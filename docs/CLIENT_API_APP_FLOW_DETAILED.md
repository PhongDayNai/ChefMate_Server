# ChefMate Client Integration Guide (Chi tiết)

> Phiên bản tài liệu: 1.0  
> Cập nhật theo server hiện tại tại `chefmate-server`  
> Mục tiêu: hướng dẫn team client (mobile/web) triển khai đầy đủ API + app flow, tập trung vào **Chat AI**, **Tủ lạnh (Pantry)**, **Dị ứng/Hạn chế ăn uống (Diet Notes)**.

---

## 1) Tổng quan kiến trúc tích hợp

Client ChefMate nên coi backend theo 3 lớp nghiệp vụ chính:

1. **Hồ sơ ăn uống người dùng**
   - Dị ứng, hạn chế, sở thích, ghi chú sức khỏe
   - API: `/api/user-diet-notes/*`

2. **Nguồn nguyên liệu thực có**
   - Tủ lạnh/pantry theo user
   - API: `/api/pantry/*`

3. **Đề xuất & hội thoại AI nấu ăn**
   - Gợi ý món từ pantry + lọc theo dị ứng/hạn chế active
   - Chat theo session, có món đang nấu (`activeRecipeId`)
   - API: `/api/ai-chat/*`

Luồng chuẩn:  
**Diet Notes + Pantry -> Recommendations -> Session Chat -> Cooking Guidance -> Session Management**

---

## 2) Base URL, format response và quy ước xử lý lỗi

## 2.1 Base URL
- Production: `https://api.example.com`
- API docs UI: `https://api.example.com/api-docs`
- OpenAPI JSON: `https://api.example.com/api-docs/openapi.json`

## 2.2 Response envelope (thực tế đang dùng)
Đa số API trả dạng:

```json
{
  "success": true,
  "data": {},
  "message": "..."
}
```

Một số case nghiệp vụ đặc biệt có thêm `code`, ví dụ:
- `AI_SERVER_BUSY` (HTTP 503)
- `PENDING_PREVIOUS_RECIPE_COMPLETION` (HTTP 200, nhưng cần xử lý như trạng thái chặn luồng)

## 2.3 Quy ước bắt lỗi client

### Nhóm 400
- Dữ liệu đầu vào thiếu/sai kiểu
- Client hiển thị lỗi dạng form validation hoặc snackbar

### Nhóm 404
- Sai `sessionId + userId` hoặc item không tồn tại
- Client cần đồng bộ lại state và refresh danh sách

### Nhóm 500
- Lỗi hệ thống/backend
- Hiển thị thông báo chung, cho phép retry

### 503 `AI_SERVER_BUSY`
- Có fallback message từ server
- Retry theo backoff nhẹ: **3s -> 5s -> 8s** (tối đa 3 lần)

---

## 3) Mô hình dữ liệu tối thiểu phía client

Đề xuất state (Redux/MobX/ViewModel đều được):

```ts
type AppState = {
  auth: {
    userId: number | null;
  };

  diet: {
    notes: DietNote[];
    lastFetchedAt?: string;
  };

  pantry: {
    items: PantryItem[];
    lastFetchedAt?: string;
  };

  recommendations: {
    items: Recommendation[];
    readyToCook: Recommendation[];
    almostReady: Recommendation[];
    recommendationLimit: number;
  };

  chat: {
    currentSessionId: number | null;
    currentSession?: ChatSession;
    timeline: ChatMessage[];
    paging: {
      hasMore: boolean;
      nextBeforeMessageId: number | null;
      limit: number;
    };
    pendingPreviousRecipe?: PendingPreviousRecipePayload | null;
    sending: boolean;
    aiBusyRetryCount: number;
  };
};
```

---

## 4) API chi tiết: Dị ứng/Hạn chế (User Diet Notes)

## 4.1 Lấy danh sách note
**GET** `/api/user-diet-notes?userId={id}`

### Thành công
```json
{
  "success": true,
  "data": [
    {
      "noteId": 12,
      "userId": 4,
      "noteType": "allergy",
      "label": "Dị ứng tôm cua",
      "keywords": ["tôm", "cua", "shrimp", "crab"],
      "instruction": "Tránh hoàn toàn",
      "isActive": true,
      "startAt": null,
      "endAt": null,
      "createdAt": "2026-03-25T...",
      "updatedAt": "2026-03-25T..."
    }
  ],
  "message": "Get diet notes successfully"
}
```

