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
