# API Versioning & Route Policy

> Cập nhật: 2026-04-03

## Kết luận ngắn
- **Không version theo base path** kiểu `/v1/...` hay `/v2/...`.
- Giữ route gốc dạng **`/api/...`** cho cả 2 server.
- Version được thể hiện ở **từng API cụ thể** (ví dụ: `trending-v2`, `ai-chat/v2/...`).

---

## Cách hiểu đúng về v1/v2 trong project

### 1) Version theo endpoint (đúng)
Ví dụ:
- `GET /api/recipes/trending` (version cũ của feed)
- `GET /api/recipes/trending-v2` (version mới của feed)
- `POST /api/ai-chat/messages` (chat flow v1)
- `POST /api/ai-chat/v2/messages` (chat flow v2)

### 2) Không đổi base path toàn hệ thống
- Không dùng quy ước kiểu `/v1/users`, `/v2/users`.
- Vẫn dùng `/api/users`, `/api/recipes`, `/api/ai-chat`...

---

## Chính sách theo môi trường chạy

### Port 8000 (legacy runtime)
- Giữ nguyên route cũ: `/api/...`

### Port 13081 (JWT runtime)
- Cũng dùng route `/api/...`
- Khác nhau ở auth/behavior, không khác base path.

---

## Ví dụ thực tế

- Legacy + JWT đều gọi được:
  - `GET /api/recipes/all`
  - `GET /api/recipes/trending-v2`

- Chat v2 endpoint:
  - `POST /api/ai-chat/v2/messages`

> Tóm lại: **v1/v2 là version nghiệp vụ của endpoint**, không phải version của toàn bộ URL prefix.
