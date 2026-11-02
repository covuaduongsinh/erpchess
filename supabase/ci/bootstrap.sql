-- Dựng phần mà image supabase/postgres đơn lẻ chưa có, để áp migration và chạy pgTAP trong CI (và cục bộ).
-- Chạy bằng supabase_admin (superuser) TRƯỚC khi áp migration; chạy lại an toàn.
--
-- Image đã có: vai trò (anon, authenticated, service_role…), schema auth/storage/extensions, pg_net, pgcrypto.
-- Chưa có: extension pg_cron (không-trusted, cần superuser) và schema realtime (do dịch vụ supabase/realtime tạo).
-- Các migration 13 và 14 tạo policy trên realtime.messages và gọi realtime.send(), nên ở đây dựng bản rút gọn
-- cùng hình dạng (bảng, RLS, quyền, topic(), send()) — đủ để migration và test phân quyền kênh chạy như thật.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists realtime;
grant usage on schema realtime to postgres, anon, authenticated, service_role;

create table if not exists realtime.messages (
  topic text not null,
  extension text not null,
  payload jsonb,
  event text,
  private boolean default false,
  updated_at timestamp not null default now(),
  inserted_at timestamp not null default now(),
  id uuid not null default gen_random_uuid() primary key
);
alter table realtime.messages enable row level security;
grant all on realtime.messages to postgres;
grant select, insert, update on realtime.messages to anon, authenticated, service_role;
-- Vai trò `postgres` (người áp migration, như trên Supabase) phải là chủ bảng để tạo policy
alter table realtime.messages owner to postgres;

-- Realtime đặt chủ đề kênh hiện tại vào cài đặt `realtime.topic` rồi policy gọi realtime.topic()
create or replace function realtime.topic() returns text
language sql stable
as $$ select nullif(current_setting('realtime.topic', true), '')::text $$;

-- Bản rút gọn: dịch vụ thật phát tin tới người đang nghe; ở đây chỉ cần hàm tồn tại và không lỗi
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void
language sql
as $$ select $$;

grant execute on function realtime.topic() to postgres, anon, authenticated, service_role;
grant execute on function realtime.send(jsonb, text, text, boolean) to postgres, anon, authenticated, service_role;

-- ── auth.users (GoTrue tạo bảng này ở môi trường thật; image đơn lẻ chỉ có auth.uid()/role()/email()) ──
-- Bản rút gọn: đủ cột mà migration/test dùng (khoá ngoại, trigger tạo profile, insert id/email/raw_user_meta_data).
create table if not exists auth.users (
  instance_id uuid,
  id uuid primary key,
  aud varchar(255),
  role varchar(255),
  email varchar(255) unique,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  phone text,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  is_anonymous boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_sign_in_at timestamptz,
  deleted_at timestamptz
);
grant usage on schema auth to postgres, anon, authenticated, service_role;
grant select on auth.users to postgres, service_role;
-- postgres phải là chủ bảng để migration tạo trigger trên auth.users (như quyền của postgres trên Supabase thật)
alter table auth.users owner to postgres;

-- ── storage.buckets / storage.objects / storage.foldername() (storage-api tạo ở môi trường thật) ──
create table if not exists storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  public boolean default false,
  avif_autodetection boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored,
  version text,
  owner_id text,
  user_metadata jsonb
);
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to postgres, anon, authenticated, service_role;
alter table storage.buckets owner to postgres;
alter table storage.objects owner to postgres;

create or replace function storage.foldername(name text) returns text[]
language plpgsql
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;
grant execute on function storage.foldername(text) to postgres, anon, authenticated, service_role;

-- ── auth.uid()/role()/email(): bản hiện đại của GoTrue đọc cả `request.jwt.claims` (JSON) ──
-- Image đơn lẻ chỉ có bản cũ đọc `request.jwt.claim.sub`; các test mô phỏng đăng nhập bằng `request.jwt.claims`.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create or replace function auth.email() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;
