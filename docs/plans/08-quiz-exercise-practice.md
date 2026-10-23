# Giai đoạn 7 — Quiz, Exercise, Practice

## Bối cảnh

- **Claim cần đóng** trong `rea/ledger.md`: `quiz.core`, `quiz.auto`, `quiz.leaderboard`, `hw.split`, `practice.chapters`. Đặc tả gốc: `rea/spec/quiz-bai-tap-luyen.md`.
- **Quiz trên Chesslang:**
  - Lấy hoạt động từ Study hoặc Database.
  - Riêng tư hoặc mở cho tất cả học viên; hoặc giao cho học viên/Batch/Group cụ thể.
  - Có lịch bắt đầu, hạn chót, bảng xếp hạng, góc nhìn học viên.
  - "Quiz tự động" sinh theo cấp độ.
- **Exercise** là bài tập soạn một lần, giao nhiều lần (tách khỏi lần giao).
- **Practice** là các chương thế cờ để luyện với máy.
- **Món nợ đã hứa từ Giai đoạn 4–6:** học viên đọc được đáp án qua API. Quiz là bài kiểm tra nên **phải giấu đáp án**:
  - Học viên chỉ nhận đề.
  - Puzzle được chấm **từng nước phía server**; server trả nước đáp của đối phương.

**Có sẵn để dùng lại:**
- `gradeMove` / `gradeCapture` (`packages/chess-core`), bản chép cho Deno qua `supabase/functions/sync-shared.mjs`.
- `submit-activity` làm khuôn Edge Function.
- `activityInputSchema` (`packages/domain/src/study.ts`), `useStudy` / `fetchStudies` (`packages/api/src/studies.ts`).
- `ActivityPlayer` web/mobile (trắc nghiệm, bắt quân), `PuzzleSolver`, `BoardEditor`, `getEngine()` (`apps/web/src/lib/engine.ts`).
- `assignments` (Giai đoạn 4), `levels` (Giai đoạn 5), mẫu RLS và test pgTAP / test tích hợp.

Kế hoạch con ghi vào `docs/plans/08-quiz-exercise-practice.md`. Chia 3 PR, mỗi PR đi đủ quy trình commit → CI xanh → merge.

## PR 7a — CSDL Quiz và chấm từng nước phía server (giấu đáp án)

1. **Migration `…0009_quizzes.sql`:**
   - **Bảng:**
     - `quizzes(id, academy_id, title, level_id?, topics[], open_to_all bool, starts_at?, due_at?, auto bool, created_by, created_at)`.
     - `quiz_items(id, quiz_id, position, kind in (puzzle, mcq, capture), title, payload jsonb, points, max_attempts?, wrong_penalty, source_activity_id?)`. Lưu bản chụp payload nên sửa Study về sau không làm đổi Quiz đã giao.
     - `quiz_targets(quiz_id, group_id | student_id)`, giống `assignment_targets`.
     - `quiz_attempts(item_id, student_id, tries, solved, score, time_ms, answers jsonb, state jsonb, finished_at, updated_at)`, unique `(item_id, student_id)`. Cột `state` giữ bước hiện tại của puzzle.
   - **RLS:**
     - Staff đọc và ghi trong học viện mình.
     - **Học viên không được SELECT `quiz_items`.**
     - Học viên đọc `quizzes` khi quiz `open_to_all`, hoặc khi được giao (trực tiếp hoặc qua lớp).
     - Phụ huynh đọc như con.
     - `quiz_attempts` chỉ Edge Function ghi.
   - **RPC `quiz_items_for_student(p_quiz)`** (security definer): trả đề đã lược đáp án.
     - Puzzle chỉ còn `{fen}`.
     - Trắc nghiệm còn `{question, fen?, options}`.
     - Bắt quân còn `{fen}` (bài này không có đáp án để giấu).
     - Chỉ trả khi quiz đã mở (`starts_at` ≤ hiện tại).
   - **RPC `quiz_leaderboard(p_quiz)`:** học viên xếp theo tổng điểm rồi tổng thời gian; ai xem được quiz thì xem được bảng.
   - **View `quiz_progress`** (security_invoker).
   - **Hàm service-role `quiz_item_for_student(p_item, p_student)`:** trả đáp án để chấm, kèm `starts_at` và `due_at`.
