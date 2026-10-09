#!/usr/bin/env node
'use strict';

/*
 * merge_execution_status.js — ghi kết quả execute (testcase-status.json) NGƯỢC vào cột `Result` của file
 * Excel/Sheet canonical.
 *
 * Thay cho `scripts/integrations/aio/push_execution_aio.js` (Google Sheet ngưng dùng 22/09/2026, thay bằng
 * Google Sheet) — không còn Cycle/Run/step-evidence, chỉ còn 1 cột `Result` trên đúng file testcase đang
 * publish lên Sheet. Evidence (ảnh/video) VẪN ở local `test-results/artifacts/` như trước, không đẩy đi đâu.
 *
 * LUỒNG THẬT (agent thực hiện, script này chỉ lo bước giữa):
 *   1. Agent tải file Sheet mới nhất về local `.xlsx` qua Google Drive MCP (`download_file_content`).
 *   2. Chạy script này để merge `testcase-status.json` vào cột Result của file vừa tải.
 *   3. Agent `update_file` qua MCP để đẩy bản đã merge đè lên Drive.
 * Script KHÔNG tự upload — MCP là kênh riêng của agent/phiên chat, không phải library `node` gọi được.
 *
 * CHỈ ghi cột `Result` — không đụng Test Type/Priority/Note hay bất kỳ ô nào khác (QA có thể đã sửa tay
 * trực tiếp trên Sheets sau khi Phase 1 xuất).
 *
 * Input status.json — GIỮ NGUYÊN hợp đồng cũ của push_execution_aio.js (agent không phải đổi cách ghi):
 *   <TASK_OUTPUT_DIR>/test-results/testcase-status.json
 *   { taskKey, generatedAt, attestation, tests: [ { tcId, status, comment, failedStep?, evidence?[], carriedOver? } ] }
 *
 * Dùng:
 *   node scripts/convert_excel/merge_execution_status.js <xlsx> <status.json>
 *     [--cap <MN|TH|THCS|THPT|GDTX>] [--only TC1,TC2] [--include-carried-over] [--force] [--qa-approved]
 *     [--task-output <dir>]
 *
 *   --cap BẮT BUỘC khi file có nhiều cột `Result <CẤP>` (bố cục 24 cột của bộ chuẩn); suy được từ
 *   thư mục `shard-<CẤP>` thì không cần khai.
 */

const fs = require('fs');
const path = require('path');
let ExcelJS;
try {
  ExcelJS = require('exceljs');
} catch {
  console.error('Missing dependency: exceljs. Run `npm install` at the repo root.');
  process.exit(1);
}

const rc = require(path.join(__dirname, '..', 'utils', 'runtime_config'));
const outputGate = require(path.join(__dirname, '..', 'qa', 'output_gate'));
const planGuard = require(path.join(__dirname, '..', 'lib', 'expansion', 'plan_guard'));
const m = require(path.join(__dirname, '..', 'lib', 'testcase', 'model'));
const taxonomy = require(path.join(__dirname, '..', '..', '.agent', 'config', 'verdict_taxonomy.json'));

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
function flag(name) { return process.argv.includes(`--${name}`); }

const QA_APPROVED = flag('qa-approved');

/** Năm nhãn cấp học của bộ chuẩn, đúng thứ tự cột `Result <CẤP>`. */
const CAP_LABELS = ['MN', 'TH', 'THCS', 'THPT', 'GDTX'];

/**
 * Suy cấp học từ đường dẫn file status — CHỈ khi khớp chính xác một nhãn.
 * Không đoán mò: "TH" là tiền tố của cả "THCS" và "THPT", đoán sai là ghi verdict sang cấp khác.
 */
function capFromPath(p) {
  const seg = String(p || '').split(/[\\/]/).filter(Boolean);
  const hit = new Set();
  for (const x of seg) {
    const mm = x.match(/^shard-(.+)$/i);
    if (mm && CAP_LABELS.includes(mm[1].toUpperCase())) hit.add(mm[1].toUpperCase());
  }
  return hit.size === 1 ? [...hit][0] : null;
}

