# ChefMate Server API Client Guide (Cũ + Mới)

> Tài liệu cho phía client (mobile/web) tích hợp toàn bộ API hiện có, gồm legacy + Pantry + AI Chat + User Diet Notes.

## 1) Tổng quan

- **Base URL local (docker):** `http://127.0.0.1:8000`
- **Tiền tố API:** `/api`
- **Content-Type:** `application/json` (trừ upload ảnh dùng `multipart/form-data`)
- **Auth:** hiện tại **chưa có JWT middleware** (client tự quản lý `userId` theo phiên đăng nhập)

### AI backend mặc định
- `AI_CHAT_API_URL` hiện dùng: `https://your-ai-api-url.com`
- `AI_CHAT_MODEL` mặc định: `gemma3:4b`
- `AI_CHAT_TIMEOUT_MS` mặc định: `20000` (khuyến nghị nâng 30000-45000 nếu mạng không ổn định)

---

## 2) Chuẩn response

Phần lớn endpoint trả dạng:

```json
{
  "success": true,
  "data": {},
  "message": "..."
}
```

Một số endpoint cũ có thể trả khác format (`{ "error": "..." }`).

---

## 3) API cũ (legacy)

## 3.1 Users - `/api/users`

### `GET /api/users/all`
Lấy toàn bộ user.

### `POST /api/users/register`
Tạo tài khoản.

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

```json
{
  "identifier": "0912345678",
  "password": "123456"
}
```

### `POST /api/users/forgot-password`
Reset password theo phone.

```json
{ "phone": "0912345678" }
```

### `POST /api/users/change-password`
Đổi mật khẩu.

```json
{
  "phone": "0912345678",
  "currentPassword": "123456",
  "newPassword": "abcdef"
}
```

### `GET /api/users/recipes-view-history`
Lấy lịch sử xem công thức.

> Lưu ý legacy: controller đọc `userId` từ body dù là GET.

```json
{ "userId": 1 }
```

### `POST /api/users/update-user-information`
Cập nhật profile user.

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
Tạo công thức + upload ảnh.

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
```json
{ "recipeName": "phở", "userId": 1 }
```

### `GET /api/recipes/ingredients`
Lấy danh sách nguyên liệu.

### `POST /api/recipes/top-trending`
```json
{ "userId": 1 }
```

### `GET /api/recipes/tags`
Lấy toàn bộ tag.

### `POST /api/recipes/search-by-tag`
```json
{ "tagName": "Việt Nam", "userId": 1 }
```

### `POST /api/recipes/user-recipes`
```json
{ "userId": 1 }
```

### `GET /api/recipes/growth-report`
Báo cáo tăng trưởng công thức theo tháng.

---

## 3.3 Interactions - `/api/interactions`

### `POST /api/interactions/like`
```json
{ "userId": 1, "recipeId": 100 }
```

### `POST /api/interactions/comment`
```json
{ "userId": 1, "recipeId": 100, "content": "Món này ngon" }
```

### `POST /api/interactions/increase-view-count`
```json
{ "recipeId": 100 }
```

### `GET /api/interactions/comments`
Lấy toàn bộ bình luận.

### `DELETE /api/interactions/comment`
```json
{ "commentId": 12 }
```

---

## 4) API mới

## 4.1 Pantry (Tủ lạnh) - `/api/pantry`

### `GET /api/pantry?userId={id}`
Lấy nguyên liệu tủ lạnh theo user.

### `POST /api/pantry/upsert`
Thêm/cập nhật item tủ lạnh (key logic: `userId + ingredient + unit`).

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
```json
{ "userId": 1, "pantryItemId": 10 }
```

---

## 4.2 User Diet Notes (Dị ứng / Hạn chế / Ghi chú sức khỏe) - `/api/user-diet-notes`

> Dùng để lưu note ăn uống cá nhân theo từng user: dị ứng, đang kiêng, preference, health note.

### `GET /api/user-diet-notes?userId={id}`
Lấy toàn bộ notes của user.

### `POST /api/user-diet-notes/upsert`
Tạo mới hoặc cập nhật note.

```json
{
  "userId": 1,
  "noteType": "allergy",
  "label": "Hải sản",
  "keywords": ["shrimp", "prawn", "fish", "salmon", "tôm", "cá", "mực"],
  "instruction": "Không dùng nguyên liệu hải sản",
  "isActive": true,
  "startAt": null,
  "endAt": null
}
```

