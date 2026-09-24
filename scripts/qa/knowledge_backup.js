#!/usr/bin/env node
'use strict';

/*
 * knowledge_backup.js — sao lưu / khôi phục các store knowledge KHÔNG NẠP LẠI ĐƯỢC.
 *
 * VÌ SAO CẦN (đo 14/08/2026): bảng "nạp lại" trong knowledge/SCHEMA.md đặt hai thứ KHÁC LOẠI cạnh nhau.
 *   `bugs/` ← `learn:bugs:apply` là NGUỒN MÁY: mất file thì query Backlog lại là có.
 *   `domain/ system/ decisions/ setup_recipes/ environment/ locators/` ← "ghi tay từ FSD/BA/dev" thì KHÔNG
 *   phải nạp lại — là LÀM LẠI CÔNG SỨC NGƯỜI. Không nguồn máy nào trả lại được.
 * Và cả `knowledge/**` đều bị gitignore (mirror GitHub là public) ⇒ 15 file đắt nhất của kit hiện tồn tại
 * trên ĐÚNG MỘT máy, không remote nào có. Hôm nay 15 file; sau 6 tháng là hàng trăm business rule đã được BA
 * xác nhận. Đây là việc phải làm TRƯỚC khi tích luỹ, vì sau thì không sửa được.
 *
 * ĐÍCH SAO LƯU PHẢI Ở NGOÀI REPO. Script TỪ CHỐI ghi vào trong repo — backup nằm cùng chỗ với bản gốc thì
 * không phải backup, và tệ hơn: nó tạo nguy cơ commit chính dữ liệu vừa quyết định không commit.
 * Trỏ `KNOWLEDGE_BACKUP_DIR` tới: thư mục Drive/OneDrive đồng bộ · working copy của private repo · ổ ngoài.
 *
 * Dùng:
 *   KNOWLEDGE_BACKUP_DIR=<dir ngoài repo> npm run knowledge:backup
 *   npm run knowledge:backup -- --out <dir>
 *   npm run knowledge:backup -- --verify <bundle.json>     # so bundle với hiện trạng
 *   npm run knowledge:backup -- --restore <bundle.json>    # CHỈ ghi file còn THIẾU, không đè
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const KNOW = path.join(rc.REPO_ROOT, 'knowledge');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };

// CHỈ những store ghi tay. Cố ý BỎ `bugs/` (Backlog), `historical_execution/` (`learn --scan`), `metrics/` (sinh
// khi chạy test), `index.json` (artifact sinh ra) — sao lưu thứ nạp lại được chỉ làm bundle phình và làm mờ
// thông điệp "đây là những thứ mất là mất thật".
const STORES = ['domain', 'system', 'decisions', 'setup_recipes', 'environment', 'locators'];
const SINGLE_FILES = ['bug_tc_map.json'];

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

function collect() {
  const items = [];
  for (const store of STORES) {
    const dir = path.join(KNOW, store);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const rel = `${store}/${f}`;
      const content = fs.readFileSync(path.join(dir, f), 'utf8');
      items.push({ rel, sha: sha(content), content });
    }
  }
  for (const f of SINGLE_FILES) {
    const p = path.join(KNOW, f);
    if (!fs.existsSync(p)) continue;
    const content = fs.readFileSync(p, 'utf8');
    items.push({ rel: f, sha: sha(content), content });
  }
  return items;
}

// ── VERIFY ─────────────────────────────────────────────────────────────────────────────────────────────
const verifyPath = arg('verify', '');
if (verifyPath) {
  const b = JSON.parse(fs.readFileSync(path.resolve(verifyPath), 'utf8'));
  const now = new Map(collect().map((i) => [i.rel, i.sha]));
  const old = new Map((b.items || []).map((i) => [i.rel, i.sha]));
  const missing = [...old.keys()].filter((k) => !now.has(k));        // có trong bundle, MẤT ở hiện trạng
  const added = [...now.keys()].filter((k) => !old.has(k));          // mới, bundle chưa có
  const changed = [...now.keys()].filter((k) => old.has(k) && old.get(k) !== now.get(k));
  console.log(`[kb] bundle ${b.created_at} · ${(b.items || []).length} file · hiện trạng ${now.size} file`);
  if (missing.length) console.log(`[kb] ⚠ MẤT ở hiện trạng (${missing.length}): ${missing.join(', ')} → khôi phục bằng --restore`);
  if (added.length) console.log(`[kb] mới chưa sao lưu (${added.length}): ${added.join(', ')} → chạy backup lại`);
  if (changed.length) console.log(`[kb] đã sửa sau lần sao lưu (${changed.length}): ${changed.join(', ')} → chạy backup lại`);
  if (!missing.length && !added.length && !changed.length) console.log('[kb] ✓ bundle KHỚP hiện trạng.');
  process.exit(missing.length ? 1 : 0);
}

// ── RESTORE ────────────────────────────────────────────────────────────────────────────────────────────
const restorePath = arg('restore', '');
if (restorePath) {
  const b = JSON.parse(fs.readFileSync(path.resolve(restorePath), 'utf8'));
  let written = 0; const skipped = [];
  for (const it of b.items || []) {
    const dest = path.join(KNOW, it.rel);
    // KHÔNG ĐÈ. Bản trên đĩa có thể mới hơn bundle; đè là mất công sức mới nhất — đúng loại hỏng không ai
    // nhìn thấy. File đã có mà khác nội dung thì chỉ BÁO, để người quyết định.
    if (fs.existsSync(dest)) {
      if (sha(fs.readFileSync(dest, 'utf8')) !== it.sha) skipped.push(`${it.rel} (đã có, nội dung KHÁC bundle)`);
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, it.content, 'utf8');
    written += 1;
    console.log(`  + ${it.rel}`);
  }
  console.log(`[kb] khôi phục ${written} file còn thiếu · bỏ qua ${skipped.length} file đã có`);
  for (const s of skipped) console.log(`  ~ ${s}`);
  if (written) console.log('[kb] Kế tiếp: `npm run domain:index` · `system:index` · `decisions --index` · `howto:index` để dựng lại index.json.');
  process.exit(0);
}

// ── BACKUP ─────────────────────────────────────────────────────────────────────────────────────────────
let out = arg('out', process.env.KNOWLEDGE_BACKUP_DIR || '');
if (!out) {
  console.error('[kb] ✗ CHƯA có đích sao lưu. Đặt `KNOWLEDGE_BACKUP_DIR` (hoặc `--out <dir>`) trỏ tới chỗ NGOÀI repo:');
  console.error('      thư mục Drive/OneDrive đồng bộ · working copy của private repo · ổ ngoài.');
  console.error('[kb]   Không đặt mặc định vì mọi mặc định trong repo đều KHÔNG phải backup (mất máy là mất cả hai).');
  process.exit(2);
}
out = path.resolve(out);
const rel = path.relative(rc.REPO_ROOT, out);
if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
  console.error(`[kb] ✗ TỪ CHỐI ghi vào trong repo: ${out}`);
  console.error('[kb]   Backup nằm cùng chỗ bản gốc thì không phải backup, và tạo nguy cơ commit đúng dữ liệu đã quyết định không commit.');
  process.exit(2);
}

const items = collect();
if (!items.length) { console.error('[kb] ✗ không có record ghi tay nào để sao lưu — kiểm lại knowledge/.'); process.exit(2); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const bundle = {
  kind: 'qa-kit-knowledge-backup',
  version: 1,
  created_at: new Date().toISOString(),
  repo: path.basename(rc.REPO_ROOT),
  _note: 'CHỈ chứa store GHI TAY (không nạp lại được từ nguồn máy). bugs/ historical_execution/ metrics/ CỐ Ý không có: nạp lại được. Đây là DỮ LIỆU NỘI BỘ — giữ ở nơi riêng tư, đừng đưa lên repo public.',
  stores: STORES,
  items,
};
fs.mkdirSync(out, { recursive: true });
const file = path.join(out, `knowledge-backup-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify(bundle, null, 2), 'utf8');

const byStore = {};
for (const i of items) { const k = i.rel.includes('/') ? i.rel.split('/')[0] : '(root)'; byStore[k] = (byStore[k] || 0) + 1; }
console.log(`[kb] ✓ ${items.length} file ghi tay → ${file}`);
console.log(`[kb]   ${Object.entries(byStore).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
console.log('[kb]   Kiểm lại: npm run knowledge:backup -- --verify "' + file + '"');
