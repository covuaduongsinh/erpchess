# Classroom (lớp trực tiếp) và Calendar

## Danh sách lớp

- **Lọc:** theo người tạo (mọi người hoặc chỉ tôi) và theo khoảng ngày. Nút M/Q/Y chuyển nhanh khoảng.
- **Xuất CSV.**
- **Khi trống:** gợi ý tạo lớp; học viên vào lớp qua link được chia sẻ.

## Tạo lớp

- **Hình thức:**
  - Online: có phòng học, video, bàn cờ chung.
  - Offline: chỉ ghi nhận buổi học và điểm danh.
- **Người tham gia:** học viên, Batch, Group.
- **Chế độ video:**
  - Ưu tiên hiệu năng (mặc định).
  - Chế độ chuẩn, dùng khi mạng kém.
  - Không video.
- **Tuỳ chọn nâng cao:**
  - Lớp công khai: ai có link cũng vào được.
  - Lớp mở.
  - Báo qua WhatsApp tới số người giám hộ.
  - Báo qua email.
- **Lịch:** lặp lại theo lịch.
- **Tên lớp:** mặc định "Class".

## Calendar (quản trị)

- **Tạo:** nút "Lớp mới". Chọn múi giờ.
- **Chế độ xem:**
  - Lịch trống của HLV.
  - Các slot đã kín.
  - Tìm HLV còn trống.
  - Lịch tuần lặp lại, xem theo slot hoặc dạng lịch.
- **Bộ lọc:**
  - Theo HLV.
  - Theo loại sự kiện: lớp, lớp học thử, họp, nghỉ, khác.
  - Theo Batch, theo học viên.

## Ánh xạ sang erpchess (Giai đoạn lớp học)

- **Bảng:**
  - `classrooms`: kind online/offline, video_mode, is_public, schedule.
  - `classroom_targets`: học viên, Batch, Group.
  - `classroom_attendance`.
  - `classroom_events`: dùng để xem lại.
- **Realtime:**
  - Broadcast cho nước đi, mũi tên, tô ô.
  - Presence cho danh sách người trong phòng.
- **Video:** LiveKit; token cấp qua Edge Function.
- **Lịch:** `calendar_events`. Batch có lịch tuần lặp lại.
