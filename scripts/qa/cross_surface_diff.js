#!/usr/bin/env node
/**
 * cross_surface_diff.js — TRỤC 2: **cùng một giá trị, khác nơi hiển thị**.
 *
 * VÌ SAO CÓ FILE NÀY: đây là trục RÒ NHIỀU NHẤT — đo trên SAPP-24395 có **21/69 bug** thuộc lớp này, và không
 * phép kiểm nào của kit chạm tới, vì mỗi màn xét riêng đều "đúng":
 *   - SAPP-28521: tab Hubspot Information hiện D.O.B thô `2001-05-20`, tab Overview hiện `20/05/2001`.
 *   - SAPP-28405: Extension Course Package khác nhau giữa màn Create/Edit và màn Order Detail.
 *   - SAPP-28446: màn Checkout rút gọn + sai chính tả tên khoá học so với Ops.
 * Chỉ khi ĐẶT CẠNH NHAU thì lệch mới hiện ra. Và phải tách hai lớp: **khác GIÁ TRỊ** (nghiêm trọng: lấy sai
 * nguồn/sai field) vs **khác ĐỊNH DẠNG** (cùng giá trị, format khác — vẫn là bug hiển thị, nhưng khác nguyên nhân).
 *
 * Đọc giá trị ở 3 loại bề mặt: `label` (khối nhãn→giá trị trên màn detail/tab), `column`+`rowMatch` (một dòng
 * trong lưới), `api`+`jsonPath` (nguồn sự thật của BE). Read-only: chỉ điều hướng và đọc.
 *
 * Dùng:
 *   TASK_ENV=profiles/<TASK>/task.env \
 *   node scripts/qa/cross_surface_diff.js --config <cross_surface.json> [--out <report.md>] [--enforce]
 *
 * config = { "login": {"site":"ops"}, "checks": [{
 *   "name": "Service Fee của order X",
 *   "surfaces": [
 *     { "screen": "Order Detail / Overview", "url": "/…/detail/overview", "label": "Service Fee" },
 *     { "screen": "Hub Info",  "url": "/…/detail/hubspot-information", "label": "Service fee" },
 *     { "screen": "Order List", "url": "/…?page_index=1", "column": "Service Fee",
 *       "rowMatch": { "column": "Deal ID", "value": "64095623819" } },
 *     { "screen": "API", "api": "/api/v1/service-fee-orders/<id>", "jsonPath": "data.service_fee" }
 *   ] }] }
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const { chromium } = require('@playwright/test');
const { login } = require(path.resolve(__dirname, 'ui_conformance_check.js'));
const { attachEnvSignals } = require(path.resolve(__dirname, '..', 'utils', 'runtime', 'env_signals'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const ENFORCE = process.argv.includes('--enforce');

function loadConfig() {
  const cfgPath = arg('config');
  if (!cfgPath || !fs.existsSync(cfgPath)) { console.error(`[xsurf] ✗ thiếu --config: ${cfgPath || '(không truyền)'}`); process.exit(2); }
  return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
}

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
/** Rút "hạt nhân" của giá trị để phân biệt khác-giá-trị với khác-định-dạng. */
function core(v) {
  const s = norm(v);
  if (!s) return { kind: 'empty', v: '' };
  const money = s.replace(/[₫đ$€\s]/g, '').replace(/[.,](?=\d{3}\b)/g, '');
  if (/^-?\d+([.,]\d+)?$/.test(money)) return { kind: 'num', v: String(parseFloat(money.replace(',', '.'))) };
  // ngày: dd/mm/yyyy · yyyy-mm-dd · dd-mm-yyyy → chuẩn hoá về yyyymmdd
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { kind: 'date', v: m[1] + m[2] + m[3] };
  m = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (m) return { kind: 'date', v: m[3] + m[2] + m[1] };
  return { kind: 'text', v: s.toLowerCase() };
}

/**
 * Giá trị có ĐỌC ĐƯỢC không. `"(không thấy nhãn…)"`, ô trống, và `undefined`/`null` do API trả KHÔNG phải giá
 * trị — so hai ô trống rồi kết luận "khớp" là kiểu im-lặng-thành-đạt mà bộ gate này sinh ra để chống.
 */
