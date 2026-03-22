# ChefMate Server – API Client Guide (Cập nhật mới nhất)

> Tài liệu tích hợp client cho toàn bộ API mới liên quan AI Chat, Pantry, Diet Notes + các endpoint quản lý session.

---

## 1) Tổng quan

- Base URL: `https://api.example.com`
- Content-Type: `application/json`
- Auth: hiện tại chưa có JWT middleware; client truyền `userId` theo request.

### Biến môi trường AI (server)
- `AI_CHAT_API_URL`
- `AI_CHAT_MODEL` (mặc định `gemma3:4b`)
- `AI_CHAT_TIMEOUT_MS`

---

## 2) Chuẩn response

### Success
```json
{
  "success": true,
  "data": {},
  "message": "..."
}
```

### Fail (điển hình)
```json
{
  "success": false,
  "data": null,
  "message": "..."
}
```

### AI bận
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

## 3) FLOW chuẩn cho app

## Flow A – Hồ sơ ăn uống (dị ứng/hạn chế)

### A1) Lấy danh sách ghi chú
`GET /api/user-diet-notes?userId={id}`

```bash
curl -s 'https://api.example.com/api/user-diet-notes?userId=4'
```

### A2) Tạo/cập nhật ghi chú
`POST /api/user-diet-notes/upsert`

```bash
curl -s -X POST 'https://api.example.com/api/user-diet-notes/upsert' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": 4,
    "noteType": "allergy",
    "label": "Hải sản",
    "keywords": ["shrimp","prawn","fish","tôm","cá","mực"],
    "instruction": "Không dùng nguyên liệu hải sản",
    "isActive": true
  }'
```

`noteType` hợp lệ:
- `allergy`
- `restriction`
- `preference`
- `health_note`

### A3) Xóa ghi chú
`DELETE /api/user-diet-notes/delete`

```bash
curl -s -X DELETE 'https://api.example.com/api/user-diet-notes/delete' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": 4,
    "noteId": 3
  }'
```

---

## Flow B – Pantry (Tủ lạnh)

### B1) Lấy pantry
`GET /api/pantry?userId={id}`

```bash
curl -s 'https://api.example.com/api/pantry?userId=4'
```

### B2) Thêm/cập nhật item
`POST /api/pantry/upsert`

```bash
curl -s -X POST 'https://api.example.com/api/pantry/upsert' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": 4,
    "ingredientName": "Thịt bò",
    "quantity": 500,
    "unit": "g",
    "expiresAt": null
  }'
```

### B3) Xóa item
`DELETE /api/pantry/delete`

```bash
curl -s -X DELETE 'https://api.example.com/api/pantry/delete' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": 4,
    "pantryItemId": 12
  }'
```

---

## Flow C – Gợi ý món theo pantry

### C1) Lấy danh sách gợi ý
`POST /api/ai-chat/recommendations-from-pantry`

```bash
curl -s -X POST 'https://api.example.com/api/ai-chat/recommendations-from-pantry' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": 4,
    "limit": 10
  }'
```

### Quy tắc kết quả
- Ưu tiên `ready_to_cook` trước.
- Nếu chưa đủ `limit` thì thêm `almost_ready`.
- Có `index` tuần tự.
- Tự lọc theo `allergy/restriction` đang active.

---

## Flow D – Quản lý session chat

### D1) Tạo session
`POST /api/ai-chat/sessions`

```bash
curl -s -X POST 'https://api.example.com/api/ai-chat/sessions' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": 4,
    "title": "Nấu cùng AI"
  }'
```

### D2) Lấy danh sách session theo user (PHÂN TRANG)
`GET /api/ai-chat/sessions?userId=...&page=...&limit=...`

```bash
curl -s 'https://api.example.com/api/ai-chat/sessions?userId=4&page=1&limit=20'
```

Response mẫu:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "chatSessionId": 26,
        "userId": 4,
        "title": "Nấu cùng AI",
        "activeRecipeId": null,
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "totalPages": 1
    }
  },
  "message": "Get chat sessions successfully"
}
```

### D3) Lấy chi tiết 1 session + lịch sử message
`GET /api/ai-chat/sessions/{sessionId}?userId={id}`

```bash
curl -s 'https://api.example.com/api/ai-chat/sessions/26?userId=4'
```

### D4) Đổi tiêu đề session
`PATCH /api/ai-chat/sessions/title`

```bash
curl -s -X PATCH 'https://api.example.com/api/ai-chat/sessions/title' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": 4,
    "chatSessionId": 26,
    "title": "Bữa tối ít carb"
  }'
```

### D5) Xóa session
`DELETE /api/ai-chat/sessions/{id}?userId={id}`

```bash
curl -s -X DELETE 'https://api.example.com/api/ai-chat/sessions/26?userId=4'
```

### D6) Chọn/đổi món đang nấu
`PATCH /api/ai-chat/sessions/active-recipe`

```bash
curl -s -X PATCH 'https://api.example.com/api/ai-chat/sessions/active-recipe' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": 4,
    "chatSessionId": 26,
    "recipeId": 120
  }'
```

> Bỏ món đang chọn: `"recipeId": null`

---

## Flow E – Chat với AI

### E1) Gửi message
`POST /api/ai-chat/messages`

```bash
curl -s -X POST 'https://api.example.com/api/ai-chat/messages' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": 4,
    "chatSessionId": 26,
    "message": "Hướng dẫn bước 1 thật ngắn",
    "model": "gemma3:4b",
    "stream": true
  }'
```

Ghi chú:
- Nếu không truyền `chatSessionId` thì server tự tạo session mới.
- Với `stream=true`, backend gom stream và trả `assistantMessage` hoàn chỉnh cho client.

---

## 4) Danh sách endpoint mới (copy nhanh)

```txt
GET    /api/user-diet-notes
POST   /api/user-diet-notes/upsert
DELETE /api/user-diet-notes/delete

GET    /api/pantry
POST   /api/pantry/upsert
DELETE /api/pantry/delete

POST   /api/ai-chat/recommendations-from-pantry

POST   /api/ai-chat/sessions
GET    /api/ai-chat/sessions?userId=...&page=...&limit=...
GET    /api/ai-chat/sessions/:sessionId?userId=...
PATCH  /api/ai-chat/sessions/title
PATCH  /api/ai-chat/sessions/active-recipe
DELETE /api/ai-chat/sessions/:id?userId=...

POST   /api/ai-chat/messages
```

---

## 5) Xử lý lỗi phía client (khuyến nghị)

- Nếu `503 + AI_SERVER_BUSY`: hiển thị fallback, cho retry sau 3–5s, tối đa 2–3 lần.
- Nếu `404 Chat session not found`: kiểm tra đúng cặp `sessionId + userId`.
- Nếu recommend rỗng: kiểm tra pantry trống hoặc bị filter bởi allergy/restriction.

---

## 6) Ghi chú hình ảnh recipe

- Trường `image` trả về local path như `/images/recipes/...` hoặc `/images/placeholders/...`
- URL đầy đủ để render:
  - `https://api.example.com` + `image`

Ví dụ:
- `https://api.example.com/images/recipes/123-abc.jpg`
- `https://api.example.com/images/placeholders/565-pho.svg`
