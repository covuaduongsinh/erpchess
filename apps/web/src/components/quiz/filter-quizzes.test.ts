import type { QuizSummary } from '@erpchess/api';
import type { QuizStatus } from '@erpchess/domain';
import { describe, expect, it } from 'vitest';
import { filterQuizzes, type Row } from './filter-quizzes';

function row(title: string, status: QuizStatus, created: string, due: string | null = null): Row {
  return {
    status,
    q: { id: title, title, created_at: created, due_at: due } as unknown as QuizSummary,
  };
}

const rows = [
  row('Chiến thuật 1', 'open', '2026-05-10T08:00:00', '2026-05-20T08:00:00'),
  row('Tàn cuộc', 'closed', '2026-04-01T08:00:00', '2026-04-10T08:00:00'),
  row('Khai cuộc', 'upcoming', '2026-05-25T08:00:00'),
];
const none = { from: '', to: '' };
const titles = (r: Row[]) => r.map((x) => x.q.title);

describe('filterQuizzes', () => {
  it('không lọc: giữ đủ và sắp mới nhất trước', () => {
    expect(
      titles(filterQuizzes(rows, { search: '', filter: 'all', range: none, sort: 'newest' })),
    ).toEqual(['Khai cuộc', 'Chiến thuật 1', 'Tàn cuộc']);
  });

  it('lọc theo trạng thái và theo từ khoá (không phân biệt hoa thường)', () => {
    expect(
      titles(filterQuizzes(rows, { search: '', filter: 'open', range: none, sort: 'title' })),
    ).toEqual(['Chiến thuật 1']);
    expect(
      titles(filterQuizzes(rows, { search: ' CUỘC ', filter: 'all', range: none, sort: 'title' })),
    ).toEqual(['Khai cuộc', 'Tàn cuộc']);
  });

  it('lọc theo khoảng ngày tạo', () => {
    const range = { from: '2026-05-01', to: '2026-05-31' };
    expect(
      titles(filterQuizzes(rows, { search: '', filter: 'all', range, sort: 'title' })),
    ).toEqual(['Chiến thuật 1', 'Khai cuộc']);
  });

  it('sắp theo hạn: quiz không có hạn xuống cuối', () => {
    expect(
      titles(filterQuizzes(rows, { search: '', filter: 'all', range: none, sort: 'due' })),
    ).toEqual(['Tàn cuộc', 'Chiến thuật 1', 'Khai cuộc']);
  });

  it('không làm thay đổi mảng gốc', () => {
    const copy = [...rows];
    filterQuizzes(rows, { search: '', filter: 'all', range: none, sort: 'title' });
    expect(rows).toEqual(copy);
  });
});
