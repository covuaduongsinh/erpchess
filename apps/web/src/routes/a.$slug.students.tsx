import { fetchGroupMemberships, type Member } from '@erpchess/api';
import {
  useCreateStudent,
  useErpClient,
  useGroups,
  useImportStudents,
  useLevels,
  useMembers,
  useRatings,
} from '@erpchess/api/react';
import { parseStudentsCsv, type StudentCsvResult, slugify, studentsToCsv } from '@erpchess/domain';
import type { TranslationKey } from '@erpchess/i18n';
import { createFileRoute } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { StudentAdminTable } from '../components/students/StudentAdminTable';
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

function StudentsPage() {
  const { academy } = useAcademy();
  const members = useMembers(academy.id);
  const levels = useLevels(academy.id);
  const groups = useGroups(academy.id);
  const ratings = useRatings(academy.id);

  const students = members.data?.filter((m) => m.role === 'student') ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white shadow-md">
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight">
            Quản trị Học viên (Students Administration)
          </h1>
          <p className="mt-1 text-blue-100 text-sm">
            Danh sách học viên, phân nhóm lớp (batches), cấp độ đào tạo và liên kết tài khoản phụ
            huynh
          </p>
        </div>
        <ExportButton students={students} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2.5fr_1fr]">
        <div className="flex flex-col gap-4">
          {members.isPending || levels.isPending || groups.isPending ? (
            <Spinner />
          ) : members.error ? (
            <ErrorText error={members.error} />
          ) : (
            <StudentAdminTable
              students={students}
              academyId={academy.id}
              slug={academy.slug}
              levels={levels.data ?? []}
              groups={groups.data ?? []}
              ratings={ratings.data ?? []}
            />
          )}
        </div>

        <div className="flex flex-col gap-6">
          <CreateStudentCard />
          <ImportCard />
        </div>
      </div>
    </div>
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
