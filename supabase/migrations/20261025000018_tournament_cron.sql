-- Giai đoạn 10c: tự lên lịch giải đấu và giải lặp lại. pg_cron mỗi phút gọi Edge Function
-- `tournament-tick` qua pg_net, kèm một chuỗi bí mật sinh ngẫu nhiên ngay trong CSDL (không nằm
-- trong repo, không rời khỏi CSDL trừ khi gửi tới chính function này).

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table private.cron_secrets (
  name text primary key,
  secret text not null
);
revoke all on private.cron_secrets from public, anon, authenticated;

insert into private.cron_secrets (name, secret)
values ('tournament_tick', encode(extensions.gen_random_bytes(32), 'hex'));

-- Function kiểm chuỗi bí mật (chỉ service role gọi được, schema private không lộ qua REST)
create function public.cron_secret_ok(p_name text, p_secret text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from private.cron_secrets s where s.name = p_name and s.secret = p_secret);
$$;
revoke execute on function public.cron_secret_ok(text, text) from public, anon, authenticated;
grant execute on function public.cron_secret_ok(text, text) to service_role;

-- URL của project (không phải bí mật: là địa chỉ API công khai mà client đã dùng)
create function private.invoke_tournament_tick()
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_secret text;
begin
  select s.secret into v_secret from private.cron_secrets s where s.name = 'tournament_tick';
  return net.http_post(
    url := 'https://eordwpktwokvmhymvcyd.supabase.co/functions/v1/tournament-tick',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tick-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;
revoke execute on function private.invoke_tournament_tick() from public, anon, authenticated;

select cron.schedule('tournament-tick', '* * * * *', 'select private.invoke_tournament_tick()');
