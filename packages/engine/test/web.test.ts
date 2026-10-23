import { describe, expect, it, vi } from 'vitest';
import { loadNetwork } from '../src/web/network';
import { engineSupport } from '../src/web/support';

describe('engineSupport', () => {
  const wasm = { validate: () => true };

  it('đủ điều kiện: chừa 1 nhân cho giao diện, tối đa 4 luồng', () => {
    const base = { WebAssembly: wasm, crossOriginIsolated: true, SharedArrayBuffer };
    expect(engineSupport({ ...base, navigator: { hardwareConcurrency: 8 } })).toEqual({
      ok: true,
      threads: 4,
    });
    expect(engineSupport({ ...base, navigator: { hardwareConcurrency: 2 } })).toEqual({
      ok: true,
      threads: 1,
    });
  });

  it('báo đúng lý do khi thiếu điều kiện', () => {
    expect(engineSupport({ WebAssembly: { validate: () => false } })).toEqual({
      ok: false,
      reason: 'no-wasm-simd',
    });
    expect(engineSupport({ WebAssembly: wasm, crossOriginIsolated: false })).toEqual({
      ok: false,
      reason: 'not-cross-origin-isolated',
    });
  });

  it('Node hiện tại có WASM SIMD thật', () => {
    expect(engineSupport({ WebAssembly, crossOriginIsolated: true, SharedArrayBuffer }).ok).toBe(
      true,
    );
  });
});

describe('loadNetwork', () => {
  function streamResponse(parts: number[][], headers: Record<string, string>) {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (const p of parts) c.enqueue(new Uint8Array(p));
        c.close();
      },
    });
    return new Response(body, { headers });
  }

  it('ghép các chunk và báo tiến độ có tổng khi không nén', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      streamResponse(
        [
          [1, 2],
          [3, 4, 5],
        ],
        { 'content-length': '5' },
      ),
    );
    const progress: { loaded: number; total: number | null }[] = [];
    const bytes = await loadNetwork('https://cdn.test/n.nnue', (p) => progress.push(p), fetchImpl);
    expect([...bytes]).toEqual([1, 2, 3, 4, 5]);
    expect(progress.at(-1)).toEqual({ loaded: 5, total: 5 });
  });

  it('không dùng Content-Length làm tổng khi server nén', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        streamResponse([[9, 9, 9]], { 'content-length': '2', 'content-encoding': 'br' }),
      );
    const progress: { total: number | null }[] = [];
    await loadNetwork('https://cdn.test/n2.nnue', (p) => progress.push(p), fetchImpl);
    expect(progress.at(-1)?.total).toBeNull();
  });

  it('báo lỗi khi tải thất bại', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    await expect(loadNetwork('https://cdn.test/x.nnue', undefined, fetchImpl)).rejects.toThrow(
      /404/,
    );
  });
});
