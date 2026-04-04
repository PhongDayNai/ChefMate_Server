# CHANGELOG — Chat V2 Policy Engine + Gender Support

**Ngày cập nhật:** 2026-04-04  
**Phạm vi:** `chefmate-server` (JWT API / v2)

---

## 1) Trả lời nhanh câu hỏi “chỉ 2 API đổi với gender?”

Không chỉ đúng 2 API anh hai nhé.

### API có liên quan trực tiếp tới `gender`
1. `POST /v2/users/register`
   - Nhận thêm trường `gender`
   - Trả về `data.gender`
2. `PATCH /v2/users/me` và `POST /v2/users/update-user-information`
   - Có thể cập nhật `gender`
3. `POST /v2/users/login`
   - Trả về `data.user.gender` (do trả full safe user)
4. `POST /v2/users/refresh-token`
   - Trả về `data.user.gender`
5. `GET /v2/users/all`
   - Trả thêm cột `gender`

> Hiện chưa có `GET /v2/users/me` riêng.

---

## 2) Thay đổi DB/Schema cho Gender

## MySQL
- Bổ sung cột vào bảng `Users`:
  - `gender ENUM('male','female','other','unknown') NOT NULL DEFAULT 'unknown'`

## SQL Server schema file
- Bổ sung cột `gender NVARCHAR(10) NOT NULL DEFAULT 'unknown'` trong `be_db_sql.sql`

## Migration script đã thêm
- `scripts/add-user-gender.sql`
  - Add cột `gender`
  - Map giới tính ban đầu cho tập user seed/test đã tạo trước đó

---

## 3) Thay đổi Chat V2 sau plan Conversation Policy Engine

## API chính
1. `POST /v2/ai-chat/messages`
   - Có thể trả branch mới khi trigger policy:
     - `code: PENDING_MEAL_V2_COMPLETION_CHECK`
     - `data.completionCheck` (message + actions)
2. `POST /v2/ai-chat/sessions/meal/resolve-completion-check` (**mới**)
   - Xử lý action từ inline button

## Action hỗ trợ (resolve endpoint)
- `mark_done`
- `mark_skipped`
- `continue_current`
- `complete_session` (mới bổ sung theo nhánh “đã xong hết món”)
- `keep_session_open` (mới bổ sung theo nhánh “đã xong hết món”)

## Hành vi mới quan trọng
- Sau `mark_done/mark_skipped`:
  - Nếu còn món chưa xong -> server trả **assistant message tự nhiên** để dẫn tiếp món sau
  - Nếu không còn món -> trả:
    - `code: MEAL_SESSION_READY_TO_COMPLETE`
    - `assistantMessage` hỏi kết thúc phiên
    - `nextActions: [complete_session, keep_session_open]`
- Nếu có `pendingUserMessage`, server xử lý action xong có thể gọi tiếp chat và trả lời luôn.

---

## 4) Prompt/Conversation theo giới tính

Đã bổ sung hint theo giới tính user vào system prompt (V1 + V2):
- male -> ưu tiên xưng hô lịch sự kiểu “anh”
- female -> ưu tiên “chị”
- unknown/other -> trung tính “bạn”

Mục tiêu: câu chữ tự nhiên và phù hợp hơn khi hội thoại.

---

## 5) Config policy hiện tại (đang để test nhanh)

Trong `.env` server đang đặt:
- `MEAL_V2_COMPLETION_REMINDER_MINUTES=2`
- `MEAL_V2_COMPLETION_REMINDER_STRONG_MINUTES=5`
- `MEAL_V2_COMPLETION_REMINDER_COOLDOWN_MINUTES=1`
- `MEAL_V2_COMPLETION_REMINDER_MAX_PER_DAY=10`

> Đây là mốc để test. Lên production nên tăng lại (ví dụ 30/180/30/3 hoặc theo dữ liệu thực tế).

---

## 6) Tác động tương thích client

- Client cũ vẫn chạy bình thường ở luồng thường.
- Khi gặp branch `PENDING_MEAL_V2_COMPLETION_CHECK`, client cần handle inline actions.
- Nếu không handle branch này, có thể thấy “không có assistant message mới” ở đúng nhánh trigger.

---

## 7) File code đã thay đổi chính

- `models/aiChatV2Model.js`
- `controllers/aiChatV2Controller.js`
- `controllers/aiChatV2ControllerJwt.js`
- `routes/aiChatV2Routes.js`
- `models/aiChatModel.js`
- `models/userModel.js`
- `controllers/userController.js`
- `be_db_mysql.sql`
- `be_db_sql.sql`
- `scripts/add-user-gender.sql`

---

## 8) Khuyến nghị release

1. Chốt frontend handle inline actions trước khi bật ngưỡng production cứng.
2. Chạy migration `gender` trên DB production.
3. Verify register/login/update-user với `gender`.
4. Smoke test 3 luồng:
   - sendMessageV2 bình thường
   - trigger completion check + resolve
   - nhánh hết món -> complete_session/keep_session_open
