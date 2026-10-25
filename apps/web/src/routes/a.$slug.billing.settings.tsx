import { useBilling, useBillingMutations } from '@erpchess/api/react';
import { invoiceNumber, VN_BANKS } from '@erpchess/domain';
import { createFileRoute } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { BillingNav, CurrencySelect } from '../components/billing';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/billing/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  const settings = useBilling(academy.id);
  if (academy.role !== 'owner') return <p className="text-text-muted">{t('bill.ownerOnly')}</p>;
  return (
    <div className="flex flex-col gap-4">
      <BillingNav />
      {settings.isPending ? (
        <Spinner />
      ) : settings.error ? (
        <ErrorText error={settings.error} />
      ) : (
        <SettingsForm initial={settings.data} />
      )}
    </div>
  );
}

function SettingsForm({ initial }: { initial: ReturnType<typeof useBilling>['data'] }) {
  const { t } = useT();
  const { academy } = useAcademy();
  const { saveSettings } = useBillingMutations(academy.id);
  const [currency, setCurrency] = useState(initial?.currency ?? 'VND');
  const [taxId, setTaxId] = useState(initial?.tax_id ?? '');
  const [prefix, setPrefix] = useState(initial?.invoice_prefix ?? 'HD');
  const [bankBin, setBankBin] = useState(initial?.bank_bin ?? '');
  const [bankAccount, setBankAccount] = useState(initial?.bank_account ?? '');
  const [bankHolder, setBankHolder] = useState(initial?.bank_holder ?? '');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    saveSettings.mutate({
      currency,
      taxId,
      invoicePrefix: prefix,
      bankBin,
      bankAccount,
      bankHolder,
    });
  }

  const year = new Date().getFullYear();
  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-2">
      <Card title={t('bill.general')}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('bill.defaultCurrency')}</span>
          <CurrencySelect value={currency} onChange={setCurrency} className="self-start" />
          <span className="text-xs text-text-muted">{t('bill.defaultCurrencyHint')}</span>
        </label>
        <Field
          label={t('bill.taxId')}
          value={taxId}
          onChange={(e) => setTaxId(e.target.value)}
          maxLength={32}
        />
        <Field
          label={t('bill.prefix')}
          hint={t('bill.prefixHint', { example: invoiceNumber(prefix || 'HD', year, 1) })}
          value={prefix}
          onChange={(e) => setPrefix(e.target.value.toUpperCase())}
          pattern="[A-Z0-9]{1,8}"
          required
        />
      </Card>
      <Card title={t('bill.bankTitle')}>
        <p className="text-sm text-text-muted">{t('bill.bankHint')}</p>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('bill.bank')}</span>
          <select
            value={bankBin}
            onChange={(e) => setBankBin(e.target.value)}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2"
          >
            <option value="">{t('bill.pickBank')}</option>
            {VN_BANKS.map((b) => (
              <option key={b.bin} value={b.bin}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          label={t('bill.account')}
          value={bankAccount}
          onChange={(e) => setBankAccount(e.target.value.replace(/\s/g, ''))}
          pattern="[0-9A-Za-z]{1,19}"
          required={!!bankBin}
        />
        <Field
          label={t('bill.holder')}
          value={bankHolder}
          onChange={(e) => setBankHolder(e.target.value.toUpperCase())}
          maxLength={80}
        />
      </Card>
      <div className="flex items-center gap-3 lg:col-span-2">
        <Button type="submit" variant="cta" disabled={saveSettings.isPending}>
          {t('bill.save')}
        </Button>
        {saveSettings.isSuccess && <span className="text-sm text-green">{t('bill.saved')}</span>}
        <ErrorText error={saveSettings.error} />
      </div>
    </form>
  );
}
