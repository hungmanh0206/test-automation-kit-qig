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
/* Dat o DAU file, khong dat canh cho dung: `getRiskModel` goi no tu dong 392, nen khai o duoi la
 * ReferenceError TDZ. Da dinh dung loi do 10/10/2026 va no lam 11 test do. */
const cfgLoad = require(path.join(__dirname, 'lib', 'config_load'));
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

  // Chiều thêm 23/08/2026 sau khi ĐO: kit có idempotency phía GỬI (§5/§8) và webhook ĐI RA (§9), nhưng
  // KHÔNG chiều nào đứng ở phía NHẬN callback bên thứ ba — nơi mình không kiểm soát số lần/thứ tự gửi.
  // Bằng chứng là bug thật: callback thanh toán trùng làm Paid Amount cộng đôi (CSDL-28236), do NGƯỜI
  // phát hiện chứ không máy nào bắt.
  { id: 'inbound_callback', sec: '§22', label: 'Inbound Callback / Webhook (phía NHẬN)', group: /callback|webhook|ipn/, re: /callback|webhook|\bipn\b|secure ?hash|hmac|chu ky (sai|hop le)|replay|gui lai callback|callback trung|at[- ]least[- ]once|vnp_/ },


  // Chieu them 27/08/2026 sau khi dung tang kiem DB: UI/API KHONG du de noi ban ghi da luu dung —
  // response thuong echo lai request, con FE format lai gia tri. 7 lop loi (doi kieu so, lech mui gio,
  // cat varchar, xoa mem hong, bang lien quan khong doi, double-submit, rollback sai) deu 'UI thay dung'.
  { id: 'db_persistence', sec: '§23', label: 'DB Persistence (bản ghi sau CRUD)', group: /dbpersist|persist|ban ghi/, re: /dbpersist|ban ghi (duoi )?db|\bdeleted_at\b|xoa mem|soft[- ]delete|luu (dung|sai) (vao )?db|updated_at|rollback|khong doi gi trong db/ },];

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
  const dirs = getTestcaseDirs(taskDir);   // 1 nguồn: test-cases/ + bản kéo về từ Google Sheet (from-aio)
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
const TAG_OF = { field_validation: 'validation', ui_display: 'ui', api: 'api', e2e: 'e2e', export_import: 'export', resilience: 'resilience', side_effect: 'sideeffect', guard: 'guard', design_figma: 'design', display_conformance: 'display', business_logic: 'calc', be_conformance: 'bedata', security: 'security', perf: 'perf', change_impact: 'impact', ordering: 'ordering', bug_history: 'bughistory', accessibility: 'a11y', inbound_callback: 'callback', db_persistence: 'dbpersist' };
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

/*
 * ── KỸ THUẬT THIẾT KẾ (H1) ────────────────────────────────────────────────────────────────────────
 *
 * Đếm case theo 6 mã, và CHẶN khi manifest khai một kỹ thuật là `required` mà 0 case dùng.
 *
 * VÌ SAO CHẶN THEO MANIFEST chứ không tự suy "task này có field min/max nên phải có BVA": suy được thì
 * cũng phải đọc được ràng buộc của từng field, mà thứ đó nằm trong spec dạng văn xuôi. Đoán hộ rồi chặn
 * là báo oan, và một gate báo oan một lần là mất uy tín vĩnh viễn — cùng lý lẽ đã ghi cho chiều coverage
 * ngay bên dưới. Người khai `required`, máy giữ lời khai đó.
 *
 * Bộ chưa dùng quy ước (0 case có tag) thì KHÔNG chặn: `validate.js` đã kêu ở tầng của nó, kêu hai lần
 * thành tiếng ồn.
 */
