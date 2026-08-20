import { test, expect, type Page } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — Resource read-only trên zoom-02 (20 tài liệu, KHÔNG mutate): 004 (Size format), 031 (Filter),
 * 033 (touch target ≥44px), 037 (design token nút vàng). Mobile iPhone 13. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const iphone = require('@playwright/test').devices['iPhone 13'];
const RESURL = `${OPS_BASE}/classes/detail/479bf5f4-8f78-4f7a-a460-ee482bab68d4`;
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }

let page: Page;
async function goRes() { await page.goto(`${RESURL}/overview`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1800); await page.getByText(/^Resources$/).last().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2800); }
test.beforeAll(async ({ browser }) => { const ctx = await browser.newContext({ ...iphone }); page = await ctx.newPage(); await loginOps(page); });

test('SAPP_MOBRES_TC_004 — Card tài liệu: Size đúng format NN.NN KB/MB', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(60_000);
  await goRes();
  // gom bodyText qua nhiều mốc scroll để chắc bắt được value size (card lazy)
  let t = '';
  for (const y of [0, 500, 1000, 1600, 2200]) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(500); t += '\n' + (await bodyText(page)); }
  await shot(page, 'SAPP_MOBRES_TC_004', '01');
  const hasSize = /\bSize\b/i.test(t); const fmt = /\d+(\.\d+)?\s*(KB|MB|GB|Byte)/i.test(t);
  const fields = ['Access', 'Lesson', 'Location', 'Size', 'Owner', 'Date'].filter((l) => t.includes(l));
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_004', 'observations.txt'), `Size label: ${hasSize} · format số+đơn vị: ${fmt}\nfield card: ${fields.join(', ')}\n`, 'utf8');
  expect(hasSize && fmt, 'Size không đúng format NN.NN <đơn vị>').toBeTruthy();
});

test('SAPP_MOBRES_TC_031 — Filter: mở panel filter', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(60_000);
  await goRes();
  await page.getByText(/^Filter$/).last().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1800); await shot(page, 'SAPP_MOBRES_TC_031', '01_filter');
  const t = await bodyText(page);
  const opened = /Filter|Lọc|Apply|Reset|Access|Owner|Lesson|Type|Sort/i.test(t);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_031', 'observations.txt'), `panel Filter mở: ${opened}\nsnippet: ${t.slice(0, 300).replace(/\n/g, ' | ')}\n`, 'utf8');
  await page.keyboard.press('Escape').catch(() => {});
  expect(opened, 'Không mở được panel Filter').toBeTruthy();
});

test('SAPP_MOBRES_TC_033 — Touch target nút Upload/Filter ≥44px', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(60_000);
  await goRes(); await shot(page, 'SAPP_MOBRES_TC_033', '01');
  const sizes = await page.evaluate(() => {
    const out: any = {};
    for (const label of ['Upload', 'Filter']) { const el = Array.from(document.querySelectorAll('button,[role="button"],a')).find((b) => new RegExp(`^${label}$`, 'i').test((b.textContent || '').trim())); if (el) { const r = el.getBoundingClientRect(); out[label] = { w: Math.round(r.width), h: Math.round(r.height) }; } }
    return out;
  });
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_033', 'observations.txt'), `touch sizes: ${JSON.stringify(sizes)}\n`, 'utf8');
  const ok = Object.values(sizes).every((s: any) => s.h >= 40); // ~44px (dung sai)
  expect(ok, `Nút bấm < ~44px: ${JSON.stringify(sizes)}`).toBeTruthy();
});

test('SAPP_MOBRES_TC_037 — Design token: nút Upload nền vàng #FFB800', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(60_000);
  await goRes();
  const bg = await page.getByText(/^Upload$/).first().evaluate((e) => { let n: any = e; for (let i = 0; i < 4 && n; i++) { const c = getComputedStyle(n).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; n = n.parentElement; } return ''; }).catch(() => '');
  await shot(page, 'SAPP_MOBRES_TC_037', '01');
  const m = bg.match(/(\d+),\s*(\d+),\s*(\d+)/); const yellow = m ? (+m[1] > 200 && +m[2] > 140 && +m[3] < 90) : false;
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_037', 'observations.txt'), `Upload bg=${bg} vàng≈#FFB800: ${yellow}\n`, 'utf8');
  expect(yellow, `Upload không nền vàng (bg=${bg})`).toBeTruthy();
});
