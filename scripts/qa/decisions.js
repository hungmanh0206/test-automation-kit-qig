#!/usr/bin/env node
'use strict';

/*
 * decisions.js — quản lý `knowledge/decisions/`: LÝ DO của những quyết định QA đã chốt.
 *
 * VÌ SAO CẦN: kit đang lưu được "cái đúng" (`domain/`), "hệ thống được phép làm gì" (`system/`) và
 * "cái đã sai" (`bugs/`, `root_causes/`) — nhưng KHÔNG lưu **vì sao đã kết luận như thế**. Những kết luận
 * đắt nhất lại chính là loại này:
 *   - "triệu chứng X KHÔNG phải bug — dev đã verify code, Jira Rejected"  → task sau log lại đúng bug đó
 *   - "case Y ghi PASS kèm note vì vướng data/env, không phải defect"      → task sau lại FAIL đỏ oan
 *   - "module Z QA hạ band High→Medium vì lý do nghiệp vụ"                → mỗi lần chạy risk lại phải override tay
 *   - "cách test W không dùng được (lý do kỹ thuật cụ thể)"               → task sau lại mò lại từ đầu
 * Hiện chúng chỉ nằm trong output của task rồi chết theo task (hoặc trong đầu người làm).
 *
 * Dùng:
 *   npm run decisions:check                        # validate + bug Rejected chưa có lý do + decision hết hạn
 *   npm run decisions:check -- --enforce           # lỗi schema/PII → exit 1
 *   node scripts/qa/decisions.js --check "<triệu chứng>"   # TRA TRƯỚC KHI LOG BUG: đã từng kết luận chưa?
 *   node scripts/qa/decisions.js --index
 *   [--dir knowledge/decisions] [--module <name>] [--max <n>]
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);
const ENFORCE = flag('enforce');
const REPO = rc.REPO_ROOT;
const KNOW = path.join(REPO, 'knowledge');
const DIR = path.resolve(arg('dir', path.join(KNOW, 'decisions')));
const BUGS_DIR = path.resolve(arg('bugs-dir', path.join(KNOW, 'bugs')));
const MAX_ROWS = Math.max(1, Number(arg('max', 20)) || 20);

const TYPES = ['false_positive', 'by_design', 'risk_override', 'blocked_pass', 'wont_fix', 'test_approach'];
const ID_RE = /^DEC-[A-Z0-9]+-\d{3}$/;
const DECIDERS = ['BA', 'Dev', 'QA-Lead', 'PO', 'QA'];
const STATUSES = ['active', 'superseded'];
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /\b0\d{8,10}\b/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TODAY = new Date().toISOString().slice(0, 10);

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return { __err: e.message }; } }

function loadAll(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: path.join(dir, f), rel: path.relative(REPO, path.join(dir, f)).replace(/\\/g, '/'), data: readJson(path.join(dir, f)) }));
}

/** Bỏ dấu tiếng Việt + hạ chữ, để so khớp triệu chứng không phụ thuộc cách gõ dấu. */
const norm = (s) => String(s || '').normalize('NFD').split('').filter((c) => { const k = c.charCodeAt(0); return k < 0x300 || k > 0x36f; }).join('').toLowerCase();
const tokens = (s) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4);

