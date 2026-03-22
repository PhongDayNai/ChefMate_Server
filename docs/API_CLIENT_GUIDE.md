# ChefMate Server API Client Guide (Cũ + Mới)

> Tài liệu này dành cho phía client (mobile/web) để tích hợp toàn bộ API hiện có.

## 1) Tổng quan

- **Base URL local (docker):** `http://127.0.0.1:8000`
- **Tiền tố API:** `/api`
- **Content-Type:** `application/json` (trừ upload ảnh dùng `multipart/form-data`)
- **Auth:** hiện tại **chưa có JWT token middleware** ở server (client tự quản lý `userId` theo phiên đăng nhập)

---

## 2) Chuẩn response

Phần lớn endpoint trả theo format:

```json
{
  "success": true,
  "data": {},
  "message": "..."
}
```

Một số endpoint cũ có thể trả khác format (`{ error: "..." }`).

---

## 3) API cũ (legacy)

## 3.1 Users - `/api/users`

### `GET /api/users/all`
Lấy toàn bộ user.

### `POST /api/users/register`
Tạo tài khoản.

Body:
```json
{
  "fullName": "Nguyen Van A",
  "phone": "0912345678",
  "email": "a@example.com",
  "password": "123456"
}
```

### `POST /api/users/login`
Đăng nhập bằng email hoặc phone.

Body:
```json
{
  "identifier": "0912345678",
  "password": "123456"
}
```

### `POST /api/users/forgot-password`
Reset password theo phone (server hiện reset về mặc định nội bộ).

Body:
```json
{
  "phone": "0912345678"
}
```

### `POST /api/users/change-password`
Đổi mật khẩu.

Body:
```json
{
  "phone": "0912345678",
  "currentPassword": "123456",
  "newPassword": "abcdef"
}
```

### `GET /api/users/recipes-view-history`
Lấy lịch sử xem công thức của user.

> Lưu ý: controller đọc từ `req.body.userId` dù route là GET.

Body:
```json
{
  "userId": 1
}
```

### `POST /api/users/update-user-information`
Cập nhật profile user.

Body:
```json
{
  "userId": 1,
  "fullName": "Nguyen Van B",
  "phone": "0988888888",
  "email": "b@example.com"
}
```

---

## 3.2 Recipes - `/api/recipes`

### `GET /api/recipes/all`
Lấy tất cả công thức.

### `POST /api/recipes/create` (multipart)
Tạo công thức mới + upload ảnh.

Form-data:
- `image`: file ảnh
- `recipeName`: string
- `cookingTime`: string (vd `30 mins`)
- `ration`: number
- `userId`: number
- `ingredients`: JSON string array
- `cookingSteps`: JSON string array
- `tags`: JSON string array (optional)

Ví dụ `ingredients`:
```json
[
  {"ingredientName":"Thịt Bò","weight":300,"unit":"g","isMain":true,"isCommon":false},
  {"ingredientName":"Nước Tương","weight":2,"unit":"tbsp","isMain":false,"isCommon":true}
]
```

### `POST /api/recipes/search`
Tìm công thức theo tên.

Body:
```json
{
  "recipeName": "phở",
  "userId": 1
}
```

### `GET /api/recipes/ingredients`
Lấy danh sách nguyên liệu.

### `POST /api/recipes/top-trending`
Lấy top công thức trending.

Body:
```json
{
  "userId": 1
}
```

### `GET /api/recipes/tags`
Lấy toàn bộ tag.

### `POST /api/recipes/search-by-tag`
Tìm theo tag.

Body:
```json
{
  "tagName": "Việt Nam",
  "userId": 1
}
```

### `POST /api/recipes/user-recipes`
Lấy công thức theo user.

Body:
```json
{
  "userId": 1
}
```

### `GET /api/recipes/growth-report`
Báo cáo tăng trưởng công thức theo tháng.

---

## 3.3 Interactions - `/api/interactions`

### `POST /api/interactions/like`
Like/unlike công thức.

Body:
```json
{
  "userId": 1,
  "recipeId": 100
}
```

### `POST /api/interactions/comment`
Thêm bình luận.

Body:
```json
{
  "userId": 1,
  "recipeId": 100,
  "content": "Món này ngon"
}
```

### `POST /api/interactions/increase-view-count`
Tăng lượt xem.

Body:
```json
{
  "recipeId": 100
}
```

### `GET /api/interactions/comments`
Lấy toàn bộ bình luận.

### `DELETE /api/interactions/comment`
Xóa bình luận.

Body:
```json
{
  "commentId": 12
}
```

---

## 4) API mới (Pantry + AI Chat)

## 4.1 Pantry - `/api/pantry`

### `GET /api/pantry?userId={id}`
Lấy toàn bộ nguyên liệu trong tủ lạnh theo user.

### `POST /api/pantry/upsert`
Thêm mới/cập nhật nguyên liệu tủ lạnh (theo `userId + ingredient + unit`).

Body:
```json
{
  "userId": 1,
  "ingredientName": "Cà rốt",
  "quantity": 300,
  "unit": "g",
  "expiresAt": "2026-03-30 00:00:00"
}
```

### `DELETE /api/pantry/delete`
Xóa item trong tủ lạnh.

Body:
```json
{
  "userId": 1,
  "pantryItemId": 10
}
```

