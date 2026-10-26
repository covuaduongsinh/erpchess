# Bàn giao sau Giai đoạn 12 (2026-10-26)

Dán khối dưới đây làm tin nhắn đầu tiên cho phiên Claude Code mới mở trong `D:\code\erpchess`.

---

Tiếp tục dự án ERPChess (`D:\code\erpchess`, repo PUBLIC `covuaduongsinh/erpchess`): nền tảng quản lý học viện cờ vua tương đương chesslang.com, chạy web/desktop/mobile, tái tạo theo kiểu clean-room từ khảo sát REA.

**Đọc trước khi làm:**
- `docs/plans/00-ke-hoach-tong.md`: lộ trình tổng. Giai đoạn 0–12 đã xong.
- `rea/ledger.md`: trạng thái từng claim. Hiện có 43 claim đóng, 12 làm một phần, 2 còn mở.
- `docs/plans/13-van-hanh-hoc-vien.md`: kế hoạch và mục "Kết quả" của Giai đoạn 12 (PR #26, #27, #28).
- `rea/spec/*.md`: đặc tả hành vi. Không chép mã, văn bản hay học liệu của Chesslang.

**Quy trình mỗi giai đoạn:** vào plan mode → ghi kế hoạch vào `docs/plans/NN-ten.md` → chờ tôi duyệt → làm trên nhánh `feat/giai-doan-NNx-...` → commit → PR → CI 3 job xanh → merge. Giai đoạn lớn thì chia thành nhiều PR (a/b/c). Cuối giai đoạn cập nhật `rea/ledger.md` và mục "Kết quả" trong file kế hoạch.

**Ràng buộc:**
- Trả lời bằng tiếng Việt, kể cả tiêu đề mục.
- Trong plan mode không chạy shell.
- Commit kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR body kết thúc bằng `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Quét bí mật trước khi push; không commit `.env.local`.
- Không đưa code GPL vào dự án: không chessground, không Stockfish; engine là Arasan (MIT).
- Không tự gõ mật khẩu vào trình duyệt; chỉ dùng phiên Chrome đã đăng nhập sẵn. Không lặp lại giá trị bí mật trong chat.
- Không thay đổi dữ liệu trên tài khoản Chesslang. Không tạo ván, lớp, giải cho học viên thật.
- Học viện thật DSC1 (`/a/dsc1`) chỉ có owner. Dữ liệu thử trong đó đặt tên có "(Claude)" và phải dọn sau khi dùng. Đừng bật/tắt cài đặt của DSC1 khi chưa hỏi.
- Tài khoản test (`e2e.owner@erpchess.test`, học viên `minhan.test`, học viện `clb-co-vua-duong-sinh-thu-nghiem`) chỉ dùng qua script/test. Biến môi trường nằm trong file `it.env` ở scratchpad của phiên cũ; nếu không còn, hỏi tôi, không tự tạo mật khẩu.

**Kỹ thuật cần biết:**
- **Stack:**
  - pnpm 11 (luôn thêm `< /dev/null`), Turborepo, Biome 2.6 (định dạng cả `.md`), Vitest.
  - Web: TanStack Router dạng file; `routeTree.gen.ts` sinh khi chạy `vite dev`/`build`.
  - Site: Next.js 16 (`apps/site`); `params` là Promise.
  - Mobile: Expo (`apps/mobile`, expo-router).
  - Desktop: Tauri.
- **Supabase project `eordwpktwokvmhymvcyd`:**
  - Áp migration bằng MCP `apply_migration`, rồi chạy `get_advisors`.
  - Sinh types bằng MCP `generate_typescript_types`. Output lớn bị lưu ra file; ghi vào `packages/api/src/database.types.ts`, giữ 2 dòng header và một dòng trống, rồi chạy `biome format`.
  - **Bất kỳ SQL nào chứa câu `DELETE`/`DROP`** (kể cả trong thân hàm) qua MCP đều báo lỗi `Invalid or expired requestState`, do bước xác nhận lệnh nguy hiểm không tới được người dùng. Hãy thiết kế tránh `DELETE` trong migration; muốn xoá dữ liệu thì xoá qua RLS từ client/app, hoặc nhờ tôi chạy trong SQL Editor.
  - Cảnh báo advisor "anon chạy được SECURITY DEFINER" cho `verify_certificate` và `public_invoice` là có chủ đích.
- **pgTAP:** viết `supabase/tests/NN_*.sql` theo khung `begin; plan(n) … finish(); rollback;`. Chạy `node supabase/tests/to-mcp.mjs file.sql` để chuyển đổi, rồi dán vào `execute_sql`. Kết quả trả về dạng exception `TAP x/y`.
- **Test tích hợp:** `packages/api/src/phaseN.integration.test.ts`. Nạp env bằng `set -a && . it.env && set +a`, rồi chạy `npx vitest run <file>` trong `packages/api`.
- **Python trên Windows:** heredoc chứa tiếng Việt dễ lỗi. Viết script ra file rồi chạy `python -X utf8 file.py`.
- **Máy yếu, ít RAM:**
  - Build/typecheck thì chạy nền hoặc từng gói (`npx tsc --noEmit` trong từng app).
  - `next dev` (Turbopack) có thể chết với mã `0xc0000142`; khi đó dùng `next build && next start`.
  - Chrome đôi khi không chụp được màn hình; dùng `javascript_tool`/`get_page_text` để kiểm DOM.
- **Đường công khai:** `apps/site` có `/verify/[code]` (chứng chỉ) và `/pay/[token]` (hoá đơn VietQR); cả hai gọi REST RPC bằng khoá publishable.

**Việc còn tồn:**
1. **Dữ liệu thử:**
   - Hoá đơn `TEST-2026-9999` (đã huỷ) trong học viện thử: cần xoá bằng SQL Editor.
   - Hai thông báo hệ thống "(Claude)" (đã đọc) của owner DSC1: xoá được bằng `delete from notifications where title like '%(Claude)%'` trong SQL Editor.
2. **Claim làm một phần** (xem `rea/ledger.md`):
   - `ops.invoices`: mới có VietQR tĩnh; còn PayOS/Stripe qua webhook.
   - `ops.notify`: mới có thông báo trong app; còn email Resend, Expo push, Web Push.
   - Các claim 🟡 khác từ những giai đoạn trước.
3. **LiveKit:** vẫn chờ tôi đặt secret `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
4. **Biến môi trường khi triển khai** (đã có trong các `.env.example`): `VITE_SITE_URL`, `EXPO_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`, `NEXT_PUBLIC_APP_URL`.

**Việc kế tiếp:** Giai đoạn 13 — Báo cáo và hồ sơ, theo `00-ke-hoach-tong.md`:
- Báo cáo theo học viên: gom bài tập, quiz, lớp, ván, giải; xuất CSV.
- Hồ sơ: ngôn ngữ, múi giờ, ký hiệu nước đi.

Hãy bật plan mode, đọc các file trên cùng `rea/spec/` liên quan, rồi đề xuất kế hoạch Giai đoạn 13 vào `docs/plans/14-bao-cao-ho-so.md`.
