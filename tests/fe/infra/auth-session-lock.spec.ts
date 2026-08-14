import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sessionCache = require('../../../scripts/utils/auth/session_cache');

/*
 * Kiểm phần THUẦN LOGIC của auth-reuse: quyết định tươi/hết hạn + lock chống N worker login đồng thời.
 * KHÔNG chạm UAT, KHÔNG cần creds, KHÔNG mở browser thật — chạy được ở CI và trên máy chưa có profile.
 *
 * Vì sao cần: nhánh SEED của `loginOps` chỉ nghiệm thu được bằng UAT smoke (cần browser + creds), nhưng phần
 * quyết định và lock thì kiểm được offline — và chính lock là thứ chữa lỗi "khởi động lạnh N worker = N lần
 * login" (throttle/lockout UAT). Không có test này thì lock là code không ai chứng minh chạy đúng.
 */

const KEY = `__infra_test_${process.pid}`;
const lockDir = `${sessionCache.sessionPath(KEY)}.lock`;

test.afterEach(() => {
  sessionCache.clear(KEY);
  try { fs.rmdirSync(lockDir); } catch (e) { /* không có lock thì thôi */ }
});

test('session cache: chưa lưu thì KHÔNG tươi; lưu rồi thì tươi; TTL=0 thì hết hạn ngay', () => {
  expect(sessionCache.isFresh(KEY, 25)).toBeFalsy();

  sessionCache.save(KEY, { cookies: [{ name: 'a', value: '1' }], origins: [] });
  expect(sessionCache.isFresh(KEY, 25)).toBeTruthy();
  expect(sessionCache.ageMinutes(KEY)).toBe(0);

  // TTL 0 phút ⇒ mọi session đều coi như hết hạn (dùng để ép login lại)
  expect(sessionCache.isFresh(KEY, 0)).toBeFalsy();

  const rec = sessionCache.load(KEY);
  expect(rec.storageState.cookies[0].name).toBe('a');

  expect(sessionCache.clear(KEY)).toBeTruthy();
  expect(sessionCache.load(KEY)).toBeNull();
});

test('withLock: 5 lượt đồng thời chỉ 1 lượt vào vùng găng cùng lúc, và chỉ 1 lần "login"', async () => {
  let inside = 0; let maxInside = 0; let logins = 0;

  const worker = async () => sessionCache.withLock(KEY, async () => {
    inside += 1; maxInside = Math.max(maxInside, inside);
    // Mô phỏng đúng thân hàm thật: đã tươi thì KHÔNG login lại.
    if (!sessionCache.isFresh(KEY, 25)) {
      await new Promise((r) => setTimeout(r, 40));           // "login form" tốn thời gian
      logins += 1;
      sessionCache.save(KEY, { cookies: [], origins: [] });
    }
    inside -= 1;
  }, { timeoutMs: 10000 });

  await Promise.all([worker(), worker(), worker(), worker(), worker()]);

  expect(maxInside, 'lock phải tuần tự hoá vùng găng').toBe(1);
  expect(logins, '5 worker khởi động lạnh chỉ được login MỘT lần').toBe(1);
});

test('withLock: lock RÁC (tiến trình chết) bị thu hồi thay vì treo mãi', async () => {
  fs.mkdirSync(path.dirname(lockDir), { recursive: true });
  fs.mkdirSync(lockDir);                                     // lock mồ côi, không ai nhả
  const old = new Date(Date.now() - 5 * 60 * 1000);
  fs.utimesSync(lockDir, old, old);                          // giả lập lock 5 phút tuổi

  let ran = false;
  await sessionCache.withLock(KEY, async () => { ran = true; }, { staleMs: 60000, timeoutMs: 3000 });
  expect(ran, 'lock quá staleMs phải bị thu hồi để không treo mọi lần chạy sau').toBeTruthy();
});

test('withLock: hết timeout thì VẪN chạy fn (thà login trùng còn hơn fail cả suite)', async () => {
  fs.mkdirSync(path.dirname(lockDir), { recursive: true });
  fs.mkdirSync(lockDir);                                     // lock còn TƯƠI nên không bị thu hồi

  let ran = false;
  const t0 = Date.now();
  const res = await sessionCache.withLock(KEY, async (info: { gotLock: boolean }) => {
    ran = true; return info.gotLock;
  }, { timeoutMs: 600, pollMs: 100, staleMs: 600000 });

  expect(ran).toBeTruthy();
  expect(res, 'phải báo rõ là chạy KHÔNG có lock').toBeFalsy();
  expect(Date.now() - t0).toBeGreaterThanOrEqual(500);
});
