#!/usr/bin/env node
'use strict';

/*
 * domain_rules.js — quản lý `knowledge/domain/` (business rule đã XÁC NHẬN = nền của oracle).
 *
 * VÌ SAO CẦN: kit CẤM oracle tautological (expected phải từ spec/business rule, không suy từ app —
 * prompt gen §12/§13 + `output_gate.looksTautology`). Nhưng nếu không lưu "đúng là gì" thì agent phải
 * đọc lại Jira/Confluence mỗi lần (dễ miss) hoặc suy từ app (rơi đúng vào tautology bị cấm).
 * File này làm 4 việc để `domain/` không thành nghĩa địa dữ liệu:
 *   --validate  (mặc định) schema + PII + trùng id/version + `source` rỗng (chống rule tự bịa)
 *   --trace     đối chiếu `covered_by` với TC ID THẬT trong testcase canonical → TC ma / rule chưa có TC
 *   --stale     rule đổi (confirmed_at) SAU lần execute cuối của TC → TC phải chạy lại
 *   --index     ghi entry `business_rule` vào knowledge/index.json (tra theo module/tag)
 *
 * Dùng:
 *   npm run domain:check                       # validate + trace + stale (report)
 *   npm run domain:check -- --enforce          # lỗi schema/PII → exit 1
 *   node scripts/qa/domain_rules.js --index
 *   [--dir knowledge/domain] [--tc-dir <test-cases/>] [--task <TASK_KEY>]
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const canonical = require(path.resolve(__dirname, '..', 'lib', 'testcase'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);
const ENFORCE = flag('enforce');
const REPO = rc.REPO_ROOT;
const KNOW = path.join(REPO, 'knowledge');
const DIR = path.resolve(arg('dir', path.join(KNOW, 'domain')));

const ID_RE = /^BR-[A-Z0-9]+-\d{3}$/;
const STATUSES = ['active', 'superseded', 'deprecated'];
const CONFIRMERS = ['BA', 'Dev', 'QA-Lead', 'PO'];
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /\b0\d{8,10}\b/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return { __err: e.message }; } }

function loadRules() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: path.join(DIR, f), rel: path.relative(REPO, path.join(DIR, f)).replace(/\\/g, '/'), data: readJson(path.join(DIR, f)) }));
}

/** Validate 1 rule → mảng lỗi (chặn) + cảnh báo. */
function validate(r) {
  const problems = []; const warnings = [];
  const d = r.data || {};
  const at = (m) => `${path.basename(r.file)}: ${m}`;
  if (d.__err) return { problems: [at(`JSON lỗi — ${d.__err}`)], warnings };

  if (!ID_RE.test(String(d.id || ''))) problems.push(at(`\`id\` "${d.id}" sai format (cần BR-<MODULE>-<NNN>, vd BR-PAYMENT-004)`));
  if (!String(d.module || '').trim()) problems.push(at('thiếu `module` (phải khớp cột Module của testcase để tra cứu/risk gom đúng)'));
  if (!String(d.rule || '').trim()) problems.push(at('thiếu `rule` (phát biểu rule kiểm được)'));
  // `source` rỗng = rule không truy nguyên được → chính là cửa cho rule tự bịa.
  if (!String(d.source || '').trim()) problems.push(at('thiếu `source` — rule KHÔNG truy nguyên được thì không được ghi vào knowledge (chống rule tự bịa)'));
  if (!CONFIRMERS.includes(String(d.confirmed_by || ''))) problems.push(at(`\`confirmed_by\` phải ∈ ${CONFIRMERS.join('|')} (ai CHỐT rule này)`));
  if (!DATE_RE.test(String(d.confirmed_at || ''))) problems.push(at('`confirmed_at` phải là ISO date YYYY-MM-DD (dùng để phát hiện TC stale)'));
  if (!Number.isInteger(d.version) || d.version < 1) problems.push(at('`version` phải là số nguyên ≥ 1'));
  if (!STATUSES.includes(String(d.status || ''))) problems.push(at(`\`status\` phải ∈ ${STATUSES.join('|')}`));
  if (!Array.isArray(d.covered_by)) problems.push(at('`covered_by` phải là mảng TC ID (rỗng cũng được, nhưng phải có field — đây là mắt xích trace ngược)'));

  // examples: thứ biến rule thành oracle dùng được → phải có input + expected cụ thể.
  const ex = Array.isArray(d.examples) ? d.examples : [];
  if (!ex.length) problems.push(at('thiếu `examples` — rule không có cặp {input, expected} cụ thể thì KHÔNG dùng được làm oracle'));
  ex.forEach((e, i) => {
    if (!e || !String(e.input || '').trim() || !String(e.expected || '').trim()) problems.push(at(`examples[${i}] thiếu \`input\` hoặc \`expected\``));
    else if (!/\d/.test(String(e.expected))) warnings.push(at(`examples[${i}].expected không có số/giá trị cụ thể ("${String(e.expected).slice(0, 40)}") — oracle dễ thành chung chung`));
  });

  if (d.version > 1 && !String(d.supersedes || '').trim()) warnings.push(at(`version ${d.version} nhưng thiếu \`supersedes\` (nên ghi <id>@v${d.version - 1} để lần theo lịch sử)`));
  if (d.status === 'active' && Array.isArray(d.covered_by) && !d.covered_by.length) warnings.push(at('rule active nhưng `covered_by` RỖNG — chưa có testcase nào dùng rule này làm oracle (coverage gap)'));

  const blob = JSON.stringify(d);
  if (EMAIL_RE.test(blob)) problems.push(at('có EMAIL trong nội dung — knowledge cấm PII khách (mask hoặc bỏ)'));
  if (PHONE_RE.test(blob)) problems.push(at('có SỐ ĐIỆN THOẠI trong nội dung — knowledge cấm PII khách'));
  return { problems, warnings };
}

