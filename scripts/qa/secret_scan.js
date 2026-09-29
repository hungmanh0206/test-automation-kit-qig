#!/usr/bin/env node
'use strict';

/*
 * secret_scan.js (F7) — quet secret bi commit nham tren cac file DA TRACK trong git.
 * Self-contained (khong can gitleaks/binary ngoai). Pattern high-signal, it false-positive;
 * bo qua file .example/placeholder + binary. CHAN (exit 1) neu thay secret that.
 *
 * Dung: node scripts/qa/secret_scan.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

// Luật secret khai ở `lib/secret_patterns.js` — MỘT NGUỒN, dùng chung với `package_kit.js`.
const { PATTERNS, CRED_FILE, CRED_CONTENT } = require(require('path').resolve(__dirname, 'lib', 'secret_patterns'));
const SKIP = /(\.example($|\.)|example\.env|\.md$|\.png$|\.jpg$|\.jpeg$|\.webp$|\.gif$|\.pdf$|\.zip$|\.xlsx$|\.ico$|package-lock\.json$)/i;
/*
 * `&lt;...&gt;` là CHÍNH `<...>` sau khi HTML-escape. Thiếu vế đó thì cùng một dòng placeholder bị bỏ qua
 * trong file `.md` nhưng lại bị báo trong file `.html`. Đo 19/09/2026 khi quét 4.925 blob lịch sử: đúng 2
 * phát hiện, cả hai là `CRM_ACCESS_TOKEN=&lt;TEST_PRIVATE_APP_ACCESS_TOKEN&gt;` trong HTML xuất ra.
 */
const PLACEHOLDER = /your[-_]?|<[^>]+>|&lt;[^&\s]+&gt;|xxx+|placeholder|example|changeme|process\.env|\$\{?[A-Z_]/i;
const BINARY = /\x00/;

const SKIP_DIR = /^(node_modules|\.git|outputs|playwright-report|test-results|reports|\.claude|dist|build|coverage)$/;

// Danh sách file để quét: ưu tiên git ls-files (chỉ file đã track); KHÔNG có .git (vd chạy từ ZIP)
// → fallback quét working-tree, bỏ thư mục nặng/generated.
const { listFiles: sharedList, worktreeNotice: sharedNotice } = require(path.resolve(__dirname, '..', 'utils', 'tracked_files'));
// Dùng CHUNG helper (23/08/2026): bản copy cũ ở đây là lý do bài học không lan sang json_check/ci_scope_check.
function trackedFiles() {
  const r = sharedList({ root: rc.REPO_ROOT, filter: /./ });
  if (r.mode === 'worktree') console.warn(sharedNotice('secret-scan'));
  return r.files;
}
function _trackedFilesLegacy() {
  try {
    const out = execSync('git ls-files', { cwd: rc.REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const files = out.split(/\r?\n/).filter(Boolean);
    if (files.length) return files;
  } catch (e) { /* không có .git → fallback bên dưới */ }
  console.warn('[secret-scan] không dùng được git ls-files (không .git?) → fallback quét working-tree.');
  const acc = [];
  (function walk(dir, rel) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!SKIP_DIR.test(e.name)) walk(path.join(dir, e.name), childRel); }
      else acc.push(childRel);
    }
  })(rc.REPO_ROOT, '');
  return acc;
}

const findings = [];
for (const rel of trackedFiles()) {
  if (SKIP.test(rel)) continue;
  const abs = path.join(rc.REPO_ROOT, rel);
  let content;
  try {
    const st = fs.statSync(abs);
    if (st.size > 2 * 1024 * 1024) continue;
    content = fs.readFileSync(abs, 'utf8');
  } catch (e) { continue; }
  if (BINARY.test(content)) continue;
  content.split(/\r?\n/).forEach((line, i) => {
    for (const p of PATTERNS) {
      const m = p.re.exec(line);
      if (!m) continue;
      // Hai luật "gán giá trị" là luật SUY ĐOÁN theo hình dạng, nên phải lọc bản mẫu/placeholder.
      // Các luật còn lại nhận diện chuỗi không thể xuất hiện hợp lệ, không cần lọc.
      if ((p.name === 'generic-secret-assign' || p.name === 'env-assign-unquoted') && PLACEHOLDER.test(line)) continue;
      findings.push({ file: rel, line: i + 1, pattern: p.name, snippet: m[0].slice(0, 6) + '***' });
    }
  });
}

/*
 * CREDENTIAL NẰM TRONG CÂY REPO — dù KHÔNG bị track. `.gitignore` chỉ bảo vệ GIT: nó không bảo vệ khi ai đó
 * zip thư mục, copy sang máy khác, hay upload artifact chứa cả cây. Đo 23/08/2026: chạy gate này ở bản
 * giải nén (chế độ working-tree) thì nó bắt được `scripts/integrations/google_doc/service_account.json`
 * kèm `private_key` — file gitignore đúng, nhưng vẫn đi theo mọi bản ZIP.
 * Nên kiểm SỰ TỒN TẠI theo TÊN FILE, độc lập với việc track hay chưa, và luôn chạy ở cả 2 chế độ.
 * Cách đúng: để credential NGOÀI repo (vd `~/.qa-keys/<tên>/`) rồi trỏ bằng biến env đường dẫn TUYỆT ĐỐI.
 */
/*
 * Khớp TÊN rồi XÁC NHẬN NỘI DUNG. Chỉ tên là không đủ: `.*-key.json` bắt luôn
 * `knowledge/system/sap-sync__dealid-key.json` (một record nghiệp vụ) ⇒ báo oan ngay lần chạy đầu, mà gate
 * báo oan một lần là mất uy tín vĩnh viễn. Nội dung phải có dấu hiệu credential thật.
 */
const credOnDisk = [];
(function walkCred(dir, rel) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const en of entries) {
    const childRel = rel ? `${rel}/${en.name}` : en.name;
    if (en.isDirectory()) { if (!SKIP_DIR.test(en.name)) walkCred(path.join(dir, en.name), childRel); continue; }
    if (!CRED_FILE.test(en.name)) continue;
    let body = '';
    try { body = fs.readFileSync(path.join(dir, en.name), 'utf8'); } catch (e) { continue; }
    if (CRED_CONTENT.test(body)) credOnDisk.push(childRel);
  }
})(rc.REPO_ROOT, '');

if (credOnDisk.length) {
  console.error(`[secret-scan] ✗ ${credOnDisk.length} file credential nằm TRONG cây repo (dù có gitignore hay không):`);
  for (const f of credOnDisk) console.error('  - ' + f);
  console.error('  -> .gitignore KHONG bao ve khi zip/copy/artifact. Chuyen ra ngoai repo (vd ~/.qa-keys/<ten>/)');
  console.error('     roi tro bang bien env duong dan TUYET DOI (xem .env.example o goc repo).');
  process.exit(1);
}

if (!findings.length) { console.log('[secret-scan] OK — khong thay secret bi commit tren file da track.'); process.exit(0); }
console.error('[secret-scan] Nghi co secret bi commit (' + findings.length + '):');
for (const f of findings) console.error('  - ' + f.file + ':' + f.line + ' [' + f.pattern + '] ' + f.snippet);
console.error('  -> Go secret khoi file + rotate key, dua vao .env (da gitignore). KHONG commit secret.');
process.exit(1);
