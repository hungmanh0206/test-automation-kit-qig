#!/usr/bin/env node
'use strict';

/*
 * push_execution_aio.js — đẩy kết quả execute của Phase 2 lên AIO Tests (bản thay cho
 * `jira/push_test_execution.js` vốn đẩy sang Xray).
 *
 * Đầu vào GIỮ NGUYÊN hợp đồng cũ: `<TASK_OUTPUT_DIR>/test-results/testcase-status.json`
 *   { taskKey, generatedAt, attestation, tests: [ { tcId, status, comment, failedStep?, evidence?[], steps?[] } ] }
 * → agent không phải đổi cách ghi kết quả; chỉ đích đến là khác.
 *
 * NÂNG CẤP SO VỚI XRAY — EVIDENCE NEO XUỐNG TỪNG BƯỚC:
 *   Xray chỉ nhận evidence ở cấp run (đo trên 15 execution cũ: 0/154 step có evidence). AIO có
 *   `.../testrun/{id}/testrunstep/{stepId}/attachment`, nên kit lần đầu thoả được đúng rule
 *   "mỗi step phải có ảnh/video". Chỉ neo xuống bước khi THẬT SỰ biết bước nào (steps[].evidence,
 *   hoặc failedStep của case FAIL); không biết thì để cấp run — không bịa vị trí.
 *
 * LIÊN KẾT: khoá là `automationKey` = TC ID. Tuyệt đối KHÔNG khớp theo tiêu đề — nhiều case dùng lại
 * cùng tiêu đề ở các nhóm khác nhau, khớp kiểu đó làm nhiều run dồn vào một case (đã mất 12 run khi
 * migrate). Xem thêm README của module.
 *
 * MẶC ĐỊNH DRY-RUN. Có gate chất lượng `output_gate.gateTestExecution` chạy TRƯỚC như bản Xray.
 *
 * Dùng:
 *   node scripts/integrations/aio/push_execution_aio.js --task <KEY> [--folder "<Sprint>"] [--cycle-title "..."]
 *   ... --apply            # ghi thật
 *   ... --apply --qa-approved   # cố ý bỏ qua gate
 */

