#!/usr/bin/env node
'use strict';

/*
 * system_map.js — quản lý `knowledge/system/`: bản đồ HỆ THỐNG đã được xác nhận.
 *   state_machine     — entity có những state nào + chuyển state nào là HỢP PHÁP
 *   permission_matrix — role nào được làm action nào
 *   shared_surface    — API/component/bảng/job dùng CHUNG bởi ≥2 module
 *
 * VÌ SAO CẦN: `domain/` lưu "giá trị đúng là gì", nhưng nhiều câu hỏi khi test KHÔNG phải về giá trị mà
 * về HỆ THỐNG: "API cho hủy order đã PAID — bug hay đúng thiết kế?", "GV gọi được endpoint của Admin —
 * có phải lỗ hổng?", "sửa API này thì phải regression những module nào?". Không có bản đồ thì agent
 * suy từ app (app cho làm ⇒ tưởng hợp pháp) — đúng thứ tautology kit cấm — hoặc log bug đoán rồi bị bounce.
 *
 * Khác `domain/` ở chỗ bản đồ này SINH RA NGHĨA VỤ TEST, không chỉ để đọc:
 *   - mọi cặp (from,to) KHÔNG khai trong `transitions` = chuyển state bất hợp pháp → PHẢI có case chứng minh bị chặn
 *   - mọi ô role×action KHÔNG có trong `allow` = phải 403/không đổi dữ liệu → PHẢI có case guard
 *   - `shared_surface` bị sửa → mọi `consumers` phải vào scope regression
 *
 * Dùng:
 *   npm run system:check                  # validate + matrix + gaps (report)
 *   npm run system:check -- --enforce     # lỗi schema/PII → exit 1
 *   node scripts/qa/system_map.js --impact "POST /api/v1/orders"   # ai bị ảnh hưởng nếu sửa surface này
 *   [--dir knowledge/system] [--matrix] [--gaps] [--index] [--tc-dir <dir>] [--task <TASK_KEY>] [--max <n>]
 */

const fs = require('fs');
const { getTestcaseDirs } = require('../utils/runtime_config');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const canonical = require(path.resolve(__dirname, '..', 'lib', 'testcase'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);
const ENFORCE = flag('enforce');
const REPO = rc.REPO_ROOT;
const KNOW = path.join(REPO, 'knowledge');
const DIR = path.resolve(arg('dir', path.join(KNOW, 'system')));
const MAX_ROWS = Math.max(1, Number(arg('max', 40)) || 40);

// `ui_contract` (UI-) = **oracle FE máy đọc được**, trích từ design. Vì sao thêm vào đây: BE có Swagger nên
// assertion là `total = 540000`, còn FE chỉ có Figma (hình ảnh) nên assertion thoái hoá thành `toBeVisible()`.
// Biến design thành contract có id/nguồn/ngày chốt là cách duy nhất để FE có oracle NGOÀI app — nếu không thì
// mọi phép kiểm FE đều so app với chính nó (tautology).
const TYPES = ['state_machine', 'permission_matrix', 'shared_surface', 'data_model', 'ui_contract'];
const PREFIX = { state_machine: 'SM', permission_matrix: 'PM', shared_surface: 'SS', data_model: 'DM', ui_contract: 'UI' };
const KINDS = ['api', 'component', 'table', 'job', 'config', 'library'];
const ID_RE = /^(SM|PM|SS|DM|UI)-[A-Z0-9]+-\d{3}$/;
const STATUSES = ['active', 'superseded', 'deprecated'];
const CONFIRMERS = ['BA', 'Dev', 'QA-Lead', 'PO'];
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /\b0\d{8,10}\b/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return { __err: e.message }; } }

function loadMaps() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: path.join(DIR, f), rel: path.relative(REPO, path.join(DIR, f)).replace(/\\/g, '/'), data: readJson(path.join(DIR, f)) }));
}

const pairKey = (a, b) => `${a} → ${b}`;

