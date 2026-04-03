# CLIENT API 13081 JWT GUIDE (Bản chuẩn mới)

> Cập nhật: 2026-04-03  
> Server: `http://<host>:13081`  
> Base path mới: `/v2/...`

---

## 1) Mục tiêu tài liệu
Tài liệu này dành cho mobile/web client khi gọi backend JWT ở cổng `13081`.

### Quy tắc quan trọng
- **Port 8000 (legacy)**: vẫn giữ route cũ `/api/...`.
- **Port 13081 (JWT)**: dùng route mới `/v2/...`.
- `v1/v2` ở đây là version API theo endpoint/flow nghiệp vụ, không phải copy nguyên route cũ.

---

## 2) Auth model trên 13081

## 2.1 JWT chung
Đa số API private dùng:
```http
Authorization: Bearer <accessToken>
```

Refresh token:
- `POST /v2/users/refresh-token`

## 2.2 Chat dùng dual-auth (bắt buộc cả 2)
Cho toàn bộ chat endpoint:
- `/v2/ai-chat/*` (chat v2 meal flow)
- `/v2/ai-chat-v1/*` (chat v1 flow)

Bắt buộc gửi đồng thời:
```http
Authorization: Bearer <accessToken>
x-api-key: __CHANGE_ME_CHAT_API_KEY__
```
Thiếu 1 trong 2 -> `401`.

---

## 3) Danh sách endpoint đầy đủ (13081)

## 3.1 Users
Base: `/v2/users`

### Public
- `GET /all`
- `POST /register`
- `POST /login`
- `POST /refresh-token`
- `POST /forgot-password`
- `POST /change-password`

### Private (Bearer)
- `GET /recipes-view-history`
- `POST /update-user-information` (legacy-compatible)
- `PATCH /me` (khuyến nghị)

---

## 3.2 Recipes
Base: `/v2/recipes`

### Public
- `GET /all`
- `GET /search?q=...` (optional Bearer)
- `POST /search` (optional Bearer)
- `GET /ingredients`
- `GET /tags`
- `GET /by-tag?tagName=...` (optional Bearer)
- `POST /search-by-tag` (optional Bearer)
- `GET /growth-report`

### Trending mapping mới
- `GET /trending` -> **behavior cũ của `/api/recipes/trending-v2`**
- `GET /trending-v1` -> behavior cũ của `/api/recipes/trending`
- `GET /trending-v2` -> alias tương thích tạm (same behavior với `/trending`)

### Private (Bearer)
- `POST /create`
- `GET /top-trending`
- `POST /top-trending` (legacy-compatible)
- `GET /me`
- `POST /user-recipes` (legacy-compatible)
- `GET /admin/pending`
- `PATCH /admin/review`

### Optional Bearer nghĩa là gì?
- Không có token: vẫn trả kết quả public, `isLiked=false`.
- Có token: cá nhân hoá `isLiked` theo user.

---

## 3.3 Interactions
Base: `/v2/interactions`

### Public
- `GET /comments`
- `POST /increase-view-count`

### Private (Bearer)
- `POST /like`
- `POST /comment`
- `DELETE /comment`

---

## 3.4 Pantry (private)
Base: `/v2/pantry`

- `GET /`
- `POST /upsert`
- `DELETE /delete`

---

## 3.5 User diet notes (private)
Base: `/v2/user-diet-notes`

- `GET /`
- `POST /upsert`
- `DELETE /delete`

---

## 3.6 Chat v2 (meal flow)
Base: `/v2/ai-chat`  
Auth: **Bearer + x-api-key**

- `POST /sessions/meal`
- `PATCH /sessions/meal/recipes`
- `PATCH /sessions/meal/recipes/status`
- `PATCH /sessions/meal/primary-recipe`
- `PATCH /sessions/meal/complete`
- `POST /messages`

---

## 3.7 Chat v1 (legacy flow)
Base: `/v2/ai-chat-v1`  
Auth: **Bearer + x-api-key**

- `POST /sessions`
- `GET /sessions`
- `GET /sessions/:sessionId`
- `DELETE /sessions/:id`
- `PATCH /sessions/title`
- `PATCH /sessions/active-recipe`
- `GET /recommendations-from-pantry`
- `POST /recommendations-from-pantry`
- `POST /sessions/resolve-previous`
- `POST /messages`
- `GET /messages`

---

## 4) Mapping nhanh từ route cũ -> route mới 13081

### Recipes
- `GET /api/recipes/trending-v2` -> `GET /v2/recipes/trending`
- `GET /api/recipes/trending` -> `GET /v2/recipes/trending-v1`
- `GET /api/recipes/all` -> `GET /v2/recipes/all`

### Chat
- `POST /api/ai-chat/v2/messages` -> `POST /v2/ai-chat/messages`
- `POST /api/ai-chat/messages` -> `POST /v2/ai-chat-v1/messages`

### Users
- `POST /api/users/login` -> `POST /v2/users/login`
- `POST /api/users/refresh-token` -> `POST /v2/users/refresh-token`

---

## 5) Error handling chuẩn client

- `200/201`: thành công
- `400`: payload sai
- `401`: thiếu token / token sai / thiếu 1 trong 2 header chat
- `404`: không tìm thấy resource
- `503`: AI server busy

### Flow xử lý 401 (không áp dụng nếu thiếu x-api-key ở chat)
1. Gọi `POST /v2/users/refresh-token`
2. Thành công -> retry request 1 lần
3. Thất bại -> logout

---

## 6) Ví dụ request thực tế

## 6.1 Login
```bash
curl -X POST http://localhost:13081/v2/users/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"0999xxxxxx","password":"your_password"}'
```

## 6.2 Trending mới (mapping từ trending-v2 cũ)
```bash
curl "http://localhost:13081/v2/recipes/trending?page=1&limit=20"
```

## 6.3 Trending có personalize isLiked
```bash
curl "http://localhost:13081/v2/recipes/trending?page=1&limit=20" \
  -H "Authorization: Bearer <accessToken>"
```

## 6.4 Chat v2 (dual-auth)
```bash
curl -X POST http://localhost:13081/v2/ai-chat/messages \
  -H "Authorization: Bearer <accessToken>" \
  -H "x-api-key: __CHANGE_ME_CHAT_API_KEY__" \
  -H "Content-Type: application/json" \
  -d '{"chatSessionId":88,"message":"món hiện tại cần làm gì đầu tiên"}'
```

---

## 7) Checklist migrate cho client
- [ ] Đổi base URL sang `:13081/v2`
- [ ] Thay route theo mapping ở mục 4
- [ ] API private: thêm Bearer token
- [ ] Chat API: thêm cả Bearer + x-api-key
- [ ] Với recipes public optional token: hỗ trợ cả mode có/không có token
- [ ] QA đủ cả case unauthorized/authorized
