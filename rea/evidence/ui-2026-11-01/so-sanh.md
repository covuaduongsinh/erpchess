# Đối chiếu giao diện erpchess với Chesslang (nghiệm thu Giai đoạn 25)

**Ngày chụp:** 2026-11-01. **Bản build:** `main` tại `7ae5477` (sau PR 25a–25g), cộng các sửa của PR này, chạy bằng `vite preview` cục bộ, đăng nhập tài khoản thử `erpchess-dev` (học viện `thu-nghiem-ui`, vai chủ học viện). **Công cụ:** REA `capture-browser-scenario` (Chrome headless), bốn kịch bản sinh từ `make-scenarios.py`.

- Ảnh erpchess: `25f/<biến thể>/shot_*.png`, bốn biến thể `desktop-light`, `desktop-dark` (1440×900), `mobile-light`, `mobile-dark` (390×844, có thêm `shot_drawer.png`), mỗi biến thể 26 ảnh.
- Ảnh Chesslang (đã quan sát trước): `shot_p_*.png` cùng thư mục.
- **Phạm vi thực sự đã xem bằng mắt:** Tổng quan, Học viên, Quiz, Giải đấu, Khu thi đấu, Bàn cờ, Thiết lập, Học phí, 404 (desktop sáng và/hoặc tối), Tổng quan và drawer (mobile). Các trang còn lại đã được chụp đủ nhưng chưa xem từng ảnh; học liệu so sánh trực tiếp chỉ có ở các trang có ảnh Chesslang.
- **Dữ liệu:** học viện thử gần như trống (0 học viên, 0 quiz, 0 giải), nên đối chiếu này chủ yếu về **bố cục, điều hướng và trạng thái rỗng**, chưa kiểm cách hiển thị khi có nhiều dữ liệu (bục podium có người, biểu đồ có cột, danh sách dài, phân trang).

## 1. Lỗi tìm thấy khi chụp và đã sửa trong PR này

| # | Lỗi (thấy trong ảnh) | Nguyên nhân | Sửa |
| --- | --- | --- | --- |
| 1 | Nút "Tìm kiếm… Ctrl K" ở thanh trên gần như vô hình trên mọi trang (sáng) | Nút `CommandPalette` được viết cho thanh trên màu navy (chữ trắng, nền trắng 10%), nhưng từ 25a thanh trên trong suốt | Đổi sang viền + nền `surface`, chữ `text-muted` |
| 2 | Mục menu đang mở, tab gạch chân đang chọn và nút ngôn ngữ đang chọn **không đọc được ở chế độ tối** (chữ navy trên nền tối) | Quy tắc làm sáng chữ `text-primary` ở 25f chỉ phủ lớp gốc, không phủ các biến thể `data-[active=true]:`, `aria-pressed:`, `aria-selected:`, `group-hover:` | Mở rộng quy tắc `.dark` cho đủ bốn biến thể đang dùng; test token kiểm từng biến thể |
| 3 | Đáy sidebar chiếm quá nhiều chỗ nên trên màn 900 px menu bị cắt (không thấy "Học liệu" ở nhóm Nội dung, "Địa điểm"/"Chứng chỉ" ở Quản trị) | Mỗi mục đáy (Chế độ tối, VI/EN, Đăng xuất) một dòng riêng | Gom thành một hàng công cụ (chế độ tối · VI EN · đăng xuất), tiết kiệm khoảng 110 px; vẫn có nhãn truy cập và tooltip |
| 4 | Khi sidebar thu gọn thành thanh icon, logo học viện bị nút thu gọn đè lên | Hai phần tử xếp ngang trong thanh rộng 80 px | Xếp dọc khi thu gọn |

Sau sửa đã chụp lại cả bốn biến thể (ảnh trong thư mục này là bản sau sửa).

## 2. Đối chiếu từng trang có ảnh Chesslang

