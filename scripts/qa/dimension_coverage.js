#!/usr/bin/env node
'use strict';

/*
 * dimension_coverage.js — đếm case theo 15 CHIỀU coverage của `prompt_templates/phase1/02_gen_testcases.md`
 * (§3–§17) trên bộ testcase ĐÃ SINH, rồi chặn nếu thiếu chiều mà task khai là bắt buộc.
 *
 * VÌ SAO CẦN (đo 14/08/2026, đây là lỗ hổng lớn nhất còn lại của Phase 1):
 *   - `design_gate` KHÔNG kiểm chiều nào (chỉ `requirements`); `tc_validator` cũng không.
 *   - Nhãn chiều duy nhất tồn tại trong bộ canonical là `positive/negative/edge/boundary` (suy từ tiền tố
 *     tiêu đề). 15 chiều thật (hiển thị, BE conformance, security, perf, change-impact...) KHÔNG có nhãn nào.
 *   ⇒ Thứ DUY NHẤT làm cho các chiều đó xảy ra là agent đọc được §3–§17 trong prompt. Không có máy nào đứng
 *     sau. Và cơ chế đó vốn đã yếu: §12 là BẮT BUỘC, luôn được nạp, mà bộ 530 case thật chỉ có ~12% case
 *     hiển thị — cả cụm bug "thiếu trường / thừa cột / hai màn lệch nhãn" lọt hết.
 *
 * ĐẢO PHỤ THUỘC: kiểm ở OUTPUT (bộ case đã sinh) thay vì tin agent nhớ nạp mục nào. Nhờ vậy prompt có cắt
 * nhỏ để tiết kiệm token thì "mất text" KHÔNG còn đồng nghĩa "mất chiều" — đây là điều kiện tiên quyết để
 * cắt `02_gen_testcases.md` mà vẫn cam kết được chất lượng không giảm.
 *
 * TỰ NHẬN DIỆN CHỈ LÀ GỢI Ý, KHÔNG PHẢI SỰ THẬT: script suy chiều bằng tín hiệu văn bản (nhóm con sau dấu
 * `/` trong cột Module + tiêu đề + steps + expected). Nên nó LUÔN in TC ID mẫu cho mỗi chiều để người soi
 * lại trong vài giây, và chỉ CHẶN theo manifest do NGƯỜI khai (chiều nào bắt buộc / chiều nào N/A + lý do).
 * Không có manifest ⇒ chỉ báo cáo + in sẵn khung manifest để dán. Cố ý: script không được tự quyết chiều nào
 * áp dụng cho task — đó là phán đoán phạm vi, và đoán sai thì gate mất uy tín ngay lượt đầu.
 *
 * Dùng:
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/qa/dimension_coverage.js
 *   ... [--enforce]         # thiếu chiều bắt buộc ⇒ exit 1
 *   ... [--samples N]       # số TC ID mẫu in ra mỗi chiều (mặc định 3)
 *   ... [--write-manifest]  # ghi khung manifest vào requirements/dimension_manifest.json (không đè nếu đã có)
 */

