import { useCreateInvitation, useCreateStudent, useGroups, useMembers } from '@erpchess/api/react';
import { createFileRoute } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { InviteLink } from '../components/InviteLink';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/students')({
  component: StudentsPage,
});

function StudentsPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  const members = useMembers(academy.id);
  const invite = useCreateInvitation(academy.id);
  const [invitedFor, setInvitedFor] = useState<string | null>(null);
  const students = members.data?.filter((m) => m.role === 'student') ?? [];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card title={t('students.title')}>
        {members.isPending ? (
          <Spinner />
        ) : members.error ? (
          <ErrorText error={members.error} />
        ) : students.length === 0 ? (
          <p className="text-text-muted">{t('students.none')}</p>
        ) : (
          <ul className="divide-y divide-text-muted/15">
            {students.map(({ profile }) => (
              <li key={profile.id} className="flex flex-col gap-2 py-3">
                <div className="flex items-center justify-between">
                  <span>
                    <span className="font-medium">{profile.display_name}</span>
                    <span className="text-sm text-text-muted"> · @{profile.username}</span>
                  </span>
                  <Button
                    variant="ghost"
                    className="text-sm"
                    disabled={invite.isPending}
                    onClick={() =>
                      invite.mutate(
                        { role: 'parent', studentId: profile.id },
                        { onSuccess: () => setInvitedFor(profile.id) },
                      )
                    }
                  >
                    {t('students.inviteParent')}
                  </Button>
                </div>
                {invitedFor === profile.id && invite.data && (
                  <InviteLink token={invite.data.token} />
                )}
              </li>
            ))}
          </ul>
        )}
        <ErrorText error={invite.error} />
      </Card>
      <CreateStudentCard />
    </div>
  );
}

function CreateStudentCard() {
  const { t } = useT();
  const { academy } = useAcademy();
  const groups = useGroups(academy.id);
  const create = useCreateStudent(academy.id);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const groupId = String(form.get('groupId') ?? '');
    create.mutate(
      {
        displayName: String(form.get('displayName')),
        username: String(form.get('username')),
        pin: String(form.get('pin')),
        groupId: groupId || undefined,
      },
      { onSuccess: () => formEl.reset() },
    );
  }

  return (
    <Card title={t('students.create')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label={t('auth.displayName')} name="displayName" required />
        <Field
          label={t('auth.username')}
          name="username"
          hint={t('validation.username')}
          autoCapitalize="none"
          autoComplete="off"
          required
        />
        <Field
          label={t('auth.pin')}
          name="pin"
          hint={t('validation.pin')}
          inputMode="numeric"
          autoComplete="off"
          required
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('students.group')}</span>
          <select
            name="groupId"
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2 text-base"
          >
            <option value="">{t('students.noGroup')}</option>
            {groups.data?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <ErrorText error={create.error} />
        {create.data && (
          <p role="status" className="text-sm text-green">
            {t('students.created', { username: create.data.username })}
          </p>
        )}
        <Button type="submit" variant="cta" disabled={create.isPending}>
          {t('students.create')}
        </Button>
      </form>
    </Card>
  );
}