## 4.2 Tạo hoặc cập nhật note
**POST** `/api/user-diet-notes/upsert`

### Tạo mới
```json
{
  "userId": 4,
  "noteType": "allergy",
  "label": "Dị ứng đậu phộng",
  "keywords": ["đậu phộng", "peanut", "groundnut"],
  "instruction": "Không dùng dầu đậu phộng",
  "isActive": true
}
```

### Cập nhật
```json
{
  "noteId": 12,
  "userId": 4,
  "noteType": "allergy",
  "label": "Dị ứng hải sản giáp xác",
  "keywords": ["tôm", "cua"],
  "instruction": "Tránh hoàn toàn",
  "isActive": true
}
```

> Server trả lại full list sau upsert (thuận tiện sync UI).

## 4.3 Xóa note
**DELETE** `/api/user-diet-notes/delete`

```json
{
  "userId": 4,
  "noteId": 12
}
```

---

## 5) API chi tiết: Tủ lạnh (Pantry)

## 5.1 Lấy pantry theo user
**GET** `/api/pantry?userId={id}`

## 5.2 Upsert pantry item
**POST** `/api/pantry/upsert`

```json
{
  "userId": 4,
  "ingredientName": "Ức gà",
  "quantity": 500,
  "unit": "g",
  "expiresAt": "2026-03-29"
}
```

### Hành vi quan trọng ở backend
- Nếu ingredient chưa có trong bảng `Ingredients` -> server tự tạo.
- Nếu cùng `userId + ingredientId + unit` đã tồn tại -> **update quantity/expiresAt**.
- Nếu chưa tồn tại -> insert mới.
- Trả về full pantry list sau upsert.

## 5.3 Xóa pantry item
**DELETE** `/api/pantry/delete`

```json
{
  "userId": 4,
  "pantryItemId": 31
}
```

---

## 6) API chi tiết: Recommendations từ Pantry

## 6.1 Lấy gợi ý
**POST** `/api/ai-chat/recommendations-from-pantry`

```json
{
  "userId": 4,
  "limit": 10
}
```

### Response ý nghĩa
- `recommendations`: list hợp nhất, có `index` + `recommendationType`
- `readyToCook`: món đủ nguyên liệu
- `almostReady`: món thiếu ít (ưu tiên thiếu gia vị/cơ bản)

```json
{
  "success": true,
  "data": {
    "recommendationLimit": 10,
    "recommendations": [
      {
        "index": 1,
        "recommendationType": "ready_to_cook",
        "recipeId": 101,
        "recipeName": "Ức gà áp chảo",
        "completionRate": 100,
        "missing": []
      },
      {
        "index": 2,
        "recommendationType": "almost_ready",
        "recipeId": 88,
        "recipeName": "Canh rau cải",
        "completionRate": 92,
        "missing": [{"ingredientName": "hành lá", "need": 10, "have": 0, "unit": "g"}]
      }
    ]
  },
  "message": "Get recommendations from pantry successfully"
}
```

### Quy tắc lọc dị ứng/hạn chế
Trong model server, recommendations đã lấy `activeDietNotes` để chặn công thức vi phạm.  
=> Client **không cần tự lọc lại theo dị ứng** (trừ khi muốn thêm lớp cảnh báo UI).

---

## 7) API chi tiết: Chat AI theo session

## 7.1 Tạo session
**POST** `/api/ai-chat/sessions`

```json
{
  "userId": 4,
  "firstMessage": "Tối nay tôi muốn ăn món bò nhanh",
  "model": "gemma3:4b"
}
```

Hoặc custom title:

```json
{
  "userId": 4,
  "title": "Bữa tối healthy",
  "activeRecipeId": null
}
```

### Hành vi quan trọng
- Nếu không truyền `title`, server tự tạo title từ AI theo `firstMessage`.
- Session mới luôn có **intro message của Bepes** ngay đầu lịch sử.

---

## 7.2 Danh sách session
**GET** `/api/ai-chat/sessions?userId=4&page=1&limit=50`