const fs = require('fs');
const { getTestcaseDirs } = require('../utils/runtime_config');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const canonical = require(path.resolve(__dirname, '..', 'lib', 'testcase'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const ENFORCE = process.argv.includes('--enforce');
const WRITE_MANIFEST = process.argv.includes('--write-manifest');
const SAMPLES = parseInt(arg('samples', '3'), 10) || 3;
const TASK = arg('task', process.env.TASK_KEY || '');
const POD = process.env.PROJECT_OUTPUT_DIR || '';

if (!TASK || !POD) { console.error('[dim] cần TASK_KEY + PROJECT_OUTPUT_DIR (TASK_ENV=profiles/<TASK>/task.env).'); process.exit(2); }
const taskDir = path.resolve(rc.REPO_ROOT, POD, 'tasks', TASK);

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * 15 chiều = §3–§17 của prompt gen. `re` chạy trên chuỗi ĐÃ BỎ DẤU (norm) nên viết không dấu.
 * `group` khớp nhóm con (phần sau dấu `/` của cột Module) — tín hiệu MẠNH nhất vì do QA chủ động đặt tên.
 */
const DIMS = [
  { id: 'field_validation', sec: '§3', label: 'Field-Level Validation', group: /validate|field$/, re: /this field is required|bo trong|bat buoc.*(nhap|dien)|qua \d+ ky tu|ky tu dac biet|khong hop le|max ?length|toi da \d+/ },
  { id: 'ui_display', sec: '§4', label: 'UI Coverage (lưới/filter/sort/empty/loading)', group: /grid|pagination|search|filter|list/, re: /pagination|phan trang|sort|sap xep|empty state|loading|spinner|skeleton|reset bo loc|lam moi/ },
  { id: 'api', sec: '§5', label: 'API Coverage', group: /^api/, re: /\bapi\b|\b(get|post|patch|put|delete)\s+\/|\/api\/v\d|endpoint|swagger|status ?code|http \d{3}/ },
  { id: 'e2e', sec: '§6', label: 'E2E Coverage', group: /e2e/, re: /\be2e\b|dau[- ]cuoi|end[- ]to[- ]end|luong hoan chinh|xuyen suot/ },
  { id: 'export_import', sec: '§7', label: 'Export/Import & File Output', group: /export|import/, re: /export|xuat file|ten file|\.xlsx|\.csv|import|tai xuong|download/ },
  { id: 'resilience', sec: '§8', label: 'Resilience / Concurrency', group: /idempotent|concurrent/, re: /dong thoi|concurrent|race|double|trung (lan|callback|request)|idempotent|timeout|het han phien|retry|thu lai/ },
  { id: 'side_effect', sec: '§9', label: 'Side-effect / Notification', group: /task|mail|notification/, re: /gui (mail|email)|thong bao|notification|webhook|sinh task|tao task|kt0\d/ },
  { id: 'guard', sec: '§10', label: 'Cross-layer Guard', group: /guard|permission|state/, re: /\b403\b|\b409\b|bi chan|khong cho phep|bat hop phap|deny|tu choi|guard/ },
  { id: 'design_figma', sec: '§11', label: 'Design/Visual Compliance (Figma)', group: /design|ux/, re: /figma|design token|dung token|typography|spacing|mau sac.*token/ },
  // `hien thi` một mình quá rộng (171/530 case có nó ở đâu đó) nên chỉ nhận khi nằm ở TIÊU ĐỀ (reTitle) —
  // tiêu đề là chỗ QA phát biểu chủ đích của case. Đo: 17 → 40 case, khớp đúng con số đếm tay.
  // BẪY BỎ DẤU: `nhan` (label/nhãn) trùng luôn `nhận` trong "ghi nhận", "TK nhận", "HV nhận" ⇒ thêm nó vào
  // reTitle làm §12 phồng 17 → 106 case. Đã bỏ. Cũng vì vậy KHÔNG dùng `hien thi` một mình cho toàn văn
  // (171/530 case có nó ở đâu đó) — chỉ nhận ở TIÊU ĐỀ, nơi QA phát biểu chủ đích của case.
  { id: 'display_conformance', sec: '§12', label: 'Display/Field Conformance', group: /conformance|grid hien thi/, reTitle: /hien thi|du cot|dinh dang/, re: /conformance|dung \+ du cot|du cot|hien thi dung|dung dinh dang|dinh dang (ngay|tien)|verbatim|dung thu tu cot/ },
  { id: 'business_logic', sec: '§13', label: 'Business Logic / Calculation', group: /cong thuc|amount|discount|fee/, re: /cong thuc|= gross|net ?= |tinh (dung|lai)|cong don|quy doi|ty gia|lam tron|tong ?= / },
  { id: 'be_conformance', sec: '§14', label: 'BE Response Data Conformance', group: /field mapping|mapping/, re: /field mapping|property|payload|response|be tra|dong bo dung.*(property|field)|internal name/ },
  { id: 'security', sec: '§15', label: 'Security Coverage', group: /idor|mass-assignment|injection|session|token|security/, re: /\bidor\b|mass[- ]assignment|injection|\bxss\b|session|token|leo quyen|privilege|khong dang nhap/ },
  { id: 'perf', sec: '§16', label: 'Performance / Load / Stress', group: /perf|load|stress/, re: /hieu nang|thoi gian phan hoi|\bsla\b|\bload test\b|stress|p95|dong thoi \d+ user/ },
  { id: 'change_impact', sec: '§17', label: 'Change Impact / Regression Ripple', group: /regression|impact/, re: /regression|ripple|anh huong (lan|toi)|khong lam vo|van hoat dong nhu truoc/ },
  // Ba chiều thêm 20/08/2026 sau khi ĐO chỗ hở: ordering chỉ 1 file nhắc trong toàn kit; knowledge/bugs có 58
  // entry mà không prompt sinh case nào dùng; accessibility_check.js chạy được nhưng chỉ 2/22 file phase1 nhắc.
  { id: 'ordering', sec: '§19', label: 'Ordering / Sequence', group: /ordering|thu tu/, re: /sai thu tu|dao thu tu|thu tu thao tac|quay lui|quay lai buoc|bam back|xen ke|hai tab|2 tab|bo do giua chung|reset khi doi/ },
  { id: 'bug_history', sec: '§20', label: 'Error Guessing từ bug lịch sử', group: /bughistory|bug lich su/, re: /bug lich su|tung xay ra|da tung loi|lap lai loi|regression tu bug|knowledge\/bugs/ },
  { id: 'accessibility', sec: '§21', label: 'Accessibility (A11y)', group: /a11y|accessib/, re: /\ba11y\b|accessib|\baria\b|contrast|focus order|dieu huong ban phim|screen reader|label for|nhan gan dung/ },
];

// Self-check bảng DIMS: id trùng hoặc pattern không phải RegExp thì báo ngay, đừng để lệch âm thầm.
{
  const seen = new Set();
  for (const d of DIMS) {
    if (!(d.re instanceof RegExp)) { console.error(`[dim] pattern của chiều "${d.id}" không phải RegExp — sửa DIMS.`); process.exit(2); }
    if (seen.has(d.id)) { console.error(`[dim] chiều "${d.id}" khai TRÙNG trong DIMS.`); process.exit(2); }
    seen.add(d.id);
  }
}

function loadTests() {
  const dirs = getTestcaseDirs(taskDir);   // 1 nguồn: test-cases/ + bản kéo về từ AIO (from-aio)
  const byId = new Map();
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('~$') || f.startsWith('.~') || !f.endsWith('.md')) continue;
      try {
        const doc = canonical.parseMarkdown(fs.readFileSync(path.join(dir, f), 'utf8'));
        for (const t of doc.tests || []) if (t.tcId && !byId.has(t.tcId)) byId.set(t.tcId, t);
      } catch (e) { /* không phải bảng testcase */ }
    }
  }
  return [...byId.values()];
}

