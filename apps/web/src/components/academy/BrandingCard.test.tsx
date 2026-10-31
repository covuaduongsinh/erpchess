import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { academyBrandStyle, useAcademyFavicon } from '../../lib/academy-branding';
import { AcademyContactCard, BrandingCard } from './BrandingCard';

const updateMutate = vi.fn();
const uploadMutate = vi.fn();
let academy: Record<string, unknown>;

vi.mock('@erpchess/api/react', () => ({
  useUpdateAcademyProfile: () => ({
    mutate: updateMutate,
    isPending: false,
    isSuccess: false,
    error: null,
  }),
  useUploadAcademyBranding: () => ({ mutate: uploadMutate, isPending: false, error: null }),
}));

vi.mock('../../lib/academy-context', () => ({
  useAcademy: () => ({ academy }),
}));

vi.mock('../../lib/use-t', () => ({
  validationKey: () => null,
  useT: () => ({ t: (key: string) => key, i18n: { language: 'vi' } }),
}));

afterEach(cleanup);

beforeEach(() => {
  updateMutate.mockClear();
  uploadMutate.mockClear();
  academy = {
    id: 'a1',
    name: 'CLB Dương Sinh',
    description: '',
    logo_url: null,
    favicon_url: null,
    brand_color: null,
    socials: {},
    contact: {},
    login_background_url: 'https://cdn.vn/bg.jpg',
    login_sections: [{ title: 'Lịch khai giảng', body: 'Thứ 7' }],
    slug: 'duong-sinh',
    role: 'owner',
  };
});

describe('BrandingCard', () => {
  it('saves brand color and contact together with the profile', () => {
    render(<BrandingCard />);
    fireEvent.change(screen.getByLabelText('branding.brandColor'), {
      target: { value: '#c0392b' },
    });
    expect(screen.getByTestId('brand-preview').style.backgroundColor).toBe('rgb(192, 57, 43)');
    fireEvent.change(screen.getByLabelText('branding.phone'), {
      target: { value: '0912 345 678' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'CLB Dương Sinh',
        brandColor: '#c0392b',
        contact: { address: '', phone: '0912 345 678', zalo: '' },
      }),
    );
  });

  it('uploads a logo and rejects files over 1 MB', () => {
    render(<BrandingCard />);
    const input = screen.getByLabelText('branding.uploadLogo');

    const big = new File([new Uint8Array(1024 * 1024 + 1)], 'big.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [big] } });
    expect(screen.getByRole('alert').textContent).toBe('branding.fileTooLarge');
    expect(uploadMutate).not.toHaveBeenCalled();

    const logo = new File(['png'], 'logo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [logo] } });
    expect(uploadMutate).toHaveBeenCalledWith(
      { kind: 'logo', file: logo },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});

describe('BrandingCard login page', () => {
  it('keeps login settings when saving and lets the owner add a section', () => {
    render(<BrandingCard />);
    expect(screen.getByText('/login/duong-sinh')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /loginPage.addSection/ }));
    fireEvent.change(screen.getAllByLabelText(/loginPage.sectionTitle/)[1] as HTMLElement, {
      target: { value: 'Học phí' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        loginBackgroundUrl: 'https://cdn.vn/bg.jpg',
        loginSections: [
          { title: 'Lịch khai giảng', body: 'Thứ 7' },
          { title: 'Học phí', body: '' },
        ],
      }),
    );
  });
});

describe('AcademyContactCard', () => {
  it('renders nothing without contact info', () => {
    const { container } = render(<AcademyContactCard />);
    expect(container.textContent).toBe('');
  });

  it('shows address and a tel: link for the phone', () => {
    academy.contact = { address: '12 Lê Lợi', phone: '0912 345 678' };
    render(<AcademyContactCard />);
    expect(screen.getByText('12 Lê Lợi')).toBeTruthy();
    expect(screen.getByText('0912 345 678').getAttribute('href')).toBe('tel:0912345678');
  });
});

describe('academy branding helpers', () => {
  it('academyBrandStyle sets CSS variables only for a valid color', () => {
    expect(academyBrandStyle(null)).toBeUndefined();
    expect(academyBrandStyle('#fbb040')).toEqual({
      '--color-primary': '#fbb040',
      '--color-text-on-primary': '#1c1917',
    });
  });

  it('useAcademyFavicon swaps the favicon and restores it on unmount', () => {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = '/favicon.png';
    document.head.appendChild(link);

    const { unmount } = renderHook(() => useAcademyFavicon('https://cdn.vn/f.png'));
    expect(link.getAttribute('href')).toBe('https://cdn.vn/f.png');
    unmount();
    expect(link.getAttribute('href')).toBe('/favicon.png');
    link.remove();
  });
});
