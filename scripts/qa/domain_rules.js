#!/usr/bin/env node
'use strict';

/*
 * domain_rules.js — quản lý `knowledge/domain/` (business rule đã XÁC NHẬN = nền của oracle).
 *
 * VÌ SAO CẦN: kit CẤM oracle tautological (expected phải từ spec/business rule, không suy từ app —
 * prompt gen §12/§13 + `output_gate.looksTautology`). Nhưng nếu không lưu "đúng là gì" thì agent phải
 * đọc lại Backlog/tài liệu nguồn mỗi lần (dễ miss) hoặc suy từ app (rơi đúng vào tautology bị cấm).
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
const { getTestcaseDirs } = require('../utils/runtime_config');
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
/*
 * `invalid` thêm 25/08/2026 — KHÁC hẳn `superseded`:
 *   superseded = rule ĐÚNG ở thời điểm đó, nghiệp vụ đổi ⇒ có bản mới. Kết quả TC cũ VẪN có giá trị (nó
 *               pass theo rule đang hiệu lực lúc chạy).
 *   invalid    = rule SAI TỪ ĐẦU (đọc nhầm FSD, BA nói lại, suy từ app). Mọi TC từng dùng nó làm oracle
 *               phải bị REVIEW LẠI — không phải chỉ chạy lại: chạy lại theo oracle sai thì vẫn sai.
 * Trước đó chỉ sửa được bằng tay (đổi status hoặc xoá file) ⇒ không có vết ai gỡ và vì sao.
 */
const STATUSES = ['active', 'superseded', 'deprecated', 'invalid'];
const CONFIRMERS = ['BA', 'Dev', 'QA-Lead', 'PO'];
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

// Dấu hiệu expected CÓ thứ để đối chiếu: số, chuỗi nguyên văn trong ngoặc, tên field/property, hoặc khẳng
// định RỖNG (một oracle hợp lệ — "cột công phải TRỐNG, không phải 0").
// Không dùng `\b` với cụm có dấu: "đ"/"ẩ" không phải word-char trong regex JS ⇒ biên không bao giờ khớp.
const CONCRETE_RE = /\d|["'“”]|[a-z]+_[a-z_]+|(rỗng|để trống|không hiển thị|không có giá trị|không gửi|không tạo|không đổi|CHẶN|CHO PHÉP)/i;
// Thứ cần bắt: expected chỉ nói "được/đúng/thành công" rồi hết — PASS cả khi hệ thống làm sai.
const VAGUE_RE = /(thành công|đúng|hợp lệ|bình thường|như mong đợi|không lỗi|\bok\b|\bpass\b)/i;
const isVagueExpected = (s) => VAGUE_RE.test(s) && !CONCRETE_RE.test(s);

// TC ID có dạng <PREFIX>_<số>; prefix cho biết bộ testcase nào. Dùng để biết một scan có ĐỦ THẨM QUYỀN phán
// "TC không tồn tại" hay không.
const tcPrefix = (id) => String(id).replace(/[_-]?\d+$/, '');
const PHONE_RE = /\b0\d{8,10}\b/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return { __err: e.message }; } }

function loadRules() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: path.join(DIR, f), rel: path.relative(REPO, path.join(DIR, f)).replace(/\\/g, '/'), data: readJson(path.join(DIR, f)) }));
}


/*
 * SỬA TẠI CHỖ MÀ KHÔNG BUMP `confirmed_at` — lỗ thật của `--stale`.
 * `--stale` so `confirmed_at` với lần execute cuối của TC. Nghĩa là ai mở file sửa một câu trong
 * `statement`/`examples` rồi lưu, KHÔNG đổi `confirmed_at`, thì: oracle đã khác, mà không TC nào bị đánh
 * dấu phải chạy lại. Không gate nào bắt — vì không có gì để so.
 * Cách bịt: `content_sha` = hash của phần NỘI DUNG (bỏ metadata seal). Lệch hash ⇒ nội dung đã đổi sau lần
 * seal ⇒ bắt buộc bump `confirmed_at` rồi `--seal` lại. Đây là thứ duy nhất phân biệt được "rule đổi có
 * chủ đích" với "ai đó sửa tay rồi quên".
 */
