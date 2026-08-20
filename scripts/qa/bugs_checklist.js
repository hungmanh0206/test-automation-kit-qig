#!/usr/bin/env node
'use strict';

/*
 * bugs_checklist.js — biến `knowledge/bugs/` thành CHECKLIST lúc SINH CASE (chiều §20 Error Guessing).
 *
 * VÌ SAO CÓ FILE NÀY: đo 20/08/2026 — kho có 58 bug thật, nhưng nơi DUY NHẤT đọc nó ở khâu sinh case là
 * `phase1_00_scope_planning.md`, và chỉ để **nâng risk** cho module hay vỡ. Không prompt nào bắt "mỗi lỗi
 * từng xảy ra phải có TC canh". Lỗi đã lọt một lần thì đường lọt đó còn mở tới khi có case đứng canh —
 * đây là kỹ thuật error-guessing dựa trên lỗi THẬT của chính sản phẩm, không phải lý thuyết.
 *
 * Never-auto: chỉ đọc, in ra màn hình. Không sinh case, không sửa file — người/agent đọc rồi tự quyết.
 *
 * Dùng:
 *   npm run bugs:checklist -- --module "Tạo Add-on Order"
 *   npm run bugs:checklist -- --task SAPP-24395     ·     --tag checkout     ·     --all
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);

const norm = (s) => String(s || '').normalize('NFC').toLowerCase().trim();
// `jira_status` này = bug KHÔNG có thật ⇒ sinh case canh nó là tự tạo case sai.
const REJECTED = /reject|duplicate|won'?t ?fix|not ?a ?bug|cancel/i;

function load() {
  const dir = path.join(rc.REPO_ROOT, 'knowledge', 'bugs');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (j && j.bug) out.push({ file: f, ...j });
    } catch (e) { console.warn(`[bugs] bỏ qua ${f}: ${e.message}`); }
  }
  return out;
}

function main() {
  const all = load();
  if (!all.length) { console.log('[bugs] knowledge/bugs/ chưa có entry nào — chiều §20 ghi "N/A: chưa có bug lịch sử".'); return; }

  const mod = arg('module');
  const task = arg('task');
  const tag = arg('tag');
  let list = all;
  if (mod) list = list.filter((b) => norm(b.module).includes(norm(mod)));
  if (task) list = list.filter((b) => norm(b.task_key) === norm(task));
  if (tag) list = list.filter((b) => (b.tags || []).some((t) => norm(t).includes(norm(tag))));

  if (!mod && !task && !tag && !flag('all')) {
    // Không có bộ lọc thì in BẢN ĐỒ module để người chọn — in thẳng 58 bug là không ai đọc.
    const by = {};
    for (const b of all) { const k = b.module || '(không module)'; (by[k] = by[k] || []).push(b); }
    console.log(`[bugs] ${all.length} bug lịch sử · ${Object.keys(by).length} module. Chọn một module để soi:\n`);
    Object.entries(by).sort((a, b) => b[1].length - a[1].length).forEach(([k, v]) => {
      const live = v.filter((b) => !REJECTED.test(String(b.jira_status || ''))).length;
      console.log(`  ${String(v.length).padStart(3)} bug (${live} còn hiệu lực)  ${k}`);
    });
    console.log('\n  → npm run bugs:checklist -- --module "<tên>"   (hoặc --task / --tag / --all)');
    console.log('  Module càng nhiều bug = vùng ĐÃ CHỨNG MINH là dễ vỡ ⇒ ưu tiên sinh case ở đó trước.');
    return;
  }

  if (!list.length) { console.log(`[bugs] không có bug nào khớp bộ lọc — chiều §20 ghi "N/A: module chưa có bug lịch sử".`); return; }

  const live = list.filter((b) => !REJECTED.test(String(b.jira_status || '')));
  const dead = list.filter((b) => REJECTED.test(String(b.jira_status || '')));

  console.log(`[bugs] ${list.length} bug khớp${mod ? ` · module "${mod}"` : ''}${task ? ` · task ${task}` : ''}${tag ? ` · tag ${tag}` : ''}`);
  console.log(`       ${live.length} còn hiệu lực (PHẢI quy về 1 trong 3 kết cục) · ${dead.length} đã bác bỏ (KHÔNG sinh case canh)\n`);

  live.forEach((b, i) => {
    console.log(`${String(i + 1).padStart(3)}. ${b.bug}`);
    const meta = [b.module, b.task_key, b.jira_status, (b.tags || []).filter((t) => t !== '(unmapped)').join('/')].filter(Boolean);
    console.log(`     ${meta.join(' · ')}`);
  });

  if (dead.length) {
    console.log(`\n  ĐÃ BÁC BỎ (${dead.length}) — canh một thứ không phải lỗi là tự tạo case sai:`);
    dead.forEach((b) => console.log(`     ✗ ${String(b.bug).slice(0, 96)} [${b.jira_status}]`));
  }

  console.log('\n  Mỗi bug còn hiệu lực phải có MỘT kết cục, không được bỏ trống:');
  console.log('    1) đã có TC canh  → ghi TC ID đối chiếu, đừng sinh trùng');
  console.log('    2) chưa có        → sinh case [BugHistory], expected bám TRIỆU CHỨNG đã xảy ra');
  console.log('    3) không còn áp dụng → ghi lý do vào Coverage Gaps');
  console.log('  Và hỏi thêm: "LỚP lỗi này còn chỗ nào khác cũng dính?" — bug cũ là ví dụ, không phải case.');
}

main();
