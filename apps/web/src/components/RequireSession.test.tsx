import type { ErpClient } from '@erpchess/api';
import { ErpProvider } from '@erpchess/api/react';
import { createI18n } from '@erpchess/i18n';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import { routeTree } from '../routeTree.gen';

/** Client giả: chưa đăng nhập. */
function signedOutClient(): ErpClient {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  } as unknown as ErpClient;
}

describe('RequireSession', () => {
  it('chưa đăng nhập thì chuyển về /login đúng một lần, giữ đường dẫn gốc', async () => {
    const history = createMemoryHistory({ initialEntries: ['/a/hoc-vien-a/students'] });
    const router = createRouter({ routeTree, history });
    const push = vi.spyOn(history, 'replace');

    render(
      <I18nextProvider i18n={createI18n('vi')}>
        <ErpProvider client={signedOutClient()}>
          <RouterProvider router={router} />
        </ErpProvider>
      </I18nextProvider>,
    );

    // Cây route nạp toàn bộ trang; khi chạy song song nhiều gói test máy chậm hơn mốc 1 giây mặc định
    expect(await screen.findByRole('tab', { name: 'Học viên' }, { timeout: 5000 })).toBeTruthy();
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'), { timeout: 5000 });
    expect(router.state.location.search).toEqual({ redirect: '/a/hoc-vien-a/students' });
    // Không có điều hướng lồng nhau kiểu /login?redirect=/login?...
    await new Promise((r) => setTimeout(r, 50));
    expect(push.mock.calls.length).toBeLessThanOrEqual(2);
    expect(router.state.location.search).toEqual({ redirect: '/a/hoc-vien-a/students' });
  });
});
