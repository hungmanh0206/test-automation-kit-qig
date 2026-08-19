/**
 * visual.js — KỶ LUẬT CHỤP TẤT ĐỊNH cho visual regression.
 *
 * VÌ SAO KHÔNG TÁI DÙNG ẢNH EVIDENCE: kit đã chụp ~1000 ảnh mỗi task, nhưng chúng **không dùng làm baseline được** —
 * full-page, dữ liệu động (mã đơn, thời gian, số tiền theo fixture), và mask PII bằng cách **sửa DOM** trước khi
 * chụp. Mỗi lần chạy ra một ảnh khác ⇒ diff luôn khác 0 ⇒ hoặc bỏ qua hết, hoặc đỏ liên tục. Baseline cần **bộ chụp
 * riêng, tất định**.
 *
 * GIỚI HẠN PHẢI NÓI TRƯỚC: oracle của visual regression là "**bản build đã được chấp nhận lần trước**". Nó bắt
 * **regression** (đang đúng rồi bị làm sai) — **KHÔNG** bắt được cái sai từ đầu. Vì vậy nó bổ trợ, không thay được
 * contract FE (`knowledge/system/UI-*`) và không thay assert hình học.
 *
 * Bốn nguồn bất định phải triệt (nếu không thì diff là nhiễu, không phải tín hiệu):
 *   1. **Animation/transition** → `animations: 'disabled'` + tắt CSS animation.
 *   2. **Caret nhấp nháy** trong input → `caret: 'hide'`.
 *   3. **Dữ liệu động** (mã đơn, ngày, số tiền theo fixture, avatar) → `mask` các vùng đó (khai ở lớp task).
 *   4. **Viewport/scrollbar/font** → viewport cố định, chỉ chụp vùng ổn định, chờ `networkidle` + settle.
 */

/** CSS triệt animation/transition/caret — inject trước khi chụp. */
const FREEZE_CSS = `*, *::before, *::after {
  animation-duration: 0s !important; animation-delay: 0s !important;
  transition-duration: 0s !important; transition-delay: 0s !important;
  caret-color: transparent !important;
}
*::-webkit-scrollbar { display: none !important; }`;

/**
 * Đưa trang về trạng thái tất định. Trả về danh sách việc đã làm để ghi vào báo cáo (minh bạch: người đọc biết
 * ảnh đã bị can thiệp những gì).
 */
async function freeze(page, { settle = 1200 } = {}) {
  const done = [];
  await page.addStyleTag({ content: FREEZE_CSS }).catch(() => {});
  done.push('tắt animation/transition/caret/scrollbar');
  // Ảnh lazy-load: kéo hết trang rồi về đầu, nếu không thì lần chụp đầu thiếu ảnh, lần sau có ⇒ diff giả.
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += Math.max(200, window.innerHeight - 100)) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
  }).catch(() => {});
  done.push('kéo hết trang để lazy-load xong rồi về đầu');
  await page.waitForTimeout(settle);
  done.push(`settle ${settle}ms`);
  return done;
}

/**
 * Dựng options cho `toHaveScreenshot`. `maskSelectors` là **lớp task** (mỗi màn có vùng động riêng) — script không
 * tự đoán, vì mask sai chỗ sẽ che luôn phần cần kiểm.
 */
function captureOptions(page, maskSelectors = [], opts = {}) {
  return {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
    fullPage: opts.fullPage === true,             // mặc định KHÔNG full-page: càng dài càng dễ nhiễu
    mask: (maskSelectors || []).map((s) => page.locator(s)),
    maxDiffPixelRatio: opts.maxDiffPixelRatio === undefined ? 0.01 : opts.maxDiffPixelRatio,
    timeout: opts.timeout || 20000,
  };
}

/**
 * Đọc cấu hình mục tiêu visual của task. KHÔNG có file ⇒ trả `null` để lane báo **CHƯA ĐO ĐƯỢC**, tuyệt đối không
 * coi là pass (0 màn mà xanh là kiểu false-green đã bị cấm ở nhiều gate khác của kit).
 */
function loadTargets(fs, path, taskDir) {
  const p = path.join(taskDir, 'requirements', 'visual_targets.json');
  if (!fs.existsSync(p)) return null;
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  const screens = Array.isArray(cfg.screens) ? cfg.screens.filter((s) => s && s.name && s.url) : [];
  return { file: p, login: cfg.login || { site: 'ops' }, screens, invalid: (cfg.screens || []).length - screens.length };
}

module.exports = { FREEZE_CSS, freeze, captureOptions, loadTargets };
