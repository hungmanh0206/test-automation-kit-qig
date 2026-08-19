#!/usr/bin/env node
'use strict';

/*
 * migrate_execution.js — chuyển Test Execution của Xray thành Test Cycle của AIO.
 *
 * Xray                          AIO
 *   Test Execution (issue)  →   Cycle          (giữ NGÀY GỐC, không đóng dấu "hôm nay")
 *   Test Run                →   Run            (trạng thái ánh xạ 1:1)
 *   step status             →   run-step status
 *   evidence (cấp run)      →   attachment cấp run
 *   Test Plan (issue)       →   thư mục cycle   (AIO KHÔNG có Test Plan — dùng --folder)
 *
 * MẶC ĐỊNH DRY-RUN. Khớp case theo TIÊU ĐỀ (đo thực tế 40/40); AIO không xoá được nên chạy thử trước.
 *
 * Dùng:
 *   node scripts/integrations/aio/migrate_execution.js --exec <XRAY-EXEC-KEY> [--folder "<Tên sprint>"]
 *   ... --apply
 *
 * LƯU Ý ĐÃ ĐO: evidence của Xray nằm ở CẤP RUN, không có thông tin thuộc bước nào (0/154 step có
 * evidence). Nên gắn ở cấp run là trung thực; muốn evidence theo bước thì phải từ lượt execute MỚI.
 */

