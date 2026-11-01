import { useUpdateInviteSender } from '@erpchess/api/react';
import { type FormEvent, useState } from 'react';
import { useAcademy } from '../../lib/academy-context';
import { useT } from '../../lib/use-t';
import { Button, ErrorText, Field, Modal } from '../ui';

/** Cấu hình người gửi lời mời: tên hiển thị và email trả lời, lưu trong `academies.contact`. */
export function InviteSenderModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const { academy } = useAcademy();
  const contact = (academy.contact ?? {}) as Record<string, string | undefined>;
  const update = useUpdateInviteSender(academy.id);
  const [senderName, setSenderName] = useState(contact.senderName ?? '');
  const [replyTo, setReplyTo] = useState(contact.replyTo ?? '');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    update.mutate({ senderName, replyTo }, { onSuccess: onClose });
  }

  return (
    <Modal title={t('integrations.senderTitle')} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">{t('integrations.senderDesc')}</p>
        <Field
          label={t('integrations.senderName')}
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          maxLength={80}
        />
        <Field
          label={t('integrations.replyTo')}
          type="email"
          value={replyTo}
          onChange={(e) => setReplyTo(e.target.value)}
          maxLength={120}
        />
        <ErrorText error={update.error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="cta" disabled={update.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