function validate(r) {
  const problems = []; const warnings = [];
  const d = r.data || {};
  const at = (m) => `${path.basename(r.file)}: ${m}`;
  if (d.__err) return { problems: [at(`JSON lỗi — ${d.__err}`)], warnings };

  if (!ID_RE.test(String(d.id || ''))) problems.push(at(`\`id\` "${d.id}" sai format (cần DEC-<SLUG>-<NNN>, vd DEC-PAYMENT-001)`));
  if (!TYPES.includes(String(d.type || ''))) problems.push(at(`\`type\` phải ∈ ${TYPES.join('|')}`));
  if (!String(d.subject || '').trim()) problems.push(at('thiếu `subject` — TRIỆU CHỨNG/đối tượng được quyết định (đây là thứ dùng để tra cứu lần sau)'));
  if (!String(d.decision || '').trim()) problems.push(at('thiếu `decision` — chốt cái gì'));
  // Không có `rationale` thì bản ghi vô dụng: lần sau đọc vẫn không biết vì sao, vẫn phải điều tra lại.
  if (String(d.rationale || '').trim().length < 20) problems.push(at('`rationale` quá ngắn/thiếu — phải nêu VÌ SAO (bằng chứng, ai xác nhận, code/spec nào); thiếu lý do thì lần sau vẫn phải điều tra lại từ đầu'));
  if (!DECIDERS.includes(String(d.decided_by || ''))) problems.push(at(`\`decided_by\` phải ∈ ${DECIDERS.join('|')}`));
  if (!DATE_RE.test(String(d.decided_at || ''))) problems.push(at('`decided_at` phải là ISO date YYYY-MM-DD'));
  if (!STATUSES.includes(String(d.status || ''))) problems.push(at(`\`status\` phải ∈ ${STATUSES.join('|')}`));
  if (d.expires_at !== undefined && d.expires_at !== null && !DATE_RE.test(String(d.expires_at))) problems.push(at('`expires_at` (tuỳ chọn) phải là ISO date YYYY-MM-DD'));

  const sc = d.scope || {};
  if (!sc || typeof sc !== 'object' || Array.isArray(sc)) problems.push(at('thiếu `scope` {modules:[], tc_ids:[], bug_keys:[]} — không khoanh phạm vi thì quyết định bị áp sai chỗ'));
  else {
    for (const k of ['modules', 'tc_ids', 'bug_keys']) if (sc[k] !== undefined && !Array.isArray(sc[k])) problems.push(at(`\`scope.${k}\` phải là mảng`));
    if (!(sc.modules || []).length && !(sc.tc_ids || []).length && !(sc.bug_keys || []).length) problems.push(at('`scope` rỗng hoàn toàn — phải có ít nhất 1 trong modules/tc_ids/bug_keys'));
  }
  // false_positive là loại nguy hiểm nhất nếu ghi bừa: nó DẬP một bug thật ở lần sau.
  if (d.type === 'false_positive' && !['Dev', 'BA', 'QA-Lead', 'PO'].includes(String(d.decided_by))) {
    problems.push(at('`false_positive` phải do Dev/BA/QA-Lead/PO chốt (không tự QA/agent kết luận) — ghi bừa là dập luôn bug THẬT ở task sau'));
  }
  if (d.type === 'risk_override' && !(d.scope && (d.scope.modules || []).length)) problems.push(at('`risk_override` phải khoanh `scope.modules`'));
  if (d.type === 'blocked_pass' && !(d.scope && (d.scope.tc_ids || []).length)) problems.push(at('`blocked_pass` phải khoanh `scope.tc_ids`'));
  if (!String(d.evidence || '').trim()) warnings.push(at('thiếu `evidence` — nên trỏ ảnh/video/Jira key/commit làm bằng'));
  if (d.expires_at && String(d.expires_at) < TODAY && d.status === 'active') warnings.push(at(`HẾT HẠN ${d.expires_at} mà vẫn \`active\` — phải kiểm lại rồi gia hạn hoặc chuyển \`superseded\``));

  const blob = JSON.stringify(d);
  if (EMAIL_RE.test(blob)) problems.push(at('có EMAIL trong nội dung — knowledge cấm PII khách (mask hoặc bỏ)'));
  if (PHONE_RE.test(blob)) problems.push(at('có SỐ ĐIỆN THOẠI trong nội dung — knowledge cấm PII khách'));
  return { problems, warnings };
}

const decisions = loadAll(DIR);
const CHECK = arg('check');

