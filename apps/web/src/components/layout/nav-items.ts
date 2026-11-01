import type { AcademyRole } from '@erpchess/domain';
import { isStaff } from '@erpchess/domain';
import type { TranslationKey } from '@erpchess/i18n';
import type { LinkProps } from '@tanstack/react-router';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  Building2,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Database,
  FileText,
  Gamepad2,
  GraduationCap,
  Grid2x2,
  Layers,
  LayoutDashboard,
  Library,
  type LucideIcon,
  MapPin,
  Palette,
  Percent,
  Puzzle,
  Receipt,
  School,
  Shield,
  Swords,
  Trophy,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react';

export type NavTo = NonNullable<LinkProps['to']>;

export type NavItem = {
  id: string;
  to: NavTo;
  labelKey: TranslationKey;
  icon: LucideIcon;
  /** Chỉ sáng khi đúng đường dẫn (không sáng cho trang con). */
  exact?: boolean;
  /** `true` nếu `to` cần tham số `slug` của học viện. */
  academy: boolean;
};

export type NavSection = { id: string; labelKey: TranslationKey; items: NavItem[] };

export type NavGroup = {
  id: 'admin' | 'learn' | 'play' | 'content';
  labelKey: TranslationKey;
  icon: LucideIcon;
  /** Nhóm "Quản trị" kiểu Chesslang: bấm vào thì sidebar chuyển sang danh sách con. */
  drill: boolean;
  sections: NavSection[];
};

export type NavAcademy = { leads_enabled?: boolean | null };

function item(
  id: string,
  to: NavTo,
  labelKey: TranslationKey,
  icon: LucideIcon,
  opts: { exact?: boolean; academy?: boolean } = {},
): NavItem {
  return { id, to, labelKey, icon, exact: opts.exact, academy: opts.academy ?? true };
}

/** Mục "Tổng quan" đứng riêng phía trên các nhóm. */
export function buildOverviewItem(role: AcademyRole | null): NavItem | null {
  if (!role) return null;
  return item('overview', '/a/$slug', 'nav.overview', LayoutDashboard, { exact: true });
}

/** Mục dưới đáy sidebar liên quan đến học viện (chat). */
export function buildChatItem(role: AcademyRole | null): NavItem | null {
  if (!role) return null;
  return item('chat', '/a/$slug/chat', 'chat.title', UsersRound);
}

/**
 * Cây menu sidebar theo vai trò. Phân quyền giữ đúng logic các tab ngang cũ trong `a.$slug.tsx`:
 * học phí ẩn với HLV, CSDL ván ẩn với phụ huynh, thông báo chỉ chủ học viện, Lead theo
 * `leads_enabled`, còn lịch/học viên/cấp độ/địa điểm chỉ dành cho nhân sự.
 * Không có học viện (`role` null) thì chỉ còn Bàn cờ.
 */
