# Giai đoạn 8 — Lớp học trực tiếp và Calendar

## Bối cảnh

- **Claim cần đóng** trong `rea/ledger.md`: `class.live`, `class.video`, `class.offline`, `class.schedule`, `class.export`. Đặc tả: `rea/spec/lop-hoc.md`; kế hoạch tổng: `docs/plans/00-ke-hoach-tong.md` (mục Giai đoạn 8).
- **Hiện trạng:** chưa có bảng lớp, điểm danh, lịch; chưa dùng Supabase Realtime ở đâu. Đã có:
  - `groups.kind` (group | batch) và `groups.schedule` dạng `[{day, start, minutes}]`, schema `scheduleSchema` / `sortSchedule` (`packages/domain/src/admin.ts`), trình sửa lịch ở `apps/web/src/routes/a.$slug.groups.tsx`.
  - `Board` web nhận `fen`, `movable`, `onMove`, `drawings` / `onDrawingsChange` (mũi tên, tô ô), `lastMove` — điều khiển được hoàn toàn từ ngoài. `Board` native chưa có `drawings`.
  - `TargetPicker` + `toggle`, `useMembers`, `useGroups`; `toCsv` (`packages/domain/src/csv.ts`); `periodRange` (`periods.ts`, chưa có quý/năm); tải CSV đang viết tay trong `a.$slug.students.tsx`.
  - `getEngine()` (Arasan WASM) ở `apps/web/src/lib/engine.ts`; `chess-core` để kiểm nước đi.
- **Đã chốt với chủ dự án:** video dùng **LiveKit Cloud**. Chủ dự án tự tạo tài khoản và đặt secret; khi chưa có secret, lớp vẫn chạy (bàn cờ, chat), chỉ báo "chưa cấu hình video".
- **Ngoài phạm vi:** WhatsApp (⛔ trong ledger); email báo lớp để Giai đoạn 12 (thông báo). "Lớp công khai" nghĩa là mọi người **đã đăng nhập** có link đều vào được (không có khách vô danh).

Kế hoạch con ghi vào `docs/plans/09-lop-hoc-calendar.md`. Chia 3 PR, mỗi PR đủ quy trình commit → CI xanh → merge.

## PR 8a — CSDL lớp, lớp offline + điểm danh, lịch lặp lại, Calendar, xuất CSV

1. **Migration `…0012_classrooms.sql`:**
   - `classrooms(id, academy_id, title default 'Class', kind online|offline, video_mode performance|standard|none, is_public, starts_at, minutes, coach_id, group_id?, series_id?, state jsonb, ended_at, created_by, created_at)`. `state` giữ `{fen, lastMove, controller}` để người vào muộn đồng bộ.
   - `classroom_targets(classroom_id, group_id | student_id)` như `quiz_targets`.
   - `classroom_attendance(classroom_id, student_id, status present|late|absent|excused, joined_at, note)`, unique `(classroom_id, student_id)`.
   - `classroom_events(id bigserial, classroom_id, at, kind move|fen|draw|chat|control, actor_id, payload)` để xem lại.
   - `coach_availability(id, academy_id, coach_id, day 0-6, start, minutes)` — lịch trống tuần của HLV.
   - `calendar_events(id, academy_id, coach_id?, kind class|trial|meeting|leave|other, title, starts_at, ends_at, classroom_id?, created_by)`; lớp tạo ra thì tự có sự kiện `class` (trigger).
   - **RLS:** staff đọc/ghi trong học viện; HLV sửa lớp mình, owner sửa mọi lớp. Học viên đọc lớp khi được giao (trực tiếp/qua lớp), hoặc `is_public` và là thành viên đã đăng nhập; phụ huynh đọc như con. Điểm danh: staff ghi; học viên chỉ qua RPC `classroom_join(p_class)` (đánh dấu có mặt/đi muộn theo giờ). `classroom_events`: người xem được lớp thì đọc; chat do người trong lớp tự ghi (`actor_id = auth.uid()`), các loại khác chỉ HLV/owner ghi.
   - Hàm `private.can_view_classroom`, `private.can_run_classroom`.
