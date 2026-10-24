# Giai đoạn 9 — Game Area và Simul

## Bối cảnh

- **Claim cần đóng** trong `rea/ledger.md`: `play.game`, `play.pairing`, `play.bot` (đang 🟡), `play.simul`, và `org.rating` (🟡: "chưa cập nhật từ ván đấu"). Đặc tả: `rea/spec/choi-giai-dau.md` (Game Area L3-10, Simul L12-16, ánh xạ L63-71); kế hoạch tổng `docs/plans/00-ke-hoach-tong.md` L195-201.
- **Đã có để dùng lại:**
  - `chess-core`: `playMove`, `legalDests`, `gameStatus`, `inCheck`, `toPgn`/`parsePgn`, `glicko2Update`.
    - Lưu ý: `gameStatus(fen)` không biết lặp 3 lần → server phải đi lại cả danh sách nước.
  - `engine`: `BOT_LEVELS`, `UciEngine.play(fen, {elo, movetimeMs})`.
  - `EngineGame` (`apps/web/src/components/study/ActivityPlayer.tsx`), `getEngine()` / `useEngine()`.
  - Bảng `ratings` (classical/rapid/blitz, Glicko-2; học viên không tự ghi).
  - Mẫu Edge Function (`submit-attempt`, `quiz-answer`) và `sync-shared.mjs`.
  - Realtime riêng tư + policy trên `realtime.messages` (Giai đoạn 8b).
  - `Board` web/native, `TargetPicker`, `useMembers`.
- **Chưa có:** đồng hồ, bảng ván đấu, presence toàn học viện, cập nhật rating từ ván.
- **Quyết định thiết kế:** ván 1–1 do **server làm trọng tài**. Mọi nước đi qua Edge Function `game-move`: kiểm luật, trừ đồng hồ theo giờ server, phát hiện kết thúc (kể cả lặp 3 lần, hết giờ), cập nhật rating. Trigger CSDL đẩy trạng thái mới qua Realtime riêng tư `game:<id>`; client không tự ghi bảng `games`.

Kế hoạch con ghi vào `docs/plans/10-game-area-simul.md`. Chia 3 PR, mỗi PR đủ quy trình commit → CI xanh → merge.

## PR 9a — Lõi ván đấu: luật + đồng hồ + CSDL + trọng tài server + rating

1. **`packages/chess-core`** (có test, thêm vào `sync-shared.mjs`):
   - `game.ts`: `replayGame(initialFen, moves)` → `{fen, sans, status: ongoing|checkmate|stalemate|repetition|insufficient|fifty}` (đếm vị trí để bắt lặp 3 lần).
   - `clock.ts`: `TimeControl {baseMs, incMs}`, `clockAfterMove(clock, side, now)`, `remaining(clock, now)`, `flagged(clock, now)`, `categoryOf(tc)` → blitz (<10 phút) / rapid (<60 phút) / classical.
2. **Migration `…0014_games.sql`:**
   - `games(id, academy_id, white_id, black_id, initial_fen, moves text[], fen, base_ms, inc_ms, white_ms, black_ms, turn_started_at, status pending|active|finished|aborted, result '1-0'|'0-1'|'1/2-1/2', reason, rated, category, draw_offer_by, simul_id?, bot_elo?, pgn, created_by, created_at, started_at, finished_at)`.
   - **RLS:** người chơi, staff học viện, phụ huynh của người chơi đọc; thành viên học viện đọc ván `active` (xem trực tiếp). Ghi: staff tạo ván ghép cặp (`pending`); học viên chỉ tạo ván máy đã kết thúc (`bot_elo` khác null, không tính rating). Mọi cập nhật ván người–người qua service role.
   - Trigger `games` → `realtime.send` tới topic riêng tư `game:<id>` (trạng thái rút gọn); policy `realtime.messages`: ai đọc được ván thì nghe được.
3. **Edge Function `game-move`** (`{gameId, action: move|resign|offer_draw|accept_draw|decline_draw|abort|claim_timeout, move?, ply?}`):
   - Chỉ người chơi đúng lượt; `ply` lệch → 409 `out_of_sync`.
   - Đồng hồ tính theo `now()` server; đi khi đã hết giờ → thua vì hết giờ.
   - Nước đầu của mỗi bên không trừ giờ; abort được trước nước thứ hai.
   - Kết thúc: ghi kết quả, lý do, PGN (`toPgn`); nếu `rated` thì cập nhật `ratings` hai người bằng `glicko2Update` theo `category`.
