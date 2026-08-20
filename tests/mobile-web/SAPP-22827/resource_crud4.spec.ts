import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — Resource CRUD net-zero (áp feedback): kill-animation + open-menu idempotent-retry +
 * 1 op / fresh-nav (KHÔNG chain) + namespace PFX + guard-rail sweep finally. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const AUTO = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CFA = `${OPS_BASE}/classes/detail/9faf72a4-af1f-4056-a833-b260de91e6f7`;
const PFX = 'SAPP22827';
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
async function killAnim(ctx: BrowserContext) { await ctx.addInitScript(() => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important;}'; (document.head || document.documentElement).appendChild(s); }); }

let page: Page; let RES = '';
async function goRes() { if (!RES) { await page.goto(`${CFA}/overview`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500); await page.getByText(/^Resources$/).last().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2500); RES = page.url(); } else { await page.goto(RES, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500); } }
// open menu = idempotent, retry CHỈ bước mở
async function openMenu(): Promise<boolean> {
  for (let i = 0; i < 4; i++) {
    await page.evaluate((pfx) => { const leaf = Array.from(document.querySelectorAll('*')).find((e) => e.children.length === 0 && (e.textContent || '').includes(pfx)); if (!leaf) return; leaf.scrollIntoView({ block: 'center' }); let c: any = leaf; for (let k = 0; k < 6 && c.parentElement; k++) c = c.parentElement; const nr = leaf.getBoundingClientRect(); const bs = Array.from(c.querySelectorAll('svg,button,[role="button"],[class*="action" i]')) as any[]; let best: any = null, bx = -1; for (const b of bs) { const r = b.getBoundingClientRect(); if (Math.abs(r.top - nr.top) < 80 && r.left > nr.left + nr.width - 40 && r.width < 60 && r.height < 60 && r.left > bx) { bx = r.left; best = b; } } if (best) (best.closest('[class*="action" i]') || best.parentElement || best).click(); }, PFX);
    await page.waitForTimeout(600);
    if (/Rename|Move To Folder|Download File/i.test(await bodyText(page))) return true;
  }
  return false;
}
async function present() { await goRes(); return (await bodyText(page)).includes(PFX); }
// guard-rail sweep: chỉ xoá item khớp PFX
async function sweep() { for (let k = 0; k < 6; k++) { if (!(await present())) return; if (!(await openMenu())) return; await page.getByText(/^(Delete|Xoá|Xóa)$/i).last().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(500); await page.getByRole('button', { name: /^Yes$/i }).click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(2000); } }
async function uploadThrow() { await goRes(); if ((await bodyText(page)).includes(PFX)) return; await page.getByText(/^Upload$/).first().click({ timeout: 6000 }); await page.waitForTimeout(800); await page.getByText(/^File$/).last().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1600); await page.locator('input[type="file"]').first().setInputFiles(path.join(AUTO, 'SAPP22827_AUTO_DELETE_ME.txt')).catch(() => {}); await page.waitForTimeout(900); await page.getByRole('button', { name: /^Save$/ }).click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(3000); }

test.beforeAll(async ({ browser }) => { const ctx = await browser.newContext({ ...iphone }); await killAnim(ctx); page = await ctx.newPage(); await loginOps(page); await sweep(); await uploadThrow(); expect((await present()), 'setup upload fail').toBeTruthy(); });
test.afterAll(async () => { await sweep().catch(() => {}); const orphan = await present().catch(() => true); if (orphan) { fs.writeFileSync(path.join(ART, 'ORPHAN_WARNING.txt'), 'crud4\n', 'utf8'); console.log('⚠ ORPHAN'); } else console.log('✓ swept clean'); });

test('SAPP_MOBRES_TC_028 — Delete: No/backdrop giữ nguyên tài liệu', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  expect(await openMenu(), 'menu không mở').toBeTruthy();
  await page.getByText(/^(Delete|Xoá|Xóa)$/i).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(600); await shot(page, 'SAPP_MOBRES_TC_028', '01_confirm');
  await page.getByRole('button', { name: /^No$/i }).first().click({ timeout: 2500 }).catch(() => page.keyboard.press('Escape').catch(() => {})); await page.waitForTimeout(1200);
  expect(await present(), 'Delete No nhưng tài liệu mất').toBeTruthy();
});

test('SAPP_MOBRES_TC_020 — Rename: Cancel không đổi tên', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goRes(); expect(await openMenu(), 'menu không mở').toBeTruthy();
  await page.getByText(/^Rename$/i).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1000); await shot(page, 'SAPP_MOBRES_TC_020', '01_modal');
  const isModal = /Rename/i.test(await bodyText(page));
  const inp = page.locator('input:not([type=search]):not([type=file]),textarea').first();
  await inp.fill('SAPP22827_TMPRENAME.txt', { timeout: 3000 }).catch(() => {});
  await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 2500 }).catch(() => page.keyboard.press('Escape').catch(() => {})); await page.waitForTimeout(1200);
  const keep = (await present()) && !(await bodyText(page)).includes('SAPP22827_TMPRENAME');
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_020', 'observations.txt'), `modal Rename mở: ${isModal} · Cancel giữ tên cũ: ${keep}\n`, 'utf8');
  expect(isModal, 'Modal Rename không mở').toBeTruthy(); expect(keep, 'Cancel vẫn đổi tên?').toBeTruthy();
});

test('SAPP_MOBRES_TC_024 — Edit: Cancel không lưu (modal Student/Teacher permission)', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goRes(); expect(await openMenu(), 'menu không mở').toBeTruthy();
  await page.getByText(/^Edit$/i).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1200); await shot(page, 'SAPP_MOBRES_TC_024', '01_modal');
  const et = await bodyText(page); const isModal = /Student/i.test(et) && /Teacher/i.test(et) && /Permission|Attach|Viewer|Downloader/i.test(et);
  await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 2500 }).catch(() => page.keyboard.press('Escape').catch(() => {})); await page.waitForTimeout(1200);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_024', 'observations.txt'), `modal Edit (Student/Teacher/Permission) mở: ${isModal}\n`, 'utf8');
  expect(isModal, 'Modal Edit không mở đúng').toBeTruthy(); expect(await present(), 'item mất sau Edit-Cancel').toBeTruthy();
});

test('SAPP_MOBRES_TC_026 — Move To Folder: modal + Cancel không chuyển', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goRes(); expect(await openMenu(), 'menu không mở').toBeTruthy();
  await page.getByText(/^Move To Folder$/i).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1500); await shot(page, 'SAPP_MOBRES_TC_026', '07_modal');
  const mt = await bodyText(page); const isModal = /Move To Folder/i.test(mt) && /\bName\b/.test(mt);
  await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 2500 }).catch(() => page.keyboard.press('Escape').catch(() => {})); await page.waitForTimeout(1200);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_026', 'observations.txt'), `modal Move (cột Name + folder) mở: ${isModal}\n`, 'utf8');
  expect(isModal, 'Modal Move không mở').toBeTruthy(); expect(await present(), 'item mất sau Move-Cancel').toBeTruthy();
});
