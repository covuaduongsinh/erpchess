/** Số liệu tổng hợp cho Tổng quan và Quiz (Giai đoạn 25g): theo ngày, bảng xếp hạng quiz, quiz đã bắt đầu. */
import type { ErpClient } from './client';
import { unwrap } from './queries';

/** Một ngày của biểu đồ tuần; `date` là `YYYY-MM-DD` theo múi giờ đã truyền vào. */
export type DailyStat = {
  date: string;
  /** Lượt làm đã kết thúc: bài tập + quiz + hoạt động của study thuộc học viện. */
  attempts: number;
  /** Lượt điểm danh có mặt hoặc trễ. */
  attendancePresent: number;
  /** Lượt điểm danh không tính "có phép". */
  attendanceTotal: number;
  /** Số cặp (quiz, học viên) làm xong đủ mọi câu, tính theo ngày nộp câu cuối. */
  quizCompletions: number;
};

export type QuizBoardRow = {
  studentId: string;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  correct: number;
  completed: number;
};

export type QuizStarted = { total: number; open: number; started: number };

/** Múi giờ mặc định của học viện (cùng mặc định của RPC). */
export const DEFAULT_STATS_TZ = 'Asia/Ho_Chi_Minh';

/**
 * Số liệu từng ngày trong [from, to] (`YYYY-MM-DD`, tối đa 93 ngày). Chỉ owner/coach của học viện
 * nhận dữ liệu; người khác nhận mảng rỗng.
 */
export async function fetchDailyStats(
  client: ErpClient,
  academyId: string,
  from: string,
  to: string,
  tz: string = DEFAULT_STATS_TZ,
): Promise<DailyStat[]> {
  const rows = unwrap(
    await client.rpc('academy_daily_stats', {
      p_academy: academyId,
      p_from: from,
      p_to: to,
      p_tz: tz,
    }),
  );
  return rows.map((r) => ({
    date: r.on_date,
    attempts: r.attempts,
    attendancePresent: r.attendance_present,
    attendanceTotal: r.attendance_total,
    quizCompletions: r.quiz_completions,
  }));
}

/** Bảng xếp hạng quiz toàn học viện trong [from, to): mọi học viên, đã sắp theo điểm. */
export async function fetchAcademyQuizBoard(
  client: ErpClient,
  academyId: string,
  from: Date,
  to: Date,
): Promise<QuizBoardRow[]> {
  const rows = unwrap(
    await client.rpc('academy_quiz_leaderboard', {
      p_academy: academyId,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    }),
  );
  return rows.map((r) => ({
    studentId: r.student_id,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    points: r.points,
    correct: r.correct,
    completed: r.completed,
  }));
}

/** Tổng quiz, quiz đang giao và quiz đã có người bắt đầu; `null` nếu không phải nhân sự. */
export async function fetchQuizStarted(
  client: ErpClient,
  academyId: string,
): Promise<QuizStarted | null> {
  const [row] = unwrap(await client.rpc('academy_quiz_started', { p_academy: academyId }));
  if (!row) return null;
  return { total: row.total_quizzes, open: row.open_quizzes, started: row.started_quizzes };
}

/** Phần trăm làm tròn của `part` trên `whole`; `null` khi không có gì để chia (tránh hiện 0% giả). */
export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}
