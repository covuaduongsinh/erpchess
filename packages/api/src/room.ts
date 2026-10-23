/**
 * Phòng học trực tuyến (Giai đoạn 8b) qua Supabase Realtime, HLV là nguồn sự thật:
 *   classroom:<id>        chat, xin đi quân, xin đồng bộ, presence — ai xem được lớp đều gửi được
 *   classroom:<id>:board  ảnh chụp bàn cờ (FEN, mũi tên, người được đi quân, engine) — chỉ HLV gửi
 * HLV kiểm nước đi bằng chess-core rồi phát lại ảnh chụp; ghi `classrooms.state` và
 * `classroom_events` để người vào muộn đồng bộ và để xem lại.
 */
import { playMove, START_FEN } from '@erpchess/chess-core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { addClassroomEvent } from './classrooms';
import type { ErpClient } from './client';
import type { Json } from './database.types';

export type RoomBrush = 'green' | 'red' | 'blue' | 'yellow';
export type RoomDrawings = {
  arrows: { from: string; to: string; brush: RoomBrush }[];
  highlights: { square: string; brush: RoomBrush }[];
};
export type RoomSnapshot = {
  fen: string;
  lastMove: [string, string] | null;
  ply: number;
  drawings: RoomDrawings;
  /** Học viên được trao quyền đi quân (null: chỉ HLV đi). */
  controller: string | null;
  engine: boolean;
};
export type RoomChat = { id: string; userId: string; name: string; text: string; at: string };
export type RoomPeer = { userId: string; name: string; runner: boolean };
export type RoomStatus = 'connecting' | 'live' | 'error' | 'closed';

/** Hermes (React Native) có thể chưa có crypto.randomUUID; id tin chat chỉ cần duy nhất. */
function newId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

const EMPTY_DRAWINGS: RoomDrawings = { arrows: [], highlights: [] };

export function emptySnapshot(fen = START_FEN): RoomSnapshot {
  return { fen, lastMove: null, ply: 0, drawings: EMPTY_DRAWINGS, controller: null, engine: false };
}

/** Đọc `classrooms.state` (có thể rỗng hoặc thiếu trường). */
export function snapshotFromState(state: Json | null | undefined): RoomSnapshot {
  const s = (state && typeof state === 'object' && !Array.isArray(state) ? state : {}) as Partial<
    Record<keyof RoomSnapshot, unknown>
  >;
  const base = emptySnapshot(typeof s.fen === 'string' ? s.fen : START_FEN);
  return {
    ...base,
    lastMove:
      Array.isArray(s.lastMove) && s.lastMove.length === 2
        ? [String(s.lastMove[0]), String(s.lastMove[1])]
        : null,
    ply: typeof s.ply === 'number' ? s.ply : 0,
    drawings: (s.drawings as RoomDrawings | undefined) ?? EMPTY_DRAWINGS,
    controller: typeof s.controller === 'string' ? s.controller : null,
    engine: s.engine === true,
  };
}

/** Đi một nước UCI trên ảnh chụp; `null` nếu không hợp lệ. Xoá mũi tên cũ sau mỗi nước. */
export function applyRoomMove(snap: RoomSnapshot, uci: string): RoomSnapshot | null {
  const played = playMove(snap.fen, uci);
  if (!played) return null;
  return {
    ...snap,
    fen: played.fen,
    lastMove: [uci.slice(0, 2), uci.slice(2, 4)],
    ply: snap.ply + 1,
    drawings: EMPTY_DRAWINGS,
  };
}

type Handlers = {
  onSnapshot?: (s: RoomSnapshot) => void;
  onChat?: (m: RoomChat) => void;
  onPeers?: (p: RoomPeer[]) => void;
  onStatus?: (s: RoomStatus) => void;
};

