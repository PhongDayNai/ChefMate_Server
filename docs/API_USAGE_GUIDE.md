# ChefMate Server - API Usage Guide

Cập nhật: 2026-03-25 (Asia/Ho_Chi_Minh)
Trạng thái kiểm thử gần nhất: **46/46 case pass**.

---

## 1) Base URL

- Local (docker): `http://127.0.0.1:8000`

Headers mặc định cho JSON API:

```http
Content-Type: application/json
```

---

## 2) Users API

## 2.1 Lấy danh sách user
- **GET** `/api/users/all`

## 2.2 Đăng ký
- **POST** `/api/users/register`

```json
{
  "phone": "09...",
  "email": "user@example.com",
  "password": "123456",
  "fullName": "Nguyen Van A"
}
```

## 2.3 Đăng nhập
- **POST** `/api/users/login`

```json
{
  "identifier": "09... hoặc email",
  "password": "123456"
}
```

## 2.4 Quên mật khẩu
- **POST** `/api/users/forgot-password`

```json
{
  "phone": "09..."
}
```

## 2.5 Đổi mật khẩu
- **POST** `/api/users/change-password`

```json
{
  "phone": "09...",
  "currentPassword": "...",
  "newPassword": "..."
}
```

## 2.6 Cập nhật thông tin user
- **POST** `/api/users/update-user-information`

```json
{
  "userId": 1,
  "fullName": "Nguyen Van B",
  "phone": "09...",
  "email": "new@example.com"
}
```

## 2.7 Lịch sử recipe theo user
- **GET** `/api/users/recipes-view-history?userId=1`

> Đã fix lỗi crash endpoint GET.

---

## 3) Recipes API

## 3.1 Lấy toàn bộ recipe
- **GET** `/api/recipes/all`

## 3.2 Tạo recipe
- **POST** `/api/recipes/create` (multipart/form-data)
- Bắt buộc có file `image`.

Form fields chính:
- `recipeName` (string)
- `cookingTime` (string)
- `ration` (number/string)
- `userId` (number/string)
- `ingredients` (JSON string array)
- `cookingSteps` (JSON string array)
- `tags` (JSON string array, optional)

Ví dụ `ingredients`:
```json
[
  { "ingredientName": "Trứng", "weight": 2, "unit": "quả", "isMain": true, "isCommon": false }
]
```

Ví dụ `cookingSteps`:
```json
[
  { "content": "Đánh trứng" },
  { "content": "Chiên" }
]
```

## 3.3 Tìm recipe theo tên
- **POST** `/api/recipes/search`

```json
{
  "recipeName": "trứng",
  "userId": 1
}
```

## 3.4 Lấy danh sách ingredients
- **GET** `/api/recipes/ingredients`

## 3.5 Top trending
- **POST** `/api/recipes/top-trending`

```json
{ "userId": 1 }
```

## 3.6 Trending feed
- **GET** `/api/recipes/trending?userId=1&page=1&limit=10&period=all`

`period` hỗ trợ: `all`, `7d`, `30d`, `90d`

## 3.7 Trending v2
- **GET** `/api/recipes/trending-v2?userId=1&page=1&limit=10&period=all`

## 3.8 Lấy tags
- **GET** `/api/recipes/tags`

## 3.9 Tìm recipe theo tag
- **POST** `/api/recipes/search-by-tag`

```json
{
  "tagName": "Healthy",
  "userId": 1
}
```

## 3.10 Recipe theo user
- **POST** `/api/recipes/user-recipes`

```json
{ "userId": 1 }
```

## 3.11 Báo cáo tăng trưởng recipe
- **GET** `/api/recipes/growth-report`

---

## 4) Interactions API

## 4.1 Like/Unlike (toggle)
- **POST** `/api/interactions/like`

```json
{
  "userId": 1,
  "recipeId": 100
}
```

Hành vi:
- Nếu chưa like: tạo like, trả `liked: true`
- Nếu đã like: bỏ like, trả `liked: false`

Ví dụ response data:
```json
{
  "count": 3,
  "liked": true
}
```

Nếu recipe không tồn tại: `404`.

## 4.2 Thêm comment
- **POST** `/api/interactions/comment`

```json
{
  "userId": 1,
  "recipeId": 100,
  "content": "Món ngon"
}
```

## 4.3 Tăng view count
- **POST** `/api/interactions/increase-view-count`

```json
{
  "recipeId": 100
}
```

## 4.4 Lấy tất cả comment
- **GET** `/api/interactions/comments`

