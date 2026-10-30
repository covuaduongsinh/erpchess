import { describe, expect, it } from 'vitest';
import { filterLocations, locationSchema, modeNeedsLocation } from './locations';

const base = {
  name: 'Cơ sở Cầu Giấy',
  country: 'VN',
  workingDays: [6, 1, 1, 3],
  opensAt: '08:00',
  closesAt: '20:30',
  contactName: 'Thầy An',
  contactPhone: '0912 345 678',
};

describe('locationSchema', () => {
  it('điền mặc định, sắp và bỏ trùng ngày làm việc, email rỗng thành null', () => {
    const v = locationSchema.parse(base);
    expect(v.kind).toBe('centre');
    expect(v.isMain).toBe(false);
    expect(v.workingDays).toEqual([1, 3, 6]);
    expect(v.email).toBeNull();
    expect(v.timezone).toBe('Asia/Ho_Chi_Minh');
  });

  it('giờ đóng phải sau giờ mở', () => {
    const r = locationSchema.safeParse({ ...base, opensAt: '20:00', closesAt: '08:00' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('hours');
  });

  it('từ chối số điện thoại, email, ngày làm việc sai', () => {
    expect(locationSchema.safeParse({ ...base, contactPhone: 'gọi tôi' }).success).toBe(false);
    expect(locationSchema.safeParse({ ...base, email: 'không-phải-email' }).success).toBe(false);
    expect(locationSchema.safeParse({ ...base, workingDays: [] }).success).toBe(false);
    expect(locationSchema.safeParse({ ...base, workingDays: [7] }).success).toBe(false);
    expect(locationSchema.safeParse({ ...base, opensAt: '25:00' }).success).toBe(false);
  });
});

describe('modeNeedsLocation', () => {
  it('chỉ học online là không cần địa điểm', () => {
    expect(modeNeedsLocation('online')).toBe(false);
    expect(modeNeedsLocation('offline')).toBe(true);
    expect(modeNeedsLocation('hybrid')).toBe(true);
  });
});

describe('filterLocations', () => {
  const rows = [
    {
      kind: 'centre',
      name: 'Cơ sở Cầu Giấy',
      city: 'Hà Nội',
      address_line: '1 Xuân Thủy',
      contact_name: 'An',
    },
    {
      kind: 'school',
      name: 'Trường Tiểu học Đống Đa',
      city: 'Hà Nội',
      address_line: '',
      contact_name: 'Bình',
    },
    {
      kind: 'library',
      name: 'Thư viện Quận 1',
      city: 'TP.HCM',
      address_line: '',
      contact_name: 'Chi',
    },
  ];

  it('lọc theo tab', () => {
    expect(filterLocations(rows, 'all', '')).toHaveLength(3);
    expect(filterLocations(rows, 'centre', '').map((r) => r.name)).toEqual(['Cơ sở Cầu Giấy']);
    expect(filterLocations(rows, 'school', '')).toHaveLength(1);
    expect(filterLocations(rows, 'other', '').map((r) => r.kind)).toEqual(['library']);
  });

  it('tìm không phân biệt dấu và hoa thường', () => {
    expect(filterLocations(rows, 'all', 'dong da').map((r) => r.kind)).toEqual(['school']);
    expect(filterLocations(rows, 'all', 'HÀ NỘI')).toHaveLength(2);
    expect(filterLocations(rows, 'all', 'chi')).toHaveLength(1);
  });
});
