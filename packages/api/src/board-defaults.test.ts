import { DEFAULT_BOARD_PREFERENCES } from '@erpchess/domain';
import { describe, expect, it, vi } from 'vitest';
import type { ErpClient } from './client';
import { updateAcademyBoardDefaults } from './queries';

function client() {
  const eq = vi.fn().mockResolvedValue({ data: null, error: null });
  const update = vi.fn(() => ({ eq }));
  return { c: { from: () => ({ update }) } as unknown as ErpClient, update, eq };
}

describe('updateAcademyBoardDefaults', () => {
  it('lưu bộ tùy chọn đã kiểm tra', async () => {
    const { c, update, eq } = client();
    await updateAcademyBoardDefaults(c, 'a1', { ...DEFAULT_BOARD_PREFERENCES, theme: 'wood' });
    expect(update).toHaveBeenCalledWith({
      board_defaults: { ...DEFAULT_BOARD_PREFERENCES, theme: 'wood' },
    });
    expect(eq).toHaveBeenCalledWith('id', 'a1');
  });

  it('null là bỏ mặc định; giá trị sai thì từ chối trước khi ghi', async () => {
    const { c, update } = client();
    await updateAcademyBoardDefaults(c, 'a1', null);
    expect(update).toHaveBeenLastCalledWith({ board_defaults: {} });
    await expect(
      updateAcademyBoardDefaults(c, 'a1', {
        ...DEFAULT_BOARD_PREFERENCES,
        theme: 'pink' as 'navy',
      }),
    ).rejects.toThrow();
  });
});