Phục vụ màn hình lịch sử hội thoại.

---

## 7.3 Lấy lịch sử session
**GET** `/api/ai-chat/sessions/{sessionId}?userId=4`

- Trả `session` + `messages` (recent tối đa theo server hiện tại)
- Dùng cho màn hình mở lại cuộc chat cũ.

---

## 7.4 Cập nhật tiêu đề session
**PATCH** `/api/ai-chat/sessions/title`

```json
{
  "userId": 4,
  "chatSessionId": 26,
  "title": "Nấu ăn cho 2 người"
}
```

---

## 7.5 Cập nhật món đang nấu (active recipe)
**PATCH** `/api/ai-chat/sessions/active-recipe`

```json
{
  "userId": 4,
  "chatSessionId": 26,
  "recipeId": 101
}
```

Clear món đang nấu:
```json
{
  "userId": 4,
  "chatSessionId": 26,
  "recipeId": null
}
```

---

## 7.6 Gửi message tới AI
**POST** `/api/ai-chat/messages`

### Chat với session đã có
```json
{
  "userId": 4,
  "chatSessionId": 26,
  "message": "Hướng dẫn bước 1 thật ngắn",
  "model": "gemma3:4b",
  "stream": true
}
```

### Chat không có sessionId (auto create)
```json
{
  "userId": 4,
  "message": "Tối nay tôi muốn ăn món gà ít dầu mỡ",
  "model": "gemma3:4b",
  "stream": false
}
```

### Unified session mode
- Trường `useUnifiedSession` mặc định controller đang set là `true` khi không truyền.
- Nếu gọi kiểu “không truyền chatSessionId + unified mode”, server có thể dùng/default session gần nhất.

---

## 7.7 Timeline hợp nhất (lazy load)
**GET** `/api/ai-chat/messages?userId=4&limit=30&beforeMessageId=1234`

Dùng cho UI chat cuộn ngược.

---

## 7.8 Resolve session cũ khi đang nấu dở
**POST** `/api/ai-chat/sessions/resolve-previous`

```json
{
  "userId": 4,
  "previousSessionId": 26,
  "action": "complete_and_deduct",
  "pendingUserMessage": "Cho tôi món khác nhẹ bụng hơn"
}
```

`action` chỉ nhận:
- `complete_and_deduct`
- `skip_deduction`

---

## 7.9 Xóa session
**DELETE** `/api/ai-chat/sessions/{id}?userId=4`

---

## 7.10 Cơ chế tạo session mới, kết thúc session cũ, và tin nhắn đầu tiên (QUAN TRỌNG)

Phần này mô tả đúng hành vi backend hiện tại để client xử lý chính xác vòng đời chat.

### A. Khi nào session mới được tạo?

Session mới được tạo trong 3 tình huống chính:

1. **Client gọi tạo session tường minh**
   - API: `POST /api/ai-chat/sessions`
   - Dùng khi user bấm “Tạo cuộc trò chuyện mới”, hoặc vào màn chat mới từ Home.

2. **Client gửi message nhưng không có `chatSessionId` và không đi nhánh dùng session cũ**
   - API: `POST /api/ai-chat/messages`
   - Backend có thể auto tạo session mới (đặt title tự động từ message đầu nếu không có title).

3. **Client resolve session cũ còn dang dở món nấu**
   - API: `POST /api/ai-chat/sessions/resolve-previous`
   - Sau khi xử lý session cũ theo action, backend tạo session mới.

---

### B. “Kết thúc session cũ” trong ChefMate được hiểu như thế nào?

Hiện tại backend **không có trạng thái `closed` riêng** cho `ChatSessions`.  
Thay vào đó, “kết thúc session cũ” trong flow nấu ăn được thực hiện bằng nghiệp vụ:

1. Clear món đang nấu của session cũ (`activeRecipeId -> null`)
2. Ghi một assistant message vào session cũ để log quyết định:
   - `complete_and_deduct`: ghi nhận hoàn thành (hiện chưa tự trừ kho, user cập nhật kho thủ công)
   - `skip_deduction`: ghi nhận bỏ qua trừ kho
3. Tạo session mới để tiếp tục chat

