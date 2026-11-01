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

| Thành phần        | Chesslang (quan sát)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | erpchess hiện tại                                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Điều hướng        | **Thanh bên trái cố định** (~256 px), nền trắng. Trên cùng có logo và tên học viện (hai dòng), cùng nút thu gọn `‹`. Menu chia nhóm, mỗi nhóm mở/đóng được: **Administration** (gồm Members: Students/Coaches/Groups/Batches; Operations: Leads/Calendar/Invoices/Billing/Plans/Discounts/Reminders/Email/Notifications/Reports; Academy), **Learn** (Classrooms, Quiz, Assignment, Courses, Board, Practice), **Play** (Simul, Game Area, Tournaments), **Content** (Database, Studies). Phần đáy: Chat, Profile, Report a bug, công tắc Light/Dark, Logout. Mục đang mở được tô nền xám nhạt. Bấm vào Administration thì sidebar chuyển sang danh sách con, có nút `‹ ADMINISTRATION` để quay lại. | Thanh trên cùng màu navy (logo, Phân tích, Command Palette, ngôn ngữ, hồ sơ, chuông, đăng xuất) và **hơn 20 tab ngang** dưới tên học viện, nằm trong khung `max-w-5xl`. |
| Thu gọn           | Ở trang Board, sidebar thu thành **thanh icon** (~80 px), chỉ còn icon, giữ nguyên thứ tự nhóm.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Không có.                                                                                                                                                               |
| Nền vùng nội dung | Nền xanh rất nhạt; nội dung nằm trong các **thẻ trắng bo góc lớn** (~16 px), bóng rất nhẹ. Vùng nội dung rộng hết phần còn lại của màn hình.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Nền `#f8f9fc`, nội dung bó trong 1024 px.                                                                                                                               |
| Đầu trang         | **Thẻ đầu trang**: ô icon vuông bo góc nền nhạt, tiêu đề lớn đậm, phụ đề xám một dòng, nút hành động chính ở bên phải (nút màu chính, có thể kèm nút viền phụ như Import/Export/Default config).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Không có thẻ đầu trang, mỗi trang tự đặt `h2`.                                                                                                                          |
| Thẻ số liệu       | Hàng 2–4 thẻ: icon nằm trong ô màu nhạt (mỗi chỉ số một màu: xanh dương, xanh lá, cam, xám), số lớn, nhãn nhỏ. Có hai kiểu: icon nằm trái cạnh số (Quiz, Tournaments), hoặc icon ở trên, nhãn viết hoa, số lớn ở giữa (Dashboard, Game Area, Students).                                                                                                                                                                                                                                                                                                                                                                                                                                              | Có `StatsRow` ở tổng quan, mỗi trang tự làm kiểu riêng.                                                                                                                 |
| Tab               | Hai kiểu. **Gạch chân** có icon và huy hiệu "NEW" (Quiz: Quiz / Automated Quiz / Student View / Leaderboard; Studies: Studies / Collections). **Nút nhóm dạng viên thuốc** (Exercise / Assigned; My / Public / Shared Studies có số đếm; Academy stats / Ongoing sessions; Game Area: Students / Game History / Live Games).                                                                                                                                                                                                                                                                                                                                                                         | Tab tự làm ở từng trang, không thống nhất.                                                                                                                              |
| Thanh lọc         | Một thẻ trắng chứa: ô tìm kiếm có icon kính lúp, ô chọn sắp xếp, cặp ô **Start date / End date** có icon lịch, nút **M/Q/Y** (tháng/quý/năm), chip trạng thái (All / In Progress / Upcoming / Past, chip đang chọn tô màu chính), nút chuyển chế độ xem **danh sách / lưới / lịch**.                                                                                                                                                                                                                                                                                                                                                                                                                 | Có lọc nhưng mỗi trang một kiểu.                                                                                                                                        |
| Trạng thái rỗng   | Căn giữa: icon hoặc hình minh hoạ, tiêu đề đậm, một câu mô tả, nút CTA ("Create your first …"). Bài tập có khung viền nét đứt.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Thường chỉ là một dòng chữ xám.                                                                                                                                         |
| Phân trang        | "Rows/page" (ô chọn 20), các nút ⏮ ‹ › ⏭, ô "Go to".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Ít trang có phân trang.                                                                                                                                                 |
| Dashboard         | Tiêu đề "<Học viện> overview", lời chào. Hàng **Quick actions** gồm 3 thẻ lớn (thẻ đầu tô màu chính). 4 thẻ số (Students kèm thanh tiến độ ghế, Classrooms, Tournaments upcoming/in progress/past, Quiz activity). Tab Academy stats / Ongoing sessions. Weekly stats có chọn khoảng ngày, Previous/Next week, biểu đồ 3 chuỗi (Daily activity, Attendance, Quiz completion). **Cột phải** là thẻ Leaderboard: This week / This month / 6 months, **bục podium** top 3.                                                                                                                                                                                                                              | Có quick actions, stats, biểu đồ tuần, bảng xếp hạng, nhưng xếp dọc trong khung hẹp, không có bục podium.                                                               |
| Học viên          | 3 thẻ ghế (Total / Active / Remaining). Thanh: tìm kiếm, lọc HLV, Sort, công tắc Show inactive, nút **List view / Grid view**. Thẻ học viên dạng lưới: avatar, tên, @username, **hàng 7 nút icon** (sửa, đổi PIN, thành tích, link, đồng bộ, lịch sử, đăng nhập thay), Level, Email, công tắc Active, nút Show more. Nút Add Student có menu thả, kèm Import và Export.                                                                                                                                                                                                                                                                                                                              | Bảng `StudentAdminTable`, không có thẻ ghế, không có chế độ lưới.                                                                                                       |
| Game Area         | 4 thẻ số căn giữa (Games today / as White / as Black / Total), **banner đánh với máy** (nền tối có ảnh, chip cấp độ, tiêu đề lớn, nút Play Computer), cột phải **Online Students** (trạng thái rỗng có icon). Nút Create Pairings ở đầu trang.                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Các khối xếp dọc.                                                                                                                                                       |
| Board             | Hai cột: bàn cờ bên trái, dưới bàn là **thanh công cụ icon** (lật bàn, ghim, tẩy, công cụ vẽ, chụp, gương, điều hướng ⏮‹›⏭, lưới, bot, hoàn tác) và công tắc Move times. Bên phải là panel đầu trang (Masterbase + Save Game), các tab dạng viên thuốc **Masterbase / New Board / AI PDF / My Database / Engine / Analysis**, rồi bảng ván. Chọn một ván thì xổ ra bàn cờ nhỏ ngay trong hàng. Sidebar ở dạng icon.                                                                                                                                                                                                                                                                                  | `/analysis` nằm trong khung hẹp, Masterbase là một panel bên trong.                                                                                                     |
| 404               | Thẻ giữa màn hình: số 404 cách điệu, tiêu đề, câu đùa về cờ, nút Go to Dashboard / Go Back / Refresh, Quick links.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Mặc định của router.                                                                                                                                                    |

