# Đặc tả Kỹ thuật & Giải mã Chức năng: Chesslang.com vs ERPChess

## Tài liệu 07: Phân hệ Báo cáo Tiến độ (Reports), Trò chuyện Nội bộ (Chat) & Cấu hình Thương hiệu (Preferences)

> **Mã định danh:** REA-SPEC-07  
> **Route đối chứng:** `https://platform.chesslang.com/reports/coach`, `/chat`, `/preferences`  
> **Ảnh chụp bằng chứng:** `rea/evidence/screenshots/route_reports.png`, `route_chat.png`, `route_preferences.png`  
> **Hạ tầng hỗ trợ:** Supabase Storage (Logo/Favicon) + Realtime Chat Channels + Report CSV/PDF Export

---

### 1. Mục tiêu Nghiệp vụ & Giá trị Vận hành

1. **Báo cáo Tiến bộ Toàn diện (Comprehensive Learning Reports):**
   - Giúp Huấn luyện viên và Ban lãnh đạo học viện có cái nhìn định lượng chính xác về sự tiến bộ của từng học viên.
   - Giúp Phụ huynh an tâm khi nhìn thấy biểu đồ tiến bộ rõ ràng: số lượng bài tập con đã làm, số giờ con học với thầy, tỷ lệ thắng/hòa/thua trong các ván cờ nội bộ.
   - Hỗ trợ xuất dữ liệu ra file chuẩn (CSV, PDF) để in ấn hoặc gửi báo cáo định kỳ hàng tháng cho phụ huynh.
2. **Kênh Giao tiếp Nội bộ Chuyên biệt (Academy Chat System):**
   - Không bị phân tán như Zalo hay Facebook.
   - Phân kênh rành mạch:
     - **Kênh Thông báo Chung (Announcements):** Chỉ HLV/Admin được gửi tin, học viên và phụ huynh đọc thông báo.
     - **Kênh Nhóm Lớp (Batch Channels):** Dành cho học viên và HLV cùng lớp trao đổi bài tập, lịch học.
     - **Tin nhắn Trực tiếp (Direct Messages):** HLV trao đổi riêng với từng phụ huynh về tình hình của con.
3. **Cấu hình Thương hiệu Riêng (White-label & Preferences):**
   - Học viện có thể đặt tên riêng, logo riêng, favicon riêng, màu sắc chủ đạo riêng.
   - Tùy biến giao diện bàn cờ: Chọn kiểu quân cờ (cổ điển, hiện đại, gỗ, kim loại), màu ô cờ (xanh lá cẩm thạch, gỗ sồi nâu, xanh dương), âm thanh gõ cờ, múi giờ và ngôn ngữ hiển thị.

---

### 2. Chi tiết Phân hệ Báo cáo (Reports Module)

#### 2.1. Cấu trúc Báo cáo Cá nhân Học viên (Student Progress Report)

```
+-----------------------------------------------------------------------------------------+
| [Báo cáo Học viên]: Nguyễn Văn An (Mã: CS-001) | Lớp: U10 Nâng cao | HLV: Thầy Tuấn     |
+-----------------------------------------------------------------------------------------+
| [Chỉ số Tổng quan]                                                                      |
| - Tổng bài tập đã giao: 120 bài         | - Tỷ lệ hoàn thành: 92% (110 bài)             |
| - Điểm giải đúng lần đầu: 85%           | - Thời gian trung bình/câu: 45 giây           |
| - Ván cờ đã đấu: 34 ván (Thắng 20, Hòa 5, Thua 9) - Tỷ lệ thắng: 66.2%                  |
| - Chuyên cần: 12/12 buổi học tham gia đầy đủ (100%)                                     |
+-----------------------------------------------------------------------------------------+
| [Biểu đồ Phân tích Kỹ năng]:                                                            |
|   Tactics (Chiến thuật):   [==================== 88% ]                                  |
|   Endgame (Tàn cuộc):      [==============       62% ]                                  |
|   Opening (Khai cuộc):     [=================    75% ]                                  |
|   Calculation (Tính toán): [==================   82% ]                                  |
+-----------------------------------------------------------------------------------------+
| [Nhận xét của Huấn luyện viên]:                                                         |
| "An có khả năng tính toán đòn chiến thuật rất sắc bén. Cần rèn luyện thêm kỹ thuật      |
| Vua - Xe trong tàn cuộc để không bị rơi vào thế hòa đáng tiếc."                         |
|                                                     [ Nút Xuất Báo Cáo PDF / CSV ]     |
+-----------------------------------------------------------------------------------------+
```

