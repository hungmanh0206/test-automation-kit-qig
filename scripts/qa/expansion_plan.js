#!/usr/bin/env node
/**
 * expansion_plan.js — QUYẾT TRƯỚC KHI CHẠY: case nào mở rộng trục nào, và tốn bao nhiêu.
 *
 * VÌ SAO CÓ FILE NÀY: mở rộng 5 trục × mọi case thì suite dài ra và evidence nhân lên (đo thật: 1 task đang
 * 1021 file / 136 MB) — rồi chính đống artifact đó làm không ai đọc báo cáo. Nên độ sâu đi theo **risk band**, và
 * chi phí phải **hiện ra trước khi chạy**, không phải phát hiện sau khi đầy ổ.
 *
 * Kèm chức năng kiểm: đọc `test-results/expansion_findings.json` và **chặn** nếu có finding vi phạm luật oracle
 * (PASS/FAIL mà không có `oracle_ref`) — phòng trường hợp file bị sinh bằng script tự chế hoặc sửa tay.
 *
 * Dùng:
 *   TASK_ENV=profiles/<TASK>/task.env npm run expansion:plan            # kế hoạch + chi phí
 *   ... npm run expansion:plan -- --audit [--enforce]                   # kiểm findings đã ghi
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const canonical = require(path.resolve(__dirname, '..', 'lib', 'testcase'));
const depth = require(path.resolve(__dirname, '..', 'lib', 'expansion', 'depth'));
const finding = require(path.resolve(__dirname, '..', 'lib', 'expansion', 'finding'));

const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };

const taskKey = rc.getTaskKey();
const taskDir = path.join(rc.REPO_ROOT, rc.getProjectOutputDir(), 'tasks', taskKey);
const tcDir = arg('tc-dir', path.join(taskDir, 'test-cases'));

/** Đọc testcase canonical (markdown) — cùng nguồn với các gate khác, không tự parse lại. */
function loadTests(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { out.push(...loadTests(p)); continue; }
    if (!f.endsWith('.md')) continue;
    try { out.push(...(canonical.parseMarkdown(fs.readFileSync(p, 'utf8')).tests || [])); } catch (e) { /* file không phải bảng canonical */ }
  }
  const seen = new Set();
  return out.filter((t) => t.tcId && !seen.has(t.tcId) && seen.add(t.tcId));
}

if (flag('audit')) {
  const jp = path.join(taskDir, 'test-results', 'expansion_findings.json');
  if (!fs.existsSync(jp)) {
    console.log(`[exp] chưa có ${path.relative(rc.REPO_ROOT, jp)} — chưa lượt mở rộng nào ghi finding.`);
    process.exit(0);
  }
  const data = JSON.parse(fs.readFileSync(jp, 'utf8'));
  const list = data.findings || [];
  const by = finding.summarize(list);
  const bad = finding.auditFindings(list);
  console.log(`[exp] ${list.length} finding · EXPANSION_FINDING ${by.EXPANSION_FINDING} · PASS ${by.PASS} · FAIL ${by.FAIL} · OBSERVATION ${by.OBSERVATION}`);
  for (const b of bad) console.log(`[exp] ✗ ${b}`);
  if (!bad.length) console.log('[exp] ✓ mọi finding đều đúng luật oracle (PASS/FAIL đều có neo; OBSERVATION đều có câu hỏi mở).');
  if (flag('enforce') && bad.length) process.exit(1);
  process.exit(0);
}

const tests = loadTests(tcDir);
if (!tests.length) { console.error(`[exp] ✗ không đọc được testcase canonical ở ${path.relative(rc.REPO_ROOT, tcDir)}`); process.exit(2); }

const est = depth.estimate(tests);
console.log(`[exp] ${tests.length} testcase · band: high ${est.bands.high} · medium ${est.bands.medium} · low ${est.bands.low}`);
console.log(`[exp] kế hoạch trục: high → ${depth.PLAN.high.join(' ')} · medium → ${depth.PLAN.medium.join(' ')} · low → ${depth.PLAN.low.join(' ')}`);
console.log(`[exp] CHI PHÍ ước lượng: ~${est.loads} lượt tải trang · ~${est.shots} ảnh evidence · ~${est.minutes} phút · ~${est.mb} MB`);
console.log('[exp] ⓘ Ước lượng để QUYẾT TRƯỚC: thấy quá thì hạ band hoặc thu hẹp scope, đừng chạy rồi mới biết.');

// Nhóm case theo band để người/agent biết chạy trục gì cho case nào
const byBand = { high: [], medium: [], low: [] };
for (const t of tests) byBand[depth.bandOf(t)].push(t.tcId);
for (const b of ['high', 'medium', 'low']) {
  if (!byBand[b].length) continue;
  console.log(`[exp] ${b.toUpperCase()} (${byBand[b].length}): ${byBand[b].slice(0, 12).join(', ')}${byBand[b].length > 12 ? ` … (+${byBand[b].length - 12})` : ''}`);
}

const out = arg('out');
if (out) {
  const L = [`<!-- gate: proven=${tests.length} inconclusive=0 broken=0 -->`,
    '# Kế hoạch mở rộng quanh case (theo risk band)', '',
    '> Sinh bởi `scripts/qa/expansion_plan.js`. Độ sâu theo band vì chi phí là thật: mỗi trục thêm lượt tải trang',
    '> và ảnh evidence. Ước lượng dưới đây để **quyết trước khi chạy**.', '',
    `- Testcase: **${tests.length}** — high **${est.bands.high}** · medium **${est.bands.medium}** · low **${est.bands.low}**`,
    `- Chi phí ước lượng: **~${est.loads}** lượt tải trang · **~${est.shots}** ảnh · **~${est.minutes}** phút · **~${est.mb}** MB`, '',
    '| Band | Trục phải mở rộng | Số case |', '|---|---|---|',
    ...['high', 'medium', 'low'].map((b) => `| ${b} | ${depth.PLAN[b].join(' · ')} | ${est.bands[b]} |`)];
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, `${L.join('\n')}\n`);
  console.log(`[exp] báo cáo: ${out}`);
}