2. **`packages/domain/src/classroom.ts`** (có test):
   - `classroomInputSchema`; `expandSchedule(schedule, fromDate, weeks)` → danh sách giờ bắt đầu (lặp tuần, theo giờ địa phương).
   - `busySlots` / `freeCoaches(availability, events, slot)` — tìm HLV còn trống.
   - `periodRange` thêm `quarter`, `year` (nút M/Q/Y).
   - `classesToCsv(rows)` dùng `toCsv`.
3. **`packages/api/src/classrooms.ts`** + hook: tạo lớp (một buổi hoặc chuỗi lặp từ lịch Batch / lịch tự chọn, chung `series_id`, lỗi thì xoá phần đã tạo), danh sách lọc theo người tạo + khoảng ngày, điểm danh, `joinClassroom`, sự kiện, lịch trống HLV, `calendar_events`.
4. **Web:**
   - Tab "Lớp học" `/a/$slug/classes`: lọc Mọi người / Của tôi, khoảng ngày + nút M/Q/Y, xuất CSV (tách helper `downloadCsv` từ `a.$slug.students.tsx`), nút "Lớp mới" (tên, online/offline, chế độ video, người tham gia qua `TargetPicker`, công khai, giờ + thời lượng, lặp theo lịch Batch hoặc tự chọn N tuần).
   - `/a/$slug/classes/$id`: lớp offline → bảng điểm danh (HLV đánh dấu); lớp online → nút "Vào lớp" (PR 8b) + bảng điểm danh tự ghi.
   - `/a/$slug/calendar` (staff): lưới tuần, lọc theo HLV / loại sự kiện / Batch / học viên; HLV khai lịch trống; ô "Tìm HLV còn trống"; tạo sự kiện họp/nghỉ/học thử.
5. **Mobile:** thẻ "Lớp học" ở màn học viện (buổi sắp tới, trạng thái điểm danh của mình).
6. **Kiểm thử:** pgTAP `07_classrooms_rls.sql`; domain test; `phase8.integration.test.ts` (chuỗi lặp 4 buổi, học viên được giao thấy lớp, học viên khác không thấy, `classroom_join` ghi điểm danh, CSV).

## PR 8b — Phòng học trực tuyến (bàn cờ đồng bộ, presence, chat, xem lại)

1. **Realtime kênh riêng tư** `classroom:<id>` (Supabase Realtime Authorization): migration thêm policy trên `realtime.messages` — chỉ người `can_view_classroom` được nghe/gửi; tin điều khiển chỉ chấp nhận từ HLV phía client (học viên chỉ gửi `move_request` và `chat`).
2. **Mô hình đồng bộ: HLV là nguồn sự thật.**
   - HLV đi quân / dán FEN / lùi nước → kiểm bằng `chess-core` → broadcast `state {fen, lastMove, ply}`; ghi `classrooms.state` (giãn nhịp) và `classroom_events`.
   - HLV trao quyền đi quân cho một học viên (`control`); học viên đó gửi `move_request`, HLV kiểm hợp lệ rồi phát lại `state`.
   - Mũi tên, tô ô: HLV vẽ → broadcast `draw` (dùng `drawings` của `Board`).
   - Bật/tắt engine: HLV phát `engine on/off`; mỗi máy web tự chạy `getEngine()` hiển thị đánh giá.
   - Presence: danh sách người trong phòng; vào phòng thì gọi `classroom_join` (điểm danh tự động).
   - Người vào muộn: đọc `classrooms.state`, rồi gửi `sync_request` để HLV phát lại.
   - Chat: broadcast + lưu `classroom_events` kind `chat`.
3. **Web `/a/$slug/classes/$id/room`:** bàn cờ + thanh công cụ HLV (trao quyền, FEN, engine, kết thúc lớp), danh sách người, chat. Hook `useClassroomChannel` trong `packages/api/src/react.tsx`.
4. **Xem lại** `/a/$slug/classes/$id/replay`: đi lại các sự kiện theo thứ tự (nước đi, mũi tên, chat).
5. **Mobile:** màn `classes/[id]` theo dõi bàn cờ + chat (thêm `drawings` cho `Board` native nếu gọn; nếu không thì chỉ ô tô màu, ghi chú lại).
6. **Kiểm thử:** test tích hợp hai client (HLV + học viên thử) trên cloud: học viên nhận `state` sau khi HLV đi; học viện khác bị từ chối vào kênh; chat được lưu.

## PR 8c — Video LiveKit (3 chế độ)

