import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — Modal xác nhận xoá HV: batch biến thể (non-destructive, enroll manh_norole, KHÔNG xoá).
 * TC_010 back-khi-modal, TC_015 touch Yes/No, TC_019 landscape, TC_020 design-token màu/thứ tự nút. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const STATE = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation/ops_state.json');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CLASS = '1e8d953c-83f8-49d9-9cce-5ea3af76d2cf';
const STU = 'Mạnh Nguyễn Hùng'; const MATCH = 'Mạnh Nguyễn Hùng|manhnh\\+100|S000150|manh_norole';
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function maskPII(p: Page) { await p.evaluate(() => { const w = (el: Node) => { for (const n of Array.from(el.childNodes)) { if (n.nodeType === 3 && n.nodeValue) n.nodeValue = n.nodeValue.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '•••@•••').replace(/(?:\+?84|0)\d{8,10}/g, '•••••••••'); else w(n); } }; w(document.body); }).catch(() => {}); }
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await maskPII(p); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
async function gotoStudents(p: Page) { for (let i = 0; i < 4; i++) { await p.goto(`${OPS_BASE}/classes/detail/${CLASS}/students`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3200); const t = await bodyText(p); if (!/Network error|Forbidden/i.test(t) && /(Email|Level|Student)/i.test(t)) return; await p.waitForTimeout(2500 + i * 1500); } }
const inClass = async (p: Page) => new RegExp(MATCH, 'i').test(await bodyText(p));
async function openNoroleMenu(p: Page): Promise<boolean> {
  const ok = await p.evaluate((m) => { const re = new RegExp(m, 'i'); for (const s of Array.from(document.querySelectorAll('span.sapp-btn-action-cell'))) { let c: any = s; for (let i = 0; i < 6 && c.parentElement; i++) { c = c.parentElement; if (re.test(c.textContent || '')) { s.setAttribute('data-x', '1'); return true; } } } return false; }, MATCH);
  if (!ok) return false;
  await p.locator('span.sapp-btn-action-cell[data-x="1"]').click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(900);
  return /Delete|Chuyển nhượng/i.test(await bodyText(p));
}
async function openDeleteModal(p: Page): Promise<boolean> {
  if (!(await openNoroleMenu(p))) return false;
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
async function removeNorole(p: Page): Promise<boolean> { await p.setViewportSize({ width: 390, height: 844 }).catch(() => {}); await gotoStudents(p); if (!(await inClass(p))) return true; if (!(await openDeleteModal(p))) return false; await p.getByRole('button', { name: /^Yes$/i }).first().click({ timeout: 2500 }).catch(() => {}); await p.waitForTimeout(2500); await gotoStudents(p); return !(await inClass(p)); }
// đóng modal an toàn (No) nếu đang mở
async function closeModalNo(p: Page) { await p.getByRole('button', { name: /^No$/i }).first().click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(800); }

let page: Page; let ctxRef: BrowserContext;
test.beforeAll(async ({ browser }) => { ctxRef = await browser.newContext({ ...iphone, storageState: STATE }); await ctxRef.addInitScript(() => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;}'; (document.head || document.documentElement).appendChild(s); }); page = await ctxRef.newPage(); await removeNorole(page).catch(() => {}); await enroll(page); });
test.afterAll(async () => { await removeNorole(page).catch(() => {}); await ctxRef.close().catch(() => {}); });
test.skip(!haveOpsCreds, 'no creds');

test('SAPP_MOBSTU_TC_010 — nhấn Back khi mở modal → KHÔNG xoá', async () => {
  test.setTimeout(120_000);
  const m = await openDeleteModal(page); await shot(page, 'SAPP_MOBSTU_TC_010', '01_modal');
  await page.goBack({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1500);
  await gotoStudents(page);
  const still = await inClass(page);
  await shot(page, 'SAPP_MOBSTU_TC_010', '02_after_back');
  fs.writeFileSync(path.join(ART, 'SAPP_MOBSTU_TC_010', 'observations.txt'), `modal mở=${m}, sau Back manh_norole vẫn trong lớp=${still} (đúng: KHÔNG xoá)\n`, 'utf8');
  expect(m, 'modal Delete phải mở').toBeTruthy();
  expect(still, 'Back khi mở modal phải KHÔNG xoá học viên').toBeTruthy();
});

test('SAPP_MOBSTU_TC_015 — touch target nút Yes/No (đo px)', async () => {
  test.setTimeout(120_000);
  const m = await openDeleteModal(page);
  const yes = await page.getByRole('button', { name: /^Yes$/i }).first().boundingBox();
  const no = await page.getByRole('button', { name: /^No$/i }).first().boundingBox();
  await shot(page, 'SAPP_MOBSTU_TC_015', '01_modal_buttons');
  await closeModalNo(page);
  const yOk = yes && yes.width >= 44 && yes.height >= 44; const nOk = no && no.width >= 44 && no.height >= 44;
  fs.writeFileSync(path.join(ART, 'SAPP_MOBSTU_TC_015', 'observations.txt'), `modal mở=${m}\nYes = ${yes ? Math.round(yes.width) + 'x' + Math.round(yes.height) : 'n/a'}px (≥44: ${yOk})\nNo = ${no ? Math.round(no.width) + 'x' + Math.round(no.height) : 'n/a'}px (≥44: ${nOk})\n`, 'utf8');
  expect(m, 'modal phải mở để đo nút').toBeTruthy();
  expect(yOk && nOk, 'nút Yes & No phải ≥44x44px (mobile tap)').toBeTruthy();
});

test('SAPP_MOBSTU_TC_019 — xoay landscape → nút Yes/No không mất', async () => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 844, height: 390 }); // iPhone 13 landscape
  const m = await openDeleteModal(page);
  const yesVis = await page.getByRole('button', { name: /^Yes$/i }).first().isVisible().catch(() => false);
  const noVis = await page.getByRole('button', { name: /^No$/i }).first().isVisible().catch(() => false);
  await shot(page, 'SAPP_MOBSTU_TC_019', '01_landscape_modal');
  await closeModalNo(page);
  await page.setViewportSize({ width: 390, height: 844 }); // trả portrait
  fs.writeFileSync(path.join(ART, 'SAPP_MOBSTU_TC_019', 'observations.txt'), `Landscape 844x390: modal mở=${m}, nút Yes hiển thị=${yesVis}, nút No hiển thị=${noVis}\n`, 'utf8');
  expect(m && yesVis && noVis, 'landscape: modal + nút Yes/No vẫn hiển thị').toBeTruthy();
});

test('SAPP_MOBSTU_TC_020 — design token: Yes nền đỏ, thứ tự nút', async () => {
  test.setTimeout(120_000);
  const m = await openDeleteModal(page);
  const style = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')).filter((b) => /^(Yes|No)$/.test((b.textContent || '').trim()));
    const yes = btns.find((b) => (b.textContent || '').trim() === 'Yes');
    const no = btns.find((b) => (b.textContent || '').trim() === 'No');
    const bg = yes ? getComputedStyle(yes).backgroundColor : '';
    const yesX = yes ? yes.getBoundingClientRect().x : -1; const noX = no ? no.getBoundingClientRect().x : -1;
    return { yesBg: bg, yesLeftOfNo: yesX >= 0 && noX >= 0 && yesX < noX };
  });
  await shot(page, 'SAPP_MOBSTU_TC_020', '01_tokens');
  await closeModalNo(page);
  // đỏ ~ #F01919 = rgb(240,25,25): R cao, G/B thấp
  const rgb = (style.yesBg.match(/\d+/g) || []).map(Number);
  const isRed = rgb.length >= 3 && rgb[0] > 180 && rgb[1] < 90 && rgb[2] < 90;
  fs.writeFileSync(path.join(ART, 'SAPP_MOBSTU_TC_020', 'observations.txt'), `modal mở=${m}\nNút Yes background=${style.yesBg} (đỏ ~#F01919: ${isRed})\nThứ tự: Yes bên trái No=${style.yesLeftOfNo}\n`, 'utf8');
  expect(m, 'modal phải mở').toBeTruthy();
  expect(isRed, 'nút Yes phải nền đỏ (~#F01919)').toBeTruthy();
  expect(style.yesLeftOfNo, 'thứ tự nút: Yes bên trái, No bên phải').toBeTruthy();
});
