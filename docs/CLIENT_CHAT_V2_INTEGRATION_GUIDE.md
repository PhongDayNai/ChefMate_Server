# ChefMate Client Integration Guide — AI Chat V2 (Multi-Recipes Meal Session)

> Phiên bản: 1.0  
> Mục tiêu: giúp client (mobile/web) tích hợp đầy đủ luồng chat v2 nhiều món, bao gồm chọn món focus, cập nhật trạng thái món, xác nhận chuyển focus, và gọi AI message v2.

---

## 1) Tổng quan tư duy thiết kế

### 1.1 Vì sao có Chat V2?
Chat v1 vận hành tốt cho 1 món/1 session (`activeRecipeId` đơn), nhưng khi user nấu nhiều món trong cùng bữa sẽ khó theo dõi.  
Chat v2 giải quyết bằng cách tách:

- **Meal Session**: một phiên chat đại diện cho **1 bữa ăn**
- **Meal Items**: danh sách nhiều recipe trong cùng session
- **Focus Recipe (`activeRecipeId`)**: món đang tập trung hướng dẫn sâu

### 1.2 Nguyên tắc quan trọng của v2

1. **Không auto ép focus khi nhiều món**  
   Khi session có >1 món, backend có thể để `activeRecipeId = null` để client hỏi user chọn món focus.

2. **Đóng món focus không tự nhảy món ngay**  
   Nếu user vừa đóng món đang focus (`done`/`skipped`), backend trả:
   - `code = PENDING_PRIMARY_RECIPE_SWITCH_CONFIRMATION`  
   Client phải xác nhận món focus tiếp theo trước khi chốt.

3. **Cho phép chat meal-level khi chưa focus**  
   Nếu `activeRecipeId = null`, AI vẫn trả lời ở mức kế hoạch toàn bữa (timeline, phối hợp song song).

---

## 2) API V2 sử dụng

Base path: `/api/ai-chat/v2`

1. `POST /sessions/meal` — tạo meal session nhiều món  
2. `PATCH /sessions/meal/recipes` — thay toàn bộ danh sách món  
3. `PATCH /sessions/meal/primary-recipe` — set/clear món focus  
4. `PATCH /sessions/meal/recipes/status` — cập nhật trạng thái 1 món  
5. `POST /messages` — chat AI v2 theo context multi-recipes
6. `PATCH /sessions/meal/complete` — đóng phiên nấu (hoàn thành / tạm dừng)

Swagger đã được cập nhật trong `docs/openapi.json` (tag `AIChatV2`).

---

## 3) Data contract thực tế (những field client cần quan tâm)

## 3.1 Session + Focus
Trong response v2 thường có:

- `data.session.chatSessionId`
- `data.session.activeRecipeId` (nullable)
- `data.focus.activeRecipeId`
- `data.focus.needsSelection` (boolean)

Ý nghĩa:
- `activeRecipeId = null` + `needsSelection = true` => UI nên mở chọn món focus.

## 3.2 Meal items
`data.meal.items[]` gồm:
- `recipeId`
- `sortOrder`
- `status`: `pending | cooking | done | skipped`
- `servingsOverride`
- `note`
- `resolvedAt`
- `recipe` (thông tin hiển thị)

## 3.3 Pending switch response
Khi đóng món đang focus mà chưa confirm chuyển món:

- `success = true`
- `code = PENDING_PRIMARY_RECIPE_SWITCH_CONFIRMATION`
- `data.pendingSwitch`:
  - `currentPrimaryRecipeId`
  - `candidateNextPrimaryRecipeIds[]`
  - `suggestedNextPrimaryRecipeId`
  - `confirmField` = `confirmSwitchPrimary`
  - `chooseField` = `nextPrimaryRecipeId`

Client phải dùng chính các field này để gọi lại request confirm.

---

## 4) Flow tích hợp chuẩn (end-to-end)

## 4.1 Tạo meal session mới

### Request
`POST /api/ai-chat/v2/sessions/meal`

```json
{
  "userId": 4,
  "title": "Bữa tối 3 món",
  "recipeIds": [123, 124, 125]
}
```

### Client xử lý
1. Lưu `chatSessionId`.
2. Render `meal.items`.
3. Nếu `focus.needsSelection = true`:
   - mở bottom sheet chọn món focus.
   - gọi API set primary recipe (mục 4.3).

---

## 4.2 Cập nhật danh sách món của bữa

### Request
`PATCH /api/ai-chat/v2/sessions/meal/recipes`