const path = require('path');
const { AioClient } = require('./aio_client');
const { XrayCloudClient } = require(path.resolve(__dirname, '..', 'jira', 'xray_cloud'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);

const EXEC = arg('exec');
const FOLDER = arg('folder');
const APPLY = flag('apply');
// Xray → AIO. TODO/EXECUTING giữ nguyên sự thật thay vì suy ra "chắc là pass".
const RUN_STATUS = { PASSED: 3, FAILED: 4, TODO: 1, EXECUTING: 2, BLOCKED: 5, ABORTED: 5 };
const norm = (s) => String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

async function jira(pathname) {
  const base = (process.env.JIRA_BASE_URL || '').replace(/\/$/, '');
  const auth = 'Basic ' + Buffer.from(`${process.env.JIRA_EMAIL || process.env.JIRA_USER_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
  return (await fetch(base + pathname, { headers: { Authorization: auth, Accept: 'application/json' } })).json();
}

async function main() {
  if (!EXEC) { console.error('ERROR: cần --exec <XRAY-EXEC-KEY>'); process.exit(2); }
  const aio = new AioClient({ throttleMs: Number(arg('throttle', 0)) || undefined });
  const xray = new XrayCloudClient({ clientId: process.env.XRAY_CLIENT_ID, clientSecret: process.env.XRAY_CLIENT_SECRET });
  await xray.authenticate();

  const issue = await jira(`/rest/api/3/issue/${EXEC}?fields=summary,created`);
  const day = String(issue.fields.created).slice(0, 10);

  /*
   * PHÂN TRANG BẮT BUỘC: `testRuns` chặn cứng 100/lần. Execution lớn có 563 run — không phân trang
   * là lặng lẽ mất 463 run mà log vẫn báo "XONG 100/100".
   */
  const runs = [];
  for (let start = 0; ; start += 100) {
    const data = await xray.graphql(`query($id: String, $s: Int) { getTestExecution(issueId: $id) { testRuns(limit: 100, start: $s) { total results {
      status { name } steps { status { name } } evidence { filename downloadLink }
      test { jira(fields: ["key","summary","labels"]) } } } } }`, { id: String(issue.id), s: start });
    const page = (data.getTestExecution && data.getTestExecution.testRuns) || {};
    const res = page.results || [];
    runs.push(...res);
    if (!res.length || runs.length >= (page.total || 0)) break;
  }

  /*
   * KHỚP THEO NHÃN `tc-<TC_ID>`, KHÔNG theo tiêu đề.
   * Nhiều test dùng LẠI cùng tiêu đề ở các nhóm khác nhau (vd "Hủy — chọn No" có ở 6 loại order):
   * khớp theo tiêu đề thì nhiều run Xray cùng trỏ về 1 case AIO → run sau chỉ thành một ATTEMPT MỚI của
   * chính case đó, số case trong cycle không tăng → mất run mà log vẫn "XONG".
   * (Đính chính: dòng cũ ở đây ghi "dùng lại run cũ" là SAI — đo lại thì `POST .../testcase/{key}` đẻ
   *  RUN MỚI, run cũ vẫn còn; xem đặc tính #8 trong README. Kết luận mất dữ liệu không đổi.)
   * Đo thật: 563 run chỉ còn 552 tiêu đề phân biệt,
   * trong khi nhãn `tc-*` đủ 563 phân biệt. Tiêu đề chỉ còn là lối dự phòng.
   */
  const cases = await aio.list('/testcase');
  const byKey = {}; const byTitle = {};
  cases.forEach((c) => { if (c.automationKey) byKey[String(c.automationKey).toUpperCase()] = c.key; byTitle[norm(c.title)] = c.key; });
  const tcOf = (r) => {
    const lb = ((r.test.jira.labels) || []).find((l) => /^tc-/i.test(l));
    return lb ? String(lb).slice(3).toUpperCase() : null;
  };
  const caseOf = (r) => { const tc = tcOf(r); return (tc && byKey[tc]) || byTitle[norm(r.test.jira.summary)] || null; };
  const matched = runs.filter((r) => caseOf(r)).length;
  const evTotal = runs.reduce((s, r) => s + (r.evidence || []).length, 0);
  const stepTotal = runs.reduce((s, r) => s + (r.steps || []).length, 0);

  console.log(`${EXEC} · ${day} · ${issue.fields.summary}`);
  console.log(`  run ${runs.length} · bước ${stepTotal} · evidence ${evTotal} · khớp case ${matched}/${runs.length}`);
  const dist = {}; runs.forEach((r) => { dist[r.status.name] = (dist[r.status.name] || 0) + 1; });
  console.log(`  trạng thái: ${JSON.stringify(dist)}${FOLDER ? ` · thư mục đích: "${FOLDER}"` : ''}`);
  if (matched < runs.length) console.log(`  ⚠ ${runs.length - matched} run KHÔNG khớp case nào trên AIO — publish testcase trước đã.`);
  if (!APPLY) { console.log('\n[DRY-RUN] chưa ghi gì. Thêm --apply để tạo cycle.'); return; }

  const folderId = FOLDER ? await aio.ensureFolder('testcycle', [FOLDER]) : null;

  /*
   * DÙNG LẠI cycle đã có cho cùng execution — chạy lại (bù run thiếu) mà tạo cycle mới là đẻ bản trùng,
   * và AIO không cho xoá cycle còn case. Nhận diện theo `objective` chứa key execution.
   */
  const marker = `Migrate từ Xray ${EXEC}`;
  const found = (await aio.list('/testcycle')).find((c) => c.title === issue.fields.summary);
  let cycle = found && found.key;
  if (cycle) {
    console.log(`\ncycle ${cycle} (ID ${found.ID}) — DÙNG LẠI cycle đã có`);
  } else {
    const created = await aio.call('POST', '/testcycle/detail', {
      title: issue.fields.summary,
      objective: marker,
      startDate: `${day}T00:00:00Z`, endDate: `${day}T23:59:59Z`,
      folder: folderId ? { ID: folderId } : undefined,
    });
    cycle = created.json && created.json.key;
    if (!cycle) { console.error(`Không tạo được cycle: HTTP ${created.status} ${created.text.slice(0, 160)}`); process.exit(1); }
    console.log(`\ncycle ${cycle} (ID ${created.json.ID})${folderId ? ` trong "${FOLDER}"` : ''}`);
  }

  /*
   * CHỈ thêm case chưa có trong cycle. `POST .../testcase/{key}` lên case đã có đẻ RUN MỚI (attempt) —
   * chạy lại để BÙ vài run thiếu mà gọi vô điều kiện thì 563 case đều mọc thêm một attempt và evidence
   * bị upload lại từ đầu (đã xảy ra: lượt bù CY-16 up lại đủ 572 file). Xem đặc tính #8 trong README.
   */
  const already = new Set((await aio.list(`/testcycle/${cycle}/testcase`))
    .map((x) => (x.testCase || {}).key).filter(Boolean));

  let ok = 0; let up = 0; let skipped = 0;
  for (const [i, r] of runs.entries()) {
    const caseKey = caseOf(r);
    if (!caseKey) { skipped++; continue; }
    if (!already.has(caseKey)) { await aio.call('POST', `/testcycle/${cycle}/testcase/${caseKey}`, {}); already.add(caseKey); }
    const run = (await aio.call('GET', `/testcycle/${cycle}/testcase/${caseKey}/testrun`)).json;
    if (!run || !run.ID) { skipped++; continue; }

    const full = (await aio.call('GET', `/testcycle/${cycle}/testrun/${run.ID}`)).json || {};
    const steps = full.testRunSteps || [];
    await aio.call('POST', `/testcycle/${cycle}/testrun/${run.ID}`, {
      ...full,
      testRunStatus: { ID: RUN_STATUS[r.status.name] || 1 },
      testRunSteps: steps.map((s, n) => ({ ...s, testRunStepStatus: { ID: RUN_STATUS[(r.steps[n] && r.steps[n].status.name)] || 1 } })),
    });

    // Dedup evidence phải đọc từ RUN DETAIL (endpoint danh sách không trả `attachments` → up trùng).
    const have = new Set(((full.attachments) || []).map((a) => a.name));
    for (const ev of r.evidence || []) {
      if (have.has(ev.filename)) continue;
      const bin = Buffer.from(await (await fetch(ev.downloadLink, { headers: { Authorization: `Bearer ${xray.token}` } })).arrayBuffer());
      const res = await aio.upload(`/testcycle/${cycle}/testrun/${run.ID}/attachment`, ev.filename, bin);
      res.status < 300 ? up++ : skipped++;
      await aio.pause();
    }
    ok++;
    if ((i + 1) % 10 === 0) process.stdout.write(`  ...${i + 1}/${runs.length} run\n`);
    await aio.pause();
  }
  console.log(`\nXONG: ${ok}/${runs.length} run · evidence ${up}/${evTotal} · bỏ qua ${skipped}`);

  /*
   * TỰ ĐỐI SOÁT — đếm TRÊN AIO, không tin số lệnh.
   * Đã dính: log báo "563/563 khớp" (đó là phía Xray) trong khi cycle chỉ có 551 run, vì nhiều run
   * cùng trỏ về một case nên lần thêm thứ hai chỉ thành attempt mới của case đó. Chỉ đếm lại mới thấy.
   */
  const inCycle = await aio.list(`/testcycle/${cycle}/testcase`);
  const gap = runs.length - inCycle.length;
  console.log(`ĐỐI SOÁT: cycle ${cycle} có ${inCycle.length} run · Xray có ${runs.length} · ${gap === 0 ? '✓ KHỚP' : `✗ THIẾU ${gap}`}`);
  if (gap !== 0) {
    console.log('  → thường do nhiều test trùng tiêu đề mà thiếu nhãn tc-*; kiểm nhãn trên Xray.');
    process.exitCode = 1;
  }
  if (up < evTotal) process.exitCode = 1;
}

main().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