const tests = loadTests();
if (!tests.length) { console.error('[dim] không đọc được testcase canonical ở test-cases/*.md.'); process.exit(2); }

const subGroup = (t) => norm(String(t.module || '').split('/').slice(1).join('/'));
const blob = (t) => norm(`${t.title} ${t.stepsRaw} ${t.expectedRaw} ${t.data}`);

// ── HAI CHẾ ĐỘ, và đây là điểm quan trọng nhất của script ───────────────────────────────────────────────
// NHÃN (đáng tin, được phép --enforce): case mang tag chiều trong tiêu đề, vd "[Positive][Display] …".
//   Tag đọc qua `DIMENSION_TAGS` của scripts/lib/testcase — cùng cơ chế đã dùng cho positive/negative.
// GỢI Ý (KHÔNG được --enforce): chưa bộ nào gắn tag ⇒ suy chiều từ văn bản. Đo trên bộ 530 case thật thì cách
//   này KHÔNG đủ tin: recall thiếu (§5 API đếm 0 trong khi có 17 case nhắc "api") và precision kém
//   (§12 nhận cả "Chọn Next → hiển thị màn Confirm" — vì `hiển thị` là động từ chuẩn của MỌI expected tiếng
//   Việt). Nên chế độ này chỉ để BIẾT chỗ nào có thể hổng, và script TỪ CHỐI chặn.
const TAG_OF = { field_validation: 'validation', ui_display: 'ui', api: 'api', e2e: 'e2e', export_import: 'export', resilience: 'resilience', side_effect: 'sideeffect', guard: 'guard', design_figma: 'design', display_conformance: 'display', business_logic: 'calc', be_conformance: 'bedata', security: 'security', perf: 'perf', change_impact: 'impact', ordering: 'ordering', bug_history: 'bughistory', accessibility: 'a11y' };
const COVERAGE_TAGS = new Set(Object.values(TAG_OF));
const labelled = tests.filter((t) => (t.dimensions || []).some((x) => COVERAGE_TAGS.has(x)));
const MODE = labelled.length ? 'label' : 'hint';

