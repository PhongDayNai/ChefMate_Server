# ChefMate AI Chat API Guide (Bản mới, đầy đủ)

> Cập nhật: 2026-03-26  
> Áp dụng theo code backend hiện tại (routes/controllers/models).

---

## 1) Mục tiêu tài liệu

Tài liệu này mô tả đầy đủ cách dùng nhóm API chat AI của ChefMate, bao gồm:
- Quản lý session chat
- Chat theo ngữ cảnh pantry + diet + active recipe
- Unified timeline **cuộn xuyên nhiều session cũ**
- Cơ chế chốt session cũ và tạo session mới
- Các mã lỗi và cách xử lý ở client

---

## 2) Base URL

- Production: `https://api.example.com`
- Swagger UI: `https://api.example.com/api-docs`

Header JSON chuẩn:

```http
Content-Type: application/json
```

---

## 3) Tổng quan endpoint AI Chat

- `POST /api/ai-chat/sessions` — tạo session
- `GET /api/ai-chat/sessions?userId=&page=&limit=` — list session
- `GET /api/ai-chat/sessions/:sessionId?userId=` — history theo session
- `DELETE /api/ai-chat/sessions/:id?userId=` — xóa session
- `PATCH /api/ai-chat/sessions/title` — đổi title
- `PATCH /api/ai-chat/sessions/active-recipe` — đổi món đang nấu
- `POST /api/ai-chat/recommendations-from-pantry` — gợi ý món
- `POST /api/ai-chat/sessions/resolve-previous` — chốt session cũ + tạo mới
- `POST /api/ai-chat/messages` — gửi chat
- `GET /api/ai-chat/messages?userId=&limit=&beforeMessageId=` — unified timeline lazy-load

---

## 4) Cấu trúc response chung

```json
{
  "success": true,
  "data": {},
  "message": "..."
}
```

Một số response có thêm `code`:
- `AI_SERVER_BUSY` (HTTP 503)
- `PENDING_PREVIOUS_RECIPE_COMPLETION` (HTTP 200)

---

## 5) Session APIs

## 5.1 Tạo session
### Request
```bash
curl -sS -X POST "https://api.example.com/api/ai-chat/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 4,
    "title": "Bữa tối healthy"
  }'
```

### Body fields
- `userId` (bắt buộc)
- `title` (optional)
- `activeRecipeId` (optional)
- `firstMessage` (optional, dùng để server auto title)
- `model` (optional)

### Hành vi
- Nếu không có `title`, server sẽ auto-generate title.
- Session mới luôn có intro message của Bepes.

---

## 5.2 Lấy danh sách session
```bash
curl -sS "https://api.example.com/api/ai-chat/sessions?userId=4&page=1&limit=20"
```

---

## 5.3 Lấy history theo session
```bash
curl -sS "https://api.example.com/api/ai-chat/sessions/44?userId=4"
```

Response trả:
- `data.session`
- `data.messages[]`

Lưu ý:
- `data.session.activeRecipeId` là món đang gắn hiện tại của session.
- Không phải toàn bộ lịch sử đổi món theo thời gian.

---

## 5.4 Đổi title session
```bash
curl -sS -X PATCH "https://api.example.com/api/ai-chat/sessions/title" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 4,
    "chatSessionId": 44,
    "title": "Nấu tối cho 2 người"
  }'
```

---

## 5.5 Đổi món đang nấu (active recipe)
```bash
curl -sS -X PATCH "https://api.example.com/api/ai-chat/sessions/active-recipe" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 4,
    "chatSessionId": 44,
    "recipeId": 5
  }'
```

Clear active recipe:
```bash
curl -sS -X PATCH "https://api.example.com/api/ai-chat/sessions/active-recipe" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 4,
    "chatSessionId": 44,
    "recipeId": null
  }'
```

---

## 5.6 Xóa session
```bash
curl -sS -X DELETE "https://api.example.com/api/ai-chat/sessions/44?userId=4"
```

---

## 6) Gợi ý món từ pantry

```bash
curl -sS -X POST "https://api.example.com/api/ai-chat/recommendations-from-pantry" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 4,
    "limit": 10
  }'
```

Response có:
- `recommendations[]`
- `readyToCook[]`
- `almostReady[]`
- `recommendationType`: `ready_to_cook` | `almost_ready`

Server đã lọc theo diet notes đang active.

---

## 7) Gửi tin nhắn chat

## 7.1 Gửi không truyền session (khuyến nghị)
```bash
curl -sS -X POST "https://api.example.com/api/ai-chat/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 4,
    "message": "Gợi ý món tối nay ít dầu mỡ",
    "stream": false
  }'
```

## 7.2 Gửi vào session cụ thể
```bash
curl -sS -X POST "https://api.example.com/api/ai-chat/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 4,
    "chatSessionId": 44,
    "message": "Hướng dẫn bước 1",
    "stream": false
  }'
```

### Input fields
- `userId` (required)
- `message` (required)
- `chatSessionId` (optional)
- `model` (optional)
- `stream` (optional, default false)
- `activeRecipeId` (optional)
- `useUnifiedSession` (optional, default true)

### Response thường
```json
{
  "success": true,
  "data": {
    "session": { "chatSessionId": 44 },
    "assistantMessage": "..."
  },
  "message": "Chat with AI successfully"
}
```

---

## 8) Unified timeline (mới)

