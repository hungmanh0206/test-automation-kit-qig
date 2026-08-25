#!/usr/bin/env node
'use strict';

/*
 * sync_gitlab.js — đẩy `main` sang nhánh GitLab, TRỪ những đường dẫn khai trong
 * `.agent/config/gitlab_strip.json`.
 *
 * VÌ SAO CÓ FILE NÀY: nhánh GitLab cố ý không chứa vài file mà `main` có ⇒ tree hai bên phân kỳ VĨNH VIỄN.
 * Cho tới 24/08/2026 việc sync làm bằng tay (`read-tree` + `commit-tree` gõ từng lần). Cách đó hỏng theo
 * kiểu tệ nhất: quên strip MỘT lần là file quay lại nhánh GitLab và không ai biết — không có gì báo.
 * Script này biến quy trình đó thành một lệnh, và biến danh sách strip thành CẤU HÌNH đọc được.
 *
 * NGUYÊN TẮC:
 *   - KHÔNG merge cây của GitLab vào `main`. Tree đẩy lên = tree của `main` (trừ phần strip), hai cha là
 *     `origin/main` + `main` để lịch sử liền và lần sau vẫn fast-forward được.
 *   - KHÔNG chạm index/working-tree thật: dùng `GIT_INDEX_FILE` tạm.
 *   - Mục strip thiếu `why` ⇒ CHẶN. Đường dẫn khai mà `main` KHÔNG có ⇒ CHẶN (config đã lạc hậu, và strip
 *     một thứ không tồn tại là dấu hiệu ai đó đổi cấu trúc mà không sửa config).
 *
 * Dùng:
 *   npm run sync:gitlab            # xem trước (dry-run): sẽ strip gì, đẩy lên đâu
 *   npm run sync:gitlab -- --push  # thực thi
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const CFG = path.join(REPO, '.agent', 'config', 'gitlab_strip.json');
const REMOTE = process.env.GITLAB_REMOTE || 'origin';
const BRANCH = process.env.GITLAB_BRANCH || 'main';
const PUSH = process.argv.includes('--push');

const git = (args, env = {}) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', env: { ...process.env, ...env } }).trim();

function main() {
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch (e) {
    console.error(`[sync-gitlab] ✗ không đọc được ${path.relative(REPO, CFG)}: ${e.message}`);
    process.exit(2);
  }
  const strip = Array.isArray(cfg.strip) ? cfg.strip : [];
  const noWhy = strip.filter((s) => !String(s.why || '').trim());
  if (noWhy.length) {
    console.error(`[sync-gitlab] ✗ ${noWhy.length} mục strip KHÔNG có \`why\`: ${noWhy.map((s) => s.path).join(', ')}`);
    console.error('[sync-gitlab]   Strip im lặng là cách mất dấu quyết định — ghi lý do rồi chạy lại.');
    process.exit(2);
  }

  // `main` phải THẬT SỰ có những đường dẫn đó, nếu không thì config đã lạc hậu.
  const inMain = new Set(git(['ls-tree', '-r', '--name-only', BRANCH]).split('\n'));
  const missing = strip.filter((s) => !inMain.has(s.path));
  if (missing.length) {
    console.error(`[sync-gitlab] ✗ ${missing.length} đường dẫn khai strip nhưng \`${BRANCH}\` KHÔNG có: ${missing.map((s) => s.path).join(', ')}`);
    console.error('[sync-gitlab]   Ai đó đã đổi/xoá file mà không sửa config ⇒ dừng, để không strip nhầm thứ khác.');
    process.exit(2);
  }

  git(['fetch', REMOTE, BRANCH]);
  const localHead = git(['rev-parse', BRANCH]);
  const remoteHead = git(['rev-parse', `${REMOTE}/${BRANCH}`]);

  /*
   * Dựng tree = tree của `main` trừ phần strip, trong một index TẠM (không chạm index thật).
   */
  const tmpIndex = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sync-gitlab-')), 'index');
  const env = { GIT_INDEX_FILE: tmpIndex };
  git(['read-tree', BRANCH], env);
  for (const s of strip) git(['rm', '--cached', '-q', '--ignore-unmatch', '--', s.path], env);
  const tree = git(['write-tree'], env);

  const sameAsRemote = tree === git(['rev-parse', `${REMOTE}/${BRANCH}^{tree}`]);
  console.log(`[sync-gitlab] ${BRANCH}=${localHead.slice(0, 7)} · ${REMOTE}/${BRANCH}=${remoteHead.slice(0, 7)}`);
  console.log(`[sync-gitlab] strip ${strip.length} đường dẫn khỏi nhánh ${REMOTE}:`);
  for (const s of strip) console.log(`  - ${s.path} — ${s.why}`);
  console.log(`[sync-gitlab] tree sẽ đẩy: ${tree.slice(0, 7)}${sameAsRemote ? ' (GIỐNG remote — không có gì để đẩy)' : ''}`);

  if (sameAsRemote) { console.log('[sync-gitlab] ✓ remote đã đúng trạng thái mong muốn.'); return; }
  if (!PUSH) {
    console.log('[sync-gitlab] (dry-run) thêm `-- --push` để thực thi.');
    return;
  }

  const msg = [
    `merge: đồng bộ ${BRANCH} vào nhánh GitLab (strip ${strip.length} đường dẫn)`,
    '',
    `Tree = tree của \`${BRANCH}\` TRỪ ${strip.length} đường dẫn khai ở \`.agent/config/gitlab_strip.json\`.`,
    'Sinh bởi `npm run sync:gitlab -- --push` — không strip tay, nên không quên được.',
    '',
    ...strip.map((s) => `- ${s.path}: ${s.why}`),
  ].join('\n');
  const commit = git(['commit-tree', tree, '-p', `${REMOTE}/${BRANCH}`, '-p', BRANCH, '-m', msg]);
  git(['push', REMOTE, `${commit}:refs/heads/${BRANCH}`]);
  git(['fetch', REMOTE, BRANCH]);

  const after = git(['rev-parse', `${REMOTE}/${BRANCH}^{tree}`]);
  if (after !== tree) { console.error('[sync-gitlab] ✗ tree remote sau push KHÔNG khớp — kiểm tra bằng tay.'); process.exit(1); }
  const stillThere = strip.filter((s) => {
    // stdio 'ignore': `cat-file -e` in "fatal: path ... does not exist" ra stderr khi file KHÔNG có —
    // đó chính là kết quả MONG MUỐN, nên đừng để nó hiện ra như lỗi.
    try {
      execFileSync('git', ['cat-file', '-e', `${REMOTE}/${BRANCH}:${s.path}`], { cwd: REPO, stdio: 'ignore' });
      return true;
    } catch (e) { return false; }
  });
  if (stillThere.length) { console.error(`[sync-gitlab] ✗ vẫn còn trên remote: ${stillThere.map((s) => s.path).join(', ')}`); process.exit(1); }
  console.log(`[sync-gitlab] ✓ đã đẩy ${commit.slice(0, 7)} · remote sạch ${strip.length}/${strip.length} đường dẫn strip.`);
}

