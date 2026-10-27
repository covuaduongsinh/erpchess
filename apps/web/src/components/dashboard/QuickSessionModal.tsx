import { useClassroomMutations } from '@erpchess/api/react';
import type { ClassroomInput } from '@erpchess/domain';
import { useNavigate } from '@tanstack/react-router';
import { type FormEvent, useEffect, useState } from 'react';
import { Button, ErrorText, Field } from '../ui';

export interface CoachOption {
  id: string;
  name: string;
}

export interface GroupOption {
  id: string;
  name: string;
}

export interface QuickSessionModalProps {
  open: boolean;
  onClose: () => void;
  academyId: string;
  slug: string;
  userId: string;
  coaches: CoachOption[];
  groups?: GroupOption[];
}

function getDefaultStartTime(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 15);
  d.setSeconds(0);
  d.setMilliseconds(0);
  // Định dạng ISO không múi giờ cho datetime-local: YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function QuickSessionModal({
  open,
  onClose,
  academyId,
  slug,
  userId,
  coaches,
  groups = [],
}: QuickSessionModalProps) {
  const navigate = useNavigate();
  const { create } = useClassroomMutations(academyId, userId);

  const [title, setTitle] = useState('Lớp Cờ vua Trực tuyến');
  const [kind, setKind] = useState<'online' | 'offline'>('online');
  const [coachId, setCoachId] = useState<string>(coaches[0]?.id ?? userId);
  const [groupId, setGroupId] = useState<string>('');
  const [startsAt, setStartsAt] = useState<string>(getDefaultStartTime());
  const [minutes, setMinutes] = useState<number>(60);
  const [openImmediately, setOpenImmediately] = useState(true);

  useEffect(() => {
    if (open) {
      setStartsAt(getDefaultStartTime());
      if (coaches[0]?.id) setCoachId(coaches[0].id);
    }
  }, [open, coaches]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const dateObj = new Date(startsAt);
    const input: Omit<ClassroomInput, 'academyId'> = {
      title: title.trim() || 'Lớp Cờ vua',
      kind,
      videoMode: kind === 'online' ? 'performance' : 'none',
      isPublic: false,
      startsAt: dateObj.toISOString(),
      minutes,
      coachId: coachId || null,
      groupId: groupId || null,
      groupIds: groupId ? [groupId] : [],
      studentIds: [],
      repeat: null,
    };

    try {
      const created = await create.mutateAsync(input);
      onClose();
      if (openImmediately && kind === 'online' && created?.length) {
        const first = created[0];
        if (first?.id) {
          void navigate({
            to: '/a/$slug/classes/$id/room',
            params: { slug, id: first.id },
          });
          return;
        }
      }
      void navigate({
        to: '/a/$slug/classes',
        params: { slug },
      });
    } catch {
      // Error handled by create.error
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-session-title"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
        aria-hidden="true"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Đóng"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-600">
            🏫
          </span>
          <div>
            <h2 id="quick-session-title" className="font-bold text-gray-900 text-lg">
              Tạo Lớp học Nhanh
            </h2>
            <p className="text-xs text-text-muted">
              Khởi tạo buổi học trực tuyến có bàn cờ tương tác và LiveKit video
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Tên lớp */}
          <Field
            label="Tên buổi học / Chủ đề"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Chiến thuật Đòn ghim - Lớp U10"
          />

          {/* Hình thức & Thời lượng */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Hình thức học</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as 'online' | 'offline')}
                className="w-full rounded-md border border-text-muted/30 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-hidden"
              >
                <option value="online">🌐 Trực tuyến (LiveKit)</option>
                <option value="offline">🏫 Trực tiếp tại CLB</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Thời lượng</span>
              <select
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="w-full rounded-md border border-text-muted/30 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-hidden"
              >
                <option value={45}>45 phút</option>
                <option value={60}>60 phút (1 tiếng)</option>
                <option value={90}>90 phút (1.5 tiếng)</option>
                <option value={120}>120 phút (2 tiếng)</option>
              </select>
            </label>
          </div>

          {/* HLV phụ trách & Nhóm học viên */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Huấn luyện viên</span>
              <select
                value={coachId}
                onChange={(e) => setCoachId(e.target.value)}
                className="w-full rounded-md border border-text-muted/30 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-hidden"
              >
                {coaches.length > 0 ? (
                  coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                ) : (
                  <option value={userId}>Tôi (HLV hiện tại)</option>
                )}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Nhóm / Lớp (Batch)</span>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full rounded-md border border-text-muted/30 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-hidden"
              >
                <option value="">-- Cả học viện / Mở --</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Thời gian bắt đầu */}
          <Field
            label="Thời gian bắt đầu"
            type="datetime-local"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />

          {/* Checkbox mở phòng ngay */}
          {kind === 'online' && (
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={openImmediately}
                onChange={(e) => setOpenImmediately(e.target.checked)}
                className="size-4 rounded-sm border-gray-300 text-primary focus:ring-primary"
              />
              <span>Tự động chuyển vào phòng học trực tuyến ngay sau khi tạo</span>
            </label>
          )}

          {create.error && <ErrorText error={create.error} />}

          {/* Buttons */}
          <div className="mt-2 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" variant="cta" disabled={create.isPending}>
              {create.isPending ? 'Đang tạo lớp...' : '✓ Tạo Buổi Học'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
