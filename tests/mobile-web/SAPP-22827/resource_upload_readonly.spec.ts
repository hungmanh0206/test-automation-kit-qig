import { test, expect, type Page } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — read-only trên Resources + Upload screen (empty-state + conformance chuỗi 500MB/File
 * supported/Share Resource) + recon UI upload cho destructive. KHÔNG mutate (chỉ mở form, không submit). */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const iphone = require('@playwright/test').devices['iPhone 13'];
const bodyText = (page: Page) => page.evaluate(() => document.body.innerText || '');
async function shot(page: Page, tc: string, name: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await page.screenshot({ path: path.join(d, `${name}.png`), fullPage: true }); }

async function gotoResourceTab(page: Page) {
  await page.goto(`${OPS_BASE}/classes?page_index=1&page_size=10`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const href = await page.locator('a[href*="/classes/detail"]').first().getAttribute('href');
  await page.goto(`${OPS_BASE}${(href || '').replace(/\/overview.*$/, '')}/overview`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const tab = page.getByText(/^Resources$/).last();
  await tab.scrollIntoViewIfNeeded().catch(() => {});
  await tab.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

let page: Page;
test.beforeAll(async ({ browser }) => { const ctx = await browser.newContext({ ...iphone }); page = await ctx.newPage(); await loginOps(page); });

test('SAPP_MOBRES_TC_003 — Resources: empty-state "No data" + nút Upload/Filter', async () => {
  test.skip(!haveOpsCreds, 'no creds');
  await gotoResourceTab(page);
  await shot(page, 'SAPP_MOBRES_TC_003', '01_empty');
  const txt = await bodyText(page);
  expect(/No data|0 items|Không có/i.test(txt), 'Không thấy empty-state').toBeTruthy();
  expect(/Upload/i.test(txt) && /Filter/i.test(txt), 'Thiếu Upload/Filter').toBeTruthy();
});

test('SAPP_MOBRES_TC_005 — Upload screen: chuỗi "File supported" + "500MB" + Share Resource (Student/Teacher) — conformance', async () => {
  test.skip(!haveOpsCreds, 'no creds');
  await gotoResourceTab(page);
  await page.getByRole('button', { name: /^Upload$/ }).or(page.getByText(/^Upload$/)).first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await shot(page, 'SAPP_MOBRES_TC_005', '01_upload_form');
  const txt = await bodyText(page);
  const fileSupported = txt.includes('File supported');
  const has500 = /500\s*MB/i.test(txt);
  const has100 = /100\s*MB/i.test(txt);
  const share = /Share Resource/i.test(txt);
  const stTe = ['Student', 'Teacher'].filter((l) => txt.includes(l));
  const attach = /Attach To The Lesson/i.test(txt) || /Not attached/i.test(txt);
  const fileInput = await page.locator('input[type="file"]').count();
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_005', 'observations.txt'),
    `File supported string: ${fileSupported}\n500MB: ${has500} | 100MB: ${has100}\nShare Resource: ${share} (${stTe.join(',')})\nAttach To The Lesson: ${attach}\ninput[type=file] count: ${fileInput}\nSnippet: ${txt.slice(0, 500).replace(/\n/g, ' / ')}\n`, 'utf8');
  // oracle: màn Upload Resource của tài liệu lớp = 500MB (ui_catalog)
  expect(fileSupported, 'Thiếu chuỗi "File supported"').toBeTruthy();
  expect(has500, 'Màn upload tài liệu lớp phải ghi 500MB (oracle Figma)').toBeTruthy();
  expect(share, 'Thiếu section Share Resource').toBeTruthy();
});
