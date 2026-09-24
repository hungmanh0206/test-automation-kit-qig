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

function stripEmoji(text) {
  return String(text || "").replace(/[\u{1F300}-\u{1FAFF}\u2700-\u27BF]/gu, "").trim();
}

function cleanCell(text) {
  return stripEmoji(String(text || "").replace(/<br\s*\/?>/gi, "\n").replace(/`([^`]*)`/g, "$1"));
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
const FUNC_DATA_START_ROW = 7;
const FUNC_DATA_END_ROW = 500; // khớp "Hướng dẫn": mỗi sheet tính từ dòng 7 đến dòng 500
const DASH_DATA_START_ROW = 7;
const DASH_DATA_END_ROW = 80; // khớp file mẫu: dashboard cấp sẵn 74 dòng chức năng

const DROPDOWN = {
  testType: "UI,Positive,Negative,Boundary,Validation,Business Rule,Permission,Security,Performance,Compatibility,Accessibility,API,Database,Integration,Regression,E2E,Error Handling,Logging - Audit",
  priority: "Critical,High,Medium,Low",
  testLevel: "Unit,Integration,System,UAT",
  result: "Pass,Fail,Pending,Un_test",
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
const DIMENSION_TO_TEST_TYPE = {
  positive: "Positive", negative: "Negative", boundary: "Boundary", validation: "Validation",
  security: "Security", perf: "Performance", api: "API", dbpersist: "Database",
  regression: "Regression", e2e: "E2E", a11y: "Accessibility", ui: "UI", display: "UI",
};
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
  return Math.min(150, Math.max(24, maxLines * 15));
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
  cell.alignment = { vertical: opts.valign || "middle", horizontal: opts.align || "left", wrapText: true };
  return cell;
}

/**
 * 1 sheet / nhóm chức năng — nhân bản layout `TC_TEMPLATE 1` của file mẫu: banner (Tên màn hình/Mã chức
 * năng/Ngày tạo) + mini-dashboard (Lần 1 nhập tay, Mới nhất tự tính) + header 16 cột (dòng 5) + data từ
 * dòng 7 + dropdown/conditional-formatting đúng danh sách đo được từ file mẫu.
 */
function addFunctionSheet(workbook, sheetName, groupLabel, rows, createdDate) {
  const worksheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 6 }] });
  worksheet.columns = FUNC_COL_WIDTHS.map((width) => ({ width }));

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

  FUNC_HEADERS.forEach((h, i) => setStyledCell(worksheet, `${columnIndexToName(i)}5`, h, { fill: COLOR.header, white: true }));

  rows.forEach((row, i) => {
    const r = FUNC_DATA_START_ROW + i;
    row.forEach((value, colIdx) => {
      const cell = worksheet.getCell(`${columnIndexToName(colIdx)}${r}`);
      cell.value = value;
      cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    });
    worksheet.getRow(r).height = estimateRowHeight(row, FUNC_COL_WIDTHS);
  });

  // Dropdown + conditional formatting trên TOÀN phạm vi dòng 7-500 (khớp file mẫu) — kể cả dòng chưa có
  // data, để QA thêm case tay về sau vẫn có sẵn dropdown, không cần copy-format lại.
  const applyListValidation = (colLetter, csvList) => {
    for (let r = FUNC_DATA_START_ROW; r <= FUNC_DATA_END_ROW; r++) {
      worksheet.getCell(`${colLetter}${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [`"${csvList}"`] };
    }
  };
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

  worksheet.getRow(1).height = 20;
  worksheet.getRow(3).height = 20;
  worksheet.getRow(5).height = 24;
  return worksheet;
}

/**
 * Sheet `Theo dõi tiến độ` — dashboard tự tính, 1 dòng/nhóm chức năng, kéo số liệu từ sheet chức năng
 * tương ứng qua `INDIRECT`. Layout/formula nhân bản chính xác file mẫu (đo bằng exceljs).
 */
