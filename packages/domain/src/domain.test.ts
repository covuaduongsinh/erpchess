import { describe, expect, it } from 'vitest';
import {
  academySlugSchema,
  createAssignmentSchema,
  createStudentSchema,
  isStaff,
  pinSchema,
  slugify,
  usernameSchema,
} from './index';

describe('domain', () => {
  it('username chuẩn hoá chữ thường và chặn ký tự lạ', () => {
    expect(usernameSchema.parse('  An.Nguyen_09 ')).toBe('an.nguyen_09');
    expect(usernameSchema.safeParse('ab').success).toBe(false);
    expect(usernameSchema.safeParse('an nguyen').success).toBe(false);
    expect(usernameSchema.safeParse('nguyễn').success).toBe(false);
  });

  it('PIN là 6–12 chữ số', () => {
    expect(pinSchema.safeParse('123456').success).toBe(true);
    expect(pinSchema.safeParse('12345').success).toBe(false);
    expect(pinSchema.safeParse('12345a').success).toBe(false);
  });

  it('slug hợp lệ', () => {
    expect(academySlugSchema.safeParse('duong-sinh').success).toBe(true);
    expect(academySlugSchema.safeParse('-abc').success).toBe(false);
    expect(academySlugSchema.safeParse('ab-').success).toBe(false);
  });

  it('slugify bỏ dấu tiếng Việt', () => {
    expect(slugify('Câu lạc bộ Cờ vua Dương Sinh')).toBe('cau-lac-bo-co-vua-duong-sinh');
    expect(slugify('  Đống Đa!! ')).toBe('dong-da');
    expect(academySlugSchema.safeParse(slugify('Học viện Cờ vua Hà Nội 2026')).success).toBe(true);
  });

  it('createStudentSchema kiểm đủ trường', () => {
    const ok = createStudentSchema.safeParse({
      academyId: '7b0f3c1e-1d2a-4c8e-9f00-0a1b2c3d4e5f',
      displayName: 'Nguyễn An',
      username: 'an.nguyen',
      pin: '246810',
    });
    expect(ok.success).toBe(true);
  });

  it('isStaff', () => {
    expect(isStaff('owner')).toBe(true);
    expect(isStaff('coach')).toBe(true);
    expect(isStaff('student')).toBe(false);
    expect(isStaff(null)).toBe(false);
  });

  it('createAssignmentSchema cần puzzle và đối tượng giao', () => {
    const base = {
      academyId: '10000000-0000-4000-8000-00000000000a',
      title: ' Bài 1 ',
      puzzleIds: ['30000000-0000-4000-8000-000000000001'],
    };
    const ok = createAssignmentSchema.parse({
      ...base,
      groupIds: ['20000000-0000-4000-8000-0000000000a1'],
      dueAt: '2026-10-30T10:00:00.000Z',
    });
    expect(ok.title).toBe('Bài 1');
    expect(ok.studentIds).toEqual([]);
    expect(() => createAssignmentSchema.parse(base)).toThrow(/targets/);
    expect(() =>
      createAssignmentSchema.parse({ ...base, puzzleIds: [], studentIds: [base.academyId] }),
    ).toThrow(/puzzles/);
  });
});
