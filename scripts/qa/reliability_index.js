#!/usr/bin/env node
'use strict';

/*
 * reliability_index.js (F10) — Test Reliability Index (TRI) per-testcase + flaky quarantine.
 * Đọc knowledge/metrics/tc-history.jsonl (do metrics_collect tích luỹ mỗi run) → gộp per-TC:
 *   TRI       = pass sạch (passed, không retry) / tổng lần chạy
 *   flakyRate = số lần flaky (retry rồi mới pass) / tổng
 *   Rank      = S(≥0.99) · A(≥0.97) · B(≥0.90) · C(≥0.75) · D(<0.75)  (cần ≥minRuns mới xếp; ít hơn = NEW)
 *   Quarantine = rank D HOẶC flakyRate > flakyThreshold → tách khỏi gate chính, gắn owner theo dõi.
 * Ra: knowledge/metrics/reliability-index.{md,json} (+ quarantine list). Nguồn cho dashboard.
 *
 * Dùng: node scripts/qa/reliability_index.js [--in <tc-history.jsonl>] [--min-runs 3] [--flaky-threshold 0.1]
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const IN = path.resolve(arg('in', path.join(rc.REPO_ROOT, 'knowledge', 'metrics', 'tc-history.jsonl')));
const OUT = path.resolve(arg('out', path.join(rc.REPO_ROOT, 'knowledge', 'metrics')));
const MIN_RUNS = parseInt(arg('min-runs', '3'), 10);
const FLAKY_TH = parseFloat(arg('flaky-threshold', '0.1'));

function rankOf(tri) {
  if (tri >= 0.99) return 'S';
  if (tri >= 0.97) return 'A';
  if (tri >= 0.90) return 'B';
  if (tri >= 0.75) return 'C';
  return 'D';
}

if (!fs.existsSync(IN)) {
  console.log(`[reliability] Chưa có ${path.relative(rc.REPO_ROOT, IN)} — chạy test + metrics_collect để tích luỹ trước. (0 TC)`);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'reliability-index.json'), JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '), note: 'Chưa có dữ liệu tc-history.', tests: [] }, null, 2), 'utf8');
  process.exit(0);
}

const recs = fs.readFileSync(IN, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
/*
 * BỎ record `skipped` trước khi tính. Skip KHÔNG nói gì về độ tin cậy, nhưng TRI = pass sạch / TỔNG nên
 * mỗi record skip kéo TRI xuống. Chạy một file lẻ ⇒ 500+ test còn lại bị ghi skip ⇒ TRI của chúng về 0.
 * Đo 23/08/2026 trên kho thật: 1548 record = 1537 skipped · 10 failed · 1 passed ⇒ bảng cũ "quarantine
 * 437/438 test, TRI 0, flaky 0". Đó không phải cảnh báo mà là KẾT LUẬN SAI sinh từ nhiễu.
 * `metrics_collect` đã ngừng ghi skip từ cùng ngày; lọc ở đây để dữ liệu CŨ không tiếp tục đầu độc.
 */
const skippedRecs = recs.filter((r) => String(r.status || '') === 'skipped').length;
const usable = recs.filter((r) => String(r.status || '') !== 'skipped');
if (skippedRecs) console.log(`[reliability] bỏ ${skippedRecs}/${recs.length} record \`skipped\` (không mang tín hiệu độ tin cậy; TRI tính trên ${usable.length} record đã CHẠY).`);
if (!usable.length) {
  console.log('[reliability] KHÔNG có record nào đã chạy ⇒ không kết luận gì. Cần chạy suite với retry (CI) để sinh tín hiệu clean/flaky.');
  process.exit(0);
}
const byKey = new Map();
for (const r of usable) {
  const g = byKey.get(r.key) || { key: r.key, file: r.file, title: r.title, total: 0, cleanPass: 0, flaky: 0, fail: 0, lastAt: '' };
  g.total++;
  const st = String(r.status || '');
  if (r.flaky) g.flaky++;
  else if (st === 'passed') g.cleanPass++;
  if (st === 'failed' || st === 'timedOut' || st === 'interrupted') g.fail++;
  if (r.at > g.lastAt) g.lastAt = r.at;
  g.file = r.file || g.file; g.title = r.title || g.title;
  byKey.set(r.key, g);
}

