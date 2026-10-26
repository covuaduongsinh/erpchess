/**
 * Báo cáo tổng hợp và chi tiết theo học viên và toàn học viện.
 */
import { toCsv } from './csv';

export type ReportPreset = 'all' | 'month' | 'quarter' | 'year';

export type StudentReportFilters = {
  from?: string;
  to?: string;
  preset?: ReportPreset;
};

export type StudentReportSummary = {
  studentId: string;
  displayName: string;
  username: string;
  assignments: {
    totalAssigned: number;
    completed: number;
    solvedRate: number; // 0 - 100
    avgTries: number;
    avgTimeMs: number;
  };
  quizzes: {
    totalAssigned: number;
    completed: number;
    avgScore: number;
    avgTimeMs: number;
  };
  classrooms: {
    totalSessions: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    attendanceRate: number; // 0 - 100
  };
  games: {
    totalGames: number;
    wins: number;
    draws: number;
    losses: number;
    ratings: {
      bullet?: number;
      blitz?: number;
      rapid?: number;
      classical?: number;
    };
  };
  tournaments: {
    totalJoined: number;
    totalGames: number;
    totalPoints: number;
    bestRank: number | null;
  };
};

export type StudentAssignmentDetail = {
  id: string;
  title: string;
  assignedAt: string;
  dueDate: string | null;
  solved: boolean;
  tries: number;
  timeMs: number;
};

export type StudentQuizDetail = {
  id: string;
  title: string;
  submittedAt: string | null;
  score: number;
  maxScore: number;
  solved: boolean;
  timeMs: number;
};

export type StudentClassroomDetail = {
  id: string;
  title: string;
  startsAt: string;
  status: 'present' | 'late' | 'absent';
  note: string;
};

export type StudentGameDetail = {
  id: string;
  playedAt: string;
  opponent: string;
  color: 'white' | 'black';
  result: string;
  speed: string;
  won: boolean | null;
};

export type StudentTournamentDetail = {
  id: string;
  title: string;
  startsAt: string;
  rank: number | null;
  points: number;
  tiebreak: number;
  totalPlayers: number;
};

export type StudentDetailedReport = {
  student: {
    id: string;
    displayName: string;
    username: string;
    email?: string;
  };
  summary: StudentReportSummary;
  assignments: StudentAssignmentDetail[];
  quizzes: StudentQuizDetail[];
  classrooms: StudentClassroomDetail[];
  games: StudentGameDetail[];
  tournaments: StudentTournamentDetail[];
};

export type AcademyStudentSummary = {
  studentId: string;
  displayName: string;
  username: string;
  levelName?: string;
  assignmentsCompleted: number;
  assignmentsTotal: number;
  quizAvgScore: number;
  quizCompleted: number;
  attendanceRate: number;
  sessionsPresent: number;
  sessionsTotal: number;
  gamesTotal: number;
  gamesWdl: string;
  blitzRating: number;
  rapidRating: number;
  classicalRating: number;
};

const UTF8_BOM = '\uFEFF';

function formatSeconds(ms: number): string {
  return (ms / 1000).toFixed(1);
}

function attendanceStatusLabel(status: 'present' | 'late' | 'absent'): string {
  switch (status) {
    case 'present':
      return 'Có mặt';
    case 'late':
      return 'Đi muộn';
    case 'absent':
      return 'Vắng mặt';
    default:
      return status;
  }
}

