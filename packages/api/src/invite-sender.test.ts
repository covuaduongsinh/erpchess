import { describe, expect, it, vi } from 'vitest';
import type { ErpClient } from './client';
import { updateAcademyInviteSender } from './queries';

const ACADEMY = '00000000-0000-4000-8000-000000000001';

function fakeClient(current: Record<string, unknown>) {
  const single = vi.fn().mockResolvedValue({ data: { contact: current }, error: null });
  const eqUpdate = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: eqUpdate }));
  const from = vi.fn(() => ({
    select: () => ({ eq: () => ({ single }) }),
    update,
  }));
  return { client: { from } as unknown as ErpClient, update, eqUpdate };
}

describe('updateAcademyInviteSender', () => {
  it('ghi gộp vào contact, giữ nguyên địa chỉ/điện thoại/Zalo đang có', async () => {
    const { client, update, eqUpdate } = fakeClient({
      address: '12 Lê Lợi',
      phone: '0912 345 678',
      senderName: 'Tên cũ',
    });
    await updateAcademyInviteSender(client, ACADEMY, {
      senderName: ' CLB Dương Sinh ',
      replyTo: 'hi@clb.vn',
    });
    expect(update).toHaveBeenCalledWith({
      contact: {
        address: '12 Lê Lợi',
        phone: '0912 345 678',
        senderName: 'CLB Dương Sinh',
        replyTo: 'hi@clb.vn',
      },
    });
    expect(eqUpdate).toHaveBeenCalledWith('id', ACADEMY);
  });

  it('để trống thì gỡ hai trường đó, các trường khác vẫn giữ', async () => {
    const { client, update } = fakeClient({
      phone: '0912 345 678',
      senderName: 'Tên cũ',
      replyTo: 'cu@clb.vn',
    });
    await updateAcademyInviteSender(client, ACADEMY, { senderName: '', replyTo: '' });
    expect(update).toHaveBeenCalledWith({ contact: { phone: '0912 345 678' } });
  });

  it('email sai thì báo lỗi và không ghi gì', async () => {
    const { client, update } = fakeClient({});
    await expect(
      updateAcademyInviteSender(client, ACADEMY, { senderName: 'A', replyTo: 'sai' }),
    ).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});
