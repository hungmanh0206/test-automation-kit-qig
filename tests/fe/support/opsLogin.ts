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
/*
 * CẤP HỌC — thêm 25/09/2026. Màn login có NĂM ô chọn chứ không phải ba: Năm học · Sở · **Cấp học** ·
 * Phường/Xã · Trường. Bản trước bỏ qua ô Cấp học, và nó có sẵn giá trị mặc định hợp lệ là "Mầm non" —
 * nên vẫn đăng nhập trót lọt, chỉ là vào NHẦM CẤP, và app không báo gì. Lỗi im lặng kiểu này tệ hơn lỗi
 * ném, vì cả suite chạy xanh trên dữ liệu của cấp khác.
 * Để TRỐNG = giữ nguyên mặc định của app (giữ đúng hành vi cũ cho task chưa khai) — xem `chonDonVi`.
 */
export const QEMIS_CAP_HOC = process.env.QEMIS_CAP_HOC || '';
/** Năm học chọn ở form đăng nhập — ô này xuất hiện 01/10/2026 khi form đổi. */
export const QEMIS_NAM_HOC = process.env.QEMIS_NAM_HOC || '';

/*
 * Nơi helper ghi ảnh captcha ra và chờ đáp án — MỖI TIẾN TRÌNH MỘT ĐƯỜNG DẪN RIÊNG.
 *
 * Bản cũ dùng một đường dẫn cố định cho mọi lượt chạy. Hai lượt chạy chồng nhau là hỏng cả hai, theo
 * cách rất khó nhìn ra: lượt B ghi đè ảnh của lượt A, người đọc ảnh của A rồi ghi đáp án, nhưng lượt B
 * poll trước nên NUỐT mất đáp án đó — A hết giờ chờ, B nộp sai mã. Cả hai cùng trượt, và log chỉ nói
 * "sai captcha" nên dễ quy oan cho người đọc.
 *
 * Đã xảy ra thật 01/10/2026: hai lượt chạy khác đơn vị (THCS Test và Thủ Đô/THPT) tranh nhau cùng một
 * file, khiến không lượt nào đăng nhập được, và vì `save` chỉ chạy sau khi đăng nhập thành công nên
 * cache phiên không bao giờ ấm lên — mọi case lại phải đăng nhập lại từ đầu.
 *
 * Gắn `process.pid` vào tên file là đủ tách: mỗi lượt chạy Playwright là một tiến trình.
 */
const HAU_TO_TIEN_TRINH = `-${process.pid}`;
export const CAPTCHA_IMAGE = process.env.QEMIS_CAPTCHA_IMAGE
  || `test-results/qemis-captcha${HAU_TO_TIEN_TRINH}.png`;
export const CAPTCHA_ANSWER = process.env.QEMIS_CAPTCHA_ANSWER
  || `test-results/qemis-captcha-answer${HAU_TO_TIEN_TRINH}.txt`;
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
  // Nhãn trên màn là "Phường/Xã" nhưng id là `rcbPhongGD` (Phòng GD) — tìm theo chữ "PhuongXa" sẽ không ra.
  cbPhuongXa: 'ctl00_ContentPlaceHolder1_ctl00_rcbPhongGD',
  cbTruong: 'ctl00_ContentPlaceHolder1_ctl00_cbTruong',
  cbCapHoc: 'ctl00_ContentPlaceHolder1_ctl00_cbCapHoc',
  // Thêm 01/10/2026: form đăng nhập đổi — ô "Sở" biến mất, ô "Năm học" xuất hiện.
  cbNamHoc: 'ctl00_ContentPlaceHolder1_ctl00_rcbNamHoc',
} as const;

/** "9.500.000" / "9,500,000" / "9500000" → 9500000 (null nếu không có số). */
export function toNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

/**
 * Chọn một RadComboBox theo text hiển thị, rồi CHỜ postback cascade xong.
 *
 * VIẾT LẠI 25/09/2026 sau khi đo thật trên `/Login.aspx`. Bản trước hỏng ở hai chỗ, đều im lặng:
 *
 *  1. **Chờ sai tín hiệu.** RadComboBox giữ `<li>` trong DOM cả khi dropdown đang ĐÓNG, nên `count()` > 0
 *     không có nghĩa là mở. Click vào item đang ẩn thì Playwright quay vòng "element is not visible" tới
 *     hết timeout rồi ném — đo được: Phường/Xã và Lớp đều chết kiểu này. Phải chờ item **visible**.
 *
 *  2. **Postback của ô trước đóng dropdown vừa mở.** Chọn Sở là một postback ASP.NET; nếu mở ô kế ngay lúc
 *     nó đang chạy thì dropdown bật lên rồi tắt. Nên phải THỬ LẠI, không phải mở một phát.
 *
 * Bỏ luôn hai `waitForTimeout` của bản cũ — `playwright_fe.md` cấm, và ở đây chúng vừa chậm vừa không
 * chắc: 1s có thể chưa đủ mở dropdown, 3s có thể thừa hoặc vẫn thiếu tuỳ mạng. Thay bằng tín hiệu thật:
 * ô `_Input` phải hiện đúng chữ vừa chọn.
 */
