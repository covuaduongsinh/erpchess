import { uploadStudyMedia } from '@erpchess/api';
import { useErpClient, usePuzzles } from '@erpchess/api/react';
import { BoardEditor, type BoardEditorLabels } from '@erpchess/board-web';
import {
  captureTargets,
  isValidFen,
  parsePgn,
  playMove,
  START_FEN,
  solveCapture,
} from '@erpchess/chess-core';
import {
  type Activity,
  type ActivityInput,
  type ActivityKind,
  activityInputSchema,
} from '@erpchess/domain';
import { BOT_LEVELS } from '@erpchess/engine';
import type { TranslationKey } from '@erpchess/i18n';
import { type ReactNode, useState } from 'react';
import { useT } from '../../lib/use-t';
import { Button, ErrorText, Field } from '../ui';
import { Markdown } from './Markdown';
import { SolutionRecorder } from './SolutionRecorder';

const CAPTURE_SAMPLE = '8/8/8/p3p3/8/8/8/R7 w - - 0 1';

type Draft = {
  title: string;
  points: number;
  maxAttempts: string;
  wrongPenalty: number;
  timeLimitS: string;
  fen: string;
  moves: string[];
  question: string;
  options: string[];
  correct: number;
  withBoard: boolean;
  body: string;
  side: 'w' | 'b';
  elo: string;
  goal: 'win' | 'draw';
  url: string;
  pgn: string;
};

function initialDraft(kind: ActivityKind, a?: Activity): Draft {
  const base: Draft = {
    title: a?.title ?? '',
    points: a?.points ?? 10,
    maxAttempts: a?.maxAttempts ? String(a.maxAttempts) : '',
    wrongPenalty: a?.wrongPenalty ?? 0,
    timeLimitS: a?.timeLimitS ? String(a.timeLimitS) : '',
    fen: kind === 'capture' ? CAPTURE_SAMPLE : START_FEN,
    moves: [],
    question: '',
    options: ['', ''],
    correct: 0,
    withBoard: false,
    body: '',
    side: 'w',
    elo: String(BOT_LEVELS[0].elo),
    goal: 'win',
    url: '',
    pgn: '',
  };
  if (!a) return base;
  switch (a.kind) {
    case 'puzzle':
      return { ...base, fen: a.payload.fen, moves: a.payload.moves };
    case 'capture':
      return { ...base, fen: a.payload.fen };
    case 'mcq':
      return {
        ...base,
        question: a.payload.question,
        options: a.payload.options,
        correct: a.payload.correct,
        withBoard: !!a.payload.fen,
        fen: a.payload.fen ?? START_FEN,
      };
    case 'explanation':
      return {
        ...base,
        body: a.payload.body,
        withBoard: !!a.payload.fen,
        fen: a.payload.fen ?? START_FEN,
      };
    case 'engine':
      return {
        ...base,
        fen: a.payload.fen,
        side: a.payload.side,
        elo: a.payload.elo === null ? '' : String(a.payload.elo),
        goal: a.payload.goal,
      };
    case 'video':
      return { ...base, url: a.payload.url };
    case 'game':
      return { ...base, pgn: a.payload.pgn };
  }
}

