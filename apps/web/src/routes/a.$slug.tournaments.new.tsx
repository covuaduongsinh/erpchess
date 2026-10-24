import { TIME_PRESETS } from '@erpchess/api';
import { useGroupMemberships, useMembers, useTournamentMutations } from '@erpchess/api/react';
import { BoardEditor } from '@erpchess/board-web';
import { isValidFen, START_FEN } from '@erpchess/chess-core';
import {
  OPENING_PRESETS,
  type TournamentFormat,
  type TournamentRepeat,
  tournamentControls,
  tournamentFormats,
  tournamentRepeats,
} from '@erpchess/domain';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { TargetPicker } from '../components/assign/TargetPicker';
import { Button, Card, ErrorText, Field } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { localInputToIso } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/tournaments/new')({
  component: NewTournamentPage,
});

type Team = { key: number; name: string; playerIds: string[] };

/** Tạo giải 3 bước: chi tiết → lịch → người chơi. */
function NewTournamentPage() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const members = useMembers(academy.id);
  const memberships = useGroupMemberships(academy.id);
  const { create } = useTournamentMutations(academy.id, session.user.id);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  // 1. Chi tiết
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [format, setFormat] = useState<TournamentFormat>('swiss');
  const [rounds, setRounds] = useState(5);
  const [minutes, setMinutes] = useState('10');
  const [increment, setIncrement] = useState('0');
  const [rated, setRated] = useState(false);
  const [allowDraw, setAllowDraw] = useState(true);
  const [allowResign, setAllowResign] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [control, setControl] = useState<(typeof tournamentControls)[number]>('auto_finish');
  const [startKind, setStartKind] = useState<'standard' | 'opening' | 'fen'>('standard');
  const [opening, setOpening] = useState<string>(OPENING_PRESETS[0].fen);
  const [fen, setFen] = useState(START_FEN);
  const [teamBoards, setTeamBoards] = useState(2);
  // 2. Lịch
  const [startsAt, setStartsAt] = useState('');
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [roundInterval, setRoundInterval] = useState(0);
  const [repeat, setRepeat] = useState<TournamentRepeat>('none');
  const [repeatUntil, setRepeatUntil] = useState('');
  // 3. Người chơi
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [teams, setTeams] = useState<Team[]>([
    { key: 1, name: '', playerIds: [] },
    { key: 2, name: '', playerIds: [] },
  ]);

  const name = (id: string) =>
    members.data?.find((m) => m.profile.id === id)?.profile.display_name ?? '?';
  const playerIds = [
    ...new Set([
      ...studentIds,
      ...(memberships.data ?? [])
        .filter((m) => groupIds.includes(m.groupId))
        .map((m) => m.studentId),
    ]),
  ];
  const assigned = new Set(teams.flatMap((x) => x.playerIds));
  const baseMs = minutes.trim() === '' ? null : Math.round(Number(minutes) * 60_000);
  const select = 'rounded-md border border-text-muted/30 bg-white px-3 py-2';

  function submit() {
    create.mutate(
      {
        title,
        description,
        location,
        format,
        rounds,
        baseMs,
        incMs: Math.round(Number(increment || '0') * 1000),
        rated: rated && baseMs !== null,
        allowDraw,
        allowResign,
        isPublic,
        control,
        startKind,
        initialFen: startKind === 'opening' ? opening : startKind === 'fen' ? fen : undefined,
        teamBoards,
        startsAt: localInputToIso(startsAt) ?? null,
        timezone,
        roundIntervalMin: roundInterval,
        repeat,
        repeatUntil: localInputToIso(repeatUntil) ?? null,
        playerIds: format === 'team_swiss' ? [] : playerIds,
        teams:
          format === 'team_swiss'
            ? teams
                .filter((x) => x.playerIds.length)
                .map((x, i) => ({
                  name: x.name.trim() || t('tournament.teamN', { n: i + 1 }),
                  playerIds: x.playerIds,
                }))
            : [],
      },
      {
        onSuccess: (row) =>
          void navigate({
            to: '/a/$slug/tournaments/$id',
            params: { slug: academy.slug, id: row.id },
          }),
      },
    );
  }

  const zodMessage = (create.error as { issues?: { message: string }[] } | null)?.issues?.[0]
    ?.message;
  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/a/$slug/tournaments"
        params={{ slug: academy.slug }}
        className="self-start text-sm text-primary hover:underline"
      >
        ← {t('tournament.title')}
      </Link>
      <ol className="flex gap-4 text-sm">
        {(['details', 'schedule', 'players'] as const).map((s, i) => (
          <li key={s} className={step === i + 1 ? 'font-bold text-primary' : 'text-text-muted'}>
            {t(`tournament.step_${s}`)}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <Card title={t('tournament.step_details')}>
          <Field
            label={t('tournament.name')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={160}
          />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('tournament.description')}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={4000}
              className={select}
            />
          </label>
          <Field
            label={t('tournament.location')}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={160}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('tournament.format')}</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                className={select}
              >
                {tournamentFormats.map((f) => (
                  <option key={f} value={f}>
                    {t(`tournament.format_${f}`)}
                  </option>
                ))}
              </select>
            </label>
            {(format === 'swiss' || format === 'team_swiss') && (
              <Field
                label={t('tournament.rounds')}
                type="number"
                min={1}
                max={30}
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
              />
            )}
            {format === 'team_swiss' && (
              <Field
                label={t('tournament.teamBoards')}
                type="number"
                min={1}
                max={10}
                value={teamBoards}
                onChange={(e) => setTeamBoards(Number(e.target.value))}
              />
            )}
          </div>
          {format === 'swiss' && (
            <p className="text-xs text-text-muted">{t('tournament.dutchNote')}</p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('tournament.time')}</span>
              <select
                value={
                  TIME_PRESETS.find(
                    (p) => p.baseMs === baseMs && p.incMs === Number(increment) * 1000,
                  )?.id ?? ''
                }
                onChange={(e) => {
                  const p = TIME_PRESETS.find((x) => x.id === e.target.value);
                  if (p) {
                    setMinutes(String(p.baseMs / 60_000));
                    setIncrement(String(p.incMs / 1000));
                  }
                }}
                className={select}
              >
                <option value="">—</option>
                {TIME_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label={t('tournament.minutes')}
              type="number"
              min={1}
              max={180}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              hint={t('tournament.unlimited')}
            />
            <Field
              label={t('tournament.increment')}
              type="number"
              min={0}
              max={180}
              value={increment}
              onChange={(e) => setIncrement(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            {(
              [
                ['rated', rated, setRated],
                ['allowDraw', allowDraw, setAllowDraw],
                ['allowResign', allowResign, setAllowResign],
                ['isPublic', isPublic, setIsPublic],
              ] as const
            ).map(([key, value, set]) => (
              <label key={key} className="flex items-center gap-2">
                <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} />
                {t(`tournament.${key}`)}
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('tournament.control')}</span>
              <select
                value={control}
                onChange={(e) => setControl(e.target.value as typeof control)}
                className={select}
              >
                {tournamentControls.map((c) => (
                  <option key={c} value={c}>
                    {t(`tournament.control_${c}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('tournament.startKind')}</span>
              <select
                value={startKind}
                onChange={(e) => setStartKind(e.target.value as typeof startKind)}
                className={select}
              >
                {(['standard', 'opening', 'fen'] as const).map((k) => (
                  <option key={k} value={k}>
                    {t(`tournament.start_${k}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {startKind === 'opening' && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('tournament.opening')}</span>
              <select
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                className={select}
              >
                {OPENING_PRESETS.map((o) => (
                  <option key={o.id} value={o.fen}>
                    {t(`tournament.opening_${o.id}`)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {startKind === 'fen' && (
            <div className="max-w-md">
              <BoardEditor
                fen={fen}
                onChange={setFen}
                labels={{
                  board: t('studies.editorBoard'),
                  eraser: t('studies.eraser'),
                  start: t('studies.startPosition'),
                  clear: t('studies.clearBoard'),
                  flip: t('database.flip'),
                  sideToMove: t('studies.sideToMove'),
                  white: t('studies.white'),
                  black: t('studies.black'),
                }}
              />
              {!isValidFen(fen) && <p className="text-sm text-danger">{t('studies.errFen')}</p>}
            </div>
          )}
          <Button
            variant="cta"
            className="self-start"
            disabled={!title.trim() || (startKind === 'fen' && !isValidFen(fen))}
            onClick={() => setStep(2)}
          >
            {t('tournament.next')}
          </Button>
        </Card>
      )}

      {step === 2 && (
        <Card title={t('tournament.step_schedule')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t('tournament.startsAt')}
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
            <Field
              label={t('tournament.timezone')}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              maxLength={64}
            />
            <Field
              label={t('tournament.interval')}
              type="number"
              min={0}
              max={10080}
              value={roundInterval}
              onChange={(e) => setRoundInterval(Number(e.target.value))}
            />
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('tournament.repeat')}</span>
              <select
                value={repeat}
                onChange={(e) => setRepeat(e.target.value as TournamentRepeat)}
                className={select}
              >
                {tournamentRepeats.map((r) => (
                  <option key={r} value={r}>
                    {t(`tournament.repeat_${r}`)}
                  </option>
                ))}
              </select>
            </label>
            {repeat !== 'none' && (
              <Field
                label={t('tournament.repeatUntil')}
                type="datetime-local"
                value={repeatUntil}
                onChange={(e) => setRepeatUntil(e.target.value)}
              />
            )}
          </div>
          {(control === 'auto_schedule' || repeat !== 'none') && !startsAt && (
            <p className="text-sm text-danger">{t('tournament.error_schedule')}</p>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              {t('tournament.back')}
            </Button>
            <Button
              variant="cta"
              disabled={(control === 'auto_schedule' || repeat !== 'none') && !startsAt}
              onClick={() => setStep(3)}
            >
              {t('tournament.next')}
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card title={t('tournament.step_players')}>
            <TargetPicker
              groupIds={groupIds}
              studentIds={studentIds}
              onGroups={setGroupIds}
              onStudents={setStudentIds}
            />
          </Card>
          <Card
            title={
              format === 'team_swiss'
                ? t('tournament.teams')
                : t('tournament.playerCount', { count: playerIds.length })
            }
          >
            {format !== 'team_swiss' ? (
              <ul className="flex flex-col gap-1 text-sm">
                {playerIds.map((id) => (
                  <li key={id}>{name(id)}</li>
                ))}
              </ul>
            ) : (
              <TeamsEditor
                teams={teams}
                setTeams={setTeams}
                pool={playerIds.filter((id) => !assigned.has(id))}
                name={name}
                boards={teamBoards}
              />
            )}
            {zodMessage === 'schedule' ? (
              <p role="alert" className="text-sm text-danger">
                {t('tournament.error_schedule')}
              </p>
            ) : (
              <ErrorText error={create.error} />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(2)}>
                {t('tournament.back')}
              </Button>
              <Button variant="cta" disabled={create.isPending} onClick={submit}>
                {t('tournament.create')}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/** Chia đội cho Swiss đồng đội: bấm người ở "chưa vào đội" để thêm vào đội đang chọn; thứ tự = bàn. */
function TeamsEditor({
  teams,
  setTeams,
  pool,
  name,
  boards,
}: {
  teams: Team[];
  setTeams: (f: (x: Team[]) => Team[]) => void;
  pool: string[];
  name: (id: string) => string;
  boards: number;
}) {
  const { t } = useT();
  const [current, setCurrent] = useState(0);
  return (
    <div className="flex flex-col gap-3 text-sm">
      {teams.map((team, i) => (
        <div
          key={team.key}
          className={`rounded-md border p-2 ${current === i ? 'border-primary' : 'border-text-muted/20'}`}
        >
          <input
            aria-label={t('tournament.teamName')}
            placeholder={t('tournament.teamN', { n: i + 1 })}
            value={team.name}
            onFocus={() => setCurrent(i)}
            onChange={(e) =>
              setTeams((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))
            }
            className="w-full rounded border border-text-muted/30 px-2 py-1"
          />
          <ol className="mt-1">
            {team.playerIds.map((id, b) => (
              <li key={id} className="flex justify-between">
                <span className={b < boards ? '' : 'text-text-muted'}>
                  {t('tournament.board', { n: b + 1 })}: {name(id)}
                </span>
                <button
                  type="button"
                  className="text-danger"
                  onClick={() =>
                    setTeams((x) =>
                      x.map((y, j) =>
                        j === i ? { ...y, playerIds: y.playerIds.filter((p) => p !== id) } : y,
                      ),
                    )
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="mt-1 text-xs text-primary" onClick={() => setCurrent(i)}>
            {current === i ? '●' : '○'} {t('tournament.teamN', { n: i + 1 })}
          </button>
        </div>
      ))}
      <Button
        variant="ghost"
        className="self-start text-sm"
        onClick={() =>
          setTeams((x) => [
            ...x,
            { key: Math.max(0, ...x.map((y) => y.key)) + 1, name: '', playerIds: [] },
          ])
        }
      >
        + {t('tournament.addTeam')}
      </Button>
      <div>
        <p className="font-medium">{t('tournament.unassigned')}</p>
        <div className="flex flex-wrap gap-1">
          {pool.map((id) => (
            <button
              key={id}
              type="button"
              className="rounded-full bg-bg px-2 py-1 hover:bg-primary/10"
              onClick={() =>
                setTeams((x) =>
                  x.map((y, j) => (j === current ? { ...y, playerIds: [...y.playerIds, id] } : y)),
                )
              }
            >
              {name(id)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
