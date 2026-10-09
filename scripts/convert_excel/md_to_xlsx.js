#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const outputGate = require("../qa/output_gate"); // gate gen-testcase (RULE_GLOBAL §6: KQ khớp bước, cấm gộp range/chung chung)
const preflight = require("../qa/preflight_gate"); // G1: input/config bắt buộc đủ & parse được (miss-file/PARSE_FAILURE = CHẶN)
const designGate = require("../qa/design_gate"); // G5: structural (đủ cột) + completeness (ô lõi không rỗng)
const canonical = require("../lib/testcase"); // #1: table-scanner + predicate DUY NHẤT (thay parser nội bộ)

let ExcelJS;
try {
  ExcelJS = require("exceljs");
} catch {
  console.error("Missing dependency: exceljs. Run `npm install` at the repo root.");
  process.exit(1);
}

// D\u1EA3i c\u0169 b\u1ECF s\u00F3t \u26A0 U+26A0 v\u00E0 \u26D4 U+26D4 (kh\u1ED1i Misc Symbols) \u2014 hai icon hay d\u00F9ng nh\u1EA5t trong ghi ch\u00FA,
// \u0111o 30/09/2026 tr\u00EAn 5 b\u1ED9 th\u00EC ch\u00FAng l\u1ECDt th\u1EB3ng ra Excel. GI\u1EEE m\u0169i t\u00EAn U+2190\u2013U+21FF v\u00EC \u0111\u00F3 l\u00E0 ch\u1EEF ngh\u0129a.
function stripEmoji(text) {
  return String(text || "").replace(/(?:[☀-➿⬀-⯿\u{1F000}-\u{1FAFF}]|\uFE0F)/gu, "").replace(/[ \t]{2,}/g, " ").trim();
}

