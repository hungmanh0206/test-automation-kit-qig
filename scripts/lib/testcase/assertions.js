/**
 * assertions.js — VERIFICATION THEO ASSERTION, không theo bước.
 *
 * VÌ SAO CÓ FILE NÀY: đo trên bản ghi thật (530 case) thấy **68% case ghi ít verification hơn số assertion** trong
 * "Kết quả mong đợi" (135 case lệch ≥2). Nhưng con số đó chỉ là **proxy**: `steps[]` là bằng chứng theo *bước*, nên
 * không chứng minh được "assertion nào chưa ai kiểm". Vì thiếu dữ liệu đúng chiều, gate chỉ dám **cảnh báo** —
 * chặn ngay sẽ làm đỏ 2/3 bản ghi mà chưa chắc thiếu kiểm thật.
 *
 * File này tạo ra dữ liệu đúng chiều: mỗi **assertion nguyên tử** (một dòng trong "Kết quả mong đợi") có một
 * `verified` + `evidence` riêng. Có nó rồi thì "thiếu kiểm" là **sự thật đọc được**, không phải suy luận ⇒ gate mới
 * được phép chặn. Đây là điều kiện tiên quyết của mục 13 trong RULE_GLOBAL.
 *
 * Hợp đồng (thêm vào bản ghi execution, TÙY CHỌN để không phá bản ghi cũ):
 *   { tcId, status, assertions: [{ text, verified: true|false, evidence: "path/anh.png", note? }] }
 */

const SPLIT = /<br\s*\/?>|\r?\n/;
/** Đánh số đầu dòng của format canonical ("1. …") không phải nội dung assertion. */
const stripNum = (s) => String(s || '').replace(/^\s*\d+\s*[.)]\s*/, '').trim();

/**
 * Tách "Kết quả mong đợi" của một testcase canonical thành các assertion NGUYÊN TỬ.
 * Mỗi dòng = 1 assertion. Dòng nhồi nhiều điều kiện ("A, và B, đồng thời C") được ĐÁNH DẤU chứ không tự tách —
 * tự tách bằng dấu phẩy sẽ cắt sai ngay ở những câu có số ("1.234.567, đúng format") và làm gate mất uy tín.
 */
function deriveAssertions(tc) {
  const raw = String((tc && (tc.expectedRaw || tc.expected)) || '');
  return raw.split(SPLIT).map(stripNum).filter(Boolean).map((text) => {
    // KHÔNG dùng `\b` sau từ có dấu: "và" kết thúc bằng "à" — không phải word-char trong regex JS — nên `\b` là
    // biên KHÔNG BAO GIỜ khớp. Đây là lần thứ TƯ trong phiên mắc đúng bẫy này, và máy gác vệ sinh source không bắt
    // được vì `\b` ở đây hợp lệ về cú pháp, chỉ sai về ngữ nghĩa với tiếng Việt.
    const compound = /,\s*(và|kèm|đồng thời|cùng với)/i.test(text) || (text.match(/;/g) || []).length >= 1;
    return compound ? { text, verified: false, evidence: null, compound: true } : { text, verified: false, evidence: null };
  });
}

const emptyish = (v) => !String(v == null ? '' : v).trim();

/**
 * Kiểm một case: assertion nào chưa có verification/bằng chứng.
 * @returns {{blocking: string[], warnings: string[], covered: number, total: number}}
 */
function auditCase(c, opts = {}) {
  const blocking = [];
  const warnings = [];
  const id = c.tcId || c.id || '(không rõ case)';
  const list = Array.isArray(c.assertions) ? c.assertions : null;
  if (!list) return { blocking, warnings, covered: 0, total: 0, hasData: false };

  let covered = 0;
  list.forEach((a, i) => {
    const label = `${id} · assertion ${i + 1} ("${String(a.text || '').slice(0, 60)}")`;
    if (emptyish(a.text)) { blocking.push(`${id} · assertion ${i + 1}: thiếu "text"`); return; }
    if (a.verified === true) {
      covered += 1;
      // PASS mà không có bằng chứng thì không kiểm lại được — evidence là điều kiện của kit, không phải tùy chọn.
      if (emptyish(a.evidence) && opts.requireEvidence !== false) blocking.push(`${label}: verified=true nhưng KHÔNG có evidence`);
    } else if (emptyish(a.note)) {
      // Chưa kiểm thì phải nói VÌ SAO — "chưa kiểm" im lặng chính là chỗ assertion lọt.
      blocking.push(`${label}: chưa verified và cũng KHÔNG có "note" giải thích vì sao`);
    } else {
      warnings.push(`${label}: chưa verified — lý do: ${String(a.note).slice(0, 80)}`);
    }
    if (a.compound) warnings.push(`${label}: một dòng NHỒI nhiều điều kiện — tách nguyên tử ở Phase 1 để mỗi điều kiện có bằng chứng riêng`);
  });
  return { blocking, warnings, covered, total: list.length, hasData: true };
}

/** Kiểm cả bản ghi. Case KHÔNG có `assertions` ⇒ chỉ đếm để báo tỉ lệ áp dụng, không chặn (bản ghi cũ). */
function auditExecution(cases, opts = {}) {
  const blocking = [];
  const warnings = [];
  let withData = 0;
  let covered = 0;
  let total = 0;
  for (const c of cases || []) {
    const r = auditCase(c, opts);
    if (!r.hasData) continue;
    withData += 1;
    covered += r.covered;
    total += r.total;
    blocking.push(...r.blocking);
    warnings.push(...r.warnings);
  }
  const all = (cases || []).length;
  return {
    blocking,
    warnings,
    adoption: all ? Math.round((withData / all) * 100) : 0,
    withData,
    all,
    coverage: total ? Math.round((covered / total) * 100) : 0,
    covered,
    total,
  };
}

module.exports = { deriveAssertions, auditCase, auditExecution };
