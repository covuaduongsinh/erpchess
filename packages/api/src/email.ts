/** Gửi email qua Resend (Giai đoạn 27a): trạng thái, gửi thử, gửi lời mời, nhật ký. Khoá API chỉ nằm ở máy chủ. */
import type { EmailKind } from '@erpchess/domain';
import type { ErpClient } from './client';
import { invokeEdge } from './edge';
import { unwrap } from './queries';

export type EmailStatus = {
  /** Đã đặt secret RESEND_API_KEY trên Edge Function hay chưa (không bao giờ trả về khoá). */
  configured: boolean;
  /** Địa chỉ gửi đi (chỉ phần email, không tên hiển thị). */
  from: string;
  /** Đang dùng địa chỉ thử của Resend (chỉ gửi được tới email chủ tài khoản Resend). */
  sandbox: boolean;
  limitPerHour: number;
  usedLastHour: number;
};

export type EmailLogRow = {
  id: string;
  kind: EmailKind;
  to_email: string;
  subject: string;
  status: 'sent' | 'failed';
  error: string | null;
  created_at: string;
};

const FN = 'send-email';

export async function fetchEmailStatus(client: ErpClient, academyId: string): Promise<EmailStatus> {
  return invokeEdge<EmailStatus>(client, FN, { mode: 'status', academy_id: academyId });
}

/** Gửi email thử tới chính người đang đăng nhập. Lỗi `not_configured` khi chưa có khoá Resend. */
export async function sendTestEmail(
  client: ErpClient,
  academyId: string,
  to: string,
  locale: 'vi' | 'en' = 'vi',
) {
  return invokeEdge<{ ok: true }>(client, FN, {
    mode: 'send',
    academy_id: academyId,
    kind: 'test',
    to,
    locale,
  });
}

/** Gửi lời mời (HLV hoặc phụ huynh) tới một email; `token` là token của lời mời vừa tạo. */
export async function sendInviteEmail(
  client: ErpClient,
  academyId: string,
  role: 'coach' | 'parent',
  to: string,
  token: string,
  locale: 'vi' | 'en' = 'vi',
) {
  return invokeEdge<{ ok: true }>(client, FN, {
    mode: 'send',
    academy_id: academyId,
    kind: role === 'coach' ? 'invite_coach' : 'invite_parent',
    to,
    data: { token },
    locale,
  });
}

/** 50 email gần nhất của học viện (chỉ chủ học viện đọc được). */
export async function fetchEmailLog(client: ErpClient, academyId: string): Promise<EmailLogRow[]> {
  const rows = unwrap(
    await client
      .from('email_log')
      .select('id, kind, to_email, subject, status, error, created_at')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false })
      .limit(50),
  );
  return rows as EmailLogRow[];
}
