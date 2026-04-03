# CLIENT CHAT V2 — HƯỚNG DẪN TRIỂN KHAI ĐẦY ĐỦ (Web/Mobile)

> Cập nhật theo backend hiện tại ngày 2026-04-03.
> Mục tiêu: client có thể triển khai đầy đủ chat v2 theo flow multi-recipes, unified mode, retry UX, và complete meal session.
>
> Ghi chú quan trọng: endpoint `POST /messages` hiện **không** trả `data.focus`; hãy lấy focus từ `data.session.activeRecipeId` và tự suy ra `needsSelection` khi cần.

---

## 1) Mục tiêu nghiệp vụ

Chat V2 phục vụ **1 phiên nấu nhiều món** (meal session), trong đó:
- Có danh sách món trong bữa (`meal.items`).
- Có món đang focus (`activeRecipeId`) hoặc meal-level (không focus cụ thể).
- Có trạng thái từng món: `pending | cooking | done | skipped`.
- Có cơ chế xác nhận khi đóng món đang focus mà vẫn còn món khác (`PENDING_PRIMARY_RECIPE_SWITCH_CONFIRMATION`).
- Có thể gửi chat theo 2 mode:
  1. **Có `chatSessionId`** (rõ phiên)
  2. **Unified mode** (không truyền `chatSessionId`, backend tự dùng session gần nhất)
- Có API đóng phiên nấu rõ nghĩa nghiệp vụ.

---

## 2) Base URL + endpoint

Base path: `/api/ai-chat/v2`

### Write APIs
1. `POST /sessions/meal`
2. `PATCH /sessions/meal/recipes`
3. `PATCH /sessions/meal/primary-recipe`
4. `PATCH /sessions/meal/recipes/status`
5. `POST /messages`
6. `PATCH /sessions/meal/complete` ✅ (mới)

### Read/hydrate (khuyến nghị)
- Timeline/sessions có thể đọc từ API read hiện có (v1/unified read) tùy kiến trúc client.
- Với màn planner đang mở, ưu tiên sync state từ response write để giảm số call.

---

## 3) Data contract quan trọng

## 3.1 Meal item
Mỗi phần tử trong `data.meal.items[]` nên coi là source of truth cho UI món:
- `recipeId`
- `recipeName`
- `sortOrder`
- `status`
- `servingsOverride`
- `note`

## 3.2 Focus
`data.focus`:
- `activeRecipeId: number | null`
- `needsSelection: boolean`

Quy ước:
- `needsSelection=true` khi có >1 món mà chưa có focus.
- Khi đó client mở picker để user chọn món focus, hoặc vẫn cho chat meal-level.

## 3.3 Pending switch payload
Khi update status trả `code=PENDING_PRIMARY_RECIPE_SWITCH_CONFIRMATION`, xem `data.pendingSwitch`:
- `reason`
- `closedRecipeId`
- `closedRecipeStatus`
- `currentPrimaryRecipeId`
- `candidateNextPrimaryRecipeIds`
- `suggestedNextPrimaryRecipeId`
- `confirmField` (hiện tại: `confirmSwitchPrimary`)
- `chooseField` (hiện tại: `nextPrimaryRecipeId`)

> Client phải ưu tiên dùng `confirmField/chooseField` từ payload để future-proof.

---

## 4) Hướng dẫn theo từng API

## 4.1 Tạo meal session

### Request
`POST /api/ai-chat/v2/sessions/meal`
```json
{
  "userId": 4,
  "title": "Bữa tối nhanh",
  "recipeIds": [123, 124, 125]
}
```

### Client xử lý
1. Lưu `chatSessionId` từ `data.session.chatSessionId`.
2. Render `data.meal.items`.
3. Đồng bộ `focus` (`activeRecipeId`, `needsSelection`).
4. Nếu `needsSelection=true`, mở focus picker.

---

## 4.2 Replace danh sách món

### Request
`PATCH /api/ai-chat/v2/sessions/meal/recipes`
```json
{
  "userId": 4,
  "chatSessionId": 88,
  "recipes": [
    { "recipeId": 124, "sortOrder": 1, "status": "pending" },
    { "recipeId": 123, "sortOrder": 2, "status": "pending" }
  ]
}
```

### Client xử lý
- Thay toàn bộ local `meal.items` bằng response.
- Sync lại `focus` ngay sau replace.

---

## 4.3 Set/Clear primary recipe (focus)

