# Khảo sát Chesslang (clean-room)

Thư mục này chứa **đặc tả hành vi** của nền tảng Chesslang, dùng làm mục tiêu tái tạo cho erpchess.
- **Nguồn quan sát:** `platform.chesslang.com`, tài khoản học viện của chủ dự án. Khảo sát ngày 2026-10-23, qua phiên trình duyệt đã đăng nhập sẵn.
- **Cách quan sát:** chỉ mở trang, đọc giao diện và mở form rồi thoát, không bấm lưu.
  - Ngoại lệ: mở trang tạo Study làm Chesslang tự sinh một bản nháp rỗng ("Untitled draft"). Bản nháp đó vẫn còn trên tài khoản.
- **Nguyên tắc clean-room:**
  - Đặc tả viết lại bằng lời của mình, chỉ mô tả hành vi, trường dữ liệu và luồng.
  - Không chép mã, hình ảnh, văn bản giao diện hay học liệu (study, câu hỏi) của Chesslang.
  - Học liệu của erpchess phải tự soạn, hoặc lấy từ nguồn có giấy phép mở.
- **Sổ cái:** [`ledger.md`](ledger.md) liệt kê từng claim và trạng thái tái tạo trong erpchess.
  - Sổ cái chính thức của REA (`build_reconstruction_obligation_ledger`) cần evidence do REA tự ghi, tức phải chạy Chrome có cổng CDP (`--remote-debugging-port=9222`). Lần khảo sát này chưa có điều kiện đó, nên để làm sau.

## Danh sách đặc tả

| Tệp                                                      | Nội dung                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [spec/00-ban-do.md](spec/00-ban-do.md)                   | Bản đồ điều hướng, vai trò, khái niệm chung                                     |
| [spec/hoc-lieu-study.md](spec/hoc-lieu-study.md)         | Study, các loại hoạt động, Collections                                          |
| [spec/quiz-bai-tap-luyen.md](spec/quiz-bai-tap-luyen.md) | Quiz, Exercise (bài tập), Practice                                              |
| [spec/lop-hoc.md](spec/lop-hoc.md)                       | Classroom trực tiếp, Calendar                                                   |
| [spec/choi-giai-dau.md](spec/choi-giai-dau.md)           | Game Area, Simul, Tournament, Board, Database                                   |
| [spec/quan-tri.md](spec/quan-tri.md)                     | Thành viên, Batch, Level, Rating, Branding, Location, Report, Chat, Preferences |
| [spec/van-hanh.md](spec/van-hanh.md)                     | Lead, Plan, Discount, Invoice, Billing, Reminder, Notification, Integration     |
