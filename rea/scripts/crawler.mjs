import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('D:/code/rea/node_modules/playwright-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EVIDENCE_DIR = path.resolve('rea/evidence');
const SCREENSHOT_DIR = path.join(EVIDENCE_DIR, 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function main() {
  console.log('>>> [1/5] Khởi động Chrome...');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  const networkLog = [];
  page.on('response', async (res) => {
    const url = res.url();
    const status = res.status();
    const req = res.request();
    const contentType = res.headers()['content-type'] || '';

    if (contentType.includes('application/json') || url.includes('/api/')) {
      try {
        const bodyText = await res.text();
        networkLog.push({
          timestamp: new Date().toISOString(),
          url,
          method: req.method(),
          status,
          postData: req.postData(),
          responseSnippet: bodyText.slice(0, 500),
          responseLength: bodyText.length,
        });
        console.log(`[HTTP ${status}] ${req.method()} ${url.slice(0, 80)}`);
      } catch {
        // ignore
      }
    }
  });

  console.log('>>> [2/5] Truy cập trang đăng nhập https://platform.chesslang.com/login...');
  await page.goto('https://platform.chesslang.com/login', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(2000);

  console.log('>>> [3/5] Điền thông tin đăng nhập: duongsinhchess...');
  await page.fill('#username', 'duongsinhchess');
  await page.fill('#password', 'covua@123');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-login-filled.png') });

  console.log('>>> Bấm nút Login...');
  await page.click('button.btn-login');

  // Đợi chuyển hướng sau khi login
  try {
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  } catch {
    console.log('Hết thời gian chờ waitForURL, URL hiện tại:', page.url());
  }

  await page.waitForTimeout(4000);
  console.log('>>> URL hiện tại:', page.url());
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-after-login.png') });

  // Kiểm tra thông báo lỗi nếu có
  const errorText = await page
    .$$eval('.error, .alert, [role="alert"], .form-error', (els) =>
      els.map((e) => e.innerText).join(' | '),
    )
    .catch(() => '');
  if (errorText) {
    console.log('Thông báo trên trang:', errorText);
  }

  // Quét danh sách tất cả các đường link và thẻ điều hướng trên trang sau khi đăng nhập
  const links = await page.$$eval('a', (els) =>
    els
      .map((e) => ({
        href: e.href,
        text: e.innerText.replace(/\s+/g, ' ').trim(),
      }))
      .filter((l) => l.href && l.href.startsWith('https://platform.chesslang.com') && l.text),
  );

  console.log(`>>> [4/5] Thu thập được ${links.length} liên kết sau khi đăng nhập:`);
  for (const l of links) {
    console.log(`  - [${l.text}]: ${l.href}`);
  }

  // Khám phá các route chính
  const routesToExplore = [
    '/dashboard',
    '/classes',
    '/classrooms',
    '/assignments',
    '/quizzes',
    '/studies',
    '/tournaments',
    '/games',
    '/students',
    '/batches',
    '/settings',
  ];

  const pageScreenshots = [];
  const discoveredRoutes = [];

  // Thêm các link tìm thấy vào danh sách khám phá nếu là nội bộ
  for (const l of links) {
    try {
      const u = new URL(l.href);
      if (
        !routesToExplore.includes(u.pathname) &&
        !u.pathname.includes('/login') &&
        !u.pathname.includes('/signup')
      ) {
        routesToExplore.push(u.pathname);
      }
    } catch {
      // ignore
    }
  }

  console.log('>>> [5/5] Khám phá chi tiết các phân hệ:', routesToExplore);

  for (const r of routesToExplore) {
    const targetUrl = `https://platform.chesslang.com${r}`;
    console.log(`Đang truy cập: ${targetUrl}...`);
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2500);

      const actualUrl = page.url();
      const title = await page.title();
      const safeName = r.replace(/[^a-zA-Z0-9]/g, '_');
      const shotPath = path.join(SCREENSHOT_DIR, `route${safeName}.png`);
      await page.screenshot({ path: shotPath });

      const heading = await page
        .$$eval('h1, h2, h3', (els) =>
          els
            .map((e) => e.innerText.trim())
            .filter(Boolean)
            .slice(0, 5),
        )
        .catch(() => []);

      discoveredRoutes.push({
        path: r,
        actualUrl,
        title,
        heading,
        screenshot: path.relative(EVIDENCE_DIR, shotPath),
      });
      console.log(`  -> Tiêu đề: "${title}", Heading: ${JSON.stringify(heading)}`);
    } catch (e) {
      console.log(`  -> Lỗi khi truy cập ${r}:`, e.message);
    }
  }

  // Lưu toàn bộ dữ liệu khảo sát và giải mã
  const fullRecon = {
    crawledAt: new Date().toISOString(),
    username: 'duongsinhchess',
    discoveredRoutes,
    networkCallsCount: networkLog.length,
    networkLog: networkLog.slice(0, 200),
  };

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'chesslang-deep-audit.json'),
    JSON.stringify(fullRecon, null, 2),
    'utf-8',
  );
  console.log('>>> HOÀN TẤT: Dữ liệu đã được lưu vào rea/evidence/chesslang-deep-audit.json');

  await browser.close();
}

main().catch((err) => {
  console.error('Fatal crawler error:', err);
  process.exit(1);
});
