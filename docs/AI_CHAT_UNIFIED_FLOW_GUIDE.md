# ChefMate Backend Guide: Chuyển sang luồng chat hợp nhất (single-thread) + lazy load

> Cập nhật theo code đã sửa trong `chefmate-server`.
> Commit liên quan: `feat(ai-chat): add unified timeline and lazy-load messages`

---

## 1) Mục tiêu của luồng mới

### Trước đây
- Client có xu hướng tách nhiều phiên chat (`ChatSessions`).
- Mỗi lần chat có thể tạo đoạn/phiên mới, UX bị rời rạc.

### Bây giờ
- **Client hiển thị 1 màn chat duy nhất** cho mỗi user.
- Backend tự dùng **session gần nhất** (unified behavior) nếu không truyền `chatSessionId`.
- Tin nhắn cũ được tải theo kiểu **lazy load** khi cuộn lên.

---

## 2) Những thay đổi backend đã có trong code

## 2.1 Endpoint mới để lấy timeline hợp nhất

### `GET /api/ai-chat/messages`

#### Query params
- `userId` (bắt buộc, số dương)
- `limit` (tuỳ chọn, mặc định `30`, max `100`)
- `beforeMessageId` (tuỳ chọn, dùng để phân trang khi cuộn ngược)

#### Hành vi
1. Tìm session gần nhất của user.
2. Nếu chưa có session:
   - tạo session mặc định (`Trò chuyện với Bepes`)
   - thêm intro message.
3. Trả tin nhắn theo trang, có `hasMore` và `nextBeforeMessageId`.

#### Response mẫu
```json
{
  "success": true,
  "data": {
    "session": {
      "chatSessionId": 41,
      "userId": 1,
      "title": "Trò chuyện với Bepes",
      "activeRecipeId": null,
      "createdAt": "2026-03-23T13:46:24.000Z",
      "updatedAt": "2026-03-23T13:46:42.000Z"
    },
    "items": [
      {
        "chatMessageId": 174,
        "role": "assistant",
        "content": "...",
        "meta": { "intro": true, "agentName": "Bepes" },
        "createdAt": "2026-03-23T13:46:24.000Z"
      }
    ],
    "paging": {
      "limit": 30,
      "hasMore": true,
      "nextBeforeMessageId": 175
    }
  },
  "message": "Get unified chat timeline successfully"
}
```

---

## 2.2 Cập nhật hành vi gửi chat

### `POST /api/ai-chat/messages`

#### Request body (khuyến nghị mới)
```json
{
  "userId": 1,
  "message": "Tủ lạnh có trứng, cà chua, hành lá. Gợi ý món tối nay giúp mình.",
  "stream": false
}
```

#### Hành vi mới
- Nếu **không truyền** `chatSessionId`, backend mặc định `useUnifiedSession = true`.
- Backend sẽ tự lấy session gần nhất để append tin nhắn.
- Chỉ tạo session mới khi user chưa có session nào.

#### Tương thích ngược
- Nếu client vẫn truyền `chatSessionId`, backend vẫn dùng đúng session đó.

---

## 2.3 Các file đã sửa

- `models/aiChatModel.js`
  - thêm `getLatestChatSessionByUser`
  - thêm `getOrCreateDefaultChatSession`
  - thêm `getSessionMessagesPaginated`
  - thêm export `getUnifiedTimeline`
  - sửa `sendMessage` để hỗ trợ `useUnifiedSession`

- `controllers/aiChatController.js`
  - sửa `sendMessage` để mặc định `useUnifiedSession = true`
  - thêm `getUnifiedTimeline`

- `routes/aiChatRoutes.js`
  - thêm route: `router.get('/messages', aiChatController.getUnifiedTimeline)`

---

## 3) Hướng dẫn client implement (rất cụ thể)

## 3.1 Khi mở màn chat

Gọi:

```http
GET /api/ai-chat/messages?userId={userId}&limit=30
```

UI render `data.items` theo thứ tự hiện có.

---

## 3.2 Khi user gửi tin nhắn

Gọi:

```http
POST /api/ai-chat/messages
Content-Type: application/json

{
  "userId": 1,
  "message": "...",
  "stream": false
}
```

Sau khi gửi thành công, có 2 cách cập nhật UI:

### Cách A (nhanh, đơn giản)
- append tạm user message ở client
- chờ response assistant và append