## 2. Quyết định thiết kế

1. **Khung ứng dụng mới** thay cho `Shell` cộng tab ngang. Áp dụng cho mọi trang đã đăng nhập: trang học viện `/a/$slug/*` và các trang ngoài học viện như `/analysis`, `/profile`, `/preferences`, `/`, cùng các alias kiểu `/dashboard`. Trang khách (`/login`, `/login/$slug`, `/signup`, `/invite/$token`) giữ bố cục riêng.
2. **Nhóm menu tiếng Việt:** Quản trị, Học tập, Thi đấu, Nội dung. Phân quyền **giữ đúng logic `tabs` hiện có** trong `a.$slug.tsx` (billing ẩn với coach, database ẩn với phụ huynh, notifications chỉ owner, leads theo `leads_enabled`, staff mới thấy calendar/students/levels/locations).
3. **Icon:** thêm `lucide-react` (giấy phép ISC, dùng được). Không dùng bộ icon của Chesslang.
4. **Token:** giữ màu Dương Sinh. Bổ sung `--color-surface`, `--color-border`, `--color-primary-soft` (nền nhạt suy ra từ màu chính bằng `color-mix`), `--color-app-bg` (nền xanh nhạt suy ra từ màu chính), `--radius-card`, cùng bộ biến cho **chế độ tối** (`.dark`). Ưu tiên `color-mix` theo `--color-primary` để màu thương hiệu học viện tự kéo theo nền nhạt.
5. **Không đổi API, DB hay migration.** Toàn giai đoạn là việc giao diện của `apps/web` (desktop Tauri dùng lại bản web). Mobile Expo chỉ chỉnh token màu, việc này để PR cuối.
6. Toàn bộ chữ đi qua i18n vi/en. Không có chữ cứng.

