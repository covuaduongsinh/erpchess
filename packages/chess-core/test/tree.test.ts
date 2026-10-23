import { describe, expect, it } from 'vitest';
import { START_FEN } from '../src/rules';
import { GameTree } from '../src/tree';

describe('GameTree', () => {
  it('thêm nước tạo nhánh chính; nước đã có thì dùng lại node', () => {
    const tree = new GameTree();
    const e4 = tree.addMove(tree.root.id, 'e2e4');
    const e5 = tree.addMove(e4?.id ?? '', 'e7e5');
    expect(e5?.ply).toBe(2);
    expect(tree.mainline().map((n) => n.san)).toEqual(['e4', 'e5']);
    expect(tree.addMove(tree.root.id, 'e4')?.id).toBe(e4?.id);
    expect(tree.root.children).toHaveLength(1);
  });

  it('nước khác ở cùng chỗ thành biến; nhánh chính không đổi', () => {
    const tree = new GameTree();
    const e4 = tree.addMove(tree.root.id, 'e4');
    tree.addMove(e4?.id ?? '', 'e5');
    const c5 = tree.addMove(e4?.id ?? '', 'c5');
    expect(tree.mainline().map((n) => n.san)).toEqual(['e4', 'e5']);
    expect(tree.path(c5?.id ?? '').map((n) => n.san)).toEqual(['e4', 'c5']);
    expect(tree.get(e4?.id ?? '')?.children.map((n) => n.san)).toEqual(['e5', 'c5']);
  });

  it('nước không hợp lệ trả về null, cây không đổi', () => {
    const tree = new GameTree();
    expect(tree.addMove(tree.root.id, 'e2e5')).toBeNull();
    expect(tree.addMove('khong-co', 'e4')).toBeNull();
    expect(tree.root.children).toHaveLength(0);
  });

  it('nâng biến lên nhánh chính và xoá từ một node', () => {
    const tree = new GameTree();
    const e4 = tree.addMove(tree.root.id, 'e4');
    tree.addMove(e4?.id ?? '', 'e5');
    const c5 = tree.addMove(e4?.id ?? '', 'c5');
    tree.addMove(c5?.id ?? '', 'Nf3');
    tree.promoteVariation(c5?.id ?? '');
    expect(tree.mainline().map((n) => n.san)).toEqual(['e4', 'c5', 'Nf3']);
    tree.deleteFrom(c5?.id ?? '');
    expect(tree.mainline().map((n) => n.san)).toEqual(['e4', 'e5']);
    expect(tree.get(c5?.id ?? '')).toBeUndefined();
  });

  it('bắt đầu từ FEN tuỳ ý, ply tính theo số nước trong FEN', () => {
    const tree = new GameTree('4k3/8/8/8/8/8/4P3/4K3 b - - 0 10');
    const kd7 = tree.addMove(tree.root.id, 'Kd7');
    expect(kd7?.ply).toBe(20);
    expect(new GameTree().root.fen).toBe(START_FEN);
  });

  it('đi tới/lùi theo nhánh hiện tại', () => {
    const tree = new GameTree();
    const e4 = tree.addMove(tree.root.id, 'e4');
    const e5 = tree.addMove(e4?.id ?? '', 'e5');
    expect(tree.next(tree.root.id)?.id).toBe(e4?.id);
    expect(tree.parentOf(e5?.id ?? '')?.id).toBe(e4?.id);
    expect(tree.parentOf(tree.root.id)).toBeUndefined();
    expect(tree.next(e5?.id ?? '')).toBeUndefined();
  });
});
