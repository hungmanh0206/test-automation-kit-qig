#!/usr/bin/env node
'use strict';

/*
 * self_review.js (G9 round-3 · #2 dùng GateEngine) — Lượt 2: đối chiếu CHECKLIST trước finalize (ADVISORY).
 *
 * Chống "check chưa kỹ": gom mọi gate liên quan của 1 task → MỘT báo cáo qua GateEngine (interface
 * chuẩn {gateId,status,severity,findings} + aggregate). Điều phối (không viết lại) preflight + design_gate
 * + output_gate (gen-testcase rows + test-execution). CHỈ advisory (exit 0), nêu rõ còn CHẶN ở gate nào.
 *
 * Dùng: node scripts/qa/self_review.js [--task <TASK_KEY>] [--tc-dir <dir>] [--status <testcase-status.json>]
 * Exit: luôn 0 (advisory).
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const preflight = require(path.resolve(__dirname, 'preflight_gate'));
const outputGate = require(path.resolve(__dirname, 'output_gate'));
const designGate = require(path.resolve(__dirname, 'design_gate'));
const engine = require(path.resolve(__dirname, 'lib', 'gate_engine'));
const testcaseModel = require(path.resolve(__dirname, '..', 'lib', 'testcase')); // parser canonical (check #6c)

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };

const TASK = arg('task', process.env.TASK_KEY || '');
const POD = process.env.PROJECT_OUTPUT_DIR || '';
const taskDir = (TASK && POD) ? path.resolve(rc.REPO_ROOT, POD, 'tasks', TASK) : null;

const results = [];

// 1) Preflight — input/config integrity.
{
  const r = preflight.runPreflight({ mode: TASK ? 'phase2' : 'generic', task: TASK });
  results.push(engine.toResult('preflight (input/config)', { problems: r.problems || [], warnings: r.warnings || [], severity: engine.SEVERITY.P0 }));
}

// 2) Testcase design + row-quality.
const tcDir = arg('tc-dir', taskDir ? path.join(taskDir, 'test-cases') : '');
if (tcDir && fs.existsSync(tcDir)) {
  const files = fs.readdirSync(tcDir).filter((f) => f.endsWith('.md'));
  const problems = []; const warnings = [];
  for (const f of files) {
    const md = fs.readFileSync(path.join(tcDir, f), 'utf8');
    const d = designGate.gateDesign(md);
    (d.problems || []).forEach((p) => problems.push(`${f}: ${p}`));
    (d.warnings || []).forEach((p) => warnings.push(`${f}: ${p}`));
    const parsed = outputGate.parseTestcaseTable(md);
    for (const row of parsed.rows) { const g = outputGate.gateTestcaseRow(row); g.problems.forEach((p) => problems.push(`${f}: ${p}`)); g.warnings.forEach((p) => warnings.push(`${f}: ${p}`)); }
  }
  results.push(engine.toResult('testcase design + row-quality', { problems, warnings, skipped: !files.length, note: files.length ? `${files.length} file` : 'không có .md', severity: engine.SEVERITY.P0 }));
} else {
  results.push(engine.toResult('testcase design + row-quality', { skipped: true, note: 'không thấy test-cases/', severity: engine.SEVERITY.P0 }));
}

// 3) Execution output (comment/evidence/tầng-lỗi/attestation).
const statusFile = arg('status', taskDir ? path.join(taskDir, 'test-results', 'testcase-status.json') : '');
if (statusFile && fs.existsSync(statusFile)) {
  try {
    const doc = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    const g = outputGate.gateTestExecution(doc);
    results.push(engine.toResult('execution output', { problems: g.problems, warnings: g.warnings, note: `${g.executed} case đã execute`, severity: engine.SEVERITY.P0 }));
  } catch (e) {
    results.push(engine.toResult('execution output', { problems: [`testcase-status.json lỗi JSON: ${e.message}`], severity: engine.SEVERITY.P0 }));
  }
} else {
  results.push(engine.toResult('execution output', { skipped: true, note: 'không thấy testcase-status.json', severity: engine.SEVERITY.P0 }));
}

// 4) Learning data (F10/F11) — chống "làm nhiều task mà knowledge/ vẫn trống".
// Workflow phase2_04 Bước 9 yêu cầu ghi learning entry, nhưng vốn "Suggest-only" nên hay bị bỏ →
// check ở đây: đã execute (có testcase-status.json) thì PHẢI có snapshot + KPI cho task này.
{
  const know = path.join(rc.REPO_ROOT, 'knowledge');
  const executed = Boolean(statusFile && fs.existsSync(statusFile));
  if (!executed || !TASK) {
    results.push(engine.toResult('learning data (knowledge/)', { skipped: true, note: executed ? 'thiếu TASK_KEY' : 'chưa execute', severity: engine.SEVERITY.P1 }));
  } else {
    const problems = [];
    const histDir = path.join(know, 'historical_execution');
    const hasSnap = fs.existsSync(histDir) && fs.readdirSync(histDir).some((f) => f.startsWith(`${TASK}__`));
    if (!hasSnap) problems.push(`Thiếu knowledge/historical_execution/${TASK}__<date>.json (snapshot pass/fail theo module — input cho risk_score + dashboard)`);
    // KPI chỉ đòi khi task THỰC SỰ có results.json (execute qua Playwright runner). Task chạy bằng
    // script tự chế không sinh results.json → đòi KPI là CHẶN OAN (đã gặp thật).
    const trDir = path.join(path.dirname(statusFile));
    let hasResults = fs.existsSync(path.join(trDir, 'results.json'));
    if (!hasResults && fs.existsSync(trDir)) {
      hasResults = fs.readdirSync(trDir).some((d) => {
        try { return fs.statSync(path.join(trDir, d)).isDirectory() && fs.existsSync(path.join(trDir, d, 'results.json')); } catch (e) { return false; }
      });
    }
    const runsFile = path.join(know, 'metrics', 'runs.jsonl');
    let hasKpi = false;
    if (fs.existsSync(runsFile)) {
      hasKpi = fs.readFileSync(runsFile, 'utf8').split(/\r?\n/).filter(Boolean).some((line) => {
        try { return String(JSON.parse(line).label || '').split('/')[0] === TASK; } catch (e) { return false; }
      });
    }
    if (hasResults && !hasKpi) problems.push(`Thiếu KPI cho ${TASK} trong knowledge/metrics/runs.jsonl (có results.json mà chưa thu — chạy \`npm run learn\`)`);
    if (problems.length) problems.push('→ Chạy: `TASK_ENV=profiles/<TASK>/task.env npm run learn` (idempotent, chạy lại không nhân đôi).');

    // Có case FAILED nhưng knowledge/bugs chưa có entry nào của task → nhiều khả năng quên `learn:bugs`.
    // Chỉ CẢNH BÁO (không chặn): FAILED có thể là setup/flaky — loại đó KHÔNG được ghi vào knowledge.
    const warnings = [];
    try {
      const doc = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
      const tests = Array.isArray(doc.tests) ? doc.tests : Object.values(doc.tests || {});
      const failed = tests.filter((t) => /^FAIL/i.test(String(t.status || ''))).length;
      const bugsDir = path.join(know, 'bugs');
      const hasBug = fs.existsSync(bugsDir) && fs.readdirSync(bugsDir).some((f) => f.startsWith(`${TASK}__`));
      if (failed && !hasBug) warnings.push(`${failed} case FAILED nhưng knowledge/bugs chưa có entry của ${TASK} — nếu đã log bug Jira, chạy \`npm run learn:bugs:apply\` để risk_score có bugCount (bỏ qua nếu FAILED là setup/flaky, loại đó KHÔNG ghi vào knowledge).`);
    } catch (e) { /* đã báo ở check execution output */ }

    results.push(engine.toResult('learning data (knowledge/)', { problems, warnings, note: problems.length ? 'learning loop ĐỨT — task chạy xong nhưng không học được gì' : 'đã tích luỹ snapshot + KPI', severity: engine.SEVERITY.P1 }));
  }
}