const TECHS = require(path.join(rc.REPO_ROOT, '.agent', 'config', 'design_techniques.json')).techniques;
const demKyThuat = new Map(TECHS.map((t) => [t.code, 0]));
let caseCoKyThuat = 0;
for (const tc of tests) {
  const ks = tc.techniques || [];
  if (ks.length) caseCoKyThuat += 1;
  for (const k of ks) if (demKyThuat.has(k)) demKyThuat.set(k, demKyThuat.get(k) + 1);
}

console.log('');
console.log('[dim] Kỹ thuật thiết kế (nguồn: .agent/config/design_techniques.json)');
if (!caseCoKyThuat) {
  console.log('[dim]   0 case mang tag kỹ thuật ⇒ CHƯA ĐƯỢC GÁC. Điều kiện bắt buộc dùng từng kỹ thuật ở config.');
} else {
  for (const t of TECHS) {
    const n = demKyThuat.get(t.code) || 0;
    const khai = manifest && manifest.techniques ? manifest.techniques[t.code] : undefined;
    const nhan = khai === 'required' ? 'BẮT BUỘC' : (khai === 'n/a' ? 'n/a' : 'chưa khai');
    console.log(`[dim]   ${t.code.padEnd(4)} ${String(n).padStart(4)} case · ${nhan} · ${t.kich_hoat.slice(0, 70)}`);
  }
}

const kyThuatThieu = [];
if (manifest && manifest.techniques) {
  for (const t of TECHS) {
    if (manifest.techniques[t.code] !== 'required') continue;
    if ((demKyThuat.get(t.code) || 0) === 0) kyThuatThieu.push(t);
  }
}
for (const t of kyThuatThieu) {
  console.error(`[dim] ✗ kỹ thuật ${t.code} khai \`required\` trong manifest nhưng 0 case dùng — ${t.kich_hoat}`);
}
if (kyThuatThieu.length && ENFORCE) {
  console.error(`[dim] ✗ ${kyThuatThieu.length} kỹ thuật bắt buộc mà 0 case. Sinh case, hoặc đổi manifest sang "n/a" KÈM LÝ DO.`);
  process.exit(1);
}

const CP_PLACEHOLDER = /^(|-+|n\/?a|tbd|todo|\?+|<[^>]*>|\[[^\]]*\]|xxx+)$/i;
const isFilledReason = (v) => typeof v === 'string' && v.trim().length >= 20 && !CP_PLACEHOLDER.test(v.trim());

/*
 * ── COMPONENT + LOẠI FIELD (H4) ───────────────────────────────────────────────────────────────────
 *
 * Form input chỉ là một phần của app. Lưới dữ liệu, modal, toast và vòng đời CRUD là những NHÓM HÀNH VI
 * rải trên nhiều chiều, nên không chiều nào tự liệt kê chúng ra — và thứ không được liệt kê thì "đã rà đủ"
 * chỉ có nghĩa "agent thấy đủ".
 *
 * GIỚI HẠN, nói trước để không ai tưởng chỗ này chặn được nhiều hơn thực tế: component KHÔNG phải tag, nên
 * máy KHÔNG đếm được "component X có mấy case". Thêm tag component vào cột Tag thì mỗi case đeo 5-6 tag,
 * đã cân nhắc và loại. Vì vậy ở đây chỉ gác được XUẤT XỨ CỦA LỜI KHAI:
 *   - có khai chưa (chưa khai ⇒ cảnh báo, vì "không áp dụng" và "quên rà" trông giống hệt nhau);
 *   - khai `n/a` có kèm lý do chưa;
 *   - lời khai có TRÁI ARTIFACT có thật không (chỉ 2 component có artifact ⇒ chỉ 2 chỗ chặn được).
 *
 * HAI TẦNG: manifest chưa có khối `components` ⇒ tự từ chối chặn, nhưng in rõ là CHƯA ĐƯỢC GÁC.
 */
const UIC = require(path.join(rc.REPO_ROOT, '.agent', 'config', 'ui_components.json'));
const khaiCp = manifest && manifest.components ? manifest.components : null;
const lyDoCp = (manifest && manifest.na_reasons) || {};

