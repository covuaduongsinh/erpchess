import { useGroups, useMembers } from '@erpchess/api/react';
import { useAcademy } from '../../lib/academy-context';
import { useT } from '../../lib/use-t';
import { Spinner } from '../ui';

export function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Chọn lớp/Batch và học viên để giao bài (bài tập, Exercise, Quiz). */
export function TargetPicker({
  groupIds,
  studentIds,
  onGroups,
  onStudents,
}: {
  groupIds: string[];
  studentIds: string[];
  onGroups: (ids: string[]) => void;
  onStudents: (ids: string[]) => void;
}) {
  const { t } = useT();
  const { academy } = useAcademy();
  const groups = useGroups(academy.id);
  const members = useMembers(academy.id);
  const students = members.data?.filter((m) => m.role === 'student') ?? [];
  const setGroupIds = (f: (l: string[]) => string[]) => onGroups(f(groupIds));
  const setStudentIds = (f: (l: string[]) => string[]) => onStudents(f(studentIds));

  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-bold tracking-[0.05em] text-text-muted uppercase">
          {t('assignments.groups')}
        </legend>
        {groups.isPending ? (
          <Spinner />
        ) : (groups.data ?? []).length === 0 ? (
          <p className="text-sm text-text-muted">{t('groups.none')}</p>
        ) : (
          groups.data?.map((g) => (
            <label key={g.id} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={groupIds.includes(g.id)}
                onChange={() => setGroupIds((l) => toggle(l, g.id))}
              />
              <span>{g.name}</span>
              <span className="text-sm text-text-muted">
                {t('groups.studentCount', { count: g.studentCount })}
              </span>
            </label>
          ))
        )}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-bold tracking-[0.05em] text-text-muted uppercase">
          {t('assignments.students')}
        </legend>
        {members.isPending ? (
          <Spinner />
        ) : students.length === 0 ? (
          <p className="text-sm text-text-muted">{t('students.none')}</p>
        ) : (
          students.map(({ profile }) => (
            <label key={profile.id} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={studentIds.includes(profile.id)}
                onChange={() => setStudentIds((l) => toggle(l, profile.id))}
              />
              <span>{profile.display_name}</span>
              <span className="text-sm text-text-muted">@{profile.username}</span>
            </label>
          ))
        )}
      </fieldset>
    </>
  );
}
