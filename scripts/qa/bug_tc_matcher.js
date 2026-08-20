#!/usr/bin/env node
'use strict';

/*
 * bug_tc_matcher.js — ĐỀ XUẤT (không tự ghi) TC canonical cho bug đang `module: "(unmapped)"`.
 *
 * VÌ SAO CẦN: `risk_score` LOẠI bug không có `module` khỏi bảng (xem risk_score.js §"(unmapped)"), nên bug
 * thiếu label TC = log rồi vẫn KHÔNG làm sâu thêm test lượt sau. Đo 14/08/2026 trên dự án đang chạy:
 * 22/53 bug rơi vào diện này ⇒ 42% lịch sử bug vô hình với risk.
 *
 * ĐÃ THỬ VÀ LOẠI 2 CÁCH:
 *   1. Suy module từ TIÊU ĐỀ bug — 9 ca "trông chắc", soi ra ≥4 sai rõ ràng. Module SAI tệ hơn "(unmapped)":
 *      nó bơm Likelihood cho module vô can VÀ vẫn để module thật mỏng.
 *   2. Bảng tra `label → module` — chấm trên 30 bug đã có module thật: 5/17 label ĐA NGHĨA, và các label
 *      đa nghĩa lại là loại phổ biến nhất (`be` trải 6 module, `re-verify`/`reopened` 3 module). Label trong
 *      thực tế là nhãn QUY TRÌNH (be/ux/re-verify) chứ không phải nhãn chức năng ⇒ không dùng làm map được.
 *
 * CÁCH NÀY KHÁC Ở ĐÂU: không suy ra module: đi tìm **TC có thật** phát biểu đúng hành vi mà bug phá. Ghép
 * được thì `tc_id` là bằng chứng (đọc TC là thấy), và `module` lấy theo TC nên không phải đoán. Ghép KHÔNG
 * được cũng là kết quả có giá trị: bug đó là **khoảng trống coverage** — không TC nào bảo vệ hành vi đó.
 *
 * Script CHỈ IN ĐỀ XUẤT. Việc chốt là của người: điền `knowledge/bug_tc_map.json` rồi chạy
 * `learn:bugs:apply` để backfill. Không có chế độ tự-ghi — đó là chủ ý, xem 2 cách bị loại ở trên.
 *
 * Dùng:
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/qa/bug_tc_matcher.js [--top 6] [--all] [--bug KEY]
 *     --all   chấm cả bug ĐÃ có module (để tự kiểm: TC đúng có nằm trong top-N không)
 */

