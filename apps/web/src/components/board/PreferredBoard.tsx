import { Board, type BoardProps } from '@erpchess/board-web';
import { useEffect, useRef } from 'react';
import { classifyBoardSound, playBoardSound } from '../../lib/board-sound';
import { useBoardPreferences } from '../../lib/use-board-preferences';

export type PreferredBoardProps = BoardProps & {
  /** Tắt hẳn âm thanh cho bàn này (lưới nhiều bàn, ảnh thu nhỏ). Mặc định theo cài đặt. */
  sound?: boolean;
};

/**
 * Bàn cờ áp dụng cài đặt cá nhân (theme, tọa độ, âm thanh). Prop truyền vào luôn thắng cài đặt,
 * để bàn thu nhỏ vẫn giữ `coordinates={false}`.
 */
export function PreferredBoard({
  theme,
  pieceSet,
  coordinates,
  sound,
  ...rest
}: PreferredBoardProps) {
  const { preferences } = useBoardPreferences();
  const soundOn = sound ?? preferences.soundEnabled;
  const { fen, lastMove, check } = rest;
  const prevFenRef = useRef<string | null>(null);

  useEffect(() => {
    const prevFen = prevFenRef.current;
    prevFenRef.current = fen;
    // Lần vẽ đầu tiên hoặc không có nước vừa đi thì không phát tiếng
    if (prevFen === null || prevFen === fen || !lastMove || !soundOn) return;
    playBoardSound(classifyBoardSound(prevFen, fen, check));
  }, [fen, lastMove, check, soundOn]);

  return (
    <Board
      {...rest}
      theme={theme ?? preferences.theme}
      pieceSet={pieceSet ?? preferences.pieceSet}
      coordinates={coordinates ?? preferences.coordinates}
    />
  );
}

/**
 * Hướng bàn khi bật "tự xoay theo lượt": bên đến lượt nằm dưới. Hướng gốc 'b' nghĩa là người
 * dùng đã bấm lật, nên đảo lại so với bên đến lượt.
 */
export function autoFlipOrientation(
  orientation: 'w' | 'b',
  sideToMove: 'w' | 'b',
  autoFlip: boolean,
): 'w' | 'b' {
  if (!autoFlip) return orientation;
  if (orientation === 'w') return sideToMove;
  return sideToMove === 'w' ? 'b' : 'w';
}
