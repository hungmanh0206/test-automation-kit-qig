#!/usr/bin/env node
'use strict';
/*
 * expansion_audit.js — ĐO ĐỘ PHỦ 5 TRỤC trên MỌI task đã execute, để quyết định siết gate bằng SỐ.
 *
 * VÌ SAO CÓ FILE NÀY: câu hỏi "siết check #10 thành chặn thì đỏ bao nhiêu" không trả lời được bằng cảm tính.
 * Đo 19/08/2026 trên 9 task (1014 case, 382 case band high): chỉ 1 task đủ 5 artefact, 7 task 0/5. Quan trọng
 * hơn: task "đủ 5/5" đó có 3/7 báo cáo `proven=0` — nghĩa là chấm theo "có file hay không" sẽ dạy cả hệ thống
 * CHẠM VÀO FILE CHO CÓ. Chính con số đó đã bác bỏ phương án siết ban đầu và đổi sang: chặn "chưa lập kế hoạch"
 * (rẻ, buộc quyết định) + chặn `proven=0` ở 4 báo cáo TRỤC (hiện đỏ 0/9 — luật PHÒNG, không dọn nợ).
 *
 * Dùng LẠI depth.bandOf và ĐÚNG bộ glob của self_review #10 — đo bằng luật khác với luật sẽ áp là đo vô nghĩa.
 *
 * Dùng: node scripts/qa/expansion_audit.js        (quét toàn bộ outputs/)
 */
const fs = require('fs');
const path = require('path');
const REPO = process.argv[2] || path.resolve(__dirname, '..', '..');
const depth = require(path.join(REPO, 'scripts/lib/expansion/depth.js'));
const canonical = require(path.join(REPO, 'scripts/lib/testcase'));
// Thư mục testcase lấy từ MỘT nguồn (runtime_config) — ghép tay ở đây là tự tạo lại đúng lỗi mà
// check "thêm nguồn mới không được làm script đếm thiếu" sinh ra để chống.
const { getTestcaseDirs } = require(path.join(REPO, 'scripts/utils/runtime_config.js'));

const glob1 = (dir, rx) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => rx.test(f)) : []);

/** Bản sao NGUYÊN VĂN cách self_review #10 xét "trục đã chạy chưa". */
function axesRan(taskDir) {
  const resDir = path.join(taskDir, 'test-results');
  const repDir = path.join(taskDir, 'reports');
  return {
    field: glob1(resDir, /^conformance/).some((d) => fs.existsSync(path.join(resDir, d, 'conformance_report.json'))),
    reverse: glob1(repDir, /spec-gap/i).length > 0,
    surface: glob1(repDir, /cross-surface/i).length > 0,
    persist: glob1(repDir, /persist|probe/i).length > 0,
    fixture: glob1(repDir, /fixture-matrix/i).length > 0,
  };
}

/** Báo cáo tồn tại nhưng proven=0 thì KHÔNG tính là đã soi (self_review cũng bắt điểm này). */
function provenZero(taskDir) {
  const repDir = path.join(taskDir, 'reports');
  const out = [];
  for (const f of glob1(repDir, /cross-surface|persist|probe|fixture-matrix|spec-gap/i)) {
    const m = fs.readFileSync(path.join(repDir, f), 'utf8').match(/<!--\s*gate:\s*proven=(\d+)/);
    if (m && Number(m[1]) === 0) out.push(f);
  }
  return out;
}

async function readCases(taskDir) {
  const byId = new Map();
  for (const d of getTestcaseDirs(taskDir)) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => /\.xlsx$/i.test(x))) {
      try {
        const doc = await canonical.parseXlsx(path.join(d, f));
        for (const t of doc.tests || []) {
          /*
           * `tcId` là tên trường của model canonical. Bản trước đọc `t.id` — một trường KHÔNG tồn tại — nên
           * map luôn rỗng, MỌI case báo `unknown`, và mọi dòng "NẾU SIẾT TIẾP" hiện 0/6 đỏ. Một máy đo RỖNG
           * mà kết quả lại trông yên tâm là lớp lỗi tệ nhất: nó được dùng để quyết định có siết gate hay không.
           * Giữ `t.id` và `_cells` làm đường lùi cho bản Excel cũ không qua parser canonical.
           */
          const id = String(t.tcId || t.id || (t._cells && (t._cells['TC ID'] || t._cells['TC_ID'])) || '').toUpperCase();
          if (id && !byId.has(id)) byId.set(id, t);
        }
      } catch { /* file hỏng → bỏ qua, không làm hỏng cả phép đo */ }
    }
  }
  return byId;
}