=> Nghĩa là session cũ vẫn tồn tại trong lịch sử, nhưng **đã được chốt nghiệp vụ** và không còn active recipe.

---

### C. Tin nhắn đầu tiên khi tạo session mới là gì?

Backend luôn chèn intro message của agent **Bepes** vào đầu session mới:

```text
Xin chào anh, em là Bepes – trợ lý nấu ăn của ChefMate. Em có thể gợi ý món theo nguyên liệu hiện có, hướng dẫn từng bước nấu và điều chỉnh theo dị ứng/hạn chế ăn uống của anh.
```

Intro này xuất hiện trong các nhánh:
- `POST /api/ai-chat/sessions`
- Auto-create session từ `POST /api/ai-chat/messages` (khi chưa có session)
- `POST /api/ai-chat/sessions/resolve-previous` (session mới tạo sau khi chốt session cũ)
- Lần đầu mở unified timeline nếu chưa có session (server tạo default session)

---

### D. Flow chuẩn “session cũ -> session mới” (có pending recipe)

#### Bước 1: User gửi message mới
`POST /api/ai-chat/messages`

Nếu session gần nhất còn `activeRecipeId` và đủ điều kiện nhắc, API có thể trả:

```json
{
  "success": true,
  "code": "PENDING_PREVIOUS_RECIPE_COMPLETION",
  "data": {
    "previousSessionId": 26,
    "recipeId": 101,
    "recipeName": "Ức gà áp chảo",
    "minutesSinceLastMessage": 42,
    "isStrongReminder": false,
    "reminderMessage": "...",
    "pendingUserMessage": "Cho tôi món mới",
    "actions": [
      { "id": "complete_and_deduct", "label": "Hoàn thành & trừ nguyên liệu" },
      { "id": "skip_deduction", "label": "Bỏ qua (không trừ)" }
    ]
  }
}
```

#### Bước 2: Client buộc user chọn hành động
- Nút 1: `complete_and_deduct`
- Nút 2: `skip_deduction`

#### Bước 3: Gọi resolve
`POST /api/ai-chat/sessions/resolve-previous`

```json
{
  "userId": 4,
  "previousSessionId": 26,
  "action": "complete_and_deduct",
  "pendingUserMessage": "Cho tôi món mới"
}
```

#### Bước 4: Backend thực thi
- Clear `activeRecipeId` của session 26
- Ghi assistant log message vào session 26
- Tạo session mới
- Chèn intro Bepes vào session mới
- Nếu có `pendingUserMessage`, migrate message này sang session mới dưới role `user`

#### Bước 5: Client cập nhật state
- Set `currentSessionId = data.newSession.chatSessionId`
- Reload timeline session mới
- Đóng modal pending

---

### E. Flow “tạo session mới chủ động”

Khi user bấm nút “Cuộc trò chuyện mới”:

1. Gọi `POST /api/ai-chat/sessions`
2. Lấy `chatSessionId` mới từ response
3. Mở màn chat với session mới
4. Render ngay intro message đã có sẵn trong history

Khuyến nghị UX:
- Nếu user đang có session với `activeRecipeId`, hỏi xác nhận trước khi tạo session mới.
- Cho phép 2 lựa chọn giống resolve flow để tránh lệch logic kho/ngữ cảnh.

---

### F. Quy tắc client bắt buộc để không lỗi logic

1. Không coi “session mới” = “xóa session cũ”.
2. Luôn xử lý `PENDING_PREVIOUS_RECIPE_COMPLETION` trước khi gửi tiếp message mới.
3. Khi nhận `newSession` từ resolve flow, luôn đồng bộ:
   - `currentSessionId`
   - `currentSession`
   - timeline theo session mới
4. Luôn hiển thị intro message đầu phiên (nếu API đã trả trong history).

---

## 8) App Flow theo từng màn hình (đề xuất triển khai)

## 8.1 Onboarding / Login
1. Login/Register để lấy `userId`
2. Lưu `userId` local secure storage
3. Điều hướng Home

---

## 8.2 Home (load nhanh)
Khi mở Home:
1. `GET /api/user-diet-notes?userId=...`
2. `GET /api/pantry?userId=...`
3. `POST /api/ai-chat/recommendations-from-pantry`

