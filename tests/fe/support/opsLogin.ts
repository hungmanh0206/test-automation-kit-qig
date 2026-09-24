import { expect, type Page } from '@playwright/test';
import fs from 'fs';
import { seedSession } from './auth/seedSession';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sessionCache = require('../../../scripts/utils/auth/session_cache');

/*
 * Helper login QEMIS (CSDL ngành Giáo dục) dùng chung cho suite FE thật.
 *
 * VIẾT LẠI 24/09/2026. Bản trước viết cho một SPA khác: nó tự ghép `${OPS_BASE}/auth/login` và dùng
 * `input[name=username]`. Đo trên QEMIS thật: hai selector đó khớp **0 phần tử** — QEMIS là ASP.NET
 * WebForms ở `/Login.aspx`, tên control là `ctl00$ContentPlaceHolder1$ctl00$tbU`. Bản cũ còn BỎ QUA
 * `OPS_LOGIN_URL` nên dù khai đúng URL vẫn đi sai chỗ.
 *
 * BA ĐIỀU KHÁC HẲN MỘT MÀN LOGIN THƯỜNG — đọc trước khi sửa:
 *
 *  1. **Phải chọn ĐƠN VỊ trước khi đăng nhập.** Màn login có 3 combobox cascade bắt buộc:
 *     Sở → Phường/Xã → Trường. Thiếu thì app hiện "Thông tin bắt buộc" và KHÔNG báo gì ở tầng text —
 *     đo 24/09/2026: điền đúng user/pass/captcha mà vẫn đứng ở Login.aspx chỉ vì chưa chọn Sở + Trường.
 *
 *  2. **Đơn vị là TIỀN ĐIỀU KIỆN CỦA TASK, không phải hằng số của kit.** Mỗi task test một trường khác
 *     nhau, và chọn nhầm trường là đang đọc/ghi dữ liệu của đơn vị khác. Vì vậy ba biến dưới đây khai ở
 *     `profiles/<TASK_KEY>/task.env`, và THIẾU thì helper NÉM lỗi — tuyệt đối không tự chọn trường đầu
 *     danh sách cho "chạy được".
 *
 *  3. **Có CAPTCHA, và mỗi postback sinh mã MỚI.** Chọn combobox là postback ⇒ phải chọn xong hết rồi mới
 *     chụp captcha, nếu không mã đọc được đã hết hạn lúc submit. Captcha không tự giải được: helper ghi ảnh
 *     ra file rồi CHỜ đáp án. Hệ quả phải chấp nhận: **CI không người trông KHÔNG tự đăng nhập được** —
 *     phải nạp sẵn session (xem `sessionCache` bên dưới) hoặc có agent/người đọc captcha.
 */

export const OPS_BASE = (process.env.OPS_BASE_URL || '').replace(/\/$/, '');
export const OPS_LOGIN_URL = process.env.OPS_LOGIN_URL || (OPS_BASE ? `${OPS_BASE}/Login.aspx` : '');
export const OPS_USER = process.env.OPS_USERNAME || '';
export const OPS_PASS = process.env.OPS_PASSWORD || '';

/** Đơn vị làm việc — khai ở `profiles/<TASK_KEY>/task.env`, KHÔNG có mặc định. */
export const QEMIS_SO = process.env.QEMIS_SO || '';
export const QEMIS_PHUONG_XA = process.env.QEMIS_PHUONG_XA || '';
export const QEMIS_TRUONG = process.env.QEMIS_TRUONG || '';

/** Nơi helper ghi ảnh captcha ra và chờ đáp án. */
export const CAPTCHA_IMAGE = process.env.QEMIS_CAPTCHA_IMAGE || 'test-results/qemis-captcha.png';
export const CAPTCHA_ANSWER = process.env.QEMIS_CAPTCHA_ANSWER || 'test-results/qemis-captcha-answer.txt';
const CAPTCHA_WAIT_MS = Number(process.env.QEMIS_CAPTCHA_WAIT_MS || 5 * 60 * 1000);

// Coi placeholder chưa điền (`<OPS_USERNAME>`) là CHƯA có creds → skip, tránh submit rác gây lockout oan.
const isReal = (v: string): boolean => Boolean(v) && !/^<.*>$/.test(v.trim());
export const haveOpsCreds = Boolean(OPS_LOGIN_URL && isReal(OPS_USER) && isReal(OPS_PASS));
/** Có đủ cả creds LẪN đơn vị thì mới chạy được form login. */
export const haveOpsUnit = Boolean(isReal(QEMIS_SO) && isReal(QEMIS_TRUONG));

/** Control thật trên `/Login.aspx` — đo bằng `ui-debug` ngày 24/09/2026. */
export const SEL = {
  user: '#ContentPlaceHolder1_ctl00_tbU',
  pass: '#ContentPlaceHolder1_ctl00_tbP',
  captcha: '#ContentPlaceHolder1_ctl00_tbCapcha',
  submit: '#ContentPlaceHolder1_ctl00_btOK',
  captchaImg: 'img[src*="CaptchaImage.axd"]',
  cbSo: 'ctl00_ContentPlaceHolder1_ctl00_cbSO',
  cbPhuongXa: 'ctl00_ContentPlaceHolder1_ctl00_rcbPhongGD',
  cbTruong: 'ctl00_ContentPlaceHolder1_ctl00_cbTruong',
} as const;

