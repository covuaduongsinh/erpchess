// Kiểm HTTPS của instance mới. Chủ ý KHÔNG tắt kiểm chứng chỉ để gọi API (không gửi khoá qua kênh chưa xác thực):
// chỉ mở một kết nối TLS "chỉ để đọc chứng chỉ" và báo cho chủ dự án biết chứng chỉ đang là gì.
import tls from 'node:tls';

/** Mô tả bằng tiếng Việt cho mã lỗi chứng chỉ của Node/OpenSSL. */
export function describeTlsError(code) {
  switch (code) {
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'SELF_SIGNED_CERT_IN_CHAIN':
      return 'chứng chỉ TỰ KÝ (Traefik đang dùng "TRAEFIK DEFAULT CERT" — chưa cấp Let\'s Encrypt)';
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
    case 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY':
      return 'không xác minh được chuỗi chứng chỉ';
    case 'CERT_HAS_EXPIRED':
      return 'chứng chỉ đã HẾT HẠN';
    case 'ERR_TLS_CERT_ALTNAME_INVALID':
      return 'chứng chỉ không khớp tên miền';
    default:
      return code ? `lỗi chứng chỉ (${code})` : 'lỗi chứng chỉ không rõ';
  }
}

/** Kết nối TLS tới host:443, trả thông tin chứng chỉ và kết quả xác minh. */
export function probeTls(urlStr, { timeoutMs = 10000 } = {}) {
  const u = new URL(urlStr);
  const port = Number(u.port || 443);
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: u.hostname, port, servername: u.hostname, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        const info = {
          authorized: socket.authorized,
          authError: socket.authorizationError ? String(socket.authorizationError) : null,
          subject: cert?.subject?.CN ?? null,
          issuer: cert?.issuer?.CN ?? cert?.issuer?.O ?? null,
          validTo: cert?.valid_to ?? null,
        };
        socket.end();
        resolve(info);
      },
    );
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      reject(new Error(`Hết thời gian kết nối TLS tới ${u.hostname}:${port}`));
    });
    socket.on('error', reject);
  });
}

/**
 * Kiểm HTTPS hợp lệ rồi gọi /auth/v1/health bằng anon key.
 * Trả { ok, message }. Chứng chỉ không hợp lệ → ok=false và KHÔNG gọi health.
 */
export async function checkHttps(baseUrl, anonKey, { probe = probeTls, fetchImpl = fetch } = {}) {
  let info;
  try {
    info = await probe(baseUrl);
  } catch (e) {
    return { ok: false, message: `Không kết nối được HTTPS: ${e.message}` };
  }
  if (!info.authorized) {
    const what = describeTlsError(info.authError);
    return {
      ok: false,
      message: `HTTPS KHÔNG hợp lệ: ${what}. Người cấp: ${info.issuer ?? '?'}, chủ thể: ${info.subject ?? '?'}. Cấp chứng chỉ Let's Encrypt trong Dokploy rồi chạy lại; chưa gọi API, chưa gửi khoá.`,
    };
  }
  let res;
  try {
    res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/auth/v1/health`, {
      headers: { apikey: anonKey },
    });
  } catch (e) {
    return {
      ok: false,
      message: `HTTPS hợp lệ nhưng gọi /auth/v1/health lỗi: ${e.cause?.code ?? e.message}`,
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      message: `HTTPS hợp lệ (đến ${info.validTo ?? '?'}) nhưng /auth/v1/health trả HTTP ${res.status} (kiểm NEW_ANON_KEY)`,
    };
  }
  return {
    ok: true,
    message: `HTTPS hợp lệ (${info.issuer ?? '?'}, đến ${info.validTo ?? '?'}); /auth/v1/health OK`,
  };
}
