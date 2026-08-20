import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — Xóa HV: batch network/edge (cross-browser: setOffline + route-delay).
 * TC_002 loading-state (Slow), TC_013 offline khi Yes (không xoá mồ côi, không crash), TC_003 empty-state lớp 0 HV. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const STATE = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation/ops_state.json');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CLASS = '1e8d953c-83f8-49d9-9cce-5ea3af76d2cf';
const SCAN = ['9faf72a4-af1f-4056-a833-b260de91e6f7', '479bf5f4-8f78-4f7a-a460-ee482bab68d4', '3bdae22c-5a33-4714-a3cf-3bb467c3bdcb', 'b08bcc1c-88af-41c1-9121-90723f45a130', 'e0d90c55-e48c-4a38-b69f-cb6539827e7b', 'b4e69959-2d46-473b-8578-fc1a62c85b4c', 'bec33159-2fcf-4163-a389-46b0480b9ce9', '0a286c0c-2159-4f12-afa6-8fa1559ae64c'];
const STU = 'Mạnh Nguyễn Hùng'; const MATCH = 'Mạnh Nguyễn Hùng|manhnh\\+100|S000150|manh_norole';
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function maskPII(p: Page) { await p.evaluate(() => { const w = (el: Node) => { for (const n of Array.from(el.childNodes)) { if (n.nodeType === 3 && n.nodeValue) n.nodeValue = n.nodeValue.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '•••@•••').replace(/(?:\+?84|0)\d{8,10}/g, '•••••••••'); else w(n); } }; w(document.body); }).catch(() => {}); }
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await maskPII(p); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
async function gotoStudents(p: Page, id = CLASS) { for (let i = 0; i < 4; i++) { await p.goto(`${OPS_BASE}/classes/detail/${id}/students`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3200); const t = await bodyText(p); if (!/Network error|Forbidden/i.test(t)) return; await p.waitForTimeout(2500 + i * 1500); } }
const inClass = async (p: Page) => new RegExp(MATCH, 'i').test(await bodyText(p));
async function openDeleteModal(p: Page): Promise<boolean> {
  const ok = await p.evaluate((m) => { const re = new RegExp(m, 'i'); for (const s of Array.from(document.querySelectorAll('span.sapp-btn-action-cell'))) { let c: any = s; for (let i = 0; i < 6 && c.parentElement; i++) { c = c.parentElement; if (re.test(c.textContent || '')) { s.setAttribute('data-x', '1'); return true; } } } return false; }, MATCH);
  if (!ok) return false;
  await p.locator('span.sapp-btn-action-cell[data-x="1"]').click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(900);
  await p.getByText(/^Delete$/i).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(900);
  return /chắc chắn muốn xóa|Are you sure/i.test(await bodyText(p));
}
async function enroll(p: Page) {
  await gotoStudents(p);
  await p.getByText(/^\+?\s*Add$/i).first().click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(2500);
  await p.getByPlaceholder(/^Search$/i).first().fill(STU).catch(() => {});
  await p.getByRole('button', { name: /^Search$/i }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(2500);
  const tick = await p.evaluate((m) => { const re = new RegExp(m, 'i'); for (const cb of Array.from(document.querySelectorAll('input[type="checkbox"]'))) { let c: any = cb; for (let i = 0; i < 6 && c.parentElement; i++) { c = c.parentElement; if (re.test(c.textContent || '')) { const r = cb.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; } } } return null; }, MATCH);
  if (tick) await p.mouse.click(tick.x, tick.y); await p.waitForTimeout(600);
  await p.getByRole('button', { name: /^Add$/i }).first().click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(3000);
  await gotoStudents(p);
}
async function removeNorole(p: Page): Promise<boolean> { await gotoStudents(p); if (!(await inClass(p))) return true; if (!(await openDeleteModal(p))) return false; await p.getByRole('button', { name: /^Yes$/i }).first().click({ timeout: 2500 }).catch(() => {}); await p.waitForTimeout(2500); await gotoStudents(p); return !(await inClass(p)); }

let page: Page; let ctxRef: BrowserContext;
test.beforeAll(async ({ browser }) => { ctxRef = await browser.newContext({ ...iphone, storageState: STATE }); await ctxRef.addInitScript(() => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;}'; (document.head || document.documentElement).appendChild(s); }); page = await ctxRef.newPage(); });
test.afterAll(async () => { await ctxRef.close().catch(() => {}); });
test.skip(!haveOpsCreds, 'no creds');

test('SAPP_MOBSTU_TC_002 — loading state khi tải List Students (route-delay)', async () => {
  test.setTimeout(120_000);
  // delay các XHR/fetch API ~3.5s để lộ trạng thái loading
  await page.route('**', async (route) => { const rt = route.request().resourceType(); if (rt === 'xhr' || rt === 'fetch') { await new Promise((r) => setTimeout(r, 3500)); } await route.continue().catch(() => {}); });
  await page.goto(`${OPS_BASE}/classes/detail/${CLASS}/students`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1200); // giữa lúc API còn delay
  const loadingUI = await page.evaluate(() => /Loading|Đang tải/i.test(document.body.innerText || '') || document.querySelectorAll('[class*="spin" i],[class*="load" i],[class*="skeleton" i],[class*="shimmer" i]').length > 0);
  await shot(page, 'SAPP_MOBSTU_TC_002', '01_loading');
  await page.waitForTimeout(5000); // chờ data về
  const dataUI = /Email|Level|Student/i.test(await bodyText(page));
  await shot(page, 'SAPP_MOBSTU_TC_002', '02_loaded');
  await page.unroute('**').catch(() => {});
  fs.writeFileSync(path.join(ART, 'SAPP_MOBSTU_TC_002', 'observations.txt'), `Trong lúc API delay: có loading indicator (spinner/skeleton/text)=${loadingUI}\nSau khi API về: data hiển thị=${dataUI}\n`, 'utf8');
  expect(loadingUI, 'phải có trạng thái loading trong lúc tải').toBeTruthy();
  expect(dataUI, 'data phải hiển thị sau khi tải xong').toBeTruthy();
});

test('SAPP_MOBSTU_TC_013 — mất mạng khi tap Yes → không xoá, không crash', async () => {
  test.setTimeout(150_000);
  await removeNorole(page).catch(() => {});
  await enroll(page);
  expect(await inClass(page), 'precondition enroll').toBeTruthy();
  const m = await openDeleteModal(page); await shot(page, 'SAPP_MOBSTU_TC_013', '01_modal');
  await ctxRef.setOffline(true); // NGẮT MẠNG
  await page.getByRole('button', { name: /^Yes$/i }).first().click({ timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(3000);
  const crashed = await page.evaluate(() => /Application error|Cannot read|undefined is not|white screen/i.test(document.body.innerText || '') || document.body.innerText.trim().length < 5);
  await shot(page, 'SAPP_MOBSTU_TC_013', '02_offline_yes');
  await ctxRef.setOffline(false); // khôi phục mạng
  await page.waitForTimeout(1500);
  await gotoStudents(page);
  const stillThere = await inClass(page);
  await shot(page, 'SAPP_MOBSTU_TC_013', '03_after');
  fs.writeFileSync(path.join(ART, 'SAPP_MOBSTU_TC_013', 'observations.txt'), `modal mở=${m}, offline khi Yes → app crash/trắng=${crashed}, manh_norole VẪN trong lớp (không xoá mồ côi)=${stillThere}\n`, 'utf8');
  await removeNorole(page).catch(() => {}); // cleanup net-zero
  expect(crashed, 'mất mạng KHÔNG được làm app crash/trắng').toBeFalsy();
  expect(stillThere, 'mất mạng khi Yes → KHÔNG xoá (không mồ côi)').toBeTruthy();
});

test('SAPP_MOBSTU_TC_003 — empty-state lớp 0 học viên', async () => {
  test.setTimeout(150_000);
  let emptyClass = ''; let scannedCounts: any[] = [];
  for (const id of SCAN) {
    await gotoStudents(page, id);
    const dots = await page.locator('span.sapp-btn-action-cell').count().catch(() => 0);
    const noData = /No Data|Không có|No result|empty/i.test(await bodyText(page));
    scannedCounts.push({ id: id.slice(0, 8), dots, noData });
    if (dots === 0) { emptyClass = id; break; }
  }
  fs.mkdirSync(path.join(ART, 'SAPP_MOBSTU_TC_003'), { recursive: true });
  fs.writeFileSync(path.join(ART, 'SAPP_MOBSTU_TC_003', 'observations.txt'), `Scan lớp tìm 0-HV: ${JSON.stringify(scannedCounts)}\nLớp 0-HV: ${emptyClass || '(không tìm thấy trong tập scan)'}\n`, 'utf8');
  if (!emptyClass) { test.skip(true, 'không có lớp 0-HV trong tập scan → cần lớp "#2 Lớp rỗng" chỉ định'); return; }
  await gotoStudents(page, emptyClass);
  const dots = await page.locator('span.sapp-btn-action-cell').count();
  const addFilter = /\+?\s*Add/i.test(await bodyText(page)) && /Filter/i.test(await bodyText(page));
  await shot(page, 'SAPP_MOBSTU_TC_003', '01_empty_state');
  expect(dots, 'empty-state: không có card học viên (0 ⋮)').toBe(0);
  expect(addFilter, 'empty-state: hàng action Add/Filter vẫn hiển thị').toBeTruthy();
});