2. **Edge Function `quiz-answer`:**
   - **Puzzle**, `{itemId, move}`, chấm từng nước:
     - Server đọc `state.step` và chấm bằng `gradeMove`.
     - Đúng: trả `{ok, reply, solved}` và lưu bước mới.
     - Sai: kết thúc lượt thử (tries + 1, đặt lại bước), trả `{ok: false}`.
   - **Trắc nghiệm** `{choice}` và **bắt quân** `{moves}`: chấm một lần như `submit-activity`.
   - Từ chối `quiz_not_started`, `quiz_closed` (quá hạn), `no_attempts_left`.
   - Điểm = `points` trừ `wrong_penalty` × số lần sai.
   - Thêm `quiz-answer` vào `sync-shared.mjs`.
3. **`packages/domain/src/quiz.ts`:**
   - Schema tạo quiz, `quizStatus(startsAt, dueAt, now)` trả `upcoming | open | closed`.
   - Hàm lược đáp án dùng chung để test.
4. **`packages/api/src/quizzes.ts`:**
   - Hàm: `createQuiz` (sao chép hoạt động từ Study hoặc puzzle từ thư viện; nếu lỗi thì xoá quiz vừa tạo), `fetchQuizzes`, `fetchQuizForStudent`, `answerQuizItem`, `fetchQuizLeaderboard`, `fetchQuizProgress`.
   - Hook React tương ứng.
5. **Kiểm thử:**
   - pgTAP `05_quizzes_rls.sql`: học viên không đọc được `quiz_items`; quiz chưa mở thì không có đề; học viện khác không thấy.
   - Test tích hợp `phase7.integration.test.ts` trên cloud: puzzle 3 nước chấm từng nước (sai rồi đúng), trắc nghiệm, quá hạn bị chặn, bảng xếp hạng.

## PR 7b — Giao diện Quiz (web + mobile)

- **Web, `/a/$slug/quizzes`:** các tab Quiz / Góc nhìn học viên / Bảng xếp hạng; lọc theo trạng thái (sắp tới, đang mở, đã đóng).
- **Web, `/a/$slug/quizzes/new`:**
  - Tên, cấp độ, chủ đề.
  - Nội dung: chọn hoạt động từ Study (của tôi / học viện / thư viện chung; chỉ puzzle, trắc nghiệm, bắt quân) hoặc từ thư viện puzzle.
  - Phạm vi: mở cho tất cả, hoặc chọn học viên / lớp / Batch.
  - Lịch bắt đầu, hạn chót.
- **Web, `/a/$slug/quizzes/$id`:**
  - Staff thấy báo cáo học viên × câu và bảng xếp hạng.
  - Học viên làm bài:
    - `QuizPuzzle`: bàn cờ đi theo nước đáp của server; mỗi nước gọi `quiz-answer`.
    - Trắc nghiệm và bắt quân dùng lại component của `ActivityPlayer`, nộp qua `quiz-answer`.
  - Hiện đồng hồ đếm tới hạn.
- **Từ Study:** mỗi thẻ học liệu có nút "Tạo quiz từ học liệu" (như Chesslang).
- **Mobile:** thẻ "Quiz" ở màn học viện; màn `quizzes/[id]` để làm bài (puzzle chấm từng nước, trắc nghiệm, bắt quân) và xem bảng xếp hạng.
- **Tổng quan:** cộng điểm quiz vào bảng xếp hạng học viện, bằng cách cập nhật `academy_leaderboard` để gộp cả `quiz_attempts`.

## PR 7c — Exercise dùng lại, Quiz tự động, Practice

