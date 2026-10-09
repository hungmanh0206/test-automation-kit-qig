#!/usr/bin/env node
/**
 * unit_stamp_check.js — mọi verdict ĐÃ CHẠY phải khai ĐƠN VỊ đã đo.
 *
 * ===================================================================================================
 * VÌ SAO
 * ===================================================================================================
 *
 * Đo trên CSDL-9003 ngày 09/10/2026: artifact của MỘT task trải trên ÍT NHẤT BỐN đơn vị khác nhau, và
 * không chỗ nào trong verdict ghi lại —
 *
 *   · TEST 1 (1700001001) · Phú Thọ        → bản đồ field + `docs/form-that-vs-dac-ta.md`
 *   · Đức Trí - Minh Khai (74000831) · HCM → `profiles/<TASK>/task.env`, CSDL_HS_TC_011, TC_004
 *   · TH Võ Thị Sáu (79764417)             → CSDL_HS_TC_009 (chỉ biết nhờ người viết tay vào comment)
 *   · Elite (0100000001) · Hà Nội          → `_hs_form_reader.js` tự đăng nhập vào
 *
 * Hậu quả đo được: kỳ vọng "đúng 10 trường bắt buộc" rút ra ở TEST 1, trong khi case chạy ở Đức Trí —
 * nơi form có 31 trường mang mốc đỏ. Case vẫn PASS. Không máy nào thấy, vì không có chỗ nào để thấy.
 *
 * Đây KHÔNG phải lỗi của người chạy. Hợp đồng `testcase-status.json` xưa nay là
 * `{ tcId, status, comment, failedStep?, evidence?[], carriedOver? }` — không có ô nào cho đơn vị, nên
 * ai nhớ thì viết vào `comment`, ai quên thì mất. Thông tin quyết định mà nằm trong văn xuôi tuỳ hứng
 * thì đó là chỗ trống của hợp đồng, không phải của người.
 *
 * Luật: verdict có `executed: true` trong `verdict_taxonomy.json` (PASS · FAIL · PASS_WITH_DEVIATION ·
 * SUSPECT_REAL_BUG · OBSERVATION · EXPANSION_FINDING) PHẢI kèm `donVi`. Verdict chưa chạy (SKIP · TODO ·
 * BLOCKED_SETUP · SKIP_SETUP) thì không đòi — chưa chạm app thì không có đơn vị nào để khai.
 *
 * ===================================================================================================
 * DÙNG
 * ===================================================================================================
 *
 *   node scripts/qa/unit_stamp_check.js --task <TASK_KEY> [--project-output outputs/<P>] [--enforce]
 *
 * Không `--enforce` thì luôn exit 0 (báo cáo). Có `--enforce` thì thiếu dấu là CHẶN.
 * Bản thường để chạy trên bộ dữ liệu CŨ mà không làm đỏ task đang chạy dở; bật `--enforce` khi đã dọn xong.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const taxonomy = require(path.resolve(__dirname, '../../.agent/config/verdict_taxonomy.json'));

function tham(ten, macDinh = null) {
  const i = process.argv.indexOf(ten);
  if (i === -1) return macDinh;
  const v = process.argv[i + 1];
  if (!v || v.startsWith('--')) throw new Error(`Thiếu giá trị cho ${ten}`);
  return v;
}

const TASK = tham('--task', process.env.TASK_KEY);
const OUT = tham('--project-output', process.env.PROJECT_OUTPUT_DIR || 'outputs/CSDL');
const ENFORCE = process.argv.includes('--enforce');

if (!TASK) {
  console.error('[unit-stamp] Thiếu --task <TASK_KEY> (hoặc env TASK_KEY).');
  process.exit(2);
}

const duong = path.resolve(OUT, 'tasks', TASK, 'test-results', 'testcase-status.json');
if (!fs.existsSync(duong)) {
  console.error(`[unit-stamp] Không thấy ${duong}`);
  process.exit(ENFORCE ? 1 : 0);
}

const data = JSON.parse(fs.readFileSync(duong, 'utf8'));
const tests = Array.isArray(data.tests) ? data.tests : Object.values(data.tests || {});

/** Verdict nào tính là ĐÃ CHẠY — lấy từ taxonomy, không gán cứng danh sách ở đây. */
const daChay = new Set(
  Object.entries(taxonomy.statuses)
    .filter(([, v]) => v && v.executed === true)
    .map(([k]) => k),
);