/** Ghép bản nháp thành input; trả mã lỗi i18n khi nội dung cờ chưa hợp lệ. */
function buildInput(kind: ActivityKind, d: Draft): ActivityInput | TranslationKey {
  const common = {
    title: d.title,
    points: d.points,
    maxAttempts: d.maxAttempts ? Number(d.maxAttempts) : null,
    wrongPenalty: d.wrongPenalty,
    timeLimitS: d.timeLimitS ? Number(d.timeLimitS) : null,
  };
  switch (kind) {
    case 'puzzle': {
      if (!isValidFen(d.fen)) return 'studies.errFen';
      if (d.moves.length === 0 || d.moves.length % 2 === 0)
        return 'studies.solutionMustEndWithSolver';
      return { kind, ...common, payload: { fen: d.fen, moves: d.moves } };
    }
    case 'capture': {
      if (captureTargets(d.fen) === 0) return 'studies.errCaptureNoTargets';
      if (solveCapture(d.fen) === null) return 'studies.errCaptureUnsolvable';
      return { kind, ...common, payload: { fen: d.fen } };
    }
    case 'mcq': {
      if (d.withBoard && !isValidFen(d.fen)) return 'studies.errFen';
      return {
        kind,
        ...common,
        payload: {
          question: d.question,
          options: d.options,
          correct: d.correct,
          ...(d.withBoard ? { fen: d.fen } : {}),
        },
      };
    }
    case 'explanation': {
      if (d.withBoard && !isValidFen(d.fen)) return 'studies.errFen';
      return { kind, ...common, payload: { body: d.body, ...(d.withBoard ? { fen: d.fen } : {}) } };
    }
    case 'engine': {
      if (!isValidFen(d.fen)) return 'studies.errFen';
      return {
        kind,
        ...common,
        payload: { fen: d.fen, side: d.side, elo: d.elo ? Number(d.elo) : null, goal: d.goal },
      };
    }
    case 'video':
      return { kind, ...common, payload: { url: d.url } };
    case 'game': {
      try {
        if (parsePgn(d.pgn).length === 0) return 'studies.errPgn';
      } catch {
        return 'studies.errPgn';
      }
      return { kind, ...common, payload: { pgn: d.pgn } };
    }
  }
}

