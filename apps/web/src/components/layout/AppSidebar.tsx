import type { MyAcademy } from '@erpchess/api';
import { languages } from '@erpchess/i18n';
import { Link } from '@tanstack/react-router';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sun,
  UserCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Theme } from '../../lib/theme';
import { useT } from '../../lib/use-t';
import {
  buildChatItem,
  buildNavGroups,
  buildOverviewItem,
  findActiveItem,
  flattenGroup,
  groupOfItem,
  type NavGroup,
  type NavItem,
} from './nav-items';

export type AppSidebarProps = {
  pathname: string;
  /** Học viện đang dùng (theo URL, hoặc học viện gần nhất); null khi chưa có học viện nào. */
  academy: MyAcademy | null;
  academies: MyAcademy[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  closedGroups: string[];
  onToggleGroup: (id: string) => void;
  /** Drawer trên màn hình hẹp hơn `lg`. */
  drawerOpen: boolean;
  onCloseDrawer: () => void;
  /** Số tin chat chưa đọc, 0 thì không hiện. */
  unreadChat?: number;
  /** Giao diện hiện tại và hàm đổi sáng/tối. */
  theme?: Theme;
  onToggleTheme?: () => void;
  signedIn: boolean;
  onSignOut: () => void;
};

const linkBase =
  'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-muted hover:bg-primary/5 hover:text-text data-[active=true]:bg-primary/10 data-[active=true]:font-medium data-[active=true]:text-primary';

/** Thanh bên trái kiểu Chesslang: nhóm menu, danh sách con "Quản trị", thu gọn thành thanh icon. */
export function AppSidebar({
  pathname,
  academy,
  academies,
  collapsed,
  onToggleCollapsed,
  closedGroups,
  onToggleGroup,
  drawerOpen,
  onCloseDrawer,
  unreadChat = 0,
  theme = 'light',
  onToggleTheme,
  signedIn,
  onSignOut,
}: AppSidebarProps) {
  const { t, i18n } = useT();
  const slug = academy?.slug;
  const role = academy?.role ?? null;
  const groups = buildNavGroups(role, academy);
  const overview = buildOverviewItem(role);
  const chat = buildChatItem(role);
  const active = findActiveItem(groups, pathname, slug, [overview, chat]);
  const activeGroup = groupOfItem(groups, active);

  // Đang ở trang quản trị thì tự mở sẵn danh sách con; ra khỏi thì về menu chính.
  const [adminOpen, setAdminOpen] = useState(activeGroup?.id === 'admin');
  const lastGroup = useRef(activeGroup?.id);
  useEffect(() => {
    if (lastGroup.current === activeGroup?.id) return;
    lastGroup.current = activeGroup?.id;
    setAdminOpen(activeGroup?.id === 'admin');
  }, [activeGroup?.id]);

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!switcherOpen) return;
    const close = (e: MouseEvent) => {
      if (switcherBox.current && !switcherBox.current.contains(e.target as Node))
        setSwitcherOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [switcherOpen]);

  const hide = collapsed ? 'lg:hidden' : '';
  const adminGroup = groups.find((g) => g.drill);

  function renderItem(it: NavItem, badge?: number) {
    const label = t(it.labelKey);
    const isActive = active?.id === it.id;
    return (
      <Link
        key={it.id}
        to={it.to}
        {...(it.academy && slug ? { params: { slug } } : {})}
        data-active={isActive}
        aria-current={isActive ? 'page' : undefined}
        title={collapsed ? label : undefined}
        aria-label={collapsed ? label : undefined}
        onClick={onCloseDrawer}
        className={`${linkBase} ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
      >
        <it.icon className="size-5 shrink-0" aria-hidden="true" />
        <span className={`truncate ${hide}`}>{label}</span>
        {!!badge && badge > 0 && (
          <span
            className={`ml-auto rounded-full bg-orange px-1.5 text-xs font-bold text-white ${hide}`}
          >
            {badge}
          </span>
        )}
      </Link>
    );
  }

  function renderGroup(group: NavGroup) {
    const open = !closedGroups.includes(group.id);
    const items = flattenGroup(group);
    if (group.drill) {
      // Bấm "Quản trị" chuyển sang danh sách con thay vì xổ ngay trong menu chính
      return (
        <button
          key={group.id}
          type="button"
          onClick={() => setAdminOpen(true)}
          title={collapsed ? t(group.labelKey) : undefined}
          aria-label={t(group.labelKey)}
          data-active={activeGroup?.id === group.id}
          className={`${linkBase} w-full ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
        >
          <group.icon className="size-5 shrink-0" aria-hidden="true" />
          <span className={`truncate ${hide}`}>{t(group.labelKey)}</span>
          <ChevronRight className={`ml-auto size-4 ${hide}`} aria-hidden="true" />
        </button>
      );
    }
    return (
      <div key={group.id} className="flex flex-col gap-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => onToggleGroup(group.id)}
          className={`flex items-center justify-between px-3 pt-3 pb-1 text-xs font-bold tracking-[0.05em] text-text-muted uppercase ${hide}`}
        >
          {t(group.labelKey)}
          <ChevronDown
            className={`size-4 transition-transform ${open ? '' : '-rotate-90'}`}
            aria-hidden="true"
          />
        </button>
        {/* Rail icon luôn hiện đủ mục, không có tiêu đề nhóm để bấm đóng */}
        <div className="flex flex-col gap-1">
          {(open || collapsed) && items.map((it) => renderItem(it))}
        </div>
      </div>
    );
  }

  const initial = (academy?.name ?? t('app.name')).trim().charAt(0).toUpperCase();

  return (
    <>
      {drawerOpen && (
        <button
          type="button"
          aria-label={t('nav.closeMenu')}
          onClick={onCloseDrawer}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}
      <aside
        aria-label={t('nav.mainNav')}
        data-open={drawerOpen}
        data-collapsed={collapsed}
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-text-muted/15 bg-surface transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 lg:transition-[width] ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        {/* Đầu sidebar: logo, tên học viện, vai trò; bấm để đổi học viện */}
        <div ref={switcherBox} className="relative border-b border-text-muted/15 p-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSwitcherOpen((o) => !o)}
              aria-expanded={switcherOpen}
              aria-label={t('nav.switchAcademy')}
              title={collapsed ? (academy?.name ?? t('app.name')) : undefined}
              className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left hover:bg-primary/5 ${collapsed ? 'lg:justify-center' : ''}`}
            >
              {academy?.logo_url ? (
                <img
                  src={academy.logo_url}
                  alt=""
                  className="size-10 shrink-0 rounded-lg object-contain"
                />
              ) : (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-lg font-bold text-text-on-primary">
                  {initial}
                </span>
              )}
              <span className={`flex min-w-0 flex-col ${hide}`}>
                <span className="truncate text-sm font-bold text-primary">
                  {academy?.name ?? t('app.name')}
                </span>
                <span className="truncate text-xs text-text-muted">
                  {academy ? t(`role.${academy.role}`) : t('nav.noAcademy')}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
              title={collapsed ? t('nav.expand') : t('nav.collapse')}
              className="hidden shrink-0 rounded-md p-1.5 text-text-muted hover:bg-primary/5 lg:block"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-5" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="size-5" aria-hidden="true" />
              )}
            </button>
          </div>
          {switcherOpen && (
            <div
              role="menu"
              className="absolute top-full left-3 z-50 mt-1 flex w-60 flex-col gap-1 rounded-lg border border-text-muted/15 bg-surface p-2 shadow-lg"
            >
              {academies.map((a) => (
                <Link
                  key={a.id}
                  role="menuitem"
                  to="/a/$slug"
                  params={{ slug: a.slug }}
                  onClick={() => {
                    setSwitcherOpen(false);
                    onCloseDrawer();
                  }}
                  data-active={a.slug === slug}
                  className={linkBase}
                >
                  <span className="truncate">{a.name}</span>
                </Link>
              ))}
              <Link
                role="menuitem"
                to="/academies/new"
                onClick={() => {
                  setSwitcherOpen(false);
                  onCloseDrawer();
                }}
                className={`${linkBase} border-t border-text-muted/15`}
              >
                <Plus className="size-4" aria-hidden="true" />
                {t('nav.createAcademy')}
              </Link>
            </div>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {adminOpen && adminGroup ? (
            <>
              <button
                type="button"
                onClick={() => setAdminOpen(false)}
                aria-label={t('nav.backTo', { name: t(adminGroup.labelKey) })}
                title={collapsed ? t('nav.backTo', { name: t(adminGroup.labelKey) }) : undefined}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-bold tracking-[0.05em] text-primary uppercase hover:bg-primary/5 ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
              >
                <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
                <span className={hide}>{t(adminGroup.labelKey)}</span>
              </button>
              {adminGroup.sections.map((section) => (
                <div key={section.id} className="flex flex-col gap-1">
                  <p
                    className={`px-3 pt-3 pb-1 text-xs font-bold tracking-[0.05em] text-text-muted uppercase ${hide}`}
                  >
                    {t(section.labelKey)}
                  </p>
                  {section.items.map((it) => renderItem(it))}
                </div>
              ))}
            </>
          ) : (
            <>
              {overview && renderItem(overview)}
              {groups.map((g) => renderGroup(g))}
            </>
          )}
        </nav>

        {/* Đáy sidebar: chat, hồ sơ, giao diện sáng/tối, ngôn ngữ, đăng xuất */}
        <div className="flex flex-col gap-1 border-t border-text-muted/15 p-3">
          {chat && renderItem(chat, unreadChat)}
          {signedIn && (
            <Link
              to="/profile"
              onClick={onCloseDrawer}
              data-active={pathname === '/profile'}
              title={collapsed ? t('nav.profile') : undefined}
              aria-label={collapsed ? t('nav.profile') : undefined}
              className={`${linkBase} ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
            >
              <UserCircle className="size-5 shrink-0" aria-hidden="true" />
              <span className={hide}>{t('nav.profile')}</span>
            </Link>
          )}
          {/* Công tắc sáng/tối: lưu localStorage, mặc định theo hệ thống (lib/theme.ts) */}
          <button
            type="button"
            role="switch"
            aria-checked={theme === 'dark'}
            onClick={onToggleTheme}
            title={collapsed ? t('nav.darkMode') : undefined}
            className={`${linkBase} w-full ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
          >
            {theme === 'dark' ? (
              <Sun className="size-5 shrink-0" aria-hidden="true" />
            ) : (
              <Moon className="size-5 shrink-0" aria-hidden="true" />
            )}
            <span className={hide}>{t('nav.darkMode')}</span>
          </button>
          <fieldset
            className={`m-0 flex items-center gap-1 border-0 px-3 py-1 ${collapsed ? 'lg:flex-col lg:px-0' : ''}`}
          >
            <legend className="sr-only">{t('nav.language')}</legend>
            {languages.map((lng) => (
              <button
                key={lng}
                type="button"
                aria-pressed={i18n.language === lng}
                onClick={() => void i18n.changeLanguage(lng)}
                className="rounded-md px-2 py-1 text-xs font-medium text-text-muted hover:bg-primary/5 aria-pressed:bg-primary/10 aria-pressed:text-primary"
              >
                {lng.toUpperCase()}
              </button>
            ))}
          </fieldset>
          {signedIn && (
            <button
              type="button"
              onClick={onSignOut}
              title={collapsed ? t('nav.signOut') : undefined}
              aria-label={collapsed ? t('nav.signOut') : undefined}
              className={`${linkBase} w-full ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
            >
              <LogOut className="size-5 shrink-0" aria-hidden="true" />
              <span className={hide}>{t('nav.signOut')}</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
