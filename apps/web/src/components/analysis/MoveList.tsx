import type { GameTree, MoveNode } from '@erpchess/chess-core';
import type { ReactNode } from 'react';

const NAG_SYMBOLS: Record<number, string> = { 1: '!', 2: '?', 3: '!!', 4: '??', 5: '!?', 6: '?!' };

/** Danh sách nước đi dạng cây: nhánh chính in đậm, biến trong ngoặc, bấm để nhảy tới nước. */
export function MoveList({
  tree,
  currentId,
  onSelect,
}: {
  tree: GameTree;
  currentId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-1 gap-y-1 text-sm leading-7">
      {tree.root.comment && <Comment text={tree.root.comment} />}
      {renderLine(tree.root.children, true, true, currentId, onSelect)}
    </div>
  );
}

function renderLine(
  nodes: readonly MoveNode[],
  mainline: boolean,
  forceNumber: boolean,
  currentId: string,
  onSelect: (id: string) => void,
): ReactNode[] {
  const out: ReactNode[] = [];
  let current = nodes;
  let force = forceNumber;
  while (current.length) {
    const [main, ...alts] = current as [MoveNode, ...MoveNode[]];
    out.push(
      <MoveButton
        key={main.id}
        node={main}
        showNumber={force || main.ply % 2 === 1}
        active={main.id === currentId}
        mainline={mainline}
        onSelect={onSelect}
      />,
    );
    if (main.comment) out.push(<Comment key={`${main.id}-c`} text={main.comment} />);
    force = Boolean(main.comment);
    for (const alt of alts) {
      out.push(
        <span
          key={`var-${alt.id}`}
          className="inline-flex flex-wrap items-baseline gap-x-1 text-text-muted"
        >
          ({renderLine([alt], false, true, currentId, onSelect)})
        </span>,
      );
      force = true;
    }
    current = main.children;
  }
  return out;
}

function MoveButton({
  node,
  showNumber,
  active,
  mainline,
  onSelect,
}: {
  node: MoveNode;
  showNumber: boolean;
  active: boolean;
  mainline: boolean;
  onSelect: (id: string) => void;
}) {
  const moveNo = Math.ceil(node.ply / 2);
  const number = node.ply % 2 === 1 ? `${moveNo}.` : `${moveNo}…`;
  const nags = node.nags.map((n) => NAG_SYMBOLS[n] ?? '').join('');
  return (
    <button
      type="button"
      data-move-id={node.id}
      aria-current={active ? 'true' : undefined}
      onClick={() => onSelect(node.id)}
      className={`rounded-sm px-1 ${mainline ? 'font-medium text-text' : ''} ${
        active ? 'bg-primary text-text-on-primary' : 'hover:bg-primary/10'
      }`}
    >
      {showNumber && <span className="mr-0.5 text-text-muted">{number}</span>}
      {node.san}
      {nags}
    </button>
  );
}

function Comment({ text }: { text: string }) {
  return <span className="text-green italic">{text}</span>;
}
