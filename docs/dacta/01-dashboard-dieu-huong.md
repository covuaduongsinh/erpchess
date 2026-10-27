# Đặc tả Kỹ thuật & Giải mã Chức năng: Chesslang.com vs ERPChess

## Tài liệu 01: Bảng Điều khiển (Dashboard) & Hệ thống Điều hướng Thông minh

> **Mã định danh:** REA-SPEC-01  
> **Route đối chứng:** `https://platform.chesslang.com/dashboard`  
> **Ảnh chụp bằng chứng:** `rea/evidence/screenshots/route_dashboard.png`  
> **API giám sát:** `api/v2/dashboard/feed/upcoming`, `api/v2/dashboard/feed/weekly-stats`, `api/v2/dashboard/learners/top`

---

### 1. Mục tiêu Nghiệp vụ & Đối tượng Sử dụng (Personas)

- **Chủ học viện (Owner / Admin):** Cần cái nhìn tổng quan tức thì về số lượng học viên đang hoạt động, lịch dạy của các lớp trong ngày, tình hình làm bài tập và biểu đồ tương tác của toàn câu lạc bộ.
- **Huấn luyện viên (Coach):** Nhanh chóng thấy được lớp học sắp diễn ra tiếp theo của mình (đếm ngược thời gian) để bấm "Vào lớp ngay", xem danh sách học viên cần nhắc nhở làm bài.
- **Học viên (Student) & Phụ huynh (Parent):** Xem ca học sắp diễn ra, số lượng bài tập còn hạn nộp, thành tích giải cờ trong tuần và thứ hạng của mình trong Top Learners.

---

### 2. Cấu trúc Giao diện & Luồng Người dùng (UI / UX Flow)

```
+-----------------------------------------------------------------------------------------+
| [Header] Logo CLB | Chọn Học viện | [Ctrl+K Tìm kiếm...] | Múi giờ | Avatar / Hồ sơ      |
+-----------------------------------------------------------------------------------------+
| [Thanh Quick Actions]                                                                   |
| [ + Lớp mới ]       [ + Giao bài tập ]      [ + Tạo giải đấu ]     [ ⚔️ Đấu Bot / Chơi ] |
+-------------------------------------------------------------+---------------------------+
| [Cột Trái (2/3 chiều rộng)]                                 | [Cột Phải (1/3)]          |
| 1. Widget Lớp học sắp tới (Upcoming Sessions):              | 3. Hoạt động Tuần:        |
|    - Tên lớp, HLV phụ trách, thời gian, số học viên.        |    - Biểu đồ số bài giải  |
|    - Nút 1 chạm: "Vào lớp ngay" (Launch Classroom).         |    - Giờ học trực tuyến   |
| 2. Feed Hoạt động & Thông báo mới:                          | 4. Bảng xếp hạng Tuần:    |
|    - Học viên A vừa hoàn thành bài tập 100%.                |    - Top Learners (Avatar,|
|    - HLV B đã giao 10 bài tập thế cờ mới.                   |      Số bài đúng, Điểm)   |
+-------------------------------------------------------------+---------------------------+
```

---

### 3. Chi tiết Thành phần Chức năng (Component Breakdown)

#### 3.1. Thanh tác vụ nhanh (Quick Actions Bar)

- **Tạo lớp học mới (Create Classroom / Session):** Mở modal đặt tên buổi học, chọn HLV, chọn lớp học viên (batch), chọn thời gian bắt đầu và thời lượng (45m, 60m, 90m).
- **Giao bài tập (Assign Exercise):** Mở luồng chọn chương bài tập hoặc thế cờ FEN, đặt hạn chót (deadline) và gán cho cả lớp hoặc từng học viên.
- **Tổ chức giải đấu (Create Tournament):** Chuyển hướng đến trình tạo giải cờ vua nội bộ.
- **Vào khu vực thi đấu (Game Area / Play Bot):** Chuyển nhanh đến bàn cờ đấu bot hoặc thách đấu học viên online.

#### 3.2. Widget Buổi học sắp tới (Upcoming Sessions)