console.log('');
console.log('[dim] Component (nguồn: .agent/config/ui_components.json)');
const cpThieuKhai = [];
const cpXungDot = [];
const cpThieuLyDo = [];
const cpLechChieu = [];
if (!khaiCp) {
  console.log(`[dim]   manifest CHƯA có khối \`components\` ⇒ ${UIC.components.length} component CHƯA ĐƯỢC GÁC.`);
  console.log('[dim]   Khung để dán: "components": { ' + UIC.components.map((c) => `"${c.code}": "required|n/a"`).join(', ') + ' }');
} else {
  for (const c of UIC.components) {
    const k = khaiCp[c.code];
    const nhan = k === 'required' ? 'BẮT BUỘC' : (k === 'n/a' ? 'n/a' : 'CHƯA KHAI');
    console.log(`[dim]   ${c.code.padEnd(12)} ${c.ten.padEnd(22)} ${nhan.padEnd(10)} checklist: ${c.o}`);
    if (k === undefined) { cpThieuKhai.push(c); continue; }
    if (k === 'n/a') {
      if (!isFilledReason(lyDoCp[c.code])) cpThieuLyDo.push(c);
      if (c.artifact_signal && knowSystem(c.artifact_signal)) cpXungDot.push(c);
      continue;
    }
    // Khai `required` mà MỌI chiều chứa checklist của nó đều n/a ⇒ hai lời khai chống nhau.
    const chieu = c.chieu || [];
    if (chieu.length && manifest.dimensions && chieu.every((id) => manifest.dimensions[id] === 'n/a')) {
      cpLechChieu.push({ c, chieu });
    }
  }
}
for (const c of cpThieuKhai) {
  console.warn(`[dim] ⚠ component "${c.ten}" CHƯA KHAI trong manifest — kích hoạt khi: ${c.kich_hoat} Không áp dụng thì khai "n/a" kèm lý do, đừng im lặng bỏ qua.`);
}
for (const c of cpThieuLyDo) {
  console.error(`[dim] ✗ component "${c.ten}" khai n/a mà \`na_reasons.${c.code}\` trống — n/a không lý do là thu hẹp phạm vi mà không ai chịu trách nhiệm.`);
}
for (const c of cpXungDot) {
  console.error(`[dim] ✗ XUNG ĐỘT: component "${c.ten}" khai n/a nhưng \`knowledge/system/\` có khai \`${c.artifact_signal}\`. Artifact chứng minh component này ÁP DỤNG.`);
}
for (const x of cpLechChieu) {
  console.warn(`[dim] ⚠ component "${x.c.ten}" khai required nhưng mọi chiều chứa checklist của nó (${x.chieu.join(', ')}) đều khai n/a — hai lời khai chống nhau.`);
}
if ((cpXungDot.length || cpThieuLyDo.length) && ENFORCE) {
  console.error(`[dim] ✗ ${cpXungDot.length + cpThieuLyDo.length} lời khai component không hợp lệ. Sửa manifest rồi chạy lại.`);
  process.exit(1);
}

/*
 * LOẠI FIELD. Prompt gốc muốn check "loại field X có trong inventory mà 0 case [Validation]". Đã đo:
 * `field-inventory.spec.ts` và `ui_conformance_check.js` kiểm kê TÊN field của từng màn
 * (`expectedFields` là mảng chuỗi nhãn), KHÔNG có thuộc tính LOẠI. Nên inventory theo loại field hiện
 * KHÔNG tồn tại, và suy loại từ tên nhãn là dò chữ — đúng thứ đã gây dương tính giả nhiều lần.
 *
 * Vì vậy mẫu số phải do NGƯỜI khai: `"field_types": ["text", "email", ...]` trong manifest. Máy kiểm được
 * đúng hai điều, và chỉ hai điều đó:
 *   - mã lạ ⇒ CHẶN (sai mã thì danh mục vô nghĩa);
 *   - số loại khai NHIỀU HƠN số case [Validation] ⇒ cảnh báo, vì mỗi loại cần tối thiểu một case.
 * Nó KHÔNG biết case nào thuộc loại nào. Nói rõ ra, đừng để ai tưởng đây là phép đo per-field.
 */
