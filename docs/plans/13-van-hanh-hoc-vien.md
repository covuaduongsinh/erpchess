# Giai đoạn 12 — Vận hành học viện

## Bối cảnh

- **Claim cần đóng** (`rea/ledger.md` L65-71): `ops.plans`, `ops.discounts`, `ops.invoices`, `ops.reminders`, `ops.notify`, `ops.leads`, `ops.chat`. Spec: `rea/spec/van-hanh.md` (gói học phí đa tiền tệ + thư viện mẫu, giảm giá áp nhiều gói kèm thống kê, hoá đơn kèm link thanh toán, cài đặt Billing: tiền tệ mặc định, mã số thuế, đánh số hoá đơn; nhắc đóng phí trước hạn; nhật ký thông báo theo loại + bật/tắt từng loại; Lead + lớp học thử) và `rea/spec/quan-tri.md` L58-61 (chat: lọc chưa đọc / Group / Batch / HLV / học viên, tìm hội thoại).
- **Đã chốt với anh/chị:**
  - Thanh toán: **chỉ VietQR tĩnh** — mã QR chuyển khoản theo tài khoản ngân hàng của học viện, staff xác nhận đã nhận tiền. Không webhook, không PayOS/Stripe (để sau).
  - Thông báo: chưa chọn kênh ngoài → làm **thông báo trong app + nhật ký gửi**; email/push để sau (`ops.notify` ghi 🟨 một phần).
  - Chia 3 PR: **12a học phí → 12b thông báo + nhắc phí → 12c lead + chat**.
- **Có sẵn để dùng lại:** `private.has_role/is_member/is_parent_of/can_see_student/group_academy`, `groups.kind` (group|batch), `parent_links`, `calendar_events.kind` đã có `'trial'`, mẫu pg_cron (`…0018_tournament_cron.sql`), mẫu `realtime.send` từ trigger + policy `realtime.messages` (`…0013`, `…0015`), mẫu RPC cho `anon` (`verify_certificate`), trang công khai trên `apps/site` (`src/lib/verify.ts`), gói `qrcode` (web), tab staff trong `a.$slug.tsx` (`isStaff`), thẻ mobile trong `apps/mobile/src/app/academies/[slug].tsx`.
- **Chưa có:** mọi thứ về tiền tệ, hoá đơn, thông báo, chat hội thoại (chat lớp học GĐ8 nằm trong `classroom_events`, không dùng lại).

Kế hoạch con ghi vào `docs/plans/13-van-hanh-hoc-vien.md`. Mỗi PR: commit → PR → CI xanh → merge.

## PR 12a — Học phí, giảm giá, hoá đơn, VietQR

1. **Domain (`packages/domain`)** — có test:
   - `money.ts`: số tiền lưu **đơn vị nhỏ nhất (bigint/integer)**; `currencyDecimals` (VND 0, USD/EUR 2…), `formatMoney(amount, currency, locale)` qua `Intl.NumberFormat`, `parseMoney`.
   - `vietqr.ts`: sinh payload EMVCo/NAPAS VietQR (TLV, BIN ngân hàng + số TK, số tiền VND, nội dung chuyển khoản) + CRC16-CCITT (test vector `"123456789"` → `29B1`); danh sách BIN các ngân hàng lớn (Vietcombank, VietinBank, BIDV, Agribank, Techcombank, MB, ACB, VPBank, TPBank, Sacombank…) — kiểm lại BIN với nguồn công khai NAPAS khi làm.
   - `billing.ts`: `applyDiscount(subtotal, discount)` (phần trăm / số tiền cố định, không âm), `invoiceNumber(prefix, n)` dạng `HD-2026-0001`, `transferMemo(number)`; `PLAN_TEMPLATES` ~12 mẫu gói cờ vua tự soạn (8 buổi/tháng, 12 buổi/tháng, học kèm 1-1, gói hè, lớp online…).
2. **Migration `…0021_billing.sql`:**
   - `academy_billing(academy_id pk, currency, tax_id, invoice_prefix, next_number, bank_bin, bank_account, bank_holder)`.
   - `plans(academy_id, name, description, sessions, period once|month|term, active)`, `plan_prices(plan_id, currency, amount)` unique `(plan_id, currency)`.
   - `discounts(academy_id, name, code?, kind percent|fixed, value, currency?, starts_on?, ends_on?, max_uses?, active)`, `discount_plans(discount_id, plan_id)`.
   - `invoices(academy_id, number unique/academy, student_id, plan_id?, discount_id?, currency, subtotal, discount_amount, total, status open|paid|void, due_on, issued_at, paid_at, pay_token, note, created_by)`, `invoice_lines(invoice_id, description, quantity, unit_amount)`, `payments(invoice_id, amount, method transfer|cash|other, reference, paid_at, recorded_by)`.
   - RPC security definer (owner): `create_invoice(...)` (tính tiền phía server, áp giảm giá còn hiệu lực/còn lượt, cấp số tăng dần), `record_payment(...)` (đủ tiền → `paid`), `void_invoice(...)`. RPC `public_invoice(p_token)` cho `anon`: chỉ trả học viện, số HĐ, tên học viên, dòng hàng, tổng, trạng thái, hạn, thông tin chuyển khoản. View thống kê giảm giá (số lượt dùng).
   - **RLS:** owner quản lý toàn bộ; coach không thấy học phí; học viên/phụ huynh chỉ đọc hoá đơn của mình/con. Bảng tiền không có policy ghi trực tiếp ngoài cài đặt/gói/giảm giá cho owner.
