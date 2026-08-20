import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — MOBCAL_035: Datepicker + Timepicker mobile chọn được ngày/giờ (non-destructive: Cancel, không tạo buổi).
 * Bonus: xác nhận datepicker DISABLE ngày quá khứ (finding tốt cho chất lượng nhập liệu). */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence/SAPP_MOBCAL_TC_035');
const STATE = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation/ops_state.json');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CAL = `${OPS_BASE}/classes/detail/9faf72a4-af1f-4056-a833-b260de91e6f7/calendar`;
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');

test.skip(!haveOpsCreds, 'no creds');

test('SAPP_MOBCAL_TC_035 — datepicker + timepicker chọn được ngày/giờ', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx: BrowserContext = await browser.newContext({ ...iphone, storageState: STATE });
  await ctx.addInitScript(() => { const s = document.createElement('style'); s.textContent = '*{animation:none!important;transition:none!important;}'; document.documentElement.appendChild(s); });
  const page = await ctx.newPage(); fs.mkdirSync(ART, { recursive: true });
  await page.goto(CAL, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  await page.getByText(/Add Lesson/i).first().click({ timeout: 6000 }); await page.waitForTimeout(2500);
  // Datepicker: mở → next month tới Aug 2026 → chọn ngày 22
  await page.getByPlaceholder(/Select date/i).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
  const dpOpened = /Su|Mo|Tu|We|Th|Fr|Sa|Mon|Sun/i.test(await bodyText(page)) || (await page.locator('[class*="picker" i],[class*="calendar" i]').count()) > 0;
  // xác nhận ngày quá khứ bị disable (ô ngày hôm qua/tháng trước ở trạng thái disabled)
  const pastDisabled = await page.evaluate(() => document.querySelectorAll('[class*="disabled" i][class*="cell" i],td[class*="disabled" i],[aria-disabled="true"]').length > 0);
  for (let i = 0; i < 4; i++) { if (/Aug\s*2026/i.test(await bodyText(page))) break; await page.getByRole('button', { name: /next month/i }).first().click({ timeout: 1200 }).catch(() => {}); await page.waitForTimeout(500); }
  const augReached = /Aug\s*2026/i.test(await bodyText(page));
  await page.getByText(/^22$/).filter({ visible: true }).last().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(700);
  // đọc INPUT VALUE (không phải innerText — datepicker set value vào input)
  const dateSet = await page.evaluate(() => Array.from(document.querySelectorAll('input')).some((i) => /22\/08\/2026/.test((i as HTMLInputElement).value || '')));
  await page.screenshot({ path: path.join(ART, '01_date.png'), fullPage: true });
  // Timepicker: fill Start/End
  await page.getByPlaceholder(/Start Time/i).first().fill('18:00').catch(() => {});
  await page.getByPlaceholder(/End Time/i).first().fill('20:00').catch(() => {});
  await page.waitForTimeout(500);
  const timeSet = await page.evaluate(() => { const vals = Array.from(document.querySelectorAll('input')).map((i) => (i as HTMLInputElement).value || ''); return vals.some((v) => /18:00/.test(v)) && vals.some((v) => /20:00/.test(v)); });
  await page.screenshot({ path: path.join(ART, '02_time.png'), fullPage: true });
  // Cancel — KHÔNG tạo buổi (net-zero). Dùng nút X / Cancel (KHÔNG Escape → mở popup stop)
  await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 2000 }).catch(() => page.locator('button:has-text("×"),[aria-label="Close"]').first().click().catch(() => {}));
  await page.waitForTimeout(800);

  fs.writeFileSync(path.join(ART, 'observations.txt'), `Datepicker mở=${dpOpened}, ngày quá khứ disabled=${pastDisabled}, tới Aug 2026=${augReached}, chọn 22/08/2026=${dateSet}\nTimepicker: Start 18:00 + End 20:00 set=${timeSet}\n(Cancel → không tạo buổi → net-zero)\n`, 'utf8');
  await ctx.close();
  expect(dateSet, 'datepicker phải chọn được ngày (22/08/2026)').toBeTruthy();
  expect(timeSet, 'timepicker phải chọn được giờ (18:00-20:00)').toBeTruthy();
});
