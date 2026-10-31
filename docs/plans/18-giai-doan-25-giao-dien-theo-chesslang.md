# Giai đoạn 25: Giao diện theo Chesslang (khung ứng dụng, hệ thành phần, từng nhóm trang)

> **Trạng thái:** đã lập kế hoạch 2026-11-01, chưa triển khai.
> **Tiếp nối:** Giai đoạn 24 (`17-ke-hoach-hoan-thien-toan-dien-theo-dac-ta.md`, PR 24a–24d đã xong).
> **Lý do:** sổ cái REA đã đóng 46/60 claim về tính năng, nhưng chủ dự án nhận xét giao diện erpchess "chưa được như chesslang.com". Giai đoạn này chỉ xử lý **bố cục và trải nghiệm**, không thêm tính năng nghiệp vụ.

## 1. Căn cứ quan sát bằng REA (clean-room)

- **Cách quan sát:** `rea capture-browser-scenario` (REA 6.7.0, chế độ launch, Chrome headless, profile tạm, viewport 1440×900). Kịch bản đăng nhập bằng secret lấy từ biến môi trường, rồi mở 18 trang, mỗi trang chờ 6 giây và chụp màn hình. Không bấm lưu, không tạo dữ liệu.
- **Evidence:** `ev_17669e6f505136d7cadfec19a742f09749e812f66232807aee020a05b6df93c7`. Kết quả đầy đủ ở `rea/evidence/ui-2026-11-01/capture.json` (không commit, nặng 4,8 MB; đã kiểm tra không chứa mật khẩu). Ảnh ở `rea/evidence/ui-2026-11-01/shot_p_*.png`. Kịch bản ở `scenario.json` cùng thư mục; chạy lại bằng:
  ```powershell
  $env:CL_USER='…'; $env:CL_PASS='…'
  node D:\code\rea\scripts\rea.mjs capture-browser-scenario rea\evidence\ui-2026-11-01\scenario.json --format json > capture.json
  ```
- **Trang đã chụp:** dashboard, administration/students, batches, study (→ study/list), assignment (→ assignment/exercise), quiz/list, practice, game-area, tournaments, simul, board, database, reports (→ reports/coach), chat, preferences, course (→ course/list). Hai trang `/classes` và `/calendar` trả về 404 (đường dẫn thật nằm trong menu Classrooms và Administration → Calendar).
- **Nguyên tắc:** chỉ tái tạo **bố cục, cấu trúc điều hướng và hành vi**. Không chép CSS, ảnh (ảnh nền banner, avatar, hình minh hoạ), câu chữ giao diện hay icon của Chesslang. Màu dùng bộ nhận diện Dương Sinh (`--color-primary #2B3990`, font Roboto), không dùng màu xanh của Chesslang. Màu thương hiệu học viện (white-label, GĐ22a) vẫn ghi đè `--color-primary`.

### 1.1. Quan sát chính: khung ứng dụng

