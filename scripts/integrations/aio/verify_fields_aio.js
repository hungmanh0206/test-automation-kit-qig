#!/usr/bin/env node
'use strict';

/*
 * verify_fields_aio.js — ĐỐI SOÁT TỪNG TRƯỜNG giữa Excel canonical và bản ghi thật trên AIO.
 *
 * VÌ SAO CÓ FILE NÀY (đo thật 21/08/2026, bộ SAPP-26878 101 case): publish trả `TẠO 0 · CẬP NHẬT 101 ·
 * LỖI 0` — nghĩa là mọi request 2xx — mà vẫn có HAI trường sai im lặng:
 *   - `Module` (chở mã US): publish KHÔNG gửi đi đâu cả, còn `pull` thì bịa lại từ đường dẫn folder cha
 *     ⇒ round-trip trả về "Hiệu chỉnh thông tin ghi nhận…" thay vì "Business Partner / US-01 Tạo BP".
 *     Ô có dữ liệu, trông như đúng, mà là giá trị khác hẳn nguồn — không ai soi mắt mà thấy được.
 *   - `Kết quả mong đợi`: từng bị ghép theo chỉ số phẳng, mất 300/682 dòng ở 83/101 case.
 * Kết luận: **HTTP 2xx không chứng minh mapping đúng.** Chỉ có đọc lại từng trường rồi so mới chứng minh
 * được. Đó là việc của file này.
 *
 * ĐO THÊM 07/09/2026 (bộ SAPP-26878, 297 case): đối soát trả `1881/1881 khớp` mà **không một case nào
 * được nối với Jira story** — `jiraRequirementIDs` rỗng sạch. Lý do: `MAPPING` chỉ soi những cột CÓ
 * TRONG FILE EXCEL, mà `story` là tham số đặt lúc publish (`--story` / `JIRA_STORY_KEY`), không phải cột.
 * Publish có in `story: (không)` ở dòng 2 nhưng người chỉ đọc dòng tổng kết `TẠO/CẬP NHẬT/LỖI` ở cuối.
 * ⇒ Sinh ra lớp ③: soi cả những thứ **đặt lúc publish** chứ không nằm trong file.
 *
 * BA LỚP KIỂM:
 *   ① CẤU TRÚC (không cần mạng) — mọi cột của nguồn phải có ĐÍCH khai trong `MAPPING`, hoặc được khai
 *      tường minh ở `LOCAL_ONLY` kèm lý do. Cột lạ = CHẶN. Đây là lớp lẽ ra đã bắt được ca `Module`:
 *      cột tồn tại trong template mà không ai khai đích, nên rơi mà không có tiếng động.
 *   ② GIÁ TRỊ (gọi AIO) — đọc lại từng case rồi so từng trường đã khai.
 *   ③ THUỘC TÍNH LÚC PUBLISH (gọi AIO) — `story` và ĐƯỜNG DẪN FOLDER: không nằm trong file nên lớp ①
 *      không thấy, lớp ② không so. Đây đúng là vùng mù đã để lọt ca 297 case không nối story.
 *
 * Dùng:
 *   node scripts/integrations/aio/verify_fields_aio.js --task <KEY> --file <xlsx> [--story <JIRA-KEY>]
 *   ... --folder-root "<đường dẫn>"   # bắt buộc nếu muốn lớp ③ soi cả vị trí folder
 *   ... --no-publish-attrs            # tắt lớp ③ (chỉ khi cố ý push không gắn story)
 *   ... --structure-only     # chỉ lớp ①, không gọi mạng (chạy được ở CI không token)
 *   ... --max <n>            # giới hạn số case đối soát giá trị (mặc định: tất cả)
 * Thoát 1 nếu có bất kỳ lệch nào.
 */

const path = require('path');
const { AioClient } = require('./aio_client');
const canonical = require(path.resolve(__dirname, '..', '..', 'lib', 'testcase'));
const { displayTitle } = require('./publish_testcases_aio');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);

