import { vi } from '@erpchess/i18n';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173';

export default function LandingPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden px-4 text-center">
      <div
        aria-hidden
        className="chess-pattern pointer-events-none absolute inset-0 opacity-[0.06]"
      />
      <p className="text-sm tracking-[0.05em] text-text-muted uppercase">{vi.app.slogan}</p>
      <h1 className="text-4xl font-bold text-primary sm:text-5xl">{vi.app.name}</h1>
      <p className="max-w-xl text-lg">{vi.app.tagline}</p>
      <p className="max-w-xl text-text-muted">{vi.home.description}</p>
      <a
        href={APP_URL}
        className="rounded-md bg-orange px-6 py-3 font-bold text-white hover:bg-orange-hover"
      >
        {vi.home.getStarted}
      </a>
    </main>
  );
}
