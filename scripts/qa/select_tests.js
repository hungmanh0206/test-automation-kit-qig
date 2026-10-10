#!/usr/bin/env node
'use strict';

/*
 * select_tests.js (F9) — Intelligent Test Selection từ git diff.
 * Từ thay đổi giữa <base>..HEAD → chọn tập test cần chạy (scope run manual/nightly/local nhanh hơn).
 *
 * Phân loại (bảo thủ — thà chạy thừa còn hơn sót):
 *   - Đổi support/fixture/playwright.config → ẢNH HƯỞNG DIỆN RỘNG → chạy TẤT CẢ (in: tests).
 *   - Đổi spec test cụ thể → chạy ĐÚNG các spec đó (targeted).
 *   - Chỉ đổi kit/scripts/docs (không đụng tests/) → chạy @smoke (an toàn tối thiểu, nhanh).
 *   - Không đổi gì liên quan → @smoke.
 * Ưu tiên rủi ro: `--risk-first` xếp file hay fail/flaky lên trước, `--include-risky <n>` kéo thêm file
 * rủi ro cao dù diff không đụng. Tín hiệu lấy từ `tc-history` theo FILE (xem `fileRisk`).
 *   (Dòng này trước ghi "hiện in gợi ý, chưa auto-lọc" — SAI từ lúc `fileRisk()` được dùng thật, và nó
 *    mâu thuẫn với chú thích ngay phía dưới trong cùng file. Sửa 11/10/2026.)
 * Khi `--risk-first`: cảnh báo nếu risk-register toàn module band High KHÔNG có tín hiệu (xem cuối file).
 *
 * LƯU Ý wiring: PR KHÔNG chạy UAT test (rule bảo mật — không secret trên PR/fork). F9 dùng để
 * scope run manual/nightly/local, KHÔNG phải PR-gate chạy UAT.
 *
 * Dùng: node scripts/qa/select_tests.js [--base origin/main]
 *   In log + dòng cuối `PLAYWRIGHT_ARGS: <args>` để CI/script bắt: ARGS=$(... | sed -n 's/^PLAYWRIGHT_ARGS: //p')
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const BASE = arg('base', process.env.SELECT_BASE || 'origin/main');

function changedFiles() {
  const tryCmds = [`git diff --name-only ${BASE}...HEAD`, `git diff --name-only ${BASE}`, 'git diff --name-only HEAD~1'];
  for (const cmd of tryCmds) {
    try {
      const out = execSync(cmd, { cwd: rc.REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const files = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (files.length) return { files, cmd };
    } catch (e) { /* thử cmd kế */ }
  }
  return { files: [], cmd: '(không diff được)' };
}

const { files, cmd } = changedFiles();
const norm = files.map((f) => f.replace(/\\/g, '/'));

const isSpec = (f) => /^tests\/.*\.spec\.[jt]s$/.test(f);
const isBroad = (f) => /^tests\/(.*\/)?(support|fixtures)\//.test(f) || /(^|\/)playwright\.config\.[cm]?js$/.test(f);

const specChanged = norm.filter((f) => isSpec(f) && fs.existsSync(path.join(rc.REPO_ROOT, f)));
const broadChanged = norm.some(isBroad);
const anyTestsTouched = norm.some((f) => f.startsWith('tests/'));

// Impact-map (GĐ-U3): đổi vùng NGUỒN (glob) → chọn test domain tương ứng (không chỉ khi spec đổi).
function globToRe(g) {
  return new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\0').replace(/\*/g, '[^/]*').replace(/\0/g, '.*') + '$');
}
let impactTests = []; let impactDomains = [];
try {
  const cand = ['.agent/config/impact-map.json', '.agent/config/impact-map.example.json'].find((p) => fs.existsSync(path.join(rc.REPO_ROOT, p)));
  if (cand) {
    const map = JSON.parse(fs.readFileSync(path.join(rc.REPO_ROOT, cand), 'utf8'));
    for (const d of map.domains || []) {
      const res = (d.sources || []).map(globToRe);
      if (norm.some((f) => res.some((re) => re.test(f)))) { impactTests.push(...(d.tests || [])); impactDomains.push(d.domain); }
    }
    impactTests = [...new Set(impactTests)];
  }
} catch (e) { /* impact-map optional */ }

