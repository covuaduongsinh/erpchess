/**
 * Cây ván cờ có biến: mỗi node là một nước đi; con đầu tiên là nhánh chính,
 * các con sau là biến. Dùng cho bàn phân tích, PGN Creator, bài học, lớp trực tuyến.
 */
import { playMove, START_FEN } from './rules';

export type MoveNode = {
  readonly id: string;
  /** Số nửa nước tính từ đầu ván (1 = nước đầu tiên của Trắng). */
  readonly ply: number;
  readonly san: string;
  readonly uci: string;
  /** FEN sau nước đi này. */
  readonly fen: string;
  comment?: string;
  /** Mã NAG theo chuẩn PGN ($1 = !, $2 = ?, $3 = !!, $4 = ??, $5 = !?, $6 = ?!…). */
  nags: number[];
  children: MoveNode[];
};

export type RootNode = {
  readonly id: 'root';
  readonly ply: number;
  readonly fen: string;
  comment?: string;
  children: MoveNode[];
};

export type TreeNode = RootNode | MoveNode;

export class GameTree {
  readonly root: RootNode;
  headers: Record<string, string> = {};
  private readonly nodes = new Map<string, TreeNode>();
  private readonly parents = new Map<string, TreeNode>();
  private nextId = 1;

  constructor(fen: string = START_FEN) {
    this.root = { id: 'root', ply: plyFromFen(fen), fen, children: [] };
    this.nodes.set('root', this.root);
  }

  get(id: string): TreeNode | undefined {
    return this.nodes.get(id);
  }

  parentOf(id: string): TreeNode | undefined {
    return this.parents.get(id);
  }

  /** Nước kế tiếp theo nhánh chính của node. */
  next(id: string): MoveNode | undefined {
    return this.nodes.get(id)?.children[0];
  }

  /**
   * Đi một nước (UCI hoặc SAN) từ node cho trước. Nếu nước đó đã có trong cây thì trả về
   * node sẵn có; nếu chưa, thêm làm con mới (thành biến nếu đã có nhánh chính).
   */
  addMove(parentId: string, move: string): MoveNode | null {
    const parent = this.nodes.get(parentId);
    if (!parent) return null;
    const played = playMove(parent.fen, move);
    if (!played) return null;
    const existing = parent.children.find((c) => c.uci === played.uci);
    if (existing) return existing;
    const node: MoveNode = {
      id: `n${this.nextId++}`,
      ply: parent.ply + 1,
      san: played.san,
      uci: played.uci,
      fen: played.fen,
      nags: [],
      children: [],
    };
    parent.children.push(node);
    this.nodes.set(node.id, node);
    this.parents.set(node.id, parent);
    return node;
  }

  /** Nhánh chính từ đầu ván. */
  mainline(): MoveNode[] {
    const line: MoveNode[] = [];
    let node: TreeNode | undefined = this.root.children[0];
    while (node && node.id !== 'root') {
      line.push(node as MoveNode);
      node = node.children[0];
    }
    return line;
  }

  /** Các nước từ đầu ván tới node (không gồm gốc). */
  path(id: string): MoveNode[] {
    const out: MoveNode[] = [];
    let node = this.nodes.get(id);
    while (node && node.id !== 'root') {
      out.unshift(node as MoveNode);
      node = this.parents.get(node.id);
    }
    return out;
  }

  /** Đưa biến chứa node lên làm nhánh chính ở mọi cấp phía trên. */
  promoteVariation(id: string): void {
    let node = this.nodes.get(id);
    while (node && node.id !== 'root') {
      const parent = this.parents.get(node.id);
      if (!parent) break;
      const idx = parent.children.indexOf(node as MoveNode);
      if (idx > 0) {
        parent.children.splice(idx, 1);
        parent.children.unshift(node as MoveNode);
      }
      node = parent;
    }
  }

  /** Xoá node và toàn bộ nước sau nó. */
  deleteFrom(id: string): void {
    const node = this.nodes.get(id);
    const parent = this.parents.get(id);
    if (!node || !parent) return;
    parent.children = parent.children.filter((c) => c.id !== id);
    const stack: TreeNode[] = [node];
    while (stack.length) {
      const n = stack.pop() as TreeNode;
      this.nodes.delete(n.id);
      this.parents.delete(n.id);
      stack.push(...n.children);
    }
  }

  setComment(id: string, comment: string): void {
    const node = this.nodes.get(id);
    if (node) node.comment = comment.trim() || undefined;
  }
}

/** Số nửa nước đã đi trước thế cờ trong FEN (dựa vào số nước và bên đi). */
function plyFromFen(fen: string): number {
  const parts = fen.trim().split(/\s+/);
  const fullmove = Number(parts[5] ?? 1) || 1;
  return (fullmove - 1) * 2 + (parts[1] === 'b' ? 1 : 0);
}
