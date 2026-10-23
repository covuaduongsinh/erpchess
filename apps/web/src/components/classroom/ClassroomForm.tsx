import { useClassroomMutations, useGroups, useMembers } from '@erpchess/api/react';
import { expandSchedule, type ScheduleSlot, scheduleSchema, videoModes } from '@erpchess/domain';
import { type FormEvent, useMemo, useState } from 'react';
import { useAcademy } from '../../lib/academy-context';
import { localInputToIso } from '../../lib/format';
import { useT } from '../../lib/use-t';
import { TargetPicker } from '../assign/TargetPicker';
import { ScheduleEditor } from '../ScheduleEditor';
import { Button, Card, ErrorText, Field } from '../ui';

type Repeat = 'none' | 'batch' | 'custom';

/** Giá trị mặc định cho <input type="datetime-local">: giờ tròn kế tiếp. */
function nextHourInput(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}

/** Tạo một buổi học hoặc chuỗi lặp (theo lịch Batch hoặc lịch tự chọn). */
export function ClassroomForm({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const groups = useGroups(academy.id);
  const members = useMembers(academy.id);
  const { create } = useClassroomMutations(academy.id, session.user.id);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'online' | 'offline'>('online');
  const [videoMode, setVideoMode] = useState<(typeof videoModes)[number]>('performance');
  const [isPublic, setIsPublic] = useState(false);
  const [coachId, setCoachId] = useState(session.user.id);
  const [startsAt, setStartsAt] = useState(nextHourInput);
  const [minutes, setMinutes] = useState(60);
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [batchId, setBatchId] = useState('');
  const [custom, setCustom] = useState<ScheduleSlot[]>([]);
  const [weeks, setWeeks] = useState(4);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);

  const batches = (groups.data ?? []).filter((g) => g.kind === 'batch');
  const coaches = (members.data ?? []).filter((m) => m.role === 'owner' || m.role === 'coach');
  const batch = batches.find((b) => b.id === batchId);
  const batchSchedule = useMemo(() => {
    const parsed = scheduleSchema.safeParse(batch?.schedule);
    return parsed.success ? parsed.data : [];
  }, [batch]);
  const schedule = repeat === 'batch' ? batchSchedule : repeat === 'custom' ? custom : [];
  const startIso = localInputToIso(startsAt);
  const count =
    repeat === 'none'
      ? 1
      : startIso
        ? expandSchedule(schedule, new Date(startIso), weeks).length
        : 0;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!startIso) return;
    create.mutate(
      {
        title,
        kind,
        videoMode: kind === 'online' ? videoMode : 'none',
        isPublic,
        startsAt: startIso,
        minutes,
        coachId,
        groupId: repeat === 'batch' ? batchId || null : null,
        groupIds:
          repeat === 'batch' && batchId && !groupIds.includes(batchId)
            ? [...groupIds, batchId]
            : groupIds,
        studentIds,
        repeat: repeat === 'none' ? null : { schedule, weeks },
      },
      { onSuccess: onDone },
    );
  }

  const select = 'rounded-md border border-text-muted/30 bg-white px-3 py-2';
  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card title={t('classroom.create')}>
        <Field
          label={t('classroom.name')}
          placeholder="Class"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
        />
        <fieldset className="flex flex-wrap gap-4">
          <legend className="mb-2 text-sm font-medium">{t('classroom.kind')}</legend>
          {(['online', 'offline'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
              {t(`classroom.kind_${k}`)}
            </label>
          ))}
        </fieldset>
        {kind === 'online' && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('classroom.videoMode')}</span>
            <select
              value={videoMode}
              onChange={(e) => setVideoMode(e.target.value as (typeof videoModes)[number])}
              className={select}
            >
              {videoModes.map((m) => (
                <option key={m} value={m}>
                  {t(`classroom.video_${m}`)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('classroom.coach')}</span>
          <select value={coachId} onChange={(e) => setCoachId(e.target.value)} className={select}>
            {coaches.map((m) => (
              <option key={m.profile.id} value={m.profile.id}>
                {m.profile.display_name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-3">
          <Field
            label={t('classroom.startsAt')}
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
          {repeat === 'none' && (
            <Field
              label={t('classroom.minutes')}
              type="number"
              min={5}
              max={600}
              step={5}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          )}
        </div>
        <fieldset className="flex flex-wrap gap-4">
          <legend className="mb-2 text-sm font-medium">{t('classroom.repeat')}</legend>
          {(['none', 'batch', 'custom'] as const).map((r) => (
            <label key={r} className="flex items-center gap-2">
              <input
                type="radio"
                name="repeat"
                checked={repeat === r}
                onChange={() => setRepeat(r)}
              />
              {t(`classroom.repeat_${r}`)}
            </label>
          ))}
        </fieldset>
        {repeat === 'batch' && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('classroom.batch')}</span>
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className={select}
              required
            >
              <option value="">—</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {batch && batchSchedule.length === 0 && (
              <span className="text-danger">{t('classroom.batchNoSchedule')}</span>
            )}
          </label>
        )}
        {repeat === 'custom' && (
          <ScheduleEditor
            legend={t('classroom.repeat_custom')}
            schedule={custom}
            onChange={setCustom}
          />
        )}
        {repeat !== 'none' && (
          <Field
            label={t('classroom.weeks')}
            type="number"
            min={1}
            max={26}
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
          />
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          {t('classroom.isPublic')}
        </label>
        <p className="text-sm text-text-muted">{t('classroom.willCreate', { count })}</p>
        <ErrorText error={create.error} />
        <div className="flex gap-2">
          <Button type="submit" variant="cta" disabled={create.isPending || count === 0}>
            {t('classroom.create')}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            {t('common.cancel')}
          </Button>
        </div>
      </Card>
      <Card title={t('classroom.participants')}>
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
