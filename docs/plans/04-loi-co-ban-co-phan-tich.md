# Giai đoạn 3 (phần còn lại) — Lõi cờ, bàn cờ, bàn phân tích

Kế hoạch tổng: [00-ke-hoach-tong.md](00-ke-hoach-tong.md) · Engine: [03-engine-arasan.md](03-engine-arasan.md)

## Thứ tự ưu tiên (chốt 2026-10-23)

| #   | Hạng mục                                              | Lý do thứ tự                                                                                                  |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | `packages/chess-core`                                 | Mọi tính năng sau (bàn cờ, bài tập, puzzle, lớp trực tuyến, giải đấu) đều cần luật cờ, cây PGN và chấm puzzle |
| 2   | `packages/board-web` + Bàn phân tích (web và desktop) | Biến engine đã có thành tính năng dùng được ngay. Desktop dùng chung bản web; engine WASM chạy trong WebView2 |
| 3   | Kiểm engine trong app desktop đã build                | Đủ nhanh thì hoãn bước sidecar native (bước 6 kế hoạch engine)                                                |
| 4   | `packages/board-native` + bàn cờ mobile               | Sau khi API `BoardProps` đã ổn định trên web                                                                  |
| 5   | Engine mobile (bước 7 kế hoạch engine)                | Tốn công nhất (module native C++), làm sau                                                                    |
| 6   | Giai đoạn 4: bài tập, puzzle, báo cáo                 | Dùng `chess-core` (chấm puzzle) và bàn cờ                                                                     |

## 1. `packages/chess-core`

Dựa trên chess.js 1.4.0 (BSD-2) cho luật đi và FEN. Phần tự viết:
- **Cây ván cờ `GameTree`:** mỗi node gồm `id`, `san`, `uci`, `fen` sau nước đi, `ply`, `comment`, `nags` và `children`. Con đầu tiên là nhánh chính, các con sau là biến.
  - `addMove(nodeId, move)`: nếu nước đã có thì đi vào nhánh đó, chưa có thì tạo biến mới.
  - `mainline()`, `path(nodeId)`.
  - `promoteVariation`, `deleteFrom`.
- **PGN:**
  - `parsePgn(text)`: đọc tag, chú thích `{…}` và `;`, biến `( … )` lồng nhau, NAG `$n` và các ký hiệu `!`/`?`, số nước, kết quả ván. Nhận được nhiều ván trong một file.
  - `toPgn(tree)`: ghi ngược lại, đảm bảo parse → ghi → parse giữ nguyên cây.
- **FEN:** `validateFen`, `sideToMove`.
- **Puzzle:**
  - `Puzzle = { fen, moves: string[] }`. `moves` là chuỗi UCI xen kẽ: nước của người giải, rồi nước đáp của đối phương…
  - `gradeMove(puzzle, step, uci)` trả về `correct` / `wrong` / `solved`.
  - Nếu nước cuối của lời giải là chiếu hết thì **mọi nước chiếu hết khác cũng được tính đúng**, vì một thế có thể có nhiều cách chiếu hết.
- **Cờ mù / ẩn quân:** `maskFen(fen, mode)` cho các chế độ ẩn hết quân, ẩn quân một bên, chỉ hiện tốt. Dùng cho luyện tập và lớp học.
- **Test (TDD):** perft vài thế chuẩn; parse PGN có biến lồng nhau, chú thích và NAG; chạy vòng parse → ghi → parse; các trường hợp chấm puzzle.

## 2. `packages/board-web` + Bàn phân tích

- **Bàn cờ SVG, tự viết (MIT, không dùng chessground vì GPL).** Interface `BoardProps`:
  - Hiển thị: `fen`, `orientation`, `lastMove`, `check`.
  - Đi quân: `movable: { color, dests: Map<from, to[]> }`, `onMove(from, to, promotion?)`.
  - Vẽ: mũi tên, tô ô, tô ô có thể đi; `hiddenPieces` cho cờ mù.
  - Theme màu lấy từ `ui-tokens`.