// --check: TRA CỨU trước khi log bug / trước khi kết luận FAIL.
if (CHECK) {
  const q = tokens(CHECK);
  const modFilter = norm(arg('module', ''));
  const scored = decisions.map((r) => {
    const d = r.data || {};
    const hay = tokens([d.subject, d.decision, d.rationale, (d.tags || []).join(' '), ((d.scope || {}).modules || []).join(' '), ((d.scope || {}).tc_ids || []).join(' '), ((d.scope || {}).bug_keys || []).join(' ')].join(' '));
    const set = new Set(hay);
    const hits = q.filter((w) => set.has(w));
    const exact = norm([d.subject, ((d.scope || {}).tc_ids || []).join(' '), ((d.scope || {}).bug_keys || []).join(' ')].join(' ')).includes(norm(CHECK)) ? 5 : 0;
    const modBoost = modFilter && norm(((d.scope || {}).modules || []).join(' ')).includes(modFilter) ? 2 : 0;
    return { r, d, score: hits.length + exact + modBoost, hits };
    // Ngưỡng ≥2 từ khớp (hoặc khớp nguyên văn subject/TC/bug key): khớp 1 từ chung chung ("chưa", "không")
    // tạo nhiễu, mà bản tra cứu này phải đọc-là-hiểu trong 5 giây mới có người dùng.
  }).filter((x) => x.d.status === 'active' && (x.hits.length >= 2 || x.score >= 5)).sort((a, b) => b.score - a.score);

  console.log(`[decisions] Tra "${CHECK}"${modFilter ? ` (module ~ ${arg('module')})` : ''} trong ${decisions.length} quyết định → ${scored.length} khớp`);
  if (!scored.length) {
    console.log('  (không khớp — CHƯA từng kết luận về việc này, hoặc có mà chưa ai ghi lại. Không có nghĩa là được phép bỏ qua điều tra.)');
  }
  for (const x of scored.slice(0, MAX_ROWS)) {
    console.log(`\n  ▸ ${x.d.id} [${x.d.type}] ${x.d.decided_at} · ${x.d.decided_by} (khớp: ${x.hits.join(', ') || 'subject'})`);
    console.log(`    Việc:  ${x.d.subject}`);
    console.log(`    Chốt:  ${x.d.decision}`);
    console.log(`    Vì:    ${x.d.rationale}`);
    if (x.d.evidence) console.log(`    Bằng:  ${x.d.evidence}`);
    if (x.d.expires_at) console.log(`    Hết hạn: ${x.d.expires_at}${x.d.expires_at < TODAY ? ' ⚠ ĐÃ QUÁ HẠN — phải kiểm lại' : ''}`);
    if (x.d.type === 'false_positive' || x.d.type === 'by_design') console.log('    ⇒ KHÔNG log bug lại nếu triệu chứng y hệt; muốn log phải có bằng chứng MỚI khác lần trước.');
  }
  process.exit(0);
}

console.log(`[decisions] ${decisions.length} quyết định trong ${path.relative(REPO, DIR)}`);
if (!decisions.length) {
  console.log('[decisions] Chưa ghi quyết định nào. Ghi khi: bug bị Rejected/by-design · case PASS-kèm-note vì vướng env ·');
  console.log('            QA override risk band · chốt cách test sau khi thử thất bại. Skill `decision_recorder`, schema: knowledge/SCHEMA.md §decisions/.');
}

let problems = []; let warnings = [];
for (const r of decisions) { const v = validate(r); problems = problems.concat(v.problems); warnings = warnings.concat(v.warnings); }

const seen = new Map();
const activeById = {};
for (const r of decisions) {
  const d = r.data || {};
  const k = `${d.id}@${d.decided_at}`;
  if (seen.has(k)) problems.push(`TRÙNG ${k}: ${path.basename(seen.get(k))} và ${path.basename(r.file)}`);
  else seen.set(k, r.file);
  if (d.status === 'active' && d.id) activeById[d.id] = (activeById[d.id] || 0) + 1;
}
Object.entries(activeById).filter(([, n]) => n > 1).forEach(([id, n]) => problems.push(`${id}: có ${n} bản \`active\` — chỉ được 1 (bản cũ đổi thành \`superseded\`)`));