/*
 * Chấp nhận dấu đơn vị ở `donVi` (hợp đồng mới). KHÔNG dò trong `comment`: comment là văn xuôi tự do,
 * dò chữ trong đó đúng là cái bệnh đã sinh ra vấn đề này — và một `comment` nhắc tên trường vì lý do
 * khác sẽ cho dương tính giả.
 */
const thieu = [];
const co = [];
const chuaChay = [];

for (const t of tests) {
  if (!t || !t.tcId) continue;
  const st = String(t.status || '').toUpperCase();
  if (!daChay.has(st)) { chuaChay.push(t.tcId); continue; }
  if (t.donVi && String(t.donVi).trim()) co.push({ tcId: t.tcId, donVi: String(t.donVi).trim() });
  else thieu.push({ tcId: t.tcId, status: st });
}

console.log(`[unit-stamp] ${TASK} — ${tests.length} case trong status`);
console.log(`[unit-stamp]   đã chạy, CÓ dấu đơn vị : ${co.length}`);
console.log(`[unit-stamp]   đã chạy, THIẾU dấu     : ${thieu.length}`);
console.log(`[unit-stamp]   chưa chạy (không đòi)  : ${chuaChay.length}`);

if (co.length) {
  const nhom = new Map();
  for (const x of co) nhom.set(x.donVi, (nhom.get(x.donVi) || 0) + 1);
  console.log('');
  console.log('[unit-stamp] Đơn vị đã khai:');
  for (const [d, n] of [...nhom].sort((a, b) => b[1] - a[1])) console.log(`               ${String(n).padStart(4)}  ${d}`);
  if (nhom.size > 1) {
    console.log('');
    console.log(`[unit-stamp] ⚠ Task này có verdict từ ${nhom.size} đơn vị khác nhau. Không tự nó là lỗi,`);
    console.log('             nhưng kỳ vọng rút ra ở đơn vị này mà áp cho đơn vị kia thì sai mẫu số —');
    console.log('             đã xảy ra ở CSDL-9003 ("đúng 10 trường bắt buộc" đo ở TEST 1, case chạy ở Đức Trí).');
  }
}

if (thieu.length) {
  console.log('');
  console.log(`[unit-stamp] Thiếu dấu (${thieu.length}) — 15 case đầu:`);
  for (const x of thieu.slice(0, 15)) console.log(`               ${x.tcId.padEnd(18)} ${x.status}`);
  if (thieu.length > 15) console.log(`               … còn ${thieu.length - 15} case nữa`);
  console.log('');
  console.log('[unit-stamp] Cách sửa: thêm `donVi` vào từng bản ghi trong testcase-status.json, ví dụ');
  console.log('             "donVi": "Thành phố Hồ Chí Minh · Trường TH-THCS-THPT Đức Trí - Minh Khai (74000831)"');
}

if (ENFORCE && thieu.length) {
  console.log('');
  console.log('[unit-stamp] ✗ CHẶN: verdict đã chạy mà không khai đơn vị thì không tái lập được, và không');
  console.log('             đối chiếu được với bản đồ field/đặc tả của đúng đơn vị đó.');
  process.exit(1);
}

console.log('');
console.log(thieu.length ? '[unit-stamp] (bản thường — không chặn; bật --enforce khi đã dọn xong)' : '[unit-stamp] ✓ mọi verdict đã chạy đều khai đơn vị.');
process.exit(0);
