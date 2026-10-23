import { type Inline, parseMarkdown } from '@erpchess/domain';
import { Fragment } from 'react';

function Inlines({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) => {
        // Đoạn chữ sinh lại toàn bộ khi nội dung đổi, nên vị trí là khoá ổn định
        const key = i;
        if (p.bold) return <strong key={key}>{p.text}</strong>;
        if (p.italic) return <em key={key}>{p.text}</em>;
        return <Fragment key={key}>{p.text}</Fragment>;
      })}
    </>
  );
}

/** Vẽ Markdown rút gọn bằng phần tử React (không dùng HTML thô). */
export function Markdown({ source }: { source: string }) {
  return (
    <div className="flex flex-col gap-2">
      {parseMarkdown(source).map((block, i) => {
        const key = i;
        switch (block.type) {
          case 'heading': {
            const cls = ['text-xl font-bold', 'text-lg font-bold', 'font-bold'][block.level - 1];
            const Heading = (['h3', 'h4', 'h5'] as const)[block.level - 1] ?? 'h5';
            return (
              <Heading key={key} className={`${cls} text-primary`}>
                <Inlines parts={block.inline} />
              </Heading>
            );
          }
          case 'paragraph':
            return (
              <p key={key}>
                <Inlines parts={block.inline} />
              </p>
            );
          case 'list': {
            const List = block.ordered ? 'ol' : 'ul';
            return (
              <List key={key} className={`pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
                {block.items.map((item, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: mục sinh lại toàn bộ khi nội dung đổi
                  <li key={j}>
                    <Inlines parts={item} />
                  </li>
                ))}
              </List>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
