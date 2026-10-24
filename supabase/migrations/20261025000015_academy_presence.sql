-- Giai đoạn 9b: presence toàn học viện (ai đang online) trên kênh Realtime riêng tư
-- `academy:<id>:online`. Chỉ thành viên học viện được nghe và báo mình đang online.

create function private.academy_topic_id(p_topic text)
returns uuid
language sql immutable set search_path = ''
as $$
  select case
    when p_topic ~ '^academy:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:online$'
      then substr(p_topic, 9, 36)::uuid
  end;
$$;

grant execute on function private.academy_topic_id(text) to authenticated;

create policy "academy presence: thành viên nghe"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'presence'
    and private.is_member(private.academy_topic_id((select realtime.topic())))
  );

create policy "academy presence: thành viên báo online"
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and private.is_member(private.academy_topic_id((select realtime.topic())))
  );
