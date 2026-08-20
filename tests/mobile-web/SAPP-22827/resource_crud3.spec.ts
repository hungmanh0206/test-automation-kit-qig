import { test, expect, type Page } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — Resource CRUD net-zero (CFA throwaway). ⋮ mở bằng mouse.click (real pointer) + retry.
 * Soft-record từng op; finally cleanup. 020/024/026/028 (cancel/No) + 021 (rename save) + 029 (delete cleanup). */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const AUTO = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CFA = `${OPS_BASE}/classes/detail/9faf72a4-af1f-4056-a833-b260de91e6f7`;
const PFX = 'SAPP22827';
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }

let page: Page; let RES = '';
async function goRes() { if (!RES) { await page.goto(`${CFA}/overview`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1600); await page.getByText(/^Resources$/).last().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2500); RES = page.url(); } else { await page.goto(RES, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500); } }
async function dotsBox() { return page.evaluate((pfx) => { const leaf = Array.from(document.querySelectorAll('*')).find((e) => e.children.length === 0 && (e.textContent || '').includes(pfx)); if (!leaf) return null; leaf.scrollIntoView({ block: 'center' }); let c: any = leaf; for (let i = 0; i < 6 && c.parentElement; i++) c = c.parentElement; const nr = leaf.getBoundingClientRect(); const bs = Array.from(c.querySelectorAll('button,[role="button"]')) as any[]; let best = null, bx = -1; for (const b of bs) { const r = b.getBoundingClientRect(); if (Math.abs(r.top - nr.top) < 80 && r.left > nr.left + nr.width - 40 && r.width < 60 && r.height < 60 && r.left > bx) { bx = r.left; best = r; } } return best ? { x: best.left + best.width / 2, y: best.top + best.height / 2 } : null; }, PFX); }
async function openMenu(): Promise<boolean> {
  for (let i = 0; i < 3; i++) { const b = await dotsBox(); if (b && b.y > 0 && b.y < 830) { await page.mouse.click(b.x, b.y); await page.waitForTimeout(900); if (/Rename|Move To Folder|Download File/i.test(await bodyText(page))) return true; } await page.waitForTimeout(400); }
  return false;
}
async function present() { await goRes(); return (await bodyText(page)).includes(PFX); }

test.beforeAll(async ({ browser }) => { const ctx = await browser.newContext({ ...iphone }); page = await ctx.newPage(); await loginOps(page); });

test('Resource CRUD net-zero (⋮ mouse-click): 028/020/026/024/021 + cleanup', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(200_000);
  const R: any = {};
  try {
    await goRes();
    if (!(await bodyText(page)).includes(PFX)) { await page.getByText(/^Upload$/).first().click({ timeout: 6000 }); await page.waitForTimeout(900); await page.getByText(/^File$/).last().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1800); await page.locator('input[type="file"]').first().setInputFiles(path.join(AUTO, 'SAPP22827_AUTO_DELETE_ME.txt')).catch(() => {}); await page.waitForTimeout(1000); await page.getByRole('button', { name: /^Save$/ }).click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(3500); await goRes(); }
    expect((await bodyText(page)).includes(PFX), 'Upload throwaway thất bại').toBeTruthy();

    // 028 delete No
    if (await openMenu()) { await page.getByText(/^(Delete|Xoá|Xóa)$/i).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(600); await page.getByRole('button', { name: /^No$/i }).first().click({ timeout: 2500 }).catch(() => page.keyboard.press('Escape').catch(() => {})); await page.waitForTimeout(1200); R['028'] = await present(); await shot(page, 'SAPP_MOBRES_TC_028', '01'); }

    // 020 rename cancel
    if (await openMenu()) { await page.getByText(/^Rename$/i).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1200); await shot(page, 'SAPP_MOBRES_TC_020', '01_modal'); const inp = page.locator('input:not([type=search]),textarea').first(); await inp.fill('SAPP22827_TMP.txt', { timeout: 3000 }).catch(() => {}); R['020_modal'] = /Rename/i.test(await bodyText(page)); await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 2500 }).catch(() => page.keyboard.press('Escape').catch(() => {})); await page.waitForTimeout(1200); R['020'] = (await present()) && !(await bodyText(page)).includes('SAPP22827_TMP'); }

    // 026 move cancel
    if (await openMenu()) { await page.getByText(/^Move To Folder$/i).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1500); const mt = await bodyText(page); R['026_modal'] = /Move To Folder/i.test(mt) && /\bName\b/.test(mt); await shot(page, 'SAPP_MOBRES_TC_026', '06'); await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 2500 }).catch(() => page.keyboard.press('Escape').catch(() => {})); await page.waitForTimeout(1200); R['026'] = await present(); }

    // 024 edit cancel
    if (await openMenu()) { await page.getByText(/^Edit$/i).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1200); const et = await bodyText(page); R['024_modal'] = /Student/i.test(et) && /Teacher/i.test(et) && /Permission|Attach/i.test(et); await shot(page, 'SAPP_MOBRES_TC_024', '01'); await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 2500 }).catch(() => page.keyboard.press('Escape').catch(() => {})); await page.waitForTimeout(1200); R['024'] = await present(); }

    // 021 rename save unicode (giữ PFX)
    if (await openMenu()) { await page.getByText(/^Rename$/i).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1000); const inp = page.locator('input:not([type=search]),textarea').first(); await inp.fill('SAPP22827_Tài liệu ✎ ünicode.txt', { timeout: 3000 }).catch(() => {}); await page.getByRole('button', { name: /^Save$/i }).last().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(2000); R['021'] = await present(); await shot(page, 'SAPP_MOBRES_TC_021', '01'); }

    fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_028', 'observations.txt'), JSON.stringify(R, null, 2), 'utf8');
    expect(R['028'] === true, '028 delete-No item không ở lại').toBeTruthy();
    expect(R['020'] === true, '020 rename-cancel không giữ nguyên').toBeTruthy();
    expect(R['026_modal'] === true, '026 modal Move không mở').toBeTruthy();
    expect(R['024_modal'] === true, '024 modal Edit không mở').toBeTruthy();
  } finally {
    if (await present().catch(() => false)) { if (await openMenu()) { await page.getByText(/^(Delete|Xoá|Xóa)$/i).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(600); await page.getByRole('button', { name: /^Yes$/i }).first().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(2500); } const still = await present().catch(() => true); if (still) { fs.writeFileSync(path.join(ART, 'ORPHAN_WARNING.txt'), 'crud3 orphan\n', 'utf8'); console.log('⚠ ORPHAN!'); } else console.log('cleanup OK'); }
  }
});
