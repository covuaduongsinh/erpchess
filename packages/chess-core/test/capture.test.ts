import { describe, expect, it } from 'vitest';
import {
  captureDests,
  captureTargets,
  gradeCapture,
  playCaptureMove,
  solveCapture,
} from '../src/capture';

// Xe trắng a1, tốt đen a5 và e5 (không có vua)
const ROOK = '8/8/8/p3p3/8/8/8/R7 w - - 0 1';

describe('capture', () => {
  it('đếm quân đối phương còn lại', () => {
    expect(captureTargets(ROOK)).toBe(2);
    expect(captureTargets('8/8/8/8/8/8/8/R7 w - - 0 1')).toBe(0);
  });

  it('xe đi thẳng, bị chặn bởi quân, bắt được quân đối phương', () => {
    const dests = captureDests(ROOK).get('a1') ?? [];
    expect(dests).toContain('a5');
    expect(dests).not.toContain('a6');
    expect(dests).toContain('h1');
    const after = playCaptureMove(ROOK, 'a1a5');
    expect(after?.captured).toBe(true);
    expect(captureTargets(after?.fen ?? '')).toBe(1);
    // Đối phương không đi, vẫn đến lượt trắng
    expect(after?.fen.split(' ')[1]).toBe('w');
  });

  it('nước sai luật trả null', () => {
    expect(playCaptureMove(ROOK, 'a1b2')).toBeNull();
    expect(playCaptureMove(ROOK, 'a1a6')).toBeNull();
    expect(playCaptureMove(ROOK, 'b1b2')).toBeNull();
    expect(playCaptureMove(ROOK, 'xx')).toBeNull();
  });

  it('mã nhảy qua quân, tượng đi chéo, hậu kết hợp', () => {
    const knight = '8/8/8/8/3p4/2P5/8/1N6 w - - 0 1';
    expect(captureDests(knight).get('b1')).toEqual(expect.arrayContaining(['a3', 'd2']));
    expect(captureDests(knight).get('b1')).not.toContain('c3');
    expect(playCaptureMove('8/8/8/8/8/2p5/8/B7 w - - 0 1', 'a1c3')?.captured).toBe(true);
    expect(captureDests('8/8/8/8/8/8/8/Q7 w - - 0 1').get('a1')).toHaveLength(21);
  });

  it('tốt đi thẳng không bắt, bắt chéo, đi hai ô từ hàng xuất phát, phong cấp', () => {
    const fen = '8/8/8/8/8/1p6/P7/8 w - - 0 1';
    expect(captureDests(fen).get('a2')?.sort()).toEqual(['a3', 'a4', 'b3']);
    expect(playCaptureMove('8/8/8/8/8/p7/P7/8 w - - 0 1', 'a2a3')).toBeNull();
    const promo = playCaptureMove('1p6/P7/8/8/8/8/8/8 w - - 0 1', 'a7b8');
    expect(promo?.fen.startsWith('1Q6')).toBe(true);
    expect(playCaptureMove('1p6/P7/8/8/8/8/8/8 w - - 0 1', 'a7b8n')?.fen.startsWith('1N6')).toBe(
      true,
    );
  });

  it('phe đen cầm quân', () => {
    const fen = '8/8/8/8/8/8/8/r3P3 b - - 0 1';
    expect(playCaptureMove(fen, 'a1e1')?.captured).toBe(true);
    // Tốt đen đi xuống
    expect(captureDests('8/p7/8/8/8/8/8/8 b - - 0 1').get('a7')?.sort()).toEqual(['a5', 'a6']);
  });

  it('gradeCapture chấm cả chuỗi, dừng ở nước sai', () => {
    expect(gradeCapture(ROOK, ['a1a5', 'a5e5'])).toEqual({
      solved: true,
      captured: 2,
      remaining: 0,
      legalMoves: 2,
    });
    expect(gradeCapture(ROOK, ['a1a5', 'a5a8', 'zz', 'a8e8'])).toEqual({
      solved: false,
      captured: 1,
      remaining: 1,
      legalMoves: 2,
    });
  });

  it('solveCapture tìm số nước ít nhất hoặc báo không giải được', () => {
    expect(solveCapture(ROOK)).toBe(2);
    expect(solveCapture('8/8/8/8/8/8/1p6/B7 w - - 0 1')).toBe(1);
    // Tượng ô đen không bao giờ bắt được quân ở ô trắng
    expect(solveCapture('8/8/8/8/8/8/p7/B7 w - - 0 1')).toBeNull();
    expect(solveCapture('8/8/8/8/8/8/8/R7 w - - 0 1')).toBe(0);
  });
});
