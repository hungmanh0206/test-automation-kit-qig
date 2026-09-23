#!/usr/bin/env node
'use strict';

/*
 * learn_bugs.js — nối mắt xích còn ĐỨT: bug đã log Backlog → knowledge/bugs/ (+ root_causes ref, index).
 *
 * Migrated từ Jira (22/09/2026). Khác Jira:
 *   - KHÔNG có JQL/labels tự do — khoanh bug bằng `parentIssueId[]=<storyId>` (BẮT BUỘC có --story; JQL
 *     cũ còn fallback "labels in (tcId...)" khi thiếu story, Backlog không filter được kiểu đó nên bỏ
 *     nhánh này — không có story thì dừng, không đoán).
 *   - tcId không còn nằm ở label riêng — `bug_reporter.js` giờ nhúng `[<layer>][<tcId>] ...` NGAY ĐẦU
 *     summary (xem buildBugSummary), đọc bằng regex thay vì `labels.includes`.
 *   - description đã là plain text — không cần `flattenAdf`.
 *
 * VÌ SAO CẦN: `risk_score` tính Likelihood = f(bugCount theo module, failRate theo module). Sau khi
 * learn_task.js cấp failRate thì bugCount vẫn = 0 vì `knowledge/bugs/` chỉ được ghi khi agent nhớ chạy
 * skill `learning_recorder` (Suggest-only) → thực tế luôn bị bỏ. Script này lấy bug TỪ CHÍNH BACKLOG nên
 * không phụ thuộc agent có nhớ hay không, và KHÔNG cần sửa `bug_reporter.js` thêm.
 *
 * Module của bug suy từ tcId → cột `Module` của testcase canonical (dùng chung map với learn_task.js).
 * Idempotent: đã có file thì chỉ ĐỒNG BỘ `backlog_status` (rerun chuyển Resolved → cập nhật), không tạo trùng.
 *
 * Dùng:
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/qa/learn_bugs.js --story <KEY>   # dry-run: chỉ in
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/qa/learn_bugs.js --story <KEY> --apply
 *   [--task <KEY>] [--max 100]
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const { loadEnv } = require(path.resolve(__dirname, '..', 'integrations', 'backlog', 'utils.js'));
const learn = require(path.resolve(__dirname, 'learn_task.js'));

loadEnv();

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const APPLY = process.argv.includes('--apply');
const TASK = arg('task', process.env.TASK_KEY || '');
const STORY = arg('story', process.env.BACKLOG_STORY_KEY || '');
const MAX = parseInt(arg('max', '100'), 10) || 100;
const BASE = (process.env.BACKLOG_BASE_URL || '').replace(/\/+$/, '');
const API_KEY = process.env.BACKLOG_API_KEY || '';
const KNOW = path.join(rc.REPO_ROOT, 'knowledge');
const BUGS_DIR = path.join(KNOW, 'bugs');

if (!TASK) { console.error('[learn-bugs] cần TASK context (TASK_ENV hoặc --task).'); process.exit(2); }
if (!BASE || !API_KEY) { console.error('[learn-bugs] thiếu BACKLOG_BASE_URL / BACKLOG_API_KEY.'); process.exit(2); }
if (!STORY) { console.error('[learn-bugs] cần --story <BACKLOG_STORY_KEY> — Backlog không có JQL "labels in (...)" để khoanh bug khi thiếu story.'); process.exit(2); }

const POD = process.env.PROJECT_OUTPUT_DIR || '';
const taskDir = POD ? path.resolve(rc.REPO_ROOT, POD, 'tasks', TASK) : '';
const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'bug';

function apiUrl(pathname, params = {}) {
  const url = new URL(BASE + pathname);
  url.searchParams.set('apiKey', API_KEY);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(`${key}[]`, v));
    else url.searchParams.set(key, value);
  }
  return url;
}
async function backlog(pathname, params) {
  const res = await fetch(apiUrl(pathname, params));
  if (!res.ok) throw new Error(`Backlog ${res.status}: ${await res.text()}`);
  return res.json();
}

/** tcId nhúng ở ĐẦU summary — `[<layer>][<tcId>] ...` (xem bug_reporter.js buildBugSummary). */
function tcIdFromSummary(summary, known) {
  const m = String(summary || '').match(/^\[[A-Z]+\]\[([^\]]+)\]/);
  if (m && known.has(m[1])) return m[1];
  return null;
}

