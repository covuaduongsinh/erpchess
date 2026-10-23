# Giai đoạn 6 — Study (học liệu) và CSDL ván

## Bối cảnh

Khảo sát Chesslang (`rea/spec/hoc-lieu-study.md`) cho thấy **Study** là nguồn nội dung chung:
- Mỗi Study là chuỗi hoạt động có thứ tự.
- Quiz, khoá học và lớp học ở các giai đoạn sau đều lấy hoạt động từ Study.
- **Database** (kho ván PGN) là nguồn để tạo puzzle và hoạt động xem ván.

erpchess hiện có:
- **Lõi cờ:** `parsePgn` (nhiều ván, có biến), `GameTree`, `gradeMove`, `usePuzzleSession`, `UciEngine.play` (đặt được Elo, có `BOT_LEVELS`).
- **Bàn cờ web:** có mũi tên và tô ô. Chưa có trình dựng thế cờ.
- **Chấm bài:** Edge Function `submit-attempt` chấm lại phía server, dùng mã copy từ `chess-core` qua `supabase/functions/sync-shared.mjs`.
- **Chưa có:** Supabase Storage, nhập từ Lichess.

Mục tiêu là đóng các claim `study.*`, `db.pgn-upload`, `db.sync` trong `rea/ledger.md`.

Kế hoạch con sẽ ghi vào `docs/plans/07-study-csdl-van.md`. Chia 4 PR, mỗi PR đều đi trọn quy trình commit → CI xanh → merge.

## Phạm vi

### Loại hoạt động

| Loại          | Payload (jsonb)                                                              | Cách chấm                                     |
| ------------- | ---------------------------------------------------------------------------- | --------------------------------------------- |
| `puzzle`      | `{fen, moves[]}`                                                             | Server, bằng `gradeMove`                      |
| `mcq`         | `{question, fen?, imageUrl?, options[2–6], correct}`                         | Server, so chỉ số đáp án                      |
| `capture`     | `{fen, side}`: bàn chỉ có quân của học viên và quân đối phương, không có vua | Server, kiểm luật bắt quân mới                |
| `explanation` | `{body}` (Markdown rút gọn), `fen?`, `arrows?`                               | Ghi "đã xem"                                  |
| `engine`      | `{fen, side, elo, goal: 'win' \| 'draw'}`                                    | Client tự báo kết quả (ghi rõ đây là tự khai) |
| `video`       | `{url}`: YouTube/Vimeo hoặc tệp trong Storage                                | Ghi "đã xem"                                  |
| `game`        | `{pgn}`: xem ván có biến và chú thích                                        | Ghi "đã xem"                                  |
- **Không làm "Trang HTML"** (⛔ trong sổ cái), vì nhúng HTML tuỳ ý dễ bị XSS. Hoạt động "Giải thích" thay chỗ của nó.
- **Thuộc tính chung** của mọi hoạt động: `title`, `points` (mặc định 10), `max_attempts`, `time_limit_s?`, `wrong_penalty`, `hint_penalty`, `topics[]`.

### Phạm vi hiển thị Study

- **`private`:** chỉ tác giả thấy.
- **`academy`:** mọi thành viên của học viện thấy.
- **`public`:** thư viện chung. Gồm `academy_id null` do nền tảng soạn, hoặc HLV chủ động công khai.
- **Bản nháp:** chỉ lưu khi đã có tên. Không tự sinh bản nháp như Chesslang.

## PR 6a — CSDL, luật bắt quân, chấm bài phía server

1. **Migration `20261024000006_studies.sql`:**
   - **Bảng:**
     - `studies(id, academy_id null, title, description, level_id?, visibility, created_by, timestamps)`
     - `study_activities(id, study_id, position, kind, title, payload jsonb, points, max_attempts, time_limit_s, wrong_penalty, hint_penalty, topics text[])`, ràng buộc `unique(study_id, position) deferrable`
     - `study_collections(id, academy_id, name, created_by)`, `study_collection_items(collection_id, study_id, position)`
     - `activity_attempts(activity_id, student_id, tries, solved, score, time_ms, answers jsonb, finished_at, updated_at)`, `unique(activity_id, student_id)`. Client không được ghi; chỉ Edge Function ghi.
     - View `study_progress` (security_invoker): số hoạt động đã xong và điểm theo học viên × study.
   - **Quyền (RLS):**
     - Đọc Study: tác giả; thành viên học viện khi `academy`; mọi người dùng đã đăng nhập khi `public`.
     - Ghi Study: staff của học viện, và phải là tác giả hoặc owner.
     - Study công khai của nền tảng (`academy_id null`) chỉ service role ghi được.
   - **Storage:** bucket `study-media`, đường dẫn `<academy_id>/<study_id>/<file>`. Thành viên học viện đọc, staff ghi. Giới hạn 100 MB; chỉ nhận video/mp4, webm và ảnh.
   - **Hàm `activity_for_student(p_activity, p_student)`** (chỉ service role gọi): trả `kind` và `payload` khi học viên được xem study đó.
