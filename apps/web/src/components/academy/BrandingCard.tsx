import { useUpdateAcademyProfile, useUploadAcademyBranding } from '@erpchess/api/react';
import { brandColorVars, contactKeys, socialKeys } from '@erpchess/domain';
import { type ChangeEvent, type FormEvent, useState } from 'react';
import { useAcademy } from '../../lib/academy-context';
import { useT } from '../../lib/use-t';
import { Button, Card, ErrorText, Field } from '../ui';

const DEFAULT_BRAND = '#2b3990';
const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon';
const MAX_IMAGE_BYTES = 1024 * 1024;

/** Thông tin và thương hiệu học viện (white-label, Giai đoạn 22a): chỉ chủ học viện thấy. */
export function BrandingCard() {
  const { t } = useT();
  const { academy } = useAcademy();
  const update = useUpdateAcademyProfile(academy.id);
  const upload = useUploadAcademyBranding(academy.id);
  const socials = (academy.socials ?? {}) as Partial<Record<(typeof socialKeys)[number], string>>;
  const contact = (academy.contact ?? {}) as Partial<Record<(typeof contactKeys)[number], string>>;
  const [logoUrl, setLogoUrl] = useState(academy.logo_url ?? '');
  const [faviconUrl, setFaviconUrl] = useState(academy.favicon_url ?? '');
  const [brandColor, setBrandColor] = useState(academy.brand_color ?? '');
  const [fileError, setFileError] = useState<string | null>(null);
  const preview = brandColorVars(brandColor);

  function onFile(kind: 'logo' | 'favicon') {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (file.size > MAX_IMAGE_BYTES) {
        setFileError(t('branding.fileTooLarge'));
        return;
      }
      setFileError(null);
      upload.mutate(
        { kind, file },
        { onSuccess: (url) => (kind === 'logo' ? setLogoUrl(url) : setFaviconUrl(url)) },
      );
    };
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '');
    update.mutate({
      name: text('name'),
      description: text('description'),
      logoUrl,
      faviconUrl,
      brandColor,
      socials: Object.fromEntries(socialKeys.map((k) => [k, text(k)])),
      contact: {
        address: text('address'),
        phone: text('phone'),
        zalo: text('contactZalo'),
      },
    });
  }

  return (
    <Card title={t('branding.title')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label={t('academy.name')} name="name" defaultValue={academy.name} required />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('branding.description')}</span>
          <textarea
            name="description"
            rows={3}
            maxLength={2000}
            defaultValue={academy.description}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2 text-base"
          />
        </label>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-medium">{t('branding.identity')}</legend>
          {(['logo', 'favicon'] as const).map((kind) => {
            const value = kind === 'logo' ? logoUrl : faviconUrl;
            const setValue = kind === 'logo' ? setLogoUrl : setFaviconUrl;
            return (
              <div key={kind} className="flex flex-col gap-2">
                <Field
                  label={t(kind === 'logo' ? 'branding.logoUrl' : 'branding.faviconUrl')}
                  type="url"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  {value && (
                    <img
                      src={value}
                      alt=""
                      className={`${kind === 'logo' ? 'size-10' : 'size-6'} rounded object-contain`}
                    />
                  )}
                  <label className="cursor-pointer text-sm text-primary underline">
                    {t(kind === 'logo' ? 'branding.uploadLogo' : 'branding.uploadFavicon')}
                    <input
                      type="file"
                      accept={IMAGE_ACCEPT}
                      onChange={onFile(kind)}
                      className="sr-only"
                      aria-label={t(
                        kind === 'logo' ? 'branding.uploadLogo' : 'branding.uploadFavicon',
                      )}
                    />
                  </label>
                </div>
              </div>
            );
          })}
          <div className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-sm font-medium">{t('branding.brandColor')}</span>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="color"
                value={preview?.primary ?? DEFAULT_BRAND}
                onChange={(e) => setBrandColor(e.target.value)}
                aria-label={t('branding.brandColor')}
                className="h-9 w-14 cursor-pointer rounded border border-text-muted/30"
              />
              <span
                data-testid="brand-preview"
                className="rounded-md px-3 py-1.5 text-sm font-semibold"
                style={{
                  backgroundColor: preview?.primary ?? DEFAULT_BRAND,
                  color: preview?.onPrimary ?? '#ffffff',
                }}
              >
                {academy.name}
              </span>
              {brandColor && (
                <button
                  type="button"
                  onClick={() => setBrandColor('')}
                  className="text-xs text-text-muted underline"
                >
                  {t('branding.resetColor')}
                </button>
              )}
            </div>
            <span className="text-xs text-text-muted">{t('branding.brandColorHint')}</span>
          </div>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-medium">{t('branding.contact')}</legend>
          <Field
            label={t('branding.address')}
            name="address"
            maxLength={300}
            defaultValue={contact.address ?? ''}
          />
          <Field
            label={t('branding.phone')}
            name="phone"
            type="tel"
            maxLength={30}
            defaultValue={contact.phone ?? ''}
          />
          <Field
            label={t('branding.zaloHotline')}
            name="contactZalo"
            type="tel"
            maxLength={30}
            defaultValue={contact.zalo ?? ''}
          />
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-medium">{t('branding.socials')}</legend>
          {socialKeys.map((k) => (
            <Field
              key={k}
              label={t(`branding.${k}`)}
              name={k}
              type="url"
              defaultValue={socials[k] ?? ''}
            />
          ))}
        </fieldset>
        {fileError && (
          <p role="alert" className="text-sm text-danger">
            {fileError}
          </p>
        )}
        <ErrorText error={upload.error ?? update.error} />
        {update.isSuccess && (
          <p role="status" className="text-sm text-green">
            {t('branding.saved')}
          </p>
        )}
        <Button
          type="submit"
          variant="cta"
          className="self-start"
          disabled={update.isPending || upload.isPending}
        >
          {upload.isPending ? t('branding.uploading') : t('common.save')}
        </Button>
      </form>
    </Card>
  );
}

/** Thông tin liên hệ học viện cho mọi thành viên; không có gì thì không hiện. */
export function AcademyContactCard() {
  const { t } = useT();
  const { academy } = useAcademy();
  const contact = (academy.contact ?? {}) as Partial<Record<(typeof contactKeys)[number], string>>;
  const rows = contactKeys.filter((k) => contact[k]);
  if (rows.length === 0) return null;
  const label = {
    address: 'branding.address',
    phone: 'branding.phone',
    zalo: 'branding.zaloHotline',
  } as const;
  return (
    <Card title={t('branding.contact')}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {rows.map((k) => (
          <div key={k} className="contents">
            <dt className="text-text-muted">{t(label[k])}</dt>
            <dd>
              {k === 'address' ? (
                contact[k]
              ) : (
                <a href={`tel:${contact[k]?.replace(/[^+\d]/g, '')}`} className="text-primary">
                  {contact[k]}
                </a>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
