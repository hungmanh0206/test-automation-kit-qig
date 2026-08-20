import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — MOBCAL_015 Edit Lesson (net-zero create→edit→verify→delete).
 * Tạo buổi Manual (LH62 18/10, 08:00-11:00) → mở → Edit → đổi Note → Save → verify Note persisted → xoá (loop swal2).
 * Buổi Manual (Offline) nên KHÔNG có banner "Automatic Schedule" như spec — phần đó cần buổi generate (ghi chú).
 * Form ở DESKTOP viewport; open/verify/delete ở MOBILE. Mask PII. afterAll loop-delete chống orphan. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const STATE = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation/ops_state.json');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CLASS = '4dff019e-25a9-44e9-b7b5-a9dd00ae5786';
const CAL = `${OPS_BASE}/classes/detail/${CLASS}/calendar`;
const DESKTOP = { width: 1440, height: 900 }; const MOBILE = { width: 390, height: 844 };
const TC = 'SAPP_MOBCAL_TC_015';
const NOTE_NEW = 'SAPP22827 EDIT Doi hinh thuc';
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function maskPII(p: Page) { await p.evaluate(() => { const w = (el: Node) => { for (const n of Array.from(el.childNodes)) { if (n.nodeType === 3 && n.nodeValue) n.nodeValue = n.nodeValue.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '•••@•••').replace(/(?:\+?84|0)\d[\d ]{7,11}/g, '•••••••••'); else w(n); } }; w(document.body); }).catch(() => {}); }
async function shot(p: Page, n: string) { const d = path.join(ART, TC); fs.mkdirSync(d, { recursive: true }); await maskPII(p); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
async function openCC(p: Page) { await p.evaluate(() => { const lbl = Array.from(document.querySelectorAll('*')).find((e) => e.children.length === 0 && (e.textContent || '').trim() === 'Course Content'); let box: any = lbl; for (let i = 0; i < 4; i++) { if (box?.parentElement?.querySelector('button,svg,i')) { box = box.parentElement; break; } box = box?.parentElement || box; } (box.querySelector('button,i.ki-down,svg') as HTMLElement)?.click(); }); await p.waitForTimeout(1500); }

async function gotoDay18Oct(p: Page) {
  await p.setViewportSize(MOBILE);
  await p.goto(CAL, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
  for (let m = 0; m < 8; m++) { const cur = ((await p.getByText(/,\s*\d{4}$/).first().innerText().catch(() => '')) || '').trim(); if (/^October,\s*2026$/i.test(cur)) break; const lb = await p.getByText(/,\s*\d{4}$/).first().boundingBox(); if (lb) await p.mouse.click(lb.x + lb.width + 22, lb.y + lb.height / 2); await p.waitForTimeout(700); }
  await p.getByText(/^18$/).last().click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(2000);
}
async function day18Block(p: Page) { return p.locator('text=/\\d{1,2}:\\d{2}\\s*[-–]\\s*\\d{1,2}:\\d{2}/').first(); }
async function cleanDay18(p: Page, max = 6): Promise<boolean> {
  for (let i = 0; i < max; i++) {
    await gotoDay18Oct(p);
    const b = await day18Block(p);
    if (!(await b.count().catch(() => 0))) return true;
    await b.click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(2500);
    if (!/Delete/i.test(await bodyText(p))) continue;
    await p.getByRole('button', { name: /^Delete$/i }).first().click({ timeout: 3000 }).catch(() => p.getByText(/^Delete$/i).first().click().catch(() => {})); await p.waitForTimeout(1500);
    const sw = await p.locator('.swal2-confirm').first().click({ timeout: 2500 }).then(() => true).catch(() => false);
    if (!sw) await p.getByRole('button', { name: /^(Yes|OK)$/i }).first().click({ timeout: 2000 }).catch(() => {});
    await p.waitForTimeout(3000);
  }
  return false;
}

let page: Page; let ctxRef: BrowserContext;
test.beforeAll(async ({ browser }) => { ctxRef = await browser.newContext({ ...iphone, viewport: DESKTOP, storageState: STATE }); page = await ctxRef.newPage(); });
test.afterAll(async () => { await cleanDay18(page).catch(() => {}); await ctxRef.close().catch(() => {}); });
test.skip(!haveOpsCreds, 'no creds');

test('MOBCAL_015 — Edit Lesson net-zero (create→edit Note→save→verify→delete)', async () => {
  test.setTimeout(260_000);
  const obs: string[] = [];

  // ── 1) CREATE buổi Manual (LM+date+time+leaf+teacher+classroom+Save ≥3h) ──
  await page.setViewportSize(DESKTOP);
  await page.goto(CAL, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
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
  await page.getByRole('button', { name: /^Add$/i }).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(2000);
  await page.getByText(/Add classroom/i).first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(2500);
  await page.locator('input[type="radio"]').first().check({ timeout: 3000, force: true }).catch(() => {}); await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^Add$/i }).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /^Save$/i }).last().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(4000);
  await shot(page, '01_created');
  obs.push('Tạo buổi Manual 18/10 08:00-11:00 (teacher+classroom) = xong');

  // ── 2) VERIFY buổi trên lịch + MỞ ──
  await gotoDay18Oct(page);
  const block = await day18Block(page);
  const created = (await block.count().catch(() => 0)) > 0;
  obs.push(`Buổi hiện trên lịch 18/10 = ${created}`);
  expect(created, 'phải tạo được buổi rồi mới edit').toBeTruthy();
  await block.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(2500);
  await shot(page, '02_lesson_view_modal');
  const viewText = (await bodyText(page)).replace(/\s+/g, ' ');
  const hasEditBtn = await page.getByRole('button', { name: /^Edit$/i }).count().catch(() => 0);
  obs.push(`Modal buổi mở; có nút Edit = ${hasEditBtn}; tiêu đề/View chứa "Lesson" = ${/Lesson/i.test(viewText)}`);

  // ── 3) EDIT: bật Edit mode → đổi Note → Save ──
  if (hasEditBtn) { await page.getByRole('button', { name: /^Edit$/i }).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(2500); }
  await shot(page, '03_edit_mode');
  const noteBox = page.locator('input[placeholder*="Note" i], textarea[placeholder*="Note" i]').first();
  const hasNote = (await noteBox.count().catch(() => 0)) > 0;
  await noteBox.fill(NOTE_NEW, { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500);
  // Edit Lesson YÊU CẦU field bắt buộc "Reason for change" (audit) — phải điền mới Save được
  const reasonBox = page.locator('textarea[placeholder*="reason" i], input[placeholder*="reason" i]').first();
  const hasReason = (await reasonBox.count().catch(() => 0)) > 0;
  await reasonBox.fill('SAPP-22827 automation edit test', { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500);
  await shot(page, '04_note_and_reason_changed');
  await page.getByRole('button', { name: /^Save$/i }).last().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(4500);
  const saveErr = /required|bắt buộc|vui lòng|invalid|không hợp lệ|no less than|enter reason|Please enter/i.test(await bodyText(page));
  await shot(page, '05_after_save_edit');
  obs.push(`Edit: field Note = ${hasNote}; field "Reason for change" (bắt buộc) = ${hasReason}; nhập Note+Reason; Save còn lỗi = ${saveErr}`);

  // ── 4) VERIFY Note persisted: mở lại buổi → View Detail (KHÔNG show Note) → bấm Edit → đọc value Note ──
  await gotoDay18Oct(page);
  const block2 = await day18Block(page);
  await block2.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(2500);
  const teacherPersist = /Lê Văn B/i.test(await bodyText(page)); // teacher gán vẫn còn (view detail)
  await shot(page, '06_reopen_view_detail');
  await page.getByRole('button', { name: /^Edit$/i }).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(2500);
  const noteVal = await page.locator('input[placeholder*="Note" i], textarea[placeholder*="Note" i]').first().inputValue().catch(() => '');
  const notePersisted = /Doi hinh thuc|SAPP22827/i.test(noteVal);
  await shot(page, '06b_reopen_edit_note_value');
  obs.push(`Verify sau Save: teacher "Lê Văn B" persist=${teacherPersist}; Note value khi mở Edit lại = "${noteVal}" → persisted=${notePersisted}`);
  // đóng edit (không lưu thêm) trước khi delete
  await page.getByRole('button', { name: /^Cancel$/i }).last().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(1000);

  // ── 5) DELETE net-zero (loop swal2) ──
  const cleaned = await cleanDay18(page);
  const stillThere = await (async () => { await gotoDay18Oct(page); return (await (await day18Block(page)).count().catch(() => 0)) > 0; })();
  await shot(page, '07_after_delete_empty');
  obs.push(`Xoá net-zero (loop) = ${cleaned}; còn buổi = ${stillThere}`);

  obs.push('OBSERVATION 1: Edit Lesson yêu cầu field bắt buộc "Reason for change" (audit) — spec canonical không nêu.');
  obs.push('OBSERVATION 2: modal "View Detail" (đọc) KHÔNG hiển thị field Note — Note chỉ hiện ở Edit mode.');
  fs.writeFileSync(path.join(ART, TC, 'observations.txt'), obs.join('\n') + '\n', 'utf8');

  expect(hasEditBtn, '015: modal buổi có nút Edit').toBeGreaterThan(0);
  expect(hasNote, '015: Edit mode có field Note sửa được').toBeTruthy();
  expect(hasReason, '015: Edit mode có field bắt buộc "Reason for change"').toBeTruthy();
  expect(saveErr, '015: Save Edit không lỗi (đã điền Reason)').toBeFalsy();
  expect(notePersisted, '015: Note sửa persist sau Save (mở Edit lại đọc value)').toBeTruthy();
  expect(stillThere, '015: net-zero — sau delete không còn buổi').toBeFalsy();
});
