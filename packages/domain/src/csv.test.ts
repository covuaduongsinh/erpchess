import { describe, expect, it } from 'vitest';
import { parseCsv, parseStudentsCsv, studentsToCsv } from './csv';

describe('parseCsv', () => {
  it('ngoặc kép, dấu phẩy trong trường, CRLF, BOM', () => {
    expect(parseCsv('﻿a,"b, c","d ""e"""\r\n1,2,3\r\n')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['1', '2', '3'],
    ]);
  });

  it('tự nhận dấu chấm phẩy (Excel tiếng Việt)', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('bỏ dòng trống', () => {
    expect(parseCsv('a\n\n1\n')).toEqual([['a'], ['1']]);
  });
});

describe('parseStudentsCsv', () => {
  it('đọc dòng hợp lệ, báo dòng lỗi và username trùng', () => {
    const { rows, issues } = parseStudentsCsv(
      [
        'Họ tên,Username,PIN,Lớp',
        'Nguyễn An,an.nguyen,123456,Lớp A1',
        'Trần Bình,Binh_Tran,654321,',
        'Lê Cường,lc,123456,',
        'Phạm Dung,dung.pham,12ab,',
        'An khác,an.nguyen,111111,',
      ].join('\n'),
    );
    expect(rows).toEqual([
      { displayName: 'Nguyễn An', username: 'an.nguyen', pin: '123456', group: 'Lớp A1' },
      { displayName: 'Trần Bình', username: 'binh_tran', pin: '654321' },
    ]);
    expect(issues).toEqual([
      { line: 4, field: 'username' },
      { line: 5, field: 'pin' },
      { line: 6, field: 'duplicate' },
    ]);
  });

  it('thiếu cột bắt buộc', () => {
    expect(parseStudentsCsv('name,username\nA,abc').issues).toEqual([{ line: 1, field: 'pin' }]);
  });
});

describe('studentsToCsv', () => {
  it('xuất đủ cột, không có PIN, đọc lại được', () => {
    const csv = studentsToCsv([
      {
        displayName: 'Nguyễn, An',
        username: 'an',
        level: 'Cơ bản',
        groups: ['A1', 'B2'],
        rating: 812.4,
      },
    ]);
    expect(parseCsv(csv)).toEqual([
      ['display_name', 'username', 'level', 'groups', 'rating'],
      ['Nguyễn, An', 'an', 'Cơ bản', 'A1 | B2', '812'],
    ]);
  });
});
