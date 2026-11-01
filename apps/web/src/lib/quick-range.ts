export type QuickPeriod = 'month' | 'quarter' | 'year';

export const quickPeriods: readonly QuickPeriod[] = ['month', 'quarter', 'year'];

/** Ngày theo giờ máy dạng `YYYY-MM-DD` (giá trị của `<input type="date">`). */
export function toDateInput(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Khoảng ngày của tháng, quý hoặc năm đang chứa `now`, cả hai đầu đều tính (đầu tháng đến cuối
 * tháng). Khác `periodRange` của domain (tuần/tháng/6 tháng gần nhất, tính tới hôm nay) vì ô
 * Từ ngày/Đến ngày là khoảng đóng theo lịch.
 */
export function quickRange(period: QuickPeriod, now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === 'year') {
    return { from: toDateInput(new Date(y, 0, 1)), to: toDateInput(new Date(y, 11, 31)) };
  }
  const first = period === 'quarter' ? m - (m % 3) : m;
  const span = period === 'quarter' ? 3 : 1;
  return {
    from: toDateInput(new Date(y, first, 1)),
    // Ngày 0 của tháng kế tiếp là ngày cuối của tháng cuối trong khoảng
    to: toDateInput(new Date(y, first + span, 0)),
  };
}
