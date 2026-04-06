# ChefMate Server 🍳

Backend API for **ChefMate** — a recipe, pantry, and AI-assisted cooking platform.

This repository contains the server-side application built with **Node.js + Express + MySQL**, including both:
- **Legacy API** (`/api/...`)
- **JWT API** (`/v2/...`, recommended for new clients)

## 🌐 Ecosystem

- Android Client: [ChefMate_Client](https://github.com/PhongDayNai/ChefMate_Client)
- Web Client: [Chefmate_Web_Client](https://github.com/PhongDayNai/Chefmate_Web_Client)
- Admin Web: [ChefMate_Admin_Web](https://github.com/PhongDayNai/ChefMate_Admin_Web)

---

## ✨ Key Features

- User account management (register/login/profile/password)
- Recipe management (create, search, tags, trending, user recipes)
- Social interactions (like/comment/view)
- Pantry management per user
- Diet notes (allergy/restriction/preference/health note)
- AI Chat v1 (session-based cooking assistant)
- AI Chat v2 meal flow (multi-recipe orchestration)
- JWT auth model with refresh token support
- Dual-auth protection for chat endpoints (Bearer + API key)

---

## 🧱 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL 8
- **Auth**: JWT (Access Token + Refresh Token)
- **Containerization**: Docker + Docker Compose
- **AI integration**: configurable primary and fallback providers

---

## 📂 Project Structure

```text
chefmate-server/
├─ controllers/
├─ models/
├─ routes/            # JWT routes (/v2/...)
├─ routes-legacy/     # Legacy routes (/api/...)
├─ middleware/
├─ config/
├─ docs/
├─ scripts/
├─ assets/
├─ server.js          # Legacy server (default internal port 8080)
├─ server.jwt.js      # JWT server (default port 13081)
├─ docker-compose.yml
└─ .env.example
```

---

## 🚀 Quick Start (Docker Recommended)

### 1) Clone and configure

```bash
git clone <your-repo-url>
cd chefmate-server
cp .env.example .env
```

Update `.env` values before running (database credentials, JWT secrets, chat key, AI keys).

### 2) Start services

```bash
docker compose up --build -d
```

### 3) Service URLs

- Legacy API: `http://localhost:8000`
- JWT API: `http://localhost:13081`
- Swagger UI:
  - `http://localhost:8000/api-docs`
  - `http://localhost:13081/api-docs`

---

## 🧪 Local Development (without Docker)

> Requires a running MySQL instance and a valid `.env`.

```bash
npm install
npm run start       # start legacy server
# or
npm run start:jwt   # start JWT server
```

---

## 🔐 Authentication

### Standard private endpoints
Use Bearer token:

```http
Authorization: Bearer <accessToken>
```

### Chat endpoints (dual-auth required)
Applies to all:
- `/v2/ai-chat/*`
- `/v2/ai-chat-v1/*`

Must include both:

```http
Authorization: Bearer <accessToken>
x-api-key: <CHAT_API_KEY>
```

Missing either header returns `401 Unauthorized`.

---

## 🛣️ API Surfaces

### Legacy API
- Prefix: `/api/...`
- Server: `server.js`
- Compatibility-first for older clients

### JWT API (recommended)
- Prefix: `/v2/...`
- Server: `server.jwt.js`
- Used by current/new clients

### JWT full integration docs
- [`docs/API_JWT_13081_COMPLETE.md`](./docs/API_JWT_13081_COMPLETE.md)

---

## 📘 Main API Domains (JWT)

- Users: `/v2/users`
- Recipes: `/v2/recipes`
- Interactions: `/v2/interactions`
- Pantry: `/v2/pantry`
- Diet Notes: `/v2/user-diet-notes`
- AI Chat v1: `/v2/ai-chat-v1`
- AI Chat v2 meal flow: `/v2/ai-chat`

---

## ⚙️ Environment Variables

See `.env.example` for the full template.

Commonly used variables:

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

Migration/testing/import helpers are available in [`scripts/`](./scripts).

---

## 🛡️ Security Notes

- Never commit `.env` or real secrets.
- Rotate credentials immediately if exposure is suspected.
- Use strong JWT secrets in production.
- Restrict AI/chat credentials by environment.
- Deploy behind HTTPS/reverse proxy in production.

---

## 🤝 Contributing

Contributions are welcome.

Suggested workflow:

1. Fork the repository
2. Create a feature branch
3. Commit using **Conventional Commits**
4. Open a PR with clear summary and test notes

---

## 📄 License

No license file is currently defined.

If you plan public distribution, add a `LICENSE` file (e.g. MIT).

---

## 🇻🇳 Vietnamese README

Bản tiếng Việt: [README-vi.md](./README-vi.md)
