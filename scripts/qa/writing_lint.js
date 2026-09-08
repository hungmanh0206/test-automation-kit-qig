#!/usr/bin/env node
'use strict';

/*
 * writing_lint — output phải đọc như QA viết, không như máy viết.
 *
 * VÌ SAO CÓ FILE NÀY: "viết tự nhiên hơn" trước nay là lời dặn, và lời dặn thì trôi ngay ở artifact
 * tiếp theo. Nhưng "văn máy" là CẢM NHẬN, không chặn được bằng cảm nhận. Nên toàn bộ ngưỡng dưới đây
 * đến từ một MẪU CÓ NHÃN, không từ trực giác của tôi: 34 bài `docs/course/**` vừa được người viết tay
 * lại cho tự nhiên (6 commit, 0613122..3601a1e) so với 50 file prompt/workflow/tài liệu chưa viết lại.
 *
 * HAI GIẢ THUYẾT ĐẦU CỦA TÔI ĐỀU BỊ SỐ ĐO BÁC:
 *   ① "văn máy = từ vựng hype" — quét 180k từ: 2 lần trong toàn repo. Cấm từ vựng là chữa bệnh không có.
 *   ② "văn máy = bôi đậm dày"  — mẫu ĐÃ viết lại có đậm giữa câu 18.9/1k, CAO HƠN mẫu chưa viết lại
 *      16.7/1k. Đậm không phân biệt được gì, nên KHÔNG đưa vào máy. (Giữ lại đây để đừng thử lại.)
 *
 * DẤU HIỆU THẬT — phân biệt được, theo trung vị (đã viết lại → chưa viết lại):
 *      viết tắt bằng `/` giữa hai từ thường     0    → 13.7   /1k   (cách biệt lớn nhất)
 *      câu dài quá 35 từ                        1.2  →  3.4   /1k
 *      ký hiệu thay chữ  ≈ ⇒ → · ± ≤ ≥          4.8  → 13.0   /1k
 *      gạch dài nối hai mệnh đề                 5.7  → 10.1   /1k
 *      độ dài câu trung bình                   13.8  → 17.6   từ
 * Đọc diff của lượt viết lại thì thấy đúng những thứ này bị bỏ: "trả về kết luận — không trả về toàn
 * bộ" thành "làm một việc rồi trả về kết luận, không trả về mọi thứ"; "đọc/viết" thành "đọc và viết";
 * "Xấp xỉ: 1 token ≈ 3 ký tự" thành "tiếng Việt thì khoảng 3 ký tự là 1 token".
 *
 * LỌC ĐỂ KHỎI BÁO OAN: `/` chỉ tính khi CẢ HAI bên là từ chữ thường. Không lọc thì nó bắt `PASS/FAIL`,
 * `Critical/High`, `UI/API`, `AIO/Jira`, ngày `14/08/2026`, đường dẫn `docs/user/...` — nửa số lần
 * xuất hiện là từ vựng hợp lệ, và một gate hay báo oan thì bị tắt trong một ngày.
 *
 * BASELINE, không cấm tuyệt đối: chặn khi file vượt max(ngưỡng, mốc baseline). File MỚI phải đạt đích;
 * file CŨ chỉ cần không tệ thêm. Cùng khuôn `locator-lint-baseline.json` của kit.
 *
 * Dùng:
 *   node scripts/qa/writing_lint.js <path...>                # tự nhận profile theo đường dẫn
 *   node scripts/qa/writing_lint.js --docs                   # tài liệu + prompt + giáo trình
 *   node scripts/qa/writing_lint.js <path> --profile bug
 *   node scripts/qa/writing_lint.js --docs --baseline-write  # hạ mốc sau khi dọn
 * Exit: 0 đạt · 1 có file vượt mốc · 2 dùng sai.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const CFG = path.join(REPO, '.agent', 'config', 'writing_style.json');
const BASELINE = path.join(REPO, '.agent', 'config', 'writing-lint-baseline.json');

function loadJson(p, what) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`[writing] không đọc được ${what}: ${p} — ${e.message}`);
    process.exit(2);
  }
}

const cfg = loadJson(CFG, 'config');
const rel = (p) => path.relative(REPO, p).split(path.sep).join('/');

/** Đoán profile theo đường dẫn. Đo bằng thước của loại khác thì con số vô nghĩa. */
function profileOf(file) {
  const r = rel(file).toLowerCase();
  if (/\/test-cases\//.test(r)) return 'testcase';
  if (/\/reports?\//.test(r)) return 'report';
  return 'doc';
}

/*
 * Bỏ những thứ KHÔNG phải văn xuôi trước khi đo. Bảng cũng bỏ: ô bảng là mảnh câu, đưa vào thì phép
 * tách câu sai và mọi mật độ lệch theo. Ngưỡng ở config cũng được suy ra trên văn bản đã bỏ bảng —
 * đo khác cách suy ngưỡng là tự làm sai.
 */
function prose(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/^\s*\|.*$/gm, ' ')
    .replace(/^#+ .*$/gm, ' ')
    .replace(/\bhttps?:\S+/g, ' ')
    .replace(/\S*\/\S*\/\S*/g, ' ');
}

/** `/` giữa hai từ CHỮ THƯỜNG. Xem ghi chú "LỌC ĐỂ KHỎI BÁO OAN" ở đầu file. */
const SLASH_RE = /(?<![\p{L}\d/.])(\p{Ll}[\p{Ll}\p{M}]+)\/(\p{Ll}[\p{Ll}\p{M}]+)(?![\p{L}\d/.])/gu;
const SYM_RE = /[≈⇒→·±≤≥]/g;

function measure(text) {
  const t = prose(text);
  const words = (t.match(/\S+/g) || []).length;
  const sents = t.split(/(?<=[.!?…])\s+|\n\n+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length > 3);
  const vagueRe = new RegExp(`\\b(${cfg.vagueWords.words.join('|')})\\b`, 'gi');
  /*
   * \p{Emoji_Presentation}: bản đầu tôi tự gõ dãy ký tự và đếm 63 "emoji" trong README — nó quét cả
   * mũi tên, dấu giữa câu, ký tự kẻ bảng. Thuộc tính này bắt đúng ✅❌🚀 và bỏ qua ▶ ⚠ → ⇒ · ✓ ─ ①.
   */
  const emojiRe = /\p{Emoji_Presentation}/gu;
  const n = (re) => (t.match(re) || []).length;
  const per1k = (v) => (words ? +((v / words) * 1000).toFixed(1) : 0);

  return {
    words,
    sentences: sents.length,
    slash: per1k(n(SLASH_RE)),
    longSent: per1k(sents.filter((s) => s.split(/\s+/).length > 35).length),
    sym: per1k(n(SYM_RE)),
    emDash: per1k(n(/—/g)),
    vague: per1k(n(vagueRe)),
    meanSent: sents.length ? +(words / sents.length).toFixed(1) : 0,
    emojiCount: (text.match(emojiRe) || []).length,
  };
}

/** Cụm bị cấm — danh sách NGẮN, chỉ gồm cụm đo được ~0 lần trong văn bản thật. */
function bannedHits(text) {
  const t = prose(text).toLowerCase();
  const out = [];
  for (const [group, phrases] of Object.entries(cfg.bannedPhrases)) {
    if (group.startsWith('_')) continue;
    for (const ph of phrases) if (t.includes(ph.toLowerCase())) out.push(`${ph} [${group}]`);
  }
  return out;
}

const args = process.argv.slice(2);
const WRITE_BASELINE = args.includes('--baseline-write');
const forced = (() => {
  const i = args.indexOf('--profile');
  return i >= 0 ? args[i + 1] : '';
})();

function docSet() {
  const out = [];
  for (const f of ['README.md', 'USER_GUIDE.md', 'QUICKSTART.md', 'RULE_GLOBAL.md']) {
    const abs = path.join(REPO, f);
    if (fs.existsSync(abs)) out.push(abs);
  }
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const en of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, en.name);
      if (en.isDirectory()) { walk(p); continue; }
      if (en.name.endsWith('.md')) out.push(p);
    }
  };
  walk(path.join(REPO, 'prompt_templates'));
  walk(path.join(REPO, '.agent', 'workflows'));
  walk(path.join(REPO, 'docs', 'course'));
  return out;
}

