/**
 * Khởi động Arasan WASM trong trình duyệt (web và desktop Tauri dùng chung).
 * Module Emscripten nạp trên luồng chính, nhưng main() của engine chạy trên pthread
 * (Web Worker) nên giao diện không bị chặn khi engine tính toán.
 */
import { UciEngine } from '../engine';
import { type ArasanFactory, createWasmTransport } from '../wasm';
import { type DownloadProgress, loadNetwork } from './network';
import { engineSupport } from './support';

export type { DownloadProgress } from './network';
export { loadNetwork } from './network';
export { type EngineSupport, engineSupport } from './support';

export type BrowserEngineOptions = {
  /** Thư mục chứa arasan-<variant>.mjs/.wasm, vd. "/engine/" */
  baseUrl: string;
  /** URL file NNUE (có thể ở CDN/Supabase Storage). */
  networkUrl: string;
  variant?: 'sse41' | 'sse2';
  hashMb?: number;
  onProgress?: (p: DownloadProgress) => void;
};

export class EngineUnavailableError extends Error {
  override name = 'EngineUnavailableError';
  constructor(readonly reason: string) {
    super(`Trình duyệt không chạy được engine: ${reason}`);
  }
}

export async function createBrowserEngine({
  baseUrl,
  networkUrl,
  variant = 'sse41',
  hashMb = 64,
  onProgress,
}: BrowserEngineOptions): Promise<UciEngine> {
  const support = engineSupport();
  if (!support.ok) throw new EngineUnavailableError(support.reason);

  const base = new URL(baseUrl, globalThis.location?.href);
  const moduleUrl = new URL(`arasan-${variant}.mjs`, base).href;
  const [{ default: factory }, network] = await Promise.all([
    import(/* @vite-ignore */ moduleUrl) as Promise<{ default: ArasanFactory }>,
    loadNetwork(networkUrl, onProgress),
  ]);
  const networkName = decodeURIComponent(new URL(networkUrl, base).pathname.split('/').pop() ?? '');

  const transport = await createWasmTransport({
    factory,
    network,
    networkName,
    locateFile: (path) => new URL(path, base).href,
  });
  const engine = new UciEngine(transport);
  // Đặt rõ đường dẫn NNUE trong FS ảo, phòng khi tên file khác tên mặc định của bản build
  await engine.init({ nnueFile: `/${networkName}`, threads: support.threads, hashMb });
  return engine;
}