export class ClassroomRoom {
  private talk: RealtimeChannel | null = null;
  private board: RealtimeChannel | null = null;
  private snap: RoomSnapshot;
  private history: RoomSnapshot[] = [];
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly client: ErpClient,
    private readonly classroomId: string,
    private readonly me: { userId: string; name: string },
    /** HLV phụ trách / owner: được điều khiển bàn cờ. */
    readonly runner: boolean,
    initial: RoomSnapshot,
    private readonly handlers: Handlers = {},
  ) {
    this.snap = initial;
  }

  get snapshot(): RoomSnapshot {
    return this.snap;
  }

  connect(): Promise<void> {
    this.handlers.onStatus?.('connecting');
    const id = this.classroomId;
    const board = this.client.channel(`classroom:${id}:board`, { config: { private: true } });
    board.on('broadcast', { event: 'snapshot' }, ({ payload }) => {
      if (this.runner) return;
      this.snap = payload as RoomSnapshot;
      this.handlers.onSnapshot?.(this.snap);
    });
    const talk = this.client.channel(`classroom:${id}`, {
      config: { private: true, presence: { key: this.me.userId } },
    });
    talk
      .on('broadcast', { event: 'chat' }, ({ payload }) =>
        this.handlers.onChat?.(payload as RoomChat),
      )
      .on('broadcast', { event: 'move_request' }, ({ payload }) => {
        const p = payload as { userId: string; uci: string; ply: number };
        if (this.runner && p.userId === this.snap.controller && p.ply === this.snap.ply) {
          this.move(p.uci);
        }
      })
      .on('broadcast', { event: 'sync_request' }, () => {
        if (this.runner) void this.publish();
      })
      .on('presence', { event: 'sync' }, () => {
        const state = talk.presenceState<RoomPeer>();
        const peers = Object.values(state).flatMap((list) => list.slice(0, 1));
        this.handlers.onPeers?.(
          peers.map(({ userId, name, runner }) => ({ userId, name, runner })),
        );
      });
    this.board = board;
    this.talk = talk;

    const joined = (ch: RealtimeChannel) =>
      new Promise<void>((resolve, reject) => {
        ch.subscribe((status, err) => {
          if (status === 'SUBSCRIBED') resolve();
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            this.handlers.onStatus?.('error');
            reject(err ?? new Error(status));
          }
        });
      });
    return Promise.all([joined(board), joined(talk)]).then(async () => {
      await talk.track({ userId: this.me.userId, name: this.me.name, runner: this.runner });
      this.handlers.onStatus?.('live');
      if (this.runner) await this.publish();
      else await this.send('sync_request', {});
    });
  }

  async disconnect() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      await this.persist();
    }
    if (this.talk) await this.client.removeChannel(this.talk);
    if (this.board) await this.client.removeChannel(this.board);
    this.talk = this.board = null;
    this.handlers.onStatus?.('closed');
  }

  // ── Học viên ──

  /** Học viên được trao quyền gửi nước đi cho HLV kiểm. */
  requestMove(uci: string) {
    return this.send('move_request', { userId: this.me.userId, uci, ply: this.snap.ply });
  }

  async chat(text: string) {
    const body = text.trim().slice(0, 500);
    if (!body) return;
    const msg: RoomChat = {
      id: newId(),
      userId: this.me.userId,
      name: this.me.name,
      text: body,
      at: new Date().toISOString(),
    };
    this.handlers.onChat?.(msg);
    await this.send('chat', msg);
    await addClassroomEvent(this.client, this.me.userId, this.classroomId, 'chat', msg);
  }

  // ── HLV ──

  move(uci: string): boolean {
    const next = applyRoomMove(this.snap, uci);
    if (!next) return false;
    this.update(next, 'move', { uci, fen: next.fen });
    return true;
  }

  setFen(fen: string) {
    this.update(
      { ...emptySnapshot(fen), controller: this.snap.controller, engine: this.snap.engine },
      'fen',
      {
        fen,
      },
    );
  }

  undo() {
    const prev = this.history.pop();
    if (!prev) return;
    this.snap = prev;
    this.handlers.onSnapshot?.(prev);
    void this.publish();
    void this.log('fen', { fen: prev.fen, undo: true });
    this.schedulePersist();
  }

  setDrawings(drawings: RoomDrawings) {
    this.update({ ...this.snap, drawings }, 'draw', drawings, false);
  }

  setController(controller: string | null) {
    this.update({ ...this.snap, controller }, 'control', { controller }, false);
  }

  setEngine(engine: boolean) {
    this.update({ ...this.snap, engine }, null, {}, false);
  }

  private update(
    next: RoomSnapshot,
    kind: 'move' | 'fen' | 'draw' | 'control' | null,
    payload: Record<string, unknown>,
    keepHistory = true,
  ) {
    if (!this.runner) return;
    if (keepHistory) this.history.push(this.snap);
    this.snap = next;
    this.handlers.onSnapshot?.(next);
    void this.publish();
    if (kind) void this.log(kind, payload);
    this.schedulePersist();
  }

  private publish() {
    return this.board?.send({ type: 'broadcast', event: 'snapshot', payload: this.snap });
  }

  private send(event: string, payload: Record<string, unknown>) {
    return this.talk?.send({ type: 'broadcast', event, payload });
  }

  private log(kind: 'move' | 'fen' | 'draw' | 'control', payload: Record<string, unknown>) {
    return addClassroomEvent(this.client, this.me.userId, this.classroomId, kind, payload).catch(
      () => undefined,
    );
  }

  private schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => void this.persist(), 1500);
  }

  private async persist() {
    this.persistTimer = null;
    await this.client
      .from('classrooms')
      .update({ state: this.snap as unknown as Json })
      .eq('id', this.classroomId);
  }
}

export type ReplayEvent = { kind: string; payload: unknown; at: string; actor_id: string | null };
export type ReplayFrame = {
  fen: string;
  lastMove: [string, string] | null;
  drawings: RoomDrawings;
  chats: RoomChat[];
};

/**
 * Trạng thái tại bước `step` (0 = trước sự kiện đầu tiên) khi đi lại `classroom_events` theo thứ
 * tự: nước đi và đặt thế đổi bàn cờ (xoá mũi tên), vẽ thay mũi tên, chat cộng dồn.
 */
export function replayAt(events: readonly ReplayEvent[], step: number): ReplayFrame {
  const frame: ReplayFrame = {
    fen: START_FEN,
    lastMove: null,
    drawings: EMPTY_DRAWINGS,
    chats: [],
  };
  for (const e of events.slice(0, step)) {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    if (e.kind === 'move' && typeof p.fen === 'string' && typeof p.uci === 'string') {
      frame.fen = p.fen;
      frame.lastMove = [p.uci.slice(0, 2), p.uci.slice(2, 4)];
      frame.drawings = EMPTY_DRAWINGS;
    } else if (e.kind === 'fen' && typeof p.fen === 'string') {
      frame.fen = p.fen;
      frame.lastMove = null;
      frame.drawings = EMPTY_DRAWINGS;
    } else if (e.kind === 'draw') {
      frame.drawings = {
        arrows: Array.isArray(p.arrows) ? (p.arrows as RoomDrawings['arrows']) : [],
        highlights: Array.isArray(p.highlights) ? (p.highlights as RoomDrawings['highlights']) : [],
      };
    } else if (e.kind === 'chat' && typeof p.text === 'string') {
      frame.chats = [...frame.chats, p as unknown as RoomChat];
    }
  }
  return frame;
}
