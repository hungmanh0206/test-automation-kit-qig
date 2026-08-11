'use strict';

/*
 * validate — kiểm STRUCTURAL (đủ cột canonical) + COMPLETENESS (ô lõi không rỗng) trên TestCaseDoc.
 * Superset của design_gate.gateDesign (GĐ 1b sẽ cho design_gate delegate về đây). Row-quality/oracle
 * (KQ khớp bước, range, tautology) vẫn ở output_rules — validate KHÔNG lặp lại, chỉ structural/completeness.
 */

const m = require('./model');

const REQUIRED_COLS = [
  ['TC ID', m.COL.tcId], ['Module', m.COL.module], ['Trường hợp kiểm thử', m.COL.title],
  ['Tiền điều kiện', m.COL.precondition], ['Các bước thực hiện', m.COL.steps],
  ['Kết quả mong đợi', m.COL.expected], ['Ưu tiên', m.COL.priority], ['Severity | Mức độ rủi ro', m.COL.risk],
];
// ô lõi mỗi TC không được rỗng (KQ mong đợi để output_rules lo oracle-rỗng; precondition/data có thể rỗng hợp lệ)
const REQUIRED_FIELDS = [['module', 'Module'], ['title', 'Trường hợp kiểm thử'], ['stepsRaw', 'Các bước thực hiện'], ['priority', 'Ưu tiên'], ['risk', 'Severity']];

// GIÁ TRỊ hợp lệ. `Ưu tiên` phải là 1 trong 5 priority CÓ THẬT trên Jira: bug được log lấy Priority TỪ CHÍNH
// cột này (prompt `08_log_bug_jira.md`), giá trị lạ (`Critical`, `P0`…) ⇒ Jira không set được ⇒ bug rơi về
// default, mất luôn tín hiệu ưu tiên. Trước đây prompt §7/§8 có quy định nhưng KHÔNG có gì kiểm.
const PRIORITY_OK = /^(highest|high|medium|low|lowest)$/i;
// SEVERITY (thang mới, 5 mức) = hậu quả NẾU lỗi xảy ra. Khác `Ưu tiên` (thứ tự sửa, đẩy vào field Priority
// của Jira). Trước đây cột này là "Mức độ rủi ro" 3 mức; thang 3 mức vẫn NHẬN để bộ TC cũ không đỏ, nhưng
// deprecated — cảnh báo 1 lần/file (không phải mỗi dòng, tránh 530 dòng nhiễu).
// LƯU Ý: Jira hiện CHƯA có field Severity → giá trị này giữ ở testcase/report, KHÔNG đẩy lên Jira.
const SEVERITY_OK = /^(blocker|critical|major|minor|trivial)$/i;
const RISK_LEGACY = /^(high|medium|low|cao|trung bình|trung binh|thấp|thap)$/i;
const RISK_OK = new RegExp(`${SEVERITY_OK.source}|${RISK_LEGACY.source}`, 'i');
const RISK_HIGH = /^(blocker|critical|high|cao)$/i;
const RISK_LOW = /^(minor|trivial|low|thấp|thap)$/i;

/**
 * @param {import('./model').TestCaseDoc} doc
 * @returns {{ problems: string[], warnings: string[] }}
 */