function addDashboardWorksheet(workbook, groupEntries) {
  const worksheet = workbook.addWorksheet("Theo dõi tiến độ", { views: [{ state: "frozen", ySplit: 6 }] });
  const widths = [7.57, 24, 40, 20.57, 12.71, 13, 13, 12.14, 12.14, 12.14, 12.14, 12.14, 12.14, 15, 26];
  worksheet.columns = widths.map((width) => ({ width }));

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
    worksheet.getCell(`H${r}`).value = { formula: `IF($D${r}="","",IFERROR(COUNTA(INDIRECT("'"&$D${r}&"'!$A$${FUNC_DATA_START_ROW}:$A$${FUNC_DATA_END_ROW})),0))` };
    worksheet.getCell(`I${r}`).value = { formula: `IF($D${r}="","",IFERROR(COUNTIF(INDIRECT("'"&$D${r}&"'!$L$${FUNC_DATA_START_ROW}:$L$${FUNC_DATA_END_ROW}),"Pass"),0))` };
    worksheet.getCell(`J${r}`).value = { formula: `IF($D${r}="","",IFERROR(COUNTIF(INDIRECT("'"&$D${r}&"'!$L$${FUNC_DATA_START_ROW}:$L$${FUNC_DATA_END_ROW}),"Fail"),0))` };
    worksheet.getCell(`K${r}`).value = { formula: `IF($D${r}="","",IFERROR(COUNTIF(INDIRECT("'"&$D${r}&"'!$L$${FUNC_DATA_START_ROW}:$L$${FUNC_DATA_END_ROW}),"Pending"),0))` };
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
  worksheet.columns = [{ width: 4 }, { width: 30 }, { width: 95 }];

  setStyledCell(worksheet, "B1", "HƯỚNG DẪN SỬ DỤNG FILE", { fill: COLOR.banner, white: true });
  worksheet.mergeCells("B1:C1");

  const rows = [
    ["Quy ước màu", "Ô nền vàng, chữ xanh = nhập tay. Ô nền trắng = công thức tự tính, đừng gõ đè lên."],
    ["Thêm 1 chức năng mới",
      "Sheet theo chức năng do kit TỰ SINH từ Markdown testcase (mỗi 'Nhóm chức năng' → 1 sheet, tên sheet " +
      "= Mã CN). Thêm case cho chức năng mới: thêm vào bảng Markdown nguồn rồi chạy lại\n" +
      "`node scripts/convert_excel/md_to_xlsx.js <input.md> <output.xlsx>` — sheet mới và dòng dashboard " +
      "tương ứng tự xuất hiện, không cần copy tay. Nếu thêm case TAY ngoài quy trình: đặt tên sheet đúng " +
      "bằng giá trị cột 'Mã CN' trên dashboard — sai một ký tự là số liệu về 0."],
    ["Số liệu tự tính",
      "Tổng TC = số dòng có ID_TC (cột A) trong sheet chức năng.\nPass / Fail / Pending = đếm cột Result " +
      "(cột L).\nUn_test = Tổng TC trừ đi Pass, Fail, Pending — tức là các dòng chưa chọn kết quả."],
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

  rows.forEach(([label, text], i) => {
    const r = i + 3;
    setStyledCell(worksheet, `B${r}`, label, { fill: COLOR.label, valign: "top" });
    setStyledCell(worksheet, `C${r}`, text, { bold: false, valign: "top" });
    const longestLine = Math.max(...text.split("\n").map((l) => l.length));
    worksheet.getRow(r).height = Math.min(220, Math.max(20, text.split("\n").length * 16 + Math.ceil(longestLine / 90) * 14));
  });

  return worksheet;
}

async function buildXlsx(tables, contractTables, outputPath) {
  // Gộp mọi bảng Markdown → TestCase canonical (`canonical.buildTestCase`, cùng logic parseMarkdown/
  // parseXlsx dùng — KHÔNG tự chế lại field). Nhóm suy từ cột `Nhóm chức năng` nếu có; bộ TC cũ chưa có
  // cột đó fallback `inferFunctionalGroup` (heuristic cũ, giữ nguyên để không đỏ oan bộ đang publish).
  const groupedRows = new Map();
  for (const table of tables) {
    const headers = table.headers.map(cleanCell);
    for (const row of table.rows) {
      const tc = canonical.buildTestCase(headers, row, "");
      const cleanedCells = headers.map((_, i) => cleanCell(row[i] || ""));
      const group = tc.group || inferFunctionalGroup(headers, cleanedCells) || "Khác";
      const testType = pickTestType(tc.dimensions, canonical.DIMENSION_TAGS);
      const outRow = [
        tc.tcId, tc.module, displayTitle(tc.title), tc.precondition, tc.data, tc.stepsRaw, tc.expectedRaw,
        testType, normalizePriority(tc.priority), "", "", "", "", "", "",
        tc.traceability.reqId || tc.traceability.story || "",
        tc.caseType || "", tc.tags || "",
      ];
      if (!groupedRows.has(group)) groupedRows.set(group, []);
      groupedRows.get(group).push(outRow);
    }
  }

  const usedNames = new Set(["Theo dõi tiến độ", "Hướng dẫn"]);
  const groupEntries = [...groupedRows.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "vi"))
    .map(([group, rows]) => ({ group, sheetName: sanitizeSheetName(group, usedNames), rows }));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "test-automation-kit";
  workbook.created = new Date();

  // Thứ tự add = thứ tự tab: dashboard + hướng dẫn đứng trước, khớp file mẫu.
  addDashboardWorksheet(workbook, groupEntries);
  addGuideWorksheet(workbook);

  const createdDate = new Date().toISOString().slice(0, 10);
  let total = 0;
  for (const { group, sheetName, rows } of groupEntries) {
    addFunctionSheet(workbook, sheetName, group, rows, createdDate);
    total += rows.length;
  }

  addContractWorksheet(workbook, contractTables);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
  return total;
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

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