// --- Learning data (F9 + F10/F11): xếp hạng rủi ro theo FILE từ knowledge/metrics/tc-history.jsonl ---
// Trước đây risk chỉ "in gợi ý, chưa auto-lọc". Giờ dùng thật: ưu tiên chạy trước file hay fail/flaky,
// và (tuỳ chọn) KÉO THÊM file rủi ro cao dù diff không đụng — bắt regression ở vùng hay vỡ.
function fileRisk() {
  const f = path.join(rc.REPO_ROOT, 'knowledge', 'metrics', 'tc-history.jsonl');
  const stat = new Map();
  if (!fs.existsSync(f)) return stat;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    let r; try { r = JSON.parse(line); } catch (e) { continue; }
    let file = String(r.file || '');
    if (!file || file === 'synthetic') continue;
    if (!file.startsWith('tests/') && /\.spec\.[jt]s$/.test(file)) file = `tests/${file}`; // record cũ chưa chuẩn hoá
    const s = stat.get(file) || { runs: 0, failed: 0, flaky: 0 };
    s.runs += 1;
    if (r.status === 'failed') s.failed += 1;
    if (r.flaky) s.flaky += 1;
    stat.set(file, s);
  }
  for (const [, s] of stat) s.score = s.runs ? Math.round(((s.failed + 0.5 * s.flaky) / s.runs) * 100) / 100 : 0;
  return stat;
}
const risk = fileRisk();
const rankedRisky = [...risk.entries()]
  // CHỈ nhận spec thật trong tests/ — tc-history còn chứa script automation task-scoped
  // (outputs/**/automation/*.js) và 'synthetic'; đưa chúng vào PLAYWRIGHT_ARGS là vô nghĩa.
  .filter(([f, s]) => s.score > 0 && isSpec(f) && fs.existsSync(path.join(rc.REPO_ROOT, f)))
  .sort((a, b) => b[1].score - a[1].score);

const INCLUDE_RISKY = parseInt(arg('include-risky', process.env.SELECT_INCLUDE_RISKY || '0'), 10) || 0;
const RISK_FIRST = process.argv.includes('--risk-first') || process.env.SELECT_RISK_FIRST === '1';
const riskyAdded = INCLUDE_RISKY > 0 ? rankedRisky.slice(0, INCLUDE_RISKY).map(([f]) => f) : [];

let selected = [...new Set([...specChanged, ...impactTests, ...riskyAdded])];
if (RISK_FIRST) selected = selected.sort((a, b) => ((risk.get(b) || {}).score || 0) - ((risk.get(a) || {}).score || 0));

/*
 * RISK REGISTER PHANTOM (v2.5.0 G3.4) — xếp thứ tự test theo một register phantom TỆ HƠN không xếp.
 *
 * Đo 11/10/2026 trên `CSDL-9003/reports/risk-register.json`: **10 module band High, và cả 10 đều là tên
 * KHÔNG tồn tại trong dự án này** (`Payment`, `Transaction Management`, `Cash Management`, `Order`,
 * `Product & Order` — module của dự án TRƯỚC, còn trong `impact.modules` của `risk_model.json`). Trong
 * khi đó 18 module CÓ dữ liệu thật bị chặn trần Medium vì không khai Impact.
 *
 * `risk:score` ĐÃ cảnh báo đúng chuyện này ("20/20 tên trong impact.modules không có dữ liệu"). Nhưng
 * cảnh báo ở chỗ SINH register không ngăn được việc DÙNG nó: `--risk-first` vẫn xếp theo điểm, và
 * `executeOrder` vẫn chỉ đường test tới thứ không tồn tại. Nên chỗ gác phải ở đây — nơi register được
 * đem ra dùng.
 *
 * CẢNH BÁO, không chặn: điểm rủi ro theo FILE (`fileRisk()` từ `tc-history`) vẫn là tín hiệu THẬT và độc
 * lập với register. Chặn `--risk-first` sẽ bỏ luôn tín hiệu đúng vì một tín hiệu sai.
 */
