import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — Resource CRUD net-zero. FIX ĐÚNG: mở ⋮ bằng Playwright Locator.click() trên
 * span.sapp-btn-action-cell (nút thật 35px, KHÔNG phải svg 3px). Real pointer + hit-test → ổn định.
 * kill-animation + namespace PFX + guard-rail sweep finally. 1 op / fresh-nav. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const AUTO = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CFA = `${OPS_BASE}/classes/detail/9faf72a4-af1f-4056-a833-b260de91e6f7`;
const PFX = 'SAPP22827';
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
async function killAnim(ctx: BrowserContext) { await ctx.addInitScript(() => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;}'; (document.head || document.documentElement).appendChild(s); }); }

let page: Page; let RES = '';
async function goRes() { if (!RES) { await page.goto(`${CFA}/overview`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1400); await page.getByText(/^Resources$/).last().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2300); RES = page.url(); } else { await page.goto(RES, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2300); } }
// FIX: click nút thật (span.sapp-btn-action-cell) bằng Playwright real click, retry-only-open
async function openMenu(): Promise<boolean> {
  for (let i = 0; i < 3; i++) {
    await page.locator('span.sapp-btn-action-cell').last().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    if (/Rename|Move To Folder|Download File/i.test(await bodyText(page))) return true;
  }
  return false;
}
async function present() { await goRes(); return (await bodyText(page)).includes(PFX); }
async function sweep() { for (let k = 0; k < 5; k++) { if (!(await present())) return; if (!(await openMenu())) return; await page.getByText(/^(Delete|Xoá|Xóa)$/i).last().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(500); await page.getByRole('button', { name: /^Yes$/i }).click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(1800); } }
async function uploadThrow() { await goRes(); if ((await bodyText(page)).includes(PFX)) return; await page.getByText(/^Upload$/).first().click({ timeout: 6000 }); await page.waitForTimeout(800); await page.getByText(/^File$/).last().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1500); await page.locator('input[type="file"]').first().setInputFiles(path.join(AUTO, 'SAPP22827_AUTO_DELETE_ME.txt')).catch(() => {}); await page.waitForTimeout(900); await page.getByRole('button', { name: /^Save$/ }).click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(3000); }
async function cancel() { await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 2500 }).catch(() => page.keyboard.press('Escape').catch(() => {})); await page.waitForTimeout(1000); }

test.beforeAll(async ({ browser }) => { const ctx = await browser.newContext({ ...iphone }); await killAnim(ctx); page = await ctx.newPage(); await loginOps(page); await sweep(); await uploadThrow(); expect(await present(), 'setup upload fail').toBeTruthy(); });
test.afterAll(async () => { await sweep().catch(() => {}); if (await present().catch(() => true)) { fs.writeFileSync(path.join(ART, 'ORPHAN_WARNING.txt'), 'crud5\n', 'utf8'); console.log('⚠ ORPHAN'); } else console.log('✓ swept clean'); });

test('SAPP_MOBRES_TC_035 — Modal Rename hiển thị bottom-sheet mobile + ⋮ menu đủ item', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goRes(); expect(await openMenu(), 'menu không mở').toBeTruthy();
  await shot(page, 'SAPP_MOBRES_TC_035', '01_menu');
  const menu = await bodyText(page);
  const items = ['Download File', 'Rename', 'Edit', 'Move To Folder', 'Delete'].filter((l) => menu.includes(l));
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_035', 'observations.txt'), `⋮ menu items: ${items.join(', ')}\n`, 'utf8');
  await page.keyboard.press('Escape').catch(() => {});
  expect(items.length >= 4, `⋮ menu thiếu item: ${items.join(',')}`).toBeTruthy();
});

test('SAPP_MOBRES_TC_020 — Rename: Cancel không đổi tên', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goRes(); expect(await openMenu(), 'menu không mở').toBeTruthy();
  await page.getByText(/^Rename$/i).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1000); await shot(page, 'SAPP_MOBRES_TC_020', '01');
  const isModal = /Rename/i.test(await bodyText(page));
  await page.getByRole('textbox').last().fill('SAPP22827_TMP.txt').catch(() => {});
  await cancel();
  const keep = (await present()) && !(await bodyText(page)).includes('SAPP22827_TMP');
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_020', 'observations.txt'), `modal Rename mở: ${isModal} · Cancel giữ tên: ${keep}\n`, 'utf8');
  expect(isModal && keep).toBeTruthy();
});

test('SAPP_MOBRES_TC_021 — Rename: đổi tên Unicode/ký tự đặc biệt và Save', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goRes(); expect(await openMenu(), 'menu không mở').toBeTruthy();
  await page.getByText(/^Rename$/i).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1000);
  await page.getByRole('textbox').last().fill('SAPP22827_Tài liệu ✎ ünicode.txt').catch(() => {});
  await page.getByRole('button', { name: /^Save$/i }).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(2000); await shot(page, 'SAPP_MOBRES_TC_021', '01');
  const saved = (await present()) && /ünicode|Tài liệu ✎/i.test(await bodyText(page));
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_021', 'observations.txt'), `rename Unicode saved: ${saved}\n`, 'utf8');
  expect(saved, 'Rename Unicode không lưu/không hiện').toBeTruthy();
});

test('SAPP_MOBRES_TC_024 — Edit: modal Share (Student/Teacher/Permission) + Cancel', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goRes(); expect(await openMenu(), 'menu không mở').toBeTruthy();
  await page.getByText(/^Edit$/i).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1200); await shot(page, 'SAPP_MOBRES_TC_024', '01');
  const et = await bodyText(page); const isModal = /Student/i.test(et) && /Teacher/i.test(et) && /Permission|Viewer|Downloader|Attach/i.test(et);
  await cancel();
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_024', 'observations.txt'), `modal Edit (Student/Teacher/Permission) mở: ${isModal}\n`, 'utf8');
  expect(isModal && (await present())).toBeTruthy();
});

test('SAPP_MOBRES_TC_026 — Move To Folder: modal (cột Name + folder) + Cancel không chuyển', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goRes(); expect(await openMenu(), 'menu không mở').toBeTruthy();
  await page.getByText(/^Move To Folder$/i).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1500); await shot(page, 'SAPP_MOBRES_TC_026', '08');
  const mt = await bodyText(page); const isModal = /Move To Folder/i.test(mt) && /\bName\b/.test(mt);
  await cancel();
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_026', 'observations.txt'), `modal Move mở: ${isModal}\n`, 'utf8');
  expect(isModal && (await present())).toBeTruthy();
});

test('SAPP_MOBRES_TC_028 — Delete: No giữ nguyên tài liệu', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goRes(); expect(await openMenu(), 'menu không mở').toBeTruthy();
  await page.getByText(/^(Delete|Xoá|Xóa)$/i).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(600); await shot(page, 'SAPP_MOBRES_TC_028', '02');
  await page.getByRole('button', { name: /^No$/i }).first().click({ timeout: 2500 }).catch(() => page.keyboard.press('Escape').catch(() => {})); await page.waitForTimeout(1000);
  expect(await present(), 'Delete No nhưng mất tài liệu').toBeTruthy();
});

test('SAPP_MOBRES_TC_029 — Delete: xác nhận Yes xoá đúng 1 (net-zero cleanup)', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goRes(); expect(await openMenu(), 'menu không mở').toBeTruthy();
  await page.getByText(/^(Delete|Xoá|Xóa)$/i).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500);
  await page.getByRole('button', { name: /^Yes$/i }).first().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(2500); await shot(page, 'SAPP_MOBRES_TC_029', '02');
  expect(!(await present()), 'Delete Yes không xoá').toBeTruthy();
});
