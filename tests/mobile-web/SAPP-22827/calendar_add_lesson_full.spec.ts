import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — MOBCAL_020 Add Lesson full net-zero (LH62 4dff019e, Offline) + Add Teacher screen (029/031).
 * CHÌA KHOÁ: LM → date → time → tick leaf CC → Teacher enable. Form ở DESKTOP viewport; verify/delete ở MOBILE (nav reliable).
 * afterAll: quét-xoá mọi buổi 08:00-11:00 (chống orphan). Mask PII. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const STATE = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation/ops_state.json');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CLASS = '4dff019e-25a9-44e9-b7b5-a9dd00ae5786';
const CAL = `${OPS_BASE}/classes/detail/${CLASS}/calendar`;
const DESKTOP = { width: 1440, height: 900 }; const MOBILE = { width: 390, height: 844 };
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function maskPII(p: Page) { await p.evaluate(() => { const w = (el: Node) => { for (const n of Array.from(el.childNodes)) { if (n.nodeType === 3 && n.nodeValue) n.nodeValue = n.nodeValue.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '•••@•••').replace(/(?:\+?84|0)\d{8,10}/g, '•••••••••'); else w(n); } }; w(document.body); }).catch(() => {}); }
async function shot(p: Page, n: string) { const d = path.join(ART, 'SAPP_MOBCAL_TC_020'); fs.mkdirSync(d, { recursive: true }); await maskPII(p); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
async function openCC(p: Page) { await p.evaluate(() => { const lbl = Array.from(document.querySelectorAll('*')).find((e) => e.children.length === 0 && (e.textContent || '').trim() === 'Course Content'); let box: any = lbl; for (let i = 0; i < 4; i++) { if (box?.parentElement?.querySelector('button,svg,i')) { box = box.parentElement; break; } box = box?.parentElement || box; } (box.querySelector('button,i.ki-down,svg') as HTMLElement)?.click(); }); await p.waitForTimeout(1500); }
// MOBILE nav-by-LABEL tới October 2026 → tap ngày 18. Trả về locator body sẵn sàng đọc.
async function gotoDay18Oct(p: Page): Promise<void> {
  await p.setViewportSize(MOBILE);
  await p.goto(CAL, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
  for (let m = 0; m < 8; m++) { const cur = ((await p.getByText(/,\s*\d{4}$/).first().innerText().catch(() => '')) || '').trim(); if (/^October,\s*2026$/i.test(cur)) break; const lb = await p.getByText(/,\s*\d{4}$/).first().boundingBox(); if (lb) await p.mouse.click(lb.x + lb.width + 22, lb.y + lb.height / 2); await p.waitForTimeout(700); }
  await p.getByText(/^18$/).last().click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(2000);
}
// Verify read-only: buổi có block giờ ở ngày 18 không (KHÔNG xoá).
async function day18HasLesson(p: Page): Promise<boolean> {
  await gotoDay18Oct(p);
  return (await p.locator('text=/\\d{1,2}:\\d{2}\\s*[-–]\\s*\\d{1,2}:\\d{2}/').first().count().catch(() => 0)) > 0;
}
// LOOP-until-empty delete (single-shot swal2 flaky sau form nặng → phải lặp; proven ở _cleanup.oct18b).
async function cleanDay18(p: Page, max = 6): Promise<{ cleaned: boolean; rounds: number }> {
  for (let iter = 0; iter < max; iter++) {
    await gotoDay18Oct(p);
    const block = p.locator('text=/\\d{1,2}:\\d{2}\\s*[-–]\\s*\\d{1,2}:\\d{2}/').first();
    if (!(await block.count().catch(() => 0))) return { cleaned: true, rounds: iter };
    await block.click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(2500);
    if (!/Delete/i.test(await bodyText(p))) continue;
    await p.getByRole('button', { name: /^Delete$/i }).first().click({ timeout: 3000 }).catch(() => p.getByText(/^Delete$/i).first().click().catch(() => {}));
    await p.waitForTimeout(1500);
    const swal = await p.locator('.swal2-confirm').first().click({ timeout: 2500 }).then(() => true).catch(() => false);
    if (!swal) await p.getByRole('button', { name: /^(Yes|OK)$/i }).first().click({ timeout: 2000 }).catch(() => {});
    await p.waitForTimeout(3000);
  }
  return { cleaned: false, rounds: max };
}

let page: Page; let ctxRef: BrowserContext;
test.beforeAll(async ({ browser }) => { ctxRef = await browser.newContext({ ...iphone, viewport: DESKTOP, storageState: STATE }); page = await ctxRef.newPage(); });
test.afterAll(async () => { await cleanDay18(page).catch(() => {}); await ctxRef.close().catch(() => {}); }); // chống orphan (loop-until-empty)
test.skip(!haveOpsCreds, 'no creds');

test('SAPP_MOBCAL_TC_020 — Add Lesson full net-zero + Add Teacher screen', async () => {
  test.setTimeout(220_000);
  const obs: string[] = [];
  await page.setViewportSize(DESKTOP);
  await page.goto(CAL, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  await page.getByText(/Add Lesson/i).first().click({ timeout: 6000 }); await page.waitForTimeout(2500);
  // 1) LM
  await page.locator('input[type="search"][readonly]').first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(700);
  await page.locator('.ant-select-item-option').first().click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(500);
  // 2) date → datepicker next ×3 → day 18
  await page.getByPlaceholder(/Select date/i).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(700);
  for (let i = 0; i < 3; i++) { await page.locator('.ant-picker-header-next-btn').first().click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(400); }
  await page.locator('.ant-picker-cell-in-view:not(.ant-picker-cell-disabled)').filter({ hasText: /^18$/ }).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(600);
  const dateVal = await page.evaluate(() => { const i = Array.from(document.querySelectorAll('input')).find((x) => /\d{2}\/\d{2}\/\d{4}/.test((x as HTMLInputElement).value || '')); return i ? (i as HTMLInputElement).value : ''; });
  obs.push(`Lesson date = ${dateVal}`);
  // 3) time 08:00-11:00 (chữ ký để dọn)
  await page.getByPlaceholder(/Start Time/i).first().fill('08:00').catch(() => {});
  await page.getByPlaceholder(/End Time/i).first().fill('11:00').catch(() => {}); await page.waitForTimeout(400);
  // 4) CC leaf
  await openCC(page);
  await page.locator('.ant-drawer-content input[type="checkbox"].cursor-pointer, input[type="checkbox"].cursor-pointer').nth(3).click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(2500);
  const teacherEnabled = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find((x) => /Add teacher/i.test(x.textContent || '')) as HTMLButtonElement | undefined; return b ? !b.disabled : false; });
  obs.push(`Teacher enable sau LM+date+time+leaf = ${teacherEnabled}`); await shot(page, '01_teacher_enabled');
  expect(teacherEnabled, 'CHÌA KHOÁ: Teacher phải enable').toBeTruthy();
  // 5) Teacher: +Add teacher → radio + Add  [MOBCAL_029/031]
  await page.getByText(/Add teacher/i).first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(2500);
  const teacherScreen = /Add Teacher/i.test(await bodyText(page)) && (await page.locator('input[type="radio"]').count()) > 0;
  await shot(page, '02_add_teacher_screen');
  await page.locator('input[type="radio"]').first().check({ timeout: 3000, force: true }).catch(() => {}); await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^Add$/i }).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(2000);
  obs.push(`Màn Add Teacher (search+radio) = ${teacherScreen}`); await shot(page, '03_teacher_added');
  // 6) Classroom: +Add classroom → radio + Add
  await page.getByText(/Add classroom/i).first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(2500);
  await shot(page, '04_classroom_screen');
  await page.locator('input[type="radio"]').first().check({ timeout: 3000, force: true }).catch(() => {}); await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^Add$/i }).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(2000);
  await shot(page, '05_classroom_added');
  // 7) Save
  await page.getByRole('button', { name: /^Save$/i }).last().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(4000);
  const saveErr = /required|bắt buộc|vui lòng|invalid|không hợp lệ/i.test(await bodyText(page));
  await shot(page, '06_after_save'); obs.push(`Save còn lỗi required = ${saveErr}`);
  // 8) VERIFY create (read-only, chụp evidence buổi trên lịch) → CLEAN (loop) → VERIFY net-zero
  const created = await day18HasLesson(page); await shot(page, '07_lesson_on_calendar');
  obs.push(`Buổi tạo hiện trên lịch ngày 18/10 (verify read-only) = ${created}`);
  const clean = await cleanDay18(page);
  obs.push(`Đã xoá net-zero (loop) = ${clean.cleaned} sau ${clean.rounds} vòng`);
  const stillThere = await day18HasLesson(page); await shot(page, '08_after_delete_empty');
  obs.push(`Verify net-zero: còn buổi ngày 18/10 = ${stillThere}`);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_020', 'observations.txt'), obs.join('\n') + '\n', 'utf8');
  expect(created, 'Add Lesson phải tạo được buổi trên lịch rồi mới net-zero').toBeTruthy();
  expect(clean.cleaned, 'net-zero: buổi phải xoá được sạch (loop)').toBeTruthy();
  expect(stillThere, 'net-zero: sau delete KHÔNG còn buổi ngày 18/10').toBeFalsy();
});
