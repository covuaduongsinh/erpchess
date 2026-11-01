## Tóm tắt

Giai đoạn 25f: chế độ tối, trang 404, token mobile và chuẩn bị đối chiếu REA. Kế hoạch: `docs/plans/18-giai-doan-25-giao-dien-theo-chesslang.md` mục 3 (PR 25f). Không đổi DB, API hay migration.

- **Chế độ tối chạy thật:**
  - `lib/theme.ts` (`useTheme`): mặc định theo `prefers-color-scheme` (tự đổi khi hệ thống đổi), bấm công tắc thì lưu `localStorage` (`erpchess.theme`), theo dõi đổi từ tab khác; gắn `.dark` và `color-scheme` lên `<html>`.
  - Script nhỏ trong `index.html` gắn `.dark` **trước khi vẽ** nên không nháy (không có CSP chặn script nội tuyến; test kiểm tra script dùng cùng khoá và nằm trước script nạp ứng dụng).
  - Công tắc Sáng/Tối ở đáy sidebar (`role="switch"`, hoạt động thật, thay nút đặt chỗ ở 25a) và ở thanh đầu trang khách.
  - `@custom-variant dark` để các lớp `dark:` sẵn có của Tailwind theo class `.dark` thay vì theo hệ điều hành (trước đây hai cơ chế lệch nhau khi hệ thống ở chế độ tối).
  - `--color-white` không còn bị đổi trong `.dark` (làm `text-white` trên nút màu bị tối); bỏ khoá `white` khỏi `darkColors`.
  - **Chữ màu chính:** `text-primary` (navy) gần như không đọc được trên nền tối. Phát hiện khi chụp thử trang đăng nhập và 404, nên trong `.dark` chữ này được trộn 40% với trắng, tính ngay tại phần tử nên màu thương hiệu học viện cũng được làm sáng theo.
- **Rà màu cứng (~70 tệp):** `bg-white` sang `bg-surface`; `text/border/divide/ring-gray-*` và `bg-gray-50/100` sang token. Giữ nguyên có chủ đích: tệp in (hoá đơn, chứng chỉ, phiếu báo cáo vẫn nền trắng như giấy; chỉ ô nhập liệu trong đó đổi sang `bg-surface`), `text-white` và lớp phủ `bg-white/xx` trên nền màu, màu ngữ nghĩa (xanh/vàng/đỏ nhạt), các khối slate đã có cặp `dark:`. Bàn cờ giữ theme bàn cờ riêng.
- **Trang 404** (`components/NotFound.tsx`, `notFoundComponent` của router gốc): tự thiết kế (số 404 cách điệu bằng họa tiết ô cờ, không dùng câu đùa hay hình của Chesslang); nút Về tổng quan (hoặc Về trang chủ khi chưa có học viện) / Quay lại / Tải lại; liên kết nhanh Bàn cờ, Luyện tập, Học liệu, Giải đấu theo học viện gần nhất (`useCurrentAcademy`, tách từ `AppLayout`). i18n vi/en.
- **Mobile Expo:** thêm `nativeColors` / `darkNativeColors` (bản hex của `primary-soft` và `app-bg`, tính trong oklab giống `color-mix`, có test đối chiếu); màn hình gốc và trang chủ dùng `app-bg`. Không đổi điều hướng.
- **Kịch bản REA:** `make-scenarios.py` sinh 4 kịch bản (desktop/mobile × sáng/tối, 26 trang của 25a–25f kể cả 404, mobile có ảnh drawer) thay hai kịch bản 25a cũ. **Chưa chạy được** vì tài khoản thử chưa xác nhận email; không lách. Đầu tệp ghi các bước chạy.
- **Ảnh thật:** 2 ảnh trang khách ở chế độ tối (đăng nhập, 404) chụp bằng REA trên bản build cục bộ, ở `rea/evidence/ui-2026-11-01/25f-khach-toi/`.
- **Tài liệu:** plan 18 ghi 25e-2 ✅ (#71), mục 25g thêm "Lưu ván từ bàn phân tích vào CSDL của tôi" và ghi nội dung 25f; ledger thêm `ui.dark-mode`, `ui.404` ✅ (65 claim, 50 đã đóng).

## Kiểm tra

- [x] `pnpm lint` (535 tệp), `pnpm typecheck` 11/11
- [x] `pnpm test`: web 275/275, ui-tokens 11/11. Test mới: hook theme (mặc định sáng/tối theo hệ thống, bật/tắt và lưu, đọc lại lần sau, lựa chọn thắng hệ thống, tự đổi khi hệ thống đổi, đồng bộ giữa các tab, script `index.html`); công tắc ở sidebar (role switch, `aria-checked`, gọi callback); trang 404 (nội dung, liên kết theo học viện, khi chưa có học viện, Quay lại/Tải lại, tiếng Anh) và `notFoundComponent` của route gốc; token (`.dark` không đổi `white`, chữ chính sáng hơn, hex mobile khớp `color-mix`)
- [x] `pnpm build`, `pnpm --filter @erpchess/mobile export:web`, `cargo check -j 2`
- [ ] CI 3/3
- [ ] Đối chiếu ảnh erpchess-vs-Chesslang (`so-sanh.md`): chờ tài khoản thử xác nhận email

## Hạn chế cần biết

- Chưa kiểm bằng mắt các trang sau đăng nhập ở chế độ tối (chỉ kiểm được trang khách). Việc rà màu theo quy tắc và test; các chỗ còn lệch sẽ lộ khi chạy kịch bản REA.
- Các khối slate có cặp `dark:` riêng (phòng học, quiz toàn màn hình…) giữ nguyên.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
