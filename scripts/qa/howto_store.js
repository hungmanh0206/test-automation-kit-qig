#!/usr/bin/env node
'use strict';

/*
 * howto_store.js — quản lý 2 store trả lời câu hỏi "LÀM SAO tới được đó":
 *   setup_recipes/  — để có state X thì làm Y (kèm CẠM BẪY đã vấp)
 *   environment/    — quirk hạ tầng/auth/env khiến chạy test thất bại một cách khó hiểu
 *
 * VÌ SAO CẦN: các store cũ (`domain` giá trị đúng · `system` được phép làm gì · `bugs` cái gì hỏng ·
 * `decisions` vì sao đã chốt) đều nhớ phía KẾT LUẬN. Nhưng đo thật trên 80 memory tích luỹ của một dự án
 * đang chạy: **59% là "cách dựng state/fixture" và 21% là "quirk môi trường"** — tức 80% thời gian thật tiêu
 * ở phía "làm sao tới được đó", mà kit KHÔNG có chỗ nào chứa. `Setup Strategy` chỉ sống trong TỪNG task nên
 * task sau phải mò lại từ đầu.
 *
 * Giá trị nằm ở trường `pitfalls`: thứ chỉ biết sau khi đã vấp (vd "phải PATCH loai_phi_dich_vu TRƯỚC khi
 * sync, không thì form ra nhầm luồng"). Không có nó thì recipe chỉ là mô tả lại tài liệu.
 *
 * Dùng:
 *   npm run howto:check              # validate schema + PII
 *   npm run howto:check -- --enforce # lỗi = exit 1
 *   npm run howto:index              # ghi entry vào knowledge/index.json
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);
const ENFORCE = flag('enforce');
const KNOW = path.join(rc.REPO_ROOT, 'knowledge');

const STORES = {
  setup_recipes: {
    dir: path.resolve(arg('recipes-dir', path.join(KNOW, 'setup_recipes'))),
    idRe: /^SR-[A-Z0-9]+-\d{3}$/, idHint: 'SR-<SLUG>-<NNN> (vd SR-ORDER-001)', indexType: 'setup_recipe',
  },
  environment: {
    dir: path.resolve(arg('env-dir', path.join(KNOW, 'environment'))),
    idRe: /^ENV-[A-Z0-9]+-\d{3}$/, idHint: 'ENV-<SLUG>-<NNN> (vd ENV-AUTH-001)', indexType: 'environment_fact',
  },
};

const STATUSES = ['active', 'superseded', 'deprecated'];
const CONFIRMERS = ['BA', 'Dev', 'QA-Lead', 'PO', 'QA'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /\b0\d{8,10}\b/;
// Precondition KHÔNG được dựng bằng DB (RULE_GLOBAL §DB access) — recipe là nơi rất dễ lách luật đó.
const DB_SETUP_RE = /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER)\b|\bpsql\b|\bpg_dump\b/i;

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return { __err: e.message }; } };

function load(store) {
  const { dir } = STORES[store];
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => ({ store, file: path.join(dir, f), rel: path.relative(KNOW, path.join(dir, f)).replace(/\\/g, '/'), data: readJson(path.join(dir, f)) }));
}

/** Trường chung cho cả 2 store — giữ y hệt `domain/`+`system/` để chỉ có 1 mô hình trong đầu. */
function validateCommon(d, at, problems, warnings, spec) {
  if (!spec.idRe.test(String(d.id || ''))) problems.push(at(`\`id\` "${d.id}" sai format — cần ${spec.idHint}`));
  if (!String(d.source || '').trim()) problems.push(at('thiếu `source` — không truy nguyên được thì không ghi (chống bịa)'));
  if (!CONFIRMERS.includes(String(d.confirmed_by || ''))) problems.push(at(`\`confirmed_by\` phải ∈ ${CONFIRMERS.join('|')}`));
  if (!DATE_RE.test(String(d.confirmed_at || ''))) problems.push(at('`confirmed_at` phải là ISO date YYYY-MM-DD'));
  if (!Number.isInteger(d.version) || d.version < 1) problems.push(at('`version` phải là số nguyên ≥ 1'));
  if (!STATUSES.includes(String(d.status || ''))) problems.push(at(`\`status\` phải ∈ ${STATUSES.join('|')}`));
  const blob = JSON.stringify(d);
  if (EMAIL_RE.test(blob)) problems.push(at('có EMAIL trong nội dung — knowledge cấm PII khách'));
  if (PHONE_RE.test(blob)) problems.push(at('có SỐ ĐIỆN THOẠI trong nội dung — knowledge cấm PII khách'));
  if (d.version > 1 && !String(d.supersedes || '').trim()) warnings.push(at(`version ${d.version} nhưng thiếu \`supersedes\``));
}

