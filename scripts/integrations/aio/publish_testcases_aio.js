#!/usr/bin/env node
'use strict';

/*
 * publish_testcases_aio.js — đẩy testcase từ Excel canonical lên AIO Tests.
 * Dùng CHUNG model canonical scripts/lib/testcase với mọi script đọc Excel,
 * nên mọi luật đọc/validate Excel giữ nguyên — chỉ khác tầng gọi API.
 *
 * MẶC ĐỊNH DRY-RUN. AIO không có API xoá case → sai là phải dọn tay trên UI, nên bắt buộc xem
 * trước rồi mới --apply.
 *
 * Dùng:
 *   node scripts/integrations/aio/publish_testcases_aio.js --file <x.xlsx> --story <JIRA-KEY>
 *   ... --apply            # ghi thật
 *   ... --limit 5          # chỉ N case đầu (chạy thử)
 *   [--throttle 130]
 *
 * ÁNH XẠ (cột Excel → field AIO):
 *   Trường hợp kiểm thử → title          |  TC ID        → automationKey (KHÔNG ghép vào title)
 *   Tiền điều kiện      → precondition   |  Nhóm chức năng→ folder (cây tạo TỪ Excel, không hardcode)
 *   Các bước/Kết quả    → steps[]        |  Ưu tiên       → priority
 *   Dữ liệu Test        → steps[0].data  |  story         → jiraRequirementIDs
 * KHÔNG dùng `tags`: AIO nhận 200 nhưng không lưu (đã đo) → TC ID nằm ở automationKey.
 */

const fs = require('fs');
const path = require('path');
const { AioClient } = require('./aio_client');
const rc = require(path.resolve(__dirname, '..', '..', 'utils', 'runtime_config'));
const { parseXlsx } = require(path.resolve(__dirname, '..', '..', 'lib', 'testcase'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);

const FILE = arg('file');
const STORY = arg('story', process.env.JIRA_STORY_KEY || '');
const APPLY = flag('apply');
const LIMIT = Number(arg('limit', Infinity));
// `--only TC_001,TC_007` — đẩy lại vài case lẻ sau khi sửa Excel, khỏi quét cả bộ.
const ONLY = new Set(String(arg('only', '')).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
const QA_APPROVED = flag('qa-approved') || process.env.JIRA_TESTCASE_QA_APPROVED === '1';

const PRIORITY = { critical: 1, high: 2, medium: 3, low: 4, lowest: 5 };
const STATUS_PUBLISHED = 3;
const SCRIPT_CLASSIC = 1;
const AUTOMATION_MANUAL = 1;
// Loại case suy từ tên nhóm — đỡ phải khai tay, và sai thì chỉ lệch nhãn chứ không mất dữ liệu.
/*
 * Case Type: ĐỌC TỪ CỘT `Loại case` do người khai — KHÔNG suy từ tên nhóm nữa.
 * Bản cũ suy từ `Nhóm chức năng`, nhưng đó là trục "test Ở ĐÂU" còn case type là trục "LOẠI KIỂM THỬ NÀO".
 * Ép trục này ra trục kia thì hậu quả đo được ngay: 1.342/1.399 case (96%) rơi về Functional, Integration
 * và Performance = 0 ⇒ lọc/báo cáo theo Case Type trên AIO vô dụng.
 * ID lấy từ `GET /config` của chính AIO (giống cách làm với run status) — không hardcode con số.
 */
const CASE_TYPE_FALLBACK = 'Functional';
function caseTypeResolver(cfg) {
  const byName = Object.fromEntries((cfg.caseTypes || []).map((t) => [String(t.name).toLowerCase(), t.ID]));
  const fallback = byName[CASE_TYPE_FALLBACK.toLowerCase()];
  let guessed = 0;
  return {
    idOf(tc) {
      const declared = String(tc.caseType || '').trim().toLowerCase();
      if (declared && byName[declared]) return byName[declared];
      if (declared) console.log(`  ⚠ ${tc.id || ''}: "Loại case" = "${tc.caseType}" không thuộc 6 loại AIO nhận → dùng ${CASE_TYPE_FALLBACK}`);
      else guessed += 1;
      return fallback;
    },
    report() {
      if (guessed) console.log(`⚠ ${guessed} case CHƯA khai cột "Loại case" → tạm gán ${CASE_TYPE_FALLBACK}. Đây là SUY ĐOÁN, không phải phân loại — bổ sung cột thì lọc theo Case Type trên AIO mới có nghĩa.`);
    },
  };
}
const lineText = (x) => (typeof x === 'string' ? x : (x && (x.text || x.value || x.line)) || '');
const tcIdOf = (t) => t.id || (t._cells && (t._cells['TC ID'] || t._cells['TC_ID'])) || '';

/** Report publish — path theo runtime_config để nằm đúng `<TASK_OUTPUT_DIR>/reports/`. */
function writeReport(r) {
  let out;
  try { out = path.join(rc.getTaskOutputDir(), 'reports'); } catch (e) { return; }   // không có TASK_KEY thì bỏ qua, đừng vỡ
  const L = [`<!-- gate: proven=${r.created + r.updated} inconclusive=0 broken=${r.failed} -->`,
    '# Publish testcase lên AIO Tests', '',
    `- Nguồn: \`${path.basename(r.file)}\` · story: \`${r.story || '(không)'}\``,
    `- Kết quả: **tạo ${r.created}** · **cập nhật ${r.updated}** · **lỗi ${r.failed}** (tổng ${r.tests.length} case xử lý)`,
    `- Cây folder: \`${r.rootName}/{${r.groups.join(', ')}}\``,
    '- Dedup theo `automationKey` (= TC ID): case đã có thì UPDATE, không tạo trùng.', ''];
  if (r.errors.length) L.push('## Lỗi', '', ...r.errors.map((e) => `- ${e}`), '');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'aio-testcase-publish-summary.md'), `${L.join('\n')}\n`);
  console.log(`Report: ${path.join(path.relative(rc.REPO_ROOT, out), 'aio-testcase-publish-summary.md')}`);
}