- **Tương tác:** kéo-thả bằng pointer events (chuột và cảm ứng), hoặc bấm chọn ô rồi bấm ô đích. Có hộp chọn quân phong cấp. Chuột phải để vẽ mũi tên và tô ô.
- **Truy cập:** mỗi ô có nhãn (vd. "e4, Mã trắng"). Có nhập nước bằng bàn phím (gõ SAN).
- **Trang `/analysis`** (web và desktop):
  - Bàn cờ.
  - Danh sách nước đi dạng cây, có biến và chú thích.
  - Thanh đánh giá (eval bar), MultiPV từ `useEngine()`.
  - Nhập và xuất FEN/PGN.
  - Đi lùi/tới bằng phím ← → ↑ ↓.
- **Test:** Vitest cho logic bàn cờ (toạ độ ↔ ô, lật bàn, tính `dests` từ chess-core). Thử trên Chrome thật: đi quân, phong cấp, biến, engine phân tích theo thế đang xem.

## Ngoài phạm vi đợt này

- Bàn cờ mobile (mục 4), PGN Creator/Sharebox lưu lên Supabase (sau khi có bảng `pgns` ở Giai đoạn 4).

## Kết quả mục 1–2 (2026-10-23)

### `packages/chess-core` — 30 test

- **Luật đi:** `legalDests`, `playMove` (nhận cả UCI và SAN), `needsPromotion`, `gameStatus`, `inCheck`, `kingSquare`.
- **Hiển thị:** `sanLine` đổi PV dạng UCI của engine sang SAN.
- **Cây ván cờ `GameTree`:**
  - Nhánh chính kèm các biến; đi lại nước đã có thì dùng lại node sẵn có.
  - `path`, `next`, `parentOf`, `promoteVariation`, `deleteFrom`, chú thích, NAG.
- **PGN:**
  - Đọc được nhiều ván trong một file, biến lồng nhau, chú thích `{…}` và `;`, NAG và ký hiệu `!?`, FEN/SetUp. Báo lỗi rõ khi gặp nước sai.
  - Ghi ngược lại; vòng parse → ghi → parse giữ nguyên cây (đã kiểm với ván Opera của Morphy).
- **Puzzle:** `gradeMove` chấm từng bước. Nếu nước cuối là chiếu hết thì mọi cách chiếu hết khác đều được tính đúng. Phong cấp phải khớp đúng quân.
- **Cờ mù:** `hiddenSquares` với các chế độ `all` / `white` / `black` / `pieces`.

### `packages/board-web` — 13 test

- **Bàn cờ:** SVG tự viết (MIT), dùng bộ quân **celtic của Maurizio Monge (MIT)** lấy từ repo Arasan, có kèm `LICENSE`.
- **Đi quân:** kéo-thả hoặc bấm-bấm, hiện ô có thể đi, hộp chọn quân phong cấp.
- **Vẽ:** chuột phải kéo để vẽ mũi tên, bấm tại chỗ để tô ô (Shift / Alt / Ctrl đổi màu).
- **Bàn phím:** phím mũi tên di chuyển ô, Enter để chọn hoặc đi, Esc để huỷ. Có vùng `aria-live` đọc tên ô và quân.
- **Hiển thị:** lật bàn, toạ độ, nước vừa đi, ô vua bị chiếu, chế độ cờ mù.

### Trang `/analysis` — Bàn phân tích (web và desktop) — 3 test

- **Bàn cờ và danh sách nước:** danh sách dạng cây, bấm vào nước nào thì nhảy tới nước đó.
- **Chỉnh sửa:** viết chú thích, nâng biến lên nhánh chính, xoá từ một nước trở đi.
- **Phím tắt:** ← → ↑ ↓ để đi qua lại, F để lật bàn.
- **Nhập/xuất:** mở FEN hoặc PGN; sao chép PGN hoặc FEN; nhận tham số `?fen=` (có kiểm hợp lệ).
- **Engine:** chỉ nạp khi bấm "Bật engine", để không tải NNUE 25 MB khi chưa cần.
  - Hiện 3 phương án ở dạng SAN; bấm vào phương án thì đi nước đầu của nó.
  - Thanh đánh giá: thẻ `<meter>` cho trình đọc màn hình, cùng một thanh để nhìn.

### Kiểm trên Chrome thật

