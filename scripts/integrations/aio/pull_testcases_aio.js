#!/usr/bin/env node
'use strict';

/*
 * pull_testcases_aio.js — kéo testcase TỪ AIO Tests về Excel canonical local.
 * Phục vụ `TESTCASE_SOURCE=aio`: kéo case trên AIO về Excel canonical local để Phase 2 execute từ file.
 *
 * VÌ SAO CẦN: Phase 2 execute mặc định KHÔNG đọc Excel người viết, mà đọc bản kéo về từ test-management
 * tool (nơi testcase đã qua review/sửa). Thiếu bản này thì đặt `TEST_MANAGEMENT_TOOL=aio` xong Phase 2
 * mới là nguồn thật của Phase 2.
 *
 * Ghi ra THƯ MỤC RIÊNG `test-cases/from-aio/` — KHÔNG đụng Excel người viết ở `test-cases/`, giống
 * Cột + tên sheet + định dạng "1. … 2. …" giữ NGUYÊN để parser canonical đọc được.
 * đọc được mà không cần biết nguồn nào.
 *
 * TÌM CASE (theo thứ tự ưu tiên):
 *   --story <JIRA-KEY>  → lọc theo `jiraRequirementIDs` (AIO lưu ID SỐ của issue, không lưu key ⇒ script
 *                         tự hỏi Jira để đổi key → id; đây là chỗ dễ hụt nếu so key với id).
 *   --folder-root <tên> → lọc theo nhánh gốc của cây folder (cách publish đang đặt: gốc = story key).
 *   --only TC_1,TC_2    → lọc thẳng theo automationKey.
 *
 * Dùng:
 *   node scripts/integrations/aio/pull_testcases_aio.js --story <JIRA-KEY>            # xem trước
 *   node scripts/integrations/aio/pull_testcases_aio.js --story <JIRA-KEY> --write
 */

const fs = require('fs');
const path = require('path');
const { AioClient } = require('./aio_client');
const rc = require(path.resolve(__dirname, '..', '..', 'utils', 'runtime_config'));

let ExcelJS;
try { ExcelJS = require('exceljs'); } catch { console.error('Thiếu exceljs — chạy `npm install` ở gốc repo.'); process.exit(1); }

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);

