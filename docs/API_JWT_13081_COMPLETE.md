# API JWT 13081 — Full Integration Guide (chỉ JWT, không legacy)

> Cập nhật: 2026-04-06  
> Server: `http://<host>:13081`  
> Base path: `/v2/...`

Tài liệu này là bản **đầy đủ để tích hợp client** cho backend JWT cổng `13081`.  
**Không bao gồm** route legacy `/api/...`.

---

## 1) Auth model

## 1.1 Public
Không cần header auth.

## 1.2 Bearer (private)
```http
Authorization: Bearer <accessToken>
```

## 1.3 Dual-auth cho toàn bộ Chat
Áp dụng cho:
- `/v2/ai-chat/*` (meal flow v2)
- `/v2/ai-chat-v1/*` (chat v1 flow)

Bắt buộc gửi **đồng thời**:
```http
Authorization: Bearer <accessToken>
x-api-key: <CHAT_API_KEY>
```

Thiếu 1 trong 2 -> `401`.

---

## 2) Danh sách endpoint đầy đủ (JWT 13081)

## 2.1 Users — `/v2/users`

| Method | Endpoint | Auth | Mục đích |
|---|---|---|---|
| GET | `/all` | Public | Lấy danh sách user |
| POST | `/register` | Public | Đăng ký |
| POST | `/login` | Public | Đăng nhập |
| POST | `/refresh-token` | Public | Đổi cặp token mới từ refresh token |
| POST | `/forgot-password` | Public | Reset mật khẩu |
| POST | `/change-password` | Public | Đổi mật khẩu theo phone/current/new |
| GET | `/recipes-view-history` | Bearer | Lịch sử xem recipe của user hiện tại |
| POST | `/update-user-information` | Bearer | Update profile (legacy-compatible) |
| PATCH | `/me` | Bearer | Update profile (khuyến nghị) |

---

## 2.2 Recipes — `/v2/recipes`

| Method | Endpoint | Auth | Mục đích |
|---|---|---|---|
| GET | `/all` | Public | Lấy toàn bộ recipe |
| POST | `/create` | Bearer | Tạo recipe (multipart + image) |
| POST | `/search` | Optional Bearer | Tìm recipe theo tên |
| GET | `/search` | Optional Bearer | Tìm recipe qua query `q` hoặc `recipeName` |
| GET | `/ingredients` | Public | Danh sách nguyên liệu |
| POST | `/top-trending` | Bearer | Trending kiểu legacy-compatible |
| GET | `/top-trending` | Bearer | Trending kiểu legacy-compatible |
| GET | `/trending` | Optional Bearer | Trending mới (map từ `trending-v2` cũ) |
| GET | `/trending-v1` | Optional Bearer | Behavior cũ của `trending` |
| GET | `/trending-v2` | Optional Bearer | Alias tạm (same behavior `/trending`) |
| GET | `/tags` | Public | Danh sách tag |
| POST | `/search-by-tag` | Optional Bearer | Tìm theo tag |
| GET | `/by-tag` | Optional Bearer | Tìm theo `tagName` query |
| POST | `/user-recipes` | Bearer | Recipe của user hiện tại (legacy-compatible) |
| GET | `/me` | Bearer | Recipe của user hiện tại |
| GET | `/admin/pending` | Bearer | Danh sách recipe chờ duyệt |
| PATCH | `/admin/review` | Bearer | Duyệt recipe |
| GET | `/growth-report` | Public | Báo cáo tăng trưởng recipe |

**Optional Bearer**:
- Không token: trả dữ liệu public.
- Có token: có thể kèm field cá nhân hoá (ví dụ `isLiked`).

---

## 2.3 Interactions — `/v2/interactions`

| Method | Endpoint | Auth | Mục đích |
|---|---|---|---|
| POST | `/like` | Bearer | Toggle like/unlike recipe |
| POST | `/comment` | Bearer | Tạo comment |
| POST | `/increase-view-count` | Public | Tăng view recipe |
| GET | `/comments` | Public | Lấy danh sách comments |
| DELETE | `/comment` | Bearer | Xoá comment |

