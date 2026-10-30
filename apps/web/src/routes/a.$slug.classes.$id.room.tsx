import type { RoomChat, RoomDrawings } from '@erpchess/api';
import { useClassroom, useClassroomRoom, useJoinClassroom, useMembers } from '@erpchess/api/react';
import { legalDests, sideToMove } from '@erpchess/chess-core';
import { isStaff } from '@erpchess/domain';
import type { Score } from '@erpchess/engine';
import { createFileRoute, Link } from '@tanstack/react-router';
import { type FormEvent, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { EngineLines } from '../components/analysis/EngineLines';
import { EvalBar } from '../components/analysis/EvalBar';
import { PreferredBoard } from '../components/board/PreferredBoard';
import { ClassroomRoster } from '../components/classroom/ClassroomRoster';
import { ClassroomToolbar } from '../components/classroom/ClassroomToolbar';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { useT } from '../lib/use-t';

// Thư viện LiveKit chỉ nạp khi người dùng bật video
const VideoPanel = lazy(() => import('../components/classroom/VideoPanel'));

export type ClassroomLayout = 'board' | 'split' | 'gallery';

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
  const [video, setVideo] = useState(false);
  const [layoutMode, setLayoutMode] = useState<ClassroomLayout>('board');
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());

  const [bestScore, setBestScore] = useState<Score | null>(null);
  const [prevFen, setPrevFen] = useState(snapshot?.fen);

  if (snapshot?.fen !== prevFen) {
    setPrevFen(snapshot?.fen);
    setBestScore(null);
  }

  const onScore = useCallback((score: Score | null) => {
    setBestScore(score);
  }, []);

  // Theo dõi tin nhắn chat để cập nhật danh sách học viên giơ tay phát biểu
  useEffect(() => {
    const hands = new Set<string>();
    for (const m of chat) {
      if (m.text.includes('[✋ Giơ tay phát biểu]')) {
        hands.add(m.userId);
      } else if (m.text.includes('[👇 Hạ tay phát biểu]')) {
        hands.delete(m.userId);
      } else if (m.text.includes('[👇 HẠ TAY CẢ LỚP]')) {
        hands.clear();
      }
    }
    setRaisedHands(hands);
  }, [chat]);

  function handleToggleRaiseHand() {
    if (!room) return;
    if (raisedHands.has(me)) {
      void room.chat('[👇 Hạ tay phát biểu]');
    } else {
      void room.chat('[✋ Giơ tay phát biểu]');
    }
  }

  function handleLowerAllHands() {
    if (!room) return;
    void room.chat('[👇 HẠ TAY CẢ LỚP]');
  }

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

  function handleShareFen() {
    if (!room || !snapshot) return;
    void room.chat(`[Thế cờ FEN] ${snapshot.fen}`);
  }

  const videoLayoutParam =
    layoutMode === 'gallery' ? 'grid' : layoutMode === 'split' ? 'theater' : 'sidebar';

  return (
    <div className="flex flex-col gap-4">
      {/* Thanh tiêu đề phòng học & trạng thái */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-3">
          <Link
            to="/a/$slug/classes/$id"
            params={{ slug: academy.slug, id }}
            className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            ← {c.title}
          </Link>
          <span
            role="status"
            className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
              status === 'live' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {status === 'live' ? `● ${t('classroom.live')}` : `○ ${t('classroom.connecting')}`}
          </span>
        </div>

        {/* Bộ chọn Chế độ Bố cục (Layout Selector) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setLayoutMode('board')}
              className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                layoutMode === 'board'
                  ? 'bg-white text-gray-900 shadow-xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Chế độ Bàn cờ tập trung"
            >
              ♟ Bàn cờ
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('split')}
              className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                layoutMode === 'split'
                  ? 'bg-white text-gray-900 shadow-xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Chế độ Chia đôi màn hình"
            >
              ⚏ Chia đôi
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('gallery')}
              className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                layoutMode === 'gallery'
                  ? 'bg-white text-gray-900 shadow-xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Chế độ Hội nghị Video lớn"
            >
              👥 Hội nghị
            </button>
          </div>

          {/* Thông báo quyền đi cờ */}
          {iControl && (
            <div
              role="status"
              className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-xs animate-pulse"
            >
              <span>♟️</span>
              <span>{t('classroom.yourTurn')}</span>
            </div>
          )}
        </div>
      </div>

      {(status === 'error' || !!error) && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-danger">
          {t('classroom.roomError')}
        </p>
      )}

      {/* Chế độ Gallery: Video Grid lớn nằm ở hàng trên */}
      {layoutMode === 'gallery' && (
        <Card title={t('classroom.video')}>
          {video ? (
            <Suspense fallback={<Spinner />}>
              <VideoPanel classroomId={c.id} layout={videoLayoutParam} />
            </Suspense>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center gap-3">
              <span className="text-4xl">📹</span>
              <p className="text-sm font-medium text-gray-900">Chế độ Hội nghị đang được chọn</p>
              <p className="text-xs text-text-muted max-w-md">
                Bật Video & Micro để tham gia giao lưu trực quan toàn màn hình với thầy và các bạn
                trong lớp.
              </p>
              <Button variant="cta" onClick={() => setVideo(true)}>
                {t('classroom.videoJoin')}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Bố cục Grid dựa trên layoutMode */}
      <div
        className={`grid gap-6 ${
          layoutMode === 'split'
            ? 'lg:grid-cols-[1.1fr_0.9fr]'
            : layoutMode === 'gallery'
              ? 'lg:grid-cols-[1fr_340px]'
              : 'lg:grid-cols-[minmax(0,1fr)_340px]'
        }`}
      >
        {/* Vùng Bàn cờ Giảng dạy */}
        <div className="flex flex-col gap-3">
          <div className="mx-auto flex w-full max-w-[680px] items-stretch justify-center gap-2">
            {/* Thanh đánh giá EvalBar đứng cạnh bàn cờ */}
            {snapshot.engine && (
              <div className="flex w-6 py-1 shrink-0">
                <EvalBar score={bestScore} orientation={orientation} label="Đánh giá thế trận" />
              </div>
            )}

            <div className="w-full max-w-[640px]">
              <PreferredBoard
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
          </div>

          {/* Thanh công cụ giảng dạy */}
          <ClassroomToolbar
            room={room}
            snapshot={snapshot}
            runner={runner}
            flipped={flipped}
            onToggleFlip={() => setFlipped((f) => !f)}
          />

          {runner && (
            <p className="text-xs text-text-muted text-center">
              💡 {t('classroom.drawHint')} (Chuột phải kéo = mũi tên xanh, bấm chuột phải = tô ô,
              Shift = đỏ, Alt = xanh dương, Ctrl = vàng).
            </p>
          )}

          {/* Phân tích Engine Arasan */}
          {snapshot.engine && (
            <Card title="Phân tích Động cơ Arasan NNUE">
              <EngineLines
                fen={snapshot.fen}
                onPlay={(uci) => runner && room?.move(uci)}
                onScore={onScore}
              />
            </Card>
          )}
        </div>

        {/* Cột Tương tác (Video nếu không phải chế độ gallery, Thành viên, Chat) */}
        <div className="flex flex-col gap-4">
          {/* Khung Video LiveKit trong sidebar (chỉ hiển thị khi không ở chế độ Gallery) */}
          {layoutMode !== 'gallery' && (
            <Card title={t('classroom.video')}>
              {video ? (
                <Suspense fallback={<Spinner />}>
                  <VideoPanel classroomId={c.id} layout={videoLayoutParam} />
                </Suspense>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-text-muted">
                    Bật Video & Micro để tương tác trực tuyến qua LiveKit WebRTC cùng lớp học.
                  </p>
                  <Button variant="cta" className="self-start" onClick={() => setVideo(true)}>
                    {t('classroom.videoJoin')}
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* Danh sách Thành viên, Giơ tay & Trao quyền đi cờ */}
          <ClassroomRoster
            peers={peers}
            snapshot={snapshot}
            runner={runner}
            room={room}
            currentUserId={me}
            raisedHands={raisedHands}
            onToggleRaiseHand={handleToggleRaiseHand}
            onLowerAllHands={handleLowerAllHands}
          />

          {/* Hộp Chat trong lớp */}
          <ChatBox
            chat={chat}
            onSend={(text) => void room?.chat(text)}
            onShareFen={handleShareFen}
            me={me}
          />
        </div>
      </div>
    </div>
  );
}

function ChatBox({
  chat,
  onSend,
  onShareFen,
  me,
}: {
  chat: RoomChat[];
  onSend: (text: string) => void;
  onShareFen?: () => void;
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
      <div className="flex flex-col gap-2">
        {onShareFen && (
          <div className="flex justify-end -mt-1 pb-1 border-b border-gray-100">
            <button
              type="button"
              onClick={onShareFen}
              className="text-xs text-primary hover:underline font-medium"
              title="Gửi FEN thế cờ hiện tại vào khung chat"
            >
              Chia sẻ FEN ♟
            </button>
          </div>
        )}
        <ul
          ref={listRef}
          className="flex max-h-72 flex-col gap-2 overflow-y-auto text-sm pr-1"
          aria-live="polite"
        >
          {chat.length === 0 && (
            <li className="text-xs text-text-muted py-4 text-center">{t('classroom.noChat')}</li>
          )}
          {chat.map((m) => {
            const isMyMsg = m.userId === me;
            const isFenMsg = m.text.startsWith('[Thế cờ FEN]');
            const isHandMsg = m.text.includes('[✋ Giơ tay') || m.text.includes('[👇');

            return (
              <li key={m.id} className={`flex flex-col ${isMyMsg ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-text-muted mb-0.5">
                  {m.name} ·{' '}
                  {new Date(m.at).toLocaleTimeString(i18n.language, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <div
                  className={`max-w-[90%] rounded-lg px-3 py-1.5 text-xs leading-relaxed ${
                    isMyMsg
                      ? 'bg-primary text-white rounded-br-none'
                      : 'bg-gray-100 text-gray-900 rounded-bl-none'
                  } ${
                    isFenMsg
                      ? 'font-mono text-[11px] break-all border border-amber-300 bg-amber-50 text-amber-900'
                      : isHandMsg
                        ? 'font-semibold italic bg-amber-50 text-amber-900 border border-amber-200'
                        : 'break-words'
                  }`}
                >
                  {m.text}
                </div>
              </li>
            );
          })}
        </ul>

        <form onSubmit={onSubmit} className="flex gap-2 pt-2 border-t border-gray-100 mt-2">
          <input
            aria-label={t('classroom.chatPlaceholder')}
            placeholder={t('classroom.chatPlaceholder')}
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-hidden"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!text.trim()}
            className="text-xs px-3 py-1.5"
          >
            {t('classroom.send')}
          </Button>
        </form>
      </div>
    </Card>
  );
}