// 5) Locator discipline — chống "bắt sai element → log bug sai" (nguyên nhân số 1 của bug sai).
// Chỉ báo P0 PHÁT SINH THÊM so với baseline (nợ cũ không chặn), để gate dùng được ngay.
{
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [path.join(__dirname, 'locator_lint.js'), '--enforce'], { encoding: 'utf8' });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const problems = []; const warnings = [];
  const m = out.match(/CHẶN: (\d+) khoá file\+rule có P0 MỚI/);
  if (m) {
    problems.push(`${m[1]} khoá file+rule có anti-pattern định vị P0 MỚI (force:true / .first() cấp trang / click toạ độ / regex body / quét toàn DOM) → dễ bấm-đọc nhầm đối tượng rồi kết luận bug sai.`);
    (out.match(/^\s{2}\S+::\S+\s+\d+ → \d+$/gm) || []).slice(0, 5).forEach((l) => problems.push(`  ${l.trim()}`));
    problems.push('→ Sửa theo `.agent/rules/locator_strategy.md` (neo scope → resolve đúng-1 → nghiệm thu kết quả) hoặc dùng `scripts/utils/ui/safe_target.js`. Chạy: `npm run lint:locator`.');
  }
  const tot = (out.match(/·\s+(\d+) finding/) || [])[1];
  if (!m && tot && Number(tot) > 0) warnings.push(`${tot} anti-pattern định vị (nợ cũ, không phát sinh thêm) — dọn dần khi đụng lại file đó: \`npm run lint:locator\`.`);
  results.push(engine.toResult('locator discipline (chống bug sai)', { problems, warnings, note: m ? 'có P0 MỚI' : 'không phát sinh P0 mới', severity: engine.SEVERITY.P0 }));
}

