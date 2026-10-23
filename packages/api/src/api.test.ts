import { describe, expect, it, vi } from 'vitest';
import type { ErpClient } from './client';
import { createErpClient } from './client';
import {
  createAssignment,
  createStudent,
  fetchGroups,
  signInStudent,
  submitAttempt,
} from './queries';
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

  describe('createAssignment', () => {
    const input = {
      academyId: '10000000-0000-4000-8000-00000000000a',
      title: 'Bài 1',
      puzzleIds: ['30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002'],
      groupIds: ['20000000-0000-4000-8000-0000000000a1'],
    };

    function fakeDb(itemsError: { message: string } | null) {
      const calls: { table: string; op: string; payload?: unknown }[] = [];
      const from = (table: string) => ({
        insert: (payload: unknown) => {
          calls.push({ table, op: 'insert', payload });
          if (table === 'assignments')
            return {
              select: () => ({
                single: async () => ({ data: { id: 'new-id', title: 'Bài 1' }, error: null }),
              }),
            };
          return Promise.resolve({
            data: null,
            error: table === 'assignment_items' ? itemsError : null,
          });
        },
        delete: () => ({
          eq: async (_col: string, id: string) => {
            calls.push({ table, op: 'delete', payload: id });
            return { data: null, error: null };
          },
        }),
      });
      return { client: fakeClient({ from }), calls };
    }

    it('tạo bài, giao lớp, thêm puzzle theo thứ tự', async () => {
      const { client, calls } = fakeDb(null);
      await createAssignment(client, input);
      expect(calls.map((c) => `${c.op} ${c.table}`)).toEqual([
        'insert assignments',
        'insert assignment_targets',
        'insert assignment_items',
      ]);
      expect(calls[2]?.payload).toEqual([
        { assignment_id: 'new-id', position: 0, puzzle_id: input.puzzleIds[0] },
        { assignment_id: 'new-id', position: 1, puzzle_id: input.puzzleIds[1] },
      ]);
    });

    it('bước sau lỗi thì xoá bài vừa tạo', async () => {
      const { client, calls } = fakeDb({ message: 'denied' });
      await expect(createAssignment(client, input)).rejects.toThrow('denied');
      expect(calls.at(-1)).toEqual({ table: 'assignments', op: 'delete', payload: 'new-id' });
    });
  });

  it('submitAttempt báo mã lỗi từ Edge Function', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }),
      },
    });
    await expect(
      submitAttempt(fakeClient({ functions: { invoke } }), 'item', [{ uci: 'e2e4', ms: 1 }]),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });
});
