import { vi } from '@erpchess/i18n';
import type { Metadata } from 'next';
import {
  fill,
  formatCode,
  normalizeCode,
  type VerifiedCertificate,
  verifyCertificate,
  verifyConfigured,
} from '../../../lib/verify';

export const metadata: Metadata = {
  title: `${vi.cert.verifyTitle} — ${vi.app.name}`,
  robots: { index: false, follow: false },
};

const dateVi = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { dateStyle: 'long', timeZone: 'Asia/Ho_Chi_Minh' });

export default async function VerifyCodePage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  let cert: VerifiedCertificate | null = null;
  let failed = !verifyConfigured;
  if (!failed) {
    try {
      cert = await verifyCertificate(code);
    } catch {
      failed = true;
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="chess-pattern pointer-events-none absolute inset-0 opacity-[0.06]"
      />
      <p className="relative text-sm tracking-[0.05em] text-text-muted uppercase">{vi.app.name}</p>
      <h1 className="relative text-3xl font-bold text-primary">{vi.cert.verifyTitle}</h1>
      <p className="relative font-mono text-lg tracking-wider">{formatCode(code)}</p>

      <section className="relative w-full max-w-lg rounded-lg border-t-8 border-primary bg-white p-6 shadow-sm">
        {failed ? (
          <p className="text-text-muted">{vi.cert.unavailable}</p>
        ) : !cert ? (
          <p className="font-medium text-orange">{vi.cert.notFound}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {cert.revoked_at ? (
              <p className="rounded-md bg-orange/15 px-4 py-3 font-bold text-orange">
                {fill(vi.cert.revokedNote, { date: dateVi(cert.revoked_at) })}
              </p>
            ) : (
              <p className="rounded-md bg-green/15 px-4 py-3 font-bold text-green">
                ✓ {vi.cert.validNote}
              </p>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-left">
              <dt className="text-text-muted">{vi.cert.recipient}</dt>
              <dd className="font-bold">{cert.student_name}</dd>
              <dt className="text-text-muted">{vi.cert.content}</dt>
              <dd className="font-medium text-primary">{cert.title}</dd>
              <dt className="text-text-muted">{vi.cert.issuer}</dt>
              <dd>{cert.academy_name}</dd>
              <dt className="text-text-muted">{vi.cert.issuedAt}</dt>
              <dd>{dateVi(cert.issued_at)}</dd>
            </dl>
          </div>
        )}
      </section>
      <a href="/verify" className="relative text-sm text-primary underline">
        {vi.cert.again}
      </a>
    </main>
  );
}