```json
{
  "userId": 4,
  "chatSessionId": 88,
  "recipes": [
    { "recipeId": 124, "sortOrder": 1, "status": "cooking", "note": "món mở màn" },
    { "recipeId": 123, "sortOrder": 2, "status": "pending" },
    { "recipeId": 125, "sortOrder": 3, "status": "pending", "servingsOverride": 2 }
  ]
}
```

### Client xử lý
- Replace danh sách local theo response (không merge cũ thủ công).
- Đọc `focus.needsSelection` để quyết định hỏi chọn focus lại.

---

## 4.3 Set/Clear món focus

### Set focus
`PATCH /api/ai-chat/v2/sessions/meal/primary-recipe`

```json
{
  "userId": 4,
  "chatSessionId": 88,
  "recipeId": 124
}
```

### Clear focus
```json
{
  "userId": 4,
  "chatSessionId": 88,
  "recipeId": null
}
```

### Client lưu ý
- Chỉ cho chọn món có status `pending` hoặc `cooking`.
- Nếu server trả 400 => món đó không hợp lệ để focus (đã done/skipped hoặc không thuộc session).

---

## 4.4 Cập nhật trạng thái món

### Case A — cập nhật bình thường
`PATCH /api/ai-chat/v2/sessions/meal/recipes/status`

```json
{
  "userId": 4,
  "chatSessionId": 88,
  "recipeId": 124,
  "status": "cooking"
}
```

### Case B — đóng món focus cần xác nhận chuyển
Lần gọi 1:

```json
{
  "userId": 4,
  "chatSessionId": 88,
  "recipeId": 124,
  "status": "done"
}
```

Nếu response có `code=PENDING_PRIMARY_RECIPE_SWITCH_CONFIRMATION`, client hiển thị modal:
- “Món focus đã hoàn thành. Chuyển focus sang món nào tiếp theo?”

Lần gọi 2 (confirm):

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

### UX khuyến nghị
- Nếu user bấm “Để sau”:
  - gọi confirm với `nextPrimaryRecipeId` bỏ trống khi không còn candidate,
  - hoặc dùng `PATCH /primary-recipe` set null sau khi chốt.

---

## 4.5 Đóng phiên nấu (complete meal session)

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
- `completionType`: `completed | abandoned` (mặc định `completed`)
- `markRemainingStatus`: `null | done | skipped`
  - `done/skipped`: backend sẽ auto đổi toàn bộ món còn `pending/cooking` sang trạng thái này trước khi đóng phiên.
- Backend luôn clear focus (`activeRecipeId = null`) khi đóng phiên.

### Client xử lý
- Hiển thị trạng thái phiên đã đóng.
- Disable các action write cho phiên hiện tại (hoặc chuyển sang màn tạo phiên mới).
- Có thể vẫn cho đọc lịch sử message/session như bình thường.

---

## 4.6 Gửi chat AI v2

### Request
`POST /api/ai-chat/v2/messages`

```json
{
  "userId": 4,
  "chatSessionId": 88,
  "message": "Lên timeline nấu 2 món này trong 45 phút giúp tôi",
  "stream": false
}
```

### Không truyền sessionId
```json
{
  "userId": 4,
  "message": "Tiếp tục kế hoạch bữa tối"
}
```
- Backend sẽ dùng session gần nhất nếu `useUnifiedSession=true`.

### Client xử lý
- Khi `200`: hiển thị `assistantMessage` và đồng bộ `meal + focus`.
- Khi `503` + `code=AI_SERVER_BUSY`:
  - Không append assistant fallback message.
  - Đánh dấu bubble user vừa gửi là `failed` (dùng `failedUserMessage.content` nếu cần sync lại).
  - Dùng `retryable=true` + `retryAfterMs` để hiện nút `Gửi lại`.
  - Khi resend: gửi lại đúng payload `message` ban đầu (idempotent phía UI).

---

## 5) State machine gợi ý cho client

Gợi ý state tối thiểu:

- `mealSession`: `{ chatSessionId, activeRecipeId, needsSelection }`
- `mealItems`: `MealItem[]`
- `pendingSwitch`: `null | PendingSwitchPayload`
- `messages`: `ChatMessage[]`

Transitions chính:
1. `CREATE_SESSION_SUCCESS` -> set mealSession + mealItems
2. `FOCUS_REQUIRED` -> mở picker
3. `SET_PRIMARY_SUCCESS` -> cập nhật activeRecipeId
4. `UPDATE_STATUS_PENDING_SWITCH` -> lưu pendingSwitch + mở confirm modal
5. `UPDATE_STATUS_CONFIRMED` -> clear pendingSwitch + update data
6. `SEND_MESSAGE_SUCCESS` -> append message + sync meal/focus

---

## 6) Error handling chuẩn

