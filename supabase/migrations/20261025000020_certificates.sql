-- Giai đoạn 11b: chứng chỉ hoàn thành khoá học + xác minh công khai bằng mã.
-- Chỉ ghi qua RPC security definer (tên học viên/học viện chụp lại lúc cấp, không cho sửa tay);
-- người lạ chỉ gọi được verify_certificate(code), không đọc được bảng.

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[2-9A-HJ-NP-Z]{10}$'),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  title text not null check (char_length(title) between 2 and 200),
  student_name text not null,
  academy_name text not null,
  issued_at timestamptz not null default now(),
  issued_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz
);
create index certificates_student_idx on public.certificates (student_id);
create index certificates_academy_idx on public.certificates (academy_id, issued_at desc);
-- Mỗi khoá chỉ một chứng chỉ còn hiệu lực cho mỗi học viên
create unique index certificates_course_active_idx on public.certificates (course_id, student_id)
  where course_id is not null and revoked_at is null;

-- Mã 10 ký tự base32 (bỏ 0/1/I/O cho dễ đọc), ~50 bit ngẫu nhiên
create function private.certificate_code()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_bytes bytea;
  v_code text;
begin
  loop
    v_bytes := extensions.gen_random_bytes(10);
    v_code := '';
    for i in 0..9 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) & 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.certificates c where c.code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Cấp chứng chỉ (không kiểm quyền — chỉ gọi từ trigger hoặc RPC đã kiểm)
create function private.issue_certificate(
  p_academy uuid, p_student uuid, p_course uuid, p_title text, p_by uuid
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.certificates (code, academy_id, student_id, course_id, title, student_name, academy_name, issued_by)
  select private.certificate_code(), p_academy, p_student, p_course, p_title,
         coalesce(nullif(p.display_name, ''), p.username::text, ''), a.name, p_by
  from public.profiles p, public.academies a
  where p.id = p_student and a.id = p_academy
  on conflict (course_id, student_id) where course_id is not null and revoked_at is null do nothing
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function private.issue_certificate(uuid, uuid, uuid, text, uuid) from public, authenticated;

-- Tự cấp khi hoàn thành khoá bật auto_certificate
create function private.certificate_on_completion()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare c record;
begin
  select co.academy_id, co.title, co.auto_certificate into c from public.courses co where co.id = new.course_id;
  if c.auto_certificate then
    perform private.issue_certificate(c.academy_id, new.student_id, new.course_id, c.title, null);
  end if;
  return new;
end;
$$;
create trigger certificate_on_completion
  after insert on public.course_completions
  for each row execute function private.certificate_on_completion();

-- ───────────────────────── RPC cho staff ─────────────────────────

create function public.issue_certificate(
  p_academy uuid, p_student uuid, p_title text default null, p_course uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_title text := nullif(btrim(coalesce(p_title, '')), ''); v_id uuid;
begin
  if not private.has_role(p_academy, '{owner,coach}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.memberships m where m.academy_id = p_academy and m.user_id = p_student and m.role = 'student'
  ) then
    raise exception 'not a student of this academy' using errcode = '22023';
  end if;
  if p_course is not null then
    if private.course_academy(p_course) is distinct from p_academy then
      raise exception 'course not in academy' using errcode = '22023';
    end if;
    v_title := coalesce(v_title, (select co.title from public.courses co where co.id = p_course));
  end if;
  if v_title is null then
    raise exception 'title required' using errcode = '22023';
  end if;
  v_id := private.issue_certificate(p_academy, p_student, p_course, v_title, (select auth.uid()));
  if v_id is null then
    raise exception 'certificate already issued' using errcode = '23505';
  end if;
  return v_id;
end;
$$;
revoke execute on function public.issue_certificate(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.issue_certificate(uuid, uuid, text, uuid) to authenticated;

create function public.revoke_certificate(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.certificates c where c.id = p_id and private.has_role(c.academy_id, '{owner,coach}')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.certificates set revoked_at = coalesce(revoked_at, now()) where id = p_id;
end;
$$;
revoke execute on function public.revoke_certificate(uuid) from public, anon;
grant execute on function public.revoke_certificate(uuid) to authenticated;

-- ───────────────────────── Xác minh công khai ─────────────────────────

-- Chỉ trả đúng các trường in trên chứng chỉ; mã nhập có thể thường/hoa, có gạch/khoảng trắng
create function public.verify_certificate(p_code text)
returns table (code text, title text, student_name text, academy_name text, issued_at timestamptz, revoked_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select c.code, c.title, c.student_name, c.academy_name, c.issued_at, c.revoked_at
  from public.certificates c
  where c.code = upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g'));
$$;
revoke execute on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ───────────────────────── RLS ─────────────────────────

alter table public.certificates enable row level security;
create policy "certificates: của mình, phụ huynh, staff đọc"
  on public.certificates for select to authenticated
  using (private.can_see_student(student_id) and (private.is_member(academy_id) or private.is_parent_of(student_id)));
-- Không có policy ghi: chỉ RPC/trigger ở trên

-- Bù chứng chỉ cho các khoá đã hoàn thành trước đó
select private.issue_certificate(co.academy_id, cc.student_id, cc.course_id, co.title, null)
from public.course_completions cc
join public.courses co on co.id = cc.course_id
where co.auto_certificate;
