# Đặc tả Kỹ thuật & Giải mã Chức năng: Chesslang.com vs ERPChess

## Tài liệu 04: Phân hệ Bài tập (Assignments), Trắc nghiệm (Quiz) & Luyện tập Thế cờ (Practice)

> **Mã định danh:** REA-SPEC-04  
> **Route đối chứng:** `https://platform.chesslang.com/assignment/exercise`, `/quiz/list`, `/practice`  
> **Ảnh chụp bằng chứng:** `rea/evidence/screenshots/route_assignment.png`, `route_quiz_list.png`, `route_practice.png`  
> **Logic chấm điểm:** `@erpchess/chess-core` + Supabase Edge Function `submit-attempt`

---

### 1. Mục tiêu Nghiệp vụ & Khái niệm Ba Trụ cột Học tập

Trong hệ sinh thái đào tạo cờ vua của Chesslang, việc rèn luyện tư duy cờ được chia làm 3 hình thức rõ rệt:
1. **Luyện tập Thế cờ tự do (Practice Chapters / Drills):**
   - Kho bài tập mở cho học viên tự luyện tập bất kỳ lúc nào.
   - Được phân loại theo chương (Chapters) và chủ đề chiến thuật (Đòn ghim - Pin, Đòn xiên - Skewer, Đòn chĩa - Fork, Chiếu bí trong 1-2-3 nước, Tàn cuộc cơ bản).
   - Có cơ chế lưu tiến độ (% đã giải) và cho phép giải lại.
2. **Bài tập Giao về nhà (Assignments / Exercises):**
   - Do Huấn luyện viên tuyển chọn và giao có chủ đích cho một Lớp (Batch) hoặc từng Học viên.
   - Có thời hạn nộp bài (Deadline) và số điểm mục tiêu.
   - HLV theo dõi bảng thống kê: Ai đã làm, số lần thử (attempts), thời gian giải mỗi câu, tỷ lệ đúng lần đầu (First-try accuracy).
3. **Trắc nghiệm Cờ vua (Quiz Management):**
   - Bài kiểm tra có áp lực thời gian (tính giờ từng câu hoặc cả bài quiz, ví dụ: 60 giây/câu).
   - Kết hợp cả câu hỏi thế cờ tương tác (nước đi đúng) và câu hỏi lý thuyết cờ vua nhiều lựa chọn (Multiple choice: A, B, C, D).
   - Bảng điểm xếp hạng tự động sau khi hoàn tất.

---

### 2. Cấu trúc Giao diện & Luồng Người dùng (UI / UX Flow)

```
[Phân hệ Practice]                     [Phân hệ Assignments]                   [Phân hệ Quizzes]
+-------------------------------+      +-------------------------------+       +-------------------------------+
| Grid các Chương Luyện tập     |      | Danh sách Bài tập đã giao     |       | Danh sách Bài Trắc nghiệm     |
| [Tactics 101] [Chủ đề Tàn cờ] |      | - Hạn nộp, Lớp được giao      |       | - Thời gian, Số câu hỏi       |
| - Tiến độ: [==== 65% ]       |      | - Tỷ lệ nộp: 18/20 học viên   |       | - Trạng thái: Mở / Đã đóng    |
+-------------------------------+      +-------------------------------+       +-------------------------------+
               |                                       |                                       |
        (Click vào Chương)                      (Click Xem chi tiết)                    (Bắt đầu làm Quiz)
               v                                       v                                       v
+-------------------------------+      +-------------------------------+       +-------------------------------+
| Màn hình Giải Thế cờ:         |      | Báo cáo Nộp bài của Lớp:      |       | Giao diện Kiểm tra Tính giờ:  |
| - Bàn cờ tương tác            |      | - Bảng danh sách học viên     |       | - Đồng hồ đếm ngược: 00:45    |
| - Máy tự động đi nước đáp trả |      | - Số điểm, Thời gian làm bài  |       | - Câu hỏi 3/10: "Nước đi tốt  |
| - Gợi ý (Hint) khi gặp bế tắc |      | - Đánh giá: Cần luyện thêm    |       |   nhất cho Trắng là gì?"      |
+-------------------------------+      +-------------------------------+       +-------------------------------+
```