const crypto = require('crypto');
const SEAL_FIELDS = ['content_sha', 'sealed_at'];
function contentSha(d) {
  const body = {};
  for (const k of Object.keys(d).sort()) if (!SEAL_FIELDS.includes(k)) body[k] = d[k];
  return crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16);
}

/*
 * ① MÂU THUẪN GIỮA HAI RULE ACTIVE. Đây là loại sai KHÓ nhất: cả hai rule đều có `source`, đều qua
 * validate, nhưng nói trái nhau ⇒ agent dùng rule nào tìm thấy trước ⇒ oracle sai một cách IM LẶNG.
 * Không thể đối chiếu ngữ nghĩa bằng máy, nên đây là HEURISTIC có chủ đích: cùng module + trùng ≥2 từ khoá
 * chủ đề + một bên có từ phủ định mà bên kia không ⇒ nghi vấn, buộc người xem lại. Chỉ CẢNH BÁO, không chặn:
 * báo oan mà chặn thì người ta tắt cả gate.
 */
const NEG_RE = /\b(khong|chua|cam|tu choi|bi chan|khong duoc|loai tru|ngoai tru)\b/;
const STOP = new Set(['duoc', 'phai', 'khi', 'cua', 'thi', 'neu', 'cho', 'voi', 'trong', 'tren', 'theo', 'moi', 'cac', 'nay', 'gia', 'tri', 'va', 'la', 'co']);
/*
 * CHỈ lấy từ trong `statement`. Bản đầu gộp cả `title` + `tags` ⇒ hai rule khác hẳn chủ đề vẫn "khớp 2 từ"
 * nhờ trùng tag (`discount`) + một động từ chung (`nhan` trong "ghi nhan" vs "xac nhan") ⇒ BÁO OAN ngay ca
 * thử thứ hai. Tag quá thô để làm bằng chứng cùng-chủ-đề; nó chỉ đủ để cho phép SO SÁNH, không đủ để kết luận.
 */
