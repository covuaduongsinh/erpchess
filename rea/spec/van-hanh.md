# Vận hành kinh doanh

## Leads

- Là tính năng bật/tắt theo học viện. Học viện khảo sát chưa bật.
- Dùng để thu khách tiềm năng, kèm lớp học thử (loại sự kiện "demo class" trong Calendar).

## Plans

- **Gói học phí:** tạo mới, hoặc chọn từ thư viện khoảng 20 mẫu giá dành cho học viện cờ.
- **Đa tiền tệ:** một gói có thể có giá ở nhiều đơn vị tiền.

## Discounts

- Giảm giá dùng chung cho nhiều gói.
- **Số liệu:** tổng số, đang hiệu lực, số lần đã dùng.
- Lọc theo loại giảm giá.

## Invoices

- Tạo hoá đơn kèm link thanh toán.

## Billing

- Tiền tệ mặc định của học viện, áp cho gói, hoá đơn, giảm giá và màn thanh toán.
- Mã số thuế.
- Đánh số hoá đơn.

## Reminders

- Nhắc tự động theo danh mục, hiện có "Nhắc đóng phí" trước hạn.

## Email

- Cấu hình tên và địa chỉ gửi email mời (giải đấu, quiz…).

## Notifications

- **Nhật ký WhatsApp:**
  - Danh mục: lớp học, quiz, giải đấu, nhắc hoá đơn, xác minh.
  - Thống kê: đã gửi, đã nhận, lỗi, chi phí mỗi tin.
  - Xem trước nội dung tin.
- Bật/tắt từng danh mục.

## Integration

- **Liên lạc:** email gửi đi, WhatsApp Business API.
- **Thanh toán:**
  - Chuyển khoản/QR.
  - Cổng do nền tảng quản lý.
  - Razorpay.
  - Stripe.

## Ánh xạ sang erpchess (thị trường Việt Nam)

- **Thanh toán:**
  - Chuyển khoản bằng VietQR, cần đối soát.
  - PayOS hoặc VNPay.
  - Stripe cho khách quốc tế.
- **Kênh thông báo:**
  - Email qua Resend.
  - Push qua Expo và Web Push.
  - Zalo OA (thay WhatsApp) để sau.
- **Bảng:** `plans`, `plan_prices`, `discounts`, `subscriptions`, `invoices`, `payments`, `reminder_rules`, `notification_log`, `leads`.