1. **Edge Function `livekit-token`:** xác thực người dùng, kiểm `can_view_classroom` qua RPC, ký token bằng `npm:livekit-server-sdk` (Apache-2.0). HLV có quyền quản trị phòng; học viên được phát âm thanh/video theo chế độ. Thiếu `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` → 503 `video_not_configured`.
2. **Web:** `livekit-client` + `@livekit/components-react` (Apache-2.0), lazy-load trong phòng.
   - Ưu tiên hiệu năng (mặc định): simulcast + adaptive stream + dynacast.
   - Chuẩn (mạng kém): 360p, tắt simulcast, ưu tiên âm thanh.
   - Không video: chỉ âm thanh.
   - HLV tắt mic/cam học viên.
3. **Desktop (Tauri)** dùng chung giao diện web. **Mobile** video để sau (cần dev build có native WebRTC) — ghi rõ trong ledger.
4. **Việc chủ dự án làm** (tôi không tự đăng ký hay gõ khoá): tạo project LiveKit Cloud, đặt 3 secret cho Edge Functions trên Supabase. Có secret rồi tôi thử video trên Chrome.

## Kiểm chứng

- Mỗi PR: `pnpm lint`, `typecheck`, `test`, `build`, `sync-shared --check`; CI 3 job xanh.
- pgTAP qua `to-mcp.mjs` + `execute_sql`; test tích hợp `phase8.integration.test.ts` với tài khoản thử trong `it.env`.
- Chrome ở localhost (phiên chủ dự án, DSC1): tạo "Lớp mẫu (Claude)" offline + điểm danh; lớp online, vào phòng, đi quân, vẽ mũi tên, chat, xem lại; lịch tuần + lịch trống HLV; xuất CSV. Không giao lớp cho học viên thật (chỉ nhắm vào tài khoản thử hoặc để trống người tham gia).
- Cuối giai đoạn: cập nhật `rea/ledger.md`, mục "Kết quả" trong `docs/plans/09-lop-hoc-calendar.md`.

## Rủi ro và ghi chú

- **Realtime Authorization** cần bật "private channels" phía dự án; nếu chưa bật, kiểm bằng test tích hợp trước khi làm giao diện.
- **HLV là nguồn sự thật** nên khi HLV rời phòng, bàn cờ đứng yên ở `classrooms.state`; chấp nhận được cho lớp học.
- **Múi giờ:** lưu `timestamptz`; lặp lịch tính theo giờ địa phương của người tạo (lịch Batch đã là giờ địa phương).
- **Chi phí LiveKit:** gói miễn phí giới hạn phút tham gia; chế độ "Chuẩn"/"Không video" giảm băng thông.

## Kết quả

### PR 8a (2026-10-25)

- **Migration `…0012_classrooms.sql`:** `classrooms`, `classroom_targets`, `classroom_attendance`, `classroom_events`, `coach_availability`, `calendar_events` (trigger tự thêm sự kiện "class"), RPC `classroom_join`.
- **Domain:** `classroomInputSchema`, `expandSchedule`, `calendarRange` (M/Q/Y), `weekDays`, `freeCoaches`, `classesToCsv` — có test. Giữ `periods.ts` nguyên vì bảng xếp hạng đang dùng.
- **Web:**
  - Tab "Buổi học" (tiếng Việt đổi tên để không trùng tab "Lớp học" của nhóm/Batch): lọc Mọi người/Của tôi, khoảng ngày + Tháng/Quý/Năm, xuất CSV, tạo một buổi hoặc chuỗi lặp theo lịch Batch/tự chọn.
  - Trang buổi học: điểm danh (Có mặt/Đi muộn/Vắng/Có phép), học viên bấm "Vào lớp" tự ghi điểm danh, xoá buổi / xoá các buổi sắp tới của chuỗi.
  - Tab "Lịch" (staff): lưới tuần, lọc HLV/loại/Batch/học viên, sự kiện họp/nghỉ/học thử, lịch trống HLV, tìm HLV còn trống.
  - Tách `ScheduleEditor` (dùng chung với trang Lớp học) và `downloadCsv`.
