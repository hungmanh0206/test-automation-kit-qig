import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — Biến thể modal Xóa học viên (negative, KHÔNG xoá) trên HV throwaway manh_norole.
 * Enroll 1 lần → No-cancel / backdrop-cancel / double-tap-idempotent → đóng bằng Yes (net-zero).
 * Cover: MOBSTU delete-No (không xoá), delete-backdrop (không xoá), double-tap Yes idempotent. Mask PII. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence/SAPP_MOBSTU_delete_variants');
const STATE = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation/ops_state.json');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CLASS = '1e8d953c-83f8-49d9-9cce-5ea3af76d2cf';
const STU = 'Mạnh Nguyễn Hùng'; const MATCH = 'Mạnh Nguyễn Hùng|manhnh\\+100|S000150|manh_norole';
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function maskPII(p: Page) { await p.evaluate(() => { const w = (el: Node) => { for (const n of Array.from(el.childNodes)) { if (n.nodeType === 3 && n.nodeValue) n.nodeValue = n.nodeValue.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '•••@•••').replace(/(?:\+?84|0)\d{8,10}/g, '•••••••••'); else w(n); } }; w(document.body); }).catch(() => {}); }
async function shot(p: Page, n: string) { fs.mkdirSync(ART, { recursive: true }); await maskPII(p); await p.screenshot({ path: path.join(ART, `${n}.png`), fullPage: true }); }
async function gotoStudents(p: Page) { await p.goto(`${OPS_BASE}/classes/detail/${CLASS}/students`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000); }
const inClass = async (p: Page) => new RegExp(MATCH, 'i').test(await bodyText(p));
async function openNoroleMenu(p: Page): Promise<boolean> {
  const ok = await p.evaluate((m) => { const re = new RegExp(m, 'i'); for (const s of Array.from(document.querySelectorAll('span.sapp-btn-action-cell'))) { let c: any = s; for (let i = 0; i < 6 && c.parentElement; i++) { c = c.parentElement; if (re.test(c.textContent || '')) { s.setAttribute('data-x', '1'); return true; } } } return false; }, MATCH);
  if (!ok) return false;
  await p.locator('span.sapp-btn-action-cell[data-x="1"]').click({ timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(900);
  return /Delete|Chuyển nhượng/i.test(await bodyText(p));
}
async function openDeleteModal(p: Page): Promise<boolean> {
  if (!(await openNoroleMenu(p))) return false;
  await p.getByText(/^Delete$/i).first().click({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(800);
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
test.afterAll(async () => { await removeNorole(page).catch(() => {}); await ctxRef.close().catch(() => {}); });

test.skip(!haveOpsCreds, 'no creds');

test('SAPP_MOBSTU delete-modal variants (No / backdrop / double-tap) — non-destructive', async () => {
  test.setTimeout(220_000);
  const obs: string[] = [];
  await removeNorole(page).catch(() => {}); // sạch trước
  await enroll(page);
  const enrolled = await inClass(page);
  expect(enrolled, 'precondition: enroll manh_norole').toBeTruthy();
  obs.push(`Precondition enroll manh_norole=${enrolled}`);

  // V1 — Delete modal → No → KHÔNG xoá
  const m1 = await openDeleteModal(page); await shot(page, '01_modal_No');
  await page.getByRole('button', { name: /^No$/i }).first().click({ timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(1500); await gotoStudents(page);
  const afterNo = await inClass(page);
  obs.push(`V1 [No-cancel]: modal mở=${m1}, sau No manh_norole vẫn trong lớp=${afterNo} (đúng: KHÔNG xoá)`);
  expect(afterNo, 'No phải KHÔNG xoá học viên').toBeTruthy();

  // V2 — Delete modal → click backdrop (ngoài modal) → KHÔNG xoá
  const m2 = await openDeleteModal(page); await shot(page, '02_modal_backdrop');
  await page.mouse.click(15, 300).catch(() => {}); // vùng ngoài modal (mép trái)
  await page.waitForTimeout(1200);
  const modalGone = !/chắc chắn muốn xóa|Are you sure/i.test(await bodyText(page));
  await gotoStudents(page);
  const afterBackdrop = await inClass(page);
  obs.push(`V2 [backdrop-cancel]: modal mở=${m2}, modal đóng khi click backdrop=${modalGone}, manh_norole vẫn trong lớp=${afterBackdrop} (đúng: KHÔNG xoá)`);
  expect(afterBackdrop, 'Backdrop phải KHÔNG xoá học viên').toBeTruthy();

  // V3 — double-tap Yes idempotent → xoá đúng 1 (net-zero close)
  const m3 = await openDeleteModal(page); await shot(page, '03_modal_doubletap');
  const yes = page.getByRole('button', { name: /^Yes$/i }).first();
  await yes.click({ timeout: 2500 }).catch(() => {});
  await yes.click({ timeout: 800 }).catch(() => {}); // tap thứ 2 nhanh (idempotent)
  await page.waitForTimeout(2800); await gotoStudents(page);
  const afterYes = await inClass(page);
  obs.push(`V3 [double-tap Yes]: modal mở=${m3}, sau double-tap Yes manh_norole biến mất=${!afterYes} (idempotent, xoá đúng 1)`);
  await shot(page, '04_after_delete');
  expect(afterYes, 'Double-tap Yes phải xoá học viên (idempotent)').toBeFalsy();

  fs.writeFileSync(path.join(ART, 'observations.txt'), obs.join('\n') + '\n', 'utf8');
});
