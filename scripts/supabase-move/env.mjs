// Đọc .env.supabase-move và che bí mật khỏi mọi thông điệp in ra.
import { readFileSync } from 'node:fs';

export const ENV_KEYS = [
  'OLD_DATABASE_URL',
  'OLD_SUPABASE_URL',
  'OLD_SERVICE_ROLE_KEY',
  'NEW_DATABASE_URL',
  'NEW_SUPABASE_URL',
  'NEW_ANON_KEY',
  'NEW_SERVICE_ROLE_KEY',
];

/** `KEY=VALUE` mỗi dòng; bỏ dòng trống và dòng bắt đầu bằng #; bỏ chú thích ` # …` sau giá trị; gỡ ngoặc kép/đơn. */
export function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    const q = val[0];
    if ((q === '"' || q === "'") && val.lastIndexOf(q) > 0) {
      val = val.slice(1, val.lastIndexOf(q));
    } else {
      val = val.replace(/\s+#.*$/, '');
    }
    out[key] = val;
  }
  return out;
}

export function loadEnv(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    throw new Error(
      `Không đọc được ${path}. Tạo tệp này theo docs/plans/21-chuyen-supabase-sang-self-host.md mục 2 (tệp bị gitignore).`,
    );
  }
  return parseEnv(text);
}

/** Kiểm các khoá bắt buộc; báo TÊN khoá thiếu, không bao giờ in giá trị. */
export function requireKeys(env, keys) {
  const missing = keys.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Thiếu trong .env.supabase-move: ${missing.join(', ')}`);
}

const SECRET_KEY = /(KEY|PASSWORD|SECRET|TOKEN)/i;

/** Tập chuỗi bí mật: giá trị các khoá nhạy cảm, nguyên chuỗi kết nối và mật khẩu trong chuỗi kết nối. */
export function secretsOf(env) {
  const set = new Set();
  for (const [k, v] of Object.entries(env)) {
    if (!v) continue;
    if (SECRET_KEY.test(k) || /DATABASE_URL$/.test(k)) set.add(v);
    if (/DATABASE_URL$/.test(k)) {
      try {
        const u = new URL(v);
        if (u.password) {
          set.add(u.password);
          set.add(decodeURIComponent(u.password));
        }
      } catch {
        // chuỗi không phải URL hợp lệ thì chỉ che nguyên chuỗi
      }
    }
  }
  return [...set].filter((s) => s.length >= 4).sort((a, b) => b.length - a.length);
}

/** Thay mọi bí mật trong `text` bằng `***`. */
export function redact(text, secrets) {
  let out = String(text);
  for (const s of secrets) out = out.split(s).join('***');
  return out;
}
