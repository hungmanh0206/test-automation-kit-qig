/*
 * course_parse.js — đọc docs/COURSE.md (CANONICAL) thành dữ liệu cho trang.
 *
 * Trang là lớp DẪN XUẤT: không được chép tay lại giáo trình vào JS, vì hai bản sẽ trôi khỏi nhau.
 *
 * QUY ƯỚC của COURSE.md mà file này phụ thuộc:
 *   ## PHẦN <N> — <tên> (<X> giờ)
 *   ### [Bài <N> — <tên>](course/<slug>.md) *(<X>h)* ⭐      ← link và ⭐ đều tuỳ chọn
 *   *Có gì trong tay: …*
 *   - gạch đầu dòng nội dung
 *
 * MỌI SAI QUY ƯỚC ĐỀU THROW. Tab khoá học trống là lỗi im lặng tệ hơn build đỏ.
 */
'use strict';
const fs = require('fs');
const path = require('path');

function plain(s) {
  return String(s || '')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Gỡ markdown về chữ thường, GIỮ lại thông tin nhấn mạnh qua cờ riêng thì gọi keepMd. */
function stripMd(s) {
  return plain(s)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\([^)]+\)/g, '$1');
}

/** Bullet có callout dẫn đầu — Thực hành / XÂY gate — được đánh dấu để trang tô khác. */
function classifyBullet(raw) {
  const m = plain(raw).match(/^\*\*(Thực hành|XÂY gate):\*\*\s*(.+)$/i);
  if (m) return { kind: m[1].toLowerCase().startsWith('thực') ? 'practice' : 'gate', text: stripMd(m[2]) };
  return { kind: 'point', text: stripMd(raw) };
}

