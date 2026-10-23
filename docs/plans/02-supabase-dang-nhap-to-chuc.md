# Giai đoạn 2 — Supabase, đăng nhập, tổ chức

Kế hoạch tổng: [00-ke-hoach-tong.md](00-ke-hoach-tong.md) · Giai đoạn trước: [01-nen-mong-monorepo.md](01-nen-mong-monorepo.md)

## Mục tiêu

Người dùng thao tác được trên cả 3 app (web, desktop, mobile):
- **Chủ học viện:** đăng ký tài khoản, tạo học viện, mời HLV qua link.
- **HLV:** tạo lớp, tạo tài khoản học viên bằng _username + PIN_, xếp học viên vào lớp.
- **Học viên:** đăng nhập bằng username + PIN, không cần email.
- **Phụ huynh:** đăng nhập bằng email, xem được thông tin con mình.

## Môi trường

- **Supabase Cloud:** project `erpchess-dev`, vùng `ap-southeast-1` (Singapore), gói Free. Gói Free chỉ cho 2 project hoạt động, nên người dùng tạm dừng một project cũ để nhường chỗ.
- **Migration:** nằm trong `supabase/migrations/` và được áp lên cloud qua Supabase MCP. Sau này chạy được local bằng `supabase start` khi có Docker.
- **Test RLS:** viết bằng pgTAP trong `supabase/tests/`. Mỗi file chạy trong một transaction rồi `ROLLBACK`, nên không để lại dữ liệu.

## Mô hình dữ liệu

| Bảng            | Ghi chú                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `profiles`      | 1-1 với `auth.users`; `display_name`, `username` (duy nhất, chỉ có ở học viên), `locale`; tạo tự động bằng trigger |
| `academies`     | `name`, `slug` duy nhất, `created_by`                                                                              |
| `memberships`   | `(academy_id, user_id)` là khoá chính, kèm `role` ∈ `owner \| coach \| student \| parent`                          |
| `groups`        | lớp học: `academy_id`, `name`, `coach_id`                                                                          |
| `group_members` | `(group_id, student_id)`                                                                                           |
| `parent_links`  | `(academy_id, parent_id, student_id)`                                                                              |
| `invitations`   | mời HLV hoặc phụ huynh: `academy_id`, `role`, `token`, `email` (tuỳ chọn), `expires_at`, `accepted_by`             |

**Hàm hỗ trợ** (`security definer`, `search_path = ''`, nằm trong schema `private` để không lộ qua API):
- `private.has_role(academy_id, roles[])`
- `private.is_member(academy_id)`
- `private.is_parent_of(student_id)`

**RPC công khai:**
- `create_academy(name, slug)`: tạo học viện và gán người gọi làm `owner`.
- `create_invitation(academy_id, role, email?)`: chỉ owner gọi được, trả về token.
- `accept_invitation(token)`: thêm người gọi vào học viện với role của lời mời.

## Phân quyền (RLS)

- **Học viện, thành viên:** chỉ thành viên của học viện mới đọc được học viện đó và danh sách thành viên.
  - Owner quản lý mọi thành viên.
  - Coach chỉ thêm hoặc xoá thành viên có role `student`.
- **Lớp:**
  - Owner và coach đọc, ghi mọi lớp.
  - Học viên chỉ thấy lớp mình học.
  - Phụ huynh chỉ thấy lớp của con.
- **Profiles:** mỗi người tự sửa profile của mình. Chỉ đọc được profile của người cùng học viện.
- **Lời mời:** chỉ owner đọc và tạo; người nhận chấp nhận qua RPC.

## Edge Function `create-student`

**Đầu vào:** `{ academyId, displayName, username, pin, groupId? }`.

**Xử lý:**
1. Kiểm JWT của người gọi; người gọi phải là owner hoặc coach của học viện.
2. Kiểm `username` theo mẫu `^[a-z0-9_.]{3,32}$` và chưa bị trùng. PIN gồm 6–12 chữ số.
3. Dùng service role, gọi `auth.admin.createUser` với email nội bộ `<username>@students.erpchess.local`, mật khẩu là PIN, `email_confirm: true`, và đặt `user_metadata` gồm `display_name`, `username`.
4. Thêm `memberships` với role `student`; nếu có `groupId` thì thêm cả `group_members`.