function topicWords(d) {
  // FIELD THẬT là `rule`, KHÔNG phải `statement`. Bản đầu tôi đọc `d.statement` — field không tồn tại trên
  // record thật ⇒ topicWords luôn RỖNG ⇒ gate in "0 mâu thuẫn" trên kho 18 rule mà thực chất KHÔNG ĐO GÌ.
  // Đúng lớp lỗi tệ nhất: máy báo sạch vì nó mù, không vì kho sạch.
  const raw = String(d.rule || d.statement || '');
  const norm = String(raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return new Set(norm.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w)));
}
function findConflicts(list) {
  const active = list.map((r) => r.data || {}).filter((d) => d.id && String(d.status || 'active') === 'active');
  const out = [];
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i]; const b = active[j];
      if (String(a.module || '') !== String(b.module || '')) continue;
      const ta = topicWords(a); const tb = topicWords(b);
      const shared = [...ta].filter((w) => tb.has(w));
      /*
       * Hai điều kiện, không chỉ một: đủ SỐ từ chung (≥2) VÀ đủ TỈ LỆ trùng trên câu ngắn hơn (≥0.35).
       * Chỉ đếm số thì hai câu dài bất kỳ cũng dễ chung 2 từ. Đo trên fixture: cặp trái nhau thật (cùng câu,
       * khác đúng chữ phủ định) có tỉ lệ ~1.0; cặp khác chủ đề chỉ ~0.1.
       */
      const ratio = shared.length / Math.max(1, Math.min(ta.size, tb.size));
      if (shared.length < 2 || ratio < 0.35) continue;
      /*
       * `applies_when` là ĐIỀU KIỆN ÁP DỤNG. Hai rule cùng chủ đề mà điều kiện khác nhau ("khi VIP" vs
       * "khi thường") KHÔNG mâu thuẫn — chúng là hai nhánh của cùng một quy tắc. Chỉ nghi khi điều kiện
       * GIỐNG nhau (hoặc cả hai đều để trống) mà kết luận trái chiều.
       */
      const cond = (x) => String(x.applies_when || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
      if (cond(a) !== cond(b)) continue;
      const na = NEG_RE.test(String(a.rule || a.statement || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      const nb = NEG_RE.test(String(b.rule || b.statement || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      if (na === nb) continue;                                   // cùng chiều khẳng định/phủ định ⇒ bỏ
      out.push({ a: a.id, b: b.id, module: a.module, shared: shared.slice(0, 4) });
    }
  }
  return out;
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
  // Seal: có `content_sha` mà lệch ⇒ nội dung đã bị sửa sau lần seal.
  if (String(d.content_sha || '').trim()) {
    const now = contentSha(d);
    if (now !== d.content_sha) {
      problems.push(at(`nội dung ĐÃ ĐỔI sau lần seal (\`content_sha\` ${d.content_sha} ≠ ${now}) mà không seal lại. Nếu đổi có chủ đích: bump \`confirmed_at\` rồi chạy \`npm run domain:check -- --seal\` (để \`--stale\` đánh dấu TC phải chạy lại). Nếu không cố ý đổi: hoàn nguyên nội dung.`));
    }
  }
  if (d.status === 'invalid') {
    // Go mot oracle la quyet dinh nang — phai de lai vet doc duoc, khong duoc go im lang.
    if (!String(d.invalidated_reason || '').trim()) problems.push(at('`status: invalid` PHAI co `invalidated_reason` — vi sao rule nay SAI TU DAU (doc nham tai lieu? BA noi lai? suy tu app?)'));
    if (!DATE_RE.test(String(d.invalidated_at || ''))) problems.push(at('`status: invalid` PHAI co `invalidated_at` (ISO date) — moc de biet ket qua TC nao can review lai'));
  }

  // examples: thứ biến rule thành oracle dùng được → phải có input + expected cụ thể.
  // Bản đầu đòi `expected` phải chứa CHỮ SỐ. Đo trên rule thật (FSD Bảo lưu/Transaction) thì luật đó báo oan
  // 12/26 lần: "Refund Amount = rỗng", "Edit: CHẶN", "VietQR sinh theo tài khoản SCMA" đều là oracle đối chiếu
  // được mà không có số nào. Nên đảo chiều: KHÔNG đòi dấu hiệu cụ thể, mà bắt đúng thứ cần bắt — expected
  // chỉ nói "thành công/đúng/hợp lệ" rồi hết. (Cùng gốc lỗi với TAG_EVIDENCE.display trong lib/output_rules.js.)
  const ex = Array.isArray(d.examples) ? d.examples : [];
  if (!ex.length) problems.push(at('thiếu `examples` — rule không có cặp {input, expected} cụ thể thì KHÔNG dùng được làm oracle'));
  ex.forEach((e, i) => {
    if (!e || !String(e.input || '').trim() || !String(e.expected || '').trim()) problems.push(at(`examples[${i}] thiếu \`input\` hoặc \`expected\``));
    else if (isVagueExpected(String(e.expected))) warnings.push(at(`examples[${i}].expected chung chung ("${String(e.expected).slice(0, 40)}") — không có số/chuỗi nguyên văn/khẳng định rỗng nào để đối chiếu`));
  });

  if (d.version > 1 && !String(d.supersedes || '').trim()) warnings.push(at(`version ${d.version} nhưng thiếu \`supersedes\` (nên ghi <id>@v${d.version - 1} để lần theo lịch sử)`));
  if (d.status === 'active' && Array.isArray(d.covered_by) && !d.covered_by.length) warnings.push(at('rule active nhưng `covered_by` RỖNG — chưa có testcase nào dùng rule này làm oracle (coverage gap)'));

  const blob = JSON.stringify(d);
  if (EMAIL_RE.test(blob)) problems.push(at('có EMAIL trong nội dung — knowledge cấm PII khách (mask hoặc bỏ)'));
  if (PHONE_RE.test(blob)) problems.push(at('có SỐ ĐIỆN THOẠI trong nội dung — knowledge cấm PII khách'));
  return { problems, warnings };
}

/** TC ID thật từ testcase canonical (theo task hoặc --tc-dir). */
// Trả về TESTCASE ĐẦY ĐỦ (không chỉ ID) để dùng được cả `oracleRefs` + `dimensions` cho chiều TC→rule.
// Trước đây hàm này chỉ gom ID; tách ra thay vì viết bộ đi-file thứ hai — logic đi-file có bẫy riêng
// (file LOCK Excel, parseXlsx async) mà nhân bản là chắc chắn lệch.
function realTests() {
  const tests = [];
  const dirs = [];
  const explicit = arg('tc-dir');
  if (explicit) dirs.push(path.resolve(explicit));
  const TASK = arg('task', process.env.TASK_KEY || '');
  const POD = process.env.PROJECT_OUTPUT_DIR || '';
  if (TASK && POD) {
    dirs.push(...getTestcaseDirs(path.resolve(REPO, POD, 'tasks', TASK)));
  }
  if (!explicit && !(TASK && POD)) {
    // fallback: quét mọi task trong outputs (để dùng được cả khi không có TASK context)
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
        // Nói to ra thay vì im (sửa đúng = chuyển realTcIds + chỗ gọi top-level sang async).
        if (doc && typeof doc.then === 'function') {
          console.warn(`[domain] BỎ QUA ${f}: parseXlsx là async nhưng realTcIds chạy sync ⇒ TC ID trong file này KHÔNG được tính. Dùng bản .md.`);
          doc = null;
        }
        for (const t of (doc && doc.tests) || []) if (t.tcId) tests.push(t);
      } catch (e) { /* file không phải bảng testcase → bỏ qua */ }
    }
  }
  // DEDUP theo tcId: `from-sheet/` là bản mirror kéo từ Google Sheet của CÙNG bộ, nên gộp cả hai thư mục làm mỗi TC
  // xuất hiện 2 lần (đo: 550 cho 530 TC) ⇒ mọi con số đếm ở trace-back bị phồng. Bản ở `test-cases/` thắng.
  const byId = new Map();
  for (const t of tests) if (!byId.has(String(t.tcId))) byId.set(String(t.tcId), t);
  return [...byId.values()];
}

