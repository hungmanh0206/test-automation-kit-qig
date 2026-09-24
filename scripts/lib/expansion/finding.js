/**
 * finding.js — hạt nhân của phần MỞ RỘNG QUANH CASE: biến quan sát thành **finding có neo**.
 *
 * VÌ SAO TỒN TẠI (đây là chỗ dễ làm hỏng cả ý tưởng 5 trục): khi mở sang field lân cận / bề mặt khác, kit phải
 * biết **cái đúng là gì**. Không có nguồn thì mặc định "app đang hiện thế là đúng" ⇒ tautology, và nhân lên theo
 * số trục. Lúc đó không giảm bug lọt mà **sản xuất PASS giả nhìn rất thuyết phục**.
 *
 * Bằng chứng đây không phải lo xa: `persistence_probe` bản đầu trả `ok: true` khi 4 điểm khớp nhau. Test của
 * chính nó (case CSDL-28403, USD không quy đổi) có `form/payload/api/ui = 10` — **khớp cả 4 mà sai cả 4**, giá
 * trị đúng phải là 260.500. Tên field `ok` chính là mầm PASS giả.
 *
 * BA LOẠI KẾT LUẬN — luật cứng:
 *   1. `EXPANSION_FINDING` — app **tự mâu thuẫn với chính nó** (giá trị lệch giữa 2 bề mặt, mắt đứt trong chuỗi
 *      lưu trữ, field thừa/thiếu so tài liệu). Đây là defect **không cần oracle ngoài**: hai nơi cùng nguồn mà
 *      khác nhau thì chắc chắn có một nơi sai. Được log bug. KHÔNG phải verdict của case gốc.
 *   2. `PASS` / `FAIL` — CHỈ khi có `oracle_ref` (`BR-`/`SM-`/`PM-`/`SS-`/`DM-`/`UI-`) và `expected` lấy từ đó.
 *   3. `OBSERVATION` — quan sát được nhưng **không có oracle**: nhất quán ≠ đúng. Bắt buộc kèm `open_question`.
 *      Không tính vào pass-rate, không log bug.
 *
 * Nói cách khác: **nhất quán KHÔNG phải bằng chứng của đúng**; nó chỉ loại được một lớp sai.
 */

const fs = require('fs');
const path = require('path');

// Trục mở rộng. ①②③ cần runtime (DOM/response thật) ⇒ thuộc Phase 2. ④⑤ sinh case được từ tài liệu
// (permission matrix / state machine) ⇒ CASE thuộc Phase 1, Phase 2 chỉ đo "ô nào chạy được".
const AXES = {
  field: { id: '①field', label: 'Field cùng khối', phase: 2, hasDocOracle: true },
  surface: { id: '②surface', label: 'Cùng giá trị, khác nơi hiển thị', phase: 2, hasDocOracle: false },
  persist: { id: '③persist', label: 'Chuỗi lưu trữ form→payload→API→UI', phase: 2, hasDocOracle: false },
  branch: { id: '④branch', label: 'Nhánh/biến thể', phase: 1, hasDocOracle: true },
  state: { id: '⑤state', label: 'Trạng thái kế cận', phase: 1, hasDocOracle: true },
  concurrency: { id: '⑥concurrency', label: 'Lặp & đồng thời (idempotency/race)', phase: 2, hasDocOracle: false },
  reverse: { id: '⑦reverse', label: 'Chiều ngược (hủy/hoàn → về trạng thái cũ)', phase: 2, hasDocOracle: false },
};

// Oracle hợp lệ = id trong knowledge store, KHÔNG phải "theo tôi thấy". UI- dành cho contract FE trích từ design.
const ORACLE_RE = /^(BR|SM|PM|SS|DM|UI)-[A-Z0-9]+-\d{3}$/;

const VERDICTS = ['EXPANSION_FINDING', 'PASS', 'FAIL', 'OBSERVATION'];

/**
 * Quyết định verdict theo luật trên. `selfInconsistent` = app tự mâu thuẫn (đo được, không cần oracle).
 * @returns {{verdict: string, reason: string, downgraded?: string}}
 */
function decide({ selfInconsistent, oracleRef, expected, actual }) {
  const hasOracle = ORACLE_RE.test(String(oracleRef || ''));
  if (selfInconsistent) {
    return { verdict: 'EXPANSION_FINDING', reason: 'app tự mâu thuẫn với chính nó — có một nơi sai, không cần oracle ngoài' };
  }
  if (!hasOracle) {
    return {
      verdict: 'OBSERVATION',
      reason: 'không có `oracle_ref` hợp lệ ⇒ nhất quán KHÔNG phải bằng chứng của đúng; phải kèm open_question',
      downgraded: 'PASS→OBSERVATION',
    };
  }
  const same = String(expected).replace(/\s+/g, '') === String(actual).replace(/\s+/g, '');
  return same
    ? { verdict: 'PASS', reason: `khớp oracle ${oracleRef}` }
    : { verdict: 'FAIL', reason: `lệch oracle ${oracleRef}: cần "${expected}", thấy "${actual}"` };
}

