/**
 * Tải file mạng NNUE (~25 MB, ~11 MB khi server nén brotli) có báo tiến độ,
 * và giữ trong Cache Storage để lần sau mở app không phải tải lại.
 */

export type DownloadProgress = { loaded: number; total: number | null };

const CACHE_NAME = 'erpchess-engine-v1';

export async function loadNetwork(
  url: string,
  onProgress?: (p: DownloadProgress) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<Uint8Array> {
  const cache = await openCache();
  const cached = await cache?.match(url);
  if (cached) {
    const bytes = new Uint8Array(await cached.arrayBuffer());
    onProgress?.({ loaded: bytes.byteLength, total: bytes.byteLength });
    return bytes;
  }

  const response = await fetchImpl(url);
  if (!response.ok || !response.body) {
    throw new Error(`Không tải được mạng NNUE (${response.status})`);
  }
  // Content-Length là kích thước sau nén; khi server nén thì không dùng làm tổng được
  const encoded = response.headers.get('content-encoding');
  const length = Number(response.headers.get('content-length'));
  const total = !encoded && length > 0 ? length : null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress?.({ loaded, total });
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  await cache?.put(
    url,
    new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } }),
  );
  return bytes;
}

async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches === 'undefined' ? null : await caches.open(CACHE_NAME);
  } catch {
    // Cache Storage có thể bị chặn (chế độ riêng tư); vẫn chạy được, chỉ là không cache
    return null;
  }
}