const norm = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const PRIORITY_NAME = { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low', 5: 'Lowest' };
const cfOf = (d, name) => {
  const f = ((d && d.customFields) || []).find((x) => String(x.name || '').toLowerCase() === name.toLowerCase());
  return f ? norm(f.value) : '';
};

/*
 * ĐÍCH của từng cột canonical. `src` đọc từ testcase canonical, `aio` đọc từ bản ghi AIO (detail).
 * Thêm cột mới vào template thì PHẢI thêm một dòng ở đây, nếu không lớp ① chặn — đúng chỗ mà ca `Module`
 * đã lọt qua trước đây.
 */
const MAPPING = [
  { col: 'Nhóm chức năng', src: (t) => norm(t._cells['Nhóm chức năng'] || t.group), aio: (d) => norm((d.folder || {}).name), note: 'folder lá' },
  { col: 'TC ID', src: (t) => norm(t.tcId), aio: (d) => norm(d.automationKey), note: 'automationKey (khoá nối)' },
  { col: 'Loại case', src: (t) => norm(t.caseType), aio: (d) => norm((d.type || {}).name), note: 'Case Type' },
  { col: 'Tag', src: (t) => canonical.tagNamesOf(t.tags, t.title).map((x) => x.toLowerCase()).sort().join('|'),
    aio: (d) => ((d.tags || []).map((x) => norm((x.tag || {}).name).toLowerCase()).sort().join('|')),
    note: 'Field Tags (so như TẬP HỢP: AIO trả theo thứ tự của nó)' },
  { col: 'Module', src: (t) => norm(t.module), aio: (d) => cfOf(d, 'Module'), note: 'custom field "Module"' },
  { col: 'Trường hợp kiểm thử', src: (t) => norm(displayTitle(t.title)), aio: (d) => norm(d.title), note: 'title (đã cắt khối tag)' },
  { col: 'Tiền điều kiện', src: (t) => norm(t.precondition), aio: (d) => norm(d.precondition), note: 'precondition' },
  { col: 'Dữ liệu Test', src: (t) => norm(t.data), aio: (d) => norm(((d.steps || [])[0] || {}).data), note: 'steps[0].data' },
  { col: 'Các bước thực hiện', src: (t) => canonical.groupNumbered(t.steps || []).map((s) => norm(s.text)).join(' ¶ '),
    aio: (d) => (d.steps || []).map((s) => norm(s.step)).join(' ¶ '), note: 'steps[].step' },
  { col: 'Kết quả mong đợi', src: (t) => canonical.groupNumbered(t.expected || []).map((s) => norm(s.text)).join(' ¶ '),
    aio: (d) => (d.steps || []).map((s) => norm(s.expectedResult)).join(' ¶ '), note: 'steps[].expectedResult' },
  { col: 'Ưu tiên', src: (t) => norm(t.priority).toLowerCase(), aio: (d) => norm(PRIORITY_NAME[(d.priority || {}).ID]).toLowerCase(), note: 'priority' },
];

/*
 * Cột CỐ Ý không lên AIO. Phải khai kèm lý do — im lặng bỏ một cột là đúng cái lỗi file này đi bắt.
 */
const LOCAL_ONLY = {
  'Mức độ rủi ro': 'Cột Severity đã bỏ khỏi template 21/08/2026 (thuộc tính của BUG). Bộ TC cũ còn cột này thì giữ ở local, không đẩy.',
  Severity: 'Xem trên — Severity chấm lúc log bug, không phải lúc viết case.',
  'TC gốc': 'Truy vết nội bộ giữa các bộ TC, AIO không có ô tương ứng.',
  'Ghi chú Phase 2': 'Ghi chú cho người chạy, không phải dữ liệu của case.',
};

/*
 * ③ THUỘC TÍNH ĐẶT LÚC PUBLISH — không phải cột trong file nên phải soi riêng.
 *
 * `story`: AIO lưu jiraRequirementIDs dưới dạng ID SỐ của issue (vd 58606), không phải key (SAPP-26878).
 * Nên muốn khẳng định "nối đúng story" thì phải hỏi Jira đổi key sang id. Không có credential Jira thì
 * KHÔNG được kết luận là đúng — chỉ kiểm được "có nối và nối đồng nhất", và phải nói rõ mức đó.
 */
async function resolveJiraIssueId(key) {
  const base = process.env.JIRA_BASE_URL || process.env.JIRA_URL;
  const user = process.env.JIRA_EMAIL || process.env.JIRA_USERNAME;
  const token = process.env.JIRA_API_TOKEN;
  if (!base || !user || !token) return null;
  const https = require('https');
  const U = new URL(base);
  const auth = Buffer.from(`${user}:${token}`).toString('base64');
  return new Promise((res) => {
    https.get({ hostname: U.hostname, path: `/rest/api/3/issue/${encodeURIComponent(key)}?fields=id`,
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } }, (r) => {
      let b = ''; r.on('data', (c) => { b += c; });
      r.on('end', () => { try { res(r.statusCode < 300 ? String(JSON.parse(b).id) : null); } catch (e) { res(null); } });
    }).on('error', () => res(null));
  });
}

/*
 * Trả về danh sách vấn đề (rỗng = đạt). `seen` là mảng {tcId, reqIds, folderPath}.
 */
