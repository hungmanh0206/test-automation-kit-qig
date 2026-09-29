#!/usr/bin/env node
/**
 * fixture_matrix.js — TRỤC 4 + 5: **nhánh/biến thể** × **trạng thái kế cận** (42/69 bug của CSDL-24395).
 *
 * VÌ SAO CÓ FILE NÀY: hai trục rò nhiều nhất sau trục 2, và lý do rò thì rất tầm thường — **không có dữ liệu để
 * thử**. Case viết ra cho "đơn Chuyển đổi đã thanh toán rồi hủy" mà không ai dựng nổi fixture đó thì case chìm
 * vào SKIP, rồi biến mất khỏi báo cáo. Không đo được "mình đang thiếu ô nào" thì mãi không biết phải dựng gì.
 *
 * Hai chế độ:
 *   --discover : ĐẾM fixture đang có thật trên môi trường (đọc list API do config khai) ⇒ ô nào 0 là ô mù.
 *   (mặc định): đối chiếu ma trận khai trong config với `knowledge/setup_recipes/` — cell phải hoặc CÓ fixture,
 *               hoặc khai `na` kèm lý do; và `how: "recipe:<id>"` phải trỏ tới recipe TỒN TẠI.
 *
 * Dùng:
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/qa/fixture_matrix.js --config <fixture_matrix.json> \
 *        [--discover] [--out <report.md>] [--enforce] [--stale-days 30]
 *
 * config = {
 *   "axes": { "branch": ["Bảo lưu", …], "state": ["Chờ thanh toán", …] },
 *   "discover": { "api": "/api/v1/service-fee-orders?page_index={page}&page_size=50", "listPath": "data.orders",
 *                 "branchField": "<cot_nhanh>", "stateField": "status", "pages": 6,
 *                 "branchMap": { "CHUYEN_DOI": "Chuyển đổi" }, "stateMap": { "PURCHASED": "Đã thanh toán" } },
 *   "fixtures": [{ "branch": "…", "state": "…", "id": "…", "how": "recipe:<id>", "verified": "2026-08-19" }],
 *   "na": [{ "branch": "…", "state": "…", "reason": "…" }]
 * }
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const ENFORCE = process.argv.includes('--enforce');
const DISCOVER = process.argv.includes('--discover');

const cellKey = (b, s) => `${b} ▸ ${s}`;

/** Đối chiếu ma trận khai với thực tế: cell nào có fixture, cell nào khai n/a, cell nào BỎ TRỐNG. */
function auditMatrix(cfg, recipeIds, staleDays) {
  const branches = (cfg.axes || {}).branch || [];
  const states = (cfg.axes || {}).state || [];
  const fx = new Map();
  for (const f of cfg.fixtures || []) {
    const k = cellKey(f.branch, f.state);
    if (!fx.has(k)) fx.set(k, []);
    fx.get(k).push(f);
  }
  const na = new Map((cfg.na || []).map((x) => [cellKey(x.branch, x.state), x.reason || '']));
  const cutoff = new Date(Date.now() - staleDays * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const cells = [];
  const problems = [];
  const warnings = [];
  for (const b of branches) {
    for (const s of states) {
      const k = cellKey(b, s);
      const list = fx.get(k) || [];
      const naReason = na.get(k);
      let state = 'TRỐNG';
      if (list.length) state = 'CÓ';
      else if (naReason !== undefined) state = 'N/A';
      cells.push({ branch: b, state: s, kind: state, fixtures: list, naReason });
      if (state === 'TRỐNG') problems.push(`${k}: chưa có fixture và cũng chưa khai \`na\` kèm lý do`);
      if (state === 'N/A' && !String(naReason).trim()) problems.push(`${k}: khai \`na\` mà KHÔNG có lý do — n/a không lý do là né, không phải quyết định`);
      for (const f of list) {
        const recipe = String(f.how || '').startsWith('recipe:') ? String(f.how).slice(7) : null;
        if (recipe && !recipeIds.has(recipe)) problems.push(`${k}: \`how\` trỏ recipe KHÔNG TỒN TẠI: ${recipe}`);
        if (!recipe && !String(f.how || '').trim()) warnings.push(`${k}: fixture ${f.id || '(không id)'} không ghi CÁCH dựng ⇒ hết fixture là tắc, không ai dựng lại được`);
        if (f.verified && String(f.verified) < cutoff) warnings.push(`${k}: fixture ${f.id || ''} xác nhận lần cuối ${f.verified} (quá ${staleDays} ngày) — dữ liệu UAT bị dọn/deploy là hỏng`);
        if (!f.verified) warnings.push(`${k}: fixture ${f.id || ''} chưa ghi \`verified\` ⇒ không biết còn dùng được không`);
      }
    }
  }
  return { branches, states, cells, problems, warnings };
}

async function discover(cfg) {
  const d = cfg.discover || {};
  if (!d.api) { console.error('[fx] ✗ --discover cần `discover.api` trong config'); process.exit(2); }
  const { chromium } = require('@playwright/test');
  const { login } = require(path.resolve(__dirname, 'ui_conformance_check.js'));
  const apiBase = (process.env.OPS_API_BASE_URL || '').replace(/\/+$/, '');
  const ctx = await chromium.launchPersistentContext('', { headless: true });
  const page = await ctx.newPage();
  const found = new Map();
  try {
    await login(page, cfg.login || { site: 'ops' });
    const token = await page.evaluate(() => localStorage.getItem('actToken'));
    for (let p = 1; p <= (d.pages || 4); p += 1) {
      // eslint-disable-next-line no-await-in-loop
      const items = await page.evaluate(async ([url, tok, lp]) => {
        const r = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } });
        if (!r.ok) return { error: `HTTP ${r.status}` };
        const j = await r.json();
        return { items: lp.split('.').reduce((o, k) => (o == null ? o : o[k]), j) || [] };
      }, [apiBase + d.api.replace('{page}', String(p)), token, d.listPath || 'data']);
      if (items.error) { console.error(`[fx] ✗ đọc API lỗi: ${items.error}`); break; }
      if (!items.items.length) break;
      for (const it of items.items) {
        // `branchField`/`stateField` nhận CHUỖI hoặc MẢNG tên: schema API hay có nhiều biến thể tên field, khai
        // sai một chữ là cả ma trận ra `undefined` (đã xảy ra ngay lượt dò đầu).
        const pick = (spec) => {
          for (const k of [].concat(spec || [])) if (it[k] !== undefined && it[k] !== null) return it[k];
          return undefined;
        };
        const rawB = String(pick(d.branchField));
        const rawS = String(pick(d.stateField));
        const b = (d.branchMap || {})[rawB] || rawB;
        const s = (d.stateMap || {})[rawS] || rawS;
        const k = cellKey(b, s);
        if (!found.has(k)) found.set(k, []);
        found.get(k).push(it.id);
      }
    }
  } finally { await ctx.close(); }
  return found;
}

