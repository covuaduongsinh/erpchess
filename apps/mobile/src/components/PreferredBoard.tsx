import { useMyAcademies, useProfile, useSession } from '@erpchess/api/react';
import { Board, type NativeBoardProps } from '@erpchess/board-native';
import { type BoardPreferences, pickBoardPreferences } from '@erpchess/domain';

/**
 * Bàn cờ của người đang đăng nhập (Giai đoạn 20d): `profiles.board_preferences`; chưa tự chỉnh thì
 * dùng bàn cờ mặc định của học viện mình tham gia (Giai đoạn 24a).
 */
export function useBoardPreferences(): BoardPreferences {
  const { session } = useSession();
  const profile = useProfile(session?.user.id);
  const academies = useMyAcademies(session?.user.id);
  return pickBoardPreferences(
    profile.data?.board_preferences,
    (academies.data ?? []).map((a) => a.board_defaults),
  );
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
