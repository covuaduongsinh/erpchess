import { describe, expect, it } from 'vitest';
import { exerciseInputSchema, pickAutoQuizPuzzles, practicePositionSchema } from './practice';

const puzzles = [
  { id: 'a', rating: 400 },
  { id: 'b', rating: 450 },
  { id: 'c', rating: 700 },
  { id: 'd', rating: 800 },
  { id: 'e', rating: 1200 },
  { id: 'f', rating: 2100 },
];

describe('pickAutoQuizPuzzles', () => {
  it('chỉ lấy puzzle trong khoảng rating của cấp, không trùng', () => {
    const picked = pickAutoQuizPuzzles(puzzles, { minRating: 400, maxRating: 800 }, 10, 1);
    expect(picked.map((p) => p.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('cùng hạt giống thì cùng kết quả; giới hạn số câu', () => {
    const level = { minRating: 0, maxRating: null };
    const a = pickAutoQuizPuzzles(puzzles, level, 3, 42);
    expect(a).toHaveLength(3);
    expect(pickAutoQuizPuzzles(puzzles, level, 3, 42)).toEqual(a);
    expect(new Set(a.map((p) => p.id)).size).toBe(3);
  });

  it('cấp cuối không giới hạn trên', () => {
    expect(pickAutoQuizPuzzles(puzzles, { minRating: 2000, maxRating: null }, 5, 7)).toEqual([
      { id: 'f', rating: 2100 },
    ]);
  });
});

describe('schema', () => {
  it('Exercise cần ít nhất một puzzle', () => {
    const base = { academyId: '00000000-0000-4000-8000-000000000001', title: 'Chiến thuật 1' };
    expect(exerciseInputSchema.safeParse({ ...base, puzzleIds: [] }).success).toBe(false);
    expect(
      exerciseInputSchema.safeParse({
        ...base,
        puzzleIds: ['00000000-0000-4000-8000-0000000000a1'],
      }).success,
    ).toBe(true);
  });

  it('thế luyện tập mặc định mục tiêu thắng, máy hết sức', () => {
    expect(
      practicePositionSchema.parse({ fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', side: 'w' }),
    ).toMatchObject({ goal: 'win', elo: null, title: '' });
  });
});