/** Chỉ tập TC ID — dựng từ `realTests()` để không tồn tại hai bộ đi-file song song. */
function realTcIds() { return new Set(realTests().map((t) => String(t.tcId))); }

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
  const scannedPrefixes = new Set([...real].map(tcPrefix));
  let outOfScopeRules = 0;
  for (const r of rules) {
    const d = r.data || {};
    if (!Array.isArray(d.covered_by)) continue;
    // Chỉ phán "TC không tồn tại" khi lượt quét này CÓ thẩm quyền: bộ testcase đang quét phải chứa cùng họ
    // TC ID (cùng prefix). Đo thực địa: trỏ --tc-dir vào một bộ pilot `BL_TC_*` khiến 15/15 rule bị báo oan
    // ghost-ref vì `covered_by` của chúng trỏ `OPS_PAY_TC_*` — nằm ở bộ canonical khác, không phải "không tồn tại".
    const ghosts = d.covered_by.filter((tc) => real.size && !real.has(String(tc)) && scannedPrefixes.has(tcPrefix(tc)));
    const outOfScope = d.covered_by.filter((tc) => real.size && !real.has(String(tc)) && !scannedPrefixes.has(tcPrefix(tc)));
    if (outOfScope.length) outOfScopeRules += 1;
    if (ghosts.length) warnings.push(`${d.id}: \`covered_by\` trỏ tới TC KHÔNG TỒN TẠI: ${ghosts.join(', ')} (rule nghĩ là đã test nhưng thực tế không)`);
    if (flag('stale') || !flag('trace')) {
      const stale = d.covered_by.filter((tc) => runs.has(String(tc)) && runs.get(String(tc)) < String(d.confirmed_at || ''));
      if (stale.length) warnings.push(`${d.id}: rule cập nhật ${d.confirmed_at} NHƯNG các TC sau execute trước đó → phải chạy lại: ${stale.join(', ')}`);
    }
  }
  // Nói thẳng phần KHÔNG kiểm được, để không ai đọc "0 ghost-ref" thành "đã đối chiếu hết".
  if (outOfScopeRules) console.log(`[domain] ⓘ ${outOfScopeRules} rule có \`covered_by\` trỏ họ TC ID không nằm trong lượt quét này (prefix khác) — KHÔNG kiểm ghost-ref cho chúng. Muốn kiểm đủ: chạy trên bộ canonical đầy đủ (bỏ --tc-dir).`);

  // STALE THEO LỊCH — khác hẳn stale ở trên.
  //   Trên: rule ĐỔI sau lần execute cuối ⇒ TC phải chạy lại. Chỉ nổ khi có người sửa rule.
  //   Dưới: rule KHÔNG ai chạm suốt N tháng. Business rule cũ không tự sai, nhưng sản phẩm thì đổi — một rule
  //   xác nhận 12 tháng trước mà chưa ai soi lại là **oracle có thể đã lạc hậu**, và nó im lặng vì không có
  //   sự kiện nào kích hoạt. Rule lạc hậu tệ hơn không có rule: nó làm mọi TC dựa vào nó sai theo, mà vẫn xanh.
  // Ngưỡng đổi bằng `--stale-months` (mặc định 9 — dưới 1 năm để còn kịp hỏi lại BA trước khi qua chu kỳ mới).
  // `Number(x) || 9` là bẫy: `--stale-months 0` cho Number = 0, mà 0 là falsy nên rơi về 9 ⇒ cờ bị bỏ qua
  // âm thầm. Phải kiểm chuỗi rỗng và tính hữu hạn riêng.
  const rawMonths = arg('stale-months', '');
  const months = rawMonths !== '' && Number.isFinite(Number(rawMonths)) ? Number(rawMonths) : 9;
  const cutoff = new Date(Date.now() - months * 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const old = rules
    .map((r) => r.data || {})
    .filter((d) => d.id && String(d.status || 'active') === 'active' && String(d.confirmed_at || '') && String(d.confirmed_at) < cutoff)
    .sort((a, b) => String(a.confirmed_at).localeCompare(String(b.confirmed_at)));
  for (const d of old) {
    const ageM = Math.round((Date.now() - Date.parse(d.confirmed_at)) / (30 * 24 * 3600 * 1000));
    warnings.push(`${d.id}: xác nhận ${d.confirmed_at} (~${ageM} tháng trước) và chưa ai soi lại — oracle có thể đã lạc hậu. Hỏi lại BA/dev rồi bump \`confirmed_at\`, hoặc chuyển \`status: superseded\` nếu đã thay.`);
  }
  if (!old.length) console.log(`[domain] ✓ không rule active nào cũ hơn ${months} tháng (ngưỡng --stale-months).`);
}

