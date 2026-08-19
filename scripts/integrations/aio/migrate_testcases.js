#!/usr/bin/env node
'use strict';

/*
 * migrate_testcases.js — chuyển testcase sang AIO, LẤY CẤU TRÚC FOLDER TỪ TEST REPOSITORY CỦA XRAY.
 *
 * Khác `publish_testcases_aio.js` (dựng folder từ tên sheet Excel): script này coi **Test Repository
 * của Xray là cấu trúc chuẩn** — đó là cây mà team thật sự tổ chức và nhìn thấy hằng ngày, còn tên
 * sheet Excel chỉ là cách nhóm lúc soạn thảo.
 *
 *   Xray  → danh sách test + `folder.path`  (chuẩn cho CẤU TRÚC và TÊN folder)
 *   Excel → nội dung case                    (steps/expected/precondition/priority — canonical của kit)
 *   ghép theo TIÊU ĐỀ; đo thực tế 1396/1399 = 99,8%. Test không khớp vẫn tạo, phần nội dung để trống
 *   và automationKey lấy Jira key của test (để lần sau vẫn dedup được).
 *
 * MẶC ĐỊNH DRY-RUN — AIO không có API xoá case.
 *
 * Dùng:
 *   node scripts/integrations/aio/migrate_testcases.js --task <JIRA-KEY> [--apply]
 *   node scripts/integrations/aio/migrate_testcases.js --all [--apply] [--tasks A,B,C]
 */

const fs = require('fs');
const path = require('path');
const { AioClient } = require('./aio_client');
const { XrayCloudClient } = require(path.resolve(__dirname, '..', 'jira', 'xray_cloud'));
const { parseXlsx } = require(path.resolve(__dirname, '..', '..', 'lib', 'testcase'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);
const APPLY = flag('apply');
const PROJECT = process.env.JIRA_PROJECT_KEY || 'SAPP';
const OUT_ROOT = arg('outputs', 'outputs');

const PRIORITY = { critical: 1, high: 2, medium: 3, low: 4, lowest: 5 };
const typeOf = (folderPath) => (/\bapi\b/i.test(folderPath) ? 4 : /security|permission/i.test(folderPath) ? 6 : 3);
const norm = (s) => String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
const lineText = (x) => (typeof x === 'string' ? x : (x && (x.text || x.value || x.line)) || '');

/** Ký tự thay thế U+FFFD = phản hồi bị hỏng UTF-8 (không phải nội dung thật của testcase). */
const MOJIBAKE = /�/;

/**
 * Test của 1 task trên Xray, có phân trang (API chặn cứng 100/lần → không phân trang là mất dữ liệu).
 *
 * CÓ RETRY VÌ HỎNG MÃ HOÁ: Xray GraphQL THỈNH THOẢNG trả UTF-8 hỏng ở tiêu đề tiếng Việt
 * ("vượt"→"vư<?><?><?>t", "≤"→"<?><?>"). Tiêu đề hỏng thì không khớp Excel → rơi vào nhánh dự phòng
 * lấy Jira key làm automationKey → TẠO BẢN TRÙNG (đã xảy ra: 4 case rác). Gặp U+FFFD thì gọi lại;
 * vẫn hỏng sau vài lần thì báo to để người xử lý, KHÔNG lặng lẽ tạo trùng.
 */
async function xrayTests(xray, task) {
  const out = [];
  for (let start = 0; ; start += 100) {
    let res = [];
    let total = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      const d = await xray.graphql(
        'query($jql: String, $s: Int) { getTests(jql: $jql, limit: 100, start: $s) { total results { issueId folder { path } jira(fields:["key","summary","labels"]) } } }',
        { jql: `project = ${PROJECT} AND issuetype = Test AND labels = 'task-${task}'`, s: start },
      );
      res = (d && d.getTests && d.getTests.results) || [];
      total = (d && d.getTests && d.getTests.total) || 0;
      // Kiểm CẢ tiêu đề LẪN đường dẫn folder: hỏng ở path thì tạo ra folder gốc rác
      // (đã xảy ra: 1 folder "…ghi nh<?><?><?>n…" song song với folder thật).
      const bad = res.filter((t) => MOJIBAKE.test(t.jira.summary) || MOJIBAKE.test((t.folder && t.folder.path) || ''));
      if (!bad.length) break;
      if (attempt === 2) {
        console.log(`      ⚠ ${bad.length} bản ghi vẫn hỏng mã hoá sau 3 lần gọi — sẽ tạo case/folder RÁC:`);
        bad.slice(0, 3).forEach((t) => console.log(`         ${t.jira.key} "${String(t.jira.summary).slice(0, 46)}" @ ${String((t.folder && t.folder.path) || '').slice(-40)}`));
      }
    }
    out.push(...res);
    if (!res.length || out.length >= total) break;
  }
  return out;
}

