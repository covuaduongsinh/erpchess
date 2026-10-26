-- Giai đoạn 12b: thông báo trong app + nhắc đóng phí.
-- Mỗi dòng notifications là một lần gửi tới một người (cũng là nhật ký gửi). Chỉ trigger/hàm nội
-- bộ ghi; người nhận đọc và đánh dấu đã đọc; owner đọc toàn bộ nhật ký học viện mình.
-- Đẩy realtime lên kênh riêng `user:<id>`. Email/push để sau (cùng bảng, thêm kênh).

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('class', 'quiz', 'tournament', 'invoice', 'invoice_reminder', 'system')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 1000),
  link text not null default '' check (char_length(link) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_academy_idx on public.notifications (academy_id, created_at desc);

-- Không có dòng = loại đó đang bật
create table public.notification_settings (
  academy_id uuid not null references public.academies (id) on delete cascade,
  category text not null check (category in ('class', 'quiz', 'tournament', 'invoice', 'invoice_reminder', 'system')),
  enabled boolean not null default true,
  primary key (academy_id, category)
);

-- Không có dòng = nhắc 3 ngày trước hạn và đúng ngày hạn
create table public.reminder_rules (
  academy_id uuid not null references public.academies (id) on delete cascade,
  kind text not null default 'invoice_due' check (kind in ('invoice_due')),
  days_before int[] not null default '{3,0}'
    check (cardinality(days_before) between 1 and 5 and 0 <= all (days_before) and 30 >= all (days_before)),
  enabled boolean not null default true,
  primary key (academy_id, kind)
);

create table public.reminder_sent (
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  days_before int not null,
  sent_at timestamptz not null default now(),
  primary key (invoice_id, days_before)
);

-- ───────────────────────── Hàm nội bộ ─────────────────────────

-- Học viên kèm phụ huynh của họ trong học viện
create function private.with_parents(p_academy uuid, p_users uuid[])
returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct u), '{}')
  from (
    select unnest(p_users) as u
    union
    select pl.parent_id from public.parent_links pl
    where pl.academy_id = p_academy and pl.student_id = any (p_users)
  ) s
  where u is not null
$$;

-- Học viên của một đích giao (lớp hoặc một học viên)
create function private.target_students(p_group uuid, p_student uuid)
returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select case
    when p_student is not null then array[p_student]
    else coalesce((select array_agg(gm.student_id) from public.group_members gm where gm.group_id = p_group), '{}')
  end
$$;

create function private.fmt_money(p_amount bigint, p_currency text)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_currency in ('VND', 'JPY', 'KRW')
      then replace(to_char(p_amount, 'FM999,999,999,999,990'), ',', '.') || ' ' || p_currency
    else to_char(p_amount / 100.0, 'FM999,999,999,990.00') || ' ' || p_currency
  end
$$;

