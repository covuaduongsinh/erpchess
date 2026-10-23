/**
 * Trình dựng thế cờ: chọn quân trên bảng (hoặc cục tẩy) rồi bấm vào ô để đặt/xoá. Gọi `onChange`
 * với FEN mới sau mỗi thay đổi. Không tự kiểm tính hợp lệ — nơi dùng kiểm theo loại hoạt động
 * (thế cờ thường cần đủ vua; bài "bắt quân" thì không có vua).
 */
import { colors } from '@erpchess/ui-tokens';
import { useState } from 'react';
import {
  boardToFen,
  type Orientation,
  type PieceCode,
  parseBoard,
  SQUARES,
  squareColor,
  squareToGrid,
} from './geometry';
import { CELTIC, pieceLabel } from './pieces';

const PALETTE: PieceCode[] = [
  'wK',
  'wQ',
  'wR',
  'wB',
  'wN',
  'wP',
  'bK',
  'bQ',
  'bR',
  'bB',
  'bN',
  'bP',
];
const START_PLACEMENT = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1';
const EMPTY = '8/8/8/8/8/8/8/8 w - - 0 1';

export type BoardEditorLabels = {
  board: string;
  eraser: string;
  start: string;
  clear: string;
  flip: string;
  sideToMove: string;
  white: string;
  black: string;
};

export function BoardEditor({
  fen,
  onChange,
  labels,
}: {
  fen: string;
  onChange: (fen: string) => void;
  labels: BoardEditorLabels;
}) {
  const [tool, setTool] = useState<PieceCode | 'eraser'>('wP');
  const [orientation, setOrientation] = useState<Orientation>('w');
  const pieces = parseBoard(fen);
  const side = fen.trim().split(/\s+/)[1] === 'b' ? 'b' : 'w';

  function place(square: string) {
    const next = new Map(pieces);
    // Bấm lại đúng quân đang chọn trên ô đó thì xoá, cho thao tác nhanh không cần đổi sang cục tẩy
    if (tool === 'eraser' || next.get(square) === tool) next.delete(square);
    else next.set(square, tool);
    onChange(boardToFen(next, side));
  }

  const ordered = [...SQUARES].sort((a, b) => {
    const ga = squareToGrid(a, orientation);
    const gb = squareToGrid(b, orientation);
    return ga.row - gb.row || ga.col - gb.col;
  });

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-wrap gap-1">
        <legend className="sr-only">{labels.board}</legend>
        {PALETTE.map((code) => (
          <button
            key={code}
            type="button"
            aria-pressed={tool === code}
            aria-label={pieceLabel(code)}
            onClick={() => setTool(code)}
            className="size-10 rounded-md border border-transparent p-0.5 aria-pressed:border-primary aria-pressed:bg-primary/10"
          >
            <img src={CELTIC[code]} alt="" className="size-full" />
          </button>
        ))}
        <button
          type="button"
          aria-pressed={tool === 'eraser'}
          onClick={() => setTool('eraser')}
          className="h-10 rounded-md border border-transparent px-2 text-sm aria-pressed:border-primary aria-pressed:bg-primary/10"
        >
          {labels.eraser}
        </button>
      </fieldset>

      <fieldset className="grid aspect-square w-full max-w-md grid-cols-8 overflow-hidden rounded-md">
        <legend className="sr-only">{labels.board}</legend>
        {ordered.map((sq) => {
          const piece = pieces.get(sq);
          return (
            <button
              key={sq}
              type="button"
              data-square={sq}
              aria-label={`${sq}${piece ? `, ${pieceLabel(piece)}` : ''}`}
              onClick={() => place(sq)}
              style={{
                backgroundColor: squareColor(sq) === 'light' ? colors.boardLight : colors.boardDark,
              }}
              className="aspect-square p-0"
            >
              {piece && (
                <img
                  src={CELTIC[piece]}
                  alt=""
                  data-piece={piece}
                  data-at={sq}
                  className="size-full"
                />
              )}
            </button>
          );
        })}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          className="rounded-md px-3 py-1 text-primary hover:bg-primary/10"
          onClick={() => onChange(boardToFen(parseBoard(START_PLACEMENT), side))}
        >
          {labels.start}
        </button>
        <button
          type="button"
          className="rounded-md px-3 py-1 text-primary hover:bg-primary/10"
          onClick={() => onChange(EMPTY.replace(' w ', ` ${side} `))}
        >
          {labels.clear}
        </button>
        <button
          type="button"
          className="rounded-md px-3 py-1 text-primary hover:bg-primary/10"
          onClick={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))}
        >
          {labels.flip}
        </button>
        <label className="flex items-center gap-2">
          {labels.sideToMove}
          <select
            value={side}
            onChange={(e) => onChange(boardToFen(pieces, e.target.value === 'b' ? 'b' : 'w'))}
            className="rounded-md border border-text-muted/30 bg-white px-2 py-1"
          >
            <option value="w">{labels.white}</option>
            <option value="b">{labels.black}</option>
          </select>
        </label>
      </div>
    </div>
  );
}