### Cách B (an toàn đồng bộ)
- gọi lại `GET /api/ai-chat/messages?userId=1&limit=30` để đồng bộ timeline mới nhất

---

## 3.3 Khi cuộn lên để xem tin cũ

- lấy `nextBeforeMessageId` từ lần gọi trước
- gọi:

```http
GET /api/ai-chat/messages?userId=1&limit=30&beforeMessageId={nextBeforeMessageId}
```

- prepend `items` cũ vào đầu danh sách hiện tại.
- lặp đến khi `hasMore = false`.

---

## 3.4 Pseudocode lazy load phía client

```ts
let items: Message[] = [];
let hasMore = true;
let cursor: number | null = null;

async function loadInitial() {
  const res = await api.get(`/api/ai-chat/messages?userId=${userId}&limit=30`);
  items = res.data.items;
  hasMore = res.data.paging.hasMore;
  cursor = res.data.paging.nextBeforeMessageId;
}

async function loadOlder() {
  if (!hasMore || !cursor) return;

  const res = await api.get(
    `/api/ai-chat/messages?userId=${userId}&limit=30&beforeMessageId=${cursor}`
  );

  items = [...res.data.items, ...items];
  hasMore = res.data.paging.hasMore;
  cursor = res.data.paging.nextBeforeMessageId;
}

async function sendMessage(text: string) {
  await api.post('/api/ai-chat/messages', {
    userId,
    message: text,
    stream: false
  });

  // hoặc append optimistic, hoặc sync lại:
  await loadInitial();
}
```

---

## 4) Curl test nhanh (domain production)

## 4.1 Lấy timeline mới nhất
```bash
curl -sS "https://api.example.com/api/ai-chat/messages?userId=1&limit=30"
```

## 4.2 Load cũ hơn
```bash
curl -sS "https://api.example.com/api/ai-chat/messages?userId=1&limit=30&beforeMessageId=175"
```

## 4.3 Gửi chat (unified)
```bash
curl -sS -X POST "https://api.example.com/api/ai-chat/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "message": "Tối nay có trứng và cà chua, gợi ý giúp mình món nhanh.",
    "stream": false
  }'
```

---

## 5) Kế hoạch xử lý “trừ nguyên liệu sau khi nấu” (phase tiếp theo)

> Hiện **chưa triển khai** trong commit này, đây là bước tiếp theo đề xuất.

## 5.1 Nguyên tắc
- Không chặn chat sau khi nấu xong.
- Chỉ chặn trừ lặp bằng idempotency.
- Cho phép user custom lượng thực tế trước khi apply.

## 5.2 Luồng đề xuất
1. AI tạo draft trừ kho (theo recipe + context).
2. User xác nhận nhẹ (`ok`, `trừ đi`, hoặc bấm nút).
3. Backend apply transaction và ghi ledger.
4. Cho hoàn tác ngắn hạn nếu cần.

## 5.3 Endpoint dự kiến
- `POST /api/pantry/consumption/draft`
- `POST /api/pantry/consumption/confirm`
- `POST /api/pantry/consumption/cancel`

---

## 6) Checklist rollout

- [ ] Client bỏ UI session list ở màn chat chính.
- [ ] Client dùng `GET /api/ai-chat/messages` để load timeline.
- [ ] Client lazy-load bằng `beforeMessageId`.
- [ ] Client gửi chat không cần `chatSessionId`.
- [ ] Test cuộn ngược nhiều lần không trùng message.
- [ ] Test multi-device cùng user.
- [ ] Theo dõi p95 response time.

---

## 7) Lưu ý vận hành

- DB index hiện tại đủ cho bước đầu, nhưng khi message lớn nên bổ sung/tối ưu index theo tải thực tế.
- Nếu data tăng nhanh, cân nhắc cursor theo `createdAt + chatMessageId` để ổn định hơn.
- Nếu cần realtime mượt hơn, có thể bổ sung WebSocket/SSE ở phase sau.

---

## 8) Tóm tắt ngắn cho team

- Đã chuyển logic backend sang hướng **unified session mặc định**.
- Đã có endpoint **lazy load timeline** bằng cursor `beforeMessageId`.
- Client giờ chỉ cần coi chat là **một luồng duy nhất**.
- Phase kế tiếp: transaction trừ nguyên liệu an toàn (draft/confirm/apply + idempotency).
