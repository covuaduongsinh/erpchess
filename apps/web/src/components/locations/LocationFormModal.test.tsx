import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocationFormModal } from './LocationFormModal';

const createMutate = vi.fn();
const updateMutate = vi.fn();

vi.mock('@erpchess/api/react', () => ({
  useLocationMutations: () => ({
    create: { mutate: createMutate, isPending: false, error: null },
    update: { mutate: updateMutate, isPending: false, error: null },
  }),
}));

vi.mock('../../lib/use-t', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'vi' } }),
  validationKey: () => null,
}));

afterEach(cleanup);
beforeEach(() => {
  createMutate.mockClear();
  updateMutate.mockClear();
});

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('LocationFormModal', () => {
  it('creates a location with kind, main flag and working days', () => {
    render(<LocationFormModal academyId="a1" onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('location.kind'), { target: { value: 'school' } });
    fill('location.name', 'Trường Tiểu học Đống Đa');
    fill('location.contactName', 'Cô Bình');
    fill('location.contactPhone', '0912 345 678');
    fireEvent.click(screen.getByLabelText(/location.isMain/));
    // Bỏ Thứ bảy khỏi lịch mặc định (Thứ hai – Thứ bảy)
    fireEvent.click(screen.getByRole('button', { name: 'weekday.d6' }));
    fireEvent.click(screen.getByRole('button', { name: 'location.save' }));

    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'school',
        isMain: true,
        name: 'Trường Tiểu học Đống Đa',
        country: 'Việt Nam',
        workingDays: [1, 2, 3, 4, 5],
        opensAt: '08:00',
        closesAt: '20:00',
        timezone: 'Asia/Ho_Chi_Minh',
        contactPhone: '0912 345 678',
      }),
      expect.anything(),
    );
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('edits an existing location with its stored values', () => {
    render(
      <LocationFormModal
        academyId="a1"
        location={{
          id: 'l1',
          academy_id: 'a1',
          kind: 'centre',
          name: 'Cơ sở Cầu Giấy',
          is_main: true,
          address_line: '1 Xuân Thủy',
          country: 'Việt Nam',
          state: 'Hà Nội',
          city: 'Cầu Giấy',
          working_days: [0, 6],
          opens_at: '07:30:00',
          closes_at: '21:00:00',
          timezone: 'Asia/Ho_Chi_Minh',
          contact_name: 'Thầy An',
          contact_phone: '0912345678',
          email: null,
          notes: '',
          created_at: '2026-10-31T00:00:00Z',
        }}
        onClose={vi.fn()}
      />,
    );
    expect((screen.getByLabelText('location.opensAt') as HTMLInputElement).value).toBe('07:30');
    fireEvent.click(screen.getByRole('button', { name: 'location.save' }));
    expect(updateMutate).toHaveBeenCalledWith(
      {
        id: 'l1',
        input: expect.objectContaining({ isMain: true, workingDays: [0, 6], city: 'Cầu Giấy' }),
      },
      expect.anything(),
    );
  });
});
