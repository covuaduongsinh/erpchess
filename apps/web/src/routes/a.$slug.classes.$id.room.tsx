import type { ClassroomRoom, RoomChat, RoomDrawings, RoomPeer, RoomSnapshot } from '@erpchess/api';
import { useClassroom, useClassroomRoom, useJoinClassroom, useMembers } from '@erpchess/api/react';
import { Board } from '@erpchess/board-web';
import { isValidFen, legalDests, START_FEN, sideToMove } from '@erpchess/chess-core';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { EngineLines } from '../components/analysis/EngineLines';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

export const Route = createFileRoute('/a/$slug/classes/$id/room')({
  component: RoomPage,
});

function RoomPage() {
  const { t } = useT();
  const { id } = Route.useParams();
  const { academy, session } = useAcademy();
  const classroom = useClassroom(id);
  const members = useMembers(academy.id);
  const me = session.user.id;
  const myName = members.data?.find((m) => m.profile.id === me)?.profile.display_name;
  const c = classroom.data;
  const runner =
    !!c &&
    (academy.role === 'owner' ||
      (academy.role === 'coach' && (c.coach_id === me || c.created_by === me)));
  const { room, snapshot, chat, peers, status, error } = useClassroomRoom(
    c,
    myName ? { userId: me, name: myName } : undefined,
    runner,
  );
  const join = useJoinClassroom(id);
  const joined = useRef(false);
  const [flipped, setFlipped] = useState(false);
  const onScore = useCallback(() => undefined, []);

  // Học viên vào phòng thì tự ghi điểm danh (một lần)
  useEffect(() => {
    if (status === 'live' && !isStaff(academy.role) && !joined.current) {
      joined.current = true;
      join.mutate();
    }
  }, [status, academy.role, join]);

  if (classroom.isPending || members.isPending) return <Spinner />;
  if (classroom.error) return <ErrorText error={classroom.error} />;
  if (!c || !snapshot) return <Spinner />;

  const iControl = !runner && snapshot.controller === me;
  const movable = runner
    ? { color: 'both' as const, dests: legalDests(snapshot.fen) }
    : iControl
      ? { color: sideToMove(snapshot.fen), dests: legalDests(snapshot.fen) }
      : undefined;
  const orientation = (snapshot.fen.split(' ')[1] === 'b') !== flipped ? 'b' : 'w';

  function onMove(from: string, to: string, promotion?: string) {
    const uci = `${from}${to}${promotion ?? ''}`;
    if (runner) room?.move(uci);
    else if (iControl) void room?.requestMove(uci);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/a/$slug/classes/$id"
          params={{ slug: academy.slug, id }}
          className="text-sm text-primary hover:underline"
        >
          ← {c.title}
        </Link>
        <span
          role="status"
          className={`rounded-full px-3 py-1 text-xs ${status === 'live' ? 'bg-green/15 text-green' : 'bg-text-muted/15 text-text-muted'}`}
        >
          {status === 'live' ? t('classroom.live') : t('classroom.connecting')}
        </span>
      </div>
      {(status === 'error' || !!error) && (
        <p role="alert" className="text-sm text-danger">
          {t('classroom.roomError')}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-3">
          <div className="mx-auto w-full max-w-[640px]">
            <Board
              fen={snapshot.fen}
              orientation={orientation}
              lastMove={snapshot.lastMove ?? undefined}
              movable={movable}
              onMove={onMove}
              drawings={snapshot.drawings}
              onDrawingsChange={runner ? (d) => room?.setDrawings(d as RoomDrawings) : undefined}
              label={c.title}
            />
          </div>
          {iControl && (
            <p role="status" className="text-sm font-medium text-green">
              {t('classroom.yourTurn')}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="text-sm" onClick={() => setFlipped((f) => !f)}>
              {t('classroom.flip')}
            </Button>
            {runner && room && <CoachTools room={room} snapshot={snapshot} peers={peers} me={me} />}
          </div>
          {runner && <p className="text-xs text-text-muted">{t('classroom.drawHint')}</p>}
          {snapshot.engine && (
            <Card>
              <EngineLines
                fen={snapshot.fen}
                onPlay={(uci) => runner && room?.move(uci)}
                onScore={onScore}
              />
            </Card>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <Card title={t('classroom.people', { count: peers.length })}>
            <ul className="flex flex-col gap-1 text-sm">
              {peers.map((p) => (
                <li key={p.userId} className="flex items-center justify-between gap-2">
                  <span>{p.name}</span>
                  {p.runner && (
                    <span className="text-xs text-primary">{t('classroom.coachBadge')}</span>
                  )}
                  {snapshot.controller === p.userId && <span aria-hidden>♟</span>}
                </li>
              ))}
            </ul>
          </Card>
          <ChatBox chat={chat} onSend={(text) => void room?.chat(text)} me={me} />
        </div>
      </div>
    </div>
  );
}

function CoachTools({
  room,
  snapshot,
  peers,
  me,
}: {
  room: ClassroomRoom;
  snapshot: RoomSnapshot;
  peers: RoomPeer[];
  me: string;
}) {
  const { t } = useT();
  const [fen, setFen] = useState('');
  const students = peers.filter((p) => !p.runner && p.userId !== me);
  const select = 'rounded-md border border-text-muted/30 bg-white px-2 py-1 text-sm';
  function onFen(e: FormEvent) {
    e.preventDefault();
    if (!isValidFen(fen.trim())) return;
    room.setFen(fen.trim());
    setFen('');
  }
  return (
    <>
      <Button variant="ghost" className="text-sm" onClick={() => room.undo()}>
        {t('classroom.undo')}
      </Button>
      <Button variant="ghost" className="text-sm" onClick={() => room.setFen(START_FEN)}>
        {t('classroom.reset')}
      </Button>
      <Button
        variant="ghost"
        className="text-sm"
        aria-pressed={snapshot.engine}
        onClick={() => room.setEngine(!snapshot.engine)}
      >
        {snapshot.engine ? t('classroom.engineOff') : t('classroom.engineOn')}
      </Button>
      <label className="flex items-center gap-2 text-sm">
        {t('classroom.control')}
        <select
          value={snapshot.controller ?? ''}
          onChange={(e) => room.setController(e.target.value || null)}
          className={select}
        >
          <option value="">{t('classroom.controlCoach')}</option>
          {students.map((p) => (
            <option key={p.userId} value={p.userId}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <form onSubmit={onFen} className="flex w-full flex-wrap items-center gap-2">
        <input
          aria-label={t('classroom.fen')}
          placeholder={t('classroom.fen')}
          value={fen}
          onChange={(e) => setFen(e.target.value)}
          className={`${select} min-w-0 flex-1 font-mono`}
        />
        <Button type="submit" variant="ghost" className="text-sm" disabled={!fen.trim()}>
          {t('classroom.applyFen')}
        </Button>
        {fen.trim() && !isValidFen(fen.trim()) && (
          <span className="text-xs text-danger">{t('classroom.badFen')}</span>
        )}
      </form>
    </>
  );
}

function ChatBox({
  chat,
  onSend,
  me,
}: {
  chat: RoomChat[];
  onSend: (text: string) => void;
  me: string;
}) {
  const { t, i18n } = useT();
  const [text, setText] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const count = chat.length;
  useEffect(() => {
    // Có tin mới thì cuộn xuống cuối
    if (count) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [count]);
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  }
  return (
    <Card title={t('classroom.chat')}>
      <ul
        ref={listRef}
        className="flex max-h-80 flex-col gap-2 overflow-y-auto text-sm"
        aria-live="polite"
      >
        {chat.length === 0 && <li className="text-text-muted">{t('classroom.noChat')}</li>}
        {chat.map((m) => (
          <li key={m.id} className={m.userId === me ? 'text-right' : ''}>
            <span className="text-xs text-text-muted">
              {m.name} ·{' '}
              {new Date(m.at).toLocaleTimeString(i18n.language, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <p className="whitespace-pre-wrap break-words">{m.text}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          aria-label={t('classroom.chatPlaceholder')}
          placeholder={t('classroom.chatPlaceholder')}
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-text-muted/30 bg-white px-3 py-2"
        />
        <Button type="submit" variant="primary" disabled={!text.trim()}>
          {t('classroom.send')}
        </Button>
      </form>
    </Card>
  );
}
