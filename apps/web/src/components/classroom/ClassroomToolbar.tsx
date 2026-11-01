import type { ClassroomRoom, RoomSnapshot } from '@erpchess/api';
import { isValidFen, START_FEN } from '@erpchess/chess-core';
import { type FormEvent, useState } from 'react';
import { Button } from '../ui';

export type ClassroomToolbarProps = {
  room: ClassroomRoom | null;
  snapshot: RoomSnapshot;
  runner: boolean;
  flipped: boolean;
  onToggleFlip: () => void;
};

export function ClassroomToolbar({
  room,
  snapshot,
  runner,
  flipped,
  onToggleFlip,
}: ClassroomToolbarProps) {
  const [fenInput, setFenInput] = useState('');
  const [showFenBox, setShowFenBox] = useState(false);

  function handleReset() {
    if (!room) return;
    room.setFen(START_FEN);
  }

  function handleUndo() {
    if (!room) return;
    room.undo();
  }

  function handleToggleEngine() {
    if (!room) return;
    room.setEngine(!snapshot.engine);
  }

  function handleClearDrawings() {
    if (!room) return;
    room.setDrawings({ arrows: [], highlights: [] });
  }

  function handleApplyFen(e: FormEvent) {
    e.preventDefault();
    if (!room) return;
    const cleanFen = fenInput.trim();
    if (!isValidFen(cleanFen)) return;
    room.setFen(cleanFen);
    setFenInput('');
    setShowFenBox(false);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Nút lật cờ & xóa nét vẽ chung */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            onClick={onToggleFlip}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 font-medium text-text hover:bg-primary-soft"
            title="Đổi hướng nhìn bàn cờ Trắng / Đen"
          >
            <span>🔄</span>
            <span>{flipped ? 'Nhìn quân Trắng' : 'Nhìn quân Đen'}</span>
          </Button>

          {runner && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClearDrawings}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 font-medium text-text hover:bg-primary-soft"
              title="Xóa tất cả mũi tên và ô cờ được tô màu"
            >
              <span>🧹</span>
              <span>Xóa nét vẽ</span>
            </Button>
          )}
        </div>

        {/* Công cụ sư phạm dành riêng cho HLV */}
        {runner && room && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              onClick={handleUndo}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 font-medium text-text hover:bg-primary-soft"
              title="Hoàn tác 1 nước đi"
            >
              <span>↩️</span>
              <span>Đi lại (Undo)</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={handleReset}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 font-medium text-text hover:bg-primary-soft"
              title="Đặt lại thế cờ ban đầu"
            >
              <span>🔁</span>
              <span>Ván mới</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              aria-pressed={snapshot.engine}
              onClick={handleToggleEngine}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 font-semibold transition-colors ${
                snapshot.engine
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                  : 'text-text hover:bg-primary-soft'
              }`}
              title="Bật/Tắt động cơ phân tích Arasan & thanh EvalBar"
            >
              <span>{snapshot.engine ? '⚡' : '🤖'}</span>
              <span>{snapshot.engine ? 'Tắt Engine' : 'Bật Engine'}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowFenBox((prev) => !prev)}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 font-medium text-primary hover:bg-primary/10"
              title="Nạp chuỗi FEN thế cờ bất kỳ"
            >
              <span>📋</span>
              <span>{showFenBox ? 'Đóng FEN' : 'Nạp FEN'}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Hộp nạp FEN mở rộng */}
      {runner && showFenBox && (
        <form
          onSubmit={handleApplyFen}
          className="flex items-center gap-2 pt-2 border-t border-border"
        >
          <input
            type="text"
            aria-label="Chuỗi FEN thế cờ"
            placeholder="Dán chuỗi FEN thế cờ (VD: r1bqkbnr/pppp1ppp/...)"
            value={fenInput}
            onChange={(e) => setFenInput(e.target.value)}
            className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 font-mono text-xs text-text placeholder:text-text-muted focus:border-primary focus:outline-hidden"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!fenInput.trim() || !isValidFen(fenInput.trim())}
            className="text-xs px-3 py-1.5 whitespace-nowrap"
          >
            Áp dụng
          </Button>
          {fenInput.trim() && !isValidFen(fenInput.trim()) && (
            <span className="text-xs text-danger font-medium">FEN không hợp lệ</span>
          )}
        </form>
      )}
    </div>
  );
}
