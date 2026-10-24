import { formatCertificateCode } from '@erpchess/api';
import { useCertificateMutations, useCertificates, useMembers } from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDate } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/certificates/')({
  component: CertificatesPage,
});

function CertificatesPage() {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  const staff = isStaff(academy.role);
  const list = useCertificates({ academyId: academy.id });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card title={t('cert.title')}>
        {list.isPending ? (
          <Spinner />
        ) : list.error ? (
          <ErrorText error={list.error} />
        ) : list.data.length === 0 ? (
          <p className="text-text-muted">{t('cert.none')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-text-muted/15">
            {list.data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="flex flex-col">
                  <Link
                    to="/a/$slug/certificates/$id"
                    params={{ slug: academy.slug, id: c.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {c.title}
                  </Link>
                  <span className="text-sm text-text-muted">
                    {c.student_name} · {formatDate(c.issued_at, i18n.language)} ·{' '}
                    {c.course_id ? t('cert.fromCourse') : t('cert.manual')}
                  </span>
                </div>
                <span className="flex items-center gap-2 text-xs">
                  <code className="rounded-sm bg-bg px-2 py-1">
                    {formatCertificateCode(c.code)}
                  </code>
                  {c.revoked_at && (
                    <span className="rounded-sm bg-orange/15 px-2 py-1 text-orange">
                      {t('cert.revoked')}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {staff && <IssueCertificate />}
    </div>
  );
}

function IssueCertificate() {
  const { t } = useT();
  const { academy } = useAcademy();
  const members = useMembers(academy.id);
  const { issue } = useCertificateMutations(academy.id);
  const [studentId, setStudentId] = useState('');
  const [title, setTitle] = useState('');
  const students = (members.data ?? []).filter((m) => m.role === 'student');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    issue.mutate(
      { studentId, title },
      {
        onSuccess: () => {
          setStudentId('');
          setTitle('');
        },
      },
    );
  }

  return (
    <Card title={t('cert.issueManual')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('cert.student')}</span>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2"
          >
            <option value="">{t('cert.pickStudent')}</option>
            {students.map((m) => (
              <option key={m.profile.id} value={m.profile.id}>
                {m.profile.display_name || m.profile.username}
              </option>
            ))}
          </select>
        </label>
        <Field
          label={t('cert.certTitle')}
          placeholder={t('cert.titleHint')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={2}
          maxLength={200}
        />
        <ErrorText error={issue.error} />
        {issue.isSuccess && <p className="text-sm text-green">{t('cert.issued')}</p>}
        <Button type="submit" variant="cta" className="self-start" disabled={issue.isPending}>
          {t('cert.issue')}
        </Button>
      </form>
    </Card>
  );
}
