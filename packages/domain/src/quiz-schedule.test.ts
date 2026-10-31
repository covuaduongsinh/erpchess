import { describe, expect, it } from 'vitest';
import { nextScheduledStudy, quizScheduleSchema } from './quiz-schedule';

const S1 = '00000000-0000-4000-8000-000000000001';
const S2 = '00000000-0000-4000-8000-000000000002';
const G = '00000000-0000-4000-8000-0000000000a1';

describe('quizScheduleSchema', () => {
  it('sắp và bỏ trùng ngày, điền mặc định', () => {
    const v = quizScheduleSchema.parse({
      name: 'Quiz cuối tuần',
      days: [6, 0, 6],
      atTime: '19:30',
      studyIds: [S1, S2],
      groupIds: [G],
    });
    expect(v.days).toEqual([0, 6]);
    expect(v.openHours).toBe(24);
    expect(v.expiresOn).toBeNull();
    expect(v.timezone).toBe('Asia/Ho_Chi_Minh');
  });

  it('bắt buộc có ngày, study và người nhận; giờ đúng định dạng', () => {
    const base = { name: 'X', days: [1], atTime: '08:00', studyIds: [S1], groupIds: [G] };
    expect(quizScheduleSchema.safeParse({ ...base, days: [] }).success).toBe(false);
    expect(quizScheduleSchema.safeParse({ ...base, studyIds: [] }).success).toBe(false);
    expect(quizScheduleSchema.safeParse({ ...base, groupIds: [] }).error?.issues[0]?.message).toBe(
      'targets',
    );
    expect(quizScheduleSchema.safeParse({ ...base, atTime: '24:00' }).success).toBe(false);
  });
});

describe('nextScheduledStudy', () => {
  it('quay vòng theo con trỏ', () => {
    expect(nextScheduledStudy([S1, S2], 0)).toBe(S1);
    expect(nextScheduledStudy([S1, S2], 3)).toBe(S2);
    expect(nextScheduledStudy([], 0)).toBeNull();
  });
});
