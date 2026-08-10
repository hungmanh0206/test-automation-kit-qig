'use strict';

/*
 * output_rules.js — Rule chất lượng output máy-kiểm-được, DÙNG CHUNG cho các gate
 * (push_test_execution, bug_reporter, và các phase khác về sau).
 *
 * Mục tiêu: biến rule prose trong RULE_GLOBAL/prompt thành hàm thuần để gate:
 *   - AUTO-FIX phần deterministic an toàn (strip prefix status, strip debug token).
 *   - PHÁT HIỆN + báo phần không tự sửa an toàn được (run-on, thiếu evidence, thiếu video)
 *     → gate chặn, agent tự sửa trong session (không nhồi auto-fix dễ sai ngữ nghĩa).
 *
 * Không phụ thuộc gì ngoài path — an toàn để require ở bất kỳ script nào.
 */

const VISUAL_EXT = /\.(png|jpe?g|webp|gif|bmp|mp4|webm|mov|m4v)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

const isVisualEvidence = (p) => VISUAL_EXT.test(String(p || ''));
const isVideoEvidence = (p) => VIDEO_EXT.test(String(p || ''));

// Prefix trạng thái thừa ở đầu comment (status đã có badge riêng trên Test Run).
const STATUS_PREFIX = /^\s*\[(pass|passed|fail|failed|positive|negative)\]\s*/i;

