/** Thông báo trong app + nhắc đóng phí (Giai đoạn 12b). */
import type { ErpClient } from './client';
import type { Tables } from './database.types';
import { unwrap } from './queries';

export const notificationCategories = [
  'class',
  'quiz',
  'tournament',
  'invoice',
  'invoice_reminder',
  'system',
] as const;
export type NotificationCategory = (typeof notificationCategories)[number];

export type AppNotification = Tables<'notifications'>;
export type NotificationLogRow = AppNotification & {
  user: { display_name: string; username: string | null } | null;
};
export type NotificationStat = {
  category: string;
  sent: number;
  read: number;
  last_sent_at: string | null;
};

/** Thông báo của chính tôi (mọi học viện, hoặc một học viện), mới nhất trước. */
export async function fetchMyNotifications(
  client: ErpClient,
  userId: string,
  opts: { academyId?: string; limit?: number } = {},
): Promise<AppNotification[]> {
  let q = client.from('notifications').select('*').eq('user_id', userId);
  if (opts.academyId) q = q.eq('academy_id', opts.academyId);
  return unwrap(await q.order('created_at', { ascending: false }).limit(opts.limit ?? 30));
}

/** Đánh dấu đã đọc; bỏ `ids` để đánh dấu tất cả (trong học viện nếu truyền `academyId`). */
export async function markNotificationsRead(
  client: ErpClient,
  opts: { ids?: string[]; academyId?: string } = {},
): Promise<number> {
  return unwrap(
    await client.rpc('mark_notifications_read', {
      p_ids: opts.ids,
      p_academy: opts.academyId,
    }),
  );
}

/** Nghe thông báo mới trên kênh riêng `user:<id>`. */
export function subscribeNotifications(
  client: ErpClient,
  userId: string,
  onNotification: (n: Partial<AppNotification>) => void,
) {
  const channel = client
    .channel(`user:${userId}`, { config: { private: true } })
    .on('broadcast', { event: 'notification' }, (msg) =>
      onNotification(msg.payload as Partial<AppNotification>),
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

// ───────────── Cho owner: nhật ký, cài đặt, nhắc phí ─────────────

export async function fetchNotificationLog(
  client: ErpClient,
  academyId: string,
  filter: { category?: string; limit?: number } = {},
): Promise<NotificationLogRow[]> {
  let q = client
    .from('notifications')
    .select('*, user:profiles!notifications_user_id_fkey(display_name, username)')
    .eq('academy_id', academyId);
  if (filter.category) q = q.eq('category', filter.category);
  return unwrap(
    await q.order('created_at', { ascending: false }).limit(filter.limit ?? 100),
  ) as NotificationLogRow[];
}

export async function fetchNotificationStats(
  client: ErpClient,
  academyId: string,
): Promise<NotificationStat[]> {
  const rows = unwrap(
    await client
      .from('notification_stats')
      .select('category, sent, read, last_sent_at')
      .eq('academy_id', academyId),
  );
  return rows.map((r) => ({
    category: r.category ?? '',
    sent: r.sent ?? 0,
    read: r.read ?? 0,
    last_sent_at: r.last_sent_at,
  }));
}

/** Loại nào đang tắt (không có dòng = bật). */
export async function fetchNotificationSettings(
  client: ErpClient,
  academyId: string,
): Promise<Record<string, boolean>> {
  const rows = unwrap(
    await client
      .from('notification_settings')
      .select('category, enabled')
      .eq('academy_id', academyId),
  );
  return Object.fromEntries(rows.map((r) => [r.category, r.enabled]));
}

export async function setNotificationEnabled(
  client: ErpClient,
  academyId: string,
  category: NotificationCategory,
  enabled: boolean,
): Promise<void> {
  unwrap(
    await client.from('notification_settings').upsert({ academy_id: academyId, category, enabled }),
  );
}

export type ReminderRule = { enabled: boolean; days_before: number[] };

/** Quy tắc nhắc phí; mặc định 3 ngày trước và đúng ngày hạn. */
export async function fetchReminderRule(
  client: ErpClient,
  academyId: string,
): Promise<ReminderRule> {
  const row = unwrap(
    await client
      .from('reminder_rules')
      .select('enabled, days_before')
      .eq('academy_id', academyId)
      .eq('kind', 'invoice_due')
      .maybeSingle(),
  );
  return row ?? { enabled: true, days_before: [3, 0] };
}

export async function saveReminderRule(
  client: ErpClient,
  academyId: string,
  rule: ReminderRule,
): Promise<void> {
  const days = [...new Set(rule.days_before)]
    .filter((d) => d >= 0 && d <= 30)
    .sort((a, b) => b - a);
  unwrap(
    await client.from('reminder_rules').upsert({
      academy_id: academyId,
      kind: 'invoice_due',
      enabled: rule.enabled,
      days_before: days.length > 0 ? days.slice(0, 5) : [0],
    }),
  );
}

/** Chạy nhắc phí ngay (owner). Trả số hoá đơn đã nhắc. */
export async function runFeeRemindersNow(client: ErpClient, academyId: string): Promise<number> {
  return unwrap(await client.rpc('run_fee_reminders_now', { p_academy: academyId }));
}