/**
 * Gộp mọi Excel canonical của task → 2 map tra cứu. Bỏ `from-xray/` (bản kéo về, không phải nguồn).
 *
 * VÌ SAO KHÔNG KHOÁ THEO MỖI TIÊU ĐỀ: nhiều bộ dùng LẠI cùng một tiêu đề ở các nhóm khác nhau —
 * vd "[Positive] Hủy — chọn No → không xóa" có ở 6 loại order (Gia hạn/Chuyển đổi/Chuyển nhượng/…).
 * Khoá theo tiêu đề trần thì 6 test Xray cùng tra về 1 dòng Excel → cùng automationKey → GHI ĐÈ nhau
 * (đã xảy ra: mất 11 case). Khoá chính là `nhóm||tiêu đề` — nhóm chức năng của Excel trùng tên với
 * folder lá của Xray; `byTitle` chỉ còn là lối dự phòng khi tên nhóm hai bên lệch nhau.
 */
async function excelMaps(task) {
  const dir = path.join(process.cwd(), OUT_ROOT, 'lms-operations-automation', 'tasks', task, 'test-cases');
  const byGroupTitle = {}; const byTitle = {}; const titleCount = {}; const byTcId = {};
  if (!fs.existsSync(dir)) return { byGroupTitle, byTitle, titleCount, byTcId };
  for (const f of fs.readdirSync(dir)) {
    if (!/\.xlsx$/i.test(f)) continue;
    try {
      const doc = await parseXlsx(path.join(dir, f));
      doc.tests.forEach((t) => {
        byGroupTitle[`${norm(t.group)}||${norm(t.title)}`] = t;
        byTitle[norm(t.title)] = t;
        titleCount[norm(t.title)] = (titleCount[norm(t.title)] || 0) + 1;
        const id = t.id || (t._cells && t._cells['TC ID']);
        if (id) byTcId[String(id).toUpperCase()] = t;
      });
    } catch (e) { console.log(`      ⚠ không đọc được ${f}: ${e.message.slice(0, 60)}`); }
  }
  return { byGroupTitle, byTitle, titleCount, byTcId };
}

/** TC ID nhúng trong nhãn Xray `tc-<tc_id>` — danh tính CHÍNH XÁC, không phụ thuộc tiêu đề. */
function tcIdFromLabels(labels) {
  const lb = (labels || []).find((l) => /^tc-/i.test(l));
  return lb ? String(lb).slice(3).toUpperCase() : null;
}

/**
 * Tra dòng Excel cho 1 test Xray, theo thứ tự tin cậy giảm dần:
 *   1) nhãn `tc-<TC_ID>` — khoá thật, mỗi test một nhãn riêng (563 test = 563 nhãn phân biệt)
 *   2) nhóm + tiêu đề    — khi test chưa có nhãn
 *   3) tiêu đề, CHỈ KHI tiêu đề đó duy nhất trong Excel
 * Không khớp được thì trả null: thà để trống nội dung còn hơn gán nhầm sang case khác.
 */
function findExcelRow(maps, folderPath, title, labels) {
  const tc = tcIdFromLabels(labels);
  if (tc && maps.byTcId[tc]) return maps.byTcId[tc];
  const leaf = String(folderPath || '').split('/').filter(Boolean).pop() || '';
  const hit = maps.byGroupTitle[`${norm(leaf)}||${norm(title)}`];
  if (hit) return hit;
  if ((maps.titleCount[norm(title)] || 0) === 1) return maps.byTitle[norm(title)];
  return null;
}

/**
 * Map automationKey → case key, dùng để dedup.
 * Endpoint DANH SÁCH đã trả sẵn `automationKey` → KHÔNG gọi detail từng case (với 1.4k case và 10 task
 * thì cách kia là ~14.000 request thừa). Quét MỘT LẦN cho cả phiên, cập nhật dần khi tạo mới.
 */
async function buildDedupMap(aio) {
  const map = {};
  for (const c of await aio.list('/testcase')) if (c.automationKey) map[c.automationKey] = c.key;
  return map;
}

