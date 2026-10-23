import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gradeMove, type Puzzle } from '../src/puzzle';
import { isValidFen } from '../src/rules';

type SeedPuzzle = Puzzle & { title: string; themes: string[] };

const seed: SeedPuzzle[] = JSON.parse(
  readFileSync(new URL('../../../supabase/seed/puzzles.json', import.meta.url), 'utf8'),
);

describe('bộ puzzle khởi đầu (supabase/seed/puzzles.json)', () => {
  it('có dữ liệu', () => {
    expect(seed.length).toBeGreaterThanOrEqual(10);
  });

  it.each(seed.map((p) => [p.title, p] as const))(
    '%s: FEN hợp lệ và giải đúng theo gradeMove',
    (_, p) => {
      expect(isValidFen(p.fen)).toBe(true);
      let step = 0;
      for (;;) {
        const r = gradeMove(p, step, p.moves[step] as string);
        if (r.result === 'solved') break;
        expect(r.result).toBe('correct');
        if (r.result !== 'correct') break;
        step = r.nextStep;
      }
      expect(step).toBe(p.moves.length - 1);
    },
  );
});