4. **`packages/api/src/games.ts`** + hook: tạo cặp, danh sách ván (của tôi, đang diễn ra, lịch sử), `gameAction`, `useGame` (tải ván + nghe `game:<id>`, đồng hồ đếm ở client chỉ để hiển thị).
5. **Kiểm thử:**
   - Domain: lặp 3 lần, đồng hồ (increment, hết giờ, nước đầu).
   - pgTAP `09_games_rls.sql`.
   - `phase9.integration.test.ts`: HLV ghép cặp owner–học viên thử, đi vài nước qua `game-move`, nước sai/lệch lượt bị từ chối, xin hoà–đồng ý, rating cập nhật, người ngoài không đọc được.

## PR 9b — Game Area (web + mobile), đánh máy

1. **Presence học viện:** topic `academy:<id>:online` (policy: thành viên học viện). Hook `useAcademyPresence` — web và mobile cùng báo online khi mở app trong học viện.
2. **Web tab "Chơi cờ" `/a/$slug/play`:**
   - Thẻ "Ván hôm nay", danh sách học viên online, ván đang diễn ra (bấm để xem), lịch sử ván (lọc theo học viên).
   - HLV "Tạo cặp đấu": chọn hai học viên (ưu tiên đang online), thời gian (preset 3+2, 5+0, 10+0, 15+10, 30+0), màu (ngẫu nhiên/chỉ định), tính rating hay không.
   - `/a/$slug/play/$id`: bàn cờ + đồng hồ hai bên, nút đầu hàng / xin hoà / huỷ ván, danh sách nước; người xem chỉ theo dõi; ván xong hiện kết quả, thay đổi rating, nút mở trong bàn phân tích.
   - `/a/$slug/play/bot`: chọn mức trong `BOT_LEVELS`, màu, thời gian (tuỳ chọn); dùng lại logic `EngineGame` (tách phần chơi máy thành hook dùng chung); ván xong lưu vào `games` với `bot_elo` (không tính rating).
3. **Mobile:** thẻ "Ván của tôi" ở màn học viện + màn `games/[id]` để chơi ván 1–1 (bàn native, đồng hồ, đầu hàng/xin hoà). Đánh máy vẫn chỉ trên web/desktop.
4. **Kiểm thử:** test tích hợp presence (hai client cùng học viện thấy nhau, học viện khác không vào được); Chrome: ghép cặp owner với học viên thử, chơi bằng script cho phía học viên.

## PR 9c — Simul

1. **Migration `…0015_simuls.sql`:** `simuls(id, academy_id, title, description, host_id, starts_at, base_ms, inc_ms, host_color, status upcoming|active|finished, created_by)`; mỗi bàn là một `games` có `simul_id`. Bắt đầu simul → các ván chuyển `active` cùng lúc. Simul không trừ đồng hồ của chủ simul (`base_ms` null phía host).
2. **`game-move`** hiểu ván simul (đồng hồ chỉ tính cho học viên nếu có); simul kết thúc khi mọi bàn xong.
3. **Web `/a/$slug/simuls`:** thống kê tổng / đang diễn ra / sắp tới / đã xong, tìm theo tên–mô tả, tạo simul (chọn học viên/lớp bằng `TargetPicker`); trang simul: chủ simul thấy lưới bàn nhỏ, bàn đang chờ mình đi nổi lên trước, bấm vào để đi; học viên vào ván của mình qua `/play/$id`.
4. **Kiểm thử:** pgTAP + test tích hợp simul 2 bàn; Chrome tạo "Simul mẫu (Claude)".

## Kiểm chứng

- Mỗi PR: `pnpm lint`, `typecheck`, `test`, `build`, `sync-shared --check`; CI 3 job xanh.
- pgTAP qua `to-mcp.mjs` + `execute_sql`; test tích hợp với tài khoản thử trong `it.env` (owner `e2e` + học viên thử).
- Chrome ở localhost (phiên chủ dự án, DSC1): chỉ ghép cặp/simul với tài khoản thử hoặc owner, không tạo ván cho học viên thật; dữ liệu thử ghi "(Claude)".
- Cuối giai đoạn: cập nhật `rea/ledger.md` và mục "Kết quả" trong `docs/plans/10-game-area-simul.md`.

## Rủi ro và ghi chú

- **Độ trễ:** mỗi nước đi một lượt gọi Edge Function (~200–500 ms); đồng hồ trừ theo giờ server nên độ trễ mạng tính vào người đi. Chấp nhận cho cờ nhanh từ 3 phút; không hỗ trợ bullet.
- **Hết giờ khi đối thủ bỏ đi:** client của bên còn lại gửi `claim_timeout` khi đồng hồ hiển thị về 0; server kiểm lại theo giờ server.
- **Rating:** mỗi ván là một kỳ Glicko-2 riêng (đơn giản, như nhiều nền tảng online); ván máy không tính.
- **Đánh máy** vẫn chạy engine trong trình duyệt, kết quả tự báo (như Practice).

