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
const { listFiles, worktreeNotice } = require(path.resolve(__dirname, '..', 'utils', 'tracked_files'));

const REPO = path.resolve(__dirname, '..', '..');

/*
 * Không có `.git` (giải nén ZIP, artifact CI, thư mục copy) thì vẫn phải kiểm được: JSON hỏng vẫn hỏng dù
 * repo có git hay không. Chặn chỉ vì thiếu `.git` là chặn oan. Dùng chung `utils/tracked_files.js` để bài
 * học này không phải vá lần thứ tư ở script kế tiếp.
 */
function trackedJson() {
  return listFiles({ root: REPO, patterns: ['*.json'], filter: /\.json$/ });
}

function main() {
  const { files, mode } = trackedJson();
  if (mode === 'worktree') console.warn(worktreeNotice('json'));

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
  console.log(`[json] ✓ ${files.length} file .json ${mode === 'git' ? 'được track' : 'trên working-tree'} đều parse được.`);
}

if (require.main === module) main();
module.exports = { trackedJson };
