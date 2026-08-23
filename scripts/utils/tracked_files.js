#!/usr/bin/env node
'use strict';

/*
 * tracked_files.js — MỘT nguồn cho câu hỏi "repo này đang có những file nào".
 *
 * VÌ SAO CÓ FILE NÀY (bài học đã trả giá BA lần): `git ls-files` là cách đúng để chỉ lấy file ĐÃ TRACK,
 * nhưng nó CHẾT khi không có `.git` — chạy từ bản giải nén ZIP, từ artifact CI, từ thư mục copy. Lần đầu
 * `secret_scan.js` gặp và tự vá bằng fallback working-tree. Rồi 23/08/2026 tôi viết `json_check.js` và
 * `ci_scope_check.js` — cả hai lặp lại đúng lỗi đó (`ci_scope_check` thì CRASH hẳn, stack trace thô).
 * Bài học nằm trong MỘT file nên không lan sang file mới; nay nó nằm ở đây và ai cũng dùng chung.
 *
 * HAI CHẾ ĐỘ, và người gọi PHẢI biết mình đang ở chế độ nào:
 *   - `git`      : chỉ file đã track. Đây là ngữ nghĩa đúng cho gate nói về "file được commit".
 *   - `worktree` : mọi file trên đĩa (trừ thư mục nặng/generated). Rộng hơn ⇒ mọi luật kiểu "file này KHÔNG
 *                  ĐƯỢC track" sẽ BÁO OAN, vì ở chế độ này không phân biệt được track hay chưa.
 * Vì vậy hàm trả về `mode` — gate nào có luật phụ thuộc "đã track" thì phải HẠ xuống cảnh báo khi
 * `mode === 'worktree'` (xem `ci_scope_check.js`).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/** Thư mục không bao giờ cần quét — nặng, sinh tự động, hoặc dữ liệu công ty. */
const SKIP_DIR = /^(node_modules|\.git|outputs|playwright-report|test-results|reports|\.claude|dist|build|coverage|profiles|knowledge)$/;

/**
 * @param {object} o
 * @param {string} o.root            thư mục gốc repo
 * @param {string[]} [o.patterns]    pathspec cho `git ls-files` (vd ['*.json'])
 * @param {RegExp} [o.filter]        lọc ở CHẾ ĐỘ FALLBACK (đường dẫn dùng dấu `/`)
 * @returns {{ files: string[], mode: 'git'|'worktree' }}
 */
function listFiles({ root, patterns = [], filter = null }) {
  try {
    const out = execFileSync('git', ['ls-files', '-z', ...patterns], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    const files = out.split('\0').filter(Boolean).map((p) => p.replace(/\\/g, '/'));
    // 0 file KHÔNG chắc là "repo rỗng": có thể pathspec không khớp gì. Cứ trả về, người gọi tự phán.
    return { files, mode: 'git' };
  } catch (e) { /* không có .git / không có git trong PATH → fallback */ }

  const acc = [];
  (function walk(dir, rel) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (err) { return; }
    for (const en of entries) {
      const childRel = rel ? `${rel}/${en.name}` : en.name;
      if (en.isDirectory()) { if (!SKIP_DIR.test(en.name)) walk(path.join(dir, en.name), childRel); continue; }
      if (!filter || filter.test(childRel)) acc.push(childRel);
    }
  })(root, '');
  return { files: acc, mode: 'worktree' };
}

/** Câu cảnh báo dùng chung — để 3 gate nói CÙNG một điều, không ai tự diễn đạt khác. */
function worktreeNotice(label) {
  return `[${label}] ⚠ không dùng được \`git ls-files\` (không có .git? chạy từ ZIP/artifact?) → quét WORKING-TREE. `
    + 'Danh sách rộng hơn bản đã-track, nên luật kiểu "file này không được track" chỉ còn là cảnh báo.';
}

module.exports = { listFiles, worktreeNotice, SKIP_DIR };