// Dấu vết debug bị cấm trong comment (RULE_GLOBAL §"Comment kết quả").
const DEBUG_TOKEN = /(?:\b[\w.]+=(?:true|false|null|\d[\d.]*|"[^"]*"|'[^']*'))|(?:\b\w+\s*→\s*\w+)|(?:\bmatched=\[[^\]]*\])|(?:\bval="[^"]*")/i;
const hasDebugTokens = (t) => DEBUG_TOKEN.test(String(t || ''));

// Số thô kiểu tiền/timestamp máy (gợi ý format lại — chỉ cảnh báo, không auto-đổi để tránh sai đơn vị).
const RAW_MONEY = /(?<![\d.,])\d{7,}(?![\d.,])/;

// Tách "ý" trong 1 chuỗi: theo xuống dòng, dấu ; , hoặc ranh giới câu.
function splitIdeas(text) {
  return String(text || '')
    .split(/\r?\n|;\s*|(?<=[.。!?])\s+(?=[A-ZĐÀ-Ỹ0-9])/)
    .map((s) => s.replace(/^\s*[-*•]\s*/, '').trim())
    .filter((s) => s.length > 2);
}

// Comment run-on = 1 đoạn dài KHÔNG bullet nhồi nhiều ý (RULE_GLOBAL §comment mục 4).
function looksRunOn(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  const lines = t.split(/\r?\n/).filter((l) => l.trim());
  if (lines.some((l) => /^\s*[-*•]\s+/.test(l))) return false; // đã có bullet → OK
  const ideas = splitIdeas(t);
  if (t.length > 160 && ideas.length >= 2) return true;
  if (ideas.length >= 3) return true;
  // Chuỗi mệnh đề nối bằng "và"/phẩy trên 1 dòng — kiểu "1 mạch text nhồi nhiều ý".
  // (dùng split theo khoảng trắng vì \b không nhận diện được từ có dấu tiếng Việt)
  const andCount = t.split(/\s+(?:và|nhưng|đồng thời|ngoài ra|cũng như)\s+/i).length - 1;
  const commas = (t.match(/[,;]/g) || []).length;
  if (andCount >= 3) return true;                            // ≥3 liên từ nối clause = nhồi nhiều ý
  if (andCount + commas >= 4 && t.length > 80) return true;  // hỗn hợp nhiều dấu ngắt + dài
  return false;
}

/**
 * AUTO-FIX an toàn cho comment Xray: bỏ prefix status + xoá cụm debug trong ngoặc.
 * KHÔNG tự tách run-on thành bullet (dễ sai ngữ nghĩa tiếng Việt) — để gate chặn, agent tự viết lại.
 * @returns {{ text, changed, notes }}
 */
function cleanComment(text) {
  let t = String(text || '').trim();
  const notes = [];
  if (STATUS_PREFIX.test(t)) { t = t.replace(STATUS_PREFIX, '').trim(); notes.push('bỏ prefix [PASS]/[FAIL]'); }
  // Xoá cụm ngoặc chỉ chứa debug token, vd " (editable=false, atGateway=true)".
  const before = t;
  t = t.replace(/\s*\(([^()]*)\)/g, (m, inner) => (hasDebugTokens(inner) && !/[.,]/.test(inner.replace(DEBUG_TOKEN, '')) ? ' ' : m)).replace(/\s{2,}/g, ' ').trim();
  if (t !== before) notes.push('xoá cụm debug key=value');
  return { text: t, changed: notes.length > 0, notes };
}

/**
 * Lint 1 comment case → danh sách vi phạm CHẶN (sau khi đã cleanComment).
 * @returns {string[]} lý do vi phạm (rỗng = đạt)
 */
function lintComment(text) {
  const problems = [];
  const t = String(text || '').trim();
  if (looksRunOn(t)) problems.push('comment run-on (nhiều ý dồn 1 dòng) → tách mỗi ý 1 dòng "- …"');
  if (hasDebugTokens(t)) problems.push('còn dấu vết debug (key=value / A→A / matched=[…]) → viết lại thành ý người đọc hiểu');
  if (STATUS_PREFIX.test(t)) problems.push('mở đầu bằng [PASS]/[FAIL] (thừa — status đã có badge)');
  return problems;
}

/**
 * Gợi ý case PHỨC TẠP (cần video) từ tên/mô tả (RULE_GLOBAL mục 4 evidence + prompt log bug).
 */
const COMPLEX_HINT = /thanh toán|payment|cổng|gateway|async|bất đồng bộ|đồng bộ|sync|nhiều màn|multi.?screen|iframe|popup|modal|toast|drag|drop|upload|realtime|websocket|debounce|pagination|refund|hoàn tiền|webhook|end.?to.?end|e2e/i;
const looksComplex = (text) => COMPLEX_HINT.test(String(text || ''));

/**
 * Lint bộ evidence của 1 case đã execute.
 * @param {object} opts { evidences: string[], isComplex: bool, requireVideoWhenComplex: bool }
 */
function lintEvidence({ evidences = [], isComplex = false, requireVideoWhenComplex = true } = {}) {
  const problems = [];
  const visual = evidences.filter(isVisualEvidence);
  const nonVisual = evidences.filter((e) => e && !isVisualEvidence(e));
  if (!visual.length) problems.push('thiếu evidence ảnh/video (bắt buộc cho case đã execute)');
  if (nonVisual.length) problems.push(`có evidence KHÔNG phải ảnh/video (${nonVisual.map((e) => e.split(/[\\/]/).pop()).join(', ')}) → chỉ ảnh/video`);
  if (isComplex && requireVideoWhenComplex && !evidences.some(isVideoEvidence)) {
    problems.push('case phức tạp nhưng THIẾU video (ảnh không mô tả đủ chuỗi thao tác) → rerun quay video');
  }
  return problems;
}

/**
 * Lint description bug đã build (mảng heading) — phải ĐÚNG 4 phần, đúng thứ tự (prompt 08 §Description).
 */
const BUG_SECTIONS = ['Tiền điều kiện', 'Bước', 'Kết quả hiện tại', 'Kết quả mong muốn'];
function lintBugHeadings(headings = []) {
  const problems = [];
  const norm = headings.map((h) => String(h || '').replace(/[:.]$/, '').trim());
  if (norm.length !== BUG_SECTIONS.length) problems.push(`description có ${norm.length} phần, phải ĐÚNG 4 (${BUG_SECTIONS.join(' / ')})`);
  BUG_SECTIONS.forEach((s, i) => { if (norm[i] && norm[i].toLowerCase() !== s.toLowerCase()) problems.push(`phần ${i + 1} là "${norm[i]}", phải là "${s}"`); });
  const extra = norm.filter((h) => !BUG_SECTIONS.some((s) => s.toLowerCase() === h.toLowerCase()));
  if (extra.length) problems.push(`phần thừa cấm đưa vào description: ${extra.join(', ')} (ghi ở report local)`);
  return problems;
}

// ---- Gen testcase: cột "Các bước thực hiện" / "Kết quả mong đợi" (RULE_GLOBAL + prompt 02 §6) ----

// Gộp range kiểu "1-2." / "2–3.)" ở đầu dòng (bên trong cell ngăn bằng <br>).
const RANGE_GROUP = /(?:^|<br\s*\/?>|\n|\s)\d+\s*[-–—]\s*\d+\s*[.)]/;
const hasRangeGrouping = (t) => RANGE_GROUP.test(String(t || ''));