**Đăng nhập học viên:** client đổi username thành email nội bộ rồi gọi `signInWithPassword`. Hàm đổi nằm trong `@erpchess/api` để cả 3 app dùng chung.

## Gói mã

- **`packages/api`:**
  - `createSupabaseClient(storage)`: web dùng `localStorage`, mobile dùng `expo-secure-store`/AsyncStorage, desktop dùng chung bản web.
  - Types sinh từ DB (`database.types.ts`).
  - Hàm `studentEmail(username)`.
  - Hook TanStack Query: `useSession`, `useMyAcademies`, `useGroups`…
- **`packages/domain`:** schema Zod cho form (username, PIN, slug, tên học viện) dùng chung cho client và Edge Function.
- **UI:**
  - **Web/desktop:** `/login` (tab email/học viên), `/signup`, `/academies/new`, `/a/$slug` (tổng quan), `/a/$slug/groups`, `/a/$slug/students`, `/invite/$token`.
  - **Mobile:** các màn hình tương đương bằng Expo Router.

## Kiểm chứng

1. **pgTAP:**
   - Học viện A không đọc được dữ liệu của học viện B.
   - Học viên không thấy lớp khác lớp mình.
   - Coach không tạo được owner.
   - Phụ huynh chỉ thấy con mình.
2. **Advisors:** `get_advisors` (security và performance) không còn cảnh báo về RLS.
3. **Vitest:** schema Zod và `studentEmail`.
4. **End-to-end:** chạy thủ công trên web — đăng ký, tạo học viện, tạo lớp, tạo học viên — rồi đăng nhập học viên đó trên bản web của mobile.
5. **Toàn repo:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` xanh.

## Ngoài phạm vi

- Thanh toán (Giai đoạn 8).
- Đăng nhập Google/Apple: chỉ cấu hình khi có client ID; mã đã hỗ trợ sẵn qua `signInWithOAuth`.

## Kết quả triển khai (2026-10-23)

- **Supabase:** project `erpchess-dev` (ref `eordwpktwokvmhymvcyd`, vùng ap-southeast-1). Đã áp migration `core_org` và deploy Edge Function `create-student`.
- **pgTAP:** 22/22 qua trên cloud. Cách chạy qua MCP: ghi kết quả vào bảng tạm, rồi `raise exception` ở cuối để toàn bộ transaction rollback.
- **Advisors security:** còn 3 cảnh báo `authenticated_security_definer_function_executable` cho 3 RPC công khai. Đây là chủ ý thiết kế: mỗi RPC tự kiểm quyền bên trong.
- **Smoke E2E:** `packages/api/scripts/smoke-phase2.mjs` qua 9/9 bước.
- **Thử trên trình duyệt** (bản build web, Chrome), các luồng đều chạy đúng:
  - Chủ học viện đăng nhập, tạo học viện, tạo lớp, tạo học viên (qua Edge Function).
  - Học viên đăng nhập bằng username + PIN và chỉ thấy lớp của mình.
- **Lỗi đã sửa:** vào route cần đăng nhập khi chưa đăng nhập thì trang treo vì điều hướng vô hạn. Nguyên nhân là `<Navigate>` so sánh props theo tham chiếu, cộng với `useLocation` render lại trong lúc route `/login` đang tải. Đã sửa bằng điều hướng một lần trong `useEffect`, có test hồi quy `RequireSession.test.tsx`.
- **Mobile:** đã có các màn hình đăng nhập (email/học viên), đăng ký, danh sách học viện, chi tiết học viện (lớp, thành viên, tạo lớp, tạo học viên). Phiên đăng nhập lưu bằng `expo-sqlite/localStorage`. Mới kiểm bằng `expo export --platform web`; **chưa chạy trên thiết bị hoặc emulator Android/iOS**.
- **Tài khoản thử nghiệm trên dev:**
  - Chủ học viện: `e2e.owner@erpchess.test`.
  - Học viên: `minhan.test`.
  - Học viện: "CLB Cờ vua Dương Sinh Thử nghiệm".
- **Còn lại:**
  - Bật hoặc tắt xác nhận email và cấu hình Site URL trong Auth của Supabase Dashboard.
  - Kiểm luồng lời mời HLV/phụ huynh trên giao diện (RPC đã có test pgTAP).
  - Chạy app mobile trên thiết bị thật.
