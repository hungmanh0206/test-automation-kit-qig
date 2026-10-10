#!/usr/bin/env node
'use strict';

/*
 * rerun_failed.js — chạy lại ĐÚNG case đỏ của lượt vừa rồi, bằng MỘT lệnh.
 *
 * VÌ SAO, và đây là số đo đáng chú ý nhất của đợt token-diet: trong 4 lượt chạy task thật
 * (CSDL-9001 đến 9004), `npx playwright test` được gọi **2.076 lần**. Trong đó:
 *
 *     chạy cả file hoặc cả suite : 2.070
 *     có `--grep`                :     6
 *     có `--last-failed`         :     0
 *
 * Tức rerun chọn lọc được dùng **0,3%**. Và `playwright test` là lệnh shell tốn nhiều lượt nhất,
 * 1.540 trong tổng 11.299 lượt — mà mỗi lượt là một message, và mỗi message kéo theo cả context
 * (~500k token, cache-hit 98,5%).
 *
 * `prompt_templates/phase2/04_execute_fe_playwright.md` ĐÃ dặn "rerun đúng case đỏ". Số đo nói lời dặn
 * đó không xảy ra. Nên nó cần một MÁY: một lệnh làm sẵn việc đọc kết quả, dựng `--grep`, rồi chạy.
 *
 * HAI CHỖ TỪ CHỐI, cố ý, vì im lặng ở đây dẫn tới kết luận sai:
 *   ① Không có case đỏ ⇒ KHÔNG chạy gì cả. Chạy lại cả suite "cho chắc" là đúng thứ máy này đi bỏ.
 *   ② Có case đỏ mà KHÔNG có TC ID trong tiêu đề ⇒ `--grep` sẽ bỏ sót nó. Máy TỪ CHỐI dựng grep một
 *      phần, vì agent chạy theo grep rồi thấy xanh sẽ kết luận đã xử lý hết — trong khi một case đỏ
 *      chưa từng được chạy lại.
 *
 * Dùng:
 *   npm run rerun:failed                 # đọc results.json của task đang khai, chạy lại case đỏ
 *   npm run rerun:failed -- --dry        # chỉ in lệnh, không chạy
 *   npm run rerun:failed -- --file <results.json>
 * Exit: 0 không có gì để chạy hoặc chạy xong xanh · mã thoát của playwright khi chạy · 2 dùng sai.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const sum = require(path.resolve(__dirname, 'summarize_results'));

const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };

/** Danh sách case đỏ của lượt gần nhất: `{ ids, khongId, tong }`. */
function caseDo(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const specs = (j.suites || []).reduce((a, s) => sum.phang(s, a), []);
  const ids = [];
  const khongId = [];
  for (const sp of specs) {
    for (const t of sp.tests || []) {
      const res = t.results || [];
      const cuoi = res[res.length - 1] || {};
      const st = String(t.status || cuoi.status || '');
      if (st === 'expected' || cuoi.status === 'passed' || st === 'skipped' || cuoi.status === 'skipped') continue;
      const id = sum.tcIdCua(sp.title);
      if (id) ids.push(id);
      else khongId.push({ title: String(sp.title || '').slice(0, 60), file: `${sp.file}:${sp.line}` });
    }
  }
  return { ids: [...new Set(ids)], khongId, tong: ids.length + khongId.length };
}

/* Dùng CHUNG `timFile` của summarize_results — hai bản chép tay thì sớm muộn tìm hai chỗ khác nhau,
 * và đó đúng là lỗi vừa phải vá: lượt task-scoped ghi vào `test-results/runs/<RUN_ID>/results.json`. */
const timFile = () => (arg('file', '') || sum.timFile());

function main() {
  const file = timFile();
  if (!file || !fs.existsSync(file)) {
    console.error('[rerun] không thấy results.json. Truyền --file, hoặc set TASK_KEY + PROJECT_OUTPUT_DIR.');
    console.error('  Chưa chạy lượt nào thì chưa có gì để chạy lại.');
    process.exit(2);
  }

  let r;
  try { r = caseDo(file); }
  catch (e) { console.error(`[rerun] results.json lỗi: ${e.message}`); process.exit(2); }

  /* ① Không có case đỏ ⇒ KHÔNG chạy gì. */
  if (!r.tong) {
    console.log('[rerun] lượt vừa rồi 0 case đỏ ⇒ KHÔNG chạy lại gì cả.');
    console.log('  Chạy lại cả suite "cho chắc" là đúng thứ lệnh này đi bỏ: đo trên 4 lượt task thật,');
    console.log('  2.070/2.076 lượt `playwright test` là chạy cả file hoặc cả suite.');
    process.exit(0);
  }

  /* ② Có case đỏ KHÔNG mang TC ID ⇒ grep sẽ bỏ sót. TỪ CHỐI dựng grep một phần. */
  if (r.khongId.length) {
    console.error(`[rerun] ✗ TỪ CHỐI dựng --grep: ${r.khongId.length}/${r.tong} case đỏ KHÔNG có TC ID trong tiêu đề.`);
    r.khongId.slice(0, 8).forEach((x) => console.error(`    ${x.title} · ${x.file}`));
    console.error('  Grep chỉ gồm case CÓ ID thì nó bỏ sót những case trên, và bạn sẽ thấy xanh rồi kết luận');
    console.error('  đã xử lý hết. Chạy theo FILE cho những case đó, hoặc đặt TC ID vào tiêu đề test.');
    process.exit(2);
  }

  const grep = r.ids.join('|');
  const argv = ['playwright', 'test', '--grep', grep];
  console.log(`[rerun] ${r.ids.length} case đỏ: ${r.ids.slice(0, 8).join(', ')}${r.ids.length > 8 ? ' …' : ''}`);
  console.log(`[rerun] npx ${argv.join(' ')}`);

  if (flag('dry')) { console.log('[rerun] (--dry: chỉ in lệnh, không chạy)'); process.exit(0); }

  const res = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', argv, { stdio: 'inherit', cwd: rc.REPO_ROOT });
  process.exit(res.status == null ? 1 : res.status);
}

module.exports = { caseDo };

if (require.main === module) main();