const fs = require('fs');
const path = require('path');
const { AioClient } = require('./aio_client');
const rc = require(path.resolve(__dirname, '..', '..', 'utils', 'runtime_config'));
const outputGate = require(path.resolve(__dirname, '..', '..', 'qa', 'output_gate'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);
const APPLY = flag('apply');
const QA_APPROVED = flag('qa-approved');

/*
 * TRẠNG THÁI: MỘT nguồn, KHÔNG hardcode.
 *   verdict kit → tên trạng thái AIO  : `.agent/config/verdict_taxonomy.json` (cột `aio`)
 *   tên trạng thái AIO → ID nội bộ    : `GET /config` của chính AIO (runStatuses/runStepStatuses)
 * Bảng hardcode cũ thiếu `PASS_WITH_DEVIATION` và `SUSPECT_REAL_BUG` ⇒ chúng rơi về mặc định "Not Run",
 * tức case ĐÃ chạy bị báo là chưa chạy. Đọc từ taxonomy thì thêm verdict mới không phải sửa script.
 * `canonStatus` lo phần đồng nghĩa (PASSED→PASS, BLOCKED→BLOCKED_SETUP…).
 */
const taxonomy = require(path.resolve(__dirname, '..', '..', '..', '.agent', 'config', 'verdict_taxonomy.json'));
const NOT_RUN = 'Not Run';

function buildStatusMap(cfg) {
  const idOf = (list) => Object.fromEntries((list || []).map((s) => [String(s.name).toLowerCase(), s.ID]));
  const run = idOf(cfg && cfg.runStatuses);
  const step = idOf(cfg && cfg.runStepStatuses);
  if (!run[NOT_RUN.toLowerCase()]) throw new Error('AIO /config không trả runStatuses — không suy được ID trạng thái, dừng để khỏi ghi bừa.');
  const aioName = (kitStatus) => {
    const canon = outputGate.canonStatus(kitStatus);
    const entry = taxonomy.statuses[canon];
    return (entry && entry.aio) || NOT_RUN;
  };
  return {
    runId: (s) => run[String(aioName(s)).toLowerCase()] || run[NOT_RUN.toLowerCase()],
    stepId: (s) => step[String(aioName(s)).toLowerCase()] || step[NOT_RUN.toLowerCase()],
    names: run,
  };
}

// Đặt sau khi đọc /config (main() gán). Khai ở đây để planSteps dùng chung.
let S = null;
const statusId = (s) => S.runId(s);
const stepStatusId = (s) => S.stepId(s);

/**
 * Trạng thái từng bước + chỗ neo evidence.
 * Ưu tiên `steps[]` do agent ghi (chính xác nhất). Không có thì suy từ `failedStep` của case FAIL:
 * bước trước = Passed, bước hỏng = Failed, bước sau = Not Run — giống quy ước bản Xray.
 * `failedStep` ngoài khoảng (vd 99 ở case PASS) coi như không có.
 */
function planSteps(test, stepCount) {
  const overall = String(test.status || '').toUpperCase();
  const explicit = Array.isArray(test.steps) && test.steps.length ? test.steps : null;
  if (explicit) {
    return Array.from({ length: stepCount }, (_, i) => ({
      status: stepStatusId(explicit[i] && explicit[i].status),
      evidence: (explicit[i] && explicit[i].evidence) ? [].concat(explicit[i].evidence) : [],
    }));
  }
  // Shortcut của template Phase 2: `failedStep` (1-based) + `failedStepEvidence`. Nhận cả biến thể
  // snake_case y như bản Xray — bỏ sót là agent làm ĐÚNG template mà evidence rơi mất trong im lặng.
  const failedAt = Number(test.failedStep != null ? test.failedStep : test.failed_step);
  const hasFail = overall.startsWith('FAIL') && failedAt >= 1 && failedAt <= stepCount;
  const failEv = [].concat(test.failedStepEvidence || test.failed_step_evidence || test.evidence || []);
  return Array.from({ length: stepCount }, (_, i) => {
    const n = i + 1;
    if (hasFail) {
      return {
        status: n < failedAt ? stepStatusId('PASS') : n === failedAt ? stepStatusId('FAIL') : stepStatusId('TODO'),
        evidence: n === failedAt ? failEv : [],
      };
    }
    if (overall.startsWith('PASS')) return { status: stepStatusId('PASS'), evidence: [] };
    return { status: stepStatusId('TODO'), evidence: [] };
  });
}

// `--run-id` trỏ vào `test-results/runs/<RUN_ID>/` — luồng partial-rerun ghi kết quả ở đó, không phải
// thư mục gốc. Dùng đúng helper của kit để một chỗ quyết định đường dẫn.
function readStatusDoc(taskOut) {
  const dir = rc.getTestResultsDir({ taskOutputDir: taskOut, runId: rc.getRunId(arg('run-id') || process.env.RUN_ID) });
  const p = path.join(dir, 'testcase-status.json');
  if (!fs.existsSync(p)) throw new Error(`Không thấy ${p} — chạy execute rồi ghi file trạng thái trước.`);
  return { file: p, doc: JSON.parse(fs.readFileSync(p, 'utf8')) };
}

async function main() {
  const taskOut = arg('task-output') || rc.getTaskOutputDir();
  const { file, doc } = readStatusDoc(taskOut);
  const all = doc.tests || [];
  const task = arg('task') || doc.taskKey || rc.getTaskKey();
  if (!all.length) { console.error(`ERROR: ${file} không có case nào.`); process.exit(2); }

  /*
   * LỌC TRƯỚC KHI GATE.
   * `--only` để đẩy đúng tập vừa chạy (partial rerun, hoặc lượt execute một phần).
   * Case mang cờ `carriedOver` là kết quả KẾ THỪA từ lượt chạy trước (EvidenceRecorder gộp shard cũ) —
   * mặc định LOẠI, vì đẩy chúng lên là báo cáo verdict cũ dưới danh nghĩa lượt chạy hôm nay.
   */
  const only = new Set(String(arg('only', '')).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
  let tests = only.size ? all.filter((t) => only.has(String(t.tcId || '').toUpperCase())) : all;
  if (only.size) {
    const got = new Set(tests.map((t) => String(t.tcId).toUpperCase()));
    const miss = [...only].filter((k) => !got.has(k));
    if (miss.length) { console.error(`ERROR: --only không thấy trong status: ${miss.join(', ')}`); process.exit(2); }
  }
  const carried = tests.filter((t) => t.carriedOver);
  if (carried.length && !flag('include-carried-over')) {
    tests = tests.filter((t) => !t.carriedOver);
    console.log(`⚠ LOẠI ${carried.length} case KẾ THỪA từ lượt chạy trước (cờ carriedOver) — chúng không phải kết quả hôm nay.`);
    console.log('  Cố ý muốn đẩy: --include-carried-over.');
  }
  if (!tests.length) { console.error('ERROR: sau khi lọc không còn case nào để đẩy.'); process.exit(2); }

  // Gate chất lượng chạy TRƯỚC — không để payload sai lọt lên TCM (giống bản Xray).
  const gate = outputGate.gateTestExecution({ ...doc, tests });
  if (gate.problems.length) {
    console.error(`GATE CHẤT LƯỢNG — ${gate.problems.length} vi phạm:\n  - ${gate.problems.join('\n  - ')}`);
    console.error(`→ Sửa ${file}, hoặc \`node scripts/qa/output_gate.js --status ${file} --fix\`. Cố ý bỏ qua: --qa-approved.`);
    if (!QA_APPROVED) process.exit(1);
    console.error('  [--qa-approved] bỏ qua gate theo chủ ý QA.');
  } else console.log('Gate chất lượng: OK');

  /*
   * CỬA THỨ HAI cho luật mở rộng 5 trục.
   * `self-review --enforce` đã chặn ở bước finalize, nhưng đó là bước NGƯỜI/agent tự chạy — bỏ qua nó rồi
   * đẩy thẳng kết quả lên TCM thì trước đây không gì cản (chính lượt SAPP-26523 đã đi đường đó: 3 case,
   * 0/5 trục, mọi gate xanh). Đây là chỗ có exit code nằm trên đường ghi thật, nên luật phải đứng cả ở đây.
   * Luật + lý do: `scripts/lib/expansion/plan_guard.js` (một nguồn, dùng chung với self_review).
   * KHÔNG chặn "đã mở đủ trục chưa" — chỉ chặn việc bỏ qua QUYẾT ĐỊNH trong im lặng.
   */
  const planGuard = require(path.resolve(__dirname, '..', '..', 'lib', 'expansion', 'plan_guard'));
  const pg = planGuard.checkPlan(taskOut, tests.map((t) => t.tcId));
  if (pg.warning) console.log(`⚠ ${pg.warning}`);
  if (pg.problem) {
    console.error(`GATE MỞ RỘNG — ${pg.problem}`);
    if (!QA_APPROVED) { console.error('  Cố ý bỏ qua: --qa-approved (được ghi lại).'); process.exit(1); }
    console.error('  [--qa-approved] bỏ qua theo chủ ý QA.');
  } else if (pg.high.length) console.log(`Gate mở rộng: OK (${pg.high.length} case band high · đã có kế hoạch)`);

  const aio = new AioClient();
  // Nạp bảng trạng thái TỪ chính AIO trước mọi thứ khác — thiếu nó thì mọi ID đều là phỏng đoán.
  S = buildStatusMap((await aio.call('GET', '/config')).json);
  const cases = await aio.list('/testcase');
  const byKey = {};
  cases.forEach((c) => { if (c.automationKey) byKey[String(c.automationKey).toUpperCase()] = c.key; });

  const dist = {}; tests.forEach((t) => { dist[t.status] = (dist[t.status] || 0) + 1; });
  const matched = tests.filter((t) => byKey[String(t.tcId || '').toUpperCase()]);
  const missing = tests.filter((t) => !byKey[String(t.tcId || '').toUpperCase()]);
  const evCount = tests.reduce((s, t) => s + ((t.evidence || []).length), 0);

  const title = arg('cycle-title') || `[${task}] Test Execution - ${new Date(doc.generatedAt || Date.now()).toISOString().slice(0, 10)}`;
  console.log(`Task ${task} · ${tests.length} case · ${JSON.stringify(dist)}`);
  console.log(`Khớp case trên AIO: ${matched.length}/${tests.length} · evidence ${evCount} file`);
  console.log(`Cycle: "${title}"${arg('folder') ? ` trong thư mục "${arg('folder')}"` : ''}`);
  if (missing.length) {
    console.log(`⚠ ${missing.length} TC ID không có case trên AIO — publish testcase trước:`);
    missing.slice(0, 5).forEach((t) => console.log(`   ${t.tcId}`));
  }
  /*
   * GUARD "run conclusive": 0 case PASSED/FAILED (toàn TODO/EXECUTING) = lượt chạy debug/dở/setup hỏng.
   * Trên Xray điều này chỉ đẻ execution rác; trên AIO thì NẶNG HƠN — cycle không xoá được bằng API,
   * phải vào UI dọn tay. Nên chặn ở đây, `--force` khi thật sự muốn.
   */
  const conclusive = tests.filter((t) => /^(PASS|FAIL)/i.test(String(t.status || '').trim())).length;
  if (!conclusive && !flag('force')) {
    console.error('CHẶN: 0/%d case có verdict PASSED/FAILED (toàn TODO/EXECUTING) → không tạo cycle rác. Dùng --force nếu vẫn muốn.', tests.length);
    process.exit(1);
  }

  if (!APPLY) { console.log('\n[DRY-RUN] chưa ghi gì. Thêm --apply để đẩy lên AIO.'); return; }

  const folderId = arg('folder') ? await aio.ensureFolder('testcycle', [arg('folder')]) : null;
  const existing = (await aio.list('/testcycle')).find((c) => c.title === title);
  let cycle = existing && existing.key;
  if (cycle) console.log(`\ncycle ${cycle} (ID ${existing.ID}) — dùng lại`);
  else {
    const day = new Date(doc.generatedAt || Date.now()).toISOString().slice(0, 10);
    const r = await aio.call('POST', '/testcycle/detail', {
      title, objective: `Kết quả execute ${task} (kit)`,
      startDate: `${day}T00:00:00Z`, endDate: `${day}T23:59:59Z`,
      folder: folderId ? { ID: folderId } : undefined,
    });
    cycle = r.json && r.json.key;
    if (!cycle) { console.error(`Không tạo được cycle: HTTP ${r.status} ${String(r.text).slice(0, 140)}`); process.exit(1); }
    console.log(`\ncycle ${cycle} (ID ${r.json.ID}) — tạo mới`);
  }

  /*
   * CHỈ thêm case khi nó CHƯA ở trong cycle.
   * Đo thật: `POST .../testcase/{key}` lên case ĐÃ có KHÔNG dùng lại run cũ mà đẻ RUN MỚI (attempt),
   * run cũ vẫn nằm đó (3898 → 3957). Gọi vô điều kiện thì mỗi lần chạy lại là một tầng run nữa,
   * và dedup evidence không bao giờ ăn vì run mới luôn rỗng attachment → ảnh nhân đôi.
   * Muốn có "lượt 2" thì tạo cycle mới bằng --cycle-title, đúng như quy ước "Lần 1 / Lần 2" đang dùng.
   * Lưu ý hình dạng: endpoint này trả bản ghi case-trong-cycle, `key` nằm ở `.testCase.key`, KHÔNG ở `.key`.
   */
  const already = new Set((await aio.list(`/testcycle/${cycle}/testcase`))
    .map((x) => (x.testCase || {}).key).filter(Boolean));

  let done = 0; let evRun = 0; let evStep = 0; let failed = 0;
  for (const t of matched) {
    const caseKey = byKey[String(t.tcId).toUpperCase()];
    if (!already.has(caseKey)) { await aio.call('POST', `/testcycle/${cycle}/testcase/${caseKey}`, {}); already.add(caseKey); }
    const run = (await aio.call('GET', `/testcycle/${cycle}/testcase/${caseKey}/testrun`)).json;
    if (!run || !run.ID) { failed++; continue; }
    const full = (await aio.call('GET', `/testcycle/${cycle}/testrun/${run.ID}`)).json || {};
    const runSteps = full.testRunSteps || [];
    const plan = planSteps(t, runSteps.length);

    const res = await aio.call('POST', `/testcycle/${cycle}/testrun/${run.ID}`, {
      ...full,
      testRunStatus: { ID: statusId(t.status) },
      testRunSteps: runSteps.map((s, i) => ({ ...s, testRunStepStatus: { ID: (plan[i] && plan[i].status) || stepStatusId('TODO') } })),
    });
    if (res.status >= 300) { failed++; continue; }

    /*
     * Evidence: neo xuống BƯỚC khi biết bước nào; còn lại để cấp run.
     * Dedup phải theo TỪNG bước, không dùng chung một set: attachment của bước nằm ở
     * `testRunSteps[i].attachments` (đo thật), nên chạy lại mà chỉ chống trùng cấp run là nhân đôi ảnh.
     * POST trạng thái run KHÔNG xoá attachment đã có (đã đo) → thứ tự POST-rồi-upload là an toàn.
     */
    const haveRun = new Set(((full.attachments) || []).map((a) => a.name));
    const haveStep = runSteps.map((s) => new Set(((s.attachments) || []).map((a) => a.name)));
    const upload = async (file, idx) => {
      const name = path.basename(file);
      const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
      if (!fs.existsSync(abs)) { console.log(`   ⚠ thiếu file evidence: ${file}`); return; }
      const stepId = idx == null ? null : (runSteps[idx] && runSteps[idx].ID);
      if (stepId ? haveStep[idx].has(name) : haveRun.has(name)) return;
      const buf = fs.readFileSync(abs);
      const url = stepId
        ? `/testcycle/${cycle}/testrun/${run.ID}/testrunstep/${stepId}/attachment`
        : `/testcycle/${cycle}/testrun/${run.ID}/attachment`;
      const r = await aio.upload(url, name, buf);
      if (r.status < 300) { if (stepId) evStep++; else evRun++; } else console.log(`   ⚠ upload ${name} → ${r.status} ${String(r.text).slice(0, 70)}`);
      await aio.pause();
    };

    /*
     * Thứ tự: evidence theo bước trước, rồi MỌI thứ còn lại về cấp run.
     * Hai chỗ từng mất evidence trong im lặng, đều phải chặn:
     *  1) Có `steps[].evidence` thì trước đây nhánh cấp-run bị bỏ hẳn ⇒ VIDEO cấp case (thứ gate BẮT
     *     BUỘC với case chuỗi thao tác) không bao giờ được đẩy lên.
     *  2) Automation thường chạy NHIỀU bước hơn số bước khai trong case (thêm bước mở màn/đăng nhập).
     *     `planSteps` cắt theo số bước của case trên AIO ⇒ evidence của bước dôi ra rơi mất.
     * Giờ: bước dôi ra và evidence cấp case đều lên cấp run, và có cảnh báo khi số bước lệch.
     */
    const sent = new Set();
    const send = async (f, idx) => { if (f && !sent.has(f)) { sent.add(f); await upload(f, idx); } };

    for (const [i, p] of plan.entries()) for (const f of p.evidence) await send(f, i);

    const ranSteps = Array.isArray(t.steps) ? t.steps.length : 0;
    if (ranSteps && ranSteps !== runSteps.length) {
      console.log(`   ⓘ ${t.tcId}: chạy ${ranSteps} bước nhưng case trên AIO khai ${runSteps.length} — evidence bước dôi đưa về cấp run.`);
      for (const s of (t.steps || []).slice(runSteps.length)) for (const f of [].concat(s.evidence || [])) await send(f, null);
    }
    for (const f of t.evidence || []) await send(f, null);
    done++;
    if (done % 10 === 0) process.stdout.write(`  ...${done}/${matched.length}\n`);
    await aio.pause();
  }

  console.log(`\nXONG: ${done}/${matched.length} run · evidence cấp bước ${evStep} · cấp run ${evRun} · lỗi ${failed}`);

  /*
   * Tự đối soát: đếm TRÊN AIO, không tin số lệnh (đã dính bẫy này khi migrate).
   * Đếm theo CASE PHÂN BIỆT chứ không phải độ dài mảng — độ dài không phát hiện được trùng.
   */
  const inCycle = new Set((await aio.list(`/testcycle/${cycle}/testcase`))
    .map((x) => (x.testCase || {}).key).filter(Boolean));
  /*
   * Điều kiện đúng là BAO HÀM, không phải bằng số: đẩy một phần vào cycle đã có (partial rerun) là
   * hợp lệ, nên cycle nhiều case hơn lượt này KHÔNG phải lỗi. Chỉ case cần đẩy mà VẮNG mới là lỗi.
   */
  const want = [...new Set(matched.map((t) => byKey[String(t.tcId).toUpperCase()]))];
  const absent = want.filter((k) => !inCycle.has(k));
  console.log(`ĐỐI SOÁT: cycle ${cycle} có ${inCycle.size} case · lượt này cần ${want.length} · ${absent.length === 0 ? '✓ ĐỦ' : `✗ VẮNG ${absent.length}: ${absent.slice(0, 5).join(', ')}`}`);
  if (absent.length || failed) process.exitCode = 1;
}

main().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