/** Cột `Áp dụng cho cấp` có bao gồm cấp này không. "Tất cả" là có. */
function capApDung(oCap, cap) {
  const v = String(oCap == null ? '' : oCap).trim();
  if (!v) return true;                                   // ô trống: không chặn, để lượt merge không im lặng bỏ case
  if (/tất cả|tat ca/i.test(v)) return true;
  const toks = v.split(/[,·;/]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
  return toks.includes(cap.toUpperCase());
}
/** verdict kit → giá trị cột Result (Pass|Fail|Pending) theo `.agent/config/verdict_taxonomy.json` cột
 * `sheet`. `null` = KHÔNG phải verdict (EXPANSION_FINDING/OBSERVATION, loại khỏi merge). `''`/status lạ =
 * không đổi ô (coi như Un_test mặc định). */
function sheetValueOf(status) {
  const canon = outputGate.canonStatus(status);
  const entry = canon ? taxonomy.statuses[canon] : null;
  if (!entry) return undefined; // status không có trong taxonomy — không đổi ô, không loại khỏi count
  return entry.sheet;
}

async function main() {
  const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const [xlsxPath, statusPath] = positional;
  if (!xlsxPath || !statusPath) {
    console.log('Usage: node scripts/convert_excel/merge_execution_status.js <xlsx> <status.json> [--only TC1,TC2] [--include-carried-over] [--force] [--qa-approved] [--task-output <dir>]');
    process.exit(1);
  }
  if (!fs.existsSync(xlsxPath)) { console.error(`File not found: ${xlsxPath}`); process.exit(1); }
  if (!fs.existsSync(statusPath)) { console.error(`File not found: ${statusPath}`); process.exit(1); }

  const doc = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  const all = doc.tests || [];
  if (!all.length) { console.error(`ERROR: ${statusPath} không có case nào.`); process.exit(2); }

  const only = new Set(String(arg('only', '')).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
  let tests = only.size ? all.filter((t) => only.has(String(t.tcId || '').toUpperCase())) : all;
  if (only.size) {
    const got = new Set(tests.map((t) => String(t.tcId).toUpperCase()));
    const miss = [...only].filter((k) => !got.has(k));
    if (miss.length) { console.error(`ERROR: --only không thấy trong status: ${miss.join(', ')}`); process.exit(2); }
  }

  // Cùng luật cũ (`sheet: null` trong verdict_taxonomy): EXPANSION_FINDING/OBSERVATION không phải verdict
  // của case gốc — không ghi.
  const nonVerdict = tests.filter((t) => sheetValueOf(t.status) === null);
  if (nonVerdict.length) {
    tests = tests.filter((t) => sheetValueOf(t.status) !== null);
    console.log(`Loại ${nonVerdict.length} case status KHÔNG phải verdict (${[...new Set(nonVerdict.map((t) => t.status))].join(', ')}): ${nonVerdict.slice(0, 6).map((t) => t.tcId).join(', ')}${nonVerdict.length > 6 ? '…' : ''}`);
    console.log('  → không ghi vào Result. Chúng thuộc reports/expansion-findings.md.');
  }

  const carried = tests.filter((t) => t.carriedOver);
  if (carried.length && !flag('include-carried-over')) {
    tests = tests.filter((t) => !t.carriedOver);
    console.log(`⚠ LOẠI ${carried.length} case KẾ THỪA từ lượt chạy trước (cờ carriedOver) — chúng không phải kết quả hôm nay.`);
    console.log('  Cố ý muốn ghi: --include-carried-over.');
  }
  if (!tests.length) { console.error('ERROR: sau khi lọc không còn case nào để ghi.'); process.exit(2); }

  // Gate chất lượng — cùng gate từng chạy trước khi ghi kết quả; không phải đặc thù Google Sheet.
  const gate = outputGate.gateTestExecution({ ...doc, tests });
  if (gate.problems.length) {
    console.error(`GATE CHẤT LƯỢNG — ${gate.problems.length} vi phạm:\n  - ${gate.problems.join('\n  - ')}`);
    console.error(`→ Sửa ${statusPath}. Cố ý bỏ qua: --qa-approved.`);
    if (!QA_APPROVED) process.exit(1);
    console.error('  [--qa-approved] bỏ qua gate theo chủ ý QA.');
  } else {
    console.log('Gate chất lượng: OK');
  }

  try {
    const taskOut = arg('task-output') || rc.getTaskOutputDir();
    const pg = planGuard.checkPlan(taskOut, tests.map((t) => t.tcId));
    if (pg.warning) console.log(`⚠ ${pg.warning}`);
    if (pg.problem) {
      console.error(`GATE MỞ RỘNG — ${pg.problem}`);
      if (!QA_APPROVED) { console.error('  Cố ý bỏ qua: --qa-approved (được ghi lại).'); process.exit(1); }
      console.error('  [--qa-approved] bỏ qua theo chủ ý QA.');
    } else if (pg.high.length) {
      console.log(`Gate mở rộng: OK (${pg.high.length} case band high · đã có kế hoạch)`);
    }
  } catch (e) {
    console.log(`⚠ Không chạy được gate mở rộng (${e.message}) — bỏ qua, không chặn merge.`);
  }

  // Cùng guard "run conclusive" cũ: toàn Pending (chưa chạy thật) thì không đáng ghi đè Sheet.
  const conclusive = tests.filter((t) => /^(PASS|FAIL)/i.test(String(t.status || '').trim())).length;
  if (!conclusive && !flag('force')) {
    console.error(`CHẶN: 0/${tests.length} case có verdict PASS/FAIL (toàn Pending) → không ghi. Dùng --force nếu vẫn muốn.`);
    process.exit(1);
  }

  // ---- Merge vào workbook ----
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  const CAP = (() => {
    const i = process.argv.indexOf('--cap');
    const tu = i > 0 && process.argv[i + 1] ? String(process.argv[i + 1]).trim().toUpperCase() : null;
    if (tu) {
      if (!CAP_LABELS.includes(tu)) {
        console.error(`CHẶN: --cap "${tu}" không phải cấp học. Chọn một trong: ${CAP_LABELS.join(', ')}.`);
        process.exit(1);
      }
      return tu;
    }
    const suy = capFromPath(statusPath);
    if (suy) console.log(`[cap] suy từ đường dẫn status: ${suy} (khai --cap để ghi đè)`);
    return suy;
  })();
  const lechCap = [];
  const byTcId = new Map(tests.map((t) => [String(t.tcId || '').trim().toUpperCase(), t]));
  const notFound = new Set(byTcId.keys());
  let updated = 0;
  let sheetsScanned = 0;

  for (const ws of workbook.worksheets) {
    let headerRow = null;
    ws.eachRow((row, rn) => {
      if (headerRow) return;
      const cells = [];
      row.eachCell({ includeEmpty: true }, (c) => cells.push(String((c.value && c.value.result) || c.value || '').trim()));
      if (m.isTestCaseHeader(cells)) headerRow = { rn, headers: cells };
    });
    if (!headerRow) continue; // sheet "Theo dõi tiến độ" / "Hướng dẫn" / "Preconditions" không khớp — bỏ qua

    const tcIdCol = m.colIndex(headerRow.headers, m.COL.tcId);
    /*
     * Cột kết quả: bộ chuẩn 5 cấp có NĂM cột `Result <CẤP>`, bố cục cũ có đúng một cột `Result`.
     * Dò theo tiền tố thay vì so khớp tuyệt đối — so khớp tuyệt đối là lý do script này chết trên
     * mọi file 24 cột (xem reports/case-chua-co-ket-qua.md).
     */
    const resultCols = headerRow.headers
      .map((h, i) => ({ h: String(h).trim(), i }))
      .filter((x) => /^result\b/i.test(x.h));
    if (tcIdCol < 0 || !resultCols.length) continue;

    let resultCol;
    if (resultCols.length === 1 && resultCols[0].h.toLowerCase() === 'result') {
      resultCol = resultCols[0].i;
    } else {
      if (!CAP) {
        console.error(
          `CHẶN: sheet "${ws.name}" có ${resultCols.length} cột kết quả theo cấp (${resultCols.map((x) => x.h).join(', ')}) nhưng lượt merge không khai cấp nào. Thêm --cap <MN|TH|THCS|THPT|GDTX>, hoặc để file status trong thư mục shard-<CẤP>. Đoán hộ ở đây là ghi verdict sang cấp khác mà không ai biết.`,
        );
        process.exit(1);
      }
      const want = `result ${CAP}`.toLowerCase();
      const hit = resultCols.find((x) => x.h.toLowerCase() === want);
      if (!hit) {
        console.error(`CHẶN: không có cột "Result ${CAP}" trong sheet "${ws.name}". Có: ${resultCols.map((x) => x.h).join(', ')}.`);
        process.exit(1);
      }
      resultCol = hit.i;
    }
    // m.COL chưa có khoá cho cột này nên dò thẳng theo nhãn header.
    const capCol = headerRow.headers.findIndex((h) => /áp dụng cho cấp/i.test(String(h)));
    sheetsScanned += 1;

    ws.eachRow((row, rn) => {
      if (rn <= headerRow.rn) return;
      const tcIdRaw = row.getCell(tcIdCol + 1).value;
      const tcIdCell = String((tcIdRaw && tcIdRaw.result) || tcIdRaw || '').trim().toUpperCase();
      if (!tcIdCell || !byTcId.has(tcIdCell)) return;
      const t = byTcId.get(tcIdCell);
      const sheetVal = sheetValueOf(t.status);
      if (!sheetVal) return; // '' (TODO) hoặc status lạ (undefined) → không đổi ô
      /*
       * Verdict của shard cấp này KHÔNG được ghi vào case không áp dụng cho cấp đó. Lỗi thật đang
       * có: bản ghi của CSDL_HSTRUONG_TC_143 (case chỉ THCS) nằm trong shard-TH — ghi mù thì cột
       * `Result TH` mang verdict của một case vốn không chạy ở Tiểu học.
       */
      if (CAP && capCol >= 0) {
        const oCap = row.getCell(capCol + 1).value;
        if (!capApDung((oCap && oCap.result) || oCap, CAP)) {
          lechCap.push(`${tcIdCell} (Áp dụng cho cấp: ${String((oCap && oCap.result) || oCap || '—').trim()})`);
          notFound.delete(tcIdCell);
          return;
        }
      }
      row.getCell(resultCol + 1).value = sheetVal;
      updated += 1;
      notFound.delete(tcIdCell);
    });
  }

  if (!sheetsScanned) {
    console.error(`ERROR: không thấy sheet nào có header testcase (TC ID + Kết quả mong đợi) trong ${xlsxPath}.`);
    process.exit(1);
  }
  if (lechCap.length) {
    console.log(
      `⚠ BỎ QUA ${lechCap.length} case có verdict ở shard ${CAP} nhưng cột "Áp dụng cho cấp" KHÔNG gồm ${CAP} — verdict này đang ở shard sai, soi lại lượt chạy trước khi ghi: ${lechCap.slice(0, 8).join(' · ')}${lechCap.length > 8 ? ' …' : ''}`,
    );
  }
  if (notFound.size) {
    console.log(`⚠ ${notFound.size} TC ID trong status không thấy trong file Excel (không đổi Sheet): ${[...notFound].slice(0, 8).join(', ')}${notFound.size > 8 ? '…' : ''}`);
  }

  await workbook.xlsx.writeFile(xlsxPath);
  console.log(`Đã ghi ${updated}/${tests.length} kết quả vào cột Result của ${xlsxPath}.`);
  console.log('Kế tiếp: agent upload file này đè lên Google Drive (update_file) để đồng bộ Sheet.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
