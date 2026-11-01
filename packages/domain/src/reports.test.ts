import { describe, expect, it } from 'vitest';
import {
  type AcademyStudentSummary,
  academyStudentsReportToCsv,
  type StudentDetailedReport,
  studentDetailedReportToCsv,
  withRealRatings,
} from './reports';

describe('studentDetailedReportToCsv', () => {
  it('tạo chuỗi CSV có UTF-8 BOM và đầy đủ các phần thông tin', () => {
    const report: StudentDetailedReport = {
      student: {
        id: '11111111-1111-1111-1111-111111111111',
        displayName: 'Nguyễn Văn An',
        username: 'nguyenvanan',
        email: 'an@example.com',
      },
      summary: {
        studentId: '11111111-1111-1111-1111-111111111111',
        displayName: 'Nguyễn Văn An',
        username: 'nguyenvanan',
        assignments: {
          totalAssigned: 10,
          completed: 8,
          solvedRate: 80,
          avgTries: 1.5,
          avgTimeMs: 45000,
        },
        quizzes: {
          totalAssigned: 5,
          completed: 4,
          avgScore: 85,
          avgTimeMs: 120000,
        },
        classrooms: {
          totalSessions: 12,
          presentCount: 10,
          lateCount: 1,
          absentCount: 1,
          attendanceRate: 83.3,
        },
        games: {
          totalGames: 20,
          wins: 12,
          draws: 3,
          losses: 5,
          ratings: { blitz: 1450, rapid: 1520 },
        },
        tournaments: {
          totalJoined: 2,
          totalGames: 10,
          totalPoints: 7.5,
          bestRank: 3,
        },
      },
      assignments: [
        {
          id: 'a1',
          title: 'Chiếu hết 1 nước - Hậu',
          assignedAt: '2026-10-01T08:00:00Z',
          dueDate: '2026-10-07T23:59:59Z',
          solved: true,
          tries: 1,
          timeMs: 30000,
        },
      ],
      quizzes: [
        {
          id: 'q1',
          title: 'Quiz luật cờ cơ bản',
          submittedAt: '2026-10-02T10:00:00Z',
          score: 90,
          maxScore: 100,
          solved: true,
          timeMs: 90000,
        },
      ],
      classrooms: [
        {
          id: 'c1',
          title: 'Chiến thuật Tốt thông',
          startsAt: '2026-10-03T18:00:00Z',
          status: 'present',
          note: 'Tích cực phát biểu',
        },
      ],
      games: [
        {
          id: 'g1',
          playedAt: '2026-10-04T19:00:00Z',
          opponent: 'Trần Văn Bình',
          color: 'white',
          result: '1-0',
          speed: 'blitz',
          won: true,
        },
      ],
      tournaments: [
        {
          id: 't1',
          title: 'Giải Mùa Thu 2026',
          startsAt: '2026-10-05T09:00:00Z',
          rank: 3,
          points: 4.5,
          tiebreak: 15.5,
          totalPlayers: 16,
        },
      ],
    };

    const csv = studentDetailedReportToCsv(report);
    // Bắt đầu bằng UTF-8 BOM
    expect(csv.startsWith('\uFEFF')).toBe(true);
    // Chứa thông tin học viên
    expect(csv).toContain('Nguyễn Văn An');
    expect(csv).toContain('nguyenvanan');
    // Chứa các tiêu đề mục
    expect(csv).toContain('# TỔNG QUAN');
    expect(csv).toContain('# CHI TIẾT BÀI TẬP');
    expect(csv).toContain('Chiếu hết 1 nước - Hậu');
    expect(csv).toContain('# CHI TIẾT QUIZ');
    expect(csv).toContain('Quiz luật cờ cơ bản');
    expect(csv).toContain('# CHUYÊN CẦN LỚP HỌC');
    expect(csv).toContain('Chiến thuật Tốt thông');
    expect(csv).toContain('Có mặt');
    expect(csv).toContain('# LỊCH SỬ VÁN ĐẤU');
    expect(csv).toContain('Trần Văn Bình');
    expect(csv).toContain('# THÀNH TÍCH GIẢI ĐẤU');
    expect(csv).toContain('Giải Mùa Thu 2026');
  });
});

describe('academyStudentsReportToCsv', () => {
  it('tạo chuỗi CSV bảng danh sách học viên', () => {
    const list: AcademyStudentSummary[] = [
      {
        studentId: 'uuid-1',
        displayName: 'Nguyễn Văn An',
        username: 'nguyenvanan',
        levelName: 'Nhập môn',
        assignmentsCompleted: 8,
        assignmentsTotal: 10,
        quizAvgScore: 85,
        quizCompleted: 4,
        attendanceRate: 83.3,
        sessionsPresent: 10,
        sessionsTotal: 12,
        gamesTotal: 20,
        gamesWdl: '12/3/5',
        blitzRating: 1450,
        rapidRating: 1520,
        classicalRating: 1500,
      },
    ];

    const csv = academyStudentsReportToCsv(list);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Mã học viên,Họ và tên,Tên đăng nhập');
    expect(csv).toContain('Nguyễn Văn An');
    expect(csv).toContain('80.0'); // solved rate
    expect(csv).toContain('12/3/5');
    expect(csv).toContain('1450');
  });
});

describe('withRealRatings (Elo nội bộ: chưa có thì null, không phải 1200)', () => {
  const base = {
    displayName: 'An',
    username: 'an',
    assignmentsCompleted: 0,
    assignmentsTotal: 0,
    quizAvgScore: 0,
    quizCompleted: 0,
    attendanceRate: 0,
    sessionsPresent: 0,
    sessionsTotal: 0,
    gamesTotal: 0,
    gamesWdl: '0/0/0',
    blitzRating: 1200,
    rapidRating: 1200,
    classicalRating: 1200,
  };

  it('lấy số từ bảng ratings (làm tròn); học viên chưa có dòng nào thì null', () => {
    const out = withRealRatings(
      [
        { ...base, studentId: 's1' },
        { ...base, studentId: 's2' },
      ],
      [
        { student_id: 's1', category: 'rapid', rating: 1234.6 },
        { student_id: 's1', category: 'blitz', rating: 1200 },
        { student_id: 'khac', category: 'classical', rating: 1800 },
      ],
    );
    expect(out[0]).toMatchObject({ blitzRating: 1200, rapidRating: 1235, classicalRating: null });
    expect(out[1]).toMatchObject({ blitzRating: null, rapidRating: null, classicalRating: null });
  });

  it('CSV toàn học viện để trống ô rating khi chưa có', () => {
    const [s] = withRealRatings(
      [{ ...base, studentId: 's1' }],
      [{ student_id: 's1', category: 'rapid', rating: 1500 }],
    );
    const lines = academyStudentsReportToCsv([s as AcademyStudentSummary])
      .trim()
      .split(/\r?\n/);
    expect(lines[0]).toContain('Rating Blitz,Rating Rapid,Rating Classical');
    expect(lines[1]?.endsWith(',0/0/0,,1500,')).toBe(true);
  });
});
