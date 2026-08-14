'use strict';

/*
 * session_cache.js (P1 Auth Strategy — reuse session né throttle/lockout).
 * Lưu Playwright storageState (cookies + origins[].localStorage gồm actToken/refreshToken) vào
 * .auth/<key>.json kèm savedAt → lần sau nếu còn TƯƠI (< TTL, mặc định 25' < token TTL 30') thì SEED lại,
 * KHÔNG login UI lặp (tránh lockout/throttle UAT — xem uat-auth-phase2-constraints).
 *
 * ⚠️ .auth/ = SECRET (token/cookie) → gitignore, không commit. Dependency-free (chỉ fs/path + REPO_ROOT).
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'runtime_config'));

const AUTH_DIR = path.join(rc.REPO_ROOT, '.auth');
const safeKey = (k) => String(k || 'default').replace(/[^\w.-]+/g, '_');
function sessionPath(key) { return path.join(AUTH_DIR, `${safeKey(key)}.json`); }

/** Lưu storageState (Playwright) → .auth/<key>.json (atomic tương đối). Trả path. */
function save(key, storageState) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const file = sessionPath(key);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ savedAt: Date.now(), storageState: storageState || { cookies: [], origins: [] } }, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  return file;
}

/** Đọc record {savedAt, storageState} hoặc null. */
function load(key) {
  try { return JSON.parse(fs.readFileSync(sessionPath(key), 'utf8')); } catch (e) { return null; }
}

/** Session còn tươi (< ttlMinutes)? */
function isFresh(key, ttlMinutes = 25) {
  const r = load(key);
  if (!r || !r.savedAt) return false;
  return (Date.now() - Number(r.savedAt)) < ttlMinutes * 60 * 1000;
}

/** Tuổi session (phút) hoặc null. */
function ageMinutes(key) {
  const r = load(key);
  if (!r || !r.savedAt) return null;
  return Math.round((Date.now() - Number(r.savedAt)) / 60000);
}

/** Xoá session (khi login fail / muốn ép login lại). */
function clear(key) { try { fs.unlinkSync(sessionPath(key)); return true; } catch (e) { return false; } }

/**
 * withLock — CHỈ MỘT tiến trình được login cho `key` tại một thời điểm; các tiến trình khác CHỜ rồi dùng lại
 * session vừa được lưu.
 *
 * VÌ SAO CẦN: cache reuse chỉ né được throttle khi cache đã ẤM. Khởi động LẠNH với N worker Playwright thì cả
 * N cùng thấy "cache không tươi" và cùng login → đúng cái lockout/throttle mà cache sinh ra để tránh
 * (uat-auth-phase2-constraints: token TTL 30', ~5 login/browser là bị chặn). Lock biến N login thành 1.
 *
 * Cơ chế: `mkdir` là atomic trên cả Windows lẫn POSIX ⇒ dùng thư mục làm lock, không cần thư viện. Lock CŨ hơn
 * `staleMs` bị coi là rác (tiến trình chết giữa đường) và được thu hồi — nếu không thì một lần crash sẽ treo
 * mọi lần chạy sau. Hết `timeoutMs` thì KHÔNG ném lỗi: chạy `fn` luôn. Chọn vậy vì thà login trùng (mất thêm
 * 1 lần) còn hơn làm cả suite fail vì không lấy được lock.
 */
async function withLock(key, fn, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 60000;
  const staleMs = opts.staleMs ?? 120000;
  const pollMs = opts.pollMs ?? 250;
  const dir = `${sessionPath(key)}.lock`;
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const t0 = Date.now();
  let held = false;
  for (;;) {
    try { fs.mkdirSync(dir); held = true; break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let age = 0;
      try { age = Date.now() - fs.statSync(dir).mtimeMs; } catch (e2) { continue; }   // lock vừa được nhả
      if (age > staleMs) { try { fs.rmdirSync(dir); } catch (e3) { /* kẻ khác thu hồi trước */ } continue; }
      if (Date.now() - t0 > timeoutMs) break;                                          // hết chờ → chạy không lock
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }
  try { return await fn({ gotLock: held, waitedMs: Date.now() - t0 }); }
  finally { if (held) { try { fs.rmdirSync(dir); } catch (e) { /* đã bị thu hồi */ } } }
}

module.exports = { AUTH_DIR, sessionPath, save, load, isFresh, ageMinutes, clear, withLock };
