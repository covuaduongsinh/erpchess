import { signOut } from '@erpchess/api';
import { useConversations, useErpClient, useMyAcademies, useSession } from '@erpchess/api/react';
import { languages } from '@erpchess/i18n';
import { Link, useParams, useRouterState } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { academyBrandStyle } from '../../lib/academy-branding';
import { useT } from '../../lib/use-t';
import { CommandPalette } from '../CommandPalette';
import { NotificationBell } from '../NotificationBell';
import { BoardPreferencesSync } from '../preferences/BoardPreferencesSync';
import { AppSidebar } from './AppSidebar';
import { isImmersivePath } from './nav-items';
import { readLastAcademySlug, saveLastAcademySlug, useSidebarState } from './useSidebarState';

/** Trang khách: giữ bố cục riêng (không sidebar). */
function isGuestPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/signup' ||
    pathname.startsWith('/invite/')
  );
}

/** Khung cho trang chưa đăng nhập: thanh mảnh có logo và chọn ngôn ngữ. */
function GuestLayout({ children }: { children: ReactNode }) {
  const { t, i18n } = useT();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-4 bg-primary px-4 py-3 text-text-on-primary">
        <Link to="/" className="text-lg font-bold">
          {t('app.name')}
        </Link>
        <span className="hidden text-xs tracking-[0.05em] uppercase opacity-80 sm:inline">
          {t('app.slogan')}
        </span>
        <div className="ml-auto flex items-center gap-2 text-sm">
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
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        {children}
      </main>
    </div>
  );
}

/**
 * Khung ứng dụng cho mọi trang đã đăng nhập: sidebar nhóm bên trái, thanh trên mảnh
 * (Command Palette, chuông, avatar) và vùng nội dung rộng. Trang khách giữ bố cục riêng.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const { t } = useT();
  const client = useErpClient();
  const { session, loading } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const params = useParams({ strict: false }) as { slug?: string };
  const academies = useMyAcademies(session?.user.id);
  const list = academies.data ?? [];

  // Học viện hiện tại: theo URL, nếu không thì học viện dùng gần nhất, rồi học viện đầu tiên
  const bySlug = params.slug ? list.find((a) => a.slug === params.slug) : undefined;
  const academy = bySlug ?? list.find((a) => a.slug === readLastAcademySlug()) ?? list[0] ?? null;
  useEffect(() => {
    if (bySlug) saveLastAcademySlug(bySlug.slug);
  }, [bySlug]);

  const conversations = useConversations(academy?.id);
  const unreadChat = (conversations.data ?? []).reduce((sum, c) => sum + c.unread, 0);

  const sidebar = useSidebarState(pathname, isImmersivePath(pathname));
  const { setDrawerOpen } = sidebar;
  // biome-ignore lint/correctness/useExhaustiveDependencies: đóng drawer mỗi khi đổi trang
  useEffect(() => setDrawerOpen(false), [pathname, setDrawerOpen]);

  if (loading || !session || isGuestPath(pathname)) {
    return <GuestLayout>{children}</GuestLayout>;
  }

  const displayName = String(session.user.user_metadata?.display_name ?? session.user.email ?? '');

  return (
    <div
      className="flex min-h-screen bg-app-bg"
      style={academyBrandStyle(academy?.brand_color)}
      data-brand={academy?.brand_color ? '' : undefined}
    >
      <AppSidebar
        pathname={pathname}
        academy={academy}
        academies={list}
        collapsed={sidebar.collapsed}
        onToggleCollapsed={sidebar.toggleCollapsed}
        closedGroups={sidebar.closedGroups}
        onToggleGroup={sidebar.toggleGroup}
        drawerOpen={sidebar.drawerOpen}
        onCloseDrawer={() => sidebar.setDrawerOpen(false)}
        unreadChat={unreadChat}
        signedIn
        onSignOut={() => void signOut(client)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 px-4 lg:px-6">
          <button
            type="button"
            onClick={() => sidebar.setDrawerOpen(true)}
            aria-label={t('nav.openMenu')}
            className="rounded-md p-1.5 text-text-muted hover:bg-primary/5 lg:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <CommandPalette />
            <NotificationBell userId={session.user.id} />
            <BoardPreferencesSync key={session.user.id} userId={session.user.id} />
            <Link
              to="/profile"
              title={t('nav.profile')}
              aria-label={t('nav.profile')}
              className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-text-on-primary"
            >
              {displayName.trim().charAt(0).toUpperCase() || '?'}
            </Link>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-6 pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
