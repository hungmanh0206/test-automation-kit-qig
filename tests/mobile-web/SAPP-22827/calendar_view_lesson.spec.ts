import { test, expect, type Page } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — View Lesson (read-only) trên CGMA (buổi ngày 27-31). Mở modal → verify banner+field → Cancel.
 * + recon entry Add Teacher (field Teacher trong modal). KHÔNG mutate. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CAL = `${OPS_BASE}/classes/detail/1e8d953c-83f8-49d9-9cce-5ea3af76d2cf/calendar`;
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }

let page: Page;
test.beforeAll(async ({ browser }) => { const ctx = await browser.newContext({ ...iphone }); page = await ctx.newPage(); await loginOps(page); });

test('SAPP_MOBCAL_TC_014 — View Lesson read-only (CGMA): mở buổi, banner + field', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(120_000);
  await page.goto(CAL, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(1200);
  await shot(page, 'SAPP_MOBCAL_TC_014', '01_scrolled');

  // oracle "modal buổi mở" = banner Manual/Automatic HOẶC ≥3 field lesson (tiêu đề build không phải "View/Edit Lesson")
  const lessonModalOpen = async () => { const t = await bodyText(page); const f = ['Learning Mode', 'Start Time', 'End Time', 'Course Content', 'Teacher', 'Classroom'].filter((l) => t.includes(l)).length; return /Manual Schedule|Automatic Schedule/i.test(t) || f >= 3; };
  let opened = false;
  const lesson = page.locator('text=/\\d{1,2}:\\d{2}\\s*[-–]\\s*\\d{1,2}:\\d{2}/').first();
  if (await lesson.count().catch(() => 0)) {
    await lesson.scrollIntoViewIfNeeded().catch(() => {});
    await lesson.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2500);
    opened = await lessonModalOpen();
  }
  if (!opened) {
    for (const d of ['31', '30', '29', '28', '27']) {
      const cell = page.getByText(new RegExp(`^${d}$`)).last();
      await cell.scrollIntoViewIfNeeded().catch(() => {});
      await cell.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1800);
      if (await lessonModalOpen()) { opened = true; break; }
    }
  }
  await page.waitForTimeout(500);
  await shot(page, 'SAPP_MOBCAL_TC_014', '02_lesson_modal');
  const txt = await bodyText(page);
  const isModal = opened;
  const banner = /Manual Schedule|Automatic Schedule/i.test(txt);
  const fields = ['Learning Mode', 'Lesson Date', 'Start Time', 'End Time', 'Course Content', 'Teacher', 'Classroom'].filter((l) => txt.includes(l));
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_014', 'observations.txt'),
    `mở modal: ${isModal}\nbanner Manual/Automatic: ${banner}\nfields: ${fields.join(', ')}\nAdd-Teacher entry (field Teacher): ${txt.includes('Teacher')}\n`, 'utf8');
  await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 3000 }).catch(() => page.keyboard.press('Escape').catch(() => {}));
  expect(isModal, 'Không mở được modal View/Edit Lesson (buổi CGMA)').toBeTruthy();
  expect(fields.length >= 2, 'Modal lesson thiếu field').toBeTruthy();
});
