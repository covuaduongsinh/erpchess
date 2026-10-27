import { signOut } from '@erpchess/api';
import { useErpClient, useSession } from '@erpchess/api/react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../lib/use-t';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'nav' | 'action' | 'system';
  icon: string;
  keywords?: string[];
  action: () => void;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { t, i18n } = useT();
  const client = useErpClient();
  const { session } = useSession();

  // Lấy slug từ URL nếu đang ở trong học viện
  const params = useParams({ strict: false }) as { slug?: string };
  const slug = params?.slug;

  // Lắng nghe phím tắt Ctrl+K hoặc Cmd+K
  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input khi mở
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [];

    // 1. Phân hệ điều hướng học viện
    if (slug) {
      list.push(
        {
          id: 'nav-dashboard',
          title: t('academy.overview'),
          subtitle: `/${slug}`,
          category: 'nav',
          icon: '📊',
          keywords: ['tong quan', 'overview', 'dashboard', 'home', 'trang chu'],
          action: () => void navigate({ to: '/a/$slug', params: { slug } }),
        },
        {
          id: 'nav-classes',
          title: t('classroom.title'),
          subtitle: `/${slug}/classes`,
          category: 'nav',
          icon: '🏫',
          keywords: ['lop hoc', 'classroom', 'live class', 'phong hoc'],
          action: () => void navigate({ to: '/a/$slug/classes', params: { slug } }),
        },
        {
          id: 'nav-assignments',
          title: t('assignments.title'),
          subtitle: `/${slug}/assignments`,
          category: 'nav',
          icon: '📝',
          keywords: ['bai tap', 'homework', 'exercise', 'giao bai'],
          action: () => void navigate({ to: '/a/$slug/assignments', params: { slug } }),
        },
        {
          id: 'nav-quizzes',
          title: t('quiz.title'),
          subtitle: `/${slug}/quizzes`,
          category: 'nav',
          icon: '🧩',
          keywords: ['dau do', 'quiz', 'trac nghiem', 'cau hoi'],
          action: () => void navigate({ to: '/a/$slug/quizzes', params: { slug } }),
        },
        {
          id: 'nav-practice',
          title: t('practice.title'),
          subtitle: `/${slug}/practice`,
          category: 'nav',
          icon: '🎯',
          keywords: ['luyen tap', 'practice', 'the co', 'drills'],
          action: () => void navigate({ to: '/a/$slug/practice', params: { slug } }),
        },
        {
          id: 'nav-studies',
          title: t('studies.title'),
          subtitle: `/${slug}/studies`,
          category: 'nav',
          icon: '📚',
          keywords: ['hoc lieu', 'study', 'bai giang', 'chuong'],
          action: () => void navigate({ to: '/a/$slug/studies', params: { slug } }),
        },
        {
          id: 'nav-courses',
          title: t('course.title'),
          subtitle: `/${slug}/courses`,
          category: 'nav',
          icon: '🎓',
          keywords: ['khoa hoc', 'course', 'curriculum', 'giao trinh'],
          action: () => void navigate({ to: '/a/$slug/courses', params: { slug } }),
        },
        {
          id: 'nav-play',
          title: t('play.title'),
          subtitle: `/${slug}/play`,
          category: 'nav',
          icon: '⚔️',
          keywords: ['thi dau', 'game area', 'choi co', 'dau bot', 'may'],
          action: () => void navigate({ to: '/a/$slug/play', params: { slug } }),
        },
        {
          id: 'nav-tournaments',
          title: t('tournament.title'),
          subtitle: `/${slug}/tournaments`,
          category: 'nav',
          icon: '🏆',
          keywords: ['giai dau', 'tournament', 'swiss', 'vong tron'],
          action: () => void navigate({ to: '/a/$slug/tournaments', params: { slug } }),
        },
        {
          id: 'nav-simuls',
          title: t('simul.title'),
          subtitle: `/${slug}/simuls`,
          category: 'nav',
          icon: '👑',
          keywords: ['dau dong loat', 'simul', 'bieu dien', 'hlv dau nhieu ban'],
          action: () => void navigate({ to: '/a/$slug/simuls', params: { slug } }),
        },
        {
          id: 'nav-database',
          title: t('database.title'),
          subtitle: `/${slug}/database`,
          category: 'nav',
          icon: '🗄️',
          keywords: ['csdl van co', 'database', 'pgn', 'masterbase'],
          action: () => void navigate({ to: '/a/$slug/database', params: { slug } }),
        },
        {
          id: 'nav-students',
          title: t('students.title'),
          subtitle: `/${slug}/students`,
          category: 'nav',
          icon: '👥',
          keywords: ['hoc vien', 'students', 'danh sach', 'administration'],
          action: () => void navigate({ to: '/a/$slug/students', params: { slug } }),
        },
        {
          id: 'nav-batches',
          title: 'Lớp học & Nhóm (Batches)',
          subtitle: `/${slug}/batches`,
          category: 'nav',
          icon: '🏫',
          keywords: ['batches', 'nhom hoc vien', 'lop hoc', 'phan lop'],
          action: () => void navigate({ to: '/a/$slug/batches', params: { slug } }),
        },
        {
          id: 'nav-reports',
          title: t('reports.navReports'),
          subtitle: `/${slug}/reports`,
          category: 'nav',
          icon: '📈',
          keywords: ['bao cao', 'reports', 'xuat csv', 'chuyen can'],
          action: () => void navigate({ to: '/a/$slug/reports', params: { slug } }),
        },
        {
          id: 'nav-chat',
          title: t('chat.title'),
          subtitle: `/${slug}/chat`,
          category: 'nav',
          icon: '💬',
          keywords: ['tro chuyen', 'chat', 'tin nhan'],
          action: () => void navigate({ to: '/a/$slug/chat', params: { slug } }),
        },
      );

      // 2. Thao tác nhanh (Quick Actions)
      list.push(
        {
          id: 'act-new-assignment',
          title: 'Giao bài tập mới',
          subtitle: 'Giao bài tập mới cho lớp',
          category: 'action',
          icon: '➕',
          keywords: ['tao bai tap', 'new assignment', 'giao bai'],
          action: () => void navigate({ to: '/a/$slug/assignments/new', params: { slug } }),
        },
        {
          id: 'act-new-quiz',
          title: t('quiz.create'),
          subtitle: 'Tạo quiz trắc nghiệm và thế cờ',
          category: 'action',
          icon: '✨',
          keywords: ['tao quiz', 'new quiz', 'trac nghiem'],
          action: () => void navigate({ to: '/a/$slug/quizzes/new', params: { slug } }),
        },
        {
          id: 'act-new-tournament',
          title: 'Tổ chức giải đấu mới',
          subtitle: 'Tổ chức giải đấu Thụy Sĩ hoặc vòng tròn',
          category: 'action',
          icon: '🏅',
          keywords: ['tao giai dau', 'new tournament', 'swiss'],
          action: () => void navigate({ to: '/a/$slug/tournaments/new', params: { slug } }),
        },
      );
    }

    // 3. Toàn cục (Global Tools & Settings)
    list.push(
      {
        id: 'nav-analysis',
        title: t('analysis.title'),
        subtitle: 'Bàn cờ phân tích với Arasan WASM',
        category: 'nav',
        icon: '♟️',
        keywords: ['ban co', 'board', 'phan tich', 'arasan', 'engine'],
        action: () => void navigate({ to: '/analysis' }),
      },
      {
        id: 'global-exercise-bank',
        title: 'Ngân hàng Bài tập (Exercises)',
        subtitle: '/assignment/exercise',
        category: 'nav',
        icon: '🧩',
        keywords: ['ngan hang bai tap', 'exercises', 'assignment', 'exercise'],
        action: () => void navigate({ to: '/assignment/exercise' }),
      },
      {
        id: 'global-practice',
        title: 'Luyện tập Thế cờ (Practice)',
        subtitle: '/practice',
        category: 'nav',
        icon: '🎯',
        keywords: ['luyen tap', 'practice', 'the co', 'drills'],
        action: () => void navigate({ to: '/practice' }),
      },
      {
        id: 'global-quiz-list',
        title: 'Trắc nghiệm Tính giờ (Quiz)',
        subtitle: '/quiz/list',
        category: 'nav',
        icon: '⏱️',
        keywords: ['trac nghiem', 'quiz list', 'tinh gio', 'quiz'],
        action: () => void navigate({ to: '/quiz/list' }),
      },
      {
        id: 'nav-profile',
        title: t('profile.title'),
        subtitle: 'Cài đặt ngôn ngữ, múi giờ, ký hiệu nước đi',
        category: 'nav',
        icon: '⚙️',
        keywords: ['ho so', 'profile', 'cai dat', 'preferences', 'settings'],
        action: () => void navigate({ to: '/profile' }),
      },
      {
        id: 'sys-lang-vi',
        title: 'Tiếng Việt',
        subtitle: 'Chuyển giao diện sang Tiếng Việt',
        category: 'system',
        icon: '🇻🇳',
        keywords: ['tieng viet', 'vietnamese'],
        action: () => void i18n.changeLanguage('vi'),
      },
      {
        id: 'sys-lang-en',
        title: 'English',
        subtitle: 'Switch interface language to English',
        category: 'system',
        icon: '🇬🇧',
        keywords: ['english', 'tieng anh'],
        action: () => void i18n.changeLanguage('en'),
      },
    );

    if (session) {
      list.push({
        id: 'sys-signout',
        title: t('common.signOut'),
        subtitle: 'Đăng xuất khỏi tài khoản',
        category: 'system',
        icon: '🚪',
        keywords: ['dang xuat', 'sign out', 'logout'],
        action: () => void signOut(client),
      });
    }

    return list;
  }, [slug, t, i18n, session, client, navigate]);

  // Lọc theo query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSubtitle = item.subtitle?.toLowerCase().includes(q);
      const matchKeywords = item.keywords?.some((k) => k.toLowerCase().includes(q));
      return matchTitle || matchSubtitle || matchKeywords;
    });
  }, [items, query]);

  // Điều khiển bàn phím trong palette
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (filteredItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredItems[selectedIndex];
      if (selected) {
        setIsOpen(false);
        selected.action();
      }
    }
  };

  const handleSelect = (item: CommandItem) => {
    setIsOpen(false);
    item.action();
  };

  return (
    <>
      {/* Nút bấm trên Header để mở Command Palette */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/20 transition-colors"
        title="Tìm kiếm nhanh (Ctrl+K)"
      >
        <span aria-hidden="true">🔍</span>
        <span className="hidden md:inline">Tìm kiếm...</span>
        <kbd className="hidden sm:inline-block rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-mono text-white/80">
          Ctrl K
        </kbd>
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 pointer-events-none"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Đóng tìm kiếm"
            className="fixed inset-0 bg-black/50 backdrop-blur-xs cursor-default pointer-events-auto"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative z-10 flex max-h-[80vh] w-full max-w-xl flex-col rounded-xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden pointer-events-auto">
            {/* Thanh Input tìm kiếm */}
            <div className="flex items-center border-b border-gray-100 px-4 py-3">
              <span className="mr-3 text-lg opacity-50" aria-hidden="true">
                🔍
              </span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Nhập tên trang, lớp học, tính năng... (ESC để đóng)"
                className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
              />
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 font-mono">
                ESC
              </span>
            </div>

            {/* Danh sách kết quả */}
            <div className="flex-1 overflow-y-auto p-2">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  Không tìm thấy kết quả phù hợp cho &ldquo;{query}&rdquo;
                </div>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {filteredItems.map((item, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                            isSelected
                              ? 'bg-primary text-text-on-primary'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <span className="text-lg" aria-hidden="true">
                            {item.icon}
                          </span>
                          <div className="flex flex-1 flex-col">
                            <span className="font-medium">{item.title}</span>
                            {item.subtitle && (
                              <span
                                className={`text-xs ${
                                  isSelected ? 'text-white/80' : 'text-gray-400'
                                }`}
                              >
                                {item.subtitle}
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <span className="text-xs opacity-75 font-mono">↵ Chọn</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer gợi ý phím tắt */}
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2 text-[11px] text-gray-500">
              <div className="flex gap-3">
                <span>
                  <kbd className="rounded bg-white px-1 py-0.5 ring-1 ring-gray-200 font-mono">
                    ↑
                  </kbd>{' '}
                  <kbd className="rounded bg-white px-1 py-0.5 ring-1 ring-gray-200 font-mono">
                    ↓
                  </kbd>{' '}
                  Di chuyển
                </span>
                <span>
                  <kbd className="rounded bg-white px-1 py-0.5 ring-1 ring-gray-200 font-mono">
                    ↵
                  </kbd>{' '}
                  Mở
                </span>
              </div>
              <span>ERPChess Command Palette</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
