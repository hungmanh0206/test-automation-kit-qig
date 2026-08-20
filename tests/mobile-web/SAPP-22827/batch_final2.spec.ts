import { test, expect, type Page } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — batch2 (recon-sâu-driven): Add Teacher (029/032) + Move To Folder Cancel (026).
 * ⋮ menu mở bằng page.mouse.click (real pointer). Read-only/negative/Cancel → KHÔNG mutate. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CGMA = `${OPS_BASE}/classes/detail/1e8d953c-83f8-49d9-9cce-5ea3af76d2cf`;
const ZOOM = `${OPS_BASE}/classes/detail/479bf5f4-8f78-4f7a-a460-ee482bab68d4`;
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
async function esc(p: Page) { await p.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 3000 }).catch(() => {}); await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(600); }

let page: Page;
test.beforeAll(async ({ browser }) => { const ctx = await browser.newContext({ ...iphone }); page = await ctx.newPage(); await loginOps(page); });

test('SAPP_MOBCAL_TC_029/032 — Add Teacher: search + no-select Add chặn (không gán)', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(120_000);
  await page.goto(`${CGMA}/overview`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1800);
  await page.getByText(/^Teachers$/).last().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /Add\/Edit Teacher/i }).first().click({ timeout: 5000 }).catch(() => page.getByText(/Add\/Edit Teacher/i).first().click().catch(() => {}));
  await page.waitForTimeout(2500);
  await shot(page, 'SAPP_MOBCAL_TC_029', '01_section_list');
  // click "Add Teacher" của section đầu → màn search giáo viên
  await page.getByRole('button', { name: /^Add Teacher$/i }).first().click({ timeout: 5000 }).catch(() => page.getByText(/^Add Teacher$/i).first().click().catch(() => {}));
  await page.waitForTimeout(3000);
  await shot(page, 'SAPP_MOBCAL_TC_029', '02_teacher_search');
  const txt = await bodyText(page);
  const reached = /Search/i.test(txt) && /(Code:|Belong To:|Priority:|Ưu tiên|From date|No data)/i.test(txt);
  // 029: gõ search
  await page.getByPlaceholder(/search/i).or(page.locator('input[type="search"]')).first().fill('a', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1500); await shot(page, 'SAPP_MOBCAL_TC_029', '03_searched');
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_029', 'observations.txt'), `màn search giáo viên mở: ${reached}\nSearch: ${/Search/i.test(txt)} · From/To date: ${/From date|To date/i.test(txt)} · teacher card/no-data: ${/(Code:|Belong To:|Ưu tiên|No data)/i.test(txt)}\n`, 'utf8');
  // 032: Add khi chưa chọn
  const addBtn = page.getByRole('button', { name: /^Add$/i }).last();
  const enabledNoSel = await addBtn.isEnabled().catch(() => false);
  await addBtn.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const stillThere = /Search/i.test(await bodyText(page));
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_032', 'observations.txt'), `Add khi chưa chọn: enabled=${enabledNoSel} · còn ở màn (chặn): ${stillThere}\n`, 'utf8');
  await shot(page, 'SAPP_MOBCAL_TC_032', '01_no_select');
  await esc(page); await esc(page);
  expect(reached, 'Không tới màn search giáo viên').toBeTruthy();
  expect(!enabledNoSel || stillThere, 'Add khi chưa chọn đáng lẽ bị chặn').toBeTruthy();
});

test('SAPP_MOBRES_TC_026 — Move To Folder: mở modal (⋮ mouse-click) + Cancel không chuyển', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(120_000);
  await page.goto(`${ZOOM}/overview`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1800);
  await page.getByText(/^Resources$/).last().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2800);
  const firstFile = await page.evaluate(() => ((document.body.innerText.match(/[^\n]+\.(pdf|docx?|xlsx?|csv|txt|pptx?|zip|png|jpe?g|webp|gif|mp4)\b/i) || [])[0] || '').trim().slice(0, 15));
  // toạ độ ⋮ item đầu
  const box = await page.evaluate(() => { const leaf = Array.from(document.querySelectorAll('*')).find((e) => e.children.length === 0 && /\.(pdf|docx?|xlsx?|csv|txt|pptx?|zip|png|jpe?g|webp|gif|mp4)\b/i.test(e.textContent || '')); if (!leaf) return null; let c: any = leaf; for (let i = 0; i < 6 && c.parentElement; i++) c = c.parentElement; const nr = leaf.getBoundingClientRect(); const bs = Array.from(c.querySelectorAll('button,[role="button"]')) as any[]; let best = null, bx = -1; for (const b of bs) { const r = b.getBoundingClientRect(); if (r.top >= 0 && r.left > nr.left + nr.width - 30 && r.width < 60 && r.height < 60 && r.left > bx) { bx = r.left; best = r; } } return best ? { x: best.left + best.width / 2, y: best.top + best.height / 2 } : null; });
  if (box) await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(1200);
  await shot(page, 'SAPP_MOBRES_TC_026', '01_menu');
  await page.getByText(/^Move To Folder$/i).last().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, 'SAPP_MOBRES_TC_026', '02_move_modal');
  const txt = await bodyText(page);
  const isModal = /Move To Folder/i.test(txt) && /\bName\b/i.test(txt);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_026', 'observations.txt'), `⋮ box: ${JSON.stringify(box)}\nmodal Move mở: ${isModal}\nsnippet: ${txt.slice(0, 260).replace(/\n/g, ' | ')}\n`, 'utf8');
  await esc(page); await page.waitForTimeout(1200);
  const stillHasFile = (await bodyText(page)).includes(firstFile);
  expect(isModal, 'Không mở được modal Move To Folder').toBeTruthy();
  expect(stillHasFile, 'Cancel Move nhưng tài liệu biến mất').toBeTruthy();
});
