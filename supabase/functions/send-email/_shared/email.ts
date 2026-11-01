// Tự sinh bởi supabase/functions/sync-shared.mjs từ packages/domain/src/email.ts — không sửa tay.
/**
 * Mẫu email soạn sẵn (Giai đoạn 27a). Không phụ thuộc thư viện nào và không import tệp khác để
 * `supabase/functions/sync-shared.mjs` chép nguyên văn sang Edge Function `send-email` (Deno).
 * Nội dung email luôn dựng từ mẫu trong mã này; client chỉ gửi dữ liệu (tên, link…), không gửi HTML.
 */

export const emailKinds = [
  'test',
  'invite_coach',
  'invite_parent',
  'invoice_reminder',
  'quiz_assigned',
] as const;
export type EmailKind = (typeof emailKinds)[number];
export type EmailLocale = 'vi' | 'en';

/** Loại thông báo của học viện (bảng notification_settings) điều khiển việc gửi mỗi loại email. */
export const emailCategory: Record<EmailKind, 'system' | 'invoice_reminder' | 'quiz'> = {
  test: 'system',
  invite_coach: 'system',
  invite_parent: 'system',
  invoice_reminder: 'invoice_reminder',
  quiz_assigned: 'quiz',
};

/** Số email tối đa mỗi học viện mỗi giờ (chống lạm dụng). */
export const EMAIL_RATE_LIMIT_PER_HOUR = 30;

/** Tên miền email giả của học viên đăng nhập bằng PIN: không phải hộp thư thật, không bao giờ gửi tới. */
export const STUDENT_EMAIL_DOMAIN = 'students.erpchess.local';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isDeliverableEmail(email: string | null | undefined): email is string {
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return false;
  return !email.toLowerCase().endsWith(`@${STUDENT_EMAIL_DOMAIN}`);
}

export type EmailData = {
  /** Tên học viện (hiện ở đầu và chân email). */
  academyName: string;
  /** Tên người mời (tên hiển thị của người gửi lời mời hoặc HLV). */
  inviterName?: string;
  /** Tên học viên (lời mời phụ huynh). */
  studentName?: string;
  /** Tiêu đề và nội dung thông báo (nhắc học phí, giao quiz/bài tập). */
  title?: string;
  body?: string;
  /** Link tuyệt đối tới trang liên quan (lời mời, hoá đơn, quiz). */
  link?: string;
};