// Excel/Google Sheet không hiểu Markdown: `**x**` hiện nguyên dấu sao, `~~x~~` hiện nguyên dấu ngã.
// Bóc chúng như đã bóc backtick — nếu không, ô testcase đọc lên đầy ký tự rác.
// Đo 30/09/2026 trên CSDL-9004: backtick được bóc 52/52 ô, còn `**` lọt nguyên 18/18 ô vào .xlsx.
function stripMarkdownInline(text) {
  // `COUNT(*)` trong SQL phải sống sót — cất tạm rồi trả lại (xem model.js, hai bản phải khớp nhau).
  const GIU = "\u0000SAO\u0000";
  return String(text || "")
    .split("(*)").join(GIU)
    .replace(/\*\*([\s\S]*?)\*\*/g, "$1")
    .replace(/~~([\s\S]*?)~~/g, "$1")
    // Cho phép in nghiêng trải qua xuống dòng, nhưng chặn độ dài (xem model.js).
    .replace(/(^|[\s("'“‘—–-])\*(?!\s)([^*]{1,300}?)(?<!\s)\*(?=$|[\s.,;:!?)"'”’—–-])/g, "$1$2")
    .replace(/`([^`]*)`/g, "$1")
    .split(GIU).join("(*)");
}

function cleanCell(text) {
  return stripEmoji(stripMarkdownInline(String(text || "").replace(/<br\s*\/?>/gi, "\n")));
}

function normalizeHeaderName(text) {
  return stripEmoji(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

const FUNCTIONAL_GROUPS = [
  "Xem danh sách",
  "Xem chi tiết",
  "Tạo",
  "Sửa",
  "Xóa",
  "API",
  "E2E/Cross-app",
  "Permission/Security",
  "Import/Export",
  "Khác",
];

/*
 * Layout Excel export — nhân bản CHÍNH XÁC file mẫu QA đưa (`Testcase_Master_mẫu 2026.xlsx`, đo bằng
 * exceljs ngày chuyển đổi). Không phải style tự chọn — mọi hằng số dưới đây (tên cột, thứ tự, độ rộng,
 * dropdown, màu, phạm vi dòng 7-500) copy nguyên từ file mẫu để khớp quy ước "Hướng dẫn" QA đang dùng.
 */
const FUNC_HEADERS = [
  "ID_TC", "Module", "Test Case Name", "Preconditions", "Test Data", "Test Steps", "Expected Result",
  "Test Type", "Priority", "Test Level", "Actor / Role", "Result", "Note", "Test Objective", "Technique", "REQ ID",
  // 2 cột phụ SAU cùng — KHÔNG có trong file mẫu, nhưng bắt buộc giữ: `Loại case`/`Tag` là dữ liệu đã qua
  // gate ở biên sinh case (case-type gate + tag gate trong file này) — bỏ khỏi Excel export = mất im lặng
  // ngay sau khi gate vừa chặn để bắt QA điền. Xem `tests/fe/infra/case-type-gate.spec.ts` (round-trip qua
  // parseXlsx). Đặt SAU CÙNG để không xê dịch cột H/I/J/L đang neo dropdown/conditional-formatting theo chữ cái.
  "Loại case", "Tag",
];
const FUNC_COL_WIDTHS = [10, 16, 42, 28, 30, 46, 40, 16, 11, 13, 16, 12, 22, 8.71, 8.71, 8.71, 16, 22];
/*
 * BỐ CỤC "5 CẤP" — nhân bản từ bộ testcase chuẩn của hệ thống
 * ("D:/Tài liệu nghiệp vụ/Testcase_CSDL_2026-2027.xlsx", sheet "Đội ngũ v1", đo bằng exceljs 30/09/2026).
 *
 * Khác bố cục mặc định ở hai chỗ, và cả hai đều có lý do nghiệp vụ:
 *   - thêm cột "Áp dụng cho cấp" (cột C): một case có thể áp cho "Tất cả", cho "Liên cấp",
 *     hoặc cho một tập cấp viết ngăn bằng dấu chấm giữa, ví dụ "TH · THCS · THPT".
 *   - Result tách thành NĂM cột (N..R) theo từng cấp, thay vì một cột duy nhất. Cùng một case chạy
 *     ở năm cấp cho ra năm kết quả; gộp một ô là mất bốn kết quả.
 *
 * Chỉ bật khi bảng Markdown CÓ cột "Áp dụng cho cấp". Bộ nào không khai thì giữ bố cục cũ.
 */
const FUNC5_HEADERS = [
  "ID_TC", "Module", "Áp dụng cho cấp", "Test Case Name", "Preconditions", "Test Data", "Test Steps",
  "Expected Result", "Test Type", "Nhóm KT", "Priority", "Test Level", "Actor / Role",
  "Result MN", "Result TH", "Result THCS", "Result THPT", "Result GDTX",
  "Note", "Test Objective", "Technique", "REQ ID", "Mã ISTQB", "Nhóm chức năng",
];
const FUNC5_COL_WIDTHS = [10, 16, 28, 28, 28, 30, 46, 40, 16, 11, 11, 13, 16, 12, 10.71, 10.71, 10.71, 10.71, 22, 21.14, 25.29, 21.71, 8.71, 33];
const CAP_COLS = [["MN", "N"], ["TH", "O"], ["THCS", "P"], ["THPT", "Q"], ["GDTX", "R"]];

const FUNC_HEADER_ROW = 5; // dòng tiêu đề cột của sheet chức năng — dashboard dò cột Result theo dòng này
const FUNC_DATA_START_ROW = 7;
const FUNC_DATA_END_ROW = 500; // khớp "Hướng dẫn": mỗi sheet tính từ dòng 7 đến dòng 500
const DASH_DATA_START_ROW = 7;
const DASH_DATA_END_ROW = 80; // khớp file mẫu: dashboard cấp sẵn 74 dòng chức năng

const DROPDOWN = {
  testType: "UI,Positive,Negative,Boundary,Validation,Business Rule,Permission,Security,Performance,Compatibility,Accessibility,API,Database,Integration,Regression,E2E,Error Handling,Logging - Audit",
  priority: "Critical,High,Medium,Low",
  testLevel: "Unit,Integration,System,UAT",
  result: "Pass,Fail,Pending,Un_test",
  // Bộ chuẩn dùng bộ giá trị khác cho Result theo cấp, và có thêm dropdown "Nhóm KT".
  result5: "Pass,Fail,Blocked,N/A",
  nhomKT: "Business Rule,Negative,Positive,Security,UI,Validation",
  testType5: "Functional,Non-functional",
  testLevel5: "Integration,System",
};

const COLOR = {
  banner: "FF1F4E79", label: "FFF2F2F2", resultHeader: "FF434343", header: "FF0070C0",
  totalsGreen: "FFC6EFCE",
  green: { bg: "FFC6EFCE", font: "FF006100" },
  red: { bg: "FFFFC7CE", font: "FF9C0006" },
  yellow: { bg: "FFFFEB9C", font: "FF9C6500" },
  gray: { bg: "FFE7E6E6", font: "FF3F3F3F" },
  lightGray: { bg: "FFF2F2F2", font: "FF808080" },
};

/*
 * Test Type (18 giá trị chuẩn file mẫu) suy best-effort từ `dimensions` ([Positive][Calc]... ở tiêu đề) —
 * KHÔNG phải mapping đầy đủ 1-1 (2 taxonomy khác mục đích: dimensions gác COVERAGE cho máy, Test Type là
 * nhãn cho người đọc Excel). Chỉ map khi rõ nghĩa; dimension không có ở đây (edge/export/resilience/
 * sideeffect/guard/design/calc/bedata/impact/ordering/bughistory/callback) → để trống, QA tự điền.
 * Case nhiều dimension → lấy tag ĐẦU TIÊN khớp bảng theo thứ tự DIMENSION_TAGS (ổn định, không phụ thuộc
 * thứ tự tag trong tiêu đề).
 */
/*
 * MỞ RỘNG 25/09/2026 — bảng này trước đó ánh xạ 13/25 tag chiều mà kit định nghĩa, nên MỌI case chỉ mang
 * tag thuộc 12 chiều còn lại đều ra `Test Type` RỖNG. Đo trên bộ CSDL-9001 (142 case): 13 case trống, tất
 * cả đều dạng `[Edge][Ordering]` / `[Edge][Calc]` / `[Edge][Impact]` — tức càng dùng đúng các chiều §13,
 * §17, §19 thì càng nhiều ô trống. Người mở Excel thấy cột trống sẽ tưởng QA quên khai, trong khi nguyên
 * nhân nằm ở đây.
 *
 * Giá trị bên phải BẮT BUỘC thuộc 18 giá trị của dropdown `DROPDOWN.testType` — điền giá trị lạ thì ô
 * không khớp data-validation và Excel báo lỗi khi người dùng sửa.
 *
 * AN TOÀN VỚI BỘ CŨ: `pickTestType` duyệt theo thứ tự `DIMENSION_TAGS`, mà `positive > negative > boundary`
 * đứng đầu bảng thứ tự đó. Case nào đang ra Positive/Negative/Boundary thì vẫn ra đúng thế — phần thêm dưới
 * đây chỉ LẤP Ô TRỐNG, không đổi giá trị đã có. Đo lại trên chính bộ 142 case: 129 ô cũ giữ nguyên.
 *
 * `edge` CỐ Ý không ánh xạ: "Edge" không nằm trong 18 giá trị của dropdown, và bản chất case (Positive/
 * Negative/Boundary/Edge) đã có chỗ riêng ở cột `Loại case` + cột `Tag`. Case `[Edge][Ordering]` vì thế
 * lấy Test Type từ `ordering`, đúng thứ nó đang kiểm.
 */
const DIMENSION_TO_TEST_TYPE = {
  positive: "Positive", negative: "Negative", boundary: "Boundary", validation: "Validation",
  security: "Security", perf: "Performance", api: "API", dbpersist: "Database",
  regression: "Regression", e2e: "E2E", a11y: "Accessibility", ui: "UI", display: "UI",
  // — bổ sung 25/09/2026 —
  calc: "Business Rule",        // §13 giá trị TÍNH ra theo rule nghiệp vụ
  ordering: "Business Rule",    // §19 ràng buộc thứ tự thao tác cũng là rule nghiệp vụ
  guard: "Permission",          // §10 ai/trạng thái nào được làm gì — tầng sau phải chặn
  impact: "Regression",         // §17 feature khác có vỡ sau thay đổi không
  bughistory: "Regression",     // §20 bug cũ có tái phát không
  bedata: "API",                // §14 hình dạng dữ liệu BE trả về
  sideeffect: "Integration",    // §9 hệ quả lan sang nơi khác (mail/noti/webhook)
  export: "Integration",        // §7 bàn giao dữ liệu qua file
  callback: "Integration",      // §22 nhận request từ bên thứ ba
  resilience: "Error Handling", // §8 chịu lỗi/gián đoạn/đồng thời
  design: "UI",                 // §11 đối chiếu token thiết kế
};
/*
 * Bộ chuẩn chỉ có HAI giá trị Test Type: Functional và Non-functional. Từ vựng 18 giá trị của kit
 * rơi vào hai nhóm đó. Ánh xạ ở đây thay vì bắt người viết case nhớ hai bộ từ vựng.
 */
const PHI_CHUC_NANG = new Set(["Performance", "Security", "Accessibility", "Compatibility", "Logging - Audit"]);
function testType5(loai) {
  return PHI_CHUC_NANG.has(String(loai || "").trim()) ? "Non-functional" : "Functional";
}

/** Cột "Nhóm KT" của bộ chuẩn: 6 giá trị, suy từ tag chiều của case. */
function nhomKTFromTags(tags) {
  const t = String(tags || "").toLowerCase();
  if (t.includes("[security]")) return "Security";
  if (t.includes("[validation]")) return "Validation";
  if (t.includes("[negative]")) return "Negative";
  if (/\[(display|ui)\]/.test(t)) return "UI";
  if (/\[br-|\[guard\]/.test(t)) return "Business Rule";
  if (t.includes("[positive]")) return "Positive";
  return "";
}

function pickTestType(dimensions, dimensionOrder) {
  const found = dimensionOrder.find((dim) => dimensions.includes(dim) && DIMENSION_TO_TEST_TYPE[dim]);
  return found ? DIMENSION_TO_TEST_TYPE[found] : "";
}

function normalizePriority(raw) {
  const value = String(raw || "").trim();
  return /^lowest$/i.test(value) ? "Low" : value;
}

// Bỏ khối `[Positive][Calc][BR-xxx]` đầu tiêu đề để hiển thị tên case sạch trong cột `Test Case Name`.
// Cùng regex với `displayTitle` ở scripts/integrations/aio/publish qua Drive MCP.js — không import chéo
// sang công cụ cũ (đã bỏ) để tránh phụ thuộc code orphan.
function displayTitle(raw) {
  const text = String(raw || "");
  return text.replace(/^(?:\s*\[[^\]]*\])+\s*/, "").trim() || text.trim();
}

function groupFromModulePrefix(moduleValue) {
  const value = String(moduleValue || "");
  const explicitPrefix = value.split(" / ")[0]?.trim();
  if (explicitPrefix) return explicitPrefix;
  return FUNCTIONAL_GROUPS.find((group) => value.startsWith(`${group} / `)) || "";
}

function headerIndex(headers, matchers) {
  const normalized = headers.map(normalizeHeaderName);
  return normalized.findIndex((name) => matchers.some((matcher) => matcher(name)));
}

function inferFunctionalGroup(headers, row) {
  const moduleIndex = headerIndex(headers, [
    (name) => name === "module",
    (name) => name.includes("module"),
    (name) => name.includes("phan he"),
  ]);
  const scenarioIndex = headerIndex(headers, [
    (name) => name.includes("truong hop"),
    (name) => name.includes("scenario"),
    (name) => name.includes("test title"),
    (name) => name.includes("test case"),
  ]);

  const moduleValue = row[moduleIndex] || "";
  const prefixedGroup = groupFromModulePrefix(moduleValue);
  if (prefixedGroup) return prefixedGroup;

  const raw = [moduleValue, row[scenarioIndex] || ""].join(" ");
  const text = normalizeHeaderName(raw);

  if (/(^|[^a-z0-9])api([^a-z0-9]|$)/.test(text) || /\/api\/v\d+\//i.test(raw)) return "API";
  if (text.includes("cross app") || text.includes("cross-app") || text.includes("e2e") || text.includes("dong bo") || text.includes("sync")) {
    return "E2E/Cross-app";
  }
  if (text.includes("permission") || text.includes("security") || text.includes("authorization") || text.includes("unauthorized") || text.includes("forbidden") || text.includes("phan quyen")) {
    return "Permission/Security";
  }
  if (text.includes("us 05") || text.includes("delete") || text.includes("remove") || /\bxoa\b/.test(text)) return "Xóa";
  if (text.includes("us 04") || text.includes("edit") || text.includes("update") || /\bsua\b/.test(text) || text.includes("cap nhat") || text.includes("setting")) {
    return "Sửa";
  }
  if (text.includes("us 03") || text.includes("create") || /\btao\b/.test(text)) return "Tạo";
  if (text.includes("us 02") || text.includes("detail") || text.includes("chi tiet") || text.includes("overview") || text.includes("students tab")) {
    return "Xem chi tiết";
  }
  if (text.includes("us 01") || text.includes("list") || text.includes("danh sach") || text.includes("filter") || text.includes("sort") || text.includes("pagination")) {
    return "Xem danh sách";
  }

  return "Khác";
}

function sanitizeSheetName(name, usedNames) {
  const base = String(name || "Khác")
    .replace(/[\\/?*:[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31) || "Khác";
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    const marker = ` ${suffix}`;
    candidate = base.slice(0, 31 - marker.length) + marker;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

function getContractColumnWidth(header) {
  const name = normalizeHeaderName(header);
  if (name.includes("precondition id")) return 16;
  if (name.includes("mo ta") || name.includes("trang thai")) return 34;
  if (name.includes("precondition type") || name === "type") return 18;
  if (name.includes("setup strategy")) return 16;
  if (name.includes("setup source")) return 52;
  if (name.includes("verification")) return 42;
  if (name.includes("cleanup") || name.includes("rollback")) return 34;
  if (name.includes("readiness")) return 20;
  if (name.includes("linked")) return 28;
  return 24;
}

function estimateRowHeight(row, colWidths) {
  const maxLines = row.reduce((max, value, index) => {
    const width = colWidths[index] || 20;
    const text = String(value || "");
    const lines = text.split(/\n/).reduce((sum, line) => {
      return sum + Math.max(1, Math.ceil(line.length / Math.max(12, width)));
    }, 0);
    return Math.max(max, lines);
  }, 1);
  // Trần 409 = giới hạn CỨNG của Excel (409.5pt); trước đây là 150 và đó là lỗi hiển thị, không phải quy
  // ước từ file mẫu QA: `wrapText` bật nhưng dòng bị ép thấp hơn nội dung nên chữ BỊ CẮT. Đo trên bộ
  // CSDL-3544 (60 case) trước khi sửa: 55/60 dòng (92%) cần cao hơn 150pt, dòng nặng nhất cần ~375pt ⇒
  // mất ~60% nội dung nhìn thấy được. Người đọc Excel không biết mình đang đọc thiếu — đó là kiểu hỏng
  // tệ nhất. Cột `Test Steps`/`Expected Result` vốn nhiều dòng nên chạm trần là chuyện thường, không phải
  // dấu hiệu case viết dài.
  return Math.min(409, Math.max(24, maxLines * 15));
}

// #1: delegate table-scanner canonical (cùng logic split \| → xlsx y hệt; predicate đòi expected khớp gate).
function parseMdTables(filePath) {
  return canonical.parseTablesMatching(fs.readFileSync(filePath, "utf8").split(/\r?\n/), canonical.isTestCaseHeader);
}

function parseSetupContractTables(filePath) {
  return canonical.parseTablesMatching(fs.readFileSync(filePath, "utf8").split(/\r?\n/), canonical.isSetupContractHeader);
}

function columnIndexToName(index) {
  let name = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function styleWorksheet(worksheet, headers, rows, colWidths) {
  worksheet.columns.forEach((column, index) => {
    column.width = colWidths[index] || 24;
  });

  worksheet.autoFilter = {
    from: "A1",
    to: `${columnIndexToName(headers.length - 1)}${rows.length + 1}`,
  };

  worksheet.eachRow((row, rowNumber) => {
    row.height = rowNumber === 1 ? 24 : estimateRowHeight(row.values.slice(1), colWidths);
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
      if (rowNumber === 1) cell.font = { bold: true };
    });
  });
}

function addTestcaseWorksheet(workbook, name, headers, rows, colWidths) {
  const worksheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  worksheet.addRow(headers);
  for (const row of rows) worksheet.addRow(row);
  styleWorksheet(worksheet, headers, rows, colWidths);
  return worksheet;
}

function addContractWorksheet(workbook, contractTables) {
  const contractTable = contractTables && contractTables[0];
  if (!contractTable || !contractTable.rows.length) return;
  const cHeaders = contractTable.headers.map(cleanCell);
  const cWidths = cHeaders.map(getContractColumnWidth);
  const cRows = contractTable.rows.map((row) => cHeaders.map((_, i) => cleanCell(row[i] || "")));
  const usedNames = new Set(workbook.worksheets.map((sheet) => sheet.name));
  addTestcaseWorksheet(workbook, sanitizeSheetName("Preconditions", usedNames), cHeaders, cRows, cWidths);
}

function solidConditionalStyle({ bg, font }) {
  return {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: bg }, bgColor: { argb: bg } },
    font: { bold: true, size: 10, color: { argb: font }, name: "Arial" },
  };
}

function setStyledCell(worksheet, addr, value, opts = {}) {
  const cell = worksheet.getCell(addr);
  cell.value = value;
  if (opts.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill } };
  if (opts.bold !== undefined || opts.white) cell.font = { bold: opts.bold !== false, color: opts.white ? { argb: "FFFFFFFF" } : undefined };
  // Mặc định TOP, không phải middle: nội dung testcase là khối nhiều dòng (steps/expected 5-10 dòng), căn
  // giữa theo chiều dọc làm dòng ngắn trôi xuống giữa ô cao 200pt, đọc theo hàng ngang không khớp nhau.
  cell.alignment = { vertical: opts.valign || "top", horizontal: opts.align || "left", wrapText: true };
  return cell;
}

/**
 * 1 sheet / nhóm chức năng — nhân bản layout `TC_TEMPLATE 1` của file mẫu: banner (Tên màn hình/Mã chức
 * năng/Ngày tạo) + mini-dashboard (Lần 1 nhập tay, Mới nhất tự tính) + header 16 cột (dòng 5) + data từ
 * dòng 7 + dropdown/conditional-formatting đúng danh sách đo được từ file mẫu.
 */
function addFunctionSheet(workbook, sheetName, groupLabel, rows, createdDate, nam5cap = false) {
  const HEADERS = nam5cap ? FUNC5_HEADERS : FUNC_HEADERS;
  const WIDTHS = nam5cap ? FUNC5_COL_WIDTHS : FUNC_COL_WIDTHS;
  // xSplit 1: khoá cột ID_TC khi cuộn ngang — cột Expected Result nằm tận cột G, cuộn sang đó mà mất ID_TC
  // thì không biết đang đọc case nào. ySplit 6: giữ banner + hàng tiêu đề như cũ.
  const worksheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", xSplit: 1, ySplit: 6 }] });

  /*
   * WRAP TEXT + TOP-LEFT Ở CẤP CỘT, không chỉ ở ô có dữ liệu.
   *
   * Lỗi đã đo trên file sinh ra ngày 25/09/2026: vòng `rows.forEach` bên dưới chỉ style những dòng CÓ nội
   * dung, nên các dòng 7–500 để trống dành cho QA điền tay ra `alignment: undefined` — QA gõ vào là chữ
   * không xuống dòng, căn giữa, và một bước dài tràn ngang che mất ô bên cạnh. Sheet có 1 case thì 493/494
   * dòng dính lỗi này.
   *
   * Style cấp CỘT là chỗ sửa đúng: Excel áp cho mọi ô chưa có style riêng — phủ cả dòng trống lẫn dòng QA
   * thêm sau dòng 500 — mà không phải ghi style cho ~8.900 ô mỗi sheet (18 cột × 494 dòng × 6 sheet ≈ 53k
   * ô, đủ để phình file và làm Excel mở chậm). Ô có style riêng (banner, header, dòng dữ liệu) vẫn thắng.
   */
  const FUNC_ALIGN = { vertical: "top", horizontal: "left", wrapText: true };
  worksheet.columns = WIDTHS.map((width) => ({ width, style: { alignment: FUNC_ALIGN } }));

  setStyledCell(worksheet, "A1", "Tên màn hình/chức năng:", { fill: COLOR.label });
  worksheet.mergeCells("A1:B1");
  setStyledCell(worksheet, "C1", groupLabel, { bold: false });
  worksheet.mergeCells("C1:F1");
  setStyledCell(worksheet, "G1", "Mã chức năng:", { fill: COLOR.label });
  setStyledCell(worksheet, "H1", sheetName, { bold: false });
  worksheet.mergeCells("H1:I1");
  setStyledCell(worksheet, "J1", "Ngày tạo:", { fill: COLOR.label });
  setStyledCell(worksheet, "K1", createdDate, { bold: false });
  worksheet.mergeCells("K1:M1");

  if (nam5cap) {
    /*
     * Ma trận theo cấp ở M..R — nhân bản công thức của bộ chuẩn.
     * "Tổng áp dụng" của một cấp = số case khai "Tất cả" CỘNG số case có tên cấp đó trong ô
     * "Áp dụng cho cấp". Phép SEARCH bọc hai đầu bằng dấu chấm giữa để "TH" không khớp nhầm vào "THCS".
     */
    setStyledCell(worksheet, "A2", "Kết quả", { fill: COLOR.resultHeader, white: true });
    setStyledCell(worksheet, "B2", "Tổng số case", { fill: COLOR.resultHeader, white: true });
    worksheet.mergeCells("B2:D2");
    setStyledCell(worksheet, "E2", "Pass", { fill: COLOR.resultHeader, white: true });
    setStyledCell(worksheet, "F2", "Fail", { fill: COLOR.resultHeader, white: true });
    setStyledCell(worksheet, "G2", "Blocked", { fill: COLOR.resultHeader, white: true });
    setStyledCell(worksheet, "H2", "Un_test", { fill: COLOR.resultHeader, white: true });
    setStyledCell(worksheet, "M2", "Chỉ số", { fill: COLOR.resultHeader, white: true });
    CAP_COLS.forEach(([ten, col]) => setStyledCell(worksheet, `${col}2`, ten, { fill: COLOR.resultHeader, white: true }));

    setStyledCell(worksheet, "A3", "Lần 1", { fill: COLOR.label });
    worksheet.mergeCells("B3:D3");
    setStyledCell(worksheet, "M3", "Tổng áp dụng", { fill: COLOR.label });
    const R1 = FUNC_DATA_START_ROW; const R2 = FUNC_DATA_END_ROW;
    CAP_COLS.forEach(([ten, col]) => {
      const f = `COUNTIF($C$${R1}:$C$${R2},"Tất cả")+SUMPRODUCT(--ISNUMBER(SEARCH("·${ten}·","·"&SUBSTITUTE($C$${R1}:$C$${R2}&""," ","")&"·")))`;
      setStyledCell(worksheet, `${col}3`, { formula: f }, { fill: "FFFFFFFF", bold: false });
    });

    setStyledCell(worksheet, "A4", "Mới nhất", { fill: COLOR.label });
    setStyledCell(worksheet, "B4", { formula: `COUNTA($A$${R1}:$A$${R2})` }, { fill: "FFFFFFFF", bold: false });
    worksheet.mergeCells("B4:D4");
    setStyledCell(worksheet, "E4", { formula: `COUNTIF($N$${R1}:$R$${R2},"Pass")` }, { fill: "FFFFFFFF", bold: false });
    setStyledCell(worksheet, "F4", { formula: `COUNTIF($N$${R1}:$R$${R2},"Fail")` }, { fill: "FFFFFFFF", bold: false });
    setStyledCell(worksheet, "G4", { formula: `COUNTIF($N$${R1}:$R$${R2},"Blocked")` }, { fill: "FFFFFFFF", bold: false });
    setStyledCell(worksheet, "H4", { formula: "MAX(0,SUM($N$3:$R$3)-$E$4-$F$4-$G$4)" }, { fill: "FFFFFFFF", bold: false });
    setStyledCell(worksheet, "S3", "Một case chạy ở nhiều cấp thì mỗi cấp có một ô Result riêng. Tổng áp dụng tính từ cột 'Áp dụng cho cấp'.", { bold: false, valign: "top" });
    worksheet.mergeCells("S3:X4");
  } else {
  setStyledCell(worksheet, "A2", "Kết quả", { fill: COLOR.resultHeader, white: true });
  setStyledCell(worksheet, "B2", "Tổng số case", { fill: COLOR.resultHeader, white: true });
  worksheet.mergeCells("B2:C2");
  setStyledCell(worksheet, "D2", "Pass", { fill: COLOR.resultHeader, white: true });
  setStyledCell(worksheet, "E2", "Fail", { fill: COLOR.resultHeader, white: true });
  setStyledCell(worksheet, "F2", "Pending", { fill: COLOR.resultHeader, white: true });
  setStyledCell(worksheet, "G2", "Un_test", { fill: COLOR.resultHeader, white: true });

  setStyledCell(worksheet, "A3", "Lần 1", { fill: COLOR.label });
  worksheet.mergeCells("B3:C3");
  setStyledCell(worksheet, "H3", "Dòng 'Lần 1' nhập tay để lưu kết quả vòng test đầu. Dòng 'Mới nhất' tự tính từ cột Result.", { bold: false, valign: "top" });
  worksheet.mergeCells("H3:M4");

  setStyledCell(worksheet, "A4", "Mới nhất", { fill: COLOR.label });
  setStyledCell(worksheet, "B4", { formula: `COUNTA($A$${FUNC_DATA_START_ROW}:$A$${FUNC_DATA_END_ROW})` }, { fill: "FFFFFFFF", bold: false });
  worksheet.mergeCells("B4:C4");
  setStyledCell(worksheet, "D4", { formula: `COUNTIF($L$${FUNC_DATA_START_ROW}:$L$${FUNC_DATA_END_ROW},"Pass")` }, { fill: "FFFFFFFF", bold: false });
  setStyledCell(worksheet, "E4", { formula: `COUNTIF($L$${FUNC_DATA_START_ROW}:$L$${FUNC_DATA_END_ROW},"Fail")` }, { fill: "FFFFFFFF", bold: false });
  setStyledCell(worksheet, "F4", { formula: `COUNTIF($L$${FUNC_DATA_START_ROW}:$L$${FUNC_DATA_END_ROW},"Pending")` }, { fill: "FFFFFFFF", bold: false });
  setStyledCell(worksheet, "G4", { formula: "MAX(0,$B$4-$D$4-$E$4-$F$4)" }, { fill: "FFFFFFFF", bold: false });

  }

  HEADERS.forEach((h, i) => setStyledCell(worksheet, `${columnIndexToName(i)}5`, h, { fill: COLOR.header, white: true }));

  // Viền mảnh cho ô dữ liệu: dòng cao 150-300pt mà không viền thì hai dòng liền nhau dính vào nhau, mắt
  // không lần ra đâu là hết dòng. Gridline mặc định của Excel quá nhạt và bị nền của ô có fill che mất.
  const THIN_BORDER = {
    top: { style: "thin", color: { argb: "FFD0D0D0" } },
    left: { style: "thin", color: { argb: "FFD0D0D0" } },
    bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
    right: { style: "thin", color: { argb: "FFD0D0D0" } },
  };

  rows.forEach((row, i) => {
    const r = FUNC_DATA_START_ROW + i;
    for (let colIdx = 0; colIdx < HEADERS.length; colIdx++) {
      const cell = worksheet.getCell(`${columnIndexToName(colIdx)}${r}`);
      if (colIdx < row.length) cell.value = row[colIdx];
      cell.alignment = { ...FUNC_ALIGN };   // cùng một định nghĩa với style cấp cột, không để lệch hai chỗ
      cell.border = THIN_BORDER;
    }
    worksheet.getRow(r).height = estimateRowHeight(row, WIDTHS);
  });

  /*
   * Viền cho phần dòng trống còn lại của phạm vi 7–500. Alignment đã do style cấp cột lo, nhưng viền thì
   * không: thiếu viền ở vùng trống làm QA không nhìn ra ranh giới ô khi điền tay, mà đây đúng là vùng để
   * điền tay. Chỉ ghi border (không ghi alignment) nên chi phí thấp hơn hẳn việc style đủ mọi thuộc tính.
   */
  for (let r = FUNC_DATA_START_ROW + rows.length; r <= FUNC_DATA_END_ROW; r++) {
    for (let colIdx = 0; colIdx < HEADERS.length; colIdx++) {
      worksheet.getCell(`${columnIndexToName(colIdx)}${r}`).border = THIN_BORDER;
    }
  }

  // AutoFilter trên hàng tiêu đề (dòng 5) tới hết phạm vi dữ liệu — QA lọc được theo Priority / Test Type /
  // Result / Module ngay trong Excel, nhất là khi cần soi case còn `Un_test`.
  worksheet.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: FUNC_DATA_END_ROW, column: HEADERS.length },
  };

  // Dropdown + conditional formatting trên TOÀN phạm vi dòng 7-500 (khớp file mẫu) — kể cả dòng chưa có
  // data, để QA thêm case tay về sau vẫn có sẵn dropdown, không cần copy-format lại.
  const applyListValidation = (colLetter, csvList) => {
    for (let r = FUNC_DATA_START_ROW; r <= FUNC_DATA_END_ROW; r++) {
      worksheet.getCell(`${colLetter}${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [`"${csvList}"`] };
    }
  };
  if (nam5cap) {
    applyListValidation("I", DROPDOWN.testType5);
    applyListValidation("J", DROPDOWN.nhomKT);
    applyListValidation("K", DROPDOWN.priority);
    applyListValidation("L", DROPDOWN.testLevel5);
    for (const [, col] of CAP_COLS) {
      applyListValidation(col, DROPDOWN.result5);
      worksheet.addConditionalFormatting({
        ref: `${col}${FUNC_DATA_START_ROW}:${col}${FUNC_DATA_END_ROW}`,
        rules: [
          { type: "cellIs", operator: "equal", priority: 1, formulae: ['"Pass"'], style: solidConditionalStyle(COLOR.green) },
          { type: "cellIs", operator: "equal", priority: 2, formulae: ['"Fail"'], style: solidConditionalStyle(COLOR.red) },
          { type: "cellIs", operator: "equal", priority: 3, formulae: ['"Blocked"'], style: solidConditionalStyle(COLOR.yellow) },
        ],
      });
    }
  } else {
    applyListValidation("H", DROPDOWN.testType);
    applyListValidation("I", DROPDOWN.priority);
    applyListValidation("J", DROPDOWN.testLevel);
    applyListValidation("L", DROPDOWN.result);

    worksheet.addConditionalFormatting({
      ref: `L${FUNC_DATA_START_ROW}:L${FUNC_DATA_END_ROW}`,
      rules: [
        { type: "cellIs", operator: "equal", priority: 1, formulae: ['"Pass"'], style: solidConditionalStyle(COLOR.green) },
        { type: "cellIs", operator: "equal", priority: 2, formulae: ['"Fail"'], style: solidConditionalStyle(COLOR.red) },
        { type: "cellIs", operator: "equal", priority: 3, formulae: ['"Pending"'], style: solidConditionalStyle(COLOR.yellow) },
      ],
    });
  }

  worksheet.getRow(1).height = 20;
  worksheet.getRow(3).height = 20;
  worksheet.getRow(5).height = 24;
  return worksheet;
}

/**
 * Công thức đếm case theo kết quả cho một dòng dashboard. Sheet chức năng có thể mang 1 cột
 * `Result` (bố cục 13 cột) hoặc 5 cột `Result MN/TH/THCS/THPT/GDTX` (bố cục 24 cột), nên khối cột
 * được dò tại chỗ bằng MATCH("Result*") trên dòng header thay vì đóng cứng một chữ cái cột.
 */
function dashResultFormula(r, loai) {
  const hdr = `INDIRECT("'"&$D${r}&"'!$${FUNC_HEADER_ROW}:$${FUNC_HEADER_ROW}")`;
  const soCot = `COUNTIF(${hdr},"Result*")`;
  const cotDau = `MATCH("Result*",${hdr},0)`;
  const khoi = `INDIRECT("'"&$D${r}&"'!R${FUNC_DATA_START_ROW}C"&${cotDau}&":R${FUNC_DATA_END_ROW}C"&(${cotDau}+${soCot}-1),FALSE)`;
  // Gộp theo hàng: MMULT(khối, vector 1) cho ra số ô mang giá trị đó trên từng case.
  const dem = (gt) => `MMULT(--(${khoi}="${gt}"),ROW(INDIRECT("1:"&${soCot}))^0)`;
  const than = {
    Pass: `SUMPRODUCT((${dem("Pass")}>0)*(${dem("Pass")}+${dem("N/A")}=${soCot}))`,
    Fail: `SUMPRODUCT(--(${dem("Fail")}>0))`,
    Pending: `SUMPRODUCT((${dem("Fail")}=0)*(${dem("Pending")}+${dem("Blocked")}>0))`,
  }[loai];
  if (!than) throw new Error(`dashResultFormula: loại "${loai}" không có công thức`);
  return `IF($D${r}="","",IFERROR(${than},0))`;
}

/**
 * Sheet `Theo dõi tiến độ` — dashboard tự tính, 1 dòng/nhóm chức năng, kéo số liệu từ sheet chức năng
 * tương ứng qua `INDIRECT`. Layout/formula nhân bản chính xác file mẫu (đo bằng exceljs).
 */
function addDashboardWorksheet(workbook, groupEntries) {
  const worksheet = workbook.addWorksheet("Theo dõi tiến độ", { views: [{ state: "frozen", ySplit: 6 }] });
  const widths = [7.57, 24, 40, 20.57, 12.71, 13, 13, 12.14, 12.14, 12.14, 12.14, 12.14, 12.14, 15, 26];
  // Cùng luật wrap + top-left với sheet chức năng. Để hai sheet trong cùng file theo hai luật căn lề khác
  // nhau là thứ sớm muộn cũng có người sửa nhầm một bên.
  worksheet.columns = widths.map((width) => ({ width, style: { alignment: { vertical: "top", horizontal: "left", wrapText: true } } }));

  // Cấp tối thiểu 74 dòng (khớp file mẫu) hoặc đủ số nhóm thật nếu vượt — không cắt mất nhóm nào.
  const dashEndRow = Math.max(DASH_DATA_END_ROW, DASH_DATA_START_ROW + groupEntries.length - 1);

  setStyledCell(worksheet, "A1", "BẢNG THEO DÕI TIẾN ĐỘ KIỂM THỬ – <tên phần mềm>", { fill: COLOR.banner, white: true });
  worksheet.mergeCells("A1:O1");

  setStyledCell(worksheet, "A2", "Dự án / Phiên bản:", { fill: COLOR.label });
  worksheet.mergeCells("A2:C2");
  worksheet.mergeCells("D2:G2");
  setStyledCell(worksheet, "H2", "Cập nhật:", { fill: COLOR.label });
  worksheet.mergeCells("H2:I2");
  const updatedCell = setStyledCell(worksheet, "J2", { formula: "TODAY()" }, { bold: false });
  updatedCell.numFmt = "dd/mm/yyyy";
  worksheet.mergeCells("J2:K2");
  setStyledCell(worksheet, "L2", "Ô nền vàng = nhập tay. Ô nền trắng = công thức tự tính, không sửa.", { fill: COLOR.label, bold: false });
  worksheet.mergeCells("L2:O2");

  setStyledCell(worksheet, "A3", "Tổng số chức năng:", { fill: COLOR.totalsGreen });
  worksheet.mergeCells("A3:B3");
  setStyledCell(worksheet, "C3", { formula: `COUNTA($C$${DASH_DATA_START_ROW}:$C$${dashEndRow})` }, { fill: "FFFFFFFF", bold: false });
  ["Tổng TC", "Pass", "Fail", "Pending", "Un_test", "% Pass"].forEach((label, i) => {
    setStyledCell(worksheet, `${["H", "I", "J", "K", "L", "M"][i]}3`, label, { fill: COLOR.totalsGreen });
  });
  setStyledCell(worksheet, "N3", "Số liệu Tổng TC / Pass / Fail / Pending tự đếm từ từng sheet test case.", { fill: COLOR.label, bold: false, valign: "top" });
  worksheet.mergeCells("N3:O4");

  setStyledCell(worksheet, "A4", "Đã hoàn thành:", { fill: COLOR.totalsGreen });
  worksheet.mergeCells("A4:B4");
  setStyledCell(worksheet, "C4", { formula: `COUNTIF($N$${DASH_DATA_START_ROW}:$N$${dashEndRow},"Hoàn thành")` }, { fill: "FFFFFFFF", bold: false });
  setStyledCell(worksheet, "H4", { formula: `SUM(H${DASH_DATA_START_ROW}:H${dashEndRow})` }, { fill: "FFFFFFFF", bold: false });
  setStyledCell(worksheet, "I4", { formula: `SUM(I${DASH_DATA_START_ROW}:I${dashEndRow})` }, { fill: "FFFFFFFF", bold: false });
  setStyledCell(worksheet, "J4", { formula: `SUM(J${DASH_DATA_START_ROW}:J${dashEndRow})` }, { fill: "FFFFFFFF", bold: false });
  setStyledCell(worksheet, "K4", { formula: `SUM(K${DASH_DATA_START_ROW}:K${dashEndRow})` }, { fill: "FFFFFFFF", bold: false });
  setStyledCell(worksheet, "L4", { formula: `SUM(L${DASH_DATA_START_ROW}:L${dashEndRow})` }, { fill: "FFFFFFFF", bold: false });
  setStyledCell(worksheet, "M4", { formula: "IF($H$4=0,\"\",$I$4/$H$4)" }, { fill: "FFFFFFFF", bold: false });

  const dashHeaders = ["STT", "Phân hệ", "Chức năng", "Mã CN\n(= tên sheet)", "Người thực hiện", "Ngày bắt đầu", "Ngày kết thúc", "Tổng TC", "Pass", "Fail", "Pending", "Un_test", "% Pass", "Trạng thái", "Ghi chú"];
  dashHeaders.forEach((h, i) => setStyledCell(worksheet, `${columnIndexToName(i)}6`, h, { fill: COLOR.header, white: true }));

  for (let i = 0; i <= dashEndRow - DASH_DATA_START_ROW; i++) {
    const r = DASH_DATA_START_ROW + i;
    const entry = groupEntries[i];
    worksheet.getCell(`A${r}`).value = { formula: `IF($D${r}="","",ROW()-6)` };
    if (entry) {
      worksheet.getCell(`C${r}`).value = entry.group;
      worksheet.getCell(`D${r}`).value = entry.sheetName;
    }
    worksheet.getCell(`H${r}`).value = { formula: `IF($D${r}="","",IFERROR(COUNTIF(INDIRECT("'"&$D${r}&"'!$A$${FUNC_DATA_START_ROW}:$A$${FUNC_DATA_END_ROW}"),"?*"),0))` };
    worksheet.getCell(`I${r}`).value = { formula: dashResultFormula(r, "Pass") };
    worksheet.getCell(`J${r}`).value = { formula: dashResultFormula(r, "Fail") };
    worksheet.getCell(`K${r}`).value = { formula: dashResultFormula(r, "Pending") };
    worksheet.getCell(`L${r}`).value = { formula: `IF($D${r}="","",MAX(0,$H${r}-$I${r}-$J${r}-$K${r}))` };
    worksheet.getCell(`M${r}`).value = { formula: `IF(N($H${r})=0,"",$I${r}/$H${r})` };
    worksheet.getCell(`N${r}`).value = { formula: `IF($D${r}="","",IF($H${r}=0,"Chưa có TC",IF($I${r}+$J${r}+$K${r}=0,"Chưa test",IF($I${r}=$H${r},"Hoàn thành",IF($J${r}>0,"Có lỗi","Đang test")))))` };
    worksheet.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    });
  }

  worksheet.addConditionalFormatting({
    ref: `N${DASH_DATA_START_ROW}:N${dashEndRow}`,
    rules: [
      { type: "cellIs", operator: "equal", priority: 1, formulae: ['"Hoàn thành"'], style: solidConditionalStyle(COLOR.green) },
      { type: "cellIs", operator: "equal", priority: 2, formulae: ['"Có lỗi"'], style: solidConditionalStyle(COLOR.red) },
      { type: "cellIs", operator: "equal", priority: 3, formulae: ['"Đang test"'], style: solidConditionalStyle(COLOR.yellow) },
      { type: "cellIs", operator: "equal", priority: 4, formulae: ['"Chưa test"'], style: solidConditionalStyle(COLOR.gray) },
      { type: "cellIs", operator: "equal", priority: 5, formulae: ['"Chưa có TC"'], style: solidConditionalStyle(COLOR.lightGray) },
    ],
  });

  worksheet.getRow(1).height = 30;
  worksheet.getRow(6).height = 30;
  return worksheet;
}

