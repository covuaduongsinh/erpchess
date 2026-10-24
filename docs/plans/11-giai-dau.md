# Giai đoạn 10 — Giải đấu

## Bối cảnh

- **Claim cần đóng** trong `rea/ledger.md`: `tour.swiss` (Swiss, Quad, Swiss đồng đội; vòng, thời gian, FEN tuỳ chỉnh) và `tour.auto` (tự hoàn tất vòng, tự lên lịch, lặp lại). Đặc tả: `rea/spec/choi-giai-dau.md` L18-39 (Tournament) và L63-71 (ánh xạ: `tournaments`, `tournament_players`, `tournament_rounds`, `pairings`; ghép cặp Swiss/vòng tròn trong `packages/chess-core` có test). Kế hoạch tổng `docs/plans/00-ke-hoach-tong.md` L203-208 (thêm vòng tròn; bảng xếp hạng realtime; xem dạng danh sách, bảng, lịch).
- **Dùng lại từ Giai đoạn 9:**
  - Bảng `games` (đồng hồ, kết quả, `version`, trigger phát `game:<id>`), Edge Function `game-move` (trọng tài server, rating Glicko-2 theo `category`), cách simul gắn ván bằng `simul_id` và chạy RPC bắt đầu / trigger kết thúc.
  - `replayGame`, `clock`, `formatPgn`, `glicko2Update` (`packages/chess-core`), `sync-shared.mjs`.
  - Web: trang ván `/a/$slug/play/$id`, `GameClock`, `resultText`, `TargetPicker`, `BoardEditor`, `TIME_PRESETS`, `calendarRange`/`weekDays` (Giai đoạn 8), presence học viện.
- **Hạ tầng cho phần tự động:** cloud có sẵn `pg_cron` và `pg_net` (chưa bật).
- **Quyết định thiết kế:**
  - Mỗi ván giải là một `games` có `tournament_id` + `round` → trang ván, đồng hồ, trọng tài, rating dùng nguyên.
  - Ghép cặp là **hàm thuần trong chess-core** (có test), chạy phía server trong Edge Function; client không tự ghép.
  - Swiss theo **Dutch rút gọn**: nhóm điểm, nửa trên gặp nửa dưới, tránh gặp lại, cân màu (lệch tối đa 2, không 3 ván cùng màu liên tiếp), đẩy người lẻ xuống nhóm dưới, bye cho người thấp nhất chưa từng được bye. Không cài đủ mọi luật chuyển vị của FIDE C.04.3 — ghi rõ trong tài liệu.

Kế hoạch con ghi vào `docs/plans/11-giai-dau.md`. Chia 3 PR, mỗi PR đủ quy trình commit → CI xanh → merge.

## PR 10a — Lõi giải đấu: ghép cặp + bảng xếp hạng + CSDL + điều hành phía server

1. **`packages/chess-core/src/tournament.ts`** (thuần, có test kỹ; thêm vào `sync-shared.mjs`):
   - `pairSwiss(players, history, round)` — Dutch rút gọn như trên; trả cặp `{white, black}` + `bye`.
   - `roundRobin(players)` — bảng Berger, đủ màu cân bằng, thêm "bye" khi số lẻ.
   - `quadGroups(players)` — chia nhóm 4 theo rating (nhóm cuối 3–5 người), mỗi nhóm đấu vòng tròn.
   - `pairTeamSwiss(teams, history, round, boards)` — ghép đội như Swiss theo điểm trận; mỗi trận N bàn, màu xen kẽ theo bàn.
   - `standings(players, results)` — điểm, Buchholz, Buchholz cắt 1, Sonneborn-Berger, số ván thắng; đội: điểm trận rồi điểm ván.
