import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — Xóa học viên (happy-path) NET-ZERO: enroll HV throwaway `manh_norole` → verify → Delete qua ⋮ → về trạng thái cũ.
 * Cách B (user cấp account HV): admin enroll manh_norole vào lớp test → xoá → net-zero. Mask PII trong evidence.
 * AN TOÀN: chỉ chạm đúng card manh_norole (data-attr); cleanup guard afterAll gỡ nếu còn sót. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence/SAPP_MOBSTU_delete');
const STATE = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation/ops_state.json');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CLASS = '1e8d953c-83f8-49d9-9cce-5ea3af76d2cf'; // CGMA Class Test (test class)
const STU = 'Mạnh Nguyễn Hùng'; const MATCH = 'Mạnh Nguyễn Hùng|manhnh\\+100|S000150|manh_norole';
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, n: string) { fs.mkdirSync(ART, { recursive: true }); await maskPII(p); await p.screenshot({ path: path.join(ART, `${n}.png`), fullPage: true }); }
async function maskPII(p: Page) { await p.evaluate(() => { const w = (el: Node) => { for (const n of Array.from(el.childNodes)) { if (n.nodeType === 3 && n.nodeValue) n.nodeValue = n.nodeValue.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '•••@•••').replace(/(?:\+?84|0)\d{8,10}/g, '•••••••••'); else w(n); } }; w(document.body); }).catch(() => {}); }

async function gotoStudents(p: Page) { await p.goto(`${OPS_BASE}/classes/detail/${CLASS}/students`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3200); }
const inClass = async (p: Page) => new RegExp(MATCH, 'i').test(await bodyText(p));

