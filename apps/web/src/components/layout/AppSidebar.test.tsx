import type { MyAcademy } from '@erpchess/api';
import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppSidebar, type AppSidebarProps } from './AppSidebar';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string;
    params?: { slug: string };
    children: ReactNode;
  } & Record<string, unknown>) => (
    <a href={params ? to.replace('$slug', params.slug) : to} {...rest}>
      {children}
    </a>
  ),
}));

const academy = {
  id: 'a1',
  slug: 'clb',
  name: 'CLB Dương Sinh',
  role: 'owner',
  logo_url: null,
  leads_enabled: false,
} as unknown as MyAcademy;
const other = { ...academy, id: 'a2', slug: 'other', name: 'Học viện khác' } as MyAcademy;

function renderSidebar(over: Partial<AppSidebarProps> = {}) {
  const props: AppSidebarProps = {
    pathname: '/a/clb/quizzes',
    academy,
    academies: [academy, other],
    collapsed: false,
    onToggleCollapsed: vi.fn(),
    closedGroups: [],
    onToggleGroup: vi.fn(),
    drawerOpen: false,
    onCloseDrawer: vi.fn(),
    signedIn: true,
    onSignOut: vi.fn(),
    ...over,
  };
  const view = render(
    <I18nextProvider i18n={createI18n('vi')}>
      <AppSidebar {...props} />
    </I18nextProvider>,
  );
  return { props, ...view };
}

describe('AppSidebar', () => {
  afterEach(() => cleanup());

  it('hiện tên học viện, vai trò và các nhóm menu chính', () => {
    renderSidebar();
    expect(screen.getByText('CLB Dương Sinh')).toBeTruthy();
    expect(screen.getByText('Chủ học viện')).toBeTruthy();
    for (const name of ['Tổng quan', 'Quản trị', 'Học tập', 'Thi đấu', 'Nội dung'])
      expect(screen.getAllByText(name).length, name).toBeGreaterThan(0);
  });

  it('mục đang mở được tô (aria-current)', () => {
    renderSidebar({ pathname: '/a/clb/quizzes/xyz' });
    const link = screen.getByRole('link', { name: 'Quiz' });
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.getAttribute('href')).toBe('/a/clb/quizzes');
    expect(screen.getByRole('link', { name: 'Luyện tập' }).getAttribute('aria-current')).toBeNull();
  });

  it('bấm Quản trị chuyển sang danh sách con, nút quay lại trả về menu chính', () => {
    renderSidebar();
    expect(screen.queryByRole('link', { name: 'Học viên' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Quản trị' }));
    expect(screen.getByRole('link', { name: 'Học viên' }).getAttribute('href')).toBe(
      '/a/clb/students',
    );
    expect(screen.getByRole('link', { name: 'Gói học phí' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Quiz' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại Quản trị' }));
    expect(screen.getByRole('link', { name: 'Quiz' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Học viên' })).toBeNull();
  });

  it('ở trang Tổng quan: mục Tổng quan sáng và danh sách con Quản trị không tự mở', () => {
    renderSidebar({ pathname: '/a/clb' });
    expect(screen.getByRole('link', { name: 'Tổng quan' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.getByRole('button', { name: 'Quản trị' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Học viên' })).toBeNull();
  });

  it('đang ở trang quản trị thì tự mở sẵn danh sách con', () => {
    renderSidebar({ pathname: '/a/clb/students' });
    const link = screen.getByRole('link', { name: 'Học viên' });
    expect(link.getAttribute('aria-current')).toBe('page');
  });

  it('HLV không thấy mục chỉ dành cho chủ học viện', () => {
    renderSidebar({
      academy: { ...academy, role: 'coach' } as MyAcademy,
      pathname: '/a/clb/students',
    });
    expect(screen.getByRole('link', { name: 'Học viên' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Gói học phí' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Thông báo' })).toBeNull();
  });

  it('thu gọn: icon vẫn có nhãn truy cập; nút thu gọn gọi callback', () => {
    const { props } = renderSidebar({ collapsed: true });
    expect(document.querySelector('aside')?.getAttribute('data-collapsed')).toBe('true');
    expect(screen.getByRole('link', { name: 'Quiz' }).getAttribute('title')).toBe('Quiz');
    fireEvent.click(screen.getByRole('button', { name: 'Mở rộng thanh bên' }));
    expect(props.onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('nhóm đóng thì ẩn mục; bấm tiêu đề nhóm gọi onToggleGroup', () => {
    const { props } = renderSidebar({ closedGroups: ['learn'] });
    expect(screen.queryByRole('link', { name: 'Quiz' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Học tập/ }));
    expect(props.onToggleGroup).toHaveBeenCalledWith('learn');
  });

  it('drawer: mở theo prop, bấm nền hoặc bấm mục thì đóng', () => {
    const { props } = renderSidebar({ drawerOpen: true });
    expect(document.querySelector('aside')?.getAttribute('data-open')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng menu' }));
    fireEvent.click(screen.getByRole('link', { name: 'Quiz' }));
    expect(props.onCloseDrawer).toHaveBeenCalledTimes(2);
  });

  it('đổi học viện: mở menu, liệt kê học viện và mục Tạo học viện', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Đổi học viện' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Học viện khác' }).getAttribute('href')).toBe(
      '/a/other',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Tạo học viện' }).getAttribute('href')).toBe(
      '/academies/new',
    );
  });

  it('chat hiện số chưa đọc; đăng xuất gọi callback', () => {
    const { props } = renderSidebar({ unreadChat: 3 });
    expect(within(screen.getByRole('link', { name: /Chat/ })).getByText('3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Đăng xuất/ }));
    expect(props.onSignOut).toHaveBeenCalled();
  });

  it('không có học viện: chỉ Bàn cờ, Hồ sơ và Tạo học viện', () => {
    renderSidebar({ academy: null, academies: [], pathname: '/analysis' });
    expect(screen.getByRole('link', { name: 'Bàn cờ' }).getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('link', { name: 'Tổng quan' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Hồ sơ' })).toBeTruthy();
  });
});
