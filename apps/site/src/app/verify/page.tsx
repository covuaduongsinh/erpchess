import { vi } from '@erpchess/i18n';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { normalizeCode } from '../../lib/verify';

export const metadata: Metadata = {
  title: `${vi.cert.verifyTitle} — ${vi.app.name}`,
  robots: { index: false, follow: false },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  if (code && normalizeCode(code)) redirect(`/verify/${normalizeCode(code)}`);
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden px-4 text-center">
      <div
        aria-hidden
        className="chess-pattern pointer-events-none absolute inset-0 opacity-[0.06]"
      />
      <p className="text-sm tracking-[0.05em] text-text-muted uppercase">{vi.app.name}</p>
      <h1 className="text-3xl font-bold text-primary sm:text-4xl">{vi.cert.verifyTitle}</h1>
      <p className="max-w-md text-text-muted">{vi.cert.verifyHint}</p>
      <form action="/verify" method="get" className="relative flex w-full max-w-md gap-2">
        <input
          name="code"
          required
          maxLength={20}
          autoComplete="off"
          placeholder="XXXXX-XXXXX"
          aria-label={vi.cert.code}
          className="flex-1 rounded-md border border-text-muted/30 bg-white px-4 py-3 font-mono text-lg tracking-wider uppercase"
        />
        <button
          type="submit"
          className="rounded-md bg-orange px-6 py-3 font-bold text-white hover:bg-orange-hover"
        >
          {vi.cert.verifyButton}
        </button>
      </form>
    </main>
  );
}