/**
 * TC ID nêu TƯỜNG MINH trong description/comment (vd QA viết "Liên quan test case OPS_PAY_TC_255").
 *
 * VÌ SAO thêm nguồn này: summary marker là nguồn chính nhưng hay bị quên khi log bug tay — đo 14/08/2026:
 * 23/46 bug KHÔNG có marker TC ⇒ rơi vào "(unmapped)" và `risk_score` LOẠI khỏi bảng, tức log rồi cũng
 * không ảnh hưởng độ sâu test lượt sau. Trong 23 cái đó, **4 cái có nêu TC ID ngay trong description**.
 *
 * CHỈ nhận mã CÓ THẬT trong bộ canonical (`known`). Đã thử cách suy module từ TIÊU ĐỀ bug và **loại bỏ**:
 * 9/23 ca trông "chắc" nhưng soi ra ≥4 sai rõ ràng. Gán SAI module còn tệ hơn để "(unmapped)": nó bơm
 * Likelihood cho module vô can và làm lệch việc chọn độ sâu test. Thà thiếu còn hơn sai.
 */
function tcIdFromText(issue, known) {
  const txt = `${issue.description || ''} ${(issue.comments_text || '')}`;
  const found = [...new Set(txt.match(/\b[A-Z][A-Z0-9_]*_TC_\d+\b/g) || [])].filter((t) => known.has(t));
  return found.length === 1 ? found[0] : (found[0] || null);   // nhiều mã → lấy mã đầu (module thường trùng)
}

/**
 * Bản đồ CHỐT BẰNG TAY: bug key → { tc_id } hoặc { module, coverage_gap }.
 * (Không đổi so với bản Jira — nguồn thứ ba, người chốt, xem knowledge/SCHEMA.md.)
 */
