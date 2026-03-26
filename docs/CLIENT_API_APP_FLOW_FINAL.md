# ChefMate — Client API & App Flow (Bản Hoàn Thiện Cuối)

> Mục tiêu: tài liệu chuẩn để team client implement ổn định, ưu tiên đúng hành vi backend hiện tại.  
> Cập nhật: 2026-03-26 (Asia/Ho_Chi_Minh)

---

## 0) Phạm vi rà soát & nguồn đối chiếu

Em đã rà soát toàn bộ docs hiện có trong `docs/` và đối chiếu trực tiếp route/controller/model.

### 0.1 Tài liệu đã đọc theo thời gian sửa
- `SYSTEM_OVERVIEW.md` — 2026-03-22 13:26
- `PROJECT_STATUS.md` — 2026-03-22 13:26
- `AI_CHAT_UNIFIED_FLOW_GUIDE.md` — 2026-03-23 14:25
- `CLIENT_CHAT_INTEGRATION_GUIDE.md` — 2026-03-23 16:51
- `API_USAGE_GUIDE.md` — 2026-03-25 01:31
- `openapi.json` — 2026-03-25 01:41
- `CLIENT_API_APP_FLOW_DETAILED.md` — 2026-03-26 13:49

### 0.2 Nguồn sự thật kỹ thuật (source of truth)
1. **Code route/controller/model hiện tại** (ưu tiên cao nhất)
2. `openapi.json`
3. Các guide markdown cũ

Khi có khác biệt nhỏ giữa docs cũ, tài liệu này chọn theo code mới nhất.

---

## 1) Base API & nguyên tắc chung

- Base URL production: `https://api.example.com`
- Swagger UI: `/api-docs`
- OpenAPI JSON: `/api-docs/openapi.json`

Response chuẩn:

```json
{
  "success": true,
  "data": {},
  "message": "..."
}
```

Một số case có `code`:
- `AI_SERVER_BUSY` (HTTP 503)
- `PENDING_PREVIOUS_RECIPE_COMPLETION` (HTTP 200, nhưng nghiệp vụ chặn để user xác nhận)

---

## 2) Endpoint inventory (đã verify theo route)

## 2.1 User
- `GET /api/users/all`
- `POST /api/users/register`
- `POST /api/users/login`
- `POST /api/users/forgot-password`
- `POST /api/users/change-password`
- `GET /api/users/recipes-view-history`
- `POST /api/users/update-user-information`

## 2.2 Recipe
- `GET /api/recipes/all`
- `POST /api/recipes/create` (multipart)
- `POST /api/recipes/search`
- `GET /api/recipes/ingredients`
- `POST /api/recipes/top-trending` (legacy)
- `GET /api/recipes/trending`
- `GET /api/recipes/trending-v2`
- `GET /api/recipes/tags`
- `POST /api/recipes/search-by-tag`
- `POST /api/recipes/user-recipes`
- `GET /api/recipes/growth-report`

## 2.3 Interaction
- `POST /api/interactions/like`
- `POST /api/interactions/comment`
- `DELETE /api/interactions/comment`
- `POST /api/interactions/increase-view-count`
- `GET /api/interactions/comments`

## 2.4 Pantry
- `GET /api/pantry?userId=...`
- `POST /api/pantry/upsert`
- `DELETE /api/pantry/delete`

## 2.5 User Diet Notes
- `GET /api/user-diet-notes?userId=...`
- `POST /api/user-diet-notes/upsert`
- `DELETE /api/user-diet-notes/delete`

## 2.6 AI Chat
- `POST /api/ai-chat/sessions`
- `GET /api/ai-chat/sessions?userId=&page=&limit=`
- `GET /api/ai-chat/sessions/:sessionId?userId=`
- `DELETE /api/ai-chat/sessions/:id?userId=`
- `PATCH /api/ai-chat/sessions/title`
- `PATCH /api/ai-chat/sessions/active-recipe`
- `POST /api/ai-chat/recommendations-from-pantry`
- `POST /api/ai-chat/sessions/resolve-previous`
- `POST /api/ai-chat/messages`
- `GET /api/ai-chat/messages` (unified timeline + lazy load)

---

## 3) Trục nghiệp vụ chính cho client

1. **Diet Notes** (dị ứng/hạn chế/sở thích/health)
2. **Pantry** (nguyên liệu thực có)
3. **Recommendations** (lọc theo diet + so khớp pantry)
4. **Chat Session Lifecycle** (session mới/cũ, active recipe, pending resolution)
5. **Unified Timeline** (chat UI 1 luồng, lazy-load)

---

## 4) Flow chuẩn theo màn hình

## 4.1 Home
1. `GET /api/user-diet-notes?userId=...`
2. `GET /api/pantry?userId=...`
3. `POST /api/ai-chat/recommendations-from-pantry`

Render:
- Nhóm `ready_to_cook`
- Nhóm `almost_ready`

## 4.2 Màn Dị ứng/Hạn chế
- CRUD qua `/api/user-diet-notes/*`
- `noteType` enum bắt buộc:
  - `allergy`
  - `restriction`
  - `preference`
  - `health_note`

Sau mỗi thay đổi note -> refresh recommendations.

## 4.3 Màn Tủ lạnh
- CRUD qua `/api/pantry/*`
- Sau mỗi upsert/delete -> refresh pantry + recommendations.

