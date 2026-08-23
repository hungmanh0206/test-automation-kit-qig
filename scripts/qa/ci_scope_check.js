#!/usr/bin/env node
'use strict';

/*
 * ci_scope_check.js — MÁY ĐỨNG SAU LUẬT "CI generic KHÔNG tự chạm UAT".
 *
 * VÌ SAO CÓ FILE NÀY (đo được, không phải giả định): commit `6773d1e` quét 46 spec
 * `tests/mobile-web/SAPP-22827/**` + 8 spec DB vào repo. Job nightly chạy `npx playwright test` TRẦN —
 * cả suite — với `OPS_USERNAME`/`OPS_PASSWORD` sẵn trong env job. Nghĩa là từ commit đó, mỗi 01:00 giờ
 * VN CI sẽ drive `student_delete*` · `calendar_destructive` · `calendar_create` trên OPS UAT. Chưa nổ
 * chỉ vì repo chưa khai secret nào — đó là MAY, không phải thiết kế.
 *
 * CLAUDE.md §2 ("UAT non-destructive + xác nhận trước MỖI lượt chạm UAT") và §5 (scope & isolation) đã
 * cấm rõ chuyện này từ lâu. Tôi vẫn vi phạm được, vì KHÔNG có máy nào đứng sau hai luật đó. `.gitignore`
 * không thay được: nó chỉ chặn đúng đường dẫn đã biết, `tests/fe/SAPP-99999/` ngày mai vẫn lọt.
 *
 * Ba điều gate này kiểm:
 *   1. Spec trong thư mục theo task (`SAPP-<số>`) mà ĐANG ĐƯỢC TRACK ⇒ ĐỎ (nợ đã khai thì cảnh báo).
 *   2. Spec drive UAT mà nằm trong phạm vi `nightly` ⇒ ĐỎ.
 *   3. File CI phải lấy phạm vi TỪ config này, và KHÔNG được còn `playwright test` trần ⇒ nếu không thì
 *      config chỉ là trang trí, CI vẫn chạy cả suite.
 *
 * Dùng:
 *   npm run ci:scope                  # kiểm (dùng trong static-check của cả 2 CI)
 *   npm run -s ci:scope -- --print-nightly   # in phạm vi cho CI dùng, 1 nguồn duy nhất
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const CFG_PATH = path.join(REPO, '.agent', 'config', 'ci_scope.json');
const TASK_DIR = /(^|\/)[A-Z]{2,}-\d+(\/|$)/;          // tests/fe/SAPP-26523/... · tests/mobile-web/SAPP-22827/...
const CI_FILES = ['.github/workflows/ci.yml', '.gitlab-ci.yml'];

const cfg = () => JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));

/** Spec ĐANG ĐƯỢC TRACK (không phải trên đĩa): thứ CI nhìn thấy sau checkout. */
function trackedSpecs() {
  const out = execFileSync('git', ['ls-files', '-z', 'tests/**/*.spec.ts', 'tests/**/*.spec.js'], { cwd: REPO, encoding: 'utf8' });
  return out.split('\0').filter(Boolean).map((p) => p.replace(/\\/g, '/'));
}

const inScope = (file, roots) => roots.some((r) => file === r || file.startsWith(`${r.replace(/\/+$/, '')}/`));

/*
 * Spec có cần app sống/creds không. ĐO bằng IMPORT + `process.env.X`, KHÔNG grep chữ tự do: bản đầu tôi
 * lấy `page.goto`/`storageState` làm dấu hiệu thì `infra/screen-snapshot` (goto file fixture) và
 * `infra/auth-session-lock` (chỉ nhắc tên hàm trong assert) bị gắn cờ OAN — gate báo oan là gate bị tắt.
 * Cách đo hiện tại (đo ngày 23/08/2026): bắt 8/8 spec drive UAT, gắn cờ 0/29 spec infra.
 */
function uatSignalsIn(file, cfgObj) {
  let body = '';
  try { body = fs.readFileSync(path.join(REPO, file), 'utf8'); } catch (e) { return []; }
  const hits = [];
  const imports = [...body.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  for (const pat of cfgObj.uatImports || []) if (imports.some((i) => i.includes(pat))) hits.push(`import ${pat}`);
  const envs = [...new Set([...body.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]))];
  for (const p of cfgObj.uatEnvPrefixes || []) for (const e of envs) if (e.startsWith(p)) hits.push(`env ${e}`);
  return [...new Set(hits)];
}

