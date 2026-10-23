# Kế hoạch: ERPChess — nền tảng đào tạo cờ vua kiểu Chesslang (web + desktop + mobile)

## Bối cảnh

- **Yêu cầu:** xây một ứng dụng tương tự https://chesslang.com, chạy đồng bộ trên web, desktop và mobile bằng công nghệ mới nhất. Dùng tiện ích của repo REA (`D:\code\rea`) để khảo sát sản phẩm gốc và kiểm chứng mức độ tái tạo.
- **Hiện trạng:** repo `D:\code\erpchess` hiện chỉ có `LICENSE` (một commit "Initial commit", nhánh `main`).
- **Quy ước:** mọi kế hoạch lưu ở `docs/plans/`.
- **Quyết định đã chốt với người dùng:**
  - Stack: TypeScript monorepo — Expo cho mobile, Tauri 2 cho desktop, web là React.
  - Backend: Supabase.
  - Phạm vi bản đầu: gần đầy đủ (có khoá học, giải đấu, lớp trực tuyến, thanh toán).

**Chesslang là gì** (theo nghiên cứu web; trang chính `chesslang.com` không truy cập được, nguồn là `one.chesslang.com` và blog đối tác):
- **Đối tượng:** phần mềm cho huấn luyện viên (HLV) và học viện cờ. Học viên đăng nhập bằng ID, không cần email.
- **Tính năng:**
  - Lớp học trực tiếp: video/âm thanh, bàn cờ chung, mũi tên, tô ô, ẩn quân, engine, chat.
  - Bài tập về nhà: PGN/puzzle, theo dõi từng nước thử và thời gian làm.
  - Luyện với engine từ thế cờ do HLV dựng, có chế độ cờ mù.
  - Đấu nội bộ và giải đấu.
  - Sharebox, PGN Creator.
  - Báo cáo tiến độ.
  - Thu học phí, lead, cập nhật cho phụ huynh, bán khoá học/webinar.
  - Giáo trình 7 cấp độ, thi chứng chỉ có webcam, chứng chỉ xác minh công khai.
  - Đa ngôn ngữ.
- **Giá:** khoảng $20–29/tháng mỗi HLV.

**REA là gì:** bộ công cụ reverse-engineering chạy dưới dạng MCP `rea`. Dùng cho dự án này:
- **Quan sát web:** `observe_web_session`, `capture_browser_scenario`, `capture_web_screenshot`, `inspect_web_network_capture`, `analyze_web_bundle`, `trace_application_feature`.
- **Sổ cái tái tạo:** `export_evidence_bundle` → `build_reconstruction_obligation_ledger` → `evaluate_reconstruction_coverage` → `verify_reconstruction`. Tài liệu: `D:\code\rea\docs\reconstruction-obligation-ledgers.md`, `reconstruction-coverage.md`. Skill phương pháp: `D:\code\rea\.agents\skills\reverse-engineer-anything\SKILL.md`.
- **Yêu cầu chạy:** Node ≥22.19 và Chrome mở CDP bằng một profile riêng (`--remote-debugging-port=9222`).

**Nguyên tắc pháp lý — clean-room:**
- REA chỉ dùng để **quan sát hành vi, luồng UI và API công khai** từ tài khoản dùng thử hợp lệ của người dùng, rồi viết thành đặc tả tính năng. **Không** chép mã, asset hay văn bản của Chesslang.
- Repo `ornicar/app.chesslang.com` theo GPL-3.0 nên **không** đưa code từ đó vào.
- Thư viện GPL (chessground, Stockfish) cần quyết định riêng; xem mục Rủi ro.

---

## Kiến trúc

