import { test, expect, type Page } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/*
 * SAPP-22827 — (b) DESTRUCTIVE có rollback (net-zero) trên lớp test 0 tài liệu.
 * Upload throwaway (SAPP22827_AUTO_DELETE_ME.txt) → verify → XOÁ → về 0. Guard cleanup đầu + finally.
 * MOBRES_006 (upload) + MOBRES_027 (delete/rollback). Submit thật = nút "Save".
 */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const AUTO = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation');
const iphone = require('@playwright/test').devices['iPhone 13'];
const FILE_TXT = path.join(AUTO, 'SAPP22827_AUTO_DELETE_ME.txt');
const MARK = 'SAPP22827_AUTO_DELETE_ME';
const bodyText = (page: Page) => page.evaluate(() => document.body.innerText || '');
async function shot(page: Page, tc: string, name: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await page.screenshot({ path: path.join(d, `${name}.png`), fullPage: true }); }

let RES_URL = '';
async function gotoResourceTab(page: Page) {
  if (!RES_URL) {
    await page.goto(`${OPS_BASE}/classes?page_index=1&page_size=10`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const href = await page.locator('a[href*="/classes/detail"]').first().getAttribute('href');
    await page.goto(`${OPS_BASE}${(href || '').replace(/\/overview.*$/, '')}/overview`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    await page.getByText(/^Resources$/).last().click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(2500);
    RES_URL = page.url();
  } else {
    await page.goto(RES_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
  }
}
async function deleteThrowawayIfPresent(page: Page): Promise<boolean> {
  await gotoResourceTab(page);
  if (!(await bodyText(page)).includes(MARK)) return false;
  await page.locator(`xpath=//*[contains(text(),"${MARK}")]/ancestor::*[self::div or self::li][1]//button`).last().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.getByText(/^(Delete|Xoá|Xóa)$/i).last().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /^Yes$/i }).click({ timeout: 4000 }).catch(() => page.getByText(/^Yes$/i).last().click().catch(() => {}));
  await page.waitForTimeout(2500);
  await gotoResourceTab(page);
  return (await bodyText(page)).includes(MARK); // true = vẫn còn (fail)
}

let page: Page;
test.beforeAll(async ({ browser }) => { const ctx = await browser.newContext({ ...iphone }); page = await ctx.newPage(); await loginOps(page); });

test('SAPP_MOBRES_TC_006+027 — Upload throwaway → verify → delete rollback (net-zero)', async () => {
  test.skip(!haveOpsCreds, 'no creds');
  test.setTimeout(120_000);
  let uploaded = false;
  try {
    // guard: dọn leftover nếu có
    await gotoResourceTab(page);
    if ((await bodyText(page)).includes(MARK)) { await deleteThrowawayIfPresent(page); }
    await shot(page, 'SAPP_MOBRES_TC_006', '01_before_0items');

    // Upload → File
    await page.getByText(/^Upload$/).first().click({ timeout: 6000 });
    await page.waitForTimeout(1000);
    await page.getByText(/^File$/).last().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.locator('input[type="file"]').first().setInputFiles(FILE_TXT, { timeout: 8000 });
    await page.waitForTimeout(1500);
    await shot(page, 'SAPP_MOBRES_TC_006', '02_file_selected');
    expect((await bodyText(page)).includes(MARK), 'File throwaway không hiện trên form').toBeTruthy();

    // submit = nút "Save"
    await page.getByRole('button', { name: /^Save$/ }).click({ timeout: 6000 });
    uploaded = true;
    await page.waitForTimeout(4000);
    await gotoResourceTab(page);
    await shot(page, 'SAPP_MOBRES_TC_006', '03_after_upload');
    expect((await bodyText(page)).includes(MARK), 'Sau Save không thấy tài liệu trong list (upload fail)').toBeTruthy();

    // ROLLBACK / MOBRES_027
    await shot(page, 'SAPP_MOBRES_TC_027', '01_before_delete');
    const stillThere = await deleteThrowawayIfPresent(page);
    await shot(page, 'SAPP_MOBRES_TC_027', '02_after_delete');
    uploaded = stillThere;
    expect(stillThere, 'Sau xoá vẫn còn tài liệu (rollback fail)').toBeFalsy();
    expect(/No data|0 items/i.test(await bodyText(page)), 'Không trở về empty-state').toBeTruthy();
  } finally {
    if (uploaded) {
      const orphan = await deleteThrowawayIfPresent(page).catch(() => true);
      if (orphan) { console.log(`⚠⚠ ORPHAN: "${MARK}" còn trên UAT — xoá thủ công!`); fs.writeFileSync(path.join(ART, 'ORPHAN_WARNING.txt'), `Orphan ${MARK}\n`, 'utf8'); }
      else console.log('cleanup OK — orphan đã xoá.');
    }
  }
});
