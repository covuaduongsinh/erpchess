-- Sửa lỗi: học viên bấm "Thách đấu" trong Game Area chèn trực tiếp vào `games`, nhưng RLS chỉ cho
-- staff ghép cặp nên bị từ chối. Thách đấu đi qua hàm này (security definer) với các ràng buộc riêng:
-- người gọi phải là một trong hai kỳ thủ, cả hai là thành viên (owner/coach/student) của học viện.

create function public.create_challenge(
  p_academy uuid,
  p_opponent uuid,
  p_color text,
  p_base_ms int,
  p_inc_ms int,
  p_rated boolean
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_white uuid;
  v_black uuid;
  v_category text;
  v_game uuid;
begin
  if v_uid is null or not private.has_role(p_academy, '{owner,coach,student}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_opponent is null or p_opponent = v_uid then
    raise exception 'same_player' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.academy_id = p_academy and m.user_id = p_opponent
      and m.role in ('owner', 'coach', 'student')
  ) then
    raise exception 'opponent_not_member' using errcode = '22023';
  end if;
  if p_color is null or p_color not in ('w', 'b', 'random') then
    raise exception 'invalid_color' using errcode = '22023';
  end if;
  if (p_base_ms is not null and p_base_ms not between 60000 and 10800000)
     or p_inc_ms is null or p_inc_ms not between 0 and 180000 then
    raise exception 'invalid_time_control' using errcode = '22023';
  end if;
  -- Chống tạo hàng loạt: tối đa 3 ván đang diễn ra do mình mở
  if (
    select count(*) from public.games g
    where g.academy_id = p_academy and g.created_by = v_uid and g.status = 'active'
      and g.bot_elo is null and g.simul_id is null
  ) >= 3 then
    raise exception 'too_many_active_games' using errcode = '22023';
  end if;

  if p_color = 'w' or (p_color = 'random' and random() < 0.5) then
    v_white := v_uid; v_black := p_opponent;
  else
    v_white := p_opponent; v_black := v_uid;
  end if;

  -- Cùng công thức với categoryOf (chess-core); không giới hạn thời gian thì không tính rating
  v_category := case
    when p_base_ms is null then null
    when p_base_ms + 40 * p_inc_ms < 600000 then 'blitz'
    when p_base_ms + 40 * p_inc_ms < 3600000 then 'rapid'
    else 'classical'
  end;

  insert into public.games (
    academy_id, white_id, black_id, fen, base_ms, inc_ms, white_ms, black_ms,
    rated, category, created_by
  )
  values (
    p_academy, v_white, v_black, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    p_base_ms, p_inc_ms, p_base_ms, p_base_ms,
    coalesce(p_rated, false) and p_base_ms is not null, v_category, v_uid
  )
  returning id into v_game;
  return v_game;
end;
$$;

revoke execute on function public.create_challenge(uuid, uuid, text, int, int, boolean) from public, anon;
grant execute on function public.create_challenge(uuid, uuid, text, int, int, boolean) to authenticated;