```
erpchess/                      (pnpm workspaces + Turborepo)
├─ apps/
│  ├─ web/        Vite + React 19 + TanStack Router SPA  → app.<domain>   (deploy Vercel)
│  ├─ site/       Next.js (bản ổn định mới nhất) — landing, SEO, xác minh chứng chỉ công khai
│  ├─ desktop/    Tauri 2 — bọc đúng bản build của apps/web; thêm auto-update, engine native
│  └─ mobile/     Expo (SDK mới nhất, New Architecture) + Expo Router + NativeWind
├─ packages/
│  ├─ chess-core/   chess.js + PGN parse/serialize + chấm puzzle, cờ mù, luật variant (thuần TS, có test)
│  ├─ engine/       interface EngineAdapter: web worker (Stockfish WASM) | Tauri sidecar | RN native
│  ├─ board-web/    bàn cờ SVG React (mũi tên, tô ô, ẩn quân, kéo thả) — dùng cho web + desktop
│  ├─ board-native/ bàn cờ RN (react-native-skia + gesture-handler), cùng API props với board-web
│  ├─ api/          supabase-js client, types sinh tự động, hook TanStack Query, kênh Realtime
│  ├─ domain/       schema Zod dùng chung (Assignment, Puzzle, Session, Tournament...)
│  ├─ i18n/         i18next + từ điển vi/en
│  ├─ ui-tokens/    design token (màu, spacing, font) → Tailwind v4 (web) và NativeWind (mobile)
│  └─ config/       tsconfig, eslint (hoặc Biome), vitest preset
├─ supabase/
│  ├─ migrations/   schema + RLS
│  ├─ functions/    Edge Functions (Deno): tạo tài khoản học viên, webhook thanh toán, ghép cặp Swiss, cấp chứng chỉ, LiveKit token
│  └─ tests/        pgTAP cho RLS
├─ rea/             đặc tả + evidence + ledger tái tạo (đầu ra của Giai đoạn 0)
└─ docs/plans/      kế hoạch tổng + kế hoạch từng giai đoạn
```

**Đồng bộ đa nền tảng:**
- **Nguồn sự thật:** Supabase Postgres.
- **Realtime:**
  - _Broadcast_ cho bàn cờ trong buổi học trực tiếp (độ trễ thấp).
  - _Presence_ để biết ai đang online.
  - _Postgres Changes_ để cập nhật bài tập, kết quả và thông báo.
- **Video lớp học:** LiveKit (Cloud hoặc tự host), có SDK cho web và React Native.
- **Đăng nhập:** Supabase Auth gồm email, Google, Apple, OTP.
  - Học viên đăng nhập bằng _username + PIN_. Edge Function tạo user với email nội bộ `<uuid>@students.local`, khớp với kiểu đăng nhập không cần email của Chesslang.
- **Offline (mobile/desktop):** TanStack Query persist cho dữ liệu đọc. Lời giải puzzle và bài tập vào hàng đợi, gửi lại khi có mạng.
- **Push notification:** Expo Notifications cho mobile, Web Push cho web, thông báo native của Tauri cho desktop.

**Vai trò và RLS:**
- Vai trò: `owner` (chủ học viện), `coach`, `student`, `parent`.
- Mọi bảng nghiệp vụ có `academy_id`. RLS dựa trên bảng `memberships(academy_id, user_id, role)`.
- **Bảng chính:**
  - Tổ chức và người dùng: `academies`, `profiles`, `memberships`, `groups` (lớp), `group_members`.
  - Nội dung cờ: `pgns`, `puzzles`, `puzzle_sets`.
  - Bài tập: `assignments`, `assignment_items`, `attempts` (lưu từng nước thử và thời gian).
  - Buổi học: `sessions`, `session_events`.
  - Ván và giải: `games`, `tournaments`, `tournament_players`, `pairings`.
  - Khoá học và chứng chỉ: `courses`, `course_levels`, `lessons`, `lesson_activities`, `exams`, `exam_attempts`, `certificates`.
  - Kinh doanh: `invoices`, `payments`, `leads`, `parent_updates`.

---

## Các giai đoạn

Mỗi giai đoạn có file kế hoạch con `docs/plans/NN-<ten>.md`, viết ngay trước khi làm giai đoạn đó.

### Giai đoạn 0 — Lưu kế hoạch và khảo sát Chesslang bằng REA

1. **Lưu kế hoạch:** tạo `docs/plans/00-ke-hoach-tong.md` (bản sao kế hoạch này) và ghi memory dự án "kế hoạch luôn ở `docs/plans/`".
2. **Chuẩn bị REA:**
   - Chạy `npx -y rea-agents@latest doctor --client claude_code --json`.
   - Người dùng mở Chrome với profile riêng, `--remote-debugging-port=9222`, đăng nhập Chesslang bằng tài khoản dùng thử của họ.
