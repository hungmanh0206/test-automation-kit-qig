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
async function stampSection(page, headingText, mark) {
  return page.evaluate(({ heading, m }) => {
    const n = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const want = n(heading).replace(/[:*]\s*$/, '').toLowerCase();
    const leaves = [...document.querySelectorAll('*')].filter((el) => !el.children.length);
    const head = leaves.find((el) => n(el.textContent).replace(/[:*]\s*$/, '').toLowerCase() === want);
    if (!head) return { ok: false, rows: 0 };
    const rowCount = (el) => [...el.children].filter((c) => c.children.length === 2
      && [...c.children].every((g) => !g.children.length)).length;
    let node = head.parentElement;
    let best = null;
    let bestRows = 0;
    for (let k = 0; k < 6 && node; k += 1) {
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
    if (!best) return { ok: false, rows: 0 };
    best.setAttribute('data-uicheck', m);
    return { ok: true, rows: bestRows };
  }, { heading: headingText, m: mark });
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
  // 2b) FIELDS: kiểm kê TẬP field/nhãn của một section (thiếu / thừa / sai thứ tự).
  // Vì sao cần dù đã có `table` và `texts`: `table` chỉ phủ cột của bảng, `texts` chỉ kiểm TỪNG nhãn đã biết
  // trước — cả hai đều KHÔNG phát hiện được "section thiếu một trường" hay "màn mọc thêm một trường lạ",
  // vì không có gì liệt kê tập hợp. Đây đúng là lớp bug hay lọt: thiếu Net Price ở section thông tin sản phẩm,
  // thừa cột/field không thuộc màn, hai màn cùng dữ liệu nhưng danh sách field lệch nhau.
  for (const f of screen.fields || []) {
    let sel = f.containerSelector;
    if (f.headingText) {
      const mark = `sec-${(f.name || f.headingText).replace(/[^\w]+/g, '-').toLowerCase()}`;
      const st = await stampSection(page, f.headingText, mark);
      if (!st.ok) { dev.push({ type: 'fields.no-container', name: f.name, selector: `headingText="${f.headingText}"` }); continue; }
      sel = `[data-uicheck="${mark}"]`;
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
        [...el.children].forEach((row) => {
          const kids = [...row.children].filter((g) => !g.children.length);
          if (kids.length === 2) out.push(n(kids[0].textContent).replace(/[:*]\s*$/, ''));
        });
        return out.filter(Boolean);
      }).catch(() => []);
      // tiền tố `info.` = ghi chú quan sát, KHÔNG tính là deviation (xem chỗ tách ở dưới)
      if (actual.length) dev.push({ type: 'info.loose-labels', name: f.name, note: `section không có <label>; đọc ${actual.length} nhãn theo cặp leaf-node` });
    }
    const exp = (f.expectedFields || []).map(norm);
    if (!exp.length) { dev.push({ type: 'fields.no-expected', name: f.name, note: 'catalog khai `fields` mà thiếu expectedFields' }); continue; }
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
    // mode 'superset' = chấp nhận màn có thêm field ngoài danh sách (dùng khi catalog mới trích một phần).
    if (extra.length && f.mode !== 'superset') dev.push({ type: 'fields.extra', name: f.name, actual: extra, detail: 'field xuất hiện trên build nhưng KHÔNG có trong tài liệu' });
    if (f.ordered) {
      const seq = actual.filter((x) => exp.includes(x));
      const wrong = exp.filter((x, i) => seq[i] !== undefined && seq[i] !== x);
      if (wrong.length) dev.push({ type: 'fields.order', name: f.name, expected: exp, actual: seq });
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
  let fatal = null;
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
      report.screens.push({
        name: screen.name,
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

module.exports = { checkScreen };
