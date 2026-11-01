import type { Member } from '@erpchess/api';
import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fideParts } from '../../lib/fide-text';
import { FideEditor } from './FideEditor';
import { StudentAdminTable } from './StudentAdminTable';
import { StudentGrid } from './StudentGrid';

const h = vi.hoisted(() => ({
  setFide: { mutate: vi.fn(), isPending: false, error: null as unknown },
}));

vi.mock('@erpchess/api/react', () => ({
  useSetMemberFide: () => h.setFide,
  useSetStudentLevel: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useSetInitialRating: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useCreateInvitation: () => ({ mutate: vi.fn(), isPending: false, error: null, data: null }),
}));

const withFide = {
  role: 'student',
  levelId: null,
  profile: { id: 's1', display_name: 'Nguyễn Văn An', username: 'an' },
  fide: { id: '12345678', standard: 1800, rapid: 1750, blitz: null },
} as unknown as Member;
const noFide = {
  role: 'student',
  levelId: null,
  profile: { id: 's2', display_name: 'Trần Thị Bình', username: 'binh' },
  fide: { id: null, standard: null, rapid: null, blitz: null },
} as unknown as Member;

function ui(node: React.ReactNode, lng: 'vi' | 'en' = 'vi') {
  return render(<I18nextProvider i18n={createI18n(lng)}>{node}</I18nextProvider>);
}

beforeEach(() => h.setFide.mutate.mockReset());
afterEach(() => cleanup());

describe('FideEditor', () => {
  it('hiện giá trị hiện có, chưa sửa thì không có nút Lưu', () => {
    ui(
      <FideEditor
        academyId="a1"
        studentId="s1"
        name="Nguyễn Văn An"
        fide={{ id: '12345678', standard: 1800, rapid: 1750, blitz: null }}
      />,
    );
    expect((screen.getByLabelText('ID FIDE — Nguyễn Văn An') as HTMLInputElement).value).toBe(
      '12345678',
    );
    expect((screen.getByLabelText('Standard — Nguyễn Văn An') as HTMLInputElement).value).toBe(
      '1800',
    );
    expect((screen.getByLabelText('Blitz — Nguyễn Văn An') as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('button', { name: 'Lưu' })).toBeNull();
  });

  it('sửa thì hiện Lưu; lưu gửi mã + 3 Elo (rỗng thành null)', () => {
    ui(
      <FideEditor
        academyId="a1"
        studentId="s1"
        name="Nguyễn Văn An"
        fide={{ id: '12345678', standard: 1800, rapid: 1750, blitz: null }}
      />,
    );
    fireEvent.change(screen.getByLabelText('Blitz — Nguyễn Văn An'), { target: { value: '1700' } });
    fireEvent.change(screen.getByLabelText('Rapid — Nguyễn Văn An'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(h.setFide.mutate).toHaveBeenCalledWith({
      studentId: 's1',
      fideId: '12345678',
      standard: 1800,
      rapid: null,
      blitz: 1700,
    });
  });

  it('học viên chưa có FIDE: ô trống, nhập mã rồi lưu', () => {
    ui(<FideEditor academyId="a1" studentId="s2" name="Bình" fide={undefined} />);
    fireEvent.change(screen.getByLabelText('ID FIDE — Bình'), { target: { value: '987654' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(h.setFide.mutate).toHaveBeenCalledWith({
      studentId: 's2',
      fideId: '987654',
      standard: null,
      rapid: null,
      blitz: null,
    });
  });
});

describe('cột FIDE trong bảng và lưới học viên', () => {
  const tableProps = { students: [withFide, noFide], academyId: 'a1', slug: 'clb', levels: [] };

  it('bảng: học viện tắt FIDE thì không có cột; bật thì có cột và ô sửa cho từng học viên', () => {
    const { unmount } = ui(<StudentAdminTable {...tableProps} />);
    expect(screen.queryByRole('columnheader', { name: 'FIDE' })).toBeNull();
    expect(screen.queryByLabelText('ID FIDE — Nguyễn Văn An')).toBeNull();
    unmount();
    ui(<StudentAdminTable {...tableProps} fideEnabled />);
    expect(screen.getByRole('columnheader', { name: 'FIDE' })).toBeTruthy();
    expect((screen.getByLabelText('ID FIDE — Nguyễn Văn An') as HTMLInputElement).value).toBe(
      '12345678',
    );
    expect((screen.getByLabelText('ID FIDE — Trần Thị Bình') as HTMLInputElement).value).toBe('');
  });

  it('lưới: thẻ chỉ có mục FIDE khi học viện bật', () => {
    const props = {
      students: [withFide],
      academyId: 'a1',
      levels: [],
      groupOf: () => undefined,
      ratings: [],
      category: 'rapid' as const,
    };
    const { unmount } = ui(<StudentGrid {...props} />);
    expect(screen.queryByLabelText('ID FIDE — Nguyễn Văn An')).toBeNull();
    unmount();
    ui(<StudentGrid {...props} fideEnabled />);
    const card = screen.getByText('Nguyễn Văn An').closest('li') as HTMLElement;
    expect(within(card).getByText('FIDE')).toBeTruthy();
    expect((within(card).getByLabelText('Rapid — Nguyễn Văn An') as HTMLInputElement).value).toBe(
      '1750',
    );
  });
});

describe('fideParts', () => {
  const labels = { id: 'ID', standard: 'Std', rapid: 'Rap', blitz: 'Bli' };
  it('chỉ ghép các phần có dữ liệu', () => {
    expect(fideParts({ id: '123', standard: 1800, rapid: null, blitz: 1700 }, labels)).toBe(
      'ID 123 · Std 1800 · Bli 1700',
    );
    expect(fideParts({ id: null, standard: null, rapid: null, blitz: null }, labels)).toBe('');
    expect(fideParts(undefined, labels)).toBe('');
  });
});
