import { describe, expect, it, vi } from 'vitest';
import type { ErpClient } from './client';
import { cancelQuickPair, createChallenge, parseQuickPair, quickPair } from './games';

const ACADEMY = '00000000-0000-0000-0000-0000000000a1';
const GAME = '00000000-0000-0000-0000-0000000000g1';

function fakeClient(rpc: ReturnType<typeof vi.fn>): ErpClient {
  return { rpc } as unknown as ErpClient;
}

describe('parseQuickPair', () => {
  it('đọc trạng thái chờ, ghép xong và mặc định huỷ', () => {
    expect(
      parseQuickPair({ status: 'waiting', rating: 1512.4, window: 150, waited_ms: 12000 }),
    ).toEqual({ status: 'waiting', rating: 1512, window: 150, waitedMs: 12000 });
    expect(parseQuickPair({ status: 'matched', game_id: GAME })).toEqual({
      status: 'matched',
      gameId: GAME,
    });
    expect(parseQuickPair({ status: 'matched' })).toEqual({ status: 'cancelled' });
    expect(parseQuickPair(null)).toEqual({ status: 'cancelled' });
  });
});

describe('quickPair / cancelQuickPair', () => {
  it('gọi RPC với mức thời gian và trả trạng thái đã đọc', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: { status: 'matched', game_id: GAME }, error: null });
    const state = await quickPair(fakeClient(rpc), ACADEMY, { baseMs: 300_000, incMs: 0 });
    expect(rpc).toHaveBeenCalledWith('quick_pair', {
      p_academy: ACADEMY,
      p_base_ms: 300_000,
      p_inc_ms: 0,
    });
    expect(state).toEqual({ status: 'matched', gameId: GAME });
  });

  it('huỷ hàng đợi', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: 'cancelled' }, error: null });
    expect(await cancelQuickPair(fakeClient(rpc), ACADEMY)).toEqual({ status: 'cancelled' });
    expect(rpc).toHaveBeenCalledWith('cancel_quick_pair', { p_academy: ACADEMY });
  });

  it('ném lỗi khi RPC báo lỗi', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'forbidden' } });
    await expect(
      quickPair(fakeClient(rpc), ACADEMY, { baseMs: 300_000, incMs: 0 }),
    ).rejects.toBeTruthy();
  });
});

describe('createChallenge', () => {
  it('gọi RPC create_challenge và trả id ván', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: GAME, error: null });
    const id = await createChallenge(fakeClient(rpc), {
      academyId: ACADEMY,
      opponentId: 'u2',
      color: 'random',
      baseMs: null,
      incMs: 0,
      rated: false,
    });
    expect(id).toBe(GAME);
    expect(rpc).toHaveBeenCalledWith('create_challenge', {
      p_academy: ACADEMY,
      p_opponent: 'u2',
      p_color: 'random',
      p_base_ms: null,
      p_inc_ms: 0,
      p_rated: false,
    });
  });
});
