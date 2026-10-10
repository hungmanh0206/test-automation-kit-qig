#!/usr/bin/env node
'use strict';

/*
 * summarize_results.js — đọc `results.json` của Playwright, in BẢN TÓM TẮT có TRẦN DÒNG.
 *
 * VÌ SAO, và đây là chỗ cần nói rõ vì kit ĐÃ tối ưu một nửa: `playwright.config.js` đã đổi reporter từ
 * `list` sang `dot` (đo 19/09/2026: 143.542 byte xuống 10.646 byte, giảm 92,6%). Nửa còn thiếu là phía
 * AGENT: sau khi chạy, agent vẫn phải tự biết case nào đỏ, và cách duy nhất hiện có là đọc `results.json`
 * thô. File đó của một suite thật là hàng trăm KB, và 90% nội dung là stdout của case ĐÃ PASS.
 *
 * NGUYÊN TẮC: mỗi FAIL đúng MỘT dòng, và tổng output có TRẦN. Vượt trần thì cắt và nói rõ đã cắt bao
 * nhiêu — KHÔNG im lặng cắt, vì im lặng cắt nghĩa là có case đỏ mà agent không biết.
 *
 * ĐIỀU TUYỆT ĐỐI KHÔNG LÀM: bỏ sót một FAIL để output ngắn hơn. Tóm tắt mất một case đỏ thì tệ hơn hẳn
 * không có tóm tắt. Spec khoá đúng chuyện đó: mọi FAIL phải có mặt dù trần là bao nhiêu.
 *
 * Dùng:
 *   node scripts/qa/summarize_results.js                           # tìm results.json của task đang khai
 *   node scripts/qa/summarize_results.js --file <results.json>
 *   ... --max 40        # trần số dòng FAIL in ra (mặc định 40)
 *   ... --ids           # in thêm danh sách TC ID đỏ, dán thẳng vào --grep để rerun
 * Exit: 0 luôn — đây là máy BÁO CÁO, không phải máy chặn. Verdict do `output_gate` chấm.
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };

/** Mọi spec trong cây suite, phẳng ra. Playwright lồng suite theo file và theo describe. */
function phang(suite, acc = []) {
  for (const sp of suite.specs || []) acc.push(sp);
  for (const s of suite.suites || []) phang(s, acc);
  return acc;
}

/** TC ID lấy từ tiêu đề. Không có thì trả null — KHÔNG bịa, vì ID bịa làm `--grep` chạy sai case. */
function tcIdCua(title) {
  const m = String(title || '').match(/\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_TC_\d+)\b/);
  return m ? m[1] : null;
}

/** Lỗi rút gọn: dòng đầu có nội dung, bỏ mã màu ANSI, tối đa 140 ký tự. */
function loiGon(errors) {
  const raw = (errors || []).map((e) => String(e.message || e.value || '')).join('\n');
  const sach = raw.replace(/\u001b\[[0-9;]*m/g, '');
  const dong = sach.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const dau = dong.find((x) => !/^at\s/.test(x)) || dong[0] || '(không có thông báo lỗi)';
  return dau.length > 140 ? `${dau.slice(0, 137)}…` : dau;
}

/** Ảnh hoặc video đầu tiên trong attachments — chỗ người triage mở ra xem. */
function evidenceCua(attachments) {
  const a = (attachments || []).find((x) => /^(image|video)\//.test(String(x.contentType || '')));
  if (!a || !a.path) return '';
  try { return path.relative(rc.REPO_ROOT, a.path).replace(/\\/g, '/'); } catch (e) { return a.path; }
}

/**
 * Tìm `results.json` của lượt GẦN NHẤT.
 *
 * Phát hiện khi chạy thật trên UAT: `playwright.task.config.js` của task ghi kết quả vào
 * `test-results/runs/<RUN_ID>/results.json`, KHÔNG phải `test-results/results.json`. Bản đầu chỉ tìm ở
 * đường thứ hai, nên nó đọc một kết quả CŨ mà không báo gì — đúng lớp lỗi tệ nhất: trả lời tự tin bằng
 * dữ liệu của lượt khác.
 *
 * Nên: quét cả cây `test-results/` rồi lấy file MỚI NHẤT theo mtime.
 */
function timFile() {
  const n = arg('file', '');
  if (n) return n;
  const pod = process.env.PROJECT_OUTPUT_DIR;
  const task = process.env.TASK_KEY;
  if (!pod || !task) return '';
  const goc = path.resolve(rc.REPO_ROOT, pod, 'tasks', task, 'test-results');
  if (!fs.existsSync(goc)) return '';

  const thay = [];
  const di = (d, sau) => {
    if (sau > 3) return;
    let es;
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of es) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) di(p, sau + 1);
      else if (e.name === 'results.json') {
        try { thay.push({ p, at: fs.statSync(p).mtimeMs }); } catch (e2) { /* bỏ qua */ }
      }
    }
  };
  di(goc, 0);
  if (!thay.length) return path.join(goc, 'results.json');
  thay.sort((a, b) => b.at - a.at);
  return thay[0].p;
}