---

## 2.4 Pantry — `/v2/pantry`

| Method | Endpoint | Auth | Mục đích |
|---|---|---|---|
| GET | `/` | Bearer | Lấy pantry của user hiện tại |
| POST | `/upsert` | Bearer | Tạo/cập nhật pantry item |
| DELETE | `/delete` | Bearer | Xoá pantry item |

---

## 2.5 User Diet Notes — `/v2/user-diet-notes`

| Method | Endpoint | Auth | Mục đích |
|---|---|---|---|
| GET | `/` | Bearer | Lấy diet notes đang có |
| POST | `/upsert` | Bearer | Tạo/cập nhật diet note |
| DELETE | `/delete` | Bearer | Xoá diet note |

---

## 2.6 AI Chat v1 — `/v2/ai-chat-v1` (Dual-auth)

| Method | Endpoint | Mục đích |
|---|---|---|
| POST | `/sessions` | Tạo session chat |
| GET | `/sessions` | List session theo user (pagination) |
| GET | `/sessions/:sessionId` | Lấy history session |
| DELETE | `/sessions/:id` | Xoá session |
| PATCH | `/sessions/title` | Đổi title |
| PATCH | `/sessions/active-recipe` | Set/clear active recipe |
| POST | `/recommendations-from-pantry` | Gợi ý món từ pantry |
| GET | `/recommendations-from-pantry` | Gợi ý món từ pantry |
| POST | `/sessions/resolve-previous` | Xử lý session cũ khi có pending completion |
| POST | `/messages` | Gửi message chat |
| GET | `/messages` | Unified timeline (lazy-load) |

---

## 2.7 AI Chat v2 meal flow — `/v2/ai-chat` (Dual-auth)

| Method | Endpoint | Mục đích |
|---|---|---|
| POST | `/sessions/meal` | Tạo meal session nhiều món |
| PATCH | `/sessions/meal/recipes` | Replace toàn bộ danh sách món |
| PATCH | `/sessions/meal/recipes/status` | Cập nhật trạng thái 1 món |
| PATCH | `/sessions/meal/primary-recipe` | Set món focus (activeRecipeId) |
| PATCH | `/sessions/meal/complete` | Đóng/hoàn tất meal session |
| POST | `/sessions/meal/resolve-completion-check` | Xử lý completion check (mark done/skip/continue/complete) |
| POST | `/messages` | Chat AI theo context meal |

---

## 3) Payload chuẩn cho các flow quan trọng

## 3.1 Login + refresh

### Login
`POST /v2/users/login`
```json
{
  "identifier": "0999xxxxxx",
  "password": "your_password"
}
```

### Refresh token
`POST /v2/users/refresh-token`
```json
{
  "refreshToken": "<refresh_token>"
}
```

---

## 3.2 Search recipe (GET)
`GET /v2/recipes/search?q=ga+ran`

Có thể thay bằng:
- `recipeName=<keyword>`

---

## 3.3 Create recipe (multipart)
`POST /v2/recipes/create` (Bearer)
- field file: `image`
- fields text: `recipeName`, `cookingTime`, `ration`, `ingredients`, `cookingSteps`, `tags?`
- `ingredients/cookingSteps/tags` là JSON string.

---

## 3.4 Chat v1 gửi message
`POST /v2/ai-chat-v1/messages` (Dual-auth)
```json
{
  "chatSessionId": 26,
  "message": "Hướng dẫn bước 1 thật ngắn",
  "model": "gemma3:4b",
  "stream": false,
  "useUnifiedSession": true
}
```

Ghi chú:
- `chatSessionId` có thể bỏ trống để auto session theo logic server.
- `useUnifiedSession` mặc định true ở bản JWT wrapper/controller.

---

