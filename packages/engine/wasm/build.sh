#!/usr/bin/env bash
# Build Arasan sang WebAssembly bằng Emscripten (chạy trong Linux/WSL/CI đã source emsdk_env.sh).
#   bash packages/engine/wasm/build.sh [sse2|sse41]
# Ra: packages/engine/wasm/dist/arasan-<biến thể>.{mjs,wasm}
#
# - Dùng nguyên mã vendor/arasan/src, chỉ thay input.cpp bằng input_queue.cpp (hàng đợi lệnh).
# - pthreads + PROXY_TO_PTHREAD: engine chạy trên luồng riêng, được phép chặn khi chờ lệnh;
#   trang web phải bật cross-origin isolation (COOP/COEP) để có SharedArrayBuffer.
set -euo pipefail

variant="${1:-sse41}"
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
src="$root/vendor/arasan/src"
out="$here/dist"
obj="$here/.obj/$variant"
mkdir -p "$out" "$obj"

network="$(cd "$root/vendor/arasan/network" && ls *.nnue | head -1)"
version="$(sed -n 's/.*ARASAN_VERSION=\([0-9.]*\).*/\1/p' "$src/CMakeLists.txt" | head -1)"

# Khớp cờ của CMakeLists.txt/Makefile upstream. Thiếu USE_INTRINSICS thì firstOne tra bảng chưa khởi tạo
# lúc dựng object static NnzGroupScatter (trước main) → NNUE tính sai.
defs=(-D_64BIT -DUSE_INTRINSICS -DSMP_STATS -DSYZYGY_TBS "-DNETWORK=$network" "-DARASAN_VERSION=$version")
# Mạng NNUE v8 bắt buộc SIMD (SparseLinear có static_assert), không có biến thể vô hướng.
# Emscripten dịch intrinsic SSE sang WASM SIMD128.
case "$variant" in
  sse2) simd=(-msimd128 -msse2 -DSIMD -DSSE2) ;;
  sse41) simd=(-msimd128 -msse2 -mssse3 -msse4.1 -DSIMD -DSSE2 -DSSSE3 -DSSE41 -DUSE_POPCNT) ;;
  *) echo "Biến thể không hợp lệ: $variant" >&2; exit 2 ;;
esac

common=(${EXTRA_FLAGS:-} -std=c++17 -O3 -fno-strict-aliasing -pthread -I"$src" -I"$src/nnue" -I"$src/syzygy/src" "${defs[@]}" "${simd[@]}")

sources=(arasanx attacks bench bhash bitutil bitprobe board boardio bookread bookwrit
  calctime chess chessio eco epdrec globals hash learn legal material movearr movegen
  notation options protocol scoring searchc search see stats syzygy tester threadc threadp
  evaluate)

objects=()
pids=()
compile() { # $1 = file nguồn, $2 = file object
  em++ "${common[@]}" -c "$1" -o "$2"
}
for name in "${sources[@]}"; do
  objects+=("$obj/$name.o")
  compile "$src/$name.cpp" "$obj/$name.o" &
  pids+=($!)
  # Giới hạn số tiến trình song song để không cạn RAM
  while (( $(jobs -rp | wc -l) >= ${JOBS:-3} )); do sleep 0.2; done
done
em++ "${common[@]}" -x c++ -c "$src/syzygy/src/tbprobe.c" -o "$obj/tbprobe.o" &
pids+=($!)
objects+=("$obj/tbprobe.o")
compile "$here/input_queue.cpp" "$obj/input_queue.o" &
pids+=($!)
objects+=("$obj/input_queue.o")
# Kiểm mã thoát từng job: một file lỗi là dừng
failed=0
for pid in "${pids[@]}"; do wait "$pid" || failed=1; done
if (( failed )); then echo "Biên dịch lỗi" >&2; exit 1; fi

em++ "${common[@]}" "${objects[@]}" -o "$out/arasan-$variant.mjs" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createArasan \
  -sENVIRONMENT=web,worker,node \
  -sPROXY_TO_PTHREAD=1 -sEXIT_RUNTIME=1 \
  -sPTHREAD_POOL_SIZE=4 -sPTHREAD_POOL_SIZE_STRICT=0 \
  -sDEFAULT_PTHREAD_STACK_SIZE=4MB -sSTACK_SIZE=4MB \
  -sINITIAL_MEMORY=256MB -sALLOW_MEMORY_GROWTH=1 -sMAXIMUM_MEMORY=2GB \
  -sFORCE_FILESYSTEM=1 \
  -sEXPORTED_FUNCTIONS=_main,_erp_send \
  -sEXPORTED_RUNTIME_METHODS=FS,ccall,callMain \
  -sINVOKE_RUN=0

ls -l "$out/arasan-$variant".*
