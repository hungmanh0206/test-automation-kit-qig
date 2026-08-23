#!/usr/bin/env node
'use strict';

/*
 * json_check.js — kiểm MỌI file .json ĐANG ĐƯỢC TRACK có parse được không.
 *
 * VÌ SAO CÓ FILE NÀY: cả 2 CI trước đây hardcode đúng 3 đường dẫn, trong đó có `knowledge/index.json`.
 * Commit `2d383e1` bỏ track `knowledge/**` (dữ liệu công ty, đối xử như `.env`) ⇒ từ lúc đó job `static`
 * ĐỎ ở mọi lần push vì ENOENT, không liên quan gì tới nội dung được push. Danh sách viết tay là thứ mục
 * rỗng: file mới thêm thì không ai kiểm, file bị bỏ track thì CI đỏ oan.
 *
 * Cách đo thay thế: hỏi git xem đang track những .json nào rồi parse hết. Tự cập nhật theo repo, và
 * KHÔNG bao giờ trỏ vào dữ liệu không-track (`knowledge/` · `profiles/` · `outputs/`).
 *
 * Đếm 0 file cũng là ĐỎ: nghĩa là phép đo hỏng (không có git, sai cwd), không phải "mọi thứ đều ổn".
 *
 * Dùng: npm run json:check
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');

function trackedJson() {
  const out = execFileSync('git', ['ls-files', '-z', '*.json'], { cwd: REPO, encoding: 'utf8' });
  return out.split('\0').filter(Boolean);
}

function main() {
  let files;
  try {
    files = trackedJson();
  } catch (e) {
    console.error(`[json] ✗ không hỏi được git đang track gì (${e.message}) ⇒ KHÔNG kết luận "đạt".`);
    process.exit(2);
  }

  if (!files.length) {
    console.error('[json] ✗ 0 file .json được track — phép đo hỏng (sai cwd? repo trống?), không phải "sạch".');
    process.exit(2);
  }

  const bad = [];
  for (const f of files) {
    const p = path.join(REPO, f);
    if (!fs.existsSync(p)) { bad.push([f, 'được track nhưng KHÔNG có trên đĩa']); continue; }
    try { JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { bad.push([f, e.message]); }
  }

  if (bad.length) {
    console.error(`[json] ✗ ${bad.length}/${files.length} file .json KHÔNG parse được:`);
    for (const [f, why] of bad) console.error(`  - ${f}: ${why}`);
    console.error('[json]   JSON hỏng ở config = gate đọc nó sẽ chết giữa phase, hoặc tệ hơn: bị bắt lỗi rồi bỏ qua âm thầm.');
    process.exit(1);
  }
  console.log(`[json] ✓ ${files.length} file .json được track đều parse được.`);
}

if (require.main === module) main();
module.exports = { trackedJson };
