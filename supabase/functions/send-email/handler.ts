// Logic thuần của Edge Function send-email (Giai đoạn 27a): không import Deno/Supabase để kiểm thử được bằng
// vitest với `fetch` và cơ sở dữ liệu giả lập. `index.ts` nối logic này với Deno.serve và supabase-js.
//
// Chế độ:
//   status  — nhân sự: trạng thái cấu hình gửi email (không bao giờ trả khoá).
//   send    — nhân sự: email thử tới chính mình, hoặc lời mời HLV/phụ huynh tới email của lời mời.
//   flush   — chỉ service role (cron): gửi email cho thông báo quiz/nhắc học phí chưa gửi.
// Nội dung email luôn dựng từ mẫu soạn sẵn (_shared/email.ts); client chỉ gửi dữ liệu.
import {
  buildEmail,
  EMAIL_RATE_LIMIT_PER_HOUR,
  type EmailData,
  type EmailKind,
  type EmailLocale,
  emailCategory,
  formatFrom,
  isDeliverableEmail,
} from './_shared/email.ts';

export const SANDBOX_FROM = 'onboarding@resend.dev';

export type AcademyRow = {
  id: string;
  name: string;
  slug: string;
  contact: { senderName?: string; replyTo?: string } | null;
};

export type InvitationRow = {
  id: string;
  academy_id: string;
  role: 'coach' | 'parent';
  email: string | null;
  student_id: string | null;
  accepted_at: string | null;
  expires_at: string;
};

export type PendingNotification = {
  id: string;
  academy_id: string;
  user_id: string;
  category: string;
  title: string;
  body: string;
  link: string;
};

export type LogRow = {
  academy_id: string;
  kind: EmailKind;
  to_email: string;
  subject: string;
  status: 'sent' | 'failed';
  error: string | null;
  provider_id: string | null;
  notification_id: string | null;
  created_by: string | null;
};

export interface Db {
  userFromJwt(jwt: string): Promise<{ id: string; email: string | null } | null>;
  staffRole(userId: string, academyId: string): Promise<'owner' | 'coach' | null>;
  academy(academyId: string): Promise<AcademyRow | null>;
  categoryEnabled(academyId: string, category: string): Promise<boolean>;
  sentInLastHour(academyId: string): Promise<number>;
  invitationByToken(token: string): Promise<InvitationRow | null>;
  setInvitationEmail(id: string, email: string): Promise<void>;
  displayName(userId: string): Promise<string | null>;
  insertLog(row: LogRow): Promise<void>;
  pendingNotifications(limit: number): Promise<PendingNotification[]>;
  userEmail(userId: string): Promise<string | null>;
  markEmailed(ids: string[]): Promise<void>;
}

export type Deps = {
  env: { resendKey?: string; from?: string; appUrl?: string; serviceKey?: string };
  fetch: typeof fetch;
  now: () => Date;
  db: Db;
};

export type Request = { method: string; authorization: string | null; body: unknown };
export type Response = { status: number; body: Record<string, unknown> };

const res = (status: number, body: Record<string, unknown>): Response => ({ status, body });

const str = (v: unknown, max = 500): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

function bearer(authorization: string | null): string {
  return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

/** Địa chỉ gửi đi: secret RESEND_FROM, chưa có tên miền riêng thì dùng địa chỉ thử của Resend. */
export function fromAddress(env: Deps['env']): string {
  return env.from?.trim() || SANDBOX_FROM;
}

function addressOf(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m?.[1] ?? from).trim();
}