2. **Migration `…0017_tournaments.sql`:**
   - `tournaments(id, academy_id, title, description, location, format swiss|round_robin|quad|team_swiss, rounds, base_ms, inc_ms, rated, allow_draw, allow_resign, is_public, control manual|auto_finish|auto_schedule, start_kind standard|opening|fen, initial_fen, starts_at, timezone, round_interval_min, repeat none|daily|weekly|monthly, repeat_until?, parent_id?, status upcoming|active|finished, current_round, created_by…)`.
   - `tournament_players(tournament_id, player_id, team_id?, board_no?, seed_rating, withdrawn)`, `tournament_teams(id, tournament_id, name)`, `tournament_rounds(tournament_id, round, starts_at?, status pending|active|finished)`.
   - `games` thêm `tournament_id`, `round`, `board_no`; ván bye ghi ở `tournament_byes(tournament_id, round, player_id)`.
   - **RLS:** thành viên học viện đọc giải; staff tạo/sửa; học viên tự đăng ký vào giải `is_public` đang `upcoming` (hoặc rút lui). Cặp đấu và vòng chỉ do server ghi.
   - Trigger: ván giải xong → phát tín hiệu `tournament:<id>` (Realtime riêng tư, ai xem được giải thì nghe) để bảng xếp hạng cập nhật tức thì.
3. **Edge Function `tournament-admin`** (`{tournamentId, action: start|pair_round|finish_round|finish|withdraw}`), chỉ staff tạo giải / owner:
   - Đọc người chơi + lịch sử ván, gọi hàm ghép cặp, tạo `games` của vòng (đồng hồ, FEN đầu, `rated`, `category`), ghi bye.
   - Quad: tạo sẵn cả 3 vòng theo nhóm khi bắt đầu.
4. **`game-move`:** đọc cờ của giải (`allow_draw`, `allow_resign`); ván giải xong mà giải ở chế độ `auto_finish`/`auto_schedule` và cả vòng đã xong → tự ghép vòng kế (cùng mã ghép cặp đã chép sang function); vòng cuối xong → giải kết thúc.
5. **API `tournaments.ts`** + hook; **kiểm thử:** test thuần cho cả 4 thể thức + tiebreak; pgTAP `11_tournaments_rls.sql`; `phase10.integration.test.ts` (giải Swiss 3 người thử: owner + học viên thử + … dùng ván bye; tự ghép vòng 2 khi vòng 1 xong; không cho hoà khi `allow_draw = false`).

## PR 10b — Giao diện giải đấu (web + mobile)

1. **Tab "Giải đấu" `/a/$slug/tournaments`:**
   - Tìm theo tên / người chơi / địa điểm; lọc ngày (dùng lại M/Q/Y); sắp xếp; lọc trạng thái tất cả/đang diễn ra/sắp tới/đã xong.
   - Ba kiểu xem: danh sách, bảng (cột: tên, thể thức, thời gian, số người, trạng thái), lịch (lưới tháng dùng `calendarRange`/`weekDays`).
2. **Tạo giải 3 bước** (`/tournaments/new`):
   1. Chi tiết: tên, mô tả, địa điểm, thể thức, số vòng, thời gian (preset hoặc tự nhập phút + giây), rating, cho phép xin thua/hoà, công khai, điều khiển, kiểu ván (tiêu chuẩn / khai cuộc định sẵn — danh sách FEN tự soạn trong `domain` / FEN tuỳ chỉnh dựng bằng `BoardEditor`).
   2. Lịch: ngày giờ bắt đầu, múi giờ, khoảng cách giữa các vòng, lặp lại.
   3. Người chơi: `TargetPicker` (học viên/lớp); Swiss đồng đội thì chia đội và thứ tự bàn.
3. **Trang giải** `/tournaments/$id`: bảng xếp hạng (tự cập nhật qua `tournament:<id>`), các vòng và cặp đấu (bấm vào ván để xem/chơi), nút "Ván của tôi", nút đăng ký/rút lui (giải công khai), bảng điều khiển cho người tổ chức (bắt đầu, ghép vòng kế, kết thúc vòng, kết thúc giải).
4. **Mobile:** thẻ "Giải đấu" ở màn học viện (giải đang diễn ra + vòng hiện tại + vào ván của tôi qua màn `games/[id]` sẵn có).

## PR 10c — Tự lên lịch và giải lặp lại