2. **`packages/chess-core/src/capture.ts`:**
   - Sinh nước cho quân của học viên trên bàn không có vua, không xét chiếu.
   - `playCaptureMove(fen, uci)` trả `null` nếu nước sai luật, hoặc nếu đi tới ô trống mà không bắt được quân nào.
   - `gradeCapture(fen, moves)` trả `{solved, captured, remaining}`.
   - Có test: xe, tượng, mã, hậu, tốt.
3. **`packages/domain/src/study.ts`:**
   - Schema Zod cho từng loại payload (discriminated union theo `kind`).
   - `studyVisibility`, `activityKinds`.
   - `scoreActivity(points, tries, hintsUsed, penalties)`.
   - Test.
4. **Edge Function `submit-activity`:**
   - Request: `{activityId, answer}`, trong đó `answer` là `{moves}` (puzzle/capture), `{choice}` (mcq), `{result}` (engine) hoặc `{viewed: true}`.
   - Chấm lại phía server, rồi upsert `activity_attempts` theo cùng logic của `submit-attempt`.
   - Mở rộng `sync-shared.mjs` để copy thêm `capture.ts`.
5. **Kiểm thử:** pgTAP `04_studies_rls.sql`; sinh lại `database.types.ts`.

## PR 6b — CSDL ván (Database) và nhập dữ liệu

1. **Migration `20261024000007_game_databases.sql`:**
   - `game_databases(id, academy_id, name, visibility private|academy, created_by)`.
   - `database_games(id, database_id, white, black, result, event, date text, eco, white_elo, black_elo, ply_count, start_fen, pgn)`, có index tìm theo tên kỳ thủ và giải.
   - RLS cùng kiểu với Study.
2. **`packages/api`:**
   - Query `fetchDatabases`, `createDatabase`, `importPgn(dbId, text)`: parse ở client bằng `parsePgn`, chèn theo lô 200 ván, báo số ván lỗi.
   - `searchGames` phân trang.
   - Hàm thuần `gameSummary(tree)` lấy thông tin tiêu đề ván; đặt trong `chess-core` và có test.
3. **Nhập từ Lichess** (gọi thẳng từ client, API công khai có CORS):
   - Study công khai: `https://lichess.org/api/study/{id}.pgn`. Mỗi chương thành một hoạt động `game`, hoặc thành `puzzle` nếu chương có FEN và nước giải.
   - Ván của người dùng: `https://lichess.org/api/games/user/{name}?max=50` (application/x-chess-pgn), đưa vào CSDL.
   - Hàm thuần `lichessStudyUrl(input)` nhận link hoặc id; có test.
4. **Web, route `/a/$slug/database`, bố cục 3 cột** như đặc tả:
   - Danh sách CSDL.
   - Danh sách ván (tìm kiếm, phân trang).
   - Trình xem ván, dùng lại `MoveList` và bàn cờ chỉ xem.
   - Có nút "Mở ở bàn phân tích" (`/analysis?fen=`) và "Tạo puzzle từ đây": chọn nước bắt đầu và số nước giải.

## PR 6c — Trình dựng Study (web/desktop)

1. **`packages/board-web/src/BoardEditor.tsx`:**
   - Bảng quân để chọn, bấm vào ô để đặt hoặc xoá quân.
   - Các nút: thế ban đầu, xoá bàn, lượt đi, lật bàn.
   - Xuất FEN.
   - Chế độ `allowNoKings` cho hoạt động bắt quân.
   - Test bằng Testing Library.