function loadManualMap() {
  const p = path.join(KNOW, 'bug_tc_map.json');
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
  const statusDoc = taskDir ? learn.readJson(path.join(taskDir, 'test-results', 'testcase-status.json')) : null;
  const tests = statusDoc ? (Array.isArray(statusDoc.tests) ? statusDoc.tests : Object.values(statusDoc.tests || {})) : [];
  const knownTc = new Set(tests.map((t) => t.tcId).filter(Boolean));

  const story = await backlog(`/api/v2/issues/${encodeURIComponent(STORY)}`).catch((e) => { console.error('[learn-bugs] không lấy được story:', e.message); process.exit(1); });
  if (!story?.id) { console.error(`[learn-bugs] không tìm thấy story: ${STORY}`); process.exit(1); }

  let issues = [];
  try {
    issues = await backlog('/api/v2/issues', { projectId: [story.projectId], parentIssueId: [story.id], count: Math.min(MAX, 100) });
  } catch (e) {
    console.error('[learn-bugs] Backlog query lỗi:', e.message);
    process.exit(1);
  }
  console.log(`[learn-bugs] parentIssueId = ${story.id} (${STORY})`);
  console.log(`[learn-bugs] Backlog trả ${issues.length} bug con của story ${STORY}.`);
  if (!issues.length) { console.log('[learn-bugs] Không có bug nào → knowledge/bugs giữ nguyên (đúng: không có bug thì không học bug).'); return; }

  const modMap = taskDir ? learn.buildModuleMap(taskDir) : new Map();
  const manual = loadManualMap();
  const manualUsed = []; const manualStale = [];
  const created = []; const synced = []; const skipped = []; const renamedSummary = []; const backfilled = [];

  // NHẬN DẠNG THEO BACKLOG KEY, KHÔNG theo tên file (cùng lý do bản Jira cũ — sửa tiêu đề không được sinh
  // record trùng, xem lịch sử comment ở git blame nếu cần chi tiết).
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
    console.warn(`[learn-bugs] ⚠ id ${id} có ${files.length} record: ${files.map((x) => path.basename(x)).join(' · ')} — bug bị ĐẾM TRÙNG trong risk_score. Giữ record khớp tiêu đề Backlog hiện tại, xoá cái còn lại.`);
  }

  for (const it of issues) {
    const auto = tcIdFromSummary(it.summary, knownTc) || tcIdFromText(it, new Set([...knownTc, ...modMap.keys()]));
    const man = manual[it.issueKey] || null;
    const autoOk = auto && modMap.get(auto) ? auto : null;
    const tcId = autoOk || (man && man.tc_id) || auto || null;
    let module = (tcId && modMap.get(tcId)) || '(unmapped)';
    let gap = null;
    if (module === '(unmapped)' && man && man.module) { module = man.module; gap = man.coverage_gap || null; }
    if (man) {
      if (autoOk) manualStale.push(`${it.issueKey}: bản đồ tay không cần nữa (Backlog đã có ${autoOk}) — xoá khỏi bug_tc_map.json cho gọn`);
      else if (module === '(unmapped)') manualStale.push(`${it.issueKey}: bản đồ tay trỏ ${man.tc_id || '(không có tc_id)'} nhưng KHÔNG tra ra module → record vẫn (unmapped)`);
      else manualUsed.push(`${it.issueKey}: ${modMap.get(tcId) ? `tc_id ${tcId} → "${module}"` : `module "${module}" (khoảng trống coverage)`}${auto && auto !== tcId ? ` [ghi đè marker sai: ${auto}]` : ''}`);
    }
    const summary = String(it.summary || '').slice(0, 160);
    const backlogStatus = (it.status && it.status.name) || 'Open';
    const hit = byId.get(it.issueKey);

    if (hit) {
      const cur = hit.data;
      const prevStatus = cur.backlog_status || cur.jira_status;
      const prevBug = cur.bug;
      let touched = false;
      if (prevStatus !== backlogStatus) { cur.backlog_status = backlogStatus; delete cur.jira_status; touched = true; synced.push(`${it.issueKey}: ${prevStatus} → ${backlogStatus}`); }
      if (prevBug !== summary) { cur.bug = summary; touched = true; renamedSummary.push(`${it.issueKey}: tiêu đề đổi trên Backlog → cập nhật tại chỗ (${path.basename(hit.file)})`); }
      if (!cur.tc_id && tcId) {
        cur.tc_id = tcId; touched = true;
        const m = modMap.get(tcId);
        if (m && cur.module !== m) cur.module = m;
        backfilled.push(`${it.issueKey}: + tc_id ${tcId}${m ? ` → module "${m}"` : ' (chưa map được module)'}`);
      }
      if (cur.tc_id && !modMap.get(cur.tc_id) && man && man.tc_id && modMap.get(man.tc_id)) {
        const bad = cur.tc_id;
        cur.tc_id = man.tc_id; cur.module = modMap.get(man.tc_id); touched = true;
        backfilled.push(`${it.issueKey}: tc_id ${bad} KHÔNG có trong bộ canonical → sửa thành ${man.tc_id} → module "${cur.module}"`);
      }
      if ((!cur.module || cur.module === '(unmapped)') && module !== '(unmapped)' && !cur.tc_id) {
        cur.module = module; touched = true;
        if (gap) cur._coverage_gap = gap;
        backfilled.push(`${it.issueKey}: + module "${module}" (hạng B — thiếu TC: ${String(gap || '').slice(0, 60)}…)`);
      }
      if (touched && APPLY) fs.writeFileSync(hit.file, JSON.stringify(cur, null, 2), 'utf8');
      if (touched) { /* index.json chỉ theo status, không cần list riêng ở đây */ }
      if (!touched) skipped.push(it.issueKey);
      continue;
    }
    const file = path.join(BUGS_DIR, `${TASK}__${slugify(it.summary)}.json`);
    const rec = {
      id: it.issueKey,
      bug: summary,
      module,
      tags: [module.toLowerCase().replace(/\s+/g, '-')].slice(0, 8),
      task_key: TASK,
      detected_phase: 'phase2',
      confirmed_via_gate: true,           // đã qua Backlog gate của bug_reporter mới tồn tại trên Backlog
      backlog_status: backlogStatus,
      created_at: String(it.created || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      ...(tcId ? { tc_id: tcId } : {}),
      ...(gap ? { _coverage_gap: gap } : {}),
    };
    if (APPLY) { fs.mkdirSync(BUGS_DIR, { recursive: true }); fs.writeFileSync(file, JSON.stringify(rec, null, 2), 'utf8'); }
    created.push({ file, rec });
  }

  if (APPLY) {
    const idxFile = path.join(KNOW, 'index.json');
    const idx = learn.readJson(idxFile) || { version: 1, updated_at: null, entries: [] };
    idx.entries = idx.entries || [];
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
  if (unmapped) console.log(`  ⚠ ${unmapped} bug không map được module (thiếu testcase canonical hoặc marker tcId trong summary) → risk_score gom vào "(unmapped)".`);
  if (!APPLY && created.length) console.log('[learn-bugs] Thêm --apply để ghi thật.');
  if (APPLY && created.length) console.log('[learn-bugs] Kế tiếp: `npm run risk` — Likelihood giờ có CẢ bugCount lẫn failRate.');
})();
