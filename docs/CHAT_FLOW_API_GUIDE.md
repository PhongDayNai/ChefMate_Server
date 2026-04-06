# CHAT FLOW API GUIDE (JWT 13081)

> Cập nhật: 2026-04-06  
> Base URL: `https://chefmate-api.phongdaynai.id.vn` (hoặc `http://localhost:13081`)  
> Chỉ áp dụng cho JWT API `/v2/...`

Tài liệu này gom toàn bộ API và flow liên quan đến **chat** trong ChefMate:
- **Chat v1**: `/v2/ai-chat-v1/*`
- **Chat v2 (meal flow)**: `/v2/ai-chat/*`

---

## 1) Auth bắt buộc cho toàn bộ Chat API

Tất cả endpoint chat đều yêu cầu **dual-auth**:

```http
Authorization: Bearer <accessToken>
x-api-key: <CHAT_API_KEY>
```

Thiếu 1 trong 2 -> `401 Unauthorized`.

---

## 2) Tổng quan nhanh: nên dùng flow nào?

- Dùng **Chat v1** khi cần flow chat theo session cơ bản (single recipe/session).
- Dùng **Chat v2** khi cần điều phối **nhiều món trong một bữa** (meal planning, focus recipe, trạng thái từng món).

## 2.1 Bản mới nhất: endpoint nào nên gọi / không nên gọi

### ✅ Nên dùng ở bản mới nhất

#### Meal chat (khuyến nghị chính)
- `POST /v2/ai-chat/sessions/meal`
- `PATCH /v2/ai-chat/sessions/meal/primary-recipe`
- `PATCH /v2/ai-chat/sessions/meal/recipes/status`
- `POST /v2/ai-chat/messages`
- `POST /v2/ai-chat/sessions/meal/resolve-completion-check`
- `PATCH /v2/ai-chat/sessions/meal/complete`

#### Khi cần gợi ý từ pantry
- **Ưu tiên** `POST /v2/ai-chat-v1/recommendations-from-pantry` (payload rõ ràng, dễ mở rộng)

### ⚠️ Chỉ dùng để tương thích hoặc trường hợp đặc biệt

- Toàn bộ nhóm ` /v2/ai-chat-v1/* `: vẫn hoạt động, dùng cho client cũ/single-session.
- `GET /v2/ai-chat-v1/recommendations-from-pantry`: chỉ nên giữ cho backward compatibility.
- `GET /v2/ai-chat-v1/messages`: dùng khi màn hình cần unified timeline của v1.

### ❌ Không khuyến nghị cho client mới

- Không bắt đầu flow mới bằng ` /v2/ai-chat-v1/messages ` nếu app đã theo meal flow.
- Không phụ thuộc route legacy `/api/ai-chat...` trên server cũ cho tính năng mới.
- Không bỏ qua endpoint resolve khi server trả business code cần xác nhận:
  - `PENDING_MEAL_V2_COMPLETION_CHECK` -> phải gọi `POST /v2/ai-chat/sessions/meal/resolve-completion-check`
  - `PENDING_PRIMARY_RECIPE_SWITCH_CONFIRMATION` -> phải gọi lại `PATCH /v2/ai-chat/sessions/meal/recipes/status` với `confirmSwitchPrimary=true`
  - `PENDING_PREVIOUS_RECIPE_COMPLETION` (v1) -> phải gọi `POST /v2/ai-chat-v1/sessions/resolve-previous`

---

## 3) Chat v1 API (`/v2/ai-chat-v1`)

## 3.1 Session management

### `POST /sessions`
Tạo chat session.

### `GET /sessions`
Lấy danh sách session theo user (pagination).

Query thường dùng:
- `page` (default 1)
- `limit` (default 50)

### `GET /sessions/:sessionId`
Lấy lịch sử 1 session.

### `DELETE /sessions/:id`
Xoá session.

### `PATCH /sessions/title`
Đổi title session.

Body:
```json
{
  "chatSessionId": 26,
  "title": "Bữa tối healthy"
}
```

### `PATCH /sessions/active-recipe`
Set/clear recipe đang focus trong session.

Body:
```json
{
  "chatSessionId": 26,
  "recipeId": 123
}
```

Clear focus:
```json
{
  "chatSessionId": 26,
  "recipeId": null
}
```

---

## 3.2 Recommendation + timeline

### `POST /recommendations-from-pantry`
### `GET /recommendations-from-pantry`
Gợi ý món từ pantry (kết hợp diet notes).

