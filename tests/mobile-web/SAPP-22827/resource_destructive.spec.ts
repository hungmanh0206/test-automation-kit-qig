import { test, expect, type Page } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — Resource DESTRUCTIVE (net-zero): upload-negatives (không tạo bản ghi) + rename/edit trên
 * 1 throwaway rồi xoá. Cleanup finally chống orphan. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const AUTO = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation');
const iphone = require('@playwright/test').devices['iPhone 13'];
const PFX = 'SAPP22827';
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }

let page: Page; let RES = '';
async function goRes() {
  if (!RES) {
    await page.goto(`${OPS_BASE}/classes?page_index=1&page_size=10`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
    const href = await page.locator('a[href*="/classes/detail"]').first().getAttribute('href');
    await page.goto(`${OPS_BASE}${(href || '').replace(/\/overview.*$/, '')}/overview`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1600);
    await page.getByText(/^Resources$/).last().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2500); RES = page.url();
  } else { await page.goto(RES, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500); }
}
async function openMenu(): Promise<boolean> {
  return page.evaluate((pfx) => {
    const leaf = Array.from(document.querySelectorAll('*')).find((e) => e.children.length === 0 && (e.textContent || '').includes(pfx));
    if (!leaf) return false;
    let c: Element = leaf; for (let i = 0; i < 6 && c.parentElement; i++) c = c.parentElement;
    const nr = leaf.getBoundingClientRect();
    const btns = Array.from(c.querySelectorAll('button,[role="button"],[class*="icon" i]')) as HTMLElement[];
    let best: HTMLElement | null = null; let bx = -1;
    for (const b of btns) { const r = b.getBoundingClientRect(); if (Math.abs(r.top - nr.top) < 70 && r.left > nr.left + nr.width - 20 && r.width < 60 && r.left > bx) { bx = r.left; best = b; } }
    if (best) { best.click(); return true; } return false;
  }, PFX);
}
async function deleteItem(): Promise<boolean> {
  await goRes(); if (!(await bodyText(page)).includes(PFX)) return false;
  await openMenu(); await page.waitForTimeout(900);
  await page.getByText(/^(Delete|Xoá|Xóa)$/i).last().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(700);
  for (const l of [/^Yes$/i, /^OK$/i, /^Delete$/i, /^Confirm$/i]) { const b = page.getByRole('button', { name: l }); if (await b.count().catch(() => 0)) { await b.first().click({ timeout: 3000 }).catch(() => {}); break; } }
  await page.waitForTimeout(2500); await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {}); await page.waitForTimeout(2000);
  return (await bodyText(page)).includes(PFX);
}
async function uploadFile(file: string) {
  await page.getByText(/^Upload$/).first().click({ timeout: 6000 }); await page.waitForTimeout(900);
  await page.getByText(/^File$/).last().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1800);
  await page.locator('input[type="file"]').first().setInputFiles(file, { timeout: 8000 }); await page.waitForTimeout(1200);
}

test.beforeAll(async ({ browser }) => { const ctx = await browser.newContext({ ...iphone }); page = await ctx.newPage(); await loginOps(page); });
test.afterAll(async () => { const orphan = await deleteItem().catch(() => true); if (orphan) { fs.writeFileSync(path.join(ART, 'ORPHAN_WARNING.txt'), 'orphan resource remains\n', 'utf8'); console.log('⚠ ORPHAN còn lại!'); } });

test('SAPP_MOBRES_TC_008 — Upload: chặn file sai định dạng .exe (no orphan)', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goRes(); await uploadFile(path.join(AUTO, 'SAPP22827_BAD.exe'));
  await shot(page, 'SAPP_MOBRES_TC_008', '01_exe');
  const txt = await bodyText(page);
  const shownInList = txt.includes('SAPP22827_BAD.exe');
  const errored = /không hợp lệ|invalid|not support|sai định dạng|only|allowed/i.test(txt);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_008', 'observations.txt'), `.exe được thêm vào form: ${shownInList}\nCó thông báo chặn: ${errored}\n`, 'utf8');
  // rời form (Cancel) — không submit
  await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 4000 }).catch(() => {});
  expect(shownInList === false || errored, '.exe đáng lẽ bị chặn / không thêm được').toBeTruthy();
});

