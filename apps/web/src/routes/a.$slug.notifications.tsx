import { type NotificationCategory, notificationCategories } from '@erpchess/api';
import {
  useNotificationAdmin,
  useNotificationLog,
  useNotificationSettings,
  useNotificationStats,
  useReminderRule,
} from '@erpchess/api/react';
import { createFileRoute } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/notifications')({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  if (academy.role !== 'owner') return <p className="text-text-muted">{t('notify.ownerOnly')}</p>;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <CategoriesCard />
        <ReminderCard />
      </div>
      <LogCard />
    </div>
  );
}

function CategoriesCard() {
  const { t } = useT();
  const { academy } = useAcademy();
  const settings = useNotificationSettings(academy.id);
  const stats = useNotificationStats(academy.id);
  const { setEnabled } = useNotificationAdmin(academy.id);
  return (
    <Card title={t('notify.categories')}>
      {settings.isPending ? (
        <Spinner />
      ) : (
        <ul className="flex flex-col divide-y divide-text-muted/15">
          {notificationCategories.map((c) => {
            const on = settings.data?.[c] ?? true;
            const s = stats.data?.find((x) => x.category === c);
            return (
              <li key={c} className="flex items-center justify-between gap-2 py-2">
                <div className="flex flex-col">
                  <span className="font-medium">{t(`notify.cat_${c}`)}</span>
                  <span className="text-xs text-text-muted">
                    {t('notify.statLine', { sent: s?.sent ?? 0, read: s?.read ?? 0 })}
                  </span>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={setEnabled.isPending}
                    onChange={(e) => setEnabled.mutate({ category: c, enabled: e.target.checked })}
                  />
                  {on ? t('notify.on') : t('notify.off')}
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <ErrorText error={settings.error ?? setEnabled.error} />
    </Card>
  );
}

function ReminderCard() {
  const { academy } = useAcademy();
  const rule = useReminderRule(academy.id);
  if (rule.isPending) return <Spinner />;
  if (rule.error) return <ErrorText error={rule.error} />;
  return <ReminderForm initial={rule.data} />;
}

function ReminderForm({ initial }: { initial: { enabled: boolean; days_before: number[] } }) {
  const { t } = useT();
  const { academy } = useAcademy();
  const { saveRule, runNow } = useNotificationAdmin(academy.id);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [days, setDays] = useState(initial.days_before.join(', '));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const list = days
      .split(/[,\s]+/)
      .map((d) => Number.parseInt(d, 10))
      .filter((d) => Number.isInteger(d));
    saveRule.mutate({ enabled, days_before: list });
  }

  return (
    <Card title={t('notify.reminderTitle')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 text-sm">
        <p className="text-text-muted">{t('notify.reminderHint')}</p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {t('notify.reminderEnabled')}
        </label>
        <Field
          label={t('notify.daysBefore')}
          hint={t('notify.daysHint')}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          pattern="[0-9,\s]+"
          required
        />
        <ErrorText error={saveRule.error ?? runNow.error} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="cta" disabled={saveRule.isPending}>
            {t('bill.save')}
          </Button>
          <Button variant="ghost" disabled={runNow.isPending} onClick={() => runNow.mutate()}>
            {t('notify.runNow')}
          </Button>
          {saveRule.isSuccess && <span className="text-green">{t('bill.saved')}</span>}
          {runNow.isSuccess && (
            <span className="text-green">{t('notify.ranNow', { n: runNow.data })}</span>
          )}
        </div>
      </form>
    </Card>
  );
}

function LogCard() {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  const [category, setCategory] = useState('');
  const log = useNotificationLog(academy.id, category || undefined);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <Card title={t('notify.log')}>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="self-start rounded-md border border-text-muted/30 bg-white px-2 py-2 text-sm"
      >
        <option value="">{t('notify.allCategories')}</option>
        {notificationCategories.map((c) => (
          <option key={c} value={c}>
            {t(`notify.cat_${c as NotificationCategory}`)}
          </option>
        ))}
      </select>
      {log.isPending ? (
        <Spinner />
      ) : log.error ? (
        <ErrorText error={log.error} />
      ) : log.data.length === 0 ? (
        <p className="text-text-muted">{t('notify.logEmpty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-text-muted/30 text-left text-text-muted">
                <th className="py-2 pr-3">{t('notify.time')}</th>
                <th className="py-2 pr-3">{t('notify.recipient')}</th>
                <th className="py-2 pr-3">{t('notify.category')}</th>
                <th className="py-2 pr-3">{t('notify.message')}</th>
                <th className="py-2">{t('notify.status')}</th>
              </tr>
            </thead>
            <tbody>
              {log.data.map((n) => (
                <tr key={n.id} className="border-b border-text-muted/10 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {formatDateTime(n.created_at, i18n.language)}
                  </td>
                  <td className="py-2 pr-3">{n.user?.display_name || n.user?.username}</td>
                  <td className="py-2 pr-3">
                    {t(`notify.cat_${n.category as NotificationCategory}`)}
                  </td>
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      className="text-left text-primary hover:underline"
                      onClick={() => setPreview(preview === n.id ? null : n.id)}
                    >
                      {n.title}
                    </button>
                    {preview === n.id && (
                      <p className="mt-1 rounded-md bg-bg p-2 text-xs whitespace-pre-line">
                        {n.body || '—'}
                        {n.link && <span className="block text-text-muted">{n.link}</span>}
                      </p>
                    )}
                  </td>
                  <td className="py-2">
                    {n.read_at ? (
                      <span className="text-green">{t('notify.read')}</span>
                    ) : (
                      <span className="text-text-muted">{t('notify.delivered')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
