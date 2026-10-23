import {
  useCreateGroup,
  useGroupStudentIds,
  useGroups,
  useMembers,
  useToggleGroupStudent,
} from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
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
  const createGroup = useCreateGroup(academy.id);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const staff = isStaff(academy.role);

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
            {groups.data.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  aria-pressed={selected === g.id}
                  onClick={() => setSelected(g.id)}
                  disabled={!staff}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-bg aria-pressed:bg-primary/10"
                >
                  <span className="font-medium">{g.name}</span>
                  {staff && (
                    <span className="text-sm text-text-muted">
                      {t('groups.studentCount', { count: g.studentCount })}
                    </span>
                  )}
                </button>
              </li>
            ))}
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

      {staff && selected && (
        <GroupStudents
          key={selected}
          groupId={selected}
          title={groups.data?.find((g) => g.id === selected)?.name ?? ''}
        />
      )}
    </div>
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
