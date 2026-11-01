/**
 * Design token dùng chung cho web, desktop và mobile.
 * Bảng màu theo bộ nhận diện Dương Sinh (màu chủ đạo navy #2B3990, CTA cam #F7941D).
 */

export const colors = {
  primary: '#2B3990',
  blueLight: '#2275B4',
  teal: '#3DBB95',
  green: '#2DA44A',
  orange: '#F7941D',
  orangeHover: '#E8850F',
  yellow: '#FBB040',
  bg: '#F8F9FC',
  white: '#FFFFFF',
  text: '#1A1A2E',
  textMuted: '#6B7280',
  textOnPrimary: '#FFFFFF',
  danger: '#DC2626',
  boardLight: '#E8EBF7',
  boardDark: '#7C88C9',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  purple: '#7C4DBD',
} as const;

export const darkColors = {
  ...colors,
  bg: '#12142A',
  white: '#1C1F3D',
  text: '#ECEEF8',
  textMuted: '#A1A7C4',
  boardLight: '#B7BEE3',
  boardDark: '#4A57A8',
  surface: '#1C1F3D',
  border: '#2F335C',
} as const satisfies Record<keyof typeof colors, string>;

/**
 * Màu suy ra từ `--color-primary` bằng `color-mix`, để màu thương hiệu học viện (ghi đè
 * `--color-primary`) tự kéo theo nền nhạt. Không phải hex nên tách khỏi `colors`.
 */
export const derivedColors = {
  primarySoft: 'color-mix(in oklab, var(--color-primary) 8%, white)',
  appBg: 'color-mix(in oklab, var(--color-primary) 4%, #f8f9fc)',
} as const;

/** Bản chế độ tối của màu suy ra: trộn vào nền tối thay vì nền trắng. */
export const darkDerivedColors = {
  primarySoft: 'color-mix(in oklab, var(--color-primary) 22%, #1c1f3d)',
  appBg: 'color-mix(in oklab, var(--color-primary) 10%, #12142a)',
} as const satisfies Record<keyof typeof derivedColors, string>;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  card: 16,
  full: 9999,
} as const;

export const fontFamily = {
  sans: 'Roboto',
} as const;

export const fontSize = {
  emphasis: 12,
  subtitle: 14,
  body: 16,
  h2: 28,
  h1: 40,
} as const;

export type ColorToken = keyof typeof colors;
export type Palette = Record<ColorToken, string>;

/** Chuyển camelCase sang kebab-case để đặt tên biến CSS. */
export function toKebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/** Sinh khối biến CSS (`--ds-*`) từ một bảng màu, dùng cho web và kiểm thử đồng bộ với tokens.css. */
export function cssVariables(palette: Palette = colors): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(palette)) {
    vars[`--ds-${toKebab(name)}`] = value;
  }
  return vars;
}
