#!/usr/bin/env node
'use strict';

/*
 * reconcile_migration.js — ĐỐI SOÁT di trú Xray → AIO. CHỈ ĐỌC, không ghi gì.
 *
 * VÌ SAO CÓ FILE NÀY: "đã chạy migrate" KHÔNG phải bằng chứng là "đã di trú đủ". Hai script
 * `migrate_testcases.js` / `migrate_execution.js` đều báo "XONG" theo số việc chúng gửi đi, chứ không
 * đọc lại đích. Bản đầu của `migrate_execution` khớp case theo TIÊU ĐỀ và **mất 12 run** mà log vẫn xanh
 * (563 run chỉ còn 552 tiêu đề phân biệt). Sau khi Xray đóng băng, phát hiện thiếu thì không còn nguồn
 * để chạy lại — nên phép đếm lại ở HAI ĐẦU phải là một lệnh chạy được, không phải script tạm dùng một lần.
 *
 * Đo 3 thứ, mỗi thứ là một cách mất dữ liệu khác nhau:
 *   1. SỐ LƯỢNG run mỗi execution (thiếu = run bị dồn vào cùng case do khớp sai khoá).
 *   2. SỐ CASE PHÂN BIỆT trong cycle (bằng số run thì không có case nào bị chồng attempt).
 *   3. TRẠNG THÁI run (đủ số nhưng sai trạng thái thì pass-rate lịch sử thành vô nghĩa).
 *
 * BẪY ĐỌC (đặc tính #9 của AIO): trạng thái run KHÔNG ở `record.status` mà ở
 * `record.runs[<attempt cuối>].testRunStatus.name`; đọc sai chỗ ra `undefined` mà API vẫn trả 200 —
 * lần đầu chạy tôi ra "?=2103" và tưởng AIO không có trạng thái.
 *
 * GIỚI HẠN PHẢI NÓI TRƯỚC: đo 20/08/2026 ra **0/15 lệch**, nên **nhánh phát hiện lệch chưa gặp ca thật**.
 * Muốn thử răng thì thêm 1 run mới trên Xray rồi chạy `--exec <key>` trước khi migrate lại: số phải lệch
 * và dòng đó phải ra `✗`. Đừng coi một lượt xanh là bằng chứng script biết báo đỏ.
 *
 * Dùng:
 *   node scripts/integrations/aio/reconcile_migration.js            # tất cả Test Execution của project
 *   ... --exec SAPP-28132[,SAPP-28421]                              # chỉ vài execution
 *   ... --out <đường dẫn .md>                                       # ghi báo cáo
 * Cần: XRAY_CLIENT_ID/SECRET (đọc Xray) + AIO_API_TOKEN + JIRA_* (đọc issue).
 */