const tests = [...byKey.values()].map((g) => {
  // Clean Reliability (TRI) = pass sạch/tổng · Eventual Success = (clean+flaky)/tổng · Flaky Rate = flaky/tổng.
  const tri = g.total ? Math.round((g.cleanPass / g.total) * 1000) / 1000 : 0;
  const eventualSuccess = g.total ? Math.round(((g.cleanPass + g.flaky) / g.total) * 1000) / 1000 : 0;
  const flakyRate = g.total ? Math.round((g.flaky / g.total) * 1000) / 1000 : 0;
  const enough = g.total >= MIN_RUNS;
  const rank = enough ? rankOf(tri) : 'NEW';
  const quarantine = enough && (rank === 'D' || flakyRate > FLAKY_TH);
  return { key: g.key, file: g.file, title: g.title, runs: g.total, tri, eventualSuccess, flakyRate, rank, quarantine, lastAt: g.lastAt };
}).sort((a, b) => (a.quarantine === b.quarantine ? a.tri - b.tri : (a.quarantine ? -1 : 1)));

const generatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
const quarantined = tests.filter((t) => t.quarantine);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'reliability-index.json'), JSON.stringify({ generatedAt, minRuns: MIN_RUNS, flakyThreshold: FLAKY_TH, tests }, null, 2), 'utf8');
fs.writeFileSync(path.join(OUT, 'quarantine.json'), JSON.stringify({ generatedAt, tests: quarantined.map((t) => ({ key: t.key, tri: t.tri, flakyRate: t.flakyRate, rank: t.rank, owner: null })) }, null, 2), 'utf8');

const L = ['# Test Reliability Index (TRI) — F10', '',
  `> ${generatedAt} · ${tests.length} test · quarantine ${quarantined.length} · minRuns=${MIN_RUNS} flakyTh=${FLAKY_TH}`,
  '> TRI (Clean Reliability) = pass sạch/tổng · Eventual = (clean+flaky)/tổng · Flaky = flaky/tổng.',
  '> Rank theo TRI: S≥0.99 A≥0.97 B≥0.90 C≥0.75 D<0.75 (NEW = chưa đủ run).', '',
  '| Test | Runs | TRI(clean) | Eventual | Flaky | Rank | Quarantine |', '|---|---|---|---|---|---|---|'];
for (const t of tests) L.push(`| ${t.title || t.key} | ${t.runs} | ${t.tri} | ${t.eventualSuccess} | ${t.flakyRate} | ${t.rank} | ${t.quarantine ? '⚠️ YES' : ''} |`);
if (quarantined.length) { L.push('', '## Quarantine (tách khỏi gate chính — gắn owner)'); for (const t of quarantined) L.push(`- ${t.title || t.key} — TRI ${t.tri}, flaky ${t.flakyRate}, rank ${t.rank}`); }
fs.writeFileSync(path.join(OUT, 'reliability-index.md'), L.join('\n'), 'utf8');

console.log(`[reliability] ${tests.length} test · ${quarantined.length} quarantine · từ ${recs.length} record → knowledge/metrics/reliability-index.md`);
if (quarantined.length) for (const t of quarantined) console.log(`  QUARANTINE: ${t.title || t.key} (TRI ${t.tri}, flaky ${t.flakyRate})`);

