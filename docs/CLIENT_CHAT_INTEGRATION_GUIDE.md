# ChefMate Client Integration Guide (Full Flow)

> Tài liệu này dành cho **team client** và bám theo API backend hiện tại.
> Mục tiêu: triển khai chat 1 luồng, lazy-load ổn định, kèm flow đổi món/gợi ý/trừ nguyên liệu (bản tạm thời hiện có).

---

## 1) Phạm vi & nguyên tắc triển khai

### 1.1 Phạm vi
Client cần triển khai đủ các nhóm flow sau:
1. Chat 1 luồng (single-thread)
2. Lazy-load khi cuộn ngược
3. Gửi tin nhắn + đồng bộ timeline
4. Đổi món đang nấu
5. Gợi ý món theo pantry
6. Cập nhật pantry thủ công sau khi nấu (vì chưa có auto-deduct chính thức)
7. Xử lý nhắc mạnh khi session cũ có món chưa chốt (30 phút - 3 tiếng+)

### 1.2 Nguyên tắc
- **Không tách session trên UI chat chính**.
- Client coi chat là **1 timeline duy nhất** theo `userId`.
- `chatSessionId` vẫn tồn tại ở backend; client lấy tự động từ `GET /api/ai-chat/messages` khi cần gọi API đổi món.

---

## 2) Danh sách API client cần dùng

## 2.1 Chat timeline (unified)
### A. Load mới nhất
`GET /api/ai-chat/messages?userId={userId}&limit=30`

### B. Load cũ hơn (lazy-load)
`GET /api/ai-chat/messages?userId={userId}&limit=30&beforeMessageId={cursor}`

### Response mẫu (rút gọn)
```json
{
  "success": true,
  "data": {
    "session": {
      "chatSessionId": 41,
      "userId": 1,
      "title": "..."
    },
    "items": [
      {
        "chatMessageId": 184,
        "role": "assistant",
        "content": "...",
        "createdAt": "2026-03-23T15:00:00.000Z"
      }
    ],
    "paging": {
      "limit": 30,
      "hasMore": true,
      "nextBeforeMessageId": 183
    }
  }
}
```

## 2.2 Gửi tin nhắn chat
`POST /api/ai-chat/messages`

```json
{
  "userId": 1,
  "message": "Tối nay gợi ý món nhanh giúp mình",
  "stream": false
}
```

### Ghi chú quan trọng
- **Không cần gửi `chatSessionId`** trong luồng mới.
- Backend tự dùng unified session cho user.

### Response mẫu (rút gọn)
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

## 2.3 Đổi món đang nấu
`PATCH /api/ai-chat/sessions/active-recipe`

```json
{
  "userId": 1,
  "chatSessionId": 41,
  "recipeId": 123
}
```

- Bỏ món đang nấu: gửi `"recipeId": null`

## 2.4 Gợi ý món từ pantry
`POST /api/ai-chat/recommendations-from-pantry`

```json
{
  "userId": 1,
  "limit": 10
}
```

## 2.5 Resolve session cũ khi món trước chưa chốt (API mới)
`POST /api/ai-chat/sessions/resolve-previous`

```json
{
  "userId": 1,
  "previousSessionId": 41,
  "action": "complete_and_deduct",
  "pendingUserMessage": "ok vậy món mới là gà áp chảo"
}
```

hoặc

```json
{
  "userId": 1,
  "previousSessionId": 41,
  "action": "skip_deduction"
}
```

### Response mẫu
```json
{
  "success": true,
  "data": {
    "resolvedSessionId": 41,
    "resolution": "skip_deduction",
    "carriedRecipe": {
      "recipeId": 3,
      "recipeName": "Bang bang prawn salad"
    },
    "carriedPendingUserMessage": "ok vậy món mới là gà áp chảo",
    "newSession": {
      "chatSessionId": 42,
      "title": "Trò chuyện mới",
      "activeRecipeId": 3
    }
  }
}
```

## 2.6 Pantry thủ công (dùng tạm sau khi nấu)
### Upsert item
`POST /api/pantry/upsert`

```json
{
  "userId": 1,
  "ingredientName": "trứng gà",
  "quantity": 6,
  "unit": "quả"
}
```

### Xóa item
`DELETE /api/pantry/delete`

```json
{
  "userId": 1,
  "pantryItemId": 12
}
```

### Xem pantry hiện tại
`GET /api/pantry?userId=1`

---

## 3) Luồng chuẩn end-to-end cho client

## 3.1 Flow mở màn chat (bao gồm empty state)
1. Gọi `GET /api/ai-chat/messages?userId={id}&limit=30`
2. Nếu `items.length > 0` → render timeline bình thường.
3. Nếu `items.length == 0` (hiếm) → hiển thị empty state: “Bắt đầu trò chuyện với Bepes”.
4. Lưu local:
   - `sessionId = data.session.chatSessionId` (nếu có)
   - `hasMore`
   - `nextBeforeMessageId`