let phantomHigh = 0;
if (RISK_FIRST || INCLUDE_RISKY > 0) {
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(rc.getTaskOutputDir(), 'reports', 'risk-register.json'), 'utf8'));
    const mods = Array.isArray(reg.modules) ? reg.modules : [];
    const high = mods.filter((m) => m.band === 'High');
    phantomHigh = high.filter((m) => {
      const d = m.drivers || {};
      /* "Phantom" = band High mà KHÔNG có tín hiệu nào: 0 bug, 0 failRate, và Impact lấy từ config. */
      return !Number(d.bugCount) && !Number(d.failRate) && String(d.impactSource || '').startsWith('config');
    }).length;
    if (high.length && phantomHigh === high.length) {
      console.log(`[select] ⚠ risk-register có ${high.length} module band High và CẢ ${high.length} đều KHÔNG có tín hiệu nào (0 bug · 0 failRate · Impact lấy từ config).`);
      console.log('[select]   Thứ tự theo register sẽ chỉ đường test tới module không tồn tại trong dự án này. Khai Impact đúng');
      console.log('[select]   theo cột `Module` của bộ TC canonical trong `.agent/config/risk_model.json` rồi chạy lại `npm run risk`.');
      console.log('[select]   Điểm rủi ro theo FILE (từ tc-history) vẫn dùng được — nó độc lập với register.');
    }
  } catch (e) { /* chưa có register hoặc chưa có TASK context: không phán gì */ }
}

// Quarantine (F10): test kém tin cậy — CẢNH BÁO để không tin nhầm kết quả xanh/đỏ của chúng.
let quarantined = 0;
try {
  const q = JSON.parse(fs.readFileSync(path.join(rc.REPO_ROOT, 'knowledge', 'metrics', 'quarantine.json'), 'utf8'));
  quarantined = (q.tests || []).length;
} catch (e) { /* chưa có dữ liệu */ }

let args; let reason;
if (broadChanged) { args = 'tests'; reason = 'đổi support/fixture/config → ảnh hưởng rộng → chạy TẤT CẢ'; }
else if (selected.length) { args = selected.join(' '); reason = `chọn ${selected.length} target (spec đổi: ${specChanged.length}${impactDomains.length ? ` + impact-map domain: ${impactDomains.join(',')}` : ''}${riskyAdded.length ? ` + risky từ learning data: ${riskyAdded.length}` : ''}${RISK_FIRST ? ' · xếp risk-first' : ''})`; }
else if (!anyTestsTouched) { args = '--grep @smoke'; reason = 'chỉ đổi kit/scripts/docs (không đụng tests/ và không khớp impact-map) → chạy @smoke'; }
else { args = '--grep @smoke'; reason = 'đổi tests/ nhưng không phải spec cụ thể → @smoke'; }

console.log(`[select] base=${BASE} · diff: ${cmd}`);
console.log(`[select] ${norm.length} file đổi · spec đổi: ${specChanged.length} · broad: ${broadChanged}`);
if (rankedRisky.length) {
  const top = rankedRisky.slice(0, 5).map(([f, s]) => `${f} (score ${s.score}: ${s.failed}F/${s.flaky}Fk/${s.runs}run)`);
  console.log(`[select] risk từ learning data — top: ${top.join(' · ')}`);
  if (!INCLUDE_RISKY && !RISK_FIRST) console.log('[select] (dùng --include-risky <N> để kéo thêm file rủi ro cao, --risk-first để chạy chúng trước)');
} else {
  console.log('[select] chưa có learning data để xếp risk (chạy `npm run learn` sau khi execute).');
}
if (quarantined) console.log(`[select] ⚠ ${quarantined} test đang quarantine (kém tin cậy) — đừng tin kết quả của chúng, xem knowledge/metrics/quarantine.json`);
console.log(`[select] → ${reason}`);
console.log(`PLAYWRIGHT_ARGS: ${args}`);
