import type { StudyActivity } from '@erpchess/api';
import { useLevels, useStudy, useStudyMutations } from '@erpchess/api/react';
import {
  type ActivityKind,
  activityKinds,
  estimateMinutes,
  type StudyVisibility,
  studyVisibilities,
} from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { ActivityEditor } from '../components/study/ActivityEditor';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/studies/$id/edit')({
  component: EditStudyPage,
});

type Editing = { mode: 'new'; kind: ActivityKind } | { mode: 'edit'; activity: StudyActivity };

function EditStudyPage() {
  const { t } = useT();
  const { id } = Route.useParams();
  const { academy, session } = useAcademy();
  const study = useStudy(id);
  const m = useStudyMutations(session.user.id);
  const [editing, setEditing] = useState<Editing | null>(null);

  if (study.isPending) return <Spinner />;
  if (study.error) return <ErrorText error={study.error} />;
  const activities = study.data.activities;
  const valid = activities.flatMap((a) => (a.invalid ? [] : [a]));

  function move(index: number, delta: number) {
    const ids = activities.map((a) => a.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target] as string, ids[index] as string];
    m.reorder.mutate({ studyId: id, orderedIds: ids });
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/a/$slug/studies"
        params={{ slug: academy.slug }}
        className="self-start text-sm text-primary hover:underline"
      >
        ← {t('studies.title')}
      </Link>
      <StudyDetailsForm key={study.data.updated_at} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <Card title={t('studies.activities')}>
          <p className="text-sm text-text-muted">
            {t('studies.activityCount', { count: activities.length })} ·{' '}
            {t('studies.minutes', { count: estimateMinutes(valid) })}
          </p>
          {activities.length === 0 && (
            <p className="text-text-muted">{t('studies.noActivities')}</p>
          )}
          <ol className="flex flex-col gap-1">
            {activities.map((a, i) => (
              <li key={a.id} className="flex items-center gap-1">
                <button
                  type="button"
                  aria-pressed={editing?.mode === 'edit' && editing.activity.id === a.id}
                  onClick={() => setEditing({ mode: 'edit', activity: a })}
                  className="flex flex-1 flex-col rounded-md px-2 py-1 text-left hover:bg-bg aria-pressed:bg-primary/10"
                >
                  <span className="text-xs text-text-muted">
                    #{i + 1} · {t(`activity.${a.kind as ActivityKind}`)}
                  </span>
                  <span className={a.invalid ? 'text-danger' : 'font-medium'}>
                    {a.title || t(`activity.${a.kind as ActivityKind}`)}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  className="px-2"
                  aria-label={t('studies.moveUp')}
                  disabled={i === 0 || m.reorder.isPending}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  className="px-2"
                  aria-label={t('studies.moveDown')}
                  disabled={i === activities.length - 1 || m.reorder.isPending}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </Button>
              </li>
            ))}
          </ol>
          <ErrorText error={m.reorder.error ?? m.deleteActivity.error} />
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium">{t('studies.addActivity')}</legend>
            <div className="flex flex-wrap gap-1">
              {activityKinds.map((kind) => (
                <Button
                  key={kind}
                  variant="ghost"
                  className="text-sm"
                  onClick={() => setEditing({ mode: 'new', kind })}
                >
                  + {t(`activity.${kind}`)}
                </Button>
              ))}
            </div>
          </fieldset>
        </Card>

        <Card
          title={
            editing
              ? t(
                  `activity.${editing.mode === 'new' ? editing.kind : (editing.activity.kind as ActivityKind)}`,
                )
              : t('studies.editor')
          }
        >
          {!editing ? (
            <p className="text-text-muted">{t('studies.pickActivity')}</p>
          ) : editing.mode === 'edit' && editing.activity.invalid ? (
            <div className="flex flex-col gap-2">
              <p className="text-danger">{t('studies.invalidActivity')}</p>
              <DeleteActivity
                studyId={id}
                activityId={editing.activity.id}
                onDone={() => setEditing(null)}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <ActivityEditor
                key={editing.mode === 'new' ? `new-${editing.kind}` : editing.activity.id}
                kind={
                  editing.mode === 'new' ? editing.kind : (editing.activity.kind as ActivityKind)
                }
                initial={
                  editing.mode === 'edit' && !editing.activity.invalid
                    ? editing.activity
                    : undefined
                }
                academyId={academy.id}
                studyId={id}
                saving={m.addActivity.isPending || m.updateActivity.isPending}
                error={m.addActivity.error ?? m.updateActivity.error}
                onCancel={() => setEditing(null)}
                onSave={(input) =>
                  editing.mode === 'new'
                    ? m.addActivity.mutate(
                        {
                          studyId: id,
                          input,
                          position: (activities.at(-1)?.position ?? -1) + 1,
                        },
                        { onSuccess: () => setEditing(null) },
                      )
                    : m.updateActivity.mutate(
                        { studyId: id, id: editing.activity.id, input },
                        { onSuccess: () => setEditing(null) },
                      )
                }
              />
              {editing.mode === 'edit' && (
                <DeleteActivity
                  studyId={id}
                  activityId={editing.activity.id}
                  onDone={() => setEditing(null)}
                />
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function DeleteActivity({
  studyId,
  activityId,
  onDone,
}: {
  studyId: string;
  activityId: string;
  onDone: () => void;
}) {
  const { t } = useT();
  const { session } = useAcademy();
  const { deleteActivity } = useStudyMutations(session.user.id);
  const [confirm, setConfirm] = useState(false);
  return (
    <Button
      variant="ghost"
      className="self-start text-danger"
      disabled={deleteActivity.isPending}
      onClick={() =>
        confirm
          ? deleteActivity.mutate({ studyId, id: activityId }, { onSuccess: onDone })
          : setConfirm(true)
      }
    >
      {confirm ? t('studies.confirmDeleteActivity') : t('studies.deleteActivity')}
    </Button>
  );
}

function StudyDetailsForm() {
  const { t } = useT();
  const { id } = Route.useParams();
  const { academy, session } = useAcademy();
  const study = useStudy(id);
  const levels = useLevels(academy.id);
  const { update } = useStudyMutations(session.user.id);
  if (!study.data) return null;
  const s = study.data;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    update.mutate({
      id,
      patch: {
        title: String(form.get('title') ?? ''),
        description: String(form.get('description') ?? ''),
        levelId: String(form.get('levelId') ?? '') || null,
        visibility: String(form.get('visibility') ?? 'private') as StudyVisibility,
      },
    });
  }

  return (
    <Card title={s.title}>
      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
        <Field
          label={t('studies.studyTitle')}
          name="title"
          defaultValue={s.title}
          required
          maxLength={160}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('groups.level')}</span>
          <select
            name="levelId"
            defaultValue={s.level_id ?? ''}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2"
          >
            <option value="">{t('groups.noLevel')}</option>
            {levels.data?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm md:col-span-2">
          <span className="font-medium">{t('studies.description')}</span>
          <textarea
            name="description"
            rows={2}
            maxLength={2000}
            defaultValue={s.description}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2"
          />
        </label>
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="mb-1 font-medium">{t('studies.visibility')}</legend>
          {studyVisibilities.map((v) => (
            <label key={v} className="flex items-center gap-2">
              <input type="radio" name="visibility" value={v} defaultChecked={s.visibility === v} />
              {t(`studies.visibility_${v}`)}
            </label>
          ))}
        </fieldset>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="cta" disabled={update.isPending}>
            {t('common.save')}
          </Button>
          {update.isSuccess && <span className="text-sm text-green">{t('groups.saved')}</span>}
        </div>
        <ErrorText error={update.error} />
      </form>
    </Card>
  );
}
