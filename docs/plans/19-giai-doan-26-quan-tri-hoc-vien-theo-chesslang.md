# Giai đoạn 26: Hoàn thiện nhóm Quản trị theo Chesslang (Rating, Tích hợp, Branding nhiều tab, Báo cáo theo học viên)

> **Trạng thái (2026-11-01):** **26a, 26b, 26c đã xong và merge** (#83, #80, #81); #82 sửa lỗi báo cáo toàn học viện. Migration `20261101000039` (thẻ 7 ngày), `…040` (báo cáo toàn học viện), `…041` (FIDE) đã được chủ dự án áp lên `erpchess-dev`. Còn **26d** (gửi email) và **26e** (Masterbase), chờ chủ dự án quyết ở mục 4.
> **Tiếp nối:** Giai đoạn 25 (`18-giai-doan-25-giao-dien-theo-chesslang.md`) đã xong giao diện và nghiệm thu bằng REA (PR #64–#77).
> **Lý do:** sổ cái REA còn 11 claim một phần. Lần quan sát mới cho thấy menu Quản trị của Chesslang có các trang mà erpchess chưa có, hoặc mới có một phần: **Rating**, **Integration**, **Email**, Branding chia **6 tab**, và trang **Reports** dạng chọn học viên bên trái, xem báo cáo bên phải.

## 1. Căn cứ quan sát bằng REA (clean-room)

- **Cách quan sát:** `rea capture-browser-scenario` (REA 6.7.0, chế độ launch, Chrome headless). Đăng nhập bằng secret lấy từ biến môi trường. Chỉ mở trang, không bấm lưu.
- **Kịch bản và kết quả:** `rea/evidence/gd26-2026-11-01/`, gồm `scenario-links.json` (lấy DOM menu Quản trị) và `scenario-admin.json` (chụp 10 trang). Ảnh ở `shot_*.png`; `capture-*.json` không commit.
- **Danh sách đường dẫn menu Quản trị** (tách từ DOM):
  - Thành viên: `students`, `coaches`, `groups`, `batches`
  - Vận hành: `leads`, `calendar`, `invoices`, `billing`, `plans`, `discounts`, `reminders`, `email`, `notifications`, `/reports`
  - Học viện: `info` (Branding), `location`, `levels`, `integration`, `rating`

### 1.1. Quan sát từng trang và so với erpchess

| Trang Chesslang                                 | Quan sát (mô tả bằng lời của mình)                                                                                                                                                                                                                                | erpchess hiện tại                                                                                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rating** (`/administration/rating`)           | Thẻ "Nội bộ học viện" luôn bật, gồm 3 loại Classical / Rapid / Blitz kèm mô tả mức thời gian. Thẻ **FIDE** có công tắc bật/tắt, gồm Standard / Rapid / Blitz. Thẻ USCF bị khoá vì chỉ dành cho học viện ở Mỹ.                                                     | Có rating nội bộ Glicko-2 cho 3 loại. **Chưa có FIDE** (claim `org.rating` 🟡). Chưa có trang cấu hình.                                             |
| **Integration** (`/administration/integration`) | Hai nhóm thẻ, mỗi thẻ có huy hiệu "Chưa cấu hình" và nút Configure. **Liên lạc:** tên và email người gửi lời mời; WhatsApp Business. **Thanh toán:** UPI/ngân hàng (mã QR, số tài khoản), thanh toán do nền tảng quản lý, Razorpay, Stripe.                       | VietQR tĩnh nằm trong `academy_billing`, cấu hình ở trang Học phí. Chưa có trang Tích hợp gom một chỗ. WhatsApp và Razorpay nằm ngoài phạm vi (⛔). |
| **Email** (`/administration/email`)             | Cấu hình tên miền gửi email (SendGrid): bản ghi DNS, nút "Configure Domain".                                                                                                                                                                                      | Chưa gửi email (claim `ops.notify` 🟡).                                                                                                             |
| **Branding** (`/administration/info`)           | **6 tab:** Thông tin học viện (tên, mô tả, mạng xã hội) / Thương hiệu nền tảng / Logo và favicon / Trang đăng nhập / Thương hiệu ván trực tiếp / Tên miền white-label.                                                                                            | Trang `/a/$slug/settings` có đủ dữ liệu (22a, 23d, 23f) nhưng xếp dọc trong một trang. Chưa có "Thương hiệu ván trực tiếp" và tên miền riêng.       |
| **Billing** (`/administration/billing`)         | Tab Currency: chọn tiền tệ mặc định của học viện.                                                                                                                                                                                                                 | Đã có (`billing.settings`). Chỉ cần đối chiếu nhãn.                                                                                                 |
| **Reports** (`/reports` → `/reports/coach`)     | Bố cục **chọn bên trái, xem bên phải**. Cột trái: ô tìm học viên, khoảng ngày xuất CSV toàn học viện, chọn loại (Classroom…) và nút Export, danh sách học viên. Cột phải: báo cáo của học viên đang chọn, chưa chọn thì hiện lời nhắc. Sidebar tự thu thành icon. | Trang Báo cáo là một bảng toàn học viện kèm phiếu in. Chưa có bố cục chọn bên trái, xem bên phải.                                                   |

## 2. Quyết định thiết kế

1. **Rating FIDE:** thêm cờ bật/tắt theo học viện, mã FIDE (`fide_id`) và Elo FIDE 3 loại (standard/rapid/blitz) theo từng học viên. HLV **nhập tay**, không gọi API FIDE vì FIDE không có API công khai ổn định. Bỏ USCF.
2. **Trang Tích hợp** gom các thẻ cấu hình thật của erpchess:
   - **Chuyển khoản / VietQR:** dùng dữ liệu `academy_billing` sẵn có, chuyển giao diện sang đây và giữ một nguồn dữ liệu.
   - **Email người gửi lời mời:** chỉ lưu tên hiển thị và email trả lời (`reply_to`), chưa gửi thật.
   - **PayOS** và **Stripe:** thẻ "Sắp có", không có nút cấu hình giả. Muốn làm thật phải có khoá API của chủ dự án (xem mục 4).
   - **WhatsApp và Razorpay:** không hiện (⛔ trong sổ cái).
   - **Zalo OA:** để sau.
3. **Branding chia tab:** tách `/a/$slug/settings` thành các tab dùng `Tabs` của 25b: Thông tin học viện / Logo và màu / Trang đăng nhập / Bàn cờ mặc định. Tab "Thương hiệu ván trực tiếp" và "Tên miền riêng" chỉ thêm khi làm thật, không để tab rỗng.
4. **Báo cáo theo học viên:** bố cục chọn bên trái, xem bên phải, dùng lại dữ liệu và phiếu in của GĐ13/22b. Bảng toàn học viện giữ thành một tab.
5. **Không đổi phạm vi email/push:** gửi email thật cần nhà cung cấp và khoá API, nên chỉ làm khi chủ dự án chọn (mục 4).

## 3. Chia PR

Mỗi PR một nhánh riêng từ `main`. Cổng kiểm thử giống kế hoạch 18 mục 5, cộng thêm **chụp REA trước/sau** bằng tài khoản thử `thu-nghiem-ui` (xem `rea/evidence/ui-2026-11-01/make-scenarios.py`). PR có migration thì mở ở dạng **draft**, chủ dự án áp lên `erpchess-dev` rồi mới merge.

### PR 26a: Trang Rating và FIDE (có migration) — ✅ #83

> **Kết quả:** migration `20261101000041_fide_rating.sql` (cột `fide_*`, RPC `set_academy_fide_enabled` và `set_member_fide`, không nới RLS) + pgTAP `33`; trang `/a/$slug/rating`; cột FIDE ở bảng và thẻ lưới học viên; dòng FIDE ở báo cáo và phiếu in. Ảnh REA ở `rea/evidence/ui-2026-11-01/gd26a/` (FIDE tắt) và `gd26d/` (FIDE bật). Chưa gọi API của FIDE (nhập tay). pgTAP trên cloud: 33 = 21/21 sau khi sửa test (trước đó 20/21; xem mục 4b).
- **DB:**
  - `academies.fide_enabled boolean default false`.
  - `memberships`: thêm `fide_id text` (kiểm số), `fide_standard`/`fide_rapid`/`fide_blitz int` (khoảng 1000–3000, cho phép null).
  - RLS: staff sửa, thành viên xem.
  - pgTAP.
- **API:** `updateAcademyRatingSettings`, `updateMemberFide`, cùng hook.
- **Web:**
  - Trang `/a/$slug/rating` (Quản trị → Học viện → Rating): thẻ Nội bộ luôn bật, thẻ FIDE có `Switch`.
  - Khi bật FIDE: bảng và thẻ học viên có cột hoặc ô FIDE sửa tại chỗ; hồ sơ học viên hiện Elo FIDE.
  - Báo cáo và phiếu in hiện FIDE nếu có.
- **Sổ cái:** `org.rating` → ✅.

### PR 26b: Trang Tích hợp và Branding chia tab (không migration, trừ khi cần cột `reply_to`) — ✅ #80

> **Kết quả:** không cần migration: người gửi lời mời (tên hiển thị + email trả lời) lưu trong `academies.contact` (jsonb). Trang `/a/$slug/integrations`, Branding chia 4 tab (`?tab=`), VietQR chuyển sang Tích hợp. PayOS/Stripe "Sắp có". Ảnh: `gd26b/`.
- **Trang `/a/$slug/integrations`**, theo quyết định 2.2:
  - Thẻ có huy hiệu trạng thái Đã cấu hình / Chưa cấu hình.
  - Modal cấu hình VietQR (chuyển từ trang Học phí sang; trang Học phí trỏ link về đây).
  - Thẻ "Email người gửi" (tên và email trả lời); cần cột thì dùng jsonb `academies.contact` hoặc thêm một migration nhỏ.
- **Branding chia tab** theo quyết định 2.3.
- Nav: thêm mục Tích hợp và Rating vào nhóm Học viện.

### PR 26c: Báo cáo theo học viên, chọn bên trái xem bên phải — ✅ #81, #82

> **Kết quả:** hai tab Theo học viên / Toàn học viện, `?student=`, mobile danh sách rồi chi tiết, sidebar tự thu icon; menu Quản trị cuộn được. Phát hiện RPC `get_academy_students_report` join bảng không tồn tại `public.academy_levels` nên tab Toàn học viện chưa từng chạy: sửa ở #82 (migration `…040` + pgTAP `32`), đã áp. Ảnh: `gd26c/`, `gd26d/`.
- `a.$slug.reports.tsx` có hai tab: **Theo học viên** (mặc định) và **Toàn học viện** (bảng hiện có).
- **Tab Theo học viên:**
  - Cột trái gồm tìm kiếm, khoảng ngày kèm T/Q/N, chọn loại báo cáo, nút Xuất CSV, danh sách học viên có avatar.
  - Cột phải là báo cáo chi tiết của học viên đang chọn, dùng lại các khối của GĐ22b, có nút In.
  - Chọn học viên thì cập nhật URL (`?student=`) để chia sẻ được.
- Sidebar tự thu thành icon ở trang này, giống Chesslang.

### PR 26d (tuỳ chọn, cần chủ dự án quyết): gửi email thông báo

- Edge Function gửi email (ví dụ Resend hoặc SendGrid) cho lời mời, nhắc học phí, giao quiz. Có nhật ký gửi (`notification_log` đã có).
- **Cần:** chọn nhà cung cấp, khoá API (đặt vào secret của Supabase), và tên miền gửi đã xác minh DNS.
- Trang `/a/$slug/email`: trạng thái tên miền và gửi thử.

### PR 26e (tuỳ chọn, cần chủ dự án quyết): nạp dữ liệu Masterbase

- Đề xuất nguồn: kho ván broadcast của Lichess (giấy phép CC0), lọc Elo của cả hai bên ≥ 2300, giới hạn dung lượng < 300 MB để vừa gói Free.
- Dùng script `masterbase-export.mjs` có sẵn, rồi nạp bằng `\copy` (cần service role, chủ dự án chạy).
- **Sổ cái:** `db.masterbase` → ✅.

## 4. Việc cần chủ dự án quyết

| Việc           | Lựa chọn                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| 26d Email      | Có làm không? Nếu có: Resend (dễ, có gói miễn phí) hay SendGrid (giống Chesslang)? Cần khoá API và tên miền gửi. |
| PayOS / Stripe | Có tài khoản PayOS (thanh toán VN) chưa? Không có thì giữ thẻ "Sắp có".                                          |
| 26e Masterbase | Đồng ý dùng kho broadcast Lichess (CC0) không? Ai chạy lệnh nạp (cần service role)?                              |

## 4b. Việc đã làm thêm ngoài kế hoạch

- **Thẻ "Lượt làm bài 7 ngày"** (PR #79): `academy_stats.attempts_week` đếm bài tập + quiz + học liệu, khớp biểu đồ (migration `…039` + pgTAP `31`).
- **Sửa lưới mobile** (#78) và tab Học phí một hàng; seed dữ liệu mẫu `scripts/seed-ui-demo.mjs` (idempotent, chỉ học viện `thu-nghiem-ui`).
- **pgTAP trên `erpchess-dev`** (chủ dự án chạy): 31 = 8/8, 32 = 8/8, 33 = 21/21 (tổng 37/37). Lần chạy đầu 33 = 20/21 do test 7 của `33_fide_rating.sql` đọc `academies.fide_enabled` của học viện B khi đang đăng nhập owner A (RLS ẩn dòng nên trả NULL thay vì `false`); migration đúng, test đã sửa (đọc dưới vai trò postgres) và chạy lại đạt. Kiểm gián tiếp bằng API cũng đạt: `attempts_week` khớp tổng biểu đồ, báo cáo toàn học viện chạy được, FIDE ghi/đọc đúng.

## 5. Thứ tự đề xuất

26a → 26b → 26c (không phụ thuộc dịch vụ ngoài), sau đó 26d/26e tuỳ quyết định ở mục 4.
