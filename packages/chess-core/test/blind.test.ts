import { describe, expect, it } from 'vitest';
import { hiddenSquares } from '../src/blind';
import { START_FEN } from '../src/rules';

describe('hiddenSquares (cờ mù / ẩn quân)', () => {
  it('none: không ẩn gì; all: ẩn mọi quân', () => {
    expect(hiddenSquares(START_FEN, 'none')).toEqual([]);
    expect(hiddenSquares(START_FEN, 'all')).toHaveLength(32);
  });

  it('ẩn quân một bên', () => {
    const white = hiddenSquares(START_FEN, 'white');
    expect(white).toHaveLength(16);
    expect(white).toContain('e1');
    expect(white).not.toContain('e8');
  });

  it('pieces: chỉ hiện tốt (luyện cấu trúc tốt)', () => {
    const hidden = hiddenSquares(START_FEN, 'pieces');
    expect(hidden).toHaveLength(16);
    expect(hidden).toContain('d1');
    expect(hidden).not.toContain('e2');
  });
});
