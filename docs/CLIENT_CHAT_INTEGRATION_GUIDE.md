# ChefMate Client Integration Guide (Single Chat + Lazy Load)

> Mục tiêu: tài liệu này chỉ dành cho **team client**.  
> Không chứa nội dung vận hành backend/deploy nội bộ.

---

## 1) Team client cần làm gì?

Sau cập nhật mới, client chỉ cần coi AI chat là **1 luồng duy nhất** cho mỗi user:

1. Mở màn chat → gọi API lấy tin mới nhất.
2. Cuộn lên → gọi API lazy load tin cũ hơn.
3. Gửi tin nhắn → gọi API send message (không cần quản lý session).

**Không cần** UI chọn session / danh sách session cho màn chat chính.

---

## 2) API client sẽ dùng

## 2.1 Lấy timeline chat (mới nhất)

### Request
`GET /api/ai-chat/messages?userId={userId}&limit=30`

### Bắt buộc
- `userId`: số dương

### Optional
- `limit`: mặc định 30 (khuyến nghị 20–30 cho mobile)

### Response (rút gọn)
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "chatMessageId": 176,
        "role": "assistant",
        "content": "...",
        "createdAt": "2026-03-23T13:46:42.000Z"
      }
    ],
    "paging": {
      "limit": 30,
      "hasMore": true,
      "nextBeforeMessageId": 175
    }
  }
}
```

---

## 2.2 Lazy load khi cuộn lên

### Request
`GET /api/ai-chat/messages?userId={userId}&limit=30&beforeMessageId={nextBeforeMessageId}`

### Ý nghĩa
- `beforeMessageId`: lấy các tin **cũ hơn** message id này.

### Kết thúc phân trang
- Nếu `paging.hasMore = false` → đã hết tin cũ.

---

## 2.3 Gửi tin nhắn

### Request
`POST /api/ai-chat/messages`

```json
{
  "userId": 1,
  "message": "Tủ lạnh có trứng, cà chua. Gợi ý món tối nay giúp mình.",
  "stream": false
}
```

### Lưu ý quan trọng
- **Không cần truyền `chatSessionId`** trong luồng mới.
- Backend tự dùng luồng chat hợp nhất của user.

### Response thực tế (rút gọn)
```json
{
  "success": true,
  "data": {
    "session": { "chatSessionId": 41 },
    "assistantMessage": "..."
  },
  "message": "Chat with AI successfully"
}
```

---

## 3) Mapping UI chuẩn (khuyến nghị)

## 3.1 Khi vào màn hình chat

1. Gọi API mục 2.1.
2. Render `items` theo thứ tự như API trả về.
3. Lưu:
   - `hasMore`
   - `nextBeforeMessageId`

## 3.2 Khi user kéo lên đầu danh sách

1. Nếu `hasMore = false` → không gọi nữa.
2. Nếu còn dữ liệu:
   - gọi API mục 2.2 với `beforeMessageId = nextBeforeMessageId`
3. `prepend` items mới vào đầu danh sách hiện tại.
4. Cập nhật lại `hasMore`, `nextBeforeMessageId`.

## 3.3 Khi user gửi chat

1. Gọi API mục 2.3.
2. Khi thành công:
   - append tin user + assistant theo response (nếu app đang xử lý kiểu optimistic), hoặc
   - gọi lại API mục 2.1 để đồng bộ nhanh (cách đơn giản, an toàn).

---

## 4) Quy tắc hiển thị message

- `role = "user"` → bubble bên phải.
- `role = "assistant"` → bubble bên trái.
- `createdAt` → format theo locale người dùng.
- Nếu `content` dài, đảm bảo list không giật khi prepend lazy-load.

---

## 5) Xử lý lỗi tối thiểu cần có

## 5.1 `400` (thiếu `userId` hoặc message rỗng)
- Hiển thị: “Dữ liệu chưa hợp lệ, vui lòng thử lại.”

## 5.2 `503` (AI bận)
- Hiển thị fallback mềm: “AI đang bận, bạn thử lại sau ít phút nhé.”

## 5.3 Lỗi mạng
- Hiển thị nút “Thử lại”.
- Không xóa tin nhắn user đã nhập.

---

## 6) Mẫu curl để QA/client test nhanh

### 6.1 Lấy timeline
```bash
curl -sS "https://api.example.com/api/ai-chat/messages?userId=1&limit=30"
```

### 6.2 Lazy load tin cũ
```bash
curl -sS "https://api.example.com/api/ai-chat/messages?userId=1&limit=30&beforeMessageId=175"
```

### 6.3 Gửi tin nhắn
```bash
curl -sS -X POST "https://api.example.com/api/ai-chat/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "message": "Tối nay có trứng và cà chua, gợi ý món nhanh giúp mình.",
    "stream": false
  }'
