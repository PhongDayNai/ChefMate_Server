# ChefMate Server API

> Language: **English first** · [Jump to Vietnamese 🇻🇳](#-tiếng-việt)

Backend API for ChefMate (mobile cooking assistant app), built with Express + MySQL.

- Client app: https://github.com/PhongDayNai/ChefMate_Client
- Admin web: https://github.com/PhongDayNai/ChefMate_Admin_Web

---

## 🇬🇧 English

## 1) Overview

ChefMate Server provides:
- User authentication and profile APIs
- Recipe management (create/search/trending/tags/ingredients)
- Social interactions (likes/comments/views)
- Pantry management per user
- AI Chat cooking assistant:
  - **V1**: single active recipe per chat session
  - **V2**: multi-recipe meal session with focus recipe switching flow

## 2) Tech Stack

- Node.js + Express
- MySQL
- Docker / Docker Compose
- OpenAPI (Swagger)

## 3) Main Features

### User
- Register / Login (phone or email)
- Update profile
- Change/reset password
- Get users list

### Recipe
- Get all recipes
- Search by name / tags
- Create recipe
- Trending recipes
- Ingredient and tag lists

### Interaction
- Like recipe
- Comment recipe
- Delete comment
- Increase recipe views

### Pantry + AI Chat
- Pantry per user (`PantryItems`)
- Recipe recommendations from pantry
- Chat session history (`ChatSessions`, `ChatMessages`)
- AI Chat V1 and V2 endpoints

## 4) AI Chat V2 (Multi-Recipe)

V2 is designed for “one meal with multiple dishes”.

Core flow:
1. Create meal session with multiple recipes
2. Set/clear primary (focus) recipe
3. Update recipe status (`pending | cooking | done | skipped`)
4. If closing current focus recipe, backend returns
   `PENDING_PRIMARY_RECIPE_SWITCH_CONFIRMATION`
5. Client confirms the next focus recipe

Detailed client guide:
- `docs/CLIENT_CHAT_V2_INTEGRATION_GUIDE.md`
- Quick links: `docs/AI_CHAT_V2_LINKS.md`

## 5) API Documentation

After starting server:
- Swagger UI: `/api-docs`
- OpenAPI JSON: `/api-docs/openapi.json`
- OpenAPI file in repo: `docs/openapi.json`

## 6) Run with Docker (recommended)

### 6.1 Prerequisites
- Docker
- Docker Compose

### 6.2 Environment
Create `.env` from template:

```bash
cp .env.example .env
```

Set at least these values:
- `DB_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_PASSWORD`
- AI variables if needed (`AI_CHAT_API_URL`, `AI_CHAT_MODEL`, ...)

### 6.3 Start

```bash
docker compose up -d --build
```

Default local API:
- `http://127.0.0.1:8000`

## 7) Run without Docker

```bash
npm install
node server.js
```

Default app port from `.env` (`PORT`, often `8080`).

## 8) Database Migrations

Available scripts:
- `scripts/migrate_ai_chat.sql` (AI Chat V1)
- `scripts/migrate_ai_chat_v2.sql` (AI Chat V2)

Example:

```bash
mysql -h <host> -u <user> -p <database> < scripts/migrate_ai_chat_v2.sql
```

## 9) Security Notes (important)

- Do **not** commit `.env`
- Use `.env.example` as template only
- Rotate any leaked/previously hardcoded credentials
- Keep production secrets in deployment environment / secret manager

---

## 🇻🇳 Tiếng Việt

## 1) Tổng quan

ChefMate Server cung cấp:
- API người dùng (đăng ký/đăng nhập/hồ sơ)
- API công thức (tạo/tìm kiếm/trending)
- API tương tác (like/comment/view)
- Quản lý tủ lạnh theo user
- Trợ lý AI Chat:
  - **V1**: mỗi session tập trung 1 món (`activeRecipeId`)
  - **V2**: 1 bữa nhiều món, có cơ chế chọn/chuyển món focus

## 2) Công nghệ

- Node.js + Express
- MySQL
- Docker / Docker Compose
- OpenAPI (Swagger)

## 3) Tính năng chính

### Người dùng
- Đăng ký / Đăng nhập (SĐT hoặc email)
- Cập nhật hồ sơ
- Đổi / reset mật khẩu
- Lấy danh sách người dùng

### Công thức
- Lấy toàn bộ công thức
- Tìm theo tên / tag
- Tạo công thức
- Top trending
- Danh sách nguyên liệu / tag

### Tương tác
- Like công thức
- Bình luận công thức
- Xóa bình luận
- Tăng lượt xem công thức

### Tủ lạnh + AI Chat
- Tủ lạnh theo từng user (`PantryItems`)
- Gợi ý món theo tủ lạnh
- Lưu lịch sử chat (`ChatSessions`, `ChatMessages`)
- Hỗ trợ AI Chat V1 và V2

## 4) AI Chat V2 (đa món)

Luồng chính:
1. Tạo meal session với nhiều món
2. Set/clear món focus
3. Cập nhật trạng thái từng món (`pending | cooking | done | skipped`)
4. Khi đóng món đang focus, backend trả
   `PENDING_PRIMARY_RECIPE_SWITCH_CONFIRMATION`
5. Client xác nhận món focus tiếp theo

Tài liệu tích hợp client:
- `docs/CLIENT_CHAT_V2_INTEGRATION_GUIDE.md`
- Link nhanh: `docs/AI_CHAT_V2_LINKS.md`

## 5) Tài liệu API

Sau khi chạy server:
- Swagger UI: `/api-docs`
- OpenAPI JSON: `/api-docs/openapi.json`
- File spec trong repo: `docs/openapi.json`

## 6) Chạy bằng Docker (khuyến nghị)

### 6.1 Yêu cầu
- Docker
- Docker Compose

### 6.2 Cấu hình môi trường
Tạo `.env` từ template:

```bash
cp .env.example .env
```

Cần điền tối thiểu:
- `DB_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_PASSWORD`
- Biến AI nếu cần (`AI_CHAT_API_URL`, `AI_CHAT_MODEL`, ...)

### 6.3 Khởi động

```bash
docker compose up -d --build
```

API local mặc định:
- `http://127.0.0.1:8000`

## 7) Chạy không dùng Docker

```bash
npm install
node server.js
```

Port app lấy từ `.env` (`PORT`, thường là `8080`).

## 8) Migration DB

Các script hiện có:
- `scripts/migrate_ai_chat.sql` (AI Chat V1)
- `scripts/migrate_ai_chat_v2.sql` (AI Chat V2)

Ví dụ:

```bash
mysql -h <host> -u <user> -p <database> < scripts/migrate_ai_chat_v2.sql
```

## 9) Lưu ý bảo mật

- **Không** commit `.env`
- Dùng `.env.example` làm mẫu
- Rotate các credential từng bị lộ/hardcode
- Secret production nên lưu ở môi trường deploy/secret manager