// Số thứ tự ở đầu mỗi dòng (tách theo <br>) — để so bước vs kết quả.
function leadingNumbers(cell) {
  return String(cell || '').split(/<br\s*\/?>|\r?\n/)
    .map((l) => { const m = l.trim().match(/^(\d+)\s*[.)]/); return m ? Number(m[1]) : null; })
    .filter((n) => n != null);
}

// Kết quả mong đợi CHUNG CHUNG (cấm ghi trơ mỗi "thành công"/"đúng"/"báo lỗi"...).
const VAGUE_EXPECTED = /^(thành công|thất bại|báo lỗi|có lỗi|hiển thị đúng|hiển thị bình thường|hoạt động (bình thường|đúng)|đúng|ok|pass|thành công\.)$/i;
function vagueExpectedLines(cell) {
  return String(cell || '').split(/<br\s*\/?>|\r?\n/)
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
    .filter((l) => l && VAGUE_EXPECTED.test(l));
}

// ---- G2 (round-3): FAIL phân tầng lỗi · oracle tautology (app==app) ----

// FAIL đã được PHÂN TẦNG khi comment/root-cause nêu rõ tầng: product/API bug, setup, infra, flaky,
// data/quyền/precondition, hoặc gắn Jira key (đã log bug). Thiếu hết = "không phán được" → CHẶN.
const FAILURE_LAYER = new RegExp([
  'lỗi sản phẩm', 'product bug', 'api bug', 'api contract', '\\bbug\\b', '\\bdefect\\b',
  'sai (nghiệp vụ|kết quả|logic|công thức|số liệu|dữ liệu)',
  'setup[_ ]?failure', 'blocked[_ ]?setup', 'skip[_ ]?setup', 'precondition',
  'thiếu (data|dữ liệu|quyền|capability|hook|mock|sandbox|account|fixture)',
  'môi trường', '\\binfra\\b', 'hạ tầng', '\\bflaky\\b', 'chập chờn', '\\btimeout\\b',
  'regression', 'dependency', '\\bauth\\b', '\\b[A-Z][A-Z0-9]+-\\d{2,}\\b',
  // script_error: lỗi CỦA SCRIPT test (bắt sai element/locator mơ hồ, click nhầm, đọc sai vùng).
  // Bắt buộc nhận diện được — nếu không, FAIL kiểu này bị dồn thành product bug → LOG BUG SAI.
  'script[_ ]?error', 'lỗi script', 'sai (locator|selector|element)', 'locator (sai|mơ hồ)',
  'bấm nhầm', 'click nhầm', 'bắt nhầm', 'sai (màn|vùng|section)',
].join('|'), 'i');
const hasFailureLayer = (text) => FAILURE_LAYER.test(String(text || ''));

// Oracle tautology = đối chiếu chính output của app với chính nó (app==app) thay vì giá trị spec
// độc lập. Heuristic bảo thủ (chỉ CẢNH BÁO) — bắt các cụm tự-tham-chiếu rõ ràng.
const TAUTOLOGY_HINT = new RegExp([
  'như (trên )?hệ thống', 'theo (đúng )?hệ thống',
  '(hệ thống|app|giao diện) (trả về|hiển thị) (đúng|khớp)',
  'đúng với (dữ liệu (hiện có|trên hệ thống)|response|api)',
  'đúng như (response|api trả về|hệ thống)',
  'khớp với (response|hệ thống|api)',
  'match(es)? (the )?(system|response|app|api)',
].join('|'), 'i');
const looksTautology = (text) => TAUTOLOGY_HINT.test(String(text || ''));

