#!/usr/bin/env node
'use strict';
/*
 * rule_lookup — tra RULE_GLOBAL.md THEO MỤC, thay vì đọc cả file.
 *
 * VÌ SAO CẦN (đo 07/09/2026): RULE_GLOBAL.md = 465 dòng · 51.116 ký tự · ~12.800 token (SÀN — 12% ký tự
 * có dấu nên thực tế cao hơn). Nó KHÔNG được auto-load (file luôn-trong-ngữ-cảnh là CLAUDE.md, 13 dòng),
 * nên nó không ăn token mỗi phiên. Vấn đề là lúc CẦN tra: không có mục lục nên cách duy nhất là đọc cả
 * file — 12.8k token cho một câu trả lời. Thước đo của chính kit (`doc_budget.js`) đặt READ_DIRECT = 8.000,
 * nên đọc cả file này đã vượt ngưỡng "đọc thẳng" 1,6 lần. Đo thật: mục `Security` = 287 token — rẻ hơn 45 lần.
 *
 * VÌ SAO KHÔNG CHIA FILE — dù chia nghe hợp lý hơn: `policy_source_check.js` khoá "RULE_GLOBAL là canonical
 * DUY NHẤT" một cách có chủ đích. Chia thành 4 file là tạo 4 chỗ để cùng một luật nói khác nhau, và kit này
 * đã bị đúng lớp lỗi đó (digest lệch canonical). Tra-theo-mục lấy gần hết lợi ích mà không đổi neo.
 *
 * ĐIỂM BẤT ĐỘNG — chỗ dễ sai nhất của script này: mục lục CHỨA số dòng, mà chèn mục lục lại LÀM DỜI số
 * dòng. Sinh một lượt là ra bảng nói sai (đã dính: bảng ghi Purpose ở dòng 32 trong khi nó đã dời xuống 67).
 * Nên `--toc-write` lặp tới khi ổn định và BÁO LỖI nếu không hội tụ; `--check` so CHẶT cả khối, cùng khuôn
 * với `gates:index:check`. Cái giá phải trả: sửa nội dung RULE_GLOBAL thì phải chạy lại `npm run rule:toc`.
 *
 * Dùng:
 *   node scripts/qa/rule_lookup.js --list          # mục lục + chi phí token từng mục
 *   node scripts/qa/rule_lookup.js "security"      # in đúng mục đó (khớp không dấu, không phân biệt hoa)
 *   node scripts/qa/rule_lookup.js 8               # theo số thứ tự trong --list
 *   node scripts/qa/rule_lookup.js --toc-write     # ghi/làm mới mục lục NEO vào RULE_GLOBAL.md
 *   node scripts/qa/rule_lookup.js --check         # exit 1 nếu mục lục thiếu/lệch
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const FILE = path.join(REPO, 'RULE_GLOBAL.md');
const BEGIN = '<!-- MỤC-LỤC:BẮT-ĐẦU — sinh bởi `npm run rule:toc`. Đừng sửa tay. -->';
const END = '<!-- MỤC-LỤC:KẾT-THÚC -->';
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);

/**
 * Bỏ dấu + hạ chữ, để "Bảo mật" khớp được với "bao mat". `\p{M}` = ký tự tổ hợp.
 * KHÔNG viết dãy escape backslash-u-0300 tới -036f: tầng vận chuyển giải mã nó thành ký tự tổ hợp THẬT
 * và file trông như hỏng font. (Đã dính đúng vậy khi tạo file này.)
 */
const norm = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

/** Neo kiểu GitHub: hạ chữ, bỏ ký tự không phải chữ/số/gạch, khoảng trắng thành gạch. GIỮ dấu tiếng Việt. */
const slug = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-');

const estTok = (s) => Math.round(s.length / 4);
const readFile = () => fs.readFileSync(FILE, 'utf8');
const flatten = (t) => t.split(CR + LF).join(LF);

/** Cắt mục từ MỘT CHUỖI (không đọc đĩa) — để `--check` so được với trạng thái giả định. */
function sectionsOf(text) {
  const lines = flatten(text).split(LF);
  const heads = [];
  lines.forEach((l, i) => {
    const m = l.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (m) heads.push({ level: m[1].length, title: m[2], line: i });
  });
  return heads.map((h, k) => {
    /*
     * Mục kết thúc ở heading KẾ TIẾP có cấp BẰNG HOẶC CAO HƠN — không phải heading kế tiếp bất kỳ,
     * nếu không thì một `##` sẽ bị cắt ngay trước `###` con của chính nó.
     */
    let end = lines.length;
    for (let j = k + 1; j < heads.length; j += 1) {
      if (heads[j].level <= h.level) { end = heads[j].line; break; }
    }
    const body = lines.slice(h.line, end).join(LF);
    return { ...h, idx: k + 1, endLine: end, body, tok: estTok(body) };
  });
}

