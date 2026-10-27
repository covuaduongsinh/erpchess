import type { Member } from '@erpchess/api';
import { useCreateInvitation, useSetInitialRating, useSetStudentLevel } from '@erpchess/api/react';
import { type RatingCategory, ratingCategories } from '@erpchess/domain';
import { useMemo, useState } from 'react';
import { InviteLink } from '../InviteLink';
import { Button, ErrorText } from '../ui';
import { LevelBadge } from './LevelBadge';

export interface LevelItem {
  id: string;
  name: string;
}

export interface StudentRating {
  student_id: string;
  category: string;
  rating: number;
}

export interface StudentAdminTableProps {
  students: Member[];
  academyId: string;
  slug: string;
  levels: LevelItem[];
  groups?: GroupItem[];
  ratings?: StudentRating[];
}

export interface GroupItem {
  id: string;
  name: string;
  studentIds?: string[];
}

export function StudentAdminTable({
  students,
  academyId,
  levels,
  groups = [],
  ratings = [],
}: StudentAdminTableProps) {
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [category, setCategory] = useState<RatingCategory>('rapid');

  const [invitedFor, setInvitedFor] = useState<string | null>(null);

  const setLevel = useSetStudentLevel(academyId);
  const invite = useCreateInvitation(academyId);

  // Map studentId -> Group name
  const studentGroupMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) {
      if (g.studentIds) {
        for (const sid of g.studentIds) {
          map.set(sid, g.name);
        }
      }
    }
    return map;
  }, [groups]);

  // Map levelId -> Level name
  const levelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of levels) {
      map.set(l.id, l.name);
    }
    return map;
  }, [levels]);

  const ratingOf = (studentId: string) =>
    ratings.find((r) => r.student_id === studentId && r.category === category)?.rating;

  // Lọc danh sách học viên
  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return students.filter((s) => {
      const nameMatch =
        !query ||
        s.profile.display_name.toLowerCase().includes(query) ||
        (s.profile.username?.toLowerCase().includes(query) ?? false);

      const levelMatch =
        selectedLevel === 'all' ||
        (selectedLevel === 'none' ? !s.levelId : s.levelId === selectedLevel);

      const groupMatch =
        selectedGroup === 'all' ||
        (selectedGroup === 'none'
          ? !studentGroupMap.has(s.profile.id)
          : studentGroupMap.get(s.profile.id) === selectedGroup);

      return nameMatch && levelMatch && groupMatch;
    });
  }, [students, search, selectedLevel, selectedGroup, studentGroupMap]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[280px]">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1 min-w-[200px]">
            <span
              className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm"
              aria-hidden="true"
            >
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên học viên, username..."
              className="w-full rounded-lg border border-gray-300 py-2 pr-3 pl-9 text-sm focus:border-primary focus:outline-hidden"
            />
          </div>

          {/* Lọc theo Lớp / Batch */}
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary focus:outline-hidden"
          >
            <option value="all">Tất cả lớp / nhóm</option>
            {groups.map((g) => (
              <option key={g.id} value={g.name}>
                Lớp: {g.name}
              </option>
            ))}
            <option value="none">Chưa xếp lớp</option>
          </select>

          {/* Lọc theo Cấp độ */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary focus:outline-hidden"
          >
            <option value="all">Tất cả cấp độ</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
            <option value="none">Chưa phân cấp</option>
          </select>

          {/* Chọn hệ số Elo */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as RatingCategory)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary focus:outline-hidden"
          >
            {ratingCategories.map((c) => (
              <option key={c} value={c}>
                Elo {c.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs font-medium text-text-muted">
          Tổng số: <strong className="text-gray-900">{filteredStudents.length}</strong> /{' '}
          {students.length} học viên
        </div>
      </div>

      {/* Student Data Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50/75 text-xs font-semibold text-text-muted uppercase">
            <tr>
              <th scope="col" className="px-4 py-3.5">
                Học viên
              </th>
              <th scope="col" className="px-4 py-3.5">
                Cấp độ (Level)
              </th>
              <th scope="col" className="px-4 py-3.5">
                Lớp / Batch
              </th>
              <th scope="col" className="px-4 py-3.5">
                Elo ({category.toUpperCase()})
              </th>
              <th scope="col" className="px-4 py-3.5">
                Phụ huynh
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-text-muted">
                  Không tìm thấy học viên nào phù hợp với bộ lọc.
                </td>
              </tr>
            ) : (
              filteredStudents.map(({ profile, levelId }) => {
                const currentLevelName = levelId ? levelMap.get(levelId) : null;
                const groupName = studentGroupMap.get(profile.id);
                const currentRating = ratingOf(profile.id);

                return (
                  <tr key={profile.id} className="transition-colors hover:bg-gray-50/50">
                    {/* Cột Học viên */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 text-sm">
                          {profile.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900">
                            {profile.display_name}
                          </span>
                          {profile.username && (
                            <span className="text-xs text-text-muted">@{profile.username}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Cột Cấp độ */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <LevelBadge name={currentLevelName} />
                        <select
                          aria-label={`Đổi cấp độ cho ${profile.display_name}`}
                          value={levelId ?? ''}
                          disabled={setLevel.isPending}
                          onChange={(e) =>
                            setLevel.mutate({
                              studentId: profile.id,
                              levelId: e.target.value || null,
                            })
                          }
                          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:border-gray-300"
                        >
                          <option value="">Chưa phân cấp</option>
                          {levels.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* Cột Lớp / Batch */}
                    <td className="px-4 py-3.5">
                      {groupName ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 font-medium text-blue-700 text-xs">
                          🏫 {groupName}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted italic">Chưa xếp lớp</span>
                      )}
                    </td>

                    {/* Cột Elo */}
                    <td className="px-4 py-3.5">
                      <InlineRatingEdit
                        academyId={academyId}
                        studentId={profile.id}
                        name={profile.display_name}
                        category={category}
                        value={currentRating}
                      />
                    </td>

                    {/* Cột Phụ huynh */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1.5">
                        <Button
                          variant="ghost"
                          className="self-start text-xs font-semibold px-2.5 py-1"
                          disabled={invite.isPending}
                          onClick={() =>
                            invite.mutate(
                              { role: 'parent', studentId: profile.id },
                              { onSuccess: () => setInvitedFor(profile.id) },
                            )
                          }
                        >
                          + Mời Phụ huynh
                        </Button>
                        {invitedFor === profile.id && invite.data && (
                          <div className="mt-1">
                            <InviteLink token={invite.data.token} />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ErrorText error={invite.error ?? setLevel.error} />
    </div>
  );
}

function InlineRatingEdit({
  academyId,
  studentId,
  name,
  category,
  value,
}: {
  academyId: string;
  studentId: string;
  name: string;
  category: RatingCategory;
  value: number | undefined;
}) {
  const set = useSetInitialRating(academyId);
  const [draft, setDraft] = useState(value === undefined ? '' : String(Math.round(value)));

  function save() {
    const next = Number(draft);
    if (draft.trim() === '' || !Number.isInteger(next)) return;
    if (value !== undefined && Math.round(value) === next) return;
    set.mutate({ studentId, category, rating: next });
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        max={3500}
        aria-label={`Elo ${category} của ${name}`}
        placeholder="Chưa có"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        className="w-20 rounded-md border border-gray-300 px-2 py-1 font-semibold text-gray-900 text-xs focus:border-primary focus:outline-hidden"
      />
      {value !== undefined && <span className="font-bold text-emerald-600 text-xs">pts</span>}
    </div>
  );
}
