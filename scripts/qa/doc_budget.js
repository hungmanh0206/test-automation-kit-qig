#!/usr/bin/env node
'use strict';

/*
 * doc_budget.js — đo TÀI LIỆU đầu vào của task rồi nói rõ: đọc trực tiếp, hay GIAO SUBAGENT trích ra rồi chỉ
 * nhận về phần đã trích.
 *
 * VÌ SAO CẦN: tài liệu spec ở dự án này lớn hơn nhiều so với cảm giác. Đo 14/08/2026: FSD sau khi vá lỗi đọc
 * thiếu tab là **345 KB (~108k token)**, sheet mapping **205 KB (~64k)**. Đọc thẳng trong luồng chính thì
 * (a) tốn gấp nhiều lần toàn bộ prompt gen (11,8k), và (b) tệ hơn: nó chiếm chỗ của mọi thứ khác trong context
 * suốt phần còn lại của lượt. Nhưng "tài liệu to" không tự hiện ra — nó chỉ hiện ra khi đã đọc xong và muộn rồi.
 *
 * ĐÂY KHÔNG PHẢI CÔNG CỤ TIẾT KIỆM TOKEN THUẦN. Giao subagent thì TỔNG token TĂNG (subagent phải nạp lại luật
 * + ngữ cảnh). Cái nó đổi lấy là: luồng chính chỉ gánh phần ĐÃ TRÍCH (thường vài k) thay vì cả tài liệu, nên
 * chất lượng phần sau của lượt không bị bóp. Nói thẳng để không ai kỳ vọng sai.
 *
 * Ngưỡng (ước ~3,2 ký tự/token cho tiếng Việt — cùng hệ số dùng ở mọi phép đo khác của kit):
 *   < 8k tok   → đọc trực tiếp, không cần nghĩ.
 *   8k–25k     → đọc trực tiếp nhưng CHỈ mục cần; nếu phải đọc >1 tài liệu cỡ này thì cân nhắc giao.
 *   > 25k      → GIAO SUBAGENT: nó đọc, trả về JSON theo schema knowledge/ (có `source`), luồng chính không
 *                bao giờ chứa nguyên văn tài liệu.
 *
 * Dùng:
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/qa/doc_budget.js            # quét requirements/ của task
 *   node scripts/qa/doc_budget.js <path...>                                    # đo file/thư mục cụ thể
 *   ... [--contract]   # in kèm HỢP ĐỒNG TRÍCH XUẤT để dán cho subagent
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const CHARS_PER_TOK = 3.2;
const READ_DIRECT = 8000;
const DELEGATE = 25000;
const DOC_EXT = /\.(md|json|txt|csv|html?|xml|ya?ml)$/i;

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const WANT_CONTRACT = process.argv.includes('--contract');

function walk(p, out = []) {
  let st;
  try { st = fs.statSync(p); } catch (e) { return out; }
  if (st.isFile()) { if (DOC_EXT.test(p)) out.push({ file: p, bytes: st.size }); return out; }
  if (st.isDirectory()) for (const f of fs.readdirSync(p)) walk(path.join(p, f), out);
  return out;
}

let roots = args;
if (!roots.length) {
  const TASK = process.env.TASK_KEY || '';
  const POD = process.env.PROJECT_OUTPUT_DIR || '';
  if (!TASK || !POD) { console.error('[docs] cần <path...> hoặc TASK_KEY + PROJECT_OUTPUT_DIR (TASK_ENV=profiles/<TASK>/task.env).'); process.exit(2); }
  roots = [path.resolve(rc.REPO_ROOT, POD, 'tasks', TASK, 'requirements')];
}

const docs = [];
for (const r of roots) walk(path.resolve(r), docs);
if (!docs.length) { console.error(`[docs] không thấy tài liệu nào (${DOC_EXT}) trong: ${roots.join(', ')}`); process.exit(2); }

// Đọc thật để đếm KÝ TỰ, không dùng byte: file UTF-8 tiếng Việt có ~1,5 byte/ký tự nên đếm byte sẽ phóng đại
// khoảng 50% và đẩy tài liệu qua ngưỡng oan.
for (const d of docs) {
  try { d.chars = fs.readFileSync(d.file, 'utf8').length; } catch (e) { d.chars = d.bytes; }
  d.tok = d.chars / CHARS_PER_TOK;
  d.verdict = d.tok > DELEGATE ? 'GIAO SUBAGENT' : (d.tok > READ_DIRECT ? 'đọc CHỈ mục cần' : 'đọc trực tiếp');
}
docs.sort((a, b) => b.tok - a.tok);

const fmt = (t) => `${(t / 1000).toFixed(1)}k`;
const total = docs.reduce((s, d) => s + d.tok, 0);
const heavy = docs.filter((d) => d.tok > DELEGATE);

console.log(`[docs] ${docs.length} tài liệu · tổng ~${fmt(total)} token nếu đọc HẾT nguyên văn\n`);
console.log('| ~token | Việc nên làm | File |');
console.log('|---|---|---|');
for (const d of docs.slice(0, 25)) {
  console.log(`| ${fmt(d.tok)} | ${d.verdict} | ${path.relative(rc.REPO_ROOT, d.file)} |`);
}
if (docs.length > 25) console.log(`| … | | và ${docs.length - 25} file nhỏ hơn |`);

// ── TRÙNG BẢN: cùng một tài liệu tồn tại nhiều bản (json+md, hoặc snapshot theo ngày) ──────────────────
// Đo trên task thật: FSD có CẢ `.json` 504k VÀ `.md` 108k; sheet mapping có `.json` 56k + `.md` 33k;
// thư mục `tabs/` và `tabs_20260807/` là hai lần export của cùng bộ tab. Đọc bản nặng khi đã có bản nhẹ là
// lãng phí thuần — mà nhìn cây thư mục thì KHÔNG thấy, vì tên khác nhau chỉ ở phần hậu tố/ngày.
const groups = new Map();
for (const d of docs) {
  const base = path.basename(d.file).replace(/\.[^.]+$/, '');
  if (!groups.has(base)) groups.set(base, []);
  groups.get(base).push(d);
}
// "Nhẹ nhất thì đọc" là tiêu chí SAI và tôi đã tự đạp phải: bản 6,6k của FSD chính là export BỊ CẮT còn 1 tab
// từ trước khi vá `doc_reader` (thiếu `includeTabsContent`), còn bản 108k mới là bản đủ 15 tab. Khuyên đọc bản
// nhẹ = khuyên đọc bản thiếu nội dung. Tiêu chí đúng:
//   - Cùng basename, KHÁC phần mở rộng  → cùng nội dung khác định dạng ⇒ ưu tiên .md/.txt (nhẹ, người đọc được).
//   - Cùng basename, CÙNG phần mở rộng  → nhiều lần export ⇒ ưu tiên bản MỚI NHẤT theo mtime.
// Và nếu bản mới LỚN HƠN hẳn bản cũ thì phải nói to: bản cũ là bản THIẾU, không phải "bản khác ngày".
const FMT_RANK = { '.md': 0, '.txt': 1, '.csv': 2, '.yaml': 3, '.yml': 3, '.html': 4, '.htm': 4, '.xml': 5, '.json': 6 };
const dupGroups = [...groups.values()].filter((g) => g.length > 1);
if (dupGroups.length) {
  for (const d of docs) { try { d.mtime = fs.statSync(d.file).mtimeMs; } catch (e) { d.mtime = 0; } }
  console.log('');
  console.log(`[docs] ⚠ ${dupGroups.length} tài liệu có NHIỀU BẢN — đọc bản NÊN ĐỌC, bỏ phần còn lại:`);
  let waste = 0;
  const truncated = [];
  for (const g of dupGroups.sort((a, b) => Math.max(...b.map((x) => x.tok)) - Math.max(...a.map((x) => x.tok))).slice(0, 8)) {
    // Trong mỗi định dạng: giữ bản mới nhất. Giữa các định dạng: giữ định dạng dễ đọc nhất.
    const bestPerExt = new Map();
    for (const d of g) {
      const ext = path.extname(d.file).toLowerCase();
      const cur = bestPerExt.get(ext);
      if (!cur || d.mtime > cur.mtime) bestPerExt.set(ext, d);
    }
    const keep = [...bestPerExt.values()].sort((a, b) => (FMT_RANK[path.extname(a.file).toLowerCase()] ?? 9) - (FMT_RANK[path.extname(b.file).toLowerCase()] ?? 9))[0];
    const drop = g.filter((d) => d !== keep);
    waste += drop.reduce((s, x) => s + x.tok, 0);
    const older = drop.filter((d) => path.extname(d.file) === path.extname(keep.file) && d.tok < keep.tok * 0.8);
    if (older.length) truncated.push({ keep, older });
    console.log(`  ${path.basename(keep.file)}: ĐỌC ${fmt(keep.tok)}${path.extname(keep.file)} (mới nhất), BỎ ${drop.map((x) => `${fmt(x.tok)}${path.extname(x.file)}`).join(' + ')}`);
  }
  console.log(`[docs]   Bỏ các bản dư = tiết kiệm ~${fmt(waste)} token.`);
  for (const t of truncated) {
    console.log(`[docs] ⚠⚠ ${path.basename(t.keep.file)}: bản cũ (${t.older.map((x) => fmt(x.tok)).join(', ')}) NHỎ HƠN HẲN bản mới (${fmt(t.keep.tok)})`);
    console.log('[docs]     ⇒ bản cũ là bản THIẾU NỘI DUNG, không phải "bản khác ngày". Đọc nó là đọc thiếu spec.');
    console.log('[docs]     (Đã xảy ra thật: export Google Doc trước khi vá `includeTabsContent` chỉ lấy được 1/15 tab.)');
  }
}

console.log('');
if (heavy.length) {
  const heavyTok = heavy.reduce((s, d) => s + d.tok, 0);
  console.log(`[docs] ⚠ ${heavy.length} tài liệu VƯỢT ngưỡng giao việc (>${fmt(DELEGATE)}), tổng ~${fmt(heavyTok)} token.`);
  console.log('[docs]   Đọc thẳng mấy file này trong luồng chính = chiếm chỗ của phần còn lại của lượt.');
  console.log(`[docs]   So sánh: toàn bộ prompt gen sau khi tách chỉ ~11,8k; nghĩa là 1 tài liệu ${fmt(heavy[0].tok)} nặng gấp ~${Math.round(heavy[0].tok / 11800)}× prompt.`);
} else {
  console.log('[docs] ✓ Không tài liệu nào vượt ngưỡng giao việc — đọc trực tiếp là ổn.');
}

if (WANT_CONTRACT && heavy.length) {
  console.log(`
[docs] HỢP ĐỒNG TRÍCH XUẤT — dán cho subagent (một subagent / một tài liệu):

  Đọc: <đường dẫn tài liệu>
  Nhiệm vụ: TRÍCH, không kể lại. Trả về JSON, KHÔNG văn xuôi, KHÔNG trích nguyên văn dài.
  Hình dạng bắt buộc (theo knowledge/SCHEMA.md):
    { "domain": [ { "id":"BR-<SLUG>-<NNN>", "module":"…", "rule":"…", "applies_when":"…",
                    "examples":[{"input":"…","expected":"<giá trị/số CỤ THỂ>"}],
                    "source":"<tên tài liệu> · <tab/mục/dòng>", "confirmed_by":"BA|Dev|QA-Lead|PO" } ],
      "system": [ { "id":"SM|PM|SS|DM-<SLUG>-<NNN>", "type":"state_machine|permission_matrix|shared_surface|data_model", … } ],
      "open_questions": [ "<chỗ tài liệu KHÔNG trả lời được — ghi ra, TUYỆT ĐỐI không tự điền>" ],
      "not_covered": [ "<phần đã đọc nhưng không rút ra rule nào — để biết bạn đã đọc tới đâu>" ] }

  Ràng buộc (vi phạm là kết quả bị bỏ):
   1. Mọi rule PHẢI có \`source\` chỉ tới ĐÚNG tab/mục/dòng — không truy nguyên được thì bỏ, đừng ghi.
   2. \`examples[].expected\` phải là GIÁ TRỊ CỤ THỂ (số/chuỗi/enum), không phải mô tả chung.
   3. Tài liệu mờ → cho vào \`open_questions\`. KHÔNG suy diễn để lấp chỗ trống.
   4. KHÔNG đọc app/build để "kiểm tra lại" — tài liệu là nguồn, app là đối tượng bị kiểm.
   5. Trả JSON gọn: luồng chính chỉ nhận phần này, không nhận nguyên văn tài liệu.

  Sau khi nhận: ghi vào knowledge/{domain,system}/ rồi \`npm run domain:check\` + \`npm run system:check\` —
  gate sẽ chặn rule thiếu source/example, nên kết quả subagent KHÔNG vào knowledge mà không qua kiểm.`);
} else if (heavy.length) {
  console.log('[docs]   Thêm --contract để in hợp đồng trích xuất (dán cho subagent).');
}
