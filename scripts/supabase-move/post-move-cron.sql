-- Sau khi chuyển Supabase sang self-host (docs/plans/21, bước B2): trỏ job pg_cron `tournament-tick`
-- sang Edge Functions của instance mới. KHÔNG phải migration: migration 20261025000018 cứng URL của
-- cloud `erpchess-dev` và erpchess-dev vẫn chạy song song, nên chỉ chạy file này trên DB MỚI.
--
-- Chạy (idempotent, chạy lại an toàn): dán vào SQL Editor (Studio của instance mới) hoặc psql kết nối DB mới.
--
-- Chuỗi bí mật `private.cron_secrets.tournament_tick` do migration tự sinh NGẪU NHIÊN trong DB mới
-- (không chép từ cloud) và Edge Function kiểm bằng public.cron_secret_ok, nên không cần đặt khoá nào ở đây.
-- Hoàn tác: chạy lại hàm gốc trong migration 20261025000018 (URL cloud).

create or replace function private.invoke_tournament_tick()
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_secret text;
begin
  select s.secret into v_secret from private.cron_secrets s where s.name = 'tournament_tick';
  return net.http_post(
    url := 'https://supabaseerpchess.dsc.edu.vn/functions/v1/tournament-tick',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tick-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;
revoke execute on function private.invoke_tournament_tick() from public, anon, authenticated;
