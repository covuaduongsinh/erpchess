/**
 * Đọc/ghi PGN có biến lồng nhau, chú thích ({…} và ;), NAG ($n và !, ?, !!, ??, !?, ?!).
 * chess.js chỉ đọc được nhánh chính nên phần này tự viết, dùng GameTree để kiểm luật đi.
 */
import { START_FEN } from './rules';
import { GameTree, type MoveNode, type TreeNode } from './tree';

const SUFFIX_NAGS: Record<string, number> = { '!': 1, '?': 2, '!!': 3, '??': 4, '!?': 5, '?!': 6 };
const RESULTS = new Set(['1-0', '0-1', '1/2-1/2', '*']);

type Token =
  | { kind: 'tag'; key: string; value: string }
  | { kind: 'comment'; text: string }
  | { kind: 'open' }
  | { kind: 'close' }
  | { kind: 'nag'; value: number }
  | { kind: 'result'; value: string }
  | { kind: 'move'; san: string; nags: number[] };

export class PgnError extends Error {
  override name = 'PgnError';
}

/** Đọc một hoặc nhiều ván từ văn bản PGN. */
export function parsePgn(text: string): GameTree[] {
  const games: GameTree[] = [];
  let tags: Record<string, string> = {};
  let game: GameState | null = null;

  const finish = () => {
    if (game) games.push(game.tree);
    game = null;
  };

  for (const token of tokenize(text)) {
    if (token.kind === 'tag') {
      // Tag sau phần nước đi nghĩa là ván mới bắt đầu
      if (game) finish();
      tags[token.key] = token.value;
      continue;
    }
    if (!game) {
      game = startGame(tags);
      tags = {};
    }
    const g: GameState = game;
    switch (token.kind) {
      case 'move': {
        const node = g.tree.addMove(g.cursor.id, token.san);
        if (!node) throw new PgnError(`Nước không hợp lệ trong PGN: ${token.san}`);
        node.nags.push(...token.nags);
        if (g.pendingComment) {
          node.comment = joinComment(node.comment, g.pendingComment);
          g.pendingComment = undefined;
        }
        g.last = node;
        g.cursor = node;
        break;
      }
      case 'comment':
        if (g.last) g.last.comment = joinComment(g.last.comment, token.text);
        else if (g.cursor.id === 'root')
          g.tree.root.comment = joinComment(g.tree.root.comment, token.text);
        else g.pendingComment = joinComment(g.pendingComment, token.text);
        break;
      case 'nag':
        g.last?.nags.push(token.value);
        break;
      case 'open': {
        // Biến thay thế cho nước vừa đi: bắt đầu lại từ thế trước nước đó
        if (!g.last) throw new PgnError('Biến "(" xuất hiện trước nước đi đầu tiên');
        g.stack.push({ cursor: g.cursor, last: g.last });
        g.cursor = g.tree.parentOf(g.last.id) ?? g.tree.root;
        g.last = undefined;
        break;
      }
      case 'close': {
        const saved = g.stack.pop();
        if (!saved) throw new PgnError('Dấu ")" không khớp');
        g.cursor = saved.cursor;
        g.last = saved.last;
        break;
      }
      case 'result':
        if (g.stack.length) throw new PgnError('Kết quả ván nằm trong biến chưa đóng');
        g.tree.headers.Result ??= token.value;
        finish();
        break;
    }
  }
  finish();
  return games;
}

type GameState = {
  tree: GameTree;
  cursor: TreeNode;
  last?: MoveNode;
  pendingComment?: string;
  stack: { cursor: TreeNode; last?: MoveNode }[];
};

function startGame(tags: Record<string, string>): GameState {
  const fen = tags.FEN?.trim() || START_FEN;
  const tree = new GameTree(fen);
  tree.headers = { ...tags };
  return { tree, cursor: tree.root, stack: [] };
}

function joinComment(a: string | undefined, b: string): string {
  return a ? `${a} ${b}` : b;
}

