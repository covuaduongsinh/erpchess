# Engine cờ: Arasan thay cho Stockfish

Kế hoạch tổng: [00-ke-hoach-tong.md](00-ke-hoach-tong.md). Đây là một phần của Giai đoạn 3 (lõi cờ, bàn cờ, engine).

## Quyết định (2026-10-23)

Người dùng chốt dùng **[Arasan](https://github.com/jdart1/arasan-chess)** của Jon Dart làm engine cho cả 3 nền tảng, thay cho Stockfish.

**Lý do:**
- **Giấy phép MIT:** đã đọc `LICENSE` trong repo. Thư mục `src`, `book`, `network`, `tests` đều theo MIT. Submodule Fathom (syzygy) cũng MIT. Nhúng vào app phân phối chỉ cần giữ thông báo bản quyền, không vướng GPL như Stockfish.
- **Đủ tính năng cho đào tạo:**
  - UCI và CECP.
  - MultiPV.
  - Đa luồng (`Threads`).
  - `UCI_LimitStrength` + `UCI_Elo` (1000–3450), dùng để làm bot nhiều trình độ cho học viên.
  - NNUE.
  - Tablebase syzygy.
- **Vẫn được bảo trì:** bản mới nhất v26.1 phát hành ngày 2026-10-12; commit gần nhất 2026-10-18. Mã C++17 có sẵn `CMakeLists.txt`.

## Hiện trạng cần giải quyết

| Vấn đề                      | Chi tiết                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Chưa có bản WASM            | Không tìm thấy bản Emscripten nào, phải tự biên dịch                                                                          |
| Chưa có bản mobile          | Release chỉ có Windows, macOS, Linux, ARM NEON (CLI)                                                                          |
| Đọc lệnh từ stdin           | Engine chạy vòng lặp đọc stdin; trong WASM và module mobile phải thay bằng hàng đợi lệnh                                      |
| Đa luồng dùng `std::thread` | WASM cần `-pthread` + `SharedArrayBuffer`, nghĩa là trang web phải bật header COOP/COEP (cross-origin isolation)              |
| SIMD x86                    | Có option `OLD` (không SIMD) để build an toàn; thử thêm `-msimd128` (Emscripten ánh xạ SSE sang WASM SIMD)                    |
| File NNUE khoảng 25 MB      | `network/arasanv8-20261005.nnue`, nạp lúc chạy qua option `NNUE File`; nặng cho web/mobile nên phải tải theo yêu cầu và cache |

## Thiết kế

```
vendor/arasan/                 git submodule, ghim tag v26.1 (không sửa trực tiếp)
packages/engine/
├─ src/adapter.ts              interface EngineAdapter + parser UCI (info/bestmove/multipv) — thuần TS, có test
├─ src/protocol.ts             hàng đợi lệnh, timeout, hủy tìm kiếm (stop), chuẩn hoá điểm (cp/mate, góc nhìn bên đi)
├─ src/web/                    adapter Web Worker gọi bản WASM
└─ wasm/                       CMake + shim C++ (`erp_shim.cpp`): hàm export `erp_send(const char*)`,
                               callback gửi stdout về JS; script build bằng emsdk (Docker hoặc CI)
apps/desktop/src-tauri/        sidecar `arasan-<target-triple>` + file .nnue trong resources; lệnh Rust
                               spawn/đọc stdout, phát event sang webview
modules/arasan-native/         Expo Module (C++ qua JSI): Android NDK (arm64-v8a, NEON), iOS (arm64)
```

**`EngineAdapter`**, dùng chung cho cả 3 nền tảng:

```ts
interface EngineAdapter {
  init(opts: { threads?: number; hashMb?: number; nnue?: 'full' | 'none' }): Promise<void>;
  analyse(
    fen: string,
    opts: { depth?: number; movetimeMs?: number; multiPv?: number },
    onInfo: (info: EngineInfo) => void,
  ): Promise<BestMove>;
  play(fen: string, opts: { elo?: number; movetimeMs?: number }): Promise<BestMove>; // bot
  stop(): void;
  dispose(): void;
}
```

**File NNUE:**
- **Web:** tải từ Supabase Storage (hoặc CDN) lần đầu, cache bằng Cache API/OPFS, `FS.writeFile` vào FS ảo của Emscripten rồi `setoption name NNUE File`.
- **Desktop:** đóng gói sẵn trong installer.
- **Mobile:** tải lần đầu vào thư mục app.
- **Khi chưa tải xong:** engine **không chạy được**. Bước 1 xác nhận Arasan v26 không còn đánh giá cổ điển; nạp NNUE lỗi thì engine thoát. Vì vậy UI phải hiện tiến độ tải, và tính năng không cần engine (bàn cờ, PGN, puzzle) vẫn dùng được trong lúc chờ. File nén brotli còn khoảng 11 MB (gzip 13,6 MB) và trình duyệt tự giải nén qua `Content-Encoding: br`.

**Đa luồng trên web:**
- Bản mặc định là 1 luồng, chạy được ở mọi nơi.
- Bản đa luồng chỉ bật khi `crossOriginIsolated === true`. Để bật, thêm header `Cross-Origin-Opener-Policy: same-origin` và `Cross-Origin-Embedder-Policy: require-corp` cho `apps/web` trên Vercel và Tauri. Phải kiểm xem các header này có làm hỏng Supabase, LiveKit, Google Fonts không.

## Các bước

1. **Khảo sát mã nguồn**, chỉ đọc. Xem `src/protocol.cpp` và `src/input.cpp` (vòng lặp stdin), `src/options.cpp` (NNUE, chế độ không NNUE), `src/threadp.cpp`, `src/CMakeLists.txt`. Kết quả: chọn chỗ chèn shim nhận lệnh, kèm danh sách patch tối thiểu (nếu cần thì giữ dạng file `.patch` trong `packages/engine/wasm/patches/`, không fork).
2. **Thêm submodule** `vendor/arasan` ghim v26.1. Script `pnpm engine:build:native` build CLI bằng CMake cho máy hiện tại. Chạy thử `uci`, `isready`, `go depth 12` và benchmark.
3. **Viết `packages/engine` phần TS:** parser UCI, hàng đợi, chuẩn hoá điểm. Unit test bằng log UCI thật thu được ở bước 2.
4. **Build WASM:**
   - Dùng emsdk qua Docker (CI Linux), vì Windows thiếu RAM khi biên dịch.
   - Hai biến thể: `arasan-st.wasm` (1 luồng, `OLD`) và `arasan-mt-simd.wasm` (pthreads + `-msimd128`).
   - Đo kích thước, thời gian khởi động và số node/giây trên Chrome.
5. **Adapter web (Web Worker):** nạp WASM, đưa NNUE vào FS ảo. Có Playwright test chạy `analyse` trên vài thế cờ chuẩn (mate-in-2, thế đầu ván).
6. **Desktop:** build sidecar cho `x86_64-pc-windows-msvc` (bản AVX2 và bản dự phòng `OLD`), macOS (universal), Linux. Cấu hình Tauri `externalBin` + `resources` cho file NNUE. Thêm lệnh Rust `engine_start` / `engine_send` / event `engine-line`.
7. **Mobile:** Expo Module C++ (Android trước, iOS sau). Cần development build, không chạy được trên Expo Go. Thử trên emulator/thiết bị bằng adb (có thể dùng công cụ ADB của REA để xem logcat).
8. **Bot nhiều trình độ:** đặt sẵn các mức `UCI_Elo` 1000 / 1400 / 1800 / 2200 / tối đa, ánh xạ với cấp độ học viên. Chơi thử để kiểm cảm giác từng mức.
9. **Ghi công:** thêm màn "Giới thiệu / Giấy phép" trong app, liệt kê Arasan (MIT, © Jon Dart) và Fathom (MIT).

## Kiểm chứng

- **Unit:** parser UCI chạy trên log thật; chuẩn hoá điểm đúng cả hai phía trắng và đen.
- **Tìm nước đúng:** cả 3 nền tảng tìm ra nước thắng ở các bài mate-in-N chuẩn trong giới hạn thời gian.
- **Hiệu năng:** so node/giây giữa bản WASM 1 luồng, WASM đa luồng và native. Ghi kết quả vào file này.
- **Giới hạn sức mạnh:** với `UCI_Elo` thấp, engine phải đi nước kém hơn rõ rệt. Kiểm bằng vài ván tự đấu.

## Rủi ro

- **Vòng lặp stdin:** nếu protocol của Arasan gắn chặt với stdin thì phải patch nhiều hơn dự kiến. Phương án dự phòng: Emscripten `-sPROXY_TO_PTHREAD` kèm stdin đọc chặn từ hàng đợi SharedArrayBuffer, nhưng cách này bắt buộc cross-origin isolation.
- **Tốc độ trên web:** WASM không SIMD sẽ chậm hơn native nhiều lần. Với mục tiêu đào tạo (bot giới hạn Elo, phân tích nhanh) có thể vẫn đủ; cần đo ở bước 4.
- **Kích thước tải về:** file NNUE 25 MB nặng cho mạng di động. Cần tải nền, có thanh tiến độ và cache.
- **Phân tích phía server:** nếu thiết bị yếu có thể bổ sung sau. Vì Arasan là MIT nên chạy trên server cũng không vướng ràng buộc giấy phép.

## Kết quả bước 1–3 (2026-10-23)

### Bước 1 — Khảo sát mã nguồn (Arasan v26.1)

- **Nhận lệnh:**
  - `Protocol::poll` (`protocol.cpp`) chặn ở `Input::readInput` giữa các lệnh.
  - Trong lúc tìm kiếm, `Protocol::monitor` gọi `Input::checkInput` (không chặn) để bắt `stop`. Tìm kiếm chạy ngay trên luồng gọi.
  - Mọi I/O đầu vào đều nằm trong `input.cpp` (140 dòng), nên điểm chèn duy nhất cần thiết là **một bản `input.cpp` thay thế cho Emscripten/mobile** đọc từ hàng đợi lệnh. Không phải sửa `protocol.cpp`.
- **Đầu ra:** toàn bộ in qua `std::cout`, tắt buffer trong `main`. Emscripten chuyển tiếp từng dòng qua `Module.print`; module mobile chuyển hướng `std::cout`.
- **NNUE bắt buộc:**
  - `globals::initGlobals` gọi `loadNetwork`; nạp lỗi thì in "failed to load network, terminating" rồi thoát.
  - Đường dẫn tương đối tính theo thư mục file chạy (`derivePath`); có thể đặt tuyệt đối bằng `setoption name NNUE file`.
- **Hệ quả cho bản WASM:**
  - Engine cần một luồng được phép **chặn** khi chờ lệnh và nhận `stop` trong lúc tìm kiếm.
  - Hướng chính: build `-pthread -sPROXY_TO_PTHREAD`. `main` chạy trên pthread; lệnh từ JS đẩy vào hàng đợi C++ dùng `std::mutex` + `std::condition_variable`. Hướng này cần `crossOriginIsolated`, đổi lại có luôn đa luồng.
  - Bản 1 luồng không cần cross-origin isolation thì phải dùng Asyncify ở `checkInput`, và sẽ chậm. Để sau, khi đã đo được hiệu năng ở bước 4.
- **MinGW không dựng được:** `globals.cpp` include `sys/resource.h` và dùng `std::aligned_alloc`. Trên Windows dùng MSVC (Build Tools 2022).

### Bước 2 — Submodule và bản native

- **Submodule:** `vendor/arasan` ghim tag `v26.1` (kèm `src/syzygy`).
- **Build:** `pnpm --filter @erpchess/engine build:native [modern|avx2|avx2-bmi2|old|neon]`, ra file ở `vendor/build/arasan-<biến thể>/` (đã gitignore).
- **Máy dev:** Pentium Gold G6405, **không có AVX2**, nên dùng biến thể `modern` (SSE4.2 + POPCNT). Bản desktop phải tự chọn biến thể theo CPU (`modern` làm dự phòng), vì máy ở trung tâm/trường học thường cũng thuộc loại này.
- **Bench:** 1 luồng đạt khoảng **95.000 nps** (2.468.819 node / 25,9 s).
- **Probe UCI:** `scripts/uci-probe.mjs` ghi 5 phiên thành fixture trong `packages/engine/test/fixtures/`; đường dẫn máy đã thay bằng `<DIR>` qua `scripts/scrub-fixtures.mjs`.
  - `uci`: có 20 option, gồm `MultiPV` 1–10, `Threads`, `UCI_LimitStrength`, `UCI_Elo` 1000–3450, `NNUE file`.
  - Mate-in-1 `6k1/5ppp/8/8/8/8/5PPP/3R2K1 w`: ra `bestmove d1d8`, `score mate 1`.
  - Điểm in **theo bên đang đi** (thế đen đi: `cp 50` nghĩa là đen hơn).
  - Mặc định `OwnBook=true` và ghi file học vào AppData; app tắt cả hai khi `init`.

### Bước 3 — `packages/engine` (TypeScript)

- **`src/uci.ts`:** `parseInfo` (MultiPV, cp/mate, lower/upperbound, nodes/nps/time/hashfull, pv), `parseBestMove`, `parseOption` (tên có dấu cách, combo/var), `toWhitePov`, `formatScore`.
- **`src/engine.ts`:** `UciEngine` chạy trên `UciTransport` trừu tượng.
  - `init`: tắt OwnBook và Position learning; đặt NNUE, Threads, Hash.
  - `analyse(fen, limits, onInfo)` với MultiPV; `play(fen, { elo })` có kẹp Elo theo min/max của option.
  - `stop`, `dispose`, và timeout cho mọi bước chờ.
- **`src/node.ts`:** `spawnTransport` cho Node (server, test tích hợp).
- **Test:** 14/14 qua, chạy liên tiếp 3 lần đều ổn định.
  - 10 test parser và engine phát lại log thật.
  - 1 test kiểm engine im lặng thì báo lỗi.
  - Test tích hợp với file chạy thật (`ARASAN_BIN=…`): chiếu hết, `stop` dừng `go infinite`, bot Elo 1200. Không có `ARASAN_BIN` thì test này tự bỏ qua, nên CI chưa chạy nó.
  - Một lần chạy đầu, test tích hợp bị treo 30 giây khi chạy cùng lúc với `pnpm install`; không tái hiện được trong 3 lần sau. Cần theo dõi khi đưa lên CI.

### Việc kế tiếp

- **Bước 4 (build WASM):** cần emsdk. Docker Desktop đã cài nhưng chưa chạy; WSL Ubuntu có sẵn. Dự kiến build trong WSL hoặc CI Linux để đỡ RAM máy Windows.

## Kết quả bước 4 — Build WebAssembly (2026-10-23)

### Môi trường và cách build

- **Toolchain:** emsdk (Emscripten 6.0.13) cài trong WSL Ubuntu 24.04 (`~/emsdk`).
- **Lệnh build:** `bash packages/engine/wasm/build.sh <sse41|sse2>`. Script gọi thẳng `em++`, không cần CMake; ra `packages/engine/wasm/dist/arasan-<biến thể>.{mjs,wasm}` (đã gitignore).
- **Thay `input.cpp`:** `packages/engine/wasm/input_queue.cpp` thay cho `input.cpp` gốc: hàng đợi lệnh dùng mutex + condition_variable, export `erp_send()`. Không sửa dòng nào trong `vendor/arasan`.
- **Cờ link:**
  - `-pthread -sPROXY_TO_PTHREAD`: `main` chạy trên pthread riêng, được phép chặn khi chờ lệnh.
  - Stack pthread 4 MB, bộ nhớ 256 MB và cho phép tăng tới 2 GB.
  - `MODULARIZE` + ES module, `ENVIRONMENT=web,worker,node`.
- **Kích thước:** `arasan-sse41.wasm` khoảng 750 KB, file JS khoảng 84 KB. File NNUE tải riêng.
- **Không có biến thể "không SIMD":** mạng NNUE v8 bắt buộc SIMD (`SparseLinear` có `static_assert`). Emscripten dịch intrinsic SSE2/SSSE3/SSE4.1 sang WASM SIMD128, nên trình duyệt phải hỗ trợ WASM SIMD (Chrome 91+, Firefox 89+, Safari 16.4+).

### Lỗi đã gặp và cách tìm ra (bài học)

- **Triệu chứng:** bản WASM đầu tiên vẫn chạy và trả nước đi. Perft đúng, nhưng **điểm NNUE sai ở 7/8 thế cờ** (có thế đổi cả dấu), số node bench khác native, và tốc độ "nhanh" bất thường.
- **Cách phát hiện:** bench chạy được không chứng minh gì về tính đúng. Lỗi chỉ lộ ra nhờ `compare.mjs`, script so điểm NNUE tĩnh với native.
- **Khoanh vùng:**
  1. Đối chiếu với bản GCC Linux độc lập: kết luận native đúng, WASM sai.
  2. Loại lần lượt các giả thuyết: biến thể SSE, `_64BIT`, endian.
  3. Build cả hai bên với `-DNNUE_TRACE` và diff output từng lớp: input lớp L1 khớp, output L1 lệch.
  4. Lần ngược ra `NnzGroupScatter`, một object static dựng **trước `main`** bằng `BitUtils::firstOne`.
- **Nguyên nhân gốc:** script build thiếu `-DUSE_INTRINSICS` (và `-DSMP_STATS`, `-fno-strict-aliasing`), là các cờ upstream luôn bật. Thiếu `USE_INTRINSICS`, `firstOne` tra `MagicTable64`; bảng này chỉ được điền trong `BitUtils::init()` ở đầu `main`, nên lúc dựng object static nó toàn số 0, kéo theo bảng scatter sai.
- **Cách sửa:** dùng đúng bộ cờ của `CMakeLists.txt`/`Makefile` upstream. **Từ nay mọi build engine phải sao đủ cờ upstream.**

### Kiểm chứng

- **`compare.mjs` (native MSVC so với WASM):** perft 5 = 4.865.609, và điểm NNUE của 8 thế cờ (khai cuộc, trung cuộc phức tạp, tàn cuộc, thế có phong cấp) khớp **17/17 dòng** ở cả `sse41` lẫn `sse2`.
- **Bench:** WASM duyệt **2.468.819 node, đúng bằng native**, nghĩa là tìm kiếm giống hệt từng bit. Tốc độ trong Node (V8):

  | Bản                  | nps    |
  | -------------------- | ------ |
  | native MSVC `modern` | 95.439 |
  | WASM `sse41`         | 83.468 |
  | WASM `sse2`          | 86.988 |

  Bản WASM đạt khoảng 90% tốc độ native. `sse41` không nhanh hơn `sse2` trên máy này, nên có thể chỉ cần phát hành một biến thể. Sẽ đo lại trên trình duyệt ở bước 5.
- **Thời gian nạp:** module cộng ghi NNUE vào FS ảo mất 170–320 ms trong Node.
- **`test/wasm.test.ts`** (chạy khi đã build dist) dùng `UciEngine` thông qua `src/wasm.ts` (`createWasmTransport`). Đã qua với cả `sse41` và `sse2`:
  - Tìm ra chiếu hết.
  - `stop` dừng `go infinite`, chứng minh lệnh đến được engine qua `checkInput` trong lúc tìm kiếm.
  - MultiPV 2 đúng.
  - Bot Elo 1200 chọn được nước.
- **CI:** job `engine` mới build native Linux và WASM, rồi chạy `compare.mjs` cùng test tích hợp. Nếu cờ build lệch nhau thì CI fail ngay.

### Việc kế tiếp (bước 5)

- **Web Worker:** adapter cho `apps/web` (Vite) nạp `arasan-*.mjs`.
- **Header COOP/COEP:** `apps/web` cần `Cross-Origin-Opener-Policy: same-origin` và `Cross-Origin-Embedder-Policy: require-corp` (hoặc `credentialless`) để có SharedArrayBuffer. Phải kiểm tương thích với Supabase, Google Fonts, LiveKit.
- **File NNUE:** tải file 25 MB (brotli khoảng 11 MB) từ Supabase Storage hoặc CDN, cache trong Cache API/OPFS, có thanh tiến độ.
- **Đo lại tốc độ:** nps trên Chrome thật và khi đa luồng (`Threads` 2–4).

## Kết quả bước 5 — Engine trong app web (2026-10-23)

### Đã làm

- **`@erpchess/engine/web`:**
  - `engineSupport()`: kiểm WASM SIMD, `crossOriginIsolated`, SharedArrayBuffer; chọn số luồng = số nhân − 1, tối đa 4.
  - `loadNetwork()`: tải NNUE có báo tiến độ, cache trong Cache Storage `erpchess-engine-v1`.
  - `createBrowserEngine()`: nạp module Emscripten rồi gọi `UciEngine.init` (đặt NNUE file, Threads, Hash 64 MB).
  - Bỏ Web Worker riêng: `main()` của engine đã chạy trên pthread, luồng UI không bị chặn.
- **`apps/web`:**
  - **COOP/COEP:** đặt `same-origin` / `require-corp` cho dev và preview (`vite.config.ts`) và production (`vercel.json`).
  - **Font:** tự host Roboto qua `@fontsource/roboto` (COEP chặn Google Fonts dạng no-cors).
  - **Tài nguyên engine:** script `engine:assets` chép `arasan-*.mjs/.wasm` cùng file NNUE vào `public/engine/` (gitignore).
  - **Hook `useEngine()`:** dùng chung một engine cho cả app.
  - **Trang `/engine` (phòng thử engine):** phân tích MultiPV 1–5, Dừng, bot theo các mức Elo.
- **`apps/desktop`:** `tauri.conf.json` thêm `app.security.headers` (COOP/COEP) cho bản build.
- **`apps/site`:** đổi sang `@fontsource/roboto`. `next/font/google` làm build CI hỏng vì phụ thuộc mạng.

### Kiểm chứng trên Chrome thật (bản `vite preview`, máy Pentium G6405 2 nhân / 4 luồng)

| Kiểm tra                          | Kết quả                                                                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Header                            | Server trả đúng COOP/COEP; `.wasm` phục vụ dạng `application/wasm`                                                                           |
| Tải NNUE lần đầu                  | Thanh tiến độ hiển thị (vite preview nén nên chỉ hiện số MB đã tải)                                                                          |
| Khởi động engine                  | "Arasan 26.1 · 3 luồng": `crossOriginIsolated`, SharedArrayBuffer và pthreads đều hoạt động                                                  |
| Phân tích thế khởi đầu, MultiPV 3 | Độ sâu 18 sau khoảng 6 giây với khoảng **402k nps**; độ sâu 20 với khoảng 424k nps. 3 phương án e2e4 / c2c4 / d2d4 với +0,50 / +0,46 / +0,42 |
| Nút Dừng                          | Dừng ngay, nút trở về "Phân tích"                                                                                                            |
| Bot Elo 1000                      | Chọn `d2d3`, một nước thụ động đúng trình độ thấp                                                                                            |
| Tải lại trang                     | Engine sẵn sàng ngay, NNUE lấy từ Cache Storage                                                                                              |
| Console                           | Không có lỗi                                                                                                                                 |
| Trang khác dưới COEP              | Đăng nhập Supabase và trang lớp học vẫn chạy bình thường                                                                                     |

Ghi chú về tốc độ: đa luồng trên trình duyệt đạt khoảng 400k nps, gấp khoảng 4,8 lần mức 1 luồng đo trong Node (83k). Trên máy có nhiều nhân hơn, tốc độ sẽ cao hơn.

### Chưa làm hoặc còn mở

- **Desktop:** engine chưa được thử trong app Tauri đã build; mới thêm header và kiểm bằng `cargo check`. WebView2 dùng nhân Chromium nên dự kiến hoạt động như Chrome.
- **Trình duyệt khác:** chưa thử Safari và Firefox.
- **Kích thước bundle:** Vite cảnh báo bundle chính lớn hơn 500 kB, cần tách chunk thêm (Supabase, i18n).
- **NNUE production:** chưa đưa file lên Supabase Storage hoặc CDN. Đặt `VITE_ENGINE_NETWORK_URL` khi deploy và bật nén brotli phía CDN.
- **Bước 6:** sidecar native cho desktop (nhanh hơn WASM). **Bước 7:** module mobile.