/** Governance chung cho cả 3 type (giống `domain/` để chỉ có 1 mô hình trong đầu). */
function validateCommon(d, at, problems, warnings) {
  if (!TYPES.includes(String(d.type || ''))) problems.push(at(`\`type\` phải ∈ ${TYPES.join('|')}`));
  else if (!ID_RE.test(String(d.id || '')) || String(d.id).split('-')[0] !== PREFIX[d.type]) {
    problems.push(at(`\`id\` "${d.id}" sai format — cần ${PREFIX[d.type]}-<SLUG>-<NNN> (vd ${PREFIX[d.type]}-ORDER-001) khớp với type`));
  }
  if (!Array.isArray(d.modules) || !d.modules.length) problems.push(at('thiếu `modules` (mảng, phải khớp cột Module của testcase để tra cứu/risk gom đúng)'));
  if (!String(d.source || '').trim()) problems.push(at('thiếu `source` — bản đồ KHÔNG truy nguyên được thì không được ghi vào knowledge (chống tự bịa)'));
  if (!CONFIRMERS.includes(String(d.confirmed_by || ''))) problems.push(at(`\`confirmed_by\` phải ∈ ${CONFIRMERS.join('|')} (ai CHỐT bản đồ này)`));
  if (!DATE_RE.test(String(d.confirmed_at || ''))) problems.push(at('`confirmed_at` phải là ISO date YYYY-MM-DD (dùng để phát hiện TC stale)'));
  if (!Number.isInteger(d.version) || d.version < 1) problems.push(at('`version` phải là số nguyên ≥ 1'));
  if (!STATUSES.includes(String(d.status || ''))) problems.push(at(`\`status\` phải ∈ ${STATUSES.join('|')}`));
  if (d.version > 1 && !String(d.supersedes || '').trim()) warnings.push(at(`version ${d.version} nhưng thiếu \`supersedes\` (nên ghi <id>@v${d.version - 1})`));
  const blob = JSON.stringify(d);
  if (EMAIL_RE.test(blob)) problems.push(at('có EMAIL trong nội dung — knowledge cấm PII khách (mask hoặc bỏ)'));
  if (PHONE_RE.test(blob)) problems.push(at('có SỐ ĐIỆN THOẠI trong nội dung — knowledge cấm PII khách'));
}

/** `expected` của case guard phải KIỂM ĐƯỢC: có mã lỗi / tên state / số cụ thể. */
const concreteExpected = (s, states) => {
  const t = String(s || '');
  if (/\b[45]\d\d\b/.test(t) || /\d/.test(t)) return true;
  return (states || []).some((st) => t.includes(st));
};

