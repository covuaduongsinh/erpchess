# Study — đơn vị học liệu

Study là **chuỗi hoạt động có thứ tự**. Đây là nguồn nội dung chung, được quiz, khoá học và lớp học dùng lại.

## Danh sách

- **Tab:**
  - Study của tôi.
  - Study công khai: thư viện dùng chung, hiện có khoảng 225 bài theo giáo trình từ nhập môn tới chiến thuật.
  - Study được chia sẻ.
- **Collections:** gom nhiều study.
- **Lọc và sắp xếp:** tìm kiếm, lọc theo ngày, sắp theo ngày tạo, chuyển xem lưới hoặc danh sách.
- **Mỗi thẻ study** hiện số hoạt động, tổng thời lượng dự kiến, cấp độ, nút "Tạo quiz từ study", và nút xoá nếu có quyền.
- **Bản nháp:**
  - Mở trình dựng là sinh ngay một bản nháp chưa có tên.
  - Bản nháp chỉ chủ sở hữu thấy, hiện ở mục "Drafts".
  - _erpchess nên tránh tự sinh bản nháp khi chỉ mở trang; chỉ lưu nháp khi người dùng đã thêm nội dung._
- **Cấu hình mặc định:** điểm, số lần thử, thời gian… áp cho hoạt động mới.

## Trình dựng (2 bước)

1. **Activities:** chọn loại hoạt động ở cột trái, danh sách hoạt động hiện bên phải, sắp xếp lại được.
2. **Details:** tên, mô tả, cấp độ, rồi hoàn tất.

## Loại hoạt động

| Loại                 | Hành vi                                                          | Thuộc tính riêng                                        |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| Trang HTML           | Bài giảng tương tác nhúng                                        | —                                                       |
| Giải thích           | Văn bản giàu định dạng, có nhúng thế cờ                          | —                                                       |
| Trắc nghiệm (MCQ)    | Câu hỏi kèm ảnh hoặc thế cờ, 2–4 phương án, một đáp án đúng      | Lời giải hiện sau khi trả lời                           |
| Puzzle / chiến thuật | Tìm chuỗi nước tốt nhất từ thế cờ                                | Thời gian giới hạn (ví dụ 120 giây), nút "xem lời giải" |
| Bắt quân             | Học viên điều một quân bắt hết quân đối phương trên bàn dựng sẵn | Phe học viên cầm, phạt khi dùng gợi ý                   |
| Đánh với máy         | Chơi với engine từ thế cờ cho trước                              | —                                                       |
| Video                | Tải video bài giảng lên                                          | —                                                       |
| Xem ván              | Đi qua ván đầy đủ, có chú thích và biến                          | —                                                       |
- **Thuộc tính chung** của mọi hoạt động:
  - Điểm (thường 0 hoặc 10).
  - Số lần thử tối đa.
  - Phạt khi sai.
  - Chủ đề. Chủ đề của study được gộp từ chủ đề các hoạt động.
- **Nguồn nhập hoạt động:**
  - Nhập study công khai từ Lichess, chuyển thành puzzle.
  - Tải PGN lên: lưu vào Database, mỗi ván thành một puzzle hoặc một hoạt động xem ván.
  - Chọn ván từ Database để tạo puzzle.
  - Sinh puzzle hàng loạt có AI hỗ trợ tìm kiếm.

## Ánh xạ sang erpchess

- **Bảng mới:** `studies`, `study_activities` (cột `kind` + `payload` jsonb + `points`, `max_attempts`, `time_limit_s`, `wrong_penalty`, `hint_penalty`, `topics`), `study_collections`.
- **Puzzle hiện có** (`puzzles`) trở thành nguồn của hoạt động kiểu `puzzle`.
- **Chấm bài:**
  - Phía server cho các loại `puzzle`, `capture`, `mcq`.
  - Các loại `explanation`, `video`, `game_viewer`, `html` chỉ ghi "đã xem".