function* tokenize(text: string): Generator<Token> {
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i] as string;
    if (/\s/.test(c)) {
      i++;
    } else if (c === '[') {
      const end = text.indexOf(']', i);
      const m = /^\[\s*(\w+)\s+"((?:[^"\\]|\\.)*)"\s*\]$/.exec(text.slice(i, end + 1));
      if (end < 0 || !m) throw new PgnError(`Tag PGN không hợp lệ gần vị trí ${i}`);
      yield { kind: 'tag', key: m[1] as string, value: (m[2] as string).replace(/\\(.)/g, '$1') };
      i = end + 1;
    } else if (c === '{') {
      const end = text.indexOf('}', i);
      if (end < 0) throw new PgnError('Chú thích "{" chưa đóng');
      yield {
        kind: 'comment',
        text: text
          .slice(i + 1, end)
          .trim()
          .replace(/\s+/g, ' '),
      };
      i = end + 1;
    } else if (c === ';') {
      const end = text.indexOf('\n', i);
      const stop = end < 0 ? n : end;
      yield { kind: 'comment', text: text.slice(i + 1, stop).trim() };
      i = stop;
    } else if (c === '(') {
      yield { kind: 'open' };
      i++;
    } else if (c === ')') {
      yield { kind: 'close' };
      i++;
    } else if (c === '$') {
      const m = /^\$(\d+)/.exec(text.slice(i));
      if (!m) throw new PgnError(`NAG không hợp lệ gần vị trí ${i}`);
      yield { kind: 'nag', value: Number(m[1]) };
      i += m[0].length;
    } else {
      const m = /^[^\s{}();[\]$]+/.exec(text.slice(i));
      const word = m?.[0] as string;
      i += word.length;
      if (RESULTS.has(word)) {
        yield { kind: 'result', value: word };
        continue;
      }
      // Bỏ số nước "12." / "12..." (có thể dính liền nước đi: "12.Nf3")
      const san = word.replace(/^\d+\.+/, '');
      if (!san) continue;
      const suffix = /(!!|\?\?|!\?|\?!|!|\?)$/.exec(san);
      const bare = (suffix ? san.slice(0, -suffix[0].length) : san).replace(/^0-0(-0)?/, (s) =>
        s.replaceAll('0', 'O'),
      );
      yield { kind: 'move', san: bare, nags: suffix ? [SUFFIX_NAGS[suffix[0]] as number] : [] };
    }
  }
}

/** Ghi cây ván cờ thành PGN (tag, nhánh chính, biến, chú thích, NAG, kết quả). */
export function toPgn(tree: GameTree): string {
  const headers = { ...tree.headers };
  if (tree.root.fen !== START_FEN) {
    headers.SetUp = '1';
    headers.FEN = tree.root.fen;
  }
  const result = headers.Result ?? '*';
  const tagLines = Object.entries(headers).map(
    ([k, v]) => `[${k} "${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`,
  );

  const parts: string[] = [];
  if (tree.root.comment) parts.push(`{${tree.root.comment}}`);
  parts.push(...writeLine(tree.root.children, true));
  parts.push(result);
  const movetext = parts.join(' ');
  return tagLines.length ? `${tagLines.join('\n')}\n\n${movetext}\n` : `${movetext}\n`;
}

/** Ghi một nhánh: nước chính, các biến thay thế ngay sau nó, rồi đi tiếp nhánh chính. */
function writeLine(nodes: readonly MoveNode[], forceNumber: boolean): string[] {
  const out: string[] = [];
  let current = nodes;
  let force = forceNumber;
  while (current.length) {
    const [main, ...alts] = current as [MoveNode, ...MoveNode[]];
    out.push(writeMove(main, force));
    force = Boolean(main.comment);
    for (const alt of alts) {
      out.push(`(${writeLine([alt], true).join(' ')})`);
      force = true;
    }
    current = main.children;
  }
  return out;
}

function writeMove(node: MoveNode, forceNumber: boolean): string {
  const moveNo = Math.ceil(node.ply / 2);
  const white = node.ply % 2 === 1;
  let s = white ? `${moveNo}. ${node.san}` : forceNumber ? `${moveNo}... ${node.san}` : node.san;
  for (const nag of node.nags) s += ` $${nag}`;
  if (node.comment) s += ` {${node.comment}}`;
  return s;
}