export type BuiltEmail = { subject: string; html: string; text: string };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Chỉ cho link http(s); mọi thứ khác (javascript:, data:…) bị bỏ. */
export function safeLink(link: string | undefined): string | null {
  if (!link) return null;
  return /^https?:\/\/[^\s"'<>]+$/i.test(link) ? link : null;
}

type Copy = {
  subject: (d: EmailData) => string;
  heading: (d: EmailData) => string;
  lines: (d: EmailData) => string[];
  button: string;
};

const clean = (v: string | undefined, max = 200) =>
  (v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const COPY: Record<EmailLocale, Record<EmailKind, Copy>> = {
  vi: {
    test: {
      subject: (d) => `[${clean(d.academyName, 60)}] Email thử từ ERPChess`,
      heading: () => 'Email thử nghiệm',
      lines: (d) => [
        `Đây là email thử gửi từ học viện ${clean(d.academyName, 80)}.`,
        'Nếu bạn nhận được email này thì cấu hình gửi email đã hoạt động.',
      ],
      button: '',
    },
    invite_coach: {
      subject: (d) =>
        `${clean(d.inviterName, 60) || clean(d.academyName, 60)} mời bạn làm huấn luyện viên`,
      heading: (d) => `Lời mời làm huấn luyện viên tại ${clean(d.academyName, 80)}`,
      lines: (d) => [
        `${clean(d.inviterName, 60) || clean(d.academyName, 80)} mời bạn tham gia ${clean(d.academyName, 80)} với vai trò huấn luyện viên.`,
        'Bấm nút bên dưới để chấp nhận lời mời. Lời mời có hiệu lực 14 ngày.',
      ],
      button: 'Chấp nhận lời mời',
    },
    invite_parent: {
      subject: (d) => `Lời mời theo dõi việc học của ${clean(d.studentName, 60) || 'con bạn'}`,
      heading: (d) => `Lời mời phụ huynh tại ${clean(d.academyName, 80)}`,
      lines: (d) => [
        `${clean(d.academyName, 80)} mời bạn theo dõi việc học của ${clean(d.studentName, 60) || 'con bạn'}: bài tập, quiz, chuyên cần và học phí.`,
        'Bấm nút bên dưới để chấp nhận lời mời. Lời mời có hiệu lực 14 ngày.',
      ],
      button: 'Chấp nhận lời mời',
    },
    invoice_reminder: {
      subject: (d) => clean(d.title, 150) || 'Nhắc đóng học phí',
      heading: (d) => clean(d.title, 150) || 'Nhắc đóng học phí',
      lines: (d) => [clean(d.body, 400), `Học viện: ${clean(d.academyName, 80)}`].filter(Boolean),
      button: 'Xem hoá đơn',
    },
    quiz_assigned: {
      subject: (d) => clean(d.title, 150) || 'Bài mới được giao',
      heading: (d) => clean(d.title, 150) || 'Bài mới được giao',
      lines: (d) => [clean(d.body, 400), `Học viện: ${clean(d.academyName, 80)}`].filter(Boolean),
      button: 'Mở bài',
    },
  },
  en: {
    test: {
      subject: (d) => `[${clean(d.academyName, 60)}] Test email from ERPChess`,
      heading: () => 'Test email',
      lines: (d) => [
        `This is a test email sent from ${clean(d.academyName, 80)}.`,
        'If you received it, email sending is working.',
      ],
      button: '',
    },
    invite_coach: {
      subject: (d) =>
        `${clean(d.inviterName, 60) || clean(d.academyName, 60)} invites you to coach`,
      heading: (d) => `Coach invitation to ${clean(d.academyName, 80)}`,
      lines: (d) => [
        `${clean(d.inviterName, 60) || clean(d.academyName, 80)} invites you to join ${clean(d.academyName, 80)} as a coach.`,
        'Use the button below to accept. The invitation is valid for 14 days.',
      ],
      button: 'Accept invitation',
    },
    invite_parent: {
      subject: (d) => `Invitation to follow ${clean(d.studentName, 60) || 'your child'}’s progress`,
      heading: (d) => `Parent invitation to ${clean(d.academyName, 80)}`,
      lines: (d) => [
        `${clean(d.academyName, 80)} invites you to follow ${clean(d.studentName, 60) || 'your child'}’s progress: homework, quizzes, attendance and fees.`,
        'Use the button below to accept. The invitation is valid for 14 days.',
      ],
      button: 'Accept invitation',
    },
    invoice_reminder: {
      subject: (d) => clean(d.title, 150) || 'Tuition payment reminder',
      heading: (d) => clean(d.title, 150) || 'Tuition payment reminder',
      lines: (d) => [clean(d.body, 400), `Academy: ${clean(d.academyName, 80)}`].filter(Boolean),
      button: 'View invoice',
    },
    quiz_assigned: {
      subject: (d) => clean(d.title, 150) || 'New work assigned',
      heading: (d) => clean(d.title, 150) || 'New work assigned',
      lines: (d) => [clean(d.body, 400), `Academy: ${clean(d.academyName, 80)}`].filter(Boolean),
      button: 'Open',
    },
  },
};

/** Dựng email từ mẫu soạn sẵn; mọi giá trị người dùng được thoát HTML, link chỉ nhận http(s). */
export function buildEmail(kind: EmailKind, locale: EmailLocale, data: EmailData): BuiltEmail {
  const copy = COPY[locale][kind];
  const heading = copy.heading(data);
  const lines = copy.lines(data);
  const link = safeLink(data.link);
  const button = link && copy.button ? copy.button : '';
  const footer = clean(data.academyName, 80);

  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">',
    `<h1 style="font-size:20px;color:#2b3990;margin:0 0 16px">${escapeHtml(heading)}</h1>`,
    ...lines.map(
      (l) => `<p style="font-size:15px;line-height:1.5;margin:0 0 12px">${escapeHtml(l)}</p>`,
    ),
    button
      ? `<p style="margin:20px 0"><a href="${escapeHtml(link as string)}" style="background:#2b3990;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">${escapeHtml(button)}</a></p>`
      : '',
    footer
      ? `<p style="font-size:12px;color:#6b7280;margin-top:24px">${escapeHtml(footer)} · ERPChess</p>`
      : '',
    '</div>',
  ]
    .filter(Boolean)
    .join('');

  const text = [
    heading,
    '',
    ...lines,
    button && link ? `\n${button}: ${link}` : '',
    footer ? `\n${footer} · ERPChess` : '',
  ]
    .filter((x) => x !== '')
    .join('\n');

  return { subject: copy.subject(data), html, text };
}

/** Địa chỉ "from" kèm tên hiển thị: `Tên <email>`; bỏ ký tự có thể phá header. */
export function formatFrom(displayName: string | undefined, address: string): string {
  const name = (displayName ?? '')
    .replace(/[\r\n<>",]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return name ? `${name} <${address}>` : address;
}