// 6) Knowledge stores GHI TAY (domain/system/decisions) — chống đúng cái bẫy "có store, có validator,
// nhưng không gate nào gọi ⇒ rỗng mãi". Khác check #4: #4 lo dữ liệu MÁY tự thu (snapshot/KPI/bug),
// còn 3 store này chỉ có người/agent ghi được nên phải bị nhắc ở đây, không thì y hệt knowledge/ ngày xưa.
//   - Record đã tồn tại mà sai schema/PII → CHẶN (validator của từng store quyết).
//   - Store rỗng → chỉ nhắc khi CÓ TÍN HIỆU là task này đáng lẽ phải ghi (không nhắc chung chung).
{
  const { spawnSync } = require('child_process');
  const know = path.join(rc.REPO_ROOT, 'knowledge');
  const problems = []; const warnings = [];
  const countJson = (d) => { try { return fs.readdirSync(path.join(know, d)).filter((f) => f.endsWith('.json')).length; } catch (e) { return 0; } };

  // 6a) Validate từng store (chỉ chạy khi có record → store rỗng không bao giờ chặn).
  for (const [dir, script, label] of [['domain', 'domain_rules.js', 'domain'], ['system', 'system_map.js', 'system'], ['decisions', 'decisions.js', 'decisions']]) {
    if (!countJson(dir)) continue;
    const r = spawnSync(process.execPath, [path.join(__dirname, script), '--validate', '--enforce'], { encoding: 'utf8' });
    if (r.status === 1) {
      const out = `${r.stdout || ''}${r.stderr || ''}`;
      const n = (out.match(/✗ (\d+) lỗi CHẶN/) || [])[1] || '?';
      problems.push(`knowledge/${dir}/: ${n} lỗi schema/PII trong các record đã ghi → chạy \`npm run ${label}:check -- --enforce\` xem chi tiết.`);
    }
  }

  // 6b) domain/ — câu trả lời của BA sau Ambiguity Gate CHÍNH LÀ business truth vừa được xác nhận.
  const clar = taskDir ? path.join(taskDir, 'reports', 'phase1-clarifications.md') : '';
  if (clar && fs.existsSync(clar)) {
    const txt = fs.readFileSync(clar, 'utf8');
    if (/RESOLVED/i.test(txt) && !countJson('domain')) {
      warnings.push('Có `phase1-clarifications.md` đã RESOLVED (BA/QA đã trả lời) nhưng `knowledge/domain/` RỖNG — câu trả lời đó là business truth, không ghi lại thì task sau phải đi hỏi lại. Skill `domain_recorder`.');
    }
  }

  // 6c) system/ — bộ TC có case guard/phân quyền/trạng thái mà chưa có bản đồ nào ⇒ oracle của mấy case đó
  // đang phải suy từ app (tautology). Dò bằng dấu hiệu trong tiêu đề case, không đoán theo module.
  if (taskDir && !countJson('system')) {
    const tcDir = path.join(taskDir, 'test-cases');
    let hits = 0;
    try {
      for (const f of fs.readdirSync(tcDir).filter((x) => x.endsWith('.md'))) {
        const doc = testcaseModel.parseMarkdown(fs.readFileSync(path.join(tcDir, f), 'utf8'));
        hits += ((doc && doc.tests) || []).filter((t) => /403|401|không có quyền|khong co quyen|phân quyền|phan quyen|permission|trạng thái|trang thai|đã thanh toán|da thanh toan|đã huỷ|da huy|không được phép|khong duoc phep/i.test(`${t.title || ''} ${t.expected || ''}`)).length;
      }
    } catch (e) { /* không có test-cases/ → bỏ qua */ }
    if (hits) warnings.push(`${hits} case liên quan phân quyền/trạng thái/guard nhưng \`knowledge/system/\` RỖNG — expected của mấy case đó đang không có nguồn trích dẫn (dễ thành "app cho làm ⇒ coi là đúng"). Ghi state machine / ma trận quyền: skill \`system_mapper\`.`);
  }

  // 6d) decisions/ — bug đã Rejected mà không lưu lý do chính là bug sẽ bị log lại lần sau.
  {
    const r = spawnSync(process.execPath, [path.join(__dirname, 'decisions.js')], { encoding: 'utf8' });
    const out = `${r.stdout || ''}${r.stderr || ''}`;
    const m = out.match(/(\d+) bug bị Rejected\/Won't-Do mà CHƯA có lý do/);
    if (m) warnings.push(`${m[1]} bug Rejected/Won't-Do chưa lưu lý do — chính là bug sẽ bị log lại ở task sau. Ghi \`false_positive\`/\`by_design\` kèm lý do dev đưa ra: skill \`decision_recorder\` (\`npm run decisions:check\` để xem tên).`);
    const exp = out.match(/(\d+) quyết định ĐÃ QUÁ HẠN/);
    if (exp) warnings.push(`${exp[1]} quyết định đã quá \`expires_at\` mà còn \`active\` — phải kiểm lại, đừng để hạn chế tạm thời thành luật vĩnh viễn.`);
  }

  const filled = ['domain', 'system', 'decisions'].filter((d) => countJson(d)).length;
  results.push(engine.toResult('knowledge ghi tay (domain/system/decisions)', {
    problems, warnings, note: `${filled}/3 store có dữ liệu`, severity: engine.SEVERITY.P1,
  }));
}

// 7) VÙNG CHƯA KIỂM — chặn kỹ thuật không được tan vào SKIP.
// Vì sao: rà một task thật thấy cả một họ màn hình (checkout của một loại order) không verify được vì tường
// fixture; agent thử vài lượt rồi đi tiếp, các case đó nằm im dưới dạng SKIP/BLOCKED giữa hàng trăm record —
// báo cáo cuối vẫn xanh, và đúng vùng đó sau này lộ ra 3 bug do người khác tìm. Chặn kỹ thuật là THÔNG TIN,
// phải nổi lên thành mục "vùng chưa kiểm" có tên, không được chìm.
{
  const problems = []; const warnings = [];
  let blocked = 0; const ids = [];
  if (statusFile && fs.existsSync(statusFile)) {
    try {
      const doc = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
      const tests = Array.isArray(doc.tests) ? doc.tests : Object.values(doc.tests || {});
      for (const t of tests) {
        if (!/^(SKIP|BLOCKED|TO ?DO)/i.test(String(t.status || '').trim())) continue;
        blocked += 1;
        if (ids.length < 8) ids.push(String(t.tcId || t.id || '?'));
      }
    } catch (e) { /* đã báo ở check execution output */ }
  }
  if (blocked) {
    // Thoả điều kiện khi report cuối có mục liệt kê vùng chưa kiểm, HOẶC có quyết định trong knowledge
    // ghi nhận chặn kỹ thuật (kèm expires_at để buộc quay lại).
    const reportDir = taskDir ? path.join(taskDir, 'reports') : '';
    let declared = false;
    try {
      for (const f of fs.existsSync(reportDir) ? fs.readdirSync(reportDir) : []) {
        if (!f.endsWith('.md')) continue;
        if (/vùng chưa kiểm|vung chua kiem|chưa verify được|coverage gap/i.test(fs.readFileSync(path.join(reportDir, f), 'utf8'))) { declared = true; break; }
      }
    } catch (e) { /* bỏ qua */ }
    if (!declared) {
      const decDir = path.join(rc.REPO_ROOT, 'knowledge', 'decisions');
      try {
        declared = fs.existsSync(decDir) && fs.readdirSync(decDir).filter((f) => f.endsWith('.json')).some((f) => {
          const d = JSON.parse(fs.readFileSync(path.join(decDir, f), 'utf8'));
          return d && d.type === 'test_approach' && d.status === 'active' && (d.scope || {}).tc_ids && d.scope.tc_ids.some((x) => ids.includes(String(x)));
        });
      } catch (e) { /* bỏ qua */ }
    }
    if (!declared) {
      problems.push(`${blocked} case SKIP/BLOCKED/TO-DO nhưng KHÔNG có mục "Vùng chưa kiểm" trong reports/*.md, cũng không có quyết định \`test_approach\` nào trong knowledge/decisions ghi nhận chặn kỹ thuật (vd ${ids.slice(0, 5).join(', ')}).`);
      problems.push('→ Liệt kê thành mục có tên: vùng nào chưa verify, chặn vì cái gì, cần gì để mở. Chặn kỹ thuật chìm trong SKIP = báo cáo xanh trên một vùng chưa ai nhìn.');
    } else {
      warnings.push(`${blocked} case SKIP/BLOCKED/TO-DO — đã được khai báo thành vùng chưa kiểm. Rà lại xem đã đủ điều kiện mở chưa.`);
    }
  }
  results.push(engine.toResult('vùng chưa kiểm (chặn kỹ thuật)', {
    problems, warnings, skipped: !blocked, note: blocked ? `${blocked} case chưa verify` : 'không có case bị chặn', severity: engine.SEVERITY.P0,
  }));
}

// 8) CASE HIỂN THỊ PHẢI VERIFY QUA UI — chạy API cho case màn hình thì lỗi mapping/hiển thị phía FE
// KHÔNG THỂ lộ ra (bất khả theo định nghĩa, không phải xui). Đây là một trong 4 nguyên nhân làm lọt cụm bug
// UI ở một dự án thật. Ghép record status với testcase canonical theo tcId để biết case nào thuộc nhóm hiển thị.
{
  const problems = []; const warnings = [];
  let display = 0; let apiOnly = 0;
  const DISPLAY = /hiển thị|hien thi|format|định dạng|dinh dang|\blabel\b|cột |cot |placeholder|tooltip|empty[- ]state|tiêu đề|tieu de/i;
  const API_SIGN = /\bAPI\b|HTTP|endpoint|payload|response|POST |GET |PATCH |\/api\//i;
  const UI_SIGN = /\bUI\b|màn |man |OPS |LMS |form|lưới|grid|cột |cot |hiển thị trên|screenshot|ảnh|anh |tab /i;
  if (statusFile && fs.existsSync(statusFile) && taskDir) {
    try {
      const tcDir = path.join(taskDir, 'test-cases');
      const byId = new Map();
      for (const f of (fs.existsSync(tcDir) ? fs.readdirSync(tcDir) : []).filter((x) => x.endsWith('.md'))) {
        const d = testcaseModel.parseMarkdown(fs.readFileSync(path.join(tcDir, f), 'utf8'));
        for (const t of (d && d.tests) || []) if (t.tcId) byId.set(String(t.tcId), t);
      }
      const doc = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
      const tests = Array.isArray(doc.tests) ? doc.tests : Object.values(doc.tests || {});
      const bad = [];
      for (const r of tests) {
        if (!/^(PASS|FAIL)/i.test(String(r.status || '').trim())) continue;
        const t = byId.get(String(r.tcId || ''));
        if (!t || !DISPLAY.test(`${t.title || ''} ${t.expected || ''}`)) continue;
        display += 1;
        const cm = String(r.comment || '');
        if (API_SIGN.test(cm) && !UI_SIGN.test(cm)) { apiOnly += 1; if (bad.length < 6) bad.push(String(r.tcId)); }
      }
      if (apiOnly) {
        problems.push(`${apiOnly}/${display} case thuộc nhóm HIỂN THỊ nhưng kết luận chỉ dẫn chứng API, không có dấu vết đọc trên màn (${bad.join(', ')}).`);
        problems.push('→ Case hiển thị PHẢI verify trên UI: chạy API thì lỗi render/mapping phía FE bất khả lộ ra. Dùng API để DỰNG data thì được, phần verify phải đọc trên màn + evidence là ảnh màn đó.');
      }
    } catch (e) { /* đã báo ở check execution output */ }
  }
  // Catalog CÓ mà CHƯA CHẠY thì cũng bằng không: mắt xích cuối là bằng chứng đã quan sát màn thật.
  if (display && taskDir) {
    const cat = path.join(taskDir, 'requirements', 'ui_catalog.json');
    if (fs.existsSync(cat)) {
      const confDir = path.join(taskDir, 'test-results', 'conformance');
      const ran = fs.existsSync(path.join(confDir, 'conformance_report.json'));
      const snaps = (() => { try { return fs.readdirSync(path.join(confDir, 'snapshots')).filter((f) => f.endsWith('.json')).length; } catch (e) { return 0; } })();
      if (!ran) problems.push(`Có \`ui_catalog.json\` nhưng CHƯA CHẠY đối chiếu: thiếu \`test-results/conformance/conformance_report.json\`. Catalog không chạy thì không kiểm được gì — chạy \`node scripts/qa/ui_conformance_check.js --catalog ${path.relative(rc.REPO_ROOT, cat).replace(/\\/g, '/')}\`.`);
      else if (!snaps) warnings.push('Đã chạy conformance nhưng không có snapshot màn nào trong `test-results/conformance/snapshots/` — snapshot là dấu vết "màn đang có gì", thiếu nó thì phần catalog chưa khai vẫn là vùng mù.');
    }
  }
  results.push(engine.toResult('case hiển thị verify qua UI', {
    problems, warnings, skipped: !display, note: display ? `${display} case hiển thị` : 'không có case hiển thị đã execute', severity: engine.SEVERITY.P0,
  }));
}

// ---- Gộp + in qua GateEngine ----
const agg = engine.aggregate(results);
console.log(engine.format(agg, { title: `SELF-REVIEW (G9) — lượt 2 trước finalize${TASK ? ` · task ${TASK}` : ''}` }));
if (agg.totalFail) console.log(`\n⚠ Còn ${agg.totalFail} vấn đề CHẶN — SỬA trước khi finalize/publish (self-review advisory; gate thật chặn ở push).`);
else console.log('\n✓ Không còn vấn đề CHẶN. Rà cảnh báo rồi finalize.');
process.exit(0);
