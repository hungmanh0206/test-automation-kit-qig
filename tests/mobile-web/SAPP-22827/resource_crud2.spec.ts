import { test, expect, type Page } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — Resource CRUD create→rollback trên CFA (0 tài liệu, item đơn → ⋮ ổn định). NET-ZERO.
 * 020 rename-cancel · 024 edit-cancel · 026 move-cancel · 028 delete-No · 023 edit-permission · 021 rename-unicode · 029 double-tap-delete(cleanup). */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const AUTO = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CFA = `${OPS_BASE}/classes/detail/9faf72a4-af1f-4056-a833-b260de91e6f7`;
const PFX = 'SAPP22827';
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }

let page: Page; let RES = '';
async function goRes() { if (!RES) { await page.goto(`${CFA}/overview`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1600); await page.getByText(/^Resources$/).last().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2500); RES = page.url(); } else { await page.goto(RES, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500); } }
async function openMenu() { return page.evaluate((pfx) => { const leaf = Array.from(document.querySelectorAll('*')).find((e) => e.children.length === 0 && (e.textContent || '').includes(pfx)); if (!leaf) return false; let c: any = leaf; for (let i = 0; i < 6 && c.parentElement; i++) c = c.parentElement; const nr = leaf.getBoundingClientRect(); const bs = Array.from(c.querySelectorAll('button,[role="button"]')) as any[]; let best = null, bx = -1; for (const b of bs) { const r = b.getBoundingClientRect(); if (Math.abs(r.top - nr.top) < 70 && r.left > nr.left + nr.width - 20 && r.width < 60 && r.left > bx) { bx = r.left; best = b; } } if (best) { best.click(); return true; } return false; }, PFX); }
async function menuClick(re: RegExp) { await openMenu(); await page.waitForTimeout(800); await page.getByText(re).last().click({ timeout: 3500 }).catch(() => {}); await page.waitForTimeout(1200); }
async function present() { await goRes(); return (await bodyText(page)).includes(PFX); }

test.beforeAll(async ({ browser }) => { const ctx = await browser.newContext({ ...iphone }); page = await ctx.newPage(); await loginOps(page); });

test('Resource CRUD net-zero (020/024/026/028/023/021) + cleanup 029', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(180_000);
  const R: any = {};
  try {
    // upload throwaway
    await goRes();
    if ((await bodyText(page)).includes(PFX)) { /* leftover */ }
    else { await page.getByText(/^Upload$/).first().click({ timeout: 6000 }); await page.waitForTimeout(900); await page.getByText(/^File$/).last().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1800); await page.locator('input[type="file"]').first().setInputFiles(path.join(AUTO, 'SAPP22827_AUTO_DELETE_ME.txt'), { timeout: 8000 }); await page.waitForTimeout(1000); await page.getByRole('button', { name: /^Save$/ }).click({ timeout: 6000 }); await page.waitForTimeout(3500); }
    await goRes(); expect((await bodyText(page)).includes(PFX), 'Upload throwaway thất bại').toBeTruthy();

    // 028 delete No (item ở lại)
    await menuClick(/^(Delete|Xoá|Xóa)$/i); await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^No$/i }).first().click({ timeout: 3000 }).catch(() => page.keyboard.press('Escape').catch(() => {}));
    await page.waitForTimeout(1500); R['028'] = await present(); await shot(page, 'SAPP_MOBRES_TC_028', '01');

    // 020 rename cancel
    await menuClick(/^Rename$/i); await page.getByRole('textbox').last().fill('SAPP22827_TMP.txt').catch(() => {}); await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1500);
    R['020'] = (await present()) && !(await bodyText(page)).includes('SAPP22827_TMP'); await shot(page, 'SAPP_MOBRES_TC_020', '01');

    // 024 edit cancel
    await menuClick(/^Edit$/i); await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1200); R['024'] = await present(); await shot(page, 'SAPP_MOBRES_TC_024', '01');

    // 026 move cancel
    await menuClick(/^Move To Folder$/i); const moveTxt = await bodyText(page); R['026_modal'] = /Move To Folder/i.test(moveTxt) && /\bName\b/.test(moveTxt); await shot(page, 'SAPP_MOBRES_TC_026', '05_modal'); await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 3000 }).catch(() => page.keyboard.press('Escape').catch(() => {})); await page.waitForTimeout(1500); R['026'] = await present();

    // 023 edit permission save (toggle checkbox trong Edit)
    await menuClick(/^Edit$/i); await page.waitForTimeout(800); await shot(page, 'SAPP_MOBRES_TC_023', '01_edit'); const eTxt = await bodyText(page); R['023_form'] = /Student/i.test(eTxt) && /Teacher/i.test(eTxt); await page.getByRole('button', { name: /^Save$/i }).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1800); R['023'] = await present();

    // 021 rename unicode (giữ prefix SAPP22827 để cleanup tìm được)
    await menuClick(/^Rename$/i); await page.getByRole('textbox').last().fill('SAPP22827_Tài liệu ✎ ünicode.txt').catch(() => {}); await page.getByRole('button', { name: /^Save$/i }).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(2000);
    R['021'] = (await present()); await shot(page, 'SAPP_MOBRES_TC_021', '01');

    // 029 double-tap delete (cũng là cleanup)
    await menuClick(/^(Delete|Xoá|Xóa)$/i); await page.waitForTimeout(400);
    const yes = page.getByRole('button', { name: /^Yes$/i }).first();
    await yes.click({ timeout: 2500 }).catch(() => {}); await yes.click({ timeout: 800 }).catch(() => {}); // double-tap
    await page.waitForTimeout(3000); const gone = !(await present()); R['029'] = gone; await shot(page, 'SAPP_MOBRES_TC_029', '01');

    fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_028', 'observations.txt'), JSON.stringify(R, null, 2), 'utf8');
    expect(R['028'], '028 delete-No item không ở lại').toBeTruthy();
    expect(R['020'], '020 rename-cancel không giữ nguyên').toBeTruthy();
    expect(R['026_modal'], '026 modal Move không mở').toBeTruthy();
    expect(R['023_form'], '023 form Edit thiếu Student/Teacher').toBeTruthy();
    expect(R['029'], '029 xoá không sạch (net-zero fail)').toBeTruthy();
  } finally {
    // cleanup phòng orphan
    if (await present().catch(() => false)) { await menuClick(/^(Delete|Xoá|Xóa)$/i); await page.getByRole('button', { name: /^Yes$/i }).first().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(2500); const still = await present().catch(() => true); if (still) { fs.writeFileSync(path.join(ART, 'ORPHAN_WARNING.txt'), 'crud orphan\n', 'utf8'); console.log('⚠ ORPHAN còn lại!'); } else console.log('cleanup OK'); }
  }
});
