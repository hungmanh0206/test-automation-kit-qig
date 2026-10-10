#!/usr/bin/env node
'use strict';

/*
 * manual_run_check.js — MÁY cho nhánh `manual-run/`: lượt CHẠY TAY của case `Manual-only`.
 *
 * VÌ SAO CÓ NHÁNH NÀY. Kit đã biết đánh dấu case không tự động hoá được (`[manual]` ở ô Tiền điều kiện →
 * Readiness `Manual-only` → Phase 2 ghi `SKIP_SETUP`). Nhưng rồi DỪNG ở đó. Hệ quả đo được: case tồn tại
 * trong bộ, không ai chạy, và báo cáo in `SKIP_SETUP` như thể đó là một kết luận. `SKIP_SETUP` KHÔNG phải
 * verdict — nó là lời khai "chưa chạy". Nhánh này đóng đúng cái lỗ đó: chạy tay, có evidence, có verdict,
 * rồi ghi về cột `Result` qua đúng đường mà Phase 2 đang dùng.
 *
 * HAI VIỆC MÁY NÀY LÀM, và chỉ hai việc:
 *
 *   ① GÁC RANH GIỚI CỦA LỜI KHAI `[manual]`. Đây là giá trị chính. Không có cửa này thì nhánh chạy tay
 *      thành đường lách: case nào viết automation khó thì đẩy sang chạy tay, và coverage automation tụt
 *      mà không ai thấy. Nên: case xuất hiện trong lượt chạy tay mà KHÔNG mang `[manual]` trong bộ
 *      canonical là CHẶN. Chiều ngược lại là cảnh báo: case `[manual]` chưa có lượt chạy tay nào thì nó
 *      đang không có verdict, và điều đó phải nói ra.
 *
 *   ② ỦY QUYỀN phần chất lượng output cho `output_gate --mode test-execution`. Evidence cho MỌI case kể
 *      cả PASS, video cho case phức tạp, FAIL phải phân tầng, comment sạch, verdict thuộc taxonomy — tất
 *      cả đã có máy. Viết lại ở đây là tạo nguồn thứ hai để hai bên lệch nhau.
 *
 * LUẬT CỦA GÓI NGUỒN BỊ BỎ, nói rõ để không ai nhập lại: gói nguồn chỉ chụp ảnh khi FAIL. `CLAUDE.md`
 * mục 4 đòi ảnh hoặc video cho MỌI case đã execute, cả PASS. Giữ luật của kit, và chính `output_gate` là
 * chỗ nó được thi hành.
 *
 * Dùng:
 *   TASK_ENV=profiles/<TASK>/task.env npm run manual:check
 *   ... npm run manual:check:enforce      # lệch = exit 1
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const rules = require(path.resolve(__dirname, 'lib', 'output_rules'));
const outputGate = require(path.resolve(__dirname, 'output_gate'));
const canonical = require(path.resolve(__dirname, '..', 'lib', 'testcase'));
const cfgLoad = require(path.resolve(__dirname, 'lib', 'config_load'));

/*
 * Cấu hình nhánh chạy tay (v2.5.0 G1.7). Thiếu file ⇒ KÊU rõ phép kiểm nào chưa được gác, rồi dùng mặc
 * định NGHIÊM hơn (ngưỡng chuỗi lỗi = 3), không phải dễ hơn — xem ba nước của `config_load.js`.
 */
const MR = cfgLoad.napConfigGate({
  duong: path.join(rc.REPO_ROOT, '.agent/config/manual_run.json'),
  nhan: 'manual_run.json',
  phepKiem: 'sổ dữ liệu đã tạo · liệt kê thao tác phá huỷ · chuỗi lỗi hạ tầng liên tiếp',
  khiThieu: null,
}) || {};

const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };

/* PII: dùng lại PII_PATTERNS của output_rules. Viết bản thứ ba ở đây là tạo đúng cái lỗi mà file này
 * đi chặn ở chỗ khác — hai bản chép tay thì sớm muộn lệch nhau. */