// Bug đã Rejected/Won't Do mà KHÔNG có quyết định giải thích ⇒ lần sau gặp lại triệu chứng đó sẽ log lại.
if (!flag('index')) {
  const bugs = loadAll(BUGS_DIR);
  const explained = new Set();
  for (const r of decisions) for (const k of ((r.data || {}).scope || {}).bug_keys || []) explained.add(String(k));
  const orphans = bugs.map((b) => b.data || {}).filter((b) => /reject|won.?t do|cancel|duplicate/i.test(String(b.jira_status || '')) && !explained.has(String(b.id)));
  if (orphans.length) {
    console.log(`\n[decisions] ${orphans.length} bug bị Rejected/Won't-Do mà CHƯA có lý do lưu lại:`);
    orphans.slice(0, MAX_ROWS).forEach((b) => console.log(`  ‼ ${b.id} [${b.module}] "${String(b.bug || '').slice(0, 70)}" (${b.jira_status})`));
    console.log('    → Ghi 1 quyết định `false_positive`/`by_design` kèm lý do dev đưa ra, nếu không task sau sẽ log lại đúng bug này.');
  } else if (bugs.length) {
    console.log('[decisions] ✓ Không có bug Rejected nào bị bỏ trống lý do.');
  }
  const expired = decisions.map((r) => r.data || {}).filter((d) => d.status === 'active' && d.expires_at && String(d.expires_at) < TODAY);
  if (expired.length) {
    console.log(`\n[decisions] ${expired.length} quyết định ĐÃ QUÁ HẠN nhưng còn active (phải kiểm lại — điều kiện có thể đã thay đổi):`);
    expired.slice(0, MAX_ROWS).forEach((d) => console.log(`  ~ ${d.id} hết hạn ${d.expires_at}: ${String(d.subject).slice(0, 70)}`));
  }
}

if (flag('index')) {
  const idxFile = path.join(KNOW, 'index.json');
  const idx = readJson(idxFile);
  const doc = idx && !idx.__err ? idx : { version: 1, updated_at: null, entries: [] };
  doc.entries = doc.entries || [];
  let n = 0;
  for (const r of decisions) {
    const d = r.data || {};
    if (!d.id) continue;
    const rec = {
      type: 'decision', subtype: d.type, file: r.rel.replace(/^knowledge\//, ''),
      modules: (d.scope || {}).modules || [], tags: d.tags || [], status: d.status,
      summary: String(d.subject || '').slice(0, 120),
    };
    const i = doc.entries.findIndex((x) => x && x.file === rec.file);
    if (i >= 0) doc.entries[i] = rec; else { doc.entries.push(rec); n += 1; }
  }
  // Dọn entry TRỎ FILE ĐÃ BỊ XOÁ (chỉ của type này) — indexer trước đây chỉ thêm/sửa nên xoá 1 record
  // là index còn trỏ vào hư không, tra cứu ra kết quả ma.
  const before = doc.entries.length;
  doc.entries = doc.entries.filter((e) => !(e && e.type === 'decision') || fs.existsSync(path.join(KNOW, e.file)));
  const pruned = before - doc.entries.length;
  if (pruned) console.log(`[decisions] dọn ${pruned} entry trỏ file đã bị xoá.`);
  doc.updated_at = TODAY;
  fs.writeFileSync(idxFile, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  console.log(`\n[decisions] index.json: +${n} entry decision (tổng ${doc.entries.length}).`);
}

if (warnings.length) { console.log(`\n⚠ ${warnings.length} cảnh báo:`); warnings.forEach((w) => console.log(`  ~ ${w}`)); }
if (problems.length) {
  console.log(`\n✗ ${problems.length} lỗi CHẶN:`);
  problems.forEach((p) => console.log(`  - ${p}`));
  console.log('\nSchema: knowledge/SCHEMA.md §decisions/. Quyết định không có `rationale` thì đừng ghi — lần sau vẫn phải điều tra lại.');
  if (ENFORCE) process.exit(1);
} else if (decisions.length) {
  console.log('\n✓ Mọi quyết định hợp schema (có lý do, có người chốt, khoanh phạm vi, không PII).');
}
process.exit(0);