1. **Exercise (`hw.split`):**
   - Bảng `exercises(id, academy_id, title, description, level_id?, tags[], created_by)` và `exercise_items(exercise_id, position, puzzle_id)`; thêm `assignments.exercise_id?`.
   - **Web:** tab "Bài tập" có hai tab con, Exercise và Đã giao.
     - Tạo Exercise dùng lại `PuzzlePicker` sẵn có.
     - Nút "Giao" mở form giao (lớp/học viên, hạn) và sao chép puzzle sang `assignment_items`.
     - Báo cáo của Giai đoạn 4 giữ nguyên.
2. **Quiz tự động theo cấp độ (`quiz.auto`):**
   - Nút "Quiz tự động" lấy ngẫu nhiên N puzzle từ thư viện có rating trong khoảng của cấp độ, rồi giao cho học viên thuộc cấp đó (qua Batch của cấp).
   - Hàm thuần `pickAutoQuizPuzzles(puzzles, level, n, seed)` có test.
   - Chưa lên lịch tự chạy, để Giai đoạn 12 (cron + thông báo).
3. **Practice (`practice.chapters`):**
   - Bảng `practice_chapters(id, academy_id, title, visibility private|academy, created_by)` và `practice_positions(chapter_id, position, title, fen, side, goal, elo?)`.
   - **Web `/a/$slug/practice`:** soạn chương bằng `BoardEditor`; luyện với máy, tách `EngineGame` từ `ActivityPlayer` thành component dùng chung; lưu kết quả tự báo vào `practice_results` để HLV xem.
   - **Mobile:** xem danh sách chương; nút luyện báo "dùng trên web/desktop" (engine mobile là bước 7).

## Kiểm chứng

- **Mỗi PR:** `pnpm lint`, `typecheck`, `test`, `build`, `sync-shared --check`; CI 3 job xanh.
- **pgTAP trên cloud qua `to-mcp.mjs`:** `05_quizzes_rls.sql`, `06_exercises_practice_rls.sql`.
- **Test tích hợp trên cloud:** `phase7.integration.test.ts`.
  - Học viên gọi trực tiếp PostgREST lấy `quiz_items` thì bị chặn.
  - RPC đề không chứa `moves` hay `correct`.
  - Chấm từng nước, hết hạn, bảng xếp hạng.
  - Exercise được giao 2 lần.
- **Chrome ở localhost** (phiên đăng nhập sẵn của chủ dự án, học viện DSC1):
  - Tạo quiz từ "Học liệu mẫu", làm thử.
  - Kiểm trong tab Network rằng phản hồi không lộ đáp án.
  - Tạo Exercise rồi giao; tạo chương luyện.
  - Dữ liệu thử ghi rõ "(Claude)" và báo lại để chủ dự án giữ hoặc xoá.
- **Cuối giai đoạn:** cập nhật `rea/ledger.md` và mục "Kết quả" trong kế hoạch con.

## Rủi ro và ghi chú

- **Độ trễ:** chấm từng nước làm mỗi nước đi chờ một lượt gọi server (khoảng 200–500 ms). Chấp nhận được với bài kiểm tra; Study luyện tập vẫn chấm tại chỗ cho nhanh.
- **Đồng bộ thời gian:** hạn chót kiểm phía server bằng `now()`; đồng hồ phía client chỉ để hiển thị.
- **Practice:** kết quả vẫn do client tự báo, giống "đánh với máy".

## Kết quả

### PR 7a (2026-10-24)

- **Migration `…0009_quizzes.sql`:**
  - Bảng `quizzes`, `quiz_items` (chỉ staff đọc), `quiz_targets`, `quiz_attempts` (chỉ Edge Function ghi), view `quiz_progress`.
  - RPC `quiz_items_for_student` (đề đã lược đáp án, chỉ khi quiz đã mở), `quiz_leaderboard`, `quiz_item_for_student` (dành cho service role).
- **Edge Function `quiz-answer`:**
  - Puzzle chấm từng nước; server giữ bước hiện tại và trả nước đáp.
  - Trắc nghiệm và bắt quân chấm một lần; không trả đáp án đúng.
  - Từ chối khi quiz chưa mở, đã đóng hoặc hết lượt.
