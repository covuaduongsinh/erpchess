import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalysisBoard } from './AnalysisBoard';

// Không nạp engine WASM và không gọi mạng trong test bố cục
vi.mock('./EngineLines', () => ({ EngineLines: () => <div>EngineLinesStub</div> }));
vi.mock('./MasterbasePanel', () => ({ MasterbasePanel: () => <div>MasterbaseStub</div> }));

afterEach(cleanup);

function setup(props: { showMasterbase?: boolean } = {}) {
  return render(
    <I18nextProvider i18n={createI18n('vi')}>
      <AnalysisBoard {...props} />
    </I18nextProvider>,
  );
}

function press(container: HTMLElement, sq: string) {
  const el = container.querySelector(`[data-square="${sq}"]`) as Element;
  fireEvent.pointerDown(el, { button: 0, pointerId: 1 });
  fireEvent.pointerUp(el, { button: 0, pointerId: 1 });
}

describe('AnalysisBoard: thanh công cụ dưới bàn', () => {
  it('gom các thao tác sẵn có thành nút icon có nhãn truy cập', () => {
    setup();
    const bar = screen.getByRole('toolbar', { name: 'Thanh công cụ bàn cờ' });
    for (const name of [
      'Về đầu ván',
      'Nước trước',
      'Nước sau',
      'Về cuối ván',
      'Lật bàn',
      'Xoá nét vẽ',
      'Bật engine',
    ]) {
      expect(within(bar).getByRole('button', { name }), name).toBeTruthy();
    }
    // Nút icon nên có tooltip trùng nhãn
    expect(within(bar).getByRole('button', { name: 'Lật bàn' }).getAttribute('title')).toBe(
      'Lật bàn',
    );
  });

  it('nút đi lùi / tới / về đầu / về cuối điều khiển ván như phím mũi tên', () => {
    const { container } = setup();
    press(container, 'e2');
    press(container, 'e4');
    press(container, 'e7');
    press(container, 'e5');
    const current = () => container.querySelector('[aria-current="true"]')?.textContent ?? '';
    expect(current()).toContain('e5');
    fireEvent.click(screen.getByRole('button', { name: 'Nước trước' }));
    expect(current()).toContain('e4');
    fireEvent.click(screen.getByRole('button', { name: 'Về đầu ván' }));
    expect(container.querySelector('[aria-current="true"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Nước sau' }));
    expect(current()).toContain('e4');
    fireEvent.click(screen.getByRole('button', { name: 'Về cuối ván' }));
    expect(current()).toContain('e5');
  }, 20_000);

  it('nút Lật bàn đổi hướng bàn cờ; phím F vẫn chạy', () => {
    const { container } = setup();
    const a1 = () => container.querySelector('[data-square="a1"]')?.outerHTML;
    const before = a1();
    fireEvent.click(screen.getByRole('button', { name: 'Lật bàn' }));
    expect(a1()).not.toBe(before);
    fireEvent.keyDown(window, { key: 'f' });
    expect(a1()).toBe(before);
  });

  it('Xoá nét vẽ bị khoá khi bàn chưa có nét vẽ nào', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Xoá nét vẽ' }).hasAttribute('disabled')).toBe(true);
  });

  it('nút engine ở thanh công cụ bật/tắt cùng trạng thái với nút trong tab Engine', () => {
    setup();
    const toggle = screen.getByRole('button', { name: 'Bật engine' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('EngineLinesStub')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Tắt engine', pressed: true })).toBeTruthy();
    expect(screen.getByText('EngineLinesStub')).toBeTruthy();
    // Tắt từ thanh công cụ thì tab Engine cũng quay về trạng thái chờ
    fireEvent.click(screen.getByRole('button', { name: 'Tắt engine', pressed: true }));
    expect(screen.queryByText('EngineLinesStub')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Bật engine' }).length).toBeGreaterThan(0);
  });
});

describe('AnalysisBoard: tab bên phải', () => {
  it('mặc định ở tab Phân tích (danh sách nước), tab Engine ẩn cho tới khi chọn', () => {
    setup();
    const tabs = screen.getByRole('tablist', { name: 'Bảng phân tích' });
    expect(within(tabs).getByRole('tab', { name: 'Phân tích', selected: true })).toBeTruthy();
    expect(screen.getByText('Các nước đi')).toBeTruthy();
    expect(
      screen.getByText('Bật engine để xem các nước đi tốt nhất và điểm đánh giá.'),
    ).toBeTruthy();
    expect(
      screen
        .getByText('Bật engine để xem các nước đi tốt nhất và điểm đánh giá.')
        .closest('[hidden]'),
    ).toBeTruthy();
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Engine' }));
    expect(screen.queryByText('Các nước đi')).toBeNull();
    expect(
      screen
        .getByText('Bật engine để xem các nước đi tốt nhất và điểm đánh giá.')
        .closest('[hidden]'),
    ).toBeNull();
  });

  it('tab Masterbase chỉ có khi đăng nhập (showMasterbase) và chỉ nạp khi chọn', () => {
    const { unmount } = setup();
    expect(screen.queryByRole('tab', { name: 'Masterbase' })).toBeNull();
    unmount();
    setup({ showMasterbase: true });
    expect(screen.queryByText('MasterbaseStub')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Masterbase' }));
    expect(screen.getByText('MasterbaseStub')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Phân tích' }));
    expect(screen.queryByText('MasterbaseStub')).toBeNull();
  });

  it('bàn cờ, nhập FEN/PGN và đầu trang gọn luôn hiện; không có tab AI PDF', () => {
    setup({ showMasterbase: true });
    expect(screen.getByRole('heading', { level: 1, name: 'Bàn phân tích' })).toBeTruthy();
    expect(screen.getByLabelText('Dán FEN hoặc PGN')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /PDF/i })).toBeNull();
  });

  it('mở PGN từ ô nhập đưa về tab Phân tích để thấy các nước', () => {
    const { container } = setup({ showMasterbase: true });
    fireEvent.click(screen.getByRole('tab', { name: 'Masterbase' }));
    fireEvent.change(screen.getByLabelText('Dán FEN hoặc PGN'), {
      target: { value: '1. e4 e5 *' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mở' }));
    expect(screen.getByRole('tab', { name: 'Phân tích', selected: true })).toBeTruthy();
    expect(container.textContent).toContain('e5');
  }, 20_000);
});
