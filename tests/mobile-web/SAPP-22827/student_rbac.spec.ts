import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* SAPP-22827 — SAPP_MOBSTU_TC_021 [Negative/RBAC] role hạn chế KHÔNG xoá được học viên.
 * Oracle độc lập (spec): restricted role không có action Xoá.
 *  - Baseline admin: ⋮ student CÓ "Delete".
 *  - manh_norole: /classes + deep-link students → 403 "Forbidden", 0 student, 0 ⋮ → không thể xoá.
 * Non-destructive tự nhiên (role hạn chế không mutate được). Mask PII học viên trong evidence. */
const ART = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/evidence/SAPP_MOBSTU_TC_021');
const ADMIN_STATE = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation/ops_state.json');
const NOROLE_STATE = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation/norole_state.json');
const iphone = require('@playwright/test').devices['iPhone 13'];
const DEEP = '0a286c0c-2159-4f12-afa6-8fa1559ae64c'; // lớp admin xem được (baseline)
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText || '');
async function shot(p: Page, n: string) { fs.mkdirSync(ART, { recursive: true }); await p.screenshot({ path: path.join(ART, `${n}.png`), fullPage: true }); }
// mask email/SĐT/tên học viên trong text hiển thị trước khi chụp
async function maskPII(p: Page) {
  await p.evaluate(() => {
    const walk = (el: Node) => { for (const n of Array.from(el.childNodes)) { if (n.nodeType === 3 && n.nodeValue) { n.nodeValue = n.nodeValue.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '•••@•••').replace(/(?:\+?84|0)\d{8,10}/g, '•••••••••'); } else { walk(n); } } };
    walk(document.body);
  }).catch(() => {});
}

test.skip(!haveOpsCreds, 'no creds');

test('SAPP_MOBSTU_TC_021 — RBAC: role hạn chế không xoá được học viên', async ({ browser }) => {
  test.setTimeout(150_000);
  fs.mkdirSync(ART, { recursive: true });
  const obs: string[] = [];

  // ---- Baseline admin: ⋮ student CÓ "Delete" ----
  const actx: BrowserContext = await browser.newContext({ ...iphone, storageState: ADMIN_STATE });
  const ap = await actx.newPage();
  await ap.goto(`${OPS_BASE}/classes/detail/${DEEP}/students`, { waitUntil: 'domcontentloaded' }); await ap.waitForTimeout(3500);
  const adminDots = await ap.locator('span.sapp-btn-action-cell').count();
  await ap.locator('span.sapp-btn-action-cell').last().click({ timeout: 4000 }).catch(() => {});
  await ap.waitForTimeout(900);
  const adminHasDelete = /(^|\s)Delete(\s|$)/.test(await bodyText(ap));
  await maskPII(ap); await shot(ap, '01_admin_baseline_has_Delete');
  obs.push(`Baseline admin: student ⋮ count=${adminDots}, có action "Delete"=${adminHasDelete}`);
  await actx.close();

  // ---- manh_norole: /classes + deep-link students → Forbidden ----
  const nctx: BrowserContext = await browser.newContext({ ...iphone, storageState: NOROLE_STATE });
  const np = await nctx.newPage();
  await np.goto(`${OPS_BASE}/classes`, { waitUntil: 'domcontentloaded' }); await np.waitForTimeout(3500);
  const listForbidden = /Forbidden/i.test(await bodyText(np));
  const listClassLinks = await np.locator('a[href*="/classes/detail/"]').count();
  await shot(np, '02_norole_classlist_Forbidden');
  await np.goto(`${OPS_BASE}/classes/detail/${DEEP}/students`, { waitUntil: 'domcontentloaded' }); await np.waitForTimeout(3500);
  const deepForbidden = /Forbidden/i.test(await bodyText(np));
  const deepDots = await np.locator('span.sapp-btn-action-cell').count();
  const deepHasDelete = /(^|\s)Delete(\s|$)/.test(await bodyText(np));
  await shot(np, '03_norole_students_Forbidden');
  obs.push(`manh_norole: classList Forbidden=${listForbidden} (class links=${listClassLinks}); deep-link students Forbidden=${deepForbidden}, student ⋮ count=${deepDots}, thấy Delete=${deepHasDelete}`);
  await nctx.close();

  fs.writeFileSync(path.join(ART, 'observations.txt'), obs.join('\n') + '\n', 'utf8');

  // Oracle: admin CÓ Delete (privileged) & manh_norole KHÔNG truy cập được (Forbidden, 0 ⋮, không Delete)
  expect(adminHasDelete, 'Baseline: admin phải có action Delete trên ⋮ student').toBeTruthy();
  expect(deepForbidden || deepDots === 0, 'manh_norole phải bị chặn (Forbidden) hoặc không thấy student nào').toBeTruthy();
  expect(deepHasDelete, 'manh_norole KHÔNG được thấy action Delete (RBAC)').toBeFalsy();
});
