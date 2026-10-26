import { type Lead, type LeadStatus, leadStatuses } from '@erpchess/api';
import { useLeadMutations, useLeads } from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { Button, Card, ErrorText, Field, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime, localInputToIso } from '../lib/format';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/leads')({
  component: LeadsPage,
});

const STATUS_STYLE: Record<LeadStatus, string> = {
  new: 'bg-primary/10 text-primary',
  contacted: 'bg-blue-light/15 text-blue-light',
  trial: 'bg-orange/15 text-orange',
  won: 'bg-green/15 text-green',
  lost: 'bg-text-muted/15 text-text-muted',
};

function LeadsPage() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const owner = academy.role === 'owner';
  const list = useLeads(academy.id);
  const { setEnabled } = useLeadMutations(academy.id, session.user.id);
  const [status, setStatus] = useState<string>('');
  const [q, setQ] = useState('');

  if (!isStaff(academy.role)) return <p className="text-text-muted">{t('lead.staffOnly')}</p>;
  if (!academy.leads_enabled) {
    return (
      <Card title={t('lead.title')}>
        <p className="text-text-muted">{t('lead.disabled')}</p>
        {owner && (
          <Button
            variant="cta"
            className="self-start"
            disabled={setEnabled.isPending}
            onClick={() => setEnabled.mutate(true)}
          >
            {t('lead.enable')}
          </Button>
        )}
        <ErrorText error={setEnabled.error} />
      </Card>
    );
  }

  const all = list.data ?? [];
  const s = q.trim().toLowerCase();
  const rows = all.filter(
    (l) =>
      (!status || l.status === status) &&
      (!s || [l.name, l.child_name, l.phone, l.email].some((x) => x.toLowerCase().includes(s))),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {leadStatuses.map((st) => (
          <button
            key={st}
            type="button"
            aria-pressed={status === st}
            onClick={() => setStatus(status === st ? '' : st)}
            className="rounded-lg bg-white p-3 text-left shadow-sm aria-pressed:ring-2 aria-pressed:ring-primary"
          >
            <p className="text-2xl font-bold text-primary">
              {all.filter((l) => l.status === st).length}
            </p>
            <p className="text-sm text-text-muted">{t(`lead.status_${st}`)}</p>
          </button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card title={t('lead.title')}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('lead.search')}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2 text-sm"
          />
          {list.isPending ? (
            <Spinner />
          ) : list.error ? (
            <ErrorText error={list.error} />
          ) : rows.length === 0 ? (
            <p className="text-text-muted">{t('lead.none')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-text-muted/15">
              {rows.map((l) => (
                <LeadRow key={l.id} lead={l} />
              ))}
            </ul>
          )}
          {owner && (
            <Button
              variant="ghost"
              className="self-start text-sm"
              onClick={() => setEnabled.mutate(false)}
            >
              {t('lead.disable')}
            </Button>
          )}
        </Card>
        <NewLead />
      </div>
    </div>
  );
}

function LeadRow({ lead }: { lead: Lead }) {
  const { t, i18n } = useT();
  const { academy, session } = useAcademy();
  const navigate = useNavigate();
  const { update, scheduleTrial, remove } = useLeadMutations(academy.id, session.user.id);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState('');
  const [minutes, setMinutes] = useState('60');

  function onTrial(e: FormEvent) {
    e.preventDefault();
    const startsAt = localInputToIso(start);
    if (!startsAt) return;
    const endsAt = new Date(Date.parse(startsAt) + Number(minutes) * 60_000).toISOString();
    scheduleTrial.mutate(
      { leadId: lead.id, startsAt, endsAt },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-medium">
            {lead.name}
            {lead.child_name && (
              <span className="text-text-muted">
                {' '}
                · {lead.child_name}
                {lead.child_age ? ` (${t('lead.ageShort', { n: lead.child_age })})` : ''}
              </span>
            )}
          </span>
          <span className="text-sm text-text-muted">
            {[lead.phone, lead.email, lead.source].filter(Boolean).join(' · ')}
          </span>
          {lead.trial && (
            <span className="text-sm text-orange">
              {t('lead.trialAt', { time: formatDateTime(lead.trial.starts_at, i18n.language) })}
            </span>
          )}
          {lead.note && <span className="text-sm whitespace-pre-line">{lead.note}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <select
            value={lead.status}
            onChange={(e) =>
              update.mutate({ id: lead.id, patch: { status: e.target.value as LeadStatus } })
            }
            className={`rounded-sm px-2 py-1 text-xs font-medium ${STATUS_STYLE[lead.status as LeadStatus]}`}
          >
            {leadStatuses.map((st) => (
              <option key={st} value={st}>
                {t(`lead.status_${st}`)}
              </option>
            ))}
          </select>
          <Button variant="ghost" className="text-sm" onClick={() => setOpen(!open)}>
            {t('lead.scheduleTrial')}
          </Button>
          <Button
            variant="ghost"
            className="text-sm"
            onClick={() => {
              update.mutate({ id: lead.id, patch: { status: 'won' } });
              void navigate({
                to: '/a/$slug/students',
                params: { slug: academy.slug },
                search: { name: lead.child_name || lead.name },
              });
            }}
          >
            {t('lead.convert')}
          </Button>
          <Button variant="ghost" className="text-sm" onClick={() => remove.mutate(lead.id)}>
            {t('bill.delete')}
          </Button>
        </div>
      </div>
      {open && (
        <form
          onSubmit={onTrial}
          className="flex flex-wrap items-end gap-2 rounded-md bg-bg p-3 text-sm"
        >
          <Field
            label={t('lead.trialStart')}
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
          <Field
            label={t('lead.minutes')}
            type="number"
            min={15}
            max={240}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
          <Button type="submit" disabled={scheduleTrial.isPending}>
            {t('lead.book')}
          </Button>
        </form>
      )}
      <ErrorText error={update.error ?? scheduleTrial.error ?? remove.error} />
    </li>
  );
}

function NewLead() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const { create } = useLeadMutations(academy.id, session.user.id);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    const f = new FormData(el);
    const age = String(f.get('childAge') ?? '').trim();
    create.mutate(
      {
        name: String(f.get('name')),
        phone: String(f.get('phone') ?? ''),
        email: String(f.get('email') ?? ''),
        childName: String(f.get('childName') ?? ''),
        childAge: age ? Number(age) : null,
        source: String(f.get('source') ?? ''),
        note: String(f.get('note') ?? ''),
      },
      { onSuccess: () => el.reset() },
    );
  }

  return (
    <Card title={t('lead.new')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 text-sm">
        <Field label={t('lead.name')} name="name" required maxLength={120} />
        <Field label={t('lead.phone')} name="phone" type="tel" maxLength={30} />
        <Field label={t('lead.email')} name="email" type="email" maxLength={120} />
        <div className="flex gap-2">
          <Field label={t('lead.childName')} name="childName" maxLength={120} />
          <Field label={t('lead.childAge')} name="childAge" type="number" min={3} max={99} />
        </div>
        <Field label={t('lead.source')} name="source" hint={t('lead.sourceHint')} maxLength={60} />
        <Field label={t('lead.note')} name="note" maxLength={2000} />
        <ErrorText error={create.error} />
        <Button type="submit" variant="cta" className="self-start" disabled={create.isPending}>
          {t('lead.add')}
        </Button>
      </form>
    </Card>
  );
}
