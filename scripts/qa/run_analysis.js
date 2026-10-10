#!/usr/bin/env node
'use strict';

/*
 * run_analysis.js — LƯỢT CHẠY NÀY CÓ ĐƯỢC DÙNG ĐỂ KẾT LUẬN CHẤT LƯỢNG KHÔNG?
 *
 * VÌ SAO CÓ (v2.5.0 G1.2, nhận của A `qig-qa-automation`). Kit đã có `metrics_collect` (KPI mỗi lượt) và
 * `reliability_index` (độ tin cậy mỗi case), và `summarize_results` tóm tắt MỘT lượt. Không có gì đọc
 * **tỉ lệ BLOCKED** rồi quyết định xem lượt đó còn đủ mẫu số để nói về chất lượng hay chưa.
 *
 * Chuyện này không lý thuyết. Đo 10/10/2026 trên 78 file `testcase-status.json` của repo, trong 11 lượt có
 * từ 20 case trở lên: 4 lượt BLOCKED vượt 20% (20.5 · 21.7 · 22.2 · 28.9%). Ở lượt 28.9%, gần ba trong mười
 * case chưa chạy được — mà "pass rate" vẫn được tính trên phần còn lại rồi đọc như tỉ lệ trên phạm vi.
 *
 * BA VIỆC, mỗi việc một lý do riêng:
 *  ① Dải BLOCKED (ngưỡng ở `.agent/config/run_analysis.json`). Trên 20% ⇒ `--enforce` CHẶN kết luận
 *    chất lượng. Đây KHÔNG phải nói lượt chạy sai; nó nói mẫu số không đủ để phán.
 *  ② Nợ kiểm thử: SKIP vì thao tác PHÁ HUỶ tách riêng khỏi SKIP vì thiếu tiền đề. Hai thứ khác nhau hẳn —
 *    cái sau sẽ tự chạy khi có capability, cái trước thì KHÔNG BAO GIỜ tự chạy.
 *  ③ Xu hướng giữa các lượt, và chỉ so khi **cùng nguồn TC**. Nguồn đổi mà vẫn so số thô thì "pass rate
 *    tăng 4%" có thể chỉ là đã bỏ bớt case khó.
 *
 * Trạng thái lấy từ `verdict_taxonomy.json` (một nguồn), kể cả bảng `synonyms` — dữ liệu thật dùng
 * `BLOCKED` trong khi taxonomy khai `BLOCKED_SETUP`, và `synonyms` đã nối hai cái đó.
 *
 * Dùng:
 *   npm run run:analysis                 # báo cáo (cần TASK context, hoặc --status <file>)
 *   npm run run:analysis:enforce         # BLOCKED vượt dải trên → exit 1
 *   node scripts/qa/run_analysis.js --status <f> [--write] [--history <f>]
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const cfgLoad = require(path.join(__dirname, 'lib', 'config_load'));

const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d = '') => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const ENFORCE = flag('enforce');
const REPO = rc.REPO_ROOT;

const CFG = cfgLoad.napConfigGate({
  duong: path.join(REPO, '.agent/config/run_analysis.json'),
  nhan: 'run_analysis.json',
  phepKiem: 'dải BLOCKED (trên 20% thì KHÔNG kết luận chất lượng), nợ kiểm thử, và luật "chỉ so xu hướng khi cùng nguồn TC"',
  khiThieu: null,
}) || {};

const VT = cfgLoad.napConfigGate({
  duong: path.join(REPO, '.agent/config/verdict_taxonomy.json'),
  nhan: 'verdict_taxonomy.json',
  phepKiem: 'chuẩn hoá trạng thái (gồm bảng `synonyms`: dữ liệu thật dùng `BLOCKED`, taxonomy khai `BLOCKED_SETUP`)',
  khiThieu: null,
}) || {};

/** Chuẩn hoá verdict qua `synonyms` — KHÔNG tự lập bảng ánh xạ ở đây. */
const chuanHoa = (s) => {
  const k = String(s || '').trim().toUpperCase();
  return (VT.synonyms && VT.synonyms[k]) || k;
};

function docStatus() {
  const f = arg('status') || (() => {
    try { return path.join(rc.getTestResultsDir ? rc.getTestResultsDir() : '', 'testcase-status.json'); } catch { return ''; }
  })();
  if (!f || !fs.existsSync(f)) {
    console.error(`[run-analysis] không thấy testcase-status.json (${f || 'chưa có TASK context'}).`);
    console.error('  Truyền `--status <file>`, hoặc đặt TASK_KEY + PROJECT_OUTPUT_DIR.');
    process.exit(2);
  }
  let j;
  try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {
    console.error(`[run-analysis] ${path.basename(f)} parse lỗi: ${e.message}`);
    process.exit(2);
  }
  return { f, tests: Array.isArray(j.tests) ? j.tests : [], taskKey: j.taskKey || '', at: j.generatedAt || '' };
}

