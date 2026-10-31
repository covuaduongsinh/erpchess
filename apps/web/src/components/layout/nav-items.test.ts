import type { AcademyRole } from '@erpchess/domain';
import { describe, expect, it } from 'vitest';
import {
  buildChatItem,
  buildNavGroups,
  buildOverviewItem,
  findActiveItem,
  flattenGroup,
  groupOfPath,
  isImmersivePath,
} from './nav-items';

function ids(role: AcademyRole | null, leads = false): string[] {
  return buildNavGroups(role, { leads_enabled: leads }).flatMap((g) =>
    flattenGroup(g).map((i) => i.id),
  );
}

describe('buildNavGroups', () => {
  it('chủ học viện thấy toàn bộ mục quản trị, kể cả gói, giảm giá, thông báo, Lead, branding', () => {
    const all = ids('owner');
    for (const id of [
      'students',
      'groups',
      'batches',
      'leads',
      'calendar',
      'billing',
      'plans',
      'discounts',
      'notifications',
      'reports',
      'branding',
      'levels',
      'locations',
      'certificates',
      'database',
      'studies',
    ])
      expect(all, id).toContain(id);
    expect(buildNavGroups('owner').map((g) => g.id)).toEqual(['admin', 'learn', 'play', 'content']);
  });

  it('HLV: ẩn học phí, gói, giảm giá, thông báo, branding; Lead theo leads_enabled', () => {
    const off = ids('coach', false);
    for (const id of ['billing', 'plans', 'discounts', 'notifications', 'branding', 'leads'])
      expect(off, id).not.toContain(id);
    for (const id of ['students', 'calendar', 'levels', 'locations', 'database'])
      expect(off, id).toContain(id);
    expect(ids('coach', true)).toContain('leads');
  });

  it('leads_enabled không mở Lead cho học viên và phụ huynh', () => {
    expect(ids('student', true)).not.toContain('leads');
    expect(ids('parent', true)).not.toContain('leads');
  });

  it('học viên: không có nhóm Quản trị, vẫn thấy lớp, chứng chỉ, báo cáo, học phí, CSDL ván', () => {
    const groups = buildNavGroups('student');
    expect(groups.map((g) => g.id)).toEqual(['learn', 'play', 'content']);
    const all = ids('student');
    for (const id of ['groups', 'certificates', 'reports', 'billing', 'database', 'quizzes'])
      expect(all, id).toContain(id);
    for (const id of ['students', 'calendar', 'levels', 'locations', 'notifications'])
      expect(all, id).not.toContain(id);
  });

  it('phụ huynh: ẩn CSDL ván, vẫn thấy học phí', () => {
    const all = ids('parent');
    expect(all).not.toContain('database');
    expect(all).toContain('billing');
    expect(all).toContain('studies');
  });

  it('không có học viện thì chỉ còn Bàn cờ', () => {
    expect(ids(null)).toEqual(['board']);
    expect(buildOverviewItem(null)).toBeNull();
    expect(buildChatItem(null)).toBeNull();
  });

  it('chỉ nhóm Quản trị là dạng danh sách con', () => {
    const groups = buildNavGroups('owner');
    expect(groups.filter((g) => g.drill).map((g) => g.id)).toEqual(['admin']);
  });
});

describe('findActiveItem / groupOfPath', () => {
  const groups = buildNavGroups('owner');

  it('khớp mục dài nhất: /billing/plans sáng "Gói", không sáng "Học phí"', () => {
    expect(findActiveItem(groups, '/a/clb/billing/plans', 'clb')?.id).toBe('plans');
    expect(findActiveItem(groups, '/a/clb/billing', 'clb')?.id).toBe('billing');
  });

  it('trang con vẫn sáng mục cha', () => {
    expect(findActiveItem(groups, '/a/clb/quizzes/abc', 'clb')?.id).toBe('quizzes');
  });

  it('Tổng quan chỉ sáng khi đúng /a/slug', () => {
    const overview = buildOverviewItem('owner');
    expect(findActiveItem([], '/a/clb', 'clb', [overview])?.id).toBe('overview');
    expect(findActiveItem([], '/a/clb/x', 'clb', [overview])).toBeUndefined();
  });

  it('nhiều mục cùng trỏ về /a/slug thì mục đứng trước thắng', () => {
    expect(findActiveItem(groups, '/a/clb', 'clb')?.id).toBe('coaches');
    expect(findActiveItem(groups, '/a/clb/', 'clb')?.id).toBe('coaches');
  });

  it('/analysis sáng Bàn cờ dù không có slug', () => {
    expect(findActiveItem(buildNavGroups(null), '/analysis', undefined)?.id).toBe('board');
  });

  it('trang quản trị thuộc nhóm admin, trang học tập thì không', () => {
    expect(groupOfPath(groups, '/a/clb/students', 'clb')?.id).toBe('admin');
    expect(groupOfPath(groups, '/a/clb/quizzes', 'clb')?.id).toBe('learn');
  });
});

describe('isImmersivePath', () => {
  it('bàn cờ, phòng học, ván đấu, simul tự thu gọn', () => {
    expect(isImmersivePath('/analysis')).toBe(true);
    expect(isImmersivePath('/a/clb/classes/42/room')).toBe(true);
    expect(isImmersivePath('/a/clb/play/42')).toBe(true);
    expect(isImmersivePath('/a/clb/play/bot')).toBe(true);
    expect(isImmersivePath('/a/clb/simuls/42')).toBe(true);
  });

  it('các trang danh sách thì không', () => {
    expect(isImmersivePath('/a/clb/play')).toBe(false);
    expect(isImmersivePath('/a/clb/simuls')).toBe(false);
    expect(isImmersivePath('/a/clb/classes/42')).toBe(false);
    expect(isImmersivePath('/a/clb')).toBe(false);
  });
});
