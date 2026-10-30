-- Giai đoạn 22a: white-label học viện — favicon, màu thương hiệu, thông tin liên hệ, và bucket
-- `academy-branding` để chủ học viện tải logo/favicon lên (thay vì chỉ dán link https).

alter table public.academies
  add column if not exists favicon_url text check (favicon_url is null or favicon_url ~ '^https://'),
  add column if not exists brand_color text check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists contact jsonb not null default '{}'::jsonb
    check (jsonb_typeof(contact) = 'object' and pg_column_size(contact) <= 2048);

-- Logo/favicon hiển thị cả ở trang công khai (lời mời, chứng chỉ) nên bucket để public-read.
-- SVG chỉ được hiển thị qua thẻ <img> (không chạy script).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'academy-branding', 'academy-branding', true, 1048576,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
)
on conflict (id) do nothing;

-- Đường dẫn: <academy_id>/<tên tệp>; chỉ chủ học viện được ghi.
create policy "academy-branding: chủ học viện tải lên"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'academy-branding' and private.has_role(private.path_academy(name), '{owner}')
  );

create policy "academy-branding: chủ học viện sửa"
  on storage.objects for update to authenticated
  using (bucket_id = 'academy-branding' and private.has_role(private.path_academy(name), '{owner}'))
  with check (
    bucket_id = 'academy-branding' and private.has_role(private.path_academy(name), '{owner}')
  );
