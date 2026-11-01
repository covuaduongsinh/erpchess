/** Công cụ thuần cho trang danh sách: lọc khoảng ngày, phân trang. */

/**
 * Ngày (ISO) có nằm trong khoảng `from`–`to` (chuỗi `YYYY-MM-DD`, rỗng là không giới hạn đầu đó)
 * không. Cả hai đầu đều tính, theo giờ máy. Mục không có ngày chỉ qua khi không đặt khoảng nào.
 */
export function inDateRange(iso: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!iso) return false;
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return false;
  if (from) {
    const [y, m, d] = from.split('-').map(Number);
    if (at < new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getTime()) return false;
  }
  if (to) {
    const [y, m, d] = to.split('-').map(Number);
    // Đến hết ngày `to`: trước 0 giờ của ngày kế tiếp
    if (at >= new Date(y ?? 0, (m ?? 1) - 1, (d ?? 1) + 1).getTime()) return false;
  }
  return true;
}

/** Cắt một trang (`page` từ 1); trang vượt quá thì kẹp về trang cuối. */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const size = Math.max(1, pageSize);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return items.slice((current - 1) * size, current * size);
}
