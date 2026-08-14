import { expect, type Page } from '@playwright/test';
import { seedSession } from './auth/seedSession';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const T = require('../../../scripts/utils/ui/safe_target');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sessionCache = require('../../../scripts/utils/auth/session_cache');

/*
 * Helper login OPS dùng chung cho suite FE thật (F6). Đọc creds từ env (OPS_* — thường ở
 * profiles/<TASK>/task.env, nạp qua TASK_ENV; .env chung để rỗng). KHÔNG hardcode credential.
 */

export const OPS_BASE = (process.env.OPS_BASE_URL || '').replace(/\/$/, '');
export const OPS_USER = process.env.OPS_USERNAME || '';
export const OPS_PASS = process.env.OPS_PASSWORD || '';
// Coi placeholder chưa điền (`<OPS_USERNAME>`) là CHƯA có creds → skip, tránh submit rác gây lockout oan.
const isReal = (v: string): boolean => Boolean(v) && !/^<.*>$/.test(v.trim());
export const haveOpsCreds = Boolean(OPS_BASE && isReal(OPS_USER) && isReal(OPS_PASS));

/** "9.500.000" / "9,500,000" / "9500000" → 9500000 (null nếu không có số). */
export function toNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

/** Login form OPS thuần — KHÔNG cache. Dùng khi cố ý muốn đi qua form (vd test chính luồng login). */
export async function loginOpsForm(page: Page): Promise<void> {
  await page.goto(`${OPS_BASE}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.fill('input[name=username]', OPS_USER);
  await page.fill('input[name=password]', OPS_PASS);
  await (await T.one(page.getByRole('button', { name: /sign in|đăng nhập/i }), { what: 'nút đăng nhập OPS' })).click({ timeout: 6000 })
    .catch(() => page.keyboard.press('Enter'));
  await page.waitForTimeout(4500);
  expect(/\/auth\/login/.test(page.url()), 'OPS login thất bại (còn ở /auth/login)').toBeFalsy();
}

/**
 * loginOps — điểm vào DUY NHẤT của 32 spec. Nay TÁI DÙNG session thay vì login lại mỗi lần.
 *
 * VÌ SAO đặt cache Ở ĐÂY thay vì bắt 32 spec đổi sang `ensureOpsAuth`: đo 14/08/2026 thì **1 spec** dùng
 * `ensureOpsAuth` còn **32 file gọi thẳng `loginOps`** ⇒ cơ chế reuse có mà gần như không ai đi qua. Sửa ở
 * điểm vào thì không ai bypass được bằng cách quên — cùng nguyên tắc "forcing function" của kit. Chữ ký giữ
 * nguyên nên KHÔNG spec nào phải sửa.
 *
 * Hành vi:
 *   1. Cache còn tươi (< TTL, mặc định 25' < token TTL 30') → SEED cookies + localStorage rồi mở base. Nếu vẫn
 *      bị đẩy về /auth/login (session hỏng/đã bị thu hồi) → xoá cache, rơi xuống bước 2.
 *   2. Lấy LOCK rồi login form 1 lần và lưu cache. Worker khác chờ lock xong sẽ thấy cache tươi và dùng lại
 *      ⇒ khởi động lạnh N worker chỉ còn 1 lần login (trước đây N lần → throttle/lockout).
 *
 * Kill-switch: `AUTH_REUSE=0` ⇒ hành vi y như trước khi có thay đổi này (login form thẳng).
 * ⚠️ Nhánh SEED cần UAT smoke để nghiệm thu (cần browser + creds thật). Phần thuần logic (quyết định + lock)
 *    đã test offline ở `tests/fe/infra/auth-session-lock.spec.ts`.
 */
export async function loginOps(page: Page): Promise<void> {
  if (process.env.AUTH_REUSE === '0') { await loginOpsForm(page); return; }

  const key = OPS_USER || 'ops';
  const ttl = Number(process.env.AUTH_TTL_MINUTES || 25);
  const context = page.context();

  // Dùng CHUNG `seedSession` với `ensureOpsAuth` — một bản duy nhất, nên UAT smoke nghiệm thu được cả hai
  // đường. (Bản đầu tôi copy logic seed vào đây: hai bản sao sẽ phân kỳ và smoke chỉ phủ một bản.)
  const seed = async (): Promise<boolean> => {
    const rec = sessionCache.load(key);
    return seedSession(page, context, rec && rec.storageState, OPS_BASE);
  };

  if (sessionCache.isFresh(key, ttl) && await seed()) return;
  sessionCache.clear(key);

  await sessionCache.withLock(key, async () => {
    // Worker khác có thể vừa login xong trong lúc mình chờ lock ⇒ kiểm lại trước khi tốn một lần login nữa.
    if (sessionCache.isFresh(key, ttl) && await seed()) return;
    await loginOpsForm(page);
    try { sessionCache.save(key, await context.storageState()); } catch (e) { /* cache best-effort, không làm fail test */ }
  });
}
