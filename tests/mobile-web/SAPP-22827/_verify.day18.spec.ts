import { test, type Page, type BrowserContext } from '@playwright/test';
import { OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
const iphone = require('@playwright/test').devices['iPhone 13'];
const STATE = require('path').resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation/ops_state.json');
const CAL = `${OPS_BASE}/classes/detail/4dff019e-25a9-44e9-b7b5-a9dd00ae5786/calendar`;

/* Utility: verify ngày 18/10/2026 LH62 có buổi không (read-only trước), nếu có thì loop-delete (swal2) tới sạch.
 * Dùng chốt net-zero cho các spec calendar mutate/no-save. */
test('verify+clean day18 Oct LH62 (net-zero guard)', async ({ browser }) => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(180_000);
  const ctx: BrowserContext = await browser.newContext({ ...iphone, storageState: STATE });
  const page: Page = await ctx.newPage();
  const log: any[] = [];
  for (let iter = 0; iter < 6; iter++) {
    await page.goto(CAL, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
    for (let m = 0; m < 8; m++) { const cur = ((await page.getByText(/,\s*\d{4}$/).first().innerText().catch(() => '')) || '').trim(); if (/^October,\s*2026$/i.test(cur)) break; const lb = await page.getByText(/,\s*\d{4}$/).first().boundingBox(); if (lb) await page.mouse.click(lb.x + lb.width + 22, lb.y + lb.height / 2); await page.waitForTimeout(700); }
    await page.getByText(/^18$/).last().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(2000);
    const block = page.locator('text=/\\d{1,2}:\\d{2}\\s*[-–]\\s*\\d{1,2}:\\d{2}/').first();
    if (!(await block.count().catch(() => 0))) { log.push({ iter, day18: 'EMPTY' }); break; }
    await block.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(2500);
    // Delete: cascade ĐÚNG (await từng nhánh — nút Delete là text/icon, KHÔNG phải button-role)
    const delClicked = await page.getByRole('button', { name: /^Delete$/i }).first().click({ timeout: 2500 }).then(() => true).catch(() => false)
      || await page.getByText(/^Delete$/i).first().click({ timeout: 2000 }).then(() => true).catch(() => false)
      || await page.locator('.anticon-delete, [class*="trash"]').first().click({ timeout: 2000 }).then(() => true).catch(() => false);
    void delClicked; await page.waitForTimeout(1800);
    // Confirm: cascade (swal2 → ant-modal primary/danger → Yes/OK/Confirm)
    const c1 = await page.locator('.swal2-confirm').first().click({ timeout: 1500 }).then(() => true).catch(() => false);
    const c2 = c1 ? false : await page.locator('.ant-modal-confirm-btns button.ant-btn-primary, .ant-modal .ant-btn-dangerous, .ant-modal .ant-btn-primary').first().click({ timeout: 1500 }).then(() => true).catch(() => false);
    const c3 = (c1 || c2) ? false : await page.getByRole('button', { name: /^(Yes|OK|Xác nhận|Đồng ý|Confirm)$/i }).first().click({ timeout: 1500 }).then(() => true).catch(() => false);
    await page.waitForTimeout(3000);
    log.push({ iter, day18: 'had-lesson', confirmBy: c1 ? 'swal2' : c2 ? 'antmodal' : c3 ? 'rolebtn' : 'NONE' });
  }
  console.log('VERIFY_DAY18=' + JSON.stringify(log));
  await ctx.close();
});
