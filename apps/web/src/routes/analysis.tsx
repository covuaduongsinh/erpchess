import { isValidFen } from '@erpchess/chess-core';
import { createFileRoute } from '@tanstack/react-router';
import { AnalysisBoard } from '../components/analysis/AnalysisBoard';

type Search = { fen?: string };

export const Route = createFileRoute('/analysis')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    // FEN sai trên URL thì bỏ qua, mở thế khởi đầu
    fen: typeof s.fen === 'string' && isValidFen(s.fen) ? s.fen : undefined,
  }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const { fen } = Route.useSearch();
  return <AnalysisBoard initialFen={fen} />;
}
