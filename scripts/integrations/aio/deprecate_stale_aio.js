#!/usr/bin/env node
'use strict';

/*
 * deprecate_stale_aio.js — vòng đời testcase trên AIO khi Excel canonical thay đổi.
 * Bản đối xứng của `jira/cleanup_xray_tests.js` (Xray gắn/gỡ nhãn stale).
 *
 * VÌ SAO CÓ FILE NÀY: trước đó tôi kết luận "AIO không có API xoá ⇒ không làm được cleanup, dọn tay".
 * Kết luận đó SAI ở chỗ nhầm "cleanup" với "xoá". `GET /config` cho thấy AIO có `caseStatuses`:
 * Draft · Under Review · Published · **Deprecated**. Case rời khỏi Excel thì chuyển sang **Deprecated**
 * — vẫn giữ lịch sử run (thứ mà xoá sẽ mất), mà người đọc vẫn thấy ngay case nào không còn hiệu lực.
 *
 * HAI CHIỀU, giống bản Xray:
 *   Excel KHÔNG còn TC → case trên AIO chuyển Deprecated
 *   TC quay lại Excel   → case đang Deprecated được trả về Published  (tắt bằng --no-restore)
 *
 * MẶC ĐỊNH DRY-RUN. Không đụng case của story khác: phạm vi lấy theo `--story` (jiraRequirementIDs)
 * hoặc `--folder-root`, đúng cách `pull_testcases_aio.js` khoanh vùng.
 *
 * Dùng:
 *   node scripts/integrations/aio/deprecate_stale_aio.js --story <JIRA-KEY> --file <x.xlsx>
 *   ... --apply
 */

const path = require('path');
const { AioClient } = require('./aio_client');
const { parseXlsx } = require(path.resolve(__dirname, '..', '..', 'lib', 'testcase'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);

const tcIdOf = (t) => String(t.id || (t._cells && (t._cells['TC ID'] || t._cells['TC_ID'])) || '').toUpperCase();

/** Đổi Jira issue KEY → id số (AIO lưu id trong jiraRequirementIDs, không lưu key). */
async function jiraIssueId(key) {
  const base = (process.env.JIRA_BASE_URL || process.env.JIRA_URL || '').replace(/\/$/, '');
  const auth = 'Basic ' + Buffer.from(`${process.env.JIRA_EMAIL || process.env.JIRA_USER_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
  const r = await fetch(`${base}/rest/api/3/issue/${key}?fields=summary`, { headers: { Authorization: auth, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Jira trả ${r.status} khi đọc ${key}.`);
  return String((await r.json()).id);
}

async function main() {
  const STORY = arg('story', process.env.JIRA_STORY_KEY || '');
  const ROOT = arg('folder-root', '');
  const FILE = arg('file') || arg('excel') || arg('xlsx');
  if (!FILE) { console.error('ERROR: cần --file <x.xlsx> (Excel canonical hiện hành).'); process.exit(2); }
  if (!STORY && !ROOT) { console.error('ERROR: cần --story <JIRA-KEY> hoặc --folder-root <tên> để khoanh phạm vi.'); process.exit(2); }

  const aio = new AioClient();
  const cfg = (await aio.call('GET', '/config')).json || {};
  const caseStatus = Object.fromEntries((cfg.caseStatuses || []).map((s) => [String(s.name).toLowerCase(), s.ID]));
  const DEPRECATED = caseStatus.deprecated;
  const PUBLISHED = caseStatus.published;
  if (!DEPRECATED || !PUBLISHED) { console.error('ERROR: /config không có caseStatuses Published/Deprecated — dừng để khỏi ghi bừa.'); process.exit(1); }

  const doc = await parseXlsx(path.resolve(FILE));
  const inExcel = new Set((doc.tests || []).map(tcIdOf).filter(Boolean));

  const all = await aio.list('/testcase');
  let scope = all;
  if (ROOT) {
    const folders = await aio.folderMap('testcase');
    const pathById = {}; Object.entries(folders).forEach(([p, id]) => { pathById[id] = p; });
    scope = scope.filter((c) => String(pathById[(c.folder || {}).ID] || '').split('/')[0] === ROOT);
  } else {
    const id = await jiraIssueId(STORY);
    scope = scope.filter((c) => (c.jiraRequirementIDs || []).map(String).includes(id));
  }
  if (!scope.length) { console.error('ERROR: không thấy case nào trong phạm vi — kiểm --story/--folder-root.'); process.exit(2); }

  const stale = scope.filter((c) => c.automationKey && !inExcel.has(String(c.automationKey).toUpperCase()) && (c.status || {}).ID !== DEPRECATED);
  const back = flag('no-restore') ? []
    : scope.filter((c) => c.automationKey && inExcel.has(String(c.automationKey).toUpperCase()) && (c.status || {}).ID === DEPRECATED);
  const orphanExcel = [...inExcel].filter((k) => !scope.some((c) => String(c.automationKey).toUpperCase() === k));

  console.log(`Excel : ${path.basename(FILE)} · ${inExcel.size} TC`);
  console.log(`AIO   : ${scope.length} case trong phạm vi ${STORY || ROOT}`);
  console.log(`→ chuyển Deprecated : ${stale.length}${stale.length ? ' · ' + stale.slice(0, 8).map((c) => c.automationKey).join(', ') : ''}`);
  console.log(`→ trả về Published  : ${back.length}${back.length ? ' · ' + back.slice(0, 8).map((c) => c.automationKey).join(', ') : ''}`);
  if (orphanExcel.length) console.log(`ⓘ ${orphanExcel.length} TC có trong Excel mà CHƯA có trên AIO → chạy \`npm run aio:publish:apply\`: ${orphanExcel.slice(0, 8).join(', ')}`);
  if (!stale.length && !back.length) { console.log('\nKhông có gì phải đổi.'); return; }
  if (!flag('apply')) { console.log('\n[DRY-RUN] chưa ghi gì. Thêm --apply.'); return; }

  let ok = 0; let failed = 0;
  for (const [c, statusId, label] of [...stale.map((c) => [c, DEPRECATED, 'Deprecated']), ...back.map((c) => [c, PUBLISHED, 'Published'])]) {
    const r = await aio.mergePut(`/testcase/${c.key}/detail`, { status: { ID: statusId } });
    if (r.status < 300) { ok++; console.log(`  ✓ ${c.key} [${c.automationKey}] → ${label}`); } else { failed++; console.log(`  ✗ ${c.key}: HTTP ${r.status} ${String(r.text).slice(0, 100)}`); }
    await aio.pause();
  }
  console.log(`\nXONG: ${ok} đổi trạng thái · ${failed} lỗi`);

  // Tự đối soát: đọc LẠI từ AIO, không tin số lệnh.
  const after = await aio.list('/testcase');
  const stillStale = stale.filter((c) => {
    const now = after.find((x) => x.key === c.key);
    return now && (now.status || {}).ID !== DEPRECATED;
  });
  console.log(`ĐỐI SOÁT: ${stale.length - stillStale.length}/${stale.length} case đã sang Deprecated · ${stillStale.length === 0 ? '✓ ĐỦ' : `✗ SÓT ${stillStale.length}`}`);
  if (failed || stillStale.length) process.exitCode = 1;
}

main().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
