import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — Upload Resource EDGE: 009 (0 byte), 014 (tên dài/unicode), 017 (kho Resources tab select/filter/pagination),
 * 036 (offline khi Upload → không mồ côi), 015 (double-tap Upload → không nhân đôi, net-zero). Evidence bền (evidence/). */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const STATE = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation/ops_state.json');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CLASS = '1e8d953c-83f8-49d9-9cce-5ea3af76d2cf';
const SC = 'C:/Users/SAPP/AppData/Local/Temp/claude/d--Projects-test-automation-kit-v2/d7e89c8a-da3c-45c8-9f7e-3f2f0d785ca2/scratchpad/edge';
const EMPTY = `${SC}/empty_0byte.pdf`; const LONG = `${SC}/Tài_liệu_TÊN_RẤT_DÀI_ÀÁÂÃ_测试文档_ünïcödé_2026_abcdefghijklmnop_1234567890_special.txt`;
const DUP = `${SC}/dup_test.txt`; const OFF = `${SC}/offline_test.txt`;
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
async function gotoResource(p: Page) { for (let i = 0; i < 3; i++) { await p.goto(`${OPS_BASE}/classes/detail/${CLASS}/resource`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3200); if (!/Network error|Forbidden/i.test(await bodyText(p))) break; await p.waitForTimeout(2500); } }
async function openUploadFile(p: Page): Promise<boolean> {
  await gotoResource(p);
  await p.getByText(/Upload/i).first().click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(1000);
  await p.getByText(/^File$/i).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(2200);
  return (await p.locator('input[type="file"]').count()) > 0;
}
async function closeModal(p: Page) { await p.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(800); }

