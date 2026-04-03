# ChefMate Client API Guide (JWT) — Port 13081

> Cập nhật: 2026-04-03  
> Base URL mới: `http://<host>:13081`  
> Mục tiêu: hướng dẫn client (web/mobile) migrate từ flow cũ truyền `userId` sang JWT `accessToken`/`refreshToken`.

---

## 1) Tổng quan thay đổi

### 1.1 Auth model mới
- Dùng **Bearer accessToken** cho API private.
- Dùng **refreshToken** để cấp lại accessToken.
- **Không truyền `userId` từ client** cho các API private nữa (khi dùng JWT).
- Backend tự lấy `userId` từ token.
- Một số API public hỗ trợ **optional Bearer token** để cá nhân hoá kết quả (ví dụ `isLiked`). Không có token vẫn gọi được như public.

### 1.2 Song song 2 backend
- Legacy: `:8000` (giữ nguyên để tương thích cũ)
- JWT: `:13081` (API mới cho client migrate)
- Cùng dùng chung database.

### 1.3 Header chuẩn
```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

---

## 2) Auth flow chuẩn cho client

## 2.1 Đăng nhập
`POST /api/users/login`

Request:
```json
{
  "identifier": "email-hoac-phone",
  "password": "..."
}
```

Response thành công (rút gọn):
```json
{
  "success": true,
  "data": {
    "user": { "userId": 1, "fullName": "...", "phone": "...", "email": "..." },
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

## 2.2 Refresh token
`POST /api/users/refresh-token`

Request:
```json
{ "refreshToken": "..." }
```

Response: trả `accessToken` mới (kèm refreshToken mới).

## 2.3 Xử lý 401
Khi API private trả 401:
1. Gọi `POST /api/users/refresh-token`
2. Nếu refresh thành công → retry request cũ 1 lần
3. Nếu refresh fail → logout về màn login

---

## 3) Danh sách API theo nhóm

## 3.1 Users

### Public
- `GET /api/users/all`
- `POST /api/users/register`
- `POST /api/users/login`
- `POST /api/users/refresh-token`
- `POST /api/users/forgot-password`
- `POST /api/users/change-password`

### Private (cần Bearer token)
- `GET /api/users/recipes-view-history`
- `POST /api/users/update-user-information` *(giữ tương thích cũ)*
- `PATCH /api/users/me` *(khuyến nghị dùng mới)*

Request update profile:
```json
{
  "fullName": "Nguyen Van A",
  "phone": "09...",
  "email": "a@x.com"
}
```

---

## 3.2 Recipes

### Public
- `GET /api/recipes/all`
- `GET /api/recipes/search?q=<keyword>` *(optional Bearer: có token thì trả `isLiked` theo user)*
- `POST /api/recipes/search` *(legacy-compatible, optional Bearer)
- `GET /api/recipes/ingredients`
- `GET /api/recipes/trending?page=1&limit=20&period=all` *(optional Bearer: có token thì `isLiked` theo user, không token thì `isLiked=false`)*
- `GET /api/recipes/trending-v2?page=1&limit=20&period=all` *(optional Bearer tương tự)*
- `GET /api/recipes/tags`
- `GET /api/recipes/by-tag?tagName=<tag>` *(optional Bearer)*
- `POST /api/recipes/search-by-tag` *(legacy-compatible, optional Bearer)*
- `GET /api/recipes/growth-report`

### Private
- `POST /api/recipes/create` *(multipart/form-data, **không gửi userId**)*
- `GET /api/recipes/top-trending`
- `POST /api/recipes/top-trending` *(legacy-compatible)*
- `GET /api/recipes/me`
- `POST /api/recipes/user-recipes` *(legacy-compatible, không cần body userId)*
- `GET /api/recipes/admin/pending`

### Admin review (hiện giữ như cũ)
- `PATCH /api/recipes/admin/review`

Request:
```json
{
  "recipeId": 123,
  "status": "approved"
}
```

---

## 3.3 Interactions

### Public
- `GET /api/interactions/comments`
- `POST /api/interactions/increase-view-count`

### Private
- `POST /api/interactions/like`
- `POST /api/interactions/comment`
- `DELETE /api/interactions/comment`

Like request:
```json
{ "recipeId": 123 }
```

Comment request:
```json
{
  "recipeId": 123,
  "content": "Món này ngon"
}
```

Delete comment request:
```json
{ "commentId": 456 }
```

---

## 3.4 Pantry

> Tất cả đều private.

- `GET /api/pantry`
- `POST /api/pantry/upsert`
- `DELETE /api/pantry/delete`

Upsert request:
```json
{
  "ingredientName": "Thịt bò",
  "quantity": 1,
  "unit": "kg",
  "expiresAt": null
}
```

Delete request:
```json
{ "pantryItemId": 99 }
```

---

## 3.5 User Diet Notes

> Tất cả đều private.

- `GET /api/user-diet-notes`
- `POST /api/user-diet-notes/upsert`
- `DELETE /api/user-diet-notes/delete`

Upsert request:
```json
{
  "noteType": "preference",
  "label": "ít cay",
  "keywords": ["cay"],
  "instruction": "giảm ớt",
  "isActive": true,
  "startAt": null,
  "endAt": null
}
```

Delete request:
```json
{ "noteId": 12 }
```

---

## 3.6 AI Chat v1 (`/api/ai-chat`)

> Tất cả endpoint dưới đây đều private.  
> Trên `:13081`, chat đang bật chế độ bảo mật kép: **bắt buộc đồng thời**
> 1) `Authorization: Bearer <accessToken>`
> 2) `x-api-key: __CHANGE_ME_CHAT_API_KEY__`
> Thiếu 1 trong 2 sẽ bị `401`.

