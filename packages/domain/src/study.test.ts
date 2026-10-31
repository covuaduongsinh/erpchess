import { describe, expect, it } from 'vitest';
import {
  APP_ACTIVITY_DEFAULTS,
  activityInputSchema,
  defaultsForKind,
  estimateMinutes,
  scoreActivity,
  studyInputSchema,
} from './study';

const FEN = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1';

describe('activityInputSchema', () => {
  it('điền giá trị mặc định cho thuộc tính chung', () => {
    const a = activityInputSchema.parse({ kind: 'puzzle', payload: { fen: FEN, moves: ['d1d8'] } });
    expect(a).toMatchObject({ points: 10, maxAttempts: null, wrongPenalty: 0, topics: [] });
  });

  it('puzzle cần số nước lẻ', () => {
    const r = activityInputSchema.safeParse({
      kind: 'puzzle',
      payload: { fen: FEN, moves: ['d1d8', 'g8h7'] },
    });
    expect(r.success).toBe(false);
  });

  it('mcq: đáp án đúng phải nằm trong danh sách', () => {
    const base = {
      kind: 'mcq',
      payload: { question: 'Quân nào đi chéo?', options: ['Xe', 'Tượng'] },
    };
    expect(
      activityInputSchema.safeParse({ ...base, payload: { ...base.payload, correct: 1 } }).success,
    ).toBe(true);
    expect(
      activityInputSchema.safeParse({ ...base, payload: { ...base.payload, correct: 2 } }).success,
    ).toBe(false);
  });

  it('video chỉ nhận https hoặc tệp trong bucket', () => {
    const v = (url: string) =>
      activityInputSchema.safeParse({ kind: 'video', payload: { url } }).success;
    expect(v('https://www.youtube.com/watch?v=abc')).toBe(true);
    expect(v('storage:study-media/a/b/c.mp4')).toBe(true);
    expect(v('http://x.vn/a.mp4')).toBe(false);
    expect(v('javascript:alert(1)')).toBe(false);
  });

  it('kind lạ bị từ chối', () => {
    expect(activityInputSchema.safeParse({ kind: 'html', payload: { html: '<b>' } }).success).toBe(
      false,
    );
  });
});

describe('studyInputSchema', () => {
  it('mặc định riêng tư', () => {
    expect(
      studyInputSchema.parse({ academyId: '00000000-0000-4000-8000-000000000001', title: 'Xe' })
        .visibility,
    ).toBe('private');
  });
});

describe('scoreActivity', () => {
  it('trừ điểm theo lần sai và gợi ý, không âm', () => {
    expect(scoreActivity({ solved: true, points: 10, tries: 1, wrongPenalty: 3 })).toBe(10);
    expect(scoreActivity({ solved: true, points: 10, tries: 3, wrongPenalty: 3 })).toBe(4);
    expect(
      scoreActivity({
        solved: true,
        points: 10,
        tries: 2,
        wrongPenalty: 3,
        hintsUsed: 3,
        hintPenalty: 5,
      }),
    ).toBe(0);
    expect(scoreActivity({ solved: false, points: 10, tries: 1, wrongPenalty: 0 })).toBe(0);
  });
});

describe('estimateMinutes', () => {
  it('cộng giới hạn giờ hoặc thời lượng mặc định', () => {
    expect(estimateMinutes([{ kind: 'mcq' }, { kind: 'puzzle', timeLimitS: 75 }])).toBe(2);
    expect(estimateMinutes([])).toBe(1);
  });
});

describe('defaultsForKind', () => {
  it('lấy của học viện nếu hợp lệ, không thì mặc định ứng dụng', () => {
    const raw = {
      puzzle: { points: 20, maxAttempts: 3, timeLimitS: null, wrongPenalty: 2 },
      mcq: { points: -1 },
    };
    expect(defaultsForKind(raw, 'puzzle')).toEqual({
      points: 20,
      maxAttempts: 3,
      timeLimitS: null,
      wrongPenalty: 2,
    });
    expect(defaultsForKind(raw, 'mcq')).toEqual(APP_ACTIVITY_DEFAULTS);
    expect(defaultsForKind(null, 'video')).toEqual(APP_ACTIVITY_DEFAULTS);
  });
});