function checkPublishAttrs(seen, { story, storyId, folderRoot }) {
  const problems = [];

  // -- story --
  const noLink = seen.filter((x) => !x.reqIds.length);
  if (noLink.length) {
    problems.push(`${noLink.length}/${seen.length} case KHÔNG nối story nào (jiraRequirementIDs rỗng) — vd ${noLink.slice(0, 5).map((x) => x.tcId).join(', ')}`);
    problems.push('   → publish lại kèm --story <KEY>; nhớ đặt TASK_ENV=profiles/<TASK>/task.env để JIRA_STORY_KEY có giá trị.');
  } else {
    const sets = [...new Set(seen.map((x) => x.reqIds.slice().sort().join(',')))];
    if (sets.length > 1) {
      problems.push(`case nối story KHÔNG đồng nhất — ${sets.length} tổ hợp khác nhau: ${sets.slice(0, 4).map((x) => `[${x}]`).join(' · ')}`);
      problems.push('   → một phần bộ case đang trỏ sai story hoặc sót lượt publish.');
    } else if (storyId && !sets[0].split(',').includes(storyId)) {
      problems.push(`mọi case cùng nối [${sets[0]}] nhưng story yêu cầu là ${story} (id ${storyId}) — đang nối nhầm issue khác.`);
    }
  }

  // -- duong dan folder --
  if (folderRoot) {
    const wrong = seen.filter((x) => x.folderPath && !x.folderPath.startsWith(`${folderRoot}/`));
    if (wrong.length) {
      problems.push(`${wrong.length}/${seen.length} case nằm NGOÀI cây "${folderRoot}" — vd ${wrong.slice(0, 3).map((x) => `${x.tcId} @ ${x.folderPath}`).join(' | ')}`);
      problems.push('   → tên folder lá trùng nhau nhưng khác cây cha; lớp ② chỉ so tên lá nên không thấy.');
    }
    const noFolder = seen.filter((x) => !x.folderPath);
    if (noFolder.length) problems.push(`${noFolder.length} case không xác định được folder trên AIO — vd ${noFolder.slice(0, 3).map((x) => x.tcId).join(', ')}`);
  }
  return problems;
}

function checkStructure(headers) {
  const mapped = new Set(MAPPING.map((m) => canonical.normalizeHeader(m.col)));
  const local = new Set(Object.keys(LOCAL_ONLY).map((k) => canonical.normalizeHeader(k)));
  const orphan = (headers || []).filter((h) => {
    const n = canonical.normalizeHeader(h);
    return !mapped.has(n) && !local.has(n);
  });
  return orphan;
}

