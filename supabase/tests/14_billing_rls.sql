-- Kiểm thử Giai đoạn 12a: học phí chỉ owner quản lý, hoá đơn tính tiền phía server, giảm giá
-- theo lượt, thanh toán đủ thì "paid", học viên/phụ huynh chỉ đọc hoá đơn của mình/con, anon chỉ
-- đọc qua pay_token.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner.a@test.local', '{"display_name":"Owner A"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'coach.a@test.local', '{"display_name":"Coach A"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hv1@students.erpchess.local', '{"display_name":"HV 1","username":"hv1"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'hv2@students.erpchess.local', '{"display_name":"HV 2","username":"hv2"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'parent.a@test.local', '{"display_name":"PH 1"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner.b@test.local', '{"display_name":"Owner B"}');
insert into academies (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Học viện A', 'hv-a'),
  ('10000000-0000-0000-0000-00000000000b', 'Học viện B', 'hv-b');
insert into memberships (academy_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'coach'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', 'parent'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');
insert into parent_links (academy_id, parent_id, student_id) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a3');

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;
create function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end;
$$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ── Owner soạn cài đặt, gói, giảm giá ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
insert into academy_billing (academy_id, currency, invoice_prefix, bank_bin, bank_account, bank_holder)
  values ('10000000-0000-0000-0000-00000000000a', 'VND', 'HD', '970436', '0123456789', 'CLB A');
insert into plans (id, academy_id, name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Lớp nhóm 8 buổi');
insert into plan_prices (plan_id, currency, amount) values
  ('20000000-0000-0000-0000-000000000001', 'VND', 1200000),
  ('20000000-0000-0000-0000-000000000001', 'USD', 5000);
insert into discounts (id, academy_id, name, kind, value, max_uses) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Anh em', 'percent', 10, 1);
select is((select count(*)::int from plan_prices), 2, 'owner tạo gói nhiều tiền tệ');

-- ── Coach không thấy học phí ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from plans), 0, 'coach không đọc được gói');
select throws_ok($$
  select create_invoice('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3',
                        '20000000-0000-0000-0000-000000000001')
$$, '42501', null, 'coach không tạo được hoá đơn');

-- ── Owner B không đụng được học viện A ──
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$
  insert into plans (academy_id, name) values ('10000000-0000-0000-0000-00000000000a', 'Gói lạ')
$$, '42501', null, 'owner học viện khác không tạo gói');

-- ── Tạo hoá đơn có giảm giá ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
create temp table inv1 as
  select create_invoice('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3',
                        '20000000-0000-0000-0000-000000000001', null, '30000000-0000-0000-0000-000000000001',
                        '2026-12-01', null, '[{"description":"Sách","quantity":2,"unit_amount":50000}]') as id;
grant select on inv1 to anon, authenticated;
select is(
  (select subtotal || '|' || discount_amount || '|' || total || '|' || status || '|' || currency
   from invoices where id = (select id from inv1)),
  '1300000|130000|1170000|open|VND', 'tạm tính gói + dòng thêm, giảm 10%, tiền tệ mặc định');
select matches((select number from invoices where id = (select id from inv1)), '^HD-\d{4}-0001$', 'số hoá đơn đầu tiên');
select is((select count(*)::int from invoice_lines where invoice_id = (select id from inv1)), 2, 'hai dòng hàng');
select throws_ok($$
  select create_invoice('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4',
                        '20000000-0000-0000-0000-000000000001', null, '30000000-0000-0000-0000-000000000001')
$$, '22023', 'discount not usable', 'giảm giá hết lượt');
create temp table inv2 as
  select create_invoice('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4',
                        '20000000-0000-0000-0000-000000000001', 'USD') as id;
grant select on inv2 to anon, authenticated;
select is(
  (select number || '|' || total from invoices where id = (select id from inv2)),
  (select replace(number, '0001', '0002') from invoices where id = (select id from inv1)) || '|5000',
  'số tăng dần, giá theo tiền tệ đã chọn');
select throws_ok($$
  select create_invoice('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3',
                        '20000000-0000-0000-0000-000000000001', 'EUR')
$$, '22023', null, 'gói không có giá EUR');

-- ── Học viên / phụ huynh chỉ đọc hoá đơn của mình ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select is((select count(*)::int from invoices), 1, 'học viên chỉ thấy hoá đơn của mình');
select throws_ok($$
  select record_payment((select id from inv2), 5000)
$$, '42501', null, 'học viên không tự ghi thanh toán');
with u as (update invoices set status = 'paid' where id = (select id from inv2) returning id)
select is((select count(*)::int from u), 0, 'không sửa thẳng hoá đơn');
select pg_temp.login('00000000-0000-0000-0000-0000000000a5');
select is((select array_agg(student_id::text)::text from invoices), '{00000000-0000-0000-0000-0000000000a3}',
  'phụ huynh thấy hoá đơn của con');
select is((select count(*)::int from invoice_lines), 2, 'phụ huynh thấy dòng hàng của con');

-- ── Thanh toán ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is(record_payment((select id from inv1), 1000000, 'transfer', 'VCB 123'), 'open', 'trả một phần vẫn open');
select is(record_payment((select id from inv1), 170000, 'cash'), 'paid', 'trả đủ thì paid');
select throws_ok($$ select void_invoice((select id from inv1)) $$, '22023', null, 'không huỷ hoá đơn đã thanh toán');

-- ── Link công khai ──
select pg_temp.anon();
select is(
  (select public_invoice((select pay_token from invoices where id = (select id from inv1))) ->> 'paid_amount'),
  null, 'anon không đọc được bảng nên không lấy được token');
select pg_temp.logout();
create temp table tok as select pay_token from invoices where id = (select id from inv1);
grant select on tok to anon, authenticated;
select pg_temp.anon();
select is(
  (select j ->> 'status' || '|' || (j ->> 'total') || '|' || (j ->> 'bank_account') || '|' || jsonb_array_length(j -> 'lines')
   from (select public_invoice((select pay_token from tok)) as j) s),
  'paid|1170000|0123456789|2', 'anon xem hoá đơn qua token');

select * from finish();
rollback;
