import { describe, expect, it, vi } from 'vitest';
import type { ErpClient } from './client';
import { createLocation, updateLocation } from './locations';
import { updateGroup } from './queries';

const ACADEMY = '00000000-0000-4000-8000-000000000001';
const LOC = '00000000-0000-4000-8000-0000000000l1';

const input = {
  name: 'Cơ sở Cầu Giấy',
  country: 'VN',
  workingDays: [1, 3],
  opensAt: '08:00',
  closesAt: '20:00',
  contactName: 'Thầy An',
  contactPhone: '0912345678',
};

function fakeClient(o: Record<string, unknown>): ErpClient {
  return o as unknown as ErpClient;
}

describe('createLocation', () => {
  it('chèn dòng đã chuẩn hoá, không đặt cơ sở chính thì không gọi RPC', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: LOC, is_main: false }, error: null });
    const insert = vi.fn(() => ({ select: () => ({ single }) }));
    const rpc = vi.fn();
    await createLocation(fakeClient({ from: () => ({ insert }), rpc }), ACADEMY, input);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        academy_id: ACADEMY,
        kind: 'centre',
        working_days: [1, 3],
        contact_phone: '0912345678',
        email: null,
      }),
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('đặt cơ sở chính qua RPC set_main_location', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: LOC, is_main: false }, error: null });
    const insert = vi.fn(() => ({ select: () => ({ single }) }));
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const row = await createLocation(fakeClient({ from: () => ({ insert }), rpc }), ACADEMY, {
      ...input,
      isMain: true,
    });
    expect(rpc).toHaveBeenCalledWith('set_main_location', { p_location: LOC });
    expect(row.is_main).toBe(true);
  });

  it('dữ liệu sai thì ném lỗi trước khi gọi CSDL', async () => {
    const from = vi.fn();
    await expect(
      createLocation(fakeClient({ from }), ACADEMY, { ...input, closesAt: '07:00' }),
    ).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
});

describe('updateLocation', () => {
  it('bỏ cờ cơ sở chính khi không chọn', async () => {
    const eq = vi.fn().mockResolvedValue({ data: null, error: null });
    const update = vi.fn(() => ({ eq }));
    await updateLocation(fakeClient({ from: () => ({ update }) }), LOC, input);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ is_main: false }));
  });
});

describe('updateGroup với hình thức học', () => {
  it('offline thiếu địa điểm thì ném lỗi; online thì gỡ địa điểm', async () => {
    const eq = vi.fn().mockResolvedValue({ data: null, error: null });
    const update = vi.fn(() => ({ eq }));
    const client = fakeClient({ from: () => ({ update }) });
    await expect(updateGroup(client, 'g1', { mode: 'offline' })).rejects.toThrow('location');
    await updateGroup(client, 'g1', { mode: 'online', locationId: LOC });
    expect(update).toHaveBeenLastCalledWith({ mode: 'online', location_id: null });
    await updateGroup(client, 'g1', { mode: 'hybrid', locationId: LOC });
    expect(update).toHaveBeenLastCalledWith({ mode: 'hybrid', location_id: LOC });
  });
});