let files = args.filter((a) => !a.startsWith('--') && a !== forced).map((a) => path.resolve(REPO, a));
if (args.includes('--docs')) files = docSet();

if (!files.length) {
  console.error('Dùng: node scripts/qa/writing_lint.js <path...> | --docs   [--profile testcase|bug|report|doc] [--baseline-write]');
  process.exit(2);
}

const baseline = fs.existsSync(BASELINE) ? loadJson(BASELINE, 'baseline') : { counts: {} };
const nextBaseline = {};
const problems = [];
const rows = [];

for (const abs of files) {
  if (!fs.existsSync(abs)) { console.error(`[writing] không thấy file: ${rel(abs)}`); process.exit(2); }
  const text = fs.readFileSync(abs, 'utf8');
  const m = measure(text);
  const prof = forced || profileOf(abs);
  const lim = cfg.profiles[prof];
  if (!lim) { console.error(`[writing] profile không có trong config: ${prof}`); process.exit(2); }

  /*
   * Dưới 80 từ văn xuôi thì mật độ nhiễu (1 lần trên 40 từ = 25/1k) ⇒ không phán mật độ, nhưng VẪN
   * kiểm emoji và cụm bị cấm vì hai thứ đó là đếm tuyệt đối, không phụ thuộc độ dài.
   */
  const tooShort = m.words < 80;
  const key = rel(abs);
  const cur = {};
  for (const k of Object.keys(lim.limits)) cur[k] = m[k];
  cur.emojiCount = m.emojiCount;
  nextBaseline[key] = cur;

  const prev = (baseline.counts || {})[key] || {};
  const over = [];
  if (!tooShort) {
    for (const [k, target] of Object.entries(lim.limits)) {
      const base = prev[k];
      const allowed = Math.max(target, base === undefined ? 0 : base);
      if (m[k] > allowed + 0.05) {
        over.push(`${k} ${m[k]} > mốc ${allowed}${base !== undefined && base > target ? ` (baseline ${base}, đích ${target})` : ''}`);
      }
    }
  }
  const emojiCap = Math.max(lim.emojiMax === undefined ? 0 : lim.emojiMax, prev.emojiCount === undefined ? 0 : prev.emojiCount);
  if (m.emojiCount > emojiCap) over.push(`emoji ${m.emojiCount} > mốc ${emojiCap}`);
  const banned = bannedHits(text);
  if (banned.length) over.push(`cụm bị cấm: ${banned.join(' · ')}`);

  rows.push({ file: key, prof, m, tooShort, over });
  if (over.length) problems.push(key);
}

