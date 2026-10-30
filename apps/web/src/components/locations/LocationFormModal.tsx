import type { LocationRow } from '@erpchess/api';
import { useLocationMutations } from '@erpchess/api/react';
import { type LocationInput, type LocationKind, locationKinds } from '@erpchess/domain';
import { type FormEvent, useState } from 'react';
import { useT } from '../../lib/use-t';
import { Button, ErrorText, Field } from '../ui';

// Thứ hai trước, Chủ nhật cuối (0 = Chủ nhật)
const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;

/** Form thêm/sửa địa điểm (Giai đoạn 23a); `location` có giá trị là sửa. */
export function LocationFormModal({
  academyId,
  location,
  onClose,
}: {
  academyId: string;
  location?: LocationRow;
  onClose: () => void;
}) {
  const { t } = useT();
  const { create, update } = useLocationMutations(academyId);
  const [kind, setKind] = useState<LocationKind>((location?.kind as LocationKind) ?? 'centre');
  const [isMain, setIsMain] = useState(location?.is_main ?? false);
  const [days, setDays] = useState<number[]>(location?.working_days ?? [1, 2, 3, 4, 5, 6]);
  const pending = create.isPending || update.isPending;

  function toggleDay(d: number) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '');
    const input: LocationInput = {
      kind,
      isMain,
      name: text('name'),
      addressLine: text('addressLine'),
      country: text('country'),
      state: text('state'),
      city: text('city'),
      workingDays: days,
      opensAt: text('opensAt'),
      closesAt: text('closesAt'),
      timezone: text('timezone'),
      contactName: text('contactName'),
      contactPhone: text('contactPhone'),
      email: text('email'),
      notes: text('notes'),
    };
    if (location) update.mutate({ id: location.id, input }, { onSuccess: onClose });
    else create.mutate(input, { onSuccess: onClose });
  }

  const hhmm = (v: string | undefined, fallback: string) => (v ? v.slice(0, 5) : fallback);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={location ? t('location.edit') : t('location.add')}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
    >
      <button
        type="button"
        aria-label={t('location.cancel')}
        onClick={onClose}
        className="fixed inset-0 bg-black/50"
      />
      <form
        onSubmit={onSubmit}
        className="relative z-10 my-8 flex w-full max-w-2xl flex-col gap-4 rounded-xl bg-white p-6 shadow-2xl"
      >
        <h2 className="text-lg font-bold text-primary">
          {location ? t('location.edit') : t('location.add')}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('location.kind')}</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as LocationKind)}
              className="rounded-md border border-text-muted/30 bg-white px-3 py-2"
            >
              {locationKinds.map((k) => (
                <option key={k} value={k}>
                  {t(`location.kind_${k}`)}
                </option>
              ))}
            </select>
          </label>
          <Field
            label={t('location.name')}
            name="name"
            required
            maxLength={120}
            defaultValue={location?.name}
          />
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={isMain}
            onChange={(e) => setIsMain(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="font-medium">{t('location.isMain')}</span>
            <span className="block text-xs text-text-muted">{t('location.isMainHint')}</span>
          </span>
        </label>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-medium">{t('location.address')}</legend>
          <div className="sm:col-span-2">
            <Field
              label={t('location.address')}
              name="addressLine"
              maxLength={300}
              defaultValue={location?.address_line}
            />
          </div>
          <Field
            label={t('location.country')}
            name="country"
            required
            maxLength={64}
            defaultValue={location?.country ?? 'Việt Nam'}
          />
          <Field
            label={t('location.state')}
            name="state"
            maxLength={64}
            defaultValue={location?.state}
          />
          <Field
            label={t('location.city')}
            name="city"
            maxLength={64}
            defaultValue={location?.city}
          />
          <Field
            label={t('location.timezone')}
            name="timezone"
            required
            maxLength={64}
            defaultValue={location?.timezone ?? 'Asia/Ho_Chi_Minh'}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t('location.workingDays')}</legend>
          <div className="flex flex-wrap gap-1">
            {WEEK.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(d)}
                onClick={() => toggleDay(d)}
                className="rounded-full border border-text-muted/30 px-3 py-1 text-xs aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-text-on-primary"
              >
                {t(`weekday.d${d}`)}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t('location.opensAt')}
              name="opensAt"
              type="time"
              required
              defaultValue={hhmm(location?.opens_at, '08:00')}
            />
            <Field
              label={t('location.closesAt')}
              name="closesAt"
              type="time"
              required
              defaultValue={hhmm(location?.closes_at, '20:00')}
            />
          </div>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t('location.contactName')}
            name="contactName"
            required
            maxLength={120}
            defaultValue={location?.contact_name}
          />
          <Field
            label={t('location.contactPhone')}
            name="contactPhone"
            type="tel"
            required
            maxLength={30}
            defaultValue={location?.contact_phone}
          />
          <Field
            label={t('location.email')}
            name="email"
            type="email"
            maxLength={254}
            defaultValue={location?.email ?? ''}
          />
          <Field
            label={t('location.notes')}
            name="notes"
            maxLength={1000}
            defaultValue={location?.notes}
          />
        </fieldset>

        <ErrorText error={create.error ?? update.error} />
        <div className="flex justify-end gap-2 border-t border-text-muted/15 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('location.cancel')}
          </Button>
          <Button type="submit" variant="cta" disabled={pending}>
            {t('location.save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
