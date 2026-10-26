import type { Plan } from '@erpchess/api';
import { useBilling, useBillingMutations, usePlans } from '@erpchess/api/react';
import {
  formatMoney,
  PLAN_TEMPLATES,
  type PlanPeriod,
  planPeriods,
  templatePrice,
} from '@erpchess/domain';
import { createFileRoute } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { BillingNav, CurrencySelect, MoneyInput } from '../components/billing';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/billing/plans')({
  component: PlansPage,
});

function PlansPage() {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  const plans = usePlans(academy.id);
  const { setPlanActive, deletePlan } = useBillingMutations(academy.id);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [formKey, setFormKey] = useState(0);

  if (academy.role !== 'owner') return <p className="text-text-muted">{t('bill.ownerOnly')}</p>;

  return (
    <div className="flex flex-col gap-4">
      <BillingNav />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card title={t('bill.plans')}>
          {plans.isPending ? (
            <Spinner />
          ) : plans.error ? (
            <ErrorText error={plans.error} />
          ) : plans.data.length === 0 ? (
            <p className="text-text-muted">{t('bill.noPlans')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-text-muted/15">
              {plans.data.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className={`flex flex-col ${p.active ? '' : 'opacity-60'}`}>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-sm text-text-muted">
                      {t(`bill.period_${p.period as PlanPeriod}`)}
                      {p.sessions !== null && ` · ${t('bill.sessionsCount', { n: p.sessions })}`}
                      {' · '}
                      {p.plan_prices
                        .map((x) => formatMoney(x.amount, x.currency, i18n.language))
                        .join(' / ')}
                    </span>
                  </div>
                  <span className="flex gap-1">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditing(p);
                        setFormKey((k) => k + 1);
                      }}
                    >
                      {t('bill.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setPlanActive.mutate({ id: p.id, active: !p.active })}
                    >
                      {p.active ? t('bill.deactivate') : t('bill.activate')}
                    </Button>
                    <Button variant="ghost" onClick={() => deletePlan.mutate(p.id)}>
                      {t('bill.delete')}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ErrorText error={setPlanActive.error ?? deletePlan.error} />
        </Card>
        <PlanForm
          key={formKey}
          plan={editing}
          onDone={() => {
            setEditing(null);
            setFormKey((k) => k + 1);
          }}
        />
      </div>
    </div>
  );
}

type PriceRow = { currency: string; amount: number | null };

function PlanForm({ plan, onDone }: { plan: Plan | null; onDone: () => void }) {
  const { t } = useT();
  const { academy } = useAcademy();
  const settings = useBilling(academy.id);
  const { savePlan } = useBillingMutations(academy.id);
  const base = settings.data?.currency ?? 'VND';
  const [name, setName] = useState(plan?.name ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [sessions, setSessions] = useState(plan?.sessions?.toString() ?? '');
  const [period, setPeriod] = useState<PlanPeriod>((plan?.period as PlanPeriod) ?? 'month');
  const [prices, setPrices] = useState<PriceRow[]>(
    plan?.plan_prices.map((p) => ({ currency: p.currency, amount: p.amount })) ?? [
      { currency: base, amount: null },
    ],
  );
  const [rev, setRev] = useState(0);

  function fromTemplate(key: string) {
    const tpl = PLAN_TEMPLATES.find((x) => x.key === key);
    if (!tpl) return;
    setName(tpl.name);
    setDescription(tpl.description);
    setSessions(tpl.sessions?.toString() ?? '');
    setPeriod(tpl.period);
    setPrices([{ currency: base, amount: templatePrice(tpl, base) }]);
    setRev((r) => r + 1);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    savePlan.mutate(
      {
        id: plan?.id,
        name,
        description,
        sessions: sessions.trim() ? Number(sessions) : null,
        period,
        prices: prices
          .filter((p) => p.amount !== null)
          .map((p) => ({ currency: p.currency as 'VND', amount: p.amount ?? 0 })),
      },
      { onSuccess: onDone },
    );
  }

  const select = 'rounded-md border border-text-muted/30 bg-white px-3 py-2';
  return (
    <Card title={plan ? t('bill.editPlan') : t('bill.newPlan')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 text-sm">
        {!plan && (
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t('bill.fromTemplate')}</span>
            <select
              defaultValue=""
              onChange={(e) => fromTemplate(e.target.value)}
              className={select}
            >
              <option value="">{t('bill.pickTemplate')}</option>
              {PLAN_TEMPLATES.map((tpl) => (
                <option key={tpl.key} value={tpl.key}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <Field
          label={t('bill.planName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
        />
        <Field
          label={t('bill.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
        <div className="flex gap-2">
          <Field
            label={t('bill.sessions')}
            type="number"
            min={0}
            max={1000}
            value={sessions}
            onChange={(e) => setSessions(e.target.value)}
          />
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t('bill.period')}</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PlanPeriod)}
              className={select}
            >
              {planPeriods.map((p) => (
                <option key={p} value={p}>
                  {t(`bill.period_${p}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">{t('bill.prices')}</legend>
          {prices.map((p, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: dòng giá chỉ thêm/bớt cuối, không sắp xếp
            <div key={`${rev}-${i}`} className="flex items-center gap-2">
              <CurrencySelect
                value={p.currency}
                onChange={(c) =>
                  setPrices(prices.map((x, j) => (j === i ? { ...x, currency: c } : x)))
                }
              />
              <MoneyInput
                amount={p.amount}
                currency={p.currency}
                required
                onChange={(a) =>
                  setPrices(prices.map((x, j) => (j === i ? { ...x, amount: a } : x)))
                }
              />
              {prices.length > 1 && (
                <Button variant="ghost" onClick={() => setPrices(prices.filter((_, j) => j !== i))}>
                  ✕
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="ghost"
            className="self-start"
            onClick={() => setPrices([...prices, { currency: 'USD', amount: null }])}
          >
            {t('bill.addPrice')}
          </Button>
        </fieldset>
        <ErrorText error={savePlan.error} />
        <div className="flex gap-2">
          <Button type="submit" variant="cta" disabled={savePlan.isPending}>
            {t('bill.save')}
          </Button>
          {plan && (
            <Button variant="ghost" onClick={onDone}>
              {t('bill.cancel')}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
