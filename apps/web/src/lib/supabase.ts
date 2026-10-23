import { createErpClient, type ErpClient } from '@erpchess/api';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** null khi chưa cấu hình .env — app vẫn chạy và hiện hướng dẫn thay vì trắng trang. */
export const supabase: ErpClient | null = url && key ? createErpClient({ url, key }) : null;
