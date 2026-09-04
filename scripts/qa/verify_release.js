#!/usr/bin/env node
'use strict';

/*
 * verify_release.js — CHỨNG MINH bản phát hành chạy được từ con số 0. Đây là thước đo chính của cả luồng CD,
 * không phải bước tạo Release.
 *
 * VÌ SAO. Mọi gate khác chạy TRONG repo: có `.git`, có `node_modules`, có lớp PROJECT. Người nhận kit thì
 * không có gì trong số đó. Khoảng cách ấy đã sinh lỗi thật: `ci_scope_check.js` và `secret_scan.js` từng
 * crash vì gọi `git ls-files` vô điều kiện, và chỉ lộ ra khi giải nén vào thư mục sạch rồi `npm ci`. Script
 * này biến "đúng trải nghiệm người nhận" thành một phép kiểm chạy được.
 *
 * MỘT KỲ VỌNG BỊ ĐẢO SO VỚI ĐỀ BÀI, và đây là chỗ đáng đọc kỹ: `preflight` PHẢI **CHẶN** ở gói sạch, không
 * phải chỉ cảnh báo. Gói không mang `.agent/config/project_context.md` (lớp PROJECT), mà preflight khai file
 * đó là `require`. Chặn ở đó là **đúng**: kit vừa giải nén thì phải dừng cho tới khi dự án khai context của
 * họ. Nên phép kiểm ở đây là "chặn ĐÚNG LÝ DO và có chỉ đường", chứ không phải "phải xanh".
 *
 * Dùng: node scripts/qa/verify_release.js [--pkg dist/kit-2.0.0.tar.gz] [--keep]
 * Exit: 0 mọi bước đạt · 1 có bước fail (KHÔNG phát hành) · 2 dùng sai.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : '';
}
const KEEP = process.argv.includes('--keep');

/**
 * Env cho tiến trình con: GỠ biến task-scoped của shell.
 * Cùng bài học với `tests/fe/infra/_gate_env.ts`: để lọt `RUN_ID`/`TASK_KEY` thì phép kiểm đo môi trường chứ
 * không đo gói — xanh ở máy dev, đỏ ở CI (đã dính, ci-regression đỏ 5 lượt).
 */
function cleanEnv(extra = {}) {
  const e = { ...process.env };
  for (const k of ['RUN_ID', 'TASK_KEY', 'PROJECT_OUTPUT_DIR', 'TASK_ENV', 'ALLOW_EMPTY', 'QA_APPROVED', 'TESTCASE_SOURCE']) delete e[k];
  return { ...e, ...extra };
}

