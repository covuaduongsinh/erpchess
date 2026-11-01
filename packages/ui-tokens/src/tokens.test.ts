import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  colors,
  cssVariables,
  darkColors,
  darkDerivedColors,
  darkNativeColors,
  derivedColors,
  nativeColors,
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

  describe('bản hex cho mobile khớp color-mix của CSS', () => {
    // Trộn trong không gian oklab giống `color-mix(in oklab, ...)`
    const toLinear = (c: number) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const toSrgb = (c: number) => {
      const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
      return Math.max(0, Math.min(255, Math.round(v * 255)));
    };
    const parse = (hex: string): [number, number, number] => [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ];
    const toOklab = ([r0, g0, b0]: [number, number, number]) => {
      const [r, g, b] = [toLinear(r0), toLinear(g0), toLinear(b0)];
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
      const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
      return [
        0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
      ] as const;
    };
    const fromOklab = ([L, a, b]: readonly [number, number, number]) => {
      const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
      const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
      const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
      return [
        toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
      ];
    };
    /** `pct`% của primary trộn với `base`. */
    const mix = (base: string, pct: number) => {
      const p = toOklab(parse(colors.primary));
      const b = toOklab(parse(base));
      return fromOklab(
        [0, 1, 2].map((i) => (b[i] ?? 0) + ((p[i] ?? 0) - (b[i] ?? 0)) * (pct / 100)) as [
          number,
          number,
          number,
        ],
      );
    };
    const close = (hex: string, rgb: number[]) => {
      parse(hex).forEach((c, i) => {
        expect(Math.abs(c - (rgb[i] ?? 0))).toBeLessThanOrEqual(1);
      });
    };

    it('bản sáng: primary-soft 8% trên trắng, app-bg 4% trên nền #F8F9FC', () => {
      close(nativeColors.primarySoft, mix('#FFFFFF', 8));
      close(nativeColors.appBg, mix('#F8F9FC', 4));
    });

    it('bản tối: primary-soft 22% trên bề mặt tối, app-bg 10% trên nền tối', () => {
      close(darkNativeColors.primarySoft, mix(darkColors.surface, 22));
      close(darkNativeColors.appBg, mix(darkColors.bg, 10));
    });
  });

  it('chế độ tối làm sáng chữ màu chính theo --color-primary (kể cả màu thương hiệu)', () => {
    const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
    const rule = css.slice(css.indexOf('.dark .text-primary'));
    expect(rule).toContain('color-mix(in oklab, var(--color-primary) 40%, white)');
    expect(rule).toContain(String.raw`.dark .hover\:text-primary:hover`);
    // Các biến thể đang dùng trong ứng dụng: mục sidebar đang mở, nút bấm, tab đang chọn, nhóm khi rê chuột
    for (const variant of [
      String.raw`.dark .group:hover .group-hover\:text-primary`,
      String.raw`.dark .data-\[active\=true\]\:text-primary[data-active="true"]`,
      String.raw`.dark .aria-pressed\:text-primary[aria-pressed="true"]`,
      String.raw`.dark .aria-selected\:text-primary[aria-selected="true"]`,
    ])
      expect(rule, variant).toContain(variant);
  });
});
