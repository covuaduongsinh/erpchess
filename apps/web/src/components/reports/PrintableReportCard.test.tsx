import type { StudentDetailedReport } from '@erpchess/domain';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrintableReportCard } from './PrintableReportCard';

afterEach(cleanup);

const MOCK_REPORT: StudentDetailedReport = {
  student: {
    id: 'student-1',
    displayName: 'Nguyễn Văn An',
    username: 'an_nguyen',
    email: 'an@example.com',
  },
  summary: {
    studentId: 'student-1',
    displayName: 'Nguyễn Văn An',
    username: 'an_nguyen',
    assignments: {
      totalAssigned: 40,
      completed: 36,
      solvedRate: 90,
      avgTries: 1.2,
      avgTimeMs: 45000,
    },
    quizzes: {
      totalAssigned: 5,
      completed: 5,
      avgScore: 88,
      avgTimeMs: 120000,
    },
    classrooms: {
      totalSessions: 10,
      presentCount: 9,
      lateCount: 1,
      absentCount: 0,
      attendanceRate: 90,
    },
    games: {
      totalGames: 20,
      wins: 14,
      draws: 2,
      losses: 4,
      ratings: {
        bullet: 1350,
        blitz: 1420,
        rapid: 1510,
        classical: 1560,
      },
    },
    tournaments: {
      totalJoined: 2,
      totalGames: 6,
      bestRank: 3,
      totalPoints: 8.5,
    },
  },
  assignments: [],
  quizzes: [],
  classrooms: [],
  games: [],
  tournaments: [],
};

describe('PrintableReportCard', () => {
  it('renders student information and academic stats properly', () => {
    const handleClose = vi.fn();
    render(
      <PrintableReportCard
        report={MOCK_REPORT}
        academyName="Học Viện Cờ Vua Kiên Cường"
        levelName="Trung Cấp"
        batchName="Lớp U12 Nâng Cao"
        onClose={handleClose}
      />,
    );

    expect(screen.getByText('PHIẾU BÁO CÁO KẾT QUẢ HỌC TẬP')).toBeTruthy();
    expect(screen.getAllByText('Nguyễn Văn An').length).toBeGreaterThan(0);
    expect(screen.getByText('@an_nguyen')).toBeTruthy();
    expect(screen.getByText('Trung Cấp')).toBeTruthy();
    expect(screen.getByText('Lớp U12 Nâng Cao')).toBeTruthy();
    expect(screen.getByText('36/40')).toBeTruthy();
    expect(screen.getAllByText('90%').length).toBeGreaterThan(0);
  });

  it('triggers window.print when Print button is clicked', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const handleClose = vi.fn();

    render(
      <PrintableReportCard
        report={MOCK_REPORT}
        academyName="Học Viện Cờ Vua Kiên Cường"
        onClose={handleClose}
      />,
    );

    const printBtn = screen.getByRole('button', { name: /In \/ Xuất PDF/i });
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('triggers onClose when Close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <PrintableReportCard
        report={MOCK_REPORT}
        academyName="Học Viện Cờ Vua Kiên Cường"
        onClose={handleClose}
      />,
    );

    const closeBtn = screen.getByRole('button', { name: /Đóng/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
