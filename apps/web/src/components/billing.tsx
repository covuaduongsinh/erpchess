import type { PublicInvoice } from '@erpchess/api';
import {
  bankName,
  currencies,
  formatMoney,
  moneyInputValue,
  parseMoney,
  transferMemo,
  vietQrPayload,
} from '@erpchess/domain';
import { Link } from '@tanstack/react-router';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useAcademy } from '../lib/academy-context';
import { formatDate } from '../lib/format';
import { useT } from '../lib/use-t';

/** Thanh điều hướng con của tab Học phí (chỉ owner). */
export function BillingNav() {
  const { t } = useT();
  const { academy } = useAcademy();
  if (academy.role !== 'owner') return null;
  const links = [
    { to: '/a/$slug/billing', label: t('bill.invoices'), exact: true },
    { to: '/a/$slug/billing/plans', label: t('bill.plans'), exact: false },
    { to: '/a/$slug/billing/discounts', label: t('bill.discounts'), exact: false },
    { to: '/a/$slug/billing/settings', label: t('bill.settings'), exact: false },
  ] as const;
  return (
    <nav className="flex flex-wrap gap-2 print:hidden">
      {links.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          params={{ slug: academy.slug }}
          activeOptions={{ exact: l.exact }}
          className="rounded-full px-3 py-1 text-sm text-text-muted hover:bg-primary/10 data-[status=active]:bg-primary data-[status=active]:text-text-on-primary"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-orange/15 text-orange',
  paid: 'bg-green/15 text-green',
  void: 'bg-text-muted/15 text-text-muted',
};

export function InvoiceStatus({ status, overdue }: { status: string; overdue?: boolean }) {
  const { t } = useT();
  const s = overdue && status === 'open' ? 'overdue' : status;
  return (
    <span
      className={`rounded-sm px-2 py-0.5 text-xs font-medium ${
        s === 'overdue' ? 'bg-danger/15 text-danger' : (STATUS_STYLE[status] ?? '')
      }`}
    >
      {t(`bill.status_${s}` as 'bill.status_open')}
    </span>
  );
}

export function CurrencySelect({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md border border-text-muted/30 bg-white px-2 py-2 ${className}`}
    >
      {currencies.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

/** Ô nhập số tiền; giữ chuỗi người gõ, báo lên đơn vị nhỏ nhất (null nếu không hợp lệ). */
export function MoneyInput({
  amount,
  currency,
  onChange,
  required,
  placeholder,
}: {
  amount: number | null;
  currency: string;
  onChange: (v: number | null) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState(amount === null ? '' : moneyInputValue(amount, currency));
  useEffect(() => {
    if (amount === null) setText('');
  }, [amount]);
  return (
    <input
      inputMode="decimal"
      value={text}
      required={required}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value.trim() ? parseMoney(e.target.value, currency) : null);
      }}
      className="w-full min-w-0 rounded-md border border-text-muted/30 bg-white px-3 py-2"
    />
  );
}

export function isOverdue(dueOn: string | null, status: string): boolean {
  if (!dueOn || status !== 'open') return false;
  return dueOn < new Date().toISOString().slice(0, 10);
}

/** Mã VietQR: chỉ khi học viện đã khai báo tài khoản và hoá đơn bằng VND còn nợ. */
export function VietQr({ inv, size = 200 }: { inv: PublicInvoice; size?: number }) {
  const [src, setSrc] = useState<string>();
  const due = inv.total - inv.paid_amount;
  const payload =
    inv.bank_bin && inv.bank_account && inv.currency === 'VND' && inv.status === 'open' && due > 0
      ? vietQrPayload({
          bin: inv.bank_bin,
          account: inv.bank_account,
          amount: due,
          memo: transferMemo(inv.number),
        })
      : null;
  useEffect(() => {
    if (!payload) return;
    let alive = true;
    void QRCode.toDataURL(payload, { margin: 1, width: size * 2 }).then((d) => alive && setSrc(d));
    return () => {
      alive = false;
    };
  }, [payload, size]);
  if (!payload || !src) return null;
  return <img src={src} alt="VietQR" style={{ width: size, height: size }} />;
}

/** Hoá đơn in được (A4 dọc), dùng chung cho owner, học viên, phụ huynh. */
export function InvoiceSheet({ inv }: { inv: PublicInvoice }) {
  const { t, i18n } = useT();
  const money = (n: number) => formatMoney(n, inv.currency, i18n.language);
  const due = inv.total - inv.paid_amount;
  return (
    <article className="invoice-print flex flex-col gap-6 rounded-lg bg-white p-8 shadow-sm print:rounded-none print:p-[15mm] print:shadow-none">
      <style>{'@media print { @page { size: A4 portrait; margin: 0; } }'}</style>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-4 border-primary pb-4">
        <div>
          <p className="text-xl font-bold text-primary">{inv.academy_name}</p>
          {inv.tax_id && (
            <p className="text-sm text-text-muted">{t('bill.taxIdLine', { id: inv.tax_id })}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-black tracking-wide text-primary uppercase">
            {t('bill.invoice')}
          </p>
          <p className="font-mono">{inv.number}</p>
          <InvoiceStatus status={inv.status} overdue={isOverdue(inv.due_on, inv.status)} />
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-text-muted">{t('bill.student')}</dt>
          <dd className="font-medium">{inv.student_name}</dd>
        </div>
        <div>
          <dt className="text-text-muted">{t('bill.issuedAt')}</dt>
          <dd>{formatDate(inv.issued_at, i18n.language)}</dd>
        </div>
        <div>
          <dt className="text-text-muted">{t('bill.dueOn')}</dt>
          <dd>{inv.due_on ? formatDate(inv.due_on, i18n.language) : '—'}</dd>
        </div>
        {inv.paid_at && (
          <div>
            <dt className="text-text-muted">{t('bill.paidAt')}</dt>
            <dd>{formatDate(inv.paid_at, i18n.language)}</dd>
          </div>
        )}
      </dl>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-text-muted/30 text-left text-text-muted">
            <th className="py-2">{t('bill.item')}</th>
            <th className="py-2 text-right">{t('bill.qty')}</th>
            <th className="py-2 text-right">{t('bill.unitPrice')}</th>
            <th className="py-2 text-right">{t('bill.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: dòng hoá đơn cố định theo position
            <tr key={`${i}`} className="border-b border-text-muted/10">
              <td className="py-2">{l.description}</td>
              <td className="py-2 text-right">{l.quantity}</td>
              <td className="py-2 text-right">{money(l.unit_amount)}</td>
              <td className="py-2 text-right">{money(l.quantity * l.unit_amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="text-right">
          <tr>
            <td colSpan={3} className="pt-3 text-text-muted">
              {t('bill.subtotal')}
            </td>
            <td className="pt-3">{money(inv.subtotal)}</td>
          </tr>
          {inv.discount_amount > 0 && (
            <tr>
              <td colSpan={3} className="text-text-muted">
                {t('bill.discount')}
              </td>
              <td>−{money(inv.discount_amount)}</td>
            </tr>
          )}
          <tr className="text-lg font-bold text-primary">
            <td colSpan={3}>{t('bill.total')}</td>
            <td>{money(inv.total)}</td>
          </tr>
          {inv.paid_amount > 0 && inv.status !== 'paid' && (
            <tr>
              <td colSpan={3} className="text-text-muted">
                {t('bill.remaining')}
              </td>
              <td className="font-bold text-orange">{money(due)}</td>
            </tr>
          )}
        </tfoot>
      </table>

      {inv.note && <p className="text-sm whitespace-pre-line text-text-muted">{inv.note}</p>}

      {inv.status === 'open' && inv.bank_account && (
        <section className="flex flex-wrap items-center gap-6 rounded-md border border-primary/20 bg-bg p-4">
          <VietQr inv={inv} size={160} />
          <dl className="flex flex-col gap-1 text-sm">
            <dt className="font-bold text-primary">{t('bill.transferTitle')}</dt>
            <dd>
              {t('bill.bank')}: <b>{bankName(inv.bank_bin)}</b>
            </dd>
            <dd>
              {t('bill.account')}: <b className="font-mono">{inv.bank_account}</b>
            </dd>
            {inv.bank_holder && (
              <dd>
                {t('bill.holder')}: <b>{inv.bank_holder}</b>
              </dd>
            )}
            <dd>
              {t('bill.memo')}: <b className="font-mono">{transferMemo(inv.number)}</b>
            </dd>
            <dd>
              {t('bill.amount')}: <b>{money(due)}</b>
            </dd>
          </dl>
        </section>
      )}
    </article>
  );
}
