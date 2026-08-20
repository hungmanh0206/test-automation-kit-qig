import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — 2 case cuối nhóm Xóa HV: TC_012 xoá HV cuối→empty (net-zero lớp 0-HV), TC_014 Slow-3G Yes loading/disabled. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const STATE = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation/ops_state.json');
const iphone = require('@playwright/test').devices['iPhone 13'];
const EMPTY_CLASS = 'b08bcc1c-88af-41c1-9121-90723f45a130'; // lớp 0-HV (đã scan) — enroll 1 rồi xoá = net-zero
const CGMA = '1e8d953c-83f8-49d9-9cce-5ea3af76d2cf';
const STU = 'Mạnh Nguyễn Hùng'; const MATCH = 'Mạnh Nguyễn Hùng|manhnh\\+100|S000150|manh_norole';
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function maskPII(p: Page) { await p.evaluate(() => { const w = (el: Node) => { for (const n of Array.from(el.childNodes)) { if (n.nodeType === 3 && n.nodeValue) n.nodeValue = n.nodeValue.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '•••@•••').replace(/(?:\+?84|0)\d{8,10}/g, '•••••••••'); else w(n); } }; w(document.body); }).catch(() => {}); }
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await maskPII(p); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
async function gotoStudents(p: Page, id: string) { for (let i = 0; i < 4; i++) { await p.goto(`${OPS_BASE}/classes/detail/${id}/students`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3200); const t = await bodyText(p); if (!/Network error|Forbidden/i.test(t)) return; await p.waitForTimeout(2500 + i * 1500); } }
const inClass = async (p: Page) => new RegExp(MATCH, 'i').test(await bodyText(p));
const dots = (p: Page) => p.locator('span.sapp-btn-action-cell').count();
async function openDeleteModal(p: Page): Promise<boolean> {
  const ok = await p.evaluate((m) => { const re = new RegExp(m, 'i'); for (const s of Array.from(document.querySelectorAll('span.sapp-btn-action-cell'))) { let c: any = s; for (let i = 0; i < 6 && c.parentElement; i++) { c = c.parentElement; if (re.test(c.textContent || '')) { s.setAttribute('data-x', '1'); return true; } } } return false; }, MATCH);
  if (!ok) return false;
  await p.locator('span.sapp-btn-action-cell[data-x="1"]').click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(900);
  await p.getByText(/^Delete$/i).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(900);
  return /chắc chắn muốn xóa|Are you sure/i.test(await bodyText(p));
}
async function enroll(p: Page, id: string) {
  await gotoStudents(p, id);
  await p.getByText(/^\+?\s*Add$/i).first().click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(2500);
  await p.getByPlaceholder(/^Search$/i).first().fill(STU).catch(() => {});
  await p.getByRole('button', { name: /^Search$/i }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(2500);
  const tick = await p.evaluate((m) => { const re = new RegExp(m, 'i'); for (const cb of Array.from(document.querySelectorAll('input[type="checkbox"]'))) { let c: any = cb; for (let i = 0; i < 6 && c.parentElement; i++) { c = c.parentElement; if (re.test(c.textContent || '')) { const r = cb.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; } } } return null; }, MATCH);
  if (tick) await p.mouse.click(tick.x, tick.y); await p.waitForTimeout(600);
  await p.getByRole('button', { name: /^Add$/i }).first().click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(3000);
  await gotoStudents(p, id);
}
async function removeFrom(p: Page, id: string): Promise<boolean> { await gotoStudents(p, id); if (!(await inClass(p))) return true; if (!(await openDeleteModal(p))) return false; await p.getByRole('button', { name: /^Yes$/i }).first().click({ timeout: 2500 }).catch(() => {}); await p.waitForTimeout(2500); await gotoStudents(p, id); return !(await inClass(p)); }

let page: Page; let ctxRef: BrowserContext;
test.beforeAll(async ({ browser }) => { ctxRef = await browser.newContext({ ...iphone, storageState: STATE }); await ctxRef.addInitScript(() => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;}'; (document.head || document.documentElement).appendChild(s); }); page = await ctxRef.newPage(); });
test.afterAll(async () => { await removeFrom(page, EMPTY_CLASS).catch(() => {}); await removeFrom(page, CGMA).catch(() => {}); await ctxRef.close().catch(() => {}); });
test.skip(!haveOpsCreds, 'no creds');

test('SAPP_MOBSTU_TC_012 — xoá học viên cuối cùng → empty-state (net-zero lớp 0-HV)', async () => {
  test.setTimeout(180_000);
  await removeFrom(page, EMPTY_CLASS).catch(() => {});
  await gotoStudents(page, EMPTY_CLASS);
  const before = await dots(page); // kỳ vọng 0
  await enroll(page, EMPTY_CLASS);   // 0 → 1 (HV throwaway duy nhất)
  const afterEnroll = await dots(page);
  const one = await inClass(page);
  await shot(page, 'SAPP_MOBSTU_TC_012', '01_one_student');
  // xoá HV cuối
  const m = await openDeleteModal(page); await shot(page, 'SAPP_MOBSTU_TC_012', '02_modal');
  await page.getByRole('button', { name: /^Yes$/i }).first().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(2800);
  await gotoStudents(page, EMPTY_CLASS);
  const afterDelete = await dots(page); // về 0 → empty
  await shot(page, 'SAPP_MOBSTU_TC_012', '03_empty_state');
  fs.writeFileSync(path.join(ART, 'SAPP_MOBSTU_TC_012', 'observations.txt'), `Lớp 0-HV ${EMPTY_CLASS}\nTrước=${before} card, sau enroll=${afterEnroll} (1 HV cuối), modal mở=${m}, sau xoá HV cuối=${afterDelete} card → empty-state=${afterDelete === 0}\nNet-zero (về ${before})=${afterDelete === before}\n`, 'utf8');
  expect(before, 'lớp bắt đầu 0 HV').toBe(0);
  expect(afterEnroll, 'sau enroll có đúng 1 HV').toBe(1);
  expect(m, 'modal xoá mở').toBeTruthy();
  expect(afterDelete, 'xoá HV cuối → empty-state (0 card)').toBe(0);
});

test('SAPP_MOBSTU_TC_014 — Slow-3G khi Yes: nút Yes loading/disabled chống double-submit', async () => {
  test.setTimeout(180_000);
  await removeFrom(page, CGMA).catch(() => {});
  await enroll(page, CGMA);
  expect(await inClass(page), 'precondition enroll').toBeTruthy();
  const m = await openDeleteModal(page); await shot(page, 'SAPP_MOBSTU_TC_014', '01_modal');
  // route-delay ~4s cho request mutation (xác nhận throttle CÓ bắt được request delete)
  let mutationDelayed = 0;
  await page.route('**', async (route) => { const rt = route.request().resourceType(); const method = route.request().method(); if ((rt === 'xhr' || rt === 'fetch') && /DELETE|POST|PUT|PATCH/i.test(method)) { mutationDelayed++; await new Promise((r) => setTimeout(r, 4000)); } await route.continue().catch(() => {}); });
  await page.getByRole('button', { name: /^Yes$/i }).first().click({ timeout: 2500 }).catch(() => {});
  // POLL trạng thái nút Yes liên tục ~2.5s để bắt cửa sổ disabled/loading (dù ngắn)
  let sawDisabled = false; let sawSpinner = false; let modalStayed = false;
  for (let i = 0; i < 16; i++) {
    const st = await page.evaluate(() => {
      const y = Array.from(document.querySelectorAll('button')).find((b) => /^Yes$/.test((b.textContent || '').trim()));
      const modal = /chắc chắn muốn xóa|Are you sure/i.test(document.body.innerText || '');
      if (!y) return { present: false, modal };
      return { present: true, modal, disabled: (y as HTMLButtonElement).disabled || y.getAttribute('aria-disabled') === 'true' || /disabled|loading/i.test(y.className), spinner: y.querySelectorAll('[class*="spin" i],[class*="load" i],svg').length > 0 };
    });
    if (st.modal) modalStayed = true;
    if ((st as any).disabled) sawDisabled = true;
    if ((st as any).spinner) sawSpinner = true;
    if (i === 2) await shot(page, 'SAPP_MOBSTU_TC_014', '02_yes_processing');
    await page.waitForTimeout(160);
  }
  await page.waitForTimeout(3500); await page.unroute('**').catch(() => {});
  await gotoStudents(page, CGMA);
  const deleted = !(await inClass(page));
  await shot(page, 'SAPP_MOBSTU_TC_014', '03_after');
  const antiDouble = sawDisabled || sawSpinner;
  fs.writeFileSync(path.join(ART, 'SAPP_MOBSTU_TC_014', 'observations.txt'), [
    `modal mở=${m}, request mutation bị throttle bắt được=${mutationDelayed} (>0 = Slow-3G thực sự áp lên delete)`,
    `Poll trong lúc xử lý: nút Yes từng disabled=${sawDisabled}, từng có spinner=${sawSpinner}, modal giữ trong lúc chờ=${modalStayed}`,
    `Kết: chống double-submit visual (disabled/loading)=${antiDouble}; delete hoàn tất=${deleted}`,
    antiDouble ? '' : '⚠️ Nếu throttle CÓ bắt request (>0) mà nút Yes KHÔNG bao giờ disabled/loading → FINDING: thiếu trạng thái loading/disable nút Yes (chống double-submit visual). Backend idempotent đã verify ở TC_011.',
  ].join('\n') + '\n', 'utf8');
  expect(m, 'modal mở').toBeTruthy();
  expect(mutationDelayed, 'throttle phải bắt được request mutation (để có cửa sổ quan sát)').toBeGreaterThan(0);
  expect(deleted, 'delete phải hoàn tất sau khi mạng xong').toBeTruthy();
  // Verdict trạng thái nút: nếu có disabled/spinner → PASS; nếu không → ghi FINDING (không fake pass)
  expect(antiDouble, 'nút Yes nên disabled/loading trong lúc xử lý — nếu fail là FINDING thiếu visual anti-double-submit (backend idempotent OK ở TC_011)').toBeTruthy();
});
