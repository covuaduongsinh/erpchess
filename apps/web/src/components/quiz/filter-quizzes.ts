import type { QuizSummary } from '@erpchess/api';
import type { QuizStatus } from '@erpchess/domain';
import { inDateRange } from '../../lib/list-tools';

export const FILTERS = ['all', 'open', 'upcoming', 'closed'] as const;
export type Filter = (typeof FILTERS)[number];
export type Sort = 'newest' | 'due' | 'title';
export type DateRangeValue = { from: string; to: string };

export type Row = { q: QuizSummary; status: QuizStatus };

/** Lọc, sắp xếp quiz theo ô tìm, trạng thái, khoảng ngày tạo; hàm thuần để dễ kiểm thử. */
export function filterQuizzes(
  rows: Row[],
  opts: { search: string; filter: Filter; range: DateRangeValue; sort: Sort },
): Row[] {
  const needle = opts.search.trim().toLowerCase();
  const out = rows.filter(
    ({ q, status }) =>
      (opts.filter === 'all' || status === opts.filter) &&
      (!needle || q.title.toLowerCase().includes(needle)) &&
      inDateRange(q.created_at, opts.range.from, opts.range.to),
  );
  return out.sort((a, b) => {
    if (opts.sort === 'title') return a.q.title.localeCompare(b.q.title);
    if (opts.sort === 'due') {
      // Quiz không có hạn xuống cuối
      const da = a.q.due_at ?? '9999';
      const db = b.q.due_at ?? '9999';
      return da.localeCompare(db);
    }
    return b.q.created_at.localeCompare(a.q.created_at);
  });
}
