# Danh mục kiểm tra phát hành (Release Checklist) v1.0.0

Checklist này được sử dụng trước khi cắt tag phiên bản mới và phát hành chính thức lên các môi trường production.

---

## 1. Kiểm tra mã nguồn & Kiểm thử tự động (CI/CD)

- [ ] Tất cả các nhánh tính năng đã được merge vào nhánh `main`.
- [ ] Chạy kiểm tra tĩnh toàn bộ monorepo không có lỗi:

  ```bash
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  ```
- [ ] Kiểm tra xuất bản web của Mobile:

  ```bash
  pnpm --filter @erpchess/mobile export:web
  ```
- [ ] Kiểm tra biên dịch mã Rust cho Tauri Desktop:

  ```bash
  cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
  ```
- [ ] Xác nhận toàn bộ 3 jobs trên GitHub Actions của commit trên `main` đều đạt trạng thái XANH (PASS).

---

## 2. Kiểm tra nghiệp vụ & Trải nghiệm người dùng (E2E Smoke Tests)

- [ ] **Xác thực & Học viện (Giai đoạn 1 & 2):**
  - Đăng ký tài khoản, đăng nhập qua Email / Magic Link.
  - Tạo học viện mới, chuyển đổi giữa các học viện, gửi link mời thành viên.
- [ ] **Bàn cờ & Động cơ cờ vua Arasan (Giai đoạn 3 & 4):**
  - Bàn cờ tải mượt mà, hỗ trợ kéo thả và click-to-move.
  - Phân tích nước đi với động cơ Arasan WASM trong Web Worker hoạt động độc lập, không gây giật lag luồng giao diện chính.
- [ ] **Học phần & Bài tập (Giai đoạn 5 & 6):**
  - Giải câu đố (tactics/puzzle) chấm điểm đúng khi đi đúng hoặc sai nước đi.
  - Trả lời trắc nghiệm (quiz) hiển thị kết quả và giải thích.
- [ ] **Lớp học trực tuyến & Tương tác (Giai đoạn 7 & 8):**
  - Giáo viên mở phòng học LiveKit, học viên tham gia truyền nhận âm thanh/hình ảnh ổn định.
  - Bàn cờ lớp học đồng bộ thời gian thực giữa giáo viên và học viên qua Supabase Realtime / Data channel.
- [ ] **Ghép cặp & Thi đấu giải (Giai đoạn 9 & 10):**
  - Ghép cặp đấu tập nội bộ theo hệ số Elo.
  - Tổ chức giải đấu hệ Thụy Sĩ (Swiss pairing) bốc thăm các vòng đấu chính xác.
- [ ] **Kế toán REA & Đăng ký gói (Giai đoạn 11 & 12):**
  - Mua gói dịch vụ tạo đơn PayOS hiển thị mã QR VietQR chuẩn.
  - Webhook PayOS xác nhận giao dịch ghi nhận đầy đủ bút toán REA vào bảng dữ liệu (không có lệnh xóa/sửa số dư sai lệch).
- [ ] **Hồ sơ & Báo cáo học viên (Giai đoạn 13):**
  - Cập nhật hồ sơ (ngôn ngữ tiếng Việt/tiếng Anh, múi giờ, kiểu ký hiệu nước đi).
  - Báo cáo học viên tổng hợp điểm danh, bài tập, ván đấu và xuất file CSV chính xác mã hóa UTF-8 BOM.

---

## 3. Kiểm tra An toàn & Bảo mật

- [ ] Không có thông tin nhạy cảm (Private keys, Secret tokens, Service Role keys) bị lộ trong mã nguồn hoặc gói client.
- [ ] Chính sách Row Level Security (RLS) của Supabase được bật trên tất cả các bảng dữ liệu.
- [ ] Tiêu đề bảo mật HTTP (Security Headers) đã được kích hoạt:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN` / `DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] Kiểm tra bản quyền: Không có mã nguồn nào thuộc giấy phép lây nhiễm GPL được nhúng vào mã ứng dụng phân phối.

---

## 4. Kiểm tra Đóng gói & Phân phối Đa nền tảng

- [ ] **Web (`apps/web`):** Triển khai thử nghiệm trên Vercel Preview, kiểm tra chức năng tải file và WASM.
- [ ] **Site (`apps/site`):** Kiểm tra trang đích, trang thanh toán, endpoint `/api/health`, `robots.txt` và `sitemap.xml`.
- [ ] **Desktop (`apps/desktop`):** Đóng gói và cài đặt thử nghiệm trên Windows/macOS, đảm bảo ứng dụng khởi động thành công và kết nối được dữ liệu.
- [ ] **Mobile (`apps/mobile`):** Build bản APK preview qua EAS, cài đặt trên thiết bị thật và xác nhận giao diện hiển thị đúng chuẩn.

---

## 5. Quy trình phát hành bản chính thức

1. Tăng số phiên bản đồng bộ trong:
   - `package.json` (root)
   - `apps/desktop/package.json`
   - `apps/desktop/src-tauri/Cargo.toml`
   - `apps/desktop/src-tauri/tauri.conf.json`
   - `apps/mobile/app.json`
2. Tạo git tag:

   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0: Nền tảng Quản trị & Đào tạo Cờ vua Toàn diện"
   git push origin v1.0.0
   ```
3. Theo dõi workflow `Release Desktop Apps` trên GitHub Actions đến khi hoàn thành xuất bản tài nguyên.
4. Đẩy bản build Mobile lên kho ứng dụng qua lệnh `eas submit`.