create function private.vn_time(p_ts timestamptz)
returns text
language sql immutable set search_path = ''
as $$ select to_char(p_ts at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM/YYYY') $$;

-- Gửi một thông báo tới nhiều người; bỏ qua nếu học viện tắt loại này. Trả số người nhận.
create function private.notify(
  p_academy uuid, p_users uuid[], p_category text, p_title text, p_body text default '', p_link text default ''
)
returns int
language plpgsql security definer set search_path = ''
as $$
declare r record; v_n int := 0;
begin
  if exists (
    select 1 from public.notification_settings s
    where s.academy_id = p_academy and s.category = p_category and not s.enabled
  ) then
    return 0;
  end if;
  for r in
    insert into public.notifications (academy_id, user_id, category, title, body, link)
    select p_academy, u, p_category, left(p_title, 200), left(coalesce(p_body, ''), 1000), left(coalesce(p_link, ''), 300)
    from (select distinct unnest(p_users) as u) x
    where u is not null and u is distinct from (select auth.uid())
    returning id, user_id, category, title, body, link, created_at
  loop
    v_n := v_n + 1;
    perform realtime.send(
      jsonb_build_object('id', r.id, 'academy_id', p_academy, 'category', r.category, 'title', r.title,
                         'body', r.body, 'link', r.link, 'created_at', r.created_at),
      'notification', 'user:' || r.user_id, true
    );
  end loop;
  return v_n;
end;
$$;
revoke execute on function private.notify(uuid, uuid[], text, text, text, text) from public, anon, authenticated;

create function private.academy_slug(p_academy uuid)
returns text
language sql stable security definer set search_path = ''
as $$ select slug::text from public.academies where id = p_academy $$;

-- ───────────────────────── Trigger phát thông báo ─────────────────────────

create function private.notify_quiz_target()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare q record;
begin
  select id, academy_id, title, due_at into q from public.quizzes where id = new.quiz_id;
  perform private.notify(
    q.academy_id,
    private.with_parents(q.academy_id, private.target_students(new.group_id, new.student_id)),
    'quiz', 'Quiz mới: ' || q.title,
    case when q.due_at is not null then 'Hạn: ' || private.vn_time(q.due_at) else '' end,
    '/a/' || private.academy_slug(q.academy_id) || '/quizzes/' || q.id
  );
  return new;
end;
$$;
create trigger quiz_targets_notify after insert on public.quiz_targets
  for each row execute function private.notify_quiz_target();

create function private.notify_quiz_open()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.open_to_all and (tg_op = 'INSERT' or not old.open_to_all) then
    perform private.notify(
      new.academy_id,
      private.with_parents(new.academy_id, (
        select coalesce(array_agg(m.user_id), '{}') from public.memberships m
        where m.academy_id = new.academy_id and m.role = 'student'
      )),
      'quiz', 'Quiz mới: ' || new.title,
      case when new.due_at is not null then 'Hạn: ' || private.vn_time(new.due_at) else '' end,
      '/a/' || private.academy_slug(new.academy_id) || '/quizzes/' || new.id
    );
  end if;
  return new;
end;
$$;
create trigger quizzes_notify_open after insert or update of open_to_all on public.quizzes
  for each row execute function private.notify_quiz_open();

create function private.notify_classroom_target()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare c record;
begin
  select id, academy_id, title, starts_at into c from public.classrooms where id = new.classroom_id;
  perform private.notify(
    c.academy_id,
    private.with_parents(c.academy_id, private.target_students(new.group_id, new.student_id)),
    'class', 'Buổi học mới: ' || c.title,
    'Bắt đầu ' || private.vn_time(c.starts_at),
    '/a/' || private.academy_slug(c.academy_id) || '/classes/' || c.id
  );
  return new;
end;
$$;
create trigger classroom_targets_notify after insert on public.classroom_targets
  for each row execute function private.notify_classroom_target();

create function private.notify_tournament_player()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare t record;
begin
  select id, academy_id, title, starts_at into t from public.tournaments where id = new.tournament_id;
  perform private.notify(
    t.academy_id, private.with_parents(t.academy_id, array[new.player_id]),
    'tournament', 'Bạn có tên trong giải: ' || t.title,
    case when t.starts_at is not null then 'Bắt đầu ' || private.vn_time(t.starts_at) else '' end,
    '/a/' || private.academy_slug(t.academy_id) || '/tournaments/' || t.id
  );
  return new;
end;
$$;
create trigger tournament_players_notify after insert on public.tournament_players
  for each row execute function private.notify_tournament_player();

create function private.notify_invoice()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'open' then
    perform private.notify(
      new.academy_id, private.with_parents(new.academy_id, array[new.student_id]),
      'invoice', 'Hoá đơn học phí mới ' || new.number,
      private.fmt_money(new.total, new.currency)
        || case when new.due_on is not null then ' · hạn ' || to_char(new.due_on, 'DD/MM/YYYY') else '' end,
      '/a/' || private.academy_slug(new.academy_id) || '/billing/' || new.id
    );
  end if;
  return new;
end;
$$;
create trigger invoices_notify after insert on public.invoices
  for each row execute function private.notify_invoice();

-- ───────────────────────── Nhắc đóng phí ─────────────────────────

-- Gửi nhắc cho hoá đơn còn nợ có hạn cách hôm nay đúng số ngày trong quy tắc; mỗi mốc một lần.
create function private.run_fee_reminders(p_academy uuid default null, p_today date default null)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := coalesce(p_today, (now() at time zone 'Asia/Ho_Chi_Minh')::date);
  r record;
  v_sent int := 0;
begin
  for r in
    select i.id, i.academy_id, i.student_id, i.number, i.total - i.paid_amount as due, i.currency, i.due_on,
           (i.due_on - v_today) as days
    from public.invoices i
    left join public.reminder_rules rr on rr.academy_id = i.academy_id and rr.kind = 'invoice_due'
    where i.status = 'open'
      and i.due_on is not null
      and (p_academy is null or i.academy_id = p_academy)
      and coalesce(rr.enabled, true)
      and (i.due_on - v_today) = any (coalesce(rr.days_before, '{3,0}'))
  loop
    insert into public.reminder_sent (invoice_id, days_before) values (r.id, r.days)
      on conflict do nothing;
    if found then
      perform private.notify(
        r.academy_id, private.with_parents(r.academy_id, array[r.student_id]),
        'invoice_reminder', 'Nhắc đóng học phí ' || r.number,
        private.fmt_money(r.due, r.currency) || ' · '
          || case when r.days = 0 then 'đến hạn hôm nay' else 'đến hạn sau ' || r.days || ' ngày (' || to_char(r.due_on, 'DD/MM/YYYY') || ')' end,
        '/a/' || private.academy_slug(r.academy_id) || '/billing/' || r.id
      );
      v_sent := v_sent + 1;
    end if;
  end loop;
  return v_sent;
end;
$$;
revoke execute on function private.run_fee_reminders(uuid, date) from public, anon, authenticated;

-- Owner chạy nhắc phí ngay cho học viện mình (ngoài lịch tự động 8:00 hằng ngày)
create function public.run_fee_reminders_now(p_academy uuid)
returns int
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.has_role(p_academy, '{owner}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return private.run_fee_reminders(p_academy);
end;
$$;
revoke execute on function public.run_fee_reminders_now(uuid) from public, anon;
grant execute on function public.run_fee_reminders_now(uuid) to authenticated;

-- 01:00 UTC = 08:00 giờ Việt Nam
select cron.schedule('fee-reminders', '0 1 * * *', 'select private.run_fee_reminders()');

-- ───────────────────────── Đã đọc + thống kê ─────────────────────────

-- p_ids null = đánh dấu mọi thông báo (của học viện p_academy nếu có) là đã đọc
create function public.mark_notifications_read(p_ids uuid[] default null, p_academy uuid default null)
returns int
language sql security definer set search_path = ''
as $$
  with u as (
    update public.notifications set read_at = now()
    where user_id = (select auth.uid()) and read_at is null
      and (p_ids is null or id = any (p_ids))
      and (p_academy is null or academy_id = p_academy)
    returning 1
  )
  select count(*)::int from u
$$;
revoke execute on function public.mark_notifications_read(uuid[], uuid) from public, anon;
grant execute on function public.mark_notifications_read(uuid[], uuid) to authenticated;

-- Nhật ký theo loại; security_invoker nên chỉ owner thấy số của cả học viện
create view public.notification_stats with (security_invoker = true) as
  select academy_id, category, count(*)::int as sent, count(read_at)::int as read,
         max(created_at) as last_sent_at
  from public.notifications
  group by academy_id, category;

-- ───────────────────────── RLS ─────────────────────────

alter table public.notifications enable row level security;
alter table public.notification_settings enable row level security;
alter table public.reminder_rules enable row level security;
alter table public.reminder_sent enable row level security;

create policy "notifications: người nhận, owner xem nhật ký"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role(academy_id, '{owner}'));
create policy "notifications: người nhận xoá"
  on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "notification_settings: thành viên đọc"
  on public.notification_settings for select to authenticated
  using (private.is_member(academy_id));
create policy "notification_settings: owner ghi"
  on public.notification_settings for all to authenticated
  using (private.has_role(academy_id, '{owner}'))
  with check (private.has_role(academy_id, '{owner}'));

create policy "reminder_rules: owner"
  on public.reminder_rules for all to authenticated
  using (private.has_role(academy_id, '{owner}'))
  with check (private.has_role(academy_id, '{owner}'));

create policy "reminder_sent: owner đọc"
  on public.reminder_sent for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and private.has_role(i.academy_id, '{owner}')));

-- Kênh riêng: chỉ chính người dùng nghe được `user:<id>`
create policy "user realtime: chỉ chủ kênh nghe"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'user:' || (select auth.uid())::text
  );
