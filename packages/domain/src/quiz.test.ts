import { describe, expect, it } from 'vitest';
import { quizInputSchema, quizStatus, stripQuizAnswer } from './quiz';

const A = '00000000-0000-4000-8000-000000000001';
const G = '00000000-0000-4000-8000-0000000000a1';
const FEN = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1';
const puzzle = { kind: 'puzzle', payload: { fen: FEN, moves: ['d1d8'] } } as const;

describe('quizInputSchema', () => {
  it('cần người làm: mở cho tất cả hoặc có lớp/học viên', () => {
    const base = { academyId: A, title: 'Quiz 1', items: [puzzle] };
    expect(quizInputSchema.safeParse(base).success).toBe(false);
    expect(quizInputSchema.safeParse({ ...base, openToAll: true }).success).toBe(true);
    expect(quizInputSchema.safeParse({ ...base, groupIds: [G] }).success).toBe(true);
  });

  it('chỉ nhận puzzle, trắc nghiệm, bắt quân', () => {
    const r = quizInputSchema.safeParse({
      academyId: A,
      title: 'Q',
      openToAll: true,
      items: [{ kind: 'video', payload: { url: 'https://youtu.be/dQw4w9WgXcQ' } }],
    });
    expect(r.success).toBe(false);
  });

  it('hạn chót phải sau giờ mở', () => {
    const r = quizInputSchema.safeParse({
      academyId: A,
      title: 'Q',
      openToAll: true,
      items: [puzzle],
      startsAt: '2026-10-24T10:00:00+07:00',
      dueAt: '2026-10-24T09:00:00+07:00',
    });
    expect(r.success).toBe(false);
  });
});

describe('quizStatus', () => {
  const now = new Date('2026-10-24T10:00:00Z');
  it('sắp mở, đang mở, đã đóng', () => {
    expect(quizStatus('2026-10-24T11:00:00Z', null, now)).toBe('upcoming');
    expect(quizStatus(null, '2026-10-24T11:00:00Z', now)).toBe('open');
    expect(quizStatus(null, null, now)).toBe('open');
    expect(quizStatus('2026-10-24T08:00:00Z', '2026-10-24T09:00:00Z', now)).toBe('closed');
  });
});

describe('stripQuizAnswer', () => {
  it('puzzle chỉ còn thế cờ, trắc nghiệm mất đáp án', () => {
    expect(stripQuizAnswer('puzzle', { fen: FEN, moves: ['d1d8'] })).toEqual({ fen: FEN });
    expect(stripQuizAnswer('mcq', { question: '?', options: ['a', 'b'], correct: 1 })).toEqual({
      question: '?',
      options: ['a', 'b'],
    });
    expect(stripQuizAnswer('capture', { fen: '8/8/8/8/8/8/8/R7 w - - 0 1' })).toEqual({
      fen: '8/8/8/8/8/8/8/R7 w - - 0 1',
    });
  });
});