const PII = rules.PII_PATTERNS;

/* Bốn trường của phiên. Thiếu trường nào thì lượt chạy không truy được về ai, trên build nào. */
const SESSION_FIELDS = [
  { key: 'Người chạy', re: /ng(?:ườ|uo)i ch(?:ạ|a)y\s*[:：]\s*(.+)/i },
  { key: 'Ngày', re: /ng(?:à|a)y\s*[:：]\s*(.+)/i },
  { key: 'Môi trường', re: /m(?:ô|o)i tr(?:ườ|uo)ng(?:[^:：]*)[:：]\s*(.+)/i },
  { key: 'Build', re: /build(?:\s*\/\s*version)?\s*[:：]\s*(.+)/i },
];

/* Giá trị "trông như đã điền nhưng chưa" — cùng khuôn placeholder của scope_anchor. */
const PLACEHOLDER = /^(|-+|_+|n\/?a|tbd|todo|\?+|<[^>]*>|\[[^\]]*\]|xxx+)$/i;
const daDien = (v) => typeof v === 'string' && v.trim() !== '' && !PLACEHOLDER.test(v.trim());

/** Case có mang tag `[manual]` ở ô Tiền điều kiện? Tag này là chỗ DUY NHẤT sống sót vòng publish→pull. */
function laManual(tc) {
  return String(tc.precondition || '')
    .split(/<br\s*\/?>|\n/)
    .some((part) => /^\s*\[manual\]/i.test(part));
}

/** Đọc mọi bộ TC canonical của task, trả map tcId → testcase. */
function docBoCase(taskDir) {
  const byId = new Map();
  for (const dir of rc.getTestcaseDirs(taskDir)) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('~$') || f.startsWith('.~') || !f.endsWith('.md')) continue;
      try {
        const doc = canonical.parseMarkdown(fs.readFileSync(path.join(dir, f), 'utf8'));
        for (const t of doc.tests || []) if (t.tcId && !byId.has(t.tcId)) byId.set(t.tcId, t);
      } catch (e) { /* không phải bảng testcase */ }
    }
  }
  return byId;
}

