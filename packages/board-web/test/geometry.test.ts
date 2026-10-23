import { describe, expect, it } from 'vitest';
import {
  moveFocus,
  parseBoard,
  pointToSquare,
  SQUARES,
  squareColor,
  squareToGrid,
} from '../src/geometry';

describe('hình học bàn cờ', () => {
  it('64 ô, a8 ở góc trên trái khi nhìn từ phía Trắng', () => {
    expect(SQUARES).toHaveLength(64);
    expect(squareToGrid('a8', 'w')).toEqual({ col: 0, row: 0 });
    expect(squareToGrid('h1', 'w')).toEqual({ col: 7, row: 7 });
    expect(squareToGrid('a8', 'b')).toEqual({ col: 7, row: 7 });
    expect(squareToGrid('e2', 'b')).toEqual({ col: 3, row: 1 });
  });

  it('toạ độ điểm → ô, cả khi lật bàn; ngoài bàn thì null', () => {
    expect(pointToSquare(5, 5, 800, 'w')).toBe('a8');
    expect(pointToSquare(795, 795, 800, 'w')).toBe('h1');
    expect(pointToSquare(5, 5, 800, 'b')).toBe('h1');
    expect(pointToSquare(450, 650, 800, 'w')).toBe('e2');
    expect(pointToSquare(-1, 5, 800, 'w')).toBeNull();
    expect(pointToSquare(5, 800, 800, 'w')).toBeNull();
  });

  it('màu ô: a1 tối, h1 sáng', () => {
    expect(squareColor('a1')).toBe('dark');
    expect(squareColor('h1')).toBe('light');
    expect(squareColor('e4')).toBe('light');
  });

  it('đọc vị trí quân từ FEN', () => {
    const pieces = parseBoard('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    expect(pieces.size).toBe(32);
    expect(pieces.get('e4')).toBe('wP');
    expect(pieces.get('e2')).toBeUndefined();
    expect(pieces.get('d8')).toBe('bQ');
  });

  it('di chuyển ô đang chọn bằng phím mũi tên theo hướng nhìn', () => {
    expect(moveFocus('e4', 'ArrowUp', 'w')).toBe('e5');
    expect(moveFocus('e4', 'ArrowUp', 'b')).toBe('e3');
    expect(moveFocus('a1', 'ArrowLeft', 'w')).toBe('a1');
    expect(moveFocus('h8', 'ArrowRight', 'b')).toBe('g8');
  });
});
