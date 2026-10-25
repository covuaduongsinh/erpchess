/**
 * Tiền tệ (Giai đoạn 12a). Số tiền luôn là số nguyên theo đơn vị nhỏ nhất của tiền tệ
 * (VND: đồng, USD: cent), khớp cột `bigint` trong migration `…0021_billing.sql`.
 */
export const currencies = ['VND', 'USD', 'EUR', 'SGD', 'AUD', 'GBP', 'JPY', 'KRW'] as const;
export type Currency = (typeof currencies)[number];

const ZERO_DECIMAL = new Set<string>(['VND', 'JPY', 'KRW']);

export function currencyDecimals(currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
}

/** Hiển thị số tiền (đơn vị nhỏ nhất) theo ngôn ngữ, ví dụ `1.500.000 ₫`, `$12.50`. */
export function formatMoney(amount: number, currency: string, locale = 'vi'): string {
  const d = currencyDecimals(currency);
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(amount / 10 ** d);
}

/**
 * Đọc số tiền người dùng gõ (chấp nhận `1.500.000`, `1,500,000`, `12.5`, `12,50`) thành đơn vị
 * nhỏ nhất. Trả `null` nếu không hợp lệ hoặc âm.
 */
export function parseMoney(input: string, currency: string): number | null {
  const d = currencyDecimals(currency);
  let s = input.trim().replace(/\s|₫|\$|€|£|¥/g, '');
  if (!/^\d[\d.,]*$/.test(s)) return null;
  if (d === 0) {
    s = s.replace(/[.,]/g, '');
  } else {
    // Dấu tách cuối cùng có 1–2 chữ số phía sau là dấu thập phân
    const m = s.match(/^(.*)[.,](\d{1,2})$/);
    s = m ? `${(m[1] ?? '').replace(/[.,]/g, '')}.${m[2]}` : s.replace(/[.,]/g, '');
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 10 ** d);
}

/** Giá trị cho ô nhập (không ký hiệu tiền, không dấu nhóm): 1500000 VND → `1500000`, 1250 USD → `12.50`. */
export function moneyInputValue(amount: number, currency: string): string {
  const d = currencyDecimals(currency);
  return d === 0 ? String(amount) : (amount / 10 ** d).toFixed(d);
}
