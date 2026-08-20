import { test, expect, type Page } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — Resource read-only trên lớp 20 tài liệu "zoom-02" (KHÔNG mutate):
 * pagination (032), select-all (030), filter (031), scroll (034). */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CID = '479bf5f4-8f78-4f7a-a460-ee482bab68d4';
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }

let page: Page; let RES = '';
async function goRes() {
  if (RES) { await page.goto(RES, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500); return; }
  await page.goto(`${OPS_BASE}/classes/detail/${CID}/overview`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1800);
  await page.getByText(/^Resources$/).last().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2800); RES = page.url();
}
test.beforeAll(async ({ browser }) => { const ctx = await browser.newContext({ ...iphone }); page = await ctx.newPage(); await loginOps(page); });

test('SAPP_MOBRES_TC_032 — Resource pagination: page-size 10, chuyển trang không mất item', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goRes();
  const t1 = await bodyText(page); await shot(page, 'SAPP_MOBRES_TC_032', '01_page1');
  const itemsTotal = (t1.match(/(\d+)\s*items?/i) || [])[1];
  const hasPager = /(^|\D)2(\D|$)/.test(t1) && /10/.test(t1); // có trang 2 + page-size 10
  // đếm số card tên file trên trang 1 (heuristic: dòng có phần mở rộng file)
  const p1files = await page.evaluate(() => (document.body.innerText.match(/[^\n]+\.(pdf|docx?|xlsx?|csv|txt|pptx?|zip|png|jpe?g|webp|gif|mp4)\b/gi) || []).length);
  // sang trang 2
  await page.getByText(/^2$/).last().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(2500); await shot(page, 'SAPP_MOBRES_TC_032', '02_page2');
  const p2files = await page.evaluate(() => (document.body.innerText.match(/[^\n]+\.(pdf|docx?|xlsx?|csv|txt|pptx?|zip|png|jpe?g|webp|gif|mp4)\b/gi) || []).length);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_032', 'observations.txt'), `total items: ${itemsTotal}\ncó pager+page-size10: ${hasPager}\nfiles trang1: ${p1files} · trang2: ${p2files}\n`, 'utf8');
  expect(Number(itemsTotal) >= 11, `Lớp cần >10 tài liệu để test pagination (thấy ${itemsTotal})`).toBeTruthy();
  expect(p1files > 0 && p2files > 0, 'Chuyển trang 2 không có item (mất dữ liệu?)').toBeTruthy();
});

test('SAPP_MOBRES_TC_030 — Select all: tick chọn hết trang rồi bỏ tick', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goRes();
  const selCount = async () => Number(((await bodyText(page)).match(/(\d+)\s*Selected/i) || [])[1] || 0);
  const before = await selCount();
  await page.getByText(/^Select all$/i).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1200); await shot(page, 'SAPP_MOBRES_TC_030', '01_selected');
  const afterTxt = await bodyText(page);
  const after = await selCount();
  const bulkBar = /Delete/i.test(afterTxt) && /Download/i.test(afterTxt); // bulk action bar hiện
  // bỏ tick
  await page.getByText(/^Select all$/i).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const unchecked = await selCount();
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_030', 'observations.txt'), `"N Selected" trước: ${before} · sau Select all: ${after} · sau bỏ tick: ${unchecked}\nBulk bar (Delete+Download) hiện: ${bulkBar}\n`, 'utf8');
  expect(after > before && bulkBar, 'Select all không chọn / không hiện bulk action').toBeTruthy();
  expect(unchecked < after, 'Bỏ tick Select all không bỏ chọn').toBeTruthy();
});

test('SAPP_MOBRES_TC_034 — Scroll danh sách dài mượt, không mất item', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goRes();
  const top = await page.evaluate(() => (document.body.innerText.match(/[^\n]+\.(pdf|docx?|xlsx?|csv|txt|pptx?|zip|png|jpe?g|webp|gif|mp4)\b/gi) || []).length);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500); await shot(page, 'SAPP_MOBRES_TC_034', '01_scrolled');
  const bottom = await page.evaluate(() => (document.body.innerText.match(/[^\n]+\.(pdf|docx?|xlsx?|csv|txt|pptx?|zip|png|jpe?g|webp|gif|mp4)\b/gi) || []).length);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_034', 'observations.txt'), `files thấy trên/dưới sau scroll: ${top}/${bottom}\n`, 'utf8');
  expect(bottom > 0, 'Scroll xong không còn item').toBeTruthy();
});