| Thành phần                | Chesslang (quan sát)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | erpchess hiện tại                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Điều hướng                | **Thanh bên trái cố định** (~256 px), nền trắng. Trên cùng có logo và tên học viện (hai dòng), cùng nút thu gọn `‹`. Menu chia nhóm, mỗi nhóm mở/đóng được: **Administration** (gồm Members: Students/Coaches/Groups/Batches; Operations: Leads/Calendar/Invoices/Billing/Plans/Discounts/Reminders/Email/Notifications/Reports; Academy), **Learn** (Classrooms, Quiz, Assignment, Courses, Board, Practice), **Play** (Simul, Game Area, Tournaments), **Content** (Database, Studies). Phần đáy: Chat, Profile, Report a bug, công tắc Light/Dark, Logout. Mục đang mở được tô nền xám nhạt. Bấm vào Administration thì sidebar chuyển sang danh sách con, có nút `‹ ADMINISTRATION` để quay lại. | Thanh trên cùng màu navy (logo, Phân tích, Command Palette, ngôn ngữ, hồ sơ, chuông, đăng xuất) và **hơn 20 tab ngang** dưới tên học viện, nằm trong khung `max-w-5xl`. |
| Thu gọn                   | Ở trang Board, sidebar thu thành **thanh icon** (~80 px), chỉ còn icon, giữ nguyên thứ tự nhóm.                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Không có.                                                                                                                                |
| Nền vùng nội dung         | Nền xanh rất nhạt; nội dung nằm trong các **thẻ trắng bo góc lớn** (~16 px), bóng rất nhẹ. Vùng nội dung rộng hết phần còn lại của màn hình.                                                                                                                                                                                                                                                                                                                                                                                                      | Nền `#f8f9fc`, nội dung bó trong 1024 px.                                                                                                 |
| Đầu trang                 | **Thẻ đầu trang**: ô icon vuông bo góc nền nhạt, tiêu đề lớn đậm, phụ đề xám một dòng, nút hành động chính ở bên phải (nút màu chính, có thể kèm nút viền phụ như Import/Export/Default config).                                                                                                                                                                                                                                                                                                                                                  | Không có thẻ đầu trang, mỗi trang tự đặt `h2`.                                                                                           |
| Thẻ số liệu               | Hàng 2–4 thẻ: icon nằm trong ô màu nhạt (mỗi chỉ số một màu: xanh dương, xanh lá, cam, xám), số lớn, nhãn nhỏ. Có hai kiểu: icon nằm trái cạnh số (Quiz, Tournaments), hoặc icon ở trên, nhãn viết hoa, số lớn ở giữa (Dashboard, Game Area, Students).                                                                                                                                                                                                                                                                                          | Có `StatsRow` ở tổng quan, mỗi trang tự làm kiểu riêng.                                                                                  |
| Tab                       | Hai kiểu. **Gạch chân** có icon và huy hiệu "NEW" (Quiz: Quiz / Automated Quiz / Student View / Leaderboard; Studies: Studies / Collections). **Nút nhóm dạng viên thuốc** (Exercise / Assigned; My / Public / Shared Studies có số đếm; Academy stats / Ongoing sessions; Game Area: Students / Game History / Live Games).                                                                                                                                                                                                                      | Tab tự làm ở từng trang, không thống nhất.                                                                                               |
| Thanh lọc                 | Một thẻ trắng chứa: ô tìm kiếm có icon kính lúp, ô chọn sắp xếp, cặp ô **Start date / End date** có icon lịch, nút **M/Q/Y** (tháng/quý/năm), chip trạng thái (All / In Progress / Upcoming / Past, chip đang chọn tô màu chính), nút chuyển chế độ xem **danh sách / lưới / lịch**.                                                                                                                                                                                                                                                              | Có lọc nhưng mỗi trang một kiểu.                                                                                                         |
| Trạng thái rỗng           | Căn giữa: icon hoặc hình minh hoạ, tiêu đề đậm, một câu mô tả, nút CTA ("Create your first …"). Bài tập có khung viền nét đứt.                                                                                                                                                                                                                                                                                                                                                                                                                    | Thường chỉ là một dòng chữ xám.                                                                                                          |
| Phân trang                | "Rows/page" (ô chọn 20), các nút ⏮ ‹ › ⏭, ô "Go to".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Ít trang có phân trang.                                                                                                                  |
| Dashboard                 | Tiêu đề "<Học viện> overview", lời chào. Hàng **Quick actions** gồm 3 thẻ lớn (thẻ đầu tô màu chính). 4 thẻ số (Students kèm thanh tiến độ ghế, Classrooms, Tournaments upcoming/in progress/past, Quiz activity). Tab Academy stats / Ongoing sessions. Weekly stats có chọn khoảng ngày, Previous/Next week, biểu đồ 3 chuỗi (Daily activity, Attendance, Quiz completion). **Cột phải** là thẻ Leaderboard: This week / This month / 6 months, **bục podium** top 3.                                                                              | Có quick actions, stats, biểu đồ tuần, bảng xếp hạng, nhưng xếp dọc trong khung hẹp, không có bục podium.                                 |
| Học viên                  | 3 thẻ ghế (Total / Active / Remaining). Thanh: tìm kiếm, lọc HLV, Sort, công tắc Show inactive, nút **List view / Grid view**. Thẻ học viên dạng lưới: avatar, tên, @username, **hàng 7 nút icon** (sửa, đổi PIN, thành tích, link, đồng bộ, lịch sử, đăng nhập thay), Level, Email, công tắc Active, nút Show more. Nút Add Student có menu thả, kèm Import và Export.                                                                                                                                                                           | Bảng `StudentAdminTable`, không có thẻ ghế, không có chế độ lưới.                                                                        |
| Game Area                 | 4 thẻ số căn giữa (Games today / as White / as Black / Total), **banner đánh với máy** (nền tối có ảnh, chip cấp độ, tiêu đề lớn, nút Play Computer), cột phải **Online Students** (trạng thái rỗng có icon). Nút Create Pairings ở đầu trang.                                                                                                                                                                                                                                                                                                     | Các khối xếp dọc.                                                                                                                        |
| Board                     | Hai cột: bàn cờ bên trái, dưới bàn là **thanh công cụ icon** (lật bàn, ghim, tẩy, công cụ vẽ, chụp, gương, điều hướng ⏮‹›⏭, lưới, bot, hoàn tác) và công tắc Move times. Bên phải là panel đầu trang (Masterbase + Save Game), các tab dạng viên thuốc **Masterbase / New Board / AI PDF / My Database / Engine / Analysis**, rồi bảng ván. Chọn một ván thì xổ ra bàn cờ nhỏ ngay trong hàng. Sidebar ở dạng icon.                                                                                                                                   | `/analysis` nằm trong khung hẹp, Masterbase là một panel bên trong.                                                                      |
| 404                       | Thẻ giữa màn hình: số 404 cách điệu, tiêu đề, câu đùa về cờ, nút Go to Dashboard / Go Back / Refresh, Quick links.                                                                                                                                                                                                                                                                                                                                                                                                                              | Mặc định của router.                                                                                                                     |