/** Sheet `Hướng dẫn` — quy ước màu/số liệu/dropdown, nội dung bám sát file mẫu, chỉnh riêng mục thêm chức
 * năng mới cho khớp việc kit TỰ SINH sheet (không phải copy tay `TC_TEMPLATE`). */
function addGuideWorksheet(workbook) {
  const worksheet = workbook.addWorksheet("Hướng dẫn");
  const guideAlign = { vertical: "top", horizontal: "left", wrapText: true };
  worksheet.columns = [{ width: 4 }, { width: 30 }, { width: 95 }].map((c) => ({ ...c, style: { alignment: guideAlign } }));

  setStyledCell(worksheet, "B1", "HƯỚNG DẪN SỬ DỤNG FILE", { fill: COLOR.banner, white: true });
  worksheet.mergeCells("B1:C1");

  const rows = [
    /*
     * Ràng buộc chạy case: nói MỘT lần ở đây thay vì lặp trong từng ô testcase.
     * Trước 30/09/2026 những dòng này nằm rải trong cột Tiền điều kiện và Kết quả mong đợi — đo được
     * 73 dòng trên 5 bộ, cùng một nội dung lặp tới 19 lần. Người đọc phải lướt qua chúng ở mọi case,
     * trong khi chúng là nghĩa vụ chung của cả file chứ không phải điều kiện riêng của case nào.
     */
    ["ĐỌC TRƯỚC KHI CHẠY",
      "Bốn ràng buộc dưới đây áp dụng cho MỌI case trong file, không lặp lại ở từng dòng nữa.\n"
      + "1. DỮ LIỆU KHÁCH: không đính file xuất/nhập có dữ liệu thật vào report hay Backlog. Chỉ chụp ảnh "
      + "ĐÃ CHE, và xoá file sau khi đối chiếu xong.\n"
      + "2. CHE GÌ khi chụp evidence: Họ tên · Ngày sinh · CCCD · số định danh cá nhân · điện thoại · "
      + "địa chỉ · thông tin cha/mẹ. Che rồi vẫn phải nhìn ra được thứ đang cần chứng minh.\n"
      + "3. KHÔNG PHÁ DỮ LIỆU UAT: case tạo/sửa/xoá chỉ chạy trên bản ghi do chính lượt chạy tạo ra "
      + "(dữ liệu đặt tên theo quy ước test), xác nhận trước khi chạm, dọn sau khi xong. Case ghi đè "
      + "hàng loạt và KHÔNG có nút hoàn tác thì phải hỏi trước.\n"
      + "4. SỐ TỪ DB KHÔNG PHẢI EVIDENCE: truy vấn chỉ để khoanh tầng lỗi, và chỉ đọc. Evidence vẫn là "
      + "ảnh màn hình."],
    ["Quy ước màu", "Ô nền vàng, chữ xanh = nhập tay. Ô nền trắng = công thức tự tính, đừng gõ đè lên."],
    ["Thêm 1 chức năng mới",
      "Sheet theo chức năng do kit TỰ SINH từ Markdown testcase (mỗi 'Nhóm chức năng' → 1 sheet, tên sheet " +
      "= Mã CN). Thêm case cho chức năng mới: thêm vào bảng Markdown nguồn rồi chạy lại\n" +
      "`node scripts/convert_excel/md_to_xlsx.js <input.md> <output.xlsx>` — sheet mới và dòng dashboard " +
      "tương ứng tự xuất hiện, không cần copy tay. Nếu thêm case TAY ngoài quy trình: đặt tên sheet đúng " +
      "bằng giá trị cột 'Mã CN' trên dashboard — sai một ký tự là số liệu về 0."],
    ["Số liệu tự tính",
      "Tổng TC = số dòng có ID_TC (cột A) trong sheet chức năng.\n" +
      "Pass / Fail / Pending đếm theo CASE, gộp từ nhóm cột Result (Result MN/TH/THCS/THPT/GDTX):\n" +
      "  Pass = có ít nhất một cấp Pass và các cấp còn lại đều Pass hoặc N/A;\n" +
      "  Fail = có ít nhất một cấp Fail;\n" +
      "  Pending = chưa cấp nào Fail và có ít nhất một cấp Pending hoặc Blocked.\n" +
      "Cấp không áp dụng thì chọn N/A — để trống thì case chưa được tính là xong.\n" +
      "Un_test = Tổng TC trừ đi Pass, Fail, Pending — tức là các case chưa chấm xong."],
    ["Trạng thái tự suy ra",
      "Chưa có TC: sheet chưa có dòng test case nào (hoặc chưa tạo sheet).\nChưa test: đã có test case " +
      "nhưng chưa chấm kết quả nào.\nĐang test: đã chấm một phần, chưa có Fail.\nCó lỗi: đang có ít nhất 1 " +
      "case Fail.\nHoàn thành: 100% case Pass."],
    ["Phạm vi công thức",
      `Mỗi sheet test case tính từ dòng ${FUNC_DATA_START_ROW} đến dòng ${FUNC_DATA_END_ROW}. Nếu 1 chức ` +
      "năng vượt quá thì sửa lại vùng trong công thức của cả 2 nơi: mini-dashboard của sheet đó và dòng " +
      "tương ứng trên dashboard `Theo dõi tiến độ`."],
    ["Dropdown có sẵn",
      `Test Type: 18 loại theo chuẩn dự án (${DROPDOWN.testType}).\nPriority: ${DROPDOWN.priority}.\n` +
      `Test Level: ${DROPDOWN.testLevel}.\nResult: ${DROPDOWN.result}.`],
    ["Dòng 'Lần 1' và 'Mới nhất'",
      "Dòng 'Mới nhất' trong mỗi sheet tự đếm theo cột Result hiện tại. Trước khi bắt đầu vòng regression, " +
      "copy số của 'Mới nhất' rồi paste value vào dòng 'Lần 1' để giữ lại kết quả vòng trước."],
    ["Khi để trên Google Drive",
      "Upload thẳng file .xlsx rồi mở bằng Google Sheets. Công thức COUNTIF + INDIRECT chạy bình thường " +
      "trên Sheets. Riêng định dạng có điều kiện đôi khi bị nhạt màu sau khi convert, mở Format → " +
      "Conditional formatting kiểm tra lại 1 lần."],
    ["Cột chưa có nguồn tự động",
      "Test Level / Actor-Role / Note / Test Objective / Technique để TRỐNG khi export — không có field " +
      "tương ứng trong testcase Markdown nguồn, QA điền tay sau khi mở file. Test Type suy best-effort từ " +
      "tag chiều [Positive]/[Negative]/... trong tiêu đề case, không phải lúc nào cũng khớp — kiểm/sửa lại " +
      "khi cần."],
    ["2 cột cuối (Loại case, Tag)",
      "Không có trong file mẫu gốc — giữ lại vì đây là dữ liệu ĐÃ QUA GATE lúc sinh case (9 Case Type ở " +
      "`.agent/config/case_types.json`, tag chiều `[Positive]/[BR-xxx]`...). Bỏ đi là mất thông tin đã " +
      "được kiểm, nên đặt SAU CÙNG để không ảnh hưởng vị trí các cột giống file mẫu."],
  ];

  rows.forEach(([label, rawText], i) => {
    const r = i + 3;
    // Chính sheet hướng dẫn cũng phải sạch Markdown: nó đi thẳng ra Excel/Sheet chứ không qua cleanCell
    // như ô testcase, nên trước 30/09/2026 nó là nơi DUY NHẤT còn lọt backtick ra file xuất.
    const text = stripMarkdownInline(rawText);
    setStyledCell(worksheet, `B${r}`, stripMarkdownInline(label), { fill: COLOR.label, valign: "top" });
    setStyledCell(worksheet, `C${r}`, text, { bold: false, valign: "top" });
    const longestLine = Math.max(...text.split("\n").map((l) => l.length));
    worksheet.getRow(r).height = Math.min(220, Math.max(20, text.split("\n").length * 16 + Math.ceil(longestLine / 90) * 14));
  });

  return worksheet;
}

