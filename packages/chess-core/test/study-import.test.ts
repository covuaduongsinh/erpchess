import { describe, expect, it } from 'vitest';
import { chapterToActivity, lichessStudyName } from '../src/study-import';

const PUZZLE = `[Event "Chiến thuật: Đòn ghim 1"]
[StudyName "Chiến thuật"]
[ChapterName "Đòn ghim 1"]
[FEN "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3"]
[SetUp "1"]

3... Nf6 4. Ng5 d5 *`;

const GAME = `[Event "Chiến thuật: Ván mẫu"]
[White "An"]
[Black "Bình"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *`;

describe('chapterToActivity', () => {
  it('chương từ thế cờ riêng, số nửa nước lẻ thành puzzle', () => {
    expect(chapterToActivity(PUZZLE)).toEqual({
      kind: 'puzzle',
      title: 'Đòn ghim 1',
      payload: {
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
        moves: ['g8f6', 'f3g5', 'd7d5'],
      },
    });
  });

  it('chương từ thế khởi đầu thành xem ván, lấy tên từ Event', () => {
    const a = chapterToActivity(GAME);
    expect(a?.kind).toBe('game');
    expect(a?.title).toBe('Ván mẫu');
    expect(a?.kind === 'game' && a.payload.pgn).toContain('1. e4 e5');
  });

  it('chương trống hoặc PGN hỏng thì bỏ qua', () => {
    expect(chapterToActivity('[Event "Trống"]\n\n*')).toBeNull();
    expect(chapterToActivity('1. e4 e5 2. Ke3 Ke6 3. Qh5')).toBeNull();
  });
});

describe('lichessStudyName', () => {
  it('ưu tiên StudyName, rồi phần trước dấu hai chấm của Event', () => {
    expect(lichessStudyName(PUZZLE)).toBe('Chiến thuật');
    expect(lichessStudyName(GAME)).toBe('Chiến thuật');
  });
});
