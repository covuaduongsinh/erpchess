import type { StudyScope, StudySummary } from '@erpchess/api';
import {
  useCollectionMutations,
  useCollections,
  useStudies,
  useStudyMutations,
} from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { LichessImportDialog } from '../components/study/LichessImportDialog';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/studies/')({
  component: StudiesPage,
});

const SCOPES: StudyScope[] = ['mine', 'academy', 'public'];

function StudiesPage() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const staff = isStaff(academy.role);
  const [scope, setScope] = useState<StudyScope>(staff ? 'mine' : 'academy');
  const [search, setSearch] = useState('');
  const studies = useStudies({ scope, academyId: academy.id, userId: session.user.id, search });
  const [importing, setImporting] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      {importing && <LichessImportDialog onClose={() => setImporting(false)} />}
      <Card title={t('studies.title')}>
        <div className="flex flex-wrap items-end gap-3">
          <div role="tablist" className="flex gap-1">
            {SCOPES.filter((s) => staff || s !== 'mine').map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={scope === s}
                onClick={() => setScope(s)}
                className="rounded-full px-3 py-1 text-sm text-text-muted aria-selected:bg-primary aria-selected:text-text-on-primary"
              >
                {t(`studies.scope_${s}`)}
              </button>
            ))}
          </div>
          <div className="min-w-48 flex-1">
            <Field
              label={t('studies.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {staff && (
            <Link
              to="/a/$slug/studies/defaults"
              params={{ slug: academy.slug }}
              className="rounded-md px-3 py-2 text-sm text-primary hover:bg-primary/10"
            >
              ⚙ {t('activityDefaults.open')}
            </Link>
          )}
          {staff && (
            <Button variant="ghost" onClick={() => setImporting(true)}>
              {t('lichessImport.open')}
            </Button>
          )}
          {staff && (
            <Link
              to="/a/$slug/studies/new"
              params={{ slug: academy.slug }}
              className="rounded-md bg-orange px-4 py-2 font-medium text-white hover:bg-orange-hover"
            >
              {t('studies.create')}
            </Link>
          )}
        </div>
        {studies.isPending ? (
          <Spinner />
        ) : studies.error ? (
          <ErrorText error={studies.error} />
        ) : studies.data.length === 0 ? (
          <p className="text-text-muted">{t('studies.none')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-text-muted/15">
            {studies.data.map((s) => (
              <StudyRow key={s.id} study={s} />
            ))}
          </ul>
        )}
      </Card>
      {staff && <CollectionsCard />}
    </div>
  );
}

function StudyRow({ study }: { study: StudySummary }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const { remove } = useStudyMutations(session.user.id);
  const [confirm, setConfirm] = useState(false);
  const editable =
    study.academy_id === academy.id &&
    (academy.role === 'owner' ||
      (academy.role === 'coach' && study.created_by === session.user.id));

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex flex-col">
        <Link
          to="/a/$slug/studies/$id"
          params={{ slug: academy.slug, id: study.id }}
          className="font-medium text-primary hover:underline"
        >
          {study.title}
        </Link>
        <span className="text-sm text-text-muted">
          {t('studies.activityCount', { count: study.activityCount })} ·{' '}
          {t(`studies.visibility_${study.visibility as 'private' | 'academy' | 'public'}`)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {editable && (
          <>
            <Link
              to="/a/$slug/quizzes/new"
              params={{ slug: academy.slug }}
              search={{ studyId: study.id }}
              className="rounded-md px-3 py-1 text-sm font-medium text-primary hover:bg-primary/10"
            >
              {t('quiz.fromThisStudy')}
            </Link>
            <Link
              to="/a/$slug/studies/$id/edit"
              params={{ slug: academy.slug, id: study.id }}
              className="rounded-md px-3 py-1 text-sm font-medium text-primary hover:bg-primary/10"
            >
              {t('studies.edit')}
            </Link>
            <Button
              variant="ghost"
              className="text-sm text-danger"
              disabled={remove.isPending}
              onClick={() => (confirm ? remove.mutate(study.id) : setConfirm(true))}
            >
              {confirm ? t('studies.confirmDelete') : t('studies.delete')}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function CollectionsCard() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const collections = useCollections(academy.id);
  const mine = useStudies({ scope: 'academy', academyId: academy.id, userId: session.user.id });
  const { create, toggle, remove } = useCollectionMutations(academy.id, session.user.id);
  const [name, setName] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  function onCreate(e: FormEvent) {
    e.preventDefault();
    create.mutate(name, { onSuccess: () => setName('') });
  }

  return (
    <Card title={t('studies.collections')}>
      {collections.data?.length === 0 && (
        <p className="text-sm text-text-muted">{t('studies.noCollections')}</p>
      )}
      <ul className="flex flex-col gap-2">
        {collections.data?.map((c) => (
          <li key={c.id} className="flex flex-col gap-1">
            <button
              type="button"
              aria-expanded={open === c.id}
              onClick={() => setOpen(open === c.id ? null : c.id)}
              className="flex justify-between text-left font-medium"
            >
              {c.name}
              <span className="text-sm text-text-muted">{c.studyIds.length}</span>
            </button>
            {open === c.id && (
              <div className="flex flex-col gap-1 pl-2 text-sm">
                {mine.data?.length === 0 && (
                  <p className="text-text-muted">{t('studies.collectionHint')}</p>
                )}
                {mine.data?.map((s) => (
                  <label key={s.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={c.studyIds.includes(s.id)}
                      onChange={(e) =>
                        toggle.mutate({
                          collectionId: c.id,
                          studyId: s.id,
                          included: e.target.checked,
                        })
                      }
                    />
                    {s.title}
                  </label>
                ))}
                <Button
                  variant="ghost"
                  className="self-start text-danger"
                  onClick={() => remove.mutate(c.id)}
                >
                  {t('studies.deleteCollection')}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={onCreate} className="flex items-end gap-2">
        <div className="flex-1">
          <Field
            label={t('studies.collectionName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <Button type="submit" variant="ghost" disabled={create.isPending}>
          {t('common.create')}
        </Button>
      </form>
      <ErrorText error={create.error ?? toggle.error ?? remove.error} />
    </Card>
  );
}