- **Truy vấn dữ liệu:** Lấy danh sách các session có `start_time` trong khoảng từ hiện tại đến 7 ngày tới, sắp xếp tăng dần theo thời gian.
- **Trạng thái trực quan:**
  - `Đang diễn ra (Live now)`: Nút màu xanh lá nổi bật nhấp nháy "Vào lớp ngay".
  - `Sắp bắt đầu (< 15 phút)`: Đếm ngược thời gian (ví dụ: "Bắt đầu sau 8 phút").
  - `Trống (Empty state)`: Hiển thị hình ảnh minh họa thân thiện kèm nút "+ Tạo buổi học mới".

#### 3.3. Thống kê hoạt động tuần (Weekly Activity Stats)

- Hiển thị 3 chỉ số then chốt:
  1. **Số bài tập đã hoàn thành:** Tổng số lượt nộp bài đúng của tuần này so với tuần trước (tăng/giảm %).
  2. **Thời lượng học trực tuyến:** Tổng số giờ các lớp học đã diễn ra trong tuần.
  3. **Tỷ lệ chuyên cần (Attendance rate):** Phần trăm học viên tham gia lớp học đúng giờ.

#### 3.4. Bảng xếp hạng Top Learners (Leaderboard)

- Danh sách 5-10 học viên tích cực nhất trong tuần.
- Thuật toán tính điểm: Mỗi bài tập giải đúng lần đầu: +10 điểm; mỗi bài giải đúng sau gợi ý: +5 điểm; mỗi ván cờ hoàn thành trong Game Area: +3 điểm.
- Hiển thị: Thứ hạng huy chương (Vàng, Bạc, Đồng), Avatar, Tên học viên, Huy hiệu cấp độ, Điểm số.

#### 3.5. Command Palette toàn hệ thống (`Ctrl + K` / `Cmd + K`)

- Mở bảng tìm kiếm toàn năng tại bất kỳ màn hình nào.
- Phân nhóm kết quả thông minh:
  - **Điều hướng nhanh:** Bàn cờ phân tích, Bài tập, Lớp học, Giải đấu, Học viên, Cài đặt.
  - **Hành động nhanh:** Giao bài tập, Thách đấu cờ, Tạo lớp mới, Đổi ngôn ngữ, Đổi theme bàn cờ.
  - **Tìm kiếm dữ liệu:** Tìm tên học viên, tìm tên lớp học, tìm bài tập theo mã FEN/chủ đề.

---

### 4. Đặc tả API Contract & Ràng buộc Dữ liệu

```typescript
// GET /api/v2/dashboard/overview?academyId=:id&timezone=:tz
interface DashboardOverviewResponse {
  upcomingSessions: Array<{
    id: string;
    title: string;
    batchName?: string;
    coach: { id: string; name: string; avatarUrl?: string };
    startTime: string; // ISO 8601
    durationMinutes: number;
    studentCount: number;
    status: 'scheduled' | 'live' | 'completed';
    classroomUrl: string;
  }>;
  weeklyStats: {
    puzzlesSolved: number;
    puzzlesTrendPercent: number; // e.g. +12.5%
    classHoursTaught: number;
    attendancePercent: number;
  };
  topLearners: Array<{
    rank: number;
    studentId: string;
    name: string;
    avatarUrl?: string;
    levelName: string;
    score: number;
    puzzlesSolved: number;
  }>;
}
```

---

### 5. Hiện trạng trên ERPChess & Hạng mục Cần Hoàn thiện

- **Đã có:** Widget Quick Actions 4 nút, Danh sách lịch học sắp tới, Thống kê cơ bản, Command Palette (`Ctrl+K`).
- **Cần hoàn thiện tiếp:**
  1. Thêm biểu đồ tương tác SVG/Tailwind nhỏ gọn hiển thị tần suất giải bài tập theo từng ngày trong tuần (Thứ 2 đến Chủ nhật).
  2. Bổ sung modal tạo nhanh lớp học (Quick Session Modal) kích hoạt trực tiếp từ nút Quick Action `+ Lớp mới`.
  3. Đồng bộ dữ liệu Top Learners theo điểm số thực tế từ bảng `attempts` và `game_records`.
