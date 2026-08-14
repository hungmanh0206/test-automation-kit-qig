#!/usr/bin/env node
'use strict';

/*
 * learn_report.js — trả lời câu "chạy task này thì đã HỌC được gì?".
 *
 * VÌ SAO CẦN: trước đây kit ghi vào `knowledge/` khá đầy đủ nhưng KHÔNG báo lại. `learn_task`/`learn_bugs`
 * chỉ in một dòng console rồi mất; `execution-summary` có 12+ mục bắt buộc mà không mục nào về việc học.
 * Kết quả: người dùng không biết vòng học có chạy hay không, và không biết nó BỎ SÓT gì.
 *
 * Báo 2 phần — phần thứ hai quan trọng hơn:
 *   ĐÃ HỌC    — record thuộc task này, gom theo store
 *   CHƯA HỌC  — lỗ hổng đo được: bug không map được module (bị risk_score loại), rule chưa có TC nào dùng,
 *               bug đã nêu nguyên nhân mà chưa có root cause, store còn rỗng
 *
 * Dùng: TASK_ENV=profiles/<TASK>/task.env node scripts/qa/learn_report.js --task <TASK_KEY> [--write]
 *   --write ghi `<TASK_OUTPUT_DIR>/reports/learning-summary.md`; không có --write thì chỉ in ra.
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);
const TASK = arg('task', process.env.TASK_KEY || '');
const KNOW = path.join(rc.REPO_ROOT, 'knowledge');
const POD = process.env.PROJECT_OUTPUT_DIR || '';
const taskDir = (TASK && POD) ? path.resolve(rc.REPO_ROOT, POD, 'tasks', TASK) : null;

if (!TASK) { console.error('[learn-report] cần --task <TASK_KEY> (hoặc TASK_KEY env).'); process.exit(2); }

const STORES = ['bugs', 'domain', 'system', 'decisions', 'root_causes', 'setup_recipes', 'environment', 'locators'];
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };

/** Record thuộc task này: có `task_key` khớp, hoặc `source`/nội dung nhắc TASK_KEY. */
const load = (store) => {
  const dir = path.join(KNOW, store);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: f, data: readJson(path.join(dir, f)) }))
    .filter((r) => r.data);
};
const mine = (r) => String(r.data.task_key || '') === TASK || JSON.stringify(r.data).includes(TASK);

const learned = {}; const totals = {};
for (const s of STORES) {
  const all = load(s);
  totals[s] = all.length;
  learned[s] = all.filter(mine);
}

// ── CHƯA HỌC: lỗ hổng đo được, không phỏng đoán
const gaps = [];
const bugs = learned.bugs;
const unmapped = bugs.filter((r) => !r.data.tc_id && (r.data.module === '(unmapped)' || !r.data.module));
if (unmapped.length) gaps.push(`${unmapped.length}/${bugs.length} bug KHÔNG map được module (thiếu \`tc_id\`) → \`risk_score\` LOẠI khỏi bảng, nên chúng không làm tăng Likelihood và không ảnh hưởng độ sâu test lượt sau.`);
const noRc = bugs.filter((r) => !r.data.root_cause_ref);
if (noRc.length && !totals.root_causes) gaps.push(`${noRc.length} bug chưa có \`root_cause_ref\` và \`root_causes/\` còn RỖNG → không tra được "lỗi này cùng nguyên nhân với bug nào", nên cùng một gốc dễ bị log lại.`);
for (const s of ['domain', 'system']) {
  const bare = learned[s].filter((r) => Array.isArray(r.data.covered_by) && !r.data.covered_by.length);
  if (bare.length) gaps.push(`${bare.length} record \`${s}/\` có \`covered_by\` RỖNG → rule/bản đồ đã ghi nhưng chưa testcase nào dùng làm oracle (coverage gap).`);
}
for (const s of ['setup_recipes', 'environment', 'locators']) {
  if (!totals[s]) gaps.push(`\`${s}/\` còn RỖNG — loại tri thức này chiếm phần lớn thời gian thật khi rerun; vấp xong nên ghi lại ngay lúc còn tươi.`);
}

// ── xuất
const L = [];
L.push(`# Đã học được gì — ${TASK}`, '');
L.push(`> Sinh bởi \`npm run learn:report\`. Kho học là dữ liệu LOCAL (không commit) — nạp lại được từ Jira/test-results.`, '');
const totalMine = STORES.reduce((n, s) => n + learned[s].length, 0);
L.push(`## Đã học (${totalMine} record thuộc task này)`, '');
if (!totalMine) {
  L.push('_Chưa có record nào gắn với task này._ Nếu task đã execute và log bug thì vòng học chưa chạy — kiểm `npm run learn -- --scan` và `npm run learn:bugs:apply`.', '');
} else {
  L.push('| Store | Số record | Nội dung |', '|---|---|---|');
  for (const s of STORES) {
    const rs = learned[s];
    if (!rs.length) continue;
    const sample = rs.slice(0, 3).map((r) => (r.data.bug || r.data.rule || r.data.model || r.data.goal || r.data.fact || r.data.target || r.data.decision || r.file)).map((x) => String(x).slice(0, 70));
    L.push(`| \`${s}/\` | ${rs.length} | ${sample.join(' · ')}${rs.length > 3 ? ` · …+${rs.length - 3}` : ''} |`);
  }
  L.push('');
}
L.push(`## Chưa học / lỗ hổng (${gaps.length})`, '');
if (!gaps.length) L.push('_Không phát hiện lỗ hổng đo được._', '');
else { gaps.forEach((g) => L.push(`- ${g}`)); L.push(''); }
L.push('## Toàn kho (mọi task)', '');
L.push('| Store | Tổng record |', '|---|---|');
STORES.forEach((s) => L.push(`| \`${s}/\` | ${totals[s]} |`));

const md = L.join('\n');
console.log(`[learn-report] ${TASK}: ${totalMine} record thuộc task · ${gaps.length} lỗ hổng`);
gaps.slice(0, 4).forEach((g) => console.log(`  ! ${g.slice(0, 150)}`));

if (flag('write')) {
  if (!taskDir) { console.error('[learn-report] --write cần PROJECT_OUTPUT_DIR để biết ghi vào đâu.'); process.exit(2); }
  const out = path.join(taskDir, 'reports', 'learning-summary.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, md, 'utf8');
  console.log(`[learn-report] đã ghi ${path.relative(rc.REPO_ROOT, out).replace(/\\/g, '/')}`);
} else {
  console.log('\n(thêm --write để ghi reports/learning-summary.md)');
}