function validate(doc) {
  const problems = []; const warnings = [];
  if (!doc || !doc.tests || !doc.tests.length) { problems.push('Không có testcase nào (bảng 9-cột không parse được).'); return { problems, warnings }; }

  // 1) STRUCTURAL — đủ cột canonical.
  for (const [label, matcher] of REQUIRED_COLS) {
    if (m.colIndex(doc.headers || [], matcher) < 0) problems.push(`Bảng testcase THIẾU cột "${label}" (canonical) — downstream sẽ vỡ`);
  }
  // 2) COMPLETENESS — ô lõi không rỗng.
  for (const tc of doc.tests) {
    const id = tc.tcId || '(no-id)';
    for (const [field, label] of REQUIRED_FIELDS) {
      if (!String(tc[field] || '').trim()) problems.push(`${id}: rỗng ô "${label}"`);
    }
  }
  // 2b) VALUE — `Ưu tiên`/`Mức độ rủi ro` phải dùng đúng thang (prompt gen §7/§8).
  for (const tc of doc.tests) {
    const id = tc.tcId || '(no-id)';
    const p = String(tc.priority || '').trim();
    const r = String(tc.risk || '').trim();
    if (p && !PRIORITY_OK.test(p)) problems.push(`${id}: \`Ưu tiên\` = "${p}" không phải priority Jira — chỉ dùng Highest|High|Medium|Low|Lowest (vd "Critical" → "Highest"). Bug log lên Jira lấy Priority TỪ cột này nên giá trị lạ = Jira dùng default, mất tín hiệu ưu tiên.`);
    if (r && !RISK_OK.test(r)) problems.push(`${id}: \`Severity\` = "${r}" không thuộc thang Blocker|Critical|Major|Minor|Trivial (§8); thang cũ High|Medium|Low vẫn tạm nhận. Giá trị ngoài cả hai thang bị mọi consumer bỏ qua âm thầm.`);

    if (p && SEVERITY_OK.test(p)) problems.push(`${id}: \`Ưu tiên\` = "${p}" là giá trị SEVERITY, đặt sai cột — \`Ưu tiên\` chỉ nhận Highest|High|Medium|Low|Lowest (đẩy vào field Priority của Jira); Severity thuộc cột \`Severity\`.`);
  }
  // 2c) CONSISTENCY — 2 cột không được nói ngược nhau. Cảnh báo (không chặn) vì vẫn có ngoại lệ hợp lý,
  // nhưng phải nêu ra: rủi ro High = tài chính/bảo mật/không rollback được, gán ưu tiên thấp là tự mâu thuẫn
  // và bug sinh ra từ case đó sẽ lên Jira với Priority thấp.
  for (const tc of doc.tests) {
    const id = tc.tcId || '(no-id)';
    const p = String(tc.priority || '').trim();
    const r = String(tc.risk || '').trim();
    if (!p || !r || !PRIORITY_OK.test(p) || !RISK_OK.test(r)) continue;
    if (RISK_HIGH.test(r) && /^(low|lowest)$/i.test(p)) warnings.push(`${id}: MÂU THUẪN — \`Mức độ rủi ro\` High (tài chính/bảo mật/không rollback) nhưng \`Ưu tiên\` ${p}; sửa 1 trong 2 cho khớp §7/§8`);
    if (RISK_LOW.test(r) && /^highest$/i.test(p)) warnings.push(`${id}: MÂU THUẪN — \`Mức độ rủi ro\` Low (UI/UX, dễ fix) nhưng \`Ưu tiên\` Highest; sửa 1 trong 2 cho khớp §7/§8`);
  }
  // 2d) THANG CŨ (set-level, 1 lần/file) — bộ TC cũ dùng High/Medium/Low thì nhắc chuyển, KHÔNG chặn và
  // KHÔNG cảnh báo từng dòng (530 dòng cảnh báo = tiếng ồn, sẽ bị lướt).
  {
    const legacy = doc.tests.filter((t) => RISK_LEGACY.test(String(t.risk || '').trim())).length;
    const modern = doc.tests.filter((t) => SEVERITY_OK.test(String(t.risk || '').trim())).length;
    if (legacy && !modern) warnings.push(`Bộ này dùng thang rủi ro CŨ 3 mức (${legacy} TC) — task mới dùng \`Severity\`: Blocker|Critical|Major|Minor|Trivial (§8). Bộ cũ không cần chuyển.`);
    else if (legacy && modern) warnings.push(`Bộ này TRỘN 2 thang: ${modern} TC dùng Severity 5 mức, ${legacy} TC còn thang cũ 3 mức — thống nhất 1 thang trong cùng một bộ để lọc/thống kê không lệch.`);
  }
  // 3) DIMENSION (set-level) — cảnh báo.
  const dims = new Set(doc.tests.flatMap((t) => t.dimensions));
  if (!dims.has('negative')) warnings.push('Bộ testcase chưa có case [Negative] nào — mọi chức năng nên có ≥1 negative');
  const highs = doc.tests.filter((t) => RISK_HIGH.test(String(t.risk || '').trim()));
  if (highs.length && !dims.has('boundary') && !dims.has('security')) {
    warnings.push(`Có ${highs.length} case High-risk nhưng chưa thấy [Boundary]/[Security] — chạy risk:gate:enforce để ép depth`);
  }
  return { problems, warnings };
}

module.exports = { validate, REQUIRED_COLS, REQUIRED_FIELDS };