#### 2.2. Xuất Báo cáo CSV Chuẩn quốc tế & Tiếng Việt

- Tích hợp hàm `academyStudentsReportToCsv` hỗ trợ định dạng UTF-8 có BOM để mở trên Microsoft Excel mà không bị lỗi font tiếng Việt.
- Xuất đầy đủ các cột: Mã học viên, Tên học viên, Lớp, Số bài hoàn thành, Số bài sai, Điểm trung bình, Số buổi học, Điểm danh, Nhận xét.

---

### 3. Chi tiết Hệ thống Trò chuyện Nội bộ (Academy Chat)

#### 3.1. Phân loại Kênh Trò chuyện

- `#thong-bao-chung`: Kênh toàn học viện, gửi lịch nghỉ lễ, lịch thi đấu, thông báo học phí.
- `#lop-[ten-batch]`: Tự động tạo khi một Lớp/Batch được thành lập; học viên trong lớp tự động được thêm vào kênh.
- `Chat 1-1`: HLV và Học viên hoặc Phụ huynh.

#### 3.2. Tính năng Cờ vua Đặc thù trong Chat (Chess-specific Chat Features)

- **Chia sẻ Thế cờ (Share FEN / Puzzle in Chat):** Gửi một chuỗi FEN hoặc mã thế cờ, tin nhắn tự động hiển thị một bàn cờ nhỏ (Mini-board Preview). Người đọc có thể click vào bàn cờ để mở ra giải thử ngay lập tức!
- **Chia sẻ Ván cờ (Share PGN Game):** Hiển thị thẻ ván đấu kèm tên 2 kỳ thủ và kết quả.

---

### 4. Cấu hình Cá nhân & Thương hiệu Học viện (Preferences & Branding)

#### 4.1. Tùy biến Bàn cờ Cá nhân (User Board Preferences)

- **Kiểu quân cờ (Piece Sets):** Standard (Cstandard), Alpha, Merida, Chessnut, Wood, Neo.
- **Màu sắc Bàn cờ (Board Themes):** Green (Cẩm thạch xanh), Wood (Gỗ cổ điển), Blue (Xanh biển hiện đại), Charcoal (Xám kim loại).
- **Âm thanh (Sound Effects):** Tiếng gõ quân cờ gỗ tự nhiên, tiếng gõ đồng hồ, tiếng chiếu cờ đặc biệt.
- **Hiển thị Tọa độ:** Bật/tắt hàng chữ số 1-8 và a-h quanh viền bàn cờ.
- **Ký hiệu nước đi (Notation):** Ký hiệu Quốc tế (`Nf3`, `Qxd4`, `O-O`) hoặc Ký hiệu Tiếng Việt (`Mã f3`, `Hậu xd4`, `Nhập thành`).

#### 4.2. Cấu hình Thương hiệu CLB (Academy White-labeling)

- Upload Logo trường/CLB (PNG, SVG).
- Upload Favicon hiển thị trên tab trình duyệt.
- Tùy chỉnh màu sắc thương hiệu (Primary Brand Color).
- Cấu hình thông tin liên hệ: Địa chỉ CLB, Số điện thoại hỗ trợ, Hotline Zalo.

---

### 5. Hạng mục Cần Hoàn thiện trong ERPChess

1. **Bộ Tùy biến Bàn cờ Thời gian Thực (Live Board Customizer):** Cho phép người dùng chuyển đổi theme bàn cờ và kiểu quân cờ ngay trong modal Cài đặt với bàn cờ preview trực tiếp.
2. **Kênh Chat Học viện Thời gian thực (Realtime Academy Chat):** Tích hợp khung chat trực tiếp trong ứng dụng Web và Mobile Expo.
3. **Mẫu Báo cáo Học viên In ấn (Printable Student Report Card):** Giao diện định dạng chuẩn A4 có logo học viện và chữ ký HLV để in ra giấy hoặc lưu file PDF.
