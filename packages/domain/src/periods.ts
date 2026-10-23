export const periods = ['week', 'month', 'sixMonths'] as const;
export type Period = (typeof periods)[number];

/**
 * Khoảng [from, to) theo giờ địa phương: tuần bắt đầu từ Thứ hai 00:00, tháng từ ngày 1,
 * "6 tháng" là 6 tháng lịch gần nhất kể cả tháng hiện tại. `to` là đầu ngày mai để tính hết hôm nay.
 */
export function periodRange(period: Period, now = new Date()): { from: Date; to: Date } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(today);
  to.setDate(to.getDate() + 1);
  const from = new Date(today);
  if (period === 'week') {
    from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
  } else if (period === 'month') {
    from.setDate(1);
  } else {
    from.setDate(1);
    from.setMonth(from.getMonth() - 5);
  }
  return { from, to };
}