| Trang | Chesslang | erpchess | Đánh giá |
| --- | --- | --- | --- |
| Tổng quan | Tiêu đề lớn + lời chào; 3 thẻ Quick actions (thẻ đầu tô màu); 4 thẻ số liệu có biểu tượng trên, nhãn hoa, số lớn; tab Academy stats / Ongoing sessions; Weekly stats có Start/End date + Previous/Next week; biểu đồ 3 chuỗi; cột phải Leaderboard có bục podium | Cùng bố cục: thẻ tiêu đề, 3 Thao tác nhanh (thẻ đầu tô màu chính), 4 thẻ stacked, tab pills, Thống kê theo ngày (3 chuỗi, ô ngày, nút ‹ ›), cột phải Bảng xếp hạng + podium | **Khớp.** Khác có chủ đích: thẻ Học viên không có thanh ghế (DB không có giới hạn ghế); biểu đồ erpchess là cột đơn chuỗi chuyển tab, không vẽ đồng thời 3 chuỗi và trục tỉ lệ phải; podium tự vẽ, không ảnh |
| Quiz | Thẻ Automated Quiz (NEW) và Started %; tab Quiz / Automated Quiz / Student View / Leaderboard; thanh lọc có Start/End date + M/Q/Y; "Rows/page", Go to ở đầu danh sách; trạng thái rỗng có hình | Thẻ Tổng/Đang mở/Sắp mở/Đã đóng + **Đã bắt đầu** ("—" khi không có quiz đang giao); tab Quiz / Quiz tự động (Mới) / Bảng xếp hạng; lọc tìm + Từ/Đến ngày + T Q N + sắp xếp + chip trạng thái; phân trang ở cuối; trạng thái rỗng có icon và nút | **Khớp về cấu trúc.** Còn khác: không có tab Student View (chưa có tính năng); thẻ "Quiz tự động" của Chesslang đếm lịch tự động, erpchess chưa có thẻ riêng (huy hiệu Mới nằm ở tab); phân trang ở cuối thay vì đầu |
| Khu thi đấu | Tab phân đoạn toàn chiều rộng (Students / Game History / Live Games); 4 thẻ (Games today / as White / as Black / Total); banner tối có ảnh bàn cờ + chip cấp độ + nút Play Computer; cột phải Online Students có trạng thái rỗng | Tab pills dưới banner; 4 thẻ **theo vai trò** (staff: hôm nay / đang diễn ra / đã xong / online; học viên: của tôi / Trắng / Đen / tổng); banner gradient màu chính + họa tiết ô cờ + chip thông tin + nút Đánh với máy; QuickPairCard cạnh banner; cột phải Học viên online | **Khớp về bố cục.** Khác có chủ đích: không dùng ảnh Chesslang; thẻ Trắng/Đen chỉ cho học viên (không có RPC đếm theo màu cả học viện); Ghép cặp là nút bật/tắt biểu mẫu thay vì modal |
| Học viên | 3 thẻ ghế; thanh tìm + lọc HLV + sắp xếp + công tắc "Show inactive" + List/Grid; thẻ học viên có hàng 7 nút icon | 4 thẻ (Tổng, Đã phân cấp, Đã xếp nhóm, Nhóm và Batch); thanh tìm + lớp + cấp độ + sắp xếp + chuyển danh sách/lưới; menu Thêm học viên | **Khớp về cấu trúc.** Khác có chủ đích: không thẻ "Còn trống", không công tắc học viên nghỉ và lọc HLV (không có dữ liệu); hàng icon thao tác dùng các thao tác sẵn có (mời phụ huynh, đổi cấp độ, Elo) |
| Bàn cờ | Hai cột: bàn cờ + thanh công cụ icon dưới bàn; phải là panel đầu trang + tab (Masterbase / New Board / AI PDF / My Database / Engine / Analysis); sidebar thu thành icon | Hai cột toàn chiều rộng; thanh công cụ icon (về đầu, lùi, tới, về cuối, lật, xoá nét vẽ, engine); phải: đầu trang gọn + nút Lưu ván + tab Phân tích / Engine / Masterbase / CSDL của tôi; sidebar tự thu gọn | **Khớp.** Khác có chủ đích: không AI PDF; không tab "Bàn mới" riêng (ô dán FEN/PGN luôn hiện) |
| 404 | Thẻ giữa màn hình, số 404 cách điệu, tiêu đề, câu đùa, nút Go to Dashboard / Go Back / Refresh, Quick links | Thẻ giữa màn hình, 404 trên họa tiết ô cờ, tiêu đề, mô tả, Về tổng quan / Quay lại / Tải lại, liên kết nhanh (Bàn cờ, Luyện tập, Học liệu, Giải đấu) | **Khớp**; câu chữ và họa tiết tự thiết kế |
| Khung ứng dụng | Sidebar 256 px có nhóm Administration / Learn / Play / Content, đáy Chat, Profile, Report a bug, công tắc Light/Dark, Logout | Sidebar 256 px nhóm Quản trị (danh sách con) / Học tập / Thi đấu / Nội dung, đáy Chat, Hồ sơ, hàng công cụ (tối/sáng, VI/EN, đăng xuất); thu gọn thành thanh icon; drawer < lg | **Khớp.** Không có "Report a bug" (ngoài phạm vi); thêm chọn ngôn ngữ vì erpchess song ngữ |