const steps = [];
function record(name, ok, detail) {
  steps.push({ name, ok, detail: detail || '' });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...opts, env: cleanEnv(opts.env || {}) });
  return { code: r.status === null ? 1 : r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

function main() {
  let pkg = arg('pkg');
  if (!pkg) {
    let version;
    try { version = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).version; } catch (e) { version = ''; }
    pkg = path.join(REPO, 'dist', `kit-${version}.tar.gz`);
  } else if (!path.isAbsolute(pkg)) pkg = path.join(REPO, pkg);

  if (!fs.existsSync(pkg)) {
    console.error(`[verify] không thấy gói: ${pkg} — chạy \`npm run package:kit\` trước.`);
    process.exit(2);
  }

  /*
   * Thư mục tạm phải NGOÀI repo: nằm trong repo thì nó thừa hưởng `.git` của repo cha (git đi ngược lên tìm),
   * và ta sẽ kiểm nhầm — đúng cái phép đo này tồn tại để loại.
   */
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kitverify-'));
  console.log(`[verify] gói: ${path.relative(REPO, pkg).split(path.sep).join('/')}`);
  console.log(`[verify] thư mục sạch: ${work}\n`);

  let root = work;
  try {
    // 1) Giải nén
    execFileSync('tar', ['-xzf', path.basename(pkg), '-C', work], { cwd: path.dirname(pkg), stdio: ['ignore', 'pipe', 'pipe'] });
    const entries = fs.readdirSync(work);
    root = entries.length === 1 ? path.join(work, entries[0]) : work;
    const nFiles = execFileSync(process.execPath, ['-e',
      'const fs=require("fs"),p=require("path");let n=0;(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const q=p.join(d,e.name);e.isDirectory()?w(q):n++}})(process.argv[1]);console.log(n)',
      root], { encoding: 'utf8' }).trim();
    record('giải nén', true, `${nFiles} file`);

    // Điều kiện tiên quyết của cả phép đo: KHÔNG có `.git`.
    const hasGit = fs.existsSync(path.join(root, '.git'));
    record('không có .git (đúng trải nghiệm người nhận)', !hasGit, hasGit ? 'gói lại chứa .git' : '');

    // 2) npm ci
    const ci = run('npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund'], { cwd: root, shell: process.platform === 'win32' });
    record('npm ci', ci.code === 0, ci.code === 0 ? '' : ci.out.split('\n').slice(-4).join(' | ').slice(0, 200));
    if (ci.code !== 0) throw new Error('npm ci fail — dừng, các bước sau vô nghĩa');

    // 3) Gate không cần git
    for (const s of ['lint', 'typecheck', 'json:check', 'gate:policy', 'skills:index']) {
      const r = run('npm', ['run', '--silent', s], { cwd: root, shell: process.platform === 'win32' });
      record(`npm run ${s}`, r.code === 0, r.code === 0 ? '' : r.out.split('\n').slice(-3).join(' | ').slice(0, 200));
    }

    // 4+5) Hai script từng crash khi KHÔNG có `.git` — đây là hồi quy có tên
    for (const s of ['secret:scan', 'ci:scope']) {
      const r = run('npm', ['run', '--silent', s], { cwd: root, shell: process.platform === 'win32' });
      record(`npm run ${s} (không .git)`, r.code === 0, r.code === 0 ? '' : r.out.split('\n').slice(-3).join(' | ').slice(0, 200));
    }

    // 6) preflight PHẢI CHẶN, và phải chỉ đường tạo file từ bản mẫu
    const pf = run('npm', ['run', '--silent', 'preflight'], { cwd: root, shell: process.platform === 'win32' });
    const blockedRight = pf.code !== 0 && /project_context\.md/.test(pf.out) && /bản mẫu|\.example/.test(pf.out);
    record('preflight CHẶN đúng lý do + chỉ đường bản mẫu', blockedRight,
      blockedRight ? 'thiếu project_context.md, gate in lệnh cp' : `code=${pf.code}; ${pf.out.split('\n').slice(-3).join(' | ').slice(0, 180)}`);

    // 7) Playwright phải THẤY suite infra (0 test = gói hụt spec hoặc config vỡ)
    const pw = run('npx', ['playwright', 'test', '--list'],
      { cwd: root, shell: process.platform === 'win32', env: { PROJECT_OUTPUT_DIR: 'outputs/_v', TASK_KEY: 'V-0' } });
    const m = pw.out.match(/Total:\s*(\d+)\s*tests?/);
    const total = m ? Number(m[1]) : 0;
    /*
     * 0 test KHÔNG chỉ nghĩa "gói hụt spec": nó cũng xảy ra khi MỘT spec vỡ lúc collect (vd require một
     * file config không được đóng gói) — Playwright bỏ cả suite. Nên in luôn đuôi output, không thì lần sau
     * lại phải đi đoán.
     */
    const pwErr = pw.out.split(/\r?\n/).filter((l) => /Error|error|Cannot find/.test(l)).slice(0, 2).join(' | ');
    record('playwright --list thấy suite', total > 0,
      total > 0 ? `${total} test` : `0 test — ${pwErr.slice(0, 220)}`);

    // 8) version:check phải chạy được từ gói (không git, không tag)
    const vc = run('npm', ['run', '--silent', 'version:check'], { cwd: root, shell: process.platform === 'win32' });
    record('version:check (không .git)', vc.code === 0, vc.code === 0 ? '' : vc.out.split('\n').slice(-3).join(' | ').slice(0, 180));
  } catch (e) {
    record('lỗi giữa chừng', false, e.message);
  } finally {
    if (KEEP) console.log(`\n[verify] giữ thư mục: ${work}`);
    else fs.rmSync(work, { recursive: true, force: true });
  }

  const failed = steps.filter((s) => !s.ok);
  console.log(`\n[verify] ${steps.length - failed.length}/${steps.length} bước đạt`);
  if (!failed.length) { console.log('[verify] ✓ BẢN PHÁT HÀNH CHẠY ĐƯỢC TỪ CON SỐ 0'); process.exit(0); }
  console.log('[verify] ✗ KHÔNG PHÁT HÀNH — bước fail:');
  failed.forEach((s) => console.log(`  - ${s.name}${s.detail ? `: ${s.detail}` : ''}`));
  process.exit(1);
}

if (require.main === module) main();
