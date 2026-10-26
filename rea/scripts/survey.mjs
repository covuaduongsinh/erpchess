import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('D:/code/rea/node_modules/playwright-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = path.resolve('rea/evidence');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function run() {
  console.log('Khởi động Chrome để giải mã Chesslang...');
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

  const apiRequests = [];

  page.on('request', (req) => {
    const url = req.url();
    if (
      url.includes('api') ||
      url.includes('json') ||
      url.includes('graphql') ||
      url.includes('platform.chesslang.com')
    ) {
      apiRequests.push({
        method: req.method(),
        url: req.url(),
        resourceType: req.resourceType(),
        postData: req.postData(),
      });
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/') || url.includes('/v1/') || url.includes('/v2/')) {
      try {
        const text = await res.text();
        console.log(`[API Response] ${res.status()} ${url.slice(0, 100)} (Length: ${text.length})`);
      } catch {
        // ignore
      }
    }
  });

  console.log('Truy cập https://platform.chesslang.com/dashboard...');
  try {
    await page.goto('https://platform.chesslang.com/dashboard', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
  } catch (err) {
    console.log('Goto error / timeout:', err.message);
  }

  // Chờ 3s cho trang ổn định
  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  // Nếu chuyển sang trang login
  if (
    currentUrl.includes('login') ||
    currentUrl.includes('signin') ||
    (await page.$('input[type="password"]'))
  ) {
    console.log('Phát hiện trang đăng nhập. Điền thông tin đăng nhập duongsinhchess...');
    await page.screenshot({ path: path.join(OUTPUT_DIR, '01-login-page.png') });

    // Tìm input username/email
    const userSelectors = [
      'input[name="username"]',
      'input[name="email"]',
      'input[type="text"]',
      '#username',
      '#email',
    ];
    for (const sel of userSelectors) {
      if (await page.$(sel)) {
        await page.fill(sel, 'duongsinhchess');
        console.log(`Đã điền username vào ${sel}`);
        break;
      }
    }

    // Tìm input password
    const passSelectors = ['input[name="password"]', 'input[type="password"]', '#password'];
    for (const sel of passSelectors) {
      if (await page.$(sel)) {
        await page.fill(sel, 'covua@123');
        console.log(`Đã điền password vào ${sel}`);
        break;
      }
    }

    // Tìm nút submit
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Login")',
      'button:has-text("Sign in")',
      'input[type="submit"]',
    ];
    for (const sel of submitSelectors) {
      if (await page.$(sel)) {
        console.log(`Bấm nút submit: ${sel}`);
        await Promise.all([
          page
            .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 })
            .catch((e) => console.log('Nav timeout:', e.message)),
          page.click(sel),
        ]);
        break;
      }
    }

    await page.waitForTimeout(5000);
  }

  console.log('URL sau đăng nhập:', page.url());
  await page.screenshot({ path: path.join(OUTPUT_DIR, '02-dashboard-after-login.png') });

  // Thu thập nội dung DOM chính và các link menu
  const menuLinks = await page.$$eval('a', (links) =>
    links
      .map((a) => ({
        href: a.href,
        text: a.innerText.trim(),
      }))
      .filter((l) => l.href && l.href.includes('chesslang.com') && l.text),
  );

  console.log(`Tìm thấy ${menuLinks.length} links menu trong hệ thống.`);

  const pageTitle = await page.title();
  const bodyTextSnippet = (await page.innerText('body')).slice(0, 1500);

  const report = {
    capturedAt: new Date().toISOString(),
    startUrl: 'https://platform.chesslang.com/dashboard',
    finalUrl: page.url(),
    pageTitle,
    menuLinks,
    apiRequestsSample: apiRequests.slice(0, 50),
    bodyTextSnippet,
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'chesslang-recon.json'),
    JSON.stringify(report, null, 2),
    'utf-8',
  );
  console.log('Đã lưu kết quả khảo sát vào rea/evidence/chesslang-recon.json');

  await browser.close();
}

run().catch((err) => {
  console.error('Lỗi khi chạy REA survey:', err);
  process.exit(1);
});
