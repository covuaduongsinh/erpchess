import type { Member } from '@erpchess/api';
import { useCreateInvitation, useSetStudentLevel } from '@erpchess/api/react';
import type { RatingCategory } from '@erpchess/domain';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useT } from '../../lib/use-t';
import { InviteLink } from '../InviteLink';
import { ErrorText, IconButton } from '../ui';
import { LevelBadge } from './LevelBadge';
import { InlineRatingEdit, type LevelItem, type StudentRating } from './StudentAdminTable';

/** Chế độ lưới: mỗi học viên một thẻ (avatar, tên, @username, cấp độ, lớp, Elo, mời phụ huynh). */
export function StudentGrid({
  students,
  academyId,
  levels,
  groupOf,
  ratings,
  category,
}: {
  students: Member[];
  academyId: string;
  levels: LevelItem[];
  /** Tên lớp/nhóm của một học viên (nếu có). */
  groupOf: (studentId: string) => string | undefined;
  ratings: StudentRating[];
  category: RatingCategory;
}) {
  const { t } = useT();
  const setLevel = useSetStudentLevel(academyId);
  const invite = useCreateInvitation(academyId);
  const [invitedFor, setInvitedFor] = useState<string | null>(null);
  const levelName = new Map(levels.map((l) => [l.id, l.name]));

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {students.map(({ profile, levelId }) => {
          const group = groupOf(profile.id);
          const rating = ratings.find(
            (r) => r.student_id === profile.id && r.category === category,
          )?.rating;
          return (
            <li
              key={profile.id}
              className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary"
                  aria-hidden="true"
                >
                  {(profile.display_name.trim().charAt(0) || '?').toUpperCase()}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{profile.display_name}</span>
                  {profile.username && (
                    <span className="truncate text-xs text-text-muted">@{profile.username}</span>
                  )}
                </div>
                <IconButton
                  icon={UserPlus}
                  label={t('studentsPage.inviteParent', { name: profile.display_name })}
                  disabled={invite.isPending}
                  onClick={() =>
                    invite.mutate(
                      { role: 'parent', studentId: profile.id },
                      { onSuccess: () => setInvitedFor(profile.id) },
                    )
                  }
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <LevelBadge name={levelId ? levelName.get(levelId) : null} />
                <select
                  aria-label={t('studentsPage.changeLevel', { name: profile.display_name })}
                  value={levelId ?? ''}
                  disabled={setLevel.isPending}
                  onChange={(e) =>
                    setLevel.mutate({ studentId: profile.id, levelId: e.target.value || null })
                  }
                  className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
                >
                  <option value="">{t('studentsPage.noLevelFilter')}</option>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-sm">
                <dt className="text-text-muted">{t('studentsPage.group')}</dt>
                <dd className="truncate">{group ?? t('studentsPage.unassigned')}</dd>
                <dt className="text-text-muted">{t('studentsPage.rating')}</dt>
                <dd>
                  <InlineRatingEdit
                    academyId={academyId}
                    studentId={profile.id}
                    name={profile.display_name}
                    category={category}
                    value={rating}
                  />
                </dd>
              </dl>
              {invitedFor === profile.id && invite.data && <InviteLink token={invite.data.token} />}
            </li>
          );
        })}
      </ul>
      <ErrorText error={invite.error ?? setLevel.error} />
    </div>
  );
}