## 2. Quyết định thiết kế

1. **Khung ứng dụng mới** thay cho `Shell` cộng tab ngang. Áp dụng cho mọi trang đã đăng nhập: trang học viện `/a/$slug/*` và các trang ngoài học viện như `/analysis`, `/profile`, `/preferences`, `/`, cùng các alias kiểu `/dashboard`. Trang khách (`/login`, `/login/$slug`, `/signup`, `/invite/$token`) giữ bố cục riêng.
2. **Nhóm menu tiếng Việt:** Quản trị, Học tập, Thi đấu, Nội dung. Phân quyền **giữ đúng logic `tabs` hiện có** trong `a.$slug.tsx` (billing ẩn với coach, database ẩn với phụ huynh, notifications chỉ owner, leads theo `leads_enabled`, staff mới thấy calendar/students/levels/locations).
3. **Icon:** thêm `lucide-react` (giấy phép ISC, dùng được). Không dùng bộ icon của Chesslang.
4. **Token:** giữ màu Dương Sinh. Bổ sung `--color-surface`, `--color-border`, `--color-primary-soft` (nền nhạt suy ra từ màu chính bằng `color-mix`), `--color-app-bg` (nền xanh nhạt suy ra từ màu chính), `--radius-card`, cùng bộ biến cho **chế độ tối** (`.dark`). Ưu tiên `color-mix` theo `--color-primary` để màu thương hiệu học viện tự kéo theo nền nhạt.
5. **Không đổi API, DB hay migration.** Toàn giai đoạn là việc giao diện của `apps/web` (desktop Tauri dùng lại bản web). Mobile Expo chỉ chỉnh token màu, việc này để PR cuối.
6. Toàn bộ chữ đi qua i18n vi/en. Không có chữ cứng.

## 3. Chia PR

Mỗi PR nhánh riêng từ `main`, qua đủ cổng kiểm thử ở mục 5, merge xong mới làm PR sau.

### PR 25a: Khung ứng dụng: sidebar nhóm, thu gọn, mobile drawer