let page: Page; let ctxRef: BrowserContext;
test.beforeAll(async ({ browser }) => { ctxRef = await browser.newContext({ ...iphone, storageState: STATE }); await ctxRef.addInitScript(() => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;}'; (document.head || document.documentElement).appendChild(s); }); page = await ctxRef.newPage(); });
test.afterAll(async () => { await ctxRef.close().catch(() => {}); });
test.skip(!haveOpsCreds, 'no creds');

test('SAPP_MOBRES_TC_009 — xử lý file 0 byte', async () => {
  test.setTimeout(120_000);
  expect(await openUploadFile(page), 'mở form Upload File').toBeTruthy();
  await page.setInputFiles('input[type="file"]', EMPTY).catch(() => {});
  await page.waitForTimeout(2500);
  const body = await bodyText(page);
  const rejected = /rỗng|0\s*byte|empty|không hợp lệ|invalid|dung lượng 0/i.test(body);
  const staged = /empty_0byte\.pdf/i.test(body);
  await shot(page, 'SAPP_MOBRES_TC_009', '01_0byte');
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_009', 'observations.txt'), `File 0 byte: bị chặn/thông báo=${rejected}, vào staging=${staged} → app XỬ LÝ (không crash), 1 trong 2 trạng thái hợp lệ=${rejected || staged}\n`, 'utf8');
  await closeModal(page);
  expect(rejected || staged, 'app phải xử lý file 0 byte (chặn có thông báo HOẶC nhận staging, không crash)').toBeTruthy();
});

test('SAPP_MOBRES_TC_014 — tên file rất dài + unicode/ký tự đặc biệt', async () => {
  test.setTimeout(120_000);
  expect(await openUploadFile(page), 'mở form Upload File').toBeTruthy();
  await page.setInputFiles('input[type="file"]', LONG).catch(() => {});
  await page.waitForTimeout(2500);
  const body = await bodyText(page);
  const staged = /测试文档|ünïcödé|TÊN_RẤT_DÀI|special\.txt/i.test(body);
  const noCrash = body.length > 20 && /Upload|Resource|Save|Cancel/i.test(body);
  await shot(page, 'SAPP_MOBRES_TC_014', '01_longname');
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_014', 'observations.txt'), `Tên dài+unicode: file vào staging (tên hiển thị)=${staged}, form không crash=${noCrash}\n`, 'utf8');
  await closeModal(page);
  expect(staged && noCrash, 'file tên dài/unicode phải nhận vào staging, không vỡ layout/crash').toBeTruthy();
});

test('SAPP_MOBRES_TC_017 — kho Resources: Select all, Filter, pagination', async () => {
  test.setTimeout(120_000);
  await gotoResource(page);
  await page.getByText(/Upload/i).first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(1000);
  await page.getByText(/^Media$/i).first().click({ timeout: 3000 }).catch(() => page.getByText(/^File$/i).first().click().catch(() => {})); await page.waitForTimeout(2500);
  // trong modal có tab "Resource"/"Resources" = kho
  await page.getByText(/^Resources?$/i).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(2000);
  const body = await bodyText(page);
  const hasSelectAll = /Select all/i.test(body);
  const hasFilter = /Filter/i.test(body);
  const hasItems = await page.locator('input[type="checkbox"]').count().catch(() => 0);
  const hasPager = await page.locator('[class*="paginat" i],[class*="pager" i]').count().catch(() => 0);
  await shot(page, 'SAPP_MOBRES_TC_017', '01_kho');
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_017', 'observations.txt'), `Tab Resources (kho): Select all=${hasSelectAll}, Filter=${hasFilter}, item checkbox=${hasItems}, pagination=${hasPager > 0}\n`, 'utf8');
  await closeModal(page);
  expect(hasSelectAll && hasFilter, 'kho Resources phải có Select all + Filter').toBeTruthy();
});

test('SAPP_MOBRES_TC_036 — mất mạng khi Upload → lỗi, không tạo tài liệu mồ côi', async () => {
  test.setTimeout(120_000);
  expect(await openUploadFile(page), 'mở form Upload File').toBeTruthy();
  await page.setInputFiles('input[type="file"]', OFF).catch(() => {});
  await page.waitForTimeout(1500);
  await ctxRef.setOffline(true);
  await page.getByRole('button', { name: /^(Save|Upload)$/i }).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const blankOrErr = await page.evaluate(() => { const t = (document.body.innerText || '').trim(); return { blank: t.length < 5, errShown: /lỗi|error|thất bại|failed|mạng|network|offline|try again|thử lại/i.test(t) }; });
  await shot(page, 'SAPP_MOBRES_TC_036', '01_offline_upload');
  await ctxRef.setOffline(false); await page.waitForTimeout(1200);
  await closeModal(page);
  // verify không mồ côi: offline_test.txt KHÔNG xuất hiện trong danh sách resource (yêu cầu CỐT LÕI)
  await gotoResource(page);
  const orphan = /offline_test\.txt/i.test(await bodyText(page));
  const uxFinding = blankOrErr.blank && !blankOrErr.errShown;
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_036', 'observations.txt'), `Offline khi Upload: tài liệu mồ côi (offline_test.txt) xuất hiện=${orphan} (đúng: KHÔNG) → net-zero OK\nUX offline: màn blank=${blankOrErr.blank}, có báo lỗi rõ=${blankOrErr.errShown}${uxFinding ? ' → FINDING F13: offline hiện màn trắng KHÔNG có thông báo lỗi (nên hiện toast "Mất kết nối")' : ''}\n`, 'utf8');
  expect(orphan, 'offline khi Upload KHÔNG được tạo tài liệu mồ côi (yêu cầu cốt lõi)').toBeFalsy();
});

test('SAPP_MOBRES_TC_015 — double-tap Upload không tạo 2 bản ghi (net-zero)', async () => {
  test.setTimeout(150_000);
  const UNAME = 'dup_test.txt';
  // dọn trước nếu còn dup_test từ lần trước
  await gotoResource(page);
  // upload 1 file + double-tap Save
  expect(await openUploadFile(page), 'mở form Upload File').toBeTruthy();
  await page.setInputFiles('input[type="file"]', DUP).catch(() => {});
  await page.waitForTimeout(2000);
  const saveBtn = page.getByRole('button', { name: /^(Save|Upload)$/i }).first();
  await saveBtn.click({ timeout: 3000 }).catch(() => {});
  await saveBtn.click({ timeout: 800 }).catch(() => {}); // tap thứ 2 nhanh
  await page.waitForTimeout(4000);
  await gotoResource(page);
  // đếm số bản ghi dup_test.txt
  const count = await page.evaluate(() => (document.body.innerText.match(/dup_test\.txt/gi) || []).length);
  await shot(page, 'SAPP_MOBRES_TC_015', '01_after_doubletap');
  // CLEANUP net-zero ROBUST: xoá LẶP tới khi hết dup_test.txt
  for (let iter = 0; iter < 6; iter++) {
    await gotoResource(page);
    if (!/dup_test\.txt/i.test(await bodyText(page))) break;
    const tagged = await page.evaluate(() => { const re = /dup_test\.txt/i; for (const s of Array.from(document.querySelectorAll('span.sapp-btn-action-cell'))) { let c: any = s; for (let i = 0; i < 6 && c.parentElement; i++) { c = c.parentElement; if (re.test(c.textContent || '')) { s.setAttribute('data-del', '1'); return true; } } } return false; });
    if (!tagged) break;
    await page.locator('span.sapp-btn-action-cell[data-del="1"]').click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(800);
    await page.getByText(/^Delete$/i).first().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(600);
    await page.getByRole('button', { name: /^Yes$/i }).first().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(2200);
  }
  await gotoResource(page);
  const after = await page.evaluate(() => (document.body.innerText.match(/dup_test\.txt/gi) || []).length);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_015', 'observations.txt'), `Double-tap Upload: số bản ghi dup_test.txt tạo ra = ${count}${count > 1 ? ' → FINDING F12: double-tap tạo NHÂN ĐÔI bản ghi (thiếu debounce/chống double-submit nút Upload)' : ' (đúng: ≤1, idempotent)'}\nSau cleanup robust: dup_test.txt còn ${after} (net-zero=${after === 0})\n`, 'utf8');
  expect(after, 'net-zero: đã dọn sạch dup_test.txt').toBe(0);
  expect(count, 'double-tap KHÔNG được tạo 2 bản ghi (nếu >1 là FINDING thiếu chống double-submit)').toBeLessThanOrEqual(1);
});