```

---

## 7) Luồng nghiệp vụ món ăn: đổi món / gợi ý / trừ nguyên liệu

## 7.1 Đổi món đang nấu (đã có API)

### API
`PATCH /api/ai-chat/sessions/active-recipe`

### Request
```json
{
  "userId": 1,
  "chatSessionId": 41,
  "recipeId": 123
}
```

### Cách lấy `chatSessionId` trong luồng unified
- Gọi `GET /api/ai-chat/messages?userId=...`
- Lấy từ `data.session.chatSessionId`

### Rule UI
- Khi user chọn món khác trong màn chat, gọi API này ngay.
- Khi user bỏ món đang nấu, gửi `recipeId: null`.

---

## 7.2 Gợi ý món theo tủ lạnh (đã có API)

### API
`POST /api/ai-chat/recommendations-from-pantry`

### Request
```json
{
  "userId": 1,
  "limit": 10
}
```

### Response chính
- `readyToCook`: đủ nguyên liệu để nấu ngay
- `almostReady`: thiếu rất ít nguyên liệu phụ

### Rule UI
- Có thể gọi API này khi user bấm “Gợi ý món”
- Hoặc gọi ngầm trước rồi hiển thị khi user hỏi trong chat

---

## 7.3 Trừ nguyên liệu sau khi nấu (trạng thái hiện tại)

### Hiện trạng backend
- **Chưa có API chính thức** cho luồng `draft -> confirm -> apply` trừ nguyên liệu.
- Vì vậy client **không nên tự trừ kho tự động** theo text chat ở thời điểm hiện tại.

### Khuyến nghị tạm thời
- Nếu cần cập nhật kho thủ công, dùng API pantry hiện có (upsert/delete) theo thao tác người dùng.
- Chưa bật auto-deduct cho production đến khi backend có transaction + idempotency.

### API pantry thủ công (đang dùng được)

#### 1) Thêm/cập nhật nguyên liệu trong tủ lạnh
`POST /api/pantry/upsert`

```json
{
  "userId": 1,
  "ingredientName": "trứng gà",
  "quantity": 6,
  "unit": "quả"
}
```

#### 2) Xóa một item khỏi tủ lạnh
`DELETE /api/pantry/delete`

```json
{
  "userId": 1,
  "pantryItemId": 12
}
```

### Luồng mục tiêu (phase tiếp theo)
1. AI đề xuất draft trừ kho.
2. User xác nhận nhẹ (text/nút).
3. Backend apply 1 lần duy nhất (idempotent), có lịch sử transaction.

---

## 8) Checklist nghiệm thu cho client

- [ ] Không còn màn chọn session trong flow chat chính.
- [ ] Mở chat load được 20–30 tin mới nhất.
- [ ] Kéo lên load thêm tin cũ bằng `beforeMessageId`.
- [ ] Không bị trùng item khi load nhiều trang.
- [ ] Gửi tin không cần `chatSessionId` vẫn chạy đúng.
- [ ] Hiển thị lỗi mạng/503 rõ ràng, không crash UI.

---

## 9) Kết luận

Với luồng mới, team client chỉ cần 2 API chính:
- `GET /api/ai-chat/messages` (kèm lazy-load cursor)
- `POST /api/ai-chat/messages`

Làm đúng các bước trên là đủ để có UX chat một luồng, ít thao tác, dễ bảo trì.