## 3. Chia PR

Mỗi PR nhánh riêng từ `main`, qua đủ cổng kiểm thử ở mục 5, merge xong mới làm PR sau.

### PR 25a: Khung ứng dụng: sidebar nhóm, thu gọn, mobile drawer (✅ ĐÃ HOÀN THÀNH & MERGE #64)

**Nghiệm thu:** lint, typecheck 11/11, test web (30 test mới cho `nav-items`, `AppSidebar`, `useSidebarState`), build, mobile `export:web`, `cargo check`, CI 3/3 xanh. Mục "HLV" và "Thông tin & Branding" tạm ẩn (cùng trỏ `/a/$slug`) cho tới khi 25c tách trang `settings`. Công tắc Sáng/Tối chỉ đặt chỗ (làm ở 25f). Ảnh REA trước/sau chưa chụp được vì tài khoản thử chưa xác nhận email. Job Arasan của CI ghim `ubuntu-24.04` vì `ubuntu-latest` đã sang image thiếu `ld`.
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

### PR 25b: Hệ thành phần giao diện dùng chung (✅ ĐÃ HOÀN THÀNH & MERGE #65)

**Nghiệm thu:** lint, typecheck 11/11, test web 185 (có test cho `Tabs`, `Pagination`, `DateRangeFields` + `PeriodQuickPick`, `EmptyState`, `StatCard`), build, mobile `export:web`, `cargo check`, CI 3/3 xanh. Khác kế hoạch: `PeriodQuickPick` dùng `quickRange` (tháng/quý/năm theo lịch) thay vì `periodRange`; `Tabs` chỉ điều khiển qua `value`/`onChange`; chưa chuẩn hoá `Modal`. Màu nhạt suy ra có thêm quy tắc `[data-brand]` để theo màu thương hiệu học viện.
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

### PR 25c: Áp dụng: Tổng quan và nhóm Quản trị (chia làm 25c-1 và 25c-2)

**25c-1 ✅ ĐÃ HOÀN THÀNH & MERGE #66.** Tổng quan hai cột có bục podium, route `/a/$slug/settings` và `/a/$slug/coaches`, alias `/administration/academy`, nav `branding`/`coaches` trỏ trang riêng. Nghiệm thu: lint, typecheck 11/11, test web 199, build, `export:web`, `cargo check`, CI 3/3.

**Khác Chesslang có chủ đích (25c):**
- **Không có biểu đồ tuần ở Tổng quan:** `WeeklyActivityChart` từng hiện dữ liệu mẫu cố định nên đã gỡ; API chưa có thống kê theo ngày. Xem PR 25g.
- **Không có thẻ ghế (Còn trống):** DB không có giới hạn ghế (đã grep migrations, API, domain), nên trang Học viên chỉ có các thẻ Tổng học viên, Đã phân cấp, Đã xếp nhóm, Nhóm và Batch; không bịa số.
- **Không có công tắc "Hiện học viên nghỉ" và lọc theo HLV ở trang Học viên:** dữ liệu thành viên chưa có cờ hoạt động và chưa có HLV phụ trách từng học viên (HLV gắn với nhóm/Batch).
- **Thẻ Liên hệ (chỉ đọc) giữ ở Tổng quan** để học viên và phụ huynh vẫn xem được.

**25c-2 ✅ ĐÃ HOÀN THÀNH & MERGE #67.** Trang Học viên (PageHeader, thẻ số liệu, FilterBar dùng chung cho bảng và lưới, ViewToggle danh sách/lưới, menu Thêm học viên có Nhập CSV, Xuất), cùng PageHeader và EmptyState cho Batch, Nhóm, Cấp độ, Địa điểm, Lead, Học phí (billing.*), Thông báo. Sửa lỗi cột Lớp của bảng học viên luôn trống do không truyền danh sách thành viên nhóm.
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