const fs = require('fs');
const { getTestcaseDirs } = require('../utils/runtime_config');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const canonical = require(path.resolve(__dirname, '..', 'lib', 'testcase'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const TOP = parseInt(arg('top', '6'), 10) || 6;
const ALL = process.argv.includes('--all');
const ONE = arg('bug', '');
const TASK = arg('task', process.env.TASK_KEY || '');
const POD = process.env.PROJECT_OUTPUT_DIR || '';
const KNOW = path.join(rc.REPO_ROOT, 'knowledge');

if (!TASK || !POD) { console.error('[bug-tc] cần TASK_KEY + PROJECT_OUTPUT_DIR (TASK_ENV=profiles/<TASK>/task.env).'); process.exit(2); }
const taskDir = path.resolve(rc.REPO_ROOT, POD, 'tasks', TASK);

/** Bỏ dấu + hạ chữ để so khớp tiếng Việt không phụ thuộc cách gõ dấu. */
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Từ quá phổ biến trong MỌI testcase/bug (đúng ngữ pháp nhưng không phân biệt được gì) — giữ lại thì
// mọi TC đều "khớp" và bảng điểm thành vô nghĩa.
const STOP = new Set(norm(`
 va hoac cua cho khi thi la nhung cac mot hai ba tren duoi trong ngoai voi den tu ra vao neu thay vi
 he thong man hinh hien thi khong co duoc bang dung sai gia tri truong o nut chon bam mo xem kiem tra
 positive negative order ops user qa bug loi test case testcase step buoc ket qua mong doi hien tai
 tien dieu kien du lieu nhap luu bao gom tuong ung theo cung nhu do vi du apply
`).split(/\s+/).filter(Boolean));

const terms = (s) => {
  const out = new Map();
  for (const w of norm(s).split(/[^a-z0-9_]+/)) {
    if (w.length < 3 || STOP.has(w)) continue;
    out.set(w, (out.get(w) || 0) + 1);
  }
  return out;
};

// ── Nạp bộ testcase canonical ─────────────────────────────────────────────────────────────────────────
function loadCanonical() {
  const dirs = getTestcaseDirs(taskDir);   // 1 nguồn: test-cases/ + bản kéo về từ AIO (from-aio)
  // DEDUP theo tcId: `from-aio/` là bản mirror kéo về từ AIO của CÙNG bộ testcase, nên gộp cả hai thư mục
  // làm mỗi TC vào bảng 2 lần (đo: 550 bản ghi cho 530 TC). Hậu quả không nhìn thấy: một TC trùng chiếm
  // NHIỀU dòng trong top-N ⇒ đẩy ứng viên khác ra ngoài, và điểm bình chọn module bị nhân đôi lệch hẳn.
  // Thư mục đầu (`test-cases/`) là bản QA đang biên tập nên thắng.
  const byId = new Map();
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('~$') || f.startsWith('.~') || !f.endsWith('.md')) continue;   // .xlsx: parse là async
      try {
        const doc = canonical.parseMarkdown(fs.readFileSync(path.join(dir, f), 'utf8'));
        for (const t of doc.tests || []) if (t.tcId && !byId.has(t.tcId)) byId.set(t.tcId, t);
      } catch (e) { /* file không phải bảng testcase */ }
    }
  }
  return [...byId.values()];
}

const tests = loadCanonical();
if (!tests.length) { console.error('[bug-tc] không đọc được testcase canonical ở test-cases/*.md → không có gì để ghép.'); process.exit(2); }

// idf: từ xuất hiện ở ÍT TC thì mang nhiều thông tin hơn. Không có bước này thì các từ như "amount",
// "hubspot" (có ở hàng trăm TC) lấn hết những từ thật sự phân biệt như "clone" hay "cccd".
const df = new Map();
const docs = tests.map((t) => {
  const bag = terms(`${t.module} ${t.title} ${t.stepsRaw} ${t.expectedRaw} ${t.data}`);
  for (const w of bag.keys()) df.set(w, (df.get(w) || 0) + 1);
  return { t, bag };
});
const idf = (w) => Math.log(1 + tests.length / (1 + (df.get(w) || 0)));
const groupOf = (m) => String(m || '').split('/')[0].trim();

function rankWide(text, n) {
  const q = terms(text);
  const scored = docs.map(({ t, bag }) => {
    let s = 0;
    for (const [w, n] of q) if (bag.has(w)) s += idf(w) * Math.min(n, 3);
    return { tcId: t.tcId, module: groupOf(t.module), title: t.title, score: +s.toFixed(1) };
  }).sort((a, b) => b.score - a.score);
  // Bình chọn module trên top-20: nếu 1 module áp đảo thì tin được cả khi không chốt nổi 1 TC đơn lẻ.
  const votes = new Map();
  for (const r of scored.slice(0, 20)) votes.set(r.module, (votes.get(r.module) || 0) + r.score);
  const top = [...votes].sort((a, b) => b[1] - a[1]);
  const share = top.length && top[0][1] > 0 ? top[0][1] / top.reduce((a, b) => a + b[1], 0) : 0;
  return { list: scored.slice(0, n), leadModule: top[0] ? top[0][0] : null, leadShare: +(share * 100).toFixed(0), runnerUp: top[1] ? top[1][0] : null };
}
const rank = (text) => rankWide(text, TOP);

// ── Bug cần ghép ─────────────────────────────────────────────────────────────────────────────────────
const bugsDir = path.join(KNOW, 'bugs');
if (!fs.existsSync(bugsDir)) { console.error('[bug-tc] chưa có knowledge/bugs/ — chạy `learn:bugs:apply` trước.'); process.exit(2); }
let recs = fs.readdirSync(bugsDir).filter((f) => f.endsWith('.json'))
  .map((f) => ({ file: f, d: JSON.parse(fs.readFileSync(path.join(bugsDir, f), 'utf8')) }))
  .filter((r) => r.d && r.d.id);