// tag + click ⋮ của đúng card chứa manh_norole
async function openNoroleMenu(p: Page): Promise<boolean> {
  const ok = await p.evaluate((m) => {
    const re = new RegExp(m, 'i');
    for (const s of Array.from(document.querySelectorAll('span.sapp-btn-action-cell'))) {
      let c: any = s; for (let i = 0; i < 6 && c.parentElement; i++) { c = c.parentElement; if (re.test(c.textContent || '')) { s.setAttribute('data-norole-dots', '1'); return true; } }
    }
    return false;
  }, MATCH);
  if (!ok) return false;
  await p.locator('span.sapp-btn-action-cell[data-norole-dots="1"]').click({ timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(900);
  return /Delete|Edit Course Content|Chuyển nhượng/i.test(await bodyText(p));
}
// gỡ manh_norole khỏi lớp (dùng cho cả test lẫn cleanup)
async function removeNorole(p: Page): Promise<boolean> {
  await gotoStudents(p);
  if (!(await inClass(p))) return true; // đã sạch
  if (!(await openNoroleMenu(p))) return false;
  await p.getByText(/^Delete$/i).first().click({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(700);
  await p.getByRole('button', { name: /^Yes$/i }).first().click({ timeout: 2500 }).catch(() => {});
  await p.waitForTimeout(2500);
  await gotoStudents(p);
  return !(await inClass(p));
}

let page: Page; let ctxRef: BrowserContext;
test.beforeAll(async ({ browser }) => { ctxRef = await browser.newContext({ ...iphone, storageState: STATE }); await ctxRef.addInitScript(() => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;}'; (document.head || document.documentElement).appendChild(s); }); page = await ctxRef.newPage(); });
test.afterAll(async () => { await removeNorole(page).catch(() => {}); await ctxRef.close().catch(() => {}); }); // cleanup guard

test.skip(!haveOpsCreds, 'no creds');

test('SAPP_MOBSTU delete học viên (net-zero: enroll throwaway → delete)', async () => {
  test.setTimeout(240_000);
  // 0) dọn trước nếu manh_norole đã ở lớp (từ lần trước)
  await removeNorole(page).catch(() => {});
  await gotoStudents(page);
  const in0 = await inClass(page);
  await shot(page, '01_before');

  // 1) ENROLL manh_norole: "+ Add" → Add Student → search → tick → Add
  await page.getByText(/^\+?\s*Add$/i).first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const srch = page.getByPlaceholder(/^Search$/i).first();
  await srch.fill('manh_norole').catch(() => {});
  await page.getByRole('button', { name: /^Search$/i }).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(2500);
  let hasRow = new RegExp(MATCH, 'i').test(await bodyText(page));
  if (!hasRow) { await srch.fill(STU).catch(() => {}); await page.getByRole('button', { name: /^Search$/i }).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(2500); hasRow = new RegExp(MATCH, 'i').test(await bodyText(page)); }
  await shot(page, '02_addstudent_search');
  // tick checkbox ở ĐÚNG dòng chứa manh_norole
  const tick = await page.evaluate((m) => {
    const re = new RegExp(m, 'i');
    for (const cb of Array.from(document.querySelectorAll('input[type="checkbox"]'))) {
      let c: any = cb; for (let i = 0; i < 6 && c.parentElement; i++) { c = c.parentElement; if (re.test(c.textContent || '')) { const r = cb.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; } }
    }
    return null;
  }, MATCH);
  if (tick) await page.mouse.click(tick.x, tick.y);
  await page.waitForTimeout(700); await shot(page, '03_ticked');
  // nút "Add" trên màn Add Student (top)
  await page.getByRole('button', { name: /^Add$/i }).first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // 2) verify enroll: card manh_norole xuất hiện trong lớp
  await gotoStudents(page);
  const in1 = await inClass(page);
  await shot(page, '04_after_enroll');

  // 3) DELETE manh_norole qua ⋮ → Delete → Yes
  const menuOpen = await openNoroleMenu(page);
  await shot(page, '05_menu');
  const hasDeleteAction = /^Delete$/im.test(await bodyText(page)) || /Delete/i.test(await bodyText(page));
  await page.getByText(/^Delete$/i).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
  const confirmShown = /Are you sure|chắc chắn|delete\?/i.test(await bodyText(page));
  await shot(page, '06_confirm');
  await page.getByRole('button', { name: /^Yes$/i }).first().click({ timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(2800);

  // 4) verify net-zero: card manh_norole biến mất khỏi lớp
  await gotoStudents(page);
  const in2 = await inClass(page);
  await shot(page, '07_after_delete');

  fs.writeFileSync(path.join(ART, 'observations.txt'), [
    `Lớp: CGMA Class Test (${CLASS})  HV throwaway: manh_norole (S000150)`,
    `TRƯỚC enroll: card manh_norole trong lớp = ${in0}`,
    `Sau ENROLL (admin +Add → search → tick → Add): card manh_norole trong lớp = ${in1}`,
    `Menu ⋮ đúng card manh_norole mở=${menuOpen}, có action "Delete"=${hasDeleteAction}, modal xác nhận="Bạn có chắc chắn muốn xóa không?"=${confirmShown}`,
    `Sau DELETE (⋮ → Delete → Yes): card manh_norole trong lớp = ${in2} → NET-ZERO = ${in0 === false && in2 === false}`,
  ].join('\n') + '\n', 'utf8');

  // Oracle độc lập theo-student (chính xác — chứng minh xoá ĐÚNG học viên vừa enroll, net-zero):
  expect(in0, 'Bắt đầu sạch: manh_norole KHÔNG ở lớp').toBeFalsy();
  expect(in1, 'Sau enroll manh_norole phải XUẤT HIỆN trong lớp (count +1)').toBeTruthy();
  expect(menuOpen && hasDeleteAction, '⋮ card manh_norole phải mở & có action Delete').toBeTruthy();
  expect(confirmShown, 'Delete phải hiện modal xác nhận').toBeTruthy();
  expect(in2, 'Sau delete manh_norole phải BIẾN MẤT khỏi lớp (count −1, net-zero về trạng thái đầu)').toBeFalsy();
});