---

### 3. Cơ chế Chấm bài Thế cờ Tự động (Interactive Puzzle Engine)

#### 3.1. Cấu trúc Dữ liệu Thế cờ Nhiều nước đi (Multi-move Puzzle)

Một thế cờ không chỉ có 1 nước đi duy nhất mà có thể gồm chuỗi biến thế:
```json
{
  "id": "puz_001",
  "fen": "r1bqk2r/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 0 1",
  "orientation": "white",
  "rating": 1200,
  "theme": ["fork", "tactics"],
  "solutionMoves": ["c4f7", "e8f7", "f3e5", "f7g8"],
  "alternativeResponses": {
    "c4f7": {
      "reply": "e8f7",
      "nextMoves": {
        "f3e5": { "reply": "c6e5", "status": "solved" }
      }
    }
  }
}
```

#### 3.2. Thuật toán Chấm bài Phía Máy khách & Server

1. Học viên kéo thả hoặc click chọn ô đi quân `Move(from, to)`.
2. Client kiểm tra xem nước đi có khớp với `solutionMoves[currentStep]` hay không:
   - **Nếu Đúng:**
     - Hiển thị hiệu ứng tích xanh hoặc âm thanh chúc mừng nhẹ.
     - Sau 400ms, hệ thống tự động đi nước đáp trả của đối thủ (`opponentReply`).
     - Chuyển sang bước tiếp theo cho đến khi hoàn thành toàn bộ chuỗi nước đi -> Đánh dấu `SOLVED`.
   - **Nếu Sai:**
     - Rung bàn cờ hoặc hiển thị thông báo "Nước đi chưa chính xác, hãy thử lại!".
     - Tăng biến đếm `attempts_count`.
     - Cho phép học viên đi lại hoặc bấm nút "Xem gợi ý (Hint)".

#### 3.3. Bảo mật Chấm bài Server-side (Chống Gian lận)

- Toàn bộ kết quả nộp bài được gửi qua Edge Function `submit-attempt`.
- Server kiểm tra lại chuỗi nước đi bằng thư viện chuẩn `@erpchess/chess-core`.
- Ngăn chặn các hành vi gửi điểm giả mạo từ client mà không có chuỗi nước đi hợp lệ.

---

### 4. Báo cáo & Thống kê Chi tiết cho Huấn luyện viên

Màn hình chi tiết bài tập (`/assignment/:id`) cung cấp cho HLV:
1. **Tổng quan lớp học:**
   - Số học viên đã hoàn thành / Chưa làm / Quá hạn.
   - Điểm số trung bình của cả lớp.
   - Thế cờ nào nhiều học viên bị sai nhất (để HLV đưa vào giảng dạy trong buổi học tiếp theo).
2. **Chi tiết từng học viên:**
   - Tên học viên, thời gian bắt đầu làm, thời gian nộp bài.
   - Số lần thử trước khi tìm ra đáp án đúng (1st try, 2nd try, >3 tries).
   - Nút "Xem lại quá trình giải": Cho phép HLV xem học viên đã đi những nước sai nào để chỉ ra điểm yếu tư duy.

---

### 5. Hạng mục Cần Hoàn thiện trong ERPChess

1. **Bộ lọc Trạng thái Nâng cao:** Bổ sung bộ lọc (Chưa giải / Đã xong / Thử lại) và sắp xếp theo độ khó (Rating Elo bài tập) trong `Practice`.
2. **Giao diện Tạo Bài tập & Quiz Linh hoạt (Assignment Builder):**
   - Cho phép HLV tích chọn nhiều bài từ ngân hàng thế cờ có sẵn để tạo thành một bộ bài tập (Batch Assignment) chỉ trong vài cú click.
3. **Chế độ Làm Quiz Toàn màn hình:** Giao diện tập trung, ẩn thanh điều hướng, có đồng hồ đếm ngược to rõ và thanh tiến trình câu hỏi trực quan.