// Giữ ĐÚNG bộ cột/độ rộng của Excel canonical — lệch một cột là parseXlsx đọc sai field mà không báo lỗi.
const HEADERS = ['TC ID', 'Nhóm chức năng', 'Module', 'Trường hợp kiểm thử', 'Tiền điều kiện', 'Dữ liệu test', 'Các bước thực hiện', 'Kết quả mong đợi', 'Ưu tiên', 'Mức độ rủi ro'];
const COL_WIDTHS = [16, 22, 22, 50, 42, 40, 60, 60, 12, 14];
const PRIORITY_NAME = { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low', 5: 'Lowest' };
const numbered = (arr) => arr.map((s, i) => `${i + 1}. ${String(s || '').trim()}`).join('\n');

/** Đổi Jira issue KEY → id số. AIO lưu id, nên so key với `jiraRequirementIDs` sẽ luôn ra 0 case. */
async function jiraIssueId(key) {
  const base = (process.env.JIRA_BASE_URL || process.env.JIRA_URL || '').replace(/\/$/, '');
  const auth = 'Basic ' + Buffer.from(`${process.env.JIRA_EMAIL || process.env.JIRA_USER_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
  const r = await fetch(`${base}/rest/api/3/issue/${key}?fields=summary`, { headers: { Authorization: auth, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Jira trả ${r.status} khi đọc ${key} — kiểm JIRA_BASE_URL/creds.`);
  return String((await r.json()).id);
}

/*
 * SETUP CONTRACT KHÔNG NẰM TRÊN AIO. Case trên AIO có field `precondition` (text: mã [PRE-NN] + mô tả),
 * nhưng "dựng bằng cách nào" (Setup Strategy · Source · Verification · Cleanup) chỉ có trong Excel canonical
 * do Phase 1 sinh. Đo 20/08/2026: Excel gốc 26 dòng contract — bản kéo từ AIO 0 dòng. Nguồn execute MẶC ĐỊNH
 * là bản kéo về, nên Phase 2 mất phần "dựng thế nào" mà KHÔNG gate nào kêu.
 *
 * Nên pull COPY NGUYÊN sheet đó sang: giữ header GỐC, không tự đặt tên cột — `SETUP_COL` khớp theo tên
 * ("setup strategy", "verification"…), tự nghĩ header khác thì parser ra dòng nhưng field rỗng: có sheet mà
 * vô dụng, còn tệ hơn không có vì trông như đã đủ.
 */
async function copySetupContract(wb, taskOutDir) {
  const dir = path.join(taskOutDir, 'test-cases');
  if (!fs.existsSync(dir)) return null;
  const model = require(path.resolve(__dirname, '..', '..', 'lib', 'testcase', 'model'));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.xlsx') && f.charAt(0) !== '~');
  for (const f of files) {
    let src;
    try { src = await new ExcelJS.Workbook().xlsx.readFile(path.join(dir, f)); } catch (e) { continue; }
    for (const ws of src.worksheets) {
      let headerRow = 0; let headers = [];
      ws.eachRow((row, rn) => {
        if (headerRow) return;
        const vals = row.values.slice(1).map((v) => String(v == null ? '' : (v.text || v.result || v)));
        if (vals.length && model.isSetupContractHeader(vals)) { headerRow = rn; headers = vals; }
      });
      if (!headerRow) continue;
      const out = wb.addWorksheet('Preconditions', { views: [{ state: 'frozen', ySplit: 1 }] });
      out.addRow(headers);
      let n = 0;
      ws.eachRow((row, rn) => {
        if (rn <= headerRow) return;
        const vals = headers.map((_, i) => { const c = row.getCell(i + 1).value; return c == null ? '' : String(c.text || c.result || c); });
        if (vals.some((v) => v.trim())) { out.addRow(vals); n++; }
      });
      out.columns.forEach((col, i) => { col.width = Math.min(52, Math.max(14, String(headers[i] || '').length + 12)); });
      out.eachRow((row, rn) => row.eachCell((cell) => { cell.alignment = { vertical: 'top', wrapText: true }; if (rn === 1) cell.font = { bold: true }; }));
      return { file: f, sheet: ws.name, rows: n };
    }
  }
  return null;
}

async function main() {
  const STORY = arg('story', process.env.JIRA_STORY_KEY || '');
  const ROOT = arg('folder-root', '');
  const ONLY = new Set(String(arg('only', '')).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
  if (!STORY && !ROOT && !ONLY.size) { console.error('ERROR: cần --story <JIRA-KEY>, hoặc --folder-root <tên>, hoặc --only <TC_IDs>'); process.exit(2); }

  const aio = new AioClient();
  const all = await aio.list('/testcase');

  // Đường dẫn folder đầy đủ để lọc theo nhánh gốc (list chỉ trả folder lá + parentID).
  const folders = await aio.folderMap('testcase');
  const pathById = {}; Object.entries(folders).forEach(([p, id]) => { pathById[id] = p; });

  let picked = all;
  if (ONLY.size) picked = picked.filter((c) => ONLY.has(String(c.automationKey || '').toUpperCase()));
  if (ROOT) picked = picked.filter((c) => String(pathById[(c.folder || {}).ID] || '').split('/')[0] === ROOT);
  if (STORY && !ONLY.size && !ROOT) {
    const id = await jiraIssueId(STORY);
    picked = picked.filter((c) => (c.jiraRequirementIDs || []).map(String).includes(id));
    console.log(`Story ${STORY} → Jira issue id ${id}`);
  }
  if (!picked.length) { console.error('ERROR: không tìm thấy case nào khớp bộ lọc. (AIO lưu ID SỐ của issue, không phải key — kiểm --story.)'); process.exit(2); }

  console.log(`Tìm thấy ${picked.length} case trên AIO.`);
  const rows = [];
  const noSteps = [];
  for (const [i, c] of picked.entries()) {
    const d = (await aio.call('GET', `/testcase/${c.key}/detail`)).json || {};
    const steps = d.steps || [];
    if (!steps.length) noSteps.push(c.automationKey || c.key);
    const folderPath = pathById[(c.folder || {}).ID] || '';
    rows.push([
      c.automationKey || '',
      (c.folder || {}).name || '',                       // Nhóm chức năng = folder lá (đúng chiều publish)
      folderPath.split('/').slice(0, -1).join(' / '),     // Module = nhánh cha
      c.title || '',
      c.precondition || '',
      (steps[0] && steps[0].data) || '',                 // publish đặt Dữ liệu Test ở step đầu
      numbered(steps.map((s) => s.step)),
      numbered(steps.map((s) => s.expectedResult)),
      PRIORITY_NAME[(c.priority || {}).ID] || '',
      '',                                                // Mức độ rủi ro: AIO không có field tương ứng
    ]);
    if ((i + 1) % 25 === 0) process.stdout.write(`  ...${i + 1}/${picked.length}\n`);
    await aio.pause();
  }
  if (noSteps.length) console.log(`⚠ ${noSteps.length} case KHÔNG có bước: ${noSteps.slice(0, 8).join(', ')}`);

  const outDir = arg('out-dir') || path.join(rc.getTaskOutputDir(), 'test-cases', 'from-aio');
  const outFile = path.join(outDir, `${STORY || ROOT || rc.getTaskKey()}_from_aio.xlsx`);
  if (!flag('write')) {
    console.log(`\nSẽ ghi: ${outFile}`);
    console.log(`Mẫu dòng đầu: ${JSON.stringify(rows[0].map((v) => String(v).slice(0, 34)))}`);
    console.log('\n[DRY-RUN] chưa ghi file. Thêm --write.');
    return;
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'test-automation-kit (aio-pull)';
  wb.created = new Date();
  const sheet = wb.addWorksheet('Test Cases', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.addRow(HEADERS);
  rows.forEach((r) => sheet.addRow(r));
  sheet.columns.forEach((col, i) => { col.width = COL_WIDTHS[i] || 24; });
  sheet.eachRow((row, n) => {
    row.height = n === 1 ? 24 : undefined;
    row.eachCell((cell) => { cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }; if (n === 1) cell.font = { bold: true }; });
  });
  const contract = await copySetupContract(wb, rc.getTaskOutputDir());
  if (contract) console.log(`Setup contract: copy ${contract.rows} dòng từ ${contract.file} (sheet "${contract.sheet}")`);
  else console.log('⚠ KHÔNG thấy setup contract trong test-cases/*.xlsx ⇒ bản kéo về thiếu sheet Preconditions, Phase 2 sẽ không biết dựng precondition thế nào.');

  fs.mkdirSync(outDir, { recursive: true });
  await wb.xlsx.writeFile(outFile);
  console.log(`\nĐÃ GHI ${rows.length} case → ${outFile}`);

  /*
   * TỰ ĐỐI SOÁT: đọc LẠI file vừa ghi bằng CHÍNH parser canonical mà Phase 2 sẽ dùng.
   * Ghi thành công không có nghĩa là đọc được — lệch cột/tên sheet chỉ lộ ra ở lượt execute sau đó.
   */
  const { parseXlsx } = require(path.resolve(__dirname, '..', '..', 'lib', 'testcase'));
  const back = await parseXlsx(outFile);
  const ok = (back.tests || []).length;
  const backSetup = (back.setup || []).length;
  const wantSetup = contract ? contract.rows : 0;
  const same = ok === rows.length && backSetup === wantSetup;
  console.log(`ĐỐI SOÁT: đọc lại ${ok}/${rows.length} case · setup contract ${backSetup}/${wantSetup} dòng · ${same ? '✓ KHỚP' : '✗ LỆCH'}`);
  if (contract && backSetup !== wantSetup) console.log('  ✗ sheet Preconditions ghi ra mà parser canonical đọc không đủ — kiểm tên/thứ tự cột.');
  (back.warnings || []).slice(0, 3).forEach((w) => console.log(`  ⚠ ${w}`));
  if (!same) process.exitCode = 1;
}

// Guard: `require` file này KHÔNG được tự chạy — nó có đường ghi (`--apply`) vào hệ thống không xoá được.
if (require.main === module) main().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
module.exports = { main };
