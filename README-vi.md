# ChefMate Server 🍳

Backend API cho **ChefMate** — nền tảng công thức nấu ăn, quản lý pantry và trợ lý AI khi nấu.

Repository này chứa server được xây dựng bằng **Node.js + Express + MySQL**, hỗ trợ đồng thời:
- **Legacy API** (`/api/...`)
- **JWT API** (`/v2/...`, khuyến nghị cho client mới)

## 🌐 Ecosystem

- Android Client: [ChefMate_Client](https://github.com/PhongDayNai/ChefMate_Client)
- Web Client: [Chefmate_Web_Client](https://github.com/PhongDayNai/Chefmate_Web_Client)
- Admin Web: [ChefMate_Admin_Web](https://github.com/PhongDayNai/ChefMate_Admin_Web)

---

## ✨ Tính năng chính

- Quản lý tài khoản (đăng ký/đăng nhập/cập nhật profile/mật khẩu)
- Quản lý công thức (tạo, tìm kiếm, tag, trending, công thức theo user)
- Tương tác xã hội (like/comment/view)
- Quản lý pantry theo từng user
- Ghi chú ăn uống (dị ứng/hạn chế/sở thích/ghi chú sức khỏe)
- AI Chat v1 theo session
- AI Chat v2 theo meal flow nhiều món
- JWT auth + refresh token
- Bảo vệ chat endpoint bằng dual-auth (Bearer + API key)

---

## 🧱 Công nghệ sử dụng

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL 8
- **Auth**: JWT (Access Token + Refresh Token)
- **Container**: Docker + Docker Compose
- **AI integration**: provider chính + fallback cấu hình qua env

---

## 📂 Cấu trúc thư mục

```text
chefmate-server/
├─ controllers/
├─ models/
├─ routes/            # Route JWT (/v2/...)
├─ routes-legacy/     # Route legacy (/api/...)
├─ middleware/
├─ config/
├─ docs/
├─ scripts/
├─ assets/
├─ server.js          # Legacy server (port nội bộ mặc định 8080)
├─ server.jwt.js      # JWT server (mặc định 13081)
├─ docker-compose.yml
└─ .env.example
```

---

## 🚀 Chạy nhanh (khuyến nghị Docker)

### 1) Clone và cấu hình

```bash
git clone <your-repo-url>
cd chefmate-server
cp .env.example .env
```

Cập nhật giá trị trong `.env` trước khi chạy (DB, JWT secrets, chat key, AI keys).

### 2) Khởi động dịch vụ

```bash
docker compose up --build -d
```

### 3) URL dịch vụ

- Legacy API: `http://localhost:8000`
- JWT API: `http://localhost:13081`
- Swagger UI:
  - `http://localhost:8000/api-docs`
  - `http://localhost:13081/api-docs`

---

## 🧪 Chạy local (không dùng Docker)

> Cần có MySQL đang chạy và file `.env` hợp lệ.

```bash
npm install
npm run start       # chạy legacy server
# hoặc
npm run start:jwt   # chạy JWT server
```

---

## 🔐 Xác thực (Authentication)

### API private thông thường
Dùng Bearer token:

```http
Authorization: Bearer <accessToken>
```

### Chat API bắt buộc dual-auth
Áp dụng cho tất cả endpoint:
- `/v2/ai-chat/*`
- `/v2/ai-chat-v1/*`

Phải gửi đồng thời:

```http
Authorization: Bearer <accessToken>
x-api-key: <CHAT_API_KEY>
```

Thiếu 1 trong 2 header sẽ trả `401 Unauthorized`.

---

## 🛣️ Bề mặt API

### Legacy API
- Prefix: `/api/...`
- Server: `server.js`
- Giữ tương thích cho client cũ

### JWT API (khuyến nghị)
- Prefix: `/v2/...`
- Server: `server.jwt.js`
- Dành cho client hiện tại/mới

### Tài liệu tích hợp JWT đầy đủ
- [`docs/API_JWT_13081_COMPLETE.md`](./docs/API_JWT_13081_COMPLETE.md)

---

## 📘 Nhóm API chính (JWT)

- Users: `/v2/users`
- Recipes: `/v2/recipes`
- Interactions: `/v2/interactions`
- Pantry: `/v2/pantry`
- User Diet Notes: `/v2/user-diet-notes`
- AI Chat v1: `/v2/ai-chat-v1`
- AI Chat v2 meal flow: `/v2/ai-chat`

---

## ⚙️ Biến môi trường

Xem đầy đủ trong `.env.example`.

Các biến thường dùng:

- `PORT`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
- `CHAT_API_KEY`
- `AI_CHAT_API_URL`, `AI_CHAT_MODEL`, `AI_CHAT_TIMEOUT_MS`
- `AI_CHAT_FALLBACK_API_URL`, `AI_CHAT_FALLBACK_API_KEY`, `AI_CHAT_FALLBACK_MODEL`

---

## 🧰 Scripts

```bash
npm run start
npm run start:jwt
```

Các script migrate/test/import khác nằm trong [`scripts/`](./scripts).

---

## 🛡️ Lưu ý bảo mật

- Không commit `.env` hoặc secret thật lên Git.
- Nếu nghi ngờ lộ thông tin, xoay vòng credential ngay.
- Dùng JWT secret mạnh ở production.
- Tách khóa AI/chat theo từng môi trường.
- Khi deploy production nên đặt sau HTTPS/reverse proxy.

---

## 🤝 Đóng góp

Mọi đóng góp đều được hoan nghênh.

Quy trình đề xuất:

1. Fork repository
2. Tạo feature branch
3. Commit theo **Conventional Commits**
4. Mở PR kèm mô tả rõ ràng + ghi chú kiểm thử

---

## 📄 License

Repository hiện chưa khai báo license file.

Nếu public rộng rãi, nên thêm `LICENSE` (ví dụ MIT).

---

## 🌍 English README

English version: [README.md](./README.md)