### Request set focus
`PATCH /api/ai-chat/v2/sessions/meal/primary-recipe`
```json
{
  "userId": 4,
  "chatSessionId": 88,
  "recipeId": 124
}
```

### Request clear focus
```json
{
  "userId": 4,
  "chatSessionId": 88,
  "recipeId": null
}
```

### Client xử lý
- Dùng response để cập nhật `activeRecipeId`.
- Nếu clear focus và `needsSelection=true`, mở picker hoặc chat meal-level.

---

## 4.4 Update status 1 món

### Request thường
`PATCH /api/ai-chat/v2/sessions/meal/recipes/status`
```json
{
  "userId": 4,
  "chatSessionId": 88,
  "recipeId": 124,
  "status": "done",
  "note": "xong món khai vị"
}
```

### Trường hợp cần xác nhận đổi focus
Nếu đóng món đang focus và vẫn còn món pending/cooking, backend trả:
- HTTP 200
- `code = PENDING_PRIMARY_RECIPE_SWITCH_CONFIRMATION`

Client hiển thị modal confirm, sau đó gọi lại cùng endpoint:
```json
{
  "userId": 4,
  "chatSessionId": 88,
  "recipeId": 124,
  "status": "done",
  "confirmSwitchPrimary": true,
  "nextPrimaryRecipeId": 123
}
```

> Khuyến nghị: map field động từ `pendingSwitch.confirmField` + `pendingSwitch.chooseField` thay vì hard-code.

---

## 4.5 Gửi chat AI v2

### A) Mode có sessionId
`POST /api/ai-chat/v2/messages`
```json
{
  "userId": 4,
  "chatSessionId": 88,
  "message": "Lên timeline nấu 2 món này trong 45 phút",
  "stream": false
}
```

### B) Unified mode (không sessionId)
```json
{
  "userId": 4,
  "message": "Tiếp tục kế hoạch bữa tối",
  "stream": false
}
```

Backend sẽ dùng session gần nhất nếu `useUnifiedSession=true` (default).

### Client xử lý
- HTTP 200:
  - Append `assistantMessage`.
  - Sync `meal` từ `data.meal.items`.
  - Sync focus từ `data.session.activeRecipeId` (**không có `data.focus` ở endpoint này**).
  - Nếu cần `needsSelection`, tự tính theo rule: `meal.items.length > 1 && !data.session.activeRecipeId`.
- HTTP 503 (`AI_SERVER_BUSY`): theo mục 5.3 (retry UX).

---

## 4.6 Đóng phiên nấu (mới)

### Request
`PATCH /api/ai-chat/v2/sessions/meal/complete`
```json
{
  "userId": 4,
  "chatSessionId": 88,
  "completionType": "completed",
  "note": "Đã nấu xong bữa tối",
  "markRemainingStatus": "done"
}
```

### Field semantics
- `completionType`: `completed | abandoned` (default `completed`)
- `markRemainingStatus`: `null | done | skipped`
  - Nếu `done/skipped`: backend auto cập nhật toàn bộ món còn `pending/cooking`.
- Backend luôn clear focus (`activeRecipeId = null`) khi complete.

### Client xử lý
- Chuyển session sang trạng thái “đã hoàn tất theo nghiệp vụ” ở UI.
- Disable write actions cho session này hoặc điều hướng tạo session mới.
- Vẫn cho xem lịch sử cũ bình thường.

> Lưu ý: backend hiện chưa có cờ `closed/isClosed` trên `ChatSessions` và chưa hard-block write theo trạng thái complete. Việc khóa thao tác là trách nhiệm của client/app flow.

---

## 5) Error handling chuẩn

## 5.1 HTTP 400
Input không hợp lệ (thiếu field, status sai, recipe không hợp lệ...).
- UI: toast ngắn, giữ state local cũ.

## 5.2 HTTP 404
Session không tồn tại/không thuộc user.
- UI: reload list session hoặc về màn tạo meal mới.

## 5.3 HTTP 503 — retry contract (rất quan trọng)
Khi `code=AI_SERVER_BUSY`, backend trả data dạng:
```json
{
  "retryable": true,
  "retryAfterMs": 5000,
  "failedUserMessage": { "content": "..." },
  "error": { "message": "...", "status": 503 }
}
```

### UI bắt buộc
1. **Không append assistant fallback message**.
2. Đánh dấu bubble user vừa gửi là `failed`.
3. Hiện nút `Gửi lại` nếu `retryable=true`.
4. Chờ tối thiểu `retryAfterMs` trước khi resend.
5. Resend đúng nội dung `message` cũ.

