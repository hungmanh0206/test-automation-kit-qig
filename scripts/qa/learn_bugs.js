#!/usr/bin/env node
'use strict';

/*
 * learn_bugs.js — nối mắt xích còn ĐỨT: bug đã log Jira → knowledge/bugs/ (+ root_causes ref, index).
 *
 * VÌ SAO CẦN: `risk_score` tính Likelihood = f(bugCount theo module, failRate theo module). Sau khi
 * learn_task.js cấp failRate thì bugCount vẫn = 0 vì `knowledge/bugs/` chỉ được ghi khi agent nhớ chạy
 * skill `learning_recorder` (Suggest-only) → thực tế luôn bị bỏ. Script này lấy bug TỪ CHÍNH JIRA nên
 * không phụ thuộc agent có nhớ hay không, và KHÔNG cần sửa `bug_reporter.js`.
 *
 * NGUỒN CANONICAL: bug do kit tạo luôn có label `auto-bug` + label `<tcId>` và là sub-task của story
 * (xem bug_reporter.js). Vào Jira query đúng bộ đó ⇒ chỉ học bug ĐÃ QUA GATE (đúng nguyên tắc
 * knowledge/SCHEMA.md: chỉ ghi fact đã qua gate, không học rác từ flaky/setup).
 *
 * Module của bug suy từ tcId → cột `Module` của testcase canonical (dùng chung map với learn_task.js).
 * Idempotent: đã có file thì chỉ ĐỒNG BỘ `jira_status` (rerun chuyển Done → cập nhật), không tạo trùng.
 *
 * Dùng:
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/qa/learn_bugs.js            # dry-run: chỉ in
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/qa/learn_bugs.js --apply
 *   [--task <KEY>] [--story <JIRA_STORY_KEY>] [--project <PROJ>] [--max 100]
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const { loadEnv, buildJiraHeaders } = require(path.resolve(__dirname, '..', 'integrations', 'jira', 'utils.js'));
const learn = require(path.resolve(__dirname, 'learn_task.js'));

loadEnv();

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const APPLY = process.argv.includes('--apply');
const TASK = arg('task', process.env.TASK_KEY || '');
const STORY = arg('story', process.env.JIRA_STORY_KEY || '');
const PROJECT = arg('project', process.env.JIRA_PROJECT_KEY || 'SAPP');
const MAX = parseInt(arg('max', '100'), 10) || 100;
const BASE = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');
const KNOW = path.join(rc.REPO_ROOT, 'knowledge');
const BUGS_DIR = path.join(KNOW, 'bugs');

if (!TASK) { console.error('[learn-bugs] cần TASK context (TASK_ENV hoặc --task).'); process.exit(2); }
if (!BASE) { console.error('[learn-bugs] thiếu JIRA_BASE_URL.'); process.exit(2); }

const POD = process.env.PROJECT_OUTPUT_DIR || '';
const taskDir = POD ? path.resolve(rc.REPO_ROOT, POD, 'tasks', TASK) : '';
const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'bug';

/** tcId xuất hiện trong labels của issue (bug_reporter gắn label = tcId). */
function tcIdFromLabels(labels, known) {
  for (const l of labels || []) { if (known.has(l)) return l; }
  // fallback: label trông giống TC ID (CHỮ_HOA_TC_001)
  return (labels || []).find((l) => /_TC_\d+/i.test(l)) || null;
}

/** Gộp text ADF (description/comment) thành chuỗi phẳng để dò TC ID. */
function flattenAdf(node) {
  let s = '';
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (n.text) s += ` ${n.text}`;
    (n.content || []).forEach(walk);
  };
  walk(node);
  return s;
}

/**
 * TC ID nêu TƯỜNG MINH trong description/comment (vd QA viết "Liên quan test case OPS_PAY_TC_255").
 *
 * VÌ SAO thêm nguồn này: label là nguồn chính nhưng hay bị quên khi log bug — đo 14/08/2026: 23/46 bug
 * KHÔNG có label TC ⇒ rơi vào "(unmapped)" và `risk_score` LOẠI khỏi bảng, tức log rồi cũng không ảnh hưởng
 * độ sâu test lượt sau. Trong 23 cái đó, **4 cái có nêu TC ID ngay trong description** — nguồn do QA tự viết
 * nên đáng tin.
 *
 * CHỈ nhận mã CÓ THẬT trong bộ canonical (`known`). Đã thử cách suy module từ TIÊU ĐỀ bug và **loại bỏ**:
 * 9/23 ca trông "chắc" nhưng soi ra ≥4 sai rõ ràng (vd "Add-on Order không đồng bộ HubSpot" bị gán
 * "Check tiền & Ghi nhận doanh thu"). Gán SAI module còn tệ hơn để "(unmapped)": nó bơm Likelihood cho
 * module vô can và làm lệch việc chọn độ sâu test. Thà thiếu còn hơn sai.
 */
