#!/usr/bin/env node
'use strict';

/*
 * typecheck_task.js — chạy `tsc --noEmit` trên automation CỦA MỘT TASK.
 *
 * VÌ SAO CẦN. `tsconfig.json` của kit khai `include: ["tests/**\/*.ts"]` và `exclude: ["outputs"]`,
 * nên `npm run typecheck` CHƯA BAO GIỜ soi `outputs/**\/automation/**`. Mọi câu "typecheck sạch" nói
 * về spec của task đều rỗng — công cụ không nhìn vào đó.
 *
 * Giá phải trả, đo 09/10/2026 trên CSDL-9001: hai thuộc tính KHÔNG TỒN TẠI (`ScreenField.hidden` và
 * `ScreenField.value`) được dùng ở 17 chỗ. `undefined !== true` luôn đúng nên phép kiểm "ô có hiện
 * không" thực chất chỉ kiểm "ô có trong DOM không" ⇒ TC_148 báo PASS giả; `f.value` luôn `undefined`
 * nên mọi phép đọc giá trị gốc ra rỗng ⇒ TC_055 chấm FAIL oan. TypeScript bắt được CẢ 17 ngay khi
 * được chỉ đúng file.
 *
 * VÌ SAO THEO TASK, KHÔNG BẬT TOÀN CỤC. Thêm `outputs` vào `tsconfig.json` chung thì một task đang
 * sửa dở làm CHẶN mọi task khác — đúng thứ luật isolation §5 cấm. Đo cùng ngày: CSDL-9001 sạch 0 lỗi
 * trong khi CSDL-9004 còn 17 lỗi ở file phiên khác đang viết. Mỗi task tự gác phần của mình.
 *
 * Dùng:
 *   node scripts/qa/typecheck_task.js --task <TASK_KEY>              # báo cáo, luôn exit 0
 *   node scripts/qa/typecheck_task.js --task <TASK_KEY> --enforce    # exit 1 nếu còn lỗi
 *
 * Exit: 0 = sạch (hoặc không --enforce) · 1 = còn lỗi (chỉ khi --enforce) · 2 = không chạy được.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rc = require('../utils/runtime_config');

const REPO = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const flag = (t) => argv.includes(`--${t}`);
const val = (t, md) => {
  const i = argv.indexOf(`--${t}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : md;
};
const ENFORCE = flag('enforce');

/* Cờ tsc phải TỰ MANG, không dựa `tsconfig.json`: file đó cố ý loại `outputs`, nên nạp nó vào là
 * quay lại đúng chỗ không soi gì. `--ignoreConfig` để tsc không tự tìm lên cây thư mục. */
const CO = [
  '--noEmit', '--ignoreConfig', '--skipLibCheck',
  '--target', 'ES2022', '--module', 'esnext', '--moduleResolution', 'bundler',
  '--esModuleInterop', '--types', 'node',
  // `--lib` phải có DOM: spec chạy code trong trình duyệt qua `page.evaluate`.
  '--lib', 'ES2022,DOM',
];

(async () => {
  let taskKey; let taskDir;
  try {
    rc.loadEnvFiles();
    taskKey = val('task', process.env.TASK_KEY) || rc.getTaskKey();
    taskDir = rc.getTaskOutputDir({ taskKey });
  } catch (e) {
    console.error(`[typecheck-task] INFRA: ${e.message}`);
    process.exit(2);
  }

  const auto = path.join(taskDir, 'automation');
  if (!fs.existsSync(auto)) {
    console.log(`[typecheck-task] BỎ QUA · task ${taskKey} không có thư mục automation/`);
    process.exit(0);
  }

  /* Gom .ts ở automation/ và automation/lib/. KHÔNG đệ quy sâu hơn: thư mục con khác (outputs/,
   * test-results/) có thể chứa file sinh ra, soi chúng là báo lỗi về thứ không ai viết tay. */
  const ds = [];
  for (const d of [auto, path.join(auto, 'lib')]) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) if (f.endsWith('.ts')) ds.push(path.join(d, f));
  }
  if (!ds.length) {
    console.log(`[typecheck-task] BỎ QUA · task ${taskKey} không có file .ts nào trong automation/`);
    process.exit(0);
  }

  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const r = spawnSync(npx, ['tsc', ...CO, ...ds], {
    cwd: REPO, encoding: 'utf8', shell: process.platform === 'win32',
  });
  if (r.error) { console.error(`[typecheck-task] INFRA: không chạy được tsc — ${r.error.message}`); process.exit(2); }

  const dong = `${r.stdout || ''}${r.stderr || ''}`.split(/\r?\n/).filter((l) => /error TS/.test(l));
  console.log(`[typecheck-task] task ${taskKey} · ${ds.length} file .ts · ${dong.length} lỗi`);
  if (!dong.length) { console.log('[typecheck-task] ✅ sạch'); process.exit(0); }

  /* Gom theo file để người đọc thấy ngay chỗ nào hỏng nặng, thay vì một danh sách dài phẳng. */
  const theoFile = new Map();
  for (const l of dong) {
    const m = l.match(/^(.+?)\(\d+,\d+\)/);
    const f = m ? m[1].replace(/\\/g, '/').replace(/^.*automation\//, '') : '(?)';
    if (!theoFile.has(f)) theoFile.set(f, []);
    theoFile.get(f).push(l.replace(/^.*?error /, 'error '));
  }
  for (const [f, ls] of [...theoFile].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n  ${f} — ${ls.length} lỗi`);
    ls.slice(0, 6).forEach((l) => console.log(`     ${l}`));
    if (ls.length > 6) console.log(`     … +${ls.length - 6} nữa`);
  }

  if (ENFORCE) { console.error(`\n[typecheck-task] CHẶN — ${dong.length} lỗi kiểu trong automation của ${taskKey}.`); process.exit(1); }
  console.log(`\n[typecheck-task] (không --enforce nên exit 0 dù còn ${dong.length} lỗi)`);
  process.exit(0);
})().catch((e) => { console.error(`[typecheck-task] INFRA: ${e.message}`); process.exit(2); });
