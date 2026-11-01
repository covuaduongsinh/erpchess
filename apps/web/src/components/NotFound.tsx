import { Link, useRouter } from '@tanstack/react-router';
import { ArrowLeft, FileText, Grid2x2, Home, Puzzle, RotateCw, Trophy } from 'lucide-react';
import { useT } from '../lib/use-t';
import { useCurrentAcademy } from './layout/useCurrentAcademy';
import { Button } from './ui';

const quick =
  'inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-primary-soft';

/**
 * Trang 404 riêng cho router gốc. Nằm trong khung ứng dụng nên sidebar vẫn dùng được; liên kết
 * nhanh trỏ theo học viện gần nhất (nếu có).
 */
export function NotFound() {
  const { t } = useT();
  const router = useRouter();
  const { academy } = useCurrentAcademy();
  const slug = academy?.slug;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-16 text-center">
      {/* Số 404 cách điệu bằng họa tiết ô cờ của Dương Sinh (tự vẽ, không dùng hình ngoài) */}
      <div className="relative flex size-36 items-center justify-center overflow-hidden rounded-3xl bg-primary-soft">
        <div className="chess-pattern absolute inset-0 opacity-10" aria-hidden="true" />
        <span className="relative text-6xl font-black tracking-tight text-primary">404</span>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-text">{t('notFound.title')}</h1>
        <p className="text-text-muted">{t('notFound.description')}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {slug ? (
          <Link
            to="/a/$slug"
            params={{ slug }}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-text-on-primary hover:opacity-90"
          >
            <Home className="size-4" aria-hidden="true" />
            {t('notFound.goDashboard')}
          </Link>
        ) : (
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-text-on-primary hover:opacity-90"
          >
            <Home className="size-4" aria-hidden="true" />
            {t('notFound.goHome')}
          </Link>
        )}
        <Button variant="secondary" icon={ArrowLeft} onClick={() => router.history.back()}>
          {t('notFound.back')}
        </Button>
        <Button variant="secondary" icon={RotateCw} onClick={() => window.location.reload()}>
          {t('notFound.reload')}
        </Button>
      </div>

      <nav aria-label={t('notFound.quickLinks')} className="flex flex-col items-center gap-3">
        <p className="text-xs font-bold tracking-[0.05em] text-text-muted uppercase">
          {t('notFound.quickLinks')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link to="/analysis" className={quick}>
            <Grid2x2 className="size-4" aria-hidden="true" />
            {t('nav.board')}
          </Link>
          {slug && (
            <>
              <Link to="/a/$slug/practice" params={{ slug }} className={quick}>
                <Puzzle className="size-4" aria-hidden="true" />
                {t('practice.title')}
              </Link>
              <Link to="/a/$slug/studies" params={{ slug }} className={quick}>
                <FileText className="size-4" aria-hidden="true" />
                {t('studies.title')}
              </Link>
              <Link to="/a/$slug/tournaments" params={{ slug }} className={quick}>
                <Trophy className="size-4" aria-hidden="true" />
                {t('tournament.title')}
              </Link>
            </>
          )}
        </div>
      </nav>
    </div>
  );
}