/**
 * Đọc lại cột `Result *` của file .xlsx ĐANG CÓ, trả về Map<ID_TC, Map<tên cột Result, giá trị>>.
 *
 * VÌ SAO CẦN: Markdown không mang kết quả execute, nên dựng workbook mới rồi ghi đè là xoá trắng
 * mọi verdict đã merge. Đo 06/10/2026 trên CSDL-9001: 468 ô kết quả biến mất sau một lượt xuất lại,
 * và chúng chỉ còn ở `test-results/*.json` — nơi không ai đọc khi duyệt. Excel là source-of-truth
 * của kết quả theo §6, nên lượt xuất phải GIỮ, không được dọn.
 */
async function docResultDaCo(outputPath) {
  const giu = new Map();
  if (!fs.existsSync(outputPath)) return giu;
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);
    for (const ws of wb.worksheets) {
      const hdr = [];
      for (let i = 1; i <= 40; i += 1) hdr.push(String(ws.getRow(FUNC_HEADER_ROW).getCell(i).value ?? '').trim());
      const iId = hdr.findIndex((h) => /^ID_TC$/i.test(h));
      const cols = hdr.map((h, i) => ({ h, i })).filter((x) => /^result\b/i.test(x.h));
      if (iId < 0 || !cols.length) continue;
      for (let r = FUNC_DATA_START_ROW; r <= FUNC_DATA_END_ROW; r += 1) {
        const id = ws.getRow(r).getCell(iId + 1).value;
        const key = String((id && id.result) || id || '').trim();
        if (!key) continue;
        for (const c of cols) {
          const v = ws.getRow(r).getCell(c.i + 1).value;
          const val = String((v && v.result) || v || '').trim();
          if (!val) continue;
          if (!giu.has(key)) giu.set(key, new Map());
          giu.get(key).set(c.h, val);
        }
      }
    }
  } catch (e) {
    console.warn(`⚠ không đọc lại được kết quả cũ ở ${outputPath} (${e.message}) — lượt xuất này sẽ KHÔNG giữ cột Result.`);
  }
  return giu;
}

