import { useSendInviteEmail } from '@erpchess/api/react';
import { type FormEvent, useState } from 'react';
import { useT } from '../lib/use-t';
import { Button, ErrorText } from './ui';

/**
 * Hiện link lời mời kèm nút sao chép. Có `academyId` và `inviteRole` thì thêm ô "Gửi lời mời qua email"
 * (Edge Function send-email; chưa cấu hình Resend thì báo rõ).
 */
export function InviteLink({
  token,
  academyId,
  inviteRole,
}: {
  token: string;
  academyId?: string;
  inviteRole?: 'coach' | 'parent';
}) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const url = new URL(`/invite/${token}`, window.location.origin).href;

  return (
    <div className="flex flex-col gap-2 rounded-md bg-bg p-3 text-sm">
      <span>{t('academy.inviteLink')}</span>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-sm bg-surface px-2 py-1">{url}</code>
        <Button
          variant="ghost"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => setCopied(true));
          }}
        >
          {copied ? t('common.copied') : t('common.copy')}
        </Button>
      </div>
      {academyId && inviteRole && (
        <InviteEmailForm academyId={academyId} role={inviteRole} token={token} />
      )}
    </div>
  );
}

function InviteEmailForm({
  academyId,
  role,
  token,
}: {
  academyId: string;
  role: 'coach' | 'parent';
  token: string;
}) {
  const { t, i18n } = useT();
  const send = useSendInviteEmail(academyId);
  const [email, setEmail] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send.mutate({ role, to: email.trim(), token, locale: i18n.language === 'en' ? 'en' : 'vi' });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 border-t border-border pt-2">
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t('emailPage.inviteTitle')}</span>
        <div className="flex items-center gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPage.inviteTo')}
            aria-label={t('emailPage.inviteTo')}
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5"
          />
          <Button type="submit" variant="cta" disabled={send.isPending || !email.trim()}>
            {send.isPending ? t('emailPage.inviteSending') : t('emailPage.inviteSend')}
          </Button>
        </div>
      </label>
      {send.isSuccess && (
        <p role="status" className="text-green">
          {t('emailPage.inviteSent', { email: email.trim() })}
        </p>
      )}
      <ErrorText error={send.error} />
    </form>
  );
}
