import { describe, expect, it, vi } from 'vitest';
import type { ErpClient } from './client';
import { createErpClient } from './client';
import { createStudent, fetchGroups, signInStudent } from './queries';
import { isStudentEmail, studentEmail } from './student';

describe('student email', () => {
  it('suy email nội bộ từ username', () => {
    expect(studentEmail(' An.Nguyen ')).toBe('an.nguyen@students.erpchess.local');
    expect(isStudentEmail('AN@STUDENTS.ERPCHESS.LOCAL')).toBe(true);
    expect(isStudentEmail('coach@gmail.com')).toBe(false);
    expect(isStudentEmail(null)).toBe(false);
  });
});

describe('createErpClient', () => {
  it('báo lỗi khi thiếu cấu hình', () => {
    expect(() => createErpClient({ url: '', key: '' })).toThrow(/Thiếu cấu hình/);
  });
});

function fakeClient(overrides: Record<string, unknown>): ErpClient {
  return overrides as unknown as ErpClient;
}

describe('queries', () => {
  it('signInStudent đăng nhập bằng email nội bộ và PIN', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ data: { session: {} }, error: null });
    await signInStudent(fakeClient({ auth: { signInWithPassword } }), 'An.Nguyen', '246810');
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'an.nguyen@students.erpchess.local',
      password: '246810',
    });
  });

  it('signInStudent chặn PIN sai định dạng trước khi gọi mạng', async () => {
    const signInWithPassword = vi.fn();
    await expect(
      signInStudent(fakeClient({ auth: { signInWithPassword } }), 'an', '12'),
    ).rejects.toThrow();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('fetchGroups trải số học viên', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 'g1', name: 'Lớp A', academy_id: 'a', group_members: [{ count: 3 }] }],
      error: null,
    });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const groups = await fetchGroups(fakeClient({ from: () => ({ select }) }), 'a');
    expect(groups[0]).toMatchObject({ id: 'g1', studentCount: 3 });
    expect(groups[0]).not.toHaveProperty('group_members');
  });

  it('createStudent trả thông báo lỗi từ Edge Function', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: new Response(JSON.stringify({ error: 'username_taken' }), { status: 409 }),
      },
    });
    await expect(
      createStudent(fakeClient({ functions: { invoke } }), {
        academyId: '7b0f3c1e-1d2a-4c8e-9f00-0a1b2c3d4e5f',
        displayName: 'An',
        username: 'an.nguyen',
        pin: '246810',
      }),
    ).rejects.toMatchObject({ code: 'username_taken' });
  });
});
