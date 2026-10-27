import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LevelBadge } from './LevelBadge';

describe('LevelBadge', () => {
  afterEach(() => {
    cleanup();
  });

  it('hiển thị nhãn mặc định khi không truyền tên cấp độ', () => {
    render(<LevelBadge />);
    expect(screen.getByText('Chưa phân cấp')).toBeTruthy();
  });

  it('nhận diện và hiển thị biểu tượng Gold Kiwi', () => {
    render(<LevelBadge name="Gold Kiwi" />);
    expect(screen.getByText('Gold Kiwi')).toBeTruthy();
    expect(screen.getByText('🥝')).toBeTruthy();
  });

  it('nhận diện cấp độ Silver Knight và Master', () => {
    const { unmount } = render(<LevelBadge name="Silver Knight" />);
    expect(screen.getByText('Silver Knight')).toBeTruthy();
    expect(screen.getByText('🛡️')).toBeTruthy();
    unmount();

    render(<LevelBadge name="Master Kiện Tướng" />);
    expect(screen.getByText('Master Kiện Tướng')).toBeTruthy();
    expect(screen.getByText('👑')).toBeTruthy();
  });
});
