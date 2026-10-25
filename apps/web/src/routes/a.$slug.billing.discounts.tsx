import { useBilling, useBillingMutations, useDiscounts, usePlans } from '@erpchess/api/react';
import { type DiscountKind, discountKinds, discountUsable, formatMoney } from '@erpchess/domain';
import { createFileRoute } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { BillingNav, CurrencySelect, MoneyInput } from '../components/billing';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/billing/discounts')({
  component: DiscountsPage,
});

function DiscountsPage() {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  const list = useDiscounts(academy.id);
  const plans = usePlans(academy.id);
  const { setDiscountActive, deleteDiscount } = useBillingMutations(academy.id);
  const [kind, setKind] = useState('');

  if (academy.role !== 'owner') return <p className="text-text-muted">{t('bill.ownerOnly')}</p>;

  const today = new Date().toISOString().slice(0, 10);
  const all = list.data ?? [];
  const rows = all.filter((d) => !kind || d.kind === kind);
  const planName = (id: string) => plans.data?.find((p) => p.id === id)?.name ?? '';
  const stats = [
    { label: t('bill.statTotal'), value: all.length },
    {
      label: t('bill.statActive'),
      value: all.filter((d) => discountUsable(d, today, d.uses)).length,
    },
    { label: t('bill.statUses'), value: all.reduce((s, d) => s + d.uses, 0) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <BillingNav />
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-primary">{s.value}</p>
            <p className="text-sm text-text-muted">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card title={t('bill.discounts')}>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="self-start rounded-md border border-text-muted/30 bg-white px-2 py-2 text-sm"
          >
            <option value="">{t('bill.allKinds')}</option>
            {discountKinds.map((k) => (
              <option key={k} value={k}>
                {t(`bill.kind_${k}`)}
              </option>
            ))}
          </select>
          {list.isPending ? (
            <Spinner />
          ) : list.error ? (
            <ErrorText error={list.error} />
          ) : rows.length === 0 ? (
            <p className="text-text-muted">{t('bill.noDiscounts')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-text-muted/15">
              {rows.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div
                    className={`flex flex-col ${discountUsable(d, today, d.uses) ? '' : 'opacity-60'}`}
                  >
                    <span className="font-medium">
                      {d.name}
                      {d.code && (
                        <code className="ml-2 rounded-sm bg-bg px-1 text-xs">{d.code}</code>
                      )}
                    </span>
                    <span className="text-sm text-text-muted">
                      {d.kind === 'percent'
                        ? `−${d.value}%`
                        : `−${formatMoney(d.value, d.currency ?? 'VND', i18n.language)}`}
                      {' · '}
                      {t('bill.usesOf', { n: d.uses, max: d.max_uses ?? '∞' })}
                      {(d.starts_on || d.ends_on) &&
                        ` · ${d.starts_on ?? '…'} → ${d.ends_on ?? '…'}`}
                      {' · '}
                      {d.discount_plans.length === 0
                        ? t('bill.allPlans')
                        : d.discount_plans.map((p) => planName(p.plan_id)).join(', ')}
                    </span>
                  </div>
                  <span className="flex gap-1">
                    <Button
                      variant="ghost"
                      onClick={() => setDiscountActive.mutate({ id: d.id, active: !d.active })}
                    >
                      {d.active ? t('bill.deactivate') : t('bill.activate')}
                    </Button>
                    <Button variant="ghost" onClick={() => deleteDiscount.mutate(d.id)}>
                      {t('bill.delete')}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ErrorText error={setDiscountActive.error ?? deleteDiscount.error} />
        </Card>
        <DiscountForm />
      </div>
    </div>
  );
}

function DiscountForm() {
  const { t } = useT();
  const { academy } = useAcademy();
  const settings = useBilling(academy.id);
  const plans = usePlans(academy.id);
  const { saveDiscount } = useBillingMutations(academy.id);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<DiscountKind>('percent');
  const [percent, setPercent] = useState('10');
  const [currency, setCurrency] = useState<string>();
  const [amount, setAmount] = useState<number | null>(null);
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [planIds, setPlanIds] = useState<string[]>([]);
  const cur = currency ?? settings.data?.currency ?? 'VND';

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    saveDiscount.mutate(
      {
        name,
        code: code.trim() || null,
        kind,
        value: kind === 'percent' ? Number(percent) : (amount ?? 0),
        currency: kind === 'fixed' ? (cur as 'VND') : null,
        startsOn: startsOn || null,
        endsOn: endsOn || null,
        maxUses: maxUses.trim() ? Number(maxUses) : null,
        planIds,
      },
      {
        onSuccess: () => {
          setName('');
          setCode('');
          setAmount(null);
          setMaxUses('');
          setPlanIds([]);
        },
      },
    );
  }

  const select = 'rounded-md border border-text-muted/30 bg-white px-3 py-2';
  return (
    <Card title={t('bill.newDiscount')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 text-sm">
        <Field
          label={t('bill.discountName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
        />
        <Field
          label={t('bill.code')}
          hint={t('bill.codeHint')}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          pattern="[A-Za-z0-9_\-]{2,32}"
        />
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('bill.kind')}</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as DiscountKind)}
            className={select}
          >
            {discountKinds.map((k) => (
              <option key={k} value={k}>
                {t(`bill.kind_${k}`)}
              </option>
            ))}
          </select>
        </label>
        {kind === 'percent' ? (
          <Field
            label={t('bill.percent')}
            type="number"
            min={1}
            max={100}
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            required
          />
        ) : (
          <div className="flex items-end gap-2">
            <CurrencySelect value={cur} onChange={setCurrency} />
            <MoneyInput amount={amount} currency={cur} onChange={setAmount} required />
          </div>
        )}
        <div className="flex gap-2">
          <Field
            label={t('bill.startsOn')}
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
          <Field
            label={t('bill.endsOn')}
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
          />
        </div>
        <Field
          label={t('bill.maxUses')}
          type="number"
          min={1}
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
        />
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-medium">{t('bill.appliesTo')}</legend>
          <p className="text-xs text-text-muted">{t('bill.appliesHint')}</p>
          {(plans.data ?? []).map((p) => (
            <label key={p.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={planIds.includes(p.id)}
                onChange={(e) =>
                  setPlanIds(
                    e.target.checked ? [...planIds, p.id] : planIds.filter((x) => x !== p.id),
                  )
                }
              />
              {p.name}
            </label>
          ))}
        </fieldset>
        <ErrorText error={saveDiscount.error} />
        <Button
          type="submit"
          variant="cta"
          className="self-start"
          disabled={saveDiscount.isPending}
        >
          {t('bill.save')}
        </Button>
      </form>
    </Card>
  );
}
