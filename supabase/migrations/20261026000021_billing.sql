-- Giai đoạn 12a: học phí — cài đặt Billing, gói (đa tiền tệ), giảm giá, hoá đơn, thanh toán.
-- Số tiền là bigint theo đơn vị nhỏ nhất của tiền tệ (VND: đồng, USD: cent).
-- Chỉ owner quản lý học phí; học viên/phụ huynh chỉ đọc hoá đơn của mình/con.
-- Hoá đơn và thanh toán chỉ ghi qua RPC (tính tiền phía server); người lạ chỉ xem được một hoá
-- đơn qua public_invoice(pay_token) để chuyển khoản VietQR.

create table public.academy_billing (
  academy_id uuid primary key references public.academies (id) on delete cascade,
  currency text not null default 'VND' check (currency ~ '^[A-Z]{3}$'),
  tax_id text check (char_length(tax_id) <= 32),
  invoice_prefix text not null default 'HD' check (invoice_prefix ~ '^[A-Z0-9]{1,8}$'),
  number_year int,
  next_number int not null default 1 check (next_number >= 1),
  bank_bin text check (bank_bin ~ '^\d{6}$'),
  bank_account text check (bank_account ~ '^[0-9A-Za-z]{1,19}$'),
  bank_holder text check (char_length(bank_holder) <= 80),
  updated_at timestamptz not null default now()
);
create trigger academy_billing_touch before update on public.academy_billing
  for each row execute function private.touch_updated_at();

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  sessions int check (sessions between 0 and 1000),
  period text not null default 'month' check (period in ('once', 'month', 'term')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index plans_academy_idx on public.plans (academy_id);

create table public.plan_prices (
  plan_id uuid not null references public.plans (id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount bigint not null check (amount >= 0),
  primary key (plan_id, currency)
);

create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  code text check (code ~ '^[A-Z0-9_-]{2,32}$'),
  kind text not null check (kind in ('percent', 'fixed')),
  value bigint not null check (value >= 1),
  currency text check (currency ~ '^[A-Z]{3}$'),
  starts_on date,
  ends_on date,
  max_uses int check (max_uses >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100),
  check (kind <> 'fixed' or currency is not null),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  unique (academy_id, code)
);
create index discounts_academy_idx on public.discounts (academy_id);

-- Không có dòng nào = áp cho mọi gói
create table public.discount_plans (
  discount_id uuid not null references public.discounts (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete cascade,
  primary key (discount_id, plan_id)
);
create index discount_plans_plan_idx on public.discount_plans (plan_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  number text not null,
  student_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid references public.plans (id) on delete set null,
  discount_id uuid references public.discounts (id) on delete set null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  subtotal bigint not null check (subtotal >= 0),
  discount_amount bigint not null default 0 check (discount_amount between 0 and subtotal),
  total bigint not null,
  paid_amount bigint not null default 0 check (paid_amount >= 0),
  status text not null default 'open' check (status in ('open', 'paid', 'void')),
  due_on date,
  note text not null default '' check (char_length(note) <= 1000),
  pay_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  voided_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  check (total = subtotal - discount_amount),
  unique (academy_id, number)
);
create index invoices_academy_idx on public.invoices (academy_id, issued_at desc);
create index invoices_student_idx on public.invoices (student_id);
create index invoices_discount_idx on public.invoices (discount_id) where discount_id is not null;

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  position int not null,
  description text not null check (char_length(description) between 1 and 200),
  quantity int not null check (quantity between 1 and 1000),
  unit_amount bigint not null check (unit_amount >= 0),
  unique (invoice_id, position)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount bigint not null check (amount > 0),
  method text not null default 'transfer' check (method in ('transfer', 'cash', 'other')),
  reference text not null default '' check (char_length(reference) <= 120),
  paid_at timestamptz not null default now(),
  recorded_by uuid references public.profiles (id) on delete set null
);
create index payments_invoice_idx on public.payments (invoice_id);

-- ───────────────────────── Hàm nội bộ ─────────────────────────

create function private.plan_academy(p_plan uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$ select academy_id from public.plans where id = p_plan $$;

create function private.discount_academy(p_discount uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$ select academy_id from public.discounts where id = p_discount $$;

-- Khớp discountAmount trong packages/domain/src/billing.ts
create function private.discount_amount(p_subtotal bigint, p_currency text, p_kind text, p_value bigint, p_dcur text)
returns bigint
language sql immutable set search_path = ''
as $$
  select case
    when p_subtotal <= 0 then 0
    when p_kind = 'percent' then least(p_subtotal, (p_subtotal * p_value) / 100)
    when p_dcur is not null and p_dcur <> p_currency then 0
    else least(p_subtotal, p_value)
  end
$$;

-- ───────────────────────── RPC cho owner ─────────────────────────

-- p_lines: [{ "description": text, "quantity": int, "unit_amount": bigint }] (thêm sau dòng của gói)
create function public.create_invoice(
  p_academy uuid,
  p_student uuid,
  p_plan uuid default null,
  p_currency text default null,
  p_discount uuid default null,
  p_due date default null,
  p_note text default null,
  p_lines jsonb default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_year int := extract(year from (now() at time zone 'Asia/Ho_Chi_Minh'))::int;
  v_currency text;
  v_plan record;
  v_price bigint;
  v_d record;
  v_uses int;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_b record;
  v_n int;
  v_number text;
  v_id uuid;
  v_pos int := 0;
  v_line jsonb;
begin
  if not private.has_role(p_academy, '{owner}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.memberships m where m.academy_id = p_academy and m.user_id = p_student and m.role = 'student'
  ) then
    raise exception 'not a student of this academy' using errcode = '22023';
  end if;

  insert into public.academy_billing (academy_id) values (p_academy) on conflict do nothing;
  select * into v_b from public.academy_billing where academy_id = p_academy for update;
  v_currency := upper(coalesce(nullif(btrim(p_currency), ''), v_b.currency));
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid currency' using errcode = '22023';
  end if;

  if p_plan is not null then
    select * into v_plan from public.plans where id = p_plan and academy_id = p_academy;
    if not found then
      raise exception 'plan not in academy' using errcode = '22023';
    end if;
    select amount into v_price from public.plan_prices where plan_id = p_plan and currency = v_currency;
    if v_price is null then
      raise exception 'plan has no price in %', v_currency using errcode = '22023';
    end if;
    v_subtotal := v_price;
  end if;

  if p_lines is not null and jsonb_typeof(p_lines) <> 'array' then
    raise exception 'lines must be an array' using errcode = '22023';
  end if;
  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    if coalesce((v_line ->> 'quantity')::int, 0) < 1 or coalesce((v_line ->> 'unit_amount')::bigint, -1) < 0 then
      raise exception 'invalid line' using errcode = '22023';
    end if;
    v_subtotal := v_subtotal + (v_line ->> 'quantity')::int * (v_line ->> 'unit_amount')::bigint;
  end loop;
  if p_plan is null and jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 then
    raise exception 'invoice needs a plan or lines' using errcode = '22023';
  end if;

  if p_discount is not null then
    select * into v_d from public.discounts where id = p_discount and academy_id = p_academy for update;
    if not found then
      raise exception 'discount not in academy' using errcode = '22023';
    end if;
    select count(*) into v_uses from public.invoices where discount_id = p_discount and status <> 'void';
    if not v_d.active
      or (v_d.starts_on is not null and v_today < v_d.starts_on)
      or (v_d.ends_on is not null and v_today > v_d.ends_on)
      or (v_d.max_uses is not null and v_uses >= v_d.max_uses) then
      raise exception 'discount not usable' using errcode = '22023';
    end if;
    if exists (select 1 from public.discount_plans dp where dp.discount_id = p_discount)
      and not exists (select 1 from public.discount_plans dp where dp.discount_id = p_discount and dp.plan_id = p_plan) then
      raise exception 'discount does not apply to this plan' using errcode = '22023';
    end if;
    v_discount := private.discount_amount(v_subtotal, v_currency, v_d.kind, v_d.value, v_d.currency);
  end if;

  -- Số hoá đơn tăng dần, đánh lại từ 1 mỗi năm
  v_n := case when v_b.number_year = v_year then v_b.next_number else 1 end;
  update public.academy_billing set number_year = v_year, next_number = v_n + 1 where academy_id = p_academy;
  v_number := v_b.invoice_prefix || '-' || v_year || '-' || lpad(v_n::text, 4, '0');

  insert into public.invoices (
    academy_id, number, student_id, plan_id, discount_id, currency, subtotal, discount_amount, total,
    status, due_on, note, paid_at, created_by
  ) values (
    p_academy, v_number, p_student, p_plan, p_discount, v_currency, v_subtotal, v_discount, v_subtotal - v_discount,
    case when v_subtotal - v_discount = 0 then 'paid' else 'open' end, p_due, coalesce(btrim(p_note), ''),
    case when v_subtotal - v_discount = 0 then now() end, (select auth.uid())
  ) returning id into v_id;

  if p_plan is not null then
    v_pos := 1;
    insert into public.invoice_lines (invoice_id, position, description, quantity, unit_amount)
    values (v_id, v_pos, left(v_plan.name, 200), 1, v_price);
  end if;
  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_pos := v_pos + 1;
    insert into public.invoice_lines (invoice_id, position, description, quantity, unit_amount)
    values (v_id, v_pos, btrim(v_line ->> 'description'), (v_line ->> 'quantity')::int, (v_line ->> 'unit_amount')::bigint);
  end loop;
  return v_id;
end;
$$;
revoke execute on function public.create_invoice(uuid, uuid, uuid, text, uuid, date, text, jsonb) from public, anon;
grant execute on function public.create_invoice(uuid, uuid, uuid, text, uuid, date, text, jsonb) to authenticated;

-- Ghi nhận tiền đã nhận (đối soát chuyển khoản VietQR bằng tay). Trả trạng thái mới.
create function public.record_payment(
  p_invoice uuid, p_amount bigint, p_method text default 'transfer', p_reference text default null
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare v_inv record; v_status text;
begin
  select * into v_inv from public.invoices where id = p_invoice for update;
  if not found or not private.has_role(v_inv.academy_id, '{owner}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_inv.status <> 'open' then
    raise exception 'invoice is not open' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid amount' using errcode = '22023';
  end if;
  insert into public.payments (invoice_id, amount, method, reference, recorded_by)
  values (p_invoice, p_amount, coalesce(p_method, 'transfer'), coalesce(btrim(p_reference), ''), (select auth.uid()));
  update public.invoices
    set paid_amount = paid_amount + p_amount,
        status = case when paid_amount + p_amount >= total then 'paid' else 'open' end,
        paid_at = case when paid_amount + p_amount >= total then now() end
    where id = p_invoice
    returning status into v_status;
  return v_status;
end;
$$;
revoke execute on function public.record_payment(uuid, bigint, text, text) from public, anon;
grant execute on function public.record_payment(uuid, bigint, text, text) to authenticated;

create function public.void_invoice(p_invoice uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_inv record;
begin
  select * into v_inv from public.invoices where id = p_invoice for update;
  if not found or not private.has_role(v_inv.academy_id, '{owner}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_inv.status <> 'open' then
    raise exception 'invoice is not open' using errcode = '22023';
  end if;
  update public.invoices set status = 'void', voided_at = now() where id = p_invoice;
end;
$$;
revoke execute on function public.void_invoice(uuid) from public, anon;
grant execute on function public.void_invoice(uuid) to authenticated;

-- ───────────────────────── Link thanh toán công khai ─────────────────────────

-- Chỉ trả những gì in trên hoá đơn + thông tin chuyển khoản của học viện
create function public.public_invoice(p_token text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'number', i.number,
    'academy_name', a.name,
    'tax_id', b.tax_id,
    'student_name', coalesce(nullif(p.display_name, ''), p.username::text, ''),
    'currency', i.currency,
    'subtotal', i.subtotal,
    'discount_amount', i.discount_amount,
    'total', i.total,
    'paid_amount', i.paid_amount,
    'status', i.status,
    'due_on', i.due_on,
    'issued_at', i.issued_at,
    'paid_at', i.paid_at,
    'note', i.note,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object('description', l.description, 'quantity', l.quantity, 'unit_amount', l.unit_amount) order by l.position)
      from public.invoice_lines l where l.invoice_id = i.id
    ), '[]'::jsonb),
    'bank_bin', b.bank_bin,
    'bank_account', b.bank_account,
    'bank_holder', b.bank_holder
  )
  from public.invoices i
  join public.academies a on a.id = i.academy_id
  join public.profiles p on p.id = i.student_id
  left join public.academy_billing b on b.academy_id = i.academy_id
  where i.pay_token = p_token and p_token ~ '^[0-9a-f]{32}$'
$$;
revoke execute on function public.public_invoice(text) from public;
grant execute on function public.public_invoice(text) to anon, authenticated;

-- Lượt dùng giảm giá (hoá đơn chưa huỷ); security_invoker nên chỉ owner thấy số liệu
create view public.discount_stats with (security_invoker = true) as
  select d.id as discount_id, d.academy_id, count(i.id)::int as uses
  from public.discounts d
  left join public.invoices i on i.discount_id = d.id and i.status <> 'void'
  group by d.id;

-- ───────────────────────── RLS ─────────────────────────

alter table public.academy_billing enable row level security;
alter table public.plans enable row level security;
alter table public.plan_prices enable row level security;
alter table public.discounts enable row level security;
alter table public.discount_plans enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.payments enable row level security;

create policy "academy_billing: owner"
  on public.academy_billing for all to authenticated
  using (private.has_role(academy_id, '{owner}'))
  with check (private.has_role(academy_id, '{owner}'));

create policy "plans: owner"
  on public.plans for all to authenticated
  using (private.has_role(academy_id, '{owner}'))
  with check (private.has_role(academy_id, '{owner}'));

create policy "plan_prices: owner"
  on public.plan_prices for all to authenticated
  using (private.has_role(private.plan_academy(plan_id), '{owner}'))
  with check (private.has_role(private.plan_academy(plan_id), '{owner}'));

create policy "discounts: owner"
  on public.discounts for all to authenticated
  using (private.has_role(academy_id, '{owner}'))
  with check (private.has_role(academy_id, '{owner}'));

create policy "discount_plans: owner, cùng học viện"
  on public.discount_plans for all to authenticated
  using (private.has_role(private.discount_academy(discount_id), '{owner}'))
  with check (
    private.has_role(private.discount_academy(discount_id), '{owner}')
    and private.plan_academy(plan_id) = private.discount_academy(discount_id)
  );

create policy "invoices: owner, học viên, phụ huynh đọc"
  on public.invoices for select to authenticated
  using (
    private.has_role(academy_id, '{owner}')
    or student_id = (select auth.uid())
    or private.is_parent_of(student_id)
  );
-- Không có policy ghi: chỉ qua create_invoice / record_payment / void_invoice

create policy "invoice_lines: ai đọc được hoá đơn"
  on public.invoice_lines for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id));

create policy "payments: ai đọc được hoá đơn"
  on public.payments for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id));