### PR 25d: Áp dụng: nhóm Học tập và Nội dung (chia làm 25d-1 và 25d-2)

**25d-1 (Quiz, Bài tập, Học liệu) ✅ ĐÃ HOÀN THÀNH & MERGE #68:**
- **Quiz:** `PageHeader`, 4 `StatCard` số thật (tổng, đang mở, sắp mở, đã đóng), `Tabs` underline Quiz / Quiz tự động (huy hiệu Mới, chỉ staff; chứa `QuizSchedulesPanel` và tạo quiz tự động theo cấp độ), `FilterBar` (tìm, khoảng ngày tạo + T/Q/N, sắp xếp, chip trạng thái), `Pagination`, `EmptyState` có CTA.
- **Bài tập:** `Tabs` pills Đã giao (có số đếm) / Kho bài tập, tìm và sắp xếp, `EmptyState` nét đứt.
- **Học liệu:** `Tabs` underline Học liệu / Bộ sưu tập, pills theo nguồn (Của tôi / Học viện / Thư viện chung) có số đếm, tìm, khoảng ngày + T/Q/N, sắp xếp, `ViewToggle` danh sách/lưới, `Pagination`, nút đầu trang Cấu hình mặc định / Nhập từ Lichess / Tạo học liệu.
- **Khác Chesslang có chủ đích:** chưa có thẻ "% đã bắt đầu", tab "Góc nhìn học viên" và tab "Bảng xếp hạng" của Quiz (chưa có tính năng hay số liệu tổng hợp tương ứng, không bịa); chưa có khối "Bản nháp" của Học liệu (study không có trạng thái nháp); nguồn "Được chia sẻ" của Chesslang ứng với nguồn "Học viện".
  **25d-2 (Khoá học, Lớp học, Luyện tập, CSDL ván, Báo cáo, Chat) ✅ ĐÃ HOÀN THÀNH & MERGE #69:**

- **Khoá học:** `PageHeader`, 2 `StatCard` (tổng khoá; đã xuất bản cho staff, đã hoàn thành cho học viên), `FilterBar` (tìm, chip xuất bản/bản nháp cho staff), `EmptyState`.
- **Lớp học (danh sách):** `PageHeader` có Xuất CSV và Tạo buổi học, 3 `StatCard` (số buổi, trực tuyến, trực tiếp), `Tabs` pills Mọi buổi / Của tôi (staff), `FilterBar` (tìm, `DateRangeFields`, nút khoảng nhanh tuần/tháng có sẵn), `Pagination`, `EmptyState` có CTA.
- **Luyện tập:** `PageHeader` có nút Tạo chương, 2 `StatCard` (số chương, số thế cờ), tìm chương, `EmptyState`.
- **CSDL ván, Báo cáo, Chat:** `PageHeader` (Báo cáo giữ thanh điều khiển cũ ở dưới), `EmptyState` cho danh sách rỗng; trang chi tiết và khung chat không đổi bố cục.
- **Khác Chesslang có chủ đích:** Lớp học chưa có chế độ lưới/lịch; Báo cáo chưa đổi các biểu đồ và phiếu bên trong; không thêm chọn khoảng ngày T/Q/N cho Lớp học vì trang đã có nút tuần/tháng riêng.

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

### PR 25e: Áp dụng: nhóm Thi đấu và Bàn cờ (chia làm 25e-1 và 25e-2)