if (WRITE_BASELINE) {
  fs.writeFileSync(BASELINE, `${JSON.stringify({
    note: 'Hiện trạng lúc bật writing_lint. Gate CHẶN khi một file vượt max(đích ở writing_style.json, mốc ở đây). Dọn văn cũ rồi chạy lại --baseline-write để hạ mốc.',
    generatedAt: new Date().toISOString().slice(0, 10),
    counts: nextBaseline,
  }, null, 2)}\n`, 'utf8');
  console.log(`[writing] đã ghi baseline cho ${Object.keys(nextBaseline).length} file → ${rel(BASELINE)}`);
  process.exit(0);
}

for (const r of rows) {
  const { m } = r;
  const head = `  ${r.over.length ? 'x' : 'v'} [${r.prof}] ${r.file}`;
  const body = r.tooShort
    ? `${m.words} từ văn xuôi (quá ngắn, chỉ kiểm emoji + cụm cấm)`
    : `${m.words} từ · gạch-chéo ${m.slash}/1k · câu-dài ${m.longSent}/1k · ký-hiệu ${m.sym}/1k · gạch-dài ${m.emDash}/1k · mơ-hồ ${m.vague}/1k · câu tb ${m.meanSent} từ`;
  console.log(`${head} — ${body}`);
  for (const o of r.over) console.log(`      ${o}`);
}

if (problems.length) {
  console.error(`\n[writing] CHẶN: ${problems.length}/${rows.length} file vượt mốc.`);
  console.error('  Cách sửa, theo đúng thứ tự mà lượt viết lại 34 bài đã làm:');
  console.error('    1. Bỏ viết tắt bằng gạch chéo: "ảnh/video" thành "ảnh hoặc video".');
  console.error('    2. Cắt câu dài: chỗ nào đang dùng gạch dài để nối mệnh đề thì tách thành hai câu.');
  console.error('    3. Thay ký hiệu bằng chữ: "≈" thành "khoảng", "⇒" thành "nên".');
  console.error('    4. Thay lượng từ mơ hồ bằng số.');
  console.error('  Mốc lấy từ MAX của 34 bài người viết tay, nên đạt được là chuyện đã có tiền lệ.');
  process.exit(1);
}
console.log(`\n[writing] OK — ${rows.length} file trong mốc.`);
process.exit(0);
