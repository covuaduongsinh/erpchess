# Sổ cái tái tạo (bản văn bản)

Mỗi dòng là một **claim**: một hành vi của Chesslang mà erpchess cần tái tạo.

**Trạng thái:**
- ✅ **đã đóng:** có mã và test trong erpchess.
- 🟡 **một phần:** mới làm được một phần.
- ⬜ **mở:** chưa làm.
- ⛔ **ngoài phạm vi:** sẽ không làm.

**Cột GĐ** là giai đoạn erpchess dự kiến làm claim đó.

Cập nhật lần cuối: 2026-10-23, sau Giai đoạn 6.

| ID                     | Claim                                                             | GĐ  | Trạng thái | Bằng chứng trong erpchess                                                                                |
| ---------------------- | ----------------------------------------------------------------- | --- | ---------- | -------------------------------------------------------------------------------------------------------- |
| org.academy            | Tạo học viện, chủ học viện                                        | 2   | ✅         | `supabase/migrations/20261023000001_core_org.sql`, pgTAP                                                 |
| org.coach-invite       | Mời HLV bằng link                                                 | 2   | ✅         | `apps/web/src/routes/invite.$token.tsx`                                                                  |
| org.student-pin        | Học viên đăng nhập bằng username + PIN, không cần email           | 2   | ✅         | Edge Function `create-student`                                                                           |
| org.groups             | Group học viên                                                    | 2   | ✅         | `a.$slug.groups.tsx`                                                                                     |
| org.batches            | Batch: cùng cấp độ, cùng lịch, cùng HLV                           | 5   | ✅         | `groups.kind = batch`, `a.$slug.groups.tsx`, pgTAP 03                                                    |
| org.levels             | Lộ trình cấp độ theo khoảng rating, điều kiện lên cấp, tạo từ mẫu | 5   | 🟡         | `levels`, `a.$slug.levels.tsx`; chưa tự lên cấp theo điều kiện                                           |
| org.rating             | Rating nội bộ classical/rapid/blitz; FIDE tuỳ chọn                | 5   | 🟡         | Glicko-2 blitz/rapid/classical, ván 1–1 tính rating cập nhật qua `game-move`; chưa có FIDE               |
| org.students-csv       | Nhập/xuất học viên CSV, đếm ghế                                   | 5   | ✅         | `csv.ts`, `importStudents`, trang Học viên                                                               |
| org.dashboard          | Thẻ số liệu, bảng xếp hạng tuần/tháng/6 tháng                     | 5   | ✅         | `academy_stats`, `academy_leaderboard`, web + mobile                                                     |
| org.branding           | Tên, mô tả, logo, mạng xã hội, trang đăng nhập riêng              | 5   | 🟡         | Tên, giới thiệu, logo, mạng xã hội; chưa có trang đăng nhập riêng/tên miền                               |
| org.location           | Địa điểm: trung tâm, trường                                       | 5   | ⬜         |                                                                                                          |
| board.play             | Bàn cờ kéo thả, phong cấp, lật bàn, mũi tên/tô ô                  | 3   | ✅         | `packages/board-web`, `packages/board-native`                                                            |
| board.engine           | Engine phân tích                                                  | 3   | ✅         | `packages/engine` (Arasan)                                                                               |
| board.analysis         | Bàn phân tích PGN có biến                                         | 3   | ✅         | `apps/web/src/routes/analysis.tsx`                                                                       |
| db.pgn-upload          | CSDL ván: tải PGN, danh sách ván, trình xem                       | 6   | ✅         | `game_databases`, `databases.ts` (`importPgn` theo lô, bỏ qua ván hỏng), trang `/a/$slug/database`       |
| db.sync                | Đồng bộ ván Lichess/Chess.com                                     | 6   | 🟡         | Nhập 50 ván gần nhất của người chơi Lichess; chưa đồng bộ tự động, chưa có Chess.com                     |
| db.masterbase          | Tìm ván cao thủ theo thế cờ, Elo, độ dài                          | 6   | ⬜         | Chỉ dùng dữ liệu có giấy phép mở                                                                         |
| study.core             | Study = chuỗi hoạt động; của tôi/công khai/chia sẻ; nháp          | 6   | ✅         | Bảng/RLS, trình soạn (`a.$slug.studies.$id.edit.tsx`), trình học web + mobile, thư viện chung            |
| study.activity.puzzle  | Hoạt động puzzle: thời gian, số lần thử, điểm, phạt               | 6   | ✅         | `PuzzleSolver` trong trình học, chấm qua `submit-activity`                                               |
| study.activity.mcq     | Trắc nghiệm có thế cờ hoặc ảnh                                    | 6   | ✅         | Soạn và làm trên web/mobile, chấm phía server                                                            |
| study.activity.capture | Bắt hết quân bằng một quân                                        | 6   | ✅         | `capture.ts`, `BoardEditor`, `solveCapture` khi soạn; sửa bàn cờ cho thế không vua                       |
| study.activity.explain | Giải thích có nhúng thế cờ                                        | 6   | ✅         | Markdown an toàn (`parseMarkdown`) web + mobile                                                          |
| study.activity.engine  | Đánh với máy từ thế cờ                                            | 6   | 🟡         | Web dùng Arasan theo Elo; kết quả do client tự báo; mobile chưa có engine                                |
| study.activity.video   | Video bài giảng                                                   | 6   | ✅         | Link YouTube/Vimeo/https hoặc tải lên `study-media`                                                      |
| study.activity.viewer  | Xem ván có chú thích                                              | 6   | ✅         | `GameViewer` web, trình xem rút gọn trên mobile                                                          |
| study.import           | Nhập study Lichess, PGN thành puzzle                              | 6   | 🟡         | Nhập study Lichess vào CSDL ván; chuyển thành hoạt động ở trình soạn (PR 6c)                             |
| study.collections      | Collections                                                       | 6   | ✅         | `study_collections`, thẻ Bộ sưu tập ở danh sách học liệu                                                 |
| hw.exercise            | Exercise: tạo bài tập từ bài toán, tag chủ đề                     | 4   | ✅         | `a.$slug.assignments.new.tsx`                                                                            |
| hw.assign              | Giao cho học viên/lớp, hạn nộp                                    | 4   | ✅         | `assignment_targets`                                                                                     |
| hw.report              | Báo cáo số lần thử, thời gian, tỉ lệ hoàn thành                   | 4   | ✅         | `assignment_progress`, `phase4.integration.test.ts`                                                      |
| hw.split               | Tách Exercise (dùng lại) khỏi lần giao                            | 7   | ✅         | `exercises`, `assignments.exercise_id`; tab Exercise ở Bài tập; giao 2 lần trong test                    |
| quiz.core              | Quiz từ hoạt động study, riêng tư/công khai, lịch, hạn            | 7   | ✅         | `quizzes`, `quiz-answer` chấm từng nước ở server, đề giấu đáp án (`05_quizzes_rls.sql`)                  |
| quiz.auto              | Quiz tự động theo cấp độ                                          | 7   | 🟡         | Tạo theo cấp độ bằng tay (`pickAutoQuizPuzzles`); tự chạy theo lịch ở Giai đoạn 12                       |
| quiz.leaderboard       | Bảng xếp hạng quiz, góc nhìn học viên                             | 7   | ✅         | `quiz_leaderboard`, góc nhìn học viên web + mobile, điểm quiz vào bảng xếp hạng học viện                 |
| practice.chapters      | Chương luyện thế cờ riêng tư/công khai                            | 7   | ✅         | `practice_chapters`/`positions`/`results`, luyện với máy trên web; mobile chỉ xem                        |
| class.live             | Lớp online: bàn cờ đồng bộ, HLV điều khiển, chat                  | 8   | ✅         | Realtime riêng tư 2 kênh, HLV là nguồn sự thật, trao quyền, mũi tên, engine, chat, xem lại               |
| class.video            | Video/âm thanh, 3 chế độ                                          | 8   | 🟡         | LiveKit 3 chế độ trên web/desktop (`livekit-token`); chờ khoá LiveKit; mobile để sau                     |
| class.offline          | Lớp offline: điểm danh                                            | 8   | ✅         | `classrooms` kind offline, `classroom_attendance`, `classroom_join` tự ghi có mặt/đi muộn                |
| class.schedule         | Lịch lặp lại; Calendar với lịch trống của HLV                     | 8   | ✅         | Chuỗi lặp theo lịch Batch/tự chọn (`expandSchedule`), `/calendar` + `coach_availability`, tìm HLV trống  |
| class.export           | Lọc theo ngày, xuất CSV                                           | 8   | ✅         | Lọc người tạo + khoảng ngày (M/Q/Y), `classesToCsv`                                                      |
| play.game              | Ván 1–1 có đồng hồ, xác thực nước đi phía server                  | 9   | ✅         | `games` + Edge Function `game-move` (trọng tài server, đồng hồ, lặp 3 lần, PGN), trang ván web + mobile  |
| play.pairing           | HLV ghép cặp; học viên online; ván đang diễn ra                   | 9   | ✅         | Game Area: HLV ghép cặp, học viên online (presence `academy:<id>:online`), ván đang diễn ra, lịch sử     |
| play.bot               | Đánh máy theo mức                                                 | 9   | ✅         | `/play/bot` theo `BOT_LEVELS` (Arasan `UCI_Elo`), ván lưu vào lịch sử, không tính rating; mobile chưa có |
| play.simul             | Simul                                                             | 9   | ✅         | `simuls` + bàn là `games`; tạo/bắt đầu/tự kết thúc, đồng hồ chỉ tính học viên, thống kê, tìm kiếm        |
| tour.swiss             | Giải Swiss, Quad, Swiss đồng đội; vòng, thời gian, FEN tuỳ chỉnh  | 10  | ✅         | Swiss (Dutch rút gọn), vòng tròn, Quad, Swiss đồng đội; FEN/khai cuộc; trọng tài server; 3 kiểu xem      |
| tour.auto              | Tự hoàn tất vòng, tự lên lịch, lặp lại                            | 10  | ✅         | Tự hoàn tất vòng (game-move), tự lên lịch + lặp lại (pg_cron → `tournament-tick`)                        |
| course.core            | Khoá học gồm các study theo cấp độ                                | 11  | ✅         | `courses` + lộ trình học liệu, giao, tiến độ, XP + chuỗi ngày (trigger), bảng XP                         |
| course.cert            | Chứng chỉ có mã xác minh công khai                                | 11  | ✅         | `certificates` mã base32 10 ký tự, tự cấp/cấp tay/thu hồi, in A4 + QR, `apps/site/verify/[code]`         |
| ops.plans              | Gói học phí, đa tiền tệ, mẫu gói                                  | 12  | ✅         | `plans` + `plan_prices` (nhiều tiền tệ), 12 gói mẫu tự soạn, tiền tệ mặc định trong `academy_billing`    |
| ops.discounts          | Giảm giá                                                          | 12  | ✅         | `discounts` % / cố định, áp nhiều gói, hạn và số lượt, thống kê `discount_stats`                         |
| ops.invoices           | Hoá đơn + link thanh toán (VietQR/PayOS/Stripe)                   | 12  | 🟡         | VietQR tĩnh + `/pay/[token]`, ghi nhận tay; PayOS/Stripe để sau                                          |
| ops.reminders          | Nhắc đóng phí tự động                                             | 12  | ✅         | `reminder_rules` (mốc ngày trước hạn), pg_cron 8:00 VN, `reminder_sent` chống trùng, chạy ngay           |
| ops.notify             | Thông báo email/push, nhật ký gửi                                 | 12  | 🟡         | Trong app: `notifications` + realtime `user:<id>`, bật/tắt theo loại, nhật ký; email/push để sau         |
| ops.leads              | Lead và lớp học thử                                               | 12  | ⬜         |                                                                                                          |
| ops.chat               | Chat theo Group/Batch/HLV/học viên                                | 12  | ⬜         |                                                                                                          |
| report.student         | Báo cáo tổng hợp theo học viên, xuất CSV                          | 13  | 🟡         | Chỉ có báo cáo bài tập                                                                                   |
| pref.profile           | Hồ sơ, ngôn ngữ, múi giờ, ký hiệu nước đi, sáng/tối               | 13  | 🟡         | Có i18n vi/en và theme                                                                                   |
| ops.whatsapp           | Thông báo WhatsApp                                                | —   | ⛔         | Thay bằng email/push; Zalo OA để sau                                                                     |
| ops.razorpay           | Razorpay                                                          | —   | ⛔         | Thị trường Ấn Độ                                                                                         |

**Tổng kết:** 59 claim, gồm 41 đã đóng, 12 một phần, 4 mở, 2 ngoài phạm vi.
