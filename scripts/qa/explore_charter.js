#!/usr/bin/env node
'use strict';

/*
 * explore_charter.js — CHỌN VÙNG DÒ BẰNG DỮ LIỆU, không bằng cảm tính.
 *
 * VÌ SAO CÓ FILE NÀY: runbook cũ bắt đầu bằng "Lập charter" theo scope user nêu. Nhưng người (và agent)
 * hay chọn vùng mình QUEN — tức vùng đã được test nhiều, đã an toàn. Trong khi kit đang có sẵn 4 nguồn nói
 * rõ chỗ nào đáng nghi mà chưa ai dò:
 *   ① `reports/risk-register.json` — band + impact/likelihood theo module (đã có 101 module ở task thật)
 *   ② `knowledge/bugs/*.json`      — bug lịch sử theo `module` ⇒ mật độ defect
 *   ③ testcase canonical           — module nào ÍT case (mỏng ⇒ dễ sót)
 *   ④ `knowledge/explorations/`    — vùng ĐÃ dò ở phiên trước ⇒ trừ điểm để không dò lại chỗ cũ
 *
 * Điểm đáng-nghi = band(①) + bug lịch sử(②) + độ mỏng testcase(③) − đã-dò-gần-đây(④).
 * Đề xuất 3 charter ứng viên kèm LÝ DO TỪNG SỐ để QA chọn — KHÔNG tự chọn, KHÔNG tự chạy phiên.
 *
 * Dùng:
 *   TASK_ENV=profiles/<TASK>/task.env npm run explore:charter
 *   ... npm run explore:charter -- --top 5 --out <file.md>
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const canonical = require(path.resolve(__dirname, '..', 'lib', 'testcase'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const norm = (s) => String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

/*
 * KHỚP MODULE GIỮA HAI HỆ TÊN. risk-register dùng tên ngắn theo `risk_model.json` ("Payment", "Order"),
 * còn cột `Module` của testcase là tên dài ("Tạo Add-on Order / Chọn Version"). So bằng dấu `=` thì 0/101
 * khớp ⇒ mọi module bị cộng điểm "chưa có case nào" và bảng xếp hạng thành rác.
 * Cách khớp: lấy phần trước `/` (như `groupOf` của bug_tc_matcher) rồi so TOKEN ≥4 ký tự.
 */
const groupOf = (m) => String(m || '').split('/')[0];
const tokens = (s) => norm(groupOf(s)).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4);
const sameModule = (a, b) => {
  const A = tokens(a); const B = tokens(b);
  if (!A.length || !B.length) return false;
  return A.some((w) => B.includes(w));
};
/** Đếm theo map <tên dài → số>, cộng dồn mọi khoá khớp với `name`. */
const countFor = (map, name) => { let n = 0; for (const [k, v] of map) if (sameModule(k, name)) n += v; return n; };
/** Trọng số "đã dò" lớn nhất trong các vùng khớp. */
const exploredFor = (map, name) => { let w = 0; for (const [k, v] of map) if (sameModule(k, name)) w = Math.max(w, v); return w; };

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };

/** ① risk register của task (sinh bởi `npm run risk`). Không có ⇒ nói rõ, đừng coi như không có rủi ro. */
function loadRisk(taskDir) {
  const p = path.join(taskDir, 'reports', 'risk-register.json');
  const j = readJson(p);
  if (!j) return { rows: [], source: null };
  const rows = Array.isArray(j) ? j : (j.modules || []);
  return { rows, source: path.relative(rc.REPO_ROOT, p) };
}

/** ② bug lịch sử theo module (kho dùng chung, không theo task). */
function loadBugs() {
  const dir = path.join(rc.REPO_ROOT, 'knowledge', 'bugs');
  const by = new Map();
  if (!fs.existsSync(dir)) return by;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const j = readJson(path.join(dir, f));
    if (!j || !j.module) continue;
    const k = norm(j.module);
    by.set(k, (by.get(k) || 0) + 1);
  }
  return by;
}

/** ③ số case hiện có theo module — mỏng thì dễ sót. */
function loadCaseDensity(taskDir) {
  const by = new Map();
  for (const dir of rc.getTestcaseDirs(taskDir, { mirrorsFirst: true })) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
      let doc; try { doc = canonical.parseMarkdown(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { continue; }
      for (const t of doc.tests || []) {
        const k = norm(t.module || t.group);
        if (k) by.set(k, (by.get(k) || 0) + 1);
      }
    }
  }
  return by;
}

/** ④ vùng đã dò ở các phiên trước (record của `explore:close`). */
function loadExplored() {
  const dir = path.join(rc.REPO_ROOT, 'knowledge', 'explorations');
  const by = new Map();
  if (!fs.existsSync(dir)) return by;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const j = readJson(path.join(dir, f));
    if (!j) continue;
    const days = (Date.now() - Date.parse(j.date || 0)) / 86400000;
    for (const a of j.areas || []) {
      const k = norm(a);
      // càng gần đây càng trừ mạnh; quá 90 ngày thì coi như vùng đã đổi, không trừ nữa
      const w = days > 90 || !Number.isFinite(days) ? 0 : Math.max(0, 1 - days / 90);
      by.set(k, Math.max(by.get(k) || 0, w));
    }
  }
  return by;
}

const BAND_SCORE = { high: 40, medium: 20, low: 5 };