## 3. Chế độ tối

- Chesslang trong các ảnh quan sát chỉ có chế độ sáng ("Light Mode" kèm công tắc), nên không có ảnh tối để đối chiếu; ảnh tối của erpchess được kiểm theo tiêu chí tự thân: chữ đọc được, nền bề mặt phân biệt được với nền trang, bàn cờ giữ theme riêng.
- Đã xem: Tổng quan, Học viên, Quiz, Thiết lập, Học phí, Bàn cờ (desktop tối) và drawer (mobile tối). Sau sửa lỗi 2, chữ nhấn và mục đang chọn đọc được ở các trang này.
- Chưa xem từng ảnh tối của các trang còn lại; rủi ro còn lại là các khối giữ màu riêng (slate có cặp `dark:`, phòng học, quiz toàn màn hình) và các trang chi tiết không nằm trong kịch bản.

## 4. Còn khác Chesslang, để sau hoặc có chủ đích

- Biểu đồ Tổng quan: một chuỗi mỗi lần (chuyển tab), chưa vẽ đồng thời 3 chuỗi với trục tỉ lệ phải. Để sau nếu chủ dự án muốn.
- Quiz: chưa có "Góc nhìn học viên" (tính năng mới); phân trang ở cuối danh sách.
- Học viên: chưa có thẻ ghế, công tắc học viên nghỉ, lọc HLV (không có dữ liệu trong DB).
- Lớp học, Simul: chưa có chế độ lịch/lưới (không để nút chết).
- Cách hiển thị với dữ liệu thật (nhiều học viên, quiz, giải; podium có người; biểu đồ có cột) **chưa được kiểm bằng ảnh** vì học viện thử trống. Cần nạp dữ liệu mẫu (không dùng dữ liệu thật của học viện khác) rồi chụp lại các trang Tổng quan, Học viên, Quiz, Giải đấu để nghiệm thu nốt.
- Ô chọn ngày hiện `mm/dd/yyyy` trong ảnh vì Chrome headless dùng định dạng ngày của hệ điều hành, không phải lỗi ứng dụng.

## 5. Chạy lại

```bash
pnpm --filter @erpchess/web build && pnpm --filter @erpchess/web preview --port 4173
python rea/evidence/ui-2026-11-01/make-scenarios.py thu-nghiem-ui
set -a; . ./.env.test-account; set +a
node D:/code/rea/scripts/rea.mjs capture-browser-scenario rea/evidence/ui-2026-11-01/scenario-erpchess-desktop-light.json --format json > rea/evidence/ui-2026-11-01/25f/desktop-light/capture.json
python rea/evidence/ui-2026-11-01/extract-shots.py rea/evidence/ui-2026-11-01/25f/desktop-light/capture.json rea/evidence/ui-2026-11-01/25f/desktop-light
```

Ghi chú vận hành: một lần chạy `desktop-dark` bị REA báo `cleanup_incomplete` (hết hạn 30 giây khi dọn dẹp trình duyệt); chạy lại ngay thì đạt. `capture.json` (nặng) bị `.gitignore`.

## 6. Nghiệm thu có dữ liệu mẫu (2026-11-01, lần hai)

**Dữ liệu:** `scripts/seed-ui-demo.mjs` (idempotent, chỉ ghi vào học viện `thu-nghiem-ui` bằng tài khoản thử qua RLS, không DELETE, không khoá admin) nạp: 8 học viên (có tên rất dài để thử tràn chữ), 2 batch + 1 nhóm, 2 cấp độ đã xếp cho cả 8 học viên, 2 quiz (1 đang mở có 5 học viên làm bài, 1 đã đóng — quá hạn nên máy chủ không nhận bài), 1 giải Swiss sắp tới, 1 simul sắp tới, 2 buổi học, 1 bài tập giao cho nhóm và batch. Mọi nội dung tự soạn.

**Ảnh:** `data/{desktop-light,desktop-dark,mobile-light}/shot_*.png` — tổng quan, học viên (danh sách + lưới), batch, quiz, quiz bảng xếp hạng, giải đấu, khu thi đấu, bài tập, simul. Sinh bằng `python make-scenarios.py --data`. Đã xem từng ảnh desktop sáng; desktop tối: Tổng quan, Quiz, Học viên; mobile sáng: Tổng quan, Học viên (lưới), Quiz bảng xếp hạng.

