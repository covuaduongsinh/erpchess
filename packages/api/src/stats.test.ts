import { describe, expect, it, vi } from 'vitest';
import type { ErpClient } from './client';
import {
  DEFAULT_STATS_TZ,
  fetchAcademyQuizBoard,
  fetchDailyStats,
  fetchQuizStarted,
  percent,
} from './stats';

function clientWith(data: unknown) {
  const rpc = vi.fn().mockResolvedValue({ data, error: null });
  return { client: { rpc } as unknown as ErpClient, rpc };
}

describe('fetchDailyStats', () => {
  it('gọi academy_daily_stats với múi giờ mặc định và đổi tên cột', async () => {
    const { client, rpc } = clientWith([
      {
        on_date: '2026-05-11',
        attempts: 5,
        attendance_present: 2,
        attendance_total: 3,
        quiz_completions: 1,
      },
    ]);
    const rows = await fetchDailyStats(client, 'a1', '2026-05-11', '2026-05-17');
    expect(rpc).toHaveBeenCalledWith('academy_daily_stats', {
      p_academy: 'a1',
      p_from: '2026-05-11',
      p_to: '2026-05-17',
      p_tz: DEFAULT_STATS_TZ,
    });
    expect(rows).toEqual([
      {
        date: '2026-05-11',
        attempts: 5,
        attendancePresent: 2,
        attendanceTotal: 3,
        quizCompletions: 1,
      },
    ]);
  });

  it('truyền múi giờ khác khi được yêu cầu; không phải nhân sự thì mảng rỗng', async () => {
    const { client, rpc } = clientWith([]);
    expect(await fetchDailyStats(client, 'a1', '2026-05-11', '2026-05-11', 'UTC')).toEqual([]);
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_tz: 'UTC' });
  });

  it('ném lỗi của RPC (vd. khoảng ngày không hợp lệ)', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'khoảng ngày', code: '22023' } });
    await expect(
      fetchDailyStats({ rpc } as unknown as ErpClient, 'a1', '2026-05-11', '2026-01-01'),
    ).rejects.toBeTruthy();
  });
});

describe('fetchAcademyQuizBoard', () => {
  it('đổi ngày sang ISO và đổi tên cột', async () => {
    const { client, rpc } = clientWith([
      {
        student_id: 's1',
        display_name: 'HV 1',
        avatar_url: null,
        points: 18,
        correct: 2,
        completed: 1,
      },
    ]);
    const from = new Date('2026-05-01T00:00:00Z');
    const to = new Date('2026-06-01T00:00:00Z');
    const rows = await fetchAcademyQuizBoard(client, 'a1', from, to);
    expect(rpc).toHaveBeenCalledWith('academy_quiz_leaderboard', {
      p_academy: 'a1',
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    });
    expect(rows).toEqual([
      {
        studentId: 's1',
        displayName: 'HV 1',
        avatarUrl: null,
        points: 18,
        correct: 2,
        completed: 1,
      },
    ]);
  });
});

describe('fetchQuizStarted', () => {
  it('đổi tên cột', async () => {
    const { client } = clientWith([{ total_quizzes: 4, open_quizzes: 2, started_quizzes: 1 }]);
    expect(await fetchQuizStarted(client, 'a1')).toEqual({ total: 4, open: 2, started: 1 });
  });

  it('không phải nhân sự (RPC trả rỗng) thì null', async () => {
    const { client } = clientWith([]);
    expect(await fetchQuizStarted(client, 'a1')).toBeNull();
  });
});

describe('percent', () => {
  it('làm tròn; không có mẫu số thì null để giao diện không hiện 0% giả', () => {
    expect(percent(1, 2)).toBe(50);
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 4)).toBe(0);
    expect(percent(0, 0)).toBeNull();
  });
});