---

## 4.2 AI Chat - `/api/ai-chat`

### `POST /api/ai-chat/sessions`
Tạo phiên chat.

Body:
```json
{
  "userId": 1,
  "title": "Nấu tối",
  "activeRecipeId": 100
}
```

### `GET /api/ai-chat/sessions/:sessionId?userId={id}`
Lấy lịch sử chat của phiên.

### `PATCH /api/ai-chat/sessions/active-recipe`
Đổi món đang nấu trong phiên chat.

Body:
```json
{
  "userId": 1,
  "chatSessionId": 3,
  "recipeId": 120
}
```

Đặt `recipeId = null` để bỏ món đang chọn.

### `POST /api/ai-chat/recommendations-from-pantry`
Gợi ý món theo tủ lạnh.

Body:
```json
{
  "userId": 1,
  "limit": 10
}
```

**Logic trả kết quả:**
1. Ưu tiên món `ready_to_cook` (Đủ để nấu ngay)
2. Nếu chưa đủ limit thì thêm `almost_ready` (Còn thiếu 1 chút)
3. Có index tuần tự từ 1..N

Response (rút gọn):
```json
{
  "success": true,
  "data": {
    "recommendationLimit": 10,
    "recommendations": [
      {
        "index": 1,
        "recommendationType": "ready_to_cook",
        "recipeId": 100,
        "recipeName": "Phở bò",
        "completionRate": 100,
        "missing": []
      },
      {
        "index": 2,
        "recommendationType": "almost_ready",
        "recipeId": 101,
        "recipeName": "Bún bò",
        "completionRate": 92,
        "missing": [
          {"ingredientName":"Hành lá","need":20,"have":0,"unit":"g","isMain":false,"isCommon":true}
        ]
      }
    ],
    "readyToCook": [],
    "almostReady": []
  }
}
```

### `POST /api/ai-chat/messages`
Gửi tin nhắn đến AI (có lưu history).

Body:
```json
{
  "userId": 1,
  "chatSessionId": 3,
  "message": "Hãy đề xuất món phù hợp nguyên liệu hiện có",
  "model": "gemma3:4b",
  "stream": false,
  "activeRecipeId": 120
}
```

- Nếu `chatSessionId` không gửi -> server tự tạo session mới.
- Nếu AI server lỗi -> trả `503` + `code = AI_SERVER_BUSY`.

Ví dụ lỗi AI bận:
```json
{
  "success": false,
  "code": "AI_SERVER_BUSY",
  "data": {
    "assistantMessage": "Máy chủ AI đang bận hoặc tạm thời không khả dụng, anh vui lòng thử lại sau ít phút."
  },
  "message": "AI server is busy"
}
```

---

## 5) Gợi ý tích hợp cho client

## 5.1 Luồng đề xuất món theo tủ lạnh
1. `GET /api/pantry?userId=...`
2. `POST /api/ai-chat/recommendations-from-pantry`
3. Render `data.recommendations` theo `index` + badge `recommendationType`
4. User chọn món -> `PATCH /api/ai-chat/sessions/active-recipe`
5. Chat tiếp bằng `POST /api/ai-chat/messages`

## 5.2 Mapping type hiển thị
- `ready_to_cook` -> **Đủ để nấu ngay**
- `almost_ready` -> **Còn thiếu 1 chút**

## 5.3 Retry cho AI bận
Khi nhận `503 + AI_SERVER_BUSY`:
- hiển thị message fallback
- bật nút “Thử lại” sau 3–5 giây
- nên retry tối đa 2–3 lần

---

## 6) Danh sách endpoint nhanh (copy cho FE)

```txt
GET    /api/users/all
POST   /api/users/register
POST   /api/users/login
POST   /api/users/forgot-password
POST   /api/users/change-password
GET    /api/users/recipes-view-history
POST   /api/users/update-user-information

GET    /api/recipes/all
POST   /api/recipes/create
POST   /api/recipes/search
GET    /api/recipes/ingredients
POST   /api/recipes/top-trending
GET    /api/recipes/tags
POST   /api/recipes/search-by-tag
POST   /api/recipes/user-recipes
GET    /api/recipes/growth-report

POST   /api/interactions/like
POST   /api/interactions/comment
POST   /api/interactions/increase-view-count
GET    /api/interactions/comments
DELETE /api/interactions/comment

GET    /api/pantry
POST   /api/pantry/upsert
DELETE /api/pantry/delete

POST   /api/ai-chat/sessions
GET    /api/ai-chat/sessions/:sessionId
PATCH  /api/ai-chat/sessions/active-recipe
POST   /api/ai-chat/recommendations-from-pantry
POST   /api/ai-chat/messages
```

---

## 7) Ghi chú kỹ thuật

- Biến môi trường AI:
  - `AI_CHAT_API_URL`
  - `AI_CHAT_MODEL`
  - `AI_CHAT_TIMEOUT_MS`
- Nếu cần đổi số món mặc định recommend: chỉnh 1 chỗ ở `DEFAULT_RECOMMENDATION_LIMIT` trong `models/aiChatModel.js`.

---

Nếu cần, có thể tách thêm 1 file **OpenAPI/Swagger** để client generate SDK tự động (TypeScript/Kotlin) từ schema API.
