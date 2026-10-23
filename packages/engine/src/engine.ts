/**
 * Điều khiển một engine UCI qua một kênh văn bản trừu tượng (stdin/stdout của sidecar,
 * Web Worker chạy WASM, hay module native). Mọi nền tảng dùng chung lớp này; mỗi nền tảng
 * chỉ cần cung cấp `UciTransport`.
 */
import {
  type BestMove,
  type EngineInfo,
  parseBestMove,
  parseInfo,
  parseOption,
  type UciOption,
} from './uci';

export interface UciTransport {
  send(command: string): void;
  /** Đăng ký nhận từng dòng engine in ra; trả về hàm huỷ đăng ký. */
  onLine(listener: (line: string) => void): () => void;
  close(): void;
}

export type InitOptions = {
  threads?: number;
  hashMb?: number;
  /** Đường dẫn file NNUE trong FS của engine (WASM: FS ảo; desktop/mobile: file thật). */
  nnueFile?: string;
  timeoutMs?: number;
};

export type SearchLimits = {
  depth?: number;
  movetimeMs?: number;
  nodes?: number;
  multiPv?: number;
};

export type PlayOptions = {
  /** Giới hạn sức mạnh theo Elo (Arasan: 1000–3450). Bỏ trống = sức mạnh tối đa. */
  elo?: number;
  movetimeMs?: number;
};

export class EngineError extends Error {
  override name = 'EngineError';
}

type Pending = { resolve: (line: string) => void; reject: (e: Error) => void; match: RegExp };

export class UciEngine {
  private readonly waiters: Pending[] = [];
  private readonly unsubscribe: () => void;
  private infoListener: ((info: EngineInfo) => void) | null = null;
  private searching: Promise<BestMove> | null = null;
  private currentMultiPv = 1;
  private currentElo: number | null = null;
  options: UciOption[] = [];
  name = '';

  constructor(private readonly transport: UciTransport) {
    this.unsubscribe = transport.onLine((line) => this.handleLine(line));
  }

  private handleLine(line: string) {
    if (line.startsWith('id name ')) this.name = line.slice('id name '.length);
    const option = parseOption(line);
    if (option) this.options.push(option);
    if (this.infoListener) {
      const info = parseInfo(line);
      if (info) this.infoListener(info);
    }
    for (const w of [...this.waiters]) {
      if (w.match.test(line)) {
        this.waiters.splice(this.waiters.indexOf(w), 1);
        w.resolve(line);
      }
    }
  }

  private waitFor(match: RegExp, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const waiter: Pending = {
        match,
        resolve: (line) => {
          clearTimeout(timer);
          resolve(line);
        },
        reject,
      };
      const timer = setTimeout(() => {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        reject(new EngineError(`Engine không phản hồi (${match.source}) sau ${timeoutMs} ms`));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  private setOption(name: string, value: string | number | boolean) {
    this.transport.send(`setoption name ${name} value ${value}`);
  }

  async init({ threads, hashMb, nnueFile, timeoutMs = 30_000 }: InitOptions = {}): Promise<void> {
    const uciok = this.waitFor(/^uciok/, timeoutMs);
    this.transport.send('uci');
    await uciok;
    // App tự quản sách khai cuộc và dữ liệu học; tắt các tính năng ghi/đọc file của engine
    if (this.hasOption('OwnBook')) this.setOption('OwnBook', false);
    if (this.hasOption('Position learning')) this.setOption('Position learning', false);
    if (nnueFile) this.setOption('NNUE file', nnueFile);
    if (threads) this.setOption('Threads', threads);
    if (hashMb) this.setOption('Hash', hashMb);
    await this.isReady(timeoutMs);
  }

  hasOption(name: string): boolean {
    return this.options.some((o) => o.name.toLowerCase() === name.toLowerCase());
  }

  async isReady(timeoutMs = 30_000): Promise<void> {
    const ready = this.waitFor(/^readyok/, timeoutMs);
    this.transport.send('isready');
    await ready;
  }

  /**
   * Phân tích một thế cờ. `onInfo` nhận từng dòng phương án (theo góc nhìn bên đi).
   * Gọi `stop()` để dừng sớm; promise vẫn trả về nước tốt nhất tìm được.
   */
  async analyse(
    fen: string,
    limits: SearchLimits,
    onInfo?: (info: EngineInfo) => void,
  ): Promise<BestMove> {
    await this.prepareSearch({ multiPv: limits.multiPv ?? 1, elo: null });
    return this.search(fen, limits, onInfo);
  }

  /** Engine chọn nước để đánh với người, có thể giới hạn Elo. */
  async play(fen: string, { elo, movetimeMs = 1000 }: PlayOptions = {}): Promise<BestMove> {
    await this.prepareSearch({ multiPv: 1, elo: elo ?? null });
    return this.search(fen, { movetimeMs });
  }

  stop(): void {
    if (this.searching) this.transport.send('stop');
  }

  dispose(): void {
    for (const w of this.waiters.splice(0)) w.reject(new EngineError('Engine đã đóng'));
    this.unsubscribe();
    this.transport.send('quit');
    this.transport.close();
  }

  private async prepareSearch({ multiPv, elo }: { multiPv: number; elo: number | null }) {
    if (this.searching) {
      this.stop();
      await this.searching.catch(() => undefined);
    }
    let changed = false;
    if (multiPv !== this.currentMultiPv) {
      this.setOption('MultiPV', multiPv);
      this.currentMultiPv = multiPv;
      changed = true;
    }
    if (elo !== this.currentElo) {
      this.setOption('UCI_LimitStrength', elo !== null);
      if (elo !== null) this.setOption('UCI_Elo', clampElo(elo, this.options));
      this.currentElo = elo;
      changed = true;
    }
    if (changed) await this.isReady();
  }

  private search(
    fen: string,
    limits: SearchLimits,
    onInfo?: (info: EngineInfo) => void,
  ): Promise<BestMove> {
    const parts = ['go'];
    if (limits.depth) parts.push('depth', String(limits.depth));
    if (limits.movetimeMs) parts.push('movetime', String(limits.movetimeMs));
    if (limits.nodes) parts.push('nodes', String(limits.nodes));
    if (parts.length === 1) parts.push('infinite');

    this.infoListener = onInfo ?? null;
    // Tìm kiếm không giới hạn chỉ kết thúc khi stop(); các loại khác có hạn chờ rộng
    const timeout = parts.includes('infinite') ? 24 * 3600_000 : (limits.movetimeMs ?? 0) + 120_000;
    const done = this.waitFor(/^bestmove/, timeout).then((line) => {
      this.infoListener = null;
      this.searching = null;
      return parseBestMove(line) ?? { move: null };
    });
    this.searching = done;
    this.transport.send(fen === 'startpos' ? 'position startpos' : `position fen ${fen}`);
    this.transport.send(parts.join(' '));
    return done;
  }
}

function clampElo(elo: number, options: UciOption[]): number {
  const opt = options.find((o) => o.name === 'UCI_Elo');
  const min = opt?.min ?? 1000;
  const max = opt?.max ?? 3450;
  return Math.round(Math.min(max, Math.max(min, elo)));
}