| Trang | Khi có dữ liệu | Kết quả |
| --- | --- | --- |
| Tổng quan | Podium có 3 người + hàng thứ 4; thẻ số 8 học viên / 1 giải; biểu đồ có cột | Khớp. Tên dài bị cắt "…" ở podium (chấp nhận được) |
| Học viên (lưới, bảng) | 8 thẻ/hàng, tên 31 ký tự bị cắt "…" trong lưới, hiện đủ trong bảng; thẻ "Đã phân cấp" 8/8 | Khớp |
| Batch | 2 batch có HLV, sĩ số, hình thức | Đã sửa (mục 7) |
| Quiz + Bảng xếp hạng | Thẻ 2 / 1 đang mở / 1 đóng / 100% đã bắt đầu; danh sách 2 quiz; podium + xếp hạng điểm | Khớp |
| Giải đấu, Simul | 1 dòng mỗi trang, phân trang "1–1 / 1" | Khớp |
| Khu thi đấu | Danh sách 8 học viên (ngoại tuyến), 0 ván | Khớp |

## 7. Lỗi tìm thấy khi có dữ liệu và đã sửa

| # | Lỗi (thấy trong ảnh) | Sửa |
| --- | --- | --- |
| 5 | Trang Batch liệt kê cả **nhóm thường** (hiện 3 thẻ thay vì 2); batch tạo từ trang này lại thành nhóm thường | Lọc `kind = 'batch'`; khi tạo gán `kind: 'batch'` |
| 6 | Trang Batch dùng emoji màu (👨‍🏫 👥 📍 📅) và chữ cứng tiếng Việt ("Huấn luyện viên", "Quản lý học viên", "Xem lịch lớp") | Icon lucide + khoá i18n vi/en |
| 7 | Huy hiệu cấp độ và chip lớp trong bảng học viên dùng emoji, nền sáng chói trong chế độ tối | Icon `Award`/`Users`, màu theo token và biến thể `dark:` |
| 8 | Tiêu đề biểu đồ Tổng quan có emoji (📊 🧑‍🏫 🏁) | Bỏ emoji |
| 9 | Mobile: tab Quiz xuống dòng 2–3 chữ mỗi tab ("Bảng xếp hạng" thành 3 dòng) | `Tabs` không xuống dòng, cuộn ngang khi hẹp |
| 10 | Chế độ tối: nút VI/EN đang chọn gần như không khác nút không chọn | Nút đang chọn nền `primary` đặc, chữ `text-on-primary` |
| 11 | Thẻ "Lượt làm bài 7 ngày" (0) lệch biểu đồ ngay dưới (5 lượt) | Đổi nhãn thành "Bài tập đã làm 7 ngày" cho đúng nghĩa (RPC chỉ đếm bài tập) |

## 8. Lỗi lớn còn lại (cần quyết định/migration, chưa sửa)

- **Thẻ "Bài tập đã làm 7 ngày"** chỉ đếm bài tập; muốn gồm cả quiz và hoạt động học liệu như biểu đồ thì phải sửa RPC `academy_stats` (cần migration, chủ dự án áp).
- **Quiz đã đóng chưa có lượt làm** vì máy chủ từ chối bài nộp quá hạn; muốn ảnh quiz đóng có điểm phải tạo quiz đang mở, cho làm rồi đợi hết hạn.
- `LevelBadge` còn chuỗi cứng "Chưa phân cấp" / "Cấp độ: …" (chưa qua i18n).
- Chưa có dữ liệu cho ván đấu, ván đang diễn ra, học viên online, điểm danh (cần phiên đăng nhập học viên đồng thời).
- Ảnh tối chỉ xem 3 trang; mobile tối chưa chụp lần này.

Chạy lại: `node scripts/seed-ui-demo.mjs`, rồi `python rea/evidence/ui-2026-11-01/make-scenarios.py --data` và chụp như mục 5 với tên kịch bản `scenario-erpchess-data-<biến thể>.json`, thư mục `data/<biến thể>`.

## 9. Dọn mục nhỏ còn lại của GĐ25 (2026-11-01, lần ba)

**Dữ liệu bổ sung** (`scripts/seed-ui-demo.mjs`, vẫn idempotent, chỉ học viện thử, tài khoản học viên mẫu đăng nhập thật, qua RPC `create_challenge` và Edge Function `game-move`, không lách quyền): 4 ván đấu (1 ván chiếu hết, 1 ván đầu hàng — cả hai đã xong — và 2 ván còn mở), điểm danh cho 2 buổi học đã diễn ra (có mặt, muộn, vắng, có phép), thêm buổi học ba hôm trước.