/** Xuất báo cáo chi tiết của một học viên ra định dạng CSV kèm UTF-8 BOM cho Excel */
export function studentDetailedReportToCsv(report: StudentDetailedReport): string {
  const { student, summary, assignments, quizzes, classrooms, games, tournaments } = report;

  const rows: string[][] = [
    ['# BÁO CÁO CHI TIẾT HỌC VIÊN'],
    ['Họ và tên', 'Tên đăng nhập', 'Mã học viên', 'Email'],
    [student.displayName, student.username, student.id, student.email ?? ''],
    [],
    ['# TỔNG QUAN'],
    ['Chỉ số', 'Giá trị', 'Chi tiết'],
    [
      'Bài tập',
      `${summary.assignments.completed}/${summary.assignments.totalAssigned} (${summary.assignments.solvedRate.toFixed(1)}%)`,
      `Thử TB: ${summary.assignments.avgTries.toFixed(1)} - Thời gian TB: ${formatSeconds(summary.assignments.avgTimeMs)}s`,
    ],
    [
      'Quiz',
      `${summary.quizzes.completed}/${summary.quizzes.totalAssigned}`,
      `Điểm TB: ${summary.quizzes.avgScore.toFixed(1)} - Thời gian TB: ${formatSeconds(summary.quizzes.avgTimeMs)}s`,
    ],
    [
      'Chuyên cần lớp học',
      `${summary.classrooms.attendanceRate.toFixed(1)}%`,
      `Có mặt: ${summary.classrooms.presentCount} - Muộn: ${summary.classrooms.lateCount} - Vắng: ${summary.classrooms.absentCount} (Tổng ${summary.classrooms.totalSessions} buổi)`,
    ],
    [
      'Ván đấu',
      `Thắng ${summary.games.wins} / Hoà ${summary.games.draws} / Thua ${summary.games.losses} (Tổng ${summary.games.totalGames})`,
      `Blitz: ${summary.games.ratings.blitz ?? '-'} | Rapid: ${summary.games.ratings.rapid ?? '-'} | Classical: ${summary.games.ratings.classical ?? '-'}`,
    ],
    [
      'Giải đấu',
      `Tham gia ${summary.tournaments.totalJoined} giải`,
      `Tổng điểm: ${summary.tournaments.totalPoints} - Hạng cao nhất: ${summary.tournaments.bestRank ?? '-'}`,
    ],
    [],
    ['# CHI TIẾT BÀI TẬP'],
    ['Tiêu đề bài tập', 'Ngày giao', 'Hạn nộp', 'Trạng thái', 'Số lần thử', 'Thời gian (giây)'],
    ...assignments.map((a) => [
      a.title,
      a.assignedAt,
      a.dueDate ?? '',
      a.solved ? 'Đã giải đúng' : 'Chưa đạt',
      String(a.tries),
      formatSeconds(a.timeMs),
    ]),
    [],
    ['# CHI TIẾT QUIZ'],
    ['Tiêu đề quiz', 'Thời gian nộp', 'Điểm đạt', 'Điểm tối đa', 'Trạng thái', 'Thời gian (giây)'],
    ...quizzes.map((q) => [
      q.title,
      q.submittedAt ?? '',
      String(q.score),
      String(q.maxScore),
      q.solved ? 'Đạt' : 'Chưa đạt',
      formatSeconds(q.timeMs),
    ]),
    [],
    ['# CHUYÊN CẦN LỚP HỌC'],
    ['Lớp / Buổi học', 'Thời gian bắt đầu', 'Trạng thái', 'Ghi chú'],
    ...classrooms.map((c) => [c.title, c.startsAt, attendanceStatusLabel(c.status), c.note]),
    [],
    ['# LỊCH SỬ VÁN ĐẤU'],
    ['Ngày đấu', 'Đối thủ', 'Cầm quân', 'Thể loại', 'Kết quả'],
    ...games.map((g) => [
      g.playedAt,
      g.opponent,
      g.color === 'white' ? 'Trắng' : 'Đen',
      g.speed,
      g.result,
    ]),
    [],
    ['# THÀNH TÍCH GIẢI ĐẤU'],
    ['Tên giải', 'Thời gian bắt đầu', 'Thứ hạng', 'Điểm', 'Hệ số phụ', 'Tổng số kỳ thủ'],
    ...tournaments.map((t) => [
      t.title,
      t.startsAt,
      t.rank != null ? String(t.rank) : '-',
      String(t.points),
      String(t.tiebreak),
      String(t.totalPlayers),
    ]),
  ];

  return UTF8_BOM + toCsv(rows);
}

/** Xuất danh sách tổng quan tất cả học viên ra định dạng CSV kèm UTF-8 BOM cho Excel */
export function academyStudentsReportToCsv(students: AcademyStudentSummary[]): string {
  const headers = [
    'Mã học viên',
    'Họ và tên',
    'Tên đăng nhập',
    'Cấp độ',
    'Bài tập hoàn thành',
    'Tổng bài tập',
    'Tỉ lệ bài tập (%)',
    'Quiz hoàn thành',
    'Điểm TB Quiz',
    'Buổi có mặt',
    'Tổng buổi học',
    'Chuyên cần (%)',
    'Tổng ván cờ',
    'Thắng/Hoà/Thua',
    'Rating Blitz',
    'Rating Rapid',
    'Rating Classical',
  ];

  const rows: string[][] = [
    headers,
    ...students.map((s) => [
      s.studentId,
      s.displayName,
      s.username,
      s.levelName ?? '',
      String(s.assignmentsCompleted),
      String(s.assignmentsTotal),
      s.assignmentsTotal > 0
        ? ((s.assignmentsCompleted / s.assignmentsTotal) * 100).toFixed(1)
        : '0.0',
      String(s.quizCompleted),
      s.quizAvgScore.toFixed(1),
      String(s.sessionsPresent),
      String(s.sessionsTotal),
      s.attendanceRate.toFixed(1),
      String(s.gamesTotal),
      s.gamesWdl,
      String(s.blitzRating),
      String(s.rapidRating),
      String(s.classicalRating),
    ]),
  ];

  return UTF8_BOM + toCsv(rows);
}
