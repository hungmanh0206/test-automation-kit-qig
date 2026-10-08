#!/usr/bin/env node
'use strict';

/*
 * result_ledger.js — Chống MẤT KẾT QUẢ ÂM THẦM trong Excel canonical.
 *
 * VÌ SAO CẦN. Ngày 08/10/2026, task CSDL-9001 mất **129 ô kết quả** trong `test-cases/*.xlsx`: cả cột
 * `Result THCS` của một cấp đã chạy đủ 184/184 tụt xuống còn 47 ô, cộng 4 ô đính chính và 1 ô của lượt
 * chạy sau. Dữ liệu gốc vẫn còn nguyên trong `testcase-status*.json`, nhưng **không máy nào biết Excel
 * đã lệch khỏi chúng**. Chuyện chỉ lộ ra vì chủ dự án tình cờ hỏi "test hết case chưa" — tức là nếu
 * không ai hỏi, mọi báo cáo độ phủ sau đó đều sai mà vẫn trông bình thường.
 *
 * Đó là một lỗ hổng tin cậy chứ không phải sự cố: Excel là NƠI TỔNG HỢP, còn sự thật nằm ở file status.
 * Hai thứ có thể phân kỳ bất cứ lúc nào (ghi đè, sinh lại từ .md, merge nhầm cột) và không có gì đối soát.
 *
 * GATE NÀY ĐỐI SOÁT HAI CHIỀU:
 *
 *   A. Excel HÔM NAY so với Excel LẦN CHỤP TRƯỚC (`result-ledger.json`).
 *      Bắt: ô từng có giá trị nay TRỐNG, và ô ĐỔI giá trị. Mất giá trị là lỗi nặng — không lượt chạy
 *      hợp lệ nào làm một case đang có verdict trở lại thành chưa chạy.
 *
 *   B. Excel so với MỌI `testcase-status*.json` tìm được dưới thư mục task (kể cả shard và archive).
 *      Bắt: case đã từng có verdict GHI ĐƯỢC mà trong Excel không còn ô `Result` nào có giá trị.
 *      Đây là chiều bắt được cả trường hợp ledger chưa từng chụp (vd mất trước lần chụp đầu tiên).
 *
 * KHÔNG kiểm chiều "Excel có mà status không có": người vẫn được quyền điền tay sau khi rà soát, và
 * `capnhat-excel.js` của CSDL-9001 là ví dụ hợp lệ. Chặn chiều đó sẽ biến gate thành kẻ cản đường.
 *
 * VÌ SAO ĐỐI SOÁT THEO tcId CHỨ KHÔNG THEO CẤP: file status KHÔNG ghi cấp học. Một bộ testcase có thể
 * có một cột `Result` hoặc nhiều cột `Result <X>` (CSDL-9001 có 5 cột theo cấp). Gate vì thế hỏi câu
 * trả lời được chắc chắn — "case này còn ô nào mang verdict không" — thay vì đoán ô nào thuộc lượt nào.
 * Chiều A bù lại phần đó: nó so TỪNG Ô, nên mất cả một cột vẫn lộ ra.
 *
 * Dùng:
 *   node scripts/qa/result_ledger.js --task <TASK_KEY>              # báo cáo, luôn exit 0
 *   node scripts/qa/result_ledger.js --task <TASK_KEY> --enforce    # exit 1 khi phát hiện mất
 *   node scripts/qa/result_ledger.js --task <TASK_KEY> --snapshot   # chụp lại ledger sau khi đã rà
 *   node scripts/qa/result_ledger.js --task <TASK_KEY> --json
 *
 * Exit: 0 = sạch (hoặc không --enforce) · 1 = phát hiện mất/lệch (chỉ khi --enforce) · 2 = không chạy được.
 *
 * ⚠️ Bản KHÔNG `--enforce` luôn exit 0 — theo đúng khuôn của kit, chỗ CHẶN phải khai tường minh.
 */

const fs = require('fs');
const path = require('path');

const rc = require('../utils/runtime_config');
const outputGate = require('./output_gate.js');

const REPO = path.resolve(__dirname, '..', '..');

