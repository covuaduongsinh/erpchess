/**
 * Kiểm tích hợp Giai đoạn 13a trên Supabase thật: đọc và cập nhật hồ sơ cá nhân
 * (múi giờ, ký hiệu nước đi, quốc gia, bio).
 */

import { describe, expect, it } from 'vitest';
import { createErpClient } from './client';
import { fetchProfile, updateProfile } from './profile';
import { signInWithEmail } from './queries';

const env: Record<string, string | undefined> =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const ready = ['SUPABASE_URL', 'SUPABASE_KEY', 'OWNER_EMAIL', 'OWNER_PASSWORD'].every(
  (k) => env[k],
);

function newClient() {
  const store = new Map<string, string>();
  return createErpClient({
    url: env.SUPABASE_URL ?? '',
    key: env.SUPABASE_KEY ?? '',
    detectSessionInUrl: false,
    storage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
      removeItem: (k) => void store.delete(k),
    },
  });
}

describe.runIf(ready)('Giai đoạn 13a — Hồ sơ cá nhân và tuỳ chọn', () => {
  it('đọc profile mặc định và cập nhật tuỳ chọn thành công', async () => {
    const client = newClient();
    const session = await signInWithEmail(client, env.OWNER_EMAIL ?? '', env.OWNER_PASSWORD ?? '');
    expect(session.user.id).toBeDefined();

    // 1. Đọc profile hiện tại
    const profile = await fetchProfile(client, session.user.id);
    expect(profile).not.toBeNull();
    expect(profile?.id).toBe(session.user.id);

    // 2. Cập nhật sang figurine và múi giờ mới
    const updated = await updateProfile(client, session.user.id, {
      timezone: 'Asia/Tokyo',
      moveNotation: 'figurine',
      country: 'Vietnam',
      bio: 'Kiểm thử Giai đoạn 13a',
    });
    expect(updated.timezone).toBe('Asia/Tokyo');
    expect(updated.move_notation).toBe('figurine');
    expect(updated.country).toBe('Vietnam');

    // 3. Khôi phục lại về mặc định
    const restored = await updateProfile(client, session.user.id, {
      timezone: 'Asia/Ho_Chi_Minh',
      moveNotation: 'letters',
      bio: null,
    });
    expect(restored.timezone).toBe('Asia/Ho_Chi_Minh');
    expect(restored.move_notation).toBe('letters');
  });
});

describe.skipIf(ready)('Giai đoạn 13a — bỏ qua khi thiếu env', () => {
  it('cần SUPABASE_URL, SUPABASE_KEY, OWNER_EMAIL, OWNER_PASSWORD', () => {
    expect(ready).toBe(false);
  });
});
