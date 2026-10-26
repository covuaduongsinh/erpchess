import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('D:/code/rea/node_modules/playwright-core');

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
console.log('Navigating with domcontentloaded...');
await page.goto('https://platform.chesslang.com/login', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
});
console.log('Navigated. Waiting 3s...');
await page.waitForTimeout(3000);

const html = await page.content();
fs.writeFileSync('rea/evidence/login-page.html', html, 'utf-8');
console.log(`Saved login HTML: ${html.length} bytes`);

const frames = page.frames();
console.log('Frames count:', frames.length);
for (let i = 0; i < frames.length; i++) {
  console.log(`Frame ${i}: ${frames[i].url()}`);
}

await browser.close();