export function appLink(env: Deps['env'], link: string): string {
  if (/^https?:\/\//i.test(link)) return link;
  const base = env.appUrl?.trim().replace(/\/+$/, '') ?? '';
  return base && link.startsWith('/') ? `${base}${link}` : '';
}

type SendArgs = {
  academy: AcademyRow;
  kind: EmailKind;
  to: string;
  data: EmailData;
  locale: EmailLocale;
  createdBy: string | null;
  notificationId?: string;
};

/** Gửi một email qua Resend và ghi nhật ký. Không ném lỗi: trả kết quả để người gọi quyết định. */
async function sendOne(
  deps: Deps,
  a: SendArgs,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const email = buildEmail(a.kind, a.locale, a.data);
  const contact = a.academy.contact ?? {};
  const payload: Record<string, unknown> = {
    from: formatFrom(contact.senderName || a.academy.name, addressOf(fromAddress(deps.env))),
    to: [a.to],
    subject: email.subject,
    html: email.html,
    text: email.text,
  };
  if (contact.replyTo) payload.reply_to = contact.replyTo;

  let ok = false;
  let id: string | null = null;
  let error: string | null = null;
  try {
    const r = await deps.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${deps.env.resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    let parsed: { id?: string; message?: string; name?: string } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      // phản hồi không phải JSON: giữ nguyên văn (đã cắt) làm lỗi
    }
    if (r.ok) {
      ok = true;
      id = parsed.id ?? null;
    } else {
      error = `${r.status} ${parsed.name ?? ''} ${parsed.message ?? text}`.trim().slice(0, 300);
    }
  } catch (e) {
    error = `network: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300);
  }
  await deps.db.insertLog({
    academy_id: a.academy.id,
    kind: a.kind,
    to_email: a.to,
    subject: email.subject,
    status: ok ? 'sent' : 'failed',
    error,
    provider_id: id,
    notification_id: a.notificationId ?? null,
    created_by: a.createdBy,
  });
  return ok ? { ok: true, id: id ?? undefined } : { ok: false, error: error ?? 'unknown' };
}

export async function handleSendEmail(deps: Deps, req: Request): Promise<Response> {
  if (req.method !== 'POST') return res(405, { error: 'method_not_allowed' });
  const token = bearer(req.authorization);
  if (!token) return res(401, { error: 'unauthorized' });
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
    string,
    unknown
  >;
  const mode = str(body.mode, 20) || 'send';
  const isService = !!deps.env.serviceKey && token === deps.env.serviceKey;

  if (mode === 'flush') {
    if (!isService) return res(403, { error: 'forbidden' });
    return flush(deps);
  }

  // Các chế độ còn lại: người dùng đăng nhập là owner/coach của học viện
  if (isService) return res(403, { error: 'forbidden' });
  const user = await deps.db.userFromJwt(token);
  if (!user) return res(401, { error: 'unauthorized' });
  const academyId = str(body.academy_id, 64);
  if (!academyId) return res(400, { error: 'invalid_input', field: 'academy_id' });
  const role = await deps.db.staffRole(user.id, academyId);
  if (!role) return res(403, { error: 'forbidden' });
  const academy = await deps.db.academy(academyId);
  if (!academy) return res(404, { error: 'academy_not_found' });

  if (mode === 'status') {
    const from = fromAddress(deps.env);
    return res(200, {
      configured: !!deps.env.resendKey,
      from: addressOf(from),
      sandbox: addressOf(from).toLowerCase().endsWith('@resend.dev'),
      limitPerHour: EMAIL_RATE_LIMIT_PER_HOUR,
      usedLastHour: await deps.db.sentInLastHour(academyId),
    });
  }
  if (mode !== 'send') return res(400, { error: 'invalid_input', field: 'mode' });

  const kind = str(body.kind, 30) as EmailKind;
  if (kind !== 'test' && kind !== 'invite_coach' && kind !== 'invite_parent') {
    return res(400, { error: 'invalid_input', field: 'kind' });
  }
  const locale: EmailLocale = body.locale === 'en' ? 'en' : 'vi';
  const to = str(body.to, 254).toLowerCase();
  if (!isDeliverableEmail(to)) return res(400, { error: 'invalid_input', field: 'to' });
  const raw = (body.data && typeof body.data === 'object' ? body.data : {}) as Record<
    string,
    unknown
  >;

  const data: EmailData = { academyName: academy.name };
  let invitation: InvitationRow | null = null;
  if (kind === 'test') {
    // Gửi thử chỉ tới chính người đang đăng nhập
    if (!user.email || user.email.toLowerCase() !== to) {
      return res(403, { error: 'recipient_not_allowed' });
    }
  } else {
    const inviteToken = str(raw.token, 128);
    invitation = inviteToken ? await deps.db.invitationByToken(inviteToken) : null;
    if (!invitation || invitation.academy_id !== academyId) {
      return res(404, { error: 'invitation_not_found' });
    }
    if (invitation.role !== (kind === 'invite_coach' ? 'coach' : 'parent')) {
      return res(400, { error: 'invalid_input', field: 'kind' });
    }
    if (invitation.accepted_at || new Date(invitation.expires_at) < deps.now()) {
      return res(409, { error: 'invitation_closed' });
    }
    // Chỉ gửi tới email của lời mời; lời mời chưa có email thì gắn email này vào lời mời
    if (invitation.email && invitation.email.toLowerCase() !== to) {
      return res(403, { error: 'recipient_not_allowed' });
    }
    data.link = appLink(deps.env, `/invite/${inviteToken}`);
    data.inviterName =
      academy.contact?.senderName || (await deps.db.displayName(user.id)) || undefined;
    if (kind === 'invite_parent' && invitation.student_id) {
      data.studentName = (await deps.db.displayName(invitation.student_id)) ?? undefined;
    }
  }

  if (!deps.env.resendKey) return res(503, { error: 'not_configured' });
  if (kind !== 'test' && !(await deps.db.categoryEnabled(academyId, emailCategory[kind]))) {
    return res(409, { error: 'category_disabled' });
  }
  if ((await deps.db.sentInLastHour(academyId)) >= EMAIL_RATE_LIMIT_PER_HOUR) {
    return res(429, { error: 'rate_limited', limitPerHour: EMAIL_RATE_LIMIT_PER_HOUR });
  }
  if (invitation && !invitation.email) await deps.db.setInvitationEmail(invitation.id, to);

  const out = await sendOne(deps, { academy, kind, to, data, locale, createdBy: user.id });
  return out.ok
    ? res(200, { ok: true, id: out.id ?? null })
    : res(502, { error: 'send_failed', detail: out.error });
}

const FLUSH_BATCH = 100;
const CATEGORY_KIND: Record<string, EmailKind | undefined> = {
  quiz: 'quiz_assigned',
  invoice_reminder: 'invoice_reminder',
};

/** Cron: gửi email cho thông báo quiz/nhắc học phí chưa gửi; thông báo không có hộp thư thật thì đánh dấu bỏ qua. */
async function flush(deps: Deps): Promise<Response> {
  if (!deps.env.resendKey) return res(503, { error: 'not_configured' });
  const pending = await deps.db.pendingNotifications(FLUSH_BATCH);
  const done: string[] = [];
  const counts = { sent: 0, failed: 0, skipped: 0, deferred: 0 };
  const used = new Map<string, number>();
  const academies = new Map<string, AcademyRow | null>();

  for (const n of pending) {
    const kind = CATEGORY_KIND[n.category];
    if (!academies.has(n.academy_id))
      academies.set(n.academy_id, await deps.db.academy(n.academy_id));
    const academy = academies.get(n.academy_id) ?? null;
    const email = kind && academy ? await deps.db.userEmail(n.user_id) : null;
    if (!kind || !academy || !isDeliverableEmail(email)) {
      done.push(n.id);
      counts.skipped++;
      continue;
    }
    const before = used.get(n.academy_id) ?? (await deps.db.sentInLastHour(n.academy_id));
    if (before >= EMAIL_RATE_LIMIT_PER_HOUR) {
      counts.deferred++; // chưa đánh dấu: lượt chạy sau gửi tiếp
      continue;
    }
    const out = await sendOne(deps, {
      academy,
      kind,
      to: email.toLowerCase(),
      data: {
        academyName: academy.name,
        title: n.title,
        body: n.body,
        link: appLink(deps.env, n.link),
      },
      locale: 'vi',
      createdBy: null,
      notificationId: n.id,
    });
    used.set(n.academy_id, before + 1);
    done.push(n.id);
    if (out.ok) counts.sent++;
    else counts.failed++;
  }
  if (done.length > 0) await deps.db.markEmailed(done);
  return res(200, { ok: true, ...counts });
}