// ---- Oracle "BẰNG NGUỒN" cho case mapping/đồng bộ dữ liệu ----
// Vì sao: rà một task thật thấy cả cụm bug BE↔FE mapping lọt lưới vì kết luận chỉ ở mức "CÓ dữ liệu"
// ("map đủ field", "giá trị populate", "hiển thị đúng") — một field lấy nhầm nguồn/nhầm property VẪN
// populate nên vẫn PASS. Case mapping chỉ có giá trị khi đối chiếu ĐƯỢC HAI ĐẦU: giá trị hiển thị vs giá trị
// nguồn. Ở đây chỉ kiểm dấu vết của phép đối chiếu đó trong kết luận — rẻ, nhưng chặn đúng loại PASS rỗng.
const MAPPING_CASE = new RegExp([
  'đồng bộ', 'dong bo', '\\bsync\\b', 'hubspot', '\\bdeal\\b',
  'mapping', 'map (sang|về|vào|từ)', 'ghi nhận (doanh thu|giá trị|số tiền)',
  'lấy (từ|theo) (contact|deal|api|hubspot|property)', 'hiển thị theo (dữ liệu|api|deal|contact)',
].join('|'), 'i');
const isMappingCase = (text) => MAPPING_CASE.test(String(text || ''));

// Kết luận kiểu "có dữ liệu là đạt" — vô dụng làm oracle mapping.
const PRESENCE_ONLY = new RegExp([
  'populate', 'có dữ liệu', 'co du lieu', 'không rỗng', 'khong rong', 'not empty',
  'map đủ', 'đủ field', 'du field', 'đầy đủ (field|trường|thông tin)',
  'hiển thị đúng', 'hien thi dung', 'hiển thị bình thường', 'render (ok|đúng)',
].join('|'), 'i');

