import { describe, expect, it } from 'vitest';
import { UciEngine } from '../src/engine';
import { spawnTransport } from '../src/node';
import type { EngineInfo } from '../src/uci';
import { ReplayTransport } from './fixtures';

describe('UciEngine (phát lại log thật)', () => {
  it('init tắt sách khai cuộc và học, nạp danh sách option', async () => {
    const transport = new ReplayTransport('arasan-26.1-uci.log');
    const engine = new UciEngine(transport);
    await engine.init({ nnueFile: '/nnue/arasan.nnue', threads: 2 });
    expect(engine.name).toBe('Arasan 26.1');
    expect(engine.hasOption('UCI_Elo')).toBe(true);
    expect(transport.sent).toEqual([
      'uci',
      'setoption name OwnBook value false',
      'setoption name Position learning value false',
      'setoption name NNUE file value /nnue/arasan.nnue',
      'setoption name Threads value 2',
      'isready',
    ]);
  });

  it('analyse với MultiPV gửi đúng lệnh và trả bestmove', async () => {
    const transport = new ReplayTransport('arasan-26.1-analyse-multipv.log');
    const engine = new UciEngine(transport);
    await engine.init();
    const infos: EngineInfo[] = [];
    const best = await engine.analyse(
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
      { depth: 12, multiPv: 3 },
      (i) => infos.push(i),
    );
    expect(best).toEqual({ move: 'g1f3' });
    expect(transport.sent.slice(-4)).toEqual([
      'setoption name MultiPV value 3',
      'isready',
      'position fen rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
      'go depth 12',
    ]);
    expect(new Set(infos.map((i) => i.multipv))).toEqual(new Set([1, 2, 3]));
  });

  it('play giới hạn Elo trong khoảng engine hỗ trợ', async () => {
    const transport = new ReplayTransport('arasan-26.1-elo1200.log');
    const engine = new UciEngine(transport);
    await engine.init();
    const best = await engine.play('startpos', { elo: 600, movetimeMs: 1000 });
    expect(best.move).toBe('c2c4');
    expect(transport.sent).toContain('setoption name UCI_LimitStrength value true');
    expect(transport.sent).toContain('setoption name UCI_Elo value 1000');
    expect(transport.sent.slice(-2)).toEqual(['position startpos', 'go movetime 1000']);
  });

  it('báo lỗi khi engine im lặng', async () => {
    const engine = new UciEngine({ send() {}, onLine: () => () => {}, close() {} });
    await expect(engine.init({ timeoutMs: 50 })).rejects.toThrow(/không phản hồi/);
  });
});

// Chạy với engine thật: ARASAN_BIN=<đường dẫn arasanx> pnpm --filter @erpchess/engine test
const bin = process.env.ARASAN_BIN;
describe.runIf(bin)('UciEngine với Arasan native', () => {
  it('tìm ra chiếu hết một nước và dừng được tìm kiếm vô hạn', async () => {
    const engine = new UciEngine(spawnTransport(bin as string));
    await engine.init();
    const mate = await engine.analyse('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', { depth: 8 });
    expect(mate.move).toBe('d1d8');

    const infos: EngineInfo[] = [];
    const pending = engine.analyse('startpos', {}, (i) => infos.push(i));
    await new Promise((r) => setTimeout(r, 800));
    engine.stop();
    const best = await pending;
    expect(best.move).toMatch(/^[a-h][1-8][a-h][1-8]$/);
    expect(infos.length).toBeGreaterThan(0);

    const botMove = await engine.play('startpos', { elo: 1200, movetimeMs: 300 });
    expect(botMove.move).toMatch(/^[a-h][1-8][a-h][1-8]$/);
    engine.dispose();
  }, 60_000);
});