3. **API** `packages/api/src/billing.ts` + hook trong `react.tsx`.
4. **Web:** tab "Học phí" (`/a/$slug/billing`):
   - Owner: Hoá đơn (lọc trạng thái, tạo hoá đơn: chọn học viên + gói + tiền tệ + giảm giá + hạn), chi tiết hoá đơn (in được, QR VietQR, ghi nhận thanh toán, huỷ, copy link thanh toán); Gói (tạo từ đầu / từ mẫu, nhiều giá theo tiền tệ); Giảm giá (tổng / đang hiệu lực / lượt dùng, lọc theo loại); Cài đặt (tiền tệ mặc định, MST, tiền tố số HĐ, tài khoản ngân hàng).
   - Học viên/phụ huynh: danh sách hoá đơn của mình + QR.
5. **`apps/site`:** `/pay/[token]` (server component, khoá publishable, `noindex`): hoá đơn + QR VietQR sinh phía server (`qrcode`), trạng thái đã thanh toán/huỷ.
6. **Mobile:** thẻ "Hoá đơn" (học viên/phụ huynh), chạm mở `/pay/[token]`.
7. **Kiểm thử:** domain test (tiền, VietQR CRC, giảm giá); pgTAP `14_billing_rls.sql` (coach/học viên khác không đọc được, học viên không tự ghi thanh toán, anon chỉ gọi `public_invoice`); test tích hợp `phase12.integration.test.ts` (tạo hoá đơn có giảm giá → tổng đúng, ghi nhận thanh toán → paid, anon đọc qua token).

## PR 12b — Thông báo trong app và nhắc đóng phí

1. **Migration `…0022_notifications.sql`:**
   - `notifications(id, academy_id, user_id, category class|quiz|tournament|invoice|invoice_reminder|system, title, body, link, read_at, created_at)` — mỗi dòng là một lần gửi (nhật ký); `notification_settings(academy_id, category, enabled)`.
   - `private.notify(academy, users[], category, title, body, link)` bỏ qua loại đã tắt, rồi `realtime.send` lên kênh riêng `user:<id>` (policy chỉ chủ kênh nghe).
   - Trigger phát thông báo: tạo lớp học/sự kiện lịch, quiz xuất bản, giải đấu mở, hoá đơn mới — tới học viên được giao + phụ huynh. Nội dung tiếng Việt cố định, link vào trang tương ứng.
   - `reminder_rules(academy_id, kind 'invoice_due', days_before int[], enabled)` + `reminder_sent(invoice_id, days_before)` chống gửi trùng; `private.run_fee_reminders()` chạy bằng pg_cron mỗi ngày 8:00 giờ VN (SQL thuần, không cần Edge Function).
   - RPC `mark_notifications_read`, view thống kê nhật ký theo loại (đã gửi / đã đọc) cho owner.
2. **Web:** chuông thông báo ở thanh đầu (số chưa đọc, realtime, danh sách, đánh dấu đã đọc); trang "Thông báo" cho owner: bật/tắt từng loại, quy tắc nhắc phí (số ngày trước hạn), nhật ký + xem trước nội dung.
3. **Mobile:** thẻ "Thông báo" (chưa đọc, chạm mở link).
4. **Kiểm thử:** pgTAP `15_notifications_rls.sql` (chỉ chủ nhận đọc được, loại tắt không gửi, nhắc phí không trùng); test tích hợp: tạo hoá đơn → học viên nhận thông báo; chạy `run_fee_reminders` → đúng một nhắc.

## PR 12c — Lead, lớp học thử, chat