**25e-1 (Khu thi đấu, Giải đấu, Simul) ✅ ĐÃ HOÀN THÀNH & MERGE #70:**
- **Khu thi đấu:** `PageHeader` (liên kết Simul, Giải đấu; nút **Ghép cặp** cho staff bật/tắt biểu mẫu ghép cặp); 4 `StatCard stacked` theo vai trò, mỗi thẻ có chú thích phạm vi: học viên xem phạm vi "của tôi" (Ván hôm nay của tôi, Cầm Trắng, Cầm Đen, Tổng ván của tôi trong 50 ván kết thúc gần nhất); staff và phụ huynh xem toàn học viện (Ván hôm nay, Đang diễn ra, Đã xong hôm nay, Học viên online); tất cả tính từ dữ liệu đã tải; banner **Đánh với máy** nền gradient màu chính kèm họa tiết ô cờ `.chess-pattern` và hai chip thật (7 mức độ, Elo 800 – 2600+), nút tới `/a/$slug/play/bot`; `QuickPairCard` cạnh banner; `Tabs` pills Học viên (danh sách học viên kèm chấm online) / Lịch sử ván / Ván đang diễn ra; cột phải Học viên online có `EmptyState` và thách đấu nhanh.
- **Giải đấu:** `FilterBar` (tìm, khoảng ngày + T/Q/N, sắp xếp, chip trạng thái), `ViewToggle` danh sách / lưới / bảng / lịch (lịch và bảng là chế độ đã có, thêm chế độ lưới), 4 `StatCard`, `Pagination`, `EmptyState` có CTA.
- **Simul:** cùng mẫu (thẻ số liệu, tìm, khoảng ngày + T/Q/N, chip trạng thái, danh sách/lưới, phân trang, `EmptyState` có CTA).
- **Khác Chesslang có chủ đích:** thẻ Cầm Trắng/Cầm Đen chỉ dành cho học viên (phạm vi "của tôi"), staff xem các thẻ toàn học viện vì không thêm RPC; chip cấp độ của banner là chip thông tin (trang đánh với máy tự có bộ chọn mức Elo); Simul chưa có chế độ lịch.
  **25e-2 (Bàn cờ phân tích) ✅ ĐÃ HOÀN THÀNH & MERGE #71:**

- **Bố cục 2 cột toàn chiều rộng:** bàn cờ bên trái (không vượt chiều cao màn hình để thanh công cụ luôn trong tầm nhìn), panel phải rộng 360–440 px.
- **Thanh công cụ icon dưới bàn** (`role="toolbar"`, mỗi nút có nhãn truy cập và tooltip): về đầu, lùi, tới, về cuối, lật bàn, xoá nét vẽ (khoá khi chưa có nét vẽ), bật/tắt engine. Phím tắt ← → ↑ ↓ và F giữ nguyên; trạng thái ván (chiếu hết, hoà) hiện cuối thanh.
- **Panel phải:** `PageHeader` kiểu gọn (`compact`) và `Tabs` pills **Phân tích** (danh sách nước, chú thích, đưa lên nhánh chính, xoá) / **Engine** / **Masterbase** (chỉ khi đã đăng nhập, chỉ nạp khi chọn tab). Engine vẫn chạy khi chuyển tab để thanh đánh giá cạnh bàn không đứng. Ô dán FEN/PGN và nút sao chép nằm dưới tab, luôn hiện; mở PGN thành công thì quay về tab Phân tích.
- **Khác Chesslang có chủ đích:** không có tab "AI PDF" (theo kế hoạch); chưa có tab "Bàn mới" riêng vì việc tạo ván mới chính là ô dán FEN/PGN luôn hiện; chưa có tab "CSDL của tôi" và nút "Lưu ván" vì trang phân tích chưa có tính năng lưu ván vào CSDL (cần tính năng mới, không phải việc giao diện).

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

