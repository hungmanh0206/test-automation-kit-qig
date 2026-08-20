'use strict';

/*
 * Canonical TestCase model (architecture hardening #1) — NGUỒN DUY NHẤT hiểu bảng testcase.
 * Thay ≥6 parser rải rác (md_to_xlsx/output_gate/design_gate/risk_gate/risk_score/traceability/
 * publish/pull AIO) bằng 1 model + adapter. GĐ 1a chỉ định nghĩa model + helper (chưa đụng consumer).
 *
 * JS CommonJS + JSDoc typedef + testcase.d.ts (không dựng build-step TS; full TS để #7).
 * Dependency-free (chỉ để adapter khác require an toàn).
 *
 * @typedef {{ n: number|null, text: string }} NumberedLine
 * @typedef {{ preId: string, desc: string, type: string, method: string, source: string,
 *             verification: string, cleanup: string, readiness: string, linked: string }} SetupContract
 * @typedef {{
 *   tcId: string, module: string, title: string, precondition: string, data: string,
 *   steps: NumberedLine[], stepsRaw: string, expected: NumberedLine[], expectedRaw: string,
 *   priority: string, risk: string, dimensions: string[], group: string,
 *   traceability: { reqId: string, story: string },
 *   _cells: Record<string,string>   // original-header → cleaned cell (fidelity/migration bridge)
 * }} TestCase
 * @typedef {{ source: 'md'|'xlsx', tests: TestCase[], setup: SetupContract[],
 *             headers: string[], groups: string[], warnings: string[] }} TestCaseDoc
 */

