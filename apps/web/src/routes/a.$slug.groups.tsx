import type { GroupWithCount } from '@erpchess/api';
import {
  useCreateGroup,
  useDeleteGroup,
  useGroupStudentIds,
  useGroups,
  useLevels,
  useMembers,
  useToggleGroupStudent,
  useUpdateGroup,
} from '@erpchess/api/react';
import {
  type GroupKind,
  groupKinds,
  isStaff,
  type ScheduleSlot,
  scheduleSchema,
  sortSchedule,
} from '@erpchess/domain';
import { createFileRoute } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { ScheduleEditor } from '../components/ScheduleEditor';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/groups')({
  component: GroupsPage,
});

function GroupsPage() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const groups = useGroups(academy.id);
  const levels = useLevels(academy.id);
  const createGroup = useCreateGroup(academy.id);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const staff = isStaff(academy.role);
  const selectedGroup = groups.data?.find((g) => g.id === selected);

  function onCreate(e: FormEvent) {
    e.preventDefault();
    createGroup.mutate(
      { name, coachId: academy.role === 'coach' ? session.user.id : undefined },
      { onSuccess: () => setName('') },
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card title={t('groups.title')}>
        {groups.isPending ? (
          <Spinner />
        ) : groups.error ? (
          <ErrorText error={groups.error} />
        ) : groups.data.length === 0 ? (
          <p className="text-text-muted">{t('groups.none')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {groups.data.map((g) => {
              const level = levels.data?.find((l) => l.id === g.level_id);
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    aria-pressed={selected === g.id}
                    onClick={() => setSelected(g.id)}
                    disabled={!staff}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-bg aria-pressed:bg-primary/10"
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{g.name}</span>
                      {g.kind === 'batch' && (
                        <span className="rounded bg-primary/10 px-1.5 text-xs font-bold text-primary uppercase">
                          {t('groups.kindBatch')}
                        </span>
                      )}
                      {level && (
                        <span
                          className="rounded px-1.5 text-xs text-white"
                          style={{ backgroundColor: level.color }}
                        >
                          {level.name}
                        </span>
                      )}
                    </span>
                    {staff && (
                      <span className="text-sm text-text-muted">
                        {t('groups.studentCount', { count: g.studentCount })}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {staff && (
          <form onSubmit={onCreate} className="flex items-end gap-2">
            <div className="flex-1">
              <Field
                label={t('groups.name')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="cta" disabled={createGroup.isPending}>
              {t('groups.create')}
            </Button>
          </form>
        )}
        <ErrorText error={createGroup.error} />
      </Card>

      {staff && selectedGroup && (
        <div className="flex flex-col gap-6">
          <GroupSettings
            key={`settings-${selectedGroup.id}`}
            group={selectedGroup}
            onDeleted={() => setSelected(null)}
          />
          <GroupStudents
            key={selectedGroup.id}
            groupId={selectedGroup.id}
            title={selectedGroup.name}
          />
        </div>
      )}
    </div>
  );
}

function GroupSettings({ group, onDeleted }: { group: GroupWithCount; onDeleted: () => void }) {
  const { t } = useT();
  const { academy } = useAcademy();
  const levels = useLevels(academy.id);
  const update = useUpdateGroup(academy.id);
  const remove = useDeleteGroup(academy.id);
  const [kind, setKind] = useState<GroupKind>(group.kind === 'batch' ? 'batch' : 'group');
  const [levelId, setLevelId] = useState(group.level_id ?? '');
  const parsed = scheduleSchema.safeParse(group.schedule);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>(parsed.success ? parsed.data : []);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function onSave(e: FormEvent) {
    e.preventDefault();
    update.mutate({
      id: group.id,
      patch: {
        kind,
        levelId: levelId || null,
        schedule: kind === 'batch' ? sortSchedule(schedule) : [],
      },
    });
  }

  return (
    <Card title={`${t('groups.settings')} — ${group.name}`}>
      <form onSubmit={onSave} className="flex flex-col gap-4">
        <fieldset className="flex gap-4">
          <legend className="mb-2 text-sm font-medium">{t('groups.kind')}</legend>
          {groupKinds.map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
              {k === 'batch' ? t('groups.kindBatch') : t('groups.kindGroup')}
            </label>
          ))}
        </fieldset>
        {kind === 'batch' && <p className="text-sm text-text-muted">{t('groups.batchHint')}</p>}

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('groups.level')}</span>
          <select
            value={levelId}
            onChange={(e) => setLevelId(e.target.value)}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2 text-base"
          >
            <option value="">{t('groups.noLevel')}</option>
            {levels.data?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        {kind === 'batch' && (
          <ScheduleEditor
            legend={t('groups.schedule')}
            schedule={schedule}
            onChange={setSchedule}
          />
        )}

        <ErrorText error={update.error ?? remove.error} />
        {update.isSuccess && (
          <p role="status" className="text-sm text-green">
            {t('groups.saved')}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="cta" disabled={update.isPending}>
            {t('common.save')}
          </Button>
          <Button
            variant="ghost"
            className="ml-auto text-danger"
            disabled={remove.isPending}
            onClick={() =>
              confirmDelete
                ? remove.mutate(group.id, { onSuccess: onDeleted })
                : setConfirmDelete(true)
            }
          >
            {confirmDelete ? t('groups.confirmDelete') : t('groups.delete')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function GroupStudents({ groupId, title }: { groupId: string; title: string }) {
  const { t } = useT();
  const { academy } = useAcademy();
  const members = useMembers(academy.id);
  const inGroup = useGroupStudentIds(groupId);
  const toggle = useToggleGroupStudent(academy.id, groupId);

  if (members.isPending || inGroup.isPending) return <Spinner />;
  const students = members.data?.filter((m) => m.role === 'student') ?? [];
  const ids = new Set(inGroup.data);

  return (
    <Card title={`${t('groups.manage')} — ${title}`}>
      {students.length === 0 ? (
        <p className="text-text-muted">{t('students.none')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {students.map(({ profile }) => (
            <li key={profile.id}>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={ids.has(profile.id)}
                  disabled={toggle.isPending}
                  onChange={() =>
                    toggle.mutate({ studentId: profile.id, inGroup: ids.has(profile.id) })
                  }
                />
                <span>{profile.display_name}</span>
                <span className="text-sm text-text-muted">@{profile.username}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <ErrorText error={toggle.error} />
    </Card>
  );
}
