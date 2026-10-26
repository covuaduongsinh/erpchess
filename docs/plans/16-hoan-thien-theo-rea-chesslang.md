# Kế hoạch: Hoàn thiện ERPChess đồng bộ Web, Desktop, Mobile dựa trên giải mã Chesslang (REA)

## 1. Bối cảnh và Dữ liệu giải mã từ REA

Vào ngày 2026-10-27, tiện ích **REA (Reverse Engineer Anything)** đã đăng nhập thành công vào tài khoản huấn luyện viên `duongsinhchess` tại học viện `Dương Sinh chess CLB` trên `https://platform.chesslang.com`.

### 1.1. Bản đồ phân hệ & Routes thực tế của Chesslang:

- **Tổng quan:** `/dashboard` (Overview: Quick Actions, Thống kê tuần, Lịch học sắp diễn ra, Top học viên).
- **Phím tắt toàn cầu:** `Command Palette` (`Ctrl+K` / `Cmd+K`) điều hướng và thực thi tác vụ tức thì.
- **Học viện & Học viên:** `/administration/students`, `/batches`, `/coaches`.
- **Lớp học:** `/classrooms` (Phòng học trực tuyến, Đồng bộ bàn cờ thời gian thực).
- **Học liệu & Bài giảng:** `/study/list` (Kho Study, Hoạt động tương tác, Nháp).
- **Bài tập & Luyện tập:**
  - Bài tập về nhà: `/assignment/exercise`
  - Đấu đố: `/quiz/list`
  - Luyện thế cờ theo chương: `/practice`
- **Khóa học & Giáo trình:** `/course/list` (Curriculum 5-7 cấp độ).
- **Khu vực thi đấu & Bàn cờ:**
  - Bàn cờ phân tích & Masterbase: `/board`
  - Đấu tập & Đấu máy: `/game-area` (Thách đấu Bot Arasan theo Elo, Học viên online)
  - Đấu đồng loạt: `/simul`
  - Giải đấu: `/tournaments` (Swiss, Quad, Round Robin)
  - CSDL ván cờ PGN: `/database`
- **Vận hành & Tương tác:**
  - Báo cáo: `/reports/coach`
  - Trò chuyện: `/chat` (Academy Chat theo lớp/HLV/học viên)
  - Cài đặt & Tuỳ chọn: `/preferences` (Theme, Bàn cờ, Ký hiệu nước đi, Múi giờ)

---

## 2. Mục tiêu kiến trúc & Đồng bộ 3 nền tảng

- **Web SPA (`apps/web`):** Giao diện quản trị và lớp học chuyên sâu cho HLV và học viên trên trình duyệt (React 19 + TanStack Router + Tailwind CSS v4).
- **Desktop (`apps/desktop`):** Tauri 2 gói trọn ứng dụng Web, bổ sung phím tắt hệ thống, chạy offline với SQLite cache, phân tích cờ native Arasan tốc độ cao không bị giới hạn bộ nhớ trình duyệt.
- **Mobile (`apps/mobile`):** Expo (React Native + NativeWind) tối ưu trải nghiệm học viên và phụ huynh: nhận thông báo push tức thời, giải puzzle cảm ứng vuốt mượt mà, điểm danh và học trực tuyến mọi lúc mọi nơi.
- **Backend chung (`supabase`):** Cơ sở dữ liệu Postgres + RLS bảo mật tuyệt đối, Realtime presence và pub/sub cho bàn cờ và tin nhắn, Edge Functions xử lý bốc thăm Swiss và thanh toán VietQR / PayOS.

---

## 3. Phân chia các giai đoạn triển khai (Giai đoạn 15)

Kế hoạch hoàn thiện được chia thành **3 PR** tập trung và độc lập:

### PR 15a: Chuẩn hóa Điều hướng, Command Palette (`Ctrl+K`) & Dashboard Overview giống Chesslang

1. **Command Palette (`Ctrl+K`):**
   - Hộp thoại tìm kiếm nhanh toàn hệ thống (mở nhanh lớp học, tìm học viên, tạo bài tập, vào giải đấu, đổi giao diện).
   - Hoạt động mượt mà trên cả Web và Desktop Tauri (lắng nghe hotkey bàn phím).
2. **Dashboard Overview chuyên nghiệp:**
   - 4 nút Quick Actions: _Tạo lớp học_, _Tạo bài tập_, _Tổ chức giải đấu_, _Mời học viên_.
   - Khối Lịch học sắp diễn ra (Upcoming Sessions Widget) kèm nút "Vào lớp ngay".
   - Khối Thống kê tuần (Weekly Stats: số giờ học, bài tập đã giải, ván đấu hoàn thành).
   - Bảng vàng thành tích học viên (Top Learners Leaderboard theo XP / Elo).
3. **Đồng bộ Navigation Bar & URL aliases:**
   - Hỗ trợ các route tắt chuẩn: `/dashboard`, `/classrooms`, `/quizzes`, `/assignments`, `/studies`, `/courses`, `/practice`, `/simul`, `/game-area`, `/tournaments`, `/database`, `/chat`, `/preferences`.

### PR 15b: Hoàn thiện Phân hệ Luyện tập (Practice Chapters), Đấu Bot (Game Area) & PGN Database

1. **Luyện tập thế cờ theo chương (Practice Chapters):**
   - HLV tạo các chương luyện tập (khai cuộc, tàn cuộc cơ bản, bẫy chiến thuật).
   - Học viên luyện tập tự động với gợi ý và chấm điểm tiến độ từng chương.
2. **Nâng cấp Game Area:**
   - Chọn cấp độ Bot Arasan trực quan với avatar và Elo (từ 800 đến 2600).
   - Widget danh sách học viên đang online trong học viện (Presence Realtime) kèm nút bấm thách đấu 1 chạm.
3. **Cơ sở dữ liệu ván đấu (Database Library):**
   - Trình duyệt và tìm kiếm ván đấu PGN nhanh, xem lại ván có biểu đồ đánh giá thế trận từ Arasan.

### PR 15c: Hoàn thiện Đồng bộ Mobile (Expo) & Desktop (Tauri)

1. **Mobile App:**
   - Cập nhật giao diện Dashboard trên mobile với các widget tương đồng (Quick Actions, Lịch học hôm nay, Bài tập cần làm).
   - Thêm tab Game Area và Practice trên mobile.
2. **Desktop App:**
   - Kích hoạt menu native và phím tắt `Ctrl+K`.
   - Lưu trạng thái offline cho các bài tập và thế cờ yêu thích.
3. **Kiểm thử toàn diện & Cập nhật sổ cái REA:**
   - Kiểm tra CI 3 job xanh.
   - Cập nhật toàn bộ các claim trong `rea/ledger.md`.

---

## 4. Kế hoạch kiểm chứng

- **Kiểm thử tự động:**
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
  - `pnpm --filter @erpchess/mobile export:web`.
  - `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`.
  - Toàn bộ 3 jobs CI trên GitHub Actions xanh 100%.
- **Kiểm chứng thực tế:**
  - Mở web [http://localhost:5173](http://localhost:5173) bấm `Ctrl+K` và trải nghiệm Dashboard mới.
  - So sánh trực tiếp với các ảnh chụp bằng chứng từ Chesslang trong `rea/evidence/screenshots/`.

---

## 5. Kết quả

_(Sẽ cập nhật sau khi triển khai từng PR)_
