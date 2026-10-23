/**
 * Bàn cờ SVG cho web và desktop. Tự viết (MIT) để không phụ thuộc chessground (GPL).
 * - Đi quân: kéo-thả (chuột/cảm ứng qua pointer events) hoặc bấm ô đi rồi bấm ô đích.
 * - Vẽ: chuột phải kéo = mũi tên, chuột phải bấm = tô ô (Shift đỏ, Alt xanh dương, Ctrl vàng).
 * - Bàn phím: Tab vào bàn, phím mũi tên chọn ô, Enter/Space để chọn/đi, Esc để huỷ.
 * Bàn cờ không giữ luật cờ: bên ngoài truyền `dests` (từ chess-core) và nhận `onMove`.
 */
import { colors } from '@erpchess/ui-tokens';
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  isPromotionMove,
  moveFocus,
  type Orientation,
  type PieceCode,
  parseBoard,
  pointToSquare,
  SQUARES,
  squareColor,
  squareToGrid,
} from './geometry';
import { CELTIC, pieceLabel } from './pieces';

export type Brush = 'green' | 'red' | 'blue' | 'yellow';
export type Arrow = { from: string; to: string; brush: Brush };
export type Highlight = { square: string; brush: Brush };
export type Drawings = { arrows: Arrow[]; highlights: Highlight[] };

export type BoardProps = {
  fen: string;
  orientation?: Orientation;
  /** Ô đi và ô đến của nước vừa đi, để tô nổi. */
  lastMove?: readonly [string, string];
  /** Ô vua đang bị chiếu. */
  check?: string;
  /** Bên được đi quân và các nước hợp lệ (từ legalDests). Bỏ trống = chỉ xem. */
  movable?: { color: 'w' | 'b' | 'both'; dests: Map<string, string[]> };
  onMove?: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => void;
  drawings?: Drawings;
  onDrawingsChange?: (d: Drawings) => void;
  /** Các ô có quân bị ẩn (cờ mù). */
  hiddenSquares?: readonly string[];
  coordinates?: boolean;
  /** Nhãn cho trình đọc màn hình. */
  label?: string;
};

const SIZE = 800;
const CELL = SIZE / 8;
const BRUSH: Record<Brush, string> = {
  green: '#15781B',
  red: '#882020',
  blue: '#003088',
  yellow: '#E68F00',
};
const PROMOTION_PIECES = ['q', 'n', 'r', 'b'] as const;

type Drag = { from: string; x: number; y: number; moved: boolean };

