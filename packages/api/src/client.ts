import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type ErpClient = SupabaseClient<Database>;

export type ClientOptions = {
  url: string;
  /** Publishable key (sb_publishable_…) hoặc anon key cũ. */
  key: string;
  /** Nơi lưu phiên đăng nhập: web dùng localStorage (mặc định), mobile truyền AsyncStorage. */
  storage?: SupportedStorage;
  /** Web cần true để nhận phiên từ link xác nhận email / OAuth; mobile đặt false. */
  detectSessionInUrl?: boolean;
};

export function createErpClient({
  url,
  key,
  storage,
  detectSessionInUrl = true,
}: ClientOptions): ErpClient {
  if (!url || !key) {
    throw new Error('Thiếu cấu hình Supabase (URL hoặc publishable key)');
  }
  return createClient<Database>(url, key, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl,
    },
  });
}