async function main() {
  if (!FILE) { console.error('ERROR: cần --file <đường dẫn .xlsx>'); process.exit(2); }
  const aio = new AioClient({ throttleMs: Number(arg('throttle', 0)) || undefined });
  const CT = caseTypeResolver((await aio.call('GET', '/config')).json || {});
  const doc = await parseXlsx(path.resolve(FILE));
  const picked = ONLY.size ? (doc.tests || []).filter((t) => ONLY.has(String(tcIdOf(t)).toUpperCase())) : (doc.tests || []);
  if (ONLY.size && picked.length !== ONLY.size) {
    const got = new Set(picked.map((t) => String(tcIdOf(t)).toUpperCase()));
    console.error(`ERROR: --only có ${ONLY.size} TC ID nhưng chỉ tìm thấy ${picked.length} trong Excel. Không thấy: ${[...ONLY].filter((k) => !got.has(k)).join(', ')}`);
    process.exit(2);
  }
  const tests = picked.slice(0, LIMIT);
  if (!tests.length) { console.error(`ERROR: không đọc được case nào từ ${FILE}`); process.exit(2); }

  /*
   * Chốt QA: ghi thật phải có người duyệt.
   * AIO KHÔNG có API xoá case ⇒ publish nhầm là phải vào UI dọn tay từng cái.
   */
  if (APPLY && !QA_APPROVED) {
    console.error('CHẶN: publish thật cần QA duyệt — thêm --qa-approved (hoặc JIRA_TESTCASE_QA_APPROVED=1).');
    console.error('       AIO KHÔNG có API xoá case: đẩy nhầm là phải dọn tay trên UI. Xem --dry-run trước.');
    process.exit(1);
  }

  // Jira issue id của story (AIO nhận cả key lẫn id; dùng key cho khỏi phải gọi Jira).
  const reqIds = STORY ? [STORY] : [];

  const groups = [...new Set(tests.map((t) => t.group).filter(Boolean))];
  console.log(`Nguồn : ${path.basename(FILE)}`);
  console.log(`Case  : ${doc.tests.length}${tests.length !== doc.tests.length ? ` (xử lý ${tests.length})` : ''} · nhóm: ${groups.length} · story: ${STORY || '(không)'}`);
  console.log(`Bước  : ${tests.reduce((s, t) => s + (t.steps || []).length, 0)}`);

  /*
   * --folder-root NHẬN ĐƯỜNG DẪN NHIỀU CẤP ("A/B"): API `folder/hierarchy` nhận mảng segment tuỳ ý, nên
   * giới hạn "2 cấp" trước đây là do CHÍNH script chỉ truyền [root, nhóm]. Hệ quả đo được: bộ testcase cũ
   * nằm ở cây 3 cấp thì không thêm case vào được — phải vá tay trên UI. Nay khai đúng cây là xong.
   */
  const rootName = arg('folder-root', STORY || path.basename(FILE, '.xlsx'));
  const rootSegs = rootName.split('/').map((x) => x.trim()).filter(Boolean);
  if (!APPLY) {
    console.log(`\nFolder sẽ tạo: ${rootName}/{${groups.join(', ')}}`);
    const t = tests[0];
    console.log('\n[DRY-RUN] payload mẫu:');
    console.log(JSON.stringify({ title: t.title, automationKey: tcIdOf(t), precondition: String(t.precondition || '').slice(0, 90) + '…',
      folder: `${rootName}/${t.group}`, priority: PRIORITY[String(t.priority || '').toLowerCase()] || 3,
      steps: (t.steps || []).length, jiraRequirementIDs: reqIds }, null, 1));
    console.log('\nThêm --apply để ghi thật. AIO KHÔNG có API xoá case — kiểm kỹ trước.');
    return;
  }

  // 1) Cây thư mục dựng TỪ nhóm trong Excel (hardcode danh sách là nguồn gốc lỗi lệch tên).
  for (const g of groups) await aio.ensureFolder('testcase', [...rootSegs, g]);
  const folders = await aio.folderMap('testcase');
  console.log(`\nFolder: ${groups.filter((g) => folders[g]).length}/${groups.length} sẵn sàng`);

  /*
   * 2) Dedup theo automationKey — chạy lại thì UPDATE, không tạo trùng (AIO không xoá được).
   * `list` ĐÃ trả sẵn automationKey (đo: 1403/1403), nên KHÔNG gọi `GET /testcase/{key}/detail` từng case:
   * vòng lặp đó tốn thêm đúng bằng số case request mỗi lần publish (~1.400) mà không thêm thông tin gì.
   */
  const existing = {};
  for (const c of await aio.list('/testcase')) if (c.automationKey) existing[String(c.automationKey).toUpperCase()] = c.key;
  console.log(`Đã có trên AIO: ${Object.keys(existing).length} case (khớp theo automationKey)`);

  let created = 0; let updated = 0; let failed = 0; const errors = [];
  for (const [i, t] of tests.entries()) {
    const tcId = tcIdOf(t);
    const payload = {
      title: String(t.title || '').slice(0, 250),
      precondition: String(t.precondition || ''),
      folder: folders[`${rootName}/${t.group}`] ? { ID: folders[`${rootName}/${t.group}`] } : undefined,
      priority: { ID: PRIORITY[String(t.priority || '').toLowerCase()] || 3 },
      status: { ID: STATUS_PUBLISHED },
      type: { ID: CT.idOf(t) },
      scriptType: { ID: SCRIPT_CLASSIC },       // bắt buộc khi có steps
      automationStatus: { ID: AUTOMATION_MANUAL },
      automationKey: tcId,                       // nơi trú của TC ID (tags không lưu được)
      jiraRequirementIDs: reqIds,
      steps: (t.steps || []).map((s, n) => ({
        step: lineText(s),
        data: n === 0 ? String(t.data || '') : '',
        expectedResult: lineText((t.expected || [])[n]),
        stepType: 'TEXT',
      })).filter((s) => s.step),
    };
    const key = existing[String(tcId).toUpperCase()];
    const res = key ? await aio.mergePut(`/testcase/${key}/detail`, payload) : await aio.call('POST', '/testcase', payload);
    if (res.status < 300) {
      key ? updated++ : created++;
      process.stdout.write(`  ${String(i + 1).padStart(3)}/${tests.length} ${key ? '↻ ' + key : '✓ ' + (res.json && res.json.key)} [${tcId}]\n`);
    } else { failed++; errors.push(`${tcId}: HTTP ${res.status} ${String(res.text).slice(0, 120)}`); }
    await aio.pause();
  }
  CT.report();
  console.log(`\nTẠO ${created} · CẬP NHẬT ${updated} · LỖI ${failed}`);
  errors.slice(0, 5).forEach((e) => console.log(`  ✗ ${e}`));
  if (failed) process.exitCode = 1;
}

// Guard: `require` file này KHÔNG được tự chạy — nó có đường ghi (`--apply`) vào hệ thống không xoá được.
if (require.main === module) main().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
module.exports = { main, writeReport };
