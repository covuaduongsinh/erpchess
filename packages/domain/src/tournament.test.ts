import { describe, expect, it } from 'vitest';
import { OPENING_PRESETS, tournamentInputSchema } from './tournament';

const academyId = '10000000-0000-4000-8000-00000000000a';

describe('tournamentInputSchema', () => {
  it('giá trị mặc định', () => {
    expect(tournamentInputSchema.parse({ academyId, title: 'Giải' })).toMatchObject({
      format: 'swiss',
      rounds: 5,
      baseMs: 600_000,
      control: 'manual',
      repeat: 'none',
    });
  });
  it('tự lên lịch hoặc lặp lại thì phải có giờ bắt đầu', () => {
    expect(
      tournamentInputSchema.safeParse({ academyId, title: 'G', control: 'auto_schedule' }).success,
    ).toBe(false);
    expect(
      tournamentInputSchema.safeParse({ academyId, title: 'G', repeat: 'weekly' }).success,
    ).toBe(false);
    expect(
      tournamentInputSchema.safeParse({
        academyId,
        title: 'G',
        repeat: 'weekly',
        startsAt: '2026-11-01T19:00:00+07:00',
      }).success,
    ).toBe(true);
  });
});

describe('OPENING_PRESETS', () => {
  it('mã duy nhất, FEN đủ 6 trường', () => {
    expect(new Set(OPENING_PRESETS.map((o) => o.id)).size).toBe(OPENING_PRESETS.length);
    for (const o of OPENING_PRESETS) expect(o.fen.split(' ')).toHaveLength(6);
  });
});