function validate(r) {
  const problems = []; const warnings = [];
  const d = r.data || {};
  const at = (m) => `${path.basename(r.file)}: ${m}`;
  if (d.__err) return { problems: [at(`JSON lỗi — ${d.__err}`)], warnings };
  validateCommon(d, at, problems, warnings);

  if (d.type === 'state_machine') {
    const states = Array.isArray(d.states) ? d.states.map(String) : [];
    if (states.length < 2) problems.push(at('`states` phải có ≥ 2 state (bản đồ 1 state là vô nghĩa)'));
    if (!String(d.entity || '').trim()) problems.push(at('thiếu `entity` (state machine của cái gì: Order, Class, Request…)'));
    const inStates = (s, where) => { if (s !== undefined && !states.includes(String(s))) problems.push(at(`${where}: state "${s}" không có trong \`states\``)); };
    if (d.initial !== undefined) inStates(d.initial, '`initial`');
    (Array.isArray(d.terminal) ? d.terminal : []).forEach((s) => inStates(s, '`terminal`'));
    const trs = Array.isArray(d.transitions) ? d.transitions : [];
    if (!trs.length) problems.push(at('thiếu `transitions` — không khai chuyển state HỢP PHÁP thì không suy ra được cái bất hợp pháp'));
    const seenTr = new Set();
    trs.forEach((t, i) => {
      if (!t || typeof t !== 'object') { problems.push(at(`transitions[${i}] phải là object {from,to,trigger}`)); return; }
      inStates(t.from, `transitions[${i}].from`); inStates(t.to, `transitions[${i}].to`);
      if (!String(t.trigger || '').trim()) problems.push(at(`transitions[${i}] thiếu \`trigger\` (hành động/API nào gây chuyển state)`));
      if (!Array.isArray(t.covered_by)) problems.push(at(`transitions[${i}] thiếu \`covered_by\` (mảng TC ID, rỗng cũng được — mắt xích trace ngược)`));
      const k = pairKey(t.from, t.to);
      if (seenTr.has(k)) warnings.push(at(`transitions có 2 dòng cùng ${k} — gộp lại hoặc phân biệt bằng \`guard\``));
      seenTr.add(k);
    });
    (Array.isArray(d.illegal_verified) ? d.illegal_verified : []).forEach((t, i) => {
      if (!t || typeof t !== 'object') { problems.push(at(`illegal_verified[${i}] phải là object {from,to,expected}`)); return; }
      inStates(t.from, `illegal_verified[${i}].from`); inStates(t.to, `illegal_verified[${i}].to`);
      if (seenTr.has(pairKey(t.from, t.to))) problems.push(at(`illegal_verified[${i}] ${pairKey(t.from, t.to)} lại có trong \`transitions\` — vừa hợp pháp vừa bất hợp pháp thì bản đồ sai`));
      if (!concreteExpected(t.expected, states)) problems.push(at(`illegal_verified[${i}].expected phải KIỂM ĐƯỢC (mã lỗi 4xx/5xx, tên state giữ nguyên, hoặc số cụ thể) — "${String(t.expected || '').slice(0, 40)}"`));
      if (!Array.isArray(t.covered_by)) problems.push(at(`illegal_verified[${i}] thiếu \`covered_by\``));
    });
  } else if (d.type === 'permission_matrix') {
    const roles = Array.isArray(d.roles) ? d.roles.map(String) : [];
    const actions = Array.isArray(d.actions) ? d.actions.map(String) : [];
    if (!roles.length) problems.push(at('thiếu `roles`'));
    if (!actions.length) problems.push(at('thiếu `actions`'));
    if (!d.allow || typeof d.allow !== 'object' || Array.isArray(d.allow)) problems.push(at('`allow` phải là object {role: [action,…]} — ô KHÔNG khai = deny (phải bị chặn)'));
    else {
      for (const [role, acts] of Object.entries(d.allow)) {
        if (!roles.includes(role)) problems.push(at(`\`allow\` có role "${role}" không khai trong \`roles\``));
        if (!Array.isArray(acts)) { problems.push(at(`\`allow["${role}"]\` phải là mảng action`)); continue; }
        acts.filter((a) => !actions.includes(String(a))).forEach((a) => problems.push(at(`\`allow["${role}"]\` có action "${a}" không khai trong \`actions\``)));
      }
      roles.filter((r2) => d.allow[r2] === undefined).forEach((r2) => warnings.push(at(`role "${r2}" không có khoá trong \`allow\` — hiểu là DENY TẤT CẢ; khai \`"${r2}": []\` cho rõ ý`)));
    }
    if (!concreteExpected(d.deny_expected, [])) problems.push(at('`deny_expected` phải kiểm được (vd "403 + dữ liệu không đổi") — đây là oracle của mọi case guard'));
    if (d.covered_by && (typeof d.covered_by !== 'object' || Array.isArray(d.covered_by))) problems.push(at('`covered_by` của permission_matrix là object {"role:action": [TC…]}'));
    Object.keys(d.covered_by || {}).filter((k) => !/^[^:]+:[^:]+$/.test(k)).forEach((k) => problems.push(at(`\`covered_by\` khoá "${k}" sai format, cần "role:action"`)));
  } else if (d.type === 'shared_surface') {
    if (!String(d.surface || '').trim()) problems.push(at('thiếu `surface` (tên API/component/bảng/job dùng chung)'));
    if (!KINDS.includes(String(d.kind || ''))) problems.push(at(`\`kind\` phải ∈ ${KINDS.join('|')}`));
    const cons = Array.isArray(d.consumers) ? d.consumers : [];
    if (cons.length < 2) problems.push(at(`\`consumers\` phải có ≥ 2 module — chỉ 1 consumer thì không phải surface DÙNG CHUNG (hiện ${cons.length})`));
    if (d.paths !== undefined && !Array.isArray(d.paths)) problems.push(at('`paths` (tuỳ chọn) phải là mảng glob đường dẫn code, để đối chiếu git-impact'));
    if (!String(d.risk_note || '').trim()) warnings.push(at('thiếu `risk_note` — nên ghi "sửa cái này thì hỏng chỗ nào"'));
  } else if (d.type === 'data_model') {
    // CÁCH SẢN PHẨM TỔ CHỨC DỮ LIỆU — không phải "giá trị đúng" (`domain/`) cũng không phải "được phép làm gì".
    // Đây là thứ quyết định test viết ĐÚNG HAY SAI NGAY TỪ ĐẦU. Ca thật: OPS Learning Schedule dùng version
    // snapshot — mỗi lần Save/Edit sinh version mới VÀ lesson-id mới, nên sau mutation phải resolve theo TÊN;
    // không biết thì test dùng lại id cũ, fail, rồi bị tưởng là bug sản phẩm.
    if (!String(d.entity || '').trim()) problems.push(at('thiếu `entity` (mô hình dữ liệu của cái gì)'));
    if (!String(d.model || '').trim()) problems.push(at('thiếu `model` — phát biểu cách dữ liệu được tổ chức (vd "version snapshot: mỗi lần sửa sinh bản ghi mới")'));
    // Trường quan trọng nhất: mô hình này BẮT test phải làm gì khác đi. Không có nó thì record chỉ là mô tả.
    if (!String(d.test_implication || '').trim()) problems.push(at('thiếu `test_implication` — mô hình dữ liệu chỉ có giá trị khi nói RÕ nó bắt test phải làm khác đi thế nào (vd "sau mutation resolve theo TÊN, KHÔNG dùng lại id")'));
    if (!Array.isArray(d.pitfalls) || !d.pitfalls.length) warnings.push(at('`pitfalls` rỗng — nên ghi cái bẫy đã vấp (thứ khiến người sau mất thời gian)'));
  } else if (d.type === 'ui_contract') {
    // ORACLE FE. Bắt buộc: màn nào, và tập nhãn theo từng khối — vì đó là thứ đối chiếu được bằng máy.
    if (!String(d.screen || '').trim()) problems.push(at('thiếu `screen` (contract này nói về màn nào)'));
    const secs = Array.isArray(d.sections) ? d.sections : [];
    if (!secs.length) problems.push(at('thiếu `sections` — contract FE không có tập nhãn thì không đối chiếu được gì'));
    secs.forEach((sec, i) => {
      if (!String(sec.heading || '').trim()) problems.push(at(`sections[${i}] thiếu \`heading\``));
      if (!Array.isArray(sec.labels) || !sec.labels.length) problems.push(at(`sections[${i}] (${sec.heading || '?'}) thiếu \`labels\``));
    });
    // Tên trong DESIGN ≠ tên trên BUILD là chuyện thường (đã trả giá ở `sectionAliases`: FSD tiếng Việt vs OPS
    // tiếng Anh). Không có chỗ khai alias thì contract sẽ ra một rừng "không tìm thấy" rồi bị bỏ.
    if (d.aliases === undefined || typeof d.aliases !== 'object') problems.push(at('thiếu `aliases` (object, rỗng cũng được) — tên trong design thường KHÁC tên render trên build'));
    if (!String(d.extraction || '').trim()) warnings.push(at('thiếu `extraction` — nên ghi nhãn được trích BẰNG MÁY hay gõ tay, để người sau biết mức tin cậy'));
  }
  return { problems, warnings };
}

