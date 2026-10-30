import { useProfile, useSession } from '@erpchess/api/react';
import { Board, type NativeBoardProps } from '@erpchess/board-native';
import { type BoardPreferences, normalizeBoardPreferences } from '@erpchess/domain';

/** Tùy chọn bàn cờ của người đang đăng nhập, đọc từ `profiles.board_preferences` (Giai đoạn 20d). */
export function useBoardPreferences(): BoardPreferences {
  const { session } = useSession();
  const profile = useProfile(session?.user.id);
  return normalizeBoardPreferences(profile.data?.board_preferences);
}

/** Bàn cờ áp dụng cài đặt cá nhân (theme, bộ quân, tọa độ); prop truyền vào luôn thắng cài đặt. */
export function PreferredBoard({ theme, pieceSet, coordinates, ...rest }: NativeBoardProps) {
  const preferences = useBoardPreferences();
  return (
    <Board
      {...rest}
      theme={theme ?? preferences.theme}
      pieceSet={pieceSet ?? preferences.pieceSet}
      coordinates={coordinates ?? preferences.coordinates}
    />
  );
}