## 4.4 Màn Chat (UI khuyến nghị)
- Chat chính nên là **1 timeline unified**:
  - load: `GET /api/ai-chat/messages?userId=...&limit=30`
  - lazy-load: thêm `beforeMessageId`
- Gửi tin nhắn:
  - `POST /api/ai-chat/messages`
  - có thể không truyền `chatSessionId` (unified behavior)

---

## 5) Cơ chế session lifecycle (đã đối chiếu model)

## 5.1 Khi nào tạo session mới?

Session mới có thể được tạo bởi backend trong các nhánh:

1. `POST /api/ai-chat/sessions` (tạo tường minh)
2. `POST /api/ai-chat/messages` khi không có session phù hợp
3. `POST /api/ai-chat/sessions/resolve-previous` (sau khi chốt session cũ)
4. `GET /api/ai-chat/messages` lần đầu nếu user chưa có session (default session)

## 5.2 Tin nhắn đầu tiên của session mới

Backend luôn chèn intro message của **Bepes** vào đầu session mới:

> “Xin chào anh, em là Bepes – trợ lý nấu ăn của ChefMate...”

Áp dụng cho create session, auto-create và resolve-previous.

## 5.3 “Kết thúc session cũ” hiện tại nghĩa là gì?

Hiện chưa có cờ `closed` riêng cho session.  
Flow chốt session cũ được thực hiện nghiệp vụ qua `resolve-previous`:

- clear `activeRecipeId` ở session cũ
- thêm assistant log message ghi nhận lựa chọn
- tạo session mới để tiếp tục

=> Session cũ vẫn nằm trong lịch sử.

## 5.4 Pending previous recipe (case bắt buộc handle)

Khi user nhắn tin mới, nếu session gần nhất còn món chưa chốt và quá ngưỡng thời gian, API có thể trả:
- `code: PENDING_PREVIOUS_RECIPE_COMPLETION`
- `actions`: `complete_and_deduct` / `skip_deduction`

Client phải:
1. mở modal bắt buộc
2. gọi `POST /api/ai-chat/sessions/resolve-previous`
3. chuyển state sang `newSession`
4. reload timeline

---

## 6) Lưu ý quan trọng về trừ nguyên liệu

`action = complete_and_deduct` hiện tại **mới là ghi nhận nghiệp vụ**, backend chưa auto-trừ kho thật sự theo transaction draft/confirm/apply.

Vì vậy client hiện tại nên:
- hiểu đây là xác nhận hoàn thành món ở mức flow chat
- nếu cần chỉnh kho, cho user cập nhật Pantry thủ công (upsert/delete)

---

## 7) Recommendations logic (đã verify model)

`POST /api/ai-chat/recommendations-from-pantry`

- Ưu tiên `ready_to_cook` trước
- Thiếu slot thì bù `almost_ready`
- Có `index` tuần tự và `recommendationType`
- Có lọc theo active diet notes để chặn recipe vi phạm dị ứng/hạn chế

Client nên render theo đúng thứ tự server trả, không tự sort lại index.

---

## 8) Error handling chuẩn cho client

## 8.1 Mã lỗi
- `400`: input sai/thiếu
- `404`: session/item không tồn tại hoặc không thuộc user
- `500`: lỗi server
- `503` + `AI_SERVER_BUSY`: AI upstream bận

## 8.2 Retry policy khuyến nghị
- Chỉ auto retry cho `AI_SERVER_BUSY`
- backoff: `3s -> 5s -> 8s` (max 3)
- Không auto retry lỗi 4xx

---

## 9) Integration checklist (chuẩn release)

- [ ] Lưu và dùng `userId` nhất quán toàn app
- [ ] Màn chat chính dùng `GET /api/ai-chat/messages` (unified)
- [ ] Lazy-load có dedupe theo `chatMessageId`
- [ ] Handle đầy đủ `PENDING_PREVIOUS_RECIPE_COMPLETION`
- [ ] Handle `AI_SERVER_BUSY` + retry policy
- [ ] CRUD pantry + diet hoạt động ổn
- [ ] Sau pantry/diet update có refresh recommendations
- [ ] Chuyển session đúng khi resolve previous
- [ ] Render intro message đầu phiên đúng

---

## 10) Pseudocode ngắn (flow quan trọng nhất)

```ts
async function sendChat(userId: number, message: string) {
  const res = await api.post('/api/ai-chat/messages', { userId, message, stream: false });

  if (res.data?.code === 'PENDING_PREVIOUS_RECIPE_COMPLETION') {
    const p = res.data.data;
    const action = await openResolveModal(p.actions, p.reminderMessage);

    await api.post('/api/ai-chat/sessions/resolve-previous', {
      userId,
      previousSessionId: p.previousSessionId,
      action,
      pendingUserMessage: p.pendingUserMessage || ''
    });
  }

  await reloadUnifiedTimeline(userId);
}
```

---

## 11) Kết luận triển khai

Bản này là bản hợp nhất sau rà soát toàn docs cũ + code hiện tại.  
Nếu team client bám đúng các flow ở mục **4 + 5 + 8 + 9** thì sẽ tránh được toàn bộ lỗi tích hợp phổ biến của ChefMate hiện tại.
