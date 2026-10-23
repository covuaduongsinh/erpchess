// Build Arasan native từ vendor/arasan (submodule) và chép file NNUE cạnh file chạy.
// node scripts/build-native.mjs [modern|avx2|avx2-bmi2|old|neon]   (mặc định: modern)
// Windows cần Visual Studio Build Tools (MinGW không dựng được Arasan); Linux/macOS dùng compiler sẵn có.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const variant = process.argv[2] ?? 'modern';
const flags = {
  modern: ['-DMODERN=ON'],
  avx2: ['-DAVX2=ON'],
  'avx2-bmi2': ['-DAVX2=ON', '-DBMI2=ON'],
  old: ['-DOLD=ON'],
  neon: ['-DNEON=ON'],
}[variant];
if (!flags) {
  console.error(`Biến thể không hợp lệ: ${variant}`);
  process.exit(2);
}

const root = resolve(import.meta.dirname, '../../..');
const src = join(root, 'vendor/arasan/src');
const out = join(root, 'vendor/build', `arasan-${variant}`);
if (!existsSync(join(src, 'CMakeLists.txt'))) {
  console.error('Thiếu mã nguồn: chạy `git submodule update --init --recursive vendor/arasan`');
  process.exit(1);
}

const configure = `cmake -S "${src}" -B "${out}" -G Ninja -DCMAKE_BUILD_TYPE=Release ${flags.join(' ')}`;
const build = `cmake --build "${out}" -j ${process.env.JOBS ?? 2}`;

if (process.platform === 'win32') {
  const vswhere = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe';
  const vs = execFileSync(vswhere, ['-products', '*', '-latest', '-property', 'installationPath'])
    .toString()
    .trim();
  const script = join(tmpdir(), 'erpchess-build-arasan.cmd');
  writeFileSync(
    script,
    [
      '@echo off',
      `call "${vs}\\VC\\Auxiliary\\Build\\vcvars64.bat" >nul || exit /b 1`,
      `${configure} -DCMAKE_C_COMPILER=cl -DCMAKE_CXX_COMPILER=cl || exit /b 1`,
      `${build} || exit /b 1`,
    ].join('\r\n'),
  );
  execFileSync('cmd.exe', ['/c', script], { stdio: 'inherit' });
} else {
  execFileSync('sh', ['-c', `${configure} && ${build}`], { stdio: 'inherit' });
}

const nnue = readdirSync(join(root, 'vendor/arasan/network')).find((f) => f.endsWith('.nnue'));
if (nnue) copyFileSync(join(root, 'vendor/arasan/network', nnue), join(out, nnue));
const exe = readdirSync(out).find((f) => f.startsWith('arasanx'));
console.log(`Xong: ${join(out, exe ?? '?')}`);
