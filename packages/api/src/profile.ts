/** Hồ sơ cá nhân và tuỳ chọn (Giai đoạn 13a). */
import type { UpdateProfileInput } from '@erpchess/domain';
import type { ErpClient } from './client';
import type { TablesUpdate } from './database.types';
import type { Profile } from './queries';
import { unwrap } from './queries';

export async function fetchProfile(client: ErpClient, userId: string): Promise<Profile | null> {
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  client: ErpClient,
  userId: string,
  patch: UpdateProfileInput,
): Promise<Profile> {
  const updateData: TablesUpdate<'profiles'> = {};
  if (patch.displayName !== undefined) updateData.display_name = patch.displayName;
  if (patch.username !== undefined) updateData.username = patch.username;
  if (patch.locale !== undefined) updateData.locale = patch.locale;
  if (patch.timezone !== undefined) updateData.timezone = patch.timezone;
  if (patch.moveNotation !== undefined) updateData.move_notation = patch.moveNotation;
  if (patch.country !== undefined) updateData.country = patch.country;
  if (patch.bio !== undefined) updateData.bio = patch.bio;
  if (patch.boardPreferences !== undefined) updateData.board_preferences = patch.boardPreferences;
  if (patch.chesscomUsername !== undefined) updateData.chesscom_username = patch.chesscomUsername;
  if (patch.lichessUsername !== undefined) updateData.lichess_username = patch.lichessUsername;

  return unwrap(
    await client.from('profiles').update(updateData).eq('id', userId).select('*').single(),
  );
}