function validate(r) {
  const problems = []; const warnings = [];
  const d = r.data || {};
  const at = (m) => `${r.rel}: ${m}`;
  if (d.__err) return { problems: [at(`JSON lỗi — ${d.__err}`)], warnings };
  validateCommon(d, at, problems, warnings, STORES[r.store]);

  if (r.store === 'setup_recipes') {
    if (!String(d.goal || '').trim()) problems.push(at('thiếu `goal` — recipe phải nói RÕ dựng ra state gì'));
    const steps = Array.isArray(d.steps) ? d.steps : [];
    if (!steps.length) problems.push(at('thiếu `steps` (mảng bước cụ thể, theo thứ tự)'));
    // Đúng thứ phân biệt recipe với "mô tả lại tài liệu": cạm bẫy chỉ biết sau khi vấp.
    if (!Array.isArray(d.pitfalls) || !d.pitfalls.length) {
      warnings.push(at('`pitfalls` rỗng — recipe không có cạm bẫy thì thường chỉ là chép lại tài liệu; ghi thứ đã làm bạn mất thời gian'));
    }
    if (!String(d.verification || '').trim()) problems.push(at('thiếu `verification` — phải nêu cách XÁC NHẬN state đã dựng đúng, nếu không recipe chạy xong không ai biết có thật không'));
    const METHODS = ['api', 'ui', 'factory', 'test_hook', 'pre_existing', 'fixture-tool'];
    if (!METHODS.includes(String(d.method || ''))) problems.push(at(`\`method\` phải ∈ ${METHODS.join('|')} — KHÔNG có \`db\` (RULE_GLOBAL cấm dựng state bằng DB)`));
    const stepsBlob = JSON.stringify(steps);
    if (DB_SETUP_RE.test(stepsBlob)) problems.push(at('steps có câu lệnh GHI vào DB (INSERT/UPDATE/DELETE/psql…) — cấm dựng state bằng DB; chỉ SELECT read-only để verify'));
  }

  if (r.store === 'environment') {
    if (!String(d.fact || '').trim()) problems.push(at('thiếu `fact` — nêu quirk cụ thể, kiểm được'));
    if (!String(d.impact || '').trim()) problems.push(at('thiếu `impact` — không nêu hậu quả thì người đọc không biết vì sao phải quan tâm'));
    if (!String(d.workaround || '').trim()) warnings.push(at('`workaround` rỗng — biết quirk mà không biết cách né thì giá trị còn một nửa'));
    if (!String(d.scope || '').trim()) problems.push(at('thiếu `scope` (env/app nào: UAT OPS, staging LMS…) — quirk sai môi trường là gây hiểu nhầm'));
  }
  return { problems, warnings };
}

const all = [...load('setup_recipes'), ...load('environment')];
const problems = []; const warnings = [];
const seen = new Map();
for (const r of all) {
  const v = validate(r);
  problems.push(...v.problems); warnings.push(...v.warnings);
  const id = (r.data || {}).id;
  if (id) { if (seen.has(id)) problems.push(`${r.rel}: trùng \`id\` ${id} với ${seen.get(id)}`); else seen.set(id, r.rel); }
}

console.log(`[howto] ${load('setup_recipes').length} recipe · ${load('environment').length} env-fact`);

if (flag('index')) {
  const idxFile = path.join(KNOW, 'index.json');
  const idx = readJson(idxFile);
  const base = idx && !idx.__err ? idx : { version: 1, updated_at: null, entries: [] };
  base.entries = base.entries || [];
  const types = Object.values(STORES).map((s) => s.indexType);
  base.entries = base.entries.filter((e) => !(e && types.includes(e.type)));
  for (const r of all) {
    const d = r.data || {};
    if (d.__err || d.status !== 'active') continue;
    base.entries.push({ type: STORES[r.store].indexType, file: r.rel, modules: d.modules || [], tags: d.tags || [], status: d.status });
  }
  base.updated_at = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(idxFile, JSON.stringify(base, null, 2), 'utf8');
  console.log(`[howto] index.json: ghi ${all.filter((r) => (r.data || {}).status === 'active').length} entry active.`);
}

if (warnings.length) { console.log(`\n⚠ ${warnings.length} cảnh báo:`); warnings.forEach((w) => console.log(`  ~ ${w}`)); }
if (problems.length) {
  console.error(`\n✗ ${problems.length} lỗi CHẶN:`);
  problems.forEach((p) => console.error(`  - ${p}`));
  if (ENFORCE) process.exit(1);
} else {
  console.log('\n✓ Mọi record hợp schema (có source/verification, method không phải DB, không PII).');
}
