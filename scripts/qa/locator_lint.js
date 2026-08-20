#!/usr/bin/env node
'use strict';

/*
 * locator_lint.js — GATE chống "bắt sai element → log sai bug".
 *
 * VẤN ĐỀ NÓ CHỮA (đo thật trên 1 task lớn): `.first()` 2052 lần · `force: true` 1011 · regex trên
 * `body.innerText` 204 · `querySelectorAll('*')` 166 · `.nth(N)` 141 · `mouse.click(x,y)` 31.
 * Những pattern này KHÔNG "khó chịu" — chúng khiến script bấm/đọc nhầm đối tượng một cách IM LẶNG,
 * rồi assertion đọc sai màn → kết luận "bug" trong khi sản phẩm vẫn đúng. Rerun KHÔNG cứu được
 * (sai ổn định, không phải flaky) nên lỗi lọt tới tận Jira.
 *
 * Triết lý: **mơ hồ phải THÀNH LỖI, không được tự chọn bừa.** Lint chặn ở khâu viết code;
 * runtime thì dùng `scripts/utils/ui/safe_target.js` (resolve đúng-1, click có nghiệm thu).
 *
 * Phạm vi mặc định: `tests/**` (suite dùng chung — PHẢI sạch, --enforce sẽ chặn).
 *   `--include-tasks` quét thêm automation task-scoped dưới `outputs/<proj>/tasks/<task>/automation/`
 *   (nợ cũ — mặc định chỉ BÁO CÁO, không chặn).
 *
 * Bỏ qua có kiểm soát: thêm `// locator-lint-disable-next-line <lý do>` NGAY TRÊN dòng vi phạm
 * (bắt buộc có lý do — không lý do thì vẫn tính vi phạm).
 *
 * Dùng:
 *   npm run lint:locator                 # quét tests/, report
 *   npm run lint:locator -- --enforce    # P0 → exit 1 (dùng ở CI/pre-push)
 *   npm run lint:locator -- --include-tasks [--top 15]
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);
const ENFORCE = flag('enforce');
const INCLUDE_TASKS = flag('include-tasks');
const TOP = parseInt(arg('top', '12'), 10) || 12;
const REPO = rc.REPO_ROOT;

// severity P0 = gần như chắc chắn dẫn tới thao tác/đọc sai đối tượng.
const RULES = [
  { id: 'coord-click', sev: 'P0', re: /\b(?:mouse|page\.mouse)\.click\s*\(\s*[\w.[\]]+\s*,/,
    why: 'Click theo TOẠ ĐỘ: lệch ngay khi scroll/animation/đổi viewport, và không hề biết đã bấm trúng gì.',
    fix: 'Định vị bằng locator có nghĩa trong scope đã neo; nếu buộc phải dùng phần tử lạ thì `safe_target.one()` rồi `.click()`.' },
  { id: 'force-click', sev: 'P0', re: /force\s*:\s*true/, not: /rmSync|rmdirSync|unlinkSync|mkdirSync|cpSync|copyFileSync|renameSync|writeFileSync|createWriteStream|fs\s*\.\s*\w+|recursive\s*:/,
    why: 'force:true BỎ QUA actionability (bị che, disabled, ngoài màn) → bấm xuyên overlay, trúng thứ khác.',
    fix: 'Bỏ force; chờ điều kiện thật (`waitFor`, `toBeEnabled`). Nếu bắt buộc: giữ force NHƯNG assert danh tính element trước + nghiệm thu kết quả sau.' },
  { id: 'body-regex', sev: 'P0', re: /body\.innerText[\s\S]{0,40}?\.match\s*\(|innerText\s*\.\s*match\s*\(/,
    why: 'Đọc giá trị bằng regex trên TEXT TOÀN TRANG: dễ vớ nhầm số/nhãn của section khác → oracle sai → "bug" sai.',
    fix: '`safe_target.readValue(scope, label)` — neo theo section/label rồi mới đọc.' },
  { id: 'dom-scan-all', sev: 'P0', re: /querySelectorAll\s*\(\s*['"`]\*['"`]\s*\)/,
    why: 'Quét TOÀN BỘ DOM rồi lọc bằng text → chọn trúng phần tử cha/hàng xóm là chuyện thường.',
    fix: 'Neo scope (section/card/row/dialog) rồi query bên trong; ưu tiên `getByRole` + accessible name.' },
  { id: 'page-first', sev: 'P0', re: /\bpage\s*\.\s*(?:locator|getBy\w+)\s*\([^;]*?\)\s*\.\s*first\s*\(\s*\)/,
    why: '`.first()` ở cấp TRANG = "có nhiều match thì chọn đại cái đầu" — đúng cái cơ chế bắt nhầm element.',
    fix: 'Thu hẹp scope trước (`section.getByRole(...)`), hoặc `safe_target.one()` để >1 match là LỖI thay vì chọn bừa.' },
  { id: 'page-nth', sev: 'P1', re: /\bpage\s*\.\s*(?:locator|getBy\w+)\s*\([^;]*?\)\s*\.\s*nth\s*\(/,
    why: '`.nth(i)` phụ thuộc THỨ TỰ DOM — đổi layout/thêm control là trúng phần tử khác.',
    fix: 'Neo theo nội dung/nhãn của chính hàng-mục đó thay vì chỉ số.' },
  { id: 'first-button-in-row', sev: 'P1', re: /querySelector\s*\(\s*['"`]button['"`]\s*\)/,
    why: 'Lấy BUTTON ĐẦU TIÊN trong khối: hàng thường có nhiều nút (sửa/xoá/menu) → trúng nhầm.',
    fix: 'Chọn theo accessible name/aria-label của đúng nút cần bấm.' },
  { id: 'blind-wait', sev: 'P1', re: /waitForTimeout\s*\(\s*([5-9]\d{3}|\d{5,})\s*\)/,
    why: 'Hard wait dài thường dùng để CHE locator/điều kiện sai, làm lỗi thật khó lộ.',
    fix: 'Chờ điều kiện cụ thể (element/response/state) thay vì ngủ.' },
];

function listFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.git|test-results|playwright-report/.test(e.name)) listFiles(p, out); }
    else if (/\.(js|ts|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

// Phân lớp theo `.agent/config/kit-layers.md`: kit GENERIC phải sạch; lớp PROJECT là nội dung của
// chủ dự án (spec nghiệp vụ, helper login theo app) — báo cáo riêng, không chặn khi làm việc generic.
const GENERIC_RE = /^tests\/(support\/setup|fe\/(infra|fixtures)|load)\//i;
const layerOf = (rel) => (GENERIC_RE.test(rel.replace(/\\/g, '/')) || /example/i.test(rel) ? 'generic' : 'project');

function targets() {
  const files = listFiles(path.join(REPO, 'tests')).map((f) => ({ f, scope: 'shared' }));
  if (INCLUDE_TASKS) {
    const outputs = path.join(REPO, 'outputs');
    if (fs.existsSync(outputs)) {
      for (const proj of fs.readdirSync(outputs)) {
        const tasksDir = path.join(outputs, proj, 'tasks');
        if (!fs.existsSync(tasksDir)) continue;
        for (const t of fs.readdirSync(tasksDir)) {
          listFiles(path.join(tasksDir, t, 'automation')).forEach((f) => files.push({ f, scope: 'task' }));
        }
      }
    }
  }
  return files;
}

const findings = [];
for (const { f, scope } of targets()) {
  let lines;
  try { lines = fs.readFileSync(f, 'utf8').split(/\r?\n/); } catch (e) { continue; }
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/locator-lint-disable-next-line\s+\S/.test(lines[i - 1] || '')) continue; // bỏ qua CÓ lý do
    for (const r of RULES) {
      if (r.not && r.not.test(line)) continue;            // ngữ cảnh loại trừ (Node fs dùng trùng tên option force)
      if (r.re.test(line)) {
        const rel = path.relative(REPO, f);
        findings.push({ file: rel, line: i + 1, scope, layer: layerOf(rel), rule: r, code: line.trim().slice(0, 90) });
      }
    }
  }
}

const byRule = new Map();
for (const x of findings) { const k = x.rule.id; byRule.set(k, (byRule.get(k) || 0) + 1); }
const p0 = findings.filter((x) => x.rule.sev === 'P0');
const p0Shared = p0.filter((x) => x.scope === 'shared');
const byFile = new Map();
for (const x of findings) byFile.set(x.file, (byFile.get(x.file) || 0) + 1);

console.log(`[locator-lint] quét ${new Set(findings.map((x) => x.file)).size}/${targets().length} file có vi phạm · ${findings.length} finding (P0 ${p0.length}, trong đó shared ${p0Shared.length})`);
if (!findings.length) { console.log('[locator-lint] ✓ Sạch — không thấy anti-pattern định vị.'); process.exit(0); }

const nGeneric = findings.filter((x) => x.layer === 'generic').length;
const nProject = findings.filter((x) => x.layer === 'project').length;
console.log(`[locator-lint] theo lớp (kit-layers.md): GENERIC ${nGeneric} · PROJECT ${nProject}`);

console.log('\n— Theo rule —');
for (const r of RULES) {
  const n = byRule.get(r.id) || 0;
  if (n) console.log(`  ${r.sev}  ${String(n).padStart(4)}  ${r.id}: ${r.why}\n           → ${r.fix}`);
}
console.log('\n— File nhiều nhất —');
[...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP).forEach(([f, n]) => console.log(`  ${String(n).padStart(4)}  ${f}`));

const sample = p0.slice(0, 5);
if (sample.length) {
  console.log('\n— Ví dụ P0 —');
  sample.forEach((x) => console.log(`  ${x.file}:${x.line} [${x.rule.id}]\n      ${x.code}`));
}
console.log('\nBỏ qua có kiểm soát: thêm `// locator-lint-disable-next-line <lý do>` ngay TRÊN dòng (bắt buộc ghi lý do).');
console.log('Runtime làm đúng: `scripts/utils/ui/safe_target.js` (one/section/clickVerified/readValue/assertScreen).');

// --- BASELINE: chặn vi phạm MỚI, không chặn nợ cũ ---------------------------------------------
// Codebase lớn thì bật lint kiểu "chặn tất" = không ai dùng được. Baseline chốt hiện trạng
// (đếm theo file+rule, KHÔNG theo số dòng để refactor không gây nhiễu) → PR sau chỉ đỏ khi
// PHÁT SINH THÊM. Nợ cũ vẫn hiện trong report để dọn dần.
const BASELINE_FILE = path.resolve(arg('baseline', path.join(REPO, '.agent', 'config', 'locator-lint-baseline.json')));
const sig = (x) => `${x.file}::${x.rule.id}`;
const ENFORCE_PROJECT = flag('enforce-project');
const current = {};
const layerBySig = {};
for (const x of findings) {
  if (x.rule.sev !== 'P0') continue;
  current[sig(x)] = (current[sig(x)] || 0) + 1;
  layerBySig[sig(x)] = x.layer;
}
// Mặc định chỉ CHẶN lớp GENERIC (kit) — lớp PROJECT là trách nhiệm chủ dự án; --enforce-project để chặn cả.
const inEnforceScope = (k) => (ENFORCE_PROJECT ? true : layerBySig[k] === 'generic');

if (flag('baseline-write')) {
  fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify({ note: 'Hiện trạng P0 lúc bật gate. Gate chỉ CHẶN khi phát sinh THÊM. Dọn nợ cũ thì chạy lại --baseline-write để hạ mốc.', generatedAt: new Date().toISOString().slice(0, 10), counts: current }, null, 2)}\n`, 'utf8');
  console.log(`\n[locator-lint] Đã ghi baseline: ${path.relative(REPO, BASELINE_FILE)} (${Object.keys(current).length} khoá file+rule).`);
  process.exit(0);
}

let base = {};
if (fs.existsSync(BASELINE_FILE)) { try { base = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).counts || {}; } catch (e) { base = {}; } }
const regressions = Object.entries(current)
  .map(([k, n]) => ({ k, n, was: base[k] || 0 }))
  .filter((x) => x.n > x.was)
  .filter((x) => inEnforceScope(x.k));

if (regressions.length) {
  console.log('\n— P0 PHÁT SINH THÊM so với baseline —');
  regressions.slice(0, 15).forEach((x) => console.log(`  ${x.k}  ${x.was} → ${x.n}`));
} else if (Object.keys(base).length) {
  console.log('\n✓ Không phát sinh P0 mới so với baseline (nợ cũ vẫn còn, dọn dần).');
}

if (ENFORCE && regressions.length) {
  console.error(`\n[locator-lint] CHẶN: ${regressions.length} khoá file+rule có P0 MỚI. Sửa theo gợi ý ở trên, hoặc dùng safe_target, hoặc \`// locator-lint-disable-next-line <lý do>\` nếu thực sự cần.`);
  process.exit(1);
}
if (ENFORCE && !Object.keys(base).length) {
  console.error('\n[locator-lint] CHƯA có baseline — chạy `npm run lint:locator -- --baseline-write` một lần để chốt hiện trạng, rồi --enforce mới có nghĩa.');
  process.exit(1);
}
process.exit(0);
