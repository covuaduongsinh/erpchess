import type { GameRow } from '@erpchess/api';
import type { useT } from '../../lib/use-t';

type T = ReturnType<typeof useT>['t'];
const REASONS = [
  'checkmate',
  'resign',
  'timeout',
  'stalemate',
  'repetition',
  'insufficient',
  'fifty',
  'agreement',
  'abort',
] as const;

/** "Trắng thắng · chiếu hết", "Hoà · lặp lại 3 lần", "Đang diễn ra"… */
export function resultText(game: Pick<GameRow, 'status' | 'result' | 'reason'>, t: T): string {
  if (game.status === 'aborted') return t('play.aborted');
  if (game.status !== 'finished') return t('play.inProgress');
  const head =
    game.result === '1-0'
      ? t('play.resultWhite')
      : game.result === '0-1'
        ? t('play.resultBlack')
        : t('play.resultDraw');
  const reason = REASONS.find((r) => r === game.reason);
  return reason ? `${head} · ${t(`play.reason_${reason}`)}` : head;
}

/** Thông báo dễ hiểu cho mã lỗi của trọng tài. */
export function actionErrorKey(code: string | undefined) {
  if (code === 'out_of_sync') return 'play.error_out_of_sync' as const;
  if (code === 'not_your_turn') return 'play.error_not_your_turn' as const;
  if (code === 'illegal_move') return 'play.error_illegal_move' as const;
  if (code === 'game_over') return 'play.error_game_over' as const;
  return null;
}