/*
 * Lỗi mạng/VPN là ca THƯỜNG XUYÊN với GitLab self-hosted (port 22 chỉ mở trong VPN). Ném stack trace Node
 * ra là bắt người đọc dò giữa 20 dòng `execFileSync` để hiểu "chưa bật VPN". Dịch thành câu người đọc được,
 * và giữ exit code khác 0 để script gọi nó vẫn biết là thất bại.
 */
if (require.main === module) {
  try {
    main();
  } catch (e) {
    const msg = `${e.message || ''}${e.stderr || ''}`;
    if (/Could not read from remote repository|Connection timed out|Could not resolve hostname|port 22/i.test(msg)) {
      console.error('[sync-gitlab] ✗ KHÔNG tới được GitLab (port 22). Nguyên nhân thường gặp: chưa bật VPN.');
      console.error('[sync-gitlab]   Kiểm nhanh: `ssh -T git@gitlab.sapp.edu.vn` — đúng thì in "Welcome to GitLab".');
      console.error('[sync-gitlab]   Chưa có gì được đẩy; chạy lại đúng lệnh này sau khi có mạng.');
      process.exit(3);
    }
    console.error(`[sync-gitlab] ✗ ${e.message}`);
    if (e.stderr) console.error(String(e.stderr).trim().split(String.fromCharCode(10)).slice(0, 6).join(String.fromCharCode(10)));
    process.exit(1);
  }
}
module.exports = { main };
