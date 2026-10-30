import {
  inCheck,
  kingSquare,
  legalDests,
  type Puzzle,
  type PuzzleSession,
  puzzleSideToMove,
} from '@erpchess/chess-core';
import { usePuzzleSession } from '@erpchess/chess-core/react';
import { colors, spacing } from '@erpchess/ui-tokens';
import { type ReactNode, useMemo } from 'react';
import { Text, View } from 'react-native';
import { PreferredBoard } from '@/components/PreferredBoard';
import { Button, styles } from '@/components/ui';
import { useT } from '@/lib/use-t';

/** Bàn cờ làm puzzle (bản mobile của apps/web PuzzleSolver). Đặt `key` theo id câu. */
export function PuzzleSolver({
  puzzle,
  onTryEnd,
  children,
}: {
  puzzle: Puzzle;
  onTryEnd?: (session: PuzzleSession) => void;
  children?: ReactNode;
}) {
  const { t } = useT();
  const { session, play, retry } = usePuzzleSession(puzzle, onTryEnd);
  const side = puzzleSideToMove(puzzle);
  const dests = useMemo(() => legalDests(session.fen), [session.fen]);
  const moved = session.moves.length > 0;

  return (
    <View style={{ gap: spacing.sm }}>
      <PreferredBoard
        fen={session.fen}
        orientation={side}
        lastMove={session.lastMove ? [session.lastMove[0], session.lastMove[1]] : undefined}
        check={inCheck(session.fen) ? kingSquare(session.fen) : undefined}
        movable={session.status === 'playing' ? { color: side, dests } : undefined}
        onMove={(from, to, promo) => play(`${from}${to}${promo ?? ''}`)}
        label={t(`puzzle.toMove_${side}`)}
      />
      <View
        accessibilityLiveRegion="polite"
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}
      >
        {session.status === 'playing' && (
          <Text style={[styles.text, moved && { color: colors.green, fontWeight: '500' }]}>
            {moved ? t('puzzle.correct') : t(`puzzle.toMove_${side}`)}
          </Text>
        )}
        {session.status === 'wrong' && (
          <>
            <Text style={[styles.text, { color: colors.danger, fontWeight: '700' }]}>
              {t('puzzle.wrong')}
            </Text>
            <Button title={t('puzzle.retry')} onPress={retry} />
          </>
        )}
        {session.status === 'solved' && (
          <Text style={[styles.text, { color: colors.green, fontWeight: '700' }]}>
            {t('puzzle.solved')}
          </Text>
        )}
        {children}
      </View>
    </View>
  );
}
