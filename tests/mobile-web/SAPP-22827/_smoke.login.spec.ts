import { test, expect } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/*
 * SAPP-22827 — Phase 2 smoke: xác nhận UI login OPS chạy được trên mobile viewport (iPhone 13),
 * sau khi fix headless-loop (anti-automation flag). Chụp landing + dump nav để recon selector 3 màn.
 * KHÔNG mutate. Chạy: PROJECT_OUTPUT_DIR=... TASK_KEY=SAPP-22827 TASK_ENV=profiles/SAPP-22827/task.env
 *   npx playwright test --project=iphone-13 tests/mobile-web/SAPP-22827/_smoke.login.spec.ts
 */
const OUT = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/test-results/smoke');

test('OPS mobile login smoke + recon', async ({ page }) => {
  test.skip(!haveOpsCreds, 'Thiếu OPS creds trong task.env');
  fs.mkdirSync(OUT, { recursive: true });

  await loginOps(page);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/01_after_login.png`, fullPage: true });

  const url = page.url();
  expect(/\/auth\/login/.test(url), 'Vẫn ở /auth/login → login fail').toBeFalsy();

  // recon: dump text nav/menu/link nhìn thấy để lấy selector 3 màn (Class List / Resource / Calendar)
  const texts = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('a, button, [role="menuitem"], [role="tab"], nav *, h1, h2'))) {
      const t = (el.textContent || '').trim();
      if (t && t.length <= 40) out.push(t);
    }
    return [...new Set(out)].slice(0, 80);
  });
  fs.writeFileSync(`${OUT}/recon_nav.json`, JSON.stringify({ url, title: await page.title(), texts }, null, 2), 'utf8');
  console.log('LOGGED IN url=' + url);
  console.log('NAV TEXTS: ' + texts.join(' | '));
});