/** Đặt lại các giá trị `Result *` đã nhớ vào workbook vừa dựng. */
function datLaiResult(workbook, giu) {
  if (!giu.size) return 0;
  let n = 0;
  for (const ws of workbook.worksheets) {
    const hdr = [];
    for (let i = 1; i <= 40; i += 1) hdr.push(String(ws.getRow(FUNC_HEADER_ROW).getCell(i).value ?? '').trim());
    const iId = hdr.findIndex((h) => /^ID_TC$/i.test(h));
    const byName = new Map(hdr.map((h, i) => [h, i]).filter(([h]) => /^result\b/i.test(h)));
    if (iId < 0 || !byName.size) continue;
    for (let r = FUNC_DATA_START_ROW; r <= FUNC_DATA_END_ROW; r += 1) {
      const id = ws.getRow(r).getCell(iId + 1).value;
      const key = String(id || '').trim();
      if (!key || !giu.has(key)) continue;
      for (const [ten, val] of giu.get(key)) {
        const ci = byName.get(ten);
        if (ci === undefined) continue;
        ws.getRow(r).getCell(ci + 1).value = val;
        n += 1;
      }
    }
  }
  return n;
}
async function buildXlsx(tables, contractTables, outputPath) {
  // Gộp mọi bảng Markdown → TestCase canonical (`canonical.buildTestCase`, cùng logic parseMarkdown/
  // parseXlsx dùng — KHÔNG tự chế lại field). Nhóm suy từ cột `Nhóm chức năng` nếu có; bộ TC cũ chưa có
  // cột đó fallback `inferFunctionalGroup` (heuristic cũ, giữ nguyên để không đỏ oan bộ đang publish).
  const groupedRows = new Map();
  let dungBoChuan = false;
  for (const table of tables) {
    const headers = table.headers.map(cleanCell);
    for (const row of table.rows) {
      const tc = canonical.buildTestCase(headers, row, "");
      const cleanedCells = headers.map((_, i) => cleanCell(row[i] || ""));
      const group = tc.group || inferFunctionalGroup(headers, cleanedCells) || "Khác";
      const testType = pickTestType(tc.dimensions, canonical.DIMENSION_TAGS);
      /*
       * Hai bố cục. Bộ nào khai cột "Áp dụng cho cấp" thì xuất theo bộ chuẩn của hệ thống
       * (24 cột, Result tách theo 5 cấp); bộ nào không khai thì giữ bố cục cũ 18 cột.
       * Phát hiện theo DỮ LIỆU chứ không theo tên task — thêm task 5 cấp sau này không phải sửa code.
       */
      const iCap = headers.findIndex((h) => /^Áp dụng cho cấp$/i.test(String(h || '').trim()));
      const capValue = iCap >= 0 ? (cleanedCells[iCap] || 'Tất cả') : '';
      const outRow = iCap >= 0
        ? [
          tc.tcId, tc.module, capValue, displayTitle(tc.title), tc.precondition, tc.data, tc.stepsRaw,
          tc.expectedRaw, testType5(testType), nhomKTFromTags(tc.tags), normalizePriority(tc.priority),
          "", "", "", "", "", "", "",
          "", "", "", tc.traceability.reqId || tc.traceability.story || "", "", group,
        ]
        : [
          tc.tcId, tc.module, displayTitle(tc.title), tc.precondition, tc.data, tc.stepsRaw, tc.expectedRaw,
          testType, normalizePriority(tc.priority), "", "", "", "", "", "",
          tc.traceability.reqId || tc.traceability.story || "",
          tc.caseType || "", tc.tags || "",
        ];
      if (iCap >= 0) dungBoChuan = true;
      if (!groupedRows.has(group)) groupedRows.set(group, []);
      groupedRows.get(group).push(outRow);
    }
  }

  const usedNames = new Set(["Theo dõi tiến độ", "Hướng dẫn"]);
  const groupEntries = [...groupedRows.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "vi"))
    .map(([group, rows]) => ({ group, sheetName: sanitizeSheetName(group, usedNames), rows }));

  // Nhớ kết quả execute TRƯỚC khi dựng workbook mới — dựng xong là file cũ bị ghi đè.
  const resultDaCo = await docResultDaCo(outputPath);

  const workbook = new ExcelJS.Workbook();
  workbook.calcProperties.fullCalcOnLoad = true;
  workbook.creator = "test-automation-kit";
  workbook.created = new Date();

  // Thứ tự add = thứ tự tab: dashboard + hướng dẫn đứng trước, khớp file mẫu.
  addDashboardWorksheet(workbook, groupEntries);
  addGuideWorksheet(workbook);

  const createdDate = new Date().toISOString().slice(0, 10);
  let total = 0;
  for (const { group, sheetName, rows } of groupEntries) {
    addFunctionSheet(workbook, sheetName, group, rows, createdDate, dungBoChuan);
    total += rows.length;
  }

  addContractWorksheet(workbook, contractTables);

  // Đặt lại kết quả execute đã nhớ — phải sau khi mọi sheet chức năng đã dựng xong.
  const nGiu = datLaiResult(workbook, resultDaCo);
  if (nGiu) console.log(`  giữ lại ${nGiu} ô kết quả execute từ file .xlsx trước đó (Markdown không mang verdict).`);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
  await normalizeXlsxForExcel(outputPath);
  return total;
}

