-- Giai đoạn 26a: Rating FIDE nhập tay (FIDE không có API công khai ổn định).
--   * academies.fide_enabled: học viện bật/tắt phần FIDE (chủ học viện).
--   * memberships.fide_id + fide_standard/rapid/blitz: mã FIDE và Elo FIDE 3 loại của từng học viên (nhân sự nhập).
-- Chỉ THÊM cột (nullable hoặc có mặc định), không drop/delete gì.
--
-- Không nới RLS của memberships (policy sửa hiện chỉ cho owner và không cho sửa chính mình): ghi qua
-- hai RPC security definer có kiểm quyền, giống set_student_level.
-- Quyền đọc: các cột mới nằm cùng hàng memberships nên thành viên cùng học viện đọc được như level_id
-- (policy "thành viên cùng học viện đọc"); mã FIDE và Elo FIDE là thông tin công khai trên fide.com.
--
-- Hoàn tác (chủ dự án tự quyết, KHÔNG nằm trong migration vì xoá dữ liệu đã nhập):
--   drop function public.set_member_fide(uuid, uuid, text, int, int, int);
--   drop function public.set_academy_fide_enabled(uuid, boolean);
--   alter table public.memberships drop column fide_id, drop column fide_standard,
--     drop column fide_rapid, drop column fide_blitz;
--   alter table public.academies drop column fide_enabled;

alter table public.academies
  add column if not exists fide_enabled boolean not null default false;

alter table public.memberships
  add column if not exists fide_id text
    constraint memberships_fide_id_check check (fide_id is null or fide_id ~ '^[0-9]{3,12}$'),
  add column if not exists fide_standard int
    constraint memberships_fide_standard_check check (fide_standard is null or fide_standard between 1000 and 3300),
  add column if not exists fide_rapid int
    constraint memberships_fide_rapid_check check (fide_rapid is null or fide_rapid between 1000 and 3300),
  add column if not exists fide_blitz int
    constraint memberships_fide_blitz_check check (fide_blitz is null or fide_blitz between 1000 and 3300);

-- Chủ học viện bật/tắt FIDE (dữ liệu đã nhập được giữ lại khi tắt)
create function public.set_academy_fide_enabled(p_academy uuid, p_enabled boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.has_role(p_academy, '{owner}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  update public.academies set fide_enabled = p_enabled where id = p_academy;
  if not found then
    raise exception 'academy_not_found' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.set_academy_fide_enabled(uuid, boolean) from public, anon;
grant execute on function public.set_academy_fide_enabled(uuid, boolean) to authenticated;

-- Nhân sự (owner, coach) nhập mã FIDE và Elo FIDE của một học viên; null hoặc chuỗi rỗng = xoá giá trị.
-- Ràng buộc sai (mã không phải 3-12 chữ số, Elo ngoài 1000-3300) trả lỗi check_violation (23514).
create function public.set_member_fide(
  p_academy uuid,
  p_student uuid,
  p_fide_id text,
  p_standard int,
  p_rapid int,
  p_blitz int
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.has_role(p_academy, '{owner,coach}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.memberships
  set fide_id = nullif(btrim(p_fide_id), ''),
      fide_standard = p_standard,
      fide_rapid = p_rapid,
      fide_blitz = p_blitz
  where academy_id = p_academy and user_id = p_student and role = 'student';
  if not found then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.set_member_fide(uuid, uuid, text, int, int, int) from public, anon;
grant execute on function public.set_member_fide(uuid, uuid, text, int, int, int) to authenticated;
