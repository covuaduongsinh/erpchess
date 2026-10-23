import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown } from './markdown';

describe('parseInline', () => {
  it('đậm, nghiêng, dấu sao lẻ', () => {
    expect(parseInline('Xe **mạnh** hơn *tượng* 2*3')).toEqual([
      { text: 'Xe ' },
      { text: 'mạnh', bold: true },
      { text: ' hơn ' },
      { text: 'tượng', italic: true },
      { text: ' 2*3' },
    ]);
  });
});

describe('parseMarkdown', () => {
  it('tiêu đề, đoạn nhiều dòng, hai loại danh sách', () => {
    const blocks = parseMarkdown(
      '# Xe\nXe đi thẳng\ntheo hàng và cột.\n\n- Ăn quân\n- Bảo vệ\n1. Bước một\n2) Bước hai',
    );
    expect(blocks).toEqual([
      { type: 'heading', level: 1, inline: [{ text: 'Xe' }] },
      { type: 'paragraph', inline: [{ text: 'Xe đi thẳng theo hàng và cột.' }] },
      { type: 'list', ordered: false, items: [[{ text: 'Ăn quân' }], [{ text: 'Bảo vệ' }]] },
      { type: 'list', ordered: true, items: [[{ text: 'Bước một' }], [{ text: 'Bước hai' }]] },
    ]);
  });

  it('thẻ HTML chỉ là chữ thường', () => {
    expect(parseMarkdown('<script>alert(1)</script>')).toEqual([
      { type: 'paragraph', inline: [{ text: '<script>alert(1)</script>' }] },
    ]);
  });
});
