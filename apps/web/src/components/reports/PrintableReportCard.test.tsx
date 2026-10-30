import type { StudentDetailedReport } from '@erpchess/domain';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrintableReportCard, reportFileTitle } from './PrintableReportCard';

vi.mock('../../lib/use-t', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'vi' } }),
}));

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

const ACADEMY = {
  name: 'Học Viện Cờ Vua Kiên Cường',
  logoUrl: 'https://cdn.vn/logo.png',
  address: '12 Lê Lợi',
  phone: '0912 345 678',
};

describe('PrintableReportCard', () => {
  it('renders academy branding, student info and real stats', () => {
    const { container } = render(
      <PrintableReportCard
        report={MOCK_REPORT}
        academy={ACADEMY}
        levelName="Trung Cấp"
        batchName="Lớp U12 Nâng Cao"
        periodLabel="Tháng này"
        signerName="HLV Minh"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Học Viện Cờ Vua Kiên Cường')).toBeTruthy();
    expect(screen.getByText('12 Lê Lợi · 0912 345 678')).toBeTruthy();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.vn/logo.png');
    expect(screen.getAllByText('Nguyễn Văn An').length).toBeGreaterThan(0);
    expect(screen.getByText('@an_nguyen')).toBeTruthy();
    expect(screen.getByText('Trung Cấp')).toBeTruthy();
    expect(screen.getByText('Lớp U12 Nâng Cao')).toBeTruthy();
    expect(screen.getByText('36/40')).toBeTruthy();
    expect(screen.getByText('1510')).toBeTruthy();
    expect(screen.getByText('HLV Minh')).toBeTruthy();
    // Không còn số liệu "năng lực" bịa sẵn
    expect(screen.queryByText('75%')).toBeNull();
    expect(container.querySelector('.report-print')).toBeTruthy();
  });

  it('lists recent activity rows and shows an empty state', () => {
    render(
      <PrintableReportCard
        report={{
          ...MOCK_REPORT,
          quizzes: [
            {
              id: 'q1',
              title: 'Quiz chiếu hết',
              submittedAt: '2026-10-01T00:00:00Z',
              score: 8,
              maxScore: 10,
              solved: true,
              timeMs: 1000,
            },
          ],
          classrooms: [
            {
              id: 'c1',
              title: 'Buổi 1',
              startsAt: '2026-10-02T10:00:00Z',
              status: 'late',
              note: '',
            },
          ],
        }}
        academy={ACADEMY}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Quiz chiếu hết')).toBeTruthy();
    expect(screen.getByText('8/10')).toBeTruthy();
    expect(screen.getByText('reports.printStatus_late')).toBeTruthy();
    // Bài tập và ván đấu rỗng
    expect(screen.getAllByText('reports.printNoData').length).toBe(2);
  });

  it('prints with a file-friendly title and restores it afterwards', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {
      expect(document.title).toBe(reportFileTitle('an_nguyen'));
    });
    document.title = 'ERPChess';
    render(<PrintableReportCard report={MOCK_REPORT} academy={ACADEMY} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'reports.printPdf' }));
    expect(printSpy).toHaveBeenCalled();
    window.dispatchEvent(new Event('afterprint'));
    expect(document.title).toBe('ERPChess');
    printSpy.mockRestore();
  });

  it('triggers onClose when Close button is clicked', () => {
    const handleClose = vi.fn();
    render(<PrintableReportCard report={MOCK_REPORT} academy={ACADEMY} onClose={handleClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'reports.printClose' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('reportFileTitle uses the username and ISO date', () => {
    expect(reportFileTitle('an_nguyen', new Date('2026-10-31T08:00:00Z'))).toBe(
      'phieu-bao-cao-an_nguyen-2026-10-31',
    );
  });
});
