import { fetchGroupMemberships, type Member } from '@erpchess/api';
import {
  useCreateInvitation,
  useCreateStudent,
  useErpClient,
  useGroups,
  useImportStudents,
  useLevels,
  useMembers,
  useRatings,
  useSetInitialRating,
  useSetStudentLevel,
} from '@erpchess/api/react';
import {
  parseStudentsCsv,
  type RatingCategory,
  ratingCategories,
  type StudentCsvResult,
  slugify,
  studentsToCsv,
} from '@erpchess/domain';
import type { TranslationKey } from '@erpchess/i18n';
import { createFileRoute } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { InviteLink } from '../components/InviteLink';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { downloadCsv } from '../lib/download';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/students')({
  // `name`: điền sẵn khi chuyển lead thành học viên
  validateSearch: (s: Record<string, unknown>): { name?: string } =>
    typeof s.name === 'string' && s.name ? { name: s.name.slice(0, 80) } : {},
  component: StudentsPage,
});

const selectClass = 'rounded-md border border-text-muted/30 bg-white px-2 py-1 text-sm';

function StudentsPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  const members = useMembers(academy.id);
  const levels = useLevels(academy.id);
  const ratings = useRatings(academy.id);
  const invite = useCreateInvitation(academy.id);
  const setLevel = useSetStudentLevel(academy.id);
  const [invitedFor, setInvitedFor] = useState<string | null>(null);
  const [category, setCategory] = useState<RatingCategory>('rapid');
  const students = members.data?.filter((m) => m.role === 'student') ?? [];
  const ratingOf = (studentId: string) =>
    ratings.data?.find((r) => r.student_id === studentId && r.category === category)?.rating;

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <Card title={t('students.title')}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium">{t('students.rating')}</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as RatingCategory)}
              className={selectClass}
            >
              {ratingCategories.map((c) => (
                <option key={c} value={c}>
                  {t(`rating.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <ExportButton students={students} />
        </div>
        {members.isPending ? (
          <Spinner />
        ) : members.error ? (
          <ErrorText error={members.error} />
        ) : students.length === 0 ? (
          <p className="text-text-muted">{t('students.none')}</p>
        ) : (
          <ul className="divide-y divide-text-muted/15">
            {students.map(({ profile, levelId }) => (
              <li key={profile.id} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{profile.display_name}</span>
                    <span className="text-sm text-text-muted"> · @{profile.username}</span>
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`${t('students.level')} — ${profile.display_name}`}
                      value={levelId ?? ''}
                      disabled={setLevel.isPending}
                      onChange={(e) =>
                        setLevel.mutate({ studentId: profile.id, levelId: e.target.value || null })
                      }
                      className={selectClass}
                    >
                      <option value="">{t('groups.noLevel')}</option>
                      {levels.data?.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                    <RatingInput
                      key={`${profile.id}-${category}-${ratingOf(profile.id) ?? ''}`}
                      studentId={profile.id}
                      name={profile.display_name}
                      category={category}
                      value={ratingOf(profile.id)}
                    />
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
                </div>
                {invitedFor === profile.id && invite.data && (
                  <InviteLink token={invite.data.token} />
                )}
              </li>
            ))}
          </ul>
        )}
        <ErrorText error={invite.error ?? setLevel.error} />
      </Card>
      <div className="flex flex-col gap-6">
        <CreateStudentCard />
        <ImportCard />
      </div>
    </div>
  );
}

/** Ô rating: lưu khi rời ô hoặc bấm Enter, chỉ khi giá trị đổi. */
function RatingInput({
  studentId,
  name,
  category,
  value,
}: {
  studentId: string;
  name: string;
  category: RatingCategory;
  value: number | undefined;
}) {
  const { t } = useT();
  const { academy } = useAcademy();
  const set = useSetInitialRating(academy.id);
  const [draft, setDraft] = useState(value === undefined ? '' : String(Math.round(value)));

  function save() {
    const next = Number(draft);
    if (draft.trim() === '' || !Number.isInteger(next)) return;
    if (value !== undefined && Math.round(value) === next) return;
    set.mutate({ studentId, category, rating: next });
  }

  return (
    <input
      type="number"
      min={0}
      max={3500}
      aria-label={`${t('students.rating')} ${t(`rating.${category}`)} — ${name}`}
      placeholder={t('rating.none')}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && save()}
      aria-invalid={set.isError}
      className="w-20 rounded-md border border-text-muted/30 bg-white px-2 py-1 text-sm aria-invalid:border-danger"
    />
  );
}

function ExportButton({ students }: { students: Member[] }) {
  const { t } = useT();
  const client = useErpClient();
  const { academy } = useAcademy();
  const groups = useGroups(academy.id);
  const levels = useLevels(academy.id);
  const ratings = useRatings(academy.id);
  const [error, setError] = useState<unknown>(null);

  async function onExport() {
    setError(null);
    try {
      const memberships = await fetchGroupMemberships(client, academy.id);
      const groupName = new Map(groups.data?.map((g) => [g.id, g.name]));
      const csv = studentsToCsv(
        students.map(({ profile, levelId }) => ({
          displayName: profile.display_name,
          username: profile.username,
          level: levels.data?.find((l) => l.id === levelId)?.name,
          groups: memberships
            .filter((m) => m.studentId === profile.id)
            .flatMap((m) => groupName.get(m.groupId) ?? []),
          rating: ratings.data?.find((r) => r.student_id === profile.id && r.category === 'rapid')
            ?.rating,
        })),
      );
      downloadCsv(`hoc-vien-${academy.slug}.csv`, csv);
    } catch (err) {
      setError(err);
    }
  }

  return (
    <>
      <Button variant="ghost" className="ml-auto text-sm" onClick={onExport}>
        {t('students.export')}
      </Button>
      <ErrorText error={error} />
    </>
  );
}

function ImportCard() {
  const { t } = useT();
  const { academy } = useAcademy();
  const groups = useGroups(academy.id);
  const importer = useImportStudents(academy.id);
  const [parsed, setParsed] = useState<StudentCsvResult | null>(null);

  async function onFile(file: File | undefined) {
    importer.reset();
    setParsed(file ? parseStudentsCsv(await file.text()) : null);
  }

  const results = importer.data;
  const failed = results?.filter((r) => !r.ok) ?? [];

  return (
    <Card title={t('students.import')}>
      <p className="text-sm text-text-muted">{t('students.importHint')}</p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t('students.chooseFile')}</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </label>
      {parsed && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-medium">
            {t('students.importPreview', { count: parsed.rows.length })}
          </p>
          {parsed.issues.length > 0 && (
            <ul className="text-danger">
              {parsed.issues.map((issue) => (
                <li key={`${issue.line}-${issue.field}`}>
                  {t('students.importIssue', {
                    line: issue.line,
                    field: t(`csvIssue.${issue.field}` as TranslationKey),
                  })}
                </li>
              ))}
            </ul>
          )}
          {parsed.rows.length > 0 && !results && (
            <Button
              variant="cta"
              className="self-start"
              disabled={importer.isPending}
              onClick={() => importer.mutate({ rows: parsed.rows, groups: groups.data ?? [] })}
            >
              {importer.isPending
                ? t('students.importProgress', {
                    done: importer.progress,
                    total: parsed.rows.length,
                  })
                : t('students.importRun', { count: parsed.rows.length })}
            </Button>
          )}
        </div>
      )}
      <ErrorText error={importer.error} />
      {results && (
        <div role="status" className="flex flex-col gap-1 text-sm">
          <p className="font-medium text-green">
            {t('students.importDone', {
              ok: results.length - failed.length,
              failed: failed.length,
            })}
          </p>
          {failed.map((r) => (
            <p key={r.username} className="text-danger">
              {t('students.importFailed', {
                username: r.username,
                error: r.error === 'username_taken' ? t('students.usernameTaken') : (r.error ?? ''),
              })}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

function CreateStudentCard() {
  const { t } = useT();
  const { name: prefill } = Route.useSearch();
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
        <Field label={t('auth.displayName')} name="displayName" defaultValue={prefill} required />
        <Field
          label={t('auth.username')}
          name="username"
          defaultValue={prefill ? slugify(prefill).replace(/-/g, '.').slice(0, 32) : undefined}
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