function tcIdFromText(fields, known) {
  const txt = `${flattenAdf(fields.description)} ${((fields.comment && fields.comment.comments) || []).map((c) => flattenAdf(c.body)).join(' ')}`;
  const found = [...new Set(txt.match(/\b[A-Z][A-Z0-9_]*_TC_\d+\b/g) || [])].filter((t) => known.has(t));
  return found.length === 1 ? found[0] : (found[0] || null);   // nhiều mã → lấy mã đầu (module thường trùng)
}

/**
 * Bản đồ CHỐT BẰNG TAY: bug key → { tc_id } hoặc { module, coverage_gap }.
 *
 * VÌ SAO CẦN nguồn thứ ba: label là nguồn chính, description là nguồn vét. Cả hai đều do người log bug nhớ
 * ghi — đo 14/08/2026 thì 22/53 bug không có cả hai ⇒ `(unmapped)` ⇒ `risk_score` loại khỏi bảng ⇒ log bug
 * mà không làm sâu thêm test lượt sau. Không sửa được bằng máy: đã thử suy từ tiêu đề (≥4/9 sai) và bảng
 * `label → module` (5/17 label đa nghĩa; `be` trải 6 module). Nên nguồn cuối là người chốt, có `basis` để
 * kiểm lại được, và tách 2 hạng: `tc_id` = có TC phát biểu đúng hành vi bị phá; `module` + `coverage_gap`
 * = không TC nào phát biểu ⇒ chính việc thiếu TC là phát hiện. Sinh ứng viên: `npm run bug:tc-match`.
 */
function loadManualMap() {
  const p = path.join(KNOW, 'bug_tc_map.json');
  // Cảnh báo MẤT FILE. Đây là store DUY NHẤT trong knowledge/ không nạp lại được từ nguồn máy (nó là phán đoán
  // của người: đọc TC rồi chốt). File bị gitignore nên `git clean -xfd` hoặc đổi nhánh xoá nó KHÔNG kêu gì.
  // Mất file MỘT MÌNH chưa hỏng ngay (record trong bugs/ đã giữ `module`); hỏng khi mất file RỒI nạp lại
  // bugs/ từ Jira — mapping biến mất và bug âm thầm quay về "(unmapped)". Vì vậy điều kiện cảnh báo là
  // "thiếu file MÀ đang có bug (unmapped)": đúng đó là kịch bản mất thật, không kêu oan lúc bình thường.
  if (!fs.existsSync(p)) {
    const n = fs.existsSync(BUGS_DIR)
      ? fs.readdirSync(BUGS_DIR).filter((x) => x.endsWith('.json'))
        .filter((x) => { const d = learn.readJson(path.join(BUGS_DIR, x)); return d && (!d.module || d.module === '(unmapped)'); }).length
      : 0;
    if (n) console.warn(`[learn-bugs] ⚠ KHÔNG thấy knowledge/bug_tc_map.json mà đang có ${n} bug "(unmapped)". File này chốt bằng tay và KHÔNG tái sinh được — nếu trước đó đã có thì nó vừa bị mất (gitignored nên xoá không kêu). Xem knowledge/SCHEMA.md.`);
    return {};
  }
  const d = learn.readJson(p);
  return (d && d.map) || {};
}