- `noteType` hợp lệ: `allergy | restriction | preference | health_note`
- `keywords` là mảng từ khóa để lọc recipe/recommend.

### `DELETE /api/user-diet-notes/delete`
```json
{ "userId": 1, "noteId": 3 }
```

### Diet notes đang ảnh hưởng gì?
- Được inject vào context chat AI mỗi lượt.
- `recommendations-from-pantry` sẽ lọc bỏ món vi phạm note `allergy`/`restriction`.

---

## 4.3 AI Chat - `/api/ai-chat`

### `POST /api/ai-chat/sessions`
Tạo phiên chat.

```json
{
  "userId": 1,
  "title": "Nấu tối",
  "activeRecipeId": 100
}
```

### `GET /api/ai-chat/sessions/:sessionId?userId={id}`
Lấy lịch sử chat.

### `PATCH /api/ai-chat/sessions/active-recipe`
Đổi món đang nấu trong session.

```json
{
  "userId": 1,
  "chatSessionId": 3,
  "recipeId": 120
}
```

Đặt `recipeId = null` để bỏ món hiện tại.

### `POST /api/ai-chat/recommendations-from-pantry`
Gợi ý món theo tủ lạnh.

```json
{ "userId": 1, "limit": 10 }
```

Logic:
1. Ưu tiên `ready_to_cook`
2. Nếu chưa đủ limit thì thêm `almost_ready`
3. Có `index` tuần tự từ 1..N
4. Tự loại món vi phạm `allergy/restriction` nếu có note đang hiệu lực

Response rút gọn:
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
      }
    ],
    "readyToCook": [],
    "almostReady": []
  }
}
```

### `POST /api/ai-chat/messages`
Gửi message chat AI (có lưu history).

```json
{
  "userId": 1,
  "chatSessionId": 3,
  "message": "Hãy đề xuất món phù hợp nguyên liệu hiện có",
  "model": "gemma3:4b",
  "stream": true,
  "activeRecipeId": 120
}
```

Ghi chú:
- Nếu thiếu `chatSessionId` -> server tự tạo session.
- Nếu `stream=true`: server gọi AI dạng stream, **gom chunk** và trả về một `assistantMessage` hoàn chỉnh cho client.
- Nếu AI lỗi/bận: trả `503` + `code=AI_SERVER_BUSY`.

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

## 5) Luồng tích hợp khuyến nghị cho client

### 5.1 Luồng cơ bản AI nấu ăn
1. `GET /api/pantry?userId=...`
2. (Tuỳ chọn) setup note dị ứng/hạn chế: `POST /api/user-diet-notes/upsert`
3. `POST /api/ai-chat/recommendations-from-pantry`
4. Render `data.recommendations` theo `index` + badge type
5. User chọn món -> `PATCH /api/ai-chat/sessions/active-recipe`
6. Chat tiếp -> `POST /api/ai-chat/messages`

### 5.2 Mapping type cho UI
- `ready_to_cook` -> **Đủ để nấu ngay**
- `almost_ready` -> **Còn thiếu 1 chút**

### 5.3 Retry khi AI bận
Khi nhận `503 + AI_SERVER_BUSY`:
- Hiển thị fallback message
- Nút “Thử lại” sau 3–5s
- Retry tối đa 2–3 lần

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

GET    /api/user-diet-notes
POST   /api/user-diet-notes/upsert
DELETE /api/user-diet-notes/delete

POST   /api/ai-chat/sessions
GET    /api/ai-chat/sessions/:sessionId
PATCH  /api/ai-chat/sessions/active-recipe
POST   /api/ai-chat/recommendations-from-pantry
POST   /api/ai-chat/messages
```

---

## 7) Ghi chú kỹ thuật

- Đổi số món mặc định recommend: chỉnh 1 chỗ `DEFAULT_RECOMMENDATION_LIMIT` trong `models/aiChatModel.js`.
- DB đang lưu persistent qua docker volume `mysql_data`.

---

Nếu cần, bước tiếp theo có thể xuất thêm **OpenAPI/Swagger** để FE generate SDK (TS/Kotlin) tự động.
