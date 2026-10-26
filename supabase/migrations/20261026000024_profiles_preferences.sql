-- Giai đoạn 13a: Hồ sơ cá nhân và tuỳ chọn (múi giờ, ký hiệu nước đi, quốc gia, bio)

alter table public.profiles
  add column if not exists timezone text not null default 'Asia/Ho_Chi_Minh',
  add column if not exists move_notation text not null default 'letters' check (move_notation in ('letters', 'figurine')),
  add column if not exists country text check (char_length(country) <= 64),
  add column if not exists bio text check (char_length(bio) <= 500);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, username, locale, timezone, move_notation)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    nullif(new.raw_user_meta_data ->> 'username', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'vi'),
    coalesce(nullif(new.raw_user_meta_data ->> 'timezone', ''), 'Asia/Ho_Chi_Minh'),
    case when new.raw_user_meta_data ->> 'move_notation' = 'figurine' then 'figurine' else 'letters' end
  );
  return new;
end;
$$;