**Đã làm trong PR 25f (đối chiếu bằng ảnh để bước riêng):**
- **Chế độ tối chạy thật:** `lib/theme.ts` (`useTheme`): mặc định theo `prefers-color-scheme` (tự đổi khi hệ thống đổi), bấm công tắc thì lưu `localStorage` (`erpchess.theme`), theo dõi đổi từ tab khác; gắn class `.dark` và `color-scheme` lên `<html>`. Script nhỏ trong `index.html` gắn `.dark` trước khi vẽ nên không nháy. Công tắc Sáng/Tối ở đáy sidebar (`role="switch"`) và ở thanh đầu trang khách. `@custom-variant dark` làm các lớp `dark:` có sẵn của Tailwind theo class `.dark` thay vì theo hệ điều hành.
- **Rà màu cứng:** `bg-white` đổi sang `bg-surface` và các `text/border/divide/ring-gray-*`, `bg-gray-50/100` đổi sang token ở khoảng 70 tệp (layout, `components/ui`, các trang 25a–25e). Giữ nguyên có chủ đích: tệp in (hoá đơn, chứng chỉ, phiếu báo cáo, vẫn nền trắng như giấy), `text-white` và lớp phủ `bg-white/xx` trên nền màu, màu ngữ nghĩa (xanh/vàng/đỏ nhạt), khối slate đã có cặp `dark:`. Bàn cờ giữ theme bàn cờ riêng. `--color-white` không còn bị đổi trong `.dark` (chữ trắng trên nền màu giữ nguyên).
- **Chữ màu chính trong chế độ tối:** chữ `text-primary` (navy) gần như không đọc được trên nền tối (phát hiện khi chụp thử trang đăng nhập và 404), nên trong `.dark` chữ này được trộn 40% với trắng, tính ngay tại phần tử nên màu thương hiệu học viện cũng được làm sáng theo. Ảnh chụp thật hai trang khách ở chế độ tối nằm ở `rea/evidence/ui-2026-11-01/25f-khach-toi/`.
- **Trang 404:** `notFoundComponent` của router gốc (`components/NotFound.tsx`): số 404 cách điệu bằng họa tiết ô cờ, nút Về tổng quan (hoặc Về trang chủ khi chưa có học viện) / Quay lại / Tải lại, liên kết nhanh Bàn cờ, Luyện tập, Học liệu, Giải đấu theo học viện gần nhất (`useCurrentAcademy`, tách từ `AppLayout`).
- **Mobile Expo:** thêm `nativeColors` / `darkNativeColors` (bản hex của `primary-soft`, `app-bg`, tính trong oklab giống `color-mix`, có test đối chiếu); màn hình gốc, trang chủ và nền các màn dùng `app-bg`. Không đổi điều hướng.
- **Kịch bản REA:** `make-scenarios.py` sinh 4 kịch bản (desktop/mobile x sáng/tối, 26 trang gồm cả 404, mobile có ảnh drawer) cho các trang 25a–25f. Chưa chạy được vì tài khoản thử chưa xác nhận email; không lách. Việc chụp, tệp `so-sanh.md` và ghi các chỗ còn khác Chesslang là bước riêng sau khi tài khoản dùng được.
- **Nghiệm thu REA (2026-11-01):** đã chạy 4 kịch bản trên bản build `main` sau #74 với tài khoản thử; kết quả và đối chiếu từng trang ở `rea/evidence/ui-2026-11-01/so-sanh.md`. Phát hiện và sửa 4 lỗi giao diện (nút tìm kiếm vô hình ở thanh trên, mục đang chọn không đọc được ở chế độ tối, đáy sidebar quá cao làm cắt menu, logo bị nút thu gọn đè khi thu gọn). Còn lại: kiểm bằng dữ liệu thật/dữ liệu mẫu (học viện thử đang trống).
- **Nghiệm thu có dữ liệu (2026-11-01, lần hai):** `scripts/seed-ui-demo.mjs` nạp dữ liệu mẫu vào học viện thử (8 học viên, batch/nhóm, cấp độ, 2 quiz, giải, simul, bài tập) rồi chụp lại các trang chính (desktop sáng/tối, mobile sáng). Tìm và sửa thêm 7 lỗi: trang Batch lẫn nhóm thường và dùng emoji/chữ cứng, huy hiệu cấp độ và chip lớp dùng emoji và chói ở chế độ tối, tiêu đề biểu đồ có emoji, tab mobile xuống dòng, nút VI/EN tối khó phân biệt, thẻ lượt làm bài lệch biểu đồ; `supabase/.temp/` vào `.gitignore`. Chi tiết và lỗi lớn còn lại (sửa `academy_stats` cần migration): `rea/evidence/ui-2026-11-01/so-sanh.md` mục 6–8.
- **Dọn mục nhỏ GĐ25 (2026-11-01, lần ba):** `LevelBadge` qua i18n; thẻ học viên lưới chỉ hiện một huy hiệu, bấm mới mở ô chọn cấp độ; seed bổ sung ván đấu (2 xong, 2 đang diễn ra) và điểm danh; chụp lại desktop sáng/tối và mobile sáng/tối. Sửa thêm 3 lỗi mobile (thanh trên đè nội dung, tab viên thuốc xuống dòng, thẻ số liệu Lớp học tràn). Chi tiết: `so-sanh.md` mục 9. Không migration.
- **Sửa lưới cố định trên điện thoại (2026-11-01, lần bốn):** thẻ Giảm giá tràn ngang do lưới `grid` thiếu cột mobile tường minh — thêm `grid-cols-1` cho 36 chỗ cùng kiểu, thẻ số liệu Giảm giá/ô điều kiện Cấp độ thành `sm:grid-cols-3`, `PageHeader` cho nút hành động xuống dòng khi hẹp, trang Nhóm không xuống dòng nhãn/nút. Seed thêm mã giảm giá. Ảnh trước/sau ở `rea/evidence/ui-2026-11-01/mobile-fix/`; chi tiết `so-sanh.md` mục 10. Không migration.

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