export function Board({
  fen,
  orientation = 'w',
  lastMove,
  check,
  movable,
  onMove,
  drawings = { arrows: [], highlights: [] },
  onDrawingsChange,
  hiddenSquares = [],
  coordinates = true,
  label = 'Bàn cờ',
}: BoardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pieces = useMemo(() => parseBoard(fen), [fen]);
  const [selected, setSelected] = useState<string | null>(null);
  // Trạng thái kéo/vẽ giữ trong ref (cập nhật đồng bộ): pointermove/pointerup có thể tới
  // trước khi React vẽ lại, đọc từ state sẽ thấy giá trị cũ và bỏ lỡ cú kéo nhanh.
  // State `drag` chỉ dùng để vẽ quân đang bay theo con trỏ.
  const dragRef = useRef<Drag | null>(null);
  const drawStartRef = useRef<{ square: string; brush: Brush } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const [focus, setFocus] = useState<string>(orientation === 'w' ? 'e2' : 'e7');
  const markerId = useId();
  const hidden = useMemo(() => new Set(hiddenSquares), [hiddenSquares]);

  const canMoveFrom = useCallback(
    (square: string) => {
      if (!movable) return false;
      const piece = pieces.get(square);
      if (!piece) return false;
      if (movable.color !== 'both' && piece[0] !== movable.color) return false;
      return (movable.dests.get(square)?.length ?? 0) > 0;
    },
    [movable, pieces],
  );

  const tryMove = useCallback(
    (from: string, to: string): boolean => {
      if (!movable?.dests.get(from)?.includes(to)) return false;
      setSelected(null);
      if (isPromotionMove(pieces, from, to)) {
        setPromotion({ from, to });
      } else {
        onMove?.(from, to);
      }
      return true;
    },
    [pieces, movable, onMove],
  );

  /** Chọn ô: nếu đang chọn quân và ô là nước hợp lệ thì đi; nếu là quân mình thì chọn lại. */
  const activate = useCallback(
    (square: string) => {
      if (promotion) return;
      if (selected && selected !== square && tryMove(selected, square)) return;
      setSelected(canMoveFrom(square) && selected !== square ? square : null);
    },
    [canMoveFrom, promotion, selected, tryMove],
  );

  function toBoardPoint(e: { clientX: number; clientY: number }) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return {
      x: ((e.clientX - rect.left) / rect.width) * SIZE,
      y: ((e.clientY - rect.top) / rect.height) * SIZE,
    };
  }

  function squareFromEvent(e: PointerEvent<SVGSVGElement>): string | null {
    const target = (e.target as Element).closest?.('[data-square]');
    if (target) return target.getAttribute('data-square');
    const p = toBoardPoint(e);
    return p ? pointToSquare(p.x, p.y, SIZE, orientation) : null;
  }

  function brushFor(e: { shiftKey: boolean; altKey: boolean; ctrlKey: boolean }): Brush {
    if (e.shiftKey) return 'red';
    if (e.altKey) return 'blue';
    if (e.ctrlKey) return 'yellow';
    return 'green';
  }

  function onPointerDown(e: PointerEvent<SVGSVGElement>) {
    const square = squareFromEvent(e);
    if (!square) return;
    if (e.button === 2) {
      drawStartRef.current = { square, brush: brushFor(e) };
      return;
    }
    if (e.button !== 0) return;
    // Bấm trái xoá các hình vẽ tạm (như các bàn cờ phổ biến)
    if (drawings.arrows.length || drawings.highlights.length) {
      onDrawingsChange?.({ arrows: [], highlights: [] });
    }
    setFocus(square);
    if (canMoveFrom(square) && selected !== square) {
      const p = toBoardPoint(e) ?? { x: 0, y: 0 };
      dragRef.current = { from: square, x: p.x, y: p.y, moved: false };
      setSelected(square);
      svgRef.current?.setPointerCapture?.(e.pointerId);
      return;
    }
    activate(square);
  }

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    const current = dragRef.current;
    if (!current) return;
    const p = toBoardPoint(e);
    if (!p) return;
    dragRef.current = { ...current, x: p.x, y: p.y, moved: true };
    setDrag(dragRef.current);
  }

  function onPointerUp(e: PointerEvent<SVGSVGElement>) {
    const drawStart = drawStartRef.current;
    if (drawStart && e.button === 2) {
      drawStartRef.current = null;
      const end = squareFromEvent(e) ?? drawStart.square;
      toggleDrawing(drawStart.square, end, drawStart.brush);
      return;
    }
    const current = dragRef.current;
    if (!current) return;
    dragRef.current = null;
    setDrag(null);
    const p = toBoardPoint(e);
    const target = p ? pointToSquare(p.x, p.y, SIZE, orientation) : null;
    // Thả ở ô khác ô xuất phát là một nước kéo-thả (không dựa vào pointermove,
    // trình duyệt có thể gộp/bỏ bớt sự kiện di chuyển khi kéo rất nhanh)
    if (target && target !== current.from) {
      if (!tryMove(current.from, target)) setSelected(null);
    }
  }

  function toggleDrawing(from: string, to: string, brush: Brush) {
    if (!onDrawingsChange) return;
    if (from === to) {
      const exists = drawings.highlights.find((h) => h.square === from && h.brush === brush);
      const highlights = drawings.highlights.filter((h) => h.square !== from);
      onDrawingsChange({
        ...drawings,
        highlights: exists ? highlights : [...highlights, { square: from, brush }],
      });
    } else {
      const exists = drawings.arrows.find(
        (a) => a.from === from && a.to === to && a.brush === brush,
      );
      const arrows = drawings.arrows.filter((a) => !(a.from === from && a.to === to));
      onDrawingsChange({
        ...drawings,
        arrows: exists ? arrows : [...arrows, { from, to, brush }],
      });
    }
  }

  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      setFocus(moveFocus(focus, e.key, orientation));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate(focus);
    } else if (e.key === 'Escape') {
      setSelected(null);
      setPromotion(null);
    }
  }

  const dests = selected ? (movable?.dests.get(selected) ?? []) : [];
  const xy = (square: string) => {
    const { col, row } = squareToGrid(square, orientation);
    return { x: col * CELL, y: row * CELL };
  };
  const focusPiece = pieces.get(focus);
  const focusText = `${focus}${focusPiece && !hidden.has(focus) ? `, ${pieceLabel(focusPiece)}` : ''}`;

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="application"
        aria-label={label}
        aria-roledescription="bàn cờ"
        aria-activedescendant={`${markerId}-${focus}`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: role="application" — bàn cờ tự xử lý phím mũi tên/Enter
        tabIndex={0}
        style={{ width: '100%', height: '100%', touchAction: 'none', userSelect: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={onKeyDown}
      >
        <defs>
          {(Object.keys(BRUSH) as Brush[]).map((b) => (
            <marker
              key={b}
              id={`${markerId}-head-${b}`}
              markerWidth="4"
              markerHeight="4"
              refX="2.05"
              refY="2"
              orient="auto"
            >
              <path d="M0,0 V4 L3,2 Z" fill={BRUSH[b]} />
            </marker>
          ))}
        </defs>

        {SQUARES.map((sq) => {
          const { x, y } = xy(sq);
          const piece = pieces.get(sq);
          return (
            <rect
              key={sq}
              id={`${markerId}-${sq}`}
              data-square={sq}
              aria-label={`${sq}${piece && !hidden.has(sq) ? `, ${pieceLabel(piece)}` : ''}`}
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              fill={squareColor(sq) === 'light' ? colors.boardLight : colors.boardDark}
            />
          );
        })}

        {lastMove?.map((sq) => (
          <rect
            key={`last-${sq}`}
            {...xy(sq)}
            width={CELL}
            height={CELL}
            fill="rgba(251,176,64,0.45)"
            pointerEvents="none"
          />
        ))}
        {drawings.highlights.map((h) => (
          <rect
            key={`hl-${h.square}`}
            {...xy(h.square)}
            width={CELL}
            height={CELL}
            fill={BRUSH[h.brush]}
            fillOpacity={0.45}
            pointerEvents="none"
          />
        ))}
        {selected && (
          <rect
            {...xy(selected)}
            width={CELL}
            height={CELL}
            fill="rgba(43,57,144,0.35)"
            pointerEvents="none"
          />
        )}
        {check && (
          <circle
            cx={xy(check).x + CELL / 2}
            cy={xy(check).y + CELL / 2}
            r={CELL / 2}
            fill="rgba(220,38,38,0.55)"
            pointerEvents="none"
          />
        )}
        {focus && (
          <rect
            {...xy(focus)}
            width={CELL}
            height={CELL}
            fill="none"
            stroke={colors.orange}
            strokeWidth={4}
            className="board-focus"
            pointerEvents="none"
          />
        )}

        {coordinates &&
          SQUARES.filter(
            (sq) =>
              squareToGrid(sq, orientation).col === 0 || squareToGrid(sq, orientation).row === 7,
          ).flatMap((sq) => {
            const { x, y } = xy(sq);
            const { col, row } = squareToGrid(sq, orientation);
            const fill = squareColor(sq) === 'light' ? colors.boardDark : colors.boardLight;
            const out = [];
            if (col === 0)
              out.push(
                <text
                  key={`r-${sq}`}
                  x={x + 4}
                  y={y + 18}
                  fontSize={16}
                  fontWeight={700}
                  fill={fill}
                  pointerEvents="none"
                >
                  {sq[1]}
                </text>,
              );
            if (row === 7)
              out.push(
                <text
                  key={`f-${sq}`}
                  x={x + CELL - 14}
                  y={y + CELL - 6}
                  fontSize={16}
                  fontWeight={700}
                  fill={fill}
                  pointerEvents="none"
                >
                  {sq[0]}
                </text>,
              );
            return out;
          })}

        {[...pieces.entries()].map(([sq, code]) => {
          if (hidden.has(sq) || drag?.from === sq) return null;
          const { x, y } = xy(sq);
          return (
            <image
              key={`p-${sq}`}
              data-piece={code}
              data-at={sq}
              href={CELTIC[code]}
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              pointerEvents="none"
            />
          );
        })}

        {dests.map((sq) => {
          const { x, y } = xy(sq);
          const occupied = pieces.has(sq);
          return occupied ? (
            <circle
              key={`d-${sq}`}
              data-dest={sq}
              cx={x + CELL / 2}
              cy={y + CELL / 2}
              r={CELL / 2 - 4}
              fill="none"
              stroke="rgba(43,57,144,0.5)"
              strokeWidth={8}
              pointerEvents="none"
            />
          ) : (
            <circle
              key={`d-${sq}`}
              data-dest={sq}
              cx={x + CELL / 2}
              cy={y + CELL / 2}
              r={CELL / 7}
              fill="rgba(43,57,144,0.45)"
              pointerEvents="none"
            />
          );
        })}

        {drawings.arrows.map((a) => {
          const from = xy(a.from);
          const to = xy(a.to);
          return (
            <line
              key={`a-${a.from}-${a.to}`}
              data-arrow={`${a.from}${a.to}`}
              x1={from.x + CELL / 2}
              y1={from.y + CELL / 2}
              x2={to.x + CELL / 2}
              y2={to.y + CELL / 2}
              stroke={BRUSH[a.brush]}
              strokeWidth={CELL / 6}
              strokeOpacity={0.8}
              strokeLinecap="round"
              markerEnd={`url(#${markerId}-head-${a.brush})`}
              pointerEvents="none"
            />
          );
        })}

        {drag?.moved && pieces.get(drag.from) && (
          <image
            href={CELTIC[pieces.get(drag.from) as PieceCode]}
            x={drag.x - CELL / 2}
            y={drag.y - CELL / 2}
            width={CELL}
            height={CELL}
            pointerEvents="none"
          />
        )}
      </svg>

      <span aria-live="polite" style={visuallyHidden}>
        {focusText}
      </span>

      {promotion && (
        <PromotionPicker
          color={(pieces.get(promotion.from) ?? 'wP')[0] as 'w' | 'b'}
          left={(squareToGrid(promotion.to, orientation).col / 8) * 100}
          fromTop={squareToGrid(promotion.to, orientation).row === 0}
          onPick={(p) => {
            const { from, to } = promotion;
            setPromotion(null);
            onMove?.(from, to, p);
          }}
          onCancel={() => setPromotion(null)}
        />
      )}
    </div>
  );
}

function PromotionPicker({
  color,
  left,
  fromTop,
  onPick,
  onCancel,
}: {
  color: 'w' | 'b';
  left: number;
  fromTop: boolean;
  onPick: (p: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
}) {
  const names: Record<string, string> = { q: 'Hậu', n: 'Mã', r: 'Xe', b: 'Tượng' };
  return (
    <div
      role="dialog"
      aria-label="Chọn quân phong cấp"
      style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }}
      onPointerDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        style={{
          position: 'absolute',
          left: `${left}%`,
          width: '12.5%',
          [fromTop ? 'top' : 'bottom']: 0,
          display: 'flex',
          flexDirection: fromTop ? 'column' : 'column-reverse',
          background: colors.white,
          borderRadius: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}
      >
        {PROMOTION_PIECES.map((p) => (
          <button
            key={p}
            type="button"
            aria-label={names[p]}
            onClick={() => onPick(p)}
            style={{
              aspectRatio: '1 / 1',
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <img
              src={CELTIC[`${color}${p.toUpperCase()}` as PieceCode]}
              alt=""
              style={{ width: '100%' }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;
