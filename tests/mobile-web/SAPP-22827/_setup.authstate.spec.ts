import { test, expect } from '@playwright/test';
import { loginOps, OPS_BASE, haveOpsCreds } from '../../fe/support/opsLogin';
import * as fs from 'fs';
import * as path from 'path';

/* Login 1 LẦN → lưu storageState (cookies + localStorage auth) để mọi spec tái dùng, né login throttle. */
const STATE = path.resolve('outputs/lms-operations-automation/tasks/SAPP-22827/automation/ops_state.json');
const iphone = require('@playwright/test').devices['iPhone 13'];

test('save OPS auth storageState', async ({ browser }) => {
  test.skip(!haveOpsCreds, 'no creds'); test.setTimeout(90_000);
  const ctx = await browser.newContext({ ...iphone });
  const page = await ctx.newPage();
  await loginOps(page);
  await page.waitForTimeout(1500);
  expect(/\/auth\/login/.test(page.url()), 'login vẫn ở /auth/login').toBeFalsy();
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  await ctx.storageState({ path: STATE });
  console.log('✅ đã lưu storageState: ' + STATE + ' (url=' + page.url() + ')');
  await ctx.close();
});