## 8.1 Ý nghĩa
`GET /api/ai-chat/messages` giờ trả timeline theo **toàn bộ message của user xuyên các session**, giúp cuộn lên sẽ đi qua session cũ.

## 8.2 Request
```bash
curl -sS "https://api.example.com/api/ai-chat/messages?userId=4&limit=30"
```

Lazy-load trang cũ hơn:
```bash
curl -sS "https://api.example.com/api/ai-chat/messages?userId=4&limit=30&beforeMessageId=205"
```

## 8.3 Response shape
```json
{
  "success": true,
  "data": {
    "session": {
      "chatSessionId": 52,
      "userId": 4,
      "title": "Bepes"
    },
    "latestSession": {
      "chatSessionId": 52,
      "userId": 4,
      "title": "Bepes"
    },
    "items": [
      {
        "chatMessageId": 220,
        "chatSessionId": 52,
        "sessionTitle": "Bepes",
        "activeRecipeId": null,
        "sessionCreatedAt": "2026-03-26T14:27:17.000Z",
        "sessionUpdatedAt": "2026-03-26T14:27:17.000Z",
        "isSessionStart": true,
        "role": "assistant",
        "content": "Xin chào anh, em là Bepes...",
        "meta": { "intro": true, "agentName": "Bepes" },
        "createdAt": "2026-03-26T14:27:17.000Z"
      }
    ],
    "paging": {
      "limit": 30,
      "hasMore": true,
      "nextBeforeMessageId": 205
    }
  },
  "message": "Get unified chat timeline successfully"
}
```

## 8.4 Ý nghĩa field mới
- `chatSessionId`: message thuộc session nào
- `sessionTitle`: title của session chứa message
- `isSessionStart`: message đầu đoạn khi đổi sang session khác trong trang hiện tại

---

## 9) Cơ chế chốt session cũ và tạo session mới

## 9.1 Khi nào bị chặn?
Khi gửi message mới mà session gần nhất còn `activeRecipeId` quá ngưỡng nhắc, API có thể trả:
- `code: PENDING_PREVIOUS_RECIPE_COMPLETION`

## 9.2 Payload mẫu
```json
{
  "success": true,
  "code": "PENDING_PREVIOUS_RECIPE_COMPLETION",
  "data": {
    "previousSessionId": 44,
    "recipeId": 5,
    "recipeName": "...",
    "minutesSinceLastMessage": 42,
    "isStrongReminder": false,
    "reminderMessage": "...",
    "pendingUserMessage": "Cho tôi món khác",
    "actions": [
      { "id": "complete_and_deduct", "label": "Hoàn thành & trừ nguyên liệu" },
      { "id": "skip_deduction", "label": "Bỏ qua (không trừ)" }
    ]
  }
}
```

## 9.3 Resolve API
```bash
curl -sS -X POST "https://api.example.com/api/ai-chat/sessions/resolve-previous" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 4,
    "previousSessionId": 44,
    "action": "skip_deduction",
    "pendingUserMessage": "Cho tôi món khác"
  }'
```

`action` hợp lệ:
- `complete_and_deduct`
- `skip_deduction`

### Lưu ý
- Hiện `complete_and_deduct` mới ghi nhận nghiệp vụ, chưa auto trừ pantry transaction-level.

---

## 10) Mã lỗi và xử lý client

- `400`: input thiếu/sai
- `404`: session không tồn tại/không thuộc user
- `500`: lỗi server
- `503` + `AI_SERVER_BUSY`: AI upstream bận

Khuyến nghị retry cho `AI_SERVER_BUSY`:
- 3s -> 5s -> 8s, tối đa 3 lần.

---

## 11) Flow client chuẩn (khuyến nghị)

1. Mở chat: `GET /api/ai-chat/messages?userId=...&limit=30`
2. Cuộn lên: gọi lại với `beforeMessageId`
3. Gửi tin: `POST /api/ai-chat/messages`
4. Nếu `PENDING_PREVIOUS_RECIPE_COMPLETION`: mở modal -> gọi resolve
5. Sau send/resolve thành công: reload page đầu timeline
6. Dedupe theo `chatMessageId`

---

## 12) Bộ curl test nhanh cho userId=4

```bash
BASE="https://api.example.com"

# 1) List session
curl -sS "$BASE/api/ai-chat/sessions?userId=4&page=1&limit=20"

# 2) History session cụ thể
curl -sS "$BASE/api/ai-chat/sessions/44?userId=4"

# 3) Unified timeline page đầu
curl -sS "$BASE/api/ai-chat/messages?userId=4&limit=30"

# 4) Unified timeline cuộn lên
curl -sS "$BASE/api/ai-chat/messages?userId=4&limit=30&beforeMessageId=205"

# 5) Gửi message
curl -sS -X POST "$BASE/api/ai-chat/messages" \
  -H "Content-Type: application/json" \
  -d '{"userId":4,"message":"test from curl","stream":false}'

# 6) Đổi active recipe
curl -sS -X PATCH "$BASE/api/ai-chat/sessions/active-recipe" \
  -H "Content-Type: application/json" \
  -d '{"userId":4,"chatSessionId":44,"recipeId":5}'
```

---

## 13) Kết luận

Bản guide này là chuẩn tích hợp AI Chat mới nhất:
- Unified timeline cuộn xuyên session cũ
- Session lifecycle rõ ràng
- Có đầy đủ request/response mẫu và curl test cho QA/client.
