import { useUpdateAcademyActivityDefaults } from '@erpchess/api/react';
import {
  type ActivityDefaults,
  type ActivityKind,
  type ActivitySettings,
  APP_ACTIVITY_DEFAULTS,
  activityKinds,
  defaultsForKind,
} from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Button, Card, ErrorText } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/studies/defaults')({
  component: ActivityDefaultsPage,
});

/**
 * Hoạt động mặc định của học viện (Giai đoạn 24d, đặc tả REA: Study → Default config): mỗi loại
 * hoạt động có điểm, số lần thử tối đa, giới hạn thời gian, điểm trừ mỗi lần sai. Hoạt động mới
 * trong trình soạn lấy các giá trị này; HLV vẫn chỉnh riêng từng hoạt động.
 */
function ActivityDefaultsPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  const owner = academy.role === 'owner';
  const update = useUpdateAcademyActivityDefaults(academy.id);
  const [values, setValues] = useState<Record<ActivityKind, ActivitySettings>>(
    () =>
      Object.fromEntries(
        activityKinds.map((k) => [k, defaultsForKind(academy.activity_defaults, k)]),
      ) as Record<ActivityKind, ActivitySettings>,
  );
  const [saved, setSaved] = useState(false);

  const set = (kind: ActivityKind, patch: Partial<ActivitySettings>) => {
    setSaved(false);
    setValues((v) => ({ ...v, [kind]: { ...v[kind], ...patch } }));
  };
  const optional = (v: string) => (v.trim() === '' ? null : Math.round(Number(v)));

  function save() {
    // Chỉ lưu loại khác mặc định của ứng dụng để dữ liệu gọn
    const out: ActivityDefaults = {};
    for (const k of activityKinds) {
      const v = values[k];
      if (JSON.stringify(v) !== JSON.stringify(APP_ACTIVITY_DEFAULTS)) out[k] = v;
    }
    update.mutate(out, { onSuccess: () => setSaved(true) });
  }

  return (
    <Card title={t('activityDefaults.title')}>
      <Link to="/a/$slug/studies" params={{ slug: academy.slug }} className="text-sm text-primary">
        ← {t('studies.title')}
      </Link>
      <p className="text-sm text-text-muted">{t('activityDefaults.hint')}</p>
      {!owner && <p className="text-sm text-text-muted">{t('activityDefaults.ownerOnly')}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-text-muted">
            <tr>
              <th className="py-1 pr-2">{t('activityDefaults.kind')}</th>
              <th className="px-2 py-1">{t('activityDefaults.points')}</th>
              <th className="px-2 py-1">{t('activityDefaults.maxAttempts')}</th>
              <th className="px-2 py-1">{t('activityDefaults.timeLimit')}</th>
              <th className="px-2 py-1">{t('activityDefaults.wrongPenalty')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {activityKinds.map((k) => {
              const v = values[k];
              const label = t(`activity.${k}`);
              return (
                <tr key={k} className="border-t border-text-muted/10">
                  <td className="py-1 pr-2 font-medium">{label}</td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      disabled={!owner}
                      aria-label={`${label} · ${t('activityDefaults.points')}`}
                      value={v.points}
                      onChange={(e) => set(k, { points: Math.round(Number(e.target.value)) || 0 })}
                      className="w-20 rounded border border-text-muted/30 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      disabled={!owner}
                      placeholder="∞"
                      aria-label={`${label} · ${t('activityDefaults.maxAttempts')}`}
                      value={v.maxAttempts ?? ''}
                      onChange={(e) => set(k, { maxAttempts: optional(e.target.value) })}
                      className="w-20 rounded border border-text-muted/30 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min={5}
                      max={7200}
                      disabled={!owner}
                      placeholder="—"
                      aria-label={`${label} · ${t('activityDefaults.timeLimit')}`}
                      value={v.timeLimitS ?? ''}
                      onChange={(e) => set(k, { timeLimitS: optional(e.target.value) })}
                      className="w-24 rounded border border-text-muted/30 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      disabled={!owner}
                      aria-label={`${label} · ${t('activityDefaults.wrongPenalty')}`}
                      value={v.wrongPenalty}
                      onChange={(e) =>
                        set(k, { wrongPenalty: Math.round(Number(e.target.value)) || 0 })
                      }
                      className="w-20 rounded border border-text-muted/30 px-2 py-1"
                    />
                  </td>
                  <td className="py-1 pl-2">
                    {owner && (
                      <button
                        type="button"
                        className="text-xs text-text-muted underline"
                        onClick={() => set(k, APP_ACTIVITY_DEFAULTS)}
                      >
                        {t('activityDefaults.reset')}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ErrorText error={update.error} />
      {saved && (
        <p role="status" className="text-sm text-green">
          {t('activityDefaults.saved')}
        </p>
      )}
      {owner && (
        <Button variant="cta" className="self-start" disabled={update.isPending} onClick={save}>
          {t('activityDefaults.save')}
        </Button>
      )}
    </Card>
  );
}