## 3.2 Flow gửi tin nhắn (khuyến nghị chuẩn để tránh lệch)
1. User bấm gửi.
2. Gọi `POST /api/ai-chat/messages`.
3. Nếu response bình thường (`Chat with AI successfully`) → reload trang đầu timeline.
4. Nếu response code nghiệp vụ là `PENDING_PREVIOUS_RECIPE_COMPLETION`:
   - mở modal bắt buộc với 2 nút:
     - `Hoàn thành & trừ nguyên liệu`
     - `Bỏ qua (không trừ)`
   - hiển thị `data.reminderMessage`
   - gọi `POST /api/ai-chat/sessions/resolve-previous` theo lựa chọn,
     trong body nhớ gửi thêm `pendingUserMessage = data.pendingUserMessage`
   - sau khi resolve thành công:
     - chuyển `sessionId` local = `data.newSession.chatSessionId`
     - gọi lại `GET /api/ai-chat/messages?userId={id}&limit=30` để render session mới.

> Lưu ý: backend sẽ tự mang `pendingUserMessage` sang session mới để không mất câu user vừa gửi.

> Có thể làm optimistic UI, nhưng vẫn nên reload trang đầu sau send để tránh lệch khi backend thêm meta/tool reply.

## 3.3 Flow lazy-load khi cuộn lên
1. Khi scroll lên top:
   - nếu `hasMore=false` → dừng.
   - nếu `hasMore=true` và có `nextBeforeMessageId` → gọi API với `beforeMessageId`.
2. `prepend` kết quả vào đầu list.
3. **Dedupe theo `chatMessageId`** để tránh trùng item.
4. Cập nhật lại `hasMore`, `nextBeforeMessageId`.

## 3.4 Flow đổi món trong chat
1. Đảm bảo đã có `sessionId` (lấy từ `GET /messages`).
2. User chọn món A/B trong UI.
3. Gọi `PATCH /api/ai-chat/sessions/active-recipe` với `recipeId` tương ứng.
4. Nếu user bỏ chế độ nấu món hiện tại → gửi `recipeId: null`.

## 3.5 Flow gợi ý món
1. User bấm “Gợi ý món”.
2. Gọi `POST /api/ai-chat/recommendations-from-pantry`.
3. Hiển thị nhóm:
   - món nấu ngay
   - món gần đủ nguyên liệu
4. Khi user chọn 1 món → gọi flow đổi món (3.4).

## 3.6 Flow “nấu xong” (phiên bản hiện tại)
> Backend hiện **chưa có** auto-deduct `draft -> confirm -> apply`.

Vì vậy client tạm làm:
1. Khi user nói “nấu xong”, hiển thị CTA: “Cập nhật kho nguyên liệu”.
2. Mở UI pantry editor.
3. Dùng `upsert/delete` để user xác nhận chỉnh tay.

## 3.7 Flow nhắc mạnh theo thời gian (món trước chưa chốt)
Backend hiện áp rule:
- từ **30 phút trở lên** kể từ tin nhắn cuối của session cũ, nếu còn `activeRecipeId` thì chặn chat tiếp và trả `PENDING_PREVIOUS_RECIPE_COMPLETION`.
- từ **3 tiếng trở lên** thì `reminderMessage` sẽ là bản nhắc mạnh hơn (`isStrongReminder = true`).

Client cần:
1. Nhận code `PENDING_PREVIOUS_RECIPE_COMPLETION`.
2. Hiển thị bắt buộc modal xác nhận với đúng 2 nút hành động.
3. Gọi `POST /api/ai-chat/sessions/resolve-previous`.
4. Đổi context UI sang `newSession` backend trả về.

---

## 4) Rule UI/UX bắt buộc để tránh loạn

1. Không hiển thị màn session list trong chat chính.
2. Tin nhắn render theo `role`:
   - `user`: bên phải
   - `assistant`: bên trái
3. Không gọi lazy-load đồng thời nhiều request (chặn double trigger khi đang loading).
4. Dedupe message theo `chatMessageId` khi merge list.
5. Sau send message, ưu tiên reload trang đầu để đồng bộ.

---

## 5) Bảng lỗi & xử lý UI theo endpoint

## 5.1 `GET /api/ai-chat/messages`
- `400`: thiếu/sai `userId` → báo “Thông tin người dùng không hợp lệ”
- `500`: lỗi server → show retry

## 5.2 `POST /api/ai-chat/messages`
- `400`: message rỗng/sai input → báo nhập lại
- `code=PENDING_PREVIOUS_RECIPE_COMPLETION` (HTTP 200): mở modal xử lý session cũ trước khi chat tiếp
- `503`: AI bận → “AI đang bận, thử lại sau ít phút”
- `500`: lỗi nội bộ → retry

## 5.3 `PATCH /api/ai-chat/sessions/active-recipe`
- `400`: thiếu userId/sessionId/recipeId sai kiểu → báo lỗi form
- `404`: session không tồn tại → reload timeline để lấy session mới
- `500`: retry

