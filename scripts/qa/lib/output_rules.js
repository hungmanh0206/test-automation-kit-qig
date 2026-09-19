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

// NGUỒN DUY NHẤT của danh sách đuôi file evidence. Đây là thứ THẬT SỰ chặn, nên mọi nơi khác (thông báo lỗi,
// CLAUDE.md, core_rules.md, RULE_GLOBAL.md) phải khớp với nó — `policy_source_check.js` so 3 tài liệu với
// hằng số này và CHẶN khi lệch. Đo 12/08/2026: cùng danh sách này từng nằm ở 5 nơi với 4 nội dung khác nhau
// (CLAUDE.md thiếu `.jpeg`; thông báo của output_gate thiếu `.jpeg` mà lại có `.gif`; code có thêm bmp/mov/m4v
// mà không tài liệu nào nhắc) ⇒ chép tay giá trị máy-kiểm-được là mời drift.
// Tiêu chí chọn đuôi KHÔNG phải "có phải ảnh không" mà là "reviewer xem được NGAY trong Jira, không phải tải
// về" — evidence tải-về-mới-xem-được thì mất hẳn mục đích. Nên mỗi đuôi ở đây BẮT BUỘC có mime thật trong
// MIME_BY_EXT (uploader gắn `application/octet-stream` là Jira không preview). `policy_source_check` kiểm ràng
// buộc đó. Đo 12/08/2026 trên 2224 file evidence thật: png 2182 · webm 28 · jpg 14 · gif/bmp/mov/m4v = 0 ⇒ đã
// bỏ gif/bmp/mov/m4v (bmp/mov/m4v không có mime nên vốn không preview được; gif 256 màu làm bệt khung đỏ +
// nhãn, mà chuỗi thao tác đã có luật bắt VIDEO riêng). Cần .mov thật thì THÊM mime + ghi vào RULE_GLOBAL,
// đừng nới regex một mình.
const VISUAL_EXT = /\.(png|jpe?g|webp|mp4|webm)$/i;
const VIDEO_EXT = /\.(mp4|webm)$/i;

/** Mime cho attachment Jira — 1 NGUỒN, dùng bởi cả gate lẫn uploader (push_test_execution). */
const MIME_BY_EXT = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  // Không phải evidence nhưng vẫn có thể đính kèm hợp lệ trong ngữ cảnh khác:
  '.pdf': 'application/pdf', '.txt': 'text/plain', '.json': 'application/json', '.html': 'text/html',
};
const mimeOf = (file) => {
  const s = String(file || '').toLowerCase();
  const i = s.lastIndexOf('.');
  return (i >= 0 && MIME_BY_EXT[s.slice(i)]) || 'application/octet-stream';
};

/** Danh sách đuôi cho người đọc, SINH RA từ regex — đừng viết tay lại ở bất kỳ thông báo nào. */
const extListText = (re = VISUAL_EXT) => String(re.source)
  .replace(/^\\\.\(|\)\$$/g, '')
  .split('|')
  .map((s) => `.${s.replace('jpe?g', 'jpg/.jpeg')}`)
  .join('/');

// Bug đã GÁN TẦNG (prefix `[FE]`/`[BE]`) thì phải có dấu vết API cụ thể — nhìn UI sai chỉ chứng minh CÓ lỗi,
// không chứng minh lỗi NẰM Ở ĐÂU. Gán sai tầng ⇒ ticket đi nhầm người ⇒ dev bounce ⇒ mất trọn một vòng.
// `beVsFe` truyền vào từ `.agent/config/verdict_taxonomy.json` (giữ module này thuần, và để JSON là nguồn thật
// chứ không phải "chi tiết máy-đọc" mà không máy nào đọc).
const LAYER_PREFIX = /\[(FE|BE)\]/i;
const API_TRACE = /\b(POST|PATCH|PUT|DELETE|GET)\s+\/|\/api\/v\d|\bendpoint\b|swagger|curl\b|\bpayload\b/i;
// Mã status PHẢI có từ ngữ cảnh kèm. Bản đầu dùng `[45]\d\d` trần và khớp oan ngay: tiền Việt "5.400.000đ"
// chứa cụm `400` (đứng sau dấu chấm nên vẫn thoả \b) ⇒ bug chỉ nói về số tiền bị coi là "đã bắt API".
const STATUS_CODE = /\b(?:HTTP|status(?:\s*code)?|mã\s*(?:lỗi|trạng thái)|trả\s*về)\s*[:=]?\s*[1-5]\d\d\b/i;

/**
 * @param {{summary?: string, description?: string, beVsFe?: object}} input
 * @returns {{level: 'warning'|'problem', message: string}[]}
 */