function kiem(taskDir) {
  const problems = [];
  const warnings = [];
  const runDir = path.join(taskDir, 'manual-run');
  const sessionPath = path.join(runDir, 'session.md');
  const statusPath = path.join(taskDir, 'test-results', 'testcase-status.json');

  if (!fs.existsSync(runDir)) {
    return { problems: [`không thấy \`manual-run/\` trong ${path.relative(rc.REPO_ROOT, taskDir)} — chưa có lượt chạy tay nào.`], warnings, soCase: 0, chuaChay: true };
  }

  // ── Phiên: ai chạy, khi nào, trên build nào ────────────────────────────────────────────────────
  let sessionText;
  if (!fs.existsSync(sessionPath)) {
    problems.push('thiếu `manual-run/session.md` — lượt chạy tay không có sổ thì không truy được về ai chạy, trên build nào.');
  } else {
    sessionText = fs.readFileSync(sessionPath, 'utf8');
    for (const f of SESSION_FIELDS) {
      const m = sessionText.match(f.re);
      if (!m || !daDien(m[1])) problems.push(`\`session.md\`: trường **${f.key}** còn trống hoặc là placeholder.`);
    }
    for (const re of PII) {
      const hit = sessionText.match(re);
      if (hit) { problems.push(`\`session.md\`: có dấu hiệu PII khách (${String(hit[0]).slice(0, 4)}…) — mask trước khi lưu. Luật chung, không có ngoại lệ cho nhánh chạy tay.`); break; }
    }
  }

  // ── Kết quả: đi đúng đường của Phase 2, không tạo khuôn thứ hai ────────────────────────────────
  if (!fs.existsSync(statusPath)) {
    problems.push('thiếu `test-results/testcase-status.json` — đây là khuôn kết quả DUY NHẤT (`merge_execution_status.js` đọc nó để ghi cột Result). Chạy tay xong mà không ghi vào đó thì verdict không về được Sheet.');
    return { problems, warnings, soCase: 0 };
  }

  let status;
  try { status = JSON.parse(fs.readFileSync(statusPath, 'utf8')); }
  catch (e) { problems.push(`\`testcase-status.json\` lỗi JSON: ${e.message}`); return { problems, warnings, soCase: 0 }; }

  const tests = Array.isArray(status) ? status : (status.tests || []);
  const bo = docBoCase(taskDir);

  // ① RANH GIỚI `[manual]` — chỗ duy nhất máy này thật sự thêm giá trị.
  const daChay = new Set();
  for (const t of tests) {
    const id = t.tcId || t.testKey || t.id || '';
    if (!id) continue;
    if (!outputGate.isExecuted(t.status)) continue;
    daChay.add(id);
    const tc = bo.get(id);
    if (!tc) {
      warnings.push(`${id}: không có trong bộ TC canonical của task — không đối chiếu được lời khai \`[manual]\`. Kiểm lại TC ID, hoặc bộ case chưa kéo về.`);
      continue;
    }
    if (!laManual(tc)) {
      const tag = (String(tc.precondition || '').match(/^\s*\[([a-z_]+)\]/i) || [])[1] || 'không có tag';
      problems.push(`${id}: chạy TAY nhưng ô Tiền điều kiện khai \`[${tag}]\`, không phải \`[manual]\`. Nhánh này CHỈ dành cho case không dựng được state tự động. Case tự động hoá được mà đẩy sang chạy tay là lách automation, và coverage tụt mà không ai thấy. Muốn đổi thì sửa lời khai ở Phase 1 kèm lý do, đừng đổi ở đây.`);
    }
  }

  // Chiều ngược: case `[manual]` chưa ai chạy ⇒ nó KHÔNG có verdict. Cảnh báo, vì lượt này có thể cố ý
  // chỉ chạy một phần — nhưng phải nói ra, không để `SKIP_SETUP` trông như một kết luận.
  const manualTrongBo = [...bo.values()].filter(laManual).map((t) => t.tcId);
  const chuaCoVerdict = manualTrongBo.filter((id) => !daChay.has(id));
  if (chuaCoVerdict.length) {
    warnings.push(`${chuaCoVerdict.length}/${manualTrongBo.length} case \`[manual]\` CHƯA có lượt chạy tay nào ⇒ chưa có verdict. \`SKIP_SETUP\` là lời khai "chưa chạy", KHÔNG phải kết luận. ${chuaCoVerdict.slice(0, 5).join(', ')}${chuaCoVerdict.length > 5 ? ' …' : ''}`);
  }

  /*
   * ③ SỔ DỮ LIỆU ĐÃ TẠO (v2.5.0 G1.7). Chạy tay KHÔNG có `RUN_ID` để dọn tự động như automation, nên bản
   * ghi tạo ra trong lượt chạy tay nằm lại UAT vĩnh viễn nếu không ai ghi lại.
   *
   * CẢNH BÁO chứ không chặn, có chủ đích: có bản ghi cố ý giữ làm tiền đề cho lượt sau, và đó là lựa chọn
   * HỢP LỆ — miễn là nói ra. Chặn ở đây là phạt cả lựa chọn hợp lệ.
   */
  const soCfg = MR.soDuLieu || {};
  if (soCfg.heading && fs.existsSync(sessionPath)) {
    const raw = fs.readFileSync(sessionPath, 'utf8').replace(/\r\n?/g, '\n');
    const dong = raw.split('\n');
    const i = dong.findIndex((d) => d.includes(soCfg.heading));
    if (i < 0) {
      warnings.push(`\`session.md\` chưa có khối "## ${soCfg.heading}" ⇒ phép kiểm "bản ghi đã tạo có được dọn" CHƯA ĐƯỢC GÁC. Chạy tay không có \`RUN_ID\` để dọn tự động, nên không ghi thì bản ghi nằm lại UAT.`);
    } else {
      let chuaDon = 0;
      for (let k = i + 1; k < dong.length; k += 1) {
        const d = dong[k].trim();
        if (/^#{2,3}\s/.test(d)) break;
        if (!d.startsWith('|') || /^\|[\s:|-]+\|$/.test(d)) continue;
        const o = d.slice(1, -1).split('|').map((x) => x.trim());
        if (o.length < 3) continue;
        if (/^(tc id|tc)$/i.test(o[0])) continue;           // dòng header
        const daTao = o[1];
        const daDon = o[2];
        const lyDo = o[3] || '';
        /* Có khai TẠO mà cột dọn trống VÀ không có lý do ⇒ bản ghi đó không ai biết còn hay mất. */
        if (daTao && !/^-+$|^$/.test(daTao) && /^(|-+|chưa|không)$/i.test(daDon) && lyDo.length < 8) {
          chuaDon += 1;
        }
      }
      if (chuaDon) {
        warnings.push(`\`session.md\` → "${soCfg.heading}": ${chuaDon} dòng khai ĐÃ TẠO bản ghi mà cột dọn trống và KHÔNG có lý do. Giữ lại là lựa chọn hợp lệ, nhưng phải ghi lý do — không ghi thì lượt sau không ai biết dữ liệu đó còn hay mất.`);
      }
    }
  }

  /*
   * ④ CHUỖI LỖI HẠ TẦNG LIÊN TIẾP (v2.5.0 G1.7). A dạy "fail rồi chạy tiếp" thay vì dừng ở case đỏ đầu
   * tiên — đúng, vì dừng sớm làm mất cả lượt. Nhưng chạy tiếp MÙ thì khi hạ tầng sập, mọi case sau đó đỏ
   * vì cùng một nguyên nhân và lượt chạy thành vô giá trị.
   *
   * Máy đọc file kết quả SAU khi lượt đã xong nên nó không dừng được lượt đang chạy. Việc nó làm được là
   * nói ra: các verdict sau chuỗi đó đáng nghi.
   */
  const ht = MR.chuoiLoiHaTang || { nguong: 3, layers: ['setup_failure', 'env_issue', 'script_error'] };
  const laHaTang = (t) => (ht.layers || []).includes(String(t.failureLayer || '').trim());
  let chuoi = 0;
  let dinh = 0;
  let tangDinh = '';
  for (const t of tests) {
    if (laHaTang(t)) {
      chuoi += 1;
      if (chuoi > dinh) { dinh = chuoi; tangDinh = String(t.failureLayer || ''); }
    } else chuoi = 0;
  }
  if (dinh >= (ht.nguong || 3)) {
    warnings.push(`có ${dinh} case LIÊN TIẾP cùng tầng \`${tangDinh}\` (ngưỡng ${ht.nguong}) ⇒ dấu hiệu HẠ TẦNG sập, không phải ${dinh} lỗi khác nhau. Các verdict sau chuỗi đó đáng nghi — sửa môi trường rồi chạy lại phần đó, đừng dùng lượt này để kết luận chất lượng.`);
  }

  /*
   * ⑤ LIỆT KÊ case mang dấu hiệu THAO TÁC PHÁ HUỶ, để người chạy thấy TRƯỚC khi bắt đầu. Trên môi trường
   * dùng chung, thao tác phá huỷ làm tiền đề của case khác và của task khác biến mất.
   *
   * Chỉ LIỆT KÊ, KHÔNG tự hạ verdict: có case mà thao tác xoá chính là thứ phải kiểm, và chặn chúng là
   * chặn đúng phần cần test nhất.
   */
  const pz = (MR.thaoTacPhaHuy || {}).signals || [];
  if (pz.length) {
    const nguyHiem = [...bo.values()].filter(laManual).filter((t) => {
      const s = `${t.steps || ''} ${t.title || ''}`.toLowerCase();
      return pz.some((k) => s.includes(String(k).toLowerCase()));
    }).map((t) => t.tcId);
    if (nguyHiem.length) {
      warnings.push(`${nguyHiem.length}/${manualTrongBo.length} case \`[manual]\` mang dấu hiệu THAO TÁC PHÁ HUỶ. Trên môi trường DÙNG CHUNG, chạy tay không có \`RUN_ID\` để dọn — bỏ qua rồi khai lý do, hoặc ghi vào "${(MR.soDuLieu || {}).heading || 'sổ dữ liệu'}" những gì đã tạo/xoá. ${nguyHiem.slice(0, 5).join(', ')}${nguyHiem.length > 5 ? ` … +${nguyHiem.length - 5}` : ''}`);
    }
  }

  // ② ỦY QUYỀN chất lượng output. Evidence mọi case kể cả PASS, video case phức tạp, FAIL phân tầng,
  // verdict thuộc taxonomy — đã có máy, không viết lại.
  // Truyền CẢ doc, không chỉ `tests`: `gateTestExecution` đọc `doc.attestation` để chống "tick suông".
  // Bản đầu truyền mảng `tests` nên khối attestation vĩnh viễn undefined, và cảnh báo "chưa có
  // attestation" bắn ra ở MỌI lượt kể cả lượt đã khai đủ — một cảnh báo luôn đúng là một cảnh báo vô dụng.
  const g = outputGate.gateTestExecution(status);
  g.problems.forEach((p) => problems.push(`[output_gate] ${p}`));
  g.warnings.forEach((p) => warnings.push(`[output_gate] ${p}`));

  return { problems, warnings, soCase: daChay.size, soManual: manualTrongBo.length };
}

function main() {
  const ENFORCE = flag('enforce');
  const TASK = arg('task', process.env.TASK_KEY || '');
  const POD = process.env.PROJECT_OUTPUT_DIR || '';
  if (!TASK || !POD) {
    console.error('[manual] cần TASK_KEY + PROJECT_OUTPUT_DIR (TASK_ENV=profiles/<TASK>/task.env).');
    process.exit(2);
  }
  const taskDir = path.resolve(rc.REPO_ROOT, POD, 'tasks', TASK);

  const r = kiem(taskDir);
  if (r.chuaChay) {
    console.log(`[manual] ${r.problems[0]}`);
    console.log('[manual] Nhánh này là OPT-IN: chỉ chạy khi có case `[manual]` và user yêu cầu. Không có lượt nào thì KHÔNG phải lỗi.');
    process.exit(0);
  }

  console.log(`[manual] ${r.soCase} case đã chạy tay · ${r.soManual || 0} case \`[manual]\` trong bộ · ${r.problems.length} CHẶN · ${r.warnings.length} cảnh báo.`);
  if (r.warnings.length) {
    console.log('\n[manual] ⚠ Cảnh báo:');
    r.warnings.slice(0, 30).forEach((p) => console.log(`  ~ ${p}`));
    if (r.warnings.length > 30) console.log(`  … +${r.warnings.length - 30} nữa`);
  }
  if (!r.problems.length) {
    console.log('\n[manual] ✓ ĐẠT — mọi case chạy tay đều khai `[manual]`, phiên có sổ, kết quả qua output_gate.');
    process.exit(0);
  }
  console.log('\n[manual] ✗ VI PHẠM:');
  r.problems.forEach((p) => console.log(`  - ${p}`));
  console.log('\n  Luật nhánh này ở `manual-run/reference.md`; khuôn kết quả ở `manual-run/run_manual_execution.md`.');
  if (!ENFORCE) { console.log('\n[manual] (chế độ xem trước — thêm `--enforce` để chặn)'); process.exit(0); }
  console.log('\n[manual] BLOCK.');
  process.exit(1);
}

module.exports = { kiem, laManual, SESSION_FIELDS };

if (require.main === module) main();
