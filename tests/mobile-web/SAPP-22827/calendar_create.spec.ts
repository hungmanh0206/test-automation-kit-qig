import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — CAL_020 Add Lesson (buổi TƯƠNG LAI, ngày trống) → verify → XOÁ (Delete) → net-zero.
 * Lớp 9faf72a4 CÓ Course Content (syllabus 15 node checkbox) — bắt buộc để Save (CGMA Class Test rỗng CC nên tắc).
 * AN TOÀN: chỉ chạm ngày đã verify TRỐNG; chỉ Delete buổi tự tạo; net-zero. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CLASS = '9faf72a4-af1f-4056-a833-b260de91e6f7'; // lớp có Course Content populated
const CAL = `${OPS_BASE}/classes/detail/${CLASS}/calendar`;
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
async function killAnim(ctx: BrowserContext) { await ctx.addInitScript(() => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;}'; (document.head || document.documentElement).appendChild(s); }); }

async function gotoAug(p: Page) {
  await p.goto(CAL, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
  const label = p.getByText(/^(January|February|March|April|May|June|July|August|September|October|November|December),\s*\d{4}$/).first();
  for (let i = 0; i < 4; i++) { if (((await label.innerText().catch(() => '')) || '').trim() === 'August, 2026') break; const b = await label.boundingBox(); if (b) await p.mouse.click(b.x + b.width + 22, b.y + b.height / 2); await p.waitForTimeout(700); }
  await p.waitForTimeout(1000);
}
// ngày DAY có buổi không (dot/event/giờ trong ô)
async function hasLessonDay(p: Page, day: string): Promise<boolean> {
  await gotoAug(p);
  return p.evaluate((d) => { const cell = Array.from(document.querySelectorAll('*')).find((e) => e.children.length === 0 && (e.textContent || '').trim() === d); if (!cell) return false; let c: any = cell; for (let i = 0; i < 3 && c.parentElement; i++) c = c.parentElement; return !!c.querySelector('[class*="dot" i],[class*="event" i],[style*="background"]') || /\d{1,2}:\d{2}/.test(c.textContent || ''); }, day).catch(() => false);
}
// mở buổi ngày DAY: tap ô ngày → click block giờ
async function openLessonOnDay(p: Page, day: string): Promise<boolean> {
  await gotoAug(p);
  await p.getByText(new RegExp(`^${day}$`)).last().click({ timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(1800);
  const block = p.locator('text=/\\d{1,2}:\\d{2}\\s*[-–]\\s*\\d{1,2}:\\d{2}/').first();
  if (await block.count().catch(() => 0)) { await block.click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(2000); }
  return /View Detail|Learning Mode|Manual Schedule|Automatic Schedule|Delete/i.test(await bodyText(p));
}
async function deleteLessonOnDay(p: Page, day: string): Promise<boolean> {
  if (!(await openLessonOnDay(p, day))) return false;
  await p.getByRole('button', { name: /^Delete$/i }).first().click({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(700);
  await p.getByRole('button', { name: /^Yes$/i }).first().click({ timeout: 2500 }).catch(() => {});
  await p.waitForTimeout(2500);
  return true;
}

const STATE = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation/ops_state.json');
let page: Page; let ctxRef: BrowserContext; let DAY = ''; let createdOk = false;
test.beforeAll(async ({ browser }) => { ctxRef = await browser.newContext({ ...iphone, storageState: STATE }); await killAnim(ctxRef); page = await ctxRef.newPage(); });
// AN TOÀN: chỉ xoá nếu ĐÃ tạo thành công trên ngày trống mình chọn
test.afterAll(async () => { if (createdOk && DAY) await deleteLessonOnDay(page, DAY).catch(() => {}); await ctxRef.close().catch(() => {}); });

test('SAPP_MOBCAL_TC_020 — Add Lesson (buổi tương lai) → verify → Delete (net-zero)', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(240_000);
  // 1) chọn ngày TRỐNG trong Aug 2026 (an toàn — không đụng buổi thật)
  for (const cand of ['22', '24', '26', '19', '17', '15']) { if (!(await hasLessonDay(page, cand))) { DAY = cand; break; } }
  expect(DAY, 'không tìm được ngày trống để test net-zero').not.toBe('');

  // 2) mở Add Lesson
  await gotoAug(page);
  await page.getByText(/Add Lesson/i).first().click({ timeout: 6000 }); await page.waitForTimeout(2500);
  await shot(page, 'SAPP_MOBCAL_TC_020', '01_form');
  // Learning Mode: mặc định Live Online — set lại cho chắc (KHÔNG Escape)
  await page.locator('input[type="search"][readonly]').first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(700);
  await page.getByText(/^(Live Online|Offline|Online LMS)$/i).first().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(500);
  // Lesson date → Aug 2026 → ngày DAY
  await page.getByPlaceholder(/Select date/i).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(800);
  for (let i = 0; i < 4; i++) { if (/Aug\s*2026/i.test(await bodyText(page))) break; await page.getByRole('button', { name: /next month/i }).first().click({ timeout: 1200 }).catch(async () => { await page.getByText('›', { exact: true }).first().click({ timeout: 1200 }).catch(() => {}); }); await page.waitForTimeout(500); }
  await page.getByText(new RegExp(`^${DAY}$`)).filter({ visible: true }).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(800);
  // Times
  await page.getByPlaceholder(/Start Time/i).first().fill('18:00').catch(() => {});
  await page.getByPlaceholder(/End Time/i).first().fill('20:00').catch(() => {}); await page.waitForTimeout(400);
  await shot(page, 'SAPP_MOBCAL_TC_020', '02_before_cc');
  // Course Content: click chevron (toạ độ) mở tree → MOUSE-CLICK checkbox node đầu (mouse.click mới đăng ký; .check() no-op)
  const ccLabel = page.getByText(/^Course Content$/i).first(); await ccLabel.scrollIntoViewIfNeeded().catch(() => {});
  const ccBox = await ccLabel.boundingBox();
  if (ccBox) await page.mouse.click(292, ccBox.y + ccBox.height / 2);
  await page.waitForTimeout(2200);
  const ccY = ccBox ? ccBox.y : 0;
  const cbXY = await page.evaluate((y) => { const cbs = Array.from(document.querySelectorAll('input[type="checkbox"].cursor-pointer')) as HTMLElement[]; const b = cbs.filter((c) => c.getBoundingClientRect().y > y)[0]; if (!b) return null; const r = b.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; }, ccY);
  let ccPicked = false;
  if (cbXY) { await page.mouse.click(cbXY.x, cbXY.y); ccPicked = true; }
  await page.waitForTimeout(800); await shot(page, 'SAPP_MOBCAL_TC_020', '02c_cc_picked');
  // đóng dropdown CC: click lại chevron (lộ field Teacher)
  if (ccBox) await page.mouse.click(292, ccBox.y + ccBox.height / 2); await page.waitForTimeout(700);
  // Teacher: + Add teacher → radio GV đầu → Add
  await page.getByText(/Add teacher/i).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1800);
  await page.locator('input[type="radio"]').first().check({ timeout: 2000, force: true }).catch(() => {});
  await page.getByRole('button', { name: /^Add$/i }).last().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(1000);
  await shot(page, 'SAPP_MOBCAL_TC_020', '03_filled');
  // Save
  await page.getByRole('button', { name: /^Save$/i }).last().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(3800);
  await shot(page, 'SAPP_MOBCAL_TC_020', '04_after_save');
  const saveErr = /required|bắt buộc|vui lòng|invalid|không hợp lệ/i.test(await bodyText(page));

  // verify: ngày DAY giờ CÓ buổi
  const created = await hasLessonDay(page, DAY); createdOk = created;
  await shot(page, 'SAPP_MOBCAL_TC_020', '05_calendar');
  fs.writeFileSync(path.join(ART, 'SAPP_MOBCAL_TC_020', 'observations.txt'), `Lớp: ${CLASS}\nNgày trống chọn: ${DAY}/08/2026\nCourse Content picked: ${ccPicked}\nSave có lỗi required: ${saveErr}\nBuổi ngày ${DAY}/08 xuất hiện sau Add: ${created}\n`, 'utf8');

  // rollback net-zero: xoá buổi vừa tạo
  if (created) { const del = await deleteLessonOnDay(page, DAY); const gone = !(await hasLessonDay(page, DAY)); createdOk = !gone ? true : false; await shot(page, 'SAPP_MOBCAL_TC_020', '06_after_delete'); fs.appendFileSync(path.join(ART, 'SAPP_MOBCAL_TC_020', 'observations.txt'), `Delete buổi: ${del} · net-zero (buổi biến mất): ${gone}\n`, 'utf8'); expect(gone, 'Xoá buổi không sạch (net-zero fail)').toBeTruthy(); }
  expect(created, 'Add Lesson không tạo được buổi (form fill fail)').toBeTruthy();
});