async function main() {
  const FILE = arg('file');
  const STRUCT_ONLY = flag('structure-only');
  if (!FILE) { console.error('ERROR: cần --file <testcase.xlsx|.md>'); process.exit(2); }

  const doc = FILE.endsWith('.xlsx')
    ? await canonical.parseXlsx(FILE)
    : canonical.parseMarkdown(require('fs').readFileSync(FILE, 'utf8'));
  console.log(`Nguồn: ${path.basename(FILE)} · ${doc.tests.length} case · ${doc.headers.length} cột`);

  // ① CẤU TRÚC
  const orphan = checkStructure(doc.headers);
  if (orphan.length) {
    console.error(`\n[map] ✗ ${orphan.length} cột KHÔNG có đích trên AIO và cũng không khai local-only: ${orphan.join(', ')}`);
    console.error('→ Thêm dòng vào `MAPPING` (nếu phải lên AIO) hoặc vào `LOCAL_ONLY` kèm lý do (nếu cố ý giữ ở local).');
    console.error('  Cột không khai = rơi im lặng: publish vẫn trả 2xx, không gate nào kêu.');
    process.exit(1);
  }
  console.log(`[map] ✓ cấu trúc: ${MAPPING.length} cột có đích · ${doc.headers.filter((h) => LOCAL_ONLY[h]).length} cột khai local-only · 0 cột mồ côi`);
  if (STRUCT_ONLY) return;

  // ② GIÁ TRỊ
  /*
   * NHỊP CHẬM HƠN MẶC ĐỊNH — vì bước này (prompt 04 §8b) chạy NGAY SAU `aio:publish:apply`, lúc ngân
   * sách request đã gần cạn: AIO quá tải thì trả BODY RỖNG chứ không trả 429, cạn retry là dừng giữa
   * đường. Đo thật 24/08/2026: nhịp 200ms chạy ngay sau một lượt publish 101 case thì gãy ở case 25,
   * lần sau gãy ở case 45. 800ms cho 101 case ≈ 80s — rẻ hơn nhiều so với một lượt đối soát dở dang,
   * và rẻ hơn hẳn so với việc tin "mapping đúng" mà chưa đọc được.
   * Ghi đè bằng `AIO_THROTTLE_MS` khi cần nhanh (vd `--max 5` để soi vài case).
   */
  const aio = new AioClient({ throttleMs: Number(process.env.AIO_THROTTLE_MS || 800) });
  const all = await aio.list('/testcase');
  const byKey = new Map(all.filter((c) => c.automationKey).map((c) => [String(c.automationKey).toUpperCase(), c]));
  const MAX = Number(arg('max', '0')) || doc.tests.length;
  const tests = doc.tests.slice(0, MAX);

  const missing = []; const diffs = []; const seen = [];
  // ③ cần bản đồ folder để dựng ĐƯỜNG DẪN ĐẦY ĐỦ — detail chỉ trả tên lá, mà tên lá trùng nhau giữa các cây.
  const PUB_ATTRS = !flag('no-publish-attrs');
  const FOLDER_ROOT = arg('folder-root', '');
  const idToPath = new Map();
  if (PUB_ATTRS) {
    const fm = await aio.folderMap('testcase');
    for (const [pth, fid] of Object.entries(fm)) idToPath.set(String(fid), pth);
  }
  for (const [i, t] of tests.entries()) {
    const hit = byKey.get(String(t.tcId).toUpperCase());
    if (!hit) { missing.push(t.tcId); continue; }
    const det = (await aio.call('GET', `/testcase/${hit.key}/detail`)).json;
    if (!det) throw new Error(`Đọc chi tiết ${hit.key} (${t.tcId}) thất bại — body rỗng sau khi cạn retry; dừng để khỏi báo "khớp" mà thực ra chưa đọc được.`);
    for (const m of MAPPING) {
      const a = m.src(t); const b = m.aio(det);
      if (a !== b) diffs.push({ tcId: t.tcId, key: hit.key, col: m.col, src: a, aio: b });
    }
    if (PUB_ATTRS) {
      seen.push({ tcId: t.tcId,
        reqIds: ((det.jiraRequirementIDs || [])).map(String),
        folderPath: idToPath.get(String((det.folder || {}).ID)) || '' });
    }
    if ((i + 1) % 25 === 0) process.stdout.write(`  ...${i + 1}/${tests.length}\n`);
    await aio.pause();
  }

  console.log(`\n[map] đối soát ${tests.length} case × ${MAPPING.length} trường = ${tests.length * MAPPING.length} phép so`);
  if (missing.length) console.error(`[map] ✗ ${missing.length} case KHÔNG có trên AIO: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}`);
  if (diffs.length) {
    const byCol = {};
    for (const d of diffs) byCol[d.col] = (byCol[d.col] || 0) + 1;
    console.error(`[map] ✗ ${diffs.length} lệch, theo cột: ${Object.entries(byCol).map(([c, n]) => `${c} (${n})`).join(' · ')}`);
    for (const d of diffs.slice(0, 12)) {
      console.error(`  ${d.tcId} · ${d.col}\n     nguồn: ${JSON.stringify(d.src.slice(0, 110))}\n     AIO  : ${JSON.stringify(d.aio.slice(0, 110))}`);
    }
    if (diffs.length > 12) console.error(`  … +${diffs.length - 12} lệch nữa`);
  }

  // ③ THUỘC TÍNH ĐẶT LÚC PUBLISH
  let attrProblems = [];
  if (PUB_ATTRS && seen.length) {
    const STORY = arg('story', process.env.JIRA_STORY_KEY || '');
    const storyId = STORY ? await resolveJiraIssueId(STORY) : null;
    attrProblems = checkPublishAttrs(seen, { story: STORY, storyId, folderRoot: FOLDER_ROOT });
    const how = STORY
      ? (storyId ? `đối chiếu với ${STORY} (id ${storyId}) lấy từ Jira` : `CHƯA đổi được ${STORY} sang id (thiếu credential Jira) — chỉ kiểm được "có nối và nối đồng nhất"`)
      : 'không có --story/JIRA_STORY_KEY — chỉ kiểm được "có nối và nối đồng nhất"';
    console.log(`[map] ③ thuộc tính lúc publish: story ${how}${FOLDER_ROOT ? ` · folder phải nằm trong "${FOLDER_ROOT}"` : ' · KHÔNG kiểm folder (thiếu --folder-root)'}`);
    if (attrProblems.length) {
      console.error('[map] ✗ lệch ở thuộc tính đặt lúc publish:');
      attrProblems.forEach((x) => console.error(`  ${x}`));
    }
  } else if (!PUB_ATTRS) {
    console.log('[map] ③ BỎ QUA theo --no-publish-attrs — story và folder KHÔNG được kiểm.');
  }

  if (missing.length || diffs.length || attrProblems.length) process.exit(1);
  console.log('[map] ✓ MỌI trường khớp — không lệch, không case thiếu.');
  if (PUB_ATTRS) console.log('[map] ✓ story và folder khớp yêu cầu lúc publish.');
}

if (require.main === module) main().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
module.exports = { MAPPING, LOCAL_ONLY, checkStructure, checkPublishAttrs };
