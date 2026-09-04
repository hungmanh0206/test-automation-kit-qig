#!/usr/bin/env node
'use strict';

/*
 * version_check.js — CHẶN phát hành thiếu sót.
 *
 * VÌ SAO CẦN. Kit được phát cho nhiều dự án và sửa rất thường xuyên. Ba hệ quả của việc không có version:
 * không biết dự án nào đang ở bản nào (có bản vá quan trọng thì không có đường thông báo) · không có mốc để
 * quay lui · và bản phát ra không kèm câu trả lời cho câu hỏi duy nhất người nhận cần: **nâng bản này có phải
 * sửa gì trong lớp PROJECT không?** Chỉ MAJOR/MINOR nói được điều đó; ngày tháng thì không.
 *
 * QUY ƯỚC ĐÃ CHỐT (semver, bump theo LẦN PHÁT HÀNH chứ không theo commit — kit đang ~10 commit/ngày):
 *   MAJOR  dự án BUỘC phải sửa lớp PROJECT (đổi tên config, đổi hợp đồng script, bỏ npm script đang dùng)
 *   MINOR  thêm năng lực/gate; nâng lên là chạy được ngay
 *   PATCH  sửa lỗi, không đổi hợp đồng
 * CHANGELOG giữ nguyên định dạng cũ (ngày + nhóm chủ đề + "vấn đề → cách chữa"), chỉ thêm version vào tiêu đề.
 *
 * CHẠY ĐƯỢC TỪ ZIP KHÔNG CÓ `.git`. Đây không phải chi tiết phụ: người nhận kit giải nén rồi chạy gate, và
 * `ci_scope_check`/`secret_scan` từng crash đúng vì gọi git vô điều kiện. Mọi kiểm cần git ở đây đều
 * try/catch + bỏ qua, KHÔNG exit ≠ 0.
 *
 * Dùng: node scripts/qa/version_check.js [--tag v2.3.0]
 * Exit: 0 đạt · 1 có CHẶN · 2 dùng sai.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?$/;

/** Chạy git; KHÔNG có `.git` (hoặc không có git) thì trả null thay vì ném. */
function git(args) {
  try {
    return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    return null;
  }
}

const hasGit = fs.existsSync(path.join(REPO, '.git')) && git(['rev-parse', '--git-dir']) !== null;

/** Shared change theo RULE_GLOBAL §Shared Change Gate — đổi ở đây là ảnh hưởng MỌI story đang chạy. */
const SHARED_PATHS = ['playwright.config.js', 'package.json', 'scripts/', 'prompt_templates/', '.agent/', 'tests/support/'];

function main() {
  const argv = process.argv.slice(2);
  const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : ''; };
  const problems = [];
  const warnings = [];

  // 1) package.json phải có version hợp semver.
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')); } catch (e) {
    console.error(`[version] package.json không đọc được: ${e.message}`);
    process.exit(2);
  }
  const version = String(pkg.version || '');
  if (!version) problems.push('package.json THIẾU field `version` — không có version thì không phát hành được, và dự án không biết mình đang ở bản nào.');
  else if (!SEMVER.test(version)) problems.push(`version "${version}" không hợp semver (X.Y.Z).`);

  // 2) Nếu chạy từ tag: version phải KHỚP tag.
  const tag = arg('tag') || process.env.GITHUB_REF_NAME || process.env.CI_COMMIT_TAG || (hasGit ? git(['describe', '--exact-match', '--tags', 'HEAD']) : null) || '';
  if (tag) {
    const want = tag.replace(/^v/, '');
    if (want !== version) {
      problems.push(`tag "${tag}" ↔ package.json version "${version}" LỆCH. Phát hành với hai con số khác nhau thì mọi báo cáo lỗi về sau không tra được về đúng bản.`);
    } else {
      console.log(`[version] tag ${tag} khớp version ${version}`);
    }
  } else {
    console.log('[version] không chạy từ tag — bỏ qua kiểm khớp tag');
  }

  // 3) CHANGELOG phải có mục cho version này.
  const clPath = path.join(REPO, 'CHANGELOG.md');
  if (!fs.existsSync(clPath)) {
    problems.push('THIẾU CHANGELOG.md.');
  } else if (version) {
    const cl = fs.readFileSync(clPath, 'utf8');
    const hasEntry = new RegExp(`^##\\s.*v${version.replace(/\./g, '\\.')}(\\s|$|\\D)`, 'm').test(cl);
    if (!hasEntry) {
      problems.push(`CHANGELOG.md KHÔNG có mục cho v${version} — phát hành mà không ghi thay đổi = dự án nhận bản mới không biết đã đổi gì, và đó chính là lý do file CHANGELOG tồn tại. Thêm một mục dạng "## v${version} — <ngày> — <chủ đề>".`);
    }
  }

  // 4) CẢNH BÁO (không chặn): có shared change kể từ tag trước mà CHANGELOG chưa có mục mới.
  if (hasGit) {
    const prev = git(['describe', '--tags', '--abbrev=0', tag ? `${tag}^` : 'HEAD']);
    if (prev) {
      const changed = (git(['diff', '--name-only', `${prev}..HEAD`]) || '').split('\n').filter(Boolean);
      const shared = changed.filter((f) => SHARED_PATHS.some((p) => f === p || f.startsWith(p)));
      if (shared.length) {
        console.log(`[version] shared change kể từ ${prev}: ${shared.length} file`);
        const cl = fs.existsSync(clPath) ? fs.readFileSync(clPath, 'utf8') : '';
        if (version && !cl.includes(`v${version}`)) {
          warnings.push(`${shared.length} shared change kể từ ${prev} mà CHANGELOG chưa có mục v${version} (vd: ${shared.slice(0, 3).join(', ')}).`);
        }
      }
    }
  } else {
    console.log('[version] không có `.git` (chạy từ gói phát hành) — bỏ qua kiểm shared change');
  }

  console.log(`[version] ${version || '(chưa có)'} · ${problems.length} CHẶN · ${warnings.length} cảnh báo`);
  if (warnings.length) { console.log('\n[version] ⚠ Cảnh báo:'); warnings.forEach((w) => console.log(`  ~ ${w}`)); }
  if (!problems.length) { console.log('\n[version] ✓ ĐẠT'); process.exit(0); }
  console.log('\n[version] ✗ VI PHẠM:');
  problems.forEach((p) => console.log(`  - ${p}`));
  console.log('\n[version] BLOCK.');
  process.exit(1);
}

module.exports = { SEMVER, SHARED_PATHS };
if (require.main === module) main();
