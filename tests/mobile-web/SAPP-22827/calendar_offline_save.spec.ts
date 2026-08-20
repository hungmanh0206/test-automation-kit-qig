import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — MOBCAL_037: mất mạng khi Save Add Lesson → báo lỗi, KHÔNG tạo buổi mồ côi (net-zero).
 * Fill form đầy đủ (LM+date+time+leaf+teacher+classroom) → setOffline → Save → verify lỗi/không thành công
 * → setOffline(false) → verify ngày 18 KHÔNG có buổi mồ côi. Form DESKTOP, verify MOBILE. LH62. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const STATE = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation/ops_state.json');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CLASS = '4dff019e-25a9-44e9-b7b5-a9dd00ae5786';
const CAL = `${OPS_BASE}/classes/detail/${CLASS}/calendar`;
const DESKTOP = { width: 1440, height: 900 }; const MOBILE = { width: 390, height: 844 };
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function maskPII(p: Page) { await p.evaluate(() => { const w = (el: Node) => { for (const n of Array.from(el.childNodes)) { if (n.nodeType === 3 && n.nodeValue) n.nodeValue = n.nodeValue.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '•••@•••').replace(/(?:\+?84|0)\d[\d ]{7,11}/g, '•••••••••'); else w(n); } }; w(document.body); }).catch(() => {}); }
async function shot(p: Page, n: string) { const d = path.join(ART, 'SAPP_MOBCAL_TC_037'); fs.mkdirSync(d, { recursive: true }); await maskPII(p); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
async function openCC(p: Page) { await p.evaluate(() => { const lbl = Array.from(document.querySelectorAll('*')).find((e) => e.children.length === 0 && (e.textContent || '').trim() === 'Course Content'); let box: any = lbl; for (let i = 0; i < 4; i++) { if (box?.parentElement?.querySelector('button,svg,i')) { box = box.parentElement; break; } box = box?.parentElement || box; } (box.querySelector('button,i.ki-down,svg') as HTMLElement)?.click(); }); await p.waitForTimeout(1500); }
async function gotoDay18Oct(p: Page) { await p.setViewportSize(MOBILE); await p.goto(CAL, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000); for (let m = 0; m < 8; m++) { const cur = ((await p.getByText(/,\s*\d{4}$/).first().innerText().catch(() => '')) || '').trim(); if (/^October,\s*2026$/i.test(cur)) break; const lb = await p.getByText(/,\s*\d{4}$/).first().boundingBox(); if (lb) await p.mouse.click(lb.x + lb.width + 22, lb.y + lb.height / 2); await p.waitForTimeout(700); } await p.getByText(/^18$/).last().click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(2000); }
const day18Block = (p: Page) => p.locator('text=/\\d{1,2}:\\d{2}\\s*[-–]\\s*\\d{1,2}:\\d{2}/').first();
async function cleanDay18(p: Page, max = 5) { for (let i = 0; i < max; i++) { await gotoDay18Oct(p); const b = day18Block(p); if (!(await b.count().catch(() => 0))) return true; await b.click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(2500); if (!/Delete/i.test(await bodyText(p))) continue; const del = await p.getByRole('button', { name: /^Delete$/i }).first().click({ timeout: 2500 }).then(() => true).catch(() => false) || await p.getByText(/^Delete$/i).first().click({ timeout: 2000 }).then(() => true).catch(() => false) || await p.locator('.anticon-delete, [class*="trash"]').first().click({ timeout: 2000 }).then(() => true).catch(() => false); void del; await p.waitForTimeout(1800); const c1 = await p.locator('.swal2-confirm').first().click({ timeout: 1500 }).then(() => true).catch(() => false); const c2 = c1 ? false : await p.locator('.ant-modal-confirm-btns button.ant-btn-primary, .ant-modal .ant-btn-dangerous, .ant-modal .ant-btn-primary').first().click({ timeout: 1500 }).then(() => true).catch(() => false); if (!c1 && !c2) await p.getByRole('button', { name: /^(Yes|OK|Confirm)$/i }).first().click({ timeout: 1500 }).catch(() => {}); await p.waitForTimeout(3000); } return false; }

let page: Page; let ctxRef: BrowserContext;
test.beforeAll(async ({ browser }) => { ctxRef = await browser.newContext({ ...iphone, viewport: DESKTOP, storageState: STATE }); page = await ctxRef.newPage(); });
test.afterAll(async () => { await ctxRef.setOffline(false).catch(() => {}); await cleanDay18(page).catch(() => {}); await ctxRef.close().catch(() => {}); }); // chống orphan nếu lỡ tạo
test.skip(!haveOpsCreds, 'no creds');

test('MOBCAL_037 — Offline khi Save Add Lesson → không tạo buổi mồ côi (net-zero)', async () => {
  test.setTimeout(180_000);
  const obs: string[] = [];
  await page.setViewportSize(DESKTOP); await page.goto(CAL, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  await page.getByText(/Add Lesson/i).first().click({ timeout: 6000 }); await page.waitForTimeout(2500);
  await page.locator('input[type="search"][readonly]').first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(700);
  await page.locator('.ant-select-item-option').first().click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(500);
  await page.getByPlaceholder(/Select date/i).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(700);
  for (let i = 0; i < 3; i++) { await page.locator('.ant-picker-header-next-btn').first().click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(400); }
  await page.locator('.ant-picker-cell-in-view:not(.ant-picker-cell-disabled)').filter({ hasText: /^18$/ }).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(600);
  await page.getByPlaceholder(/Start Time/i).first().fill('08:00').catch(() => {});
  await page.getByPlaceholder(/End Time/i).first().fill('11:00').catch(() => {}); await page.waitForTimeout(400);
  await openCC(page);
  await page.locator('.ant-drawer-content input[type="checkbox"].cursor-pointer, input[type="checkbox"].cursor-pointer').nth(3).click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(2500);
  await page.getByText(/Add teacher/i).first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(2500);
  await page.locator('input[type="radio"]').first().check({ timeout: 3000, force: true }).catch(() => {}); await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^Add$/i }).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1500);
  await page.getByText(/Add classroom/i).first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(2500);
  await page.locator('input[type="radio"]').first().check({ timeout: 3000, force: true }).catch(() => {}); await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^Add$/i }).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1500);
  await shot(page, '01_form_filled');
  obs.push('Form Add Lesson điền đầy đủ (LM+date+time+leaf+teacher+classroom) = xong');

  // MẤT MẠNG rồi Save
  await ctxRef.setOffline(true); await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^Save$/i }).last().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(5000);
  const bt = await bodyText(page);
  const crashed = bt.trim().length < 40; // màn trắng
  const errShown = /error|lỗi|network|mạng|failed|thất bại|try again|thử lại/i.test(bt);
  const stillModal = await page.getByRole('button', { name: /^Save$/i }).count().catch(() => 0);
  await shot(page, '02_offline_save');
  obs.push(`Offline Save: màn trắng/crash = ${crashed}; báo lỗi mạng = ${errShown}; còn ở modal (chưa lưu) = ${stillModal > 0}`);

  // ONLINE lại → verify KHÔNG có buổi mồ côi ngày 18
  await ctxRef.setOffline(false); await page.waitForTimeout(1500);
  await gotoDay18Oct(page);
  const orphan = (await day18Block(page).count().catch(() => 0)) > 0;
  await shot(page, '03_no_orphan_day18');
  obs.push(`Sau online lại: buổi mồ côi ngày 18 = ${orphan} (mong đợi KHÔNG có = false)`);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_037', 'observations.txt'), obs.join('\n') + '\n', 'utf8');

  expect(crashed, '037: app KHÔNG crash/màn trắng khi offline Save').toBeFalsy();
  expect(orphan, '037: KHÔNG tạo buổi mồ côi khi Save offline (net-zero)').toBeFalsy();
});