function check() {
  const c = cfg();
  const problems = [];
  const warnings = [];
  const specs = trackedSpecs();

  if (!specs.length) {
    problems.push('0 spec được track ⇒ phép đo hỏng (sai cwd? không có git?), KHÔNG phải "sạch".');
    return { problems, warnings, specs };
  }

  // ① spec theo task không được track
  const debt = new Set(c.taskSpecDebt || []);
  for (const f of specs.filter((f) => TASK_DIR.test(f))) {
    if (inScope(f, c.allowedTaskSpecDirs || [])) continue;
    const msg = `spec THEO TASK đang được track: ${f}`;
    if (debt.has(f)) warnings.push(`${msg} — đã khai ở \`taskSpecDebt\`; suite chung vẫn nhìn thấy nó, nên bỏ track (\`git rm --cached\`) khi task đóng.`);
    else problems.push(`${msg} ⇒ suite chung sẽ chạy nó. Test theo task ở lại máy người chạy task: \`git rm --cached <file>\` (file vẫn còn trên đĩa) + thêm luật vào \`.gitignore\`.`);
  }

  // ② phạm vi nightly không được chứa spec drive UAT
  const roots = c.nightly || [];
  if (!roots.length) problems.push('`nightly` rỗng trong `.agent/config/ci_scope.json` ⇒ CI không biết chạy gì.');
  /*
   * MIỄN TRỪ HẸP: test của chính gate này chứa fixture `import opsLogin` / `process.env.OPS_USERNAME`
   * DƯỚI DẠNG CHUỖI để kiểm gate có bắt không ⇒ gate tự gắn cờ chính nó. Đúng khuôn `SELF` trong
   * `policy_source_check.js`. Có test khoá số lượng: thêm file thứ 2 vào danh sách = ĐỎ, để miễn trừ
   * không lặng lẽ phình thành cửa hậu.
   */
  const exempt = new Set(c.selfTestExempt || []);
  if (exempt.size > 1) problems.push(`\`selfTestExempt\` có ${exempt.size} file — miễn trừ phải HẸP (đúng test của chính gate). Nhiều hơn 1 là cửa hậu: spec drive UAT chỉ cần khai vào đây là lọt.`);
  for (const f of specs.filter((f) => inScope(f, roots) && !exempt.has(f))) {
    const hits = uatSignalsIn(f, c);
    if (hits.length) problems.push(`${f} nằm trong phạm vi nightly nhưng drive UAT (dấu hiệu: ${hits.join(', ')}) ⇒ CI generic sẽ tự chạm UAT mà không ai xác nhận. Bỏ khỏi \`nightly\`, hoặc bỏ phụ thuộc app khỏi spec.`);
  }
  for (const r of roots) if (!specs.some((f) => inScope(f, [r]))) problems.push(`phạm vi nightly \`${r}\` KHÔNG có spec nào được track ⇒ nightly sẽ xanh mà chẳng chạy gì (false-green).`);

  /*
   * ③ `.only` lọt vào spec được track = FALSE-GREEN nặng nhất còn sống trong kit. Đo 23/08/2026: cắm 1
   * `test.only` vào `tests/fe/infra/assertions.spec.ts` ⇒ `test_inventory_gate` báo **HAS_TESTS · 535
   * test** (vì `--list` vẫn liệt kê hết) nhưng run thật chạy **1 test** và in "1 passed". Mọi gate khác
   * nhìn đâu cũng xanh trong khi 534 test không chạy.
   * `forbidOnly: CI` trong `playwright.config.js` chặn ở CI. Gate này chặn SỚM HƠN — lúc push, trước khi
   * đốt runner. Ghép chuỗi để chính file này không tự khớp.
   */
  const ONLY_RE = new RegExp(`\\b(test|describe|it)\\s*\\.\\s*${'only'}\\s*\\(`);
  for (const f of specs) {
    if (exempt.has(f)) continue;
    let body = '';
    try { body = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { continue; }
    if (ONLY_RE.test(body)) problems.push(`${f} có \`.only\` ⇒ run sẽ chạy ĐÚNG spec đó rồi báo xanh, trong khi ${specs.length - 1} spec còn lại không chạy (inventory gate vẫn đếm đủ nên không bắt được). Bỏ \`.only\` trước khi push.`);
  }

  // ④ CI phải lấy phạm vi từ config, không được còn `playwright test` trần
  for (const rel of CI_FILES) {
    const p = path.join(REPO, rel);
    if (!fs.existsSync(p)) continue;
    const body = fs.readFileSync(p, 'utf8');
    const lines = body.split(/\r?\n/);
    // Lệnh "có phạm vi" = dòng nhắc tới 1 trong 3 cách truyền scope. Đừng để nhánh rỗng lọt vào regex
    // này (`a||b`): nó khớp MỌI dòng ⇒ gate im lặng mất răng. Có test âm-tính khoá đúng chuyện đó.
    const SCOPED = /ci:scope|\$SCOPE|steps\.scope\.outputs/;
    const bare = lines.filter((l) => /playwright test/.test(l) && !SCOPED.test(l) && !/^\s*#/.test(l) && !/--list/.test(l));
    if (!body.includes('ci:scope')) problems.push(`${rel} KHÔNG lấy phạm vi từ \`ci_scope.json\` (thiếu \`npm run -s ci:scope -- --print-nightly\`) ⇒ config này chỉ là trang trí.`);
    for (const l of bare) problems.push(`${rel}: còn lệnh chạy CẢ suite — \`${l.trim().slice(0, 90)}\` ⇒ mọi spec được track đều bị chạy, kể cả spec drive UAT.`);
  }

  return { problems, warnings, specs };
}

function main() {
  if (process.argv.includes('--print-nightly')) { process.stdout.write((cfg().nightly || []).join(' ')); return; }

  const { problems, warnings, specs } = check();
  for (const w of warnings) console.log(`[ci-scope] ⚠ ${w}`);
  if (problems.length) {
    console.error(`[ci-scope] ✗ ${problems.length} vi phạm phạm vi CI:`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error('[ci-scope]   Luật: CLAUDE.md §2 (UAT non-destructive, xác nhận trước MỖI lượt) + §5 (scope & isolation).');
    process.exit(1);
  }
  console.log(`[ci-scope] ✓ ${specs.length} spec được track · nightly = ${(cfg().nightly || []).join(' ')} · không spec nào trong phạm vi đó chạm UAT${warnings.length ? ` · ${warnings.length} nợ đã khai` : ''}.`);
}

if (require.main === module) main();
module.exports = { check, trackedSpecs };