/** TC ID thật từ testcase canonical (theo task hoặc --tc-dir). */
function realTcIds() {
  const ids = new Set();
  const dirs = [];
  const explicit = arg('tc-dir');
  if (explicit) dirs.push(path.resolve(explicit));
  const TASK = arg('task', process.env.TASK_KEY || '');
  const POD = process.env.PROJECT_OUTPUT_DIR || '';
  if (TASK && POD) {
    dirs.push(path.resolve(REPO, POD, 'tasks', TASK, 'test-cases'));
    dirs.push(path.resolve(REPO, POD, 'tasks', TASK, 'test-cases', 'from-xray'));
  }
  if (!explicit && !(TASK && POD)) {
    // fallback: quét mọi task trong outputs (để dùng được cả khi không có TASK context)
    const outputs = path.join(REPO, 'outputs');
    if (fs.existsSync(outputs)) {
      for (const proj of fs.readdirSync(outputs)) {
        const tasksDir = path.join(outputs, proj, 'tasks');
        if (!fs.existsSync(tasksDir)) continue;
        for (const t of fs.readdirSync(tasksDir)) {
          dirs.push(path.join(tasksDir, t, 'test-cases'));
          dirs.push(path.join(tasksDir, t, 'test-cases', 'from-xray'));
        }
      }
    }
  }
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (f.startsWith('~$') || f.startsWith('.~')) continue;   // file LOCK của Excel, không phải zip → ExcelJS nổ async
      try {
        if (!fs.statSync(full).isFile()) continue;
        let doc = null;
        if (f.endsWith('.md')) doc = canonical.parseMarkdown(fs.readFileSync(full, 'utf8'));
        else if (f.endsWith('.xlsx') && canonical.parseXlsx) doc = canonical.parseXlsx(full);
        // parseXlsx ASYNC + hàm này SYNC ⇒ doc là Promise, doc.tests undefined: bỏ sót TC ID mà không báo gì.
        // Nói to ra thay vì im (sửa đúng = chuyển realTcIds + chỗ gọi top-level sang async).
        if (doc && typeof doc.then === 'function') {
          console.warn(`[domain] BỎ QUA ${f}: parseXlsx là async nhưng realTcIds chạy sync ⇒ TC ID trong file này KHÔNG được tính. Dùng bản .md.`);
          doc = null;
        }
        for (const t of (doc && doc.tests) || []) if (t.tcId) ids.add(String(t.tcId));
      } catch (e) { /* file không phải bảng testcase → bỏ qua */ }
    }
  }
  return ids;
}

/** Lần execute cuối của mỗi TC (từ knowledge/metrics/tc-history.jsonl + historical_execution date). */
function lastRunByTc() {
  const map = new Map();
  const f = path.join(KNOW, 'metrics', 'tc-history.jsonl');
  if (fs.existsSync(f)) {
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        const day = String(r.at || '').slice(0, 10);
        const key = String(r.title || '').match(/[A-Z][A-Z0-9_]*_TC_\d+/);
        const tc = key ? key[0] : null;
        if (tc && day && (!map.has(tc) || map.get(tc) < day)) map.set(tc, day);
      } catch (e) { /* skip */ }
    }
  }
  return map;
}

