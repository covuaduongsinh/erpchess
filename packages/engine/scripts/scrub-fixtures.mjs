// Thay đường dẫn máy cục bộ trong log UCI bằng placeholder trước khi commit.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../test/fixtures/', import.meta.url);
for (const name of readdirSync(dir).filter((f) => f.endsWith('.log'))) {
  const file = join(dir.pathname.replace(/^\/([A-Za-z]:)/, '$1'), name);
  const text = readFileSync(file, 'utf8')
    .replace(/[A-Za-z]:\\[^\s]*?\\(?=[^\\\s]+$|[^\\\s]+\s)/gm, '<DIR>\\')
    .replace(/<DIR>\\(Arasan\\)/g, '<APPDATA>\\$1');
  writeFileSync(file, text);
}
