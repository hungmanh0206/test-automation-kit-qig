import { test, expect, type Page } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — MOBRES_008 verify sâu: server có chấp nhận .exe (ngoài File supported) không?
 * Upload .exe → Save → kiểm list. Nếu xuất hiện = FINDING bảo mật → xoá ngay (rollback). */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence/SAPP_MOBRES_TC_008');
const AUTO = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation');
const iphone = require('@playwright/test').devices['iPhone 13'];
const PFX = 'SAPP22827_BAD';
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');

test('SAPP_MOBRES_TC_008 verify — server nhận .exe? (rollback nếu có)', async ({ browser }) => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(120_000);
  const ctx = await browser.newContext({ ...iphone }); const page = await ctx.newPage(); await loginOps(page);
  fs.mkdirSync(ART, { recursive: true });
  let accepted = false;
  const goRes = async () => {
    await page.goto(`${OPS_BASE}/classes?page_index=1&page_size=10`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
    const href = await page.locator('a[href*="/classes/detail"]').first().getAttribute('href');
    await page.goto(`${OPS_BASE}${(href || '').replace(/\/overview.*$/, '')}/overview`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1600);
    await page.getByText(/^Resources$/).last().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2500);
  };
  try {
    await goRes();
    await page.getByText(/^Upload$/).first().click({ timeout: 6000 }); await page.waitForTimeout(900);
    await page.getByText(/^File$/).last().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1800);
    await page.locator('input[type="file"]').first().setInputFiles(path.join(AUTO, 'SAPP22827_BAD.exe'), { timeout: 8000 }); await page.waitForTimeout(1200);
    await page.getByRole('button', { name: /^Save$/ }).click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(4000);
    const afterSave = await bodyText(page);
    await page.screenshot({ path: path.join(ART, 'verify_01_after_save.png'), fullPage: true });
    await goRes();
    const inList = (await bodyText(page)).includes(PFX);
    accepted = inList;
    await page.screenshot({ path: path.join(ART, 'verify_02_list.png'), fullPage: true });
    const serverErr = /không hợp lệ|invalid|not support|sai định dạng|error|failed|allowed/i.test(afterSave);
    fs.writeFileSync(path.join(ART, 'observations.txt'),
      `.exe thêm vào form: true (không chặn client-side)\nSau Save có lỗi/thông báo: ${serverErr}\n.exe XUẤT HIỆN trong list (server CHẤP NHẬN): ${inList}\n=> ${inList ? 'FINDING BẢO MẬT: OPS nhận file .exe ngoài danh sách hỗ trợ' : 'OK: server chặn .exe (form-accept chỉ là thiếu validate client-side — minor)'}\n`, 'utf8');
    console.log(inList ? '⚠ FINDING: .exe ĐƯỢC CHẤP NHẬN' : '✓ .exe bị server chặn');
  } finally {
    if (accepted) {
      // rollback: xoá .exe
      await goRes();
      await page.evaluate((pfx) => { const leaf = Array.from(document.querySelectorAll('*')).find((e) => e.children.length === 0 && (e.textContent || '').includes(pfx)); if (!leaf) return; let c: any = leaf; for (let i = 0; i < 6 && c.parentElement; i++) c = c.parentElement; const nr = leaf.getBoundingClientRect(); const bs = Array.from(c.querySelectorAll('button')) as any[]; let best = null, bx = -1; for (const b of bs) { const r = b.getBoundingClientRect(); if (Math.abs(r.top - nr.top) < 70 && r.left > nr.left + nr.width - 20 && r.width < 60 && r.left > bx) { bx = r.left; best = b; } } if (best) best.click(); }, PFX);
      await page.waitForTimeout(900);
      await page.getByText(/^(Delete|Xoá|Xóa)$/i).last().click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(700);
      await page.getByRole('button', { name: /^Yes$/i }).click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(2500); await page.reload().catch(() => {}); await page.waitForTimeout(2000);
      const gone = !(await bodyText(page)).includes(PFX);
      console.log(gone ? '✓ rollback: .exe đã xoá' : '⚠ ORPHAN .exe còn lại!');
      if (!gone) fs.writeFileSync(path.join(path.dirname(ART), 'ORPHAN_WARNING.txt'), 'orphan .exe\n', 'utf8');
    }
    await ctx.close();
  }
});
