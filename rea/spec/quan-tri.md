# Quản trị học viện

## Students

- **Số liệu ghế:** tổng ghế, ghế đang dùng, ghế còn lại (theo gói thuê bao).
- **Thao tác chung:**
  - Thêm học viên (menu có nhiều cách thêm).
  - Nhập (import), xuất (export).
  - Tìm kiếm, lọc theo HLV, sắp xếp.
  - Ẩn/hiện học viên ngừng học.
  - Xem dạng danh sách hoặc lưới.
- **Thẻ học viên:**
  - Ảnh đại diện, tên hiển thị, username, cấp độ, email.
  - Nút: sửa, đặt mật khẩu, giải đấu, link, đổi trạng thái, đăng nhập thay (impersonate).

## Coaches

- Thêm HLV, ẩn/hiện HLV ngừng làm.
- Quy trình gợi ý: thêm HLV → gán học viên → dạy.

## Groups và Batches

- **Batch** = nhóm học viên cùng cấp độ, cùng lịch, cùng HLV, giống một lớp cố định. Khuyến nghị 6–12 học viên.
- **Group** là nhóm tự do.
- Hai kiểu xem: danh sách và lưới.

## Levels

- **Lộ trình cấp độ:** mỗi cấp có khoảng rating, ví dụ 0–200, 200–500, 500–1000, 1000–1500, 1500–2000…
- **Tạo:** từ mẫu có sẵn, hoặc tự tạo.
- **Điều kiện lên cấp:** XP, puzzle/quiz, giải đấu — học viện tự chọn tiêu chí.
- **Xếp học viên vào cấp** theo rating.

## Rating

- **Rating nội bộ** luôn bật, gồm Classical, Rapid, Blitz.
- **Bật/tắt thêm:** FIDE (Standard/Rapid/Blitz), USCF (chỉ học viện Mỹ).

## Branding

- **Thông tin học viện:** tên, mô tả, link mạng xã hội.
- **Tuỳ biến giao diện:**
  - Nhận diện nền tảng.
  - Logo và favicon.
  - Trang đăng nhập.
  - Thương hiệu khi phát ván trực tiếp.
  - Tên miền riêng (white label).

## Branding (quan sát lại bằng REA, 2026-10-31)

- Trang Branding có sáu tab:
  - **Academy Details:** tên, mô tả, link mạng xã hội.
  - **Platform Branding:** màu chủ đạo (bảng màu gợi ý hoặc tự chọn) kèm xem trước nút; giao diện sáng/tối/theo hệ thống; theme bàn cờ mặc định áp cho mọi thành viên.
  - **Logo & Favicon:** tải lên logo (hiện ở thanh bên) và favicon (tab trình duyệt).
  - **Login Page:** logo, ảnh nền và các mục nội dung tự thêm của trang đăng nhập; chỉ lưu được khi đã gắn tên miền riêng.
  - **Live Games Branding:** thư viện ảnh của học viện dùng khi phát ván trực tiếp.
  - **White Label Domains:** gắn tên miền riêng (gói đang xem cho một tên miền).

## Location

Quan sát lại bằng REA qua Chrome CDP ngày 2026-10-31 (chỉ mở trang và form rồi huỷ, không lưu).
- **Danh sách địa điểm:** lọc theo tab Tất cả / Trung tâm / Trường học, có ô tìm kiếm; nút thêm địa điểm.
- **Form thêm địa điểm:**
  - Loại (bắt buộc): trung tâm của học viện, trường học, chung cư/nhà CLB, trung tâm cộng đồng, thư viện/phòng tự học, khác.
  - Tên (bắt buộc), cờ "cơ sở chính" (mỗi học viện tối đa một).
  - Địa chỉ: dòng địa chỉ, quốc gia (bắt buộc), tỉnh/bang, thành phố.
  - Ngày làm việc (chọn nhiều, bắt buộc), giờ mở và giờ đóng cửa (bắt buộc), múi giờ IANA (bắt buộc).
  - Người liên hệ và số điện thoại kèm mã vùng (bắt buộc); email, ghi chú (không bắt buộc).
- **Liên kết với Batch:** form tạo Batch có trường **Hình thức học**: Online / Offline / Hybrid. Chọn Offline hoặc Hybrid thì bắt buộc chọn một địa điểm (có lối tắt tạo địa điểm mới).
- **Menu Administration** (để đối chiếu phạm vi): Students, Coaches, Groups, Batches, Leads, Calendar, Invoices, Billing, Plans, Discounts, Reminders, Email, Notifications, Reports, Branding, Location, Levels, Integration, Rating.

## Reports

- Chọn học viên để xem báo cáo của học viên đó.
- Xuất CSV toàn học viện theo khoảng ngày và theo loại (lớp học, …).

## Chat

- **Danh sách hội thoại**, lọc: chưa đọc, Group, Batch, HLV, học viên.
- Tìm kiếm hội thoại.

## Preferences (hồ sơ)

- Username, email, họ tên, đổi mật khẩu.
- Đồng bộ ván Chess.com/Lichess.
- Quốc gia, múi giờ, ngôn ngữ.
- Ký hiệu nước đi: biểu tượng quân hoặc chữ.
