import type { Member } from '@erpchess/api';
import { Search } from 'lucide-react';
import { useT } from '../../lib/use-t';
import { EmptyState } from '../ui';

/** Danh sách học viên có avatar chữ cái đầu để chọn xem báo cáo; học viên đang chọn có `aria-current`. */
export function StudentPicker({
  students,
  selectedId,
  onSelect,
  search,
  onSearch,
}: {
  students: Member[];
  selectedId: string | undefined;
  onSelect: (studentId: string) => void;
  search: string;
  onSearch: (value: string) => void;
}) {
  const { t } = useT();
  const q = search.trim().toLowerCase();
  const list = q
    ? students.filter(
        (s) =>
          s.profile.display_name.toLowerCase().includes(q) ||
          (s.profile.username ?? '').toLowerCase().includes(q),
      )
    : students;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <label className="relative block">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t('reports.searchStudent')}
          aria-label={t('reports.searchStudent')}
          className="w-full rounded-md border border-border bg-surface py-2 pr-3 pl-9 text-sm"
        />
      </label>
      {list.length === 0 ? (
        <EmptyState dashed title={t('reports.noStudents')} />
      ) : (
        <ul aria-label={t('reports.studentList')} className="flex flex-col gap-1 overflow-y-auto">
          {list.map(({ profile }) => {
            const active = profile.id === selectedId;
            return (
              <li key={profile.id}>
                <button
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => onSelect(profile.id)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-bg aria-[current=true]:bg-primary/10"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary"
                  >
                    {(profile.display_name.trim().charAt(0) || '?').toUpperCase()}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{profile.display_name}</span>
                    {profile.username && (
                      <span className="truncate text-xs text-text-muted">@{profile.username}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
