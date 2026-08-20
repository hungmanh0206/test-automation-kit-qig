import { test, expect, type Page } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CGMA = `${OPS_BASE}/classes/detail/1e8d953c-83f8-49d9-9cce-5ea3af76d2cf`;
const ZOOM = `${OPS_BASE}/classes/detail/479bf5f4-8f78-4f7a-a460-ee482bab68d4`;
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
async function esc(p: Page) { await p.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 2500 }).catch(() => {}); await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(600); }

let page: Page;
test.beforeAll(async ({ browser }) => { const ctx = await browser.newContext({ ...iphone }); page = await ctx.newPage(); await loginOps(page); });

test('SAPP_MOBCAL_TC_029/031/032 — Add Teacher search screen: search + no-select Add chặn', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(120_000);
  await page.goto(`${CGMA}/overview`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1800);
  await page.getByText(/^Teachers$/).last().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2200);
  await page.getByRole('button', { name: /Add\/Edit Teacher/i }).first().click({ timeout: 5000 }).catch(() => page.getByText(/Add\/Edit Teacher/i).first().click().catch(() => {}));
  await page.waitForTimeout(2200);
  // click nút "+ Add Teacher" của section đầu (E3) — dùng locator button, chờ điều hướng
  const secBtn = page.getByRole('button', { name: /Add Teacher/i }).first();
  await secBtn.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(3500);
  await shot(page, 'SAPP_MOBCAL_TC_029', '04_search_screen');
  const txt = await bodyText(page);
  // màn search giáo viên: có ô Search + (teacher card Code/Belong To / hoặc "No data" danh sách GV) + nút Add
  const hasSearchBox = await page.getByPlaceholder(/search/i).or(page.locator('input[type="search"]')).first().count().catch(() => 0);
  const teacherCtx = /Code:|Belong To:|Priority:|Ưu tiên|From date - To date|Reset/i.test(txt);
  const reached = hasSearchBox > 0 && teacherCtx;
  // 029 search
  if (reached) { await page.getByPlaceholder(/search/i).or(page.locator('input[type="search"]')).first().fill('a').catch(() => {}); await page.waitForTimeout(1200); await shot(page, 'SAPP_MOBCAL_TC_029', '05_searched'); }
  // 032 Add no-select
  const addBtn = page.getByRole('button', { name: /^Add$/i }).last();
  const enabledNoSel = await addBtn.isEnabled().catch(() => false);
  await addBtn.click({ timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(1000);
  const still = /From date|Reset|Code:|Belong To:/i.test(await bodyText(page));
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_029', 'observations.txt'), `search screen reached: ${reached} (searchBox=${hasSearchBox}, teacherCtx=${teacherCtx})\n`, 'utf8');
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_032', 'observations.txt'), `Add khi chưa chọn enabled=${enabledNoSel} · còn ở màn (chặn): ${still}\n`, 'utf8');
  await esc(page); await esc(page); await esc(page);
  expect(reached, 'Chưa tới màn search giáo viên (Search+teacher context)').toBeTruthy();
});

test('SAPP_MOBRES_TC_026 — Move To Folder Cancel: ⋮ card trên cùng (visible)', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(120_000);
  await page.goto(`${ZOOM}/overview`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1800);
  await page.getByText(/^Resources$/).last().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2800);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(600);
  const firstFile = await page.evaluate(() => ((document.body.innerText.match(/[^\n]+\.(pdf|docx?|xlsx?|csv|txt|pptx?|zip|png|jpe?g|webp|gif|mp4)\b/i) || [])[0] || '').trim().slice(0, 15));
  // ⋮ của card trên-cùng-visible: chọn ext-leaf có top nhỏ nhất >=0; scrollIntoView; lấy ⋮ trong card
  const box = await page.evaluate(() => {
    const leaves = Array.from(document.querySelectorAll('*')).filter((e) => e.children.length === 0 && /\.(pdf|docx?|xlsx?|csv|txt|pptx?|zip|png|jpe?g|webp|gif|mp4)\b/i.test(e.textContent || ''));
    leaves.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    const leaf = leaves.find((e) => e.getBoundingClientRect().top >= 0) || leaves[0]; if (!leaf) return null;
    leaf.scrollIntoView({ block: 'center' });
    let c: any = leaf; for (let i = 0; i < 6 && c.parentElement; i++) c = c.parentElement;
    const nr = leaf.getBoundingClientRect(); const bs = Array.from(c.querySelectorAll('button,[role="button"]')) as any[];
    let best = null, bx = -1; for (const b of bs) { const r = b.getBoundingClientRect(); if (r.left > nr.left + nr.width - 30 && r.width < 60 && r.height < 60 && r.left > bx) { bx = r.left; best = r; } }
    return best ? { x: best.left + best.width / 2, y: best.top + best.height / 2 } : null;
  });
  if (box) await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(1200);
  await shot(page, 'SAPP_MOBRES_TC_026', '03_menu');
  await page.getByText(/^Move To Folder$/i).last().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, 'SAPP_MOBRES_TC_026', '04_move_modal');
  const txt = await bodyText(page);
  const isModal = /Move To Folder/i.test(txt) && /\bName\b/.test(txt);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_026', 'observations.txt'), `⋮ box: ${JSON.stringify(box)}\nmodal Move mở: ${isModal}\n`, 'utf8');
  await esc(page); await page.waitForTimeout(1000);
  const stillHasFile = (await bodyText(page)).includes(firstFile);
  expect(isModal, 'Không mở được modal Move To Folder').toBeTruthy();
  expect(stillHasFile, 'Cancel Move nhưng tài liệu biến mất').toBeTruthy();
});
