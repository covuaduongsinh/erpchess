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
- **Khi chưa tải xong:** engine vẫn chạy bằng đánh giá cổ điển. Cần xác minh Arasan v26 còn hỗ trợ chế độ không NNUE (xem bước 1).

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