const argv = process.argv.slice(2);
const flag = (ten) => argv.includes(`--${ten}`);
const val = (ten, md) => {
  const i = argv.indexOf(`--${ten}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : md;
};

const ENFORCE = flag('enforce');
const SNAPSHOT = flag('snapshot');
const JSON_OUT = flag('json');

/* Taxonomy là MỘT nguồn cho "verdict nào được ghi xuống sheet". Đọc từ config, không chép bảng vào đây:
 * chép là ngày taxonomy đổi thì gate nói sai mà không ai biết. */
let TAXONOMY;
try {
  TAXONOMY = require(path.join(REPO, '.agent/config/verdict_taxonomy.json'));
} catch (e) {
  console.error(`[ledger] INFRA: không đọc được verdict_taxonomy.json — ${e.message}`);
  process.exit(2);
}

/** Verdict của recorder → giá trị ghi xuống cột Result. `undefined` = không ghi (vd OBSERVATION). */
function giaTriSheet(status) {
  const canon = outputGate.canonStatus(status);
  const e = canon && TAXONOMY.statuses ? TAXONOMY.statuses[canon] : null;
  return e ? e.sheet : undefined;
}

const txt = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((x) => x.text).join('').trim();
    if (v.text !== undefined) return String(v.text).trim();
    if (v.result !== undefined) return String(v.result).trim();
    return '';
  }
  return String(v).trim();
};

const LA_TC = /^[A-Z0-9]+(?:_[A-Z0-9]+)*_TC_\d+[A-Z]?$/i;

/**
 * Tên cấp học đầy đủ (như recorder đóng dấu) → mã ngắn dùng trong tiêu đề cột `Result <mã>`.
 * Trả `null` khi không nhận ra — và `null` nghĩa là KHÔNG kết luận gì, không phải "không khớp".
 */
function maCap(tenDayDu) {
  const s = String(tenDayDu || '').normalize('NFC').toLowerCase();
  if (!s) return null;
  if (s.includes('mầm non')) return 'MN';
  if (s.includes('thường xuyên') || s.includes('gdtx')) return 'GDTX';
  if (s.includes('trung học phổ thông') || s.includes('thpt')) return 'THPT';
  if (s.includes('trung học cơ sở') || s.includes('thcs')) return 'THCS';
  if (s.includes('tiểu học')) return 'TH';
  return null;
}

/** Hậu tố cấp trong tiêu đề cột: "Result THCS" → "THCS". Cột "Result" trơn → null (bộ một cột). */
function capCuaCot(tieuDe) {
  const m = String(tieuDe || '').trim().match(/^result\s+(.+)$/i);
  return m ? m[1].trim().toUpperCase() : null;
}

/** Mọi file .xlsx trong các thư mục testcase của task. */
function timExcel(taskOutputDir) {
  const ra = [];
  for (const d of rc.getTestcaseDirs(taskOutputDir)) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (f.endsWith('.xlsx') && !f.startsWith('~$')) ra.push(path.join(d, f));
    }
  }
  return ra;
}

/** Mọi testcase-status*.json dưới thư mục task, kể cả shard và archive. */
function timStatus(goc) {
  const ra = [];
  const di = (d, sau) => {
    if (sau > 6) return;
    let ds;
    try { ds = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ds) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') di(p, sau + 1); continue; }
      if (/^testcase-status.*\.json$/i.test(e.name)) ra.push(p);
    }
  };
  di(goc, 0);
  return ra;
}

/**
 * Đọc một workbook thành bản đồ ô Result.
 * Trả về { cells: { "<sheet>|<tcId>|<tên cột>": "giá trị" }, cols: [...], tcIds: Set }.
 *
 * Tìm hàng tiêu đề bằng cách dò ô mang tên cột ID (ID_TC / TC ID / Mã TC) trong 12 hàng đầu — KHÔNG
 * gắn cứng "hàng 5": bộ testcase của các task có số hàng đầu đề khác nhau, gắn cứng là gate lặng lẽ
 * bỏ qua cả sheet rồi báo "sạch".
 */
async function docExcel(file) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);

  const cells = {};
  const cols = new Set();
  const tcIds = new Set();
  const sheetBoQua = [];

  for (const ws of wb.worksheets) {
    let hangTieuDe = 0; let cotId = 0; const cotResult = [];
    for (let r = 1; r <= Math.min(12, ws.rowCount); r += 1) {
      const row = ws.getRow(r);
      for (let c = 1; c <= Math.min(60, ws.columnCount || 60); c += 1) {
        const h = txt(row.getCell(c).value);
        if (/^(id[_ ]?tc|tc[_ ]?id|mã\s*tc)$/i.test(h)) { hangTieuDe = r; cotId = c; }
      }
      if (hangTieuDe === r) {
        for (let c = 1; c <= Math.min(60, ws.columnCount || 60); c += 1) {
          const h = txt(row.getCell(c).value);
          if (/^result\b/i.test(h) || /^kết quả (chạy|thực tế)$/i.test(h)) cotResult.push({ c, ten: h });
        }
        break;
      }
    }
    if (!cotId || !cotResult.length) { sheetBoQua.push(ws.name); continue; }

    for (const { ten } of cotResult) cols.add(ten);
    for (let r = hangTieuDe + 1; r <= ws.rowCount; r += 1) {
      const row = ws.getRow(r);
      const id = txt(row.getCell(cotId).value).toUpperCase();
      if (!LA_TC.test(id)) continue;
      tcIds.add(id);
      for (const { c, ten } of cotResult) {
        const v = txt(row.getCell(c).value);
        if (v) cells[`${ws.name}|${id}|${ten}`] = v;
      }
    }
  }
  return { cells, cols: [...cols], tcIds, sheetBoQua };
}

(async () => {
  let taskKey; let taskOutputDir;
  try {
    rc.loadEnvFiles();
    taskKey = val('task', process.env.TASK_KEY) || rc.getTaskKey();
    taskOutputDir = rc.getTaskOutputDir({ taskKey });
  } catch (e) {
    console.error(`[ledger] INFRA: ${e.message}`);
    process.exit(2);
  }

  const excels = timExcel(taskOutputDir);
  if (!excels.length) {
    console.log(`[ledger] BỎ QUA · task ${taskKey} không có workbook nào trong test-cases/`);
    process.exit(0);
  }

  // ----- đọc Excel hiện tại -----
  const hienTai = { cells: {}, cols: new Set(), tcIds: new Set(), sheetBoQua: [] };
  for (const f of excels) {
    let d;
    try { d = await docExcel(f); } catch (e) {
      console.error(`[ledger] INFRA: không đọc được ${path.relative(REPO, f)} — ${e.message}`);
      process.exit(2);
    }
    const nhan = path.basename(f);
    for (const [k, v] of Object.entries(d.cells)) hienTai.cells[`${nhan}|${k}`] = v;
    d.cols.forEach((c) => hienTai.cols.add(c));
    d.tcIds.forEach((t) => hienTai.tcIds.add(t));
    d.sheetBoQua.forEach((s) => hienTai.sheetBoQua.push(`${nhan}:${s}`));
  }

  // ----- A. so với lần chụp trước -----
  const LEDGER = path.join(taskOutputDir, 'test-results', 'result-ledger.json');
  let cu = null;
  if (fs.existsSync(LEDGER)) {
    try { cu = JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch (e) { cu = null; }
  }
  const mat = []; const doi = [];
  if (cu && cu.cells) {
    for (const [k, v] of Object.entries(cu.cells)) {
      const moi = hienTai.cells[k];
      if (moi === undefined) mat.push(`${k} — mất giá trị "${v}"`);
      else if (moi !== v) doi.push(`${k} — "${v}" → "${moi}"`);
    }
  }

  // ----- B. so với mọi file status -----
  const files = timStatus(taskOutputDir);
  const coVerdict = new Map(); // tcId → [{ sheet, file, cap }]
  for (const f of files) {
    let j;
    try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
    const arr = Array.isArray(j) ? j : (j.tests || j.cases || j.testcases
      || Object.values(j).find(Array.isArray) || []);
    const capFile = (j && j.scope && j.scope.capHoc) || '';
    for (const t of arr) {
      const id = String(t && (t.tcId || t.id) || '').trim().toUpperCase();
      if (!LA_TC.test(id)) continue;
      const gt = giaTriSheet(t.status || t.verdict);
      if (!gt) continue; // OBSERVATION và bạn bè: không ghi sheet thì không đòi sheet
      if (!coVerdict.has(id)) coVerdict.set(id, []);
      coVerdict.get(id).push({
        sheet: gt,
        file: path.relative(REPO, f),
        cap: maCap((t.scope && t.scope.capHoc) || capFile),
      });
    }
  }
  /*
   * MIỄN TRỪ CÓ LÝ DO. Không phải mọi verdict trong file status đều ĐÁNG nằm trong Excel: lượt chạy một
   * cấp vẫn vô tình chạy case của cấp khác, và kết quả đó là đo NHẦM CẤP — ô Excel để trống mới đúng.
   * Không có chỗ khai điều này thì gate kêu sói mãi, và gate kêu sói là gate bị tắt.
   *
   * File khai nằm TRONG thư mục task, KHÔNG dùng sổ chung giữa các task: lý do "nhầm cấp" của task này
   * không có nghĩa gì ở task khác, và sổ chung đã bị chủ dự án bác đúng vì lẽ đó.
   * Mỗi mục BẮT BUỘC có `lyDo` và `ngay` — khai trống thì coi như không khai, gate vẫn báo.
   */
  const FILE_MIEN = path.join(taskOutputDir, 'test-results', 'result-ledger-mien.json');
  let mien = {};
  if (fs.existsSync(FILE_MIEN)) {
    try {
      const j = JSON.parse(fs.readFileSync(FILE_MIEN, 'utf8'));
      mien = j && typeof j === 'object' ? (j.mienTru || j) : {};
    } catch (e) {
      console.error(`[ledger] INFRA: ${path.relative(REPO, FILE_MIEN)} không phải JSON hợp lệ — ${e.message}`);
      process.exit(2);
    }
  }
  const hopLe = (m) => m && typeof m === 'object' && String(m.lyDo || '').trim() && String(m.ngay || '').trim();

  const coOTrongExcel = new Set(
    Object.keys(hienTai.cells).map((k) => k.split('|')[2]),
  );
  const thieu = []; const daMien = [];
  for (const [id, ds] of coVerdict) {
    if (!hienTai.tcIds.has(id)) continue;  // case không có trong bộ hiện tại — việc khác, không phải mất
    if (coOTrongExcel.has(id)) continue;
    const m = mien[id];
    if (hopLe(m)) { daMien.push(`${id} — ${m.lyDo} (khai ${m.ngay})`); continue; }
    thieu.push(`${id} — status có "${[...new Set(ds.map((x) => x.sheet))].join('/')}" (${ds[0].file}) nhưng Excel không ô Result nào có giá trị`
      + `${m ? ' · CÓ khai miễn trừ nhưng thiếu lyDo/ngay ⇒ không tính' : ''}`);
  }

  /*
   * ----- C. NHIỄM CHÉO CẤP: ô nằm ở cột `Result <X>` nhưng case chỉ có verdict mang dấu cấp KHÁC X.
   *
   * Chiều A và B chỉ thấy ô MẤT. Cái đã xảy ra ở CSDL-9001 tệ hơn thế: cột `Result THCS` bị thay bằng
   * 45 verdict của lượt chạy GDTX — cột vừa thiếu vừa BẨN, và ô vẫn "có giá trị" nên A/B đều im.
   *
   * Chỉ kết luận khi case CÓ dấu cấp và KHÔNG dấu nào khớp cột. Case chưa có dấu (ghi trước
   * 08/10/2026) thì bỏ qua — thà im còn hơn báo sai hàng loạt trên dữ liệu lịch sử.
   */
  const nhiemCheo = [];
  for (const [k, v] of Object.entries(hienTai.cells)) {
    const [wb, , id, cot] = k.split('|');
    const capCot = capCuaCot(cot);
    if (!capCot) continue;                       // bộ một cột `Result` — không có gì để đối chiếu
    const ds = (coVerdict.get(id) || []).filter((x) => x.cap);
    if (!ds.length) continue;                    // case chưa có dấu
    if (ds.some((x) => x.cap === capCot)) continue;
    const m = mien[`${id}@${cot}`];
    if (hopLe(m)) { daMien.push(`${id} @ ${cot} — ${m.lyDo} (khai ${m.ngay})`); continue; }
    nhiemCheo.push(`${wb}|${id}|${cot} = "${v}" — mọi verdict của case này mang dấu cấp `
      + `${[...new Set(ds.map((x) => x.cap))].join('/')}, không có ${capCot}`);
  }

  // ----- báo cáo -----
  const soO = Object.keys(hienTai.cells).length;
  const bao = {
    gate: 'result_ledger',
    task: taskKey,
    workbook: excels.map((f) => path.relative(REPO, f)),
    cotResult: [...hienTai.cols],
    oCoGiaTri: soO,
    fileStatus: files.length,
    caseCoVerdict: coVerdict.size,
    matSoVoiLedger: mat,
    doiSoVoiLedger: doi,
    thieuSoVoiStatus: thieu,
    nhiemCheoCap: nhiemCheo,
    daMienTru: daMien,
    ledger: fs.existsSync(LEDGER) ? path.relative(REPO, LEDGER) : null,
  };

  if (JSON_OUT) console.log(JSON.stringify(bao, null, 2));
  else {
    console.log(`[ledger] task ${taskKey} · ${excels.length} workbook · cột Result: ${[...hienTai.cols].join(', ') || '(không thấy)'}`);
    console.log(`[ledger] ô Result có giá trị: ${soO} · file status đọc được: ${files.length} · case từng có verdict ghi được: ${coVerdict.size}`);
    if (hienTai.sheetBoQua.length) {
      console.log(`[ledger] sheet bỏ qua (không thấy cột ID hoặc cột Result): ${hienTai.sheetBoQua.join(', ')}`);
    }
    if (!cu) console.log('[ledger] CHƯA CÓ ledger — lần đầu chạy. Chỉ đối soát được với file status. Chạy --snapshot để chụp mốc.');
    if (mat.length) { console.log(`\n[ledger] ❌ MẤT ${mat.length} ô so với lần chụp trước:`); mat.slice(0, 40).forEach((x) => console.log(`   · ${x}`)); if (mat.length > 40) console.log(`   … +${mat.length - 40} nữa`); }
    if (doi.length) { console.log(`\n[ledger] ⚠️ ĐỔI giá trị ${doi.length} ô so với lần chụp trước:`); doi.slice(0, 20).forEach((x) => console.log(`   · ${x}`)); if (doi.length > 20) console.log(`   … +${doi.length - 20} nữa`); }
    if (thieu.length) { console.log(`\n[ledger] ❌ ${thieu.length} case có verdict trong file status nhưng Excel TRỐNG:`); thieu.slice(0, 40).forEach((x) => console.log(`   · ${x}`)); if (thieu.length > 40) console.log(`   … +${thieu.length - 40} nữa`); }
    /* In miễn trừ RA MÀN HÌNH chứ không nuốt: khai miễn trừ là một quyết định, và quyết định phải
     * nhìn thấy được ở mỗi lượt chạy thì mới có cơ hội bị phản bác khi nó hết đúng. */
    if (daMien.length) { console.log(`\n[ledger] ○ ${daMien.length} case miễn trừ có lý do:`); daMien.forEach((x) => console.log(`   · ${x}`)); }
    if (nhiemCheo.length) {
      console.log(`\n[ledger] ⚠️ ${nhiemCheo.length} ô CẦN NGƯỜI XÁC NHẬN — không verdict nào của case mang dấu cấp của cột`
        + '\n           (hoặc là verdict cấp khác merge nhầm cột, hoặc là ô điền tay từ phép đo không sinh file status):');
      nhiemCheo.slice(0, 40).forEach((x) => console.log(`   · ${x}`));
      if (nhiemCheo.length > 40) console.log(`   … +${nhiemCheo.length - 40} nữa`);
    }
    if (!mat.length && !doi.length && !thieu.length && !nhiemCheo.length) console.log('\n[ledger] ✅ Excel khớp cả ledger lẫn file status.');
  }

  if (SNAPSHOT) {
    fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
    fs.writeFileSync(LEDGER, `${JSON.stringify({
      gate: 'result_ledger',
      task: taskKey,
      chupLuc: new Date().toISOString(),
      workbook: bao.workbook,
      soO,
      cells: hienTai.cells,
    }, null, 2)}\n`);
    console.log(`\n[ledger] đã chụp mốc ${soO} ô → ${path.relative(REPO, LEDGER)}`);
  }

  /* `doi` (đổi giá trị) KHÔNG chặn: một lượt rerun đổi Fail→Pass là chuyện bình thường và đúng.
   * Chỉ `mat` và `thieu` mới là mất dữ liệu. */
  /* `nhiemCheo` KHÔNG chặn, dù nó là dấu hiệu của đúng sự cố đã xảy ra.
   *
   * Lý do: gate không phân biệt được hai thứ trông giống hệt nhau — (a) verdict của cấp khác bị merge
   * nhầm cột, và (b) ô do người điền tay từ một phép đo không sinh file status (vd lượt rà soát field
   * coverage 05/10/2026 của CSDL-9001, hoặc một verdict được xét lại theo oracle mới). Cả hai đều cho
   * "không verdict nào mang dấu cấp này". Chặn thì (b) bị oan và gate sẽ bị tắt — mà gate bị tắt thì
   * (a) cũng hết người gác.
   *
   * Phần CHẶN nằm ở đầu nguồn: `merge-theo-cap.js` nay từ chối merge khi dấu cấp không khớp cột, nên
   * (a) không phát sinh thêm được nữa. Chiều này là máy DÒ cho những ô đã nhiễm từ trước — việc của nó
   * là đưa ra để người xác nhận, rồi khai vào `result-ledger-mien.json` theo khoá `<TC_ID>@<tên cột>`. */
  const hong = mat.length + thieu.length;
  if (hong && ENFORCE) {
    console.error(`\n[ledger] CHẶN — ${hong} dấu hiệu mất kết quả. Khôi phục từ file status rồi chạy lại, hoặc --snapshot nếu đã xác nhận là đúng.`);
    process.exit(1);
  }
  if (hong) console.log(`\n[ledger] (không --enforce nên exit 0 dù có ${hong} dấu hiệu mất kết quả)`);
  process.exit(0);
})().catch((e) => { console.error(`[ledger] INFRA: ${e.message}`); process.exit(2); });
