import { describe, expect, it } from 'vitest';
import { parsePgn, toPgn } from '../src/pgn';
import { GameTree } from '../src/tree';

const OPERA = `[Event "Paris Opera"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[White "Morphy, Paul"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 {Đây là nước yếu.} 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6
7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8
13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

describe('parsePgn', () => {
  it('đọc tag, nhánh chính, chú thích và kết quả', () => {
    const [game] = parsePgn(OPERA);
    expect(game?.headers.White).toBe('Morphy, Paul');
    const main = game?.mainline() ?? [];
    expect(main).toHaveLength(33);
    expect(main.at(-1)?.san).toBe('Rd8#');
    expect(main[5]?.comment).toBe('Đây là nước yếu.');
    expect(game?.headers.Result).toBe('1-0');
  });

  it('đọc biến lồng nhau, NAG và ký hiệu !?', () => {
    const [game] = parsePgn(
      '1. e4 e5 (1... c5 2. Nf3 (2. c3 d5) 2... d6) 2. Nf3!? $14 Nc6 { mở } *',
    );
    const e4 = game?.root.children[0];
    expect(e4?.children.map((n) => n.san)).toEqual(['e5', 'c5']);
    const c5 = e4?.children[1];
    expect(c5?.children.map((n) => n.san)).toEqual(['Nf3', 'c3']);
    expect(c5?.children[1]?.children[0]?.san).toBe('d5');
    expect(c5?.children[0]?.children[0]?.san).toBe('d6');
    const nf3 = e4?.children[0]?.children[0];
    expect(nf3?.san).toBe('Nf3');
    expect(nf3?.nags).toEqual([5, 14]);
    expect(nf3?.children[0]?.comment).toBe('mở');
  });

  it('đọc nhiều ván trong một file, chú thích dòng và ván bắt đầu từ FEN', () => {
    const games = parsePgn(`[White "A"]
1. d4 ; chú thích tới hết dòng
d5 1/2-1/2

[White "B"]
[SetUp "1"]
[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]
1. e4 Kd7 *`);
    expect(games).toHaveLength(2);
    expect(games[0]?.mainline().map((n) => n.san)).toEqual(['d4', 'd5']);
    expect(games[0]?.mainline()[0]?.comment).toBe('chú thích tới hết dòng');
    expect(games[1]?.root.fen).toBe('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(games[1]?.mainline().map((n) => n.san)).toEqual(['e4', 'Kd7']);
  });

  it('từ chối tag FEN là thế bất hợp lệ (bên không đi đang bị chiếu)', () => {
    expect(() =>
      parsePgn(`[FEN "7k/8/6K1/8/8/2B5/8/5B2 w - - 0 1"]

1. Bg7+ *`),
    ).toThrow(/FEN/);
  });

  it('báo lỗi rõ khi có nước không hợp lệ', () => {
    expect(() => parsePgn('1. e4 e5 2. Ke3')).toThrow(/Ke3/);
  });
});

describe('toPgn', () => {
  it('ghi biến, chú thích, NAG; parse lại cho cây giống hệt', () => {
    const src = '1. e4 e5 (1... c5 2. Nf3 (2. c3 d5) 2... d6) 2. Nf3!? $14 Nc6 {mở} *';
    const [game] = parsePgn(src);
    const out = toPgn(game as GameTree);
    expect(out).toContain('1. e4 e5 (1... c5 2. Nf3 (2. c3 d5) 2... d6) 2. Nf3 $5 $14 Nc6 {mở} *');
    const [again] = parsePgn(out);
    expect(snapshot(again as GameTree)).toEqual(snapshot(game as GameTree));
  });

  it('ghi tag và FEN khi ván không bắt đầu từ thế chuẩn', () => {
    const tree = new GameTree('4k3/8/8/8/8/8/4P3/4K3 b - - 0 10');
    tree.headers.White = 'HV';
    tree.addMove(tree.root.id, 'Kd7');
    const out = toPgn(tree);
    expect(out).toContain('[White "HV"]');
    expect(out).toContain('[FEN "4k3/8/8/8/8/8/4P3/4K3 b - - 0 10"]');
    expect(out).toContain('[SetUp "1"]');
    expect(out).toContain('10... Kd7 *');
  });

  it('ván Opera parse → ghi → parse giữ nguyên', () => {
    const [game] = parsePgn(OPERA);
    const [again] = parsePgn(toPgn(game as GameTree));
    expect(snapshot(again as GameTree)).toEqual(snapshot(game as GameTree));
  });
});

type Snap = { san: string; comment?: string; nags: number[]; children: Snap[] };
function snapshot(tree: GameTree): Snap[] {
  const walk = (
    nodes: readonly {
      san: string;
      comment?: string;
      nags: readonly number[];
      children: readonly unknown[];
    }[],
  ): Snap[] =>
    nodes.map((n) => ({
      san: n.san,
      comment: n.comment,
      nags: [...n.nags],
      children: walk(n.children as typeof nodes),
    }));
  return walk(tree.root.children);
}
