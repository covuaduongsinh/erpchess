import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useT } from '../../lib/use-t';
import { IconButton } from './IconButton';

/** Số trang (tối thiểu 1) của `total` mục với `pageSize` mục mỗi trang. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

/**
 * Phân trang: số dòng mỗi trang, ⏮ ‹ › ⏭ và ô "Đến trang". `page` tính từ 1.
 * Không có `onPageSizeChange` thì ẩn ô chọn số dòng.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}) {
  const { t } = useT();
  const pages = pageCount(total, pageSize);
  const current = Math.min(Math.max(1, page), pages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(total, current * pageSize);
  const [jump, setJump] = useState('');

  function submitJump(e: FormEvent) {
    e.preventDefault();
    const n = Number.parseInt(jump, 10);
    if (Number.isNaN(n)) return;
    onPageChange(Math.min(Math.max(1, n), pages));
    setJump('');
  }

  return (
    <nav
      aria-label={t('ui.pagination')}
      className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-muted"
    >
      {onPageSizeChange ? (
        <label className="flex items-center gap-2">
          {t('ui.rowsPerPage')}
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-md border border-border bg-surface px-2 py-1 text-text"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <span />
      )}
      <span>{t('ui.range', { from, to, total })}</span>
      <div className="flex items-center gap-1">
        <IconButton
          icon={ChevronsLeft}
          label={t('ui.firstPage')}
          disabled={current <= 1}
          onClick={() => onPageChange(1)}
        />
        <IconButton
          icon={ChevronLeft}
          label={t('ui.prevPage')}
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        />
        <IconButton
          icon={ChevronRight}
          label={t('ui.nextPage')}
          disabled={current >= pages}
          onClick={() => onPageChange(current + 1)}
        />
        <IconButton
          icon={ChevronsRight}
          label={t('ui.lastPage')}
          disabled={current >= pages}
          onClick={() => onPageChange(pages)}
        />
        <form onSubmit={submitJump} className="ml-2 flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={pages}
            aria-label={t('ui.goToPage')}
            placeholder={`${current}/${pages}`}
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-text"
          />
        </form>
      </div>
    </nav>
  );
}
