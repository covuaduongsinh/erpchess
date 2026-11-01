import type { GroupWithCount } from '@erpchess/api';
import {
  useCreateGroup,
  useGroupStudentIds,
  useGroups,
  useLevels,
  useLocations,
  useMembers,
  useToggleGroupStudent,
  useUpdateGroup,
} from '@erpchess/api/react';
import {
  type BatchMode,
  batchModes,
  isStaff,
  modeNeedsLocation,
  scheduleSchema,
} from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Layers, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { LevelBadge } from '../components/students/LevelBadge';
import { Button, EmptyState, ErrorText, Field, PageHeader, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/batches')({
  component: BatchesPage,
});

function BatchesPage() {
  const { academy, session } = useAcademy();
  const slug = academy.slug;
  const staff = isStaff(academy.role);

  const groups = useGroups(academy.id);
  const levels = useLevels(academy.id);
  const members = useMembers(academy.id);
  const locations = useLocations(academy.id);
  const { t } = useT();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  const activeBatch = groups.data?.find((g) => g.id === activeBatchId);

  return (
    <>
      <PageHeader
        icon={Layers}
        title={t('nav.batches')}
        subtitle={t('groups.batchHint')}
        actions={
          staff && (
            <Button variant="cta" icon={Plus} onClick={() => setCreateModalOpen(true)}>
              {t('groups.create')}
            </Button>
          )
        }
      />

      {/* Grid Danh sách các Lớp / Batches */}
      {groups.isPending ? (
        <Spinner />
      ) : groups.error ? (
        <ErrorText error={groups.error} />
      ) : groups.data.length === 0 ? (
        <EmptyState
          dashed
          icon={Layers}
          title={t('groups.none')}
          description={t('groups.batchHint')}
          action={
            staff && (
              <Button variant="cta" onClick={() => setCreateModalOpen(true)}>
                {t('groups.create')}
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {groups.data.map((batch) => {
            const level = levels.data?.find((l) => l.id === batch.level_id);
            const coach = members.data?.find((m) => m.profile.id === batch.coach_id);
            const parsedSchedule = scheduleSchema.safeParse(batch.schedule).data ?? [];

            return (
              <div
                key={batch.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-xs transition-all hover:border-blue-300 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-text text-lg group-hover:text-primary transition-colors">
                      {batch.name}
                    </h3>
                    <LevelBadge name={level?.name} size="sm" />
                  </div>

                  {/* Thông tin HLV & Số học viên */}
                  <div className="mt-4 flex flex-col gap-2.5 text-xs text-text-muted">
                    <div className="flex items-center gap-2">
                      <span className="text-base" aria-hidden="true">
                        👨‍🏫
                      </span>
                      <span>
                        Huấn luyện viên:{' '}
                        <strong className="text-text">
                          {coach?.profile.display_name || 'Chưa phân công'}
                        </strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-base" aria-hidden="true">
                        👥
                      </span>
                      <span>
                        Sĩ số học viên:{' '}
                        <strong className="text-primary font-bold text-sm">
                          {batch.studentCount ?? 0}
                        </strong>{' '}
                        học viên
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-base" aria-hidden="true">
                        📍
                      </span>
                      <span>
                        {t(`location.mode_${(batch.mode ?? 'online') as BatchMode}`)}
                        {batch.location_id && (
                          <>
                            {' · '}
                            <strong className="text-text">
                              {locations.data?.find((l) => l.id === batch.location_id)?.name ?? '—'}
                            </strong>
                          </>
                        )}
                      </span>
                    </div>

                    {parsedSchedule.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-base" aria-hidden="true">
                          📅
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {parsedSchedule.map((s) => (
                            <span
                              key={`${s.day}-${s.start}`}
                              className="rounded-md bg-bg px-2 py-0.5 font-medium text-text text-xs"
                            >
                              T{s.day + 1}: {s.start} ({s.minutes}m)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Actions Footer */}
                <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() => setActiveBatchId(batch.id)}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Quản lý học viên →
                  </button>

                  <Link
                    to="/a/$slug/classes"
                    params={{ slug }}
                    className="rounded-md bg-bg px-2.5 py-1 text-xs font-medium text-text hover:bg-primary-soft"
                  >
                    Xem lịch lớp
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Quản lý Học viên trong Batch */}
      {activeBatch && (
        <BatchRosterModal
          batch={activeBatch}
          academyId={academy.id}
          onClose={() => setActiveBatchId(null)}
        />
      )}

      {/* Modal Tạo Lớp mới */}
      {createModalOpen && (
        <CreateBatchModal
          academyId={academy.id}
          levels={levels.data ?? []}
          locations={(locations.data ?? []).map((l) => ({ id: l.id, name: l.name }))}
          coaches={
            members.data
              ?.filter((m) => m.role === 'coach' || m.role === 'owner')
              .map((m) => ({ id: m.profile.id, name: m.profile.display_name })) ?? []
          }
          currentUserId={session.user.id}
          onClose={() => setCreateModalOpen(false)}
        />
      )}
    </>
  );
}

function CreateBatchModal({
  academyId,
  levels,
  locations,
  coaches,
  currentUserId,
  onClose,
}: {
  academyId: string;
  levels: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  coaches: Array<{ id: string; name: string }>;
  currentUserId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [levelId, setLevelId] = useState<string>('');
  const [coachId, setCoachId] = useState<string>(coaches[0]?.id ?? currentUserId);
  const [mode, setMode] = useState<BatchMode>('online');
  const [locationId, setLocationId] = useState('');
  const { t } = useT();
  const needLocation = modeNeedsLocation(mode);
  const create = useCreateGroup(academyId);
  const update = useUpdateGroup(academyId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || (needLocation && !locationId)) return;

    const res = await create.mutateAsync({
      name: name.trim(),
      coachId: coachId || undefined,
    });
    if (res?.id && (levelId || mode !== 'online')) {
      await update.mutateAsync({
        id: res.id,
        patch: {
          ...(levelId ? { levelId } : {}),
          ...(mode !== 'online' ? { mode, locationId } : {}),
        },
      });
    }
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs"
        aria-hidden="true"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl">
        <h3 className="font-bold text-text text-lg mb-4">Tạo Lớp học / Batch Mới</h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field
            label="Tên Lớp học / Batch"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Lớp U10 Nâng cao Thứ 7"
          />

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Cấp độ mục tiêu</span>
            <select
              value={levelId}
              onChange={(e) => setLevelId(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-hidden"
            >
              <option value="">-- Chưa chọn cấp độ --</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Huấn luyện viên phụ trách</span>
            <select
              value={coachId}
              onChange={(e) => setCoachId(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-hidden"
            >
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('location.mode')}</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as BatchMode)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-hidden"
            >
              {batchModes.map((m) => (
                <option key={m} value={m}>
                  {t(`location.mode_${m}`)}
                </option>
              ))}
            </select>
          </label>

          {needLocation &&
            (locations.length === 0 ? (
              <p className="text-xs text-danger">{t('location.noLocations')}</p>
            ) : (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t('location.title')}</span>
                <select
                  value={locationId}
                  required
                  onChange={(e) => setLocationId(e.target.value)}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-hidden"
                >
                  <option value="">{t('location.pickLocation')}</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}

          {create.error && <ErrorText error={create.error} />}
          {update.error && <ErrorText error={update.error} />}

          <div className="mt-2 flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant="cta"
              disabled={create.isPending || (needLocation && !locationId)}
            >
              {create.isPending ? 'Đang tạo...' : '✓ Tạo Lớp'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BatchRosterModal({
  batch,
  academyId,
  onClose,
}: {
  batch: GroupWithCount;
  academyId: string;
  onClose: () => void;
}) {
  const members = useMembers(academyId);
  const studentIds = useGroupStudentIds(batch.id);
  const toggle = useToggleGroupStudent(academyId, batch.id);
  const [filter, setFilter] = useState('');

  const allStudents = members.data?.filter((m) => m.role === 'student') ?? [];
  const inBatchSet = new Set(studentIds.data ?? []);

  const visibleStudents = allStudents.filter((s) =>
    s.profile.display_name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs"
        aria-hidden="true"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-bold text-text text-lg">Sĩ số: {batch.name}</h3>
            <p className="text-xs text-text-muted">
              Đang có {inBatchSet.size} học viên trong lớp này
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted hover:bg-primary-soft"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="my-3">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Tìm học viên để thêm/bớt..."
            className="w-full rounded-lg border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-hidden"
          />
        </div>

        {/* Student list */}
        <div className="flex-1 overflow-y-auto divide-y divide-border pr-1">
          {visibleStudents.map((s) => {
            const inBatch = inBatchSet.has(s.profile.id);
            return (
              <div key={s.profile.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                    {s.profile.display_name.charAt(0)}
                  </div>
                  <span className="font-medium text-sm text-text">{s.profile.display_name}</span>
                </div>
                <button
                  type="button"
                  disabled={toggle.isPending}
                  onClick={() =>
                    toggle.mutate({
                      studentId: s.profile.id,
                      inGroup: !inBatch,
                    })
                  }
                  className={`rounded-md px-3 py-1 font-semibold text-xs transition-colors ${
                    inBatch
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  {inBatch ? '✕ Rút khỏi lớp' : '+ Thêm vào lớp'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 border-t border-border pt-3 text-right">
          <Button variant="primary" onClick={onClose}>
            Xong
          </Button>
        </div>
      </div>
    </div>
  );
}