1. **Migration `…0018_tournament_cron.sql`:** bật `pg_cron` + `pg_net`; bảng `private.cron_secrets` giữ một chuỗi bí mật sinh ngẫu nhiên trong CSDL (không rời khỏi CSDL, không vào repo); job `pg_cron` mỗi phút gọi `net.http_post` tới Edge Function `tournament-tick` kèm chuỗi đó.
2. **Edge Function `tournament-tick`** (`verify_jwt = false`, tự kiểm chuỗi bí mật bằng service role):
   - Giải `auto_schedule` tới giờ bắt đầu → bắt đầu + ghép vòng 1; vòng tới giờ → ghép vòng.
   - Giải lặp lại đã bắt đầu → tạo bản kế tiếp (sao chép thiết lập + người chơi, `parent_id`), dừng khi qua `repeat_until`.
3. **Kiểm thử:** test thuần cho hàm tính lịch lặp (`nextOccurrence`), gọi tick thủ công trong test tích hợp, xác nhận job cron chạy trên cloud (`cron.job_run_details`).

## Kiểm chứng

- Mỗi PR: `pnpm lint`, `typecheck`, `test`, `build`, `sync-shared --check`; CI 3 job xanh.
- pgTAP qua `to-mcp.mjs` + `execute_sql`; test tích hợp với tài khoản thử trong `it.env`.
- Chrome ở localhost (DSC1, chỉ có owner): giao diện danh sách / 3 kiểu xem / wizard / trang giải; không tạo giải có học viên thật. Luồng giải đầy đủ kiểm bằng test tích hợp trong học viện thử.
- Cuối giai đoạn: cập nhật `rea/ledger.md` và mục "Kết quả" trong `docs/plans/11-giai-dau.md`.

## Rủi ro và ghi chú

- **Dutch rút gọn** không trùng 100% với phần mềm FIDE (JaVaFo/bbpPairings); đủ cho giải nội bộ CLB. Có thể thêm "ghép tay" (HLV đổi cặp) ở bảng điều khiển nếu cần.
- **Ghép tự động trong `game-move`:** chạy ở request làm xong ván cuối của vòng; dùng `tournament_rounds.status` + ghi có điều kiện để hai ván xong cùng lúc không ghép trùng.
- **Cron:** chuỗi bí mật chỉ nằm trong CSDL; nếu lộ, kẻ xấu chỉ kích được việc ghép/tạo giải đúng lịch (idempotent), không đọc được dữ liệu.
- **Học viện thử chỉ có 1 học viên:** test tích hợp dùng owner + học viên thử + bye; giải đông người kiểm bằng test thuần của hàm ghép cặp.

## Kết quả

### PR 10a (2026-10-25)

- **chess-core `tournament.ts`** (hàm thuần, 19 test): `pairSwiss` (Dutch rút gọn, quay lui có giới hạn; nới ràng buộc màu rồi mới chấp nhận gặp lại khi không còn cách), `roundRobinRound` (Berger), `quadGroups`, `pairTeamSwiss`, `standings` (điểm, Buchholz cắt 1, Buchholz, Sonneborn-Berger, số ván thắng). Test mô phỏng giải 8–20 người tới 7 vòng: không gặp lại, bye không trùng, lệch màu ≤ 2, không 3 ván liền cùng màu.
- **domain `tournament.ts`:** `tournamentInputSchema`, `OPENING_PRESETS` (8 thế khai cuộc tự soạn, đã kiểm bằng chess.js), `nextOccurrence`.
- **Migration `…0017_tournaments.sql`:** `tournaments`, `tournament_teams`, `tournament_players` (`group_no` cho Quad, `withdrawn`), `tournament_rounds`, `tournament_byes`, `games.tournament_id/round/board_no`; RLS; trigger phát `tournament:<id>` khi ván giải đổi trạng thái.
- **Server:** `supabase/functions/_lib/tournament-run.ts` (bắt đầu, ghép vòng idempotent qua `tournament_rounds.status`, sau mỗi ván, kết thúc) — `sync-shared.mjs` mở rộng để chép `_lib` sang từng function. Edge Function `tournament-admin` (start/next_round/finish) mới; `game-move` thêm luật giải (`draw_not_allowed`, `resign_not_allowed`) và tự xử lý vòng sau mỗi ván giải. Bản triển khai lên Supabase ở dạng rút gọn tương đương (bỏ chú thích; `rules.ts` chỉ còn kiểu `Color`).
- **API `tournaments.ts`** + hook (`useTournament` nghe kênh `tournament:<id>`), `tournamentStandings`, `teamStandings`.
- **Kiểm chứng:** pgTAP `11_tournaments_rls.sql` 12/12; `phase10.integration.test.ts` 2/2 trên cloud (Swiss 2 vòng tự hoàn tất: không cho hoà, đầu hàng → server tự ghép vòng 2 → giải kết thúc, bảng xếp hạng 1–1; vòng tròn điều khiển tay: chưa xong vòng thì không ghép tiếp, kết thúc sớm huỷ ván dở).

