-- Giai đoạn 8b: phân quyền kênh Realtime riêng tư của phòng học trực tuyến.
-- Realtime kiểm quyền một lần khi vào kênh (không theo từng tin), nên tách hai kênh:
--   classroom:<id>        chat, xin đi quân, xin đồng bộ, presence — ai xem được lớp đều gửi được
--   classroom:<id>:board  trạng thái bàn cờ, mũi tên, trao quyền — chỉ người điều khiển lớp gửi

create function private.classroom_topic_id(p_topic text)
returns uuid
language sql immutable set search_path = ''
as $$
  select case
    when p_topic ~ '^classroom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(:board)?$'
      then substr(p_topic, 11, 36)::uuid
  end;
$$;

grant execute on function private.classroom_topic_id(text) to authenticated;

create policy "classroom realtime: người xem được lớp thì nghe"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and private.can_view_classroom(private.classroom_topic_id((select realtime.topic())))
  );

create policy "classroom realtime: gửi theo kênh"
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and case
      when (select realtime.topic()) like '%:board'
        then private.can_run_classroom(private.classroom_topic_id((select realtime.topic())))
      else private.can_view_classroom(private.classroom_topic_id((select realtime.topic())))
    end
  );
