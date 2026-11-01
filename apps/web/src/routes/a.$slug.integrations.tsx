import { useBilling } from '@erpchess/api/react';
import { VN_BANKS } from '@erpchess/domain';
import { createFileRoute } from '@tanstack/react-router';
import { CreditCard, Landmark, Mail, Plug, Wallet } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { IntegrationCard } from '../components/integrations/IntegrationCard';
import { InviteSenderModal } from '../components/integrations/InviteSenderModal';
import { VietQrModal } from '../components/integrations/VietQrModal';
import { PageHeader } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/integrations')({
  component: IntegrationsPage,
});

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-text-muted">{title}</h2>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</ul>
    </section>
  );
}

/** Quản trị → Học viện → Tích hợp: gom các cấu hình liên lạc và thanh toán (chỉ chủ học viện). */
function IntegrationsPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  const billing = useBilling(academy.id);
  const [open, setOpen] = useState<'sender' | 'vietqr' | null>(null);
  if (academy.role !== 'owner') {
    return <p className="text-text-muted">{t('integrations.ownerOnly')}</p>;
  }

  const contact = (academy.contact ?? {}) as Record<string, string | undefined>;
  const senderOk = !!contact.replyTo;
  const bankName = VN_BANKS.find((b) => b.bin === billing.data?.bank_bin)?.name;
  const bankOk = !!billing.data?.bank_bin && !!billing.data?.bank_account;

  return (
    <>
      <PageHeader
        icon={Plug}
        title={t('integrations.title')}
        subtitle={t('integrations.subtitle')}
      />
      <Group title={t('integrations.groupComms')}>
        <IntegrationCard
          icon={Mail}
          title={t('integrations.senderTitle')}
          description={t('integrations.senderDesc')}
          status={senderOk ? 'configured' : 'notConfigured'}
          summary={t('integrations.senderSummary', {
            name: contact.senderName || academy.name,
            email: contact.replyTo ?? '',
          })}
          onConfigure={() => setOpen('sender')}
        />
      </Group>
      <Group title={t('integrations.groupPayments')}>
        <IntegrationCard
          icon={Landmark}
          title={t('integrations.vietqrTitle')}
          description={t('integrations.vietqrDesc')}
          status={bankOk ? 'configured' : 'notConfigured'}
          summary={t('integrations.vietqrSummary', {
            bank: bankName ?? billing.data?.bank_bin ?? '',
            account: billing.data?.bank_account ?? '',
          })}
          onConfigure={() => setOpen('vietqr')}
        />
        <IntegrationCard
          icon={Wallet}
          title={t('integrations.payosTitle')}
          description={t('integrations.payosDesc')}
          status="soon"
        />
        <IntegrationCard
          icon={CreditCard}
          title={t('integrations.stripeTitle')}
          description={t('integrations.stripeDesc')}
          status="soon"
        />
      </Group>
      {open === 'sender' && <InviteSenderModal onClose={() => setOpen(null)} />}
      {open === 'vietqr' && <VietQrModal onClose={() => setOpen(null)} />}
    </>
  );
}
