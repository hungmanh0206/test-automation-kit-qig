import { test, expect, type Page } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — batch gọn (recon-driven): Add Teacher (029/032), Move To Folder Cancel (026), Edit Lesson start>end (018).
 * Tất cả read-only / negative / Cancel → KHÔNG mutate data thật. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CGMA = `${OPS_BASE}/classes/detail/1e8d953c-83f8-49d9-9cce-5ea3af76d2cf`;
const ZOOM = `${OPS_BASE}/classes/detail/479bf5f4-8f78-4f7a-a460-ee482bab68d4`;
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
async function esc(p: Page) { await p.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 3000 }).catch(() => {}); await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(700); }

let page: Page;
test.beforeAll(async ({ browser }) => { const ctx = await browser.newContext({ ...iphone }); page = await ctx.newPage(); await loginOps(page); });

test('SAPP_MOBCAL_TC_029/032 — Add Teacher (tab Teachers → Add/Edit Teacher): search + no-select Add chặn', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(120_000);
  await page.goto(`${CGMA}/overview`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1800);
  await page.getByText(/^Teachers$/).last().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2500);
  await page.getByText(/Add\/Edit Teacher|Add Teacher/i).last().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await shot(page, 'SAPP_MOBCAL_TC_029', '01_add_teacher');
  const txt = await bodyText(page);
  const reached = /Search/i.test(txt) && /(Code:|Belong To:|Priority:|Ưu tiên|From date)/i.test(txt);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_029', 'observations.txt'), `mở Add Teacher: ${reached}\nSearch: ${/Search/i.test(txt)} · From/To date: ${/From date|To date/i.test(txt)} · teacher card: ${/(Code:|Belong To:|Priority:|Ưu tiên)/i.test(txt)}\n`, 'utf8');
  // 029 search
  const search = page.getByPlaceholder(/search/i).or(page.locator('input[type="search"]')).first();
  await search.fill('a', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, 'SAPP_MOBCAL_TC_029', '02_search');
  // 032 no-select Add
  const addBtn = page.getByRole('button', { name: /^Add$/i }).last();
  const enabledNoSel = await addBtn.isEnabled().catch(() => false);
  await addBtn.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const stillThere = /Search/i.test(await bodyText(page)) && /(Code:|Belong To:|Ưu tiên|From date)/i.test(await bodyText(page));
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_032', 'observations.txt'), `Add khi chưa chọn: enabled=${enabledNoSel} · còn ở màn (chặn/không gán): ${stillThere}\n`, 'utf8');
  await shot(page, 'SAPP_MOBCAL_TC_032', '01_no_select');
  await esc(page);
  expect(reached, 'Không mở được Add Teacher từ tab Teachers').toBeTruthy();
  expect(!enabledNoSel || stillThere, 'Add khi chưa chọn giáo viên đáng lẽ bị chặn').toBeTruthy();
});

test('SAPP_MOBRES_TC_026 — Move To Folder: mở modal, có folder + Cancel không chuyển (no mutate)', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(120_000);
  await page.goto(`${ZOOM}/overview`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1800);
  await page.getByText(/^Resources$/).last().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2800);
  const firstFile = await page.evaluate(() => { const m = (document.body.innerText.match(/[^\n]+\.(pdf|docx?|xlsx?|csv|txt|pptx?|zip|png|jpe?g|webp|gif|mp4)\b/i) || [])[0]; return (m || '').trim().slice(0, 30); });
  // ⋮ item đầu → Move To Folder
  await page.evaluate(() => { const leaf = Array.from(document.querySelectorAll('*')).find((e) => e.children.length === 0 && /\.(pdf|docx?|xlsx?|csv|txt|pptx?|zip|png|jpe?g|webp|gif|mp4)\b/i.test(e.textContent || '')); if (!leaf) return; let c: any = leaf; for (let i = 0; i < 6 && c.parentElement; i++) c = c.parentElement; const nr = leaf.getBoundingClientRect(); const bs = Array.from(c.querySelectorAll('button')) as any[]; let best = null, bx = -1; for (const b of bs) { const r = b.getBoundingClientRect(); if (Math.abs(r.top - nr.top) < 70 && r.left > nr.left + nr.width - 20 && r.width < 60 && r.left > bx) { bx = r.left; best = b; } } if (best) best.click(); });
  await page.waitForTimeout(1000);
  await page.getByText(/^Move To Folder$/i).last().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, 'SAPP_MOBRES_TC_026', '01_move_modal');
  const txt = await bodyText(page);
  const isModal = /Move To Folder/i.test(txt) && /Name/i.test(txt);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_026', 'observations.txt'), `modal Move mở: ${isModal}\ncó cột Name: ${/Name/i.test(txt)} · có folder list: ${/File Record|Issue|TUẦN CHÂU|\.docx|folder/i.test(txt)}\nsnippet: ${txt.slice(0, 300).replace(/\n/g, ' | ')}\n`, 'utf8');
  // Cancel → không chuyển
  await page.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 3000 }).catch(() => page.keyboard.press('Escape').catch(() => {}));
  await page.waitForTimeout(1500);
  const stillHasFile = (await bodyText(page)).includes(firstFile.slice(0, 15));
  expect(isModal, 'Không mở được modal Move To Folder').toBeTruthy();
  expect(stillHasFile, 'Cancel Move nhưng tài liệu biến mất (không nên)').toBeTruthy();
});

test('SAPP_MOBCAL_TC_018 — Edit Lesson: bật Edit, giờ bắt đầu > kết thúc bị chặn (Cancel, no save)', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(120_000);
  await page.goto(`${CGMA}/calendar`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(1000);
  await page.locator('text=/\\d{1,2}:\\d{2}\\s*[-–]\\s*\\d{1,2}:\\d{2}/').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(2500);
  // bật Edit
  await page.getByRole('button', { name: /^Edit$/i }).last().click({ timeout: 4000 }).catch(() => page.getByText(/^Edit$/i).last().click().catch(() => {}));
  await page.waitForTimeout(2000);
  await shot(page, 'SAPP_MOBCAL_TC_018', '01_edit_mode');
  // set Start Time > End Time
  const start = page.getByPlaceholder(/Start Time/i).first();
  const end = page.getByPlaceholder(/End Time/i).first();
  const editable = await start.isEditable().catch(() => false);
  await start.fill('22:00', { timeout: 3000 }).catch(() => {});
  await end.fill('20:00', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^Save$/i }).last().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, 'SAPP_MOBCAL_TC_018', '02_after_save_invalid');
  const afterTxt = await bodyText(page);
  const blocked = /(end time|kết thúc|greater|lớn hơn|invalid|không hợp lệ|must be|phải)/i.test(afterTxt) || /Manual Schedule|Automatic Schedule/i.test(afterTxt);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_018', 'observations.txt'), `Edit bật được (time editable): ${editable}\nstart>end → bị chặn (còn modal/có lỗi): ${blocked}\n`, 'utf8');
  // Cancel dứt khoát để KHÔNG lưu
  await esc(page); await esc(page);
  expect(editable, 'Không bật được Edit / time không editable').toBeTruthy();
  expect(blocked, 'start>end đáng lẽ bị chặn').toBeTruthy();
});
