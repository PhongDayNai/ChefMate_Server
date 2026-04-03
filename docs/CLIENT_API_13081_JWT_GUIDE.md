# ChefMate Client API Guide (JWT) — Port 13081

> Cập nhật: 2026-04-03  
> Base URL mới: `http://<host>:13081`  
> Prefix mới: `/v2/...`

---

## 1) Quy tắc route mới trên 13081

- Legacy 8000 giữ nguyên `/api/...`.
- JWT 13081 chuyển sang `/v2/...`.
- Endpoint version cũ có hậu tố `-v2` sẽ được chuẩn hoá dần.

Ví dụ bắt buộc:
- `GET /api/recipes/trending-v2` (cũ) -> `GET /v2/recipes/trending` (mới)

---

## 2) Auth model

### 2.1 JWT chung
- Dùng `Authorization: Bearer <accessToken>` cho API private.
- Dùng `POST /v2/users/refresh-token` để refresh.

### 2.2 Chat bảo mật kép (13081)
Với chat (`/v2/ai-chat/*`, `/v2/ai-chat-v1/*`) bắt buộc đồng thời:
- `Authorization: Bearer <accessToken>`
- `x-api-key: __CHANGE_ME_CHAT_API_KEY__`

---

## 3) Danh sách endpoint 13081

## 3.1 Users
- `GET /v2/users/all`
- `POST /v2/users/register`
- `POST /v2/users/login`
- `POST /v2/users/refresh-token`
- `POST /v2/users/forgot-password`
- `POST /v2/users/change-password`
- `GET /v2/users/recipes-view-history` (private)
- `POST /v2/users/update-user-information` (private)
- `PATCH /v2/users/me` (private)

## 3.2 Recipes
Public:
- `GET /v2/recipes/all`
- `GET /v2/recipes/search?q=...` (optional Bearer)
- `POST /v2/recipes/search` (optional Bearer)
- `GET /v2/recipes/ingredients`
- `GET /v2/recipes/tags`
- `GET /v2/recipes/by-tag?tagName=...` (optional Bearer)
- `POST /v2/recipes/search-by-tag` (optional Bearer)
- `GET /v2/recipes/growth-report`

Trending mapping:
- `GET /v2/recipes/trending` => behavior cũ của `trending-v2`
- `GET /v2/recipes/trending-v1` => behavior cũ của `trending`
- `GET /v2/recipes/trending-v2` => alias tương thích

Private:
- `POST /v2/recipes/create`
- `GET /v2/recipes/top-trending`
- `POST /v2/recipes/top-trending`
- `GET /v2/recipes/me`
- `POST /v2/recipes/user-recipes`
- `GET /v2/recipes/admin/pending`
- `PATCH /v2/recipes/admin/review`

## 3.3 Interactions
- `GET /v2/interactions/comments`
- `POST /v2/interactions/increase-view-count`
- `POST /v2/interactions/like` (private)
- `POST /v2/interactions/comment` (private)
- `DELETE /v2/interactions/comment` (private)

## 3.4 Pantry (private)
- `GET /v2/pantry`
- `POST /v2/pantry/upsert`
- `DELETE /v2/pantry/delete`

## 3.5 User Diet (private)
- `GET /v2/user-diet-notes`
- `POST /v2/user-diet-notes/upsert`
- `DELETE /v2/user-diet-notes/delete`

## 3.6 Chat v2 meal flow (private + dual auth)
Base: `/v2/ai-chat`
- `POST /sessions/meal`
- `PATCH /sessions/meal/recipes`
- `PATCH /sessions/meal/recipes/status`
- `PATCH /sessions/meal/primary-recipe`
- `PATCH /sessions/meal/complete`
- `POST /messages`

## 3.7 Chat v1 flow (private + dual auth)
Base: `/v2/ai-chat-v1`
- `POST /sessions`
- `GET /sessions`
- `GET /sessions/:sessionId`
- `DELETE /sessions/:id`
- `PATCH /sessions/title`
- `PATCH /sessions/active-recipe`
- `GET /recommendations-from-pantry`
- `POST /recommendations-from-pantry`
- `POST /sessions/resolve-previous`
- `POST /messages`
- `GET /messages`

---

## 4) Quick migration examples

- `GET /api/recipes/trending-v2` -> `GET /v2/recipes/trending`
- `GET /api/recipes/trending` -> `GET /v2/recipes/trending-v1`
- `POST /api/ai-chat/v2/messages` -> `POST /v2/ai-chat/messages`
- `POST /api/ai-chat/messages` -> `POST /v2/ai-chat-v1/messages`

