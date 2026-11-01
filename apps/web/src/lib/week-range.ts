import { toDateInput } from './quick-range';

export type DayRange = { from: string; to: string };

/** Biểu đồ vẽ tối đa ngần này ngày một lần (RPC cho phép tới 93 ngày, nhưng cột sẽ quá mảnh). */
export const MAX_RANGE_DAYS = 31;

/** `YYYY-MM-DD` thành Date theo giờ máy (0 giờ). */
export function parseDay(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function addDays(value: string, n: number): string {
  const d = parseDay(value);
  d.setDate(d.getDate() + n);
  return toDateInput(d);
}

/** Số ngày của khoảng, tính cả hai đầu. */
export function rangeLength(range: DayRange): number {
  return (
    Math.round((parseDay(range.to).getTime() - parseDay(range.from).getTime()) / 86_400_000) + 1
  );
}

/** Tuần (thứ Hai đến Chủ nhật) chứa `now`. */
export function weekRange(now = new Date()): DayRange {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const from = toDateInput(monday);
  return { from, to: addDays(from, 6) };
}

/** Dời cả khoảng tới/lui đúng bằng độ dài của nó (tuần trước/tuần sau khi khoảng là một tuần). */
export function shiftRange(range: DayRange, direction: 1 | -1): DayRange {
  const n = rangeLength(range) * direction;
  return { from: addDays(range.from, n), to: addDays(range.to, n) };
}

/** Khoảng liền trước, cùng độ dài, để so xu hướng. */
export function previousRange(range: DayRange): DayRange {
  return shiftRange(range, -1);
}

/** Khoảng hợp lệ để truy vấn: đúng thứ tự và không quá `MAX_RANGE_DAYS` ngày. */
export function isValidRange(range: DayRange): boolean {
  if (!range.from || !range.to) return false;
  const n = rangeLength(range);
  return n >= 1 && n <= MAX_RANGE_DAYS;
}

/** Danh sách ngày của khoảng, theo thứ tự. */
export function daysOf(range: DayRange): string[] {
  return Array.from({ length: rangeLength(range) }, (_, i) => addDays(range.from, i));
}

/** % thay đổi so với kỳ trước; `null` khi kỳ trước bằng 0 (không có gì để so, tránh hiện số vô nghĩa). */
export function trendPercent(current: number, previous: number): number | null {
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
}