**Ảnh:** `data/{desktop-light,desktop-dark,mobile-light,mobile-dark}/shot_*.png`, thêm `shot_khu_thi_dau_lich_su`, `shot_khu_thi_dau_dang_dau`, `shot_lop_hoc`, `shot_lop_hoc_quy` (khoảng Quý để thấy buổi đã qua), `shot_tong_quan_diem_danh` (biểu đồ Điểm danh). Mobile tối nay đã chụp đủ.

| Trang | Khi có dữ liệu | Kết quả |
| --- | --- | --- |
| Khu thi đấu | 4 ván hôm nay, 2 đang diễn ra, 2 đã xong; Lịch sử ván ghi "Trắng thắng · đầu hàng", "Đen thắng · chiếu hết"; Ván đang diễn ra liệt kê 2 ván | Khớp |
| Lớp học (Quý) | 3 buổi: "Có mặt 4 · Vắng 1" cho hai buổi đã qua, "Có mặt 0 · Vắng 0" cho buổi chưa tới | Khớp |
| Tổng quan, biểu đồ Điểm danh | Tiêu đề "Lượt có mặt theo ngày", 8 lượt (không tính có phép) | Khớp |
| Mobile tối | Tổng quan, Học viên, Quiz/Bảng xếp hạng, Khu thi đấu, Lớp học đều đọc được; podium, thẻ số liệu và badge giữ tương phản | Khớp |

### Đã sửa

| # | Việc/lỗi | Sửa |
| --- | --- | --- |
| 12 | `LevelBadge` còn chuỗi cứng ("Chưa phân cấp", tooltip "Cấp độ: …") | Khoá i18n `studentsPage.levelBadgeNone/levelBadgeTitle` (vi/en) + test hai ngôn ngữ |
| 13 | Thẻ học viên dạng lưới hiện cấp độ hai lần (huy hiệu và ô chọn) | Chỉ hiện huy hiệu kèm biểu tượng bút; bấm vào mới mở ô chọn, chọn xong quay lại huy hiệu; giữ nguyên thao tác đổi cấp độ + test |
| 14 | Mobile: thanh trên trong suốt đè lên nội dung khi cuộn (nút menu chồng lên banner) | Nền `bg/85` + `backdrop-blur` |
| 15 | Mobile: tab dạng viên thuốc xuống hai dòng, khung bo tròn méo | Tab một hàng, cuộn ngang khi hẹp |
| 16 | Mobile: Lớp học, ba thẻ số liệu tràn ngang, chữ bị cắt ("Trực tiếp") | Một cột trên màn hẹp, ba cột từ `sm` |

### Còn lại

- Sửa `academy_stats` để thẻ 7 ngày gồm quiz/học liệu (cần migration, chủ dự án quyết định).
- Học viên online và buổi học đang diễn ra cần phiên đồng thời nên chưa có ảnh.
- Quiz đã đóng chưa có lượt làm (máy chủ từ chối bài quá hạn).
- Trang `billing/discounts`, `levels`, `play` còn `grid-cols-3` cố định; chưa kiểm trên mobile.

## 10. Sửa lưới cố định trên điện thoại (2026-11-01, lần bốn)

**Ảnh trước/sau:** `mobile-fix/truoc/mobile-light/` (bản trước sửa: Giảm giá, Cấp độ) và `mobile-fix/sau/{mobile-light,mobile-dark}/` (10 trang: Giảm giá, Cấp độ, Cấp độ đang sửa, Gói học phí, Lịch, Địa điểm, Lead, Thiết lập, Nhóm, Chơi cờ). Seed thêm 3 mã giảm giá (phần trăm, số tiền cố định, đã tắt) trong học viện thử.

