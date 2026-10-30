/** Bảng màu ô bàn cờ, dùng chung cho bàn cờ web và native (`@erpchess/board-web/themes`). */
import { colors } from '@erpchess/ui-tokens';

export type BoardTheme = 'navy' | 'green' | 'wood' | 'blue' | 'charcoal';

export const BOARD_THEMES: Record<BoardTheme, { light: string; dark: string; name: string }> = {
  navy: { light: colors.boardLight, dark: colors.boardDark, name: 'Dương Sinh Navy' },
  green: { light: '#EEEED2', dark: '#769656', name: 'Cẩm thạch Xanh' },
  wood: { light: '#F0D9B5', dark: '#B58863', name: 'Gỗ Cổ điển' },
  blue: { light: '#DEE3E6', dark: '#8CA2AD', name: 'Xanh Đại dương' },
  charcoal: { light: '#E0E0E0', dark: '#4E545C', name: 'Xám Kim loại' },
};
