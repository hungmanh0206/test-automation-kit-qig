import { type Page, type BrowserContext } from '@playwright/test';

/*
 * seedSession — nạp lại phiên đã lưu vào context MỚI, KHÔNG login. MỘT bản duy nhất.
 *
 * VÌ SAO tách file riêng: cả `loginOps` (điểm vào của 30 spec) lẫn `ensureOpsAuth` đều cần seed. Ban đầu tôi
 * viết bản thứ hai trong `opsLogin.ts` — hai bản sao của cùng một logic khó (thứ tự addInitScript, chọn origin,
 * cách xác minh) chắc chắn phân kỳ, và tệ hơn: UAT smoke chỉ nghiệm thu MỘT bản. Đặt ở module thứ ba để cả hai
 * dùng chung mà không sinh import vòng (`opsAuth` đã import `opsLogin`).
 *
 * Điểm dễ sai nhất: localStorage phải vào TRƯỚC mọi navigation. `addInitScript` chạy trước script trang nên app
 * thấy token ngay lúc check auth ⇒ không bị redirect `/auth/login`. Seed sau khi `goto` là quá muộn (bẫy đã gặp
 * thật khi làm ensureOpsAuth).
 */

export interface StorageStateLike {
  cookies?: Array<Record<string, unknown>>;
  origins?: Array<{ origin?: string; localStorage?: Array<{ name: string; value: string }> }>;
}

/*
 * Mẫu URL của MÀN ĐĂNG NHẬP — bị đẩy về đây nghĩa là phiên đã chết.
 *
 * ⚠️ SỬA 30/09/2026. Bản trước chỉ kiểm `/auth/login` (mẫu của LMS). QEMIS là ASP.NET WebForms và đá về
 * **`/Login.aspx`**, không khớp mẫu đó ⇒ phiên CHẾT bị chấm là CÒN SỐNG, `loginOps` trả về mà không đăng
 * nhập, và spec chạy tiếp trong trạng thái chưa auth. Lỗi im lặng: không ném, không đỏ ở bước seed, chỉ
 * vỡ ở assertion sau đó dưới dạng "không tìm thấy element" — trông y hệt bug sản phẩm.
 *
 * Thêm mẫu, KHÔNG thay mẫu cũ: `/auth/login` giữ nguyên nên 30 spec của lane LMS không đổi hành vi.
 */
const LOGIN_URL_PATTERNS = [/\/auth\/login/i, /\/login\.aspx/i];

/**
 * @returns true nếu seed xong và KHÔNG bị đẩy về màn đăng nhập (tức phiên còn dùng được).
 */
export async function seedSession(
  page: Page,
  context: BrowserContext,
  storageState: StorageStateLike | null | undefined,
  baseFallback = '',
): Promise<boolean> {
  const ss = storageState;
  if (!ss) return false;

  if (Array.isArray(ss.cookies) && ss.cookies.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await context.addCookies(ss.cookies as any);
  }
  for (const o of ss.origins || []) {
    if (Array.isArray(o.localStorage) && o.localStorage.length) {
      await context.addInitScript((items: Array<{ name: string; value: string }>) => {
        try { for (const it of items) window.localStorage.setItem(it.name, it.value); } catch (e) { /* origin khác scope */ }
      }, o.localStorage);
    }
  }

  const base = (ss.origins && ss.origins[0] && ss.origins[0].origin) || baseFallback;
  if (!base) return false;
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { /* xác minh bằng URL bên dưới */ });
  const url = page.url();
  return !LOGIN_URL_PATTERNS.some((re) => re.test(url));
}