// Dấu vết ĐỐI CHIẾU 2 đầu: có từ so sánh + ít nhất 2 giá trị cụ thể (số/chuỗi trong nháy/mã định danh).
const COMPARE_WORD = /(=|==|↔|->|→|\bvs\b|khớp|bằng|so với|so voi|đối chiếu|doi chieu|trùng khớp)/i;
const VALUE_TOKEN = /("[^"]{1,60}"|'[^']{1,60}'|[\w.+-]+@[\w.-]+|\b\d[\d.,]*\b|\b[a-z_]+_[a-z_]+\b|\b[A-Za-z][A-Za-z0-9]*\.[A-Za-z0-9_]+\b)/g;
function hasComparedPair(text) {
  const s = String(text || '');
  if (!COMPARE_WORD.test(s)) return false;
  const vals = s.match(VALUE_TOKEN) || [];
  return new Set(vals.map((v) => v.replace(/["']/g, ''))).size >= 2;
}

/**
 * Case mapping/đồng bộ mà kết luận KHÔNG có phép đối chiếu 2 đầu → vấn đề.
 * @returns {{problem:string}|null}
 */
function lintMappingOracle({ title = '', expected = '', comment = '' } = {}) {
  // Nhận diện trên cả comment: file testcase-status.json KHÔNG mang tiêu đề case, nên khi gate chạy chỉ có
  // kết luận để dựa vào. Comment của case mapping gần như luôn nhắc "đồng bộ"/"sync"/"HubSpot".
  if (!isMappingCase(`${title} ${expected} ${comment}`)) return null;
  if (hasComparedPair(comment)) return null;
  // Case negative/lỗi: oracle là MÃ LỖI cụ thể (400 + exceptions.x) — đó đã là oracle kiểm được, không đòi cặp giá trị.
  if (/\b[45]\d\d\b/.test(comment) && /exception|error|lỗi|không (đồng bộ|tạo|lưu)/i.test(comment)) return null;
  // CHẶN khi kết luận rơi vào mẫu "có dữ liệu là đạt" — mẫu này chắc chắn không bắt được lỗi mapping.
  if (PRESENCE_ONLY.test(comment)) {
    return { level: 'problem', message: 'case mapping/đồng bộ nhưng kết luận chỉ ở mức CÓ-dữ-liệu ("populate" / "có dữ liệu" / "map đủ field" / "hiển thị đúng") — field lấy NHẦM NGUỒN vẫn populate nên kết luận kiểu này không thể bắt lỗi mapping. Phải ghi GIÁ TRỊ HAI ĐẦU và so bằng nhau, vd "OPS Net 4.250.000 = Deal amount 4.250.000".' };
  }
  // CẢNH BÁO khi chỉ liệt kê giá trị một phía (hay gặp: nêu số phía OPS rồi kết luận sync_status = SUCCESS).
  return { level: 'warning', message: 'case mapping/đồng bộ nhưng kết luận không nêu PHÉP ĐỐI CHIẾU hai đầu — trạng thái "sync thành công" KHÔNG chứng minh giá trị bên nhận đúng (sai định dạng/sai đơn vị/nhầm property vẫn báo thành công).' };
}

// ---- Quan sát BẤT THƯỜNG phải có NƠI ĐẾN ----
// Vì sao: rà một task thật thấy có anomaly đã được NHÌN THẤY và ghi lại trong kết luận ("nghi thiếu cấu hình
// X", "không đúng như mong đợi") nhưng case vẫn PASS và ghi chú đó không thành bug, không thành câu hỏi BA,
// không thành decision — sau đó chính chỗ đó là bug thật do người khác tìm ra. Thấy mà mất còn tệ hơn không thấy.
const ANOMALY_HINT = new RegExp([
  '\\bnghi\\b', 'nghi ngờ', 'có vẻ', 'co ve', 'hình như', 'hinh nhu',
  'chưa rõ', 'chua ro', 'không rõ', 'khong ro', 'cần xác nhận', 'can xac nhan',
  'lạ là', 'bất thường', 'bat thuong', 'chưa đúng', 'chua dung',
  'không đúng như', 'khong dung nhu', 'khác mong đợi', 'đáng ngờ',
].join('|'), 'i');
// Nơi đến hợp lệ: Jira key · id quyết định/rule trong knowledge · câu hỏi đã ghi cho BA/Dev.
const ANOMALY_SINK = /\b[A-Z][A-Z0-9]+-\d{2,}\b|\bDEC-[A-Z0-9]+-\d{3}\b|\bBR-[A-Z0-9]+-\d{3}\b|\bSM-[A-Z0-9]+-\d{3}\b|hỏi (BA|Dev|QA-Lead|PO)|clarification|coverage gap/i;

/**
 * PASSED mà kết luận có dấu hiệu bất thường nhưng không trỏ tới bug/câu hỏi/quyết định nào.
 * @returns {{level:'problem', message:string}|null}
 */
function lintStrayAnomaly({ status = '', comment = '' } = {}) {
  if (!/^pass/i.test(String(status).trim())) return null;
  const s = String(comment || '');
  if (!ANOMALY_HINT.test(s)) return null;
  if (ANOMALY_SINK.test(s)) return null;
  return {
    level: 'problem',
    message: 'case PASS nhưng kết luận có ghi nhận BẤT THƯỜNG mà không trỏ tới đâu — anomaly phải thành 1 trong 3: bug Jira (kèm key), câu hỏi cho BA/Dev (ghi rõ "hỏi BA/Dev" + đưa vào clarifications/coverage gap), hoặc quyết định trong knowledge/decisions (DEC-*). Ghi chú suông sẽ biến mất và chỗ đó thành bug do người khác tìm ra.',
  };
}

module.exports = {
  isMappingCase, hasComparedPair, lintMappingOracle, lintStrayAnomaly,
  isVisualEvidence, isVideoEvidence,
  hasDebugTokens, looksRunOn, splitIdeas, looksComplex,
  cleanComment, lintComment, lintEvidence, lintBugHeadings,
  hasRangeGrouping, leadingNumbers, vagueExpectedLines,
  hasFailureLayer, looksTautology,
  BUG_SECTIONS, RAW_MONEY,
};
