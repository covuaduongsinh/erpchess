import { useMarkNotificationsRead, useMyNotifications } from '@erpchess/api/react';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { formatDateTime } from '../lib/format';
import { useT } from '../lib/use-t';

/** Chuông thông báo ở thanh trên: số chưa đọc (realtime), danh sách, bấm để mở và đánh dấu đã đọc. */
export function NotificationBell({ userId }: { userId: string }) {
  const { t, i18n } = useT();
  const router = useRouter();
  const list = useMyNotifications(userId, { limit: 20 });
  const markRead = useMarkNotificationsRead(userId);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const items = list.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={t('notify.title')}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="relative rounded-sm px-2 py-1 hover:bg-white/20"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-orange px-1 text-center text-xs font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 flex max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg bg-white text-text shadow-lg">
          <div className="flex items-center justify-between border-b border-text-muted/15 px-4 py-2">
            <span className="font-bold text-primary">{t('notify.title')}</span>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => markRead.mutate({})}
              >
                {t('notify.markAll')}
              </button>
            )}
          </div>
          <ul className="flex-1 divide-y divide-text-muted/10 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-text-muted">{t('notify.none')}</li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-bg ${
                      n.read_at ? 'opacity-70' : ''
                    }`}
                    onClick={() => {
                      if (!n.read_at) markRead.mutate({ ids: [n.id] });
                      setOpen(false);
                      if (n.link) router.history.push(n.link);
                    }}
                  >
                    <span className="flex items-start gap-2 text-sm font-medium">
                      {!n.read_at && (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-orange" />
                      )}
                      {n.title}
                    </span>
                    {n.body && <span className="text-xs text-text-muted">{n.body}</span>}
                    <span className="text-xs text-text-muted">
                      {formatDateTime(n.created_at, i18n.language)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
