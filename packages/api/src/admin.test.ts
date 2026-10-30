import { describe, expect, it, vi } from 'vitest';
import type { ErpClient } from './client';
import { importStudents, setStudentLevel, updateAcademyProfile, updateGroup } from './queries';

function fakeClient(overrides: Record<string, unknown>): ErpClient {
  return overrides as unknown as ErpClient;
}

const ACADEMY = '00000000-0000-4000-8000-000000000001';
const GROUP = '00000000-0000-4000-8000-0000000000a1';

describe('quản trị học viện', () => {
  it('importStudents ghép lớp theo tên, lỗi một dòng không dừng cả lô', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({ data: { studentId: 's1', username: 'an.ng' }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: new Response(JSON.stringify({ error: 'username_taken' }), { status: 409 }),
        },
      })
      .mockResolvedValueOnce({ data: { studentId: 's3', username: 'cuong' }, error: null });
    const progress: number[] = [];
    const results = await importStudents(
      fakeClient({ functions: { invoke } }),
      ACADEMY,
      [
        { displayName: 'An', username: 'an.ng', pin: '123456', group: ' lớp a1 ' },
        { displayName: 'Bình', username: 'binh', pin: '123456' },
        { displayName: 'Cường', username: 'cuong', pin: '123456', group: 'Không có' },
      ],
      [{ id: GROUP, name: 'Lớp A1' }],
      (n) => progress.push(n),
    );
    expect(results).toEqual([
      { username: 'an.ng', ok: true },
      { username: 'binh', ok: false, error: 'username_taken' },
      { username: 'cuong', ok: true },
    ]);
    expect(progress).toEqual([1, 2, 3]);
    expect(invoke.mock.calls[0]?.[1]).toMatchObject({ body: { groupId: GROUP } });
    expect(invoke.mock.calls[2]?.[1].body.groupId).toBeUndefined();
  });

  it('setStudentLevel truyền null để gỡ cấp', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    await setStudentLevel(fakeClient({ rpc }), ACADEMY, 's1', null);
    expect(rpc).toHaveBeenCalledWith('set_student_level', {
      p_academy: ACADEMY,
      p_student: 's1',
      p_level: null,
    });
  });

  it('updateGroup chỉ gửi trường có thay đổi và chặn lịch sai', async () => {
    const eq = vi.fn().mockResolvedValue({ data: null, error: null });
    const update = vi.fn(() => ({ eq }));
    const client = fakeClient({ from: () => ({ update }) });
    await updateGroup(client, GROUP, { kind: 'batch', levelId: null });
    expect(update).toHaveBeenCalledWith({ kind: 'batch', level_id: null });
    await expect(
      updateGroup(client, GROUP, { schedule: [{ day: 9, start: '18:00', minutes: 60 }] }),
    ).rejects.toThrow();
  });

  it('updateAcademyProfile bỏ link mạng xã hội rỗng', async () => {
    const eq = vi.fn().mockResolvedValue({ data: null, error: null });
    const update = vi.fn(() => ({ eq }));
    await updateAcademyProfile(fakeClient({ from: () => ({ update }) }), ACADEMY, {
      name: 'CLB Dương Sinh',
      logoUrl: '',
      socials: { facebook: 'https://facebook.com/clb', youtube: '' },
    });
    expect(update).toHaveBeenCalledWith({
      name: 'CLB Dương Sinh',
      description: '',
      logo_url: null,
      favicon_url: null,
      brand_color: null,
      socials: { facebook: 'https://facebook.com/clb' },
      contact: {},
    });
  });

  it('updateAcademyProfile lưu màu thương hiệu (chữ thường) và liên hệ không rỗng', async () => {
    const eq = vi.fn().mockResolvedValue({ data: null, error: null });
    const update = vi.fn(() => ({ eq }));
    await updateAcademyProfile(fakeClient({ from: () => ({ update }) }), ACADEMY, {
      name: 'CLB Dương Sinh',
      faviconUrl: 'https://cdn.vn/f.png',
      brandColor: '#C0392B',
      contact: { address: '12 Lê Lợi, Hà Nội', phone: '0912 345 678', zalo: '' },
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        favicon_url: 'https://cdn.vn/f.png',
        brand_color: '#c0392b',
        contact: { address: '12 Lê Lợi, Hà Nội', phone: '0912 345 678' },
      }),
    );
  });
});

describe('importStudents với dữ liệu sai', () => {
  it('trả mã trường sai thay vì JSON của Zod', async () => {
    const invoke = vi.fn();
    const [result] = await importStudents(
      fakeClient({ functions: { invoke } }),
      ACADEMY,
      [{ displayName: 'X', username: 'ab', pin: '123456' }],
      [],
    );
    expect(result).toEqual({ username: 'ab', ok: false, error: 'username' });
    expect(invoke).not.toHaveBeenCalled();
  });
});
