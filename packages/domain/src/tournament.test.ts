import { describe, expect, it } from 'vitest';
import { nextOccurrence, OPENING_PRESETS, tournamentInputSchema } from './tournament';

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

describe('nextOccurrence', () => {
  const start = new Date(2026, 0, 31, 19, 0);
  it('hằng ngày, hằng tuần, hằng tháng (31/1 → 28/2)', () => {
    expect(nextOccurrence(start, 'daily', null)).toEqual(new Date(2026, 1, 1, 19, 0));
    expect(nextOccurrence(start, 'weekly', null)).toEqual(new Date(2026, 1, 7, 19, 0));
    expect(nextOccurrence(start, 'monthly', null)).toEqual(new Date(2026, 1, 28, 19, 0));
  });
  it('không lặp hoặc đã quá hạn lặp', () => {
    expect(nextOccurrence(start, 'none', null)).toBeNull();
    expect(nextOccurrence(start, 'weekly', new Date(2026, 1, 1))).toBeNull();
  });
});

describe('OPENING_PRESETS', () => {
  it('mã duy nhất, FEN đủ 6 trường', () => {
    expect(new Set(OPENING_PRESETS.map((o) => o.id)).size).toBe(OPENING_PRESETS.length);
    for (const o of OPENING_PRESETS) expect(o.fen.split(' ')).toHaveLength(6);
  });
});
