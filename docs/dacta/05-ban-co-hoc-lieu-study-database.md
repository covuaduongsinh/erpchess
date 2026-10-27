# Đặc tả Kỹ thuật & Giải mã Chức năng: Chesslang.com vs ERPChess

## Tài liệu 05: Phân hệ Bàn cờ Phân tích, Học liệu Nghiên cứu (Studies) & CSDL Ván đấu (Masterbase)

> **Mã định danh:** REA-SPEC-05  
> **Route đối chứng:** `https://platform.chesslang.com/board`, `/study/list`, `/database`  
> **Ảnh chụp bằng chứng:** `rea/evidence/screenshots/route_board.png`, `route_study.png`, `route_database.png`  
> **Động cơ phân tích:** Arasan Chess Engine (WebAssembly SIMD128 + NNUE Evaluation)

---

### 1. Mục tiêu Nghiệp vụ & Giá trị Cốt lõi của Học liệu Cờ vua

Học liệu cờ vua (Studies & Masterbase) là nơi Huấn luyện viên biên soạn giáo án, lưu trữ các ván đấu kinh điển của các Đại kiện tướng thế giới và phân tích sâu các biến thể khai cuộc, trung cuộc, tàn cuộc.

Yêu cầu kỹ thuật cốt lõi:
1. **Học liệu Tương tác (Interactive Studies):**
   - Hỗ trợ cấu trúc nhiều chương (Multi-chapter study).
   - Mỗi chương có thể là một ván cờ đầy đủ, một thế cờ thế trận hoặc một biến thể phân nhánh phức tạp.
   - Cho phép thêm bình luận văn bản (Text annotations) và ký hiệu đánh giá nước đi chuẩn quốc tế (NAG: `!`, `?`, `!?`, `?!`, `++`, `+-`, v.v.).
2. **Công cụ Vẽ & Đánh dấu Bàn cờ (Board Visual Annotations):**
   - Vẽ mũi tên chiến thuật (Arrows) bằng thao tác giữ chuột phải (Right-click drag) với các màu: Xanh lá (nước đi hay), Đỏ (nguy hiểm/sai lầm), Vàng (cần lưu ý), Xanh dương (phòng thủ).
   - Đánh dấu ô vuông (Circle/Square highlight) trên bàn cờ.
3. **Cơ sở dữ liệu Ván cờ Đại kiện tướng (Masterbase / PGN Database):**
   - Hàng triệu ván cờ GM được lập chỉ mục (indexed).
   - Tìm kiếm ván đấu theo tên kỳ thủ (Magnus Carlsen, Garry Kasparov, Bobby Fischer), theo giải đấu, năm thi đấu hoặc mã khai cuộc ECO (B90, E60, C50...).
4. **Phân tích Thế trận với Engine Đỉnh cao (Arasan NNUE):**
   - Chạy trực tiếp trên trình duyệt bằng WebAssembly không phụ thuộc server mạng.
   - Cung cấp điểm đánh giá số học (Centipawns) hoặc thế chiếu bí (Mate in N).
   - Thanh đánh giá thế trận (EvalBar) hiển thị trực quan ưu thế của Trắng/Đen.

---

### 2. Cấu trúc Giao diện Bàn cờ Nghiên cứu Chuyên sâu

```
+-----------------------------------------------------------------------------------------+
| [Header] Tiêu đề Study: "Phòng thủ Sicilian - Biến Najdorf" | [Chương 1/5] | [Chia sẻ] |
+---+---------------------------------------------------------+---------------------------+
| E |      +-------------------------------------------+      | [Tab Cây Biến thể & PGN]  |
| v |      |                                           |      | 1. e4 c5 2. Nf3 d6        |
| a |      |                                           |      | 3. d4 cxd4 4. Nxd4 Nf6   |
| l |      |                                           |      | 5. Nc3 a6 {Biến Najdorf!} |
| B |      |             BÀN CỜ PHÂN TÍCH              |      |    +- 5... e5 (Biến phụ)  |
| a |      |             (ARASAN NNUE EVAL)            |      | 6. Be3 e5 7. Nb3 Be6      |
| r |      |                                           |      |                           |
|   |      |                                           |      +---------------------------+
| + |      |                                           |      | [Đánh giá Engine Arasan]: |
| 0 |      +-------------------------------------------+      | Điểm: +0.34 | Sâu: 22 ply |
| . | [|<] [<<] [Đi lại] [>>] [>|] | [Lật bàn cờ] | [Xóa vẽ]  | Gợi ý: 8. f3 Be7 9. Qd2   |
| 3 | [FEN Copy] [PGN Export] | [Thêm biến thể]               |                           |
+---+---------------------------------------------------------+---------------------------+
| [Thanh Công cụ dưới]: Nhập nước đi từ bàn phím | Nhập FEN tùy ý | Chế độ Đấu thử với Máy |
+-----------------------------------------------------------------------------------------+
```

---

### 3. Cấu trúc Cây Nước đi & Dữ liệu Study (Tree Move Data Structure)

Để hỗ trợ phân nhánh biến thể không giới hạn, ERPChess áp dụng cấu trúc Cây Nút (Node-Tree Structure):

```typescript
interface StudyNode {
  id: string;
  ply: number;
  move: {
    from: string;
    to: string;
    promotion?: string;
    san: string;
    uci: string;
  };
  fen: string;
  comment?: string;
  nags?: number[]; // [1] = !, [2] = ?, [3] = !!
  shapes?: Array<{
    type: 'arrow' | 'square';
    from: string;
    to?: string;
    color: 'green' | 'red' | 'blue' | 'yellow';
  }>;
  children: StudyNode[]; // Các nhánh biến thể phụ
  parent?: string;
}
```

---

### 4. Tích hợp Động cơ Arasan WebAssembly & Thanh Đánh giá (EvalBar)

1. **Kiến trúc luồng xử lý Web Worker:**
   - WebAssembly engine chạy trên Worker ngầm riêng biệt (`arasan.worker.ts`), không làm đơ giật UI của trang web khi tính toán sâu.
   - Giao tiếp qua giao thức chuẩn UCI (Universal Chess Interface):
     - `position fen <FEN>`
     - `go depth 20 movetime 1500`
     - Lắng nghe sự kiện `info depth 22 score cp 34 pv Be3 ...`
2. **Thanh EvalBar mượt mà:**
   - Điểm số được làm mịn (smooth transition animation) bằng CSS `transition: height 0.3s ease-out`.
   - Chuyển đổi điểm số Centipawns sang tỷ lệ % hiển thị:
     $$P(\text{Trắng}) = \frac{1}{1 + 10^{-\text{score}/400}}$$

---

### 5. Hạng mục Cần Hoàn thiện trong ERPChess

1. **Bộ Công cụ Trực quan hóa Bàn cờ (Visual Markup Toolbar):**
   - Hỗ trợ thao tác chuột phải kéo mũi tên và click đúp ô cờ trực tiếp trên component bàn cờ.
2. **Cây Nước đi Tương tác (Interactive Move Tree Component):**
   - Hiển thị các nhánh con thụt đầu dòng, click vào nước đi bất kỳ để bàn cờ nhảy ngay đến thế cờ đó.
3. **Mục Thư viện Ván cờ Lớn (Master Database Search):**
   - Tích hợp bộ lọc tìm kiếm theo tên kỳ thủ, giải đấu và tỷ lệ thắng thua của các nước khai cuộc (Opening Book Explorer).