/**
 * @param boQuaNeuDungSan CHỈ đặt `true` cho ô KHÔNG phải nguồn cascade.
 *
 * Ô nào mà danh sách của ô khác phụ thuộc vào nó — Sở, Cấp học — thì PHẢI bấm thật, kể cả khi ô đang
 * sẵn đúng giá trị. Lý do: giá trị hiển thị sẵn không có nghĩa là server đã nạp danh mục phụ thuộc;
 * cascade chỉ chạy khi có postback.
 *
 * Tôi đã mắc đúng lỗi này 01/10/2026: thêm "bỏ qua nếu đã đúng" cho MỌI combobox để cứu ô Năm học, và
 * vô tình bỏ luôn cú bấm Cấp học. Hậu quả là danh sách Trường không được lọc — 3.174 mục của mọi cấp
 * thay vì 706 mục của THCS — và RadComboBox không dựng hết số đó trong DOM, nên không tìm thấy đơn vị
 * cần chọn. Thông báo lỗi lúc đó chỉ nói "không chọn được Trường", không hề gợi ý nguyên nhân nằm ở
 * một ô khác.
 */
async function chonComboBox(page: Page, id: string, text: string, nhan: string,
  boQuaNeuDungSan = false): Promise<void> {
  /*
   * KHỚP TRỌN, không so CHỨA. `hasText` mặc định là so chứa, nên "Phường Ba Đình" cũng khớp mọi mục
   * DÀI HƠN có chứa chuỗi đó, rồi `.first()` chọn đại một cái theo thứ tự DOM. Trong danh sách 127
   * phường của Hà Nội, chọn trúng mục khác nghĩa là đăng nhập vào đơn vị khác — mà mọi assertion sau
   * đó vẫn xanh. Bản probe dùng khớp trọn thì chọn được, bản này dùng so chứa thì không: khác đúng chỗ ấy.
   */
  const tron = new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
  const item = page.locator(`#${id}_DropDown li`).filter({ hasText: tron });
  const arrow = page.locator(`#${id}_Arrow`);

  /*
   * ĐANG ĐÚNG RỒI THÌ ĐỪNG ĐỘNG VÀO — thêm 01/10/2026.
   *
   * Ô "Năm học" trên form đăng nhập mới mặc định đã là "Năm học 2026-2027", đúng thứ cần chọn. Bản cũ
   * vẫn mở dropdown rồi bấm, và vì giá trị không ĐỔI nên phép nghiệm thu "ô phải hiện đúng chữ vừa
   * chọn" không phân biệt được "chọn thành công" với "không bấm trúng gì". Nó thử 3 lượt rồi ném ra một
   * thông báo tự mâu thuẫn: "không chọn được X — ô vẫn đang là X".
   *
   * Mỗi lượt mở dropdown còn là một postback, mà mỗi postback sinh CAPTCHA MỚI. Nên động vào ô đã đúng
   * không chỉ vô ích: nó làm hỏng chính lượt đăng nhập.
   */
  if (boQuaNeuDungSan) {
    const dangCo = (await page.locator(`#${id}_Input`).inputValue().catch(() => '')).trim();
    if (dangCo !== '' && dangCo === text.trim()) return;
  }

  /*
   * ① NGHIỆM THU RỒI THỬ LẠI CẢ LƯỢT CHỌN — sửa 01/10/2026 sau khi đo trên /Login.aspx và trên lưới lớp.
   *
   * Bản trước mở dropdown rồi TIN vào một cú bấm. Hỏng ở chỗ: sau một lần chọn thành công, RadComboBox
   * để lại dropdown trong DOM ở trạng thái `isVisible = true` NHƯNG ĐÃ CHẾT. Cú bấm kế tiếp rơi vào đó
   * và không chọn được gì, nên chọn ĐƯỢC ăn XEN KẼ: Sở ăn → Cấp học ăn → Phường/Xã KHÔNG ăn.
   *
   * Đo được, lặp lại 3 lượt trên lưới lớp: Khối 6 ăn · Khối 7 không · Khối 8 ăn · Khối 9 không.
   * Hai bản vá trước (chờ `networkidle`; hỏi `isVisible` trước khi bấm mũi tên) ĐỀU KHÔNG hết, vì chính
   * tín hiệu `isVisible` đang nói dối.
   *
   * Hậu quả của bệnh này không phải là một lần fail: `loginOpsForm` bắt được Sở và Cấp học rồi TRƯỢT
   * Phường/Xã, phiên rơi vào đơn vị khác, và mọi assertion sau đó vẫn XANH trên dữ liệu của đơn vị sai.
   * Đã xảy ra thật ngày 01/10: lượt chạy khai cấp THPT trả về Khối 6–9 của THCS mà không gì báo động.
   */
  /*
   * ƯU TIÊN API CLIENT CỦA TELERIK, chuột chỉ là đường dự phòng.
   *
   * Đo 01/10/2026 trên /Login.aspx sau khi chọn Cấp học: hộp `#<id>_DropDown` báo
   * `display: block · visibility: visible · opacity: 1` — nên `isVisible()` trả TRUE — nhưng kích thước
   * thật là **0×0 tại 0,0**, và `<li>` bên trong cũng 0×0. Playwright chờ phần tử "visible, enabled,
   * stable"; một hộp 0×0 không bao giờ bấm được, nên `click()` hết giờ. Không có gì che nó cả
   * (`elementFromPoint` trả null) — nó chỉ đơn giản là không có diện tích.
   *
   * Đó là lý do mọi bản vá đường-chuột trước đều thất bại, và cũng là lý do `isVisible` không dùng làm
   * tín hiệu được: nó nói dối. `$find(id).findItemByText(text).select()` đặt giá trị và KÍCH HOẠT cascade
   * thật (đo được: chọn xong, danh sách Trường nạp 260 mục).
   */
  /* Chờ postback của ô phía trên lắng xong rồi mới đụng ô này — nếu không, giá trị vừa đặt bị nó xoá. */
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { /* app poll ngầm */ });

  /*
   * ĐỔI THỨ TỰ (đo 04/10/2026): CHUỘT TRƯỚC, API sau.
   *
   * Hôm nay trên /Login.aspx cả năm combobox đều có kích thước thật 430×34 — bấm được bình thường. Còn
   * `it.select()` của Telerik lại NÉM "'caller', 'callee', and 'arguments'..." trong ngữ cảnh strict:
   * giá trị vẫn được đặt nhưng sự kiện đổi KHÔNG phát, nên cascade đứng im và ô Phường/Xã còn 0 mục.
   * Hậu quả đo được: helper đặt xong "Thành phố Hà Nội" rồi chết ở Phường/Xã với "0 mục trong danh sách".
   *
   * Đường chuột làm được cả hai việc: đặt giá trị VÀ phát postback cho cấp dưới nạp lại. Giữ API làm
   * đường dự phòng cho những ngày hộp dropdown lại 0×0 như 01/10.
   */
  const datQuaApi = async (): Promise<boolean> => page.evaluate(([id2, text2]) => {
    const f = (window as any).$find;
    if (typeof f !== 'function') return false;
    const cb = f(id2);
    if (!cb || typeof cb.findItemByText !== 'function') return false;
    try {
      const it = cb.findItemByText(text2);
      if (!it) return false;
      it.select();
      if (typeof cb.get_inputDomElement === 'function') cb.get_inputDomElement().value = text2;
      return true;
    } catch (e) { return false; }
  }, [id, text] as const).catch(() => false);

  /*
   * Nghiệm thu PHẢI làm HAI LẦN, cách nhau một nhịp lắng.
   *
   * Đo 01/10/2026: giá trị đặt được NGAY, nhưng postback đang chạy của ô phía trên (Cấp học) ập về sau đó
   * và RESET ô này. Ảnh lỗi cho thấy Phường/Xã và Trường rỗng kèm chữ đỏ "Thông tin bắt buộc", trong khi
   * captcha đã điền đúng — tức form bị từ chối vì thiếu đơn vị chứ không phải sai mã. Kiểm một lần rồi đi
   * tiếp là tin vào một giá trị sắp bị xoá.
   */
  const dungGiaTri = async (): Promise<boolean> => page.waitForFunction(
    ([sel, mong]) => {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      return !!el && (el.value || '').trim().startsWith(String(mong).trim());
    },
    [`#${id}_Input`, text] as const,
    { timeout: 25000 },
  ).then(() => true).catch(() => false);

  const benVung = async (): Promise<boolean> => {
    if (!(await dungGiaTri())) return false;
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { /* app poll ngầm */ });
    await page.waitForTimeout(1500);
    if (await dungGiaTri()) return true;
    // eslint-disable-next-line no-console
    console.warn(`[qemis] ${nhan} bị RESET sau postback (đặt "${text}" rồi mất) — thử lại.`);
    return false;
  };

  let anKhop = false;
  let soMucCuoi = 0;
  for (let lan = 0; lan < 3 && !anKhop; lan += 1) {
    if (lan > 0) {
      await page.keyboard.press('Escape').catch(() => { /* không mở thì thôi */ });
      await page.waitForTimeout(600);
    }

    let moDuoc = false;
    for (let i = 0; i < 4 && !moDuoc; i += 1) {
      await arrow.click({ timeout: 15000 }).catch(() => { /* postback đang chạy, thử lại */ });
      moDuoc = await item.isVisible({ timeout: 4000 }).catch(() => false);
    }
    soMucCuoi = await page.locator(`#${id}_DropDown li`).count();
    if (!moDuoc) continue;

    await item.scrollIntoViewIfNeeded().catch(() => { /* đã trong khung nhìn */ });
    await item.click({ timeout: 15000 }).catch(() => { /* lượt sau thử lại */ });

    /*
     * ② Tín hiệu nghiệm thu: ô nhập của chính combobox đó hiện đúng chữ vừa chọn (KHÔNG chờ theo thời gian).
     *
     * Phải đọc `el.value` (PROPERTY), không dùng selector `[value*="…"]` (ATTRIBUTE): RadComboBox gán giá trị
     * bằng JS nên attribute `value` trong HTML không đổi. Đo 25/09/2026 — bản dùng CSS attribute ném lỗi
     * "ô vẫn đang là X" trong khi X chính là giá trị vừa chọn đúng.
     */
    anKhop = await benVung();
  }

  /* Chuột trượt (ví dụ hộp dropdown 0×0 như 01/10) thì mới mượn API client của Telerik. */
  if (!anKhop) {
    // eslint-disable-next-line no-console
    console.warn(`[qemis] ${nhan}: đường chuột không chọn được "${text}" — thử API client của Telerik.`);
    if (await datQuaApi()) anKhop = await benVung();
  }

  if (!anKhop) {
    const thuc = await page.locator(`#${id}_Input`).inputValue().catch(() => '(không đọc được)');
    throw new Error(
      `[qemis] không chọn được "${text}" trong combobox ${nhan} sau 3 lượt thử — ô vẫn đang là "${thuc}" `
      + `(${soMucCuoi} mục trong danh sách).\n`
      + (soMucCuoi === 0
        ? '  Danh sách RỖNG — thường là cấp trên chưa chọn xong, hoặc đơn vị cấp trên không có mục nào '
          + '(vd Sở "Trường trực thuộc bộ" không có trường THPT nào).'
        : '  Kiểm lại giá trị khai ở profiles/<TASK_KEY>/task.env — phải khớp ĐÚNG chữ hiện trên màn.'),
    );
  }
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
  /*
   * Chờ TÍN HIỆU form đã dựng xong, nhưng neo vào ô LUÔN CÓ chứ không vào ô có thể biến mất.
   *
   * Bản cũ chờ ô "Sở". Ngày 01/10/2026 form đổi: ô Sở bị gỡ hẳn (trang giờ gắn cứng Sở GD&ĐT Hà Nội) và
   * thêm ô "Năm học". Hậu quả không phải một test đỏ mà là TẤT CẢ: mọi lượt login treo 30 giây rồi hết
   * giờ, và thông báo chỉ nói "không thấy locator" — không ai đoán ra form đã đổi.
   * Ô Trường thì luôn có, nên neo vào đó.
   */
  await page.locator(`#${SEL.cbTruong}_Input`).waitFor({ state: 'attached', timeout: 30000 });
  const coOSo = (await page.locator(`#${SEL.cbSo}_Input`).count()) > 0;
  const coONamHoc = (await page.locator(`#${SEL.cbNamHoc}_Input`).count()) > 0;

  /*
   * THỨ TỰ THEO ĐÚNG FORM: Sở → Năm học → Cấp học → Phường/Xã → Trường. Đảo lại là postback cascade nạp
   * sai danh mục (danh sách Trường phụ thuộc cả Sở lẫn Cấp học).
   *
   * Gói thành hàm để lượt THỬ LẠI captcha gọi lại được — tải lại trang là mọi lựa chọn mất sạch.
   */
  const chonDonVi = async (): Promise<void> => {
  /*
   * "ĐÁNH THỨC" ô Trường TRƯỚC khi chọn Cấp học — mở một lần rồi đóng.
   *
   * Nghe vô lý, nhưng đây là khác biệt DUY NHẤT giữa probe chạy được và helper không chạy được, và đã
   * đo đi đo lại:
   *   · `probe.cascade-dangnhap`: mở Trường (3.174) → chọn Cấp học → mở lại Trường = **706 mục, khớp 1**
   *   · `loginOpsForm` (không mở trước): chọn Cấp học → mở Trường = **vẫn 3.174 mục, khớp 0**
   *
   * Suy đoán: RadComboBox chỉ đăng ký để được cascade làm mới sau khi nó đã dựng danh sách lần đầu.
   * Chưa mở lần nào thì postback của Cấp học không chạm tới nó.
   *
   * Tôi đã thử các cách khác và ĐỀU KHÔNG ĂN, ghi ra để không ai thử lại: chờ thêm thời gian · mở lại
   * sau khi chọn Cấp học · gõ vào ô để lọc (ô không lọc, 3.174 → 3.174) · để trống ô Trường (form bắt
   * buộc) · lấy bừa mục đầu danh sách (tài khoản không có quyền ở đơn vị đó, trượt 2/2 lượt).
   */
  await page.locator(`#${SEL.cbTruong}_Arrow`).click({ timeout: 15000 }).catch(() => { /* không mở được thì đi tiếp */ });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Escape').catch(() => { /* không mở thì thôi */ });
  await page.waitForTimeout(800);

  if (coOSo) {
    await chonComboBox(page, SEL.cbSo, QEMIS_SO, 'Sở');
  } else if (isReal(QEMIS_SO)) {
    // eslint-disable-next-line no-console
    console.warn(`[qemis] form đăng nhập KHÔNG còn ô "Sở", nhưng task.env vẫn khai QEMIS_SO="${QEMIS_SO}". `
      + 'Trang giờ gắn cứng một Sở — kiểm lại xem có đúng Sở của đơn vị cần test không, '
      + 'vì đăng nhập nhầm Sở thì mọi assertion sau đó vẫn xanh trên dữ liệu của đơn vị khác.');
  }
  if (coONamHoc && isReal(QEMIS_NAM_HOC)) {
    await chonComboBox(page, SEL.cbNamHoc, QEMIS_NAM_HOC, 'Năm học', true);
  } else if (coONamHoc) {
    // eslint-disable-next-line no-console
    console.warn('[qemis] form có ô "Năm học" nhưng QEMIS_NAM_HOC chưa khai ⇒ giữ mặc định của app. '
      + 'Năm học sai thì hồ sơ đọc được là của năm khác mà app không báo gì.');
  }
  if (isReal(QEMIS_CAP_HOC)) {
    await chonComboBox(page, SEL.cbCapHoc, QEMIS_CAP_HOC, 'Cấp học');
  } else {
    // eslint-disable-next-line no-console
    console.warn('[qemis] QEMIS_CAP_HOC chưa khai ⇒ giữ mặc định của app ("Mầm non"). '
      + 'Nếu task không phải cấp Mầm non thì đang đăng nhập NHẦM CẤP mà app không báo gì — '
      + 'khai QEMIS_CAP_HOC trong profiles/<TASK_KEY>/task.env.');
  }
  if (isReal(QEMIS_PHUONG_XA)) await chonComboBox(page, SEL.cbPhuongXa, QEMIS_PHUONG_XA, 'Phường/Xã');

  /*
   * CHỜ DANH SÁCH PHỤ THUỘC NẠP XONG, trước khi đụng vào ô Trường — sửa 01/10/2026.
   *
   * `chonComboBox` nghiệm thu bằng chữ trong ô nhập của CHÍNH nó. Với ô Cấp học, chữ đổi ngay tại trình
   * duyệt, trong khi danh sách Trường chỉ nạp lại SAU khi postback về. Nên hàm trả về "đã chọn xong" rồi
   * mà danh mục Trường vẫn là bản cũ.
   *
   * Hậu quả đo được: ô Trường còn nguyên 3.174 mục của MỌI cấp thay vì 706 mục của THCS. Với danh sách
   * cỡ đó RadComboBox không dựng hết vào DOM, nên đơn vị cần chọn không có mặt để mà bấm — và thông báo
   * lỗi chỉ nói "không chọn được Trường", không hề chỉ sang ô Cấp học.
   *
   * Tín hiệu chờ là SỐ MỤC ĐỔI, không phải một mốc thời gian: mạng nhanh thì đi tiếp ngay, mạng chậm
   * thì chờ đủ. Hết hạn mà số mục không đổi thì vẫn đi tiếp — để `chonComboBox` báo lỗi kèm số mục thật,
   * còn hơn ném một lỗi chờ không nói lên điều gì.
   */
  const demMucTruong = () => page.locator(`#${SEL.cbTruong}_DropDown li`).count().catch(() => -1);
  const soTruoc = await demMucTruong();
  let soSau = soTruoc;

  /*
   * PHẢI MỞ LẠI dropdown Trường thì nó mới nạp danh mục mới — chờ suông không đủ.
   *
   * Đo được 01/10/2026: sau khi chọn Cấp học = "Trung học cơ sở", ô Cấp học hiện đúng chữ, nhưng
   * `#cbTruong_DropDown` vẫn giữ nguyên 3.174 mục của cấp Mầm non. Đó là bản DOM dựng lúc tải trang;
   * cascade chỉ đổi dữ liệu phía server, phần hiển thị chỉ được thay khi dropdown được MỞ lại.
   *
   * Chờ thụ động bao lâu cũng vô ích vì không có gì chạm vào DOM đó. Nên ở đây mở ra, chờ số mục đổi,
   * rồi đóng lại — đúng trình tự mà probe `probe.cascade-dangnhap` chứng minh là chạy được (3.174 → 706).
   *
   * Vì sao quan trọng: với 3.174 mục, RadComboBox không dựng hết vào DOM nên đơn vị cần chọn không có
   * mặt để bấm, và lỗi báo ra chỉ là "không chọn được Trường" — không chỉ sang được nguyên nhân thật.
   */
  /*
   * ĐÃ THỬ VÀ BỎ: mở sẵn dropdown Trường ở đây rồi chờ số mục đổi, sau đó Escape.
   *
   * Ý tưởng dựa trên probe `probe.cascade-dangnhap` (mở → chọn cấp → mở lại = 3.174 → 706). Nhưng đưa
   * vào đây thì KHÔNG giúp: số mục vẫn 3.174, và tệ hơn là nó làm hỏng lượt chọn Trường vốn đang chạy
   * được lúc 13:45 — mở rồi Escape để lại dropdown ở trạng thái mà cú bấm sau không dùng được.
   *
   * Giữ lại ghi chú này để không ai (kể cả tôi) thử lại đúng cách đó lần nữa. Chỉ chờ cascade lắng, rồi
   * để `chonComboBox` tự mở như nó vẫn làm.
   */
  for (let i = 0; i < 10; i += 1) {
    await page.waitForTimeout(500);
    soSau = await demMucTruong();
    if (soSau > 0 && soSau !== soTruoc) break;
  }

  /*
   * In ra trạng thái NGAY TRƯỚC khi đụng ô Trường.
   *
   * Khi lượt chọn Trường hỏng, thông báo lỗi chỉ nói "không chọn được Trường — N mục". Con số N một
   * mình không cho biết nguyên nhân nằm ở đâu: danh sách lớn vì cascade chưa chạy, hay vì cấp học đang
   * sai. Dòng log này cho cả hai, nên lần sau nhìn log là biết ngay phải sửa chỗ nào.
   */
  const capLucNay = (await page.locator(`#${SEL.cbCapHoc}_Input`).inputValue().catch(() => '?')).trim();
  // eslint-disable-next-line no-console
  console.log(`[qemis] trước khi chọn Trường: Cấp học đang là "${capLucNay}" (cần "${QEMIS_CAP_HOC}") `
    + `· danh sách Trường ${soTruoc} → ${soSau} mục`);

  /*
   * Ô Trường ở form đăng nhập: CỐ GẮNG đúng, nhưng KHÔNG chặn lượt đăng nhập nếu không chọn được.
   *
   * Chủ dự án chỉ rõ 01/10/2026: form đăng nhập hiện bị ghim vào Sở Hà Nội và KHÔNG còn là nơi quyết
   * định đơn vị làm việc. Đơn vị thật được chọn SAU khi đăng nhập, qua nút hệ thống (9 chấm) → Master
   * root → Chọn trường làm việc → Lưu thay đổi.
   *
   * Tôi đã mất nhiều lượt vá cascade để cố chọn đúng Trường ngay tại đây — sai đường ngay từ đầu. Nên
   * giờ: chọn được đúng thì tốt, không thì lấy mục đầu danh sách cho qua cửa, và BÁO TO rằng đơn vị
   * làm việc chưa được chọn.
   *
   * ⚠️ Cảnh báo phải to, vì đây chính là kiểu lỗi nguy hiểm nhất của suite này: đăng nhập nhầm đơn vị
   * thì mọi assertion sau đó vẫn XANH, chỉ là xanh trên dữ liệu của trường khác. Spec nào đọc dữ liệu
   * đơn vị PHẢI gọi bước chọn trường làm việc trước khi tin vào màn.
   */
  /*
   * `QEMIS_CHON_TRUONG_O_FORM=0` ⇒ KHÔNG tìm đơn vị ở form đăng nhập, lấy luôn mục đầu cho nhanh.
   *
   * Vì sao cần cờ này: khi form không phải nơi chọn đơn vị, việc đi tìm đúng mục trong danh sách 3.174
   * phần tử vừa vô ích vừa rất đắt — `chonComboBox` thử 3 vòng, mỗi vòng 4 lần bấm với hạn 15 giây, tức
   * gần 3 phút chờ trước khi chịu thua. Mỗi lượt đăng nhập mất 3 phút cho một bước không dùng tới.
   */
  const timTruongOForm = process.env.QEMIS_CHON_TRUONG_O_FORM !== '0';
  try {
    if (!timTruongOForm) throw new Error('bỏ qua theo QEMIS_CHON_TRUONG_O_FORM=0');
    await chonComboBox(page, SEL.cbTruong, QEMIS_TRUONG, 'Trường');
  } catch (e) {
    /*
     * KHÔNG chọn bừa một trường khác.
     *
     * Bản trước lấy mục đầu danh sách cho qua cửa — trượt 2/2 lượt, và lý do rất dễ hiểu: mục đầu là một
     * nhóm trẻ mầm non độc lập mà tài khoản không có quyền. Đăng nhập bằng đơn vị sai còn tệ hơn không
     * đăng nhập được: nếu nó lọt, mọi assertion sau đó vẫn xanh trên dữ liệu trường khác.
     *
     * Để TRỐNG ô Trường và thử gửi. Theo chủ dự án, đơn vị làm việc được chọn SAU khi đăng nhập qua
     * Master root, nên form có thể không bắt buộc ô này. Không gửi được thì `expect` ở cuối sẽ báo, kèm
     * lý do app trả về từng lượt — tốt hơn là âm thầm vào nhầm trường.
     */
    // eslint-disable-next-line no-console
    console.warn(`[qemis] ⚠️ KHÔNG chọn được "${QEMIS_TRUONG}" ở form đăng nhập `
      + `(${String((e as Error).message).slice(0, 120)}…).\n`
      + '[qemis] ĐỂ TRỐNG ô Trường và thử đăng nhập — KHÔNG lấy bừa đơn vị khác, vì vào nhầm trường thì '
      + 'mọi assertion sau đó vẫn xanh trên dữ liệu của trường khác.\n'
      + '[qemis] Đơn vị làm việc phải chọn sau khi đăng nhập: nút hệ thống (9 chấm) → Master root → '
      + 'Chọn trường làm việc → Lưu thay đổi.');
    await page.keyboard.press('Escape').catch(() => { /* dropdown không mở thì thôi */ });
    await page.waitForTimeout(600);
  }
  };

  await chonDonVi();

  await page.fill(SEL.user, OPS_USER);
  await page.fill(SEL.pass, OPS_PASS);

  /*
   * THỬ LẠI CAPTCHA NGAY TRONG MỘT LƯỢT CHẠY — thêm 01/10/2026.
   *
   * Bản cũ chụp captcha, chờ đáp án, nộp đúng MỘT lần. Trượt là hỏng cả lượt chạy, và lượt sau lại bắt
   * đầu từ số không. Mà captcha ở đây trượt thường xuyên vì hai lý do cộng lại:
   *   · ảnh có gạch ngang và nhiễu, dễ lẫn Q/O, J/I, V/U — người lẫn agent đều đọc sai được
   *   · mã có hạn: khoảng thời gian từ lúc chụp tới lúc nộp đáp án càng dài thì càng dễ hết hạn
   *
   * Nên vòng lặp này nộp xong mà vẫn ở Login.aspx thì TẢI LẠI TRANG, chọn lại đơn vị, chụp mã MỚI và
   * thử tiếp. Rẻ hơn nhiều so với hỏng cả lượt chạy rồi dựng lại từ đầu.
   *
   * Tải lại trang là bắt buộc: giữ nguyên trang cũ thì mã trên màn đã chết, nộp bao nhiêu lần cũng trượt.
   */
  const SO_LAN_THU = Number(process.env.QEMIS_CAPTCHA_RETRY || 3);
  let vaoDuoc = false;
  const lyDo: string[] = [];

  for (let lan = 1; lan <= SO_LAN_THU && !vaoDuoc; lan += 1) {
    await page.fill(SEL.captcha, await giaiCaptcha(page));
    await page.click(SEL.submit);
    await page.waitForURL((u) => !/login\.aspx/i.test(u.toString()), { timeout: 45000 })
      .catch(() => { /* còn ở Login ⇒ xử lý ngay dưới */ });

    if (!/login\.aspx/i.test(page.url())) { vaoDuoc = true; break; }

    /* Đọc đúng lý do app từ chối, thay vì đoán "chắc sai captcha". */
    const bao = await page.evaluate(() => {
      const xs = Array.from(document.querySelectorAll('span, div, label'))
        .filter((e: any) => e.offsetParent !== null && !e.children.length)
        .map((e: any) => (e.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((t: string) => t && t.length < 160
          && /(sai|không đúng|chưa đúng|thất bại|khoá|kho[áa]|hết hạn|mã xác nhận|captcha)/i.test(t));
      return [...new Set(xs)].join(' | ');
    }).catch(() => '');
    lyDo.push(`lần ${lan}: ${bao || '(app không nêu lý do)'}`);

    // eslint-disable-next-line no-console
    console.log(`[qemis] login trượt lần ${lan}/${SO_LAN_THU} — ${bao || 'app không nêu lý do'}. `
      + (lan < SO_LAN_THU ? 'tải lại trang, chọn lại đơn vị và lấy mã mới.' : 'hết lượt thử.'));

    if (lan < SO_LAN_THU) {
      await page.goto(OPS_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.locator(`#${SEL.cbTruong}_Input`).waitFor({ state: 'attached', timeout: 30000 });
      await chonDonVi();
      await page.fill(SEL.user, OPS_USER);
      await page.fill(SEL.pass, OPS_PASS);
    }
  }

  expect(vaoDuoc,
    `QEMIS login thất bại sau ${SO_LAN_THU} lượt thử (còn ở Login.aspx).\n`
    + `  Lý do app trả về từng lượt: ${lyDo.join(' · ') || '(không đọc được)'}\n`
    + '  Thường là sai captcha, sai mật khẩu, hoặc thiếu một ô đơn vị bắt buộc.').toBeTruthy();
}

/** Control trên màn `/Manage/ChonTruong.aspx` — đo 01/10/2026. */
export const SEL_CHON_TRUONG = {
  so: 'ctl00_ContentPlaceHolder1_cbSO',
  capHoc: 'ctl00_ContentPlaceHolder1_cbCapHoc',
  phuongXa: 'ctl00_ContentPlaceHolder1_rcbPhongGD',
  truong: 'ctl00_ContentPlaceHolder1_cbTruong',
  luu: 'ContentPlaceHolder1_btTimKiem',
} as const;

/**
 * Đặt ĐƠN VỊ LÀM VIỆC sau khi đã đăng nhập.
 *
 * Từ 01/10/2026 form đăng nhập bị ghim vào một Sở và KHÔNG còn là nơi quyết định đơn vị. Đường đúng,
 * do chủ dự án chỉ: nút hệ thống (9 chấm) → Master Root → Chọn trường làm việc → Lưu thay đổi.
 * Màn đó là `/Manage/ChonTruong.aspx`, và nó có ĐỦ bộ chọn Sở · Cấp học · Phường/Xã · Trường — tức Sở
 * không biến mất khỏi hệ thống, chỉ rời khỏi form đăng nhập.
 *
 * ⚠️ Hàm này GHI: nó đổi đơn vị làm việc của chính tài khoản đang dùng, và tài khoản đó dùng chung.
 * Ai đang mở phiên khác trên cùng tài khoản sẽ thấy đơn vị đổi theo.
 *
 * Trả về tên đơn vị đọc được trên thanh tiêu đề sau khi lưu — để spec KIỂM, đừng tin là đã đổi.
 */
export async function datTruongLamViec(page: Page, opts: {
  so: string; capHoc: string; truong: string; phuongXa?: string;
}): Promise<string> {
  await page.goto(`${OPS_BASE}/Manage/ChonTruong.aspx`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator(`#${SEL_CHON_TRUONG.truong}_Input`).waitFor({ state: 'attached', timeout: 30000 });

  /*
   * Dùng routine RIÊNG cho màn này, không dùng `chonComboBox`.
   *
   * `chonComboBox` được viết cho form đăng nhập và có vòng retry mở/đóng riêng; đưa sang màn này thì ô
   * Trường đọc ra **0 mục** dù probe `probe.tim-don-vi-cu` — dùng đúng routine dưới đây — đọc được 50.
   * Khác biệt nằm ở chỗ nó để dropdown trước ở trạng thái mở-nhưng-chết, khiến cú bấm kế tiếp rơi vào đó.
   *
   * Routine này luôn Escape sau mỗi lần chạm, và chờ danh sách có mục trước khi tìm.
   */
  const chonOTrenMan = async (id: string, chu: string, nhan: string): Promise<void> => {
    const tron = new RegExp(`^\\s*${chu.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
    /* Khi chuỗi có MÃ trong ngoặc, ví dụ "TH Demo (3312133003)", ưu tiên khớp theo MÃ đó — mã là duy
     * nhất nên không đụng đơn vị khác, mà lại tránh được bẫy: exact-match neo `^…$` fail khi textContent
     * của <li> dính khoảng trắng/newline (innerText thì sạch). Không có mã thì giữ exact-match như cũ. */
    const maTrongNgoac = (chu.match(/\(([^)]+)\)\s*$/) || [])[1] || '';
    const locMuc = () => (maTrongNgoac
      ? page.locator(`#${id}_DropDown li`).filter({ hasText: `(${maTrongNgoac})` }).first()
      : page.locator(`#${id}_DropDown li`).filter({ hasText: tron }).first());
    for (let lan = 0; lan < 3; lan += 1) {
      await page.locator(`#${id}_Arrow`).click({ timeout: 20000 }).catch(() => { /* vòng sau thử lại */ });
      for (let i = 0; i < 24; i += 1) {
        await page.waitForTimeout(500);
        if ((await page.locator(`#${id}_DropDown li`).count().catch(() => 0)) > 0) break;
      }
      const muc = locMuc();
      if (await muc.count()) {
        await muc.scrollIntoViewIfNeeded().catch(() => { /* đã trong khung nhìn */ });
        await muc.click({ timeout: 20000 }).catch(() => { /* vòng sau thử lại */ });
        await page.waitForTimeout(2800);
        const gt = (await page.locator(`#${id}_Input`).inputValue().catch(() => '')).trim();
        if (maTrongNgoac ? gt.includes(maTrongNgoac) : gt.startsWith(chu.trim())) return;
      }
      await page.keyboard.press('Escape').catch(() => { /* không mở thì thôi */ });
      await page.waitForTimeout(800);
    }

    /*
     * LƯỢT CUỐI — GÕ CHỮ ĐỂ SERVER LỌC LẠI.
     *
     * Ô Trường chỉ nạp sẵn **50 mục đầu**, nên đơn vị TEST (ví dụ `THPT Nguyễn Trãi (TEST) (ntkcs)`)
     * không có trong DOM và mọi vòng mở-dropdown ở trên đều trượt. Lỗi báo ra là "danh sách có 50 mục",
     * nghe như chọn sai tên — thực ra là danh sách bị cắt. RadComboBox ở màn này lọc phía server khi gõ,
     * nên gõ một phần tên là nạp đúng mục cần. Cách này thay được mẹo phải khai thêm Phường/Xã cho trúng.
     */
    const phanTen = chu.replace(/\s*\([^)]*\)\s*$/, '').trim() || chu.trim();
    for (const tuKhoa of [phanTen, maTrongNgoac].filter(Boolean)) {
      await page.locator(`#${id}_Input`).click({ timeout: 15000 }).catch(() => { /* thử từ khoá sau */ });
      await page.locator(`#${id}_Input`).fill(tuKhoa).catch(() => { /* thử từ khoá sau */ });
      await page.waitForTimeout(3500);
      const muc = locMuc();
      if (await muc.count()) {
        await muc.scrollIntoViewIfNeeded().catch(() => { /* đã trong khung nhìn */ });
        await muc.click({ timeout: 20000 }).catch(() => { /* thử từ khoá sau */ });
        await page.waitForTimeout(2800);
        const gt = (await page.locator(`#${id}_Input`).inputValue().catch(() => '')).trim();
        if (maTrongNgoac ? gt.includes(maTrongNgoac) : gt.startsWith(chu.trim())) return;
      }
      await page.keyboard.press('Escape').catch(() => { /* không mở thì thôi */ });
    }

    const so = await page.locator(`#${id}_DropDown li`).count().catch(() => -1);
    throw new Error(`[qemis] màn Chọn trường làm việc: không chọn được "${chu}" ở ô ${nhan} `
      + `sau 3 lượt mở danh sách và 2 lượt gõ lọc — danh sách có ${so} mục.`);
  };

  await chonOTrenMan(SEL_CHON_TRUONG.so, opts.so, 'Sở');
  await chonOTrenMan(SEL_CHON_TRUONG.capHoc, opts.capHoc, 'Cấp học');
  if (opts.phuongXa && isReal(opts.phuongXa)) {
    await chonOTrenMan(SEL_CHON_TRUONG.phuongXa, opts.phuongXa, 'Phường/Xã');
  }
  await chonOTrenMan(SEL_CHON_TRUONG.truong, opts.truong, "Trường");

  await page.locator(`#${SEL_CHON_TRUONG.luu}`).click({ timeout: 20000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);

  /* Nghiệm thu bằng thứ NGƯỜI DÙNG THẤY: tên đơn vị trên thanh tiêu đề. Tin vào "đã bấm Lưu" thì
   * mọi assertion sau đó có thể đang chạy trên đơn vị cũ mà không ai biết. */
  const tenTrenThanh = (await page.locator('#qi-name-truong').innerText().catch(() => '')).trim();
  // eslint-disable-next-line no-console
  console.log(`[qemis] đơn vị làm việc sau khi lưu: "${tenTrenThanh}" (yêu cầu: "${opts.truong}")`);
  return tenTrenThanh;
}

/**
 * Login CÓ TÁI SỬ DỤNG PHIÊN — đường mà mọi spec nên đi.
 *
 * Với QEMIS đây không còn là tối ưu tốc độ mà là ĐIỀU KIỆN CHẠY ĐƯỢC: captcha khiến mỗi lần login đều cần
 * người/agent, nên phiên tái dùng là thứ giữ cho suite chạy liền mạch.
 */
export async function loginOps(page: Page): Promise<void> {
  if (process.env.AUTH_REUSE === '0') { await loginOpsForm(page); return; }

  /*
   * Khoá phiên PHẢI gồm CẤP HỌC. Thiếu nó thì đổi `QEMIS_CAP_HOC` rồi chạy lại trong TTL là dùng lại
   * phiên của cấp cũ — đo 01/10/2026: lượt khai cấp THPT nhận về lưới Khối 6–9 của THCS, mọi assertion
   * vẫn xanh. Một phiên sai cấp không báo lỗi; nó chỉ lặng lẽ chấm case của cấp này bằng dữ liệu cấp kia.
   */
  const key = `${OPS_USER || 'qemis'}::${QEMIS_TRUONG || '-'}::${QEMIS_CAP_HOC || '-'}`;
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
