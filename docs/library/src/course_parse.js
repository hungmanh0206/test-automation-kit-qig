/**
 * course_parse.js — đọc docs/COURSE.md thành dữ liệu cho tab "Khoá học".
 *
 * Cùng lý do với journal_parse.js: markdown là nguồn canonical, trang chỉ render lại. Chép nội dung sang
 * một file .js của trang là tạo nguồn thứ hai, và hai nguồn thì sẽ trôi khỏi nhau.
 *
 * QUY ƯỚC trong COURSE.md (đổi quy ước thì đổi cả file này):
 *   # PHẦN N — <tên phần>
 *   ## Bài N — <tên bài>              (hoặc "## [Bài N — …](đường/dẫn.md)" khi đã có bài giảng chi tiết)
 *   *Có gì trong tay: …*
 *   ✅ <mục tiêu>   (một hoặc nhiều dòng)
 *   **<thời lượng>**
 *
 * Parse thất bại thì THROW — tab rỗng là lỗi im lặng.
 */
'use strict';
const fs = require('fs');
const path = require('path');

function plain(s) {
  return String(s)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[\s(])\*([^*]+)\*(?=[\s.,;:)]|$)/g, '$1$2')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\([^)]+\)/g, '$1')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

function parseCourse(mdPath) {
  const md = fs.readFileSync(mdPath, 'utf8');
  const root = path.dirname(mdPath);

  // Tiêu đề khoá + tổng thời lượng
  const total = plain((md.match(/\*\*Tổng thời lượng:([^*]+)\*\*/) || [, ''])[1]);
  const audience = plain((md.match(/\*\*Đối tượng\.\*\*([\s\S]*?)\n\n/) || [, ''])[1]);
  const prereq = plain((md.match(/\*\*Cần có trước\.\*\*([\s\S]*?)\n\n/) || [, ''])[1]);
  const notCover = plain((md.match(/\*\*Không dạy trong khoá này\.\*\*([\s\S]*?)\n\n/) || [, ''])[1]);
  const outcome = plain((md.match(/\*\*Đầu ra của khoá:\*\*([\s\S]*?)\n>\s*\n/) || [, ''])[1]);
  if (!total) throw new Error('COURSE.md: không thấy "**Tổng thời lượng: …**"');

  // Cắt theo phần
  const partChunks = md.split(/^# PHẦN /m).slice(1);
  if (!partChunks.length) throw new Error('COURSE.md: không thấy mục nào dạng "# PHẦN N — …"');

  const parts = [];
  let totalLessons = 0;
  for (const chunk of partChunks) {
    const nl = chunk.indexOf('\n');
    const head = chunk.slice(0, nl).trim();
    const hm = head.match(/^(\d+)\s*—\s*(.+)$/);
    if (!hm) throw new Error('COURSE.md: tiêu đề phần sai quy ước "N — tên": ' + head);

    const lessons = [];
    for (const lc of chunk.split(/^## /m).slice(1)) {
      const lnl = lc.indexOf('\n');
      let lhead = lc.slice(0, lnl).trim();
      const body = lc.slice(lnl + 1);

      // "[Bài 1 — Tên](course/01-x.md)" hoặc "Bài 1 — Tên"
      let href = null;
      const lk = lhead.match(/^\[(.+?)\]\(([^)]+)\)$/);
      if (lk) { lhead = lk[1]; href = lk[2]; }
      const lm = lhead.match(/^Bài\s+(\d+)\s*—\s*(.+)$/);
      if (!lm) continue;                       // bỏ qua mục không phải bài (vd "Sau khoá học")

      if (href && !fs.existsSync(path.join(root, href))) {
        throw new Error(`COURSE.md: Bài ${lm[1]} trỏ tới file KHÔNG tồn tại — ${href}`);
      }

      const have = plain((body.match(/^\*Có gì trong tay:([^*]+)\*/m) || [, ''])[1]);
      const goals = [...body.matchAll(/^✅\s*(.+)$/gm)].map((x) => plain(x[1]));
      const dur = plain((body.match(/^\*\*(\d+ giờ(?: \d+ phút)?)\*\*/m) || [, ''])[1]);

      if (!goals.length) throw new Error(`COURSE.md: Bài ${lm[1]} không có mục tiêu ✅ nào`);
      if (!dur) throw new Error(`COURSE.md: Bài ${lm[1]} thiếu dòng thời lượng "**N giờ …**"`);
      if (!have) throw new Error(`COURSE.md: Bài ${lm[1]} thiếu dòng "*Có gì trong tay: …*"`);

      lessons.push({ n: lm[1], title: lm[2].trim(), have: have, goals: goals, dur: dur, href: href });
      totalLessons++;
    }
    if (!lessons.length) throw new Error(`COURSE.md: PHẦN ${hm[1]} không có bài nào`);
    parts.push({ n: hm[1], title: hm[2].trim(), lessons: lessons });
  }

  // Số bài phải LIÊN TỤC. Được bắt đầu ở 0 (bài chuẩn bị) hoặc ở 1 — không được ở số khác,
  // vì bắt đầu ở 3 nghĩa là hai bài đầu đã rơi đâu mất mà không ai biết.
  const nums = parts.flatMap((p) => p.lessons.map((l) => Number(l.n)));
  const goc = nums[0];
  if (goc !== 0 && goc !== 1) throw new Error(`COURSE.md: bài đầu tiên phải là 0 hoặc 1, đang là ${goc}`);
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] !== goc + i) {
      throw new Error(`COURSE.md: số bài không liên tục — tới bài ${nums[i]} ở vị trí thứ ${i + 1} (chờ ${goc + i})`);
    }
  }

  return { total, audience, prereq, notCover, outcome, parts, lessonCount: totalLessons };
}

module.exports = { parseCourse };
