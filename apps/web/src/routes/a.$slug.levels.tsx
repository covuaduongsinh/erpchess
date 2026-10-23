import type { Level } from '@erpchess/api';
import { useLevelMutations, useLevels, useMembers } from '@erpchess/api/react';
import type { LevelInput } from '@erpchess/domain';
import { createFileRoute } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/levels')({
  component: LevelsPage,
});

function LevelsPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  const levels = useLevels(academy.id);
  const members = useMembers(academy.id);
  const mutations = useLevelMutations(academy.id);
  const owner = academy.role === 'owner';
  const [editing, setEditing] = useState<string | null>(null);

  if (levels.isPending) return <Spinner />;
  if (levels.error) return <ErrorText error={levels.error} />;
  const nextPosition = (levels.data.at(-1)?.position ?? -1) + 1;
  const countFor = (levelId: string) =>
    members.data?.filter((m) => m.role === 'student' && m.levelId === levelId).length ?? 0;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card title={t('levels.title')}>
        <p className="text-sm text-text-muted">{t('levels.hint')}</p>
        {levels.data.length === 0 ? (
          <p className="text-text-muted">{t('levels.none')}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {levels.data.map((level) => (
              <li key={level.id}>
                <button
                  type="button"
                  disabled={!owner}
                  aria-pressed={editing === level.id}
                  onClick={() => setEditing(level.id)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-bg aria-pressed:bg-primary/10"
                >
                  <span
                    aria-hidden
                    className="size-4 shrink-0 rounded-full"
                    style={{ backgroundColor: level.color }}
                  />
                  <span className="flex-1 font-medium">{level.name}</span>
                  <span className="text-sm text-text-muted">
                    {level.max_rating === null
                      ? t('levels.rangeOpen', { min: level.min_rating })
                      : t('levels.range', { min: level.min_rating, max: level.max_rating })}
                    {' · '}
                    {t('levels.studentCount', { count: countFor(level.id) })}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
        {owner ? (
          <div className="flex flex-wrap gap-2">
            {levels.data.length === 0 && (
              <Button
                variant="cta"
                disabled={mutations.fromTemplate.isPending}
                onClick={() => mutations.fromTemplate.mutate(nextPosition)}
              >
                {t('levels.useTemplate')}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setEditing('new')}>
              {t('levels.create')}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-text-muted">{t('levels.ownerOnly')}</p>
        )}
        <ErrorText error={mutations.fromTemplate.error} />
      </Card>

      {owner && editing && (
        <LevelForm
          key={editing}
          level={levels.data.find((l) => l.id === editing)}
          position={nextPosition}
          onDone={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function LevelForm({
  level,
  position,
  onDone,
}: {
  level?: Level;
  position: number;
  onDone: () => void;
}) {
  const { t } = useT();
  const { academy } = useAcademy();
  const { create, update, remove } = useLevelMutations(academy.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const criteria = (level?.criteria ?? {}) as Record<string, number | undefined>;
  const pending = create.isPending || update.isPending || remove.isPending;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const num = (name: string) => {
      const raw = String(form.get(name) ?? '').trim();
      return raw === '' ? undefined : Number(raw);
    };
    const input: LevelInput = {
      name: String(form.get('name') ?? ''),
      minRating: num('minRating') ?? 0,
      maxRating: num('maxRating') ?? null,
      color: String(form.get('color') ?? '#2B3990'),
      criteria: { xp: num('xp'), puzzles: num('puzzles'), tournaments: num('tournaments') },
    };
    if (level) update.mutate({ id: level.id, input }, { onSuccess: onDone });
    else create.mutate({ input, position }, { onSuccess: onDone });
  }

  return (
    <Card title={level ? level.name : t('levels.create')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label={t('levels.name')} name="name" defaultValue={level?.name} required />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t('levels.minRating')}
            name="minRating"
            type="number"
            min={0}
            defaultValue={level?.min_rating ?? 0}
            required
          />
          <Field
            label={t('levels.maxRating')}
            name="maxRating"
            type="number"
            min={1}
            placeholder={t('levels.noMax')}
            defaultValue={level?.max_rating ?? ''}
          />
        </div>
        <Field
          label={t('levels.color')}
          name="color"
          type="color"
          defaultValue={level?.color ?? '#2B3990'}
        />
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">{t('levels.criteria')}</legend>
          <div className="grid grid-cols-3 gap-3">
            <Field
              label={t('levels.xp')}
              name="xp"
              type="number"
              min={0}
              defaultValue={criteria.xp}
            />
            <Field
              label={t('levels.puzzles')}
              name="puzzles"
              type="number"
              min={0}
              defaultValue={criteria.puzzles}
            />
            <Field
              label={t('levels.tournaments')}
              name="tournaments"
              type="number"
              min={0}
              defaultValue={criteria.tournaments}
            />
          </div>
        </fieldset>
        <ErrorText error={create.error ?? update.error ?? remove.error} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="cta" disabled={pending}>
            {t('common.save')}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            {t('common.cancel')}
          </Button>
          {level && (
            <Button
              variant="ghost"
              className="ml-auto text-danger"
              disabled={pending}
              onClick={() =>
                confirmDelete
                  ? remove.mutate(level.id, { onSuccess: onDone })
                  : setConfirmDelete(true)
              }
            >
              {confirmDelete ? t('levels.confirmDelete') : t('levels.delete')}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