const FT_CODES = new Set(UIC.field_types.map((f) => f.code));
const khaiFt = manifest && Array.isArray(manifest.field_types) ? manifest.field_types : null;
const ftRequired = manifest && manifest.dimensions && manifest.dimensions.field_validation !== 'n/a';
const soValidation = (hits.get('field_validation') || []).length;
console.log('');
console.log('[dim] Loại field (nguồn: .agent/config/ui_components.json — 18 loại)');
if (!khaiFt) {
  if (ftRequired) console.log(`[dim]   manifest CHƯA khai \`field_types\` ⇒ mẫu số của chiều Validation là số tự nhận. ${soValidation} case [Validation] hiện KHÔNG so được với gì.`);
  else console.log('[dim]   chiều field_validation khai n/a ⇒ bỏ qua.');
} else {
  const la = khaiFt.filter((c) => !FT_CODES.has(c));
  console.log(`[dim]   khai ${khaiFt.length} loại · ${soValidation} case [Validation]`);
  if (la.length) {
    console.error(`[dim] ✗ mã loại field lạ: ${la.join(', ')} — mã hợp lệ ở .agent/config/ui_components.json`);
    if (ENFORCE) process.exit(1);
  }
  if (soValidation < khaiFt.length) {
    console.warn(`[dim] ⚠ khai ${khaiFt.length} loại field mà chỉ có ${soValidation} case [Validation]. Mỗi loại cần tối thiểu 1 case ⇒ có loại chưa được kiểm. (Phép đo này chỉ so TỔNG, không biết case nào thuộc loại nào.)`);
  }
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
/*
 * NGƯỠNG ĐỊNH LƯỢNG (thêm 23/08/2026). Trước đó phép đo là NHỊ PHÂN: "có ≥1 case cho chiều X" là ĐẠT.
 * Hệ quả đo được: bộ 530 case thật có §12 (Display — chiều BẮT BUỘC, luôn nạp) chỉ ~12% case, và gate
 * vẫn PASS. Có mặt ≠ đủ.
 *
 * Ngưỡng lấy từ `depthPolicy[band].minCasesPerDimension` trong `.agent/config/risk_model.json` — CÙNG
 * chỗ `risk_gate` đọc `minCount`, để không sinh nguồn thứ hai. Band = band CAO NHẤT trong risk register
 * của task (task có 1 module High thì cả bộ phải sâu theo High).
 * Manifest override được từng chiều: `"display_conformance": { "required": true, "min": 8 }` — dạng chuỗi
 * "required"/"n/a" cũ vẫn chạy nguyên.
 */
const RISK_MODEL = (() => {
  /* Thiếu `risk_model.json` thì RƠI VỀ bản `.example` chứ không trả `{}`: hai bản cùng cấu trúc và
   * `depthPolicy` giống nhau, nên phần chung vẫn gác được. Trả `{}` là tắt ngưỡng độ sâu mà không
   * một dòng nào báo — đúng lỗi đã đo được trên bản đóng gói 10/10/2026. */
  return cfgLoad.napConfigGate({
    duong: path.join(rc.REPO_ROOT, '.agent', 'config', 'risk_model.json'),
    duPhong: path.join(rc.REPO_ROOT, '.agent', 'config', 'risk_model.example.json'),
    nhan: '`.agent/config/risk_model.json`',
    phepKiem: 'ngưỡng độ sâu theo band (`depthPolicy`)',
    khiThieu: {},
  }) || {};
})();
const bandOfTask = (() => {
  try {
    const rr = JSON.parse(fs.readFileSync(path.join(taskDir, 'reports', 'risk-register.json'), 'utf8'));
    const rows = Array.isArray(rr) ? rr : (rr.modules || []);
    const bands = new Set(rows.map((r) => String(r.band || '').toLowerCase()));
    if (bands.has('high')) return 'High';
    if (bands.has('medium')) return 'Medium';
    if (bands.has('low')) return 'Low';
  } catch (e) { /* chưa có risk register */ }
  return 'UNKNOWN';
})();
const policy = (RISK_MODEL.depthPolicy || {})[bandOfTask] || {};
const DEFAULT_MIN = Number(policy.minCasesPerDimension || 0) || 1;
/** Khai chiều: chuỗi "required"/"n/a" (cũ) hoặc object { required, min } (mới). */
const declOf = (id) => {
  const raw = manifest && manifest.dimensions ? manifest.dimensions[id] : undefined;
  if (raw && typeof raw === 'object') return { state: raw.required === false ? 'n/a' : 'required', min: Number(raw.min || 0) || DEFAULT_MIN };
  return { state: raw, min: DEFAULT_MIN };
};
const totalTests = tests.length || 1;
console.log(`[dim] ngưỡng mỗi chiều required: ≥${DEFAULT_MIN} case (band cao nhất của task = ${bandOfTask}, từ depthPolicy.minCasesPerDimension)`);
console.log('| Chiều | § | Case | % bộ | Ngưỡng | Trạng thái | TC mẫu (soi lại được) |');
console.log('|---|---|---|---|---|---|---|');

const missingRequired = [];
const belowThreshold = [];
const naButTagged = []; // chiều khai n/a mà case vẫn gắn tag chiều đó — hai file cạnh nhau nói ngược nhau
for (const d of DIMS) {
  const list = hits.get(d.id);
  const { state: decl, min } = declOf(d.id);
  const share = Math.round((list.length / totalTests) * 1000) / 10;
  const need = decl === 'required' ? `≥${min}` : '—';
  let state;
  if (decl === 'n/a') { state = list.length ? `⛔ N/A (khai) nhưng có ${list.length} case` : 'N/A (khai)'; if (list.length && MODE === 'label') naButTagged.push({ d, tcs: list }); }
  else if (list.length === 0 && decl === 'required') { state = '❌ THIẾU'; missingRequired.push(d); }
  else if (list.length === 0) state = '⚠ 0 case';
  else if (decl === 'required' && list.length < min) { state = `⚠ MỎNG ${list.length}/${min}`; belowThreshold.push({ d, have: list.length, min }); }
  else state = `✓ ${list.length}`;
  console.log(`| ${d.label} | ${d.sec} | ${list.length} | ${share}% | ${need} | ${state} | ${list.slice(0, SAMPLES).join(', ') || '—'} |`);
}

/*
 * PHÂN BỐ: 530 case trải đều 22 chiều rất khác 530 case dồn vào 3 chiều, mà bảng trên (đọc từng dòng)
 * không cho thấy điều đó. In luôn độ lệch để thấy ngay — không cần ai tự cộng lại.
 */
{
  const ranked = DIMS.map((d) => ({ label: d.label, sec: d.sec, n: hits.get(d.id).length }))
    .filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  if (ranked.length) {
    const top3 = ranked.slice(0, 3);
    const top3Share = Math.round((top3.reduce((s, x) => s + x.n, 0) / totalTests) * 1000) / 10;
    console.log(`\n[dim] phân bố: ${ranked.length}/${DIMS.length} chiều có case · 3 chiều lớn nhất giữ ${top3Share}% (${top3.map((x) => `${x.sec} ${x.n}`).join(' · ')})`);
    if (top3Share >= 70) console.log('[dim] ⚠ LỆCH: bộ case dồn vào ít chiều ⇒ phủ RỘNG chứ chưa SÂU đều. Xem chiều nào đang mỏng ở cột "Ngưỡng".');
  }
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

/*
 * LÝ DO n/a ĐÃ BỊ BÁC Ở TASK KHÁC — `.agent/config/na_reasons_rejected.json`.
 * Không có phép kiểm này thì việc bác bỏ chỉ sống trong task nơi nó xảy ra: đo 30/09/2026, lý do n/a
 * của `accessibility` bị rút lại ở BA task liên tiếp mà task thứ tư vẫn khai y nguyên câu đó, và mọi
 * gate vẫn xanh — vì gate chỉ hỏi "chiều required có case chưa", không hỏi "lý do n/a có đứng vững không".
 */
/*
 * ĐỌC HAI LỚP, và KHÔNG ĐƯỢC IM LẶNG KHI THIẾU.
 *
 * BẢN CŨ TRẢ `[]` TRONG `catch` — và đó là một lỗi thật, đã tái hiện 10/10/2026: file config này chưa
 * bao giờ được `git add`, nên BẢN PHÁT HÀNH KHÔNG CÓ NÓ. Thiếu file ⇒ danh sách rỗng ⇒ phép kiểm
 * "lý do n/a trùng lập luận đã bị bác" KHÔNG BAO GIỜ chặn, và không một dòng nào báo. Trên máy dev thì
 * xanh vì file đang nằm untracked — đúng kiểu lỗi mà "đo trên cây làm việc" không thể thấy.
 *
 * Nay: thiếu file ⇒ KÊU rõ là CHƯA ĐƯỢC GÁC. JSON hỏng ⇒ CHẶN hẳn, vì một file hỏng không được phép
 * có cùng hệ quả với một danh sách rỗng hợp lệ.
 */
const DUONG_NA = path.join(rc.REPO_ROOT, '.agent', 'config', 'na_reasons_rejected.json');
const DUONG_NA_DA = path.join(rc.REPO_ROOT, '.agent', 'config', 'na_reasons_rejected.project.json');

const REJECTED_NA = (() => {
  const j = cfgLoad.napConfigGate({
    duong: DUONG_NA,
    nhan: '`.agent/config/na_reasons_rejected.json`',
    phepKiem: 'lý do n/a trùng lập luận ĐÃ BỊ BÁC',
    khiThieu: { rejected: [] },
  });
  if (!Array.isArray(j && j.rejected)) {
    if (j && j.rejected !== undefined) {
      console.error('[dim] ✗ na_reasons_rejected.json không có mảng `rejected`.');
      process.exit(1);
    }
    return [];
  }
  return j.rejected;
})();

/* Lớp PROJECT: thiếu là BÌNH THƯỜNG (theo thiết kế nó không ship) nên KHÔNG kêu — đây là chỗ im
 * lặng CÓ CHỦ Ý duy nhất trong khối này. Hỏng JSON thì vẫn chặn. */
const BANG_CHUNG_NA = (() => {
  const r = cfgLoad.doc(DUONG_NA_DA);
  if (r.hong) { console.error(`[dim] ✗ na_reasons_rejected.project.json HỎNG JSON: ${r.hong}`); process.exit(1); }
  return (r.data && r.data.bang_chung) || {};
})();
/** Bỏ dấu + thường hoá, để pattern viết bằng ASCII khớp được câu tiếng Việt có dấu. */
const boDau = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
const naRejected = [];
if (manifest && manifest.dimensions) {
  const exempt = new Set(Array.isArray(manifest.na_reasons_exempt) ? manifest.na_reasons_exempt : []);
  for (const [dim, v] of Object.entries(manifest.dimensions)) {
    const state = v && typeof v === 'object' ? (v.required === false ? 'n/a' : 'required') : v;
    if (state !== 'n/a') continue;
    const why = boDau((manifest.na_reasons || {})[dim] || '');
    if (!why) continue;
    for (const r of REJECTED_NA) {
      if (exempt.has(r.id)) continue;
      if (Array.isArray(r.ap_dung_cho) && r.ap_dung_cho.length && !r.ap_dung_cho.includes(dim)) continue;
      let re;
      try { re = new RegExp(r.pattern, 'i'); } catch (e) { continue; }
      if (re.test(why)) { naRejected.push({ dim, r }); break; }
    }
  }
}
if (naRejected.length) {
  console.error(`\n[dim] ✗ ${naRejected.length} chiều khai n/a bằng LẬP LUẬN ĐÃ BỊ BÁC ở task khác:`);
  for (const { dim, r } of naRejected) {
    console.error(`  - ${dim} — trúng "${r.id}". ${r.vi_sao_bac}`);
    const bc = BANG_CHUNG_NA[r.id];
    if (Array.isArray(bc) && bc.length) console.error(`    Đã bị bác ở: ${bc.join(' · ')}`);
    console.error(`    Thay bằng: ${r['lam-gi-thay-the']}`);
    console.error(`    Muốn giữ thì phải phản bác bằng chứng cứ MỚI, ghi vào _revisions rồi thêm "${r.id}" vào na_reasons_exempt.`);
  }
  if (ENFORCE) process.exit(1);
  console.error('[dim] (chưa --enforce nên KHÔNG chặn — nhưng lý do này đã bị bác rồi.)');
}

/*
 * MANIFEST ↔ BỘ CASE NÓI NGƯỢC NHAU. Chiều khai n/a mà case vẫn gắn tag chiều đó thì một trong hai sai,
 * và trước 30/09/2026 không phép kiểm nào đối chiếu hai file này: bảng cứ in "N/A (khai)" rồi thôi.
 * Chỉ chặn ở chế độ NHÃN — chế độ gợi ý suy tag từ văn bản nên chặn theo nó là báo oan.
 */
if (naButTagged.length) {
  console.error(`\n[dim] ✗ ${naButTagged.length} chiều khai n/a mà bộ case VẪN có case gắn tag chiều đó:`);
  for (const { d, tcs } of naButTagged) {
    console.error(`  - ${d.label} (${d.sec}) — manifest nói không áp dụng, nhưng ${tcs.length} case mang tag [${TAG_OF[d.id]}]: ${tcs.slice(0, 5).join(', ')}${tcs.length > 5 ? ' …' : ''}`);
    console.error('    Một trong hai sai. Hoặc lật manifest sang "required" (rồi chiều này phải đạt ngưỡng), hoặc gỡ tag khỏi các case đó nếu chúng thuộc chiều khác.');
  }
  if (ENFORCE) process.exit(1);
  console.error('[dim] (chưa --enforce nên KHÔNG chặn — nhưng manifest và bộ case đang nói ngược nhau.)');
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

/*
 * DƯỚI NGƯỠNG — tách khỏi "THIẾU" vì hai chuyện khác nhau: THIẾU là chưa nghĩ tới chiều đó; MỎNG là có
 * nghĩ nhưng phủ hình thức (1 case cho một chiều bắt buộc). Cả hai đều chặn ở `--enforce`, nhưng thông
 * điệp phải khác để người sửa biết phải làm gì.
 */
if (belowThreshold.length) {
  console.error(`\n[dim] ✗ ${belowThreshold.length} chiều bắt buộc DƯỚI NGƯỠNG (band ${bandOfTask} ⇒ ≥${DEFAULT_MIN} case/chiều):`);
  for (const b of belowThreshold) console.error(`  - ${b.d.label} (${b.d.sec}) — có ${b.have}, cần ${b.min}. "Có 1 case" không phải phủ: mở mục ${b.d.sec} của prompt gen và bổ sung ca thật, hoặc hạ ngưỡng có chủ ý bằng \`"${b.d.id}": { "required": true, "min": ${b.have} }\` kèm lý do.`);
  if (ENFORCE) process.exit(1);
  console.error('[dim] (chưa --enforce nên KHÔNG chặn — nhưng phủ hình thức thì báo cáo coverage đang nói sai.)');
}
