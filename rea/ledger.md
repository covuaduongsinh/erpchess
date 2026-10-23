# Sổ cái tái tạo (bản văn bản)

Mỗi dòng là một **claim**: một hành vi của Chesslang mà erpchess cần tái tạo.

**Trạng thái:**
- ✅ **đã đóng:** có mã và test trong erpchess.
- 🟡 **một phần:** mới làm được một phần.
- ⬜ **mở:** chưa làm.
- ⛔ **ngoài phạm vi:** sẽ không làm.

**Cột GĐ** là giai đoạn erpchess dự kiến làm claim đó.

Cập nhật lần cuối: 2026-10-23, sau Giai đoạn 4.

| ID                     | Claim                                                             | GĐ  | Trạng thái | Bằng chứng trong erpchess                                |
| ---------------------- | ----------------------------------------------------------------- | --- | ---------- | -------------------------------------------------------- |
| org.academy            | Tạo học viện, chủ học viện                                        | 2   | ✅         | `supabase/migrations/20261023000001_core_org.sql`, pgTAP |
| org.coach-invite       | Mời HLV bằng link                                                 | 2   | ✅         | `apps/web/src/routes/invite.$token.tsx`                  |
| org.student-pin        | Học viên đăng nhập bằng username + PIN, không cần email           | 2   | ✅         | Edge Function `create-student`                           |
| org.groups             | Group học viên                                                    | 2   | ✅         | `a.$slug.groups.tsx`                                     |
| org.batches            | Batch: cùng cấp độ, cùng lịch, cùng HLV                           | 5   | ⬜         |                                                          |
| org.levels             | Lộ trình cấp độ theo khoảng rating, điều kiện lên cấp, tạo từ mẫu | 5   | ⬜         |                                                          |
| org.rating             | Rating nội bộ classical/rapid/blitz; FIDE tuỳ chọn                | 5   | ⬜         |                                                          |
| org.students-csv       | Nhập/xuất học viên CSV, đếm ghế                                   | 5   | ⬜         |                                                          |
| org.dashboard          | Thẻ số liệu, bảng xếp hạng tuần/tháng/6 tháng                     | 5   | 🟡         | Trang học viện cơ bản                                    |
| org.branding           | Tên, mô tả, logo, mạng xã hội, trang đăng nhập riêng              | 5   | ⬜         |                                                          |
| org.location           | Địa điểm: trung tâm, trường                                       | 5   | ⬜         |                                                          |
| board.play             | Bàn cờ kéo thả, phong cấp, lật bàn, mũi tên/tô ô                  | 3   | ✅         | `packages/board-web`, `packages/board-native`            |
| board.engine           | Engine phân tích                                                  | 3   | ✅         | `packages/engine` (Arasan)                               |
| board.analysis         | Bàn phân tích PGN có biến                                         | 3   | ✅         | `apps/web/src/routes/analysis.tsx`                       |
| db.pgn-upload          | CSDL ván: tải PGN, danh sách ván, trình xem                       | 6   | ⬜         |                                                          |
| db.sync                | Đồng bộ ván Lichess/Chess.com                                     | 6   | ⬜         |                                                          |
| db.masterbase          | Tìm ván cao thủ theo thế cờ, Elo, độ dài                          | 6   | ⬜         | Chỉ dùng dữ liệu có giấy phép mở                         |
| study.core             | Study = chuỗi hoạt động; của tôi/công khai/chia sẻ; nháp          | 6   | ⬜         |                                                          |
| study.activity.puzzle  | Hoạt động puzzle: thời gian, số lần thử, điểm, phạt               | 6   | 🟡         | `puzzle-session.ts`, `submit-attempt`                    |
| study.activity.mcq     | Trắc nghiệm có thế cờ hoặc ảnh                                    | 6   | ⬜         |                                                          |
| study.activity.capture | Bắt hết quân bằng một quân                                        | 6   | ⬜         |                                                          |
| study.activity.explain | Giải thích có nhúng thế cờ                                        | 6   | ⬜         |                                                          |
| study.activity.engine  | Đánh với máy từ thế cờ                                            | 6   | ⬜         |                                                          |
| study.activity.video   | Video bài giảng                                                   | 6   | ⬜         |                                                          |
| study.activity.viewer  | Xem ván có chú thích                                              | 6   | ⬜         |                                                          |
| study.import           | Nhập study Lichess, PGN thành puzzle                              | 6   | ⬜         |                                                          |
| study.collections      | Collections                                                       | 6   | ⬜         |                                                          |
| hw.exercise            | Exercise: tạo bài tập từ bài toán, tag chủ đề                     | 4   | ✅         | `a.$slug.assignments.new.tsx`                            |
| hw.assign              | Giao cho học viên/lớp, hạn nộp                                    | 4   | ✅         | `assignment_targets`                                     |
| hw.report              | Báo cáo số lần thử, thời gian, tỉ lệ hoàn thành                   | 4   | ✅         | `assignment_progress`, `phase4.integration.test.ts`      |
| hw.split               | Tách Exercise (dùng lại) khỏi lần giao                            | 7   | ⬜         |                                                          |
| quiz.core              | Quiz từ hoạt động study, riêng tư/công khai, lịch, hạn            | 7   | ⬜         |                                                          |
| quiz.auto              | Quiz tự động theo cấp độ                                          | 7   | ⬜         |                                                          |
| quiz.leaderboard       | Bảng xếp hạng quiz, góc nhìn học viên                             | 7   | ⬜         |                                                          |
| practice.chapters      | Chương luyện thế cờ riêng tư/công khai                            | 7   | ⬜         |                                                          |
| class.live             | Lớp online: bàn cờ đồng bộ, HLV điều khiển, chat                  | 8   | ⬜         |                                                          |
| class.video            | Video/âm thanh, 3 chế độ                                          | 8   | ⬜         |                                                          |
| class.offline          | Lớp offline: điểm danh                                            | 8   | ⬜         |                                                          |
| class.schedule         | Lịch lặp lại; Calendar với lịch trống của HLV                     | 8   | ⬜         |                                                          |
| class.export           | Lọc theo ngày, xuất CSV                                           | 8   | ⬜         |                                                          |
| play.game              | Ván 1–1 có đồng hồ, xác thực nước đi phía server                  | 9   | ⬜         |                                                          |
| play.pairing           | HLV ghép cặp; học viên online; ván đang diễn ra                   | 9   | ⬜         |                                                          |
| play.bot               | Đánh máy theo mức                                                 | 9   | 🟡         | Có engine, chưa có màn chơi                              |
| play.simul             | Simul                                                             | 9   | ⬜         |                                                          |
| tour.swiss             | Giải Swiss, Quad, Swiss đồng đội; vòng, thời gian, FEN tuỳ chỉnh  | 10  | ⬜         |                                                          |
| tour.auto              | Tự hoàn tất vòng, tự lên lịch, lặp lại                            | 10  | ⬜         |                                                          |
| course.core            | Khoá học gồm các study theo cấp độ                                | 11  | ⬜         |                                                          |
| course.cert            | Chứng chỉ có mã xác minh công khai                                | 11  | ⬜         |                                                          |
| ops.plans              | Gói học phí, đa tiền tệ, mẫu gói                                  | 12  | ⬜         |                                                          |
| ops.discounts          | Giảm giá                                                          | 12  | ⬜         |                                                          |
| ops.invoices           | Hoá đơn + link thanh toán (VietQR/PayOS/Stripe)                   | 12  | ⬜         |                                                          |
| ops.reminders          | Nhắc đóng phí tự động                                             | 12  | ⬜         |                                                          |
| ops.notify             | Thông báo email/push, nhật ký gửi                                 | 12  | ⬜         |                                                          |
| ops.leads              | Lead và lớp học thử                                               | 12  | ⬜         |                                                          |
| ops.chat               | Chat theo Group/Batch/HLV/học viên                                | 12  | ⬜         |                                                          |
| report.student         | Báo cáo tổng hợp theo học viên, xuất CSV                          | 13  | 🟡         | Chỉ có báo cáo bài tập                                   |
| pref.profile           | Hồ sơ, ngôn ngữ, múi giờ, ký hiệu nước đi, sáng/tối               | 13  | 🟡         | Có i18n vi/en và theme                                   |
| ops.whatsapp           | Thông báo WhatsApp                                                | —   | ⛔         | Thay bằng email/push; Zalo OA để sau                     |
| ops.razorpay           | Razorpay                                                          | —   | ⛔         | Thị trường Ấn Độ                                         |

**Tổng kết:** 59 claim, gồm 10 đã đóng, 5 một phần, 42 mở, 2 ngoài phạm vi.
