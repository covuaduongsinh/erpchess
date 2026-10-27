import type { QuizAttempt, QuizQuestion } from '@erpchess/api';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuizTaker } from './QuizTaker';

afterEach(cleanup);

vi.mock('../../lib/use-t', () => ({
  useT: () => ({
    t: (key: string, opt?: Record<string, unknown>) => {
      if (key === 'quiz.summary') {
        return `${opt?.done}/${opt?.total} câu · ${opt?.score}/${opt?.max} điểm`;
      }
      if (key === 'quiz.question') return `Câu ${opt?.n}`;
      if (key === 'quiz.focusMode') return 'Chế độ tập trung';
      if (key === 'quiz.exitFocus') return 'Thoát tập trung';
      if (key === 'quiz.perQuestionTimer') return `Thời gian: ${opt?.seconds}s`;
      if (key === 'quiz.completedTitle') return 'Hoàn thành bài Quiz!';
      if (key === 'puzzle.prev') return 'Trước';
      if (key === 'puzzle.next') return 'Sau';
      if (key === 'player.points') return `${opt?.count} điểm`;
      if (key === 'activity.mcq') return 'Trắc nghiệm';
      return key;
    },
    i18n: { language: 'vi' },
  }),
}));

const MOCK_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q-1',
    position: 0,
    kind: 'mcq',
    title: 'Câu hỏi Khai cuộc 1',
    points: 10,
    maxAttempts: 2,
    payload: {
      question: 'Nước đi mở màn phổ biến nhất cho Trắng là gì?',
      options: ['1. e4', '1. h4', '1. a4', '1. f3'],
    },
  },
  {
    id: 'q-2',
    position: 1,
    kind: 'mcq',
    title: 'Câu hỏi Khai cuộc 2',
    points: 10,
    maxAttempts: 2,
    payload: {
      question: 'Phòng thủ Sicilian bắt đầu bằng nước đi nào của Đen?',
      options: ['1... c5', '1... e5', '1... d5', '1... Nf6'],
    },
  },
];

const MOCK_ATTEMPTS: QuizAttempt[] = [
  {
    item_id: 'q-1',
    student_id: 'student-1',
    tries: 1,
    solved: true,
    score: 10,
    time_ms: 5000,
    updated_at: new Date().toISOString(),
  },
];

vi.mock('@erpchess/api/react', () => ({
  useQuizQuestions: () => ({
    data: MOCK_QUESTIONS,
    isPending: false,
    error: null,
  }),
  useQuizAttempts: () => ({
    data: MOCK_ATTEMPTS,
    isPending: false,
    error: null,
  }),
  useAnswerQuiz: () => ({
    mutate: vi.fn(),
    data: null,
    isPending: false,
    error: null,
  }),
  useQuizPuzzle: () => ({
    state: { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', status: 'playing' },
    play: vi.fn(),
    retry: vi.fn(),
    error: null,
  }),
}));

describe('QuizTaker', () => {
  it('renders questions navigation, summary score and current question', () => {
    render(<QuizTaker quizId="quiz-123" userId="student-1" startsAt={null} dueAt={null} />);

    expect(screen.getByText('1/2 câu · 10/20 điểm')).toBeTruthy();
    expect(screen.getByText('Câu hỏi Khai cuộc 1')).toBeTruthy();
    expect(screen.getByText('Nước đi mở màn phổ biến nhất cho Trắng là gì?')).toBeTruthy();
  });

  it('navigates between questions using Next and Prev buttons', () => {
    render(<QuizTaker quizId="quiz-123" userId="student-1" startsAt={null} dueAt={null} />);

    const nextBtn = screen.getByRole('button', { name: /Sau →/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText('Câu hỏi Khai cuộc 2')).toBeTruthy();
    expect(screen.getByText('Phòng thủ Sicilian bắt đầu bằng nước đi nào của Đen?')).toBeTruthy();

    const prevBtn = screen.getByRole('button', { name: /← Trước/i });
    fireEvent.click(prevBtn);

    expect(screen.getByText('Câu hỏi Khai cuộc 1')).toBeTruthy();
  });

  it('toggles Focus Mode when the focus mode button is clicked', () => {
    render(<QuizTaker quizId="quiz-123" userId="student-1" startsAt={null} dueAt={null} />);

    const focusBtn = screen.getByTitle('Chế độ tập trung');
    fireEvent.click(focusBtn);

    expect(screen.getByTitle('Thoát tập trung')).toBeTruthy();

    // Toggle back
    fireEvent.click(screen.getByTitle('Thoát tập trung'));
    expect(screen.getByTitle('Chế độ tập trung')).toBeTruthy();
  });
});