| # | Lỗi (thấy trong ảnh mobile) | Sửa |
| --- | --- | --- |
| 17 | Giảm giá: thẻ danh sách **tràn ngang** khỏi màn hình (chữ ở mép phải bị cắt) và 3 thẻ số liệu chật | Cột đơn `grid-cols-1` (cột ngầm của `grid` không có mẫu cột nở theo nội dung); thẻ số liệu 1 cột, `sm:` 3 cột |
| 18 | Cùng nguyên nhân (lưới `grid gap-6 lg:grid-cols-[…]` không có cột mobile tường minh) ở **36 chỗ** khác: hoá đơn, gói học phí, lịch, lead, nhóm, địa điểm, thiết lập, quiz, giải đấu, học liệu, bài tập, CSDL, chat… | Thêm `grid-cols-1` cho cả 36 chỗ (không đổi gì từ `lg` trở lên) |
| 19 | Cấp độ (form sửa): 3 ô số điều kiện lên cấp xếp 3 cột trên màn hẹp | `grid-cols-1 sm:grid-cols-3` |
| 20 | Địa điểm: tiêu đề bị cắt thành "Địa…", phụ đề 6 dòng vì nút hành động chiếm chỗ | `PageHeader`: khối tiêu đề rộng tối thiểu 12rem nên nút hành động xuống dòng riêng khi hẹp (áp dụng mọi trang dùng `PageHeader`) |
| 21 | Nhóm: nhãn "Cơ bản" và nút "Tạo lớp" xuống hai dòng | Nhãn, số học viên, nút không xuống dòng; tên và nhãn tự xuống dòng gọn |

**Giữ nguyên có chủ đích** (nút chọn ngắn như `3+2`, `5+0`, "Trắng/Ngẫu nhiên/Đen", lưới 7 ngày của lịch giải, khối XP 3 số của học viên): ba cột vẫn vừa màn 390 px, đổi sang một cột chỉ làm dài trang. Cửa sổ "Thách đấu" ở trang Chơi cờ chỉ mở được khi có học viên online nên chưa có ảnh; kiểm bằng đọc mã.

**Còn lại:** cửa sổ Thách đấu chưa chụp; trang Chơi cờ còn chữ cứng tiếng Việt ("Kiểm soát thời gian", "Màu quân của bạn", "Thách đấu với …") chưa qua i18n.

## 11. GĐ26b: Trang Tích hợp và Branding chia tab (2026-11-01, lần sáu)

**Ảnh** (`gd26b/{desktop-light,desktop-dark,mobile-light}/shot_*.png`, đã xem từng ảnh; tài khoản thử, VietQR mẫu được seed để thẻ có trạng thái Đã cấu hình): `shot_tich_hop` (hai nhóm thẻ), `shot_tich_hop_vietqr` và `shot_tich_hop_nguoi_gui` (modal), `shot_thiet_lap` (tab Thông tin học viện), `shot_thiet_lap_logo`, `shot_thiet_lap_dang_nhap`, `shot_thiet_lap_ban_co`, `shot_hoc_phi_cai_dat`.

| Trang | Tham chiếu Chesslang (`gd26-2026-11-01/shot_administration_integration.png`, `…_info.png`, chỉ bố cục) | erpchess | Đánh giá |
| --- | --- | --- | --- |
| Tích hợp | Hai nhóm thẻ (Liên lạc, Thanh toán), mỗi thẻ có huy hiệu trạng thái và nút cấu hình | Nhóm **Liên lạc** (Người gửi lời mời) và **Thanh toán** (Chuyển khoản/VietQR, PayOS, Stripe); huy hiệu Đã cấu hình / Chưa cấu hình; thẻ đã cấu hình có dòng tóm tắt; PayOS và Stripe chỉ có huy hiệu "Sắp có", không có nút | **Khớp bố cục.** Có chủ đích: không hiện WhatsApp và Razorpay (ngoài phạm vi); người gửi lời mời chỉ lưu cấu hình, chưa gửi email thật |
| Branding | Nhiều tab ngang (thông tin, logo, đăng nhập…) | 4 tab gạch chân: Thông tin học viện / Logo & màu / Trang đăng nhập / Bàn cờ mặc định, chọn tab qua `?tab=`; một nút Lưu cho ba tab đầu (cùng một biểu mẫu, đổi tab không mất phần đang nhập) | **Khớp.** Chưa có "Thương hiệu ván trực tiếp" và tên miền riêng (không để tab rỗng) |
| Học phí → Cài đặt | — | Thẻ ngân hàng thay bằng lời nhắn và link sang Tích hợp; lưu phần chung giữ nguyên tài khoản ngân hàng | Một nguồn dữ liệu `academy_billing` |

**Không migration:** tên hiển thị và email trả lời nằm trong `academies.contact` (jsonb có sẵn). Lưu hồ sơ từ tab Thông tin gửi lại hai trường này để không xoá chúng.

**Còn lại:** plan 19 sẽ cập nhật sau khi PR #79 (đưa tệp plan vào main) merge; PayOS và Stripe chờ chủ dự án có khoá API.