### PR 25g (sau): RPC thống kê theo ngày và biểu đồ tuần

- **Việc:** thêm RPC thống kê theo ngày (bài làm, điểm danh, hoàn thành quiz), nối lại biểu đồ tuần ở Tổng quan kèm `DateRangeFields`, nút Tuần trước/Tuần sau và hàng Hoạt động quiz.
- **Bổ sung từ 25d-1:** thẻ "% quiz đã bắt đầu" ở trang Quiz và tab "Bảng xếp hạng quiz toàn học viện" (hiện chỉ có bảng xếp hạng từng quiz trong trang chi tiết) cần số liệu tổng hợp phía server; làm cùng đợt RPC này.
- **Bổ sung từ 25e-2 — PR 25g-3 (không cần migration, đã làm):** **Lưu ván từ bàn phân tích vào CSDL của tôi**. Tab "CSDL của tôi" và nút "Lưu ván" ở đầu panel phải của trang phân tích, chỉ hiện cho nhân sự (owner/coach) của học viện gần nhất, vì RLS chỉ cho nhân sự tạo CSDL (học viên chỉ tạo được CSDL đồng bộ). Chọn một CSDL riêng tư của chính mình (bỏ CSDL đồng bộ Lichess/Chess.com và CSDL chia sẻ), hoặc tạo CSDL riêng tư mới (tên điền sẵn, sửa được); lưu cả ván lẫn các biến bằng `importPgn` có sẵn; PGN nhập 0 ván thì báo lỗi; thành công thì có liên kết tới trang CSDL ván. Không đổi API, DB hay RPC.
- **PR 25g-1/2 (cần migration; đã áp lên erpchess-dev, pgTAP 30 đạt 21/21):** migration `20261101000038_stats_quiz_board.sql`, chỉ **thêm** ba hàm đọc, không đổi bảng, không `drop`/`delete`/`update`:
  - `academy_daily_stats(p_academy uuid, p_from date, p_to date, p_tz text default 'Asia/Ho_Chi_Minh')`: mỗi ngày một dòng gồm `attempts` (bài tập + quiz + hoạt động study của học viện, đã kết thúc), `attendance_present` / `attendance_total` (có mặt + trễ trên tổng không tính có phép, theo ngày bắt đầu buổi), `quiz_completions` (cặp quiz và học viên làm xong đủ mọi câu, theo ngày nộp câu cuối). Chỉ owner/coach nhận dữ liệu (người khác nhận tập rỗng); khoảng ngày tối đa 93 ngày; ngày sai thứ tự hoặc múi giờ không tồn tại thì lỗi `22023`.
  - `academy_quiz_leaderboard(p_academy uuid, p_from timestamptz, p_to timestamptz)`: điểm quiz toàn học viện (`points` đã trừ phạt, `correct`, `completed`), mọi học viên của học viện, mọi thành viên xem được; người ngoài học viện nhận tập rỗng.
  - `academy_quiz_started(p_academy uuid)`: `total_quizzes`, `open_quizzes` (đã tới giờ mở và chưa quá hạn), `started_quizzes` (đang giao và đã có dòng bài làm). Chỉ owner/coach.
  - Cả ba là `security definer`, `search_path` rỗng, tự kiểm quyền bằng `auth.uid()`, đã `revoke` quyền của `public` và `anon`, `grant` cho `authenticated`.
  - **Kiểm chứng:** logic và số liệu đã chạy đúng trên PGlite (Postgres WASM) với bảng giả tối thiểu (23 ca: múi giờ, ngày biên, có phép, quiz làm dở, study chung không tính, quyền theo vai trò, các lỗi `22023`); `supabase/tests/30_stats_quiz_board.sql` (21 ca pgTAP) đã chạy trên erpchess-dev sau khi chủ dự án áp migration: **21/21 đạt**, advisor không có cảnh báo mới. Chạy lại: `node supabase/tests/to-mcp.mjs supabase/tests/30_stats_quiz_board.sql` rồi chạy qua `execute_sql`.
  - **Hoàn tác (nếu cần):** `drop function public.academy_daily_stats(uuid, date, date, text), public.academy_quiz_leaderboard(uuid, timestamptz, timestamptz), public.academy_quiz_started(uuid);` (hàm mới, không có dữ liệu phụ thuộc).
  - **Phía web:** `@erpchess/api` (`stats.ts`, hook `useDailyStats`, `useAcademyQuizBoard`, `useQuizStarted`); Tổng quan có `WeeklyStatsPanel` (ba chuỗi Hoạt động / Điểm danh / Quiz hoàn thành, chọn khoảng ngày tối đa 31 ngày, Tuần trước/Tuần sau, xu hướng so với kỳ trước, ẩn khi kỳ trước bằng 0); `WeeklyActivityChart` bỏ hẳn dữ liệu mẫu; trang Quiz có thẻ "Đã bắt đầu" (nhân sự, hiện "—" khi không có quiz đang giao) và tab "Bảng xếp hạng" (mọi vai trò, bục podium). Nếu migration chưa được áp, các lệnh gọi RPC lỗi và giao diện hiện thông báo lỗi trong khung tương ứng, phần còn lại của trang vẫn dùng được.
