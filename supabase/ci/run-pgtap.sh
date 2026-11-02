#!/usr/bin/env bash
# Áp toàn bộ supabase/migrations lên một Postgres kiểu Supabase rồi chạy supabase/tests/*.sql (pgTAP).
# Dùng trong CI (job "pgTAP") và cục bộ; xem supabase/tests/README.md.
#
#   PGHOST=localhost PGPORT=54322 PGPASSWORD=postgres bash supabase/ci/run-pgtap.sh [tùy chọn] [tệp test…]
#
# Biến môi trường: PGHOST, PGPORT, PGPASSWORD (mật khẩu dùng chung của image supabase/postgres), PGDATABASE (mặc định
# postgres), ADMIN_USER (mặc định supabase_admin, superuser, chỉ để dựng bootstrap), APP_USER (mặc định postgres,
# giống người áp migration trên Supabase thật).
# Tùy chọn: --skip-setup  bỏ bootstrap + áp migration (DB đã dựng sẵn, chỉ chạy test)
#
# Mỗi tệp test tự `begin … rollback` nên không để lại dữ liệu. Tệp nào thất bại nếu: có dòng `not ok`, có lỗi SQL
# (ERROR), pgTAP báo `# Looks like`, thiếu dòng kế hoạch `1..N`, hoặc psql thoát khác 0. Thoát mã 1 nếu có tệp hỏng.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PGDATABASE="${PGDATABASE:-postgres}"
ADMIN_USER="${ADMIN_USER:-supabase_admin}"
APP_USER="${APP_USER:-postgres}"
SKIP_SETUP=0
FILES=()
for a in "$@"; do
  case "$a" in
    --skip-setup) SKIP_SETUP=1 ;;
    *) FILES+=("$a") ;;
  esac
done
if [ "${#FILES[@]}" -eq 0 ]; then
  while IFS= read -r f; do FILES+=("$f"); done < <(ls "$ROOT"/supabase/tests/*.sql | sort)
fi

psql_as() { local u="$1"; shift; psql -X -q -v ON_ERROR_STOP=1 -U "$u" "$@"; }

if [ "$SKIP_SETUP" -eq 0 ]; then
  echo "── Chờ DB sẵn sàng ──"
  for i in $(seq 1 60); do
    if psql_as "$ADMIN_USER" -t -A -c "select 1 from pg_roles where rolname = 'supabase_auth_admin'" 2>/dev/null | grep -q 1; then break; fi
    sleep 2
    [ "$i" -eq 60 ] && { echo "DB chưa sẵn sàng sau 120 giây"; exit 1; }
  done
  echo "── Bootstrap (${ADMIN_USER}) ──"
  psql_as "$ADMIN_USER" -f "$ROOT/supabase/ci/bootstrap.sql" || { echo "Bootstrap lỗi"; exit 1; }
  echo "── Áp migration (${APP_USER}) ──"
  n=0
  for f in $(ls "$ROOT"/supabase/migrations/*.sql | sort); do
    if ! mig_out="$(psql_as "$APP_USER" -f "$f" 2>&1)"; then
      echo "MIGRATION LỖI: $(basename "$f")"
      printf '%s\n' "$mig_out" | tail -8
      exit 1
    fi
    n=$((n + 1))
  done
  echo "Đã áp $n migration."
fi

echo "── pgTAP (${#FILES[@]} tệp) ──"
failed=0
total_ok=0
for f in "${FILES[@]}"; do
  # Cài pgtap trong giao dịch ngoài (tệp tự begin/rollback nên không để lại gì); một số tệp không tự cài
  out="$( { echo "begin; create extension if not exists pgtap with schema extensions;"; cat "$f"; } | psql -X -q -t -A -U "$APP_USER" 2>&1; echo "PSQL_EXIT=${PIPESTATUS[1]:-$?}" )"
  rc="$(printf '%s\n' "$out" | sed -n 's/^PSQL_EXIT=//p' | tail -1)"
  ok="$(printf '%s\n' "$out" | grep -c '^ok ')"
  bad="$(printf '%s\n' "$out" | grep -c '^not ok ')"
  err="$(printf '%s\n' "$out" | grep -c '^ERROR')"
  plan="$(printf '%s\n' "$out" | grep -m1 '^1\.\.')"
  looks="$(printf '%s\n' "$out" | grep -c '^# Looks like')"
  total_ok=$((total_ok + ok))
  name="$(basename "$f")"
  if [ "$bad" -ne 0 ] || [ "$err" -ne 0 ] || [ "$looks" -ne 0 ] || [ -z "$plan" ] || [ "${rc:-0}" != "0" ]; then
    failed=$((failed + 1))
    echo "✗ $name  ok=$ok not_ok=$bad error=$err plan=${plan:-?} psql_exit=${rc:-?}"
    printf '%s\n' "$out" | grep -E '^not ok|^ERROR|^# |have:|want:|DETAIL|HINT' | head -12 | sed 's/^/    /'
  else
    echo "✓ $name  $ok/${plan#1..}"
  fi
done
echo "── Tổng: $total_ok kiểm tra đạt, $failed tệp hỏng ──"
[ "$failed" -eq 0 ]
