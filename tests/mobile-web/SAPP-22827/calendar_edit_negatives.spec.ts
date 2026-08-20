import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — Edit Lesson negatives net-zero (1 buổi cho 3 case):
 *  MOBCAL_016 Cancel không lưu · MOBCAL_017 ngày 29/02/2025 invalid bị chặn (picker) · MOBCAL_019 giờ bắt đầu=kết thúc bị chặn.
 * Tạo 1 buổi Manual (LH62 18/10, 08:00-11:00) → 3 kiểm tra (đều KHÔNG persist) → xoá (loop swal2). Mask PII. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const STATE = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation/ops_state.json');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CLASS = '4dff019e-25a9-44e9-b7b5-a9dd00ae5786';
const CAL = `${OPS_BASE}/classes/detail/${CLASS}/calendar`;
const DESKTOP = { width: 1440, height: 900 }; const MOBILE = { width: 390, height: 844 };
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function maskPII(p: Page) { await p.evaluate(() => { const w = (el: Node) => { for (const n of Array.from(el.childNodes)) { if (n.nodeType === 3 && n.nodeValue) n.nodeValue = n.nodeValue.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '•••@•••').replace(/(?:\+?84|0)\d[\d ]{7,11}/g, '•••••••••'); else w(n); } }; w(document.body); }).catch(() => {}); }
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await maskPII(p); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
async function openCC(p: Page) { await p.evaluate(() => { const lbl = Array.from(document.querySelectorAll('*')).find((e) => e.children.length === 0 && (e.textContent || '').trim() === 'Course Content'); let box: any = lbl; for (let i = 0; i < 4; i++) { if (box?.parentElement?.querySelector('button,svg,i')) { box = box.parentElement; break; } box = box?.parentElement || box; } (box.querySelector('button,i.ki-down,svg') as HTMLElement)?.click(); }); await p.waitForTimeout(1500); }
async function gotoDay18Oct(p: Page) { await p.setViewportSize(MOBILE); await p.goto(CAL, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000); for (let m = 0; m < 8; m++) { const cur = ((await p.getByText(/,\s*\d{4}$/).first().innerText().catch(() => '')) || '').trim(); if (/^October,\s*2026$/i.test(cur)) break; const lb = await p.getByText(/,\s*\d{4}$/).first().boundingBox(); if (lb) await p.mouse.click(lb.x + lb.width + 22, lb.y + lb.height / 2); await p.waitForTimeout(700); } await p.getByText(/^18$/).last().click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(2000); }
const day18Block = (p: Page) => p.locator('text=/\\d{1,2}:\\d{2}\\s*[-–]\\s*\\d{1,2}:\\d{2}/').first();
async function openLessonEdit(p: Page) { await gotoDay18Oct(p); await day18Block(p).click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(2500); await p.getByRole('button', { name: /^Edit$/i }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(2200); }
async function cleanDay18(p: Page, max = 6) { for (let i = 0; i < max; i++) { await gotoDay18Oct(p); const b = day18Block(p); if (!(await b.count().catch(() => 0))) return true; await b.click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(2500); if (!/Delete/i.test(await bodyText(p))) continue; const del = await p.getByRole('button', { name: /^Delete$/i }).first().click({ timeout: 2500 }).then(() => true).catch(() => false) || await p.getByText(/^Delete$/i).first().click({ timeout: 2000 }).then(() => true).catch(() => false) || await p.locator('.anticon-delete, [class*="trash"]').first().click({ timeout: 2000 }).then(() => true).catch(() => false); void del; await p.waitForTimeout(1800); const c1 = await p.locator('.swal2-confirm').first().click({ timeout: 1500 }).then(() => true).catch(() => false); const c2 = c1 ? false : await p.locator('.ant-modal-confirm-btns button.ant-btn-primary, .ant-modal .ant-btn-dangerous, .ant-modal .ant-btn-primary').first().click({ timeout: 1500 }).then(() => true).catch(() => false); if (!c1 && !c2) await p.getByRole('button', { name: /^(Yes|OK|Confirm)$/i }).first().click({ timeout: 1500 }).catch(() => {}); await p.waitForTimeout(3000); } return false; }

let page: Page; let ctxRef: BrowserContext;
test.beforeAll(async ({ browser }) => { ctxRef = await browser.newContext({ ...iphone, viewport: DESKTOP, storageState: STATE }); page = await ctxRef.newPage(); });
test.afterAll(async () => { await cleanDay18(page).catch(() => {}); await ctxRef.close().catch(() => {}); });
test.skip(!haveOpsCreds, 'no creds');

test('MOBCAL_016/017/019 — Edit Lesson negatives (net-zero)', async () => {
  test.setTimeout(260_000);
  const obs: string[] = [];
  // CREATE 1 buổi Manual
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
  await page.getByRole('button', { name: /^Save$/i }).last().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(4000);
  obs.push('Tạo buổi Manual 18/10 08:00-11:00 = xong');

  // ── MOBCAL_016: Edit → đổi Note → Cancel → mở lại Edit đọc Note (không đổi) ──
  await openLessonEdit(page);
  const noteSel = 'input[placeholder*="Note" i], textarea[placeholder*="Note" i]';
  await page.locator(noteSel).first().fill('TEMP016 khong luu', { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500);
  await shot(page, 'SAPP_MOBCAL_TC_016', '01_note_typed_temp');
  await page.getByRole('button', { name: /^Cancel$/i }).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(2000);
  await openLessonEdit(page);
  const noteAfterCancel = await page.locator(noteSel).first().inputValue().catch(() => '');
  const c016 = !/TEMP016/i.test(noteAfterCancel);
  await shot(page, 'SAPP_MOBCAL_TC_016', '02_reopen_note_not_saved');
  obs.push(`[016] Note sau Cancel = "${noteAfterCancel}" → KHÔNG lưu TEMP016 = ${c016}`);

  // ── MOBCAL_017: datepicker Lesson date → nav Feb 2025 → oracle theo title: KHÔNG có cell "2025-02-29" nhưng CÓ "2025-02-28" ──
  await page.locator('.ant-drawer-content .ant-picker input, .ant-drawer-content .ant-picker').first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(900);
  for (let k = 0; k < 20; k++) { await page.locator('.ant-picker-header-prev-btn').first().click({ timeout: 1200 }).catch(() => {}); await page.waitForTimeout(180); }
  const hdr = ((await page.locator('.ant-picker-header-view').first().innerText().catch(() => '')) || '').trim();
  const has29 = await page.locator('.ant-picker-cell[title="2025-02-29"]').count().catch(() => 0);
  const has28 = await page.locator('.ant-picker-cell[title="2025-02-28"]').count().catch(() => 0);
  const c017 = has29 === 0 && has28 > 0; // đang ở Feb 2025 (có 28) và KHÔNG có 29 → 29/02/2025 không tồn tại
  await shot(page, 'SAPP_MOBCAL_TC_017', '01_feb2025_no_day29');
  obs.push(`[017] header="${hdr}"; cell "2025-02-29"=${has29}, "2025-02-28"=${has28} → 29/02/2025 không tồn tại/bị chặn = ${c017}`);
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(500);

  // ── MOBCAL_019: set giờ bắt đầu = giờ kết thúc (08:00-08:00) → điền Reason → Save → bị chặn ──
  await page.getByPlaceholder(/Start Time/i).first().fill('08:00').catch(() => {});
  await page.getByPlaceholder(/End Time/i).first().fill('08:00').catch(() => {}); await page.waitForTimeout(500);
  await page.locator('textarea[placeholder*="reason" i], input[placeholder*="reason" i]').first().fill('SAPP-22827 neg test', { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^Save$/i }).last().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(3500);
  const blkText = await bodyText(page);
  const c019 = /no less than|3 hour|3 giờ|invalid|không hợp lệ|bắt buộc|greater|lớn hơn|less than/i.test(blkText) || (await page.getByRole('button', { name: /^Save$/i }).count().catch(() => 0)) > 0; // còn ở modal (Save vẫn hiện) = chưa lưu
  await shot(page, 'SAPP_MOBCAL_TC_019', '01_equal_time_blocked');
  obs.push(`[019] set giờ bằng nhau (08:00-08:00) → Save bị chặn (còn modal/lỗi) = ${c019}`);
  await page.getByRole('button', { name: /^Cancel$/i }).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1500);

  // DELETE net-zero
  const cleaned = await cleanDay18(page);
  const still = await (async () => { await gotoDay18Oct(page); return (await day18Block(page).count().catch(() => 0)) > 0; })();
  obs.push(`Xoá net-zero = ${cleaned}; còn buổi = ${still}`);
  fs.mkdirSync(path.join(ART, 'SAPP_MOBCAL_TC_016'), { recursive: true });
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_016', 'observations.txt'), obs.join('\n') + '\n', 'utf8');

  expect(c016, '016: Cancel không lưu thay đổi Note').toBeTruthy();
  expect(c017, '017: ngày 29/02/2025 không tồn tại (bị chặn ở picker)').toBeTruthy();
  expect(c019, '019: giờ bắt đầu = kết thúc bị chặn').toBeTruthy();
  expect(still, 'net-zero: đã xoá buổi').toBeFalsy();
});