async function migrateTask(aio, xray, task, existing, touched) {
  const empty = { created: 0, updated: 0, failed: 0 };
  const tests = await xrayTests(xray, task);
  if (!tests.length) { console.log(`\n═══ ${task}: không có test trên Xray → bỏ qua`); return empty; }

  const maps = await excelMaps(task);
  const matched = tests.filter((t) => findExcelRow(maps, t.folder && t.folder.path, t.jira.summary, t.jira.labels)).length;
  const paths = [...new Set(tests.map((t) => (t.folder && t.folder.path) || '').filter(Boolean))];
  console.log(`\n═══ ${task} · ${tests.length} test · nội dung khớp Excel ${matched}/${tests.length} · ${paths.length} folder`);
  paths.slice(0, 4).forEach((p) => console.log(`      ${p}`));
  if (paths.length > 4) console.log(`      … và ${paths.length - 4} folder nữa`);
  if (!APPLY) return empty;

  // 1) Dựng đúng cây folder của Xray — mọi cấp, giữ nguyên tên.
  for (const p of paths) {
    const segs = p.split('/').filter(Boolean);
    if (segs.length) await aio.ensureFolder('testcase', segs);
  }
  const folders = await aio.folderMap('testcase');

  let created = 0; let updated = 0; let failed = 0; const errs = [];
  for (const [i, t] of tests.entries()) {
    const fpath = (t.folder && t.folder.path) || '';
    const folderKey = fpath.split('/').filter(Boolean).join('/');
    const src = findExcelRow(maps, fpath, t.jira.summary, t.jira.labels);
    const akey = (src && (src.id || (src._cells && src._cells['TC ID']))) || t.jira.key;
    const payload = {
      title: String(t.jira.summary || '').slice(0, 250),
      precondition: String((src && src.precondition) || ''),
      folder: folders[folderKey] ? { ID: folders[folderKey] } : undefined,
      priority: { ID: PRIORITY[String((src && src.priority) || '').toLowerCase()] || 3 },
      status: { ID: 3 },
      type: { ID: typeOf(fpath) },
      scriptType: { ID: 1 },
      automationStatus: { ID: 1 },
      automationKey: akey,
      jiraRequirementIDs: [task],
      steps: ((src && src.steps) || []).map((s, n) => ({
        step: lineText(s),
        data: n === 0 ? String((src && src.data) || '') : '',
        expectedResult: lineText(((src && src.expected) || [])[n]),
        stepType: 'TEXT',
      })).filter((s) => s.step),
    };
    if (touched) touched.add(akey);
    const key = existing[akey];
    const res = key
      ? await aio.mergePut(`/testcase/${key}/detail`, payload)
      : await aio.call('POST', '/testcase', payload);
    if (res.status < 300) {
      if (key) updated++; else { created++; if (res.json && res.json.key) existing[akey] = res.json.key; }
    } else { failed++; errs.push(`${akey}: HTTP ${res.status} ${String(res.text).slice(0, 90)}`); }
    if ((i + 1) % 25 === 0) process.stdout.write(`      ${i + 1}/${tests.length}\n`);
    await aio.pause();
  }
  console.log(`      TẠO ${created} · CẬP NHẬT ${updated} · LỖI ${failed}`);
  errs.slice(0, 3).forEach((e) => console.log(`      ✗ ${e}`));
  return { created, updated, failed };
}

const DEFAULT_TASKS = 'SAPP-3255,SAPP-13964,SAPP-14443,SAPP-15051,SAPP-18500,SAPP-21786,SAPP-23439,SAPP-24395,SAPP-26276,SAPP-26523';

async function main() {
  const aio = new AioClient();
  const xray = new XrayCloudClient({ clientId: process.env.XRAY_CLIENT_ID, clientSecret: process.env.XRAY_CLIENT_SECRET });
  await xray.authenticate();

  const tasks = flag('all') ? String(arg('tasks', DEFAULT_TASKS)).split(',') : [arg('task')];
  if (!tasks[0]) { console.error('ERROR: cần --task <JIRA-KEY> hoặc --all'); process.exit(2); }

  const existing = APPLY ? await buildDedupMap(aio) : {};
  if (APPLY) console.log(`Đã có trên AIO: ${Object.keys(existing).length} case (dedup theo automationKey)`);

  const total = { created: 0, updated: 0, failed: 0 };
  const touched = new Set();
  for (const t of tasks) {
    const r = await migrateTask(aio, xray, t.trim(), existing, touched);
    total.created += r.created; total.updated += r.updated; total.failed += r.failed;
  }
  console.log(`\n${APPLY ? 'TỔNG' : '[DRY-RUN] chưa ghi gì — thêm --apply'}: tạo ${total.created} · cập nhật ${total.updated} · lỗi ${total.failed}`);

  /*
   * TỰ ĐỐI SOÁT — KHÔNG tin vào "số lệnh thành công".
   * Đã dính hai lần: (1) hai lệnh ghi vào cùng một case do trùng automationKey, tổng lệnh vẫn đẹp mà
   * mất 11 case; (2) đếm theo tên folder trong khi lỗi cũng nằm ở tên folder. Nên bước này đếm lại
   * TRÊN AIO và nêu tên case không được lượt chạy này chạm tới (tàn dư của lượt trước / rác).
   */
  if (APPLY) {
    const all = await aio.list('/testcase');
    const stale = all.filter((c) => !touched.has(c.automationKey));
    console.log(`\nĐỐI SOÁT: AIO có ${all.length} case · lượt này ghi ${touched.size} · không chạm tới ${stale.length}`);
    if (stale.length) {
      console.log('  (case dưới đây không thuộc phạm vi migrate — kiểm rồi xoá TAY trên UI nếu là rác)');
      stale.slice(0, 20).forEach((c) => console.log(`   ${c.key.padEnd(12)} [${String(c.automationKey || '(rỗng)').padEnd(18)}] ${String(c.title).slice(0, 56)}`));
      if (stale.length > 20) console.log(`   … và ${stale.length - 20} case nữa`);
    }
  }
  if (total.failed) process.exitCode = 1;
}

main().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
