import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UciEngine } from '../src/engine';
import type { EngineInfo } from '../src/uci';
import { type ArasanFactory, createWasmTransport } from '../src/wasm';

// Chạy khi đã build WASM: bash packages/engine/wasm/build.sh sse41 (trong WSL/CI có emsdk)
const variant = process.env.ARASAN_WASM_VARIANT ?? 'sse41';
const dist = new URL(`../wasm/dist/arasan-${variant}.mjs`, import.meta.url);
const networkDir = new URL('../../../vendor/arasan/network/', import.meta.url);
const built = existsSync(dist) && existsSync(networkDir);

describe.runIf(built)(`UciEngine với Arasan WASM (${variant})`, () => {
  it('tìm chiếu hết, dừng được go infinite, chơi bot giới hạn Elo', async () => {
    const { default: factory } = (await import(dist.href)) as { default: ArasanFactory };
    const networkName = readdirSync(networkDir).find((f) => f.endsWith('.nnue')) as string;
    const transport = await createWasmTransport({
      factory,
      network: readFileSync(new URL(networkName, networkDir)),
      networkName,
    });
    const engine = new UciEngine(transport);
    await engine.init();
    expect(engine.name).toBe('Arasan 26.1');

    const mate = await engine.analyse('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', { depth: 8 });
    expect(mate.move).toBe('d1d8');

    // stop phải đi qua checkInput (hàng đợi) trong lúc engine đang tìm kiếm
    const infos: EngineInfo[] = [];
    const pending = engine.analyse('startpos', { multiPv: 2 }, (i) => infos.push(i));
    await new Promise((r) => setTimeout(r, 1000));
    engine.stop();
    const best = await pending;
    expect(best.move).toMatch(/^[a-h][1-8][a-h][1-8]$/);
    expect(new Set(infos.map((i) => i.multipv))).toEqual(new Set([1, 2]));

    const botMove = await engine.play('startpos', { elo: 1200, movetimeMs: 300 });
    expect(botMove.move).toMatch(/^[a-h][1-8][a-h][1-8]$/);
    engine.dispose();
  }, 120_000);
});
