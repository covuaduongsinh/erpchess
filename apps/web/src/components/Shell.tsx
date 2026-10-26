import { signOut } from '@erpchess/api';
import { useErpClient, useSession } from '@erpchess/api/react';
import { languages } from '@erpchess/i18n';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useT } from '../lib/use-t';
import { CommandPalette } from './CommandPalette';
import { NotificationBell } from './NotificationBell';
import { Button } from './ui';

/** Khung chung: thanh trên cùng (logo, thanh tìm kiếm Command Palette, ngôn ngữ, đăng xuất) và vùng nội dung. */
export function Shell({ children }: { children: ReactNode }) {
  const { t, i18n } = useT();
  const client = useErpClient();
  const { session } = useSession();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-4 bg-primary px-4 py-3 text-text-on-primary">
        <Link to="/" className="text-lg font-bold">
          {t('app.name')}
        </Link>
        <span className="hidden text-xs tracking-[0.05em] uppercase opacity-80 sm:inline">
          {t('app.slogan')}
        </span>
        <Link to="/analysis" className="text-sm opacity-90 hover:opacity-100">
          {t('analysis.title')}
        </Link>

        {/* Command Palette tìm kiếm toàn cầu */}
        <div className="mx-auto hidden sm:block">
          <CommandPalette />
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <div className="sm:hidden">
            <CommandPalette />
          </div>
          {languages.map((lng) => (
            <button
              key={lng}
              type="button"
              aria-pressed={i18n.language === lng}
              onClick={() => void i18n.changeLanguage(lng)}
              className="rounded-sm px-2 py-1 aria-pressed:bg-white/20"
            >
              {lng.toUpperCase()}
            </button>
          ))}
          {session && (
            <Link
              to="/profile"
              className="rounded-sm px-2 py-1 text-white hover:bg-white/10"
              title={t('profile.title')}
            >
              {t('profile.title')}
            </Link>
          )}
          {session && <NotificationBell userId={session.user.id} />}
          {session && (
            <Button variant="ghost" className="text-white" onClick={() => void signOut(client)}>
              {t('common.signOut')}
            </Button>
          )}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
