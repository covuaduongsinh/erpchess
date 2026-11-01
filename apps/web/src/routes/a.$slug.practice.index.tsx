import { usePracticeChapters, usePracticeMutations } from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Layers, Puzzle, Search } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  FilterBar,
  PageHeader,
  SearchInput,
  Spinner,
  StatCard,
} from '../components/ui';
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
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createChapter.mutate(
      { title: title.trim(), visibility: shared ? 'academy' : 'private' },
      {
        onSuccess: () => {
          setTitle('');
          setShowCreate(false);
        },
      },
    );
  }

  const list = chapters.data ?? [];
  const totalPositions = list.reduce((sum, c) => sum + (c.positionCount || 0), 0);
  const needle = search.trim().toLowerCase();
  const shown = list.filter((c) => !needle || c.title.toLowerCase().includes(needle));

  return (
    <>
      <PageHeader
        icon={Puzzle}
        title={t('practice.title')}
        subtitle={t('practice.hint')}
        actions={
          staff && (
            <Button variant="cta" onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? t('common.cancel') : `+ ${t('practice.create')}`}
            </Button>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          accent="blue"
          icon={Layers}
          label={t('learnPage.practiceStatChapters')}
          value={list.length}
        />
        <StatCard
          accent="green"
          icon={Puzzle}
          label={t('learnPage.practiceStatPositions')}
          value={totalPositions}
        />
      </div>
      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('learnPage.practiceSearch')}
        />
      </FilterBar>

      {/* Form tạo chương (dành cho HLV) */}
      {staff && showCreate && (
        <Card title={t('practice.create')}>
          <form onSubmit={onCreate} className="flex flex-col gap-3">
            <Field
              label={t('practice.chapterName')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Khai cuộc Ý cơ bản, Tàn cuộc Xe chốt, Đòn thí Hậu..."
              required
              maxLength={160}
            />
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={shared}
                onChange={(e) => setShared(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary"
              />
              {t('database.shareWithAcademy')}
            </label>
            <ErrorText error={createChapter.error} />
            <div className="flex gap-2">
              <Button type="submit" variant="cta" disabled={createChapter.isPending}>
                {createChapter.isPending ? 'Đang tạo...' : t('practice.create')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                Huỷ
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Danh sách chương dạng Grid Cards */}
      <Card>
        {chapters.isPending ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : chapters.error ? (
          <ErrorText error={chapters.error} />
        ) : list.length === 0 ? (
          <EmptyState
            dashed
            icon={Puzzle}
            title={t('practice.none')}
            description={staff ? t('practice.hint') : undefined}
          />
        ) : shown.length === 0 ? (
          <EmptyState icon={Search} title={t('learnPage.noMatch')} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((c) => (
              <div
                key={c.id}
                className="group relative flex flex-col justify-between rounded-xl border border-text-muted/15 bg-white p-4 shadow-xs transition hover:border-primary/40 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {c.visibility === 'academy' ? 'Học viện' : 'Riêng tư'}
                    </span>
                    <span className="text-xs text-text-muted">
                      {t('practice.positionCount', { count: c.positionCount })}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-text group-hover:text-primary">
                    <Link
                      to="/a/$slug/practice/$id"
                      params={{ slug: academy.slug, id: c.id }}
                      className="focus:outline-hidden"
                    >
                      <span className="absolute inset-0" aria-hidden="true" />
                      {c.title}
                    </Link>
                  </h3>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-text-muted/10 pt-3 text-sm">
                  <span className="text-xs font-medium text-text-muted">
                    {c.positionCount > 0 ? 'Sẵn sàng luyện' : 'Chưa có thế cờ'}
                  </span>
                  <span className="font-semibold text-primary group-hover:translate-x-1 transition-transform">
                    Luyện tập →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