function rank({ risk, bugs, cases, explored }) {
  const out = [];
  for (const r of risk.rows) {
    const key = norm(r.module);
    if (!key) continue;
    const band = String(r.band || '').toLowerCase();
    const bandPt = BAND_SCORE[band] || 0;
    const bugCount = countFor(bugs, r.module);
    const bugPt = Math.min(30, bugCount * 10);                 // trần 30: 3 bug đã đủ nói "vùng này hay vỡ"
    const caseCount = countFor(cases, r.module);
    const thinPt = caseCount === 0 ? 25 : caseCount <= 3 ? 15 : caseCount <= 8 ? 8 : 0;
    const exploredW = exploredFor(explored, r.module);
    const exploredPt = -Math.round(30 * exploredW);            // vừa dò xong thì trừ tối đa 30
    const score = bandPt + bugPt + thinPt + exploredPt;
    out.push({
      module: r.module, band: r.band, score,
      why: [
        `band ${r.band || '?'} (+${bandPt})`,
        `${bugCount} bug lịch sử (+${bugPt})`,
        caseCount === 0 ? 'CHƯA có case nào (+25)' : `${caseCount} case (+${thinPt})`,
        exploredW ? `đã dò ${Math.round(exploredW * 90)} ngày gần đây (${exploredPt})` : 'chưa dò lần nào (0)',
      ],
      bugCount, caseCount, exploredW,
    });
  }
  return out.sort((a, b) => b.score - a.score || a.module.localeCompare(b.module));
}

/** Tour đề xuất theo dấu hiệu — không rải đều, chọn theo lý do vùng đó bị nghi. */
function suggestTours(r) {
  const t = [];
  if (/payment|thanh toán|order|đơn|tiền|revenue|doanh thu|transaction/i.test(r.module)) t.push('Money/number', 'D — Data');
  if (/sync|đồng bộ|export|import|job|mail|schedule|lịch/i.test(r.module)) t.push('T — Time', 'O — Operations');
  if (/permission|quyền|role|auth|login/i.test(r.module)) t.push('Permission/URL bypass', 'O — Operations');
  if (/list|danh sách|filter|search|tìm/i.test(r.module)) t.push('O — Operations', 'S — Structure');
  if (r.caseCount === 0) t.push('Ngược chiều (reverse)');
  if (!t.length) t.push('F — Function', 'D — Data', 'Interruption');
  return [...new Set(t)].slice(0, 3);
}

function main() {
  const taskKey = rc.getTaskKey();
  const taskDir = rc.getTaskOutputDir();
  const top = Math.max(1, Number(arg('top', 3)) || 3);

  const risk = loadRisk(taskDir);
  if (!risk.rows.length) {
    console.error('[charter] ✗ chưa có `reports/risk-register.json` cho task này — chạy `npm run risk` trước.');
    console.error('[charter]   KHÔNG đề xuất bằng cảm tính: chọn vùng dò mà không có căn cứ thì dễ dò đúng chỗ đã an toàn.');
    process.exit(2);
  }
  const bugs = loadBugs();
  const cases = loadCaseDensity(taskDir);
  const explored = loadExplored();

  const ranked = rank({ risk, bugs, cases, explored });
  const picks = ranked.slice(0, top);

  console.log(`[charter] ${taskKey} · ${risk.rows.length} module trong risk register (${risk.source})`);
  const matchedCases = ranked.filter((r) => r.caseCount > 0).length;
  const matchedBugs = ranked.filter((r) => r.bugCount > 0).length;
  console.log(`[charter] nguồn: bug lịch sử ${bugs.size} module (khớp ${matchedBugs}/${ranked.length}) · mật độ case ${cases.size} module (khớp ${matchedCases}/${ranked.length}) · đã dò ${explored.size} vùng`);
  if (!matchedCases) console.log('[charter] ⚠ KHÔNG khớp được module nào giữa risk-register và testcase ⇒ điểm "độ mỏng testcase" KHÔNG có giá trị ở lượt này. Xem `knowledge/bug_tc_map.json` để nối tên module thủ công.');
  console.log('[charter] ⓘ Đây là ĐỀ XUẤT để QA chọn — máy không tự chọn và không tự chạy phiên.\n');
  picks.forEach((p, i) => {
    console.log(`${i + 1}. ${p.module}  ·  điểm đáng-nghi ${p.score}`);
    console.log(`   vì: ${p.why.join(' · ')}`);
    console.log(`   tour đề xuất: ${suggestTours(p).join(' · ')}\n`);
  });
  const zero = ranked.filter((r) => r.caseCount === 0).length;
  if (zero) console.log(`[charter] ⚠ ${zero}/${ranked.length} module CHƯA có case nào — đó là chỗ exploratory đáng giá nhất, nhưng cũng là dấu hiệu Phase 1 còn thiếu.`);

  const out = arg('out');
  if (out) {
    const L = [`<!-- gate: proven=${picks.length} inconclusive=0 broken=0 -->`,
      `# Charter ứng viên — ${taskKey}`, '',
      '> Sinh bởi `scripts/qa/explore_charter.js`. Điểm = band risk + bug lịch sử + độ mỏng testcase − đã-dò-gần-đây.',
      '> Máy ĐỀ XUẤT, người CHỌN. Chọn xong copy vào `<TASK_OUTPUT_DIR>/exploratory/session-charter.md` kèm timebox.', '',
      '| # | Module | Điểm | Vì sao | Tour đề xuất |', '|---|---|---|---|---|',
      ...picks.map((p, i) => `| ${i + 1} | ${p.module} | ${p.score} | ${p.why.join(' · ')} | ${suggestTours(p).join(' · ')} |`)];
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, `${L.join('\n')}\n`);
    console.log(`[charter] báo cáo: ${out}`);
  }
}

if (require.main === module) main();
module.exports = { rank, suggestTours };
