import { describe, expect, it } from 'vitest';
import { formatSan, formatSanList } from './notation';

describe('formatSan', () => {
  it('giữ nguyên khi notation là letters', () => {
    expect(formatSan('Nf3', 'letters')).toBe('Nf3');
    expect(formatSan('e4', 'letters')).toBe('e4');
    expect(formatSan('Bxc6+', 'letters')).toBe('Bxc6+');
    expect(formatSan('e8=Q#', 'letters')).toBe('e8=Q#');
    expect(formatSan('O-O', 'letters')).toBe('O-O');
    expect(formatSan('O-O-O', 'letters')).toBe('O-O-O');
  });

  it('chuyển đúng sang figurine', () => {
    expect(formatSan('Nf3', 'figurine')).toBe('♘f3');
    expect(formatSan('Qh5#', 'figurine')).toBe('♕h5#');
    expect(formatSan('Bxc6+', 'figurine')).toBe('♗xc6+');
    expect(formatSan('Rad1', 'figurine')).toBe('♖ad1');
    expect(formatSan('Kh1', 'figurine')).toBe('♔h1');
  });

  it('không đổi nước tốt không phong cấp', () => {
    expect(formatSan('e4', 'figurine')).toBe('e4');
    expect(formatSan('d5', 'figurine')).toBe('d5');
    expect(formatSan('exd5', 'figurine')).toBe('exd5');
  });

  it('chuyển đúng phong cấp sang figurine', () => {
    expect(formatSan('e8=Q', 'figurine')).toBe('e8=♕');
    expect(formatSan('a8=N#', 'figurine')).toBe('a8=♘#');
    expect(formatSan('cxd8=R+', 'figurine')).toBe('cxd8=♖+');
    expect(formatSan('b8=B', 'figurine')).toBe('b8=♗');
  });

  it('giữ nguyên nhập thành', () => {
    expect(formatSan('O-O', 'figurine')).toBe('O-O');
    expect(formatSan('O-O-O', 'figurine')).toBe('O-O-O');
  });

  it('formatSanList chuyển mảng nước đi', () => {
    const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6', 'dxc6', 'O-O'];
    expect(formatSanList(moves, 'figurine')).toEqual([
      'e4',
      'e5',
      '♘f3',
      '♘c6',
      '♗b5',
      'a6',
      '♗xc6',
      'dxc6',
      'O-O',
    ]);
  });
});