- **Tệp mới:**
  - `apps/web/src/components/layout/AppSidebar.tsx`
  - `apps/web/src/components/layout/nav-items.ts`: hàm thuần `buildNavGroups(role, academy)` trả về các nhóm và mục, kèm icon, `to`, `exact` và điều kiện vai trò.
  - `apps/web/src/components/layout/AppLayout.tsx`
  - `apps/web/src/components/layout/useSidebarState.ts`: lưu trạng thái thu gọn và nhóm đang mở vào `localStorage`.
- **Sidebar:**
  - Đầu sidebar: logo và tên học viện, kèm vai trò.
  - Bấm vào khối đầu mở **menu đổi học viện** (dữ liệu `useMyAcademies`) và mục "Tạo học viện".
  - Nút thu gọn chuyển sang thanh icon, rê chuột lên icon thì hiện tooltip tên mục.
- **Nhóm "Quản trị":**
  - Thành viên: Học viên, HLV (trang thành viên hiện có), Nhóm, Batch.
  - Vận hành: Lead, Lịch, Hoá đơn/Học phí, Gói, Giảm giá, Thông báo, Báo cáo.
  - Học viện: Thông tin và Branding (trang tổng quan, thẻ Branding), Cấp độ, Địa điểm, Chứng chỉ.
  - Làm theo kiểu Chesslang: bấm "Quản trị" thì sidebar chuyển sang danh sách con, có nút `‹ QUẢN TRỊ` để quay lại. Khi đang ở một trang quản trị thì tự mở sẵn danh sách con.
- **Nhóm còn lại:**
  - Học tập: Lớp học, Quiz, Bài tập, Khoá học, Bàn cờ (`/analysis`), Luyện tập.
  - Thi đấu: Simul, Khu thi đấu, Giải đấu.
  - Nội dung: CSDL ván, Học liệu.
- **Đáy sidebar:**
  - Chat (kèm số chưa đọc nếu đã có hook), Hồ sơ.
  - Công tắc Sáng/Tối (chỉ đặt chỗ, làm thật ở PR 25f).
  - Ngôn ngữ VI/EN, Đăng xuất.
- **Thanh trên vùng nội dung:** mảnh, nền trong suốt, gồm Command Palette (Ctrl+K), chuông thông báo, avatar. Thanh này thay cho header navy.
- **Màn hình hẹp hơn `lg`:** sidebar thành drawer, mở bằng nút ☰ trên thanh trên.
- **Thu gọn tự động:** trang Bàn cờ/Phân tích, phòng học trực tuyến, ván đấu và simul tự thu sidebar thành icon. Người dùng vẫn mở lại được.
- **`a.$slug.tsx`:** bỏ `h1` tên học viện và `nav` tab ngang, chỉ giữ `AcademyContext` và biến màu thương hiệu. Bọc `AppLayout` ở mức route để sidebar biết học viện hiện tại. Ngoài học viện thì sidebar dùng học viện gần nhất, hoặc chỉ hiện các mục chung.
- **`Shell.tsx`:** chuyển thành `AppLayout` hoặc gọi lại `AppLayout`. Giữ `BoardPreferencesSync` và `NotificationBell`. Bỏ `max-w-5xl`, đổi sang `max-w-[1440px]` với `px-6`.
- **Kiểm thử:**
  - `nav-items.test.ts`: mục hiện/ẩn đúng theo 5 vai trò, `leads_enabled`.
  - `AppSidebar.test.tsx`: thu gọn có lưu, mục đang mở được tô, chuyển vào và ra danh sách Quản trị, drawer trên màn hẹp.
  - Sửa các test cũ đang dựa vào tab ngang hoặc header.

### PR 25b: Hệ thành phần giao diện dùng chung