function readExecuted(taskDir) {
  const p = path.join(taskDir, 'test-results', 'testcase-status.json');
  if (!fs.existsSync(p)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    const list = Array.isArray(raw) ? raw : (raw.tests || []);
    return list.filter((t) => /^(PASS|FAIL)/i.test(String(t.status || '').trim()))
      .map((t) => String(t.tcId || '').toUpperCase()).filter(Boolean);
  } catch { return []; }
}

(async () => {
  const rows = [];
  const outputs = path.join(REPO, 'outputs');
  for (const proj of fs.readdirSync(outputs)) {
    const tasksDir = path.join(outputs, proj, 'tasks');
    if (!fs.existsSync(tasksDir)) continue;
    for (const task of fs.readdirSync(tasksDir)) {
      const taskDir = path.join(tasksDir, task);
      if (!fs.statSync(taskDir).isDirectory()) continue;
      const executed = readExecuted(taskDir);
      if (!executed.length) continue;                       // chưa execute thì không nằm trong phạm vi luật
      const cases = await readCases(taskDir);
      const bands = { high: 0, medium: 0, low: 0, unknown: 0 };
      for (const id of executed) {
        const tc = cases.get(id);
        if (!tc) { bands.unknown += 1; continue; }
        bands[depth.bandOf(tc)] += 1;
      }
      const ran = axesRan(taskDir);
      const hasPlan = glob1(path.join(taskDir, 'reports'), /expansion-plan/i).length > 0;
      rows.push({ task, executed: executed.length, ...bands, ran, hasPlan, ranCount: Object.values(ran).filter(Boolean).length, provenZero: provenZero(taskDir) });
    }
  }

  rows.sort((a, b) => b.executed - a.executed);
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('TASK', 14) + pad('exec', 6) + pad('high', 6) + pad('med', 5) + pad('low', 5) + pad('?', 5) + pad('trục đã chạy', 14) + 'chi tiết');
  console.log('-'.repeat(96));
  for (const r of rows) {
    const names = Object.entries(r.ran).filter(([, v]) => v).map(([k]) => k).join(',') || '—';
    console.log(pad(r.task, 14) + pad(r.executed, 6) + pad(r.high, 6) + pad(r.medium, 5) + pad(r.low, 5) + pad(r.unknown, 5) + pad(`${r.ranCount}/5`, 14) + names);
  }

  // ĐANG ÁP trong self_review #10 — hai luật này phải khớp với code ở đó, không thì phép đo vô nghĩa.
  const LIVE = {
    'chưa lập kế hoạch (CHẶN)': (r) => r.high > 0 && !r.hasPlan,
    'artefact proven=0 (CHẶN)': (r) => r.provenZero.length > 0,
  };
  // CHƯA áp — để cân nhắc siết tiếp khi hai luật trên đã thành nếp.
  const NEXT = {
    'có case high mà 0/5 trục': (r) => r.high > 0 && r.ranCount === 0,
    'bắt buộc trục ③ persist': (r) => r.high > 0 && !r.ran.persist,
  };
  const show = (title, V) => {
    console.log(`\n${title} (trên ${rows.length} task đã execute):`);
    for (const [k, f] of Object.entries(V)) {
      const red = rows.filter(f);
      console.log(`  ${String(k).padEnd(26)} ${red.length}/${rows.length} đỏ` + (red.length ? ` → ${red.map((r) => r.task).join(', ')}` : ''));
    }
  };
  show('LUẬT ĐANG ÁP', LIVE);
  show('NẾU SIẾT TIẾP', NEXT);
  console.log('\nⓘ "Đỏ" ở đây là ảnh chụp THÓI QUEN quá khứ. Gate chỉ bắn lúc finalize của task ĐANG chạy —');
  console.log('  task cũ không finalize lại, nên số này không phải là số task sẽ vỡ.');
  const pz = rows.filter((r) => r.provenZero.length);
  if (pz.length) console.log('\nBáo cáo có nhưng proven=0 (artefact rỗng nghĩa): ' + pz.map((r) => `${r.task}(${r.provenZero.join('/')})`).join(' · '));
  const totalHigh = rows.reduce((s, r) => s + r.high, 0);
  console.log(`\nTổng: ${rows.reduce((s, r) => s + r.executed, 0)} case đã execute · ${totalHigh} case band high · ${rows.reduce((s, r) => s + r.unknown, 0)} case không tra được band (không thấy trong Excel canonical).`);
})().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
