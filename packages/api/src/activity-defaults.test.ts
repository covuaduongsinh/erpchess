import { describe, expect, it, vi } from 'vitest';
import type { ErpClient } from './client';
import { updateAcademyActivityDefaults } from './queries';

describe('updateAcademyActivityDefaults', () => {
  it('lưu cấu hình hợp lệ, từ chối giá trị sai trước khi ghi', async () => {
    const eq = vi.fn().mockResolvedValue({ data: null, error: null });
    const update = vi.fn(() => ({ eq }));
    const client = { from: () => ({ update }) } as unknown as ErpClient;
    const puzzle = { points: 20, maxAttempts: 3, timeLimitS: null, wrongPenalty: 2 };
    await updateAcademyActivityDefaults(client, 'a1', { puzzle });
    expect(update).toHaveBeenCalledWith({ activity_defaults: { puzzle } });
    await expect(
      updateAcademyActivityDefaults(client, 'a1', { puzzle: { ...puzzle, points: -5 } }),
    ).rejects.toThrow();
    expect(update).toHaveBeenCalledTimes(1);
  });
});
