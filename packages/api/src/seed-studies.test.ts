import { gradeMove, isValidFen, parsePgn, solveCapture } from '@erpchess/chess-core';
import { activityInputSchema } from '@erpchess/domain';
import { describe, expect, it } from 'vitest';
import seedJson from '../../../supabase/seed/studies.json';

type SeedStudy = {
  slug: string;
  title: string;
  activities: { kind: string; title?: string; points?: number; payload: Record<string, unknown> }[];
};

const seed: SeedStudy[] = seedJson;

describe('thư viện học liệu chung (supabase/seed/studies.json)', () => {
  it('slug không trùng, mỗi học liệu có hoạt động', () => {
    expect(new Set(seed.map((s) => s.slug)).size).toBe(seed.length);
    for (const s of seed) expect(s.activities.length).toBeGreaterThan(0);
  });

  it.each(
    seed.flatMap((s) => s.activities.map((a, i) => [`${s.slug}#${i} ${a.kind}`, a] as const)),
  )('%s hợp lệ', (_, a) => {
    const parsed = activityInputSchema.parse(a);
    switch (parsed.kind) {
      case 'puzzle': {
        expect(isValidFen(parsed.payload.fen)).toBe(true);
        let step = 0;
        for (;;) {
          const r = gradeMove(parsed.payload, step, parsed.payload.moves[step] as string);
          if (r.result === 'solved') break;
          expect(r.result).toBe('correct');
          if (r.result !== 'correct') break;
          step = r.nextStep;
        }
        break;
      }
      case 'capture':
        expect(solveCapture(parsed.payload.fen)).not.toBeNull();
        break;
      case 'mcq':
        if (parsed.payload.fen) expect(isValidFen(parsed.payload.fen)).toBe(true);
        break;
      case 'game':
        expect(parsePgn(parsed.payload.pgn)).toHaveLength(1);
        break;
      default:
        break;
    }
  });
});