function parseCourse(mdPath) {
  const md = fs.readFileSync(mdPath, 'utf8');
  const root = path.dirname(mdPath);

  const total = plain((md.match(/^## Tổng thời lượng:\s*(.+)$/m) || [, ''])[1]);
  if (!total) throw new Error('COURSE.md: không thấy "## Tổng thời lượng: …"');

  const positioning = stripMd((md.match(/>\s*\*\*Định vị:\*\*([\s\S]*?)\n\n/) || [, ''])[1]);
  const coreQuestion = stripMd((md.match(/\*\*Câu hỏi cốt lõi của khoá:\*\*(.+)/) || [, ''])[1]);

  // "Bạn sẽ học được gì" — danh sách ✅ ở cấp khoá
  const outcomeBlock = (md.match(/## Bạn sẽ học được gì([\s\S]*?)\n---/) || [, ''])[1];
  const outcomes = [...outcomeBlock.matchAll(/^✅\s*(.+)$/gm)].map((x) => stripMd(x[1]));
  if (!outcomes.length) throw new Error('COURSE.md: mục "Bạn sẽ học được gì" không có dòng ✅ nào');

  const required = stripMd((md.match(/\*\*Bắt buộc:\*\*(.+)/) || [, ''])[1]);
  const notRequired = stripMd((md.match(/\*\*Không bắt buộc:\*\*(.+)/) || [, ''])[1]);
  const warning = stripMd((md.match(/⚠️\s*\*\*Nói thẳng:\*\*([\s\S]*?)\n\n/) || [, ''])[1]);

  // So sánh với khoá khác — bảng 2 cột
  const cmpBlock = (md.match(/## Khác gì các khoá AI Testing hiện có([\s\S]*?)\n\*\*Câu hỏi/) || [, ''])[1];
  const compare = [...cmpBlock.matchAll(/^\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$/gm)]
    .map((r) => ({ aspect: stripMd(r[1]), others: stripMd(r[2]), ours: stripMd(r[3]) }))
    .filter((r) => r.aspect && !/^-+$/.test(r.others));

  // App thực hành — bảng 3 bug
  const bugBlock = (md.match(/## App thực hành[\s\S]*?\n(\|[\s\S]*?)\n\n/) || [, ''])[1] || '';
  const practiceBugs = [...bugBlock.matchAll(/^\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$/gm)]
    .map((r) => ({ bug: stripMd(r[1]), layer: stripMd(r[2]), blind: stripMd(r[3]), where: stripMd(r[4]) }))
    .filter((r) => r.bug && !/^-+$/.test(r.layer) && !/^Bug$/i.test(r.bug));

  /* Cây thư mục của kit — lấy NGUYÊN VĂN khối ``` để trang hiển thị đúng thụt lề.
     Mỗi dòng có "← Bài N" là một mốc: file này do bài nào tạo ra. */
  const treeBlock = (md.match(/## Cấu trúc thư mục của bộ kit[\s\S]*?```\n([\s\S]*?)```/) || [, ''])[1];
  if (!treeBlock) throw new Error('COURSE.md: không thấy khối cây thư mục trong "## Cấu trúc thư mục của bộ kit"');
  const kitTree = treeBlock.replace(/\s+$/, '');
  const treeLessonRefs = [...kitTree.matchAll(/←\s*Bài\s+(\d+)/g)].map((x) => Number(x[1]));
  if (treeLessonRefs.length < 10) {
    throw new Error(`COURSE.md: cây thư mục chỉ chú thích ${treeLessonRefs.length} nhánh theo bài — ` +
      'người học không biết nhánh nào do bài nào tạo');
  }

  // Ba chỗ hay xếp sai + ba thư mục không commit — hai bảng ngay sau cây
  const afterTree = md.slice(md.indexOf('```', md.indexOf('## Cấu trúc thư mục của bộ kit') + 40));
  const sortRules = [...afterTree.matchAll(/^\|\s*`([^`]+)`\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$/gm)]
    .map((r) => ({ dir: r[1], holds: stripMd(r[2]), question: stripMd(r[3]) }));

  // Bảng giờ theo phần
  const hoursBlock = (md.match(/## Tổng thời lượng:[\s\S]*?\n(\|[\s\S]*?)\n\n/) || [, ''])[1] || '';
  const partHours = {};
  for (const r of hoursBlock.matchAll(/^\|\s*(\d+)\.\s*([^|]*?)\s*\|\s*([\d.]+)\s*\|\s*$/gm)) {
    partHours[r[1]] = r[3];
  }

  /* ── Phần và bài ─────────────────────────────────────────────────────────── */

  const partChunks = md.split(/^## PHẦN /m).slice(1);
  if (!partChunks.length) throw new Error('COURSE.md: không thấy mục nào dạng "## PHẦN N — …"');

  const parts = [];
  let totalLessons = 0;

  for (const chunk of partChunks) {
    const nl = chunk.indexOf('\n');
    const head = chunk.slice(0, nl).trim();
    const hm = head.match(/^(\d+)\s*—\s*(.+?)(?:\s*\(([^)]*giờ)\))?$/);
    if (!hm) throw new Error('COURSE.md: tiêu đề phần sai quy ước "N — tên (X giờ)": ' + head);

    const lessons = [];
    for (const lc of chunk.split(/^### /m).slice(1)) {
      const lnl = lc.indexOf('\n');
      let lhead = lc.slice(0, lnl).trim();
      const body = lc.slice(lnl + 1);

      // ⭐ đánh dấu bài trọng tâm
      const star = lhead.includes('⭐');
      lhead = lhead.replace(/⭐/g, '').trim();

      // *(2.5h)* ở cuối tiêu đề
      const dm = lhead.match(/\*\((\d+(?:\.\d+)?h)\)\*\s*$/);
      const dur = dm ? dm[1] : null;
      if (dm) lhead = lhead.slice(0, dm.index).trim();

      // "[Bài 1 — Tên](course/slug.md)" hoặc "Bài 1 — Tên"
      let href = null;
      const lk = lhead.match(/^\[(.+?)\]\(([^)]+)\)$/);
      if (lk) { lhead = lk[1]; href = lk[2]; }

      const lm = lhead.match(/^Bài\s+(\d+)\s*—\s*(.+)$/);
      if (!lm) continue;                    // bỏ qua mục không phải bài

      if (href && !fs.existsSync(path.join(root, href))) {
        throw new Error(`COURSE.md: Bài ${lm[1]} trỏ tới file KHÔNG tồn tại — ${href}`);
      }
      if (!dur) throw new Error(`COURSE.md: Bài ${lm[1]} thiếu thời lượng "*(Xh)*" ở cuối tiêu đề`);

      const have = plain((body.match(/^\*Có gì trong tay:([^*]+)\*/m) || [, ''])[1]);
      if (!have) throw new Error(`COURSE.md: Bài ${lm[1]} thiếu dòng "*Có gì trong tay: …*"`);

      const bullets = [...body.matchAll(/^-\s+(.+)$/gm)].map((x) => classifyBullet(x[1]));
      if (!bullets.length) throw new Error(`COURSE.md: Bài ${lm[1]} không có gạch đầu dòng nội dung nào`);

      lessons.push({
        n: lm[1], title: stripMd(lm[2]), have: have, dur: dur,
        href: href, star: star, bullets: bullets
      });
      totalLessons++;
    }
    if (!lessons.length) throw new Error(`COURSE.md: PHẦN ${hm[1]} không có bài nào`);
    parts.push({ n: hm[1], title: hm[2].trim(), hours: hm[3] || partHours[hm[1]] || null, lessons: lessons });
  }

  // Số bài phải LIÊN TỤC, bắt đầu ở 0 (bài chuẩn bị) hoặc 1 — bắt đầu ở số khác nghĩa là
  // có bài rơi đâu mất mà không ai biết.
  const nums = parts.flatMap((p) => p.lessons.map((l) => Number(l.n)));
  const goc = nums[0];
  if (goc !== 0 && goc !== 1) throw new Error(`COURSE.md: bài đầu tiên phải là 0 hoặc 1, đang là ${goc}`);
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] !== goc + i) {
      throw new Error(`COURSE.md: số bài không liên tục — tới bài ${nums[i]} ở vị trí thứ ${i + 1} (chờ ${goc + i})`);
    }
  }

  /* Cây thư mục chú thích "← Bài N" thì bài N phải TỒN TẠI. Không kiểm thì đổi giáo trình một lần
     là cây trỏ vào bài đã biến mất, và người học đi tìm một bài không có. */
  const soBaiCo = new Set(nums);
  const treeSai = [...new Set(treeLessonRefs)].filter((n) => !soBaiCo.has(n));
  if (treeSai.length) {
    throw new Error('COURSE.md: cây thư mục trỏ tới bài KHÔNG tồn tại — Bài ' + treeSai.join(', '));
  }

  // Mọi phần phải khai được số giờ — thiếu thì bảng tổng thời lượng nói dối.
  const noHours = parts.filter((p) => !p.hours).map((p) => p.n);
  if (noHours.length) throw new Error('COURSE.md: PHẦN ' + noHours.join(', ') + ' không có số giờ');

  // "Học viên nhận được"
  const deliverBlock = (md.match(/## Học viên nhận được([\s\S]*?)\n---/) || [, ''])[1];
  const deliverables = [...deliverBlock.matchAll(/^-\s+(.+)$/gm)].map((x) => stripMd(x[1]));

  // "Quyết định thiết kế khoá học" — N. **tiêu đề** nội dung
  const designBlock = (md.match(/## Quyết định thiết kế khoá học([\s\S]*)$/) || [, ''])[1];
  const decisions = [...designBlock.matchAll(/^\*\*(\d+)\.\s*(.+?)\*\*([\s\S]*?)(?=\n\*\*\d+\.|\s*$)/gm)]
    .map((x) => ({ n: x[1], title: stripMd(x[2]), body: stripMd(x[3]) }));
  if (!decisions.length) throw new Error('COURSE.md: mục "Quyết định thiết kế khoá học" không đọc được mục nào');

  // Bài giảng đã viết nhưng chưa có chỗ trong giáo trình
  const orphanBlock = (md.match(/chưa có chỗ trong[\s\S]*?\n(\|[\s\S]*?)\n\n/) || [, ''])[1] || '';
  const orphans = [...orphanBlock.matchAll(/^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$/gm)]
    .map((r) => ({ title: plain(r[1]), href: r[2], what: stripMd(r[3]), suggest: stripMd(r[4]) }));
  for (const o of orphans) {
    if (!fs.existsSync(path.join(root, o.href))) {
      throw new Error(`COURSE.md: bài giảng chưa xếp chỗ trỏ tới file KHÔNG tồn tại — ${o.href}`);
    }
  }

  return {
    total, positioning, coreQuestion, outcomes, required, notRequired, warning,
    compare, practiceBugs, kitTree, sortRules, parts, deliverables, decisions, orphans,
    lessonCount: totalLessons
  };
}

module.exports = { parseCourse };