- **Bấm-bấm và kéo-thả:** bốn nước 1.e4 e5 2.Nf3 Nc6 bằng kéo-thả đều thành công.
- **Biến:** lùi một nước rồi đi 2…Bc5, biến hiển thị "(2…Bc5)".
- **Engine:** bật lên thì có 3 phương án và thanh đánh giá. Đã **đối chiếu với Arasan native** trên cùng thế: Nxe5 +4,13 với cùng chuỗi nước, phương án 2–3 cũng khớp (c3, Nc3).

### Lỗi tìm ra khi thử thật, đã sửa kèm test hồi quy

- **Kéo-thả nhanh không đi được quân:** trạng thái kéo nằm trong React state, mà `pointermove`/`pointerup` tới trước khi React vẽ lại.
  - Sửa: chuyển trạng thái kéo và vẽ sang `useRef`. Thả ở ô khác ô xuất phát thì tính là nước đi, không phụ thuộc `pointermove`.
  - Test hồi quy gửi sự kiện DOM liên tiếp, không đợi React vẽ lại.

### Ghi chú về công cụ thử

- Lệnh chụp màn hình CDP của tiện ích Chrome bị treo trên trang `/analysis`. Trong khi đó trang vẫn vẽ bình thường (`requestAnimationFrame` chạy, DOM đúng, thao tác chuột thật vẫn hoạt động).
- Vì vậy phần kiểm chứng ở trên dựa vào thao tác chuột thật cộng với đọc DOM.

### Còn lại

- **Mục 3:** thử engine trong app desktop đã build (`tauri build`). Cần người dùng mở app, vì không điều khiển được cửa sổ desktop từ đây.
- **Mục 4:** bàn cờ mobile (`board-native`). **Mục 5:** engine mobile.

## Kết quả mục 4 — Bàn cờ mobile (2026-10-23)

- **`packages/board-native`:** bàn cờ React Native dùng `react-native-svg` 15.16 và `react-native-gesture-handler` 3.3 (API hook `usePanGesture`).
  - Cùng hành vi với bản web: chạm-chạm hoặc kéo-thả, hiện ô có thể đi, hộp chọn phong cấp, lật bàn, toạ độ, cờ mù.
  - Bàn cờ tối đa 560px và căn giữa, để không phình to trên máy tính bảng hay màn hình rộng.
  - Dùng chung với web: hình học bàn cờ qua `@erpchess/board-web/geometry`; bộ quân celtic sinh thành chuỗi XML bằng `scripts/gen-pieces.mjs`, file SVG của bản web là nguồn duy nhất.
  - Trạng thái kéo nằm trong `useRef`, tránh lỗi kéo nhanh đã gặp ở bản web. Callback cử chỉ gọi qua một ref luôn trỏ tới hàm của lần render mới nhất, phòng trường hợp RNGH giữ closure cũ.
- **`useGameTree`** chuyển sang `@erpchess/chess-core/react`, web và mobile dùng chung.
- **Màn hình `/analysis` trên mobile:** bàn cờ, các nút ⏮ ◀ ▶ ⏭ và lật bàn, cây nước đi có biến, mở FEN/PGN. Màn hình chào và màn danh sách học viện có nút mở Bàn phân tích.

### Kiểm chứng

- Chạy bản `expo export --platform web` (react-native-web dùng chính component này) trên Chrome thật:
  - Chạm-chạm 1.e4, kéo-thả 1…e5, 2.Nf3, 2…Nc6.
  - Bấm ◀ rồi kéo 1.d4: biến hiện "1.e4 (1.d4)".
- **Chưa chạy trên thiết bị hoặc emulator Android/iOS.** Cần development build (`npx expo run:android`) hoặc Expo Go. RNGH và react-native-svg đều có sẵn trong Expo Go SDK 58.
- **Ghi chú khi thử:** cú bấm qua `ref` của công cụ tự cuộn phần tử vào khung nhìn, làm `ScrollView` dịch và lệch toạ độ đã tính sẵn. Thao tác bằng toạ độ chuột thật thì không gặp vấn đề này.

### Còn lại

- **Mục 3:** thử engine trong app desktop đã build (cần người dùng mở app).
- **Mục 5:** engine trên mobile (module native C++, bước 7 trong kế hoạch engine). Trước đó mobile chỉ có bàn phân tích, chưa có engine.