/**
 * VÁ LỖI EXCELJS: gỡ `<dataValidation>` trùng vùng, nếu không Excel báo "We found a problem with some
 * content" và bắt Repair khi mở file.
 *
 * Gốc lỗi ở `exceljs/lib/xlsx/xform/sheet/data-validations-xform.js` → `optimiseDataValidations()`:
 * nó sort địa chỉ ô bằng SO SÁNH CHUỖI (`strcmp`), nên `"H10" < "H7"`. Với dải H7:H500 nó bắt đầu gom từ
 * H10 xuống H500 (ra `H10:H500`), rồi khi tới H7 lại gom tiếp xuống H500 (ra `H7:H500`) ⇒ hai vùng CHỒNG
 * NHAU cho cùng một rule. Bất kỳ dải nào lẫn hàng 1 chữ số với hàng nhiều chữ số đều dính — tức MỌI file
 * kit từng xuất (dropdown luôn áp từ dòng 7 tới 500).
 *
 * Đã thử `worksheet.dataValidations.add('H7:H500', …)`: NÉM `TypeError: Cannot set properties of undefined`
 * ngay trong chính hàm đó, nên không dùng được API range. Vì vậy vá ở tầng file sau khi ghi.
 *
 * Cách vá: trong mỗi sheet, gom các `<dataValidation>` theo RULE (toàn bộ block trừ `sqref`); trong mỗi
 * nhóm, bỏ vùng nào nằm TRỌN trong một vùng khác. Chỉ xử dạng một cột `X<r1>:X<r2>` — gặp dạng khác thì
 * giữ nguyên, không đoán.
 */
