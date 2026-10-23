export type ClientPlatform = 'web' | 'desktop';

/** Tauri tiêm `__TAURI_INTERNALS__` vào window; dùng để biết đang chạy trong app desktop. */
export function detectPlatform(win: object = globalThis): ClientPlatform {
  return '__TAURI_INTERNALS__' in win ? 'desktop' : 'web';
}