- **Tách `apps/web/src/components/ui.tsx`** thành thư mục `components/ui/`, giữ `index.ts` export lại các tên cũ để không vỡ import.
- **Thành phần mới:**
  - `PageHeader`: icon, tiêu đề, phụ đề, `actions`; dạng thẻ trắng bo `--radius-card`.
  - `StatCard`: hai biến thể `inline` và `stacked`, màu nhấn `blue|green|orange|purple|gray`, có thể kèm `progress`.
  - `Tabs`: biến thể `underline` có icon và badge, biến thể `pills` có số đếm; điều khiển được qua `value`/`onChange` hoặc liên kết route.
  - `FilterBar` với `SearchInput`, `SelectField`, `DateRangeFields` (Từ ngày/Đến ngày), nút `PeriodQuickPick` (T/Q/N, dùng `periodRange` có sẵn trong domain), `StatusChips`, `ViewToggle` (danh sách/lưới/lịch).
  - `EmptyState`: icon, tiêu đề, mô tả, CTA, tuỳ chọn viền nét đứt.
  - `Pagination`: số dòng mỗi trang, ⏮‹›⏭, ô "Đến trang".
  - `Badge` (new/success/warn/muted), `Switch`, `IconButton` có tooltip.
  - `Button`: thêm biến thể `secondary` (viền), `danger`, cỡ `sm|md|lg`, prop `icon`.
  - `Modal`: chuẩn hoá các modal sẵn có (QuickSession, BatchRoster…) nếu tách được mà ít rủi ro.
- **Token mới** trong `packages/ui-tokens/src/index.ts` và `tokens.css` (test `tokens.test.ts` bắt hai nơi khớp nhau). Biến chế độ tối khai báo sẵn.
- **Kiểm thử:** test cho `Tabs` (bàn phím ←/→, `aria-selected`), `Pagination`, `DateRangeFields` cùng `PeriodQuickPick`, `EmptyState`, `StatCard`.

### PR 25c: Áp dụng: Tổng quan và nhóm Quản trị

- **Tổng quan** (`a.$slug.index.tsx`):
  - `PageHeader` "<Tên học viện> · Tổng quan" và lời chào theo tên người dùng.
  - Hàng **Thao tác nhanh** 3 thẻ lớn: Giải đấu, Học viện → Học viên, Lớp học → modal tạo nhanh đã có. Thẻ đầu tô màu chính.
  - 4 `StatCard stacked`: Học viên kèm thanh ghế, Lớp học trong tháng, Giải đấu (sắp tới/đang diễn ra/đã xong), Hoạt động quiz.
  - Tab pills "Thống kê học viện / Buổi học đang diễn ra".
  - Thống kê tuần có `DateRangeFields`, nút Tuần trước/Tuần sau, `WeeklyActivityChart` hiện có.
  - **Bố cục 2 cột** từ `xl`: cột phải là thẻ **Bảng xếp hạng** (Tuần này/Tháng này/6 tháng) có **bục podium top 3** (avatar chữ cái hoặc ảnh, cột cao theo hạng; tự vẽ, không dùng ảnh của Chesslang) và danh sách hạng 4 trở đi.
  - Các thẻ Branding, Liên hệ, Bàn cờ mặc định chuyển sang trang con **Quản trị → Học viện** `/a/$slug/settings`. Đây là route mới, chỉ gom các thẻ đã có.
- **Học viên** (`a.$slug.students.tsx`):
  - `PageHeader` với nút Thêm học viên (menu: thêm một / nhập CSV), Nhập, Xuất.
  - 3 thẻ ghế: Tổng, Đang hoạt động, Còn trống (dữ liệu đếm ghế đã có).
  - `FilterBar`: tìm, HLV, sắp xếp, công tắc "Hiện học viên nghỉ", `ViewToggle`.
  - **Chế độ lưới**: thẻ học viên có avatar, tên, @username, hàng `IconButton` cho các thao tác đã có (sửa, đổi PIN, mời phụ huynh, đổi cấp độ…), dòng Cấp độ, Email, công tắc trạng thái.
  - Chế độ bảng giữ `StudentAdminTable`.
- **Batch, Nhóm, Cấp độ, Địa điểm, Lead, Học phí (billing.\*), Thông báo:** dùng `PageHeader`, `FilterBar`, `EmptyState`, `StatCard` nếu có số liệu. Logic nghiệp vụ giữ nguyên.