3. **Thu thập theo từng luồng:** đăng nhập học viên, tạo lớp, giao bài, làm puzzle, buổi học trực tiếp, giải đấu, khoá học, báo cáo.
   - Ghi thao tác bằng `observe_web_session` khi người dùng tự làm, hoặc bằng `capture_browser_scenario`.
   - Chụp màn hình bằng `capture_web_screenshot`.
   - Xuất HAR, đọc bằng `inspect_web_network_capture`, rồi `inspect_analysis_view` với view `api-surface`.
4. **Viết đặc tả:** `rea/spec/*.md`, một file mỗi tính năng — mô tả hành vi, trạng thái, edge case bằng lời của mình. Lưu evidence bằng `export_evidence_bundle` vào `rea/evidence/`.
5. **Lập sổ cái:** từ các claim trong đặc tả, dựng `build_reconstruction_obligation_ledger` (`rea/ledger.json`). Ban đầu mọi claim đều **mở**.

### Giai đoạn 1 — Nền móng monorepo

- **Khung:** pnpm + Turborepo, TypeScript strict, Biome, Vitest, Changesets. CI GitHub Actions chạy lint, typecheck, test và build cả 4 app.
- **Khởi tạo app:**
  - `apps/web`: Vite + TanStack Router.
  - `apps/site`: Next.js.
  - `apps/desktop`: Tauri 2, trỏ vào `apps/web/dist`.
  - `apps/mobile`: Expo Router.
- **Gói dùng chung:** `packages/config`, `ui-tokens`, `i18n` (vi mặc định, en).
- **Phiên bản thư viện:** tra bản ổn định mới nhất qua context7 hoặc web lúc triển khai, không đoán.

### Giai đoạn 2 — Supabase, đăng nhập, tổ chức

- **Cơ sở dữ liệu:** migrations cho academies, profiles, memberships, groups; RLS kèm test pgTAP; sinh types vào `packages/api`.
- **Edge Function** `create-student`: tạo học viên bằng username + PIN.
- **Màn hình trên cả 3 app:** đăng ký học viện, mời HLV, tạo học viên và lớp, đăng nhập phụ huynh.

### Giai đoạn 3 — Lõi cờ, bàn cờ, engine

- **`chess-core`:** PGN có biến và bình luận, FEN, chấm puzzle (nhiều đáp án, nước đáp của đối phương), chế độ cờ mù/ẩn quân. Bao phủ test cao.
- **`board-web` / `board-native`:**
  - Cùng interface `BoardProps`: kéo-thả và chạm, mũi tên, tô ô, phong cấp, lật bàn, đi lại nước, theme.
  - Chơi được trên 3 nền tảng.
- **`engine`:**
  - Web: Stockfish WASM trong worker.
  - Desktop: sidecar Stockfish native qua Tauri.
  - Mobile: module native hoặc WASM.
  - Cả ba qua chung một `EngineAdapter` (UCI, multipv, giới hạn độ sâu và Elo).
- **Màn hình:** Bàn phân tích, PGN Creator, Sharebox (tải lên và chia sẻ ván).

### Giai đoạn 4 — Bài tập, puzzle, báo cáo

- **Kho puzzle:** theo chủ đề, thẻ, độ khó. Import PGN/EPD và có thể import puzzle Lichess (CC0).
- **Giao bài:** cho lớp hoặc từng học viên, có hạn nộp và nhắc hạn (cron Edge Function + push).
- **Làm bài:** học viên làm trên mọi nền tảng. `attempts` ghi từng nước và thời gian; làm offline thì xếp hàng đợi gửi sau.
- **Báo cáo:**
  - Cho HLV: tỉ lệ hoàn thành, tốc độ, số lần thử.
  - Cho học viện: tổng quan.
  - Cho phụ huynh: bản tóm tắt.

### Giai đoạn 5 — Lớp học trực tiếp

- **Phòng học:** bàn cờ đồng bộ qua Realtime Broadcast. HLV điều khiển, có thể trao quyền đi quân cho học viên. Có mũi tên, tô ô, engine bật/tắt, ẩn quân, chat.
- **Video/âm thanh:** LiveKit; Edge Function cấp token.
- **Sau buổi học:** ghi lại `session_events` để xem lại và xuất PGN có biến.

### Giai đoạn 6 — Đấu cờ và giải đấu

- **Ván cờ:** đánh với bot từ thế cờ HLV dựng, có "cờ mù". Ván 1-1 giữa học viên có đồng hồ, server xác thực nước đi qua Edge Function hoặc RPC.
- **Giải đấu:** Swiss và vòng tròn; ghép cặp theo Dutch rule (thư viện hoặc tự cài, có test), bảng xếp hạng realtime.

