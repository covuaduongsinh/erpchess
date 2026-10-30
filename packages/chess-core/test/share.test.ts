import { describe, expect, it } from 'vitest';
import { START_FEN } from '../src/rules';
import { detectChessShare } from '../src/share';

const ITALIAN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';

describe('detectChessShare', () => {
  it('trả null cho tin nhắn thường', () => {
    expect(detectChessShare('Chào thầy, mai em nghỉ học ạ')).toBeNull();
    expect(detectChessShare('Lớp 1. Buổi 2 học khai cuộc')).toBeNull();
    expect(detectChessShare('a/b/c/d/e/f/g/h w - -')).toBeNull();
  });

  it('nhận FEN đầy đủ, giữ phần chữ trước và sau', () => {
    const share = detectChessShare(`Giải thế này: ${ITALIAN} Trắng đi`);
    expect(share).toEqual({
      kind: 'fen',
      fen: ITALIAN,
      before: 'Giải thế này:',
      after: 'Trắng đi',
    });
  });

  it('nhận FEN thiếu bộ đếm nước, tự thêm 0 1', () => {
    const share = detectChessShare('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -');
    expect(share).toMatchObject({ kind: 'fen', fen: START_FEN, before: '', after: '' });
  });

  it('bỏ qua FEN sai luật (thiếu vua)', () => {
    expect(detectChessShare('rnbq1bnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1')).toBeNull();
  });

  it('nhận PGN có tag, rút tên kỳ thủ, kết quả và thế cuối', () => {
    const pgn = `[Event "Giải CLB"]
[White "An"]
[Black "Bình"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 1-0`;
    const share = detectChessShare(pgn);
    expect(share?.kind).toBe('pgn');
    if (share?.kind !== 'pgn') return;
    expect(share.summary).toMatchObject({
      white: 'An',
      black: 'Bình',
      result: '1-0',
      event: 'Giải CLB',
      plyCount: 5,
    });
    expect(share.finalFen).toBe(ITALIAN);
    expect(share.pgn).toBe(pgn);
  });

  it('nhận PGN chỉ có nước đi, kể cả dán trên một dòng', () => {
    const share = detectChessShare('1. e4 e5 2. Nf3 Nc6 3. Bc4 *');
    expect(share?.kind).toBe('pgn');
    if (share?.kind === 'pgn') expect(share.finalFen).toBe(ITALIAN);
  });

  it('PGN hỏng hoặc không có nước nào thì không coi là ván', () => {
    expect(detectChessShare('1. e4 e5 2. Ke3 Ke6 3. Qh5')).toBeNull();
    expect(detectChessShare('[Event "Trống"]\n\n*')).toBeNull();
  });
});
