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
 * FIELD TAGS: ĐẨY ĐƯỢC — nhưng phải đúng hình dạng của spec. `tags` là mảng `CaseTag`, tức tag LỒNG
 * trong khoá `tag`: `[{ tag: { ID, name } }]`. Ba dạng phẳng `[{ID,name}]`/`[{name}]`/`[ID]` đều nhận
 * HTTP 200 rồi bị bỏ IM LẶNG — ghi chú cũ của kit kết luận "AIO không lưu tags" chính vì chỉ thử 3 dạng đó.
 * Tag còn phải TỒN TẠI trong registry cấp project trước (`GET/POST /tag`, body của POST là MẢNG).
 * TC ID vẫn ở `automationKey` (khoá liên kết), tag chỉ để người đọc lọc/nhìn.
 */

const fs = require('fs');
const path = require('path');
const { AioClient } = require('./aio_client');
const rc = require(path.resolve(__dirname, '..', '..', 'utils', 'runtime_config'));
const { parseXlsx, groupNumbered, tagNamesOf } = require(path.resolve(__dirname, '..', '..', 'lib', 'testcase'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);

const FILE = arg('file');
const STORY = arg('story', process.env.JIRA_STORY_KEY || '');
const APPLY = flag('apply');
const LIMIT = Number(arg('limit', Infinity));
// `--only TC_001,TC_007` — đẩy lại vài case lẻ sau khi sửa Excel, khỏi quét cả bộ.
const ONLY = new Set(String(arg('only', '')).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
const QA_APPROVED = flag('qa-approved') || process.env.JIRA_TESTCASE_QA_APPROVED === '1';

/*
 * Map TÊN → ID priority của AIO. `highest` là alias BẮT BUỘC: bộ TC cũ dùng tên thang Jira, và trước đây
 * thiếu khoá này nên mọi case `Highest` rơi về fallback `|| 3` = Medium — hạ ưu tiên âm thầm (đo: 14 case).
 */
const PRIORITY = { critical: 1, highest: 1, high: 2, medium: 3, low: 4, lowest: 5 };
const STATUS_PUBLISHED = 3;
const SCRIPT_CLASSIC = 1;
const AUTOMATION_MANUAL = 1;
/*
 * Case Type: ĐỌC TỪ CỘT `Loại case` do người khai — KHÔNG suy từ tên nhóm nữa.
 * Bản cũ suy từ `Nhóm chức năng`, nhưng đó là trục "test Ở ĐÂU" còn case type là trục "LOẠI KIỂM THỬ NÀO".
 * Ép trục này ra trục kia thì hậu quả đo được ngay: 1.342/1.399 case (96%) rơi về Functional, Integration
 * và Performance = 0 ⇒ lọc/báo cáo theo Case Type trên AIO vô dụng.
 * ID lấy từ `GET /config` của chính AIO (giống cách làm với run status) — không hardcode con số.
 *
 * KHÔNG CÒN FALLBACK NGẦM. Bản trước gặp tên không resolve được thì in một dòng ⚠ rồi vẫn đẩy lên với
 * `Functional`. Đó chính là cơ chế đã làm 14 case `Highest` âm thầm tụt xuống Medium: cảnh báo trôi trong
 * log của một lệnh đẩy hàng trăm case, còn dữ liệu trên AIO thì sai vĩnh viễn — AIO KHÔNG CÓ API XOÁ.
 * Nay: dừng TRƯỚC khi ghi, in đủ tên AIO đang có để người sửa biết phải tạo/đổi tên loại nào.
 */
function caseTypeResolver(cfg) {
  const byName = Object.fromEntries((cfg.caseTypes || []).map((t) => [String(t.name).toLowerCase(), t.ID]));
  const known = (cfg.caseTypes || []).map((t) => t.name);
  const unresolved = new Map(); // tên đã khai (giữ nguyên chữ) → số case
  const missing = [];
  return {
    idOf(tc) {
      const declared = String(tc.caseType || '').trim();
      if (declared && byName[declared.toLowerCase()]) return byName[declared.toLowerCase()];
      if (declared) unresolved.set(declared, (unresolved.get(declared) || 0) + 1);
      else missing.push(tcIdOf(tc) || '(khong co TC ID)');
      return null;
    },
    /** Trả về lời giải thích nếu KHÔNG được phép publish; `null` nghĩa là sạch. */
    problem() {
      const L = [];
      if (missing.length) L.push(`${missing.length} case CHƯA khai cột "Loại case": ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ` … +${missing.length - 10}` : ''}`);
      for (const [name, n] of unresolved) L.push(`"${name}" (${n} case) không có trên AIO`);
      if (!L.length) return null;
      return `${L.join('\n  - ')}\n  AIO đang có: ${known.join(' · ')}\n→ Sửa cột "Loại case" trong Excel, hoặc tạo/đổi tên loại trên AIO cho khớp. KHÔNG tự gán tạm: AIO không có API xoá nên nhãn sai là sai vĩnh viễn.`;
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

/*
 * TIÊU ĐỀ GỬI LÊN AIO = NỘI DUNG THUẦN, KHÔNG mang khối tag.
 *
 * Khối `[Positive][BEData][BR-SAPSYNC-001]` ở đầu tiêu đề là TÍN HIỆU CHO MÁY, không phải cho người:
 * `dim:coverage --enforce` đọc tag chiều, luật ORACLE đọc neo `BR-`/`SM-`/`SS-`. Người mở case trên AIO
 * để đọc và chạy thì khối đó chỉ là rác thị giác.
 *
 * VÌ SAO CẮT ĐƯỢC MÀ KHÔNG SỨT MÁY KIỂM (đã đo 20/08/2026):
 *   - Tag vẫn nằm nguyên trong Excel/markdown canonical — đó mới là source-of-truth (CLAUDE.md §6);
 *   - `getTestcaseDirs()` trả `[test-cases, ...mirrors]` và mọi consumer dedup theo tcId kiểu first-wins
 *     ⇒ bản local LUÔN thắng bản mirror kéo từ AIO;
 *   - `dimension_coverage.js` và `bug_tc_matcher.js` chỉ đọc `.md`, mà mirror ghi ra `.xlsx` ⇒ tiêu đề
 *     trên AIO không nuôi gate chiều một chút nào.
 * Chỉ cắt khối bracket LIỀN NHAU ở ĐẦU chuỗi; bracket giữa câu (vd "[FBP] Ngày ghi nhận") giữ nguyên.
 */
/**
 * Bảo đảm mọi tag cần dùng đã có trong registry cấp project, trả map name(lower) → ID.
 *
 * AIO không gắn được tag chưa tồn tại: gán tag lạ thì PUT vẫn 200 mà đọc lại rỗng. Registry chỉ có
 * `GET`/`POST` — KHÔNG có DELETE, nên chỉ tạo tag thật sự có case dùng, đừng tạo thăm dò.
 */
async function ensureTags(aio, names) {
  const map = new Map();
  for (const t of (await aio.call('GET', '/tag')).json || []) {
    if (t && t.name) map.set(String(t.name).toLowerCase(), t.ID);
  }
  const missing = [...new Set(names)].filter((n) => !map.has(n.toLowerCase()));
  if (missing.length) {
    const res = await aio.call('POST', '/tag', missing.map((name) => ({ name })));
    if (!Array.isArray(res.json)) throw new Error(`Tạo ${missing.length} tag thất bại: HTTP ${res.status} ${String(res.text || '').slice(0, 120)}`);
    for (const t of res.json) if (t && t.name) map.set(String(t.name).toLowerCase(), t.ID);
    console.log(`Tag: tạo mới ${res.json.length} (${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '…' : ''})`);
  }
  return map;
}

const displayTitle = (raw) => String(raw || '').replace(/^(?:\s*\[[^\]]*\])+\s*/, '').trim() || String(raw || '').trim();

async function main() {
  if (!FILE) { console.error('ERROR: cần --file <đường dẫn .xlsx>'); process.exit(2); }
  const aio = new AioClient({ throttleMs: Number(arg('throttle', 0)) || undefined });
  const cfg = (await aio.call('GET', '/config')).json || {};
  const CT = caseTypeResolver(cfg);
  /*
   * `Module` là CUSTOM FIELD của AIO — tra ID theo TÊN, không hardcode: ID chỉ đúng trong 1 project, và
   * field có thể bị tạo lại. Không thấy field thì bỏ qua (undefined) chứ không ném lỗi — bộ khác/project
   * khác chưa tạo field vẫn publish được, chỉ là không có Module.
   */
  const moduleFieldId = ((cfg.customFields || []).find((f) => String(f.name || '').toLowerCase() === 'module') || {}).ID;
  if (!moduleFieldId) console.warn('⚠ AIO chưa có custom field "Module" — cột Module sẽ KHÔNG lên AIO.');
  const doc = await parseXlsx(path.resolve(FILE));
  const picked = ONLY.size ? (doc.tests || []).filter((t) => ONLY.has(String(tcIdOf(t)).toUpperCase())) : (doc.tests || []);
  if (ONLY.size && picked.length !== ONLY.size) {
    const got = new Set(picked.map((t) => String(tcIdOf(t)).toUpperCase()));
    console.error(`ERROR: --only có ${ONLY.size} TC ID nhưng chỉ tìm thấy ${picked.length} trong Excel. Không thấy: ${[...ONLY].filter((k) => !got.has(k)).join(', ')}`);
    process.exit(2);
  }
  /*
   * GATE MAPPING ① — mọi cột của nguồn phải có ĐÍCH khai trong `verify_fields_aio.MAPPING`, hoặc khai
   * tường minh là local-only kèm lý do. Cột không khai = rơi im lặng (publish vẫn 2xx, không ai kêu):
   * đúng cách `Module` đã mất suốt nhiều lượt push. Chặn TRƯỚC khi ghi vì AIO không có API xoá.
   */
  {
    // require muộn: verify_fields lấy `displayTitle` từ file này, nạp sớm sẽ thành vòng tròn.
    const { checkStructure } = require('./verify_fields_aio');
    const orphan = checkStructure(doc.headers);
    if (orphan.length) {
      console.error(`[map] ✗ ${orphan.length} cột KHÔNG có đích trên AIO, cũng không khai local-only: ${orphan.join(', ')}`);
      console.error('→ Khai ở `scripts/integrations/aio/verify_fields_aio.js` (MAPPING nếu phải lên AIO, LOCAL_ONLY nếu cố ý giữ local) rồi push lại.');
      process.exit(1);
    }
  }

  const tests = picked.slice(0, LIMIT);
  if (!tests.length) { console.error(`ERROR: không đọc được case nào từ ${FILE}`); process.exit(2); }

  /*
   * GATE Case Type — chạy TRƯỚC vòng ghi, trên TOÀN BỘ danh sách.
   * Phải chặn ở đây chứ không giữa vòng lặp: `--apply` ghi tuần tự, nên dừng giữa chừng để lại một nửa bộ
   * trên AIO với nhãn đúng và một nửa chưa lên — mà AIO KHÔNG CÓ API XOÁ để dọn.
   */
  {
    tests.forEach((t) => CT.idOf(t));
    const problem = CT.problem();
    if (problem) {
      console.error(`CHẶN: "Loại case" chưa dùng được\n  - ${problem}`);
      process.exit(1);
    }
  }

  /*
   * Chốt QA: ghi thật phải có người duyệt.
   * AIO KHÔNG có API xoá case ⇒ publish nhầm là phải vào UI dọn tay từng cái.
   */
  if (APPLY && !QA_APPROVED) {
    /*
     * Thông báo phải nêu ĐÚNG LỆNH CẦN GÕ, kể cả dấu `--` của npm.
     *
     * Lý do, từ SAPP-29229 (tester báo sau bàn giao "không push được lên AIO"): npm script tên là
     * `aio:publish:apply` nhưng KHÔNG mang `--qa-approved`, nên ai gõ đúng tên lệnh cũng bị chặn. Bản
     * cũ chỉ nói "thêm --qa-approved" mà không nói thêm vào đâu; với `npm run` thì phải có `--` ngăn
     * cách, và đó chính là chỗ người mới vấp. Cổng QA giữ nguyên — chỉ làm cho cổng nói rõ cách đi qua.
     */
    const file = arg('file', '<đường-dẫn.xlsx>');
    const story = arg('story', '<JIRA_STORY_KEY>');
    console.error('CHẶN: publish thật cần QA duyệt. Đây là CỔNG NGƯỜI, cố ý không tự động.');
    console.error('');
    console.error('  Gõ đúng lệnh này (chú ý dấu `--` sau tên script, npm cần nó để chuyển cờ xuống):');
    console.error(`    npm run aio:publish:apply -- --qa-approved --file "${file}" --story ${story}`);
    console.error('');
    console.error('  Xem trước mà không ghi gì (bỏ --apply và --qa-approved):');
    console.error(`    npm run aio:publish -- --file "${file}" --story ${story}`);
    console.error('');
    console.error('  AIO KHÔNG có API xoá case: đẩy nhầm là phải dọn tay trên UI. Chạy bản xem trước đi đã.');
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
  let rootName = arg('folder-root', STORY || path.basename(FILE, '.xlsx'));
  let rootSegs = rootName.split('/').map((x) => x.trim()).filter(Boolean);
  if (!APPLY) {
    console.log(`\nFolder sẽ tạo: ${rootName}/{${groups.join(', ')}}`);
    const t = tests[0];
    console.log('\n[DRY-RUN] payload mẫu:');
    console.log(JSON.stringify({ title: displayTitle(t.title), automationKey: tcIdOf(t), tags: tagNamesOf(t.tags, t.title), precondition: String(t.precondition || '').slice(0, 90) + '…',
      folder: `${rootName}/${t.group}`, priority: PRIORITY[String(t.priority || '').toLowerCase()] || 3,
      steps: (t.steps || []).length, jiraRequirementIDs: reqIds }, null, 1));
    console.log('\nThêm --apply để ghi thật. AIO KHÔNG có API xoá case — kiểm kỹ trước.');
    return;
  }

  // 1) Cây thư mục dựng TỪ nhóm trong Excel (hardcode danh sách là nguồn gốc lỗi lệch tên).
  /*
   * TÌM ROOT ĐANG CÓ TRƯỚC KHI TẠO. `ensureFolder` dựng đường dẫn từ GỐC cây, nên nếu folder root cùng
   * tên đang nằm LỒNG sâu hơn (vd "Hiệu chỉnh…/[Payment] - …") thì nó tạo một root THỨ HAI ở cấp gốc,
   * mọi case dọn sang cây mới, cây cũ thành RỖNG — mà AIO KHÔNG có API xoá folder.
   * Đã xảy ra thật 27/08/2026 với bộ SAPP-26878: qua vài lượt publish sinh ra 3 cây trùng tên
   * (#148, #171, #192). Publish vẫn báo LỖI 0 suốt, vì việc ghi case không hề sai — chỉ chỗ đặt là sai.
   *
   * Luật: có ĐÚNG MỘT folder trùng tên root (lồng bao sâu cũng được) thì DÙNG LẠI đường dẫn đó.
   * Nhiều hơn một thì DỪNG, bắt người chạy chỉ rõ — đoán bừa ở hệ không xoá được là sai vĩnh viễn.
   */
  {
    const before = await aio.folderMap('testcase');
    const hits = Object.keys(before).filter((k) => k === rootName || k.endsWith('/' + rootName));
    if (hits.length > 1) {
      console.error(`[folder] ✗ Có ${hits.length} folder cùng tên "${rootName}" — không đoán được nên dùng cây nào:`);
      hits.forEach((h) => console.error(`    #${before[h]}  ${h}`));
      console.error('→ Chỉ rõ bằng --folder-root "<đường dẫn đầy đủ>" (ngăn bằng /), hoặc gộp/đổi tên trên UI trước.');
      process.exit(1);
    }
    if (hits.length === 1 && hits[0] !== rootName) {
      rootSegs = hits[0].split('/');
      rootName = hits[0];
      console.log(`Folder: dùng lại cây đang có (#${before[hits[0]]}) — ${hits[0]}`);
    }
  }
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

  /*
   * Tag phải có trong registry TRƯỚC khi gắn vào case, nếu không PUT trả 200 mà tag rơi im lặng.
   * Dựng một lượt cho cả bộ (1 request GET + tối đa 1 POST) thay vì mỗi case một lần.
   */
  const tagsByTc = new Map(tests.map((t) => [tcIdOf(t), tagNamesOf(t.tags, t.title)]));
  const tagMap = APPLY ? await ensureTags(aio, [...tagsByTc.values()].flat()) : new Map();
  const caseTags = (tcId) => (tagsByTc.get(tcId) || [])
    .filter((n) => tagMap.has(n.toLowerCase()))
    .map((n) => ({ tag: { ID: tagMap.get(n.toLowerCase()), name: n } }));

  let created = 0; let updated = 0; let failed = 0; const errors = [];
  for (const [i, t] of tests.entries()) {
    const tcId = tcIdOf(t);
    const payload = {
      title: displayTitle(t.title).slice(0, 250),
      precondition: String(t.precondition || ''),
      folder: folders[`${rootName}/${t.group}`] ? { ID: folders[`${rootName}/${t.group}`] } : undefined,
      priority: { ID: PRIORITY[String(t.priority || '').toLowerCase()] || 3 },
      status: { ID: STATUS_PUBLISHED },
      type: { ID: CT.idOf(t) },
      scriptType: { ID: SCRIPT_CLASSIC },       // bắt buộc khi có steps
      automationStatus: { ID: AUTOMATION_MANUAL },
      automationKey: tcId,                       // khoá liên kết (KHÔNG dùng tiêu đề — nhiều case trùng tên)
      tags: caseTags(tcId),                      // Field Tags: mảng CaseTag, tag LỒNG trong khoá `tag`
      /*
       * `Module` đi vào CUSTOM FIELD thật của AIO (`customFields[].ID = 1`, SINGLE_LINE_TEXT) —
       * trường này được thêm trên AIO ngày 21/08/2026, trước đó phải gửi tạm qua `description`.
       * Hình dạng ghi được: `[{ ID, value }]` (đã thử; `[{ID,name,value}]` cũng nhận nhưng thừa).
       * `Severity` KHÔNG còn: nó là thuộc tính của bug, đã bỏ khỏi bộ testcase.
       *
       * VÌ SAO PHẢI CÓ: đối soát từng trường cho thấy `Module` (đang chở mã US) trước đây publish
       * KHÔNG gửi đi đâu, mà `pull` lại bịa lại từ đường dẫn folder cha ⇒ round-trip trả về giá trị
       * KHÁC hẳn nguồn mà trông vẫn như có dữ liệu.
       */
      customFields: moduleFieldId && String(t.module || '').trim()
        ? [{ ID: moduleFieldId, value: String(t.module).trim() }] : undefined,
      jiraRequirementIDs: reqIds,
      /*
       * Ghép bước với kết quả theo KHỐI, không theo chỉ số phẳng.
       * Prompt gen §6 cho phép mỗi bước có nhiều dòng con "- ..."; splitNumbered trả PHẲNG (dòng con mang
       * n = null) nên zip theo chỉ số vừa LỆCH bước vừa CẮT phần dôi. Đo trên bộ SAPP-26878 (101 case):
       * 300/682 dòng kết quả (44,0%) bị vứt ở 83 case, và bước sau còn nhận nhầm kết quả của bước trước.
       * Hợp đồng: khối của bước N = dòng đánh số N + mọi dòng con của nó (xem groupNumbered).
       */
      steps: groupNumbered(t.steps || []).map((s, n) => ({
        step: s.text,
        data: n === 0 ? String(t.data || '') : '',
        expectedResult: (groupNumbered(t.expected || [])[n] || {}).text || '',
        stepType: 'TEXT',
      })).filter((s) => s.step),
    };
    const key = existing[String(tcId).toUpperCase()];
    const res = key ? await aio.mergePut(`/testcase/${key}/detail`, payload) : await aio.call('POST', '/testcase', payload);
    if (res.status < 300) {
      /*
       * `POST /testcase` NHẬN `jiraRequirementIDs` trong body, trả 2xx, rồi ÂM THẦM BỎ — chỉ
       * `PUT /testcase/{key}/detail` mới ghi được liên kết Jira. Đo thật 11/09/2026: 3 case vừa TẠO có
       * `jiraRequirementIDs = []` dù lệnh publish đã truyền `--story`, trong khi 173 case đi đường UPDATE
       * cùng lượt thì nối đúng. Hệ quả cũ: bộ case chỉ nối story nếu tình cờ được publish LẦN THỨ HAI.
       * ⇒ Sau mỗi lần TẠO, gọi thêm một nhịp PUT detail chỉ để đóng liên kết.
       */
      if (!key && reqIds.length) {
        const newKey = res.json && res.json.key;
        if (newKey) {
          await aio.pause();
          const link = await aio.mergePut(`/testcase/${newKey}/detail`, { jiraRequirementIDs: reqIds });
          if (link.status >= 300) { failed++; errors.push(`${tcId}: tạo xong nhưng KHÔNG nối được story — HTTP ${link.status}`); }
        }
      }
      key ? updated++ : created++;
      process.stdout.write(`  ${String(i + 1).padStart(3)}/${tests.length} ${key ? '↻ ' + key : '✓ ' + (res.json && res.json.key)} [${tcId}]\n`);
    } else { failed++; errors.push(`${tcId}: HTTP ${res.status} ${String(res.text).slice(0, 120)}`); }
    await aio.pause();
  }
  console.log(`\nTẠO ${created} · CẬP NHẬT ${updated} · LỖI ${failed}`);
  errors.slice(0, 5).forEach((e) => console.log(`  ✗ ${e}`));
  if (failed) process.exitCode = 1;
}

// Guard: `require` file này KHÔNG được tự chạy — nó có đường ghi (`--apply`) vào hệ thống không xoá được.
if (require.main === module) main().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
module.exports = { main, writeReport, displayTitle };