2. **Routes:**
   - `/a/$slug/studies`: tab Của tôi / Học viện / Công khai, tìm kiếm, Collections.
   - `/a/$slug/studies/new`: chỉ hỏi tên, cấp độ, phạm vi; tạo xong thì chuyển sang trình dựng.
   - `/a/$slug/studies/$id/edit`: danh sách hoạt động (thêm, sửa, xoá, đổi thứ tự lên/xuống) và form theo từng loại.
3. **Form theo loại hoạt động:**
   - **Puzzle:** dựng thế cờ rồi đi các nước giải trên bàn; hoặc lấy từ thư viện puzzle hiện có / từ CSDL ván.
   - **MCQ:** câu hỏi, có thể kèm thế cờ, 2–6 phương án, chọn đáp án đúng.
   - **Bắt quân:** dựng bàn không có vua, chọn phe; chặn lưu nếu không bắt hết được (kiểm bằng tìm kiếm có giới hạn số nước).
   - **Giải thích:** ô Markdown, xem trước, thế cờ tuỳ chọn.
   - **Đánh máy:** FEN, phe cầm, mức máy theo `BOT_LEVELS`, mục tiêu.
   - **Video:** dán link hoặc tải tệp lên Storage.
   - **Xem ván:** dán PGN hoặc chọn từ CSDL.
4. **Thêm tab "Học liệu" và "CSDL ván"** cho staff trong `a.$slug.tsx`.

## PR 6d — Học viên học Study (web + mobile) và thư viện công khai

1. **Web, route `/a/$slug/studies/$id`:** trình học đi qua từng hoạt động, có thanh tiến độ và điểm. Mỗi loại một component:
   - `PuzzleSolver` dùng lại bản có sẵn.
   - `McqActivity`, `CaptureActivity` (dùng `capture.ts` để báo đúng/sai ngay).
   - `ExplanationActivity`: Markdown an toàn, tự render không qua HTML thô.
   - `EngineActivity`: dùng `getEngine()` + `UciEngine.play`, theo dõi kết quả bằng `gameStatus`.
   - `VideoActivity`: iframe YouTube/Vimeo với `sandbox`, hoặc thẻ `<video>`.
   - `GameViewer`: dùng `MoveList` + bàn cờ chỉ xem.
   - Kết quả nộp qua `useSubmitActivity`.
2. **Mobile:**
   - Học viện có thẻ "Học liệu"; màn `studies/[id].tsx` có puzzle, MCQ, bắt quân, giải thích, xem ván.
   - Video mở bằng `expo-web-browser` (đã có sẵn hay chưa thì kiểm `package.json`; nếu chưa có thì dùng `Linking`).
   - Đánh máy hiện "Dùng trên web/desktop", vì engine mobile thuộc bước 7.
3. **Thư viện công khai:** khoảng 5 study tiếng Việt do mình tự soạn:
   - Bàn cờ và toạ độ (MCQ).
   - Xe bắt quân (bắt quân).
   - Tượng bắt quân (bắt quân).
   - Chiếu hết 1 nước (puzzle lấy từ `supabase/seed/puzzles.json`).
   - Một ván mẫu có chú thích tự viết.

   Sinh SQL bằng script giống `supabase/seed/to-sql.mjs`. Không dùng học liệu của Chesslang.

## Mã dùng lại

- **`packages/chess-core`:** `gradeMove`, `usePuzzleSession`, `parsePgn` / `toPgn` / `GameTree`, `playMove` / `legalDests` / `gameStatus`.
- **Engine:**
  - `packages/engine`: `UciEngine.play`, `BOT_LEVELS`.
  - `apps/web/src/lib/engine.ts`: `getEngine()`, `useEngine()`.
- **Giao diện web:**
  - `apps/web/src/components/analysis/MoveList.tsx`, `AnalysisBoard.tsx` (cho nút "Mở ở bàn phân tích").
  - `PuzzleSolver` của web và mobile.
- **Chấm bài:** `supabase/functions/submit-attempt` làm khuôn cho `submit-activity`; `sync-shared.mjs`.
- **Truy vấn:** mẫu `unwrap` / `ApiError` / hook trong `packages/api/src/queries.ts` và `react.tsx`.

## Kiểm chứng

- **Mỗi PR:** `pnpm lint`, `typecheck`, `test`, `build` xanh; CI 3 job xanh; `sync-shared.mjs --check`.
- **pgTAP** (chạy qua `to-mcp.mjs` trên cloud):
  - Học viên không đọc được study `private` của người khác.
  - Không ghi được `activity_attempts`.
  - Học viện khác không đọc được study `academy`.