export function ActivityEditor({
  kind,
  initial,
  academyId,
  studyId,
  saving,
  error,
  onSave,
  onCancel,
}: {
  kind: ActivityKind;
  initial?: Activity;
  academyId: string;
  studyId: string;
  saving: boolean;
  error: unknown;
  onSave: (input: ActivityInput) => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const [d, setD] = useState<Draft>(() => initialDraft(kind, initial));
  const [problem, setProblem] = useState<TranslationKey | null>(null);
  const [schemaError, setSchemaError] = useState<unknown>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setD((p) => ({ ...p, [key]: value }));
  const labels: BoardEditorLabels = {
    board: t('studies.editorBoard'),
    eraser: t('studies.eraser'),
    start: t('studies.startPosition'),
    clear: t('studies.clearBoard'),
    flip: t('database.flip'),
    sideToMove: t('studies.sideToMove'),
    white: t('studies.white'),
    black: t('studies.black'),
  };

  function submit() {
    setProblem(null);
    setSchemaError(null);
    const built = buildInput(kind, d);
    if (typeof built === 'string') {
      setProblem(built);
      return;
    }
    const parsed = activityInputSchema.safeParse(built);
    if (!parsed.success) {
      setSchemaError(parsed.error);
      return;
    }
    onSave(built);
  }

  let body: ReactNode = null;
  switch (kind) {
    case 'puzzle':
      body = (
        <PuzzleFields
          fen={d.fen}
          moves={d.moves}
          labels={labels}
          academyId={academyId}
          onFen={(fen) => setD((p) => ({ ...p, fen, moves: [] }))}
          onMoves={(moves) => set('moves', moves)}
        />
      );
      break;
    case 'capture':
      body = (
        <>
          <p className="text-sm text-text-muted">{t('studies.captureHint')}</p>
          <BoardEditor fen={d.fen} onChange={(fen) => set('fen', fen)} labels={labels} />
        </>
      );
      break;
    case 'mcq':
      body = (
        <>
          <Field
            label={t('studies.question')}
            value={d.question}
            onChange={(e) => set('question', e.target.value)}
            required
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t('studies.options')}</legend>
            {d.options.map((opt, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: phương án không có id, sửa theo vị trí
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  aria-label={t('studies.markCorrect', { n: i + 1 })}
                  checked={d.correct === i}
                  onChange={() => set('correct', i)}
                />
                <input
                  value={opt}
                  aria-label={t('studies.optionN', { n: i + 1 })}
                  onChange={(e) =>
                    set(
                      'options',
                      d.options.map((o, j) => (j === i ? e.target.value : o)),
                    )
                  }
                  className="flex-1 rounded-md border border-text-muted/30 bg-white px-3 py-1"
                />
                {d.options.length > 2 && (
                  <Button
                    variant="ghost"
                    className="text-sm"
                    onClick={() =>
                      setD((p) => ({
                        ...p,
                        options: p.options.filter((_, j) => j !== i),
                        correct: p.correct >= i && p.correct > 0 ? p.correct - 1 : p.correct,
                      }))
                    }
                  >
                    ✕
                  </Button>
                )}
              </div>
            ))}
            {d.options.length < 6 && (
              <Button
                variant="ghost"
                className="self-start text-sm"
                onClick={() => set('options', [...d.options, ''])}
              >
                {t('studies.addOption')}
              </Button>
            )}
          </fieldset>
          <OptionalBoard d={d} set={set} labels={labels} />
        </>
      );
      break;
    case 'explanation':
      body = (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('studies.body')}</span>
            <textarea
              value={d.body}
              onChange={(e) => set('body', e.target.value)}
              rows={8}
              className="rounded-md border border-text-muted/30 bg-white px-3 py-2"
            />
            <span className="text-xs text-text-muted">{t('studies.markdownHint')}</span>
          </label>
          {d.body.trim() && (
            <div className="rounded-md bg-bg p-3">
              <Markdown source={d.body} />
            </div>
          )}
          <OptionalBoard d={d} set={set} labels={labels} />
        </>
      );
      break;
    case 'engine':
      body = (
        <>
          <BoardEditor fen={d.fen} onChange={(fen) => set('fen', fen)} labels={labels} />
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              {t('studies.studentPlays')}
              <select
                value={d.side}
                onChange={(e) => set('side', e.target.value === 'b' ? 'b' : 'w')}
                className="rounded-md border border-text-muted/30 bg-white px-2 py-1"
              >
                <option value="w">{t('studies.white')}</option>
                <option value="b">{t('studies.black')}</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              {t('studies.engineLevel')}
              <select
                value={d.elo}
                onChange={(e) => set('elo', e.target.value)}
                className="rounded-md border border-text-muted/30 bg-white px-2 py-1"
              >
                {BOT_LEVELS.map(({ id, elo }) => (
                  <option key={id} value={elo === null ? '' : String(elo)}>
                    {elo === null ? t('studies.fullStrength') : `Elo ${elo}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              {t('studies.goal')}
              <select
                value={d.goal}
                onChange={(e) => set('goal', e.target.value === 'draw' ? 'draw' : 'win')}
                className="rounded-md border border-text-muted/30 bg-white px-2 py-1"
              >
                <option value="win">{t('studies.goalWin')}</option>
                <option value="draw">{t('studies.goalDraw')}</option>
              </select>
            </label>
          </div>
        </>
      );
      break;
    case 'video':
      body = (
        <VideoFields
          url={d.url}
          onUrl={(url) => set('url', url)}
          academyId={academyId}
          studyId={studyId}
        />
      );
      break;
    case 'game':
      body = (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">PGN</span>
          <textarea
            value={d.pgn}
            onChange={(e) => set('pgn', e.target.value)}
            rows={8}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2 font-mono text-xs"
          />
        </label>
      );
      break;
  }

  return (
    <div className="flex flex-col gap-4">
      <Field
        label={t('studies.activityTitle')}
        value={d.title}
        onChange={(e) => set('title', e.target.value)}
      />
      {body}
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">{t('studies.scoring')}</summary>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field
            label={t('studies.points')}
            type="number"
            min={0}
            max={1000}
            value={d.points}
            onChange={(e) => set('points', Number(e.target.value))}
          />
          <Field
            label={t('studies.maxAttempts')}
            type="number"
            min={1}
            max={100}
            placeholder="∞"
            value={d.maxAttempts}
            onChange={(e) => set('maxAttempts', e.target.value)}
          />
          <Field
            label={t('studies.wrongPenalty')}
            type="number"
            min={0}
            max={1000}
            value={d.wrongPenalty}
            onChange={(e) => set('wrongPenalty', Number(e.target.value))}
          />
          <Field
            label={t('studies.timeLimit')}
            type="number"
            min={5}
            max={7200}
            placeholder="—"
            value={d.timeLimitS}
            onChange={(e) => set('timeLimitS', e.target.value)}
          />
        </div>
      </details>
      {problem && (
        <p role="alert" className="text-sm text-danger">
          {t(problem)}
        </p>
      )}
      <ErrorText error={schemaError ?? error} />
      <div className="flex gap-2">
        <Button variant="cta" disabled={saving} onClick={submit}>
          {t('studies.saveActivity')}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}

function OptionalBoard({
  d,
  set,
  labels,
}: {
  d: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  labels: BoardEditorLabels;
}) {
  const { t } = useT();
  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={d.withBoard}
          onChange={(e) => set('withBoard', e.target.checked)}
        />
        {t('studies.withBoard')}
      </label>
      {d.withBoard && (
        <BoardEditor fen={d.fen} onChange={(fen) => set('fen', fen)} labels={labels} />
      )}
    </>
  );
}

function PuzzleFields({
  fen,
  moves,
  labels,
  academyId,
  onFen,
  onMoves,
}: {
  fen: string;
  moves: string[];
  labels: BoardEditorLabels;
  academyId: string;
  onFen: (fen: string) => void;
  onMoves: (moves: string[]) => void;
}) {
  const { t } = useT();
  const puzzles = usePuzzles(academyId);
  const [step, setStep] = useState<'position' | 'solution'>(moves.length ? 'solution' : 'position');

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t('studies.fromLibrary')}</span>
        <select
          value=""
          onChange={(e) => {
            const p = puzzles.data?.find((x) => x.id === e.target.value);
            if (!p) return;
            onFen(p.fen);
            onMoves(p.moves);
            setStep('solution');
          }}
          className="rounded-md border border-text-muted/30 bg-white px-2 py-1"
        >
          <option value="">—</option>
          {puzzles.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} ({p.rating})
            </option>
          ))}
        </select>
      </label>
      <div role="tablist" className="flex gap-1">
        {(['position', 'solution'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={step === s}
            disabled={s === 'solution' && !isValidFen(fen)}
            onClick={() => setStep(s)}
            className="rounded-full px-3 py-1 text-sm text-text-muted aria-selected:bg-primary aria-selected:text-text-on-primary disabled:opacity-40"
          >
            {s === 'position' ? t('studies.stepPosition') : t('studies.stepSolution')}
          </button>
        ))}
      </div>
      {step === 'position' ? (
        <>
          <BoardEditor fen={fen} onChange={onFen} labels={labels} />
          {!isValidFen(fen) && <p className="text-sm text-danger">{t('studies.errFen')}</p>}
        </>
      ) : (
        <SolutionRecorder fen={fen} moves={moves.filter((_, i) => i < 39)} onChange={onMoves} />
      )}
      {/* Thế cờ thay đổi thì lời giải cũ có thể không còn đúng luật */}
      {moves.length > 0 && !playMove(fen, moves[0] ?? '') && (
        <p className="text-sm text-danger">{t('studies.solutionInvalid')}</p>
      )}
    </div>
  );
}

function VideoFields({
  url,
  onUrl,
  academyId,
  studyId,
}: {
  url: string;
  onUrl: (url: string) => void;
  academyId: string;
  studyId: string;
}) {
  const { t } = useT();
  const client = useErpClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  return (
    <div className="flex flex-col gap-3">
      <Field
        label={t('studies.videoUrl')}
        hint={t('studies.videoHint')}
        value={url.startsWith('storage:') ? '' : url}
        onChange={(e) => onUrl(e.target.value)}
      />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t('studies.videoUpload')}</span>
        <input
          type="file"
          accept="video/mp4,video/webm"
          disabled={uploading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setError(null);
            setUploading(true);
            try {
              onUrl(await uploadStudyMedia(client, academyId, studyId, file, file.name));
            } catch (err) {
              setError(err);
            } finally {
              setUploading(false);
            }
          }}
        />
      </label>
      {uploading && <p className="text-sm">{t('common.loading')}</p>}
      {url.startsWith('storage:') && (
        <p className="text-sm text-green">{t('studies.videoUploaded')}</p>
      )}
      <ErrorText error={error} />
    </div>
  );
}
