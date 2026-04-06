# API JWT 13081 — Danh sách đầy đủ (không gồm legacy)

> Cập nhật: 2026-04-06  
> Server: `http://<host>:13081`  
> Base path: `/v2/...`

Tài liệu này chỉ liệt kê API của bản JWT trên cổng `13081`.  
Không bao gồm route legacy `/api/...`.

---

## 1) Quy ước auth

## 1.1 Public
Không cần header auth.

## 1.2 Bearer (private)
```http
Authorization: Bearer <accessToken>
```

## 1.3 Dual-auth cho chat (bắt buộc cả 2)
Áp dụng cho toàn bộ endpoint:
- `/v2/ai-chat/*`
- `/v2/ai-chat-v1/*`

```http
Authorization: Bearer <accessToken>
x-api-key: <CHAT_API_KEY>
```

Thiếu 1 trong 2 -> `401`.

---

## 2) Users
Base: `/v2/users`

| Method | Endpoint | Auth | Ghi chú |
|---|---|---|---|
| GET | `/all` | Public | Lấy toàn bộ user |
| POST | `/register` | Public | Đăng ký |
| POST | `/login` | Public | Đăng nhập |
| POST | `/refresh-token` | Public | Refresh access token |
| POST | `/forgot-password` | Public | Quên mật khẩu |
| POST | `/change-password` | Public | Đổi mật khẩu |
| GET | `/recipes-view-history` | Bearer | Lịch sử xem recipe của user hiện tại |
| POST | `/update-user-information` | Bearer | Cập nhật profile (legacy-compatible) |
| PATCH | `/me` | Bearer | Cập nhật profile (khuyến nghị) |

---

## 3) Recipes
Base: `/v2/recipes`

| Method | Endpoint | Auth | Ghi chú |
|---|---|---|---|
| GET | `/all` | Public | Lấy tất cả recipe |
| POST | `/create` | Bearer | Tạo recipe (multipart, upload ảnh) |
| POST | `/search` | Optional Bearer | Tìm theo tên |
| GET | `/search` | Optional Bearer | Tìm theo `q` hoặc `recipeName` |
| GET | `/ingredients` | Public | Danh sách nguyên liệu |
| POST | `/top-trending` | Bearer | Trending legacy-compatible |
| GET | `/top-trending` | Bearer | Trending legacy-compatible |
| GET | `/trending` | Optional Bearer | Trending mới (mapping từ trending-v2 cũ) |
| GET | `/trending-v1` | Optional Bearer | Behavior cũ của trending |
| GET | `/trending-v2` | Optional Bearer | Alias tương thích tạm (same `/trending`) |
| GET | `/tags` | Public | Danh sách tag |
| POST | `/search-by-tag` | Optional Bearer | Tìm theo tag |
| GET | `/by-tag` | Optional Bearer | Tìm theo `tagName` (query) |
| POST | `/user-recipes` | Bearer | Recipe của user hiện tại (legacy-compatible) |
| GET | `/me` | Bearer | Recipe của user hiện tại |
| GET | `/admin/pending` | Bearer | Danh sách recipe chờ duyệt |
| PATCH | `/admin/review` | Bearer | Duyệt recipe |
| GET | `/growth-report` | Public | Báo cáo tăng trưởng recipe |

**Optional Bearer**:
- Không gửi token: trả dữ liệu public.
- Gửi token: có thể trả thêm dữ liệu cá nhân hoá (vd `isLiked`).

---

## 4) Interactions
Base: `/v2/interactions`

| Method | Endpoint | Auth | Ghi chú |
|---|---|---|---|
| POST | `/like` | Bearer | Like/Unlike recipe |
| POST | `/comment` | Bearer | Thêm comment |
| POST | `/increase-view-count` | Public | Tăng lượt xem |
| GET | `/comments` | Public | Lấy danh sách comments |
| DELETE | `/comment` | Bearer | Xoá comment |

---

## 5) Pantry
Base: `/v2/pantry`

| Method | Endpoint | Auth | Ghi chú |
|---|---|---|---|
| GET | `/` | Bearer | Lấy pantry của user hiện tại |
| POST | `/upsert` | Bearer | Thêm/cập nhật pantry item |
| DELETE | `/delete` | Bearer | Xoá pantry item |

---

## 6) User Diet Notes
Base: `/v2/user-diet-notes`

| Method | Endpoint | Auth | Ghi chú |
|---|---|---|---|
| GET | `/` | Bearer | Lấy diet notes của user hiện tại |
| POST | `/upsert` | Bearer | Thêm/cập nhật diet note |
| DELETE | `/delete` | Bearer | Xoá diet note |

---

## 7) AI Chat v1 (legacy flow trên JWT)
Base: `/v2/ai-chat-v1`  
Auth: **Dual-auth (Bearer + x-api-key)**

| Method | Endpoint | Ghi chú |
|---|---|---|
| POST | `/sessions` | Tạo session chat |
| GET | `/sessions` | Danh sách session |
| GET | `/sessions/:sessionId` | Lịch sử session |
| DELETE | `/sessions/:id` | Xoá session |
| PATCH | `/sessions/title` | Đổi tiêu đề session |
| PATCH | `/sessions/active-recipe` | Set/clear active recipe |
| POST | `/recommendations-from-pantry` | Gợi ý món từ pantry |
| GET | `/recommendations-from-pantry` | Gợi ý món từ pantry |
| POST | `/sessions/resolve-previous` | Xử lý session trước đó |
| POST | `/messages` | Gửi message chat |
| GET | `/messages` | Unified timeline |

---

## 8) AI Chat v2 (meal flow)
Base: `/v2/ai-chat`  
Auth: **Dual-auth (Bearer + x-api-key)**

| Method | Endpoint | Ghi chú |
|---|---|---|
| POST | `/sessions/meal` | Tạo meal session |
| PATCH | `/sessions/meal/recipes` | Thay danh sách món trong session |
| PATCH | `/sessions/meal/recipes/status` | Cập nhật trạng thái 1 món |
| PATCH | `/sessions/meal/primary-recipe` | Set món focus |
| PATCH | `/sessions/meal/complete` | Đóng/hoàn tất meal session |
| POST | `/sessions/meal/resolve-completion-check` | Xử lý completion check (confirm flow) |
| POST | `/messages` | Gửi message chat v2 |

---

## 9) HTTP status thường gặp

- `200/201`: Thành công
- `400`: Sai dữ liệu đầu vào
- `401`: Thiếu/sai auth token hoặc thiếu 1 trong 2 header chat
- `404`: Không tìm thấy resource
- `503`: AI server bận (`AI_SERVER_BUSY`)

---

## 10) Ghi chú triển khai nhanh

- Base URL ví dụ local: `http://localhost:13081`
- Swagger JSON hiện tại vẫn mô tả legacy (`/api/...`) ở `docs/openapi.json`.
- File này là nguồn tham chiếu nhanh **chỉ cho JWT `/v2/...`**.
