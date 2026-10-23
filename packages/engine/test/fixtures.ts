import { readFileSync } from 'node:fs';
import type { UciTransport } from '../src/engine';

/** Đọc log do scripts/uci-probe.mjs ghi: dòng "> lệnh", "< output", "# ghi chú". */
export function readFixture(name: string): { command: string; output: string[] }[] {
  const text = readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
  const steps: { command: string; output: string[] }[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('> ')) steps.push({ command: line.slice(2), output: [] });
    else if (line.startsWith('< ')) steps.at(-1)?.output.push(line.slice(2));
  }
  return steps;
}

export function outputLines(name: string): string[] {
  return readFixture(name).flatMap((s) => s.output);
}

/**
 * Transport giả phát lại log thật: khi nhận một lệnh, phát output đã ghi của lệnh cùng loại
 * (so theo từ đầu tiên) theo đúng thứ tự xuất hiện trong log.
 */
export class ReplayTransport implements UciTransport {
  readonly sent: string[] = [];
  private readonly listeners = new Set<(line: string) => void>();
  private readonly queues = new Map<string, string[][]>();

  constructor(fixture: string) {
    for (const step of readFixture(fixture)) {
      const key = step.command.split(' ')[0] as string;
      this.queues.set(key, [...(this.queues.get(key) ?? []), step.output]);
    }
  }

  send(command: string): void {
    this.sent.push(command);
    const key = command.split(' ')[0] as string;
    // Log chỉ ghi một lần isready; các lần sau engine thật luôn trả readyok
    const output = this.queues.get(key)?.shift() ?? (key === 'isready' ? ['readyok'] : undefined);
    if (!output) return;
    queueMicrotask(() => {
      for (const line of output) for (const l of this.listeners) l(line);
    });
  }

  onLine(listener: (line: string) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {}
}
