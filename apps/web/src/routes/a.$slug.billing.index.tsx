import {
  useBilling,
  useBillingMutations,
  useDiscounts,
  useInvoices,
  useMembers,
  usePlans,
} from '@erpchess/api/react';
import { discountAmount, discountUsable, formatMoney, invoiceStatuses } from '@erpchess/domain';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import {
  BillingNav,
  CurrencySelect,
  InvoiceStatus,
  isOverdue,
  MoneyInput,
} from '../components/billing';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDate } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/billing/')({
  component: InvoicesPage,
});

function InvoicesPage() {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  const owner = academy.role === 'owner';
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const list = useInvoices({ academyId: academy.id, status: status || undefined });
  const rows = (list.data ?? []).filter((i) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      i.number.toLowerCase().includes(s) ||
      (i.student?.display_name ?? '').toLowerCase().includes(s) ||
      (i.student?.username ?? '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <BillingNav />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card title={owner ? t('bill.invoices') : t('bill.myInvoices')}>
          {owner && (
            <div className="flex flex-wrap gap-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-md border border-text-muted/30 bg-white px-2 py-2 text-sm"
              >
                <option value="">{t('bill.allStatuses')}</option>
                {invoiceStatuses.map((s) => (
                  <option key={s} value={s}>
                    {t(`bill.status_${s}`)}
                  </option>
                ))}
              </select>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('bill.search')}
                className="min-w-0 flex-1 rounded-md border border-text-muted/30 bg-white px-3 py-2 text-sm"
              />
            </div>
          )}
          {list.isPending ? (
            <Spinner />
          ) : list.error ? (
            <ErrorText error={list.error} />
          ) : rows.length === 0 ? (
            <p className="text-text-muted">{t('bill.noInvoices')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-text-muted/15">
              {rows.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="flex flex-col">
                    <Link
                      to="/a/$slug/billing/$id"
                      params={{ slug: academy.slug, id: i.id }}
                      className="font-mono font-medium text-primary hover:underline"
                    >
                      {i.number}
                    </Link>
                    <span className="text-sm text-text-muted">
                      {i.student?.display_name || i.student?.username} ·{' '}
                      {formatDate(i.issued_at, i18n.language)}
                      {i.due_on &&
                        ` · ${t('bill.dueShort', { date: formatDate(i.due_on, i18n.language) })}`}
                    </span>
                  </div>
                  <span className="flex items-center gap-3">
                    <span className="font-medium">
                      {formatMoney(i.total, i.currency, i18n.language)}
                    </span>
                    <InvoiceStatus status={i.status} overdue={isOverdue(i.due_on, i.status)} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {owner && <CreateInvoice />}
      </div>
    </div>
  );
}

function CreateInvoice() {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  const navigate = useNavigate();
  const members = useMembers(academy.id);
  const plans = usePlans(academy.id);
  const discounts = useDiscounts(academy.id);
  const settings = useBilling(academy.id);
  const { createInvoice } = useBillingMutations(academy.id);
  const [studentId, setStudentId] = useState('');
  const [planId, setPlanId] = useState('');
  const [currency, setCurrency] = useState<string>();
  const [discountId, setDiscountId] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [note, setNote] = useState('');
  const [extra, setExtra] = useState('');
  const [extraAmount, setExtraAmount] = useState<number | null>(null);

  const cur = currency ?? settings.data?.currency ?? 'VND';
  const students = (members.data ?? []).filter((m) => m.role === 'student');
  const plan = plans.data?.find((p) => p.id === planId);
  const planPrice = plan?.plan_prices.find((p) => p.currency === cur)?.amount ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const usable = (discounts.data ?? []).filter(
    (d) =>
      discountUsable(d, today, d.uses) &&
      (d.discount_plans.length === 0 || d.discount_plans.some((p) => p.plan_id === planId)),
  );
  const discount = usable.find((d) => d.id === discountId) ?? null;
  const subtotal = (planPrice ?? 0) + (extra.trim() && extraAmount ? extraAmount : 0);
  const off = discountAmount(subtotal, cur, discount);
  const missingPrice = !!plan && planPrice === null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createInvoice.mutate(
      {
        studentId,
        planId: planId || null,
        currency: cur,
        discountId: discount?.id ?? null,
        dueOn: dueOn || null,
        note,
        lines:
          extra.trim() && extraAmount !== null
            ? [{ description: extra.trim(), quantity: 1, unitAmount: extraAmount }]
            : [],
      },
      {
        onSuccess: (id) =>
          void navigate({ to: '/a/$slug/billing/$id', params: { slug: academy.slug, id } }),
      },
    );
  }

  const select = 'rounded-md border border-text-muted/30 bg-white px-3 py-2';
  return (
    <Card title={t('bill.newInvoice')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('bill.student')}</span>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
            className={select}
          >
            <option value="">{t('bill.pickStudent')}</option>
            {students.map((m) => (
              <option key={m.profile.id} value={m.profile.id}>
                {m.profile.display_name || m.profile.username}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-medium">{t('bill.plan')}</span>
            <select
              value={planId}
              onChange={(e) => {
                setPlanId(e.target.value);
                setDiscountId('');
              }}
              className={select}
            >
              <option value="">{t('bill.noPlan')}</option>
              {(plans.data ?? [])
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t('bill.currency')}</span>
            <CurrencySelect value={cur} onChange={setCurrency} />
          </label>
        </div>
        {missingPrice && (
          <p className="text-danger">{t('bill.noPriceInCurrency', { currency: cur })}</p>
        )}
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('bill.extraLine')}</span>
          <input
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder={t('bill.extraHint')}
            maxLength={200}
            className={select}
          />
        </label>
        {extra.trim() && (
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t('bill.extraAmount', { currency: cur })}</span>
            <MoneyInput amount={extraAmount} currency={cur} onChange={setExtraAmount} required />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('bill.discount')}</span>
          <select
            value={discountId}
            onChange={(e) => setDiscountId(e.target.value)}
            className={select}
          >
            <option value="">{t('bill.noDiscount')}</option>
            {usable.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.code ? ` (${d.code})` : ''}
              </option>
            ))}
          </select>
        </label>
        <Field
          label={t('bill.dueOn')}
          type="date"
          value={dueOn}
          onChange={(e) => setDueOn(e.target.value)}
        />
        <Field
          label={t('bill.note')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
        />
        <p className="rounded-md bg-bg p-3">
          {t('bill.preview', {
            subtotal: formatMoney(subtotal, cur, i18n.language),
            discount: formatMoney(off, cur, i18n.language),
            total: formatMoney(subtotal - off, cur, i18n.language),
          })}
        </p>
        <ErrorText error={createInvoice.error} />
        <Button
          type="submit"
          variant="cta"
          className="self-start"
          disabled={createInvoice.isPending || missingPrice || (!planId && !extra.trim())}
        >
          {t('bill.create')}
        </Button>
      </form>
    </Card>
  );
}