if (ONE) recs = recs.filter((r) => r.d.id === ONE);
else if (!ALL) recs = recs.filter((r) => !r.d.tc_id);
recs.sort((a, b) => String(a.d.id).localeCompare(String(b.d.id)));

// Text bổ sung từ Jira description (nếu có cache). Tiêu đề một mình quá ngắn để ghép — chính vì vậy cách
// "suy từ tiêu đề" đã thất bại. `--desc-dir` cho phép nạp thêm mô tả đã lấy về sẵn (1 file .txt / bug key).
const DESC = arg('desc-dir', '');
const descOf = (id) => {
  if (!DESC) return '';
  const p = path.join(path.resolve(rc.REPO_ROOT, DESC), `${id}.txt`);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
};

console.log(`[bug-tc] ${tests.length} TC canonical · ${recs.length} bug cần ghép${DESC ? ` · mô tả từ ${DESC}` : ' · CHỈ tiêu đề (thêm --desc-dir để chính xác hơn)'}\n`);
const summary = [];
for (const { d } of recs) {
  const text = `${d.bug || ''} ${(d.tags || []).join(' ')} ${descOf(d.id)}`;
  const r = rank(text);
  summary.push({ id: d.id, lead: r.leadModule, share: r.leadShare, top: r.list[0] });
  console.log(`── ${d.id} ${d.tc_id ? `[đã có ${d.tc_id} → ${d.module}]` : ''}`);
  console.log(`   ${String(d.bug || '').slice(0, 100)}`);
  console.log(`   module áp đảo: ${r.leadModule} (${r.leadShare}%)${r.runnerUp ? ` · kế: ${r.runnerUp}` : ''}`);
  for (const c of r.list) console.log(`   ${String(c.score).padStart(6)}  ${c.tcId}  [${c.module}]  ${c.title.slice(0, 82)}`);
  console.log('');
}

if (ALL) {
  // Tự kiểm: với bug ĐÃ biết module, module áp đảo có trùng không? Đây là thước đo duy nhất cho biết
  // bảng điểm này đáng tin đến đâu — không có nó thì mọi đề xuất bên trên chỉ là cảm tính.
  const known = recs.filter((r) => r.d.tc_id && r.d.module && r.d.module !== '(unmapped)');
  let hit = 0; let inTop = 0; let tcInTop = 0;
  const wide = Math.max(TOP, 10);
  for (const { d } of known) {
    const r = rankWide(`${d.bug || ''} ${(d.tags || []).join(' ')} ${descOf(d.id)}`, wide);
    if (r.leadModule === d.module) hit++;
    if (r.list.some((c) => c.module === d.module)) inTop++;
    if (r.list.some((c) => c.tcId === d.tc_id)) tcInTop++;
  }
  // Hai con số này đo hai cách dùng KHÁC nhau và không thay thế nhau được:
  //   argmax  = nếu để script TỰ chốt module (chế độ không tồn tại, và đây là lý do)
  //   top-N   = nếu người đọc danh sách ứng viên rồi tự chốt (cách dùng thật)
  console.log(`[bug-tc] TỰ KIỂM trên ${known.length} bug đã map:`);
  console.log(`  · module áp đảo trùng module thật: ${hit}/${known.length} (${Math.round(100 * hit / known.length)}%) ⇒ KHÔNG đủ để tự chốt`);
  console.log(`  · module thật có mặt trong top-${wide}: ${inTop}/${known.length} (${Math.round(100 * inTop / known.length)}%) ⇒ độ tin của danh sách ứng viên`);
  console.log(`  · ĐÚNG TC đó có mặt trong top-${wide}: ${tcInTop}/${known.length} (${Math.round(100 * tcInTop / known.length)}%)`);
}
console.log('[bug-tc] Script KHÔNG tự ghi. Chốt bằng tay vào knowledge/bug_tc_map.json rồi chạy `npm run learn:bugs:apply`.');
