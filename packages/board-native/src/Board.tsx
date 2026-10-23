/**
 * Bàn cờ cho React Native (Android/iOS, và web qua react-native-web khi export).
 * Cùng hành vi với @erpchess/board-web: bấm quân rồi bấm ô đích, hoặc kéo-thả;
 * hiện ô có thể đi; hộp chọn quân phong cấp; lật bàn; cờ mù.
 * Hình học bàn cờ dùng chung với bản web (@erpchess/board-web/geometry).
 */
import {
  type Orientation,
  type PieceCode,
  parseBoard,
  pointToSquare,
  SQUARES,
  squareColor,
  squareToGrid,
} from '@erpchess/board-web/geometry';
import { needsPromotion } from '@erpchess/chess-core';
import { colors } from '@erpchess/ui-tokens';
import { useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Svg, { Circle, Rect, SvgXml } from 'react-native-svg';
import { CELTIC_XML } from './pieces.generated';

export type NativeBoardProps = {
  fen: string;
  orientation?: Orientation;
  lastMove?: readonly [string, string];
  check?: string;
  movable?: { color: 'w' | 'b' | 'both'; dests: Map<string, string[]> };
  onMove?: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => void;
  hiddenSquares?: readonly string[];
  coordinates?: boolean;
  /** Nhãn cho trình đọc màn hình. */
  label?: string;
};

type Drag = { from: string; x: number; y: number; moved: boolean };

const NAMES: Record<string, string> = { q: 'Hậu', n: 'Mã', r: 'Xe', b: 'Tượng' };

export function Board({
  fen,
  orientation = 'w',
  lastMove,
  check,
  movable,
  onMove,
  hiddenSquares = [],
  coordinates = true,
  label = 'Bàn cờ',
}: NativeBoardProps) {
  const [size, setSize] = useState(0);
  const pieces = useMemo(() => parseBoard(fen), [fen]);
  const hidden = useMemo(() => new Set(hiddenSquares), [hiddenSquares]);
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  // Trạng thái kéo trong ref (cập nhật đồng bộ); state chỉ để vẽ quân đang bay
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const cell = size / 8;

  const canMoveFrom = (square: string) => {
    const piece = pieces.get(square);
    if (!movable || !piece) return false;
    if (movable.color !== 'both' && piece[0] !== movable.color) return false;
    return (movable.dests.get(square)?.length ?? 0) > 0;
  };

  const tryMove = (from: string, to: string) => {
    if (!movable?.dests.get(from)?.includes(to)) return false;
    setSelected(null);
    if (needsPromotion(fen, from, to)) setPromotion({ from, to });
    else onMove?.(from, to);
    return true;
  };

  const activate = (square: string) => {
    if (promotion) return;
    if (selected && selected !== square && tryMove(selected, square)) return;
    setSelected(canMoveFrom(square) && selected !== square ? square : null);
  };

  const squareAt = (x: number, y: number) => pointToSquare(x, y, size, orientation);

  // Callback của usePanGesture (RNGH 3) có thể giữ closure của lần render cũ (thế cờ cũ,
  // ô đang chọn cũ). Luôn gọi qua ref trỏ tới các hàm của lần render mới nhất.
  const latest = useRef({ squareAt, canMoveFrom, activate, tryMove, promotion });
  latest.current = { squareAt, canMoveFrom, activate, tryMove, promotion };

  const pan = usePanGesture({
    minDistance: 0,
    runOnJS: true,
    onBegin: (e) => {
      const l = latest.current;
      const square = l.squareAt(e.x, e.y);
      if (!square || l.promotion) return;
      dragRef.current = l.canMoveFrom(square)
        ? { from: square, x: e.x, y: e.y, moved: false }
        : null;
      if (!dragRef.current) l.activate(square);
    },
    onUpdate: (e) => {
      const current = dragRef.current;
      if (!current) return;
      dragRef.current = { ...current, x: e.x, y: e.y, moved: true };
      setDrag(dragRef.current);
    },
    onFinalize: (e) => {
      const l = latest.current;
      const current = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!current || e.canceled) return;
      const target = l.squareAt(e.x, e.y);
      if (target && target !== current.from) {
        if (!l.tryMove(current.from, target)) setSelected(null);
      } else {
        // Chạm rồi nhả tại chỗ: hành vi chọn/bỏ chọn như bấm
        l.activate(current.from);
      }
    },
  });

  const xy = (square: string) => {
    const { col, row } = squareToGrid(square, orientation);
    return { x: col * cell, y: row * cell };
  };
  const dests = selected ? (movable?.dests.get(selected) ?? []) : [];

  return (
    <View
      style={styles.container}
      onLayout={(e: LayoutChangeEvent) => setSize(Math.floor(e.nativeEvent.layout.width))}
      accessibilityLabel={label}
    >
      {size > 0 && (
        <GestureDetector gesture={pan}>
          <View style={{ width: size, height: size }}>
            <Svg width={size} height={size}>
              {SQUARES.map((sq) => {
                const { x, y } = xy(sq);
                return (
                  <Rect
                    key={sq}
                    x={x}
                    y={y}
                    width={cell}
                    height={cell}
                    fill={squareColor(sq) === 'light' ? colors.boardLight : colors.boardDark}
                  />
                );
              })}
              {lastMove?.map((sq) => (
                <Rect
                  key={`last-${sq}`}
                  {...xy(sq)}
                  width={cell}
                  height={cell}
                  fill="rgba(251,176,64,0.45)"
                />
              ))}
              {selected && (
                <Rect {...xy(selected)} width={cell} height={cell} fill="rgba(43,57,144,0.35)" />
              )}
              {check && (
                <Circle
                  cx={xy(check).x + cell / 2}
                  cy={xy(check).y + cell / 2}
                  r={cell / 2}
                  fill="rgba(220,38,38,0.55)"
                />
              )}
              {dests.map((sq) => (
                <Circle
                  key={`d-${sq}`}
                  cx={xy(sq).x + cell / 2}
                  cy={xy(sq).y + cell / 2}
                  r={pieces.has(sq) ? cell / 2 - 3 : cell / 7}
                  fill={pieces.has(sq) ? 'none' : 'rgba(43,57,144,0.45)'}
                  stroke={pieces.has(sq) ? 'rgba(43,57,144,0.5)' : undefined}
                  strokeWidth={pieces.has(sq) ? 5 : 0}
                />
              ))}
            </Svg>

            {[...pieces.entries()].map(([sq, code]) => {
              if (hidden.has(sq) || (drag?.moved && drag.from === sq)) return null;
              const { x, y } = xy(sq);
              return (
                <View
                  key={`p-${sq}`}
                  pointerEvents="none"
                  testID={`piece-${sq}`}
                  accessibilityLabel={`${sq} ${code}`}
                  style={[styles.piece, { left: x, top: y, width: cell, height: cell }]}
                >
                  <SvgXml xml={CELTIC_XML[code]} width={cell} height={cell} />
                </View>
              );
            })}

            {coordinates &&
              SQUARES.filter((sq) => squareToGrid(sq, orientation).col === 0).map((sq) => (
                <Text
                  key={`r-${sq}`}
                  pointerEvents="none"
                  style={[styles.coord, { left: 2, top: xy(sq).y + 1, color: coordColor(sq) }]}
                >
                  {sq[1]}
                </Text>
              ))}
            {coordinates &&
              SQUARES.filter((sq) => squareToGrid(sq, orientation).row === 7).map((sq) => (
                <Text
                  key={`f-${sq}`}
                  pointerEvents="none"
                  style={[
                    styles.coord,
                    { left: xy(sq).x + cell - 10, top: size - 14, color: coordColor(sq) },
                  ]}
                >
                  {sq[0]}
                </Text>
              ))}

            {drag?.moved && pieces.get(drag.from) && (
              <View
                pointerEvents="none"
                style={[
                  styles.piece,
                  { left: drag.x - cell / 2, top: drag.y - cell / 2, width: cell, height: cell },
                ]}
              >
                <SvgXml
                  xml={CELTIC_XML[pieces.get(drag.from) as PieceCode]}
                  width={cell}
                  height={cell}
                />
              </View>
            )}
          </View>
        </GestureDetector>
      )}

      {promotion && (
        <View style={styles.overlay} accessibilityViewIsModal>
          <View style={styles.picker}>
            {(['q', 'n', 'r', 'b'] as const).map((p) => {
              const color = (pieces.get(promotion.from) ?? 'wP')[0] as 'w' | 'b';
              return (
                <Pressable
                  key={p}
                  accessibilityRole="button"
                  accessibilityLabel={NAMES[p]}
                  onPress={() => {
                    const { from, to } = promotion;
                    setPromotion(null);
                    onMove?.(from, to, p);
                  }}
                  style={{ width: cell * 1.2, height: cell * 1.2 }}
                >
                  <SvgXml
                    xml={CELTIC_XML[`${color}${p.toUpperCase()}` as PieceCode]}
                    width={cell * 1.2}
                    height={cell * 1.2}
                  />
                </Pressable>
              );
            })}
          </View>
          <Pressable accessibilityRole="button" onPress={() => setPromotion(null)}>
            <Text style={styles.cancel}>✕</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function coordColor(sq: string) {
  return squareColor(sq) === 'light' ? colors.boardDark : colors.boardLight;
}

const styles = StyleSheet.create({
  // Giới hạn cỡ trên máy tính bảng/màn hình rộng, căn giữa
  container: { width: '100%', maxWidth: 560, aspectRatio: 1, alignSelf: 'center' },
  piece: { position: 'absolute' },
  coord: { position: 'absolute', fontSize: 10, fontWeight: '700' },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  picker: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 4,
  },
  cancel: { color: colors.white, fontSize: 24 },
});