### PR 10b (2026-10-25)

- **Tab "Giải đấu"** `/a/$slug/tournaments`: tìm theo tên / người chơi / địa điểm; lọc trạng thái; lọc tháng/quý/năm; sắp xếp (mới nhất, tên, số người chơi); ba kiểu xem danh sách / bảng / lịch tháng.
- **Tạo giải 3 bước** `/tournaments/new`: chi tiết (thể thức, số vòng, thời gian preset hoặc tự nhập, rating, cho phép hoà/xin thua, công khai, điều khiển, kiểu ván tiêu chuẩn / 8 khai cuộc định sẵn / FEN dựng bằng `BoardEditor`), lịch (giờ bắt đầu, múi giờ, khoảng cách vòng, lặp lại), người chơi (`TargetPicker`; Swiss đồng đội có trình chia đội theo thứ tự bàn).
- **Trang giải** `/tournaments/$id`: bảng xếp hạng (điểm, Buchholz cắt 1, SB, thắng; đội: điểm trận, điểm ván) tự cập nhật qua `tournament:<id>`; cặp đấu theo vòng; "Vào ván của tôi"; đăng ký/rút (giải công khai); người tổ chức bắt đầu / ghép vòng kế / kết thúc / rút người chơi / xoá.
- **Mobile:** thẻ "Giải đấu" (giải đang diễn ra/sắp tới, vòng hiện tại); ván giải hiện trong "Ván của tôi".
- **Kiểm chứng (Chrome, DSC1):** tạo "Giải mẫu (Claude)" qua 3 bước (khai cuộc định sẵn, 15/11 19:00, lặp hằng tuần, chưa có người chơi) → trang giải đúng; bấm bắt đầu → "Cần ít nhất 2 người chơi."; ba kiểu xem hiện giải (lịch tháng 11 ngày 15); xoá giải. Sửa tiêu đề cột trạng thái của kiểu bảng sau khi thử.

### PR 10c (2026-10-25)

- **Migration `…0018_tournament_cron.sql`:** bật `pg_cron` + `pg_net`; `private.cron_secrets` giữ chuỗi bí mật 64 ký tự hex sinh bằng `gen_random_bytes` ngay trong CSDL; RPC `cron_secret_ok` chỉ `service_role` gọi được (schema `private` không lộ qua REST); job `tournament-tick` mỗi phút gọi `net.http_post`.
- **Edge Function `tournament-tick`** (`verify_jwt = false`, tự kiểm chuỗi bí mật): bắt đầu giải tự lên lịch đã tới giờ, ghép vòng đã tới giờ, tạo lần tổ chức kế tiếp cho giải lặp lại đang diễn ra (sao chép thiết lập, đội, người chơi; `parent_id`). Chỉ sinh khi giải gốc đang diễn ra để xoá bản lặp sau khi giải gốc xong không bị tạo lại.
- **`nextOccurrence`** chuyển sang `chess-core/schedule.ts` để client và function dùng chung (có test; tháng ngắn lấy ngày cuối tháng).
- **Kiểm chứng:**
  - `cron.job_run_details` báo các nhịp `succeeded`; `net._http_response` trả 200 `{"started":0,"paired":0,"repeated":0}`.
  - Gọi function từ ngoài không có / sai chuỗi bí mật → 401.
  - `phase10.integration.test.ts` thêm test cron: giải `auto_schedule` giờ bắt đầu đã qua được cron bắt đầu; bản lặp hằng tuần được tạo đúng +7 ngày, đủ 2 người chơi; dọn dữ liệu sau test.
- **Lưu ý:** bản đã triển khai của `game-move` và `tournament-admin` chưa có `schedule.ts` (không cần cho việc của chúng); lần triển khai sau gửi kèm theo bản chép trong repo.
