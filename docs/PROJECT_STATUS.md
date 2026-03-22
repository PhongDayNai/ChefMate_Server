# PROJECT STATUS — ChefMate Server

_Cập nhật: 2026-03-22_

## 1) Mục tiêu hiện tại
ChefMate backend đã mở rộng từ API công thức cơ bản sang hệ thống hỗ trợ nấu ăn có AI, gồm:
- Chat AI theo phiên
- Tủ lạnh (Pantry)
- Gợi ý món theo nguyên liệu hiện có
- Ghi chú ăn uống cá nhân (dị ứng/hạn chế)
- Feed thịnh hành có phân trang (v2)

---

## 2) Tình trạng tính năng

### ✅ Hoàn thành
1. **AI Chat theo phiên**
   - Tạo phiên, lấy danh sách phiên, lấy chi tiết phiên
   - Đổi title phiên, đổi món đang nấu, xóa phiên
   - Lưu lịch sử message theo phiên
   - Khi tạo phiên mới: có intro message cố định từ **Bepes**
   - Tự đặt tên phiên bằng AI khi thiếu title

2. **Pantry (Tủ lạnh)**
   - Thêm/sửa/xóa nguyên liệu theo user
   - Lưu số lượng, đơn vị, hạn dùng

3. **Gợi ý món từ pantry**
   - Ưu tiên `ready_to_cook`
   - Bổ sung `almost_ready` nếu chưa đủ limit
   - Có index tuần tự

4. **User Diet Notes**
   - Lưu ghi chú `allergy / restriction / preference / health_note`
   - Có hiệu lực theo `isActive`, `startAt`, `endAt`
   - Recommend + AI chat đã dùng context này

5. **Trending Feed v2 (infinite scroll)**
   - `GET /api/recipes/trending-v2`
   - Có `page/limit/period` và `pagination`
   - Payload item tương thích dữ liệu recipe v1

6. **Tương thích ngược**
   - `POST /api/recipes/top-trending` (legacy) giữ nguyên contract

7. **Ảnh công thức**
   - Cache ảnh về local cho phần lớn recipe
   - Recipe thiếu ảnh đã có placeholder local

8. **Swagger/OpenAPI**
   - Có OpenAPI full + Swagger UI

---

## 3) Điểm cần tiếp tục cải thiện
1. **Chất lượng dữ liệu instructions**
   - Đã reparse bước nấu nhưng vẫn nên tiếp tục cleanup thủ công cho các recipe nhiễu.

2. **Độ ổn định AI lúc tải cao**
   - Có thể xuất hiện `AI_SERVER_BUSY` trong một số thời điểm.

3. **Chất lượng gợi ý theo ngữ cảnh sâu**
   - Cần tinh chỉnh thêm prompt/guardrails để bám context chặt hơn ở hội thoại dài.

---

## 4) API mới chính đã có
- `GET /api/user-diet-notes`
- `POST /api/user-diet-notes/upsert`
- `DELETE /api/user-diet-notes/delete`
- `GET /api/pantry`
- `POST /api/pantry/upsert`
- `DELETE /api/pantry/delete`
- `POST /api/ai-chat/recommendations-from-pantry`
- `POST /api/ai-chat/sessions`
- `GET /api/ai-chat/sessions?userId=&page=&limit=`
- `GET /api/ai-chat/sessions/:sessionId?userId=`
- `PATCH /api/ai-chat/sessions/title`
- `PATCH /api/ai-chat/sessions/active-recipe`
- `DELETE /api/ai-chat/sessions/:id?userId=`
- `POST /api/ai-chat/messages`
- `GET /api/recipes/trending-v2`

---

## 5) Tài liệu liên quan
- OpenAPI: `docs/openapi.json`
- Swagger UI route: `/api-docs`
