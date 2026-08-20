import { test, expect, type Page } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — Batch A: read-only cần điều hướng (month-logic biên năm nhuận) + recon Resources.
 * Data-independent với calendar grid. KHÔNG mutate. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const OPS = OPS_BASE;
const iphone = require('@playwright/test').devices['iPhone 13'];

async function shot(page: Page, tc: string, name: string) {
  const dir = path.join(ART, tc); fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}
const bodyText = (page: Page) => page.evaluate(() => document.body.innerText || '');

// điều hướng calendar tới tháng đích qua nút prev/next (theo bbox của nhãn tháng)
async function gotoMonth(page: Page, target: string): Promise<boolean> {
  const label = page.getByText(/^(January|February|March|April|May|June|July|August|September|October|November|December),\s*\d{4}$/).first();
  for (let i = 0; i < 40; i++) {
    const cur = (await label.innerText().catch(() => '')) || '';
    if (cur.trim() === target) return true;
    const box = await label.boundingBox();
    if (!box) return false;
    const goBack = true; // luôn lùi (target ở quá khứ)
    await page.mouse.click(goBack ? box.x - 22 : box.x + box.width + 22, box.y + box.height / 2);
    await page.waitForTimeout(500);
  }
  return false;
}
// max ngày hiển thị trong lưới (01..31)
async function maxDay(page: Page): Promise<number> {
  const nums = await page.evaluate(() => {
    const out: number[] = [];
    for (const el of Array.from(document.querySelectorAll('td, [class*="day" i], [class*="cell" i], div, span'))) {
      const t = (el.textContent || '').trim();
      if (/^\d{1,2}$/.test(t)) { const n = Number(t); if (n >= 1 && n <= 31) out.push(n); }
    }
    return out;
  });
  return nums.length ? Math.max(...nums) : 0;
}

let page: Page;
let calBase = '';
test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({ ...iphone });
  page = await ctx.newPage();
  await loginOps(page);
  await page.goto(`${OPS}/classes?page_index=1&page_size=10`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const href = await page.locator('a[href*="/classes/detail"]').first().getAttribute('href');
  calBase = `${OPS}${(href || '').replace(/\/overview.*$/, '')}`;
});

test('SAPP_MOBCAL_TC_003 — Calendar: nhãn tháng format "<Month>, YYYY"', async () => {
  test.skip(!haveOpsCreds, 'no creds');
  await page.goto(`${calBase}/calendar`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const txt = await bodyText(page);
  await shot(page, 'SAPP_MOBCAL_TC_003', '01_monthlabel');
  expect(txt).toMatch(/\b(January|February|March|April|May|June|July|August|September|October|November|December),\s*\d{4}\b/);
});

test('SAPP_MOBCAL_TC_007 — Calendar: February 2025 hiển thị 28 ngày (không nhuận)', async () => {
  test.skip(!haveOpsCreds, 'no creds');
  const ok = await gotoMonth(page, 'February, 2025');
  await shot(page, 'SAPP_MOBCAL_TC_007', '01_feb2025');
  expect(ok, 'Không điều hướng tới February, 2025').toBeTruthy();
  const md = await maxDay(page);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_007', 'observations.txt'), `maxDay=${md} (kỳ vọng 28)\n`, 'utf8');
  expect(md, `Feb 2025 phải có 28 ngày, thấy maxDay=${md}`).toBe(28);
});

test('SAPP_MOBCAL_TC_008 — Calendar: February 2024 hiển thị 29 ngày (năm nhuận)', async () => {
  test.skip(!haveOpsCreds, 'no creds');
  const ok = await gotoMonth(page, 'February, 2024');
  await shot(page, 'SAPP_MOBCAL_TC_008', '01_feb2024');
  expect(ok, 'Không điều hướng tới February, 2024').toBeTruthy();
  const md = await maxDay(page);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_008', 'observations.txt'), `maxDay=${md} (kỳ vọng 29)\n`, 'utf8');
  expect(md, `Feb 2024 (nhuận) phải có 29 ngày, thấy maxDay=${md}`).toBe(29);
});

test('SAPP_MOBRES_TC_004 — Resources tab: recon + hiển thị (nếu có tài liệu)', async () => {
  test.skip(!haveOpsCreds, 'no creds');
  await page.goto(`${calBase}/resources`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  await shot(page, 'SAPP_MOBRES_TC_004', '01_resources');
  const txt = await bodyText(page);
  const hasUpload = /Upload/i.test(txt);
  const hasCardFields = ['Access', 'Size', 'Owner'].filter((l) => txt.includes(l));
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_004', 'observations.txt'),
    `Upload button: ${hasUpload}\nCard fields thấy: ${hasCardFields.join(', ') || '(không có tài liệu / trống)'}\nSnippet: ${txt.slice(0, 400).replace(/\n/g, ' / ')}\n`, 'utf8');
  expect(hasUpload, 'Không thấy nút Upload ở tab Resources').toBeTruthy();
});
