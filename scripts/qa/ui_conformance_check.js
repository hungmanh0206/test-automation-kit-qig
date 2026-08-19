#!/usr/bin/env node
/**
 * UI Conformance Checker (shared, dùng chung mọi task) — "visual oracle" tự động.
 *
 * Mục tiêu: bắt các lỗi hiển thị mà text-step automation hay miss — sai tên cột,
 * thiếu/thừa/sai thứ tự cột, sai format dữ liệu, sai empty-state/label, lệch token design.
 * Nguyên tắc: expected LẤY TỪ CATALOG (trích từ FS/Figma), so khớp CHÍNH XÁC (equality/regex/
 * đếm+thứ tự), KHÔNG "contains/tồn tại". Không so giá trị từ build với chính build (tautological).
 *
 * Cách chạy:
 *   TASK_ENV=profiles/<TASK>/task.env \
 *   node scripts/qa/ui_conformance_check.js --catalog <path/ui_catalog.json> [--out <dir>]
 *
 * Catalog JSON schema (rút gọn) — xem scripts/qa/README.md:
 * {
 *   "login": { "site": "ops"|"lms", "loginPath": "/auth/login",
 *              "userEnv": "OPS_USERNAME", "passEnv": "OPS_PASSWORD", "baseUrlEnv": "OPS_BASE_URL" },
 *   "screens": [{
 *     "name": "Attendance Resync Log Detail",
 *     "url": "/list-request/attendance/resync-log?...",        // tương đối base, hoặc absolute
 *     "preSteps": [{ "action":"click|fill|waitFor|goto|wait", "selector":"..", "value":".." }],
 *     "table": {
 *       "headerSelector": "table thead th",
 *       "rowSelector": "table tbody tr:not(.ant-table-measure-row)",
 *       "expectedColumns": ["#","User Name",...,"Check-in","Check-out",...],   // exact + thứ tự
 *       "formats": { "Check-in": "^\\d{2}:\\d{2}$", "Lesson date": "^\\d{2}/\\d{2}/\\d{4} .." }
 *     },
 *     "texts":  [{ "name":"empty-state", "selector":".ant-empty-description", "expected":"No data" }],
 *     "tokens": [{ "name":"Cancel btn", "selector":"button:has-text(\"Cancel\")",
 *                  "expected": { "color":"#99A1B7", "border-radius":"6px" }, "tol": { "colorPerChannel":8, "px":2 } }]
 *   }]
 * }
 */
const fs = require('fs');
const path = require('path');
require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const { chromium } = require('@playwright/test');
const { snapshotScreen } = require(path.resolve(__dirname, '..', 'utils', 'ui', 'screen_snapshot'));
const { attachEnvSignals } = require(path.resolve(__dirname, '..', 'utils', 'runtime', 'env_signals'));

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const IS_CLI = require.main === module;
const CATALOG = arg('catalog');
if (IS_CLI && (!CATALOG || !fs.existsSync(CATALOG))) { console.error(`ERROR: --catalog không tồn tại: ${CATALOG}`); process.exit(2); }
const catalog = CATALOG && fs.existsSync(CATALOG) ? JSON.parse(fs.readFileSync(CATALOG, 'utf8')) : { screens: [] };
const OUT = path.resolve(arg('out', path.join(path.dirname(CATALOG || '.'), '..', 'test-results', 'conformance')));
const SNAP_DIR = path.join(OUT, 'snapshots');
if (IS_CLI) { fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(SNAP_DIR, { recursive: true }); }

const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const key = (s) => norm(s).toLowerCase().replace(/\s*\/\s*/g, '/');
const hexToRgb = h => { const m = String(h).replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); return m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : null; };
const cssToRgb = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (m) return m[1].split(',').slice(0, 3).map(x => parseInt(x.trim(), 10)); return hexToRgb(c); };
const num = v => { const m = String(v).match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };

async function login(page, cfg) {
  if (!cfg) return;
  const base = (process.env[cfg.baseUrlEnv || 'OPS_BASE_URL'] || '').replace(/\/+$/, '');
  const userEnv = cfg.userEnv || 'OPS_USERNAME';
  const passEnv = cfg.passEnv || 'OPS_PASSWORD';
  const user = process.env[userEnv];
  const pass = process.env[passEnv];
  // CHẶN SỚM: thiếu creds thì mọi màn sau đều đọc được 0 cột / 0 field và báo cáo ra một rừng "thiếu hết" —
  // deviation GIẢ, y hệt kết quả của một app hỏng thật. Đã mắc bẫy này: 26 deviation giả chỉ vì `TASK_ENV`
  // không được truyền nên env rơi về `.env` không có creds. Báo cáo sai còn tệ hơn không có báo cáo.
  if (!String(user || '').trim() || !String(pass || '').trim()) {
    throw new Error(`Thiếu creds đăng nhập: ${userEnv}/${passEnv} rỗng. Truyền profile của task: TASK_ENV=profiles/<TASK_KEY>/task.env`);
  }
  if (!base) throw new Error(`Thiếu ${cfg.baseUrlEnv || 'OPS_BASE_URL'} — không biết đăng nhập vào đâu.`);
  await page.goto(base + (cfg.loginPath || '/auth/login'), { waitUntil: 'networkidle', timeout: 45000 });
  await page.fill(cfg.userSelector || 'input[name=username]', user);
  await page.fill(cfg.passSelector || 'input[name=password]', pass);
  await page.click(cfg.submitSelector || 'button:has-text("Sign In")');
  await page.waitForTimeout(cfg.waitAfter || 4500);
  // CHẶN SỚM (2): creds có nhưng bị sai/lockout/throttle thì vẫn đứng ở màn login. Không kiểm ở đây thì
  // toàn bộ report phía sau là rác mà vẫn trông như số liệu thật.
  const stillLogin = await page.locator(cfg.passSelector || 'input[name=password]').count().catch(() => 0);
  if (stillLogin) {
    throw new Error(`Đăng nhập KHÔNG thành công — vẫn ở màn login sau khi submit (URL: ${page.url()}). Nghi sai creds hoặc bị throttle/lockout; kiểm tra rồi chạy lại, ĐỪNG đọc report của lần này.`);
  }
}

