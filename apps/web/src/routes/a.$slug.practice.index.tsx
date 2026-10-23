import { usePracticeChapters, usePracticeMutations } from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/practice/')({
  component: PracticePage,
});

function PracticePage() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const staff = isStaff(academy.role);
  const chapters = usePracticeChapters(academy.id);
  const { createChapter } = usePracticeMutations(academy.id, session.user.id);
  const [title, setTitle] = useState('');
  const [shared, setShared] = useState(true);

  function onCreate(e: FormEvent) {
    e.preventDefault();
    createChapter.mutate(
      { title, visibility: shared ? 'academy' : 'private' },
      { onSuccess: () => setTitle('') },
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
      <Card title={t('practice.title')}>
        <p className="text-sm text-text-muted">{t('practice.hint')}</p>
        {chapters.isPending ? (
          <Spinner />
        ) : chapters.error ? (
          <ErrorText error={chapters.error} />
        ) : chapters.data.length === 0 ? (
          <p className="text-text-muted">{t('practice.none')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-text-muted/15">
            {chapters.data.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <Link
                  to="/a/$slug/practice/$id"
                  params={{ slug: academy.slug, id: c.id }}
                  className="font-medium text-primary hover:underline"
                >
                  {c.title}
                </Link>
                <span className="text-sm text-text-muted">
                  {t('practice.positionCount', { count: c.positionCount })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {staff && (
        <Card title={t('practice.create')}>
          <form onSubmit={onCreate} className="flex flex-col gap-3">
            <Field
              label={t('practice.chapterName')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={160}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={shared}
                onChange={(e) => setShared(e.target.checked)}
              />
              {t('database.shareWithAcademy')}
            </label>
            <ErrorText error={createChapter.error} />
            <Button
              type="submit"
              variant="cta"
              className="self-start"
              disabled={createChapter.isPending}
            >
              {t('practice.create')}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
