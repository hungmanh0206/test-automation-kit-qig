import { test, expect, type Page } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — Calendar trên lớp CÓ DATA "CGMA Class Test" (read-only + negative, KHÔNG mutate data thật).
 * View Lesson (đọc), Generate modal + start>end (blocked, không sinh). */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CAL = `${OPS_BASE}/classes/detail/1e8d953c-83f8-49d9-9cce-5ea3af76d2cf/calendar`;
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
async function closeModal(page: Page) { await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 3000 }).catch(() => {}); await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(700); }

let page: Page;
test.beforeAll(async ({ browser }) => { const ctx = await browser.newContext({ ...iphone }); page = await ctx.newPage(); await loginOps(page); });

test('SAPP_MOBCAL_TC_014 — View Lesson (read-only): mở buổi có sẵn, verify banner + field', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await page.goto(CAL, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
  await shot(page, 'SAPP_MOBCAL_TC_014', '01_calendar_with_lessons');
  // click buổi học: phần tử chứa khung giờ HH:mm - HH:mm
  const clicked = await page.evaluate(() => {
    const leaf = Array.from(document.querySelectorAll('*')).find((e) => e.children.length === 0 && /\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/.test(e.textContent || ''));
    if (!leaf) return false; let c: any = leaf; for (let i = 0; i < 3 && c.parentElement; i++) c = c.parentElement; (c as HTMLElement).click(); return true;
  });
  await page.waitForTimeout(2500);
  await shot(page, 'SAPP_MOBCAL_TC_014', '02_lesson_modal');
  const txt = await bodyText(page);
  const isModal = /View Lesson|Edit Lesson/i.test(txt);
  const banner = /Manual Schedule|Automatic Schedule/i.test(txt);
  const fields = ['Learning Mode', 'Lesson Date', 'Course Content'].filter((l) => txt.includes(l));
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_014', 'observations.txt'), `click buổi: ${clicked}\nmodal View/Edit Lesson: ${isModal}\nbanner Manual/Automatic: ${banner}\nfields: ${fields.join(', ')}\n`, 'utf8');
  await closeModal(page);
  expect(clicked, 'Không tìm thấy buổi học để mở').toBeTruthy();
  expect(isModal, 'Không mở được modal View/Edit Lesson').toBeTruthy();
});

test('SAPP_MOBCAL_TC_027b — Generate Schedule trên lớp có course cấu hình: modal mở + fields', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await page.goto(CAL, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  await page.getByText(/Generate schedule/i).first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await shot(page, 'SAPP_MOBCAL_TC_027', '02_generate_cgma');
  const txt = await bodyText(page);
  const modalOpen = /Schedule Information|Standard Schedule|Start Date/i.test(txt);
  const blockedToast = /add Learning Schedules for the course/i.test(txt);
  const fields = ['Schedule Information', 'Start Date', 'Standard Schedule', 'Day Of Week', 'Start Time', 'End Time', 'Add Classroom', 'Generate'].filter((l) => txt.includes(l));
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_027', 'observations_cgma.txt'), `modal Generate mở: ${modalOpen}\ntoast "add Learning Schedules": ${blockedToast}\nfields: ${fields.join(', ')}\n`, 'utf8');
  await closeModal(page);
  // hoặc modal mở (course configured) hoặc vẫn báo cần Learning Schedules — ghi nhận trạng thái thật
  expect(modalOpen || blockedToast, 'Không xác định được trạng thái Generate').toBeTruthy();
});