---

## 6) State machine khuyến nghị

State tối thiểu:
- `mealSession`: `{ chatSessionId, activeRecipeId, needsSelection, uiClosed }`
- `mealItems`: `MealItem[]`
- `pendingSwitch`: `null | PendingSwitchPayload`
- `messages`: `ChatMessage[]`

Trong đó `uiClosed` là cờ phía client (không phải trạng thái hard-close từ backend).

Transitions chính:
1. `CREATE_SESSION_SUCCESS` → set session + mealItems
2. `FOCUS_REQUIRED` → mở focus picker
3. `SET_PRIMARY_SUCCESS` → update focus
4. `UPDATE_STATUS_PENDING_SWITCH` → lưu pendingSwitch + mở modal
5. `UPDATE_STATUS_CONFIRMED` → clear pendingSwitch + sync state
6. `SEND_MESSAGE_SUCCESS` → append assistant + sync meal + session.activeRecipeId
7. `SEND_MESSAGE_FAILED_RETRYABLE` → mark failed user message + show resend
8. `COMPLETE_MEAL_SUCCESS` → set `uiClosed=true`, clear focus, lock write actions

---

## 7) Pseudo-code TypeScript

```ts
async function sendV2Message(userId: number, text: string) {
  try {
    const res = await api.post('/api/ai-chat/v2/messages', {
      userId,
      chatSessionId: state.chatSessionId, // có thể null nếu unified
      message: text,
      stream: false
    });

    syncMeal(res.data.data.meal?.items || []);
    state.activeRecipeId = res.data.data.session?.activeRecipeId ?? null;
    state.needsSelection = (res.data.data.meal?.items?.length || 0) > 1 && !state.activeRecipeId;
    appendAssistantMessage(res.data.data.assistantMessage);
  } catch (err: any) {
    const body = err?.response?.data;
    if (err?.response?.status === 503 && body?.code === 'AI_SERVER_BUSY') {
      markUserMessageFailed({
        text: body?.data?.failedUserMessage?.content || text,
        retryAfterMs: body?.data?.retryAfterMs || 5000,
        canRetry: body?.data?.retryable === true
      });
      return;
    }
    throw err;
  }
}

async function completeMealSession(userId: number) {
  const res = await api.patch('/api/ai-chat/v2/sessions/meal/complete', {
    userId,
    chatSessionId: state.chatSessionId,
    completionType: 'completed',
    markRemainingStatus: 'done'
  });

  syncMealAndFocus(res.data.data);
  state.uiClosed = true;
  disableWriteActionsForClosedSession();
}
```

---

## 8) Checklist Definition of Done

- [ ] Tạo meal session từ `recipeIds` + render đầy đủ items.
- [ ] Hỗ trợ `needsSelection=true` để chọn focus.
- [ ] Có replace/reorder meal recipes.
- [ ] Update status món + xử lý đúng `PENDING_PRIMARY_RECIPE_SWITCH_CONFIRMATION`.
- [ ] Dùng dynamic fields từ `pendingSwitch` cho confirm flow.
- [ ] Hỗ trợ cả 2 mode gửi chat: có sessionId + unified mode.
- [ ] Xử lý 503 retry UX chuẩn (`retryable/retryAfterMs/failedUserMessage`).
- [ ] Có action đóng phiên nấu `PATCH /sessions/meal/complete`.
- [ ] Sau complete: clear focus + set cờ `uiClosed` + khóa write actions ở client.

---

## 9) Lưu ý migration từ chat cũ

- API v1 (`/api/ai-chat/*`) vẫn có thể chạy song song.
- Màn planner/chat mới nên dùng v2 cho write flow meal-level.
- Tránh trộn state cũ và mới trong cùng store mà không có adapter rõ ràng.

---

## 10) Smoke test nhanh (manual)

1. Tạo session 2-3 món
2. Set primary
3. Đổi status món primary sang done (expect pending switch)
4. Confirm switch
5. Gửi chat có sessionId
6. Gửi chat không sessionId (unified)
7. Ép AI busy (nếu có môi trường test) để verify 503 resend UX
8. Complete meal session
9. Verify `uiClosed=true` + focus null + write actions disabled

---

Nếu cần, có thể tách tiếp tài liệu này thành:
- `WEB_CHAT_V2_UI_SPEC.md`
- `MOBILE_CHAT_V2_UI_SPEC.md`
- `CHAT_V2_ERROR_CATALOG.md`
để đội FE triển khai song song nhanh hơn.
