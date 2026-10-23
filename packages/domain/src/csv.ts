/** Nhập/xuất danh sách học viên dạng CSV (RFC 4180, dấu phẩy hoặc chấm phẩy). */
import { displayNameSchema, pinSchema, usernameSchema } from './index';

/** Tách CSV thành các hàng; hỗ trợ trường trong ngoặc kép, "" là dấu ngoặc kép, xuống dòng CRLF/LF. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const sep = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === sep) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

function csvField(value: string): string {
  return /[",;\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return `${rows.map((r) => r.map(csvField).join(',')).join('\r\n')}\r\n`;
}

export type StudentCsvRow = { displayName: string; username: string; pin: string; group?: string };
export type StudentCsvIssue = { line: number; field: string };
export type StudentCsvResult = { rows: StudentCsvRow[]; issues: StudentCsvIssue[] };

const HEADER_ALIASES: Record<string, keyof StudentCsvRow> = {
  display_name: 'displayName',
  name: 'displayName',
  'họ tên': 'displayName',
  'ho ten': 'displayName',
  username: 'username',
  'tên đăng nhập': 'username',
  pin: 'pin',
  group: 'group',
  lớp: 'group',
  lop: 'group',
};

/**
 * Đọc danh sách học viên mới. Dòng đầu là tiêu đề cột; bắt buộc có tên, username, PIN; lớp tuỳ chọn.
 * Dòng lỗi được báo trong `issues` (số dòng tính từ 1, gồm cả dòng tiêu đề) và bị bỏ qua.
 */
export function parseStudentsCsv(text: string): StudentCsvResult {
  const [header, ...body] = parseCsv(text);
  if (!header) return { rows: [], issues: [{ line: 1, field: 'header' }] };
  const columns = header.map((h) => HEADER_ALIASES[h.trim().toLowerCase()]);
  for (const required of ['displayName', 'username', 'pin'] as const) {
    if (!columns.includes(required)) return { rows: [], issues: [{ line: 1, field: required }] };
  }

  const rows: StudentCsvRow[] = [];
  const issues: StudentCsvIssue[] = [];
  const seen = new Set<string>();
  for (const [index, cells] of body.entries()) {
    const line = index + 2;
    const raw: Partial<Record<keyof StudentCsvRow, string>> = {};
    columns.forEach((key, i) => {
      if (key) raw[key] = (cells[i] ?? '').trim();
    });
    const displayName = displayNameSchema.safeParse(raw.displayName ?? '');
    const username = usernameSchema.safeParse(raw.username ?? '');
    const pin = pinSchema.safeParse(raw.pin ?? '');
    if (!displayName.success) issues.push({ line, field: 'displayName' });
    else if (!username.success) issues.push({ line, field: 'username' });
    else if (!pin.success) issues.push({ line, field: 'pin' });
    else if (seen.has(username.data)) issues.push({ line, field: 'duplicate' });
    else {
      seen.add(username.data);
      rows.push({
        displayName: displayName.data,
        username: username.data,
        pin: pin.data,
        ...(raw.group ? { group: raw.group } : {}),
      });
    }
  }
  return { rows, issues };
}

export type StudentExportRow = {
  displayName: string;
  username: string | null;
  level?: string;
  groups: readonly string[];
  rating?: number;
};

/** Xuất danh sách học viên (không bao giờ kèm PIN). */
export function studentsToCsv(students: readonly StudentExportRow[]): string {
  return toCsv([
    ['display_name', 'username', 'level', 'groups', 'rating'],
    ...students.map((s) => [
      s.displayName,
      s.username ?? '',
      s.level ?? '',
      s.groups.join(' | '),
      s.rating === undefined ? '' : String(Math.round(s.rating)),
    ]),
  ]);
}
