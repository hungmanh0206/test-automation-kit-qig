/**
 * deviation.js — SỔ GHI NHÂN NHƯỢNG: mọi lần lệch khỏi kịch bản đều để lại dấu.
 *
 * VÌ SAO CÓ FILE NÀY (rủi ro đặc thù của agent, không phải của người): khi gặp trở ngại, agent có xu hướng **làm
 * cho nó chạy** — chờ thêm, thử locator khác, refresh, đi đường khác. Mỗi lần như vậy là **một bug tiềm năng bị
 * lấp**: nút không bấm được vì bị overlay che (bug thật) sẽ biến thành "chờ thêm 3s rồi bấm được" (case xanh).
 *
 * Kit đã gác rất chặt phần locator (`locator_healing_policy`: mặc định tắt, không bao giờ heal assertion locator),
 * nhưng nhân nhượng **dạng rộng** thì chưa có gì gác. File này là phần thiếu đó.
 *
 * Luật: case chỉ pass **sau khi** có deviation ⇒ verdict `PASS_WITH_DEVIATION`, phải liệt kê deviation trong
 * Actual, và xếp vào diện **nghi vấn cần review**. Deviation là TÍN HIỆU, không phải tiện lợi.
 *
 * Dùng trong script execute của task:
 *   const led = newLedger('OPS_PAY_TC_014');
 *   … if (!ok) { led.note('extra-wait', 'chờ thêm 3s vì nút chưa enable'); await sleep(3000); } …
 *   const v = led.verdict('PASS');     // → 'PASS_WITH_DEVIATION' nếu sổ không rỗng
 */

const KINDS = {
  'extra-wait': 'chờ thêm ngoài kịch bản — nghi timing/race hoặc UI chưa báo trạng thái',
  retry: 'thử lại cùng một hành động — nghi flaky HOẶC bug bất định',
  'alternate-locator': 'đổi cách định vị element — nghi UI đổi cấu trúc hoặc element bị che',
  refresh: 'tải lại trang để đi tiếp — nghi state không cập nhật (đúng lớp bug hay lọt)',
  'alternate-path': 'đi đường khác để tới cùng đích — đường chính có thể đang hỏng',
  'relax-assert': 'nới điều kiện kiểm — CẤM theo RULE_GLOBAL, ghi ở đây để lộ ra nếu ai làm',
};

function newLedger(tcId) {
  const entries = [];
  return {
    tcId,
    /** @param {keyof KINDS|string} kind @param {string} why */
    note(kind, why) {
      entries.push({ kind, why: String(why || ''), meaning: KINDS[kind] || 'lệch khỏi kịch bản (loại chưa khai)' });
      return entries.length;
    },
    list() { return entries.slice(); },
    count() { return entries.length; },
    /** PASS mà sổ không rỗng ⇒ PASS_WITH_DEVIATION. FAIL/SKIP giữ nguyên (deviation chỉ làm PASS đáng ngờ). */
    verdict(base) {
      if (String(base).toUpperCase() !== 'PASS') return base;
      return entries.length ? 'PASS_WITH_DEVIATION' : 'PASS';
    },
    /** Dòng để dán vào Actual — bắt buộc khi verdict là PASS_WITH_DEVIATION. */
    actualNote() {
      if (!entries.length) return '';
      return `Đã pass NHƯNG sau ${entries.length} lần lệch kịch bản: ${entries.map((e) => `${e.kind} (${e.why})`).join(' · ')}. Mỗi lệch là một bug tiềm năng bị lấp — cần review.`;
    },
  };
}

/**
 * Kiểm bản ghi execution: case nào ghi PASS trơn mà Actual lại kể chuyện lệch kịch bản ⇒ dấu hiệu nhân nhượng
 * bị che. Dùng từ khoá vì đây là văn bản người/agent viết, nên chỉ **cảnh báo**, không chặn.
 */
const DEVIATION_HINT = /(chờ thêm|đợi thêm|thêm wait|extra wait|retry|thử lại|refresh lại|tải lại trang|đổi locator|dùng selector khác|đi đường khác|workaround|lần thứ (hai|2|ba|3) mới)/i;

/**
 * Chuẩn hoá status qua **synonyms của taxonomy** (`PASSED` → `PASS`). Bản đầu so thẳng với 'PASS' nên bỏ qua sạch
 * 563 case của một bản ghi thật (chúng ghi `PASSED`) rồi trả về 0 — đúng loại "scanner quét rỗng vẫn báo ✓".
 */
function canonStatus(raw) {
  const s = String(raw || '').trim().toUpperCase().replace(/[\s_-]+/g, '_');
  try {
    // eslint-disable-next-line global-require
    const tax = require(require('path').resolve(__dirname, '..', '..', '..', '.agent', 'config', 'verdict_taxonomy.json'));
    if (tax.statuses && tax.statuses[s]) return s;
    if (tax.synonyms && tax.synonyms[s]) return tax.synonyms[s];
  } catch (e) { /* thiếu taxonomy thì rơi về suy luận tối thiểu */ }
  return s === 'PASSED' ? 'PASS' : s;
}

/**
 * @param {Array} cases bản ghi execution
 * @param {Object} tcById  map tcId → testcase canonical (title/steps) — BẮT BUỘC để tránh báo oan:
 *   "Retry"/"tải lại trang" có thể là **nội dung của chính case** (TC_034 test retry sau sync fail; TC_462 tua đồng
 *   hồ rồi tải lại để xem bộ đếm). Đo trên bản ghi thật: không đối chiếu thì 2/2 cảnh báo đều OAN.
 */
function auditExecution(cases, tcById = {}) {
  const warnings = [];
  for (const c of cases || []) {
    const status = canonStatus(c.status);
    const text = `${c.actual || ''} ${c.note || ''} ${c.comment || ''}`;
    if (status !== 'PASS' || !DEVIATION_HINT.test(text)) continue;
    const m = text.match(DEVIATION_HINT);
    const tc = tcById[c.tcId || c.id] || {};
    const own = `${tc.title || ''} ${tc.stepsRaw || tc.steps || ''} ${tc.expectedRaw || tc.expected || ''}`;
    // Từ khoá nằm trong CHÍNH kịch bản của case ⇒ đó là chủ đề test, không phải nhân nhượng.
    if (DEVIATION_HINT.test(own)) continue;
    warnings.push(`${c.tcId || c.id || '(không rõ case)'}: ghi PASS trơn nhưng Actual kể "${m[0]}" mà kịch bản case KHÔNG có bước đó ⇒ nghi nhân nhượng; đúng phải là PASS_WITH_DEVIATION kèm liệt kê deviation.`);
  }
  return warnings;
}

module.exports = { KINDS, newLedger, auditExecution, DEVIATION_HINT, canonStatus };