- **Mã dùng chung:**
  - `domain/quiz.ts`: schema tạo quiz, `quizStatus`, `stripQuizAnswer`.
  - `api/quizzes.ts`: `createQuiz` (lỗi thì xoá quiz vừa tạo), đề, trả lời, bảng xếp hạng; kèm hook React.
- **Kiểm chứng:**
  - pgTAP `05_quizzes_rls.sql`: 18/18 trên cloud.
  - `phase7.integration.test.ts` đạt trên cloud:
    - học viên đọc thẳng `quiz_items` nhận rỗng;
    - đề không có `moves` hay `correct`;
    - puzzle 3 nước sai 1 lần rồi đúng, được 8 điểm;
    - trắc nghiệm 1 lượt bị chặn lần 2;
    - bảng xếp hạng 28 điểm;
    - quiz quá hạn trả `quiz_closed`.

### PR 7b (2026-10-24)

- **Web:**
  - Tab "Quiz": lọc Đang mở / Sắp mở / Đã đóng.
  - Trang tạo quiz: lấy câu từ học liệu (thêm từng câu hoặc cả học liệu) hoặc từ thư viện puzzle; mở cho cả học viện hoặc giao lớp/học viên; giờ mở và hạn chót.
  - Trang quiz:
    - HLV xem bảng kết quả học viên × câu, bảng xếp hạng, làm thử, xoá.
    - Học viên làm bài có đếm ngược.
  - Học liệu có nút "Tạo quiz".
- **`useQuizPuzzle`** (api/react): bàn cờ đi theo kết quả chấm của server, tự bắt đầu lại khi lệch bước.
- **Tách component dùng chung:** `PuzzlePicker`, `TargetPicker`, `Mcq`, `Capture`.
- **Mobile:** thẻ "Quiz" ở màn học viện; màn `quizzes/[id]` làm bài (puzzle chấm từng nước ở server) kèm bảng xếp hạng.
- **Bảng xếp hạng học viện** (migration `…0010`): cộng thêm điểm quiz.
- **Kiểm chứng:**
  - Chrome (tài khoản chủ dự án): tạo "Quiz mẫu (Claude)" từ học liệu mẫu (4 câu). Làm thử: đi sai thì server báo "Chưa đúng"; thử lại và đi Xe d8 chiếu hết thì đạt "Đã xong · 10 điểm".
  - Test tích hợp phase5 và phase7 đạt trên cloud; toàn repo xanh.

### PR 7c (2026-10-24)

- **Migration `…0011_exercises_practice.sql`:**
  - `exercises`, `exercise_items` (chỉ staff), `assignments.exercise_id`.
  - `practice_chapters` (riêng tư hoặc chia sẻ), `practice_positions`, `practice_results` (học viên tự ghi khi đọc được chương).
- **Web:**
  - Bài tập có hai tab Đã giao / Exercise; Exercise soạn một lần, giao nhiều lần (chép puzzle sang `assignment_items`).
  - Quiz tự động: chọn cấp độ, lấy ngẫu nhiên N puzzle trong khoảng rating (`pickAutoQuizPuzzles`), giao cho học viên ở cấp đó. Chưa chạy theo lịch (Giai đoạn 12).
  - Tab "Luyện tập": tạo chương, thêm thế bằng `BoardEditor`, luyện với máy bằng `EngineGame`, HLV xem kết quả gần đây.
- **Mobile:** thẻ "Luyện tập" liệt kê chương, ghi chú luyện trên web/desktop.
- **Kiểm chứng:**
  - pgTAP `06_exercises_practice_rls.sql`: 16/16 trên cloud.
  - `phase7.integration.test.ts` (2 test) đạt trên cloud: Exercise giao 2 lần, học viên không đọc được Exercise, chương riêng tư bị chặn, kết quả luyện tập HLV đọc được.
  - Chrome: tạo "Chương luyện mẫu (Claude)" với thế "Hậu chiếu hết (Claude)", chơi với máy, xin thua thì kết quả hiện ở bảng HLV; tạo "Exercise mẫu (Claude)" (chưa giao). Quiz tự động chỉ mở xem, không tạo để tránh giao bài cho học viên thật.