1. **Migration `…0023_leads_chat.sql`:**
   - `academies.leads_enabled`; `leads(academy_id, name, phone, email, child_name, child_age, source, status new|contacted|trial|won|lost, note, assigned_to, trial_event_id → calendar_events, created_at)` — chỉ staff; RPC `schedule_trial(lead, start, end, coach)` tạo `calendar_events` kind `trial`.
   - `conversations(academy_id, kind group|direct, group_id?)`, `conversation_members(conversation_id, user_id, last_read_at)`, `messages(conversation_id, sender_id, body ≤ 2000, created_at)`.
   - RPC `open_group_chat(group)` (tạo/đồng bộ thành viên: HLV + học viên của Group/Batch), `open_direct_chat(academy, user)` — **chỉ cho phép staff ↔ học viên/phụ huynh/staff**, không cho học viên nhắn riêng nhau; `mark_conversation_read`. Trigger `realtime.send` lên `chat:<id>` (policy: thành viên). RLS: chỉ thành viên đọc/gửi; phụ huynh xem được hội thoại riêng của con.
2. **Web:** tab "Lead" (staff, khi bật): bảng theo trạng thái, thêm/sửa lead, hẹn học thử (hiện trên Calendar), "Chuyển thành học viên" mở form tạo học viên điền sẵn. Tab "Chat": danh sách hội thoại (lọc chưa đọc / Group / Batch / HLV / học viên, tìm kiếm) + khung tin nhắn realtime.
3. **Mobile:** danh sách hội thoại + màn chat `academies/[slug]/chat/[id].tsx`.
4. **Kiểm thử:** pgTAP `16_leads_chat_rls.sql` (học viên không thấy lead; người ngoài hội thoại không đọc tin; học viên không mở được chat riêng với học viên khác); test tích hợp: HLV mở chat nhóm, học viên thử nhận tin.

## Kiểm chứng

- Mỗi PR: `pnpm lint`, `typecheck`, `test`, `build`, `sync-shared --check`; CI 3 job xanh; quét bí mật trước khi push.
- Migration qua MCP `apply_migration`, sinh lại `database.types.ts`; pgTAP qua `to-mcp.mjs` + `execute_sql`; advisor bảo mật sau mỗi migration.
- Chrome localhost trên DSC1 (chỉ owner): gói/hoá đơn "(Claude)" xuất cho chính owner, xem QR + trang `/pay/[token]` trên site local (quét thử bằng app ngân hàng là việc của anh/chị); thông báo, lead và chat thử với dữ liệu "(Claude)" — báo lại và dọn sau.
- Cuối giai đoạn: cập nhật `rea/ledger.md` (`ops.notify` 🟨 vì chưa có email/push) và mục "Kết quả" trong `docs/plans/13-van-hanh-hoc-vien.md`.
- Trước khi bắt đầu: kiểm `apps/site/next-env.d.ts` / `AGENTS.md` lại xuất hiện trong working tree — trả về/xoá nếu chỉ là file Next tự sinh.

## Rủi ro và ghi chú

- **VietQR tĩnh không tự đối soát:** staff phải đối chiếu sao kê rồi bấm "Đã nhận"; nội dung chuyển khoản chứa số hoá đơn để dễ khớp. PayOS/Stripe có thể thêm sau qua webhook mà không đổi bảng (`payments.method`).
- **Link thanh toán công khai:** `pay_token` ngẫu nhiên 128 bit, chỉ lộ thông tin trên hoá đơn; hoá đơn huỷ vẫn hiện trạng thái "đã huỷ".
- **Học viên là trẻ em:** chat riêng chỉ giữa staff và học viên/phụ huynh; không có chat học viên ↔ học viên.
- **Số tiền:** luôn số nguyên đơn vị nhỏ nhất, tính phía server; client chỉ hiển thị.

## Kết quả

### PR 12a (2026-10-26)

- **Domain:** `money.ts` (đơn vị nhỏ nhất, `formatMoney`, `parseMoney`), `vietqr.ts` (payload EMVCo/NAPAS + CRC-16/CCITT-FALSE, 18 BIN ngân hàng), `billing.ts` (schema gói/giảm giá, `discountAmount`, `discountUsable`, số hoá đơn, nội dung chuyển khoản, 12 gói mẫu tự soạn) — test `billing.test.ts`.
- **Migration `…0021_billing.sql`:** `academy_billing`, `plans` + `plan_prices`, `discounts` + `discount_plans`, `invoices` + `invoice_lines` + `payments`, view `discount_stats`. RPC owner `create_invoice` (tính tiền phía server, khoá dòng giảm giá để không vượt lượt, số `HD-YYYY-NNNN` đánh lại mỗi năm, tổng 0 thì `paid` ngay), `record_payment`, `void_invoice`; `public_invoice(pay_token)` cho `anon`. Coach không thấy học phí; học viên/phụ huynh chỉ đọc hoá đơn của mình/con.
- **Web:** tab "Học phí" (ẩn với coach): hoá đơn (lọc, tìm, tạo kèm khoản thêm + xem trước tổng), chi tiết in A4 dọc có VietQR, ghi nhận đã nhận tiền, huỷ, sao chép link; gói (từ mẫu, nhiều tiền tệ); giảm giá (thống kê tổng / đang hiệu lực / lượt dùng, lọc theo loại); cài đặt (tiền tệ mặc định, MST, tiền tố, tài khoản nhận). Khổ giấy in chứng chỉ chuyển vào trang chứng chỉ để hoá đơn in dọc.
- **`apps/site`:** `/pay/[token]` (server component, QR sinh phía server, `noindex`).
- **Mobile:** thẻ "Hoá đơn của tôi" (học viên/phụ huynh) mở trang thanh toán.
- **Kiểm chứng:** pgTAP `14_billing_rls.sql` 20/20; `phase12.integration.test.ts` đạt (hoá đơn thử của học viên thử được huỷ, gói/giảm giá thử đã xoá; học viện thử giờ có cài đặt Billing tiền tố `TEST`).