### PR 25d: Áp dụng: nhóm Học tập và Nội dung

- **Quiz:**
  - 2 `StatCard inline`: Quiz tự động (badge MỚI), % đã bắt đầu.
  - Tab underline: Quiz / Quiz tự động (đưa `QuizSchedulesPanel` từ nút thành tab) / Góc nhìn học viên / Bảng xếp hạng.
  - `FilterBar` có tìm kiếm và khoảng ngày kèm T/Q/N, `Pagination`, `EmptyState` có CTA Tạo quiz.
- **Bài tập:** tab pills Bài tập / Đã giao, tìm kiếm cùng "Sắp xếp theo", `EmptyState` viền nét đứt.
- **Học liệu:**
  - Tab underline Học liệu / Bộ sưu tập.
  - Pills Của tôi / Công khai / Được chia sẻ, có số đếm.
  - Tìm kiếm, công tắc lưới, sắp xếp, khoảng ngày kèm T/Q/N.
  - Thẻ tổng "N học liệu", khối **Bản nháp** tách riêng.
  - Nút đầu trang: Cấu hình mặc định, Nhập từ Lichess, Tạo học liệu.
- **Khoá học, Lớp học, Luyện tập, CSDL ván, Báo cáo, Chat:** dùng `PageHeader`, `FilterBar`, `EmptyState`, `Pagination` khi danh sách dài.
- Các trang chi tiết như trình soạn study và phòng học **không đổi bố cục bên trong**, chỉ thêm `PageHeader` gọn nếu hợp.

### PR 25e: Áp dụng: nhóm Thi đấu và Bàn cờ

- **Khu thi đấu** (`a.$slug.play.index.tsx`):
  - `PageHeader` có nút Ghép cặp.
  - Tab pills Học viên / Lịch sử ván / Ván đang diễn ra.
  - 4 `StatCard stacked` màu khác nhau: Ván hôm nay, Cầm Trắng, Cầm Đen, Tổng ván. Dữ liệu tính từ danh sách ván đã tải; nếu cần đếm phía server thì ghi lại, không thêm RPC trong PR này.
  - **Banner đánh với máy**: nền gradient màu chính kèm họa tiết ô cờ `.chess-pattern` (không dùng ảnh của Chesslang), chip Mới học / Trung cấp / Nâng cao, nút Đánh với máy → `/a/$slug/play/bot`.
  - Cột phải **Học viên online** có `EmptyState`.
  - `QuickPairCard` đặt cạnh banner.
- **Giải đấu:**
  - Thẻ lọc gồm tìm kiếm, khoảng ngày kèm T/Q/N, sắp xếp, chip Tất cả / Đang diễn ra / Sắp tới / Đã xong, `ViewToggle` danh sách/lưới/lịch. Dạng lịch có thể làm sau: nếu chưa làm thì ẩn nút, không để nút chết.
  - 4 `StatCard inline` màu: Tổng, Đang diễn ra, Sắp tới, Đã xong.
  - `EmptyState` có CTA.
- **Simul:** cùng mẫu với Giải đấu.
- **Bàn cờ / Phân tích** (`analysis.tsx`, `AnalysisBoard`):
  - Bố cục **2 cột toàn chiều rộng**. Bàn cờ bên trái, kèm **thanh công cụ icon** dưới bàn, gom các nút đã có (lật bàn, xoá nét vẽ, đầu/lùi/tiến/cuối, engine…).
  - Panel phải gồm `PageHeader` gọn và nút Lưu ván nếu đã có, cùng tab pills **Masterbase / Bàn mới / CSDL của tôi / Engine / Phân tích** gom các panel sẵn có. Chesslang có tab "AI PDF", erpchess **không làm**.
  - Ở trang này sidebar ở dạng icon.

### PR 25f: Chế độ tối, trang 404, hoàn thiện và đối chiếu bằng REA

- **Chế độ tối:**
  - Lưu theo người dùng vào `localStorage`, mặc định theo hệ thống.
  - Gắn class `.dark` lên `<html>`. Các thành phần của 25b dùng biến token nên đổi theo.
  - Rà các màu cứng (`bg-white`, `text-gray-…`) ở những trang đã đổi.