export function buildNavGroups(role: AcademyRole | null, academy?: NavAcademy | null): NavGroup[] {
  const board = item('board', '/analysis', 'nav.board', Grid2x2, { academy: false });
  if (!role) {
    return [
      {
        id: 'learn',
        labelKey: 'nav.learn',
        icon: GraduationCap,
        drill: false,
        sections: [{ id: 'main', labelKey: 'nav.learn', items: [board] }],
      },
    ];
  }

  const staff = isStaff(role);
  const owner = role === 'owner';
  const leads = owner || (role === 'coach' && !!academy?.leads_enabled);

  const groups: NavGroup[] = [];

  if (staff) {
    const sections: NavSection[] = [
      {
        id: 'members',
        labelKey: 'nav.members',
        items: [
          item('students', '/a/$slug/students', 'students.title', Users),
          item('coaches', '/a/$slug/coaches', 'nav.coaches', School),
          item('groups', '/a/$slug/groups', 'nav.groups', UsersRound),
          item('batches', '/a/$slug/batches', 'nav.batches', Layers),
        ],
      },
      {
        id: 'operations',
        labelKey: 'nav.operations',
        items: [
          ...(leads ? [item('leads', '/a/$slug/leads', 'lead.title', UserPlus)] : []),
          item('calendar', '/a/$slug/calendar', 'calendar.title', CalendarDays),
          ...(role !== 'coach' ? [item('billing', '/a/$slug/billing', 'bill.title', Receipt)] : []),
          ...(owner
            ? [
                item('plans', '/a/$slug/billing/plans', 'bill.plans', CircleDollarSign),
                item('discounts', '/a/$slug/billing/discounts', 'bill.discounts', Percent),
                item('notifications', '/a/$slug/notifications', 'notify.title', Bell),
              ]
            : []),
          item('reports', '/a/$slug/reports', 'reports.navReports', BarChart3),
        ],
      },
      {
        id: 'academy',
        labelKey: 'nav.academy',
        items: [
          ...(owner ? [item('branding', '/a/$slug/settings', 'nav.branding', Palette)] : []),
          item('levels', '/a/$slug/levels', 'levels.title', Shield),
          item('locations', '/a/$slug/locations', 'location.title', MapPin),
          item('certificates', '/a/$slug/certificates', 'cert.title', Award),
        ],
      },
    ];
    groups.push({
      id: 'admin',
      labelKey: 'nav.admin',
      icon: Building2,
      drill: true,
      sections,
    });
  }

  // Người không phải nhân sự (học viên, phụ huynh) vẫn thấy lớp, chứng chỉ, báo cáo, học phí
  // của mình: đưa vào nhóm Học tập thay cho nhóm Quản trị.
  const learnItems: NavItem[] = [
    ...(staff ? [] : [item('groups', '/a/$slug/groups', 'nav.groups', UsersRound)]),
    item('classes', '/a/$slug/classes', 'nav.classrooms', School),
    item('quizzes', '/a/$slug/quizzes', 'quiz.title', Brain),
    item('assignments', '/a/$slug/assignments', 'assignments.title', ClipboardList),
    item('courses', '/a/$slug/courses', 'course.title', GraduationCap),
    board,
    item('practice', '/a/$slug/practice', 'practice.title', Puzzle),
    ...(staff
      ? []
      : [
          item('certificates', '/a/$slug/certificates', 'cert.title', Award),
          item('reports', '/a/$slug/reports', 'reports.navReports', BarChart3),
          ...(role !== 'coach' ? [item('billing', '/a/$slug/billing', 'bill.title', Receipt)] : []),
        ]),
  ];
  groups.push({
    id: 'learn',
    labelKey: 'nav.learn',
    icon: BookOpen,
    drill: false,
    sections: [{ id: 'main', labelKey: 'nav.learn', items: learnItems }],
  });

  groups.push({
    id: 'play',
    labelKey: 'nav.play',
    icon: Swords,
    drill: false,
    sections: [
      {
        id: 'main',
        labelKey: 'nav.play',
        items: [
          item('simuls', '/a/$slug/simuls', 'simul.title', Gamepad2),
          item('play', '/a/$slug/play', 'nav.gameArea', Swords),
          item('tournaments', '/a/$slug/tournaments', 'tournament.title', Trophy),
        ],
      },
    ],
  });

  groups.push({
    id: 'content',
    labelKey: 'nav.content',
    icon: Library,
    drill: false,
    sections: [
      {
        id: 'main',
        labelKey: 'nav.content',
        items: [
          ...(role !== 'parent'
            ? [item('database', '/a/$slug/database', 'database.title', Database)]
            : []),
          item('studies', '/a/$slug/studies', 'studies.title', FileText),
        ],
      },
    ],
  });

  return groups;
}

export function flattenGroup(group: NavGroup): NavItem[] {
  return group.sections.flatMap((s) => s.items);
}

/** Nhóm chứa mục đang mở (suy ra từ chính `active`, không tính lại); Tổng quan/Chat không thuộc nhóm nào. */
export function groupOfItem(groups: NavGroup[], active: NavItem | undefined): NavGroup | undefined {
  if (!active) return undefined;
  return groups.find((g) => flattenGroup(g).some((i) => i.id === active.id));
}

function resolvePath(to: string, slug: string | undefined): string {
  return slug ? to.replace('$slug', slug) : to;
}

function matches(it: NavItem, pathname: string, slug: string | undefined): boolean {
  if (it.academy && !slug) return false;
  const target = resolvePath(it.to, slug);
  if (it.exact) return pathname === target || pathname === `${target}/`;
  return pathname === target || pathname.startsWith(`${target}/`);
}

/** Mục đang mở: khớp dài nhất thắng, ngang nhau thì mục đứng trước (extra trước, rồi theo thứ tự nhóm). */
export function findActiveItem(
  groups: NavGroup[],
  pathname: string,
  slug: string | undefined,
  extra: (NavItem | null)[] = [],
): NavItem | undefined {
  // Mục ngoài nhóm (Tổng quan, Chat) đứng trước để thắng khi bằng độ dài
  const all = [...extra.filter((i): i is NavItem => !!i), ...groups.flatMap(flattenGroup)];
  let best: NavItem | undefined;
  let bestLen = -1;
  for (const it of all) {
    if (!matches(it, pathname, slug)) continue;
    const len = resolvePath(it.to, slug).length;
    if (len > bestLen) {
      best = it;
      bestLen = len;
    }
  }
  return best;
}

/** Trang tự thu sidebar thành thanh icon: bàn cờ/phân tích, phòng học, ván đấu, simul. */
export function isImmersivePath(pathname: string): boolean {
  if (pathname === '/analysis' || pathname.startsWith('/analysis/')) return true;
  return /^\/a\/[^/]+\/(classes\/[^/]+\/room|play\/[^/]+|simuls\/[^/]+)\/?$/.test(pathname);
}
