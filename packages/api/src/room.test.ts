import { START_FEN } from '@erpchess/chess-core';
import { describe, expect, it } from 'vitest';
import { applyRoomMove, emptySnapshot, replayAt, snapshotFromState } from './room';

describe('applyRoomMove', () => {
  it('đi nước hợp lệ, tăng ply, xoá mũi tên', () => {
    const start = {
      ...emptySnapshot(),
      drawings: { arrows: [{ from: 'e2', to: 'e4', brush: 'green' as const }], highlights: [] },
    };
    const next = applyRoomMove(start, 'e2e4');
    expect(next).toMatchObject({ ply: 1, lastMove: ['e2', 'e4'], drawings: { arrows: [] } });
    expect(next?.fen).toContain(' b ');
    expect(applyRoomMove(start, 'e2e5')).toBeNull();
  });
});

describe('snapshotFromState', () => {
  it('chịu được state rỗng hoặc sai kiểu', () => {
    expect(snapshotFromState({})).toEqual(emptySnapshot());
    expect(snapshotFromState(null)).toEqual(emptySnapshot());
    expect(snapshotFromState({ fen: 'x', ply: 3, controller: 'u1', engine: true })).toMatchObject({
      fen: 'x',
      ply: 3,
      controller: 'u1',
      engine: true,
    });
  });
});

describe('replayAt', () => {
  const after = applyRoomMove(emptySnapshot(), 'e2e4');
  const events = [
    { kind: 'move', payload: { uci: 'e2e4', fen: after?.fen }, at: '', actor_id: null },
    {
      kind: 'draw',
      payload: { arrows: [{ from: 'd7', to: 'd5', brush: 'green' }], highlights: [] },
      at: '',
      actor_id: null,
    },
    {
      kind: 'chat',
      payload: { id: '1', userId: 'u', name: 'HV', text: 'Chào', at: '' },
      at: '',
      actor_id: 'u',
    },
    { kind: 'fen', payload: { fen: '8/8/8/8/8/8/8/K6k w - - 0 1' }, at: '', actor_id: null },
  ];
  it('đi lại từng bước', () => {
    expect(replayAt(events, 0)).toMatchObject({ fen: START_FEN, lastMove: null, chats: [] });
    expect(replayAt(events, 2)).toMatchObject({
      fen: after?.fen,
      lastMove: ['e2', 'e4'],
      drawings: { arrows: [{ from: 'd7', to: 'd5' }] },
    });
    const end = replayAt(events, 4);
    expect(end).toMatchObject({
      fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
      lastMove: null,
      drawings: { arrows: [] },
    });
    expect(end.chats.map((c) => c.text)).toEqual(['Chào']);
  });
});
