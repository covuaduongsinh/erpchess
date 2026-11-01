import { createI18n } from '@erpchess/i18n';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it } from 'vitest';
import { AllStudentsReportView } from './ReportViews';

afterEach(() => cleanup());

const base = {
  displayName: 'Nguyễn Văn An',
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
};

describe('AllStudentsReportView: Elo nội bộ', () => {
  it('chưa có rating thì hiện "Chưa có" (không phải 1200), có thì hiện số', () => {
    render(
      <I18nextProvider i18n={createI18n('vi')}>
        <AllStudentsReportView
          onSelectStudent={() => {}}
          students={[
            {
              ...base,
              studentId: 's1',
              blitzRating: null,
              rapidRating: 1234,
              classicalRating: null,
            },
          ]}
        />
      </I18nextProvider>,
    );
    const row = screen.getByText('Nguyễn Văn An').closest('tr') as HTMLElement;
    const cells = Array.from(row.querySelectorAll('td')).map((td) => td.textContent);
    // Blitz, Rapid, Classical là ba ô liền nhau trước cột thao tác
    expect(cells.slice(-4, -1)).toEqual(['Chưa có', '1234', 'Chưa có']);
    expect(screen.queryByText('1200')).toBeNull();
  });
});
