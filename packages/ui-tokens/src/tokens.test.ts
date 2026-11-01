import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  colors,
  cssVariables,
  darkColors,
  darkDerivedColors,
  derivedColors,
  radius,
  toKebab,
} from './index';

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

  it('màu suy ra (primary-soft, app-bg) khớp tokens.css và bám --color-primary', () => {
    const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
    for (const [name, value] of Object.entries(derivedColors)) {
      expect(css).toContain(`--color-${toKebab(name)}: ${value};`);
      expect(value).toContain('var(--color-primary)');
    }
    expect(radius.card).toBe(16);
    expect(css).toContain('--radius-card: 16px;');
  });

  it('khối .dark khai báo đủ biến màu tối khác bản sáng', () => {
    const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').toLowerCase();
    const dark = css.slice(css.indexOf('.dark {'));
    for (const [name, value] of Object.entries(darkColors)) {
      if (value === colors[name as keyof typeof colors]) continue;
      expect(dark, name).toContain(`--color-${toKebab(name)}: ${value.toLowerCase()};`);
    }
    for (const [name, value] of Object.entries(darkDerivedColors)) {
      expect(dark, name).toContain(`--color-${toKebab(name)}: ${value};`);
    }
  });

  it('phần tử data-brand tính lại màu nhạt theo màu thương hiệu (sáng và tối)', () => {
    const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
    const light = css.slice(css.indexOf('[data-brand] {'), css.indexOf('.dark [data-brand]'));
    const dark = css.slice(css.indexOf('.dark [data-brand]'));
    for (const [name, value] of Object.entries(derivedColors))
      expect(light).toContain(`--color-${toKebab(name)}: ${value};`);
    for (const [name, value] of Object.entries(darkDerivedColors))
      expect(dark).toContain(`--color-${toKebab(name)}: ${value};`);
  });
});