const hits = new Map(DIMS.map((d) => [d.id, []]));
for (const t of tests) {
  if (MODE === 'label') {
    const dims = new Set(t.dimensions || []);
    for (const d of DIMS) if (dims.has(TAG_OF[d.id])) hits.get(d.id).push(t.tcId);
    continue;
  }
  const g = subGroup(t); const b = blob(t); const ti = norm(t.title);
  for (const d of DIMS) {
    if ((d.group && d.group.test(g)) || (d.reTitle && d.reTitle.test(ti)) || d.re.test(b)) hits.get(d.id).push(t.tcId);
  }
}

// Manifest do NGƯỜI khai: chiều nào bắt buộc với task này, chiều nào N/A kèm lý do.
const manifestPath = path.join(taskDir, 'requirements', 'dimension_manifest.json');
let manifest = null;
if (fs.existsSync(manifestPath)) {
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (e) { console.error(`[dim] ${manifestPath} không parse được: ${e.message}`); process.exit(2); }
}

// ── ĐỐI CHIẾU MANIFEST vs ARTIFACT THẬT ────────────────────────────────────────────────────────────────
// Rủi ro sinh ra khi tách 15 chương thành file rời: agent đọc MỘT DÒNG trigger rồi khai "n/a", trong khi
// trước đây đọc tuần tự sẽ VÔ TÌNH gặp chương đó và nhận ra là cần. Chốt chặn ở đây KHÔNG suy diễn từ văn
// bản (đã loại cách đó ở trên) mà dựa vào **sự tồn tại của artifact** — một sự thật kiểm được:
// có `requirements/figma/**` thì task CÓ thiết kế để đối chiếu, khai `design: n/a` là sai, hết bàn.
//
// ⚠ Chiều ngược lại KHÔNG đúng: artifact VẮNG **không** chứng minh chiều đó không áp dụng (có thể chỉ là chưa
// ai kéo Figma/swagger về). Nên chỉ chặn khi artifact CÓ mà manifest nói n/a; artifact vắng thì im lặng.
const exists = (p) => fs.existsSync(path.join(taskDir, p));
const globExists = (dir, re) => { const d = path.join(taskDir, dir); if (!fs.existsSync(d)) return false; try { return fs.readdirSync(d, { recursive: true }).some((f) => re.test(String(f))); } catch (e) { return false; } };
const knowSystem = (type) => {
  const d = path.join(rc.REPO_ROOT, 'knowledge', 'system');
  if (!fs.existsSync(d)) return false;
  return fs.readdirSync(d).filter((f) => f.endsWith('.json')).some((f) => {
    try { return JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')).type === type; } catch (e) { return false; }
  });
};
const SCOPE_SIGNALS = [
  { dim: 'design_figma', why: 'có `requirements/figma/**` — task CÓ thiết kế để đối chiếu', has: () => exists('requirements/figma') },
  { dim: 'display_conformance', why: 'có `requirements/ui_catalog.{json,md}` — đã trích tài liệu hiển thị ra làm oracle', has: () => exists('requirements/ui_catalog.json') || exists('requirements/ui_catalog.md') },
  { dim: 'be_conformance', why: 'có bảng `field_mapping*` trong requirements — mỗi dòng mapping là 1 case đối chiếu giá trị', has: () => globExists('requirements', /field_mapping/i) },
  { dim: 'api', why: 'có `requirements/swagger/**`', has: () => exists('requirements/swagger') },
  { dim: 'change_impact', why: 'có `requirements/git-impact.md` hoặc `knowledge/system/` khai `shared_surface`', has: () => exists('requirements/git-impact.md') || knowSystem('shared_surface') },
  { dim: 'guard', why: '`knowledge/system/` khai `state_machine` — mọi cặp chuyển trạng thái KHÔNG khai là bất hợp pháp và phải có case chứng minh bị CHẶN', has: () => knowSystem('state_machine') },
  { dim: 'security', why: '`knowledge/system/` khai `permission_matrix` — mọi ô role×action ngoài allow phải có case guard', has: () => knowSystem('permission_matrix') },
];

const scopeConflict = [];
const scopeUndeclared = [];
for (const s of SCOPE_SIGNALS) {
  if (!s.has()) continue;
  const decl = manifest && manifest.dimensions ? manifest.dimensions[s.dim] : undefined;
  const dim = DIMS.find((d) => d.id === s.dim);
  if (decl === 'n/a') scopeConflict.push({ dim, why: s.why });
  else if (manifest && decl !== 'required') scopeUndeclared.push({ dim, why: s.why });
}
for (const c of scopeConflict) console.error(`[dim] ✗ XUNG ĐỘT: chiều "${c.dim.label}" (${c.dim.sec}) khai n/a nhưng ${c.why}. Artifact chứng minh chiều này ÁP DỤNG.`);
for (const c of scopeUndeclared) console.warn(`[dim] ⚠ chiều "${c.dim.label}" (${c.dim.sec}) chưa khai \`required\` nhưng ${c.why} ⇒ nên khai required.`);

// Chặn ĐỘC LẬP với việc thiếu case, và chạy được cả ở chế độ GỢI Ý — vì bằng chứng là ARTIFACT, không phải
// suy diễn. Khai n/a sai là bỏ chiều CÓ CHỦ Ý, nặng hơn việc quên sinh case.
if (scopeConflict.length && ENFORCE) {
  console.error(`[dim] ✗ ${scopeConflict.length} chiều khai n/a trái với artifact có thật — sửa manifest thành "required" rồi mở đúng file trong dimensions/.`);
  process.exit(1);
}

// FAIL-FAST hai điều kiện của việc chặn. Đặt TRƯỚC bảng để không ai tưởng gate đã gác trong khi nó chưa gác.
// Chặn bằng số liệu suy diễn, hoặc chặn khi chưa ai khai chiều nào bắt buộc, đều dẫn tới báo oan — và gate báo
// oan một lần là mất uy tín vĩnh viễn.
if (ENFORCE && MODE !== 'label') {
  console.error('[dim] ✗ TỪ CHỐI --enforce: đang ở chế độ GỢI Ý (chưa case nào mang tag chiều), số liệu suy từ văn bản không đủ tin để chặn.');
  console.error('[dim]   Đường ra: gen có gắn tag chiều (vd "[Positive][Display] …" — xem §0 prompt gen), rồi chạy lại.');
  process.exit(2);
}
if (ENFORCE && !manifest) {
  console.error(`[dim] ✗ TỪ CHỐI --enforce: chưa có ${path.relative(rc.REPO_ROOT, manifestPath)} nên KHÔNG biết chiều nào task này bắt buộc.`);
  console.error('[dim]   Chạy không --enforce (hoặc thêm --write-manifest) để lấy khung, khai required/n-a rồi mới bật chặn.');
  process.exit(2);
}

console.log(`[dim] ${tests.length} testcase · ${DIMS.length} chiều · manifest: ${manifest ? 'CÓ' : 'CHƯA CÓ (chỉ báo cáo)'}`);
if (MODE === 'label') {
  console.log(`[dim] chế độ NHÃN — ${labelled.length}/${tests.length} case mang tag chiều. Số liệu đáng tin, --enforce dùng được.\n`);
  const noTag = tests.length - labelled.length;
  if (noTag) console.warn(`[dim] ⚠ ${noTag} case CHƯA có tag chiều nào ⇒ không được tính vào bảng dưới. Bổ sung tag để bảng phản ánh đủ bộ.\n`);
} else {
  console.log('[dim] chế độ GỢI Ý — chưa case nào mang tag chiều, đang SUY từ văn bản.');
  console.log('[dim] ⚠ Số liệu dưới đây KHÔNG đáng tin: đo trên bộ 530 case thật thì suy diễn thiếu recall (§5 ra 0 dù có 17 case nhắc "api")');
  console.log('[dim]   và kém precision (§12 nhận cả case điều hướng, vì "hiển thị" là động từ chuẩn của mọi expected tiếng Việt).');
  console.log('[dim]   Dùng để BIẾT chỗ có thể hổng, rồi soi TC mẫu. Muốn chặn được thì gắn tag chiều lúc gen (xem §0 prompt gen).\n');
}
console.log('| Chiều | § | Case | Trạng thái | TC mẫu (soi lại được) |');
console.log('|---|---|---|---|---|');

const missingRequired = [];
for (const d of DIMS) {
  const list = hits.get(d.id);
  const decl = manifest && manifest.dimensions ? manifest.dimensions[d.id] : undefined;
  let state;
  if (decl === 'n/a') state = 'N/A (khai)';
  else if (list.length === 0 && decl === 'required') { state = '❌ THIẾU'; missingRequired.push(d); }
  else if (list.length === 0) state = '⚠ 0 case';
  else state = `✓ ${list.length}`;
  console.log(`| ${d.label} | ${d.sec} | ${list.length} | ${state} | ${list.slice(0, SAMPLES).join(', ') || '—'} |`);
}

if (!manifest) {
  const skeleton = {
    _purpose: 'Khai chiều coverage nào BẮT BUỘC với task này, chiều nào N/A + lý do. dimension_coverage.js --enforce chặn nếu thiếu chiều required. Script KHÔNG tự quyết phạm vi — đoán sai thì gate mất uy tín.',
    _how: 'Mỗi chiều: "required" | "n/a". Chiều n/a PHẢI kèm lý do ở `na_reasons`.',
    dimensions: Object.fromEntries(DIMS.map((d) => [d.id, 'required'])),
    na_reasons: {},
  };
  console.log('\n[dim] Chưa có manifest. Khung để dán vào `requirements/dimension_manifest.json` (sửa chiều nào N/A + ghi lý do):');
  console.log(JSON.stringify(skeleton, null, 2));
  if (WRITE_MANIFEST) {
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(skeleton, null, 2), 'utf8');
    console.log(`[dim] đã ghi khung: ${manifestPath} — SỬA lại cho đúng phạm vi task trước khi bật --enforce.`);
  }
}

