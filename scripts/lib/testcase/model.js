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
  /*
   * `Tag` — nơi trú MỚI của khối `[Positive][Calc][BR-…]`, tách khỏi `Trường hợp kiểm thử`.
   *
   * TRƯỚC 21/08/2026 tag nằm TRONG tiêu đề, lý do ghi ở `dimensionsOf` bên dưới: hồi đó template
   * đang khoá 9 cột nên thêm cột là phá mọi consumer. Lý do đó ĐÃ HẾT HIỆU LỰC — `Loại case` thêm
   * vào thành cột thứ 10, và mọi consumer nay đọc theo TÊN cột qua `colIndex()` chứ không theo vị trí.
   * Đổi lại vì tag là tín hiệu cho MÁY: người mở case trên AIO để chạy phải đọc qua 3 khối ngoặc mới
   * tới nội dung. Tách ra thì tiêu đề đọc thẳng, mà máy vẫn gác đủ.
   */
  tags: (n) => n === 'tag' || n === 'tags' || n.includes('tag chieu') || n.includes('tag'),
  /*
   * `Loại case` — TRỤC KHÁC HẲN `Nhóm chức năng`.
   *   Nhóm chức năng trả lời "test Ở ĐÂU" (màn/luồng nghiệp vụ) → thành FOLDER trên AIO.
   *   Loại case      trả lời "LOẠI KIỂM THỬ NÀO" (Unit|Integration|Functional|API|Performance|Security)
   *                  → thành Case Type trên AIO, dùng để lọc và báo cáo.
   * Trước đây kit SUY loại từ tên nhóm (`/^api/` → API, `/security/` → Security, còn lại → Functional).
   * Đo trên 1.399 case đã publish: **96% rơi về Functional**, Integration và Performance = 0 ⇒ lọc theo
   * Case Type trên AIO vô dụng, và người đọc dễ kết luận nhầm là bộ test không có mảng tích hợp.
   * Ép một trục ra trục kia thì kết quả sai là tất yếu — nên nay là cột NGƯỜI KHAI.
   */
  caseType: (n) => ['loai case', 'case type', 'loai kiem thu', 'loai test', 'type'].includes(n),
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

/**
 * Gộp kết quả/bước đã tách thành KHỐI theo số thứ tự.
 *
 * VÌ SAO CẦN: prompt §6 bắt "mỗi bước một dòng kết quả" ĐỒNG THỜI "mỗi ý một dòng con `- …`". Hai luật đó
 * đúng cho người đọc, nhưng `splitNumbered` trả phẳng: dòng đánh số có `n = 1,2,3`, dòng con có `n = null`.
 * Consumer nào zip `steps[i] ↔ expected[i]` theo CHỈ SỐ là lệch ngay từ dòng con đầu tiên — và phần dôi ra
 * bị cắt mất. Đo thật trên bộ SAPP-26878 (101 case): 300/682 dòng kết quả (44%) bị vứt ở 83 case, và các
 * bước sau còn nhận nhầm kết quả của bước trước.
 *
 * HỢP ĐỒNG: khối của bước N = dòng đánh số N + MỌI dòng con đứng sau nó cho tới dòng đánh số kế tiếp.
 * Dòng con đứng trước dòng đánh số đầu tiên (hiếm) gom vào khối `n = null` mở đầu để không nuốt mất chữ.
 *
 * @param {{n:number|null, text:string}[]} parts kết quả của splitNumbered
 * @returns {{n:number|null, text:string, lines:string[]}[]} mỗi phần tử là MỘT khối, text đã nối bằng \n
 */
function groupNumbered(parts) {
  const out = [];
  for (const p of parts || []) {
    if (p.n !== null && p.n !== undefined) out.push({ n: p.n, lines: [p.text] });
    else if (out.length) out[out.length - 1].lines.push(p.text);
    else out.push({ n: null, lines: [p.text] });
  }
  return out.map((b) => ({ n: b.n, lines: b.lines, text: b.lines.join('\n') }));
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
  'ordering', 'bughistory', 'a11y',
  // §22 (23/08/2026): chiều callback ĐẾN từ bên thứ ba. Thêm ở đây MỚI có tác dụng — `dimensionsOf`
  // chỉ nhận tag nằm trong danh sách này, nên chiều mới mà quên khai thì case gắn tag vẫn ra 0.
  'callback',
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

/**
 * Tên tag GIỮ NGUYÊN chữ gốc, để đẩy lên **Field Tags của AIO**.
 *
 * Khác `dimensionsOf` (normalize về id máy: `bedata`, `sideeffect`) — chỗ này là NHÃN CHO NGƯỜI đọc trên
 * AIO nên phải giữ đúng `BEData`, `SideEffect`, `BR-SAPSYNC-001`. Lấy cả tag chiều lẫn id oracle: trên AIO
 * lọc "case nào phủ BR-SAPSYNC-004" là việc dùng thật.
 *
 * HAI NGUỒN, KHÔNG hợp bừa:
 *   - có cột `Tag` (bộ từ 21/08/2026) ⇒ đọc ĐÚNG cột đó;
 *   - không có ⇒ bộ cũ, tag nằm ở ĐẦU tiêu đề ⇒ chỉ lấy khối ngoặc LIỀN NHAU ở đầu.
 * Không quét ngoặc giữa câu: `Kiểm [FBP] Ngày ghi nhận…` thì `[FBP]` là TÊN TRƯỜNG trên phiếu, hốt vào
 * thành tag là bịa ra nhãn không ai khai.
 */
function tagNamesOf(tagCell, title) {
  const cell = String(tagCell || '').trim();
  const lead = String(title || '').match(/^(?:\s*\[[^\]]*\])+/);
  const src = cell || (lead ? lead[0] : '');
  const out = [];
  const seen = new Set();
  for (const m of src.match(/\[([^\]]+)\]/g) || []) {
    const name = m.slice(1, -1).trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

/** Dựng 1 TestCase từ headers + cells (1 dòng bảng). */
function buildTestCase(headers, cells, story = '') {
  const get = (matcher) => { const i = colIndex(headers, matcher); return i >= 0 ? cleanCell(cells[i] || '') : ''; };
  const _cells = {};
  headers.forEach((h, i) => { _cells[h] = cleanCell(cells[i] || ''); });
  const title = get(COL.title);
  /*
   * HỢP hai nguồn, KHÔNG phải fallback: bộ mới khai tag ở cột `Tag` và tiêu đề đã sạch; bộ cũ
   * (mọi bộ đã publish trước 21/08/2026) vẫn để tag trong tiêu đề. Lấy hợp thì cả hai đời đều đo
   * được, và bộ đang chuyển dở — tag ở cả hai chỗ — cũng không mất tín hiệu nào.
   */
  const tagCell = get(COL.tags);
  const tagSrc = `${tagCell} ${title}`;
  const stepsRaw = get(COL.steps);
  const expectedRaw = get(COL.expected);
  return {
    tcId: get(COL.tcId), module: get(COL.module), title,
    precondition: get(COL.precondition), data: get(COL.data),
    steps: splitNumbered(stepsRaw), stepsRaw,
    expected: splitNumbered(expectedRaw), expectedRaw,
    priority: get(COL.priority), risk: get(COL.risk),
    dimensions: dimensionsOf(tagSrc), oracleRefs: oracleRefsOf(tagSrc), tags: tagCell,
    group: get(COL.group), caseType: get(COL.caseType),
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
  splitNumbered, groupNumbered, dimensionsOf, oracleRefsOf, tagNamesOf, buildTestCase, buildSetup, DIMENSION_TAGS,
};
