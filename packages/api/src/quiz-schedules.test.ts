import { describe, expect, it, vi } from 'vitest';
import type { ErpClient } from './client';
import { createQuizSchedule, runQuizScheduleNow } from './quiz-schedules';

const S1 = '00000000-0000-4000-8000-000000000001';
const G = '00000000-0000-4000-8000-0000000000a1';
const ST = '00000000-0000-4000-8000-0000000000b1';

describe('createQuizSchedule', () => {
  it('lưu lịch đã chuẩn hoá rồi thêm người nhận', async () => {
    const inserted: Record<string, unknown[]> = {};
    const client = {
      from: (table: string) => ({
        insert: (row: unknown) => {
          inserted[table] = [...(inserted[table] ?? []), row];
          return table === 'quiz_schedules'
            ? { select: () => ({ single: async () => ({ data: { id: 'sc1' }, error: null }) }) }
            : Promise.resolve({ data: null, error: null });
        },
      }),
    } as unknown as ErpClient;

    const id = await createQuizSchedule(client, 'a1', 'u1', {
      name: 'Quiz cuối tuần',
      days: [0, 6, 6],
      atTime: '19:00',
      studyIds: [S1],
      groupIds: [G],
      studentIds: [ST],
    });
    expect(id).toBe('sc1');
    expect(inserted.quiz_schedules?.[0]).toMatchObject({
      academy_id: 'a1',
      days: [0, 6],
      at_time: '19:00',
      study_ids: [S1],
      open_hours: 24,
      created_by: 'u1',
    });
    expect(inserted.quiz_schedule_targets?.[0]).toEqual([
      { schedule_id: 'sc1', group_id: G },
      { schedule_id: 'sc1', student_id: ST },
    ]);
  });

  it('thiếu người nhận thì từ chối trước khi ghi', async () => {
    const from = vi.fn();
    await expect(
      createQuizSchedule({ from } as unknown as ErpClient, 'a1', 'u1', {
        name: 'X',
        days: [1],
        atTime: '08:00',
        studyIds: [S1],
      }),
    ).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
});

describe('runQuizScheduleNow', () => {
  it('trả id quiz hoặc null', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: 'q1', error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const client = { rpc } as unknown as ErpClient;
    expect(await runQuizScheduleNow(client, 'sc1')).toBe('q1');
    expect(await runQuizScheduleNow(client, 'sc1')).toBeNull();
    expect(rpc).toHaveBeenCalledWith('run_quiz_schedule_now', { p_schedule: 'sc1' });
  });
});