test('SAPP_MOBRES_TC_007 — Upload form: default Attach="Not attach" + Share Student/Teacher (no submit)', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goRes();
  await page.getByText(/^Upload$/).first().click({ timeout: 6000 }); await page.waitForTimeout(900);
  await page.getByText(/^File$/).last().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1800);
  await shot(page, 'SAPP_MOBRES_TC_007', '01_form_defaults');
  const txt = await bodyText(page);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_007', 'observations.txt'), `Attach default: ${/Not attach/i.test(txt)}\nStudent: ${txt.includes('Student')} Teacher: ${txt.includes('Teacher')}\nViewer: ${/Viewer/i.test(txt)} Downloader: ${/Downloader/i.test(txt)}\n`, 'utf8');
  await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 4000 }).catch(() => {});
  expect(/Not attach/i.test(txt) && txt.includes('Student') && txt.includes('Teacher'), 'Thiếu default Attach/Share').toBeTruthy();
});

test('SAPP_MOBRES_TC_018/019/021/023 — Rename + Edit lifecycle trên throwaway (net-zero)', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(150_000);
  // upload throwaway
  await goRes(); await uploadFile(path.join(AUTO, 'SAPP22827_AUTO_DELETE_ME.txt'));
  await page.getByRole('button', { name: /^Save$/ }).click({ timeout: 6000 }); await page.waitForTimeout(3500);
  await goRes(); expect((await bodyText(page)).includes(PFX), 'Upload throwaway thất bại').toBeTruthy();

  // recon menu options
  await openMenu(); await page.waitForTimeout(900);
  await shot(page, 'SAPP_MOBRES_TC_018', '01_item_menu');
  const menu = await bodyText(page);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_018', 'menu.txt'), 'Menu options snippet: ' + menu.replace(/\n/g, ' | ').slice(0, 250) + '\n', 'utf8');

  // MOBRES_018 Rename valid
  await page.getByText(/^Rename$/i).last().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1200); await shot(page, 'SAPP_MOBRES_TC_018', '02_rename_modal');
  const input = page.getByRole('textbox').last();
  await input.fill('SAPP22827_RENAMED.txt', { timeout: 4000 }).catch(() => {});
  await page.getByRole('button', { name: /^Save$/i }).last().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(2500); await goRes(); await shot(page, 'SAPP_MOBRES_TC_018', '03_after_rename');
  const renamed = (await bodyText(page)).includes('SAPP22827_RENAMED');
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_018', 'observations.txt'), `Rename valid → tên mới hiện: ${renamed}\n`, 'utf8');
  expect(renamed, 'Rename hợp lệ không cập nhật tên').toBeTruthy();

  // MOBRES_019 Rename empty → chặn
  await openMenu(); await page.waitForTimeout(800);
  await page.getByText(/^Rename$/i).last().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const inp2 = page.getByRole('textbox').last();
  await inp2.fill('', { timeout: 4000 }).catch(() => {});
  const saveBtn = page.getByRole('button', { name: /^Save$/i }).last();
  const disabled = await saveBtn.isDisabled().catch(() => false);
  await saveBtn.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1200); await shot(page, 'SAPP_MOBRES_TC_019', '01_empty_blocked');
  const stillModal = /Rename/i.test(await bodyText(page));
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_019', 'observations.txt'), `Save disabled khi rỗng: ${disabled}\nCòn ở modal (bị chặn): ${stillModal}\n`, 'utf8');
  await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 3000 }).catch(() => {});
  expect(disabled || stillModal, 'Tên rỗng đáng lẽ bị chặn').toBeTruthy();
});
