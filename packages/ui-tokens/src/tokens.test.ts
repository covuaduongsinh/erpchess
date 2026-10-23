import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { colors, cssVariables, darkColors, toKebab } from './index';

describe('ui-tokens', () => {
  it('màu chủ đạo là navy Dương Sinh', () => {
    expect(colors.primary).toBe('#2B3990');
  });

  it('toKebab đổi camelCase sang kebab-case', () => {
    expect(toKebab('textOnPrimary')).toBe('text-on-primary');
    expect(toKebab('bg')).toBe('bg');
  });

  it('cssVariables sinh đủ biến --ds-*', () => {
    const vars = cssVariables();
    expect(vars['--ds-primary']).toBe('#2B3990');
    expect(Object.keys(vars)).toHaveLength(Object.keys(colors).length);
  });

  it('bảng màu tối có đủ khoá như bảng màu sáng', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(colors).sort());
  });

  it('tokens.css khớp với colors', () => {
    const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').toLowerCase();
    for (const [name, value] of Object.entries(colors)) {
      expect(css).toContain(`--color-${toKebab(name)}: ${value.toLowerCase()};`);
    }
  });
});
