-- Giai đoạn 23d: trang đăng nhập riêng của học viện (đặc tả quan sát bằng REA: Branding → Login
-- Page có logo, ảnh nền và các mục nội dung). Chesslang gắn trang này vào tên miền riêng; erpchess
-- phục vụ ở đường dẫn `/login/<slug>` nên không cần cấu hình DNS.

alter table public.academies
  add column if not exists login_background_url text
    check (login_background_url is null or login_background_url ~ '^https://'),
  -- [{ "title": "…", "body": "…" }], tối đa 4 mục
  add column if not exists login_sections jsonb not null default '[]'::jsonb
    check (jsonb_typeof(login_sections) = 'array' and jsonb_array_length(login_sections) <= 4
           and pg_column_size(login_sections) <= 4096);

-- Ảnh nền trang đăng nhập lớn hơn logo: nâng giới hạn bucket lên 3 MB
update storage.buckets set file_size_limit = 3145728 where id = 'academy-branding';

/**
 * Thông tin thương hiệu công khai cho trang đăng nhập (khách chưa đăng nhập gọi được). Chỉ trả các
 * trường vốn để hiển thị công khai; không có thông tin thành viên hay liên hệ nội bộ.
 */
create function public.academy_login_branding(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'name', a.name,
    'slug', a.slug,
    'description', a.description,
    'logo_url', a.logo_url,
    'favicon_url', a.favicon_url,
    'brand_color', a.brand_color,
    'login_background_url', a.login_background_url,
    'login_sections', a.login_sections
  )
  from public.academies a
  where a.slug = p_slug::extensions.citext;
$$;

revoke execute on function public.academy_login_branding(text) from public;
grant execute on function public.academy_login_branding(text) to anon, authenticated;