Body mẫu (POST):
```json
{
  "limit": 10
}
```

### `GET /messages`
Lấy unified timeline (lazy-load).

Query:
- `limit` (default 30, max 100)
- `beforeMessageId` (để load tin cũ)

---

## 3.3 Chat message

### `POST /messages`
Gửi message chat v1.

Body mẫu:
```json
{
  "chatSessionId": 26,
  "message": "Món này bước đầu làm gì trước?",
  "model": "gemma3:4b",
  "stream": false,
  "useUnifiedSession": true
}
```

Ghi chú:
- Có thể không truyền `chatSessionId` để server tự chọn/tạo session theo logic.
- `useUnifiedSession` thường nên để `true`.

---

## 3.4 Resolve session cũ

### `POST /sessions/resolve-previous`
Dùng khi server yêu cầu xử lý món cũ trước khi đi tiếp.

Body:
```json
{
  "previousSessionId": 26,
  "action": "complete_and_deduct",
  "pendingUserMessage": "ok chuyển qua món mới"
}
```

`action` hợp lệ:
- `complete_and_deduct`
- `skip_deduction`
- `continue_current_session`

---

## 4) Business codes quan trọng của v1

## `PENDING_PREVIOUS_RECIPE_COMPLETION`
Xuất hiện từ `POST /messages` khi phiên trước có món chưa chốt.

Client cần hiển thị lựa chọn và gọi `POST /sessions/resolve-previous`.

Actions trả về:
- `complete_and_deduct`
- `skip_deduction`
- `continue_current_session`

## `AI_SERVER_BUSY` (HTTP 503)
AI tạm bận/lỗi provider.

Khuyến nghị retry:
- 3s -> 5s -> 8s (tối đa 3 lần)

---

## 5) Chat v2 API (`/v2/ai-chat`) — meal flow nhiều món

## 5.1 Session meal

### `POST /sessions/meal`
Tạo meal session.

Body:
```json
{
  "title": "Bữa tối 3 món",
  "recipeIds": [123, 124, 125]
}
```

Hoặc truyền `recipes[]` chi tiết (status/sortOrder/note/...)

---

### `PATCH /sessions/meal/recipes`
Replace toàn bộ danh sách món trong session.

Body:
```json
{
  "chatSessionId": 88,
  "recipeIds": [123, 124]
}
```

---

### `PATCH /sessions/meal/primary-recipe`
Set món focus.

Body:
```json
{
  "chatSessionId": 88,
  "recipeId": 124
}
```

Clear focus:
```json
{
  "chatSessionId": 88,
  "recipeId": null
}
```

---

### `PATCH /sessions/meal/recipes/status`
Cập nhật trạng thái 1 món trong meal.

Body:
```json
{
  "chatSessionId": 88,
  "recipeId": 124,
  "status": "done",
  "confirmSwitchPrimary": true,
  "nextPrimaryRecipeId": 123
}
```

`status` hợp lệ:
- `pending`
- `cooking`
- `done`
- `skipped`

---

### `PATCH /sessions/meal/complete`
Đóng meal session.

Body:
```json
{
  "chatSessionId": 88,
  "completionType": "completed",
  "markRemainingStatus": "done",
  "note": "kết thúc bữa"
}
```

`completionType`:
- `completed`
- `abandoned`

`markRemainingStatus`:
- `done`
- `skipped`
- `null`

---

## 5.2 Chat message v2

### `POST /messages`
Chat theo context nhiều món.

Body:
```json
{
  "chatSessionId": 88,
  "message": "Lên timeline 45 phút cho cả bữa",
  "model": "gemma3:4b",
  "stream": false,
  "useUnifiedSession": true
}
```

---

## 5.3 Resolve completion check v2

### `POST /sessions/meal/resolve-completion-check`
Xử lý nhánh confirm khi server hỏi trạng thái món hiện tại.

Body mẫu:
```json
{
  "chatSessionId": 88,
  "action": "mark_done",
  "pendingUserMessage": "ok tiếp theo làm gì",
  "nextPrimaryRecipeId": 123
}
```

`action` hợp lệ:
- `mark_done`
- `mark_skipped`
- `continue_current`
- `complete_session`
- `keep_session_open`

---

## 6) Business codes quan trọng của v2

## `PENDING_MEAL_V2_COMPLETION_CHECK`
Server yêu cầu user xác nhận món đang focus đã xong chưa.

Client hiển thị action:
- `mark_done`
- `mark_skipped`
- `continue_current`

