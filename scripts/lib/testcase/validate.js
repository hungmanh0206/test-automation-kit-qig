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
    // Ô ⚠ của ma trận §7b: không cấm, nhưng phải có lý do dịch bậc — nếu không thì 1 trong 2 cột chấm sai.
    if (/^blocker$/i.test(r) && /^(medium|low|lowest)$/i.test(p)) warnings.push(`${id}: ô ⚠ trong ma trận §7b — \`Severity\` Blocker nhưng \`Ưu tiên\` ${p}. Hợp lệ khi chức năng CHƯA bật cho người dùng / sắp bỏ; phải ghi lý do dịch bậc trong \`Assumptions\`. Đừng hạ Severity cho "đẹp ô" — phạm vi hẹp là lý do hạ Ưu tiên, không phải hạ Severity.`);
    else if (RISK_HIGH.test(r) && /^(low|lowest)$/i.test(p)) warnings.push(`${id}: ô ⚠ trong ma trận §7b — \`Severity\` ${r} (mất dữ liệu/sai tiền/bảo mật) nhưng \`Ưu tiên\` ${p}; ghi lý do dịch bậc hoặc sửa 1 trong 2 cột.`);
    if (RISK_LOW.test(r) && /^highest$/i.test(p)) warnings.push(`${id}: ô ⚠ trong ma trận §7b — \`Severity\` ${r} (hiển thị/thẩm mỹ, dữ liệu dưới đúng) nhưng \`Ưu tiên\` Highest. Hợp lệ khi khách nhìn trực tiếp lúc trả tiền / sắp demo; phải ghi lý do trong \`Assumptions\`.`);
  }
  // 2d) THANG CŨ (set-level, 1 lần/file) — bộ TC cũ dùng High/Medium/Low thì nhắc chuyển, KHÔNG chặn và
  // KHÔNG cảnh báo từng dòng (530 dòng cảnh báo = tiếng ồn, sẽ bị lướt).
  {
    const legacy = doc.tests.filter((t) => RISK_LEGACY.test(String(t.risk || '').trim())).length;
    const modern = doc.tests.filter((t) => SEVERITY_OK.test(String(t.risk || '').trim())).length;
    if (legacy && !modern) warnings.push(`Bộ này dùng thang rủi ro CŨ 3 mức (${legacy} TC) — task mới dùng \`Severity\`: Blocker|Critical|Major|Minor|Trivial (§8). Bộ cũ không cần chuyển.`);
    else if (legacy && modern) warnings.push(`Bộ này TRỘN 2 thang: ${modern} TC dùng Severity 5 mức, ${legacy} TC còn thang cũ 3 mức — thống nhất 1 thang trong cùng một bộ để lọc/thống kê không lệch.`);
  }
  /*
   * 2e) PRE-CODE ↔ CATALOG — mã tiền điều kiện phải neo được vào catalog Setup Strategy.
   * Tiền điều kiện chỉ là TEXT
   * trong case ⇒ mã trỏ vào hư không vẫn publish trót lọt, và Phase 2 KHÔNG có gì để dựng precondition đó.
   * Chỉ kiểm khi file CÓ catalog (`doc.setup`): file chỉ-testcase thì không phán, tránh báo oan.
   */
  if ((doc.setup || []).length) {
    const declared = new Set(doc.setup.map((s) => String(s.preId || '').toUpperCase().match(/PRE-\d+/g) || []).flat());
    const usedBy = new Map();
    for (const tc of doc.tests) {
      for (const code of String(tc.precondition || '').toUpperCase().match(/PRE-\d+/g) || []) {
        if (!usedBy.has(code)) usedBy.set(code, []);
        usedBy.get(code).push(tc.tcId || '(no-id)');
      }
    }
    const orphan = [...usedBy.keys()].filter((c) => !declared.has(c));
    if (orphan.length) {
      problems.push(`${orphan.length} mã tiền điều kiện KHÔNG có trong catalog Setup Strategy: ${orphan.slice(0, 6).map((c) => `[${c}] (vd ${usedBy.get(c)[0]})`).join(', ')}${orphan.length > 6 ? ` …(+${orphan.length - 6})` : ''}. Trên AIO mã chỉ là text trong case — trỏ vào hư không thì Phase 2 không biết dựng gì. Khai vào sheet \`Preconditions\` hoặc sửa mã ở case.`);
    }
    const unused = [...declared].filter((c) => !usedBy.has(c));
    if (unused.length) warnings.push(`${unused.length} mã khai trong catalog mà KHÔNG case nào dùng: ${unused.slice(0, 8).join(', ')}${unused.length > 8 ? ' …' : ''} — hoặc thiếu case, hoặc catalog còn rác của lượt trước.`);

    /*
     * ĐỘ ĐẦY ĐỦ CỦA CATALOG (cấp bộ, 1 dòng — không spam từng row).
     * Template khai 9 cột nhưng bộ thật đo được chỉ có 4 (thiếu Type/Source/Verification/Cleanup/Readiness),
     * và không gì kêu. Thiếu `Cleanup` là thiếu đúng phần khiến precondition dựng-rồi-không-dọn — chính là
     * nguồn của case sau chạy trên state bẩn. Cảnh báo chứ không chặn: bộ cũ không nên bị khoá cứng.
     */
    const has = (f) => doc.setup.some((s) => String(s[f] || '').trim());
    const miss = [['cleanup', 'Cleanup/Rollback'], ['verification', 'Setup Verification'], ['type', 'Precondition Type']].filter(([f]) => !has(f)).map(([, label]) => label);
    if (miss.length) warnings.push(`Catalog Setup Strategy thiếu hẳn cột: ${miss.join(', ')} (đo trên ${doc.setup.length} dòng). Thiếu Cleanup = precondition dựng rồi không dọn ⇒ case sau chạy trên state bẩn; thiếu Verification = không biết đã dựng xong chưa. Template đầy đủ ở prompt gen §Setup Strategy.`);
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