async function main() {
  const cfgPath = arg('config');
  if (!cfgPath || !fs.existsSync(cfgPath)) { console.error(`[fx] ✗ thiếu --config: ${cfgPath || '(không truyền)'}`); process.exit(2); }
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const staleDays = Number(arg('stale-days', '30')) || 30;

  // recipe id có thật trong store (mắt xích: fixture phải nói được CÁCH dựng lại)
  const recipeDir = path.join(rc.REPO_ROOT, 'knowledge', 'setup_recipes');
  const recipeIds = new Set();
  if (fs.existsSync(recipeDir)) {
    for (const f of fs.readdirSync(recipeDir).filter((x) => x.endsWith('.json'))) {
      try { const j = JSON.parse(fs.readFileSync(path.join(recipeDir, f), 'utf8')); if (j.id) recipeIds.add(j.id); } catch (e) { /* bỏ file hỏng */ }
    }
  }

  let discovered = null;
  if (DISCOVER) {
    discovered = await discover(cfg);
    const cellsWith = [...discovered.entries()].sort((a, b) => b[1].length - a[1].length);
    console.log(`[fx] DÒ trên môi trường: ${cellsWith.length} ô có dữ liệu thật`);
    for (const [k, ids] of cellsWith) console.log(`[fx]   ${k}: ${ids.length} bản ghi · vd ${ids.slice(0, 2).join(', ')}`);
  }

  const a = auditMatrix(cfg, recipeIds, staleDays);
  const total = a.branches.length * a.states.length;
  const cnt = (kind) => a.cells.filter((c) => c.kind === kind).length;
  console.log(`[fx] ma trận ${a.branches.length} nhánh × ${a.states.length} trạng thái = ${total} ô · CÓ ${cnt('CÓ')} · N/A ${cnt('N/A')} · TRỐNG ${cnt('TRỐNG')}`);
  if (discovered) {
    // Ô trống trong khai báo NHƯNG môi trường lại có dữ liệu ⇒ chỉ là chưa ai ghi vào ma trận, dựng được ngay.
    const winnable = a.cells.filter((c) => c.kind === 'TRỐNG' && discovered.has(cellKey(c.branch, c.state)));
    if (winnable.length) {
      console.log(`[fx] ⓘ ${winnable.length} ô đang TRỐNG nhưng môi trường CÓ dữ liệu — điền được ngay, không cần dựng mới:`);
      for (const c of winnable) console.log(`[fx]     ${cellKey(c.branch, c.state)} → vd ${discovered.get(cellKey(c.branch, c.state)).slice(0, 2).join(', ')}`);
    }
  }
  // Đề xuất khối `fixtures` để dán vào config — id là SỰ THẬT đọc từ môi trường, nhưng `how`/`verified` là quyết
  // định của người (fixture nào dùng được, dựng lại bằng cách nào) nên KHÔNG tự ghi vào config.
  if (discovered && process.argv.includes('--suggest-fixtures')) {
    const sug = [];
    for (const c of a.cells) {
      if (c.kind !== 'TRỐNG') continue;
      const ids = discovered.get(cellKey(c.branch, c.state));
      if (ids && ids.length) sug.push({ branch: c.branch, state: c.state, id: ids[0], how: 'discover: GET list API (điền cách dựng lại)', verified: new Date().toISOString().slice(0, 10) });
    }
    if (sug.length) {
      console.log(`[fx] ĐỀ XUẤT ${sug.length} fixture để dán vào \`fixtures\` (người chốt \`how\`/\`verified\`):`);
      console.log(JSON.stringify(sug, null, 2));
    }
  }
  for (const p of a.problems) console.log(`[fx] ✗ ${p}`);
  for (const w of a.warnings) console.log(`[fx] ⚠ ${w}`);

  const out = arg('out');
  if (out) {
    const L = [`<!-- gate: proven=${cnt('CÓ')} inconclusive=${cnt('TRỐNG')} broken=${a.problems.length} -->`,
      '# Ma trận fixture: nhánh × trạng thái (trục 4 + 5)', '',
      '> Sinh bởi `scripts/qa/fixture_matrix.js`. Lý do hai trục này rò nhiều nhất rất tầm thường: **không có dữ liệu',
      '> để thử**, nên case chìm vào SKIP rồi biến mất. Ô `TRỐNG` = chưa có fixture VÀ chưa khai `na` kèm lý do —',
      '> đó là vùng chưa ai thử, không phải vùng đã đạt.', '',
      `- Ô: **${total}** · CÓ **${cnt('CÓ')}** · N/A **${cnt('N/A')}** · TRỐNG **${cnt('TRỐNG')}**`, '',
      `| Nhánh \\ Trạng thái | ${a.states.join(' | ')} |`, `|---|${a.states.map(() => '---').join('|')}|`];
    for (const b of a.branches) {
      const row = a.states.map((s) => {
        const c = a.cells.find((x) => x.branch === b && x.state === s);
        if (c.kind === 'CÓ') return `✓ ${c.fixtures.map((f) => f.id || 'fixture').join(', ').slice(0, 26)}`;
        if (c.kind === 'N/A') return `n/a`;
        const disc = discovered && discovered.get(cellKey(b, s));
        return disc ? `⬚ (env có ${disc.length})` : '⬚';
      });
      L.push(`| ${b} | ${row.join(' | ')} |`);
    }
    if (a.problems.length) { L.push('', '## Phải xử lý', ''); for (const p of a.problems) L.push(`- ${p}`); }
    if (a.warnings.length) { L.push('', '## Cảnh báo', ''); for (const w of a.warnings) L.push(`- ${w}`); }
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, `${L.join('\n')}\n`);
    console.log(`[fx] báo cáo: ${out}`);
  }

  if (ENFORCE && a.problems.length) process.exit(1);
}

// `require.main` guard: thiếu chốt này thì `require()` trong test làm CLI chạy và exit(2) vì không có --config.
// Đây là lần THỨ HAI mắc trong cùng phiên (cross_surface_diff.js) ⇒ đưa vào luật viết ở B7.
if (require.main === module) main();

module.exports = { auditMatrix, cellKey };
