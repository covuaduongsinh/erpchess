import { useCallback, useMemo, useRef, useState } from 'react';
import {
  GameTree,
  isValidFen,
  type Puzzle,
  type PuzzleSession,
  parsePgn,
  playPuzzleMove,
  retryPuzzleSession,
  startPuzzleSession,
  type TreeNode,
} from './index';

/**
 * Giữ một GameTree (đối tượng có thể thay đổi) cùng nước đang xem.
 * Mỗi thay đổi tăng `version` để React vẽ lại.
 */
export function useGameTree(initialFen?: string) {
  const treeRef = useRef(new GameTree(initialFen));
  const [currentId, setCurrentId] = useState<string>('root');
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const tree = treeRef.current;
  const current: TreeNode = tree.get(currentId) ?? tree.root;

  const play = useCallback(
    (move: string) => {
      const node = treeRef.current.addMove(currentId, move);
      if (!node) return false;
      setCurrentId(node.id);
      bump();
      return true;
    },
    [bump, currentId],
  );

  const goTo = useCallback((id: string) => {
    if (treeRef.current.get(id)) setCurrentId(id);
  }, []);

  const back = useCallback(() => {
    const parent = treeRef.current.parentOf(currentId);
    if (parent) setCurrentId(parent.id);
  }, [currentId]);

  const forward = useCallback(() => {
    const next = treeRef.current.next(currentId);
    if (next) setCurrentId(next.id);
  }, [currentId]);

  const toStart = useCallback(() => setCurrentId('root'), []);

  const toEnd = useCallback(() => {
    let id = currentId;
    for (let next = treeRef.current.next(id); next; next = treeRef.current.next(id)) id = next.id;
    setCurrentId(id);
  }, [currentId]);

  /** Nạp FEN hoặc PGN (lấy ván đầu tiên). Ném lỗi nếu không đọc được. */
  const load = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      let next: GameTree;
      if (isValidFen(trimmed)) {
        next = new GameTree(trimmed);
      } else {
        const [game] = parsePgn(trimmed);
        if (!game) throw new Error('không có ván nào');
        next = game;
      }
      treeRef.current = next;
      setCurrentId('root');
      bump();
    },
    [bump],
  );

  const mutate = useCallback(
    (fn: (t: GameTree) => void, nextId?: string) => {
      fn(treeRef.current);
      if (nextId) setCurrentId(nextId);
      bump();
    },
    [bump],
  );

  return useMemo(
    () => ({ tree, current, version, play, goTo, back, forward, toStart, toEnd, load, mutate }),
    [tree, current, version, play, goTo, back, forward, toStart, toEnd, load, mutate],
  );
}

/**
 * Làm một puzzle: chấm ngay từng nước, đối phương tự đáp. `onTryEnd` được gọi đúng một lần
 * mỗi khi lượt thử kết thúc (sai hoặc giải xong) — nơi gọi nộp `moves` lên server ở đây.
 */
export function usePuzzleSession(puzzle: Puzzle, onTryEnd?: (session: PuzzleSession) => void) {
  const [session, setSession] = useState(() => startPuzzleSession(puzzle, Date.now()));
  // Giữ bản mới nhất trong ref: hai nước đi liên tiếp trước khi React vẽ lại vẫn đúng
  const latest = useRef(session);
  const onTryEndRef = useRef(onTryEnd);
  onTryEndRef.current = onTryEnd;

  const play = useCallback(
    (uci: string) => {
      const prev = latest.current;
      const next = playPuzzleMove(puzzle, prev, uci, Date.now());
      if (next === prev) return;
      latest.current = next;
      setSession(next);
      if (next.status !== 'playing') onTryEndRef.current?.(next);
    },
    [puzzle],
  );

  const retry = useCallback(() => {
    const next = retryPuzzleSession(puzzle, Date.now());
    latest.current = next;
    setSession(next);
  }, [puzzle]);

  return { session, play, retry };
}
