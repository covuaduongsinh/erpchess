import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Trophy } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Button,
  DateRangeFields,
  EmptyState,
  IconButton,
  PageHeader,
  Pagination,
  PeriodQuickPick,
  StatCard,
  StatusChips,
  Switch,
  Tabs,
  ViewToggle,
} from './index';

function wrap(node: ReactNode, lang: 'vi' | 'en' = 'vi') {
  return render(<I18nextProvider i18n={createI18n(lang)}>{node}</I18nextProvider>);
}

afterEach(() => cleanup());

const items = [
  { value: 'a', label: 'Quiz', badge: 'Mới' },
  { value: 'b', label: 'Tự động' },
  { value: 'c', label: 'Xếp hạng', count: 4 },
];

function Harness({ variant }: { variant: 'underline' | 'pills' }) {
  const [value, setValue] = useState('a');
  return <Tabs items={items} value={value} onChange={setValue} variant={variant} ariaLabel="t" />;
}

describe('Tabs', () => {
  it('role tab, aria-selected và roving tabindex', () => {
    render(<Harness variant="underline" />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[0]?.getAttribute('tabindex')).toBe('0');
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('false');
    expect(tabs[1]?.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('tablist').getAttribute('aria-label')).toBe('t');
  });

  it('bàn phím ←/→ chuyển tab theo vòng, Home/End về đầu/cuối', () => {
    render(<Harness variant="underline" />);
    const list = screen.getByRole('tablist');
    const selected = () => screen.getByRole('tab', { selected: true }).textContent;
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(selected()).toContain('Tự động');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(selected()).toContain('Quiz'); // vòng về đầu
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(selected()).toContain('Xếp hạng'); // vòng về cuối
    fireEvent.keyDown(list, { key: 'Home' });
    expect(selected()).toContain('Quiz');
    fireEvent.keyDown(list, { key: 'End' });
    expect(selected()).toContain('Xếp hạng');
  });

  it('bấm tab gọi onChange; underline có huy hiệu, pills có số đếm', () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <Tabs items={items} value="a" onChange={onChange} variant="underline" />,
    );
    expect(screen.getByText('Mới')).toBeTruthy();
    expect(screen.queryByText('4')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Tự động/ }));
    expect(onChange).toHaveBeenCalledWith('b');
    unmount();
    render(<Tabs items={items} value="a" onChange={onChange} variant="pills" />);
    expect(screen.getByText('4')).toBeTruthy();
  });
});

