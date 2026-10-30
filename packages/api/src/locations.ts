/** Địa điểm học viện (Giai đoạn 23a): trung tâm, trường học, CLB… Chỉ chủ học viện được sửa. */
import { type LocationInput, locationSchema } from '@erpchess/domain';
import type { ErpClient } from './client';
import type { Tables, TablesInsert } from './database.types';
import { unwrap } from './queries';

export type LocationRow = Tables<'academy_locations'>;

function toRow(input: LocationInput): Omit<TablesInsert<'academy_locations'>, 'academy_id'> {
  const v = locationSchema.parse(input);
  return {
    kind: v.kind,
    name: v.name,
    address_line: v.addressLine,
    country: v.country,
    state: v.state,
    city: v.city,
    working_days: v.workingDays,
    opens_at: v.opensAt,
    closes_at: v.closesAt,
    timezone: v.timezone,
    contact_name: v.contactName,
    contact_phone: v.contactPhone,
    email: v.email,
    notes: v.notes,
  };
}

/** Cơ sở chính đứng đầu, rồi theo tên. */
export async function fetchLocations(client: ErpClient, academyId: string): Promise<LocationRow[]> {
  return unwrap(
    await client
      .from('academy_locations')
      .select('*')
      .eq('academy_id', academyId)
      .order('is_main', { ascending: false })
      .order('name'),
  );
}

/**
 * Thêm địa điểm. Cờ "cơ sở chính" đặt qua RPC `set_main_location` để bỏ cờ ở địa điểm cũ trong
 * cùng giao dịch (CSDL chỉ cho một cơ sở chính mỗi học viện).
 */
export async function createLocation(
  client: ErpClient,
  academyId: string,
  input: LocationInput,
): Promise<LocationRow> {
  // Kiểm tra dữ liệu trước khi chạm vào CSDL
  const values = toRow(input);
  const row = unwrap(
    await client
      .from('academy_locations')
      .insert({ ...values, academy_id: academyId })
      .select()
      .single(),
  );
  if (input.isMain) {
    unwrap(await client.rpc('set_main_location', { p_location: row.id }));
    return { ...row, is_main: true };
  }
  return row;
}

export async function updateLocation(
  client: ErpClient,
  id: string,
  input: LocationInput,
): Promise<void> {
  const patch = toRow(input);
  if (input.isMain) {
    unwrap(await client.from('academy_locations').update(patch).eq('id', id));
    unwrap(await client.rpc('set_main_location', { p_location: id }));
  } else {
    unwrap(
      await client
        .from('academy_locations')
        .update({ ...patch, is_main: false })
        .eq('id', id),
    );
  }
}

/** Xoá địa điểm; batch đang gắn địa điểm này được gỡ liên kết (ON DELETE SET NULL). */
export async function deleteLocation(client: ErpClient, id: string): Promise<void> {
  unwrap(await client.from('academy_locations').delete().eq('id', id));
}
