# AI Chat V2 — Link nhanh cho anh hai

## 1) Swagger / OpenAPI
- Swagger UI: `/api-docs`
- OpenAPI JSON: `/api-docs/openapi.json`
- File spec trong repo: `docs/openapi.json`

## 2) Tài liệu tích hợp client (đầy đủ)
- `docs/CLIENT_CHAT_V2_INTEGRATION_GUIDE.md`

## 3) Code backend liên quan Chat V2
- Route: `routes/aiChatV2Routes.js`
- Controller: `controllers/aiChatV2Controller.js`
- Model: `models/aiChatV2Model.js`
- Mount route trong server: `server.js` (`/api/ai-chat/v2`)

## 4) Migration DB
- `scripts/migrate_ai_chat_v2.sql`

## 5) Các endpoint v2 chính
- `POST /api/ai-chat/v2/sessions/meal`
- `PATCH /api/ai-chat/v2/sessions/meal/recipes`
- `PATCH /api/ai-chat/v2/sessions/meal/primary-recipe`
- `PATCH /api/ai-chat/v2/sessions/meal/recipes/status`
- `POST /api/ai-chat/v2/messages`

## 6) Link production/local (tham khảo)
- Production base: `https://api.example.com`
- Local docker base: `http://127.0.0.1:8000`
- Ví dụ swagger local: `http://127.0.0.1:8000/api-docs`
