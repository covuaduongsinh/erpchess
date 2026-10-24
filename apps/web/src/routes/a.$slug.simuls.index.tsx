import { TIME_PRESETS } from '@erpchess/api';
import { useMembers, useSimulMutations, useSimuls } from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { TargetPicker } from '../components/assign/TargetPicker';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime, localInputToIso } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/simuls/')({
  component: SimulsPage,
});

const STATUSES = ['active', 'upcoming', 'finished'] as const;

function SimulsPage() {
  const { t, i18n } = useT();
  const { academy } = useAcademy();
  const staff = isStaff(academy.role);
  const simuls = useSimuls(academy.id);
  const members = useMembers(academy.id);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const name = (id: string) =>
    members.data?.find((m) => m.profile.id === id)?.profile.display_name ?? '?';

  if (creating) return <SimulForm onDone={() => setCreating(false)} />;
  const list = simuls.data ?? [];
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? list.filter((s) => `${s.title} ${s.description}`.toLowerCase().includes(needle))
    : list;

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/a/$slug/play"
        params={{ slug: academy.slug }}
        className="self-start text-sm text-primary hover:underline"
      >
        ← {t('play.title')}
      </Link>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('simul.total')} value={list.length} />
        {STATUSES.map((s) => (
          <Stat key={s} label={t(`simul.${s}`)} value={list.filter((x) => x.status === s).length} />
        ))}
      </div>
      <Card title={t('simul.title')}>
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            aria-label={t('simul.search')}
            placeholder={t('simul.search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-text-muted/30 bg-white px-3 py-2"
          />
          {staff && (
            <Button variant="cta" onClick={() => setCreating(true)}>
              {t('simul.create')}
            </Button>
          )}
        </div>
        {simuls.isPending ? (
          <Spinner />
        ) : simuls.error ? (
          <ErrorText error={simuls.error} />
        ) : shown.length === 0 ? (
          <p className="text-text-muted">{t('simul.none')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-text-muted/15">
            {shown.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="flex flex-col">
                  <Link
                    to="/a/$slug/simuls/$id"
                    params={{ slug: academy.slug, id: s.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {s.title}
                  </Link>
                  <span className="text-sm text-text-muted">
                    {name(s.host_id)} · {t('simul.boards', { count: s.boardCount })}
                    {s.starts_at && ` · ${formatDateTime(s.starts_at, i18n.language)}`}
                  </span>
                </div>
                <span className="text-sm">
                  {t(`simul.${s.status as (typeof STATUSES)[number]}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="text-2xl font-bold text-primary">{value}</p>
    </div>
  );
}

function SimulForm({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const members = useMembers(academy.id);
  const { create } = useSimulMutations(academy.id, session.user.id);
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hostId, setHostId] = useState(session.user.id);
  const [hostColor, setHostColor] = useState<'w' | 'b'>('w');
  const [startsAt, setStartsAt] = useState('');
  const [preset, setPreset] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const hosts = (members.data ?? []).filter((m) => m.role === 'owner' || m.role === 'coach');
  const select = 'rounded-md border border-text-muted/30 bg-white px-3 py-2';

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const tc = TIME_PRESETS.find((p) => p.id === preset);
    create.mutate(
      {
        title,
        description,
        hostId,
        hostColor,
        startsAt: localInputToIso(startsAt) ?? null,
        baseMs: tc?.baseMs ?? null,
        incMs: tc?.incMs ?? 0,
        groupIds,
        studentIds,
      },
      {
        onSuccess: (s) =>
          void navigate({ to: '/a/$slug/simuls/$id', params: { slug: academy.slug, id: s.id } }),
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card title={t('simul.create')}>
        <Field
          label={t('simul.name')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={160}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('simul.description')}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('simul.host')}</span>
          <select value={hostId} onChange={(e) => setHostId(e.target.value)} className={select}>
            {hosts.map((m) => (
              <option key={m.profile.id} value={m.profile.id}>
                {m.profile.display_name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex gap-4 text-sm">
          <legend className="mb-2 font-medium">{t('simul.hostColor')}</legend>
          {(['w', 'b'] as const).map((c) => (
            <label key={c} className="flex items-center gap-2">
              <input
                type="radio"
                name="hostColor"
                checked={hostColor === c}
                onChange={() => setHostColor(c)}
              />
              {c === 'w' ? t('play.white') : t('play.black')}
            </label>
          ))}
        </fieldset>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('play.time')}</span>
          <select value={preset} onChange={(e) => setPreset(e.target.value)} className={select}>
            <option value="">{t('play.unlimited')}</option>
            {TIME_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>
          {preset && <span className="text-xs text-text-muted">{t('simul.hostClockNote')}</span>}
        </label>
        <Field
          label={t('simul.startsAt')}
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />
        {create.error instanceof Error && create.error.message === 'targets' ? (
          <p role="alert" className="text-sm text-danger">
            {t('simul.noTargets')}
          </p>
        ) : (
          <ErrorText error={create.error} />
        )}
        <div className="flex gap-2">
          <Button
            type="submit"
            variant="cta"
            disabled={create.isPending || groupIds.length + studentIds.length === 0}
          >
            {t('simul.create')}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            {t('common.cancel')}
          </Button>
        </div>
      </Card>
      <Card title={t('simul.participants')}>
        <TargetPicker
          groupIds={groupIds}
          studentIds={studentIds}
          onGroups={setGroupIds}
          onStudents={setStudentIds}
        />
      </Card>
    </form>
  );
}