const isReadable = (v) => !/^\(/.test(String(v)) && !['', '-', '—', '–', 'n/a', 'undefined', 'null'].includes(norm(v).toLowerCase());

/** Đọc mọi cặp nhãn→giá trị trên màn (quét sâu, cùng cách ui_conformance_check đọc layout div). */
async function pairsOf(page) {
  return page.evaluate(() => {
    const n = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const out = {};
    for (const el of [...document.querySelectorAll('*')]) {
      if (!el.offsetParent || el.children.length !== 2) continue;
      const kids = [...el.children];
      if (!kids.every((k) => !k.children.length)) continue;
      const label = n(kids[0].textContent);
      const value = n(kids[1].textContent);
      if (label && !(label in out)) out[label] = value;
    }
    return out;
  });
}

async function readSurface(page, base, s, token) {
  if (s.api) {
    const val = await page.evaluate(async ([api, tok, jp]) => {
      const r = await fetch(api, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} });
      if (!r.ok) return `(HTTP ${r.status})`;
      const j = await r.json();
      return String(jp.split('.').reduce((o, k) => (o == null ? o : o[k]), j));
    }, [/^https?:/.test(s.api) ? s.api : (process.env.OPS_API_BASE_URL || '').replace(/\/+$/, '') + s.api, token, s.jsonPath || 'data']);
    return { value: val, how: `API ${s.jsonPath}` };
  }
  await page.goto(/^https?:/.test(s.url) ? s.url : base + s.url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(s.settle || 6000);
  if (s.column) {
    const val = await page.evaluate(([colName, rm]) => {
      const n = (x) => String(x || '').replace(/\s+/g, ' ').trim();
      const heads = [...document.querySelectorAll('table thead th')].map((th) => n(th.textContent));
      const ci = heads.findIndex((h) => h.toLowerCase() === String(colName).toLowerCase());
      if (ci < 0) return `(không có cột "${colName}")`;
      const rows = [...document.querySelectorAll('table tbody tr')];
      let row = rows[0];
      if (rm) {
        const mi = heads.findIndex((h) => h.toLowerCase() === String(rm.column).toLowerCase());
        row = rows.find((r) => n(r.children[mi] ? r.children[mi].textContent : '') === n(rm.value));
      }
      if (!row) return '(không thấy dòng khớp rowMatch)';
      return n(row.children[ci] ? row.children[ci].textContent : '');
    }, [s.column, s.rowMatch || null]);
    return { value: val, how: `lưới · cột "${s.column}"` };
  }
  const pairs = await pairsOf(page);
  const hit = Object.keys(pairs).find((k) => k.toLowerCase() === String(s.label).toLowerCase())
    || Object.keys(pairs).find((k) => k.toLowerCase().replace(/\s+/g, '') === String(s.label).toLowerCase().replace(/\s+/g, ''));
  return { value: hit ? pairs[hit] : `(không thấy nhãn "${s.label}")`, how: `nhãn "${hit || s.label}"` };
}

