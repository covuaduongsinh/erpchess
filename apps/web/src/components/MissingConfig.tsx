import { useT } from '../lib/use-t';

export function MissingConfig() {
  const { t } = useT();
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <p role="alert" className="max-w-lg rounded-lg bg-white p-6 text-center shadow-sm">
        {t('auth.missingConfig')}
      </p>
    </main>
  );
}