- `POST /sessions`
- `GET /sessions`
- `GET /sessions/:sessionId`
- `DELETE /sessions/:id`
- `PATCH /sessions/title`
- `PATCH /sessions/active-recipe`
- `GET /recommendations-from-pantry`
- `POST /recommendations-from-pantry` *(legacy-compatible)*
- `POST /sessions/resolve-previous`
- `POST /messages`
- `GET /messages`

Send message request:
```json
{
  "chatSessionId": 88,
  "message": "Gợi ý món tối",
  "stream": false,
  "useUnifiedSession": true
}
```

---

## 3.7 AI Chat v2 (`/api/ai-chat/v2`)

> Tất cả endpoint đều private.

- `POST /sessions/meal`
- `PATCH /sessions/meal/recipes`
- `PATCH /sessions/meal/recipes/status`
- `PATCH /sessions/meal/primary-recipe`
- `PATCH /sessions/meal/complete`
- `POST /messages`

Create meal session:
```json
{
  "title": "Bữa tối",
  "recipeIds": [123, 124]
}
```

Send v2 message:
```json
{
  "chatSessionId": 88,
  "message": "Lên timeline 45 phút",
  "stream": false
}
```

---

## 4) Mapping nhanh: API cũ -> API mới nên dùng

- `POST /api/recipes/top-trending` -> `GET /api/recipes/top-trending` (Bearer)
- `POST /api/recipes/user-recipes` -> `GET /api/recipes/me` (Bearer)
- `POST /api/recipes/search-by-tag` -> `GET /api/recipes/by-tag?tagName=...`
- `POST /api/users/update-user-information` -> `PATCH /api/users/me` (Bearer)
- `POST /api/ai-chat/recommendations-from-pantry` -> `GET /api/ai-chat/recommendations-from-pantry` (chat trên `:13081` bắt buộc cả Bearer + `x-api-key`)

> Legacy endpoints vẫn giữ trên `:13081` để chuyển đổi dần, nhưng client mới nên ưu tiên endpoint GET/PATCH ở trên.

---

## 5) Error contract tối thiểu client cần handle

- `200/201`: thành công
- `400`: payload sai/thiếu field
- `401`: thiếu token, token sai, token hết hạn
- `404`: resource không tồn tại hoặc không thuộc user
- `503`: AI server busy (chat)

---

## 6) Checklist migrate cho mobile/web

- [ ] Thêm interceptor gắn `Authorization: Bearer <accessToken>`
- [ ] Bỏ truyền `userId` trong body/query cho API private
- [ ] Thêm flow refresh token khi gặp 401
- [ ] Chuyển sang endpoint GET/PATCH mới theo mapping
- [ ] Test đủ cả unauthorized (401) và authorized (200)
- [ ] Với chat trên `:13081`, luôn gửi đồng thời `Authorization: Bearer <accessToken>` và `x-api-key: __CHANGE_ME_CHAT_API_KEY__`

---

## 7) Ví dụ curl nhanh

Login:
```bash
curl -X POST http://localhost:13081/api/users/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"0999xxxxxx","password":"your_password"}'
```

Get pantry:
```bash
curl http://localhost:13081/api/pantry \
  -H "Authorization: Bearer <accessToken>"
```

Get my recipes:
```bash
curl http://localhost:13081/api/recipes/me \
  -H "Authorization: Bearer <accessToken>"
```

---

Nếu cần, có thể tách tiếp thành:
- `CLIENT_API_13081_POSTMAN_COLLECTION.md`
- `CLIENT_API_13081_ERROR_CATALOG.md`
- `CLIENT_API_13081_MIGRATION_CHECKLIST.md`
để FE/mobile QA chạy song song nhanh hơn.
