# Kiểm thử cơ sở dữ liệu (pgTAP)

Mỗi tệp `supabase/tests/NN_*.sql` là một bộ test pgTAP độc lập: tự `begin … rollback` nên không để lại dữ liệu, dựng
dữ liệu mẫu riêng trong giao dịch rồi mô phỏng đăng nhập bằng `request.jwt.claims` + `set role`.

## Chạy trong CI

Job **pgTAP** của `.github/workflows/ci.yml` dựng Postgres từ image `supabase/postgres:17.6.1.136` (cùng phiên bản với
Supabase self-host), áp **toàn bộ** `supabase/migrations/*.sql` rồi chạy mọi tệp test; hỏng khi có migration lỗi hoặc có
test `not ok`/lỗi SQL/lệch kế hoạch. Nhờ vậy lỗi kiểu "hàm gọi bảng không tồn tại" (vd. `academy_levels`) bị bắt ở PR.

Image đơn lẻ chưa có phần do các dịch vụ khác tạo ở môi trường thật, nên `supabase/ci/bootstrap.sql` (chạy bằng
`supabase_admin`) dựng bản rút gọn cùng hình dạng: `pg_cron`, `realtime.messages` + `realtime.topic()`/`send()`,
`auth.users`, `storage.buckets`/`objects`/`foldername()` và bản `auth.uid()`/`role()`/`email()` đọc `request.jwt.claims`.
Khi migration hoặc test dùng thêm cột/hàm của các schema đó, bổ sung vào bootstrap.

## Chạy cục bộ (cần Docker và `psql`)

```bash
docker run -d --name pgtap -p 54322:5432 -e POSTGRES_PASSWORD=postgres supabase/postgres:17.6.1.136
# chờ ~1 phút cho image khởi tạo xong, rồi:
PGHOST=localhost PGPORT=54322 PGPASSWORD=postgres bash supabase/ci/run-pgtap.sh
# chỉ chạy lại vài tệp trên DB đã dựng: thêm --skip-setup và đường dẫn tệp
PGHOST=localhost PGPORT=54322 PGPASSWORD=postgres bash supabase/ci/run-pgtap.sh --skip-setup supabase/tests/24_masterbase.sql
docker rm -f pgtap
```

Biến: `PGHOST`, `PGPORT`, `PGPASSWORD`, `PGDATABASE` (mặc định `postgres`), `ADMIN_USER` (mặc định `supabase_admin`),
`APP_USER` (mặc định `postgres`, giống người áp migration trên Supabase thật).

## Chạy trên Supabase thật (cloud hoặc self-host)

Mỗi tệp tự rollback nên chạy được trên DB có dữ liệu thật, không để lại gì (kể cả extension `pgtap`, vì được cài trong
giao dịch). Với self-host có SSH, ví dụ cho từng tệp:

```bash
{ echo "begin; create extension if not exists pgtap with schema extensions;"; cat supabase/tests/35_puzzle_bank.sql; } \
  | ssh root@<máy> "docker exec -i <container-db> psql -U postgres -d postgres -X -q -t -A"
```

Hoặc `bash supabase/ci/run-pgtap.sh --skip-setup` với `PGHOST/PGPORT/PGPASSWORD` trỏ tới DB đó (không áp migration).

## Quy ước viết test (để chạy đúng trên DB trống lẫn DB có dữ liệu thật và trên mọi bản pgTAP)

- Không đếm/đọc **toàn cục** khi chạy bằng vai trò bỏ qua RLS (superuser, sau `logout()`): luôn lọc theo học viện/dữ
  liệu mà chính test tạo (vd. `where academy_id = '10000000-…-00000000000a'`), nếu không dữ liệu thật làm lệch kết quả.
- Không dùng `col_default_is` với đối số ép kiểu (`'''x''::text'`): bản pgTAP khác nhau so khớp khác nhau (cloud và
  self-host). Dùng `matches((select column_default from information_schema.columns where …), '^''x''(::[a-z ]+)?$', …)`.
- Regex trong test/migration không dùng `\d`, `\.`, `\m` trong chuỗi thường: máy chủ self-host đặt
  `standard_conforming_strings = off`. Dùng `[0-9]`, `[.]`, `[[:<:]]` hoặc chuỗi `$$…$$`.
- Tệp tự `create extension if not exists pgtap with schema extensions;` trong giao dịch của nó (runner cũng cài sẵn).