Sau đó gọi `POST /sessions/meal/resolve-completion-check`.

## `PENDING_PRIMARY_RECIPE_SWITCH_CONFIRMATION`
Xảy ra khi đóng món đang focus nhưng còn món pending/cooking khác.

Client cần gọi lại `PATCH /sessions/meal/recipes/status` với:
- `confirmSwitchPrimary: true`
- `nextPrimaryRecipeId` (optional)

## `MEAL_SESSION_READY_TO_COMPLETE`
Tất cả món đã xử lý xong, server gợi ý kết thúc phiên.

Client cho user chọn:
- `complete_session`
- `keep_session_open`

## `AI_SERVER_BUSY` (HTTP 503)
AI bận/tạm lỗi.

Khuyến nghị retry:
- 3s -> 5s -> 8s (tối đa 3 lần)

---

## 7) Flow tích hợp chuẩn (đề xuất)

## Flow A — Chat v1 cơ bản
1. `POST /v2/ai-chat-v1/messages`
2. Nếu trả `PENDING_PREVIOUS_RECIPE_COMPLETION`:
   - Hiển thị action UI
   - `POST /v2/ai-chat-v1/sessions/resolve-previous`
3. Tiếp tục chat theo `newSession` hoặc `continuedSession` trong response.

---

## Flow B — Meal chat v2 đầy đủ
1. `POST /v2/ai-chat/sessions/meal`
2. Nếu `focus.needsSelection=true`:
   - `PATCH /v2/ai-chat/sessions/meal/primary-recipe`
3. `POST /v2/ai-chat/messages`
4. Khi user báo xong món:
   - `PATCH /v2/ai-chat/sessions/meal/recipes/status`
   - nếu trả `PENDING_PRIMARY_RECIPE_SWITCH_CONFIRMATION` -> confirm + gọi lại
5. Nếu trả `PENDING_MEAL_V2_COMPLETION_CHECK`:
   - `POST /v2/ai-chat/sessions/meal/resolve-completion-check`
6. Kết thúc:
   - `PATCH /v2/ai-chat/sessions/meal/complete`
   - hoặc action `complete_session` từ resolve API.

---

## 8) cURL mẫu để test nhanh

## 8.1 Chat v1 message
```bash
curl -X POST "https://chefmate-api.phongdaynai.id.vn/v2/ai-chat-v1/messages" \
  -H "Authorization: Bearer <accessToken>" \
  -H "x-api-key: <CHAT_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "chatSessionId": 26,
    "message": "Hướng dẫn bước đầu cho món này",
    "stream": false,
    "useUnifiedSession": true
  }'
```

## 8.2 Tạo meal session v2
```bash
curl -X POST "https://chefmate-api.phongdaynai.id.vn/v2/ai-chat/sessions/meal" \
  -H "Authorization: Bearer <accessToken>" \
  -H "x-api-key: <CHAT_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Bữa tối test",
    "recipeIds": [123, 124]
  }'
```

## 8.3 Chat v2 message
```bash
curl -X POST "https://chefmate-api.phongdaynai.id.vn/v2/ai-chat/messages" \
  -H "Authorization: Bearer <accessToken>" \
  -H "x-api-key: <CHAT_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "chatSessionId": 88,
    "message": "lên timeline nấu 2 món này",
    "stream": false
  }'
```

## 8.4 Resolve completion check v2
```bash
curl -X POST "https://chefmate-api.phongdaynai.id.vn/v2/ai-chat/sessions/meal/resolve-completion-check" \
  -H "Authorization: Bearer <accessToken>" \
  -H "x-api-key: <CHAT_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "chatSessionId": 88,
    "action": "mark_done",
    "nextPrimaryRecipeId": 123,
    "pendingUserMessage": "ok tiếp tục giúp tôi"
  }'
```

---

## 9) Checklist cho client khi tích hợp chat

- [ ] Luôn gửi đủ dual-auth cho chat API
- [ ] Handle đủ business codes (`PENDING_*`, `MEAL_SESSION_READY_TO_COMPLETE`, `AI_SERVER_BUSY`)
- [ ] Đồng bộ state theo response server (sessionId, activeRecipeId, meal items)
- [ ] Có retry policy cho 503
- [ ] Có UI action sheet cho các case cần confirm

---

## 10) Tài liệu liên quan

- Full JWT API: [`./API_JWT_13081_COMPLETE.md`](./API_JWT_13081_COMPLETE.md)