## 3.5 Resolve pending previous session (v1)
`POST /v2/ai-chat-v1/sessions/resolve-previous` (Dual-auth)
```json
{
  "previousSessionId": 26,
  "action": "complete_and_deduct",
  "pendingUserMessage": "ok sang món mới cho tôi"
}
```

`action` hợp lệ:
- `complete_and_deduct`
- `skip_deduction`
- `continue_current_session`

---

## 3.6 Tạo meal session (v2)
`POST /v2/ai-chat/sessions/meal` (Dual-auth)
```json
{
  "title": "Bữa tối 3 món",
  "recipeIds": [123, 124, 125]
}
```

Ghi chú:
- Nếu >1 món: thường `activeRecipeId = null`, client cần hỏi user chọn món focus.

---

## 3.7 Update status món (v2)
`PATCH /v2/ai-chat/sessions/meal/recipes/status` (Dual-auth)
```json
{
  "chatSessionId": 88,
  "recipeId": 124,
  "status": "done",
  "confirmSwitchPrimary": true,
  "nextPrimaryRecipeId": 123
}
```

`status` hợp lệ: `pending | cooking | done | skipped`

---

## 3.8 Resolve completion check (v2)
`POST /v2/ai-chat/sessions/meal/resolve-completion-check` (Dual-auth)
```json
{
  "chatSessionId": 88,
  "action": "mark_done",
  "pendingUserMessage": "tiếp theo làm gì",
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

## 3.9 Chat v2 message
`POST /v2/ai-chat/messages` (Dual-auth)
```json
{
  "chatSessionId": 88,
  "message": "Lên timeline nấu các món trong 45 phút",
  "stream": false,
  "useUnifiedSession": true
}
```

---

## 4) Business codes quan trọng cần handle ở client

## 4.1 Code của chat v1

### `PENDING_PREVIOUS_RECIPE_COMPLETION`
Phát sinh khi user đang có món cũ chưa chốt và đã quá ngưỡng nhắc.  
Client phải mở UI xác nhận action trước khi tiếp tục.

`actions` trả về:
- `complete_and_deduct`
- `skip_deduction`
- `continue_current_session`

### `AI_SERVER_BUSY` (HTTP 503)
AI bận/tạm lỗi. Nên retry có backoff.

---

## 4.2 Code của chat v2

### `PENDING_MEAL_V2_COMPLETION_CHECK`
Server yêu cầu user xác nhận món đang focus đã xong chưa.

`completionCheck.actions`:
- `mark_done`
- `mark_skipped`
- `continue_current`

### `PENDING_PRIMARY_RECIPE_SWITCH_CONFIRMATION`
Xảy ra khi user đóng món đang focus nhưng còn món khác pending/cooking và chưa confirm switch.

Client cần gửi lại `PATCH /sessions/meal/recipes/status` với:
- `confirmSwitchPrimary: true`
- `nextPrimaryRecipeId` (optional; nếu thiếu server tự chọn candidate đầu)

### `MEAL_SESSION_READY_TO_COMPLETE`
Tất cả món đã xử lý xong và server gợi ý kết thúc phiên.

### `AI_SERVER_BUSY` (HTTP 503)
AI bận/tạm lỗi. Nên retry có backoff.

---

## 5) Flow tích hợp end-to-end (khuyến nghị)

## Flow A — Auth cơ bản
1. `POST /v2/users/login`
2. Lưu `accessToken`, `refreshToken`.
3. Request nào `401` (không phải thiếu x-api-key) -> gọi `POST /v2/users/refresh-token` rồi retry 1 lần.

---

## Flow B — Chuẩn bị context nấu ăn
1. `GET /v2/user-diet-notes/`
2. `GET /v2/pantry/`
3. (tuỳ chọn) `POST /v2/ai-chat-v1/recommendations-from-pantry`

---

## Flow C — Chat v1 nhanh (single-session)
1. `POST /v2/ai-chat-v1/messages` (có thể chưa có session)
2. Nếu trả `PENDING_PREVIOUS_RECIPE_COMPLETION` -> hiển thị action sheet.
3. User chọn action -> `POST /v2/ai-chat-v1/sessions/resolve-previous`
4. Tiếp tục chat theo `newSession` hoặc `continuedSession`.

---

## Flow D — Meal planning v2 (nhiều món)
1. `POST /v2/ai-chat/sessions/meal`
2. Nếu `focus.needsSelection=true` -> hỏi user chọn món chính
   - `PATCH /v2/ai-chat/sessions/meal/primary-recipe`
3. Chat điều phối nhiều món: `POST /v2/ai-chat/messages`
4. Khi user báo xong 1 món:
   - `PATCH /v2/ai-chat/sessions/meal/recipes/status`
   - nếu trả `PENDING_PRIMARY_RECIPE_SWITCH_CONFIRMATION` -> confirm switch + gọi lại
5. Nếu trả `PENDING_MEAL_V2_COMPLETION_CHECK` -> gọi `POST /v2/ai-chat/sessions/meal/resolve-completion-check`
6. Cuối phiên:
   - `PATCH /v2/ai-chat/sessions/meal/complete`
   - hoặc theo action `complete_session` từ resolve API.

---

## Flow E — Trending feed + personalisation
1. `GET /v2/recipes/trending?page=1&limit=20&period=7d`
2. Scroll theo `hasMore` (nếu response có pagination metadata).
3. Nếu có token, client có thể nhận thêm fields cá nhân hoá (`isLiked`).

---

## 6) Error handling chuẩn

- `200/201`: thành công
- `400`: input sai / thiếu field / invalid enum
- `401`: thiếu/sai token hoặc thiếu 1 trong 2 header chat
- `404`: không tìm thấy session/resource
- `503`: AI bận (`AI_SERVER_BUSY`)

Khuyến nghị retry cho `503`:
- 3s -> 5s -> 8s (tối đa 3 lần)

---

## 7) Checklist implement cho mobile/web client

- [ ] Tách rõ auth theo nhóm API (public / bearer / dual-auth chat)
- [ ] Với chat API luôn gửi đủ `Authorization` + `x-api-key`
- [ ] Bắt và xử lý đầy đủ business codes:
  - [ ] `PENDING_PREVIOUS_RECIPE_COMPLETION`
  - [ ] `PENDING_MEAL_V2_COMPLETION_CHECK`
  - [ ] `PENDING_PRIMARY_RECIPE_SWITCH_CONFIRMATION`
  - [ ] `MEAL_SESSION_READY_TO_COMPLETE`
  - [ ] `AI_SERVER_BUSY`
- [ ] Chuẩn hoá retry 503 với backoff
- [ ] Đồng bộ session/focus state theo response server (không tự suy đoán)
- [ ] Với search/trending optional bearer: hỗ trợ cả mode có/không token

---

## 8) cURL mẫu nhanh

### Login
```bash
curl -X POST http://localhost:13081/v2/users/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"0999xxxxxx","password":"your_password"}'
```

### Trending
```bash
curl "http://localhost:13081/v2/recipes/trending?page=1&limit=20&period=7d"
```

### Chat v2 message (dual-auth)
```bash
curl -X POST http://localhost:13081/v2/ai-chat/messages \
  -H "Authorization: Bearer <accessToken>" \
  -H "x-api-key: <CHAT_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"chatSessionId":88,"message":"món này làm tiếp gì"}'
```

---

## 9) Ghi chú quan trọng

- Đây là tài liệu chuẩn cho **JWT API 13081**.
- `docs/openapi.json` hiện vẫn là tài liệu legacy `/api/...` để phục vụ swagger cũ.
- Nếu cần, có thể tách thêm 1 file `openapi.jwt.json` cho `/v2/...` để import trực tiếp vào Postman/Swagger tools.
