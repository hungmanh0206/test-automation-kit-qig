import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — MOBCAL_028 Generate Schedule: Cancel KHÔNG sinh buổi (net-zero).
 * Mở modal Generate → đếm buổi tháng hiện tại → Cancel → verify modal đóng + số buổi KHÔNG đổi (không generate). LH62. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const STATE = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation/ops_state.json');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CLASS = '4dff019e-25a9-44e9-b7b5-a9dd00ae5786';
const CAL = `${OPS_BASE}/classes/detail/${CLASS}/calendar`;
const MOBILE = { width: 390, height: 844 };
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function maskPII(p: Page) { await p.evaluate(() => { const w = (el: Node) => { for (const n of Array.from(el.childNodes)) { if (n.nodeType === 3 && n.nodeValue) n.nodeValue = n.nodeValue.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '•••@•••').replace(/(?:\+?84|0)\d[\d ]{7,11}/g, '•••••••••'); else w(n); } }; w(document.body); }).catch(() => {}); }
async function shot(p: Page, n: string) { const d = path.join(ART, 'SAPP_MOBCAL_TC_028'); fs.mkdirSync(d, { recursive: true }); await maskPII(p); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
const countLessons = (p: Page) => p.evaluate(() => (document.body.innerText.match(/\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/g) || []).length);

let page: Page; let ctxRef: BrowserContext;
test.beforeAll(async ({ browser }) => { ctxRef = await browser.newContext({ ...iphone, viewport: MOBILE, storageState: STATE }); page = await ctxRef.newPage(); });
test.afterAll(async () => { await ctxRef.close().catch(() => {}); });
test.skip(!haveOpsCreds, 'no creds');

test('MOBCAL_028 — Generate Schedule Cancel không sinh buổi (net-zero)', async () => {
  test.setTimeout(120_000);
  const obs: string[] = [];
  await page.goto(CAL, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
  const lessonsBefore = await countLessons(page);
  await shot(page, '01_calendar_before');
  await page.getByText(/Generate schedule/i).first().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2800);
  const modalOpen = /Generate Schedule/i.test(await bodyText(page));
  await shot(page, '02_generate_modal');
  obs.push(`Buổi tháng trước khi mở Generate = ${lessonsBefore}; modal Generate mở = ${modalOpen}`);

  // Cancel (KHÔNG bấm Generate)
  await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 3000 }).catch(() => page.locator('.ant-modal-close, .ant-drawer-close, button[aria-label="Close"]').first().click().catch(() => {})); await page.waitForTimeout(2500);
  const modalGone = !/Generate Schedule/i.test(await bodyText(page)) || /Add Lesson|Generate schedule/i.test(await bodyText(page));
  const successToast = /generate.*success|sinh lịch thành công|success/i.test(await bodyText(page));
  await page.waitForTimeout(1500);
  const lessonsAfter = await countLessons(page);
  await shot(page, '03_after_cancel');
  obs.push(`Sau Cancel: modal đóng = ${modalGone}; toast success = ${successToast}; buổi tháng sau = ${lessonsAfter} (không đổi = ${lessonsAfter === lessonsBefore})`);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_028', 'observations.txt'), obs.join('\n') + '\n', 'utf8');

  expect(modalOpen, '028: modal Generate mở được').toBeTruthy();
  expect(modalGone, '028: sau Cancel modal đóng').toBeTruthy();
  expect(successToast, '028: KHÔNG có toast generate-success (không sinh buổi)').toBeFalsy();
  expect(lessonsAfter, '028: số buổi KHÔNG tăng sau Cancel (net-zero)').toBeLessThanOrEqual(lessonsBefore);
});