/**
 * Dấu vân tay NGUỒN TC = băm tập `tcId` đã sắp xếp + số case.
 *
 * KHÔNG dùng mtime hay băm file canonical: bản tải lại từ Google Sheet đổi byte mà nội dung không đổi, nên
 * hai cách đó sẽ báo "nguồn đổi" ở MỌI lượt, và luật "chỉ so khi cùng nguồn" sẽ không bao giờ cho so.
 */
function dauVanTay(tests) {
  const ids = tests.map((t) => String(t.tcId || '')).filter(Boolean).sort();
  const h = require('crypto').createHash('sha256').update(ids.join('|')).digest('hex').slice(0, 12);
  return { hash: h, n: ids.length };
}

const khopTinHieu = (s, list) => {
  const t = String(s || '').toLowerCase();
  return (list || []).filter((k) => t.includes(String(k).toLowerCase()));
};

function main() {
  const { f, tests, taskKey, at } = docStatus();
  if (!tests.length) {
    console.log(`[run-analysis] ${path.basename(f)} có 0 case ⇒ KHÔNG phán được gì. Đây không phải đạt.`);
    process.exit(0);
  }

  const by = new Map();
  for (const t of tests) {
    const s = chuanHoa(t.status);
    by.set(s, (by.get(s) || 0) + 1);
  }
  const n = tests.length;
  const blocked = (by.get('BLOCKED_SETUP') || 0);
  const skip = (by.get('SKIP') || 0) + (by.get('SKIP_SETUP') || 0);
  const tiLeBlocked = blocked / n;
  const band = CFG.blockedBands || { binhThuong: 0.05, neuDauBaoCao: 0.2 };

  const pc = (x) => `${(100 * x).toFixed(1)}%`;
  console.log(`[run-analysis] ${taskKey || '(không rõ task)'} · ${n} case${at ? ` · ${at}` : ''}`);
  console.log(`  verdict: ${[...by.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' · ')}`);

  /* ① DẢI BLOCKED — in NGAY, trước mọi tỉ lệ khác. Đó là điểm của luật này. */
  let chan = false;
  if (tiLeBlocked > band.neuDauBaoCao) {
    console.log(`  ✗ BLOCKED ${blocked}/${n} = ${pc(tiLeBlocked)} VƯỢT ${pc(band.neuDauBaoCao)} ⇒ KHÔNG được kết luận chất lượng từ lượt này.`);
    console.log('    Hơn một phần năm phạm vi chưa chạy được thì "pass rate" là tỉ lệ trên PHẦN CÒN LẠI, không phải trên phạm vi.');
    console.log('    Việc cần làm: dựng capability cho phần BLOCKED, hoặc thu hẹp phạm vi đã khai rồi báo lại mẫu số.');
    chan = true;
  } else if (tiLeBlocked >= band.binhThuong) {
    console.log(`  ⚠ BLOCKED ${blocked}/${n} = ${pc(tiLeBlocked)} (dải ${pc(band.binhThuong)}–${pc(band.neuDauBaoCao)}) ⇒ phải NÊU NGAY ĐẦU báo cáo.`);
    console.log('    Mẫu số đã khuyết đủ để một tỉ lệ pass nghe hay hơn thực tế.');
  } else {
    console.log(`  BLOCKED ${blocked}/${n} = ${pc(tiLeBlocked)} — dưới ${pc(band.binhThuong)}, không cần nêu riêng.`);
  }

  /* ② NỢ KIỂM THỬ — SKIP vì phá huỷ, tách khỏi SKIP vì thiếu tiền đề. */
  const noKt = [];
  for (const t of tests) {
    if (!['SKIP', 'SKIP_SETUP'].includes(chuanHoa(t.status))) continue;
    const hit = khopTinHieu(`${t.comment || ''} ${t.reason || ''}`, (CFG.noKiemThu || {}).signals);
    if (hit.length) noKt.push({ id: t.tcId, hit });
  }
  if (noKt.length) {
    console.log(`  NỢ KIỂM THỬ: ${noKt.length} case SKIP vì thao tác PHÁ HUỶ — khác hẳn SKIP vì thiếu tiền đề, vì nó sẽ KHÔNG tự chạy ở lượt sau.`);
    noKt.slice(0, 10).forEach((x) => console.log(`    ${x.id} (dấu hiệu: ${x.hit.join(', ')})`));
    if (noKt.length > 10) console.log(`    … +${noKt.length - 10}`);
  } else if (skip) {
    console.log(`  ${skip} case SKIP, không case nào mang dấu hiệu thao tác phá huỷ.`);
  } else {
    /*
     * Nói ra thay vì im lặng: đo 10/10/2026 là 0 case SKIP trong toàn bộ 78 file status của repo, nên phép
     * kiểm nợ kiểm thử HIỆN CHƯA GÁC DỮ LIỆU THẬT NÀO. Không in "đạt" cho một phép kiểm không có gì để gác.
     */
    console.log('  0 case SKIP ⇒ phép kiểm "nợ kiểm thử" CHƯA GÁC GÌ ở lượt này (không phải đạt).');
  }

  /* Tín hiệu dữ liệu bẩn — TÍN HIỆU, không phải verdict. */
  const ban = tests.filter((t) => khopTinHieu(t.comment, (CFG.duLieuBan || {}).signals).length);
  if (ban.length) {
    console.log(`  ⚠ ${ban.length} case có dấu hiệu DỮ LIỆU BẨN trong comment ⇒ cả PASS và FAIL ở những case đó đều đáng soi lại.`);
    console.log(`    ${ban.slice(0, 5).map((t) => t.tcId).join(' · ')}${ban.length > 5 ? ` … +${ban.length - 5}` : ''}`);
    console.log('    Đây là TÍN HIỆU để người đọc soi, KHÔNG phải một verdict.');
  }

  /* ③ XU HƯỚNG — chỉ so khi cùng dấu vân tay nguồn TC. */
  const vt = dauVanTay(tests);
  const hFile = path.resolve(arg('history', path.join(REPO, CFG.historyFile || 'knowledge/metrics/run-analysis.jsonl')));
  let truoc = null;
  try {
    const dong = fs.readFileSync(hFile, 'utf8').split('\n').map((d) => d.trim()).filter(Boolean);
    for (let i = dong.length - 1; i >= 0; i -= 1) {
      const r = JSON.parse(dong[i]);
      if (r.taskKey === taskKey) { truoc = r; break; }
    }
  } catch { truoc = null; }

  if (!truoc) {
    console.log('  xu hướng: chưa có lượt trước của task này để so.');
  } else if (truoc.tcHash !== vt.hash) {
    console.log(`  ✗ xu hướng: KHÔNG so được — nguồn TC đã ĐỔI (${truoc.tcN} → ${vt.n} case, dấu vân tay ${truoc.tcHash} → ${vt.hash}).`);
    console.log('    So số thô qua hai nguồn khác nhau thì "pass rate tăng" có thể chỉ là đã bỏ bớt case khó.');
  } else {
    const d = (a, b) => { const x = b - a; return `${x > 0 ? '+' : ''}${x}`; };
    console.log(`  xu hướng (cùng nguồn TC, ${vt.n} case): BLOCKED ${d(truoc.blocked, blocked)} · FAIL ${d(truoc.fail || 0, by.get('FAIL') || 0)} · PASS ${d(truoc.pass || 0, by.get('PASS') || 0)}`);
  }

  if (flag('write')) {
    const rec = {
      at: new Date().toISOString(), taskKey, n, blocked, skip,
      pass: by.get('PASS') || 0, fail: by.get('FAIL') || 0,
      tcHash: vt.hash, tcN: vt.n,
    };
    fs.mkdirSync(path.dirname(hFile), { recursive: true });
    fs.appendFileSync(hFile, `${JSON.stringify(rec)}\n`, 'utf8');
    console.log(`  đã ghi lịch sử: ${path.relative(REPO, hFile).split(path.sep).join('/')}`);
  }

  if (ENFORCE && chan) {
    console.log('\n[run-analysis] ✗ CHẶN — mẫu số không đủ để kết luận chất lượng. Đây không phải "lượt chạy sai", mà là "chưa đủ để phán".');
    process.exit(1);
  }
  console.log(ENFORCE ? '\n[run-analysis] ✓ ĐẠT — tỉ lệ BLOCKED trong dải cho phép.' : '\nChặn được bằng: npm run run:analysis:enforce');
  process.exit(0);
}

module.exports = { dauVanTay, chuanHoa };
if (require.main === module) main();