async function runPreSteps(page, base, steps) {
  for (const s of steps || []) {
    if (s.action === 'goto') await page.goto((/^https?:/.test(s.value) ? s.value : base + s.value), { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
    else if (s.action === 'click') await page.locator(s.selector).first().click({ timeout: 8000 }).catch(() => {});
    else if (s.action === 'fill') await page.locator(s.selector).first().fill(s.value).catch(() => {});
    else if (s.action === 'selectOption') await page.locator(s.selector).first().selectOption(s.value).catch(() => {});
    else if (s.action === 'waitFor') await page.locator(s.selector).first().waitFor({ timeout: 8000 }).catch(() => {});
    else if (s.action === 'wait') await page.waitForTimeout(Number(s.value) || 1000);
    await page.waitForTimeout(400);
  }
}

/**
 * Chụp BỀ MẶT THẬT của màn: danh sách section (theo cấp tiêu đề) kèm tập nhãn của từng section.
 *
 * Vì sao cần: tên khối trong tài liệu thường KHÁC tên trên build (FSD "Thông tin trên Deal" ↔ OPS
 * "Deal Information"). Không có bề mặt thật thì bản đồ tên phải đoán bằng tay; có rồi thì ghép được bằng
 * ĐỘ TRÙNG TẬP NHÃN — dữ liệu chứ không phải cảm nhận. Đây cũng là đầu vào cho chiều ngược (build có field/khối
 * mà tài liệu không nhắc → hỏi BA).
 */
async function surfaceOf(page) {
  return page.evaluate(() => {
    const n = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const rankOf = (el) => {
      const st = getComputedStyle(el);
      const w = parseInt(st.fontWeight, 10) || 400;
      const sz = parseFloat(st.fontSize) || 0;
      return (w >= 600 && sz >= 15) ? w * 100 + Math.round(sz) : 0;
    };
    const out = [];
    let cur = null;
    for (const el of [...document.querySelectorAll('*')]) {
      if (!el.offsetParent) continue;
      if (el.children.length) {
        // hàng "nhãn → giá trị": gán cho section gần nhất phía trên (thứ tự tài liệu)
        const kids = [...el.children].filter((c) => !c.children.length);
        if (kids.length === 2 && n(kids[0].textContent) && cur) cur.labels.push(n(kids[0].textContent));
        continue;
      }
      const r = rankOf(el);
      if (r && n(el.textContent)) { cur = { heading: n(el.textContent), rank: r, labels: [] }; out.push(cur); }
    }
    // GIỮ cả section không có nhãn nào: khối cha chỉ là tiêu đề gộp vẫn CÓ THẬT trên màn, và cần nó để biết
    // cấp bậc (con/cha). Lọc bỏ ở đây từng làm mất khối cha khỏi bản đồ bề mặt.
    return out.map((x) => ({ heading: x.heading, rank: x.rank, labels: [...new Set(x.labels)] }));
  });
}

/**
 * So TẬP field đọc được từ build với tập trong tài liệu. Tách thành hàm vì có HAI đường đọc nhãn:
 * container thường, và DẢI ANH EM cho khối con layout phẳng — hai đường phải phán xét bằng CÙNG một luật.
 */
function compareFieldSet(dev, f, actual) {
    const exp = (f.expectedFields || []).map(norm);
  if (!exp.length) { dev.push({ type: 'fields.no-expected', name: f.name, note: 'catalog khai `fields` mà thiếu expectedFields' }); return; }
  // So khớp theo KHOÁ chuẩn hoá (hoa/thường + khoảng trắng quanh '/'), vì "Full Name" vs "Full name" hay
  // "Số CCCD/Hộ chiếu" vs "Số CCCD/ Hộ chiếu" mà tính là thiếu-VÀ-thừa thì mỗi lệch chữ sinh 2 dòng, nhấn
  // chìm tín hiệu thật (thiếu field, sai NGÔN NGỮ nhãn). Lệch chữ vẫn là deviation nhưng gom 1 dòng riêng.
  const key = (s) => norm(s).toLowerCase().replace(/\s*\/\s*/g, '/');
  const actKey = new Map(actual.map((a) => [key(a), a]));
  const expKey = new Map(exp.map((e) => [key(e), e]));
  const missing = exp.filter((x) => !actKey.has(key(x)));
  const extra = actual.filter((x) => !expKey.has(key(x)));
  const reworded = exp.filter((x) => actKey.has(key(x)) && actKey.get(key(x)) !== x)
    .map((x) => ({ tàiLiệu: x, build: actKey.get(key(x)) }));
  if (reworded.length) dev.push({ type: 'fields.label-text', name: f.name, pairs: reworded, note: 'nhãn khớp về nội dung nhưng lệch hoa/thường hoặc khoảng trắng so với tài liệu' });
  if (missing.length) dev.push({ type: 'fields.missing', name: f.name, expected: missing, detail: `build có: [${actual.join(' | ')}]` });
  // `optionalFields` = field tài liệu ghi rõ CHỈ hiện trong một số trường hợp: xuất hiện thì KHÔNG phải sai
  // lệch, mà vắng cũng không phải thiếu. Có danh sách này rồi thì không phải tắt cả phép bắt field THỪA.
  // Vì sao cần: backtest STT 42 (Order Detail Chuyển nhượng THỪA field "Địa chỉ") cho thấy `mode:'superset'`
  // — thứ buộc phải bật để né báo-thiếu-oan cho field điều kiện — đã âm thầm tắt đúng phép bắt được bug đó.
  // Một cờ thô che mất một lớp bug. `optionalFields` nêu ĐÍCH DANH nên chỉ miễn trừ đúng field đó.
  const optKey = new Set((f.optionalFields || []).map((x) => key(x)));
  const extraReal = extra.filter((x) => !optKey.has(key(x)));
  if (optKey.size) {
    const seen = extra.filter((x) => optKey.has(key(x)));
    if (seen.length) dev.push({ type: 'info.optional-present', name: f.name, actual: seen, note: 'field có điều kiện đang hiện — không tính là sai lệch' });
  }
  // mode 'superset' = chấp nhận màn có thêm field ngoài danh sách. Chỉ dùng khi KHÔNG thể liệt kê (vd nhãn
  // lặp động "Phí dịch vụ lần 1..N"), không dùng thay cho `optionalFields`.
  if (extraReal.length && f.mode !== 'superset') dev.push({ type: 'fields.extra', name: f.name, actual: extraReal, detail: 'field xuất hiện trên build nhưng KHÔNG có trong tài liệu' });
  if (f.ordered) {
    const seq = actual.filter((x) => exp.includes(x));
    const wrong = exp.filter((x, i) => seq[i] !== undefined && seq[i] !== x);
    if (wrong.length) dev.push({ type: 'fields.order', name: f.name, expected: exp, actual: seq });
  }
}

/**
 * Định vị container của một section theo TIÊU ĐỀ ĐANG HIỂN THỊ, rồi dán `data-uicheck` để chọn bằng CSS thuần.
 *
 * Vì sao cần: section trên nhiều màn được render bằng div không có class ổn định, nên catalog buộc phải khai
 * selector đoán-mò và vỡ ngay khi FE đổi class. Chọn theo text thì `:has-text()` chỉ là selector riêng của
 * Playwright — `document.querySelector` trong trang không hiểu — nên phải resolve trong trang rồi đánh dấu.
 *
 * Chọn tổ tiên nào: tổ tiên có NHIỀU HÀNG "nhãn→giá trị" nhất trong 6 cấp (hàng = phần tử con có đúng 2 con lá).
 * Lấy cả card thì dính luôn field của khối khác → báo thừa oan; lấy quá hẹp thì báo thiếu oan.
 * @returns {Promise<{ok: boolean, rows: number}>}
 */
async function stampSection(page, headingText, mark, containerSelector) {
  return page.evaluate(({ heading, m, csel }) => {
    const n = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const want = n(heading).replace(/[:*]\s*$/, '').toLowerCase();
    const leaves = [...document.querySelectorAll('*')].filter((el) => !el.children.length);
    // CẤP của một tiêu đề = (độ đậm, cỡ chữ). Một section KẾT THÚC ở nơi tiêu đề CÙNG CẤP HOẶC CAO HƠN tiếp
    // theo bắt đầu — đó là luật duy nhất phân biệt được khối con lồng trong khối. Đo thật trên OPS tab Hub Info:
    // "Data Synchronized from Hubspot" = w700/16px bọc hai khối con "Deal Information"/"Transfer Information" =
    // w600/16px. Không có luật này thì khối con hút hết field của cả tab (lượt 19/08: 6 field "thừa" oan).
    const rankOf = (el) => {
      const st = getComputedStyle(el);
      const w = parseInt(st.fontWeight, 10) || 400;
      const sz = parseFloat(st.fontSize) || 0;
      return (w >= 600 && sz >= 15) ? w * 100 + Math.round(sz) : 0;
    };
    const hasCompetingHeading = (box, h) => {
      const hr = rankOf(h);
      if (!hr) return false;
      return [...box.querySelectorAll('*')]
        .some((e) => e !== h && !e.children.length && n(e.textContent) && rankOf(e) >= hr);
    };
    const head = leaves.find((el) => n(el.textContent).replace(/[:*]\s*$/, '').toLowerCase() === want);
    if (!head) return { ok: false, rows: 0 };
    // (1) Ưu tiên GỢI Ý CỦA TASK: app có class bọc section ổn định thì dùng thẳng, chính xác hơn mọi heuristic.
    // Đo trên OPS: mỗi khối là `div.collapsible-section__container`. Quy ước DOM là của APP nên khai ở bindings
    // (lớp task); thuật toán ở đây vẫn generic.
    if (csel) {
      const box = head.closest(csel);
      // Selector của app chỉ bọc khối CẤP NGOÀI. Khối con lồng bên trong (đo thật: "Deal Information" nằm
      // trong "Data Synchronized from Hubspot") không có wrapper riêng ⇒ closest() leo lên khối cha và kiểm kê
      // ăn luôn field của cả tab: lượt chạy 19/08 sinh 6 field "thừa" oan. Chốt chặn: chỉ nhận box khi tiêu đề
      // đang tìm ĐÚNG LÀ tiêu đề đầu tiên của box; không thì rơi về heuristic hẹp hơn ở dưới.
      if (box && !hasCompetingHeading(box, head)) { box.setAttribute('data-uicheck', m); return { ok: true, rows: -1, via: 'selector' }; }
    }
    const rowCount = (el) => [...el.children].filter((c) => c.children.length === 2
      && [...c.children].every((g) => !g.children.length)).length;
    let node = head.parentElement;
    let best = null;
    let bestRows = 0;
    for (let k = 0; k < 6 && node; k += 1) {
      // Luật biên section áp cho CẢ heuristic hàng, không riêng fallback: khối đang xét mà đã chứa tiêu đề cùng
      // cấp khác thì nó là khối CHA của nhiều section ⇒ dừng. Thiếu chốt này chính là lý do khối con
      // "Deal Information" vẫn hút 12 nhãn của cả tab dù fallback đã có luật.
      if (hasCompetingHeading(node, head)) break;
      // hàng có thể nằm ở con trực tiếp, hoặc trong đúng 1 lớp bọc (card > box > hàng)
      const direct = rowCount(node);
      const nested = [...node.children].reduce((mx, c) => Math.max(mx, rowCount(c)), 0);
      if (direct > bestRows) { best = node; bestRows = direct; }
      if (nested > bestRows) {
        const box = [...node.children].find((c) => rowCount(c) === nested);
        if (box) { best = box; bestRows = nested; }
      }
      node = node.parentElement;
    }
    // (3) FALLBACK khi KHÔNG khối nào có "hàng 2 con lá": đo thật trên OPS thì khối `Transfer Source Package
    // Info` có rows=0 ở MỌI cấp (nhãn/giá trị lồng sâu hơn) ⇒ heuristic cũ trả no-container = BÁO OAN, trong
    // khi section có thật ngay trên màn. Fallback: leo tới tổ tiên CUỐI CÙNG trước khi số nhãn nhảy vọt (≥2×)
    // — mốc nhảy vọt đúng là lúc đã ôm luôn section bên cạnh (đo được: 13 → 13 → 52).
    if (!best) {
      const leafCount = (el) => [...el.querySelectorAll('*')].filter((e) => !e.children.length && n(e.textContent)).length;
      let cur = head.parentElement;
      let chosen = null;
      let prev = 0;
      for (let k = 0; k < 7 && cur; k += 1) {
        // Dừng NGAY khi khối đang xét đã chứa tiêu đề cùng cấp khác — nếu leo tiếp là ăn sang section bên cạnh.
        if (hasCompetingHeading(cur, head)) break;
        const c = leafCount(cur);
        if (prev >= 3 && c >= prev * 2) break;                  // mốc nhãn nhảy vọt: cũng là dấu ôm quá rộng
        if (c >= 3) { chosen = cur; prev = c; }
        cur = cur.parentElement;
      }
      if (chosen) { chosen.setAttribute('data-uicheck', m); return { ok: true, rows: -2, via: 'fallback-jump' }; }
    }
    // (4) LAYOUT PHẲNG: tiêu đề khối con và các hàng là ANH EM cùng cấp ⇒ KHÔNG tổ tiên nào là container của
    // riêng nó (mọi tổ tiên đều chứa luôn khối con kế bên). Đo thật: tab Hub Info của OPS có
    // "Deal Information"/"Transfer Information" nằm phẳng cạnh nhau ⇒ mọi bước trên đều trả no-container.
    // Cách đúng theo ĐÚNG định nghĩa section: lấy DẢI theo thứ tự tài liệu, từ tiêu đề này tới tiêu đề cùng cấp
    // kế tiếp, và đánh dấu từng hàng trong dải.
    {
      const hr = rankOf(head);
      let started = false;
      let tagged = 0;
      if (hr) {
        for (const el of [...document.querySelectorAll('*')]) {
          if (el === head) { started = true; continue; }
          if (!started || el.contains(head)) continue;
          if (!el.children.length && n(el.textContent) && rankOf(el) >= hr) break;   // sang section kế tiếp
          const kids = [...el.children].filter((c) => !c.children.length);
          if (kids.length === 2 && n(kids[0].textContent)) { el.setAttribute('data-uicheck-row', m); tagged += 1; }
        }
      }
      if (tagged) return { ok: true, rows: tagged, via: 'sibling-range' };
    }
    if (!best) return { ok: false, rows: 0 };
    best.setAttribute('data-uicheck', m);
    return { ok: true, rows: bestRows, via: 'rows' };
  }, { heading: headingText, m: mark, csel: containerSelector || null });
}

async function checkScreen(page, base, screen) {
  const dev = []; // deviations
  const scope = screen.scopeSelector ? page.locator(screen.scopeSelector).last() : page;
  // 1) TABLE: cột exact + thứ tự + số lượng
  if (screen.table) {
    const t = screen.table;
    const heads = (await (screen.scopeSelector ? scope.locator(t.headerSelector || 'thead th') : page.locator(t.headerSelector || 'table thead th')).allInnerTexts().catch(() => [])).map(norm).filter(x => x !== '');
    const exp = (t.expectedColumns || []).map(norm);
    if (exp.length) {
      if (heads.length !== exp.length) dev.push({ type: 'columns.count', expected: exp.length, actual: heads.length, detail: `build: [${heads.join(' | ')}]` });
      const maxi = Math.max(exp.length, heads.length);
      for (let i = 0; i < maxi; i++) {
        if (norm(exp[i]) !== norm(heads[i])) dev.push({ type: 'columns.title/order', pos: i + 1, expected: exp[i] || '(thiếu)', actual: heads[i] || '(thiếu)' });
      }
    }
    // 2) FORMAT theo cột
    if (t.formats) {
      const rowSel = t.rowSelector || 'table tbody tr:not(.ant-table-measure-row)';
      for (const [col, re] of Object.entries(t.formats)) {
        const idx = heads.findIndex(h => norm(h) === norm(col));
        if (idx < 0) { dev.push({ type: 'format.col-missing', column: col }); continue; }
        const cells = await (screen.scopeSelector ? scope : page).locator(`${rowSel} td:nth-child(${idx + 1})`).allInnerTexts().catch(() => []);
        const vals = cells.map(norm).filter(x => x && x !== '-');
        const rx = new RegExp(re);
        const bad = vals.find(v => !rx.test(v));
        if (vals.length && bad !== undefined) dev.push({ type: 'format.mismatch', column: col, expectedFormat: re, sampleBad: bad });
        else if (!vals.length) dev.push({ type: 'format.no-sample', column: col, note: 'không có dòng dữ liệu để kiểm format' });
      }
    }
  }
  // 2a-bis) SECTION LẠ: màn mọc thêm CẢ MỘT KHỐI thuộc loại đơn khác. Kiểm-kê-field không chạm tới lớp này —
  // các field của màn vẫn đủ và đúng, chỉ có thêm một section không thuộc màn. Backtest STT 54 (tab Hub Info
  // của đơn Chuyển nhượng hiện khối "Thông tin Deal trừ" của Chuyển đổi) lọt qua mọi phép cũ vì thế.
  // `forbiddenSections` do spec_extract sinh: section cùng tab nhưng thuộc loại đơn KHÁC ⇒ chỉ gồm tên có
  // trong tài liệu, không bịa tên.
  for (const name of screen.forbiddenSections || []) {
    const found = await page.evaluate((n) => [...document.querySelectorAll('*')]
      .some((e) => e.offsetParent && e.children.length === 0 && (e.textContent || '').trim() === n), name);
    if (found) dev.push({ type: 'sections.unexpected', name, detail: 'khối này KHÔNG có trong bảng field của màn đang mở (tài liệu xếp nó vào màn/loại đơn khác) — hoặc build mọc thêm khối, hoặc tài liệu thiếu' });
  }

  // 2b) FIELDS: kiểm kê TẬP field/nhãn của một section (thiếu / thừa / sai thứ tự).
  // Vì sao cần dù đã có `table` và `texts`: `table` chỉ phủ cột của bảng, `texts` chỉ kiểm TỪNG nhãn đã biết
  // trước — cả hai đều KHÔNG phát hiện được "section thiếu một trường" hay "màn mọc thêm một trường lạ",
  // vì không có gì liệt kê tập hợp. Đây đúng là lớp bug hay lọt: thiếu Net Price ở section thông tin sản phẩm,
  // thừa cột/field không thuộc màn, hai màn cùng dữ liệu nhưng danh sách field lệch nhau.
  for (const f of screen.fields || []) {
    let sel = f.containerSelector;
    if (f.headingText) {
      const mark = `sec-${(f.name || f.headingText).replace(/[^\w]+/g, '-').toLowerCase()}`;
      const st = await stampSection(page, f.headingText, mark, f.containerSelector || screen.sectionContainerSelector);
      if (!st.ok) { dev.push({ type: 'fields.no-container', name: f.name, selector: `headingText="${f.headingText}"` }); continue; }
      sel = st.via === 'sibling-range' ? `[data-uicheck-row="${mark}"]` : `[data-uicheck="${mark}"]`;
      if (st.via === 'sibling-range') {
        // Dải anh em: mỗi hàng là một element riêng nên KHÔNG có một root duy nhất để đọc; đọc nhãn từ chính
        // các hàng đã đánh dấu.
        const labels = await page.$$eval(sel, (els) => els.map((el) => {
          const kids = [...el.children].filter((c) => !c.children.length);
          return kids.length === 2 ? String(kids[0].textContent || '').replace(/\s+/g, ' ').trim() : '';
        }).filter(Boolean));
        const uniq = [...new Set(labels.map((x) => norm(x).replace(/[:*]\s*$/, '')))].filter(Boolean);
        dev.push({ type: 'info.loose-labels', name: f.name, note: `khối con layout phẳng; đọc ${uniq.length} nhãn theo DẢI anh em tới tiêu đề cùng cấp kế tiếp` });
        compareFieldSet(dev, f, uniq);
        continue;
      }
    }
    const root = (screen.scopeSelector ? scope : page).locator(sel).first();
    if (!(await root.count())) { dev.push({ type: 'fields.no-container', name: f.name, selector: sel }); continue; }
    let actual = (await root.locator(f.labelSelector || 'label').allInnerTexts().catch(() => []))
      .map((s) => norm(s).replace(/[:*]\s*$/, ''))          // bỏ dấu ':' và '*' bắt buộc ở cuối nhãn
      .filter((s) => s !== '');
    // Layout DIV: không có <label> nào ⇒ selector chặt trả về RỖNG và mọi field sẽ bị báo "thiếu" oan.
    // Rơi về nhãn suy theo cặp leaf-node liền kề (cùng cách screen_snapshot xử layout div) — chỉ khi
    // catalog KHÔNG tự khai labelSelector, để không âm thầm đè ý định của người viết catalog.
    if (!actual.length && !f.labelSelector) {
      actual = await root.evaluate((el) => {
        const n = (s) => String(s || '').replace(/\s+/g, ' ').trim();
        const out = [];
        // Quét SÂU, không chỉ con trực tiếp: khi container là card bọc (vd `.collapsible-section__container`
        // do task khai) thì hàng nhãn→giá trị nằm dưới vài lớp div. Bản đầu chỉ soi `el.children` nên trả 0
        // nhãn và mọi field bị báo THIẾU oan — tệ hơn cả `no-container` mà nó vừa chữa. Đo trên OPS: quét sâu
        // đọc đúng 6/6 nhãn khối Customer Info và 6/6 khối Transfer Source Package Info.
        for (const row of [el, ...el.querySelectorAll('*')]) {
          const kids = [...row.children].filter((g) => !g.children.length);
          if (kids.length === 2) out.push(n(kids[0].textContent).replace(/[:*]\s*$/, ''));
        }
        return [...new Set(out.filter(Boolean))];
      }).catch(() => []);
      // tiền tố `info.` = ghi chú quan sát, KHÔNG tính là deviation (xem chỗ tách ở dưới)
      if (actual.length) dev.push({ type: 'info.loose-labels', name: f.name, note: `section không có <label>; đọc ${actual.length} nhãn theo cặp leaf-node` });
    }
    compareFieldSet(dev, f, actual);
    // GIÁ TRỊ TRỐNG ở field mà tài liệu nói phải hiển thị. Lớp bug này (SAPP-28317: Checkout bỏ trống CCCD dù API
    // đã trả đủ) lọt qua mọi phép cũ: nhãn vẫn đủ nên kiểm-kê xanh, và không có giá trị nên so-2-bề-mặt cũng không
    // thấy gì. Ở đây chỉ NÊU (info) vì trống có thể do fixture chưa có dữ liệu — muốn kết luận bug thì phải đối
    // chiếu API (xsurf) để chứng minh "API có mà UI trống".
    if ((f.mustHaveValue || []).length) {
      const pairs = await root.evaluate((el) => {
        const n = (x) => String(x || '').replace(/\s+/g, ' ').trim();
        const out = {};
        for (const row of [el, ...el.querySelectorAll('*')]) {
          const kids = [...row.children].filter((c) => !c.children.length);
          if (kids.length === 2) { const k = n(kids[0].textContent); if (k && !(k in out)) out[k] = n(kids[1].textContent); }
        }
        return out;
      }).catch(() => ({}));
      const emptyish = (v) => ['', '-', '—', '–', 'N/A', 'null', 'undefined'].includes(String(v || '').trim());
      const blank = f.mustHaveValue.filter((lbl) => {
        const hit = Object.keys(pairs).find((k) => key(k) === key(lbl));
        return hit !== undefined && emptyish(pairs[hit]);
      });
      // Đo thật trên 4 màn: 3/3 finding đều là **fixture rỗng** (API cũng không có `dob`/`cccd`), không phải bug.
      // Nên để mức GHI CHÚ: một mình nó không kết luận được. Việc chứng minh thuộc phép so UI↔API (trục ②) —
      // `mustHaveValue` chính là danh sách field cần đưa vào `cross_surface.json`.
      if (blank.length) dev.push({ type: 'info.empty-value', name: f.name, actual: blank, detail: 'tài liệu ghi field hiển thị tự động (M/◎, không kèm điều kiện) mà build đang TRỐNG — cần đối chiếu API để phân biệt "fixture chưa có dữ liệu" với "API có mà UI không render" (lớp SAPP-28317)' });
    }
  }

  // 3) TEXTS: empty-state/label/placeholder exact
  for (const tx of screen.texts || []) {
    const el = (screen.scopeSelector ? scope : page).locator(tx.selector).first();
    const actual = (await el.count()) ? norm(await el.innerText().catch(() => '')) : '(không thấy element)';
    if (norm(tx.expected) !== actual) dev.push({ type: 'text.mismatch', name: tx.name, expected: tx.expected, actual });
  }
  // 4) TOKENS: computed-style so token (color/radius/size...) với dung sai
  for (const tk of screen.tokens || []) {
    const el = (screen.scopeSelector ? scope : page).locator(tk.selector).first();
    if (!(await el.count())) { dev.push({ type: 'token.no-element', name: tk.name, selector: tk.selector }); continue; }
    const props = Object.keys(tk.expected || {});
    const got = await el.evaluate((node, ps) => { const s = getComputedStyle(node); const o = {}; ps.forEach(p => o[p] = s.getPropertyValue(p)); return o; }, props).catch(() => ({}));
    for (const p of props) {
      const expV = tk.expected[p], gotV = got[p];
      if (/color/.test(p)) {
        const e = hexToRgb(expV) || cssToRgb(expV), g = cssToRgb(gotV);
        const tol = (tk.tol && tk.tol.colorPerChannel) || 8;
        const ok = e && g && e.every((c, i) => Math.abs(c - g[i]) <= tol);
        if (!ok) dev.push({ type: 'token.color', name: tk.name, prop: p, expected: expV, actual: gotV });
      } else {
        const e = num(expV), g = num(gotV), tol = (tk.tol && tk.tol.px) || 2;
        if (!(Number.isFinite(e) && Number.isFinite(g) && Math.abs(e - g) <= tol)) dev.push({ type: 'token.size', name: tk.name, prop: p, expected: expV, actual: gotV });
      }
    }
  }
  return dev;
}

if (IS_CLI) (async () => {
  const loginCfg = catalog.login || { site: 'ops' };
  const base = (process.env[(loginCfg.baseUrlEnv) || 'OPS_BASE_URL'] || '').replace(/\/+$/, '');
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 950 } })).newPage();
  page.setDefaultTimeout(10000);
  const report = { catalog: CATALOG, screens: [], totalDeviations: 0 };
  const surface = {};
  let fatal = null;
  // Tín hiệu môi trường: trang đã mở rồi, nghe thêm không tốn lượt tải nào. Bắt được cả bug KHÔNG liên quan tới
  // màn đang kiểm (UI xanh mà một API phụ đang 500) — thứ không case nào assert.
  const sig = attachEnvSignals(page);
  try {
    await login(page, loginCfg);
    for (const screen of catalog.screens || []) {
      if (screen.url) await page.goto(/^https?:/.test(screen.url) ? screen.url : base + screen.url, { waitUntil: 'networkidle', timeout: 40000 }).catch(() => {});
      await runPreSteps(page, base, screen.preSteps);
      await page.waitForTimeout(screen.settle || 3000);
      const shot = path.join(OUT, `${screen.name.replace(/[^A-Za-z0-9]+/g, '_')}.png`);
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      const all = await checkScreen(page, base, screen);
      // `info.*` là ghi chú cách đo (vd section không có <label> nên đọc nhãn kiểu lỏng) — hữu ích để đọc lại
      // báo cáo, nhưng KHÔNG được tính thành deviation, nếu không gate sẽ đỏ vì cách render của FE.
      const dev = all.filter((d) => !String(d.type).startsWith('info.'));
      const infos = all.filter((d) => String(d.type).startsWith('info.'));
      // SNAPSHOT bề mặt màn: ghi lại "màn đang có gì" thành dữ liệu, kể cả phần catalog CHƯA khai.
      // Nhờ đó lần sau viết catalog là việc DIFF chứ không phải việc nhớ, và thứ có trên màn mà tài liệu
      // không nói vẫn để lại dấu vết thay vì biến mất. Snapshot KHÔNG phải oracle — chỉ là quan sát.
      let snap = null;
      try {
        snap = await snapshotScreen(page, { scopeSelector: screen.scopeSelector || 'body' });
        fs.writeFileSync(path.join(SNAP_DIR, `${screen.name.replace(/[^A-Za-z0-9]+/g, '_')}.json`), JSON.stringify(snap, null, 2), 'utf8');
        if (snap.mixedCurrency) dev.push({ type: 'currency.mixed', detail: `màn trộn ${Object.keys(snap.currencies).join(' + ')} — kiểm đơn vị tiền từng field` });
      } catch (e) { console.warn(`   ! snapshot lỗi: ${e.message.slice(0, 120)}`); }
      // BỀ MẶT theo SECTION (khác snapshot: snapshot là danh sách nhãn phẳng). Đây là đầu vào để ghép bản đồ
      // tên tài liệu ↔ tên build bằng độ trùng tập nhãn, thay vì đoán.
      try { surface[screen.name] = await surfaceOf(page); } catch (e) { console.warn(`   ! surface lỗi: ${e.message.slice(0, 100)}`); }
      // Chốt tín hiệu môi trường của MÀN này rồi reset ngưỡng cho màn sau
      const envNow = sig.report();
      if (envNow.pageErrors.length) dev.push({ type: 'env.pageerror', detail: `JS exception trong lúc mở màn: ${envNow.pageErrors.map((e) => e.message).slice(0, 3).join(' | ')}`, note: 'zero-tolerance: có exception là finding, dù kiểm kê field vẫn đúng' });
      if (envNow.httpErrors.length) dev.push({ type: 'env.http-error', detail: envNow.httpErrors.slice(0, 4).map((e) => `HTTP ${e.status} ${e.method} ${e.url}`).join(' | '), note: 'request lỗi chạy nền — UI có thể vẫn xanh' });
      // `info.*` phải vào `infos`, KHÔNG vào `dev` — chỗ tách hai mảng nằm PHÍA TRÊN, nên push vào `dev` là
      // âm thầm biến ghi chú thành deviation (đã xảy ra: 17 → 21 ngay lượt cắm đầu). console.error hay là
      // ERR_CERT của môi trường/tracking, chưa đủ để gọi là lỗi sản phẩm.
      if (envNow.consoleErrors.length) infos.push({ type: 'info.console-error', detail: envNow.consoleErrors.slice(0, 4).map((e) => e.text).join(' | ') });
      report.screens.push({
        name: screen.name,
        envSignals: { pageErrors: envNow.pageErrors.length, consoleErrors: envNow.consoleErrors.length, httpErrors: envNow.httpErrors.length },
        screenshot: path.relative(OUT, shot),
        snapshot: snap ? path.relative(OUT, path.join(SNAP_DIR, `${screen.name.replace(/[^A-Za-z0-9]+/g, '_')}.json`)) : null,
        observed: snap ? { labels: snap.labels.length, columns: ((snap.tables || [])[0] || {}).headers || [], currencies: snap.currencies } : null,
        deviations: dev,
        notes: infos,
      });
      report.totalDeviations += dev.length;
      console.log(`\n=== ${screen.name} === ${dev.length ? dev.length + ' DEVIATION' : 'OK'}${infos.length ? ` (+${infos.length} ghi chú)` : ''}`);
      dev.forEach(d => console.log('   -', JSON.stringify(d)));
      infos.forEach(d => console.log('   ·', JSON.stringify(d)));
    }
    fs.writeFileSync(path.join(OUT, 'surface.json'), `${JSON.stringify(surface, null, 2)}
`, 'utf8');
  } catch (e) { fatal = e.message.slice(0, 300); console.error('FATAL', fatal); }
  finally { await browser.close(); }

  // ghi report md + json
  fs.writeFileSync(path.join(OUT, 'conformance_report.json'), JSON.stringify(report, null, 2), 'utf8');
  const md = ['# UI Conformance Report', '', `Catalog: \`${CATALOG}\` — Tổng deviation: **${report.totalDeviations}**`, ''];
  for (const s of report.screens) {
    md.push(`## ${s.name} — ${s.deviations.length ? '❌ ' + s.deviations.length + ' deviation' : '✅ khớp'}`);
    md.push(`Ảnh: \`${s.screenshot}\``, '');
    if (s.deviations.length) { md.push('| Loại | Chi tiết |', '|---|---|'); s.deviations.forEach(d => { const { type, ...rest } = d; md.push(`| ${type} | ${JSON.stringify(rest)} |`); }); md.push(''); }
    if ((s.notes || []).length) { md.push('<sub>Ghi chú cách đo (không tính deviation): ' + s.notes.map(n => n.note || n.type).join(' · ') + '</sub>', ''); }
  }
  fs.writeFileSync(path.join(OUT, 'conformance_report.md'), md.join('\n'), 'utf8');
  console.log(`\nReport: ${path.join(OUT, 'conformance_report.md')} | Tổng deviation: ${report.totalDeviations}`);
  // exit 2 = KHÔNG ĐO ĐƯỢC (khác hẳn exit 0 = đo xong và khớp). Trước đây fatal vẫn exit 0 khi chưa kịp
  // đo màn nào ⇒ "0 deviation" trông như PASS. "Không phán được" không bao giờ được thành PASS.
  if (fatal) { console.error(`\n✗ KHÔNG ĐO ĐƯỢC — ${fatal}`); process.exit(2); }
  process.exit(report.totalDeviations > 0 ? 1 : 0);
})();

module.exports = { checkScreen, stampSection, surfaceOf, compareFieldSet, login };