async function main() {
  const cfg = loadConfig();
  const base = (process.env.OPS_BASE_URL || '').replace(/\/+$/, '');
  const ctx = await chromium.launchPersistentContext('', { headless: true, viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const results = [];
  try {
    const sig = attachEnvSignals(page);         // miễn phí: trang đã mở, chỉ nghe thêm
    await login(page, cfg.login || { site: 'ops' });
    const token = await page.evaluate(() => localStorage.getItem('actToken') || null);
    for (const chk of cfg.checks || []) {
      const obs = [];
      for (const s of chk.surfaces || []) {
        // eslint-disable-next-line no-await-in-loop
        const r = await readSurface(page, base, s, token);
        // ĐỌC ĐƯỢC hay không phải nói rõ: "(không thấy nhãn…)" và ô trống ("-", "—") KHÔNG phải giá trị.
        // So hai ô trống rồi kết luận "khớp" chính là kiểu im-lặng-thành-đạt mà bộ gate này sinh ra để chống.
        const readable = isReadable(r.value);
        obs.push({ screen: s.screen || s.url || s.api, isApi: !!s.api, readable, ...r, core: core(r.value) });
      }
      const unreadable = obs.filter((o) => !o.readable);
      const vals = obs.filter((o) => o.readable);
      const cores = [...new Set(vals.map((o) => o.core.v))];
      // So ĐỊNH DẠNG chỉ giữa các bề mặt UI: API trả số thô (`600000`) còn UI format tiền (`600.000đ`) là
      // KHÁC NHAU ĐÚNG THIẾT KẾ. Bản đầu so cả API nên báo oan ngay lượt chạy đầu.
      const uiRaws = [...new Set(vals.filter((o) => !o.isApi).map((o) => norm(o.value)))];
      results.push({
        name: chk.name,
        obs,
        unreadable,
        // Dưới 2 bề mặt đọc được thì KHÔNG kết luận gì — không ✓, không ✗.
        inconclusive: vals.length < 2,
        valueMismatch: vals.length >= 2 && cores.length > 1,
        formatMismatch: vals.length >= 2 && cores.length === 1 && uiRaws.length > 1,
      });
    }
    const env = sig.report();
    if (!env.clean) {
      console.log(`[xsurf] ⚠ tín hiệu môi trường trong lượt này: ${env.pageErrors.length} JS exception · ${env.httpErrors.length} HTTP 4xx/5xx · ${env.consoleErrors.length} console.error · ${env.contractViolations.length} lệch contract`);
      for (const e of env.pageErrors.slice(0, 3)) console.log(`[xsurf]   ✗ JS exception: ${e.message}`);
      for (const e of env.httpErrors.slice(0, 5)) console.log(`[xsurf]   ✗ HTTP ${e.status} ${e.method} ${e.url}`);
    }
  } catch (e) { console.error('[xsurf] FATAL', e.message.slice(0, 200)); process.exitCode = 2; }
  await ctx.close();

  const bad = results.filter((r) => r.valueMismatch);
  const fmt = results.filter((r) => r.formatMismatch);
  const inc = results.filter((r) => r.inconclusive);
  const unread = results.filter((r) => r.unreadable.length);
  console.log(`[xsurf] ${results.length} giá trị × nhiều bề mặt · ${bad.length} khác GIÁ TRỊ · ${fmt.length} khác ĐỊNH DẠNG · ${inc.length} CHƯA KIỂM ĐƯỢC · ${unread.length} có bề mặt đọc không ra`);
  for (const r of results) {
    const tag = r.inconclusive ? '◻ CHƯA KIỂM ĐƯỢC (dưới 2 bề mặt đọc được)'
      : r.valueMismatch ? '✗ KHÁC GIÁ TRỊ' : r.formatMismatch ? '⚠ KHÁC ĐỊNH DẠNG' : '✓ khớp';
    console.log(`[xsurf] ${tag} · ${r.name}`);
    for (const o of r.obs) console.log(`[xsurf]     ${o.screen}: "${o.value}"   (${o.how})`);
  }

  // FINDING có cấu trúc + luật oracle: lệch giá trị ⇒ EXPANSION_FINDING (app tự mâu thuẫn — chắc chắn một nơi
  // sai, không cần oracle ngoài) · khớp mà KHÔNG có `oracle_ref` trong config ⇒ OBSERVATION, KHÔNG phải PASS.
  const taskDir = arg('task-dir');
  if (taskDir) {
    const fnd = require(path.resolve(__dirname, '..', 'lib', 'expansion', 'finding'));
    const items = [];
    for (const r of results) {
      const src = (cfg.checks || []).find((c) => c.name === r.name) || {};
      const readable = r.obs.filter((o) => o.readable);
      if (r.valueMismatch || r.formatMismatch) {
        items.push(fnd.makeFinding({
          axis: 'surface', base_tc: src.base_tc, self_inconsistent: true,
          surface: readable.map((o) => o.screen).join(' vs '),
          expected: readable[0] && readable[0].value, actual: readable.slice(1).map((o) => o.value).join(' / '),
          oracle_ref: src.oracle_ref,
        }));
      } else if (!r.inconclusive) {
        items.push(fnd.makeFinding({
          axis: 'surface', base_tc: src.base_tc, surface: readable.map((o) => o.screen).join(' = '),
          expected: src.expected !== undefined ? src.expected : (readable[0] && readable[0].value),
          actual: readable[0] && readable[0].value, oracle_ref: src.oracle_ref,
          open_question: src.oracle_ref ? undefined : `${readable.length} bề mặt hiển thị giống nhau, nhưng chưa có rule nào nói giá trị ĐÚNG là gì — giống nhau vẫn có thể sai cùng nhau.`,
        }));
      }
    }
    if (items.length) {
      const w = fnd.writeFindings(taskDir, items, { append: true });
      console.log(`[xsurf] finding: EXPANSION_FINDING ${w.summary.EXPANSION_FINDING} · PASS ${w.summary.PASS} · FAIL ${w.summary.FAIL} · OBSERVATION ${w.summary.OBSERVATION}`);
      for (const v of w.violations) console.log(`[xsurf] ✗ ${v}`);
    }
  }

  const out = arg('out');
  if (out) {
    const L = [`<!-- gate: proven=${results.length - inc.length} inconclusive=${inc.length} broken=${bad.length} -->`,
      '# Cùng một giá trị, khác nơi hiển thị (trục 2)', '',
      '> Sinh bởi `scripts/qa/cross_surface_diff.js`. Tách hai lớp: **khác GIÁ TRỊ** (nghi lấy sai nguồn/sai field)',
      '> và **khác ĐỊNH DẠNG** (cùng giá trị, hiển thị khác — vẫn là lỗi hiển thị nhưng nguyên nhân khác).',
      '> Bề mặt đọc không được ghi rõ là **chưa kiểm**, không phải "khớp".', '',
      `- Giá trị đối chiếu: **${results.length}** · khác giá trị: **${bad.length}** · khác định dạng: **${fmt.length}** · chưa đọc được: **${unread.length}**`, '',
      '| Giá trị | Kết luận | Bề mặt | Đọc được | Cách đọc |', '|---|---|---|---|---|'];
    for (const r of results) {
      const tag = r.inconclusive ? '◻ chưa kiểm được' : r.valueMismatch ? '✗ khác GIÁ TRỊ' : r.formatMismatch ? '⚠ khác ĐỊNH DẠNG' : '✓ khớp';
      for (const o of r.obs) L.push(`| ${r.name} | ${tag} | ${o.screen} | \`${o.value}\` | ${o.how} |`);
    }
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, `${L.join('\n')}\n`);
    console.log(`[xsurf] báo cáo: ${out}`);
  }
  if (ENFORCE && bad.length) process.exit(1);
}

// Bọc bằng `require.main`: thiếu chốt này thì chỉ cần `require()` file (vd trong test) là CLI chạy và tự
// `process.exit(2)` vì không có --config — test chết mà nhìn như lỗi test.
if (require.main === module) main();

module.exports = { core, isReadable, norm };
