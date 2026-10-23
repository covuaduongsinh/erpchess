import 'expo-sqlite/localStorage/install';
import { createErpClient, type ErpClient } from '@erpchess/api';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Khi Expo render tĩnh trong Node (export web), `localStorage` của Node 25 tồn tại nhưng thiếu
 * getItem — dùng bộ nhớ tạm để không crash; trên thiết bị là localStorage của expo-sqlite.
 */
function sessionStorageAdapter() {
  const ls = (globalThis as { localStorage?: Storage }).localStorage;
  if (typeof ls?.getItem === 'function') return ls;
  const mem = new Map<string, string>();
  return {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
}

/** null khi chưa cấu hình .env — app hiện hướng dẫn thay vì crash. */
export const supabase: ErpClient | null =
  url && key
    ? createErpClient({ url, key, storage: sessionStorageAdapter(), detectSessionInUrl: false })
    : null;

// Chỉ làm mới token khi app đang mở (khuyến nghị của Expo cho Android/iOS)
if (supabase) {
  const client = supabase;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void client.auth.startAutoRefresh();
    else void client.auth.stopAutoRefresh();
  });
}