### PR 12b (2026-10-26)

- **Migration `…0022_notifications.sql`:** `notifications` (mỗi dòng một lần gửi = nhật ký), `notification_settings` (tắt theo loại), `reminder_rules` (mặc định 3 ngày trước và đúng ngày hạn) + `reminder_sent` (mỗi mốc một lần). `private.notify` gửi tới học viên kèm phụ huynh, bỏ người tạo, đẩy realtime lên `user:<id>` (policy chỉ chủ kênh nghe). Trigger: quiz giao lớp/học viên hoặc mở cho tất cả, buổi học giao, có tên trong giải, hoá đơn mới. `private.run_fee_reminders` chạy pg_cron `fee-reminders` 01:00 UTC (8:00 VN); owner chạy ngay bằng `run_fee_reminders_now`. `mark_notifications_read`, view `notification_stats`.
- **Web:** chuông ở thanh trên (đếm chưa đọc realtime, danh sách, mở link, đánh dấu đã đọc); tab "Thông báo" cho owner: bật/tắt từng loại kèm số đã gửi/đã đọc, quy tắc nhắc phí, chạy ngay, nhật ký có xem trước nội dung.
- **Mobile:** thẻ thông báo chưa đọc của học viện, chạm để đánh dấu đã đọc.
- **Kiểm chứng:** pgTAP `15_notifications_rls.sql` 16/16 (`to-mcp.mjs` nhận thêm `matches`); `phase12.integration.test.ts` thêm ca hoá đơn mới → thông báo, nhắc phí đúng một lần; Chrome trên DSC1: chuông tăng 1 → 2 khi gửi thông báo thử qua `private.notify` (không tải lại trang), đánh dấu đã đọc, trang Thông báo hiện thống kê và nhật ký.
- **Dữ liệu thử còn lại:** 2 thông báo hệ thống "(Claude)" đã đọc của owner DSC1; hoá đơn `TEST-2026-9999` (đã huỷ) trong học viện thử — lệnh `DELETE` qua MCP bị chặn ở bước xác nhận. Gói "(Claude)" của DSC1 đã xoá qua giao diện.

### PR 12c (2026-10-26)

- **Migration `…0023_leads_chat.sql`** (áp lên Supabase thành 2 migration `leads` + `chat`): `academies.leads_enabled`; `leads` chỉ staff; `schedule_trial` tạo sự kiện lịch loại `trial` và chuyển lead sang "Học thử". Chat: `conversations` (group/direct), `conversation_members`, `messages`; `open_group_chat` (HLV + học viên của Group/Batch + staff mở), `open_direct_chat` (bắt buộc có một bên là staff — không nhắn riêng học viên ↔ học viên), `mark_conversation_read`, `my_conversations` (tin cuối, số chưa đọc, đối phương). Trigger đẩy tin lên `chat:<id>`; phụ huynh xem (không gửi) hội thoại có con. Học viên rời lớp không bị xoá khỏi hội thoại mà mất quyền qua `is_conversation_member` (MCP không chạy được câu `DELETE`).
- **Web:** tab "Lead" (owner luôn thấy để bật/tắt; coach thấy khi đã bật): đếm theo trạng thái, tìm, thêm lead, đổi trạng thái, hẹn học thử, "Chuyển thành học viên" mở trang Học viên điền sẵn tên. Tab "Chat": danh sách lọc Tất cả/Chưa đọc/Lớp/Batch/HLV/Học viên + tìm, mở chat lớp hoặc nhắn riêng, khung tin nhắn realtime.
- **Mobile:** thẻ hội thoại + màn `chats/[id]`.
- **Kiểm chứng:** pgTAP `16_leads_chat_rls.sql` 17/17; `phase12.integration.test.ts` 3/3 (lead + học thử, nhắn riêng học viên → chủ học viện). Chrome DSC1: trang Chat và Lead hiển thị đúng (không bật Lead cho DSC1).
