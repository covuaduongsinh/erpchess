/**
 * Mã QR chuyển khoản VietQR (chuẩn EMVCo do NAPAS áp dụng). Sinh chuỗi payload để mọi app
 * ngân hàng tại Việt Nam quét được, không cần gọi dịch vụ ngoài.
 */

/** BIN NAPAS của một số ngân hàng phổ biến. */
export const VN_BANKS = [
  { bin: '970436', code: 'VCB', name: 'Vietcombank' },
  { bin: '970415', code: 'ICB', name: 'VietinBank' },
  { bin: '970418', code: 'BIDV', name: 'BIDV' },
  { bin: '970405', code: 'VBA', name: 'Agribank' },
  { bin: '970407', code: 'TCB', name: 'Techcombank' },
  { bin: '970422', code: 'MB', name: 'MB Bank' },
  { bin: '970416', code: 'ACB', name: 'ACB' },
  { bin: '970432', code: 'VPB', name: 'VPBank' },
  { bin: '970423', code: 'TPB', name: 'TPBank' },
  { bin: '970403', code: 'STB', name: 'Sacombank' },
  { bin: '970441', code: 'VIB', name: 'VIB' },
  { bin: '970443', code: 'SHB', name: 'SHB' },
  { bin: '970437', code: 'HDB', name: 'HDBank' },
  { bin: '970448', code: 'OCB', name: 'OCB' },
  { bin: '970426', code: 'MSB', name: 'MSB' },
  { bin: '970440', code: 'SEAB', name: 'SeABank' },
  { bin: '970431', code: 'EIB', name: 'Eximbank' },
  { bin: '970449', code: 'LPB', name: 'LPBank' },
] as const;

export function bankName(bin: string | null | undefined): string {
  return VN_BANKS.find((b) => b.bin === bin)?.name ?? bin ?? '';
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), chữ hoa 4 ký tự hex. */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/** Nội dung chuyển khoản: chỉ chữ, số, khoảng trắng ASCII, tối đa 25 ký tự. */
export function sanitizeMemo(memo: string): string {
  return memo
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 25);
}

export type VietQrInput = {
  bin: string;
  account: string;
  /** Số tiền VND; bỏ trống để người chuyển tự nhập. */
  amount?: number | null;
  memo?: string;
};

export function vietQrPayload(input: VietQrInput): string {
  if (!/^\d{6}$/.test(input.bin)) throw new Error('bin');
  if (!/^[0-9A-Za-z]{1,19}$/.test(input.account)) throw new Error('account');
  const beneficiary = tlv('00', input.bin) + tlv('01', input.account);
  const merchant = tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA');
  const amount = input.amount && input.amount > 0 ? Math.round(input.amount) : null;
  const memo = input.memo ? sanitizeMemo(input.memo) : '';
  let s =
    tlv('00', '01') +
    tlv('01', amount ? '12' : '11') +
    tlv('38', merchant) +
    tlv('53', '704') +
    (amount ? tlv('54', String(amount)) : '') +
    tlv('58', 'VN') +
    (memo ? tlv('62', tlv('08', memo)) : '');
  s += '6304';
  return s + crc16(s);
}
