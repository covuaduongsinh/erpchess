import { useProfile, useSession } from '@erpchess/api/react';
import { isValidFen, type MoveNotation, parsePgn } from '@erpchess/chess-core';
import { createFileRoute } from '@tanstack/react-router';
import { AnalysisBoard } from '../components/analysis/AnalysisBoard';

type Search = { fen?: string; pgn?: string };

/** PGN trên URL (từ thẻ ván trong chat) chỉ nhận khi đọc được và có nước đi. */
function validPgn(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > 4000) return undefined;
  try {
    return (parsePgn(v)[0]?.mainline().length ?? 0) > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

export const Route = createFileRoute('/analysis')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    // FEN sai trên URL thì bỏ qua, mở thế khởi đầu
    fen: typeof s.fen === 'string' && isValidFen(s.fen) ? s.fen : undefined,
    pgn: validPgn(s.pgn),
  }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const { fen, pgn } = Route.useSearch();
  const { session } = useSession();
  const profileQuery = useProfile(session?.user?.id);
  const notation = (profileQuery.data?.move_notation as MoveNotation) ?? 'letters';
  return (
    <AnalysisBoard
      key={pgn ?? fen}
      initialFen={fen}
      initialPgn={pgn}
      notation={notation}
      showMasterbase={!!session}
    />
  );
}
