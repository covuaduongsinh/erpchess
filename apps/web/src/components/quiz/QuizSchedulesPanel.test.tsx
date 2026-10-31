import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizSchedulesPanel } from './QuizSchedulesPanel';

const createMutate = vi.fn();
const runNowMutate = vi.fn();
const setActiveMutate = vi.fn();
let schedules: unknown[];

const S1 = '00000000-0000-4000-8000-000000000001';
const S2 = '00000000-0000-4000-8000-000000000002';

const mutation = (mutate = vi.fn()) => ({
  mutate,
  isPending: false,
  isSuccess: false,
  error: null,
  data: undefined,
});

vi.mock('@erpchess/api/react', () => ({
  useQuizSchedules: () => ({ isPending: false, error: null, data: schedules }),
  useStudies: ({ scope }: { scope: string }) => ({
    data:
      scope === 'mine'
        ? [{ id: S1, title: 'Đòn ghim' }]
        : [
            { id: S2, title: 'Chiếu hết 2 nước' },
            { id: S1, title: 'Đòn ghim' },
          ],
  }),
  useGroups: () => ({ data: [{ id: 'g1', name: 'Lớp U10' }] }),
  useMembers: () => ({ data: [] }),
  useQuizScheduleMutations: () => ({
    create: mutation(createMutate),
    runNow: mutation(runNowMutate),
    setActive: mutation(setActiveMutate),
    remove: mutation(),
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
  createMutate.mockReset();
  runNowMutate.mockReset();
  setActiveMutate.mockReset();
  schedules = [];
});

describe('QuizSchedulesPanel', () => {
  it('lists a schedule with its next study and runs it now', () => {
    schedules = [
      {
        id: 'sc1',
        name: 'Quiz cuối tuần',
        days: [0, 6],
        at_time: '19:00:00',
        timezone: 'Asia/Ho_Chi_Minh',
        expires_on: null,
        study_ids: [S1, S2],
        next_index: 1,
        active: true,
        last_run_at: null,
        targets: [],
      },
    ];
    render(<QuizSchedulesPanel />);
    expect(screen.getByText('Quiz cuối tuần')).toBeTruthy();
    expect(
      screen.getByText('quizSchedule.next:{"title":"Chiếu hết 2 nước","n":2,"total":2}'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /quizSchedule.runNow/ }));
    expect(runNowMutate).toHaveBeenCalledWith('sc1');
    fireEvent.click(screen.getByRole('button', { name: 'quizSchedule.pause' }));
    expect(setActiveMutate).toHaveBeenCalledWith({ id: 'sc1', active: false });
  });

  it('creates a schedule with days, study sequence and a group', () => {
    render(<QuizSchedulesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /quizSchedule.create/ }));
    fireEvent.change(screen.getByLabelText('quizSchedule.name'), {
      target: { value: 'Quiz tối thứ 3' },
    });
    // Mặc định chọn Thứ bảy; bỏ Thứ bảy, chọn Thứ ba
    fireEvent.click(screen.getByRole('button', { name: 'weekday.d6' }));
    fireEvent.click(screen.getByRole('button', { name: 'weekday.d2' }));
    const add = screen.getByLabelText('quizSchedule.addStudy');
    fireEvent.change(add, { target: { value: S2 } });
    fireEvent.change(add, { target: { value: S1 } });
    fireEvent.click(screen.getByRole('button', { name: /Lớp U10/ }));
    fireEvent.click(screen.getByRole('button', { name: 'quizSchedule.save' }));

    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Quiz tối thứ 3',
        days: [2],
        atTime: '19:00',
        studyIds: [S2, S1],
        groupIds: ['g1'],
        studentIds: [],
        expiresOn: null,
        openHours: 24,
      }),
      expect.anything(),
    );
  });
});
