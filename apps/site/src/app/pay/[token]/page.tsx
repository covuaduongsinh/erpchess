import { bankName, formatMoney, transferMemo, vietQrPayload } from '@erpchess/domain';
import { vi } from '@erpchess/i18n';
import type { Metadata } from 'next';
import QRCode from 'qrcode';
import { fetchPublicInvoice, type PublicInvoice, payConfigured } from '../../../lib/pay';
import { fill } from '../../../lib/verify';

export const metadata: Metadata = {
  title: `${vi.bill.payTitle} — ${vi.app.name}`,
  robots: { index: false, follow: false },
};

const dateVi = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { dateStyle: 'long', timeZone: 'Asia/Ho_Chi_Minh' });

async function qrFor(inv: PublicInvoice): Promise<string | null> {
  const due = inv.total - inv.paid_amount;
  if (
    !inv.bank_bin ||
    !inv.bank_account ||
    inv.currency !== 'VND' ||
    inv.status !== 'open' ||
    due <= 0
  )
    return null;
  try {
    const payload = vietQrPayload({
      bin: inv.bank_bin,
      account: inv.bank_account,
      amount: due,
      memo: transferMemo(inv.number),
    });
    return await QRCode.toDataURL(payload, { margin: 1, width: 480 });
  } catch {
    return null;
  }
}

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let inv: PublicInvoice | null = null;
  let failed = !payConfigured;
  if (!failed) {
    try {
      inv = await fetchPublicInvoice(token);
    } catch {
      failed = true;
    }
  }
  const qr = inv ? await qrFor(inv) : null;
  const money = (n: number) => formatMoney(n, inv?.currency ?? 'VND', 'vi');

  return (
    <main className="relative flex min-h-screen flex-col items-center gap-6 overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="chess-pattern pointer-events-none absolute inset-0 opacity-[0.06]"
      />
      <p className="relative text-sm tracking-[0.05em] text-text-muted uppercase">{vi.app.name}</p>
      <h1 className="relative text-3xl font-bold text-primary">{vi.bill.payTitle}</h1>

      <section className="relative flex w-full max-w-xl flex-col gap-5 rounded-lg border-t-8 border-primary bg-white p-6 shadow-sm">
        {failed ? (
          <p className="text-text-muted">{vi.bill.payUnavailable}</p>
        ) : !inv ? (
          <p className="font-medium text-orange">{vi.bill.payNotFound}</p>
        ) : (
          <>
            <header className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-bold text-primary">{inv.academy_name}</p>
                {inv.tax_id && (
                  <p className="text-sm text-text-muted">
                    {fill(vi.bill.taxIdLine, { id: inv.tax_id })}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-text-muted">{vi.bill.invoice}</p>
                <p className="font-mono font-bold">{inv.number}</p>
              </div>
            </header>

            {inv.status === 'paid' && (
              <p className="rounded-md bg-green/15 px-4 py-3 font-bold text-green">
                ✓ {vi.bill.payPaid}
              </p>
            )}
            {inv.status === 'void' && (
              <p className="rounded-md bg-text-muted/15 px-4 py-3 font-bold text-text-muted">
                {vi.bill.payVoid}
              </p>
            )}

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-text-muted">{vi.bill.student}</dt>
              <dd className="font-medium">{inv.student_name}</dd>
              <dt className="text-text-muted">{vi.bill.issuedAt}</dt>
              <dd>{dateVi(inv.issued_at)}</dd>
              {inv.due_on && (
                <>
                  <dt className="text-text-muted">{vi.bill.dueOn}</dt>
                  <dd>{dateVi(inv.due_on)}</dd>
                </>
              )}
            </dl>

            <ul className="flex flex-col divide-y divide-text-muted/15 text-sm">
              {inv.lines.map((l, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: dòng hoá đơn cố định theo position
                <li key={`${i}`} className="flex justify-between gap-4 py-2">
                  <span>
                    {l.description}
                    {l.quantity > 1 && ` × ${l.quantity}`}
                  </span>
                  <span>{money(l.quantity * l.unit_amount)}</span>
                </li>
              ))}
              {inv.discount_amount > 0 && (
                <li className="flex justify-between gap-4 py-2 text-text-muted">
                  <span>{vi.bill.discount}</span>
                  <span>−{money(inv.discount_amount)}</span>
                </li>
              )}
              <li className="flex justify-between gap-4 py-2 text-lg font-bold text-primary">
                <span>{vi.bill.total}</span>
                <span>{money(inv.total)}</span>
              </li>
              {inv.paid_amount > 0 && inv.status === 'open' && (
                <li className="flex justify-between gap-4 py-2 font-bold text-orange">
                  <span>{vi.bill.remaining}</span>
                  <span>{money(inv.total - inv.paid_amount)}</span>
                </li>
              )}
            </ul>

            {inv.status === 'open' &&
              (inv.bank_account ? (
                <div className="flex flex-col items-center gap-4 rounded-md bg-bg p-4 sm:flex-row">
                  {qr && (
                    // biome-ignore lint/performance/noImgElement: ảnh QR data URL sinh phía server
                    <img src={qr} alt="VietQR" width={200} height={200} />
                  )}
                  <dl className="flex flex-col gap-1 text-sm">
                    <dt className="font-bold text-primary">{vi.bill.transferTitle}</dt>
                    <dd>
                      {vi.bill.bank}: <b>{bankName(inv.bank_bin)}</b>
                    </dd>
                    <dd>
                      {vi.bill.account}: <b className="font-mono">{inv.bank_account}</b>
                    </dd>
                    {inv.bank_holder && (
                      <dd>
                        {vi.bill.holder}: <b>{inv.bank_holder}</b>
                      </dd>
                    )}
                    <dd>
                      {vi.bill.memo}: <b className="font-mono">{transferMemo(inv.number)}</b>
                    </dd>
                    <dd>
                      {vi.bill.amount}: <b>{money(inv.total - inv.paid_amount)}</b>
                    </dd>
                  </dl>
                </div>
              ) : (
                <p className="text-sm text-text-muted">{vi.bill.payNoBank}</p>
              ))}
            {inv.note && <p className="text-sm whitespace-pre-line text-text-muted">{inv.note}</p>}
          </>
        )}
      </section>
    </main>
  );
}
