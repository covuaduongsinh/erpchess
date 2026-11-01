import { describe, expect, it, vi } from 'vitest';
import type { ErpClient } from './client';
import { fetchMembers, setAcademyFideEnabled, setMemberFide } from './queries';

const ACADEMY = '00000000-0000-4000-8000-000000000001';
const STUDENT = '00000000-0000-4000-8000-0000000000a3';

function rpcClient() {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  return { client: { rpc } as unknown as ErpClient, rpc };
}

describe('setMemberFide', () => {
  it('gọi set_member_fide với mã đã chuẩn hoá và 3 Elo', async () => {
    const { client, rpc } = rpcClient();
    await setMemberFide(client, ACADEMY, STUDENT, {
      fideId: ' 12345678 ',
      standard: 1800,
      rapid: null,
      blitz: 1700,
    });
    expect(rpc).toHaveBeenCalledWith('set_member_fide', {
      p_academy: ACADEMY,
      p_student: STUDENT,
      p_fide_id: '12345678',
      p_standard: 1800,
      p_rapid: null,
      p_blitz: 1700,
    });
  });

  it('thiếu trường thì xoá (rỗng/null); sai định dạng thì báo lỗi và không gọi máy chủ', async () => {
    const { client, rpc } = rpcClient();
    await setMemberFide(client, ACADEMY, STUDENT, {});
    expect(rpc).toHaveBeenLastCalledWith('set_member_fide', {
      p_academy: ACADEMY,
      p_student: STUDENT,
      p_fide_id: '',
      p_standard: null,
      p_rapid: null,
      p_blitz: null,
    });
    rpc.mockClear();
    await expect(setMemberFide(client, ACADEMY, STUDENT, { fideId: 'abc' })).rejects.toThrow();
    await expect(setMemberFide(client, ACADEMY, STUDENT, { rapid: 500 })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('setAcademyFideEnabled', () => {
  it('gọi set_academy_fide_enabled', async () => {
    const { client, rpc } = rpcClient();
    await setAcademyFideEnabled(client, ACADEMY, true);
    expect(rpc).toHaveBeenCalledWith('set_academy_fide_enabled', {
      p_academy: ACADEMY,
      p_enabled: true,
    });
  });
});

describe('fetchMembers', () => {
  it('đọc cột FIDE vào member.fide', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          role: 'student',
          level_id: null,
          fide_id: '12345678',
          fide_standard: 1800,
          fide_rapid: null,
          fide_blitz: null,
          profile: { id: STUDENT, display_name: 'An' },
        },
      ],
      error: null,
    });
    const select = vi.fn(() => ({ eq: () => ({ order }) }));
    const client = { from: () => ({ select }) } as unknown as ErpClient;
    const [m] = await fetchMembers(client, ACADEMY);
    expect(select).toHaveBeenCalledWith(expect.stringContaining('fide_standard'));
    expect(m?.fide).toEqual({ id: '12345678', standard: 1800, rapid: null, blitz: null });
  });
});