/** TC ID thật từ testcase canonical (theo task hoặc --tc-dir) — dùng để bắt TC ma. */
function realTcIds() {
  const ids = new Set();
  const dirs = [];
  const explicit = arg('tc-dir');
  if (explicit) dirs.push(path.resolve(explicit));
  const TASK = arg('task', process.env.TASK_KEY || '');
  const POD = process.env.PROJECT_OUTPUT_DIR || '';
  if (TASK && POD) {
    dirs.push(...getTestcaseDirs(path.resolve(REPO, POD, 'tasks', TASK)));
  }
  if (!explicit && !(TASK && POD)) {
    const outputs = path.join(REPO, 'outputs');
    if (fs.existsSync(outputs)) {
      for (const proj of fs.readdirSync(outputs)) {
        const tasksDir = path.join(outputs, proj, 'tasks');
        if (!fs.existsSync(tasksDir)) continue;
        for (const t of fs.readdirSync(tasksDir)) {
          dirs.push(...getTestcaseDirs(path.join(tasksDir, t)));
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
        if (doc && typeof doc.then === 'function') {
          console.warn(`[system-map] BỎ QUA ${f}: parseXlsx là async nhưng hàm này chạy sync ⇒ TC ID trong file này KHÔNG được tính. Dùng bản .md.`);
          doc = null;
        }
        for (const t of (doc && doc.tests) || []) if (t.tcId) ids.add(String(t.tcId));
      } catch (e) { /* file không phải bảng testcase → bỏ qua */ }
    }
  }
  return ids;
}

/** Ma trận state: ô có trigger = hợp pháp, ô trống = BẤT HỢP PHÁP (nghĩa vụ test guard). */
function printMatrix(d) {
  const states = d.states.map(String);
  const legal = new Map();
  for (const t of d.transitions || []) legal.set(pairKey(t.from, t.to), String(t.trigger));
  const term = new Set(Array.isArray(d.terminal) ? d.terminal.map(String) : []);
  console.log(`\n[system] ${d.id} · ${d.entity} (${states.length} state, ${(d.transitions || []).length} chuyển hợp pháp)`);
  if (states.length <= 8) {
    console.log(`         ${'from ↓ / to →'.padEnd(20)}${states.map((s) => s.slice(0, 11).padEnd(13)).join('')}`);
    for (const f of states) {
      const cells = states.map((t) => (f === t ? '—' : (legal.get(pairKey(f, t)) || '·')).slice(0, 11).padEnd(13));
      console.log(`         ${`${f}${term.has(f) ? ' ⚑' : ''}`.padEnd(20)}${cells.join('')}`);
    }
    console.log('         (trigger = hợp pháp · "·" = BẤT HỢP PHÁP, phải có case chứng minh bị chặn · ⚑ terminal)');
  } else {
    for (const t of d.transitions || []) console.log(`         ✓ ${pairKey(t.from, t.to)}  [${t.trigger}]${t.roles ? ` roles=${t.roles.join(',')}` : ''}`);
    console.log(`         (${states.length} state → không in ma trận; cặp không liệt kê ở trên là BẤT HỢP PHÁP)`);
  }
}

const maps = loadMaps();
console.log(`[system] ${maps.length} bản đồ trong ${path.relative(REPO, DIR)}`);
if (!maps.length) {
  console.log('[system] Chưa có bản đồ hệ thống nào. Ghi bản đồ ĐÃ ĐƯỢC XÁC NHẬN (skill `system_mapper`) —');
  console.log('         nguồn tự nhiên nhất: FSD/BRD + câu trả lời của BA/Dev khi Ambiguity Gate RESOLVED.');
  console.log('         Schema + ví dụ: knowledge/SCHEMA.md §system/.');
  process.exit(0);
}

let problems = []; let warnings = [];
for (const r of maps) { const v = validate(r); problems = problems.concat(v.problems); warnings = warnings.concat(v.warnings); }

// trùng id@version + nhiều bản active cùng id
const seen = new Map();
const activeById = {};
for (const r of maps) {
  const d = r.data || {};
  const k = `${d.id}@v${d.version}`;
  if (seen.has(k)) problems.push(`TRÙNG ${k}: ${path.basename(seen.get(k))} và ${path.basename(r.file)} — mỗi id+version chỉ 1 file`);
  else seen.set(k, r.file);
  if (d.status === 'active' && d.id) activeById[d.id] = (activeById[d.id] || 0) + 1;
}
Object.entries(activeById).filter(([, n]) => n > 1).forEach(([id, n]) => problems.push(`${id}: có ${n} bản \`active\` — chỉ được 1 (bản cũ đổi thành \`superseded\`)`));

const wantReport = !flag('index') && !flag('impact') && !flag('validate');
if (flag('matrix') || wantReport) {
  for (const r of maps) if (r.data && r.data.type === 'state_machine' && Array.isArray(r.data.states)) printMatrix(r.data);
}

if (flag('gaps') || wantReport) {
  const real = realTcIds();
  const gaps = []; const ghosts = [];
  const checkTc = (id, list, where) => (list || []).filter((tc) => real.size && !real.has(String(tc))).forEach((tc) => ghosts.push(`${id} ${where}: \`covered_by\` trỏ TC KHÔNG TỒN TẠI "${tc}"`));
  for (const r of maps) {
    const d = r.data || {};
    if (d.status !== 'active') continue;
    if (d.type === 'state_machine' && Array.isArray(d.states)) {
      const states = d.states.map(String);
      const legal = new Set((d.transitions || []).map((t) => pairKey(t.from, t.to)));
      const verified = new Map();
      (d.illegal_verified || []).forEach((t) => verified.set(pairKey(t.from, t.to), t));
      const term = new Set(Array.isArray(d.terminal) ? d.terminal.map(String) : []);
      (d.transitions || []).forEach((t, i) => {
        checkTc(d.id, t.covered_by, `transitions[${i}]`);
        if (Array.isArray(t.covered_by) && !t.covered_by.length) gaps.push({ p: 2, m: `${d.id} · chuyển HỢP PHÁP ${pairKey(t.from, t.to)} [${t.trigger}] chưa có TC nào` });
      });
      (d.illegal_verified || []).forEach((t, i) => checkTc(d.id, t.covered_by, `illegal_verified[${i}]`));
      for (const f of states) for (const t of states) {
        if (f === t || legal.has(pairKey(f, t))) continue;
        const v = verified.get(pairKey(f, t));
        if (v && Array.isArray(v.covered_by) && v.covered_by.length) continue;
        // ưu tiên cặp xuất phát từ state terminal: đó là chỗ sinh bug toàn vẹn dữ liệu (vd huỷ đơn đã thanh toán)
        gaps.push({ p: term.has(f) ? 0 : 1, m: `${d.id} · ${pairKey(f, t)} BẤT HỢP PHÁP${term.has(f) ? ' (từ state terminal ⚑)' : ''} — chưa có case chứng minh hệ thống CHẶN` });
      }
    } else if (d.type === 'permission_matrix') {
      const roles = (d.roles || []).map(String); const actions = (d.actions || []).map(String);
      Object.values(d.covered_by || {}).forEach((list, i) => checkTc(d.id, list, `covered_by[${i}]`));
      for (const role of roles) for (const a of actions) {
        const allowed = Array.isArray(d.allow && d.allow[role]) && d.allow[role].map(String).includes(a);
        const cov = (d.covered_by || {})[`${role}:${a}`];
        if (Array.isArray(cov) && cov.length) continue;
        gaps.push({ p: allowed ? 2 : 0, m: `${d.id} · ${role} × ${a} = ${allowed ? 'ALLOW' : 'DENY'} — chưa có TC${allowed ? '' : ` (guard, kỳ vọng: ${d.deny_expected})`}` });
      }
    } else if (d.type === 'shared_surface') {
      checkTc(d.id, d.covered_by, 'covered_by');
    }
  }
  gaps.sort((a, b) => a.p - b.p);
  console.log(`\n[system] Nghĩa vụ test còn TRỐNG: ${gaps.length}`);
  gaps.slice(0, MAX_ROWS).forEach((g) => console.log(`  ${g.p === 0 ? '‼' : '~'} ${g.m}`));
  if (gaps.length > MAX_ROWS) console.log(`  … còn ${gaps.length - MAX_ROWS} dòng nữa (đã cắt để dễ đọc — xem hết: --max ${gaps.length})`);
  if (ghosts.length) { console.log(`\n[system] TC ma (${ghosts.length}):`); ghosts.slice(0, MAX_ROWS).forEach((g) => console.log(`  ~ ${g}`)); }
  if (real.size) console.log(`[system] (đối chiếu với ${real.size} TC ID thật trong testcase canonical)`);
  else console.log('[system] (không tìm thấy testcase canonical → không kiểm được TC ma; chạy kèm --task <TASK_KEY> hoặc --tc-dir)');
}

if (flag('impact')) {
  const needle = String(arg('impact', '')).toLowerCase();
  const hits = [];
  if (needle) {
    for (const r of maps) {
      const d = r.data || {};
      if (d.type !== 'shared_surface' || d.status !== 'active') continue;
      const hay = [d.surface, ...(d.paths || []), ...(d.consumers || [])].join(' ').toLowerCase();
      if (hay.includes(needle)) hits.push(d);
    }
  }
  console.log(`\n[system] Impact của "${arg('impact', '')}": ${hits.length} surface dùng chung`);
  for (const d of hits) {
    console.log(`  • ${d.id} ${d.surface} (${d.kind}) → PHẢI regression: ${d.consumers.join(', ')}`);
    if (d.risk_note) console.log(`      lý do: ${d.risk_note}`);
  }
  if (!hits.length) console.log('  (không khớp surface nào — KHÔNG có nghĩa là an toàn, chỉ nghĩa là chưa ai khai surface này vào knowledge/system/)');
}

if (flag('index')) {
  const idxFile = path.join(KNOW, 'index.json');
  const idx = readJson(idxFile);
  const doc = idx && !idx.__err ? idx : { version: 1, updated_at: null, entries: [] };
  doc.entries = doc.entries || [];
  let n = 0;
  for (const r of maps) {
    const d = r.data || {};
    if (!d.id) continue;
    const rec = {
      type: 'system_map', subtype: d.type, file: r.rel.replace(/^knowledge\//, ''),
      modules: d.modules || [], tags: d.tags || [], status: `${d.status}@v${d.version}`,
      summary: d.type === 'state_machine' ? `${d.entity}: ${(d.states || []).length} state` : d.type === 'permission_matrix' ? `${(d.roles || []).length} role × ${(d.actions || []).length} action` : `${d.surface} → ${(d.consumers || []).length} consumer`,
    };
    const i = doc.entries.findIndex((x) => x && x.file === rec.file);
    if (i >= 0) doc.entries[i] = rec; else { doc.entries.push(rec); n += 1; }
  }
  // Dọn entry TRỎ FILE ĐÃ BỊ XOÁ (chỉ của type này) — indexer trước đây chỉ thêm/sửa nên xoá 1 record
  // là index còn trỏ vào hư không, tra cứu ra kết quả ma.
  const before = doc.entries.length;
  doc.entries = doc.entries.filter((e) => !(e && e.type === 'system_map') || fs.existsSync(path.join(KNOW, e.file)));
  const pruned = before - doc.entries.length;
  if (pruned) console.log(`[system] dọn ${pruned} entry trỏ file đã bị xoá.`);
  doc.updated_at = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(idxFile, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  console.log(`\n[system] index.json: +${n} entry system_map (tổng ${doc.entries.length}).`);
}

if (warnings.length) { console.log(`\n⚠ ${warnings.length} cảnh báo:`); warnings.forEach((w) => console.log(`  ~ ${w}`)); }
if (problems.length) {
  console.log(`\n✗ ${problems.length} lỗi CHẶN:`);
  problems.forEach((p) => console.log(`  - ${p}`));
  console.log('\nSchema: knowledge/SCHEMA.md §system/. Bản đồ không truy nguyên được (thiếu source/confirmed_by) thì ĐỪNG ghi vào knowledge.');
  if (ENFORCE) process.exit(1);
} else {
  console.log('\n✓ Mọi bản đồ hợp schema (có source, không PII, vòng đời nhất quán).');
}
process.exit(0);
