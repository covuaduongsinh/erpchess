/** Kiểm tra trình duyệt có chạy được engine WASM không, và vì sao nếu không. */

export type EngineSupport =
  | { ok: true; threads: number }
  | { ok: false; reason: 'no-wasm-simd' | 'not-cross-origin-isolated' | 'no-shared-memory' };

// Module WASM nhỏ nhất dùng lệnh SIMD (theo wasm-feature-detect): validate được nghĩa là có SIMD128
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15,
  253, 98, 11,
]);

type GlobalLike = {
  WebAssembly?: { validate(bytes: BufferSource): boolean };
  crossOriginIsolated?: boolean;
  SharedArrayBuffer?: unknown;
  navigator?: { hardwareConcurrency?: number };
};

export function engineSupport(g: GlobalLike = globalThis as GlobalLike): EngineSupport {
  if (!g.WebAssembly?.validate(SIMD_PROBE)) return { ok: false, reason: 'no-wasm-simd' };
  // pthreads của Emscripten cần SharedArrayBuffer, chỉ có khi trang bật COOP + COEP
  if (g.crossOriginIsolated !== true) return { ok: false, reason: 'not-cross-origin-isolated' };
  if (typeof g.SharedArrayBuffer !== 'function') return { ok: false, reason: 'no-shared-memory' };
  const cores = g.navigator?.hardwareConcurrency ?? 2;
  // Chừa một nhân cho giao diện; tối đa 4 luồng (đủ cho phân tích đào tạo, đỡ nóng máy)
  return { ok: true, threads: Math.max(1, Math.min(4, cores - 1)) };
}
