-- Giai đoạn 12c: Lead + lớp học thử, chat theo Group/Batch và nhắn riêng.
-- Lead chỉ staff thấy. Chat: thành viên hội thoại đọc/gửi; phụ huynh xem được hội thoại có con
-- mình; không có nhắn riêng học viên ↔ học viên (trẻ em) — mọi hội thoại riêng phải có staff.

alter table public.academies add column leads_enabled boolean not null default false;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  phone text not null default '' check (char_length(phone) <= 30),
  email text not null default '' check (char_length(email) <= 120),
  child_name text not null default '' check (char_length(child_name) <= 120),
  child_age int check (child_age between 3 and 99),
  source text not null default '' check (char_length(source) <= 60),
  status text not null default 'new' check (status in ('new', 'contacted', 'trial', 'won', 'lost')),
  note text not null default '' check (char_length(note) <= 2000),
  assigned_to uuid references public.profiles (id) on delete set null,
  trial_event_id uuid references public.calendar_events (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_academy_idx on public.leads (academy_id, created_at desc);
create index leads_assigned_idx on public.leads (assigned_to) where assigned_to is not null;
create index leads_trial_idx on public.leads (trial_event_id) where trial_event_id is not null;
create trigger leads_touch before update on public.leads
  for each row execute function private.touch_updated_at();

alter table public.leads enable row level security;
create policy "leads: staff"
  on public.leads for all to authenticated
  using (private.has_role(academy_id, '{owner,coach}'))
  with check (private.has_role(academy_id, '{owner,coach}'));

-- Hẹn học thử: tạo sự kiện lịch loại 'trial' và gắn vào lead
create function public.schedule_trial(p_lead uuid, p_starts timestamptz, p_ends timestamptz, p_coach uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_lead record; v_event uuid;
begin
  select * into v_lead from public.leads where id = p_lead for update;
  if not found or not private.has_role(v_lead.academy_id, '{owner,coach}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_ends <= p_starts then
    raise exception 'invalid time range' using errcode = '22023';
  end if;
  if p_coach is not null and not exists (
    select 1 from public.memberships m
    where m.academy_id = v_lead.academy_id and m.user_id = p_coach and m.role in ('owner', 'coach')
  ) then
    raise exception 'coach not in academy' using errcode = '22023';
  end if;
  insert into public.calendar_events (academy_id, coach_id, kind, title, starts_at, ends_at, created_by)
  values (v_lead.academy_id, coalesce(p_coach, (select auth.uid())), 'trial',
          left('Học thử: ' || coalesce(nullif(v_lead.child_name, ''), v_lead.name), 160),
          p_starts, p_ends, (select auth.uid()))
  returning id into v_event;
  update public.leads
    set trial_event_id = v_event, status = case when status in ('new', 'contacted') then 'trial' else status end
    where id = p_lead;
  return v_event;
end;
$$;
revoke execute on function public.schedule_trial(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.schedule_trial(uuid, timestamptz, timestamptz, uuid) to authenticated;

-- ───────────────────────── Chat ─────────────────────────

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  kind text not null check (kind in ('group', 'direct')),
  group_id uuid references public.groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  check ((kind = 'group') = (group_id is not null))
);
create unique index conversations_group_uidx on public.conversations (group_id) where group_id is not null;
create index conversations_academy_idx on public.conversations (academy_id, last_message_at desc nulls last);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id);

-- Thành viên hội thoại. Với chat lớp, học viên đã rời Group/Batch thì không còn quyền (dòng
-- thành viên cũ giữ lại làm lịch sử, không xoá).
create function private.is_conversation_member(p_conversation uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    left join public.groups g on g.id = c.group_id
    where cm.conversation_id = p_conversation and cm.user_id = (select auth.uid())
      and (
        c.group_id is null
        or g.coach_id = cm.user_id
        or private.has_role(c.academy_id, '{owner,coach}')
        or exists (select 1 from public.group_members gm where gm.group_id = c.group_id and gm.student_id = cm.user_id)
      )
  )
$$;

-- Thành viên, hoặc phụ huynh của một thành viên
create function private.can_view_conversation(p_conversation uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_conversation_member(p_conversation) or exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation and private.is_parent_of(cm.user_id)
  )
$$;

create function private.chat_topic_id(p_topic text)
returns uuid
language sql immutable set search_path = ''
as $$
  select case
    when p_topic ~ '^chat:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then substr(p_topic, 6, 36)::uuid
  end
$$;
grant execute on function private.chat_topic_id(text) to authenticated;

-- Mở (tạo nếu chưa có) hội thoại của một Group/Batch và thêm thành viên còn thiếu:
-- HLV phụ trách + học viên hiện tại + staff đang mở.
create function public.open_group_chat(p_group uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_g record; v_id uuid; v_uid uuid := (select auth.uid());
begin
  select * into v_g from public.groups where id = p_group;
  if not found or not (
    private.has_role(v_g.academy_id, '{owner,coach}')
    or exists (select 1 from public.group_members gm where gm.group_id = p_group and gm.student_id = v_uid)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.conversations (academy_id, kind, group_id) values (v_g.academy_id, 'group', p_group)
    on conflict (group_id) where group_id is not null do nothing;
  select id into v_id from public.conversations where group_id = p_group;
  insert into public.conversation_members (conversation_id, user_id)
    select v_id, u from (
      select gm.student_id as u from public.group_members gm where gm.group_id = p_group
      union select v_g.coach_id
      union select v_uid where private.has_role(v_g.academy_id, '{owner,coach}')
    ) s
    where u is not null
    on conflict do nothing;
  return v_id;
end;
$$;
revoke execute on function public.open_group_chat(uuid) from public, anon;
grant execute on function public.open_group_chat(uuid) to authenticated;

-- Nhắn riêng: phải có ít nhất một bên là staff (owner/coach) của học viện.
create function public.open_direct_chat(p_academy uuid, p_user uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid()); v_id uuid;
begin
  if p_user = v_uid or not private.is_member(p_academy) or not exists (
    select 1 from public.memberships m where m.academy_id = p_academy and m.user_id = p_user
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not (
    private.has_role(p_academy, '{owner,coach}')
    or exists (select 1 from public.memberships m
               where m.academy_id = p_academy and m.user_id = p_user and m.role in ('owner', 'coach'))
  ) then
    raise exception 'direct chat needs a staff member' using errcode = '42501';
  end if;
  select c.id into v_id
  from public.conversations c
  where c.academy_id = p_academy and c.kind = 'direct'
    and exists (select 1 from public.conversation_members a where a.conversation_id = c.id and a.user_id = v_uid)
    and exists (select 1 from public.conversation_members b where b.conversation_id = c.id and b.user_id = p_user)
  limit 1;
  if v_id is null then
    insert into public.conversations (academy_id, kind) values (p_academy, 'direct') returning id into v_id;
    insert into public.conversation_members (conversation_id, user_id) values (v_id, v_uid), (v_id, p_user);
  end if;
  return v_id;
end;
$$;
revoke execute on function public.open_direct_chat(uuid, uuid) from public, anon;
grant execute on function public.open_direct_chat(uuid, uuid) to authenticated;

create function public.mark_conversation_read(p_conversation uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.conversation_members set last_read_at = now()
  where conversation_id = p_conversation and user_id = (select auth.uid())
$$;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Danh sách hội thoại của tôi kèm tin cuối, số chưa đọc, đối phương (nhắn riêng) hoặc lớp.
create function public.my_conversations(p_academy uuid)
returns table (
  id uuid, kind text, group_id uuid, group_name text, group_kind text,
  other_id uuid, other_name text, other_role text,
  last_body text, last_message_at timestamptz, unread int
)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.kind, c.group_id, g.name, g.kind,
         o.user_id, coalesce(nullif(op.display_name, ''), op.username::text), om.role::text,
         lm.body, c.last_message_at,
         (select count(*)::int from public.messages x
          where x.conversation_id = c.id and x.sender_id is distinct from me.user_id
            and (me.last_read_at is null or x.created_at > me.last_read_at))
  from public.conversations c
  join public.conversation_members me on me.conversation_id = c.id and me.user_id = (select auth.uid())
  left join public.groups g on g.id = c.group_id
  left join lateral (
    select cm.user_id from public.conversation_members cm
    where c.kind = 'direct' and cm.conversation_id = c.id and cm.user_id <> me.user_id limit 1
  ) o on true
  left join public.profiles op on op.id = o.user_id
  left join public.memberships om on om.academy_id = c.academy_id and om.user_id = o.user_id
  left join lateral (
    select m.body from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where c.academy_id = p_academy and private.is_conversation_member(c.id)
  order by c.last_message_at desc nulls last, c.created_at desc
$$;
revoke execute on function public.my_conversations(uuid) from public, anon;
grant execute on function public.my_conversations(uuid) to authenticated;

create function private.on_message()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at
    where conversation_id = new.conversation_id and user_id = new.sender_id;
  perform realtime.send(
    jsonb_build_object('id', new.id, 'conversation_id', new.conversation_id, 'sender_id', new.sender_id,
                       'body', new.body, 'created_at', new.created_at),
    'message', 'chat:' || new.conversation_id, true
  );
  return new;
end;
$$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function private.on_message();

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create policy "conversations: người xem được"
  on public.conversations for select to authenticated
  using (private.can_view_conversation(id));
-- Tạo/đổi thành viên chỉ qua open_group_chat / open_direct_chat

create policy "conversation_members: người xem hội thoại"
  on public.conversation_members for select to authenticated
  using (private.can_view_conversation(conversation_id));

create policy "messages: người xem hội thoại đọc"
  on public.messages for select to authenticated
  using (private.can_view_conversation(conversation_id));
create policy "messages: thành viên gửi"
  on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and private.is_conversation_member(conversation_id));

create policy "chat realtime: người xem hội thoại nghe"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and private.can_view_conversation(private.chat_topic_id((select realtime.topic())))
  );