describe('Pagination', () => {
  function setup(over: Partial<Parameters<typeof Pagination>[0]> = {}) {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    wrap(
      <Pagination
        page={2}
        pageSize={20}
        total={95}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        {...over}
      />,
    );
    return { onPageChange, onPageSizeChange };
  }

  it('hiện khoảng mục và điều hướng ⏮ ‹ › ⏭', () => {
    const { onPageChange } = setup();
    expect(screen.getByText('21–40 / 95')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Trang đầu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trang cuối' }));
    expect(onPageChange.mock.calls.map((c) => c[0])).toEqual([1, 1, 3, 5]);
  });

  it('trang đầu khoá ⏮ ‹, trang cuối khoá › ⏭', () => {
    cleanup();
    setup({ page: 1 });
    expect(screen.getByRole('button', { name: 'Trang đầu' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Trang trước' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Trang sau' }).hasAttribute('disabled')).toBe(false);
    cleanup();
    setup({ page: 5 });
    expect(screen.getByRole('button', { name: 'Trang sau' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Trang cuối' }).hasAttribute('disabled')).toBe(true);
  });

  it('ô "Đến trang" kẹp trong [1, số trang] và gửi bằng Enter', () => {
    const { onPageChange } = setup();
    const input = screen.getByLabelText('Đến trang');
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(onPageChange).toHaveBeenLastCalledWith(5);
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('đổi số dòng mỗi trang; không có callback thì ẩn ô chọn', () => {
    const { onPageSizeChange } = setup();
    fireEvent.change(screen.getByLabelText('Số dòng mỗi trang'), { target: { value: '50' } });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
    cleanup();
    setup({ onPageSizeChange: undefined });
    expect(screen.queryByLabelText('Số dòng mỗi trang')).toBeNull();
  });

  it('danh sách rỗng hiện 0–0 / 0 và khoá hết nút điều hướng', () => {
    setup({ total: 0, page: 1 });
    expect(screen.getByText('0–0 / 0')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Trang sau' }).hasAttribute('disabled')).toBe(true);
  });
});

describe('DateRangeFields + PeriodQuickPick', () => {
  it('hai ô ngày ràng buộc min/max lẫn nhau và báo thay đổi', () => {
    const onChange = vi.fn();
    wrap(<DateRangeFields value={{ from: '2026-11-01', to: '2026-11-30' }} onChange={onChange} />);
    const from = screen.getByLabelText('Từ ngày') as HTMLInputElement;
    const to = screen.getByLabelText('Đến ngày') as HTMLInputElement;
    expect(from.max).toBe('2026-11-30');
    expect(to.min).toBe('2026-11-01');
    fireEvent.change(from, { target: { value: '2026-11-05' } });
    expect(onChange).toHaveBeenCalledWith({ from: '2026-11-05', to: '2026-11-30' });
  });

  it('T/Q/N điền khoảng tháng/quý/năm theo mốc now', () => {
    const onPick = vi.fn();
    wrap(<PeriodQuickPick onPick={onPick} now={new Date(2026, 10, 15)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tháng này' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quý này' }));
    fireEvent.click(screen.getByRole('button', { name: 'Năm nay' }));
    expect(onPick.mock.calls.map((c) => c[0])).toEqual([
      { from: '2026-11-01', to: '2026-11-30' },
      { from: '2026-10-01', to: '2026-12-31' },
      { from: '2026-01-01', to: '2026-12-31' },
    ]);
    expect(screen.getByText('T')).toBeTruthy();
    expect(screen.getByText('Q')).toBeTruthy();
    expect(screen.getByText('N')).toBeTruthy();
  });

  it('tiếng Anh dùng M/Q/Y', () => {
    wrap(<PeriodQuickPick onPick={vi.fn()} />, 'en');
    expect(screen.getByText('M')).toBeTruthy();
    expect(screen.getByText('Y')).toBeTruthy();
  });
});

describe('EmptyState', () => {
  it('hiện tiêu đề, mô tả và CTA', () => {
    wrap(
      <EmptyState
        icon={Trophy}
        title="Chưa có giải đấu"
        description="Hãy tạo giải đầu tiên."
        action={<Button>Tạo giải</Button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Chưa có giải đấu' })).toBeTruthy();
    expect(screen.getByText('Hãy tạo giải đầu tiên.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tạo giải' })).toBeTruthy();
  });

  it('viền nét đứt chỉ khi dashed', () => {
    const { container, rerender } = render(<EmptyState title="x" />);
    expect(container.firstElementChild?.getAttribute('data-dashed')).toBe('false');
    expect(container.firstElementChild?.className).not.toContain('border-dashed');
    rerender(<EmptyState title="x" dashed />);
    expect(container.firstElementChild?.getAttribute('data-dashed')).toBe('true');
    expect(container.firstElementChild?.className).toContain('border-dashed');
  });
});

describe('StatCard', () => {
  it('inline: số và nhãn, không có thanh tiến độ', () => {
    const { container } = render(<StatCard label="Học viên" value={12} icon={Trophy} />);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('Học viên')).toBeTruthy();
    expect(container.firstElementChild?.getAttribute('data-variant')).toBe('inline');
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('stacked + progress: thanh tiến độ có aria-valuenow và chiều rộng theo tỉ lệ', () => {
    const { container } = render(
      <StatCard
        label="Ghế"
        value="30/50"
        variant="stacked"
        accent="green"
        progress={{ value: 30, max: 50 }}
      />,
    );
    expect(container.firstElementChild?.getAttribute('data-variant')).toBe('stacked');
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('30');
    expect(bar.getAttribute('aria-valuemax')).toBe('50');
    expect((bar.firstElementChild as HTMLElement).style.width).toBe('60%');
  });

  it('tiến độ kẹp trong 0–100% và max = 0 thì 0%', () => {
    const { rerender } = render(<StatCard label="a" value={1} progress={{ value: 80, max: 50 }} />);
    expect((screen.getByRole('progressbar').firstElementChild as HTMLElement).style.width).toBe(
      '100%',
    );
    rerender(<StatCard label="a" value={1} progress={{ value: 5, max: 0 }} />);
    expect((screen.getByRole('progressbar').firstElementChild as HTMLElement).style.width).toBe(
      '0%',
    );
  });
});

describe('thành phần khác', () => {
  it('PageHeader: tiêu đề h1, phụ đề, nút hành động', () => {
    render(<PageHeader title="Giải đấu" subtitle="Quản lý giải" actions={<Button>Tạo</Button>} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Giải đấu' })).toBeTruthy();
    expect(screen.getByText('Quản lý giải')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tạo' })).toBeTruthy();
  });

  it('Button: biến thể và cỡ mới, mặc định vẫn type=button', () => {
    render(
      <>
        <Button variant="secondary" size="sm" icon={Trophy}>
          Phụ
        </Button>
        <Button variant="danger">Xoá</Button>
      </>,
    );
    const sec = screen.getByRole('button', { name: 'Phụ' });
    expect(sec.getAttribute('type')).toBe('button');
    expect(sec.className).toContain('border');
    expect(sec.querySelector('svg')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Xoá' }).className).toContain('bg-danger');
  });

  it('IconButton: nhãn vừa là aria-label vừa là tooltip', () => {
    const onClick = vi.fn();
    render(<IconButton icon={Trophy} label="Sửa" onClick={onClick} />);
    const btn = screen.getByRole('button', { name: 'Sửa' });
    expect(btn.getAttribute('title')).toBe('Sửa');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });

  it('Switch: role switch, aria-checked đổi theo onChange', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Hiện học viên nghỉ" />);
    const sw = screen.getByRole('switch', { name: 'Hiện học viên nghỉ' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('StatusChips: aria-pressed theo giá trị và báo thay đổi', () => {
    const onChange = vi.fn();
    wrap(
      <StatusChips
        options={[
          { value: 'all', label: 'Tất cả', count: 5 },
          { value: 'live', label: 'Đang diễn ra' },
        ]}
        value="all"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('button', { name: /Tất cả/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Đang diễn ra' }));
    expect(onChange).toHaveBeenCalledWith('live');
  });

  it('ViewToggle: chỉ hiện các chế độ được truyền, không có nút chết', () => {
    const onChange = vi.fn();
    wrap(<ViewToggle value="list" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Danh sách' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Lịch' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lưới' }));
    expect(onChange).toHaveBeenCalledWith('grid');
  });
});