Render:
- Khối “Nấu ngay” (`ready_to_cook`)
- Khối “Thiếu chút là nấu được” (`almost_ready`)

---

## 8.3 Màn hình Dị ứng/Hạn chế
### Use case A: thêm dị ứng mới
1. Submit form -> `POST /api/user-diet-notes/upsert`
2. Thành công -> cập nhật list ngay bằng `data` trả về
3. Trigger refresh recommendations

### Use case B: bật/tắt note
- Gọi lại upsert với `noteId` + `isActive`

### Use case C: xóa note
- Confirm dialog -> `DELETE /api/user-diet-notes/delete`
- Thành công -> cập nhật list + refresh recommendations

---

## 8.4 Màn hình Tủ lạnh
### Use case A: thêm nguyên liệu
1. Nhập ingredientName/quantity/unit/expiresAt
2. `POST /api/pantry/upsert`
3. Reload pantry list từ response
4. Refresh recommendations

### Use case B: sửa quantity hoặc expiry
- Dùng lại `upsert` cùng ingredient+unit

### Use case C: xóa item
- `DELETE /api/pantry/delete`
- Thành công -> refresh pantry + recommendations

---

## 8.5 Màn hình Chat

## Luồng khuyến nghị khi user bấm “Chat với món này”
1. Tạo hoặc lấy session hiện có
   - Cách 1: tạo mới `POST /sessions`
   - Cách 2: dùng auto message nếu không cần tạo trước
2. Gắn món đã chọn
   - `PATCH /sessions/active-recipe`
3. Gửi message
   - `POST /messages`

## Luồng gửi tin nhắn bình thường
1. Optimistic add user bubble
2. Call `POST /messages`
3. Nếu success: render assistant bubble
4. Nếu `AI_SERVER_BUSY`: render fallback + nút retry
5. Nếu pending previous recipe: mở modal resolve (phần dưới)

---

## 8.6 Luồng đặc biệt: `PENDING_PREVIOUS_RECIPE_COMPLETION`

Khi `POST /messages` trả:
```json
{
  "success": true,
  "code": "PENDING_PREVIOUS_RECIPE_COMPLETION",
  "data": {
    "previousSessionId": 26,
    "recipeId": 101,
    "recipeName": "Ức gà áp chảo",
    "pendingUserMessage": "Cho tôi món mới"
  }
}
```

Client phải:
1. Hiện modal xác nhận:
   - “Đánh dấu hoàn thành và trừ nguyên liệu”
   - “Bỏ qua trừ nguyên liệu”
2. Gọi `POST /sessions/resolve-previous` với action phù hợp
3. Dùng `newSession` trả về làm session hiện tại
4. Nếu có `carriedPendingUserMessage`, hiển thị trong timeline mới

---

## 9) Retry, timeout, loading strategy đề xuất

## 9.1 Retry policy
- Chỉ auto retry cho `AI_SERVER_BUSY` (503)
- Tối đa 3 lần: 3s, 5s, 8s
- Các lỗi 4xx không auto retry

## 9.2 Timeout phía client
- Read timeout chat >= 25s (server AI timeout mặc định 20s)
- API CRUD thông thường 10–15s

## 9.3 Loading UX
- Pantry/Diet: skeleton list
- Chat send: disable nút gửi khi đang gửi 1 request
- Recommendations: placeholder cards + pull-to-refresh

---

## 10) Mapping enum và hằng số cho client

## 10.1 `noteType`
- `allergy`
- `restriction`
- `preference`
- `health_note`

## 10.2 `recommendationType`
- `ready_to_cook`
- `almost_ready`

## 10.3 Chat business code
- `AI_SERVER_BUSY`
- `PENDING_PREVIOUS_RECIPE_COMPLETION`

## 10.4 Resolve action
- `complete_and_deduct`
- `skip_deduction`

---

## 11) Pseudo-code tích hợp nhanh

