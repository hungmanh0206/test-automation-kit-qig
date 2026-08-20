#!/usr/bin/env node
'use strict';

/*
 * verify_mirror.js — AIO LÀ SOURCE OF TRUTH, nên execute KHÔNG được chạy trên bản kéo về đã CŨ.
 *
 * VẤN ĐỀ THẬT (chỗ thiết kế trước đây chỉ đúng một nửa): Phase 2 execute đọc mirror local
 * `test-cases/from-aio/*.xlsx` — nội dung đó là AIO **tại thời điểm pull**. Không có gì bảo đảm nó còn
 * khớp AIO lúc chạy: QA sửa expected trên AIO giữa buổi, hoặc người chạy quên `aio:pull:write` và dùng
 * mirror của mấy ngày trước. Khi đó verdict được chấm theo expected CŨ mà mọi thứ vẫn xanh — đúng loại
 * sai lặng lẽ mà kit cấm ("không phán được thì KHÔNG thành PASS").
 *
 * VÌ SAO KHÔNG GỌI API TỪNG CASE LÚC EXECUTE: đắt, mất khả năng chạy offline, và AIO khi quá tải trả
 * BODY RỖNG (không phải 429) nên gọi dày là tự bắn vào chân. Thay vào đó: pull ghi kèm MANIFEST
 * (automationKey → {key, updatedDate}), và trước execute đối soát manifest với MỘT lệnh list.
 * `updatedDate` có sẵn cho 1399/1399 case trong payload list (đã đo) nên phép so này chỉ tốn 1 lượt đọc.
 *
 * Dùng:
 *   node scripts/integrations/aio/verify_mirror.js                 # đối soát mirror của task hiện tại
 *   ... --enforce                                                  # lệch = exit 1 (dùng ở preflight/CI)
 * Không có manifest ⇒ báo rõ "chưa pull" chứ không im lặng cho qua.
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', '..', 'utils', 'runtime_config'));
const { AioClient } = require('./aio_client');

const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };

/** Đường dẫn manifest đi kèm mirror: cùng thư mục, cùng tên gốc + `.manifest.json`. */
function manifestPaths(taskOutDir) {
  const dir = path.join(taskOutDir, 'test-cases', 'from-aio');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.manifest.json')).map((f) => path.join(dir, f));
}

/**
 * So manifest với AIO hiện tại. Trả về danh sách lệch theo 3 loại — cố ý KHÔNG gộp thành một con số,
 * vì cách xử lý khác nhau: `changed` = phải pull lại; `missing` = case bị xoá/deprecate hoặc lọc khác;
 * `added` = có case mới thuộc phạm vi mà mirror chưa có (thiếu coverage).
 */
function diff(manifest, live) {
  const byKey = {};
  for (const c of live) if (c.automationKey) byKey[String(c.automationKey).toUpperCase()] = c;
  const changed = []; const missing = [];
  for (const [k, snap] of Object.entries(manifest.cases || {})) {
    const now = byKey[k];
    if (!now) { missing.push(k); continue; }
    if (String(now.updatedDate) !== String(snap.updatedDate)) {
      changed.push({ tc: k, key: now.key, was: snap.updatedDate, now: now.updatedDate });
    }
  }
  const inManifest = new Set(Object.keys(manifest.cases || {}));
  const scopeIds = (manifest.scope && manifest.scope.jiraRequirementIDs) || [];
  const added = Object.keys(byKey).filter((k) => !inManifest.has(k)
    && (!scopeIds.length || (byKey[k].jiraRequirementIDs || []).map(String).some((x) => scopeIds.includes(String(x)))));
  return { changed, missing, added };
}

async function main() {
  const taskOut = arg('task-output') || rc.getTaskOutputDir();
  const files = manifestPaths(taskOut);
  if (!files.length) {
    console.log('[mirror] KHÔNG có manifest trong test-cases/from-aio/ ⇒ chưa pull, hoặc pull bằng bản cũ.');
    console.log('[mirror]   Chạy `npm run aio:pull:write -- --story <KEY>` rồi đối soát lại. AIO là source of truth,');
    console.log('[mirror]   execute trên mirror không rõ tuổi = chấm verdict theo expected có thể đã cũ.');
    if (flag('enforce')) process.exit(1);
    return;
  }

  const aio = new AioClient({ throttleMs: Number(arg('throttle', 0)) || undefined });
  const live = await aio.list('/testcase');

  let bad = 0;
  for (const f of files) {
    const m = JSON.parse(fs.readFileSync(f, 'utf8'));
    const d = diff(m, live);
    const age = Math.round((Date.now() - Date.parse(m.pulledAt)) / 60000);
    const total = Object.keys(m.cases || {}).length;
    console.log(`\n[mirror] ${path.basename(f)} · pull ${m.pulledAt} (${age} phút trước) · ${total} case`);
    if (d.changed.length) {
      bad++;
      console.log(`[mirror] ✗ ${d.changed.length} case ĐÃ SỬA trên AIO sau khi pull:`);
      d.changed.slice(0, 8).forEach((c) => console.log(`    ${c.tc} (${c.key}) — AIO cập nhật ${new Date(Number(c.now)).toISOString()}`));
      if (d.changed.length > 8) console.log(`    … (+${d.changed.length - 8})`);
    }
    if (d.missing.length) { bad++; console.log(`[mirror] ✗ ${d.missing.length} case trong mirror KHÔNG còn thấy trên AIO: ${d.missing.slice(0, 8).join(', ')}`); }
    if (d.added.length) { bad++; console.log(`[mirror] ✗ ${d.added.length} case trên AIO thuộc phạm vi mà mirror CHƯA có: ${d.added.slice(0, 8).join(', ')}`); }
    if (!d.changed.length && !d.missing.length && !d.added.length) console.log('[mirror] ✓ mirror khớp AIO — execute trên bản này là đúng source of truth.');
  }

  if (bad) {
    console.log('\n[mirror] ⇒ Chạy `npm run aio:pull:write -- --story <KEY>` để lấy bản mới TRƯỚC khi execute.');
    if (flag('enforce')) process.exit(1);
  }
}

if (require.main === module) main().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
module.exports = { main, diff };