(async () => {
  const H = buildJiraHeaders();
  // Chỉ lấy bug do KIT tạo (label auto-bug). Ưu tiên khoanh theo story (parent), fallback theo tcId.
  const statusDoc = taskDir ? learn.readJson(path.join(taskDir, 'test-results', 'testcase-status.json')) : null;
  const tests = statusDoc ? (Array.isArray(statusDoc.tests) ? statusDoc.tests : Object.values(statusDoc.tests || {})) : [];
  const knownTc = new Set(tests.map((t) => t.tcId).filter(Boolean));

  let jql = `project = "${PROJECT}" AND labels = "auto-bug"`;
  if (STORY) jql += ` AND parent = "${STORY}"`;
  else if (knownTc.size) jql += ` AND labels in (${[...knownTc].slice(0, 50).map((t) => `"${t}"`).join(',')})`;
  else { console.error('[learn-bugs] không có --story lẫn testcase-status.json → không khoanh được bug của task.'); process.exit(2); }
  jql += ' ORDER BY created DESC';

  let issues = [];
  try {
    const r = await axios.post(`${BASE}/rest/api/3/search/jql`, { jql, fields: ['summary', 'status', 'labels', 'created', 'resolution', 'description', 'comment'], maxResults: MAX }, { headers: H });
    issues = r.data.issues || [];
  } catch (e) {
    console.error('[learn-bugs] Jira query lỗi:', e.response ? `${e.response.status} ${JSON.stringify(e.response.data).slice(0, 200)}` : e.message);
    process.exit(1);
  }
  console.log(`[learn-bugs] JQL: ${jql}`);
  console.log(`[learn-bugs] Jira trả ${issues.length} bug (label auto-bug)${STORY ? ` dưới story ${STORY}` : ''}.`);
  if (!issues.length) { console.log('[learn-bugs] Không có bug nào → knowledge/bugs giữ nguyên (đúng: không có bug thì không học bug).'); return; }

  const modMap = taskDir ? learn.buildModuleMap(taskDir) : new Map();
  const manual = loadManualMap();
  const manualUsed = []; const manualStale = [];
  const created = []; const synced = []; const skipped = []; const renamedSummary = []; const updated = []; const backfilled = [];

  // NHẬN DẠNG THEO JIRA KEY, KHÔNG theo tên file.
  // Trước đây record được tìm bằng `TASK__slugify(summary).json`: sửa tiêu đề bug trên Jira là slug đổi ⇒
  // coi như bug MỚI ⇒ tạo record trùng, còn record cũ bị bỏ rơi và ĐÓNG BĂNG trạng thái mãi mãi. Hậu quả
  // không nhìn thấy được: risk_score đếm 1 bug thành 2 (Likelihood phồng) và vòng đời bug tính trên trạng
  // thái sai. Đo 12/08/2026: 43 record / 42 id — đã có 1 cặp trùng, và 3 bug sắp bị tạo trùng vì đổi tiêu đề.
  const byId = new Map();
  const dupIds = new Map();
  if (fs.existsSync(BUGS_DIR)) {
    for (const fn of fs.readdirSync(BUGS_DIR).filter((x) => x.endsWith('.json'))) {
      const p = path.join(BUGS_DIR, fn);
      const d = learn.readJson(p);
      if (!d || !d.id) continue;
      if (byId.has(d.id)) dupIds.set(d.id, [...(dupIds.get(d.id) || [byId.get(d.id).file]), p]);
      else byId.set(d.id, { file: p, data: d });
    }
  }
  for (const [id, files] of dupIds) {
    console.warn(`[learn-bugs] ⚠ id ${id} có ${files.length} record: ${files.map((x) => path.basename(x)).join(' · ')} — bug bị ĐẾM TRÙNG trong risk_score. Giữ record khớp tiêu đề Jira hiện tại, xoá cái còn lại.`);
  }

  for (const it of issues) {
    const f = it.fields || {};
    // Dò trong text thì đối chiếu với TOÀN BỘ mã canonical (`modMap`), không chỉ mã đã execute
    // (`knownTc` lấy từ testcase-status.json nên hẹp) — bug có thể trỏ tới TC chưa từng chạy.
    // Thứ tự nguồn: label (bug_reporter tự gắn) → text do QA viết → bản đồ chốt tay. Bản đồ đứng CUỐI vì nó
    // là nguồn đắt nhất (người đọc TC) nên chỉ dùng khi hai nguồn tự động không ra.
    const auto = tcIdFromLabels(f.labels, knownTc) || tcIdFromText(f, new Set([...knownTc, ...modMap.keys()]));
    const man = manual[it.key] || null;
    // Ưu tiên mã TRA RA ĐƯỢC module, không phải mã tìm thấy TRƯỚC. Label Jira gõ tay nên có thể trỏ mã không
    // tồn tại (đo: SAPP-28313 mang TC_560 trong khi bộ chỉ tới TC_530); nếu vẫn để mã đó thắng thì bản đồ tay
    // không bao giờ được dùng và record đứng mãi ở "(unmapped)" — đúng lỗi vừa gặp.
    const autoOk = auto && modMap.get(auto) ? auto : null;
    const tcId = autoOk || (man && man.tc_id) || auto || null;
    let module = (tcId && modMap.get(tcId)) || '(unmapped)';
    let gap = null;
    if (module === '(unmapped)' && man && man.module) { module = man.module; gap = man.coverage_gap || null; }
    if (man) {
      if (autoOk) manualStale.push(`${it.key}: bản đồ tay không cần nữa (Jira đã có ${autoOk}) — xoá khỏi bug_tc_map.json cho gọn`);
      else if (module === '(unmapped)') manualStale.push(`${it.key}: bản đồ tay trỏ ${man.tc_id || '(không có tc_id)'} nhưng KHÔNG tra ra module → record vẫn (unmapped)`);
      else manualUsed.push(`${it.key}: ${modMap.get(tcId) ? `tc_id ${tcId} → "${module}"` : `module "${module}" (khoảng trống coverage)`}${auto && auto !== tcId ? ` [ghi đè label Jira sai: ${auto}]` : ''}`);
    }
    const summary = String(f.summary || '').slice(0, 160);
    const jiraStatus = (f.status && f.status.name) || 'Open';
    const hit = byId.get(it.key);

    if (hit) {
      // Idempotent theo KEY: đồng bộ trạng thái, và cả tiêu đề nếu Jira đã sửa (trước đây tiêu đề mới sinh
      // ra file thứ hai; giờ cập nhật đúng chỗ). Giữ nguyên tên file cũ — tên file không còn là danh tính.
      const cur = hit.data;
      const prevStatus = cur.jira_status;
      const prevBug = cur.bug;
      let touched = false;
      if (prevStatus !== jiraStatus) { cur.jira_status = jiraStatus; touched = true; synced.push(`${it.key}: ${prevStatus} → ${jiraStatus}`); }
      if (prevBug !== summary) { cur.bug = summary; touched = true; renamedSummary.push(`${it.key}: tiêu đề đổi trên Jira → cập nhật tại chỗ (${path.basename(hit.file)})`); }
      // BACKFILL `tc_id`/`module` cho record CŨ. Trước đây nhánh này chỉ đồng bộ trạng thái + tiêu đề, nên
      // record đã ghi mà thiếu tc_id thì vĩnh viễn kẹt ở "(unmapped)" — dù về sau QA có bổ sung label trên
      // Jira hoặc nêu TC ID trong description. Đó là lý do 23/46 bug nằm ngoài bảng risk suốt thời gian dài.
      // Chỉ ghi khi trước đó THIẾU: không đè tc_id đã có (record cũ có thể đã được sửa tay cho đúng hơn).
      if (!cur.tc_id && tcId) {
        cur.tc_id = tcId; touched = true;
        const m = modMap.get(tcId);
        if (m && cur.module !== m) cur.module = m;
        backfilled.push(`${it.key}: + tc_id ${tcId}${m ? ` → module "${m}"` : ' (chưa map được module)'}`);
      }
      // SỬA tc_id KHÔNG TỒN TẠI trong bộ canonical. Label TC trên Jira gõ tay nên có thể sai mã (đo 14/08/2026:
      // SAPP-28313 mang label `OPS_PAY_TC_560` trong khi bộ chỉ có tới TC_530). Nhánh backfill ở trên chỉ chạy
      // khi tc_id RỖNG ⇒ mã sai làm record ĐÓNG BĂNG ở "(unmapped)" mãi mãi, và nhìn vào record thì tưởng đã
      // map rồi. Chỉ ghi đè khi mã hiện tại tra KHÔNG ra module VÀ bản đồ tay có mã tra ra được.
      if (cur.tc_id && !modMap.get(cur.tc_id) && man && man.tc_id && modMap.get(man.tc_id)) {
        const bad = cur.tc_id;
        cur.tc_id = man.tc_id; cur.module = modMap.get(man.tc_id); touched = true;
        backfilled.push(`${it.key}: tc_id ${bad} KHÔNG có trong bộ canonical → sửa thành ${man.tc_id} → module "${cur.module}"`);
      }
      // Hạng B: không có TC nào phát biểu hành vi bị phá, nhưng module vẫn xác định được theo màn/tầng lỗi.
      // Vẫn phải ghi, vì `risk_score` chỉ cần `module` — bỏ qua nhánh này thì 6 bug hạng B mãi nằm ngoài bảng
      // dù đã có người chốt. `_coverage_gap` giữ lại lý do KHÔNG có tc_id để lượt gen sau bù TC.
      if ((!cur.module || cur.module === '(unmapped)') && module !== '(unmapped)' && !cur.tc_id) {
        cur.module = module; touched = true;
        if (gap) cur._coverage_gap = gap;
        backfilled.push(`${it.key}: + module "${module}" (hạng B — thiếu TC: ${String(gap || '').slice(0, 60)}…)`);
      }
      if (touched && APPLY) fs.writeFileSync(hit.file, JSON.stringify(cur, null, 2), 'utf8');
      if (touched) updated.push({ file: hit.file, rec: cur });   // để index.json cập nhật `status` theo
      if (!touched) skipped.push(it.key);
      continue;
    }
    const file = path.join(BUGS_DIR, `${TASK}__${slugify(f.summary)}.json`);
    const rec = {
      id: it.key,
      bug: summary,
      module,
      tags: [...new Set([...(f.labels || []).filter((l) => l !== 'auto-bug' && !knownTc.has(l)), module.toLowerCase().replace(/\s+/g, '-')])].slice(0, 8),
      task_key: TASK,
      detected_phase: 'phase2',
      confirmed_via_gate: true,           // đã qua Jira gate của bug_reporter mới tồn tại trên Jira
      jira_status: jiraStatus,
      created_at: String(f.created || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      ...(tcId ? { tc_id: tcId } : {}),
      ...(gap ? { _coverage_gap: gap } : {}),
    };
    if (APPLY) { fs.mkdirSync(BUGS_DIR, { recursive: true }); fs.writeFileSync(file, JSON.stringify(rec, null, 2), 'utf8'); }
    created.push({ file, rec });
  }

  // index.json (schema knowledge/SCHEMA.md) — idempotent theo `file`.
  // Điều kiện là APPLY (không kèm `created.length`): lượt chỉ XOÁ record hoặc chỉ đổi trạng thái vẫn phải
  // dọn entry mồ côi và cập nhật `status`, nếu không index lệch với đĩa mà không ai biết.
  if (APPLY) {
    const idxFile = path.join(KNOW, 'index.json');
    const idx = learn.readJson(idxFile) || { version: 1, updated_at: null, entries: [] };
    idx.entries = idx.entries || [];
    // KHÔNG ghi entry `bug` vào index.json nữa, và DỌN sạch entry bug cũ.
    //
    // Lý do 1 (bảo mật): `index.json` được COMMIT (preflight_gate yêu cầu file này ở mọi mode), còn record bug
    //   thì KHÔNG được publish. Tên file bug lại sinh từ slug tiêu đề (`...__be-add-on-order-tien-usd-...`)
    //   nên chỉ riêng trường `file` trong index đã đủ lộ mô tả defect ra repo public — bỏ track thư mục
    //   `knowledge/bugs/` mà vẫn giữ entry trong index thì mới bịt được một nửa.
    // Lý do 2 (vô dụng): đã kiểm toàn bộ reader của index — KHÔNG nơi nào lọc `type === 'bug'`. Entry bug là
    //   ghi-mà-không-ai-đọc; `risk_score` và `decisions` đều đọc thẳng thư mục `knowledge/bugs/`.
    const before = idx.entries.length;
    idx.entries = idx.entries.filter((e) => !(e && e.type === 'bug'));
    const pruned = before - idx.entries.length;
    if (pruned) console.log(`[learn-bugs] index.json: dọn ${pruned} entry bug (record bug là dữ liệu LOCAL, không publish — xem knowledge/SCHEMA.md).`);
    idx.updated_at = new Date().toISOString().slice(0, 10);
    if (pruned) fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2), 'utf8');
  }

  console.log(`\n[learn-bugs] ${APPLY ? 'GHI' : 'DRY-RUN'}: mới ${created.length} · đồng bộ trạng thái ${synced.length} · tiêu đề đổi ${renamedSummary.length} · backfill tc_id ${backfilled.length} · không đổi ${skipped.length}`);
  created.slice(0, 10).forEach((c) => console.log(`  + ${c.rec.id} [${c.rec.module}] ${c.rec.bug.slice(0, 60)}`));
  synced.slice(0, 12).forEach((s) => console.log(`  ~ ${s}`));
  renamedSummary.slice(0, 8).forEach((s) => console.log(`  ✎ ${s}`));
  backfilled.slice(0, 30).forEach((s) => console.log(`  ⊕ ${s}`));
  if (manualUsed.length) console.log(`  ⌘ bug_tc_map.json dùng cho ${manualUsed.length} bug:`);
  manualUsed.slice(0, 30).forEach((s) => console.log(`      ${s}`));
  manualStale.forEach((s) => console.warn(`  ⚠ ${s}`));
  const unmapped = created.filter((c) => c.rec.module === '(unmapped)').length;
  if (unmapped) console.log(`  ⚠ ${unmapped} bug không map được module (thiếu testcase canonical hoặc label tcId) → risk_score gom vào "(unmapped)".`);
  if (!APPLY && created.length) console.log('[learn-bugs] Thêm --apply để ghi thật.');
  if (APPLY && created.length) console.log('[learn-bugs] Kế tiếp: `npm run risk` — Likelihood giờ có CẢ bugCount lẫn failRate.');
})();