// ---- helper chuỗi (đồng bộ md_to_xlsx để parity) ----
function stripEmoji(text) { return String(text || '').replace(/[\u{1F300}-\u{1FAFF}✀-➿]/gu, '').trim(); }
/** Làm sạch cell: <br>→\n, bỏ backtick, bỏ emoji. */
function cleanCell(text) { return stripEmoji(String(text || '').replace(/<br\s*\/?>/gi, '\n').replace(/`([^`]*)`/g, '$1')); }
/** Tách 1 dòng markdown "| a | b |" → ['a','b'] (bỏ pipe biên, unescape \|). */
function splitMarkdownRow(line) { return line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.replace(/\\\|/g, '|').trim()); }
/** Chuẩn hoá tên cột: bỏ dấu, đ→d, non-alnum→space, lowercase. */
function normalizeHeader(text) {
  return stripEmoji(text).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, ' ').trim().toLowerCase();
}

// ---- matcher cột testcase (normalized) ----
const COL = {
  tcId: (n) => n === 'id' || n === 'tc id' || n.endsWith(' tc id'),
  module: (n) => n.includes('module') || n.includes('site'),
  title: (n) => ['scenario', 'test title', 'test case'].includes(n) || n.includes('scenario') || n.includes('truong hop'),
  precondition: (n) => n.includes('precondition') || n.includes('pre condition') || n.includes('tien dieu kien'),
  data: (n) => n.includes('test data') || n.includes('du lieu'),
  steps: (n) => n.includes('step') || n.includes('buoc'),
  expected: (n) => n.includes('expected') || n.includes('ket qua'),
  priority: (n) => n.includes('priority') || n.includes('uu tien'),
  // Cột thứ 8 nhận CẢ tên cũ ("Mức độ rủi ro") và tên mới ("Severity") — thang 5 mức
  // Blocker|Critical|Major|Minor|Trivial áp từ task mới, bộ TC cũ giữ nguyên header không phải sửa.
  risk: (n) => n.includes('risk') || n.includes('rui ro') || n.includes('severity'),
  group: (n) => ['nhom chuc nang', 'functional group', 'test group', 'group', 'phan nhom'].includes(n),
};
// matcher cột Setup Strategy contract (normalized)
const SETUP_COL = {
  preId: (n) => n.includes('precondition id'),
  desc: (n) => n.includes('mo ta') || n.includes('trang thai'),
  type: (n) => n.includes('precondition type') || n === 'type',
  method: (n) => n.includes('setup strategy'),
  source: (n) => n.includes('setup source'),
  verification: (n) => n.includes('verification'),
  cleanup: (n) => n.includes('cleanup') || n.includes('rollback'),
  readiness: (n) => n.includes('readiness'),
  linked: (n) => n.includes('linked'),
};

// Bảng testcase THẬT = có TC ID + Kết quả mong đợi (khớp finder của output_gate/design_gate) +
// title/bước. Đòi 'expected' để KHÔNG nuốt nhầm bảng publish-summary (chỉ có TC ID, không có KQ).
const isTestCaseHeader = (headers) => {
  const nn = headers.map(normalizeHeader);
  return nn.some(COL.tcId) && nn.some(COL.expected) && nn.some((n) => COL.title(n) || COL.steps(n));
};
const isSetupContractHeader = (headers) => {
  const nn = headers.map(normalizeHeader);
  return nn.some(SETUP_COL.preId) && nn.some(SETUP_COL.method);
};

/** index cột đầu tiên khớp matcher (−1 nếu không có). */
function colIndex(headers, matcher) { return headers.map(normalizeHeader).findIndex(matcher); }

/** Tách cell đánh số "1. a<br>2. b" → [{n:1,text:'a'},{n:2,text:'b'}] (dòng không số → n:null). */
function splitNumbered(cell) {
  return cleanCell(cell).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(\d+)\s*[.)]\s*(.*)$/);
    return m ? { n: Number(m[1]), text: m[2].trim() } : { n: null, text: l.replace(/^[-*•]\s*/, '') };
  });
}

// Tag chiều đọc từ `[...]` trong tiêu đề. Hai nhóm:
//   - LOẠI case: positive/negative/boundary/edge — bộ testcase nào cũng dùng.
//   - CHIỀU COVERAGE (§3–§17 của prompt gen): thêm 14/08/2026 để `dimension_coverage.js` chặn được theo NHÃN
//     thay vì suy từ văn bản. Vì sao cần: đo trên bộ 530 case thật, suy chiều bằng từ khoá cho recall/precision
//     đều tệ và đánh đổi nhau — `hiển thị` là động từ chuẩn của MỌI kết quả mong đợi tiếng Việt nên §12 phồng
//     từ 17 lên 106 case; còn bỏ dấu thì `nhan` (nhãn) trùng luôn `nhận` trong "ghi nhận". Nhãn tường minh là
//     đường duy nhất vừa đủ recall vừa đủ precision.
// GIỮ NGUYÊN 4 tag đầu và `security/e2e/regression` — đã tồn tại từ trước, đổi là phá bộ đang publish.
const DIMENSION_TAGS = [
  'positive', 'negative', 'boundary', 'edge',
  'security', 'e2e', 'regression',
  'validation', 'ui', 'export', 'resilience', 'sideeffect', 'guard', 'design', 'display', 'calc', 'bedata', 'perf', 'api', 'impact',
];
/** Dimension từ tag [..] trong title (vd "[Negative] ..." → ['negative']). */
function dimensionsOf(title) {
  const tags = (String(title || '').match(/\[([^\]]+)\]/g) || []).map((t) => normalizeHeader(t));
  const out = new Set();
  for (const t of tags) for (const d of DIMENSION_TAGS) if (t.includes(d)) out.add(d);
  return [...out];
}

/**
 * ID knowledge dùng làm ORACLE của case, đọc từ tag tiêu đề: `[Positive][Calc][BR-RECIPBANK-001] …`
 *
 * VÌ SAO đi bằng TAG chứ không thêm cột: đo 14/08/2026 trên bộ 530 case thật — **0/530 case** nhắc bất kỳ id
 * rule nào, dù `§12` của prompt gen ĐÃ yêu cầu "ghi id rule vào Kết quả mong đợi hoặc Assumptions". Quy định
 * có, tuân thủ 0%, và không máy nào kiểm. Thêm cột thứ 10 thì phá format 9 cột mà mọi consumer đang khoá
 * theo (`md_to_xlsx`, publish/pull AIO, validate) — trong khi tag nằm trong CHÍNH cột `Trường hợp kiểm thử`,
 * dùng lại đúng cơ chế đang đọc `[Positive]`/`[Display]`. Một tín hiệu gác được HAI chiều: chặn case có oracle
 * nghiệp vụ mà không trỏ rule, VÀ tự append `covered_by` cho rule (hết phụ thuộc người nhớ điền).
 *
 * Nhận mọi tiền tố knowledge đang có: BR (domain) · SM/PM/SS/DM (system). Đọc trên tiêu đề GỐC (không
 * normalize) để giữ đúng chữ hoa và dấu gạch — id là khoá tra cứu, sai một ký tự là tra không ra.
 */
// KHÔNG export: regex có cờ /g nên .test() lặp sẽ sai vì lastIndex. Dùng oracleRefsOf() thay vì tự khớp.
const KNOWLEDGE_ID_RE = /\b(?:BR|SM|PM|SS|DM)-[A-Z0-9]+-\d{3}\b/g;
function oracleRefsOf(title) {
  const out = new Set();
  for (const m of String(title || '').match(KNOWLEDGE_ID_RE) || []) out.add(m);
  return [...out];
}

/** Dựng 1 TestCase từ headers + cells (1 dòng bảng). */
function buildTestCase(headers, cells, story = '') {
  const get = (matcher) => { const i = colIndex(headers, matcher); return i >= 0 ? cleanCell(cells[i] || '') : ''; };
  const _cells = {};
  headers.forEach((h, i) => { _cells[h] = cleanCell(cells[i] || ''); });
  const title = get(COL.title);
  const stepsRaw = get(COL.steps);
  const expectedRaw = get(COL.expected);
  return {
    tcId: get(COL.tcId), module: get(COL.module), title,
    precondition: get(COL.precondition), data: get(COL.data),
    steps: splitNumbered(stepsRaw), stepsRaw,
    expected: splitNumbered(expectedRaw), expectedRaw,
    priority: get(COL.priority), risk: get(COL.risk),
    dimensions: dimensionsOf(title), oracleRefs: oracleRefsOf(title), group: get(COL.group),
    traceability: { reqId: '', story: story || '' },
    _cells,
  };
}

/** Dựng 1 SetupContract từ headers + cells. */
function buildSetup(headers, cells) {
  const get = (matcher) => { const i = colIndex(headers, matcher); return i >= 0 ? cleanCell(cells[i] || '') : ''; };
  return {
    preId: get(SETUP_COL.preId), desc: get(SETUP_COL.desc), type: get(SETUP_COL.type),
    method: get(SETUP_COL.method), source: get(SETUP_COL.source), verification: get(SETUP_COL.verification),
    cleanup: get(SETUP_COL.cleanup), readiness: get(SETUP_COL.readiness), linked: get(SETUP_COL.linked),
  };
}

module.exports = {
  stripEmoji, cleanCell, splitMarkdownRow, normalizeHeader,
  COL, SETUP_COL, isTestCaseHeader, isSetupContractHeader, colIndex,
  splitNumbered, dimensionsOf, oracleRefsOf, buildTestCase, buildSetup, DIMENSION_TAGS,
};
