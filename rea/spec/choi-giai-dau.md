# Chơi cờ, giải đấu, bàn cờ và CSDL

## Game Area

- **Tab:**
  - Học viên: thẻ "số ván hôm nay" và danh sách học viên đang online.
  - Lịch sử ván.
  - Ván đang diễn ra: xem trực tiếp.
- **Ghép cặp:** HLV dùng "Tạo cặp đấu" để ghép học viên với nhau.
- **Đánh với máy:** chọn mức mới học, trung bình hoặc nâng cao.

## Simul (đấu đồng loạt)

- Số liệu: tổng số, đang diễn ra, sắp tới, đã xong.
- Tìm kiếm theo tên hoặc mô tả.
- Một người (HLV) đấu cùng lúc với nhiều học viên.

## Tournament

- **Danh sách:**
  - Tìm theo tên, người chơi hoặc địa điểm.
  - Lọc ngày; sắp xếp.
  - Lọc trạng thái: tất cả / đang diễn ra / sắp tới / đã xong.
  - Ba kiểu xem: danh sách, bảng, lịch.
- **Tạo giải** theo 3 bước:
  1. **Chi tiết:**
     - Tên, mô tả.
     - Ngày và giờ bắt đầu, múi giờ.
     - Lặp lại: tự tạo các giải kế tiếp theo lịch.
     - Thể thức: Swiss, Quad (nhóm 4 người), Swiss đồng đội.
     - Số vòng.
     - Hệ rating: không tính, hoặc rating nội bộ.
     - Thời gian: phút + giây cộng thêm (ví dụ 10+0).
     - Cho phép xin thua, cho phép hoà.
     - Giải công khai: ai cũng vào được, không cần mời.
     - Điều khiển: thủ công, tự hoàn tất vòng, hoặc tự lên lịch.
     - Kiểu ván: tiêu chuẩn, khai cuộc định sẵn, hoặc FEN tuỳ chỉnh (dựng trên bàn).
  2. **Lịch.**
  3. **Người chơi.**

## Board

- Bàn cờ có các thanh công cụ:
  - Lật bàn, dựng thế, xoá.
  - Bút vẽ mũi tên/tô ô.
  - Điều hướng nước đi, hiện thời gian mỗi nước.
- **Tab:**
  - Masterbase: tìm ván cao thủ; lọc ván dưới 20 nước, Elo trên 2500, hoặc theo thế cờ trên bàn.
  - Bàn mới.
  - PDF (AI).
  - CSDL của tôi.
  - Engine.
  - Phân tích.
- **Lưu ván.**

## Database

- **Thư viện:** CSDL của tôi, CSDL học viên, CSDL công khai.
- **Bố cục ba cột:** danh sách CSDL, danh sách ván (ngày, Trắng, Đen, kết quả), trình xem ván.
- **Tải PGN lên.**
- **Đồng bộ ván Chess.com / Lichess** theo ID người dùng (ở mục Preferences).

## Ánh xạ sang erpchess

- **Bảng:**
  - `games`: ván 1–1, đồng hồ, kết quả, PGN.
  - `simuls`, `simul_boards`.
  - `tournaments`, `tournament_players`, `tournament_rounds`, `pairings`.
  - `game_databases`, `database_games`.
- **Ghép cặp:** Swiss (Dutch) và vòng tròn viết trong `packages/chess-core`, có test.
- **Masterbase:** chỉ dùng bộ ván có giấy phép mở.
