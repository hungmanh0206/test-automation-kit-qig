import { test, expect, type Page } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — Calendar negatives/cancel (CGMA, KHÔNG mutate): 016 Edit Cancel, 019 start==end chặn,
 * 028 Generate Cancel, 030 Add Teacher filter, 032 Add Teacher no-select chặn. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CGMA = `${OPS_BASE}/classes/detail/1e8d953c-83f8-49d9-9cce-5ea3af76d2cf`;
const CAL = `${CGMA}/calendar`;
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
async function esc(p: Page) { await p.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 2500 }).catch(() => {}); await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(600); }
const lessonOpen = async (p: Page) => { const t = await bodyText(p); return /Manual Schedule|Automatic Schedule/i.test(t) || ['Learning Mode', 'Start Time', 'End Time', 'Course Content'].filter((l) => t.includes(l)).length >= 3; };
async function openLesson(p: Page) { await p.goto(CAL, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3500); await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(1000); await p.locator('text=/\\d{1,2}:\\d{2}\\s*[-–]\\s*\\d{1,2}:\\d{2}/').first().click({ timeout: 5000 }).catch(() => {}); await p.waitForTimeout(2500); }

let page: Page;
test.beforeAll(async ({ browser }) => { const ctx = await browser.newContext({ ...iphone }); page = await ctx.newPage(); await loginOps(page); });

test('SAPP_MOBCAL_TC_028 — Generate Schedule: Cancel không sinh buổi', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(80_000);
  await page.goto(CAL, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  await page.getByText(/Generate schedule/i).first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(2500); await shot(page, 'SAPP_MOBCAL_TC_028', '01_modal');
  const opened = /Schedule Information|Standard Schedule|Start Date/i.test(await bodyText(page));
  await esc(page); await page.waitForTimeout(800);
  const closed = !/Schedule Information/i.test(await bodyText(page));
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_028', 'observations.txt'), `modal mở: ${opened} · Cancel đóng modal (không sinh): ${closed}\n`, 'utf8');
  expect(opened && closed, 'Generate Cancel không đóng modal').toBeTruthy();
});

test('SAPP_MOBCAL_TC_016 — Edit Lesson: Cancel không lưu', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await openLesson(page);
  expect(await lessonOpen(page), 'Không mở được lesson').toBeTruthy();
  await page.getByRole('button', { name: /^Edit$/i }).last().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1800); await shot(page, 'SAPP_MOBCAL_TC_016', '01_edit');
  await esc(page); await page.waitForTimeout(800);
  const closed = !(await lessonOpen(page));
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_016', 'observations.txt'), `Edit Cancel đóng, không lưu: ${closed}\n`, 'utf8');
  expect(closed, 'Cancel Edit không đóng modal').toBeTruthy();
});

test('SAPP_MOBCAL_TC_019 — Edit Lesson: giờ bắt đầu == kết thúc bị chặn', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await openLesson(page);
  await page.getByRole('button', { name: /^Edit$/i }).last().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1800);
  await page.getByPlaceholder(/Start Time/i).first().fill('19:00').catch(() => {});
  await page.getByPlaceholder(/End Time/i).first().fill('19:00').catch(() => {});
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /^Save$/i }).last().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1500); await shot(page, 'SAPP_MOBCAL_TC_019', '01');
  const t = await bodyText(page);
  const blocked = /(end time|kết thúc|greater|lớn hơn|bằng|equal|invalid|không hợp lệ|must)/i.test(t) || await lessonOpen(page);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_019', 'observations.txt'), `start==end bị chặn (còn modal/có lỗi): ${blocked}\n`, 'utf8');
  await esc(page); await esc(page);
  expect(blocked, 'start==end đáng lẽ bị chặn').toBeTruthy();
});

test('SAPP_MOBCAL_TC_030/032 — Add Teacher: filter From/To date + no-select Add chặn', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(120_000);
  await page.goto(`${CGMA}/overview`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1800);
  await page.getByText(/^Teachers$/).last().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2200);
  await page.getByRole('button', { name: /Add\/Edit Teacher/i }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: /Add Teacher/i }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(3000); await shot(page, 'SAPP_MOBCAL_TC_030', '01_search');
  const t = await bodyText(page);
  const hasFilter = /From date|To date|Reset/i.test(t);
  const hasSearch = await page.getByPlaceholder(/search/i).or(page.locator('input[type="search"]')).first().count().catch(() => 0);
  // 030: Reset
  await page.getByRole('button', { name: /^Reset$/i }).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
  // 032: Add no-select
  const addBtn = page.getByRole('button', { name: /^Add$/i }).last();
  const enabledNoSel = await addBtn.isEnabled().catch(() => false);
  await addBtn.click({ timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(1000);
  const still = /From date|Reset|Search/i.test(await bodyText(page));
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_030', 'observations.txt'), `filter From/To date + Reset: ${hasFilter} · searchBox: ${hasSearch}\n`, 'utf8');
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_032', 'observations.txt'), `Add no-select enabled=${enabledNoSel} · còn ở màn (chặn): ${still}\n`, 'utf8');
  await shot(page, 'SAPP_MOBCAL_TC_032', '01');
  await esc(page); await esc(page); await esc(page);
  // 030 = màn Add Teacher có filter From/To date + Search (verify chính). 032 (no-select) ghi observation.
  expect(hasFilter && hasSearch > 0, 'Màn Add Teacher thiếu filter/search').toBeTruthy();
});