const rules = loadRules();
console.log(`[domain] ${rules.length} rule trong ${path.relative(REPO, DIR)}`);
if (!rules.length) {
  console.log('[domain] Chưa có business rule nào. Ghi rule ĐÃ ĐƯỢC XÁC NHẬN (skill `domain_recorder`) —');
  console.log('         nguồn tự nhiên nhất: câu trả lời của BA/QA ở `reports/phase1-clarifications.md` sau khi Ambiguity Gate RESOLVED.');
  process.exit(0);
}

let problems = []; let warnings = [];
for (const r of rules) { const v = validate(r); problems = problems.concat(v.problems); warnings = warnings.concat(v.warnings); }

// trùng id@version
const seen = new Map();
for (const r of rules) {
  const k = `${r.data && r.data.id}@v${r.data && r.data.version}`;
  if (seen.has(k)) problems.push(`TRÙNG ${k}: ${path.basename(seen.get(k))} và ${path.basename(r.file)} — mỗi id+version chỉ 1 file`);
  else seen.set(k, r.file);
}
// nhiều rule active cùng id (phải chỉ 1)
const activeById = {};
for (const r of rules) {
  const d = r.data || {};
  if (d.status === 'active' && d.id) { activeById[d.id] = (activeById[d.id] || 0) + 1; }
}
Object.entries(activeById).filter(([, n]) => n > 1).forEach(([id, n]) => problems.push(`${id}: có ${n} bản \`active\` — chỉ được 1 (bản cũ phải đổi thành \`superseded\`)`));

if (flag('trace') || flag('stale') || (!flag('index') && !flag('validate'))) {
  const real = realTcIds();
  const runs = lastRunByTc();
  console.log(`[domain] đối chiếu với ${real.size} TC ID thật trong testcase canonical`);
  for (const r of rules) {
    const d = r.data || {};
    if (!Array.isArray(d.covered_by)) continue;
    const ghosts = d.covered_by.filter((tc) => real.size && !real.has(String(tc)));
    if (ghosts.length) warnings.push(`${d.id}: \`covered_by\` trỏ tới TC KHÔNG TỒN TẠI: ${ghosts.join(', ')} (rule nghĩ là đã test nhưng thực tế không)`);
    if (flag('stale') || !flag('trace')) {
      const stale = d.covered_by.filter((tc) => runs.has(String(tc)) && runs.get(String(tc)) < String(d.confirmed_at || ''));
      if (stale.length) warnings.push(`${d.id}: rule cập nhật ${d.confirmed_at} NHƯNG các TC sau execute trước đó → phải chạy lại: ${stale.join(', ')}`);
    }
  }
}

if (flag('index')) {
  const idxFile = path.join(KNOW, 'index.json');
  const idx = readJson(idxFile);
  const doc = idx && !idx.__err ? idx : { version: 1, updated_at: null, entries: [] };
  doc.entries = doc.entries || [];
  let n = 0;
  for (const r of rules) {
    const d = r.data || {};
    if (!d.id) continue;
    const rec = { type: 'business_rule', file: r.rel.replace(/^knowledge\//, ''), module: d.module, tags: d.tags || [], task_key: d.task_key || null, status: `${d.status}@v${d.version}` };
    const i = doc.entries.findIndex((x) => x && x.file === rec.file);
    if (i >= 0) doc.entries[i] = rec; else { doc.entries.push(rec); n += 1; }
  }
  // Dọn entry TRỎ FILE ĐÃ BỊ XOÁ (chỉ của type này) — indexer trước đây chỉ thêm/sửa nên xoá 1 record
  // là index còn trỏ vào hư không, tra cứu ra kết quả ma.
  const before = doc.entries.length;
  doc.entries = doc.entries.filter((e) => !(e && e.type === 'business_rule') || fs.existsSync(path.join(KNOW, e.file)));
  const pruned = before - doc.entries.length;
  if (pruned) console.log(`[domain] dọn ${pruned} entry trỏ file đã bị xoá.`);
  doc.updated_at = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(idxFile, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  console.log(`[domain] index.json: +${n} entry business_rule (tổng ${doc.entries.length}).`);
}

if (warnings.length) { console.log(`\n⚠ ${warnings.length} cảnh báo:`); warnings.forEach((w) => console.log(`  ~ ${w}`)); }
if (problems.length) {
  console.log(`\n✗ ${problems.length} lỗi CHẶN:`);
  problems.forEach((p) => console.log(`  - ${p}`));
  console.log('\nSchema: knowledge/SCHEMA.md §domain/. Rule không truy nguyên được (thiếu source/examples) thì ĐỪNG ghi vào knowledge.');
  if (ENFORCE) process.exit(1);
} else {
  console.log('\n✓ Mọi rule hợp schema (có source + examples cụ thể, không PII, vòng đời nhất quán).');
}
process.exit(0);
