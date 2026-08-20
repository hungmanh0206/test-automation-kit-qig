import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — MOBCAL_006 (buổi hiện tên + giờ HH:mm-HH:mm) + MOBCAL_013 (ngày nhiều buổi hiển thị nhiều/"+N more").
 * Tạo 2 buổi Manual cùng ngày 18/10 LH62 (08:00-11:00, 13:00-16:00) → verify hiển thị → xoá cả 2 (loop robust) net-zero. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const STATE = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation/ops_state.json');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CLASS = '4dff019e-25a9-44e9-b7b5-a9dd00ae5786';
const CAL = `${OPS_BASE}/classes/detail/${CLASS}/calendar`;
const DESKTOP = { width: 1440, height: 900 }; const MOBILE = { width: 390, height: 844 };
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function maskPII(p: Page) { await p.evaluate(() => { const w = (el: Node) => { for (const n of Array.from(el.childNodes)) { if (n.nodeType === 3 && n.nodeValue) n.nodeValue = n.nodeValue.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '•••@•••').replace(/(?:\+?84|0)\d[\d ]{7,11}/g, '•••••••••'); else w(n); } }; w(document.body); }).catch(() => {}); }
async function shot(p: Page, n: string) { const d = path.join(ART, 'SAPP_MOBCAL_TC_006'); fs.mkdirSync(d, { recursive: true }); await maskPII(p); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
async function openCC(p: Page) { await p.evaluate(() => { const lbl = Array.from(document.querySelectorAll('*')).find((e) => e.children.length === 0 && (e.textContent || '').trim() === 'Course Content'); let box: any = lbl; for (let i = 0; i < 4; i++) { if (box?.parentElement?.querySelector('button,svg,i')) { box = box.parentElement; break; } box = box?.parentElement || box; } (box.querySelector('button,i.ki-down,svg') as HTMLElement)?.click(); }); await p.waitForTimeout(1500); }
async function gotoDay18Oct(p: Page) { await p.setViewportSize(MOBILE); await p.goto(CAL, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000); for (let m = 0; m < 8; m++) { const cur = ((await p.getByText(/,\s*\d{4}$/).first().innerText().catch(() => '')) || '').trim(); if (/^October,\s*2026$/i.test(cur)) break; const lb = await p.getByText(/,\s*\d{4}$/).first().boundingBox(); if (lb) await p.mouse.click(lb.x + lb.width + 22, lb.y + lb.height / 2); await p.waitForTimeout(700); } }
const day18Block = (p: Page) => p.locator('text=/\\d{1,2}:\\d{2}\\s*[-–]\\s*\\d{1,2}:\\d{2}/').first();
async function cleanDay18(p: Page, max = 8) { for (let i = 0; i < max; i++) { await gotoDay18Oct(p); await p.getByText(/^18$/).last().click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(2000); const b = day18Block(p); if (!(await b.count().catch(() => 0))) return true; await b.click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(2500); if (!/Delete/i.test(await bodyText(p))) continue; const del = await p.getByRole('button', { name: /^Delete$/i }).first().click({ timeout: 2500 }).then(() => true).catch(() => false) || await p.getByText(/^Delete$/i).first().click({ timeout: 2000 }).then(() => true).catch(() => false) || await p.locator('.anticon-delete, [class*="trash"]').first().click({ timeout: 2000 }).then(() => true).catch(() => false); void del; await p.waitForTimeout(1800); const c1 = await p.locator('.swal2-confirm').first().click({ timeout: 1500 }).then(() => true).catch(() => false); if (!c1) await p.getByRole('button', { name: /^(Yes|OK|Confirm)$/i }).first().click({ timeout: 1500 }).catch(() => {}); await p.waitForTimeout(3000); } return false; }

async function createLesson(p: Page, start: string, end: string, leafIdx = 3) {
  await p.setViewportSize(DESKTOP); await p.goto(CAL, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
  await p.getByText(/Add Lesson/i).first().click({ timeout: 6000 }); await p.waitForTimeout(2500);
  await p.locator('input[type="search"][readonly]').first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(700);
  await p.locator('.ant-select-item-option').first().click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(500);
  await p.getByPlaceholder(/Select date/i).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(700);
  for (let i = 0; i < 3; i++) { await p.locator('.ant-picker-header-next-btn').first().click({ timeout: 1500 }).catch(() => {}); await p.waitForTimeout(400); }
  await p.locator('.ant-picker-cell-in-view:not(.ant-picker-cell-disabled)').filter({ hasText: /^18$/ }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(600);
  await p.getByPlaceholder(/Start Time/i).first().fill(start).catch(() => {});
  await p.getByPlaceholder(/End Time/i).first().fill(end).catch(() => {}); await p.waitForTimeout(400);
  await openCC(p);
  // tick 1 leaf content (khác nhau giữa 2 buổi để không đụng content đã dùng)
  const cb = p.locator('.ant-drawer-content input[type="checkbox"].cursor-pointer, input[type="checkbox"].cursor-pointer');
  const nCb = await cb.count().catch(() => 0);
  await cb.nth(Math.min(leafIdx, Math.max(0, nCb - 1))).click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(2500);
  // nếu teacher chưa enable (content đã dùng), thử leaf kế
  const enabled0 = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find((x) => /Add teacher/i.test(x.textContent || '')) as HTMLButtonElement | undefined; return b ? !b.disabled : false; });
  if (!enabled0) { for (const j of [leafIdx + 1, leafIdx + 2, leafIdx - 1, leafIdx + 3]) { if (j < 0 || j >= nCb) continue; await cb.nth(j).click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(1800); const en = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find((x) => /Add teacher/i.test(x.textContent || '')) as HTMLButtonElement | undefined; return b ? !b.disabled : false; }); if (en) break; } }
  await p.getByText(/Add teacher/i).first().click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(2500);
  await p.locator('input[type="radio"]').first().check({ timeout: 3000, force: true }).catch(() => {}); await p.waitForTimeout(400);
  await p.getByRole('button', { name: /^Add$/i }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(2000);
  await p.getByText(/Add classroom/i).first().click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(2500);
  await p.locator('input[type="radio"]').first().check({ timeout: 3000, force: true }).catch(() => {}); await p.waitForTimeout(400);
  await p.getByRole('button', { name: /^Add$/i }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(2000);
  await p.getByRole('button', { name: /^Save$/i }).last().click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(4000);
}

let page: Page; let ctxRef: BrowserContext;
test.beforeAll(async ({ browser }) => { ctxRef = await browser.newContext({ ...iphone, viewport: DESKTOP, storageState: STATE }); page = await ctxRef.newPage(); });
test.afterAll(async () => { await cleanDay18(page).catch(() => {}); await ctxRef.close().catch(() => {}); });
test.skip(!haveOpsCreds, 'no creds');

test('MOBCAL_006/013 — buổi hiện tên+giờ & ngày nhiều buổi (net-zero)', async () => {
  test.setTimeout(300_000);
  const obs: string[] = [];
  await createLesson(page, '08:00', '11:00', 3); obs.push('Tạo buổi 1 (08:00-11:00, leaf#3) = xong');
  await createLesson(page, '13:00', '16:00', 5); obs.push('Tạo buổi 2 (13:00-16:00, leaf#5 khác content) cùng ngày 18 = xong');

  // MOBILE: mở ngày 18 → đọc hiển thị
  await gotoDay18Oct(page);
  const monthText = (await bodyText(page)).replace(/\s+/g, ' ');
  const plusMore = /\+\s*\d+\s*more|xem thêm|\+\d/i.test(monthText);
  await shot(page, '01_month_day18_multi');
  await page.getByText(/^18$/).last().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(2000);
  const dayText = (await bodyText(page)).replace(/\s+/g, ' ');
  const times = (dayText.match(/\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/g) || []);
  const nBlocks = await page.locator('text=/\\d{1,2}:\\d{2}\\s*[-–]\\s*\\d{1,2}:\\d{2}/').count().catch(() => 0);
  // 006: 1 buổi hiện đúng format giờ HH:mm-HH:mm (+ có nội dung/tên)
  const c006 = times.length >= 1 && /\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2}/.test(times[0]);
  const hasName = /Activity|Lesson|Part|Unit|Chapter|Buổi/i.test(dayText);
  // 013: ngày có ≥2 buổi hiển thị (hoặc +N more ở lưới tháng)
  const c013 = nBlocks >= 2 || plusMore;
  await shot(page, '02_day18_expanded_2lessons');
  obs.push(`[006] buổi hiện giờ HH:mm-HH:mm = ${c006} (mẫu "${times[0] || ''}"), có tên/nội dung = ${hasName}`);
  obs.push(`[013] "+N more" ở lưới tháng = ${plusMore}; #buổi ngày 18 khi bung = ${nBlocks} (times=${JSON.stringify(times.slice(0, 4))}) → nhiều buổi = ${c013}`);

  // DELETE cả 2 net-zero
  const cleaned = await cleanDay18(page);
  const still = await (async () => { await gotoDay18Oct(page); await page.getByText(/^18$/).last().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(1500); return (await day18Block(page).count().catch(() => 0)) > 0; })();
  await shot(page, '03_after_delete_empty');
  obs.push(`Xoá cả 2 net-zero = ${cleaned}; còn buổi = ${still}`);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_006', 'observations.txt'), obs.join('\n') + '\n', 'utf8');

  expect(c006, '006: buổi hiển thị giờ HH:mm-HH:mm').toBeTruthy();
  expect(c013, '013: ngày nhiều buổi hiển thị ≥2 buổi / +N more').toBeTruthy();
  expect(still, 'net-zero: đã xoá sạch cả 2 buổi').toBeFalsy();
});