### Giai đoạn 7 — Khoá học, giáo trình, chứng chỉ

- **Trình soạn khoá học:** cấp độ, bài học, 7 dạng hoạt động (puzzle, bắt quân, đánh máy, trắc nghiệm, bài giải thích, video, xem ván). Video lưu trên Supabase Storage hoặc CDN.
- **Thi chứng chỉ:** giới hạn giờ, giám sát webcam tuỳ chọn. Chứng chỉ PDF có mã xác minh công khai tại `apps/site/verify/[code]`.
- **Gamification:** XP, chuỗi ngày học, huy hiệu.

### Giai đoạn 8 — Thanh toán và vận hành học viện

- **Học phí:** hoá đơn, thu học phí và gói thuê bao cho HLV/học viện qua Stripe (quốc tế) và PayOS hoặc VNPay (Việt Nam). Webhook xử lý bằng Edge Function.
- **Bán hàng:** form lead nhúng vào website học viện, bán khoá học/webinar.
- **Phụ huynh:** bản cập nhật định kỳ và nhắc giữ chân học viên.

### Giai đoạn 9 — Phát hành

- **Web và site:** deploy lên Vercel.
- **Desktop:** Tauri bundle MSI/DMG/AppImage, ký số, `tauri-plugin-updater`.
- **Mobile:** EAS Build/Submit, OTA bằng EAS Update.
- **Giám sát:** Sentry trên cả 4 app.

---

## Kiểm chứng

- **Unit:** Vitest cho `chess-core`, `engine` (dùng mock), `domain`; pgTAP cho RLS (học viên không đọc được dữ liệu học viện khác, HLV chỉ thấy lớp của mình).
- **E2E web/desktop:** Playwright cho các luồng chính (giao bài → học viên làm → HLV xem báo cáo; buổi học 2 trình duyệt đồng bộ bàn cờ). Desktop chạy `tauri build`, cài thử trên Windows.
- **E2E mobile:** Maestro trên Android emulator. Có thể quan sát thêm bằng `mcp__rea__capture_adb_screen` / `read_adb_logcat`.
- **Kiểm chứng đồng bộ:** cùng một tài khoản mở trên web, desktop và mobile. Làm puzzle trên mobile thì báo cáo trên web cập nhật realtime.
- **Đối chiếu bằng REA:**
  - Mỗi giai đoạn xong thì gắn implementation, test fixture và verifier vào các claim trong `rea/ledger.json`.
  - Chạy `evaluate_reconstruction_coverage` và `verify_reconstruction` để biết claim nào đã đóng hay còn thiếu.
  - Dùng `capture_browser_scenario` trên app của mình để so luồng với evidence gốc, đối chiếu **hành vi**, không so pixel.
- **Kiểm định trước khi báo xong:** chạy lint, typecheck, test và build xanh trên CI; cuối mỗi giai đoạn có agent verifier/code-reviewer rà riêng.

## Rủi ro và quyết định cần lưu ý

- **Giấy phép GPL:**
  - Stockfish (GPL-3) và chessground (GPL-3). Kế hoạch dùng bàn cờ **tự viết** (MIT) nên tránh được chessground.
  - Stockfish nhúng trong app phân phối thì phải tuân GPL cho phần engine: tách module, ghi công, cung cấp source. Phương án thay thế là phân tích phía server.
  - Cần chốt trước Giai đoạn 3.
- **Pháp lý:** REA chỉ dùng trên tài khoản hợp lệ, không vượt cơ chế bảo vệ, không sao chép nội dung có bản quyền. Đặc tả viết lại bằng lời của mình.
- **Môi trường REA trên Windows:** `recover_javascript_sources` cần Wakaru trên Linux nên không dùng được. Không cần thiết vì đi theo clean-room.
- **Hạ tầng:** chi phí LiveKit và Supabase khi mở rộng; giới hạn Realtime của Supabase với giải đấu đông người. Theo dõi khi tải lớn.
- **Thứ tự:** phạm vi "gần đầy đủ" lớn, nên làm tuần tự 0→9. Mỗi giai đoạn phải demo được trên cả 3 nền tảng rồi mới sang giai đoạn sau.
