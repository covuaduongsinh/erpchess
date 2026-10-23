import { createI18n } from '@erpchess/i18n';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityEditor } from './ActivityEditor';

function setup(kind: 'mcq' | 'capture') {
  const onSave = vi.fn();
  render(
    <I18nextProvider i18n={createI18n('vi')}>
      <ActivityEditor
        kind={kind}
        academyId="a"
        studyId="s"
        saving={false}
        error={null}
        onSave={onSave}
        onCancel={() => {}}
      />
    </I18nextProvider>,
  );
  return onSave;
}

afterEach(cleanup);

describe('ActivityEditor', () => {
  it('trắc nghiệm: ghép câu hỏi, phương án và đáp án đúng', () => {
    const onSave = setup('mcq');
    fireEvent.change(screen.getByLabelText('Câu hỏi'), { target: { value: 'Quân nào đi chéo?' } });
    fireEvent.change(screen.getByLabelText('Phương án 1'), { target: { value: 'Xe' } });
    fireEvent.change(screen.getByLabelText('Phương án 2'), { target: { value: 'Tượng' } });
    fireEvent.click(screen.getByLabelText('Phương án 2 là đáp án đúng'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hoạt động' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'mcq',
        points: 10,
        payload: { question: 'Quân nào đi chéo?', options: ['Xe', 'Tượng'], correct: 1 },
      }),
    );
  });

  it('bắt quân: bàn trống bị chặn, thế mẫu thì lưu được', () => {
    const onSave = setup('capture');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hoạt động' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'capture',
        payload: { fen: '8/8/8/p3p3/8/8/8/R7 w - - 0 1' },
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Xoá bàn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hoạt động' }));
    expect(screen.getByRole('alert').textContent).toBe('Chưa có quân đối phương để bắt.');
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