- **Lưu ý:** có migration nên cần chủ dự án duyệt rồi áp lên Supabase cloud (CI không tự áp). Khi nối lại, `WeeklyActivityChart` phải nhận dữ liệu thật và bỏ dữ liệu mẫu mặc định.

## 4. Rủi ro và cách xử lý

| Rủi ro                                                                            | Cách xử lý                                                                                                                                                                              |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đổi khung làm vỡ nhiều test web: 76+ test đang dựa vào text hoặc vai trò của tab. | PR 25a chỉ đổi khung và sửa test liên quan. Các PR sau đổi từng nhóm trang, chạy `pnpm --filter @erpchess/web test` sau mỗi nhóm.                                                       |
| Màu thương hiệu học viện quá sáng hoặc quá tối làm nền nhạt xấu.                  | Nền nhạt tính bằng `color-mix(in oklab, var(--color-primary) 6%, white)`, chữ trên nền màu chính dùng `--color-text-on-primary` (đã có `brandColorVars`).                               |
| Trang ngoài học viện (`/analysis`, `/profile`) không có học viện hiện tại.        | Sidebar dùng học viện gần nhất (`useMyAcademies`, lưu slug cuối vào `localStorage`). Không có học viện nào thì chỉ hiện Bàn cờ, Hồ sơ, Tạo học viện.                                    |
| Phạm vi lớn (72 route).                                                           | Thứ tự ưu tiên: khung → thành phần → trang hay dùng nhất. Trang chi tiết ít dùng chỉ thêm `PageHeader`. Ghi những trang chưa đổi vào mục "Chưa làm" của từng PR, không để dở dang ngầm. |
| Lỡ chép tài sản của Chesslang.                                                    | Không tải ảnh, CSS hay SVG từ Chesslang. Hình minh hoạ dùng icon lucide, emoji hệ thống hoặc họa tiết ô cờ của Dương Sinh. Reviewer kiểm tra mục này trong từng PR.                     |

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