function main() {
  const MAX = parseInt(arg('max', '40'), 10) || 40;
  const file = timFile();
  if (!file || !fs.existsSync(file)) {
    console.error('[summary] không thấy results.json. Truyền --file, hoặc set TASK_KEY + PROJECT_OUTPUT_DIR.');
    console.error('  (Playwright ghi file này nhờ reporter `json` đã khai trong playwright.config.js.)');
    process.exit(0);
  }

  let j;
  try { j = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.error(`[summary] results.json lỗi JSON: ${e.message}`); process.exit(0); }

  const st = j.stats || {};
  const specs = (j.suites || []).reduce((a, s) => phang(s, a), []);

  /* Gom theo TRẠNG THÁI CUỐI của từng test, và giữ lần chạy cuối (sau retry) — đó là verdict thật. */
  const do_ = [];
  let pass = 0;
  let skip = 0;
  let flaky = 0;
  for (const sp of specs) {
    for (const t of sp.tests || []) {
      const res = (t.results || []);
      const cuoi = res[res.length - 1] || {};
      const s = String(t.status || cuoi.status || '');
      if (s === 'expected' || cuoi.status === 'passed') {
        if (res.length > 1) flaky += 1;
        pass += 1;
        continue;
      }
      if (s === 'skipped' || cuoi.status === 'skipped') { skip += 1; continue; }
      do_.push({
        tcId: tcIdCua(sp.title),
        title: String(sp.title || '').slice(0, 70),
        file: `${sp.file}:${sp.line}`,
        soLan: res.length,
        loi: loiGon(cuoi.errors),
        evidence: evidenceCua(cuoi.attachments),
      });
    }
  }

  const giay = st.duration ? Math.round(st.duration / 1000) : 0;
  console.log(`[summary] ${pass} PASS · ${do_.length} FAIL · ${skip} SKIP${flaky ? ` · ${flaky} xanh sau retry` : ''} · ${giay}s`);

  if (!do_.length) {
    console.log('[summary] không có case đỏ. Verdict chính thức do `output_gate --mode test-execution` chấm, không phải file này.');
    process.exit(0);
  }

  console.log('');
  for (const d of do_.slice(0, MAX)) {
    const id = d.tcId || d.title;
    console.log(`  ✗ ${id} · ${d.loi}${d.soLan > 1 ? ` · đã chạy ${d.soLan} lần` : ''}${d.evidence ? ` · ${d.evidence}` : ''}`);
  }
  if (do_.length > MAX) {
    console.log(`  … +${do_.length - MAX} case đỏ nữa KHÔNG in ra (trần --max ${MAX}). Tăng --max để xem hết.`);
  }

  if (flag('ids')) {
    const ids = do_.map((d) => d.tcId).filter(Boolean);
    console.log('');
    if (!ids.length) console.log('[summary] không case đỏ nào có TC ID trong tiêu đề ⇒ không dựng được --grep. Chạy lại theo file.');
    else {
      console.log('[summary] rerun ĐÚNG case đỏ, đừng chạy lại cả suite:');
      console.log(`  npx playwright test --grep "${ids.join('|')}"`);
      console.log('  (hoặc `npx playwright test --last-failed` nếu chạy ngay sau lượt vừa rồi)');
      /*
       * Case đỏ KHÔNG có TC ID thì `--grep` ở trên BỎ SÓT nó. Im lặng ở đây là đúng cái lỗi tệ nhất mà
       * máy này có thể gây ra: agent chạy lại theo grep, thấy xanh, rồi kết luận đã xử lý hết — trong khi
       * một case đỏ chưa từng được chạy lại.
       */
      const khongId = do_.filter((d) => !d.tcId);
      if (khongId.length) {
        console.log('');
        console.log(`[summary] ⚠ ${khongId.length}/${do_.length} case đỏ KHÔNG có TC ID trong tiêu đề nên --grep ở trên BỎ SÓT chúng:`);
        khongId.slice(0, 10).forEach((d) => console.log(`    ${d.title} · ${d.file}`));
        console.log('    Chạy riêng theo file, hoặc dùng `--last-failed` để không sót.');
      }
    }
  }
  process.exit(0);
}

module.exports = { phang, tcIdCua, loiGon, evidenceCua, timFile };

if (require.main === module) main();