- **Test tích hợp** `phase6.integration.test.ts` trên cloud:
  - HLV tạo study có 3 hoạt động (puzzle, MCQ, bắt quân).
  - Học viên nộp sai rồi đúng; điểm và tiến độ ra đúng.
  - Nhập 1 tệp PGN nhiều ván vào CSDL.
- **Xem tận mắt trên Chrome ở localhost** bằng phiên đăng nhập sẵn của chủ dự án (học viện DSC1): tạo study, học thử từng loại hoạt động, nhập PGN.
- **Cập nhật** `rea/ledger.md` và mục "Kết quả" trong `docs/plans/07-study-csdl-van.md`.

## Rủi ro và ghi chú

- **Đáp án lộ cho học viên:** payload chứa đáp án và học viên đọc được (giống Giai đoạn 4). Điểm vẫn do server chấm nên không gian lận được; sẽ ẩn đáp án khi làm Quiz ở Giai đoạn 7.
- **Kết quả "Đánh máy" do client tự báo.** Kiểm phía server cần chạy engine trên server, nên để sau.
- **Masterbase (ván cao thủ) chưa làm,** vì cần nguồn dữ liệu có giấy phép mở.

## Kết quả

### PR 6a (2026-10-24)

- **Migration:**
  - `20261024000006_studies.sql`: study, hoạt động, collection, lần làm, view `study_progress`, bucket `study-media`, hàm `activity_for_student`.
  - `…000007`: sửa policy SELECT để `INSERT … RETURNING` chạy được.
- **Chess-core:** `capture.ts` có luật bắt quân không cần vua, chấm cả chuỗi nước, `solveCapture` tìm số nước ít nhất.
- **Domain:** schema 7 loại hoạt động, `scoreActivity`, `estimateMinutes`.
- **API:** `packages/api/src/studies.ts` và các hook React.
- **Edge Function `submit-activity`:**
  - Chấm lại phía server: puzzle, MCQ, bắt quân.
  - "Đánh máy" do client tự báo kết quả; giải thích, video, xem ván chỉ ghi "đã xem".
  - Giới hạn số lần thử; phạt điểm theo số lần sai.
- **Kiểm chứng:**
  - pgTAP `04_studies_rls.sql`: 21/21 trên cloud.
  - `phase6.integration.test.ts` đạt trên cloud: phạt 4 điểm khi sai một lần, chặn lần thử thứ 3, bắt quân đúng, tiến độ 2/3 hoạt động với 26 điểm.
- **Ghi chú:** bản Edge Function đã triển khai dùng bản chép `_shared` đã lược chú thích; logic giống hệt mã sinh bởi `sync-shared.mjs`.

### PR 6b (2026-10-24)

- **Migration `…000008_game_databases.sql`:** `game_databases` và `database_games` (index trigram để tìm ván); RLS kiểm trên cột của dòng nên `INSERT … RETURNING` chạy được.
- **Chess-core:** `splitPgn` (tách ván, một ván hỏng không làm hỏng cả tệp) và `gameSummary`.
- **API:**
  - `databases.ts`: nhập PGN theo lô 200 ván, tìm ván có phân trang.
  - Lichess: lấy ván của người chơi, PGN study công khai. Study chỉ nhận dạng link, vì mã 8 ký tự trùng dạng tên người chơi; lỗi này phát hiện khi chạy thử "thibault".
- **Web:**
  - Tab "CSDL ván": danh sách CSDL, nhập (tệp, dán, Lichess), danh sách ván, trình xem ván.
  - `GameViewer` dùng chung: phím mũi tên, lật bàn, nút "Mở ở bàn phân tích".
- **Kiểm chứng:**
  - `phase6.integration.test.ts` (2 test) đạt trên cloud: nhập 3 ván thì bỏ 1 ván hỏng; tìm theo tên giải; học viên không thấy CSDL riêng.
  - Thử trên Chrome bằng tài khoản chủ dự án: nhập 50 ván Lichess, không ván nào lỗi; xem ván và đi nước bằng phím. Sau đó đã xoá CSDL thử.
- **Để sau:** tạo puzzle trực tiếp từ một thế trong ván (làm cùng trình soạn ở PR 6c); đồng bộ Chess.com; Masterbase.
