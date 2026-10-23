import { createI18n } from '@erpchess/i18n';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { EngineLab } from './EngineLab';

describe('trang /engine', () => {
  it('trang chưa cross-origin isolated thì báo rõ lý do, không nạp engine', () => {
    render(
      <I18nextProvider i18n={createI18n('vi')}>
        <EngineLab />
      </I18nextProvider>,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'Trình duyệt này chưa chạy được engine (trang chưa bật cross-origin isolation (COOP/COEP)).',
    );
  });
});
