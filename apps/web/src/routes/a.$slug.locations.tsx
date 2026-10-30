import type { LocationRow } from '@erpchess/api';
import { useGroups, useLocationMutations, useLocations } from '@erpchess/api/react';
import { filterLocations, isStaff, type LocationFilter } from '@erpchess/domain';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { LocationFormModal } from '../components/locations/LocationFormModal';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/locations')({
  component: LocationsPage,
});

const FILTERS: LocationFilter[] = ['all', 'centre', 'school', 'other'];

/** Địa điểm học viện (Giai đoạn 23a): staff xem, chủ học viện thêm/sửa/xoá. */
function LocationsPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  const owner = academy.role === 'owner';
  const locations = useLocations(academy.id);
  const groups = useGroups(isStaff(academy.role) ? academy.id : undefined);
  const { remove } = useLocationMutations(academy.id);
  const [filter, setFilter] = useState<LocationFilter>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<LocationRow | 'new' | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const rows = filterLocations(locations.data ?? [], filter, query);
  const batchCount = (id: string) => (groups.data ?? []).filter((g) => g.location_id === id).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-primary">{t('location.title')}</h2>
          <p className="text-sm text-text-muted">{t('location.subtitle')}</p>
        </div>
        {owner && (
          <Button variant="cta" onClick={() => setEditing('new')}>
            + {t('location.add')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className="rounded-full px-3 py-1 text-sm text-text-muted hover:bg-primary/10 aria-pressed:bg-primary aria-pressed:text-text-on-primary"
          >
            {t(`location.filter_${f}`)}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('location.search')}
          aria-label={t('location.search')}
          className="ml-auto min-w-48 rounded-md border border-text-muted/30 bg-white px-3 py-1.5 text-sm"
        />
      </div>

      {locations.isPending ? (
        <Spinner />
      ) : locations.error ? (
        <ErrorText error={locations.error} />
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            {(locations.data ?? []).length === 0 ? t('location.none') : t('location.noMatch')}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((l) => (
            <Card key={l.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold">{l.name}</h3>
                  <p className="text-xs text-text-muted">
                    {t(`location.kind_${l.kind as 'centre'}`)}
                  </p>
                </div>
                {l.is_main && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-text-on-primary">
                    {t('location.mainBadge')}
                  </span>
                )}
              </div>
              <p className="text-sm">
                {[l.address_line, l.city, l.state, l.country].filter(Boolean).join(', ')}
              </p>
              <p className="text-xs text-text-muted">
                {[...l.working_days]
                  .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
                  .map((d) => t(`weekday.d${d as 0}`))
                  .join(', ')}{' '}
                · {l.opens_at.slice(0, 5)}–{l.closes_at.slice(0, 5)}
              </p>
              <p className="text-sm">
                {l.contact_name} ·{' '}
                <a href={`tel:${l.contact_phone.replace(/[^+\d]/g, '')}`} className="text-primary">
                  {l.contact_phone}
                </a>
              </p>
              {groups.data && (
                <p className="text-xs text-text-muted">
                  {t('location.batchesHere', { count: batchCount(l.id) })}
                </p>
              )}
              {owner && (
                <div className="flex flex-wrap items-center gap-2 border-t border-text-muted/15 pt-2">
                  <Button variant="ghost" className="text-sm" onClick={() => setEditing(l)}>
                    {t('location.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-sm text-danger"
                    disabled={remove.isPending}
                    title={t('location.deleteHint')}
                    onClick={() => {
                      // Xoá hai bước thay cho hộp thoại xác nhận của trình duyệt
                      if (confirmId === l.id) {
                        remove.mutate(l.id);
                        setConfirmId(null);
                      } else setConfirmId(l.id);
                    }}
                  >
                    {confirmId === l.id ? t('location.confirmDelete') : t('location.delete')}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <ErrorText error={remove.error} />

      {editing && (
        <LocationFormModal
          academyId={academy.id}
          location={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
