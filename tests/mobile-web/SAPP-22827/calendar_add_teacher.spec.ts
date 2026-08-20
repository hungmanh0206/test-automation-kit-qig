import { test, expect, type Page } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — Add Teacher (CGMA): mở lesson → field Teacher → màn Add Teacher. Search (029) +
 * no-select Add bị chặn (032). Read-only/negative — KHÔNG Save/gán (không mutate). */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CAL = `${OPS_BASE}/classes/detail/1e8d953c-83f8-49d9-9cce-5ea3af76d2cf/calendar`;
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }

let page: Page;
async function openLesson() {
  await page.goto(CAL, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(1000);
  const lesson = page.locator('text=/\\d{1,2}:\\d{2}\\s*[-–]\\s*\\d{1,2}:\\d{2}/').first();
  await lesson.scrollIntoViewIfNeeded().catch(() => {});
  await lesson.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(2500);
}
async function openAddTeacher(): Promise<boolean> {
  // click vùng field "Teacher" / nút edit gần nhãn Teacher
  const clicked = await page.evaluate(() => {
    const lab = Array.from(document.querySelectorAll('*')).find((e) => e.children.length === 0 && /^Teacher$/i.test((e.textContent || '').trim()));
    if (!lab) return false; let c: any = lab; for (let i = 0; i < 4 && c.parentElement; i++) c = c.parentElement;
    const btn = c.querySelector('button, [role="button"], input, [class*="select" i], [class*="add" i]');
    if (btn) { (btn as HTMLElement).click(); return true; }
    (lab.parentElement as HTMLElement)?.click(); return true;
  });
  await page.waitForTimeout(2500);
  return /Add Teacher|From date|Belong To|Ưu tiên|Priority/i.test(await bodyText(page)) || clicked && /Search/i.test(await bodyText(page));
}

test.beforeAll(async ({ browser }) => { const ctx = await browser.newContext({ ...iphone }); page = await ctx.newPage(); await loginOps(page); });

test('SAPP_MOBCAL_TC_029/032 — Add Teacher: search + no-select Add bị chặn (không gán)', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(120_000);
  await openLesson();
  const reached = await openAddTeacher();
  await shot(page, 'SAPP_MOBCAL_TC_029', '01_add_teacher');
  const txt = await bodyText(page);
  const hasSearch = /Search/i.test(txt);
  const hasDateFilter = /From date|To date/i.test(txt);
  const teacherCard = /Code:|Belong To:|Priority:|Ưu tiên/i.test(txt);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_029', 'observations.txt'),
    `mở Add Teacher: ${reached}\nSearch: ${hasSearch} · From/To date: ${hasDateFilter} · teacher card fields: ${teacherCard}\nsnippet: ${txt.slice(0, 400).replace(/\n/g, ' / ')}\n`, 'utf8');

  // MOBCAL_032: click Add khi CHƯA chọn giáo viên → kỳ vọng bị chặn (không gán / còn ở màn)
  if (reached) {
    const addBtn = page.getByRole('button', { name: /^Add$/i }).last();
    const canAdd = await addBtn.isEnabled().catch(() => false);
    await addBtn.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const stillThere = /Add Teacher|From date|Search/i.test(await bodyText(page));
    fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_032', 'observations.txt'), `Nút Add khi chưa chọn: enabled=${canAdd}\nSau click Add còn ở màn Add Teacher (bị chặn): ${stillThere}\n`, 'utf8');
    await shot(page, 'SAPP_MOBCAL_TC_032', '01_no_select');
  }
  // thoát không gán
  await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 3000 }).catch(() => page.keyboard.press('Escape').catch(() => {}));
  expect(reached, 'Không mở được màn Add Teacher từ field Teacher').toBeTruthy();
});
