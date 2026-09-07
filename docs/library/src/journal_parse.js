/**
 * journal_parse.js — đọc docs/BUILD_JOURNAL.md thành dữ liệu cho tab "Hành trình".
 *
 * VÌ SAO PARSE CHỨ KHÔNG CHÉP: luật `canonical source` của kit — mỗi loại thông tin đúng một nguồn.
 * Nếu chép nội dung nhật ký sang một file .js của trang thì có hai nguồn, và hai nguồn thì sẽ trôi khỏi
 * nhau (đúng lớp lỗi mà `library:drift` sinh ra để chặn). Nên markdown là nguồn, trang là bản render.
 *
 * QUY ƯỚC trong BUILD_JOURNAL.md (đổi quy ước thì đổi cả file này):
 *   ## Chặng N — <tiêu đề>
 *   <!-- era: id="..." from="YYYY-MM-DD" to="YYYY-MM-DD" -->
 *   **Vấn đề.** …            **Đã dựng.** + gạch đầu dòng
 *   **Đo bằng.** …           **Bẫy đã vấp.** …           **Nếu bạn dựng lại.** …
 *
 * Parse THẤT BẠI thì THROW, không trả mảng rỗng — tab trống là lỗi im lặng, đúng thứ kit cấm.
 */
'use strict';
const fs = require('fs');

const FIELDS = [
  ['problem', 'Vấn đề'],
  ['built', 'Đã dựng'],
  ['measured', 'Đo bằng'],
  ['trap', 'Bẫy đã vấp'],
  ['advice', 'Nếu bạn dựng lại']
];

/** Bỏ cú pháp markdown inline để hiển thị bằng textContent (trang không render HTML từ dữ liệu). */
function plain(s) {
  return String(s)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[\s(])\*([^*]+)\*(?=[\s.,;:)]|$)/g, '$1$2')   // in nghiêng dạng *…*
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\([^)]+\)/g, '$1')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

function parseJournal(mdPath) {
  const md = fs.readFileSync(mdPath, 'utf8');

  const meta = {};
  const mm = md.match(/<!--\s*meta:([^>]*)-->/);
  if (mm) for (const [, k, v] of mm[1].matchAll(/(\w+)="([^"]*)"/g)) meta[k] = v;

  // Cắt theo "## Chặng"; phần trước chặng đầu là mở đầu, phần sau chặng cuối là kết.
  const parts = md.split(/^## Chặng /m);
  if (parts.length < 2) throw new Error('BUILD_JOURNAL.md: không thấy mục nào dạng "## Chặng N — …"');

  const eras = [];
  for (const raw of parts.slice(1)) {
    const nl = raw.indexOf('\n');
    const head = raw.slice(0, nl).trim();                       // "1 — Làm năng lực…"
    let body = raw.slice(nl + 1);
    body = body.split(/^---\s*$/m)[0];                          // cắt ở đường phân cách cuối chặng

    const hm = head.match(/^(\d+)\s*—\s*(.+)$/);
    if (!hm) throw new Error('BUILD_JOURNAL.md: tiêu đề chặng sai quy ước "N — tiêu đề": ' + head);

    const attrs = {};
    const am = body.match(/<!--\s*era:([^>]*)-->/);
    if (!am) throw new Error(`BUILD_JOURNAL.md: chặng ${hm[1]} thiếu dòng <!-- era: id=… from=… to=… -->`);
    for (const [, k, v] of am[1].matchAll(/(\w+)="([^"]*)"/g)) attrs[k] = v;
    for (const k of ['id', 'from', 'to']) {
      if (!attrs[k]) throw new Error(`BUILD_JOURNAL.md: chặng ${hm[1]} thiếu thuộc tính ${k}`);
    }

    const era = { n: hm[1], title: hm[2].trim(), id: attrs.id, from: attrs.from, to: attrs.to };
    for (const [key, label] of FIELDS) {
      // lấy từ "**Label.**" tới "**Label kế tiếp**" hoặc hết chặng
      const re = new RegExp('\\*\\*' + label + '\\.\\*\\*([\\s\\S]*?)(?=\\n\\*\\*[^*]+\\.\\*\\*|$)');
      const seg = body.match(re);
      if (!seg) { era[key] = null; continue; }
      const chunk = seg[1];
      const bullets = [...chunk.matchAll(/^\s*[-*]\s+(.+(?:\n(?!\s*[-*]\s|\s*$).+)*)/gm)].map((x) => plain(x[1]));
      const lead = plain(chunk.split(/^\s*[-*]\s+/m)[0]);
      era[key] = bullets.length ? { lead: lead || null, items: bullets } : { lead, items: [] };
    }
    if (!era.problem) throw new Error(`BUILD_JOURNAL.md: chặng ${hm[1]} thiếu "**Vấn đề.**"`);
    eras.push(era);
  }

  /* Bài học lớn nhất = khối blockquote CUỐI trong phần mở đầu. Phần mở đầu có 2 khối: khối đầu là ghi chú
     "tài liệu này là gì", khối cuối là bài học. Lấy khối cuối, không lấy mọi dòng `>` gộp lại — bản đầu
     làm vậy và ra đúng khối ghi chú. */
  const intro = parts[0];
  const groups = intro.split(/\n\s*\n/).filter((b) => /^\s*>/m.test(b));
  const lastGroup = groups[groups.length - 1] || '';
  const lesson = plain([...lastGroup.matchAll(/^\s*>\s?(.*)$/gm)].map((x) => x[1]).join(' ')) || null;
  if (!lesson) throw new Error('BUILD_JOURNAL.md: không parse được "bài học lớn nhất" (khối > trong mở đầu)');

  // Nguyên tắc rút ra + thứ tự khuyến nghị + điểm mù: đọc từ phần sau chặng cuối
  const tailStart = md.lastIndexOf('## Sáu nguyên tắc');
  const tail = tailStart >= 0 ? md.slice(tailStart) : '';
  const principles = [...tail.matchAll(/^\d+\.\s+\*\*(.+?)\*\*\s*([\s\S]*?)(?=\n\d+\.\s+\*\*|\n## |$)/gm)]
    .map((x) => ({ t: plain(x[1]).replace(/\.$/, ''), d: plain(x[2]) }));
  const order = [...tail.matchAll(/^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/gm)]
    .map((x) => ({ n: x[1], what: plain(x[2]), why: plain(x[3]) }));
  const blind = [...tail.matchAll(/^-\s+\*\*(.+?)\*\*\s*([\s\S]*?)(?=\n-\s+\*\*|\n## |$)/gm)]
    .map((x) => ({ t: plain(x[1]).replace(/\.$/, ''), d: plain(x[2]) }));

  if (!principles.length) throw new Error('BUILD_JOURNAL.md: không parse được mục "Sáu nguyên tắc rút ra"');
  if (!order.length) throw new Error('BUILD_JOURNAL.md: không parse được bảng "thứ tự tôi khuyên"');
  if (!blind.length) throw new Error('BUILD_JOURNAL.md: không parse được mục "Điểm mù"');

  return { meta, lesson, eras, principles, order, blind };
}

module.exports = { parseJournal };
