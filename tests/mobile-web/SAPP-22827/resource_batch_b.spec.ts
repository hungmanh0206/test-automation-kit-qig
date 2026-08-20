import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence');
const AUTO = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation');
const iphone = require('@playwright/test').devices['iPhone 13'];
const CFA = `${OPS_BASE}/classes/detail/9faf72a4-af1f-4056-a833-b260de91e6f7`;
const ZOOM = `${OPS_BASE}/classes/detail/479bf5f4-8f78-4f7a-a460-ee482bab68d4`;
const PFX = 'SAPP22827';
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, tc: string, n: string) { const d = path.join(ART, tc); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, `${n}.png`), fullPage: true }); }
async function killAnim(ctx: BrowserContext) { await ctx.addInitScript(() => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;}'; (document.head || document.documentElement).appendChild(s); }); }
async function cancel(p: Page) { await p.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 2500 }).catch(() => p.keyboard.press('Escape').catch(() => {})); await p.waitForTimeout(1000); }

let page: Page;
async function goResCFA() { await page.goto(`${CFA}/overview`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1400); await page.getByText(/^Resources$/).last().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2300); }
async function goResZoom() { await page.goto(`${ZOOM}/overview`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1400); await page.getByText(/^Resources$/).last().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2300); }
async function openMenu(): Promise<boolean> { for (let i = 0; i < 3; i++) { await page.locator('span.sapp-btn-action-cell').last().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(500); if (/Rename|Move To Folder|Download File/i.test(await bodyText(page))) return true; } return false; }
async function presentCFA() { await goResCFA(); return (await bodyText(page)).includes(PFX); }
async function sweepCFA() { for (let k = 0; k < 5; k++) { if (!(await presentCFA())) return; if (!(await openMenu())) return; await page.getByText(/^(Delete|Xoá|Xóa)$/i).last().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(500); await page.getByRole('button', { name: /^Yes$/i }).click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(1800); } }
async function uploadThrow() { await goResCFA(); if ((await bodyText(page)).includes(PFX)) return; await page.getByText(/^Upload$/).first().click({ timeout: 6000 }); await page.waitForTimeout(800); await page.getByText(/^File$/).last().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1500); await page.locator('input[type="file"]').first().setInputFiles(path.join(AUTO, 'SAPP22827_AUTO_DELETE_ME.txt')).catch(() => {}); await page.waitForTimeout(900); await page.getByRole('button', { name: /^Save$/ }).click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(3000); }

test.beforeAll(async ({ browser }) => { const ctx = await browser.newContext({ ...iphone }); await killAnim(ctx); page = await ctx.newPage(); await loginOps(page); await sweepCFA(); await uploadThrow(); expect(await presentCFA(), 'setup fail').toBeTruthy(); });
test.afterAll(async () => { await sweepCFA().catch(() => {}); if (await presentCFA().catch(() => true)) { fs.writeFileSync(path.join(ART, 'ORPHAN_WARNING.txt'), 'batchB\n', 'utf8'); } });

test('SAPP_MOBRES_TC_023 — Edit: đổi Permission Student/Teacher và Save', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goResCFA(); expect(await openMenu(), 'menu không mở').toBeTruthy();
  await page.getByText(/^Edit$/i).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1200); await shot(page, 'SAPP_MOBRES_TC_023', '01_edit');
  const et = await bodyText(page); const isModal = /Student/i.test(et) && /Teacher/i.test(et);
  // toggle 1 checkbox permission (Teacher) rồi Save
  const cb = page.locator('input[type="checkbox"], [role="checkbox"], .sapp-checkbox, [class*="checkbox" i]').filter({ hasText: /Teacher/i }).first();
  await page.getByText(/^Teacher$/i).first().click({ timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^Save$/i }).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(2000); await shot(page, 'SAPP_MOBRES_TC_023', '02_saved');
  const stillThere = await presentCFA();
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_023', 'observations.txt'), `modal Edit mở: ${isModal} · Save xong item còn: ${stillThere}\n`, 'utf8');
  expect(isModal && stillThere, 'Edit permission Save lỗi').toBeTruthy();
});

test('SAPP_MOBRES_TC_022 — Edit: Attach to the lesson (recon dropdown)', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goResCFA(); expect(await openMenu(), 'menu không mở').toBeTruthy();
  await page.getByText(/^Edit$/i).last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1200); await shot(page, 'SAPP_MOBRES_TC_022', '01');
  const et = await bodyText(page);
  const hasAttach = /Attach to the lesson|Attach To The Lesson|buổi|lesson/i.test(et);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_022', 'observations.txt'), `Edit modal có "Attach to the lesson": ${hasAttach}\n(CFA không có buổi → dropdown có thể rỗng)\nsnippet: ${et.slice(0, 300).replace(/\n/g, ' | ')}\n`, 'utf8');
  await cancel(page);
  expect(hasAttach, 'Edit modal không có mục Attach to the lesson').toBeTruthy();
});

test('SAPP_MOBRES_TC_004 — Card tài liệu: Size có giá trị đúng đơn vị (zoom-02)', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goResZoom();
  // đọc value size trực tiếp từ DOM (không chỉ innerText body)
  const sizes = await page.evaluate(() => { const out: string[] = []; document.querySelectorAll('*').forEach((e) => { if (e.children.length === 0) { const t = (e.textContent || '').trim(); if (/^\d+(\.\d+)?\s*(KB|MB|GB|Byte)/i.test(t)) out.push(t); } }); return [...new Set(out)].slice(0, 8); });
  await shot(page, 'SAPP_MOBRES_TC_004', '02');
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_004', 'observations.txt'), `size values thấy: ${sizes.join(' | ') || '(không thấy)'}\n`, 'utf8');
  expect(sizes.length > 0, 'Không thấy giá trị Size đúng đơn vị KB/MB/Bytes').toBeTruthy();
});

test('SAPP_MOBRES_TC_016/017 — Upload từ kho (tab Resource trong Upload)', async () => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  await goResZoom();
  await page.getByText(/^Upload$/).first().click({ timeout: 6000 }); await page.waitForTimeout(900);
  await page.getByText(/^File$/).last().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1800);
  // chuyển tab "Resource" (kho) trong màn Upload
  await page.getByText(/^Resource$/i).last().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(2000); await shot(page, 'SAPP_MOBRES_TC_016', '01_kho');
  const t = await bodyText(page);
  const hasKho = /Select all|Filter|Created at|Size/i.test(t);
  fs.writeFileSync(path.join(ART, 'SAPP_MOBRES_TC_016', 'observations.txt'), `tab Resource (kho) có Select all/Filter/item: ${hasKho}\nsnippet: ${t.slice(0, 300).replace(/\n/g, ' | ')}\n`, 'utf8');
  await cancel(page);
  expect(hasKho, 'Tab kho không có danh sách chọn').toBeTruthy();
});