## 4.5 Xóa comment
- **DELETE** `/api/interactions/comment`

```json
{
  "commentId": 10
}
```

---

## 5) Pantry API

## 5.1 Lấy pantry theo user
- **GET** `/api/pantry?userId=1`

## 5.2 Upsert pantry item
- **POST** `/api/pantry/upsert`

```json
{
  "userId": 1,
  "ingredientName": "Sữa tươi",
  "quantity": 1,
  "unit": "lít",
  "expiresAt": null
}
```

## 5.3 Xóa pantry item
- **DELETE** `/api/pantry/delete`

```json
{
  "userId": 1,
  "pantryItemId": 123
}
```

Nếu không tìm thấy item: trả `404`.

---

## 6) User Diet Notes API

## 6.1 Lấy note theo user
- **GET** `/api/user-diet-notes?userId=1`

## 6.2 Upsert note (create/update)
- **POST** `/api/user-diet-notes/upsert`

Create:
```json
{
  "userId": 1,
  "noteType": "allergy",
  "label": "Hải sản",
  "keywords": ["tôm", "cá"],
  "instruction": "Tránh hải sản",
  "isActive": true
}
```

Update:
```json
{
  "userId": 1,
  "noteId": 5,
  "noteType": "restriction",
  "label": "Đường",
  "keywords": ["sugar"],
  "instruction": "Giảm tối đa"
}
```

Nếu update với `noteId` không tồn tại: trả `404`.

## 6.3 Xóa note
- **DELETE** `/api/user-diet-notes/delete`

```json
{
  "userId": 1,
  "noteId": 5
}
```

Nếu `noteId` không tồn tại: trả `404`.

---

## 7) AI Chat API

## 7.1 Tạo session
- **POST** `/api/ai-chat/sessions`

```json
{
  "userId": 1,
  "firstMessage": "Gợi ý món đơn giản",
  "model": "gemma3:4b"
}
```

## 7.2 Lấy danh sách session
- **GET** `/api/ai-chat/sessions?userId=1&page=1&limit=20`

## 7.3 Lấy lịch sử 1 session
- **GET** `/api/ai-chat/sessions/:sessionId?userId=1`

## 7.4 Xóa session
- **DELETE** `/api/ai-chat/sessions/:id`

```json
{ "userId": 1 }
```

## 7.5 Đổi title session
- **PATCH** `/api/ai-chat/sessions/title`

```json
{
  "userId": 1,
  "chatSessionId": 10,
  "title": "Bữa tối healthy"
}
```

## 7.6 Đổi active recipe
- **PATCH** `/api/ai-chat/sessions/active-recipe`

```json
{
  "userId": 1,
  "chatSessionId": 10,
  "recipeId": 100
}
```

## 7.7 Gợi ý từ pantry
- **POST** `/api/ai-chat/recommendations-from-pantry`

```json
{
  "userId": 1,
  "limit": 10
}
```

## 7.8 Resolve session trước
- **POST** `/api/ai-chat/sessions/resolve-previous`

```json
{
  "userId": 1,
  "previousSessionId": 10,
  "action": "skip_deduction",
  "pendingUserMessage": "Tiếp tục"
}
```

`action` hỗ trợ:
- `complete_and_deduct`
- `skip_deduction`

## 7.9 Gửi message
- **POST** `/api/ai-chat/messages`

```json
{
  "userId": 1,
  "chatSessionId": 10,
  "message": "Gợi ý món từ tủ lạnh",
  "model": "gemma3:4b",
  "stream": false,
  "useUnifiedSession": true
}
```

Lưu ý:
- Có thể nhận `503` khi AI upstream bận (`AI_SERVER_BUSY`).

## 7.10 Lấy unified timeline
- **GET** `/api/ai-chat/messages?userId=1&limit=20`

---

## 8) Mã lỗi thường gặp

- `400`: dữ liệu đầu vào thiếu/sai kiểu.
- `404`: tài nguyên không tồn tại (đã chuẩn hóa cho một số delete/upsert).
- `500`: lỗi nội bộ server.
- `503`: AI upstream bận/tạm không khả dụng.

---

## 9) Ghi chú kiểm thử

Bộ test end-to-end gần nhất bao gồm:
- Tạo user mới
- Tạo recipe mới
- Test toàn bộ luồng users/recipes/interactions/pantry/diet-notes/ai-chat
- Test cả case success + not-found behavior đã chuẩn hóa

Kết quả: **46/46 pass**.