## 5.4 `POST /api/ai-chat/sessions/resolve-previous`
- `400`: thiếu userId/previousSessionId/action sai
- `404`: session cũ không tồn tại
- `500`: retry

## 5.5 Pantry API
- `400`: input sai (quantity/unit/ingredientName)
- `404`: item không tồn tại (delete)
- `500`: retry

---

## 6) Pseudocode tham chiếu (client)

```ts
type Msg = { chatMessageId: number; role: 'user' | 'assistant'; content: string };

let items: Msg[] = [];
let hasMore = true;
let cursor: number | null = null;
let sessionId: number | null = null;
let loadingOlder = false;

async function loadInitial(userId: number) {
  const res = await api.get(`/api/ai-chat/messages?userId=${userId}&limit=30`);
  const data = res.data.data;
  items = data.items || [];
  hasMore = !!data.paging?.hasMore;
  cursor = data.paging?.nextBeforeMessageId ?? null;
  sessionId = data.session?.chatSessionId ?? null;
}

async function loadOlder(userId: number) {
  if (!hasMore || !cursor || loadingOlder) return;
  loadingOlder = true;
  try {
    const res = await api.get(`/api/ai-chat/messages?userId=${userId}&limit=30&beforeMessageId=${cursor}`);
    const older = res.data.data.items || [];

    // dedupe
    const map = new Map<number, Msg>();
    [...older, ...items].forEach(m => map.set(m.chatMessageId, m));
    items = Array.from(map.values()).sort((a, b) => a.chatMessageId - b.chatMessageId);

    hasMore = !!res.data.data.paging?.hasMore;
    cursor = res.data.data.paging?.nextBeforeMessageId ?? null;
  } finally {
    loadingOlder = false;
  }
}

async function sendMessage(userId: number, message: string) {
  const res = await api.post('/api/ai-chat/messages', { userId, message, stream: false });

  if (res.data?.code === 'PENDING_PREVIOUS_RECIPE_COMPLETION') {
    const payload = res.data.data;
    const action = await openPendingRecipeModalAndWaitAction(payload);

    await api.post('/api/ai-chat/sessions/resolve-previous', {
      userId,
      previousSessionId: payload.previousSessionId,
      action,
      pendingUserMessage: payload.pendingUserMessage || ''
    });

    await loadInitial(userId);
    return;
  }

  await loadInitial(userId); // sync an toàn
}

async function switchActiveRecipe(userId: number, recipeId: number | null) {
  if (!sessionId) await loadInitial(userId);
  if (!sessionId) throw new Error('Missing sessionId');
  await api.patch('/api/ai-chat/sessions/active-recipe', { userId, chatSessionId: sessionId, recipeId });
}
```

---

## 7) Curl test nhanh cho QA/client

### 7.1 Load timeline
```bash
curl -sS "https://api.example.com/api/ai-chat/messages?userId=1&limit=30"
```

### 7.2 Lazy-load
```bash
curl -sS "https://api.example.com/api/ai-chat/messages?userId=1&limit=30&beforeMessageId=183"
```

### 7.3 Send message
```bash
curl -sS -X POST "https://api.example.com/api/ai-chat/messages" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"message":"test unified flow","stream":false}'
```

### 7.4 Đổi món đang nấu
```bash
curl -sS -X PATCH "https://api.example.com/api/ai-chat/sessions/active-recipe" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"chatSessionId":41,"recipeId":null}'
```

### 7.5 Gợi ý món
```bash
curl -sS -X POST "https://api.example.com/api/ai-chat/recommendations-from-pantry" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"limit":10}'
```

### 7.6 Resolve session cũ khi bị nhắc hoàn thành món trước
```bash
curl -sS -X POST "https://api.example.com/api/ai-chat/sessions/resolve-previous" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"previousSessionId":41,"action":"skip_deduction"}'
```

---

## 8) Checklist nghiệm thu cuối

- [ ] Chat UI chỉ còn 1 timeline (không list session).
- [ ] Mở chat load được trang đầu (20–30 tin).
- [ ] Cuộn lên lazy-load ổn định, không trùng message.
- [ ] Gửi tin không cần `chatSessionId` vẫn hoạt động.
- [ ] Đổi món hoạt động qua `PATCH active-recipe`.
- [ ] Gợi ý món từ pantry hiển thị đúng.
- [ ] Trường hợp "nấu xong" có flow cập nhật pantry thủ công rõ ràng.
- [ ] Khi nhận `PENDING_PREVIOUS_RECIPE_COMPLETION`, client hiển thị modal + resolve đúng.
- [ ] Xử lý đủ lỗi 400/404/500/503, không crash UI.

---

## 9) Ghi chú roadmap (để team nắm)

- Auto-deduct nguyên liệu sau nấu (`draft -> confirm -> apply`, idempotent) **chưa có API chính thức**.
- Khi backend phát hành phase đó, client sẽ thêm 1 flow xác nhận nhẹ thay cho cập nhật thủ công pantry.
