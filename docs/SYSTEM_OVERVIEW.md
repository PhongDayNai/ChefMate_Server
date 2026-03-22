# SYSTEM OVERVIEW — ChefMate Server

_Cập nhật: 2026-03-22_

## 1) Kiến trúc tổng thể
- Runtime: Node.js + Express
- DB: MySQL (docker volume persistent)
- API style: REST JSON
- Static assets: serve từ `assets/`
- AI integration: upstream chat API (config qua env)

---

## 2) Module chính

### A) Users (legacy)
- Đăng ký/đăng nhập/đổi mật khẩu/cập nhật thông tin

### B) Recipes (legacy + mở rộng)
- CRUD/search công thức
- tags/ingredients
- growth report
- trending v1 và v2

### C) Interactions (legacy)
- like/comment/view count

### D) Pantry (mới)
- quản lý nguyên liệu theo user

### E) User Diet Notes (mới)
- quản lý dị ứng/hạn chế/sở thích

### F) AI Chat (mới)
- chat session
- session history
- active recipe
- auto-title bằng AI
- intro message Bepes
- chat có context pantry + diet + recipe

---

## 3) Data model nổi bật
- `Users`
- `Recipes`
- `RecipesIngredients`
- `CookingSteps`
- `UsersLike`
- `UsersComment`
- `PantryItems`
- `UserDietNotes`
- `ChatSessions`
- `ChatMessages`

---

## 4) Ảnh và static files
- `assets/images/recipes/` chứa ảnh recipe cache local
- `assets/images/placeholders/` chứa placeholder SVG cho recipe thiếu ảnh
- URL ảnh trả về dạng `/images/...`

---

## 5) Tính tương thích
- API legacy vẫn hoạt động cho client cũ
- API mới bổ sung side-by-side, không phá vỡ contract cũ

Ví dụ:
- Legacy: `POST /api/recipes/top-trending`
- New: `GET /api/recipes/trending-v2` (paging/infinite scroll)

---

## 6) Quan sát vận hành
- Lỗi AI thường gặp: `AI_SERVER_BUSY` (503)
- Khuyến nghị client: retry 2–3 lần, backoff nhẹ
- Session APIs yêu cầu đúng cặp `sessionId + userId`

---

## 7) Tài liệu chính thức
- OpenAPI spec: `docs/openapi.json`
- Swagger UI: `/api-docs`