/** Dựng một finding đã chuẩn hoá + tự hạ cấp nếu thiếu neo. Không bao giờ trả PASS khi thiếu oracle. */
function makeFinding(input) {
  const axis = String(input.axis || '').replace(/^[①②③④⑤⑥⑦]/, '');
  const meta = AXES[axis] || AXES[String(input.axis || '')] || null;
  const d = decide({
    selfInconsistent: !!input.self_inconsistent,
    oracleRef: input.oracle_ref,
    expected: input.expected,
    actual: input.actual,
  });
  const f = {
    axis: meta ? meta.id : String(input.axis || '?'),
    base_tc: input.base_tc || null,               // finding thuộc case NÀO — để triage nối lại được
    surface: input.surface || null,               // đo ở đâu (URL/endpoint/khối)
    expected: input.expected === undefined ? null : String(input.expected),
    actual: input.actual === undefined ? null : String(input.actual),
    oracle_ref: ORACLE_RE.test(String(input.oracle_ref || '')) ? input.oracle_ref : null,
    verdict: d.verdict,
    reason: d.reason,
    evidence: input.evidence || null,
  };
  if (d.downgraded) f.downgraded = d.downgraded;
  if (f.verdict === 'OBSERVATION') {
    f.open_question = input.open_question
      || `Giá trị này đúng theo nguồn nào? Chưa có ${meta && meta.hasDocOracle ? 'rule/bản đồ' : 'oracle ngoài app'} để đối chiếu — cần BA/Dev xác nhận rồi ghi thành BR-/SM-/UI-.`;
  }
  if (input.oracle_ref && !f.oracle_ref) {
    f.oracle_invalid = `"${input.oracle_ref}" không đúng dạng id knowledge (BR|SM|PM|SS|DM|UI)-XXX-000 ⇒ bị bỏ, coi như KHÔNG có oracle`;
  }
  return f;
}

/** Kiểm một mảng finding (kể cả file đã bị sửa tay) — trả về danh sách vi phạm luật oracle. */
function auditFindings(findings) {
  const bad = [];
  for (const f of findings || []) {
    if (!VERDICTS.includes(f.verdict)) { bad.push(`${f.axis || '?'} · verdict "${f.verdict}" không thuộc ${VERDICTS.join('/')}`); continue; }
    if ((f.verdict === 'PASS' || f.verdict === 'FAIL') && !ORACLE_RE.test(String(f.oracle_ref || ''))) {
      bad.push(`${f.axis} · ${f.base_tc || '(không rõ case)'}: verdict ${f.verdict} mà KHÔNG có oracle_ref hợp lệ — mở rộng không có neo thì chỉ được OBSERVATION`);
    }
    if (f.verdict === 'OBSERVATION' && !String(f.open_question || '').trim()) {
      bad.push(`${f.axis} · ${f.base_tc || '(không rõ case)'}: OBSERVATION mà thiếu open_question — quan sát không có câu hỏi thì sẽ tan theo lượt chạy`);
    }
  }
  return bad;
}

function summarize(findings) {
  const by = { EXPANSION_FINDING: 0, PASS: 0, FAIL: 0, OBSERVATION: 0 };
  for (const f of findings || []) if (by[f.verdict] !== undefined) by[f.verdict] += 1;
  return by;
}

/**
 * Ghi findings ra file để gate/triage đọc được. Có dòng máy `<!-- gate: … -->` như các báo cáo khác.
 * `proven` = số finding có neo (PASS/FAIL) + số EXPANSION_FINDING; `inconclusive` = số OBSERVATION.
 */
function writeFindings(taskDir, findings, opts = {}) {
  const dir = path.join(taskDir, 'test-results');
  fs.mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, 'expansion_findings.json');
  let prev = [];
  if (opts.append && fs.existsSync(jsonPath)) {
    try { prev = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).findings || []; } catch (e) { prev = []; }
  }
  const all = [...prev, ...findings];
  const by = summarize(all);
  const violations = auditFindings(all);
  fs.writeFileSync(jsonPath, `${JSON.stringify({ _schema: 'expansion_findings/1', summary: by, violations, findings: all }, null, 2)}\n`);

  const md = [
    `<!-- gate: proven=${by.EXPANSION_FINDING + by.PASS + by.FAIL} inconclusive=${by.OBSERVATION} broken=${violations.length} -->`,
    '# Finding từ mở rộng quanh case (5 trục)',
    '',
    '> **Nhất quán ≠ đúng.** Chỉ được `PASS`/`FAIL` khi có `oracle_ref` trỏ knowledge (`BR-`/`SM-`/`PM-`/`SS-`/',
    '> `DM-`/`UI-`). App tự mâu thuẫn ⇒ `EXPANSION_FINDING` (log bug được, KHÔNG phải verdict của case gốc).',
    '> Không có neo ⇒ `OBSERVATION` + câu hỏi mở, không tính vào pass-rate.',
    '',
    `- EXPANSION_FINDING **${by.EXPANSION_FINDING}** · PASS **${by.PASS}** · FAIL **${by.FAIL}** · OBSERVATION **${by.OBSERVATION}**`,
    '',
    '| Trục | Case gốc | Bề mặt | Cần | Thấy | Oracle | Verdict |',
    '|---|---|---|---|---|---|---|',
    ...all.map((f) => `| ${f.axis} | ${f.base_tc || '—'} | ${f.surface || '—'} | ${f.expected ?? '—'} | ${f.actual ?? '—'} | ${f.oracle_ref || '_(không có)_'} | ${f.verdict} |`),
  ];
  if (violations.length) md.push('', '## Vi phạm luật oracle (phải sửa)', '', ...violations.map((v) => `- ${v}`));
  const mdPath = path.join(taskDir, 'reports', 'expansion-findings.md');
  fs.mkdirSync(path.dirname(mdPath), { recursive: true });
  fs.writeFileSync(mdPath, `${md.join('\n')}\n`);
  return { jsonPath, mdPath, summary: by, violations };
}

module.exports = { AXES, ORACLE_RE, VERDICTS, decide, makeFinding, auditFindings, summarize, writeFindings };
