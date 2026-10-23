import { useLevels, useStudyMutations } from '@erpchess/api/react';
import { type StudyVisibility, studyVisibilities } from '@erpchess/domain';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { FormEvent } from 'react';
import { Button, Card, ErrorText, Field } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/studies/new')({
  component: NewStudyPage,
});

/** Chỉ hỏi thông tin cơ bản; tạo xong chuyển sang trình soạn để thêm hoạt động (không lưu nháp rỗng). */
function NewStudyPage() {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const levels = useLevels(academy.id);
  const { create } = useStudyMutations(session.user.id);
  const navigate = useNavigate();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    create.mutate(
      {
        academyId: academy.id,
        title: String(form.get('title') ?? ''),
        description: String(form.get('description') ?? ''),
        levelId: String(form.get('levelId') ?? '') || null,
        visibility: String(form.get('visibility') ?? 'private') as StudyVisibility,
      },
      {
        onSuccess: (study) =>
          void navigate({
            to: '/a/$slug/studies/$id/edit',
            params: { slug: academy.slug, id: study.id },
          }),
      },
    );
  }

  return (
    <Card title={t('studies.create')}>
      <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
        <Field label={t('studies.studyTitle')} name="title" required maxLength={160} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('studies.description')}</span>
          <textarea
            name="description"
            rows={3}
            maxLength={2000}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('groups.level')}</span>
          <select
            name="levelId"
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2"
          >
            <option value="">{t('groups.noLevel')}</option>
            {levels.data?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium">{t('studies.visibility')}</legend>
          {studyVisibilities.map((v) => (
            <label key={v} className="flex items-center gap-2">
              <input type="radio" name="visibility" value={v} defaultChecked={v === 'academy'} />
              {t(`studies.visibility_${v}`)}
            </label>
          ))}
        </fieldset>
        <ErrorText error={create.error} />
        <Button type="submit" variant="cta" className="self-start" disabled={create.isPending}>
          {t('studies.createAndEdit')}
        </Button>
      </form>
    </Card>
  );
}
