'use strict';

/*
 * parseXlsx — adapter đọc .xlsx testcase → canonical TestCaseDoc (dùng cho consumer đọc xlsx:
 * publish/pull công cụ cũ). Tái dùng model.buildTestCase/buildSetup (cùng schema với parseMarkdown).
 * Cần ExcelJS (đã là dep). Bất đồng bộ (đọc file).
 */

const ExcelJS = require('exceljs');
const m = require('./model');

/** Trích text từ 1 cell ExcelJS (richText/hyperlink/formula/number/null). */
function cellText(cell) {
  const v = cell && cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
    if (v.text != null) return String(v.text);
    if (v.result != null) return String(v.result);
    return '';
  }
  return String(v);
}

/** Trong 1 worksheet, tìm dòng header (chứa cell 'TC ID') → { headerRow, headers[] }. */
function findHeader(ws, predicate) {
  let found = null;
  ws.eachRow((row, rn) => {
    if (found) return;
    const cells = [];
    row.eachCell({ includeEmpty: true }, (c) => cells.push(cellText(c).trim()));
    if (predicate(cells)) found = { headerRow: rn, headers: cells };
  });
  return found;
}

/**
 * Đọc .xlsx → TestCaseDoc. GỘP mọi sheet có header khớp testcase (không chỉ sheet 'Test Cases'/sheet đầu):
 * từ khi export chuyển sang layout dashboard + 1 sheet/nhóm chức năng (không còn sheet phẳng "Test Cases"
 * duy nhất), đọc 1 sheet là mất âm thầm mọi nhóm còn lại — xem `scripts/convert_excel/md_to_xlsx.js`.
 * @param {string} filePath
 * @returns {Promise<import('./model').TestCaseDoc>}
 */
async function parseXlsx(filePath, opts = {}) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const warnings = [];

  // 1) sheet testcase — mọi sheet mà header khớp isTestCaseHeader (sheet 'Theo dõi tiến độ'/'Hướng dẫn'/
  // 'Preconditions' tự bị loại vì header của chúng không khớp predicate).
  const sheets = wb.worksheets;
  const tests = [];
  const groups = new Set();
  let headers = [];
  let sheetNames = [];
  for (const ws of sheets) {
    const hdr = findHeader(ws, m.isTestCaseHeader);
    if (!hdr) continue;
    const hCells = hdr.headers.filter((_, i, a) => !(i === a.length - 1 && a[i] === '')); // bỏ đuôi rỗng
    if (!headers.length) headers = hCells; // mọi sheet nhóm cùng layout cột — dùng header sheet đầu tìm thấy
    sheetNames.push(ws.name);
    // Layout mới (md_to_xlsx.js): 1 sheet = 1 nhóm chức năng, KHÔNG có cột `Nhóm chức năng` trên từng dòng —
    // nhãn nhóm nằm ở banner ô C1 ("Tên màn hình/chức năng"). Dùng làm fallback khi buildTestCase không đọc
    // được `group` từ cột (bộ TC cũ có cột `Nhóm chức năng` per-row vẫn ưu tiên giá trị đó, không bị ghi đè).
    const sheetGroupLabel = cellText(ws.getCell('C1')).trim();
    ws.eachRow((row, rn) => {
      if (rn <= hdr.headerRow) return;
      const cells = hCells.map((_, i) => cellText(row.getCell(i + 1)));
      const tcId = (cells[m.colIndex(hCells, m.COL.tcId)] || '').trim();
      if (!tcId || ['tc id', 'id tc'].includes(m.normalizeHeader(tcId))) return;
      const tc = m.buildTestCase(hCells, cells, opts.story || '');
      if (!tc.group && sheetGroupLabel) tc.group = sheetGroupLabel;
      if (tc.group) groups.add(tc.group);
      tests.push(tc);
    });
  }
  if (!sheetNames.length) {
    warnings.push('Không thấy sheet/bảng testcase (header TC ID + Kết quả mong đợi) trong xlsx.');
  }

  // 2) setup contract (sheet 'Preconditions' nếu có)
  const setup = [];
  for (const ws of sheets) {
    const sh = findHeader(ws, m.isSetupContractHeader);
    if (!sh) continue;
    ws.eachRow((row, rn) => {
      if (rn <= sh.headerRow) return;
      const cells = sh.headers.map((_, i) => cellText(row.getCell(i + 1)));
      const s = m.buildSetup(sh.headers, cells);
      if (s.preId && !m.normalizeHeader(s.preId).includes('precondition id')) setup.push(s);
    });
    break;
  }

  return { source: 'xlsx', tests, setup, headers, groups: [...groups], warnings, sheetName: sheetNames[0] || '', sheetNames };
}

module.exports = { parseXlsx, cellText };