const fs = require('fs');
const path = require('path');
require(path.resolve(__dirname, '..', '..', 'utils', 'runtime_config')); // nạp .env + TASK_ENV
const { AioClient } = require('./aio_client');
const { XrayCloudClient } = require(path.resolve(__dirname, '..', 'jira', 'xray_cloud'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };

const norm = (s) => String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
/** Xray → tên trạng thái run của AIO. Cùng bảng với `migrate_execution.js`, chỉ khác là ở đây so tên. */
const XR2AIO = { PASSED: 'Passed', FAILED: 'Failed', TODO: 'Not Run', 'TO DO': 'Not Run', EXECUTING: 'In Progress', BLOCKED: 'Blocked', ABORTED: 'Blocked' };
const tally = (a) => a.reduce((m, s) => { m[s] = (m[s] || 0) + 1; return m; }, {});
const fmt = (o) => Object.entries(o).sort().map(([k, v]) => `${k}=${v}`).join(' ') || '(rỗng)';

async function jira(p) {
  const base = (process.env.JIRA_BASE_URL || process.env.JIRA_URL || '').replace(/\/$/, '');
  const auth = 'Basic ' + Buffer.from(`${process.env.JIRA_EMAIL || process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`).toString('base64');
  const r = await fetch(base + p, { headers: { Authorization: auth, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Jira ${r.status} khi gọi ${p}`);
  return r.json();
}

/** Run của 1 execution — PHẢI phân trang: `testRuns` chặn cứng 100, execution lớn có 563 run. */
async function xrayRuns(xray, issueId) {
  const out = [];
  for (let s = 0; ; s += 100) {
    const d = await xray.graphql(
      'query($id: String, $s: Int) { getTestExecution(issueId: $id) { testRuns(limit: 100, start: $s) { total results { status { name } evidence { filename } test { jira(fields: ["key"]) } } } } }',
      { id: String(issueId), s },
    );
    const page = (d.getTestExecution && d.getTestExecution.testRuns) || {};
    const res = page.results || [];
    out.push(...res);
    if (!res.length || out.length >= (page.total || 0)) break;
  }
  return out;
}

async function main() {
  const project = process.env.AIO_PROJECT_KEY || process.env.JIRA_PROJECT_KEY;
  if (!project) { console.error('ERROR: thiếu AIO_PROJECT_KEY / JIRA_PROJECT_KEY.'); process.exit(2); }

  const xray = new XrayCloudClient({ clientId: process.env.XRAY_CLIENT_ID, clientSecret: process.env.XRAY_CLIENT_SECRET });
  await xray.authenticate();
  const aio = new AioClient({ throttleMs: Number(arg('throttle', 0)) || undefined });

  const only = new Set(String(arg('exec', '')).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
  const jql = encodeURIComponent(`project = ${project} AND issuetype = "Test Execution" ORDER BY created ASC`);
  const search = await jira(`/rest/api/3/search/jql?jql=${jql}&fields=summary,created&maxResults=100`);
  const execs = (search.issues || [])
    .map((i) => ({ key: i.key, id: i.id, title: i.fields.summary, created: String(i.fields.created).slice(0, 10) }))
    .filter((e) => !only.size || only.has(e.key.toUpperCase()));
  if (!execs.length) { console.error('ERROR: không thấy Test Execution nào khớp.'); process.exit(2); }

  const cycles = await aio.list('/testcycle');
  const byTitle = {};
  cycles.forEach((c) => { byTitle[norm(c.title)] = c; });

  const rows = [];
  for (const e of execs) {
    const xr = await xrayRuns(xray, e.id);
    const xrStatus = tally(xr.map((r) => XR2AIO[String((r.status || {}).name || '').toUpperCase()] || `?${(r.status || {}).name || ''}`));
    const xrEvidence = xr.filter((r) => (r.evidence || []).length).length;

    const cy = byTitle[norm(e.title)];
    const recs = cy ? await aio.list(`/testcycle/${cy.key || cy.ID}/testrun`) : [];
    // Mỗi record = 1 case trong cycle; `runs[]` là các attempt → lấy attempt MỚI NHẤT.
    const aioStatus = tally(recs.map((r) => {
      const last = (r.runs || []).slice(-1)[0] || {};
      return (last.testRunStatus && last.testRunStatus.name) || '?';
    }));
    // Đặc tính #9: key của case nằm ở `.testCase.key`, KHÔNG ở `.key`.
    const uniq = new Set(recs.map((r) => (r.testCase && r.testCase.key) || r.key)).size;

    rows.push({
      exec: e.key, created: e.created, title: e.title,
      cycle: cy ? (cy.key || cy.ID) : null,
      xrRuns: xr.length, aioRuns: recs.length, uniq, xrEvidence,
      xrStatus, aioStatus,
      okCount: Boolean(cy) && recs.length === xr.length && uniq === recs.length,
      okStatus: Boolean(cy) && fmt(xrStatus) === fmt(aioStatus),
    });
  }

  const T = { xr: {}, aio: {} };
  let bad = 0;
  console.log(`\n══ ĐỐI SOÁT DI TRÚ: ${rows.length} Test Execution (Xray) → Cycle (AIO) ══`);
  for (const r of rows) {
    const ok = r.okCount && r.okStatus;
    if (!ok) bad++;
    console.log(`${ok ? '✓' : '✗'} ${r.exec} → ${r.cycle || '(THIẾU CYCLE)'} · run ${r.xrRuns}/${r.aioRuns} · case phân biệt ${r.uniq} · evidence-run bên Xray ${r.xrEvidence}`);
    if (!r.okStatus) { console.log(`      Xray: ${fmt(r.xrStatus)}`); console.log(`      AIO : ${fmt(r.aioStatus)}`); }
    for (const [k, v] of Object.entries(r.xrStatus)) T.xr[k] = (T.xr[k] || 0) + v;
    for (const [k, v] of Object.entries(r.aioStatus)) T.aio[k] = (T.aio[k] || 0) + v;
  }
  console.log(`\nRun: Xray ${rows.reduce((s, r) => s + r.xrRuns, 0)} · AIO ${rows.reduce((s, r) => s + r.aioRuns, 0)}`);
  console.log(`Trạng thái Xray: ${fmt(T.xr)}`);
  console.log(`Trạng thái AIO : ${fmt(T.aio)}`);
  console.log(bad === 0
    ? '✓ ĐỦ: mọi execution có cycle, đủ run, không case nào bị chồng attempt, trạng thái khớp.'
    : `✗ ${bad}/${rows.length} execution LỆCH — chạy lại \`aio:migrate-exec\` cho đúng execution đó TRƯỚC khi Xray đóng băng.`);

  const out = arg('out');
  if (out) {
    const L = [`<!-- gate: proven=${rows.length - bad} inconclusive=0 broken=${bad} -->`,
      '# Đối soát di trú Xray → AIO Tests', '',
      '> Sinh bởi `scripts/integrations/aio/reconcile_migration.js` (chỉ đọc). Đếm lại ở HAI ĐẦU vì "đã chạy',
      '> migrate" không phải bằng chứng đã di trú đủ — bản đầu của migrate từng mất 12 run mà log vẫn xanh.', '',
      `- Execution đối soát: **${rows.length}** · lệch: **${bad}**`,
      `- Run: Xray **${rows.reduce((s, r) => s + r.xrRuns, 0)}** · AIO **${rows.reduce((s, r) => s + r.aioRuns, 0)}**`,
      `- Trạng thái Xray: \`${fmt(T.xr)}\` · AIO: \`${fmt(T.aio)}\``, '',
      '| Execution | Ngày | Cycle | Run Xray | Run AIO | Case phân biệt | Trạng thái khớp |', '|---|---|---|---|---|---|---|',
      ...rows.map((r) => `| ${r.exec} | ${r.created} | ${r.cycle || '(thiếu)'} | ${r.xrRuns} | ${r.aioRuns} | ${r.uniq} | ${r.okStatus ? '✓' : '✗'} |`)];
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, `${L.join('\n')}\n`);
    console.log(`Báo cáo: ${out}`);
  }
  if (bad) process.exitCode = 1;
}

if (require.main === module) main().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
module.exports = { main };
