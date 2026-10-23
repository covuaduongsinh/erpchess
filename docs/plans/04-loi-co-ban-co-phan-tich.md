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
