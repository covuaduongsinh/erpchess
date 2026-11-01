import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisBoard } from './AnalysisBoard';
import { SaveGamePanel } from './SaveGamePanel';

const h = vi.hoisted(() => ({
  dbs: [] as unknown[],
  create: vi.fn(),
  importPgn: vi.fn(),
}));

vi.mock('@erpchess/api/react', () => ({
  useDatabases: () => ({ data: h.dbs, isPending: false, error: null }),
  useDatabaseMutations: () => ({
    create: { mutateAsync: h.create, isPending: false },
    importPgn: { mutateAsync: h.importPgn, isPending: false },
  }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
  }: {
    to: string;
    params?: { slug: string };
    children: ReactNode;
  }) => <a href={params ? to.replace('$slug', params.slug) : to}>{children}</a>,
}));
// Không nạp engine WASM / Masterbase trong test này
vi.mock('./EngineLines', () => ({ EngineLines: () => null }));
vi.mock('./MasterbasePanel', () => ({ MasterbasePanel: () => null }));

const db = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  name,
  created_by: 'u1',
  visibility: 'private',
  sync_source: null,
  ...over,
});

function panel(canSave = true, pgn = '1. e4 e5 *') {
  return render(
    <I18nextProvider i18n={createI18n('vi')}>
      <SaveGamePanel academyId="a1" userId="u1" slug="clb" pgn={() => pgn} canSave={canSave} />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  h.dbs = [];
  h.create.mockReset();
  h.importPgn.mockReset();
});
afterEach(() => cleanup());

describe('SaveGamePanel', () => {
  it('chỉ liệt kê CSDL riêng tư của chính mình, bỏ CSDL đồng bộ và của người khác', () => {
    h.dbs = [
      db('d1', 'Khai cuộc của tôi'),
      db('d2', 'Của người khác', { created_by: 'u2' }),
      db('d3', 'Chia sẻ học viện', { visibility: 'academy' }),
      db('d4', 'Đồng bộ Lichess', { sync_source: 'lichess' }),
    ];
    panel();
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Khai cuộc của tôi', '+ Tạo CSDL mới']);
  });

  it('lưu vào CSDL đã chọn: gọi nhập PGN với PGN hiện tại và báo thành công', async () => {
    h.dbs = [db('d1', 'Khai cuộc của tôi')];
    h.importPgn.mockResolvedValue({ imported: 1, failed: 0 });
    panel(true, '1. d4 d5 *');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ván' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'Đã lưu ván vào "Khai cuộc của tôi".',
      ),
    );
    expect(h.importPgn).toHaveBeenCalledWith({ databaseId: 'd1', text: '1. d4 d5 *' });
    expect(h.create).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Mở CSDL ván' }).getAttribute('href')).toBe(
      '/a/clb/database',
    );
  });

  it('chưa có CSDL: tạo CSDL riêng tư mới với tên đã nhập rồi mới lưu', async () => {
    h.create.mockResolvedValue({ id: 'new1', name: 'Bộ ván mới' });
    h.importPgn.mockResolvedValue({ imported: 1, failed: 0 });
    panel();
    expect(screen.getByText(/chưa có CSDL riêng nào/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tên CSDL mới'), { target: { value: 'Bộ ván mới' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ván' }));
    await waitFor(() => expect(h.importPgn).toHaveBeenCalled());
    expect(h.create).toHaveBeenCalledWith({ name: 'Bộ ván mới', visibility: 'private' });
    expect(h.importPgn).toHaveBeenCalledWith({ databaseId: 'new1', text: '1. e4 e5 *' });
    expect(screen.getByRole('status').textContent).toContain('"Bộ ván mới"');
  });

  it('khoá nút khi chưa có nước đi hoặc tên CSDL mới trống', () => {
    panel(false);
    expect(screen.getByRole('button', { name: 'Lưu ván' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Đi ít nhất một nước trên bàn để lưu ván.')).toBeTruthy();
    cleanup();
    panel(true);
    fireEvent.change(screen.getByLabelText('Tên CSDL mới'), { target: { value: '  ' } });
    expect(screen.getByRole('button', { name: 'Lưu ván' }).hasAttribute('disabled')).toBe(true);
  });

  it('lỗi khi lưu thì hiện lỗi và không báo thành công', async () => {
    h.dbs = [db('d1', 'Khai cuộc của tôi')];
    h.importPgn.mockRejectedValue(new Error('mạng lỗi'));
    panel();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ván' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('PGN nhập 0 ván thì coi là lỗi', async () => {
    h.dbs = [db('d1', 'Khai cuộc của tôi')];
    h.importPgn.mockResolvedValue({ imported: 0, failed: 1, firstError: 'PGN hỏng' });
    panel();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ván' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('AnalysisBoard + lưu ván', () => {
  function board(saveTarget?: { academyId: string; userId: string; slug: string }) {
    return render(
      <I18nextProvider i18n={createI18n('vi')}>
        <AnalysisBoard saveTarget={saveTarget} />
      </I18nextProvider>,
    );
  }

  it('không có saveTarget (khách, học viên, chưa có học viện): không tab và không nút Lưu ván', () => {
    board();
    expect(screen.queryByRole('tab', { name: 'CSDL của tôi' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lưu ván' })).toBeNull();
  });

  it('có saveTarget: tab CSDL của tôi; nút Lưu ván ở đầu trang mở tab đó', () => {
    h.dbs = [db('d1', 'Khai cuộc của tôi')];
    board({ academyId: 'a1', userId: 'u1', slug: 'clb' });
    const tab = screen.getByRole('tab', { name: 'CSDL của tôi' });
    expect(tab.getAttribute('aria-selected')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ván' }));
    expect(screen.getByRole('tab', { name: 'CSDL của tôi', selected: true })).toBeTruthy();
    expect(screen.getByLabelText('Lưu vào CSDL')).toBeTruthy();
  });
});
