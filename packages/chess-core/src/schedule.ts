/** Lịch lặp lại của giải đấu (dùng chung client và Edge Function `tournament-tick`). */

/**
 * Lần tổ chức kế tiếp của giải lặp lại (giữ giờ trong ngày theo giờ địa phương của máy chạy);
 * `null` khi không lặp hoặc đã qua `until`.
 */
export function nextOccurrence(
  startsAt: Date,
  repeat: 'none' | 'daily' | 'weekly' | 'monthly',
  until: Date | null,
): Date | null {
  if (repeat === 'none') return null;
  const next = new Date(startsAt);
  if (repeat === 'daily') next.setDate(next.getDate() + 1);
  else if (repeat === 'weekly') next.setDate(next.getDate() + 7);
  else {
    const day = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    // Tháng ngắn hơn (31 → 30/28) thì lấy ngày cuối tháng
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, last));
  }
  return until && next > until ? null : next;
}
