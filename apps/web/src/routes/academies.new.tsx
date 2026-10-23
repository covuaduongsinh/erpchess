import { useCreateAcademy } from '@erpchess/api/react';
import { slugify } from '@erpchess/domain';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { RequireSession } from '../components/RequireSession';
import { Button, Card, ErrorText, Field } from '../components/ui';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/academies/new')({
  component: () => <RequireSession>{() => <NewAcademyForm />}</RequireSession>,
});

function NewAcademyForm() {
  const { t } = useT();
  const navigate = useNavigate();
  const create = useCreateAcademy();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const academy = await create.mutateAsync({ name, slug }).catch(() => null);
    if (academy) await navigate({ to: '/a/$slug', params: { slug: academy.slug } });
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Card title={t('academy.create')}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field
            label={t('academy.name')}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(slugify(e.target.value));
            }}
            required
          />
          <Field
            label={t('academy.slug')}
            hint={t('validation.slug')}
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugEdited(true);
            }}
            required
          />
          <ErrorText error={create.error} />
          <Button type="submit" variant="cta" disabled={create.isPending}>
            {t('common.create')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