function lintBeVsFeLayer({ summary = '', description = '', beVsFe = null } = {}) {
  if (!LAYER_PREFIX.test(String(summary))) return [];
  const desc = String(description || '');
  if (API_TRACE.test(desc) || STATUS_CODE.test(desc)) return [];
  const layer = (String(summary).match(LAYER_PREFIX) || [])[1] || '';
  // Lời nhắc lấy TỪ config để sửa một chỗ là đổi mọi nơi.
  const how = Array.isArray(beVsFe && beVsFe.howTo) ? beVsFe.howTo[0] : 'Bắt response của chính API mà màn đang xem gọi, không đoán endpoint.';
  // Mức WARNING, không chặn: đo trên 99 bug đã log thì 66 (67%) chưa có dấu vết API ⇒ chặn ngay là đỏ oan
  // hai phần ba. Theo tiền lệ locator_lint: cảnh báo trước, siết sau khi thói quen đã đổi.
  return [{
    level: 'warning',
    message: `tiêu đề gán tầng [${layer.toUpperCase()}] nhưng description KHÔNG có dấu vết API (method+path, /api/v…, hoặc mã status) → chưa chứng minh được lỗi nằm ở tầng đó. ${how}`,
  }];
}

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

// Một DÒNG có phải "1 mạch text nhồi nhiều ý" không.
function lineLooksRunOn(t) {
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

// Comment run-on = 1 đoạn dài KHÔNG bullet nhồi nhiều ý (RULE_GLOBAL §comment mục 4).
//
// ⚠️ Đã tách "xét theo DÒNG" (25/08/2026) sau khi gate BÁO OAN trên chính canonical của nó:
// `bug_reporter.cellToText` tách `<br>` thành nhiều dòng rồi `cleanField` XOÁ dấu `- ` ở đầu mỗi dòng,
// nên text tới đây đã đúng một-ý-một-dòng nhưng KHÔNG còn ký tự bullet — bản cũ gộp cả khối lại,
// đếm ra ≥3 ý và chặn. Trong khi `addBulletListOrParagraph` sau đó render mỗi dòng thành 1 bullet ADF
// thật, tức output cuối CÓ bullet. Nay: đã xuống dòng thì xét TỪNG dòng, chỉ chặn khi có dòng tự nó
// nhồi nhiều ý. Run-on thật (1 dòng dài dồn nhiều ý) vẫn bị chặn y như cũ.
function looksRunOn(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  const lines = t.split(/\r?\n/).filter((l) => l.trim());
  if (lines.some((l) => /^\s*[-*•]\s+/.test(l))) return false; // đã có bullet → OK
  if (lines.length >= 2) return lines.some((l) => lineLooksRunOn(l.trim()));
  return lineLooksRunOn(t);
}

/**
 * AUTO-FIX an toàn cho comment kết quả: bỏ prefix status + xoá cụm debug trong ngoặc.
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
  // Nhận CẢ khoá canonical của verdict_taxonomy (`product_bug`, `api_bug`) lẫn văn xuôi.
  // Trước chỉ có biến thể dấu-cách → khai ĐÚNG chuẩn `failureLayer: "product_bug"` lại bị chặn oan,
  // đúng vào 2 tầng duy nhất được phép log Jira. Các tầng khác đã có `[_ ]?` nên không dính lỗi này.
  'lỗi sản phẩm', 'product[_ ]?bug', 'api[_ ]?bug', 'api contract', '\\bbug\\b', '\\bdefect\\b',
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

// ---- BUG phải TÁI HIỆN ĐƯỢC BẰNG ĐƯỜNG THẬT, và không được chứa suy đoán ----
// Vì sao: rà lại một dự án thật thấy nhiều bug bị bác vì bản thân TÌNH HUỐNG không có thật —
//  · gọi thẳng API bằng Super Admin rồi kết luận "thiếu guard" (role thường thực ra bị 403) → phải retract;
//  · replay tham số đã ký của return-URL vào endpoint nội bộ rồi coi là callback thật → premise sai từ gốc;
//  · mass-assign field mà UI không bao giờ gửi;
//  · repro ghi theo Ý ĐỊNH chứ không theo lần chạy thật (bước 1 chưa set đơn vị tiền mà đã ghi là có set).
// Dev đọc một chi tiết sai là mất tin cả ticket, và lần sau bug thật cũng bị bác theo.
const API_DIRECT = /\b(POST|PATCH|PUT|DELETE|GET)\s+\/|\/api\/v\d|endpoint|swagger|curl\b|payload/i;
const REAL_ACTOR = /\bUI\b|màn |man hinh|giao diện|form |lưới|bấm |click|role |quyền |tài khoản |token của|đăng nhập bằng/i;
const ARTIFICIAL = /replay|giả lập|gia lap|tự bắn|tu ban|inject|bypass|sửa payload|sua payload|gửi thẳng|gui thang|mass[- ]assign|tamper|giả chữ ký|gia chu ky/i;
const SPECULATION = /\bnghi\b|nghi ngờ|khả năng cao|kha nang cao|có thể do|co the do|nhiều khả năng|nhieu kha nang|đoán|doan la|chắc là|có lẽ/i;

/**
 * Kiểm "hiện thực" của một bug trước khi log.
 * @param {{summary?:string, description?:string}} bug
 * @returns {Array<{level:'problem'|'warning', message:string}>}
 */
function lintBugRealism({ summary = '', description = '' } = {}) {
  const out = [];
  const text = `${summary}\n${description}`;
  if (API_DIRECT.test(text) && !REAL_ACTOR.test(text)) {
    out.push({ level: 'problem', message: 'repro CHỈ đi bằng gọi API trực tiếp, không nêu actor thật (role/tài khoản/đường UI) — gọi bằng tài khoản quyền cao rồi kết luận "thiếu guard" là kết luận SAI: role thường có thể đã bị chặn. Phải nêu rõ gọi bằng token của role nào, và kiểm cả đường UI.' });
  }
  if (ARTIFICIAL.test(text) && !/người dùng thật|user thật|đường thật|kịch bản thật|xảy ra trong thực tế/i.test(text)) {
    out.push({ level: 'problem', message: 'repro dùng thao tác NHÂN TẠO (replay/inject/tamper/mass-assign/gửi thẳng payload) mà không chứng minh actor thật đạt được trạng thái đó — tình huống không xảy ra trong thực tế thì không phải product bug. Nếu vẫn muốn báo, phải nói rõ đây là kịch bản tấn công/kỹ thuật và ai có thể thực hiện.' });
  }
  if (SPECULATION.test(description)) {
    out.push({ level: 'warning', message: 'description chứa SUY ĐOÁN nguyên nhân ("nghi/khả năng cao/có thể do") — mô tả bug chỉ nên có sự kiện quan sát được. Suy đoán sai một chi tiết là dev mất tin cả ticket; muốn gợi ý thì để ở comment và ghi rõ là giả thuyết.' });
  }
  return out;
}

/**
 * BUG phải TRÍCH TỪ LẦN CHẠY THẬT, không viết lại bằng tay theo trí nhớ/ý định.
 * Vì sao: một bug đã bị Rejected vì bước ghi "chọn Monetary Unit = USD rồi nhập 170" trong khi lần chạy đó
 * nhiều khả năng chưa set đơn vị — re-test thì không tái hiện. Regex không thể biết script đã làm gì, nhưng
 * CÓ THỂ đòi bằng chứng: mỗi bước phải có ảnh của chính bước đó (hoặc 1 video cho cả chuỗi), và bug phải trỏ
 * được về lần chạy sinh ra nó. Bước nào không có ảnh thì không được viết là đã làm.
 * @param {{steps?:string, attachments?:string[], runRef?:string}} bug
 * @returns {Array<{level:'problem', message:string}>}
 */
function lintBugProvenance({ steps = '', attachments = [], runRef = '' } = {}) {
  const out = [];
  const att = (Array.isArray(attachments) ? attachments : [attachments]).map(String).filter(Boolean);
  const nStep = new Set(leadingNumbers(steps)).size;
  const hasVideo = att.some(isVideoEvidence);
  const nImg = att.filter(isVisualEvidence).length;
  if (nStep >= 2 && !hasVideo && nImg < nStep) {
    out.push({ level: 'problem', message: `repro có ${nStep} bước nhưng chỉ ${nImg} ảnh — mỗi bước phải có ảnh CỦA CHÍNH LẦN CHẠY, hoặc 1 video cho cả chuỗi. Thiếu ảnh nghĩa là bước đó đang được viết lại theo ý định chứ không phải theo cái đã chạy (đã có bug bị Rejected vì đúng lỗi này).` });
  }
  if (!String(runRef || '').trim() && !att.length) {
    out.push({ level: 'problem', message: 'bug không trỏ về lần chạy nào (thiếu cả evidence lẫn tham chiếu run/drive) — không audit ngược được thì không phân biệt được "quan sát thật" với "mô tả lại".' });
  }
  return out;
}

/* ── LỚP 1: BẰNG CHỨNG TỐI THIỂU THEO TAG CHIỀU ────────────────────────────────────────────────────────────
 *
 * VẤN ĐỀ: tag chiều (`[Calc]`, `[Display]`…) chứng minh case CÓ MẶT ở chiều đó, KHÔNG chứng minh nó assert
 * đủ sâu. Ca đắt nhất đã xảy ra: `OPS_PAY_TC_175` liệt kê form Add Transaction CÓ field Recipient Bank Account
 * nhưng không phát biểu ràng buộc nào ⇒ case XANH, bug `SAPP-28420` (modal cho chọn pháp nhân khác order) sống.
 *
 * VÌ SAO CÁCH NÀY KHÁC 3 LẦN SUY DIỄN ĐÃ THẤT BẠI: những lần đó tôi bắt máy PHÂN LOẠI ("case này thuộc chiều
 * nào?") — trên tiếng Việt thì recall/precision đánh đổi nhau (`hiển thị` là động từ của MỌI expected). Ở đây
 * chiều ĐÃ do người khai bằng tag, máy chỉ hỏi tiếp một câu HẸP: "expected có mang đúng loại bằng chứng của
 * chiều đó không?". Tag lọc trước nên precision cao hẳn.
 *
 * CỐ Ý KHÔNG khai luật cho mọi chiều. Chiều nào tôi không phát biểu được "bằng chứng tối thiểu" một cách chính
 * xác (`[UI]`, `[E2E]`, `[SideEffect]`, `[Design]`, `[API]`, `[Impact]`, `[Export]`) thì BỎ TRỐNG — thà không
 * gác còn hơn gác bằng một luật mơ hồ rồi báo oan.
 *
 * Luôn là CẢNH BÁO ở bản đầu. Bật chặn (`--strict`) chỉ sau khi đo trên bộ gen mới đầu tiên (<10% thiếu).
 */
// Bỏ đánh số đầu dòng ("1. …") TRƯỚC khi tìm số — nếu không thì mọi expected đều "có số" và luật `[Calc]`
// thành vô nghĩa. Đây là bẫy đã thấy ngay khi thử: expectedRaw luôn ở dạng "1. …\n2. …".
const stripLineNumbers = (s) => String(s || '').split(/<br\s*\/?>|\r?\n/).map((l) => l.replace(/^\s*\d+\s*[.)]\s*/, '')).join('\n');
const HAS_NUMBER = /\d/;
const HAS_QUOTED = /["“”'`][^"“”'`]{2,}["“”'`]/;                       // chuỗi trích nguyên văn
const HAS_FORMAT = /dd\/mm|mm\/yyyy|hh:mm|DD\/MM|YYYY|\d{2}\/\d{2}\/\d{4}/i;
const HAS_STATUS = /\b(4\d{2}|5\d{2})\b|\bhttp\s*\d{3}/i;
const HAS_BLOCK = /bị chặn|không cho|không được|chặn lưu|từ chối|deny|forbidden/i;
const HAS_UNCHANGED = /không đổi|giữ nguyên|vẫn là|vẫn ở/i;
const HAS_PROPERTY = /[a-z][a-z0-9]*_[a-z0-9_]{2,}/;                    // snake_case field/property
const HAS_NULLISH = /\bnull\b|rỗng|trống|thiếu key|\[\]|""/i;
const HAS_REPEAT = /lần (hai|2)|gọi lại|lặp lại|trùng|đồng thời|idempotent|retry|thử lại/i;
const HAS_TIME_UNIT = /\b\d+(\.\d+)?\s*(ms|s|giây|phút)\b|p9[05]|\bSLA\b/i;

// "Giá trị ĐỂ TRỐNG đúng nghĩa" là oracle hiển thị hợp lệ và §12 nêu thẳng ("buổi chưa diễn ra → cột công
// TRỐNG, KHÔNG phải 0"). Bản đầu không nhận nên báo oan case assert đúng chuẩn đó.
// KHÔNG dùng `\b` ở đây: trong regex JS, chữ có dấu ("đ", "ẩ") không phải word-char, nên `\b` đứng trước
// "để trống" / "ẩn" là biên KHÔNG BAO GIỜ khớp — luật im lặng mà trông như vẫn chạy. Test bắt được ngay.
const HAS_EMPTINESS = /(rỗng|để trống|bỏ trống|không hiển thị|không có giá trị|không hiện)/i;

const TAG_EVIDENCE = {
  calc: { test: (e) => HAS_NUMBER.test(e), need: 'một GIÁ TRỊ SỐ tự tính (kết quả của công thức) — "tính đúng" không phải oracle' },
  display: { test: (e) => HAS_QUOTED.test(e) || HAS_FORMAT.test(e) || HAS_EMPTINESS.test(e) || /đủ cột|thứ tự cột|danh sách cột/i.test(e), need: 'chuỗi TRÍCH NGUYÊN VĂN (trong ngoặc kép), mẫu định dạng (dd/mm/yyyy, hh:mm), danh sách cột, hoặc khẳng định RỖNG/để trống — nếu không thì case này PASS cả khi hiển thị sai' },
  // Chiều `guard` có HAI mặt và đòi bằng chứng KHÁC nhau:
  //   - nhánh CHẶN (negative/edge): phải có mã 4xx hoặc "bị chặn" KÈM "dữ liệu không đổi" — nếu không thì
  //     không chứng minh được dữ liệu còn nguyên sau khi bị từ chối.
  //   - nhánh CHO PHÉP (positive): không có 4xx nào để nêu; bằng chứng đúng là kết quả cụ thể của đường hợp lệ
  //     (thông báo nguyên văn hoặc giá trị/trạng thái). Bản đầu áp luật nhánh CHẶN cho cả nhánh CHO PHÉP nên
  //     báo oan — đo trên bộ pilot thật: 2/4 cảnh báo `guard` là oan vì đúng lý do này.
  guard: {
    test: (e, dims) => (dims.includes('positive') && !dims.includes('negative')
      ? (HAS_QUOTED.test(e) || HAS_NUMBER.test(e) || HAS_STATUS.test(e))
      : (HAS_STATUS.test(e) || (HAS_BLOCK.test(e) && HAS_UNCHANGED.test(e)))),
    need: 'nhánh CHẶN: MÃ TRẠNG THÁI (403/409…) hoặc "bị chặn" KÈM "dữ liệu không đổi" · nhánh CHO PHÉP (case [Positive]): thông báo nguyên văn hoặc giá trị/trạng thái cụ thể',
  },
  bedata: { test: (e) => HAS_PROPERTY.test(e) || HAS_NULLISH.test(e), need: 'TÊN property/field cụ thể, hoặc phân biệt null/rỗng/thiếu key/0 — "map đúng" không kiểm được' },
  resilience: { test: (e) => HAS_REPEAT.test(e) && HAS_NUMBER.test(e), need: 'nêu lần gọi THỨ HAI/trùng/đồng thời KÈM kết quả bằng số (vd "đúng 1 transaction", "Paid Amount vẫn 120.000")' },
  perf: { test: (e) => HAS_TIME_UNIT.test(e), need: 'NGƯỠNG có đơn vị (ms/s/p95) — không có ngưỡng thì không phán được đạt/không đạt' },
  validation: { test: (e) => HAS_QUOTED.test(e) || HAS_NUMBER.test(e), need: 'THÔNG BÁO LỖI trích nguyên văn hoặc giá trị biên cụ thể' },
};

/**
 * Case mang tag chiều nhưng expected thiếu bằng chứng tối thiểu của chiều đó → cảnh báo.
 * @param {{tcId?:string, dimensions?:string[], expected?:string}} row
 * @returns {string[]} thông điệp cảnh báo (rỗng nếu đạt hoặc không có tag nào được khai luật)
 */
function lintTagDepth(row) {
  const out = [];
  const dims = Array.isArray(row.dimensions) ? row.dimensions : [];
  if (!dims.length) return out;
  const expected = stripLineNumbers(row.expected);
  for (const d of dims) {
    const spec = TAG_EVIDENCE[d];
    if (!spec) continue;                                                  // chiều chưa khai luật → không gác
    if (spec.test(expected, dims)) continue;                                // dims: vài chiều đòi bằng chứng khác nhau theo nhánh allow/deny
    out.push(`mang tag \`[${d}]\` nhưng "Kết quả mong đợi" thiếu ${spec.need}`);
  }
  return out;
}

module.exports = {
  lintTagDepth, TAG_EVIDENCE,
  isMappingCase, hasComparedPair, lintMappingOracle, lintStrayAnomaly, lintBugRealism, lintBugProvenance,
  lintBeVsFeLayer,
  isVisualEvidence, isVideoEvidence, VISUAL_EXT, VIDEO_EXT, extListText, MIME_BY_EXT, mimeOf,
  hasDebugTokens, looksRunOn, splitIdeas, looksComplex,
  cleanComment, lintComment, lintEvidence, lintBugHeadings,
  hasRangeGrouping, leadingNumbers, vagueExpectedLines,
  hasFailureLayer, looksTautology,
  BUG_SECTIONS, RAW_MONEY,
};
