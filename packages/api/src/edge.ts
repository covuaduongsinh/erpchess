import type { ErpClient } from './client';
import { ApiError } from './queries';

/** Gọi Edge Function; lỗi HTTP đổi thành ApiError mang mã `error` trong thân phản hồi. */
export async function invokeEdge<T>(
  client: ErpClient,
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.functions.invoke<T>(name, { body });
  if (error) {
    const ctx = (error as { context?: unknown }).context;
    let code: string | undefined;
    if (ctx instanceof Response) {
      try {
        code = ((await ctx.json()) as { error?: string }).error;
      } catch {
        code = undefined;
      }
    }
    throw new ApiError(code ?? error.message, code);
  }
  if (!data) throw new ApiError('Không nhận được phản hồi');
  return data;
}
