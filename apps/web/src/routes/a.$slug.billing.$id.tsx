import { invoicePayUrl } from '@erpchess/api';
import { useBillingMutations, useInvoice, usePublicInvoice } from '@erpchess/api/react';
import { formatMoney, type PaymentMethod, paymentMethods } from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { BillingNav, InvoiceSheet, MoneyInput } from '../components/billing';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime } from '../lib/format';
import { useT } from '../lib/use-t';

const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'http://localhost:3000';

export const Route = createFileRoute('/a/$slug/billing/$id')({
  component: InvoicePage,
});

function InvoicePage() {
  const { t, i18n } = useT();
  const { id } = Route.useParams();
  const { academy } = useAcademy();
  const owner = academy.role === 'owner';
  const inv = useInvoice(id);
  const pub = usePublicInvoice(inv.data?.pay_token);
  const { voidInvoice } = useBillingMutations(academy.id);
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  if (inv.isPending || (inv.data && pub.isPending)) return <Spinner />;
  if (inv.error) return <ErrorText error={inv.error} />;
  if (pub.error) return <ErrorText error={pub.error} />;
  const d = inv.data;
  const url = invoicePayUrl(SITE_URL, d.pay_token);

  return (
    <div className="flex flex-col gap-4">
      <BillingNav />
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link
          to="/a/$slug/billing"
          params={{ slug: academy.slug }}
          className="text-sm text-primary hover:underline"
        >
          ← {t('bill.invoices')}
        </Link>
        <Button variant="cta" className="ml-auto" onClick={() => window.print()}>
          {t('bill.print')}
        </Button>
        <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
          {t('bill.payPage')}
        </a>
        {owner && (
          <Button
            variant="ghost"
            onClick={() => void navigator.clipboard.writeText(url).then(() => setCopied(true))}
          >
            {copied ? t('bill.copied') : t('bill.copyLink')}
          </Button>
        )}
        {owner && d.status === 'open' && (
          <Button
            variant="ghost"
            disabled={voidInvoice.isPending}
            onClick={() => (confirm ? voidInvoice.mutate(d.id) : setConfirm(true))}
          >
            {confirm ? t('bill.confirmVoid') : t('bill.void')}
          </Button>
        )}
      </div>
      <ErrorText error={voidInvoice.error} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {pub.data ? <InvoiceSheet inv={pub.data} /> : <p>{t('bill.noInvoices')}</p>}
        <div className="flex flex-col gap-6 print:hidden">
          {owner && d.status === 'open' && (
            <RecordPayment invoiceId={d.id} currency={d.currency} due={d.total - d.paid_amount} />
          )}
          <Card title={t('bill.payments')}>
            {d.payments.length === 0 ? (
              <p className="text-sm text-text-muted">{t('bill.noPayments')}</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {d.payments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span>
                      {formatDateTime(p.paid_at, i18n.language)} ·{' '}
                      {t(`bill.method_${p.method}` as 'bill.method_cash')}
                      {p.reference && ` · ${p.reference}`}
                    </span>
                    <b>{formatMoney(p.amount, d.currency, i18n.language)}</b>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function RecordPayment({
  invoiceId,
  currency,
  due,
}: {
  invoiceId: string;
  currency: string;
  due: number;
}) {
  const { t } = useT();
  const { academy } = useAcademy();
  const { recordPayment } = useBillingMutations(academy.id);
  const [amount, setAmount] = useState<number | null>(due);
  const [method, setMethod] = useState<PaymentMethod>('transfer');
  const [reference, setReference] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!amount) return;
    recordPayment.mutate(
      { invoiceId, amount, method, reference },
      { onSuccess: () => setReference('') },
    );
  }

  return (
    <Card title={t('bill.recordPayment')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 text-sm">
        <p className="text-text-muted">{t('bill.recordHint')}</p>
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('bill.amountIn', { currency })}</span>
          <MoneyInput amount={amount} currency={currency} onChange={setAmount} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('bill.method')}</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2"
          >
            {paymentMethods.map((m) => (
              <option key={m} value={m}>
                {t(`bill.method_${m}`)}
              </option>
            ))}
          </select>
        </label>
        <Field
          label={t('bill.reference')}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          maxLength={120}
        />
        <ErrorText error={recordPayment.error} />
        <Button type="submit" className="self-start" disabled={recordPayment.isPending || !amount}>
          {t('bill.markReceived')}
        </Button>
      </form>
    </Card>
  );
}
