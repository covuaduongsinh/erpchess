import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LichessImportDialog } from './LichessImportDialog';

const listLichessStudies = vi.fn();
const importMutate = vi.fn();
let importData: unknown;

vi.mock('@erpchess/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('@erpchess/api')>();
  return {
    parseLichessStudyInput: real.parseLichessStudyInput,
    listLichessStudies: (...a: unknown[]) => listLichessStudies(...a),
  };
});
vi.mock('@erpchess/api/react', () => ({
  useImportLichessStudies: () => ({
    mutate: importMutate,
    isPending: false,
    error: null,
    data: importData,
    progress: null,
  }),
}));
vi.mock('../../lib/academy-context', () => ({
  useAcademy: () => ({ academy: { id: 'a1' }, session: { user: { id: 'u1' } } }),
}));
vi.mock('../../lib/use-t', () => ({
  validationKey: () => null,
  useT: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
    i18n: { language: 'vi' },
  }),
}));

afterEach(cleanup);
beforeEach(() => {
  listLichessStudies.mockReset();
  importMutate.mockReset();
  importData = undefined;
});

describe('LichessImportDialog', () => {
  it('browses a user, picks studies and imports them', async () => {
    listLichessStudies.mockResolvedValue([
      { id: 'aaaaaaaa', name: 'Đòn ghim', updatedAt: 2 },
      { id: 'bbbbbbbb', name: 'Tàn cuộc', updatedAt: 1 },
    ]);
    render(<LichessImportDialog onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('lichessImport.input'), {
      target: { value: '@thibault' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'lichessImport.browse' }));
    await waitFor(() => expect(screen.getByText('Đòn ghim')).toBeTruthy());
    expect(listLichessStudies).toHaveBeenCalledWith('thibault');

    fireEvent.click(screen.getByRole('button', { name: 'lichessImport.all' }));
    fireEvent.click(screen.getByRole('button', { name: /lichessImport.import/ }));
    expect(importMutate).toHaveBeenCalledWith(['aaaaaaaa', 'bbbbbbbb']);
  });

  it('a pasted study link is selected directly without browsing', () => {
    render(<LichessImportDialog onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('lichessImport.input'), {
      target: { value: 'https://lichess.org/study/AbCdEfGh' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'lichessImport.browse' }));
    expect(listLichessStudies).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /lichessImport.import/ }));
    expect(importMutate).toHaveBeenCalledWith(['AbCdEfGh']);
  });

  it('shows per-study results', () => {
    importData = [
      { lichessId: 'aaaaaaaa', studyId: 's1', title: 'Đòn ghim', activities: 3, skipped: 1 },
      { lichessId: 'bbbbbbbb', studyId: null, title: 'bbbbbbbb', activities: 0, skipped: 0 },
    ];
    render(<LichessImportDialog onClose={vi.fn()} />);
    const status = screen.getByRole('status').textContent ?? '';
    expect(status).toContain('lichessImport.done');
    expect(status).toContain('lichessImport.failed');
  });
});