function tocOf(text) {
  const secs = sectionsOf(text);
  const L = [BEGIN, ''];
  L.push('| # | Mục | Dòng | ~token | Tra nhanh |');
  L.push('|---|---|---|---|---|');
  for (const s of secs) {
    const indent = s.level === 3 ? '&nbsp;&nbsp;' : '';
    L.push(`| ${s.idx} | ${indent}[${s.title}](#${slug(s.title)}) | ${s.line + 1}-${s.endLine} | ${s.tok} | npm run rule -- ${s.idx} |`);
  }
  L.push('');
  L.push(`> Cả file ~${estTok(text)} token. Tra MỘT mục thay vì đọc cả file: npm run rule -- <số|từ khoá>`);
  L.push(END);
  return L.join(LF);
}

/** Thay khối cũ, hoặc chèn ngay TRƯỚC heading `##` đầu tiên (phần trên đó là lời mở đầu + con trỏ canonical). */
function withToc(flat, toc) {
  const i = flat.indexOf(BEGIN);
  const j = flat.indexOf(END);
  if (i >= 0 && j > i) return flat.slice(0, i) + toc + flat.slice(j + END.length);
  const m = flat.match(/^##\s+/m);
  if (!m) throw new Error('RULE_GLOBAL.md không có heading `##` nào — không biết chèn mục lục ở đâu.');
  return `${flat.slice(0, m.index)}${toc}${LF}${LF}${flat.slice(m.index)}`;
}

/** Lặp tới ĐIỂM BẤT ĐỘNG: mục lục chứa số dòng, mà chèn nó lại làm dời số dòng. */
function converge(flat) {
  let cur = flat;
  for (let pass = 0; pass < 6; pass += 1) {
    const next = withToc(cur, tocOf(cur));
    if (next === cur) return { text: cur, pass };
    cur = next;
  }
  throw new Error('mục lục không hội tụ sau 6 lượt — có gì làm số dòng dao động, xem lại tocOf().');
}

const args = process.argv.slice(2);

if (args.includes('--list')) {
  const raw = readFile();
  const list = sectionsOf(raw);
  console.log(`RULE_GLOBAL.md — ${list.length} mục · cả file ~${estTok(raw)} token`);
  console.log('');
  for (const s of list) {
    const pad = s.level === 3 ? '  ' : '';
    console.log(`  ${String(s.idx).padStart(2)}. ${pad}${s.title.padEnd(44)} dòng ${String(s.line + 1).padStart(3)}-${String(s.endLine).padEnd(3)}  ~${s.tok} tok`);
  }
  process.exit(0);
}

if (args.includes('--toc-write')) {
  const raw = readFile();
  const crlf = raw.includes(CR + LF);   // GIỮ line-ending gốc: file đang là CRLF, chèn LF vào là lẫn lộn
  const res = converge(flatten(raw));
  fs.writeFileSync(FILE, crlf ? res.text.split(LF).join(CR + LF) : res.text, 'utf8');
  console.log(`[rule] đã ghi mục lục — ${sectionsOf(res.text).length} mục, hội tụ sau ${res.pass + 1} lượt.`);
  process.exit(0);
}

if (args.includes('--check')) {
  const raw = readFile();
  if (!raw.includes(BEGIN) || !raw.includes(END)) {
    console.error('[rule] CHẶN: RULE_GLOBAL.md thiếu khối mục lục — chạy `npm run rule:toc`.');
    process.exit(1);
  }
  const flat = flatten(raw);
  const want = converge(flat).text;
  if (want !== flat) {
    const list = sectionsOf(flat);
    const cur = flat.slice(flat.indexOf(BEGIN), flat.indexOf(END));
    const missing = list.filter((s) => !cur.includes(`[${s.title}]`)).map((s) => s.title);
    console.error('[rule] CHẶN: mục lục LỆCH nội dung file.');
    if (missing.length) console.error(`  Mục có trong file mà bảng thiếu: ${missing.join(' · ')}`);
    else console.error('  Tên mục vẫn khớp, nhưng SỐ DÒNG / chi phí token đã dời (nội dung được sửa).');
    console.error('  Chạy `npm run rule:toc` rồi commit.');
    process.exit(1);
  }
  console.log(`[rule] OK — mục lục khớp ${sectionsOf(flat).length} heading, số dòng đúng.`);
  process.exit(0);
}

const q = args.find((a) => !a.startsWith('--'));
if (!q) {
  console.error('Dùng: npm run rule -- <số|từ khoá>   ·   npm run rule -- --list');
  process.exit(2);
}

const secs = sectionsOf(readFile());
const byIdx = /^\d+$/.test(q) ? secs.find((s) => s.idx === Number(q)) : null;
const hits = byIdx ? [byIdx] : secs.filter((s) => norm(s.title).includes(norm(q)));

if (!hits.length) {
  console.error(`[rule] không mục nào khớp "${q}". Xem danh sách: npm run rule -- --list`);
  process.exit(1);
}
if (hits.length > 1) {
  console.error(`[rule] "${q}" khớp ${hits.length} mục — chọn một số:`);
  hits.forEach((s) => console.error(`   ${s.idx}. ${s.title}  (~${s.tok} tok)`));
  process.exit(1);
}
console.log(`# RULE_GLOBAL.md — mục ${hits[0].idx}/${secs.length} · dòng ${hits[0].line + 1}-${hits[0].endLine} · ~${hits[0].tok} token`);
console.log('');
console.log(hits[0].body);
