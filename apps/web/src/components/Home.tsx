import { Link } from '@tanstack/react-router';
import { detectPlatform } from '../lib/platform';
import { useT } from '../lib/use-t';

export function Home() {
  const { t } = useT();
  const platform = t(`platform.${detectPlatform()}`);

  return (
    <section className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden text-center">
      <div
        aria-hidden
        className="chess-pattern pointer-events-none absolute inset-0 opacity-[0.06]"
      />
      <p className="text-sm tracking-[0.05em] text-text-muted uppercase">{t('app.slogan')}</p>
      <h1 className="text-4xl font-bold text-primary sm:text-5xl">{t('home.welcome')}</h1>
      <p className="max-w-xl text-text-muted">{t('home.description')}</p>
      <div className="flex gap-3">
        <Link
          to="/signup"
          className="rounded-md bg-orange px-6 py-3 font-bold text-white hover:bg-orange-hover"
        >
          {t('home.getStarted')}
        </Link>
        <Link to="/login" className="rounded-md px-6 py-3 font-bold text-primary">
          {t('auth.signIn')}
        </Link>
      </div>
      <p className="text-sm text-text-muted">{t('home.platform', { platform })}</p>
    </section>
  );
}
