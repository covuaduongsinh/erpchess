import { createI18n } from '@erpchess/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { Home } from './Home';

describe('Home', () => {
  it('hiển thị lời chào tiếng Việt và đổi được sang tiếng Anh', async () => {
    render(
      <I18nextProvider i18n={createI18n('vi')}>
        <Home />
      </I18nextProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Chào mừng đến với ERPChess' })).toBeTruthy();
    expect(screen.getByText('Bạn đang dùng bản web')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(await screen.findByRole('heading', { name: 'Welcome to ERPChess' })).toBeTruthy();
  });
});
