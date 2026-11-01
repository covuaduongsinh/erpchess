import type { MemberFide } from '@erpchess/domain';

/** "ID 12345678 · Standard 1800 · Rapid 1750 · Blitz 1700" — chỉ các phần có dữ liệu; rỗng nếu chưa có gì. */
export function fideParts(
  fide: MemberFide | null | undefined,
  labels: { id: string; standard: string; rapid: string; blitz: string },
): string {
  if (!fide) return '';
  return [
    fide.id ? `${labels.id} ${fide.id}` : '',
    fide.standard !== null ? `${labels.standard} ${fide.standard}` : '',
    fide.rapid !== null ? `${labels.rapid} ${fide.rapid}` : '',
    fide.blitz !== null ? `${labels.blitz} ${fide.blitz}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