- **Mobile:** thẻ "Buổi học sắp tới" kèm trạng thái điểm danh của mình.
- **Kiểm chứng:**
  - pgTAP `07_classrooms_rls.sql`: 22/22 trên cloud.
  - `phase8.integration.test.ts` đạt: chuỗi 4 buổi chung `series_id`, 5 sự kiện Calendar, học viên chỉ thấy buổi được giao, `classroom_join` → `present` / `null`, staff sửa điểm danh.
  - Chrome: tạo "Lớp mẫu (Claude)" offline lặp 2 tuần (không giao cho ai), xem chi tiết, Calendar hiện 18:00–19:30; khai lịch trống thứ Hai 17:00–20:00 rồi tìm HLV trống (18:30 bận vì trùng lớp; 19:30 + 30 phút còn trống), sau đó gỡ khung giờ thử.

### PR 8b (2026-10-25)

- **Migration `…0013_classroom_realtime.sql`:** policy trên `realtime.messages`. Realtime chỉ kiểm quyền khi vào kênh (không theo từng tin) nên tách hai kênh riêng tư:
  - `classroom:<id>`: chat, xin đi quân, xin đồng bộ, presence — ai xem được lớp đều gửi được.
  - `classroom:<id>:board`: ảnh chụp bàn cờ — chỉ HLV phụ trách / owner gửi được.
- **`packages/api/src/room.ts`:** `ClassroomRoom` (HLV kiểm nước bằng chess-core rồi phát ảnh chụp; lùi nước, đặt FEN, trao quyền đi quân, mũi tên/tô ô, bật engine; ghi `classrooms.state` giãn nhịp và `classroom_events`), `replayAt` (có test). Hook `useClassroomRoom` đợi lần ngắt kết nối trước xong mới vào lại (tránh `removeChannel` gỡ nhầm kênh mới khi React chạy effect hai lần).
- **Web:** `/classes/$id/room` (bàn cờ, công cụ HLV, người trong phòng, chat, engine dùng lại `EngineLines`; học viên vào phòng tự điểm danh) và `/classes/$id/replay`.
- **Mobile:** màn `classes/[id]`: lớp offline tự điểm danh; lớp online theo dõi bàn cờ, đi quân khi được trao quyền, chat. Mũi tên chỉ hiện trên web.
- **Kiểm chứng:**
  - pgTAP `08_classroom_realtime.sql`: 8/8 (học viên không gửi được lên kênh bàn cờ, người ngoài lớp không nghe/gửi được, topic sai bị từ chối).
  - `phase8.integration.test.ts` thêm test hai client trên cloud: học viên nhận nước của HLV, xin đi quân bị bỏ qua khi chưa được trao quyền và được chấp nhận sau khi trao, chat tới HLV, phòng không được giao thì không vào được.
  - Chrome: "Phòng mẫu (Claude)" (không giao ai) — đi e4, chat, bật engine (độ sâu 14), xem lại 2 bước, vào lại phòng thì bàn cờ khôi phục từ `classrooms.state`.

### PR 8c (2026-10-25)

- **Edge Function `livekit-token`** (đã triển khai): kiểm người gọi xem được lớp qua RLS, lớp phải online và chưa kết thúc; ký token bằng `livekit-server-sdk@2.19.1`. HLV phụ trách / owner có `roomAdmin` và được chia sẻ màn hình; chế độ "none" chỉ cho phát micro. Hành động `silence` để HLV tắt/mở quyền phát của một người. Thiếu `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` → 503 `video_not_configured`.
- **Web:** `VideoPanel` tải lười (chunk riêng) trong phòng học, `livekit-client@2.22.4` + `@livekit/components-react@2.9.24` (Apache-2.0). `roomOptionsFor` (có test): hiệu năng = simulcast 720p; chuẩn = 360p không simulcast; không video = chỉ âm thanh. HLV có danh sách tắt/mở tiếng & hình.
- **Mobile:** chưa có video (cần dev build có WebRTC native) — ghi 🟡 trong ledger.
- **Kiểm chứng:**
  - Test tích hợp: HLV nhận `video_not_configured` (hoặc token khi đã có khoá), lớp offline → `not_online`, học viên không được giao → `forbidden`.
  - Chrome: bấm "Bật video & âm thanh" → báo chưa cấu hình, bàn cờ/chat vẫn trực tuyến.
  - Chưa thử gọi video thật: cần chủ dự án tạo project LiveKit Cloud và đặt 3 secret cho Edge Functions.