- **Trang 404 riêng** (`notFoundComponent` của router): tự thiết kế, nút Về tổng quan / Quay lại / Tải lại và các liên kết nhanh.
- **Mobile Expo:** chỉ đồng bộ token màu mới (`app-bg`, `surface`, `border`) vào theme. Không đổi điều hướng.
- **Đối chiếu bằng REA:**
  - Viết `rea/evidence/ui-2026-11-01/scenario-erpchess.json` chạy cùng danh sách trang trên bản build `vite preview` cục bộ, đăng nhập tài khoản thử của `erpchess-dev`, secret lấy từ biến môi trường.
  - Chụp từng trang, đặt cạnh ảnh Chesslang trong một tệp so sánh `rea/evidence/ui-2026-11-01/so-sanh.md`.
  - Ghi các chỗ còn khác và lý do (khác có chủ đích, hoặc để sau).
- **Cập nhật** `rea/ledger.md`: thêm claim `ui.shell`, `ui.components`, `ui.dark-mode`, `ui.404`. Cập nhật kế hoạch này bằng kết quả nghiệm thu từng PR.

## 4. Rủi ro và cách xử lý

| Rủi ro                                                                                                                       | Cách xử lý                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Đổi khung làm vỡ nhiều test web: 76+ test đang dựa vào text hoặc vai trò của tab.                                            | PR 25a chỉ đổi khung và sửa test liên quan. Các PR sau đổi từng nhóm trang, chạy `pnpm --filter @erpchess/web test` sau mỗi nhóm.                                                          |
| Màu thương hiệu học viện quá sáng hoặc quá tối làm nền nhạt xấu.                                                              | Nền nhạt tính bằng `color-mix(in oklab, var(--color-primary) 6%, white)`, chữ trên nền màu chính dùng `--color-text-on-primary` (đã có `brandColorVars`).                                  |
| Trang ngoài học viện (`/analysis`, `/profile`) không có học viện hiện tại.                                                    | Sidebar dùng học viện gần nhất (`useMyAcademies`, lưu slug cuối vào `localStorage`). Không có học viện nào thì chỉ hiện Bàn cờ, Hồ sơ, Tạo học viện.                                         |
| Phạm vi lớn (72 route).                                                                                                       | Thứ tự ưu tiên: khung → thành phần → trang hay dùng nhất. Trang chi tiết ít dùng chỉ thêm `PageHeader`. Ghi những trang chưa đổi vào mục "Chưa làm" của từng PR, không để dở dang ngầm.       |
| Lỡ chép tài sản của Chesslang.                                                                                                | Không tải ảnh, CSS hay SVG từ Chesslang. Hình minh hoạ dùng icon lucide, emoji hệ thống hoặc họa tiết ô cờ của Dương Sinh. Reviewer kiểm tra mục này trong từng PR.                          |

## 5. Cổng kiểm thử của mỗi PR

Giống mục 7 của kế hoạch 17:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm build` (hoàn tác `apps/site/next-env.d.ts` nếu bị sửa)
5. `pnpm --filter @erpchess/mobile export:web`
6. `cargo check` desktop (dùng `-j 2` nếu thiếu RAM)
7. CI 3/3 xanh

Thêm cho giai đoạn này: **chụp màn hình trước và sau** các trang chính của PR bằng REA (`capture-browser-scenario` trên `vite preview`), đính ảnh vào mô tả PR. Commit message và PR theo quy ước tiếng Việt không dấu như các PR trước, ví dụ `feat(ui): khung ung dung sidebar nhom theo Chesslang (Giai doan 25a)`.

## 6. Việc sau khi chủ dự án duyệt

- Giao PR 25a cho thành viên triển khai. Trưởng nhóm review, rồi mới giao 25b, và cứ thế lần lượt.
- Mỗi PR merge xong: cập nhật mục 3 của tệp này (✅ và kết quả nghiệm thu) và `rea/ledger.md`.
