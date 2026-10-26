import { useProfile, useSession } from '@erpchess/api/react';
import { isValidFen, type MoveNotation } from '@erpchess/chess-core';
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
  const { session } = useSession();
  const profileQuery = useProfile(session?.user?.id);
  const notation = (profileQuery.data?.move_notation as MoveNotation) ?? 'letters';
  return <AnalysisBoard initialFen={fen} notation={notation} />;
}
