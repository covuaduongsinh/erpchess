import { createI18n } from '@erpchess/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { GameViewer } from './GameViewer';

const PGN = `[White "Nguyễn"]
[Black "Trần"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 Nf6 1-0`;

describe('GameViewer với Analysis toggle', () => {
  it('hiển thị toggle phân tích khi showAnalysisToggle=true và cho phép bật tắt', () => {
    render(
      <I18nextProvider i18n={createI18n('vi')}>
        <GameViewer pgn={PGN} showAnalysisToggle={true} />
      </I18nextProvider>,
    );

    const toggle = screen.getByLabelText(/Phân tích Arasan NNUE/i) as HTMLInputElement;
    expect(toggle).toBeTruthy();
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);
    expect(screen.getByText('Đang chạy phân tích thế cờ')).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
  });
});
