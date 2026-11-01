import { useEmailLog, useEmailStatus, useSendTestEmail } from '@erpchess/api/react';
import type { TranslationKey } from '@erpchess/i18n';
import { createFileRoute } from '@tanstack/react-router';
import { Mail } from 'lucide-react';
import { Badge, Button, Card, ErrorText, PageHeader, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime } from '../lib/format';
import { useT } from '../lib/use-t';

/** `chu@clb.vn` → `ch***@clb.vn`: đủ để nhận ra hộp thư, không lộ cả địa chỉ trên màn hình. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return email;
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}

export const Route = createFileRoute('/a/$slug/email')({
  component: EmailPage,
});

/**
 * Quản trị → Vận hành → Email: trạng thái gửi email qua Resend (chỉ biết đã cấu hình hay chưa, KHÔNG bao giờ
 * hiện khoá), gửi thử tới chính mình và nhật ký 50 email gần nhất. Chỉ chủ học viện.
 */
function EmailPage() {
  const { t, i18n } = useT();
  const { academy, session } = useAcademy();
  const owner = academy.role === 'owner';
  const status = useEmailStatus(owner ? academy.id : undefined);
  const log = useEmailLog(owner ? academy.id : undefined);
  const test = useSendTestEmail(academy.id);
  if (!owner) return <p className="text-text-muted">{t('emailPage.ownerOnly')}</p>;

  const myEmail = session.user.email ?? '';
  const s = status.data;

  return (
    <>
      <PageHeader icon={Mail} title={t('emailPage.title')} subtitle={t('emailPage.subtitle')} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={t('emailPage.statusTitle')}>
          {status.isPending ? (
            <p className="text-sm text-text-muted">{t('emailPage.checking')}</p>
          ) : status.error || !s ? (
            <p role="alert" className="text-sm text-danger">
              {t('emailPage.unreachable')}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={s.configured ? 'success' : 'warn'}>
                  {s.configured ? t('emailPage.configured') : t('emailPage.notConfigured')}
                </Badge>
                <span className="text-sm text-text-muted">
                  {t('emailPage.usage', { used: s.usedLastHour, limit: s.limitPerHour })}
                </span>
              </div>
              <p className="text-sm">
                <span className="text-text-muted">{t('emailPage.fromLabel')}: </span>
                <code className="rounded-sm bg-bg px-1.5 py-0.5">{s.from}</code>
              </p>
              {s.configured && s.sandbox && (
                <p className="rounded-md bg-yellow/20 p-3 text-sm">{t('emailPage.sandboxNote')}</p>
              )}
            </>
          )}
          {!s?.configured && !status.isPending && (
            <div className="flex flex-col gap-2 rounded-md bg-bg p-3 text-sm">
              <h3 className="font-semibold">{t('emailPage.setupTitle')}</h3>
              <ol className="list-decimal pl-5">
                {(['setup1', 'setup2', 'setup3', 'setup4'] as const).map((k) => (
                  <li key={k}>{t(`emailPage.${k}`)}</li>
                ))}
              </ol>
            </div>
          )}
        </Card>

        <Card title={t('emailPage.testTitle')}>
          {myEmail ? (
            <>
              <p className="text-sm text-text-muted">
                {t('emailPage.testHint', { email: maskEmail(myEmail) })}
              </p>
              <Button
                variant="cta"
                className="self-start"
                disabled={test.isPending}
                onClick={() =>
                  test.mutate({ to: myEmail, locale: i18n.language === 'en' ? 'en' : 'vi' })
                }
              >
                {test.isPending ? t('emailPage.testSending') : t('emailPage.testButton')}
              </Button>
            </>
          ) : (
            <p className="text-sm text-text-muted">{t('emailPage.noOwnEmail')}</p>
          )}
          {test.isSuccess && (
            <p role="status" className="text-sm text-green">
              {t('emailPage.testOk', { email: maskEmail(myEmail) })}
            </p>
          )}
          <ErrorText error={test.error} />
        </Card>
      </div>

      <Card title={t('emailPage.logTitle')}>
        {log.isPending ? (
          <Spinner />
        ) : log.error ? (
          <ErrorText error={log.error} />
        ) : (log.data ?? []).length === 0 ? (
          <p className="text-sm text-text-muted">{t('emailPage.logEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs font-semibold text-text-muted uppercase">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    {t('emailPage.colTime')}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {t('emailPage.colKind')}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {t('emailPage.colTo')}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {t('emailPage.colStatus')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(log.data ?? []).map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDateTime(row.created_at, i18n.language)}
                    </td>
                    <td className="px-3 py-2">
                      {t(`emailPage.kind_${row.kind}` as TranslationKey)}
                    </td>
                    <td className="px-3 py-2 break-all">{row.to_email}</td>
                    <td className="px-3 py-2">
                      <Badge tone={row.status === 'sent' ? 'success' : 'warn'}>
                        {row.status === 'sent'
                          ? t('emailPage.statusSent')
                          : t('emailPage.statusFailed')}
                      </Badge>
                      {row.error && (
                        <p className="mt-1 max-w-xs text-xs break-words text-text-muted">
                          {row.error}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
