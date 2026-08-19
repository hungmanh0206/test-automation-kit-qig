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
  for (const [dir, script, label] of [['domain', 'domain_rules.js', 'domain'], ['system', 'system_map.js', 'system'], ['decisions', 'decisions.js', 'decisions'], ['setup_recipes', 'howto_store.js', 'howto'], ['environment', 'howto_store.js', 'howto']]) {
    if (!countJson(dir)) continue;
    const r = spawnSync(process.execPath, [path.join(__dirname, script), '--validate', '--enforce'], { encoding: 'utf8' });
    if (r.status === 1) {
      const out = `${r.stdout || ''}${r.stderr || ''}`;
      const n = (out.match(/✗ (\d+) lỗi CHẶN/) || [])[1] || '?';
      problems.push(`knowledge/${dir}/: ${n} lỗi schema/PII trong các record đã ghi → chạy \`npm run ${label}:check -- --enforce\` xem chi tiết.`);
    }
  }

  // 6b) MỖI câu hỏi Blocking đã RESOLVED phải để lại 1 record trong knowledge.
  //
  // Vì sao đây là điểm chốt: câu trả lời của BA sau Ambiguity Gate CHÍNH LÀ sự thật nghiệp vụ vừa được xác
  // nhận — và đó là **khoảnh khắc rẻ nhất** để ghi, vì thông tin đang ở ngay trước mặt. Bỏ lỡ thì task sau
  // phải đi hỏi lại từ đầu, hoặc tệ hơn là suy từ app (tautology).
  //
  // Bản trước chỉ kiểm THÔ: có RESOLVED mà `domain/` rỗng. Kiểm vậy tắt ngay khi có 1 record bất kỳ, nên
  // 10 câu trả lời mà ghi 1 cái là qua. Giờ soi TỪNG câu: record phải trích nguồn tới đúng mã câu hỏi
  // (`Q3`), và chấp nhận cả 3 store vì không phải câu nào cũng thành business rule —
  //   `domain/`    ← "giá trị đúng là gì"        `system/`  ← "được phép làm gì / luồng trạng thái"
  //   `decisions/` ← "cái này by-design, không phải bug"
  // Mức CẢNH BÁO (chưa chặn): có câu trả lời chỉ làm rõ scope, không sinh tri thức tái dùng — chặn cứng sẽ
  // ép ghi record rác. Siết thành chặn khi đã có số liệu thực tế từ vài task.
  const clar = taskDir ? path.join(taskDir, 'reports', 'phase1-clarifications.md') : '';
  if (clar && fs.existsSync(clar)) {
    const txt = fs.readFileSync(clar, 'utf8');
    // Gom nguồn 1 lần: mọi `source`/`_source` trong 3 store (record có thể nằm ở bất kỳ store nào).
    const sources = [];
    for (const d of ['domain', 'system', 'decisions']) {
      const dir = path.join(know, d);
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
        try { sources.push(JSON.stringify(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))); } catch (e) { /* file hỏng đã có check 6a */ }
      }
    }
    const blob = sources.join('\n');
    // Câu hỏi: dòng bắt đầu bằng `Q<n>` (theo format prompt gen mục 2). RESOLVED xét trên CẢ DÒNG đó.
    const rows = txt.split(/\r?\n/).filter((l) => /^\s*[|*-]?\s*\*{0,2}Q\d+\b/.test(l));
    const resolvedBlocking = rows.filter((l) => /RESOLVED/i.test(l) && /Blocking|Critical|High/i.test(l));
    const missing = resolvedBlocking
      .map((l) => (l.match(/\bQ(\d+)\b/) || [])[1])
      .filter(Boolean)
      .filter((q) => !new RegExp(`\\bQ${q}\\b`).test(blob));
    if (missing.length) {
      warnings.push(`${missing.length}/${resolvedBlocking.length} câu Blocking đã RESOLVED nhưng KHÔNG record nào trong \`knowledge/{domain,system,decisions}\` trích nguồn tới (${missing.map((q) => `Q${q}`).join(', ')}) — câu trả lời của BA là sự thật vừa xác nhận, không ghi thì task sau hỏi lại. Ghi record kèm \`source\` có mã câu (vd "phase1-clarifications Q3"). Skill: \`domain_recorder\` · \`system_mapper\` · \`decision_recorder\`.`);
    } else if (/RESOLVED/i.test(txt) && !resolvedBlocking.length && !countJson('domain')) {
      warnings.push('Có `phase1-clarifications.md` đã RESOLVED nhưng không nhận diện được câu Blocking nào (sai format `Q<n> … Blocking … RESOLVED`?) và `knowledge/domain/` RỖNG — kiểm lại file Q&A.');
    }
  }

  // 6b-bis) SAO LƯU store ghi tay — chống "quên chạy backup".
  //
  // Vì sao đứng ở đây: `knowledge/{domain,system,decisions,setup_recipes,environment,locators}` + `bug_tc_map`
  // là thứ DUY NHẤT trong kit không nạp lại được từ nguồn máy, và `knowledge/**` bị gitignore nên chúng tồn
  // tại trên ĐÚNG MỘT máy. Mối nguy KHÔNG phải hỏng ổ cứng mà là tai nạn git — đã xảy ra thật trong phiên
  // 14/08/2026: đổi nhánh khi sync GitLab xoá sạch `knowledge/**`, phải `git restore` lấy lại 87 file. Lần đó
  // cứu được vì file còn trong history; nay đã bỏ track hoàn toàn nên cùng tai nạn = MẤT VĨNH VIỄN.
  // Nhắc ở `self_review` (gate trước finalize) vì đó là lúc vừa sinh thêm record mới nhất trong lượt.
  {
    const HAND = ['domain', 'system', 'decisions', 'setup_recipes', 'environment', 'locators'];
    const handCount = HAND.reduce((s, d) => s + countJson(d), 0) + (fs.existsSync(path.join(know, 'bug_tc_map.json')) ? 1 : 0);
    const dest = process.env.KNOWLEDGE_BACKUP_DIR || '';
    if (handCount) {
      if (!dest) {
        warnings.push(`${handCount} record knowledge GHI TAY (không nạp lại được từ nguồn máy) mà CHƯA cấu hình \`KNOWLEDGE_BACKUP_DIR\` — chúng đang tồn tại trên đúng một máy và \`knowledge/**\` bị gitignore. Đặt đích NGOÀI repo trong \`.env\` rồi \`npm run knowledge:backup\`. Xem knowledge/SCHEMA.md §Chính sách sao lưu.`);
      } else {
        let newest = 0;
        try {
          for (const f of fs.readdirSync(dest).filter((x) => /^knowledge-backup-.*\.json$/.test(x))) {
            newest = Math.max(newest, fs.statSync(path.join(dest, f)).mtimeMs);
          }
        } catch (e) { /* đích chưa tồn tại → coi như chưa có bundle */ }
        if (!newest) warnings.push(`\`KNOWLEDGE_BACKUP_DIR\` đã đặt (${dest}) nhưng CHƯA có bundle nào — chạy \`npm run knowledge:backup\`.`);
        else {
          const days = Math.floor((Date.now() - newest) / 86400000);
          if (days >= 7) warnings.push(`Bundle knowledge mới nhất đã ${days} ngày (${dest}) — lượt này vừa ghi thêm record, chạy \`npm run knowledge:backup\` rồi \`--verify\` để chắc không lệch.`);
        }
      }
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

  // 6c-bis) setup_recipes/ — case vướng SETUP là chỗ tốn giờ nhất và tái diễn nguyên vẹn ở task sau.
  //
  // Vì sao nhắc ở đây: đo trên 80 memory tích luỹ của dự án đang chạy, **59% là "cách dựng state/fixture"** —
  // tức phần lớn thời gian thật tiêu ở "làm sao tới được đó", trong khi `Setup Strategy` chỉ sống trong TỪNG
  // task. Và bằng chứng rằng thêm store KHÔNG kèm máy nhắc thì store nằm chết: `locators/` có từ lâu, 0 file.
  // Dò theo status thật trong testcase-status.json (BLOCKED_SETUP/SKIP_SETUP/setup_failure), không đoán.
  if (taskDir && !countJson('setup_recipes')) {
    let stuck = 0;
    try {
      const st = JSON.parse(fs.readFileSync(path.join(taskDir, 'test-results', 'testcase-status.json'), 'utf8'));
      const tests = Array.isArray(st.tests) ? st.tests : Object.values(st.tests || {});
      stuck = tests.filter((t) => /BLOCKED_SETUP|SKIP_SETUP|setup_failure/i.test(`${t.status || ''} ${t.failureLayer || ''}`)).length;
    } catch (e) { /* chưa execute → bỏ qua */ }
    if (stuck) {
      warnings.push(`${stuck} case vướng setup (BLOCKED_SETUP/SKIP_SETUP/setup_failure) nhưng \`knowledge/setup_recipes/\` RỖNG — cách dựng state là thứ tốn giờ nhất và task sau sẽ mò lại y hệt. Ghi recipe kèm \`pitfalls\` (thứ chỉ biết sau khi đã vấp) rồi \`npm run howto:index\`.`);
    }
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

// 9) ĐỘ PHỦ BỀ MẶT — gate cũ chỉ hỏi "có catalog mà chưa chạy?", nên không khai catalog là né được
// hợp lệ. Đã xảy ra thật: catalog của một task chỉ khai 5 màn (toàn một luồng) trong khi testcase chạm
// ~29 nhóm chức năng — 4 bug hiển thị sau đó nằm đúng ở những màn không ai khai, conformance chạy xanh.
// Check này đổi câu hỏi thành: "scope chạm bao nhiêu bề mặt, catalog phủ bao nhiêu, phần chưa phủ đã khai chưa?".
{
  const problems = []; const warnings = [];
  let note = '';
  const STOP = new Set(['order', 'orders', 'quản', 'lý', 'quan', 'ly', 'tạo', 'tao', 'màn', 'man', 'và', 'va', 'theo', 'của', 'cua', 'các', 'cac', 'add', 'on', 'product', 'info', 'detail', 'list', 'create', 'view', 'tab', 'thông', 'tin', 'thong']);
  const norm = (s) => String(s || '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));
  if (taskDir && fs.existsSync(path.join(taskDir, 'test-cases'))) {
    // (a) bề mặt mà testcase tự khai — bảng "Phân nhóm testcase" do Phase 1 sinh
    const groups = [];
    for (const f of fs.readdirSync(path.join(taskDir, 'test-cases')).filter((x) => x.endsWith('.md'))) {
      const md = fs.readFileSync(path.join(taskDir, 'test-cases', f), 'utf8');
      const sec = md.split(/^##\s+/m).find((s) => /^Phân nhóm testcase/i.test(s));
      if (!sec) continue;
      for (const line of sec.split(/\r?\n/)) {
        const m = line.match(/^\|\s*([^|]+?)\s*\|/);
        if (!m) continue;
        const name = m[1].trim();
        if (!name || /^-+$/.test(name) || /^Nhóm chức năng$/i.test(name)) continue;
        groups.push(name);
      }
    }
    // (b) bề mặt đã được khai để đối chiếu máy — ui_catalog.json
    let screens = [];
    const cat = path.join(taskDir, 'requirements', 'ui_catalog.json');
    if (fs.existsSync(cat)) { try { screens = (JSON.parse(fs.readFileSync(cat, 'utf8')).screens || []).map((s) => s.name || ''); } catch (e) { problems.push(`\`ui_catalog.json\` không đọc được: ${e.message}`); } }

    if (groups.length) {
      const covered = []; const missing = [];
      const screenTokens = screens.map((s) => new Set(norm(s)));
      for (const g of groups) {
        const gt = norm(g);
        const hit = screenTokens.some((st) => gt.some((w) => st.has(w)));
        (hit ? covered : missing).push(g);
      }
      note = `${groups.length} nhóm chức năng · catalog ${screens.length} màn · phủ ${covered.length}`;
      if (!screens.length) {
        problems.push(`Testcase khai ${groups.length} nhóm chức năng nhưng KHÔNG có \`requirements/ui_catalog.json\` — nghĩa là 0 bề mặt được đối chiếu máy. Thiếu/thừa field và lệch nhãn giữa các màn không có gì bắt được.`);
      } else if (missing.length) {
        warnings.push(`${missing.length}/${groups.length} nhóm chức năng KHÔNG có màn nào trong \`ui_catalog.json\`: ${missing.slice(0, 8).join(' · ')}${missing.length > 8 ? ` … (+${missing.length - 8})` : ''}`);
        warnings.push('→ Mỗi nhóm chưa phủ hoặc phải bổ sung màn vào catalog, hoặc phải khai thành "Vùng chưa kiểm" trong reports/ kèm lý do. Catalog hẹp = conformance vẫn xanh mà cả vùng không ai soi.');
      }
    }
  }
  results.push(engine.toResult('độ phủ bề mặt (catalog vs nhóm chức năng)', {
    problems, warnings, skipped: !note, note: note || 'không có bảng "Phân nhóm testcase"', severity: engine.SEVERITY.P1,
  }));
}

// 10) 5 TRỤC MỞ RỘNG QUANH CASE — máy nào chưa chạy thì trục đó chưa ai soi.
// Luật ở RULE_GLOBAL §5 trục mở rộng nói "phải mở rộng theo 5 trục", nhưng luật không có máy thì trôi: lượt trước
// chỉ cần không khai catalog là né được cả check #9. Ở đây KHÔNG chấm "đã mở rộng đủ chưa" (không đo được), mà
// chấm thứ đo được: **artefact của từng máy có tồn tại trong task này hay không**. Máy chưa chạy = trục chưa soi.
// Để mức P1 (cảnh báo) có chủ đích: đo trên task thật trước, đủ dữ liệu rồi mới bàn chặn.
if (taskDir) {
  const problems = [];
  const warnings = [];
  const glob1 = (dir, rx) => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => rx.test(f));
  };
  const resDir = path.join(taskDir, 'test-results');
  const repDir = path.join(taskDir, 'reports');
  const reqDir = path.join(taskDir, 'requirements');
  // Mỗi trục: [tên, có chạy chưa, lệnh để chạy]
  const axes = [
    ['① field cùng khối (spec→UI)',
      glob1(resDir, /^conformance/).some((d) => fs.existsSync(path.join(resDir, d, 'conformance_report.json'))),
      'npm run spec:extract … --catalog … rồi node scripts/qa/ui_conformance_check.js --catalog …'],
    ['chiều ngược (build→tài liệu)', glob1(repDir, /spec-gap/i).length > 0, 'npm run spec:gap -- --screens … --surface … --bindings …'],
    ['② cùng giá trị khác nơi hiển thị', glob1(repDir, /cross-surface/i).length > 0, 'npm run xsurf:diff -- --config requirements/cross_surface.json --out reports/cross-surface.md'],
    ['③ chuỗi lưu trữ form→payload→API→UI', glob1(repDir, /persist|probe/i).length > 0, 'npm run probe:persist -- --chains … --out reports/persistence-probe.md'],
    ['④⑤ nhánh × trạng thái', glob1(repDir, /fixture-matrix/i).length > 0, 'npm run fixture:matrix -- --config requirements/fixture_matrix.json --discover --out reports/fixture-matrix.md'],
  ];
  const missing = axes.filter(([, ran]) => !ran);
  for (const [name, , how] of missing) warnings.push(`trục ${name}: chưa có artefact nào ⇒ trục này CHƯA ai soi. Chạy: ${how}`);
  // CHỐNG "có file là xong": báo cáo tồn tại nhưng nội dung toàn "chưa kiểm được" thì trục đó vẫn chưa soi.
  // Chính tôi vừa cân nhắc tạo một artefact khuyết chỉ để check này xanh — nên bịt luôn đường đó.
  for (const [rx, name, weak] of [
    [/cross-surface/i, 'trục ②', /CHƯA KIỂM ĐƯỢC|chưa kiểm được/],
    [/persist|probe/i, 'trục ③', /đo thiếu điểm|chuỗi ĐO KHUYẾT|partial/i],
    [/fixture-matrix/i, 'trục ④⑤', /TRỐNG \*\*[1-9]/],
  ]) {
    for (const f of glob1(repDir, rx)) {
      const body = fs.readFileSync(path.join(repDir, f), 'utf8');
      const hasResult = /✓ khớp|4\/4 điểm khớp|✓ /.test(body);
      if (weak.test(body) && !hasResult) warnings.push(`${name}: có \`reports/${f}\` nhưng nội dung KHÔNG chứng minh được gì (toàn "chưa kiểm được") — artefact rỗng nghĩa không phải là đã soi.`);
    }
  }
  // Có config mà chưa chạy thì nặng hơn: người đã khai phạm vi rồi bỏ dở.
  for (const [cfg, rx, name] of [['cross_surface.json', /cross-surface/i, 'trục ②'], ['fixture_matrix.json', /fixture-matrix/i, 'trục ④⑤']]) {
    if (fs.existsSync(path.join(reqDir, cfg)) && !glob1(repDir, rx).length) {
      problems.push(`Có \`requirements/${cfg}\` nhưng CHƯA có báo cáo ${name} — khai phạm vi rồi không chạy thì bằng không chạy.`);
    }
  }
  results.push(engine.toResult('5 trục mở rộng quanh case (máy nào đã chạy)', {
    problems,
    warnings,
    note: `${axes.length - missing.length}/${axes.length} trục có artefact`,
    severity: engine.SEVERITY.P1,
  }));
}

// ---- Gộp + in qua GateEngine ----
const agg = engine.aggregate(results);
console.log(engine.format(agg, { title: `SELF-REVIEW (G9) — lượt 2 trước finalize${TASK ? ` · task ${TASK}` : ''}` }));
if (agg.totalFail) console.log(`\n⚠ Còn ${agg.totalFail} vấn đề CHẶN — SỬA trước khi finalize/publish (self-review advisory; gate thật chặn ở push).`);
else console.log('\n✓ Không còn vấn đề CHẶN. Rà cảnh báo rồi finalize.');
process.exit(0);
