#!/usr/bin/env node
'use strict';

/*
 * phase_check.js — BÓ các gate của một phase vào MỘT lượt gọi.
 *
 * VÌ SAO, VÀ TRẦN CỦA NÓ Ở ĐÂU — nói trước để không ai tưởng đây là đòn bẩy chính.
 *
 * Đo 10/10/2026 trên 5 phiên chạy task thật (`npm run token:audit -- --mau`): 11.781 lượt shell, trong
 * đó TOÀN BỘ lệnh của kit cộng lại chỉ **248 lượt, tức 2,1%**. Chỗ thật sự tốn là thăm dò tay:
 * `node -e` 1.442 · `grep` 1.190 · `for`/`until` 948 · `sed` 825 · `python` 662. Nên bó gate lại KHÔNG
 * phải cách giảm token lớn nhất, và file này không được bán như vậy.
 *
 * Nó vẫn đáng làm vì hai lý do khác:
 *   · Cuối mỗi phase có 4 đến 5 lệnh luôn đi cùng nhau. Mỗi lệnh là một message kèm cả context
 *     (~510k token), nên gộp 5 còn 1 là bớt 4 message ở đúng chỗ ai cũng chạy.
 *   · Chạy rời thì rất dễ chạy thiếu một cái rồi tưởng đã kiểm hết. Bó lại thì "đã kiểm những gì"
 *     là một danh sách in ra, không phải trí nhớ.
 *
 * NGUYÊN TẮC THIẾT KẾ, và là điều kiện để nó không thành một gate thứ hai nói khác gate thật:
 *
 *   FILE NÀY KHÔNG TỰ KIỂM GÌ CẢ. Nó spawn ĐÚNG những script kia rồi gom kết quả. Mọi luật, mọi
 *   ngưỡng, mọi thông báo đều của script gốc. Nhờ vậy "chạy bó" và "chạy rời" cho cùng exit code và
 *   cùng tập vi phạm theo CẤU TRÚC, không phải nhờ ai đó nhớ đồng bộ hai nơi.
 *
 * Dùng:
 *   node scripts/qa/phase_check.js --phase 2 --task <TASK_KEY>
 *   ... --full      # in nguyên output của từng bước thay vì bản gọn
 *   ... --list      # chỉ in sẽ chạy những gì rồi thoát (không chạy)
 * Exit: 0 mọi bước ĐẠT · 1 có bước CHẶN · 2 dùng sai.
 */

const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};

/*
 * BƯỚC = đúng một lệnh có thật trong kit. `chan: false` nghĩa là bước BÁO CÁO: nó in thông tin,
 * không phán đúng sai, nên exit code của nó không được làm đỏ cả bó.
 */
const BUOC = {
  1: [
    { ten: 'preflight (phase1)', cmd: ['scripts/qa/preflight_gate.js', '--mode', 'phase1'], task: '--task', chan: true },
    { ten: 'scope:anchor', cmd: ['scripts/qa/scope_anchor.js', '--enforce'], task: '--task', chan: true },
    { ten: 'dim:coverage', cmd: ['scripts/qa/dimension_coverage.js', '--enforce'], task: '--task', chan: true },
    { ten: 'self-review', cmd: ['scripts/qa/self_review.js', '--enforce'], task: '--task', chan: true },
  ],
  2: [
    { ten: 'preflight (phase2)', cmd: ['scripts/qa/preflight_gate.js', '--mode', 'phase2'], task: '--task', chan: true },
    { ten: 'gate:output', cmd: ['scripts/qa/output_gate.js', '--mode', 'test-execution', '--compact'], task: null, chan: true },
    { ten: 'ledger:check', cmd: ['scripts/qa/result_ledger.js', '--enforce'], task: '--task', chan: true },
    { ten: 'self-review', cmd: ['scripts/qa/self_review.js', '--enforce'], task: '--task', chan: true },
    { ten: 'results:summary', cmd: ['scripts/qa/summarize_results.js'], task: null, chan: false },
    /*
     * `run:analysis` CHẶN (v2.5.0 G1.2): tỉ lệ BLOCKED vượt dải trên thì lượt đó không đủ mẫu số để kết
     * luận chất lượng. Không phải "lượt chạy sai" — là "chưa đủ để phán", nên nó phải đứng ở bó gate
     * CUỐI PHASE, nơi người ta sắp viết báo cáo. Đo được là 4/11 lượt thật của repo vượt 20%.
     */
    { ten: 'run:analysis', cmd: ['scripts/qa/run_analysis.js', '--enforce'], task: null, chan: true },
  ],
};

function chay(b, task) {
  const argv = [path.join(REPO, b.cmd[0]), ...b.cmd.slice(1)];
  if (b.task && task) argv.push(b.task, task);
  const r = spawnSync(process.execPath, argv, { cwd: REPO, encoding: 'utf8' });
  return { code: r.status == null ? 1 : r.status, out: `${r.stdout || ''}${r.stderr || ''}`.trimEnd() };
}

function main() {
  const phase = String(arg('phase', '2'));
  const task = arg('task', process.env.TASK_KEY || '');
  const ds = BUOC[phase];

  if (!ds) {
    console.error(`[phase-check] --phase "${phase}" lạ. Chỉ có 1 hoặc 2.`);
    process.exit(2);
  }
  if (!task) {
    console.error('[phase-check] thiếu --task <TASK_KEY> (hoặc biến môi trường TASK_KEY).');
    console.error('  Không có task thì mỗi gate đọc một chỗ khác nhau, và kết quả không nói về task nào cả.');
    process.exit(2);
  }

  if (flag('list')) {
    console.log(`[phase-check] phase ${phase} — ${ds.length} bước:`);
    for (const b of ds) console.log(`  ${b.chan ? 'CHẶN  ' : 'báo cáo'} ${b.ten.padEnd(20)} node ${b.cmd.join(' ')}`);
    process.exit(0);
  }

  const ketQua = [];
  for (const b of ds) {
    const r = chay(b, task);
    const do_ = b.chan && r.code !== 0;
    ketQua.push({ ...b, ...r, do: do_ });
    if (flag('full') || do_) {
      console.log(`\n───── ${b.ten} ─────`);
      console.log(r.out || '(không in gì)');
    }
  }

  const do_ = ketQua.filter((x) => x.do);
  console.log('');
  for (const x of ketQua) {
    const nhan = x.do ? '✗ CHẶN' : (x.chan ? '✓ đạt ' : '· báo cáo');
    console.log(`[phase-check] ${nhan}  ${x.ten}`);
  }

  if (do_.length) {
    console.error(`\n[phase-check] ✗ ${do_.length}/${ketQua.length} bước CHẶN: ${do_.map((x) => x.ten).join(', ')}`);
    console.error('  Output đầy đủ của các bước đỏ đã in ở trên. Sửa nội dung, đừng nới ngưỡng.');
    process.exit(1);
  }
  console.log(`\n[phase-check] ✓ ĐẠT — ${ketQua.length} bước của phase ${phase}.`);
  if (!flag('full')) console.log('  (thêm --full để xem nguyên output từng bước)');
}

if (require.main === module) main();
module.exports = { BUOC };