async function normalizeXlsxForExcel(filePath) {
  const JSZip = require("jszip");
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const sheetNames = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  let removed = 0;
  let touched = false;

  for (const name of sheetNames) {
    let xml = await zip.file(name).async("string");

    /*
     * (2) TRẢ AUTO-FIT CHIỀU CAO LẠI CHO EXCEL.
     *
     * ExcelJS gắn `customHeight="1"` cho mọi dòng được gán `height`. Với Excel, cờ đó nghĩa là "người dùng
     * đã chỉnh tay" ⇒ Excel KHÔNG auto-fit nữa mà giữ đúng con số ta ghi. Mà con số đó do
     * `estimateRowHeight()` ước lượng bằng `độ dài chuỗi / độ rộng cột` — không dùng font metrics thật,
     * không tính chữ có dấu, không tính font tỉ lệ ⇒ luôn lệch: dòng thì thừa chỗ trống, dòng thì CẮT chữ.
     * Google Sheets khi import tự tính lại chiều cao nên không lộ lỗi này — đó là lý do file "trông ổn trên
     * Sheet nhưng đọc sai trên Excel".
     *
     * Cách xử: GIỮ `ht` (làm gợi ý cho Sheets/LibreOffice) nhưng BỎ `customHeight` ở các dòng DỮ LIỆU
     * (r >= 7) để Excel tự co giãn theo font thật. Dòng banner/nhãn (r < 7) giữ nguyên vì chiều cao cố định
     * ở đó là có chủ ý và khớp file mẫu QA.
     */
    const before = xml;
    xml = xml.replace(/<row r="(\d+)"([^>]*?)\s*customHeight="1"/g, (m, r, rest) =>
      (Number(r) >= FUNC_DATA_START_ROW ? `<row r="${r}"${rest}` : m));
    if (xml !== before) touched = true;

    const block = xml.match(/<dataValidations[^>]*>[\s\S]*?<\/dataValidations>/);
    if (!block) { zip.file(name, xml); continue; }

    const entries = block[0].match(/<dataValidation\b[\s\S]*?<\/dataValidation>|<dataValidation\b[^>]*\/>/g) || [];
    if (entries.length < 2) { zip.file(name, xml); continue; }

    /*
     * Nhận cả vùng NHIỀU CỘT (`N7:R500`), không chỉ một cột.
     *
     * Bản đầu chỉ khớp `X<r1>:X<r2>` nên vùng nhiều cột rơi vào nhánh "dạng lạ → giữ nguyên", và cặp
     * `N7:R500` × `N10:R500` sống sót qua cả gate lẫn hàm vá này — phát hiện 05/10/2026 khi soi lại
     * chính file kit xuất ra. Cùng một lỗi sort chuỗi của ExcelJS, chỉ khác là vùng trải nhiều cột.
     * So theo cặp (cột đầu, cột cuối) nên vẫn không đoán bừa: hai vùng khác khung cột thì không đụng nhau.
     */
    const parse = (e) => {
      const m = e.match(/sqref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/);
      return m ? { col: `${m[1]}:${m[3]}`, from: Number(m[2]), to: Number(m[4]) } : null;
    };
    const ruleOf = (e) => e.replace(/\s*sqref="[^"]*"/, "");

    const keep = entries.filter((e, i) => {
      const a = parse(e);
      if (!a) return true; // dạng lạ → giữ, không đoán
      return !entries.some((other, j) => {
        if (i === j || ruleOf(other) !== ruleOf(e)) return false;
        const b = parse(other);
        if (!b || b.col !== a.col) return false;
        const contains = b.from <= a.from && b.to >= a.to;
        const identical = b.from === a.from && b.to === a.to;
        return identical ? j < i : contains; // trùng khít thì chỉ bỏ bản sau
      });
    });

    if (keep.length !== entries.length) {
      removed += entries.length - keep.length;
      const rebuilt = `<dataValidations count="${keep.length}">${keep.join("")}</dataValidations>`;
      xml = xml.replace(block[0], rebuilt);
      touched = true;
    }
    zip.file(name, xml);
  }

  if (!touched) return 0;
  fs.writeFileSync(filePath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  return removed;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log("Usage: node scripts/convert_excel/md_to_xlsx.js <input.md> [output.xlsx]");
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const outputPath = args[1] ? path.resolve(args[1]) : inputPath.replace(/\.md$/i, ".xlsx");
  const tables = parseMdTables(inputPath);
  if (tables.length === 0) {
    console.error("No testcase markdown table found.");
    process.exit(1);
  }

  // PREFLIGHT (G1): input/config bắt buộc phải đủ & parse được TRƯỚC khi convert (miss-file/PARSE_FAILURE = CHẶN).
  {
    const LENIENT = args.includes("--lenient") || process.env.QA_STRICT === "0";
    const QA_APPROVED = args.includes("--qa-approved");
    const pf = preflight.runPreflight({ mode: "phase1" });
    if (pf.warnings && pf.warnings.length) console.warn(`[preflight] ⚠ ${pf.warnings.join(" | ")}`);
    if (pf.problems && pf.problems.length) {
      const msg = `[preflight] ✗ ${pf.problems.length} input bắt buộc thiếu/hỏng:\n  - ${pf.problems.join("\n  - ")}\n→ Đọc/sửa input rồi convert lại.`;
      if (!LENIENT && !QA_APPROVED) { console.error(msg); process.exit(1); }
      console.warn(`${msg}\n  [bỏ qua] vẫn convert.`);
    }
  }

  // DESIGN GATE (G5): structural (đủ cột canonical) + completeness (ô lõi không rỗng). Row-quality/oracle do gate gen-testcase dưới lo.
  {
    const LENIENT = args.includes("--lenient") || process.env.QA_STRICT === "0";
    const QA_APPROVED = args.includes("--qa-approved");
    const d = designGate.gateDesign(fs.readFileSync(inputPath, "utf8"));
    if (d.warnings && d.warnings.length) console.warn(`[design] ⚠ ${d.warnings.length} cảnh báo:\n  ~ ${d.warnings.join("\n  ~ ")}`);
    if (d.problems && d.problems.length) {
      const msg = `[design] ✗ ${d.problems.length} vi phạm CHẶN (thiết kế testcase — thiếu cột / rỗng ô lõi):\n  - ${d.problems.join("\n  - ")}\n→ Sửa rồi convert lại.`;
      if (!LENIENT && !QA_APPROVED) { console.error(msg); process.exit(1); }
      console.warn(`${msg}\n  [bỏ qua] vẫn convert.`);
    }
  }

  /*
   * GATE `Loại case`: case SINH MỚI phải tự xác định 1 trong 9 loại đã chốt. Danh sách + định nghĩa +
   * "chọn khi / không chọn khi" của từng loại nằm ở `.agent/config/case_types.json` (nguồn DUY NHẤT).
   *
   * VÌ SAO CHẶN Ở BƯỚC CONVERT chứ không thêm vào REQUIRED_COLS: `validate()` là bộ đọc DÙNG CHUNG, thêm
   * vào đó thì mọi bộ TC cũ (9 task, đều 9 cột) đỏ theo — đúng cái bẫy "siết sai chỗ". Convert md→xlsx là
   * ĐÚNG biên sinh case: bộ cũ không convert lại nên không bị đụng, bộ mới thì không lọt.
   *
   * VÌ SAO PHẢI CHẶN: kit từng SUY loại từ tên nhóm chức năng ⇒ đo trên 1.399 case đã publish thì 96% rơi
   * về `Functional`, `Integration` và `Performance` = 0 ⇒ lọc/báo cáo theo Case Type trên Google Sheet vô dụng.
   * Để trống rồi suy sau là quay lại đúng chỗ đó.
   *
   * CHỈ LO "CỘT VẮNG MẶT". Giá trị điền SAI (vd `Regression`) đã do `validate.js` — bộ đọc dùng chung —
   * bắt ở design gate ngay phía trên; một luật một chỗ, đừng chép sang đây thành hai nguồn.
   */
  {
    const LENIENT = args.includes("--lenient") || process.env.QA_STRICT === "0";
    const QA_APPROVED = args.includes("--qa-approved");
    const doc = canonical.parseMarkdown(fs.readFileSync(inputPath, "utf8"));
    const missing = (doc.tests || []).filter((t) => !String(t.caseType || "").trim()).map((t) => t.tcId || "(no-id)");
    if (missing.length) {
      const head = `${missing.length} case CHƯA điền cột \`Loại case\`: ${missing.slice(0, 12).join(", ")}${missing.length > 12 ? ` … +${missing.length - 12}` : ""}`;
      const msg = `[gate loại-case] ✗ ${head}\n→ Điền cột \`Loại case\` cho từng case (bảng 9 loại ở prompt 02 §Loại case) rồi convert lại.`;
      if (!LENIENT && !QA_APPROVED) { console.error(msg); process.exit(1); }
      console.warn(`${msg}\n  [${LENIENT ? "--lenient/QA_STRICT=0" : "--qa-approved"}] bỏ qua gate — vẫn convert.`);
    }
  }

  /*
   * GATE `Tag`: case SINH MỚI phải khai khối `[<Loại>][<Chiều>][<Oracle-ref>]` ở cột `Tag`.
   *
   * VÌ SAO CẦN GATE RIÊNG (đo 21/08/2026): bỏ hẳn cột `Tag` thì `md_to_xlsx` và `output_gate` đều cho
   * qua exit 0. Chốt duy nhất còn lại là `dim:coverage --enforce` — nó CÓ chặn (exit 2) nhưng chỉ được
   * gọi theo prompt, KHÔNG có trong CI. Tức bộ không tag chỉ bị bắt nếu agent chịu chạy đúng bước.
   * Tệ hơn: không tag thì gate chiều rơi về chế độ GỢI Ý và tự từ chối chặn ⇒ mất luôn cả hai luật
   * (phủ chiều VÀ oracle) một cách im lặng. Chặn ở đây cho xác định.
   *
   * Cùng lý lẽ với gate `Loại case` ngay trên: chặn ở BIÊN SINH CASE, không ở `validate()` dùng chung —
   * bộ TC cũ (9 cột, không convert lại) vì thế không bị đỏ oan.
   *
   * CHỈ lo "thiếu tag". Tag ghi hai chỗ / tiền tố hằng số đã do `validate.js` bắt ở design gate.
   */
  {
    const LENIENT = args.includes("--lenient") || process.env.QA_STRICT === "0";
    const QA_APPROVED = args.includes("--qa-approved");
    const doc = canonical.parseMarkdown(fs.readFileSync(inputPath, "utf8"));
    const noTag = (doc.tests || []).filter((t) => !canonical.tagNamesOf(t.tags, t.title).length).map((t) => t.tcId || "(no-id)");
    if (noTag.length) {
      const head = `${noTag.length}/${(doc.tests || []).length} case KHÔNG có tag chiều: ${noTag.slice(0, 12).join(", ")}${noTag.length > 12 ? ` … +${noTag.length - 12}` : ""}`;
      const msg = `[gate tag] ✗ ${head}
→ Thêm cột \`Tag\` với khối \`[<Loại>][<Chiều>][<Oracle-ref>]\` cho từng case (prompt 02 §0b) rồi convert lại.
  Không có tag thì \`dim:coverage --enforce\` tự từ chối chặn ⇒ mất cả luật phủ chiều lẫn luật oracle.`;
      if (!LENIENT && !QA_APPROVED) { console.error(msg); process.exit(1); }
      console.warn(`${msg}
  [${LENIENT ? "--lenient/QA_STRICT=0" : "--qa-approved"}] bỏ qua gate — vẫn convert.`);
    }
  }

  // GATE gen-testcase: CHẶN convert nếu "Kết quả mong đợi" không khớp số bước / gộp range / chung chung.
  // `;`-packing chỉ cảnh báo (không chặn). Bỏ qua: --lenient / QA_STRICT=0 / --qa-approved.
  {
    const LENIENT = args.includes("--lenient") || process.env.QA_STRICT === "0";
    const QA_APPROVED = args.includes("--qa-approved");
    const parsed = outputGate.parseTestcaseTable(fs.readFileSync(inputPath, "utf8"));
    const problems = []; const warnings = [];
    for (const r of parsed.rows) { const g = outputGate.gateTestcaseRow(r); problems.push(...g.problems); warnings.push(...g.warnings); }
    if (warnings.length) console.warn(`[gate gen-testcase] ⚠ ${warnings.length} cảnh báo (nên tách ý ";" thành dòng "- "):\n  ~ ${warnings.slice(0, 15).join("\n  ~ ")}${warnings.length > 15 ? `\n  … +${warnings.length - 15} nữa` : ""}`);
    if (problems.length) {
      const msg = `[gate gen-testcase] ✗ ${problems.length} vi phạm CHẶN (RULE_GLOBAL + prompt 02 §6):\n  - ${problems.join("\n  - ")}\n→ Sửa "Kết quả mong đợi" cho khớp từng bước (mỗi bước 1 số) rồi convert lại.`;
      if (!LENIENT && !QA_APPROVED) { console.error(msg); process.exit(1); }
      console.warn(`${msg}\n  [${LENIENT ? "--lenient/QA_STRICT=0" : "--qa-approved"}] bỏ qua gate — vẫn convert.`);
    }
  }

  const contractTables = parseSetupContractTables(inputPath);
  const count = await buildXlsx(tables, contractTables, outputPath);
  console.log(`Exported ${count} test cases to ${outputPath}`);
}

/*
 * Chỉ chạy khi được gọi THẲNG từ dòng lệnh. Không có chốt này thì mọi `require()` file này đều kéo theo
 * `main()` — và `main()` đọc `process.argv`, nên script đi mượn `normalizeXlsxForExcel` sẽ bị thoát với
 * "Usage: …" thay vì chạy việc của nó.
 */
if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

/* Mở cho script khác dùng lại: bất cứ chỗ nào ghi .xlsx bằng ExcelJS đều dính lỗi gom vùng
 * dataValidation, nên phải chuẩn hoá lại sau khi ghi — không riêng luồng sinh testcase. */
module.exports = { normalizeXlsxForExcel };
