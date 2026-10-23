import { useState } from 'react';
import { useT } from '../lib/use-t';
import { Button } from './ui';

/** Hiện link lời mời kèm nút sao chép. */
export function InviteLink({ token }: { token: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const url = new URL(`/invite/${token}`, window.location.origin).href;

  return (
    <div className="flex flex-col gap-2 rounded-md bg-bg p-3 text-sm">
      <span>{t('academy.inviteLink')}</span>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-sm bg-white px-2 py-1">{url}</code>
        <Button
          variant="ghost"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => setCopied(true));
          }}
        >
          {copied ? t('common.copied') : t('common.copy')}
        </Button>
      </div>
    </div>
  );
}
