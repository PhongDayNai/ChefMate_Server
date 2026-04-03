# API Versioning & Migration Rule (13081)

> Cập nhật: 2026-04-03

## Rule anh yêu cầu (đã áp dụng)

### Legacy server — giữ nguyên
- Port `8000`: tiếp tục dùng route cũ `/api/...`

### JWT server — route mới
- Port `13081`: dùng prefix version ở đầu path: `/v2/...`
- Các endpoint có hậu tố `-v2` được chuẩn hoá theo dạng không hậu tố khi phù hợp.

Ví dụ chính:
- `13081 /api/recipes/trending-v2`  ->  `13081 /v2/recipes/trending`

---

## Mapping đã áp dụng trên 13081

### Recipes
- `GET /v2/recipes/trending` = behavior của **trending-v2**
- `GET /v2/recipes/trending-v1` = behavior cũ của **trending**
- `GET /v2/recipes/trending-v2` vẫn giữ như alias tương thích tạm thời

### Chat
- `POST /v2/ai-chat/...` = chat v2 meal flow (thay cho `/api/ai-chat/v2/...`)
- `POST /v2/ai-chat-v1/...` = chat v1 flow

### Các nhóm còn lại
- `users` -> `/v2/users/...`
- `interactions` -> `/v2/interactions/...`
- `pantry` -> `/v2/pantry/...`
- `user-diet-notes` -> `/v2/user-diet-notes/...`

---

## Lưu ý auth (13081)
- Chat (`/v2/ai-chat/*` và `/v2/ai-chat-v1/*`) bắt buộc:
  - `Authorization: Bearer <accessToken>`
  - `x-api-key: __CHANGE_ME_CHAT_API_KEY__`
