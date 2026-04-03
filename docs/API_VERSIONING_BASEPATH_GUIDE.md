# API Versioning & Base Path Guide

> Cập nhật: 2026-04-03

## Tổng quan

Hệ thống hiện chạy song song 2 backend:

1. **Legacy server (port 8000)**
   - Base path: `/api/...` (giữ nguyên như cũ)
   - Auth/flow giữ tương thích cũ (đặc biệt chat dùng `x-api-key`)

2. **JWT server (port 13081)**
   - Base path: `/v2/...`
   - Auth theo JWT + các rule mới (chat yêu cầu Bearer + `x-api-key`)

---

## Mapping nhanh theo cổng

### Port 8000 (legacy)
- `GET http://<host>:8000/api/recipes/all`
- `POST http://<host>:8000/api/users/login`
- `POST http://<host>:8000/api/ai-chat/messages`

### Port 13081 (jwt)
- `GET http://<host>:13081/v2/recipes/all`
- `POST http://<host>:13081/v2/users/login`
- `POST http://<host>:13081/v2/ai-chat/messages`

---

## Lưu ý quan trọng cho client

- Dùng đúng prefix theo môi trường:
  - Legacy (8000): `/api`
  - JWT (13081): `/v2`
- Chat trên `13081` bắt buộc 2 header:
  - `Authorization: Bearer <accessToken>`
  - `x-api-key: __CHANGE_ME_CHAT_API_KEY__`

---

## Ví dụ config client

```ts
// legacy client
const LEGACY_BASE_URL = 'http://<host>:8000/api';

// jwt client
const JWT_BASE_URL = 'http://<host>:13081/v2';
```