## Kết quả

### PR 9a (2026-10-25)

- **chess-core:** `game.ts` (`replayGame` đi lại cả ván để bắt lặp 3 lần, `resultOf`, `lossFor`, `formatPgn`) và `clock.ts` (`clockAfterMove` — hai nước đầu không trừ giờ, `remaining`, `flagged`, `categoryOf`), có test; chép sang `game-move` qua `sync-shared.mjs`.
- **Migration `…0014_games.sql`:** bảng `games` (đồng hồ, kết quả, lý do, PGN, `rating_change`, `version` để ghi có điều kiện); RLS: staff ghép cặp, học viên tự lưu ván đánh máy đã xong (không tính rating), thành viên xem ván đang diễn ra; trigger `realtime.send` tới kênh riêng tư `game:<id>`.
- **Edge Function `game-move`** (đã triển khai): lượt đi, lệch bước (`out_of_sync`), nước sai, hết giờ theo giờ server, đầu hàng, xin/nhận/từ chối hoà, huỷ (trước nước thứ hai; staff huỷ bất kỳ lúc nào), PGN, cập nhật `ratings` bằng Glicko-2. Bản triển khai được gửi lên ở dạng rút gọn tương đương (cùng logic, bỏ chú thích); mã nguồn trong repo là bản chuẩn.
- **API:** `games.ts` (`createPairing`, `fetchGames`, `gameAction`, `saveBotGame`, `subscribeGame`, `TIME_PRESETS`), `edge.ts` (`invokeEdge` dùng chung, `classrooms.ts` chuyển sang dùng); hook `usePlayGames`, `useGame` (nhận trạng thái theo `version`), `useGameAction`, `useGameMutations`.
- **Kiểm chứng:** chess-core 76 test; pgTAP `09_games_rls.sql` 14/14; `phase9.integration.test.ts` đạt trên cloud (sai lượt, lệch bước, nước sai bị từ chối; học viên nhận trạng thái qua Realtime; hoà theo thoả thuận có PGN và thay đổi rating; đầu hàng; huỷ ván).

### PR 9b (2026-10-25)

- **Presence học viện** (migration `…0015_academy_presence.sql`): kênh riêng tư `academy:<id>:online`, chỉ thành viên nghe/báo. `useAcademyPresence` gắn ở layout học viện (web) và màn học viện (mobile); danh sách online đi qua `AcademyContext`.
- **Web tab "Chơi cờ"** `/a/$slug/play`: số ván hôm nay, học viên online, ván đang diễn ra, lịch sử (lọc theo học viên), HLV "Tạo cặp đấu" (người online lên trước, preset 3+2/5+0/10+0/15+10/30+0 hoặc không giới hạn, bốc thăm màu, tính rating).
- **Trang ván** `/a/$slug/play/$id`: đồng hồ hai bên đếm theo dữ liệu server, tự gửi `claim_timeout` khi đồng hồ đối thủ về 0, đầu hàng (bấm hai lần), xin/nhận/từ chối hoà, huỷ ván, danh sách nước, thay đổi rating, sao chép PGN (trang phân tích hiện chỉ nhận FEN).
- **Đánh máy** `/a/$slug/play/bot`: hook mới `useBotGame` (đi lại cả ván bằng `replayGame` nên bắt được lặp 3 lần); chưa có đồng hồ; ván lưu vào lịch sử, không tính rating. `EngineGame` của Study giữ nguyên, không tách chung (khác kế hoạch).
- **Mobile:** thẻ "Ván của tôi" + màn `games/[id]` chơi ván 1–1 (đồng hồ, hoà, đầu hàng, huỷ).
- **Kiểm chứng:**
  - `phase9.integration.test.ts` thêm test presence: hai client cùng học viện thấy nhau, học viện khác bị từ chối.
  - Chrome (DSC1, chỉ có owner): Game Area hiện owner online, form ghép cặp hiện đúng (không bấm tạo); đánh máy Elo 1400: 1. e4 Nc6, đầu hàng → lưu "Đen thắng · đầu hàng" vào lịch sử, trang ván hiện PGN và nước đi.
  - Chưa thử ván 1–1 thật trên Chrome vì DSC1 không có học viên để ghép mà không đụng dữ liệu thật; phần này đã có test tích hợp hai client ở PR 9a.