/*
 * `--promote` (v2.5.0 G3.4) — ỨNG VIÊN đưa vào bộ regression/smoke dùng chung.
 *
 * Không có dữ liệu mới và không có phép tính mới: ứng viên = `rank` S hoặc A, đủ `minRuns`, và **0 lần
 * flaky**. Tất cả đã tính ở trên; đây chỉ là một GÓC NHÌN. Viết nó ở đây thay vì dựng script mới vì mọi
 * tín hiệu cần đã nằm trong file này — dựng script thứ hai đọc lại `tc-history` là tạo nguồn trôi.
 *
 * ĐỀ XUẤT, KHÔNG TỰ LÀM. Một case xanh 3 lượt vẫn có thể xanh vì oracle yếu, không vì sản phẩm đúng —
 * TRI đo ĐỘ ỔN ĐỊNH, không đo CHẤT LƯỢNG ORACLE. Nên đầu ra là danh sách để người duyệt, và nó nói ra
 * đúng giới hạn đó.
 *
 * `--top` bắt buộc khi muốn in danh sách: đo 11/10/2026 có **669/956 case** đạt tiêu chí. In 669 dòng thì
 * người đọc cuộn qua — cùng bài học đã trả giá ở `knowledge:bootstrap` (44 khung) và ở cảnh báo của
 * `bug_claim` (23 dòng).
 */
if (process.argv.includes('--promote')) {
  /*
   * LOẠI test ĐÃ NẰM TRONG SUITE DÙNG CHUNG (`tests/**`) — promote chúng là vô nghĩa, chúng đã ở đó.
   *
   * Bản đầu không lọc và in ra "669 ứng viên", nghe rất nhiều. Đo lại thì **611/669 là
   * `tests/fe/infra`** và 58 là `tests/` khác — tức **0 ứng viên là automation theo task**, đúng thứ hạng
   * mục này muốn promote. Một con số lớn mà sai đối tượng thì tệ hơn con số 0, vì nó làm người đọc tin là
   * có 669 việc để làm.
   *
   * Vì sao `tc-history` không có automation theo task: `metrics_collect` đọc `results.json` của lượt
   * chạy, và lượt chạy suite infra nhiều hơn hẳn — còn spec theo task thường chạy ít hơn `minRuns`.
   */
  const laSuiteChung = (f) => /^tests[\\/]/.test(String(f || ''));
  const uv = tests.filter((t) => ['S', 'A'].includes(t.rank) && t.flakyRate === 0 && t.runs >= MIN_RUNS && !laSuiteChung(t.file))
    .sort((a, b) => (b.runs - a.runs) || (b.tri - a.tri));
  const daTrongSuite = tests.filter((t) => ['S', 'A'].includes(t.rank) && t.flakyRate === 0 && t.runs >= MIN_RUNS && laSuiteChung(t.file)).length;
  const top = parseInt(arg('top', ''), 10);
  console.log(`\n[reliability] ỨNG VIÊN PROMOTE: ${uv.length} case — rank S/A, ≥${MIN_RUNS} lượt, 0 flaky, và CHƯA ở trong \`tests/**\`.`);
  console.log(`  (Đã loại ${daTrongSuite} test vốn đã nằm trong suite dùng chung — promote chúng là vô nghĩa.)`);
  if (!uv.length) {
    console.log('  Chưa có case nào đủ tiêu chí. Đây KHÔNG phải lỗi, và cũng KHÔNG phải "không có gì để promote":');
    console.log('  nghĩa là automation theo task chưa chạy đủ lượt để có tín hiệu. `tc-history` tích luỹ từ mọi lượt,');
    console.log('  mà lượt suite infra nhiều hơn hẳn lượt spec theo task.');
  } else if (!(top > 0)) {
    console.log(`  Thêm \`--top <n>\` để xem danh sách. Không in cả ${uv.length} dòng: danh sách dài thì người đọc cuộn qua.`);
  } else {
    uv.slice(0, top).forEach((t) => console.log(`  ${String(t.runs).padStart(3)} lượt · TRI ${t.tri} · ${t.rank} · ${(t.title || t.key).slice(0, 86)}`));
    if (uv.length > top) console.log(`  … +${uv.length - top}`);
  }
  console.log('  ⚠️ ĐỀ XUẤT, cần NGƯỜI duyệt. TRI đo ĐỘ ỔN ĐỊNH, KHÔNG đo chất lượng oracle — một case xanh');
  console.log('     nhiều lượt vẫn có thể xanh vì assertion yếu. Soi oracle trước khi đưa vào bộ dùng chung.');
}