// ── CHIỀU NGƯỢC: TC → rule (mắt xích còn hở) ────────────────────────────────────────────────────────────
// Chiều rule→TC đã có (`--trace`: rule nào chưa có TC). Chiều TC→rule thì KHÔNG có gì: một case có oracle
// nghiệp vụ mà expected do agent tự suy, không trỏ về rule nào, thì hệ thống IM LẶNG.
//
// Đo 14/08/2026 vì sao đây là lỗ thật: **0/530 case** nhắc bất kỳ id rule nào, dù `§12` prompt gen ĐÃ yêu cầu
// "ghi id rule vào Kết quả mong đợi hoặc Assumptions" ⇒ quy định có, tuân thủ 0%, không máy nào kiểm. Trong
// 530 case đó có 47 case expected mang giá trị số/tiền/% (tức chắc chắn có oracle nghiệp vụ) và 0 case trỏ rule.
//
// Tín hiệu dùng để gác là TAG trong tiêu đề: `[Positive][Calc][BR-RECIPBANK-001] …` (model.oracleRefsOf).
// KHÔNG suy từ văn bản expected — hôm nay đã 3 lần chứng minh suy diễn tiếng Việt vừa thiếu recall vừa kém
// precision. Vì vậy: chỉ chạy được ở "chế độ NHÃN"; bộ chưa gắn tag chiều thì script nói rõ là chưa gác được
// thay vì im lặng cho qua (im lặng = cùng loại lỗi mà nó sinh ra để chống).
if (flag('trace-back')) {
  const tests = realTests();
  const byId = new Map(rules.map((r) => [(r.data || {}).id, r]).filter(([k]) => k));
  const ORACLE_DIMS = new Set(['calc', 'bedata', 'display', 'security', 'guard']);   // chiều chắc chắn cần oracle ngoài app
  const tagged = tests.filter((t) => (t.dimensions || []).some((d) => ORACLE_DIMS.has(d)));
  const withRef = tests.filter((t) => (t.oracleRefs || []).length);

  console.log(`[domain] trace-back: ${tests.length} TC · ${tagged.length} case mang tag chiều cần oracle · ${withRef.length} case có trỏ id rule`);

  if (!tagged.length && !withRef.length) {
    console.log('[domain] ⚠ CHƯA GÁC ĐƯỢC chiều TC→rule: không case nào mang tag chiều lẫn id rule.');
    console.log('[domain]   Bộ testcase phải gắn tag (xem §0b prompt gen: "[Positive][Calc][BR-XXX-001] …") thì mới kiểm được.');
    console.log('[domain]   Nói rõ chỗ này thay vì báo "✓ OK" — im lặng ở đây đúng là lỗi mà check này sinh ra để chống.');
  } else {
    const missing = tagged.filter((t) => !(t.oracleRefs || []).length);
    for (const t of missing.slice(0, 20)) {
      warnings.push(`${t.tcId}: mang tag chiều [${(t.dimensions || []).filter((d) => ORACLE_DIMS.has(d)).join(',')}] (cần oracle NGOÀI app) nhưng KHÔNG trỏ id rule/bản đồ nào — expected lấy từ đâu? Thêm tag \`[BR-...]\`/\`[SM-...]\` hoặc ghi rule vào knowledge/ trước.`);
    }
    if (missing.length > 20) warnings.push(`… và ${missing.length - 20} case nữa cùng loại.`);

    // Ghost ref: case trỏ tới id KHÔNG tồn tại trong knowledge → tưởng có oracle mà thực ra không.
    for (const t of withRef) {
      for (const ref of t.oracleRefs) {
        if (ref.startsWith('BR-') && !byId.has(ref)) warnings.push(`${t.tcId}: trỏ \`${ref}\` nhưng knowledge/domain KHÔNG có rule id này (oracle ma).`);
      }
    }

    // TỰ APPEND covered_by — hết phụ thuộc người nhớ điền. Chỉ ghi khi --apply.
    const APPLY = flag('apply');
    const added = [];
    for (const t of withRef) {
      for (const ref of t.oracleRefs) {
        const r = byId.get(ref);
        if (!r || !r.data) continue;
        const cb = Array.isArray(r.data.covered_by) ? r.data.covered_by : [];
        if (cb.includes(String(t.tcId))) continue;
        cb.push(String(t.tcId));
        r.data.covered_by = cb;
        r._dirty = true;
        added.push(`${ref} += ${t.tcId}`);
      }
    }
    if (added.length) {
      console.log(`[domain] ${APPLY ? 'GHI' : 'DRY-RUN'} tự append covered_by (${added.length}): ${added.slice(0, 12).join(' · ')}${added.length > 12 ? ' …' : ''}`);
      if (APPLY) for (const r of rules) if (r._dirty) fs.writeFileSync(r.file, `${JSON.stringify(r.data, null, 2)}\n`, 'utf8');
      else console.log('[domain]   Thêm --apply để ghi thật.');
    } else if (withRef.length) {
      console.log('[domain] ✓ mọi id rule được case trỏ tới đều đã có TC đó trong covered_by.');
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


// ── MÂU THUẪN GIỮA CÁC RULE ACTIVE (--conflict, mặc định BẬT trong lượt report) ───────────────────
// Loại sai này không do bịa: cả hai rule đều có source, đều qua validate, nhưng nói trái nhau. Agent dùng
// rule nào tìm thấy trước ⇒ oracle sai IM LẶNG. Máy không đối chiếu được ngữ nghĩa, nên chỉ nêu NGHI VẤN.
if (flag('conflict') || (!flag('index') && !flag('validate') && !flag('trace-back'))) {
  const conflicts = findConflicts(rules);
  for (const c of conflicts) {
    warnings.push(`NGHI MÂU THUẪN: \`${c.a}\` vs \`${c.b}\` — cùng module "${c.module}", cùng chủ đề (${c.shared.join(', ')}) mà một bên phủ định bên kia. Đọc lại cả hai: nếu một cái sai từ đầu ⇒ \`status: invalid\` + \`invalidated_reason\`; nếu nghiệp vụ đã đổi ⇒ bản cũ \`superseded\`; nếu cả hai đúng ở ngữ cảnh khác nhau ⇒ ghi rõ điều kiện áp dụng vào \`statement\`.`);
  }
  if (!conflicts.length) console.log('[domain] ✓ không cặp rule active nào có dấu hiệu mâu thuẫn (cùng module + cùng chủ đề + trái chiều).');
  else console.log(`[domain] ⓘ ${conflicts.length} cặp NGHI mâu thuẫn — heuristic, cần người đọc lại; máy không phán đúng/sai ngữ nghĩa.`);
}

// ── RULE INVALID ⇒ TC TỪNG DÙNG NÓ PHẢI REVIEW LẠI (không phải chỉ chạy lại) ──────────────────────
// Chạy lại theo một oracle SAI thì vẫn ra kết quả sai. Nên đây là việc của người: đọc lại expected.
{
  const invalid = rules.map((r) => r.data || {}).filter((d) => d.id && d.status === 'invalid');
  for (const d of invalid) {
    const tcs = Array.isArray(d.covered_by) ? d.covered_by : [];
    warnings.push(`${d.id}: rule bị GỠ (\`invalid\` từ ${d.invalidated_at || '?'} — ${d.invalidated_reason || 'chưa ghi lý do'})${tcs.length ? ` ⇒ ${tcs.length} TC từng dùng nó làm oracle phải REVIEW LẠI expected, KHÔNG chỉ chạy lại: ${tcs.slice(0, 8).join(', ')}${tcs.length > 8 ? '…' : ''}` : ' (không TC nào trỏ tới — không lan)'}`);
  }
  if (invalid.length) console.log(`[domain] ⓘ ${invalid.length} rule ở trạng thái invalid — xem danh sách TC cần review ở phần cảnh báo.`);
}

// ── --seal: đóng dấu nội dung để phát hiện sửa TẠI CHỖ về sau ─────────────────────────────────────
if (flag('seal')) {
  let sealed = 0;
  for (const r of rules) {
    const d = r.data || {};
    if (!d.id || d.__err) continue;
    const sha = contentSha(d);
    if (d.content_sha === sha) continue;
    d.content_sha = sha;
    d.sealed_at = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(r.file, `${JSON.stringify(d, null, 2)}\n`, 'utf8');
    sealed += 1;
  }
  console.log(sealed ? `[domain] ✓ đã seal ${sealed} rule (content_sha) — từ giờ sửa tại chỗ mà không bump confirmed_at sẽ bị bắt.` : '[domain] ✓ mọi rule đã seal đúng nội dung hiện tại.');
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