- `400`: input sai/không hợp lệ (status sai, recipeId sai, nextPrimaryRecipeId không thuộc candidate)
- `404`: session không tồn tại hoặc không thuộc user
- `503` (`AI_SERVER_BUSY`): show retry UX cho chat với contract:
  - `data.retryable = true`
  - `data.retryAfterMs` (ms)
  - `data.failedUserMessage.content`
  - `data.error.message`

Khuyến nghị UI:
- 400: toast ngắn + giữ nguyên state local cũ
- 404: force reload session list/redirect về màn tạo meal mới
- 503: giữ tin user ở trạng thái failed, cho phép resend sau `retryAfterMs`

---

## 7) Checklist tích hợp (Definition of Done)

- [ ] Tạo meal session bằng `recipeIds` và render đầy đủ items
- [ ] Hỗ trợ flow `needsSelection=true` để chọn focus
- [ ] Có màn reorder/replace meal recipes
- [ ] Update status món + xử lý đúng `PENDING_PRIMARY_RECIPE_SWITCH_CONFIRMATION`
- [ ] Có API set/clear primary recipe
- [ ] Chat v2 hoạt động cả 2 mode: có sessionId và unified
- [ ] Có API đóng phiên nấu `PATCH /sessions/meal/complete`
- [ ] Đồng bộ lại `meal + focus` sau mọi thao tác write
- [ ] Xử lý chuẩn 400/404/503 (bao gồm resend theo `retryable/retryAfterMs`)

---

## 8) Pseudo-code (TypeScript style)

```ts
type MealState = {
  chatSessionId: number | null;
  activeRecipeId: number | null;
  needsSelection: boolean;
  items: any[];
  pendingSwitch: any | null;
};

async function createMeal(userId: number, recipeIds: number[]) {
  const res = await api.post('/api/ai-chat/v2/sessions/meal', { userId, recipeIds });
  const d = res.data.data;

  state.chatSessionId = d.session.chatSessionId;
  state.activeRecipeId = d.focus?.activeRecipeId ?? d.session.activeRecipeId ?? null;
  state.needsSelection = !!d.focus?.needsSelection;
  state.items = d.meal.items;

  if (state.needsSelection) openFocusPicker(d.meal.items);
}

async function markRecipeDone(userId: number, recipeId: number) {
  const payload = {
    userId,
    chatSessionId: state.chatSessionId,
    recipeId,
    status: 'done'
  };

  const res = await api.patch('/api/ai-chat/v2/sessions/meal/recipes/status', payload);
  const body = res.data;

  if (body.code === 'PENDING_PRIMARY_RECIPE_SWITCH_CONFIRMATION') {
    state.pendingSwitch = body.data.pendingSwitch;
    openSwitchConfirmModal(body.data.pendingSwitch);
    return;
  }

  syncMeal(body.data);
}

async function confirmSwitch(userId: number, recipeId: number, nextPrimaryRecipeId: number) {
  const res = await api.patch('/api/ai-chat/v2/sessions/meal/recipes/status', {
    userId,
    chatSessionId: state.chatSessionId,
    recipeId,
    status: 'done',
    confirmSwitchPrimary: true,
    nextPrimaryRecipeId
  });

  state.pendingSwitch = null;
  syncMeal(res.data.data);
}

async function sendV2Message(userId: number, text: string) {
  try {
    const res = await api.post('/api/ai-chat/v2/messages', {
      userId,
      chatSessionId: state.chatSessionId,
      message: text,
      stream: false
    });

    syncMeal(res.data.data);
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

  syncMeal(res.data.data);
  disableWriteActionsForClosedSession();
}
```

---

## 9) Ghi chú tương thích ngược

- API v1 (`/api/ai-chat/*`) vẫn còn nguyên, không bị xoá.
- Client mới nên dùng v2 cho use case nấu nhiều món.
- Có thể chạy song song: màn cũ giữ v1, màn meal planner dùng v2.

---

## 10) Khuyến nghị triển khai UI

1. **Meal Board** (danh sách món + trạng thái) riêng khỏi chat bubble.
2. **Focus pill** hiển thị rõ món đang focus ở header chat.
3. **Modal confirm switch** bắt buộc khi đóng món focus.
4. **Quick actions** trên từng món: Start / Done / Skip / Focus.
5. **Auto-scroll timeline** chỉ cho chat, không làm thay đổi focus nếu chưa confirm.

---

Nếu cần, backend có thể bổ sung thêm API read-only kiểu `GET /api/ai-chat/v2/sessions/meal/:id` để client refresh state nhanh bằng 1 call (hiện tại đã có thể đọc state mới từ các write response).