// N/A phải có lý do: "n/a" không kèm lý do là cách im lặng bỏ một chiều — đúng thứ gate này sinh ra để chặn.
if (manifest && manifest.dimensions) {
  const naNoReason = Object.entries(manifest.dimensions)
    .filter(([k, v]) => v === 'n/a' && !((manifest.na_reasons || {})[k] || '').trim());
  for (const [k] of naNoReason) console.warn(`[dim] ⚠ chiều "${k}" khai n/a mà KHÔNG có lý do trong na_reasons — bỏ chiều thì phải nói vì sao.`);
  const unknown = Object.keys(manifest.dimensions).filter((k) => !DIMS.some((d) => d.id === k));
  for (const k of unknown) console.warn(`[dim] ⚠ manifest khai chiều lạ "${k}" — không có trong DIMS, sẽ bị bỏ qua.`);
}

if (missingRequired.length) {
  console.error(`\n[dim] ✗ THIẾU ${missingRequired.length} chiều khai là bắt buộc:`);
  for (const d of missingRequired) console.error(`  - ${d.label} (${d.sec}) — 0 case. Mở đúng mục ${d.sec} của prompt gen rồi bổ sung, hoặc khai "n/a" kèm lý do nếu thật sự không áp dụng.`);
  // TỪ CHỐI chặn khi đang ở chế độ gợi ý. Chặn bằng số liệu không đáng tin là cách nhanh nhất để gate mất uy
  // tín — lần đầu nó báo oan là lần cuối có người nghe nó.
  if (ENFORCE) process.exit(1);
  console.error('[dim] (chưa --enforce nên KHÔNG chặn — nhưng đây là thiếu thật.)');
} else if (manifest) {
  console.log('\n[dim] ✓ Mọi chiều khai bắt buộc đều có case.');
}