```ts
async function refreshHomeContext(userId: number) {
  const [dietRes, pantryRes] = await Promise.all([
    api.get(`/api/user-diet-notes?userId=${userId}`),
    api.get(`/api/pantry?userId=${userId}`)
  ]);

  state.diet.notes = dietRes.data.data;
  state.pantry.items = pantryRes.data.data;

  const recRes = await api.post('/api/ai-chat/recommendations-from-pantry', { userId, limit: 10 });
  state.recommendations = recRes.data.data;
}

async function sendChatMessage(payload: {
  userId: number;
  chatSessionId?: number;
  message: string;
}) {
  try {
    const res = await api.post('/api/ai-chat/messages', payload);
    const body = res.data;

    if (body.code === 'PENDING_PREVIOUS_RECIPE_COMPLETION') {
      state.chat.pendingPreviousRecipe = body.data;
      openResolveModal();
      return;
    }

    appendAssistant(body.data.assistantMessage);
    state.chat.currentSessionId = body.data.session.chatSessionId;
  } catch (e: any) {
    const code = e?.response?.data?.code;
    if (e?.response?.status === 503 && code === 'AI_SERVER_BUSY') {
      handleRetryBusy(payload);
      return;
    }
    showErrorToast('Gửi tin nhắn thất bại, vui lòng thử lại.');
  }
}
```

---

## 12) Checklist triển khai theo màn hình (dev checklist)

## 12.1 Auth
- [ ] Lưu `userId` sau login/register
- [ ] Guard màn hình yêu cầu đăng nhập

## 12.2 Diet Notes
- [ ] CRUD đầy đủ với `/api/user-diet-notes/*`
- [ ] Toggle `isActive`
- [ ] Hỗ trợ keywords dạng chips/tag input

## 12.3 Pantry
- [ ] CRUD với `/api/pantry/*`
- [ ] Validate quantity >= 0
- [ ] Unit picker (`g`, `kg`, `ml`, `l`, `tbsp`, ...)
- [ ] Refresh recommendations sau mọi thay đổi pantry

## 12.4 Recommendations
- [ ] Render theo `data.recommendations` đúng `index`
- [ ] Badge `ready_to_cook` / `almost_ready`
- [ ] Hiển thị `missing[]` rõ ràng

## 12.5 Chat
- [ ] Gửi message với/không sessionId đều hoạt động
- [ ] Hỗ trợ `PENDING_PREVIOUS_RECIPE_COMPLETION`
- [ ] Hỗ trợ retry `AI_SERVER_BUSY`
- [ ] Màn lịch sử session + đổi title + xóa session
- [ ] Timeline lazy-load qua `beforeMessageId`

---

## 13) Rủi ro thường gặp & cách tránh

1. **Sai cặp `sessionId + userId`** -> 404  
   => luôn lấy session từ API theo user hiện tại.

2. **Không refresh recommendations sau khi sửa pantry/diet**  
   => dữ liệu gợi ý bị cũ.

3. **Không xử lý `PENDING_PREVIOUS_RECIPE_COMPLETION`**  
   => user cảm giác chat bị đứng dù API trả 200.

4. **Auto retry cả lỗi 4xx**  
   => gây spam request không cần thiết.

5. **Không lưu `currentSessionId` sau message auto-create**  
   => các lượt chat sau bị tách thành nhiều session khó quản lý.

---

## 14) Đề xuất thứ tự triển khai (sprint-friendly)

### Giai đoạn 1 (MVP chạy ổn)
1. Auth + lưu userId
2. Pantry CRUD
3. Diet note CRUD
4. Recommendations từ pantry
5. Chat cơ bản (`/messages`), bắt `AI_SERVER_BUSY`

### Giai đoạn 2 (UX tốt)
1. Session list/history/title/delete
2. active recipe flow
3. Unified timeline lazy-load
4. pending previous recipe modal + resolve flow

### Giai đoạn 3 (hoàn thiện)
1. Telemetry/log error mapping
2. UI tinh chỉnh nhắc dị ứng
3. Caching thông minh + background refresh

---

## 15) Kết luận

Với backend hiện tại, client chỉ cần bám đúng trục:

**Diet notes + Pantry chính xác -> Recommendations đúng ngữ cảnh -> Chat session có active recipe -> Handle đầy đủ AI busy + pending previous recipe**

là sẽ ra được trải nghiệm nấu ăn cá nhân hóa, an toàn với dị ứng, và mượt cho người dùng cuối.