/** "9.500.000" / "9,500,000" / "9500000" → 9500000 (null nếu không có số). */
export function toNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

/** Chọn một RadComboBox theo text hiển thị, rồi CHỜ postback cascade xong. */
async function chonComboBox(page: Page, id: string, text: string, nhan: string): Promise<void> {
  await page.locator(`#${id}_Arrow, #${id} .rcbArrowCell`).first().click({ timeout: 15000 });
  await page.waitForTimeout(1000);
  const item = page.locator(`#${id}_DropDown li`, { hasText: text }).first();
  if (!await item.count()) {
    throw new Error(
      `[qemis] không thấy "${text}" trong combobox ${nhan}. `
      + 'Kiểm lại giá trị khai ở profiles/<TASK_KEY>/task.env — phải khớp ĐÚNG chữ hiện trên màn.',
    );
  }
  await item.click();
  await page.waitForTimeout(3000);   // postback ASP.NET nạp cấp dưới
}

/** Ghi ảnh captcha ra đĩa rồi chờ đáp án. Ném nếu hết giờ — KHÔNG đoán mã. */
async function giaiCaptcha(page: Page): Promise<string> {
  const img = page.locator(SEL.captchaImg).first();
  await img.waitFor({ state: 'visible', timeout: 15000 });
  fs.mkdirSync(require('path').dirname(CAPTCHA_IMAGE), { recursive: true });
  try { fs.unlinkSync(CAPTCHA_ANSWER); } catch (e) { /* chưa có */ }
  await img.screenshot({ path: CAPTCHA_IMAGE });

  // eslint-disable-next-line no-console
  console.log(`[qemis] CẦN ĐỌC CAPTCHA → ${CAPTCHA_IMAGE}\n`
    + `[qemis] ghi đáp án vào ${CAPTCHA_ANSWER} (chờ tối đa ${Math.round(CAPTCHA_WAIT_MS / 1000)}s)`);

  const t0 = Date.now();
  while (!fs.existsSync(CAPTCHA_ANSWER)) {
    if (Date.now() - t0 > CAPTCHA_WAIT_MS) {
      throw new Error(
        `[qemis] hết ${Math.round(CAPTCHA_WAIT_MS / 1000)}s chờ đáp án captcha. `
        + 'QEMIS bắt buộc captcha nên KHÔNG đăng nhập tự động không người trông được — '
        + 'hoặc nạp sẵn session (AUTH_REUSE), hoặc để agent/người đọc ảnh rồi ghi đáp án.',
      );
    }
    await page.waitForTimeout(600);
  }
  return fs.readFileSync(CAPTCHA_ANSWER, 'utf8').trim();
}

/**
 * Login form QEMIS thuần — KHÔNG cache. Dùng khi cố ý muốn đi qua form (vd test chính luồng login).
 *
 * Thứ tự CỐ Ý: đơn vị → user/pass → captcha. Đảo lại là captcha hết hạn vì postback của combobox.
 */
export async function loginOpsForm(page: Page): Promise<void> {
  if (!haveOpsUnit) {
    throw new Error(
      '[qemis] thiếu đơn vị làm việc: cần QEMIS_SO và QEMIS_TRUONG (và QEMIS_PHUONG_XA nếu Sở có phân cấp) '
      + 'trong `profiles/<TASK_KEY>/task.env`.\n'
      + '  KHÔNG có giá trị mặc định: mỗi task test một trường khác nhau, chọn bừa là đọc dữ liệu của đơn vị khác.',
    );
  }

  await page.goto(OPS_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1200);

  await chonComboBox(page, SEL.cbSo, QEMIS_SO, 'Sở');
  if (isReal(QEMIS_PHUONG_XA)) await chonComboBox(page, SEL.cbPhuongXa, QEMIS_PHUONG_XA, 'Phường/Xã');
  await chonComboBox(page, SEL.cbTruong, QEMIS_TRUONG, 'Trường');

  await page.fill(SEL.user, OPS_USER);
  await page.fill(SEL.pass, OPS_PASS);

  await page.fill(SEL.captcha, await giaiCaptcha(page));
  await page.click(SEL.submit);
  await page.waitForLoadState('domcontentloaded', { timeout: 40000 }).catch(() => { /* postback có thể không đổi trang */ });
  await page.waitForTimeout(3500);

  expect(/login\.aspx/i.test(page.url()), 'QEMIS login thất bại (còn ở Login.aspx)').toBeFalsy();
}

/**
 * Login CÓ TÁI SỬ DỤNG PHIÊN — đường mà mọi spec nên đi.
 *
 * Với QEMIS đây không còn là tối ưu tốc độ mà là ĐIỀU KIỆN CHẠY ĐƯỢC: captcha khiến mỗi lần login đều cần
 * người/agent, nên phiên tái dùng là thứ giữ cho suite chạy liền mạch.
 */
export async function loginOps(page: Page): Promise<void> {
  if (process.env.AUTH_REUSE === '0') { await loginOpsForm(page); return; }

  const key = `${OPS_USER || 'qemis'}::${QEMIS_TRUONG || '-'}`;   // phiên gắn với ĐƠN VỊ, không chỉ user
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
