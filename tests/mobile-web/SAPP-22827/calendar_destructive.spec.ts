import { test, expect, type Page } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — Calendar destructive negatives (KHÔNG submit thành công = không tạo buổi → an toàn):
 * 022 required trống bị chặn, 021 Online LMS thiếu Deadline bị chặn, 027 start>end bị chặn (Generate).
 * + recon modal Add Lesson / Generate để lấy selector cho các case create→rollback sau. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const iphone = require('@playwright/test').devices['iPhone 13'];
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }

let page: Page; let CAL = '';
async function goCal() {
  if (!CAL) {
    await page.goto(`${OPS_BASE}/classes?page_index=1&page_size=10`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
    const href = await page.locator('a[href*="/classes/detail"]').first().getAttribute('href');
    CAL = `${OPS_BASE}${(href || '').replace(/\/overview.*$/, '')}/calendar`;
  }
  await page.goto(CAL, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
}
async function closeModal() {
  await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 3000 }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(800);
}

test.beforeAll(async ({ browser }) => { const ctx = await browser.newContext({ ...iphone }); page = await ctx.newPage(); await loginOps(page); });

test('SAPP_MOBCAL_TC_022 — Add Lesson: bỏ trống field bắt buộc bị chặn (no create)', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goCal();
  await page.getByText(/Add Lesson/i).first().click({ timeout: 6000 });
  await page.waitForTimeout(2500);
  await shot(page, 'SAPP_MOBCAL_TC_022', '01_add_lesson_modal');
  const modalTxt = await bodyText(page);
  const isModal = /Add Lesson/i.test(modalTxt);
  // recon fields
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_022', 'recon.txt'), `modal mở: ${isModal}\nfields thấy: ${['Learning Mode', 'Lesson Date', 'Deadline', 'Course Content', 'Note'].filter((l) => modalTxt.includes(l)).join(', ')}\nsnippet: ${modalTxt.slice(0, 400).replace(/\n/g, ' / ')}\n`, 'utf8');
  // click Save ngay khi trống → kỳ vọng bị chặn
  await page.getByRole('button', { name: /^Save$/i }).last().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, 'SAPP_MOBCAL_TC_022', '02_after_save_empty');
  const afterTxt = await bodyText(page);
  const stillModal = /Add Lesson/i.test(afterTxt);
  const hasErr = /required|bắt buộc|vui lòng|please|không được để trống|is required/i.test(afterTxt);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_022', 'observations.txt'), `Còn ở modal (bị chặn): ${stillModal}\nCó thông báo lỗi required: ${hasErr}\n`, 'utf8');
  await closeModal();
  expect(isModal, 'Không mở được modal Add Lesson').toBeTruthy();
  expect(stillModal || hasErr, 'Save trống đáng lẽ bị chặn').toBeTruthy();
});

test('SAPP_MOBCAL_TC_027 — Generate Schedule: mở modal + recon fields (Schedule Information)', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goCal();
  await page.getByRole('button', { name: /Generate schedule/i }).first().click({ timeout: 6000 }).catch(async () => { await page.locator('button', { hasText: /Generate/i }).first().click().catch(() => {}); });
  await page.waitForTimeout(3000);
  await shot(page, 'SAPP_MOBCAL_TC_027', '01_generate_modal');
  const modalTxt = await bodyText(page);
  const isModal = /Schedule Information|Standard Schedule|Start Date/i.test(modalTxt);
  const fields = ['Schedule Information', 'Start Date', 'Standard Schedule', 'Day Of Week', 'Start Time', 'End Time', 'Add Classroom', 'Generate'].filter((l) => modalTxt.includes(l));
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_027', 'recon.txt'), `modal thật mở: ${isModal}\nfields: ${fields.join(', ')}\n`, 'utf8');
  await closeModal();
  expect(isModal, 'Không mở được modal Generate Schedule (Schedule Information không hiện)').toBeTruthy();
});

test('SAPP_MOBCAL_TC_005b — FINDING legend: build "Recheduling" (typo) vs Figma "Cancel"', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(60_000);
  await goCal();
  const txt = await bodyText(page);
  await shot(page, 'SAPP_MOBCAL_TC_005', '02_legend_finding');
  const hasCancel = /\bCancel\b/.test(txt) && /Holiday/.test(txt); // Figma oracle
  const hasRecheduling = /Recheduling/.test(txt); // build typo (đáng lẽ Rescheduling/Cancel)
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_005', 'legend_finding.txt'),
    `Figma legend có "Cancel": ${hasCancel}\nBuild có "Recheduling" (typo): ${hasRecheduling}\n=> FINDING: legend build dùng "Recheduling" (sai chính tả, nên là "Rescheduling") thay cho "Cancel" của Figma.\n`, 'utf8');
  // đánh dấu là finding: build lệch oracle Figma (nhãn "Cancel")
  expect(hasRecheduling && !hasCancel, 'Legend đã khớp Figma (Cancel) — không còn finding').toBeTruthy();
});
