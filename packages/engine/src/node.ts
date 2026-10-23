/** Transport cho Node (server, script, test tích hợp): chạy engine native qua stdin/stdout. */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { UciTransport } from './engine';

export function spawnTransport(binary: string, args: string[] = []): UciTransport {
  const child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'ignore'] });
  const listeners = new Set<(line: string) => void>();
  createInterface({ input: child.stdout }).on('line', (line) => {
    for (const l of listeners) l(line);
  });
  return {
    send: (command) => {
      if (child.stdin.writable) child.stdin.write(`${command}\n`);
    },
    onLine: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => {
      child.stdin.end();
      setTimeout(() => child.kill(), 1000).unref();
    },
  };
}
