import { languages, type TranslationKey } from '@erpchess/i18n';
import { useTranslation } from 'react-i18next';
import { detectPlatform } from '../lib/platform';

export function Home() {
  const { t, i18n } = useTranslation();
  const tk = (key: TranslationKey, opts?: Record<string, string>) => t(key, opts);
  const platform = tk(`platform.${detectPlatform()}`);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden px-4 text-center">
      <div
        aria-hidden
        className="chess-pattern pointer-events-none absolute inset-0 opacity-[0.06]"
      />
      <p className="text-sm tracking-[0.05em] text-text-muted uppercase">{tk('app.slogan')}</p>
      <h1 className="text-4xl font-bold text-primary sm:text-5xl">{tk('home.welcome')}</h1>
      <p className="max-w-xl text-text-muted">{tk('home.description')}</p>
      <button
        type="button"
        className="rounded-md bg-orange px-6 py-3 font-bold text-white hover:bg-orange-hover"
      >
        {tk('home.getStarted')}
      </button>
      <p className="text-sm text-text-muted">{tk('home.platform', { platform })}</p>
      <fieldset className="flex items-center gap-2 text-sm">
        <legend className="sr-only">{tk('language.label')}</legend>
        {languages.map((lng) => (
          <button
            key={lng}
            type="button"
            aria-pressed={i18n.language === lng}
            onClick={() => void i18n.changeLanguage(lng)}
            className="rounded-sm px-2 py-1 aria-pressed:bg-primary aria-pressed:text-text-on-primary"
          >
            {tk(`language.${lng}`)}
          </button>
        ))}
      </fieldset>
    </main>
  );
}
