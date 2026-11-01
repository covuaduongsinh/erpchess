import { createI18n } from '@erpchess/i18n';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it } from 'vitest';
import { LevelBadge, type LevelBadgeProps } from './LevelBadge';

function badge(props: LevelBadgeProps, lng: 'vi' | 'en' = 'vi') {
  return render(
    <I18nextProvider i18n={createI18n(lng)}>
      <LevelBadge {...props} />
    </I18nextProvider>,
  );
}

describe('LevelBadge', () => {
  afterEach(() => {
    cleanup();
  });

  it('hiển thị nhãn mặc định khi không truyền tên cấp độ', () => {
    badge({});
    expect(screen.getByText('Chưa phân cấp')).toBeTruthy();
  });

  it('nhận diện và hiển thị biểu tượng Gold Kiwi', () => {
    badge({ name: 'Gold Kiwi' });
    expect(screen.getByText('Gold Kiwi')).toBeTruthy();
  });

  it('nhận diện cấp độ Silver Knight và Master', () => {
    const { unmount } = badge({ name: 'Silver Knight' });
    expect(screen.getByText('Silver Knight')).toBeTruthy();
    unmount();

    badge({ name: 'Master Kiện Tướng' });
    expect(screen.getByText('Master Kiện Tướng')).toBeTruthy();
  });

  it('nhãn và tooltip theo ngôn ngữ, không còn chuỗi cứng', () => {
    const { unmount } = badge({}, 'en');
    expect(screen.getByText('No level yet')).toBeTruthy();
    expect(screen.queryByText('Chưa phân cấp')).toBeNull();
    unmount();
    badge({ name: 'Gold Kiwi' }, 'en');
    expect(screen.getByTitle('Level: Gold Kiwi')).toBeTruthy();
    cleanup();
    badge({ name: 'Gold Kiwi' }, 'vi');
    expect(screen.getByTitle('Cấp độ: Gold Kiwi')).toBeTruthy();
  });
});
