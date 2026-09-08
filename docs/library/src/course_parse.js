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
  const coreQuestion = stripMd((md.match(/\*\*Câu hỏi cốt lõi:\*\*(.+)/) || [, ''])[1]);

  // "Bạn làm được gì sau khi đọc hết" — danh sách ✅ ở cấp khoá
  const outcomeBlock = (md.match(/## Bạn làm được gì sau khi đọc hết([\s\S]*?)\n---/) || [, ''])[1];
  const outcomes = [...outcomeBlock.matchAll(/^✅\s*(.+)$/gm)].map((x) => stripMd(x[1]));
  if (!outcomes.length) throw new Error('COURSE.md: mục "Bạn làm được gì sau khi đọc hết" không có dòng ✅ nào');

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

  /* Vòng làm việc 6 chặng — nguồn của sơ đồ trên trang. Mỗi chặng PHẢI có cổng chặn:
     chặng không có cổng là chặng đi qua được mà không ai kiểm. */
  const flowBlock = (md.match(/## Một vòng làm việc trông thế nào[\s\S]*?\n(\|[\s\S]*?)\n\n/) || [, ''])[1] || '';
  const workflow = [...flowBlock.matchAll(
    /^\|\s*(\d+)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$/gm)]
    .map((r) => ({ n: r[1], stage: stripMd(r[2]), input: stripMd(r[3]), output: stripMd(r[4]),
                   gate: stripMd(r[5]), lessons: stripMd(r[6]) }));
  if (workflow.length < 4) {
    throw new Error(`COURSE.md: mục "Một vòng làm việc" chỉ đọc được ${workflow.length} chặng — cần ít nhất 4`);
  }
  const thieuCong = workflow.filter((w) => !w.gate).map((w) => w.n);
  if (thieuCong.length) {
    throw new Error('COURSE.md: chặng ' + thieuCong.join(', ') + ' không khai cổng chặn — ' +
      'chặng không có cổng là chặng đi qua được mà không ai kiểm');
  }

  /* Bốn mốc dừng được — thứ giúp người mới không nản khi thấy 59 giờ.
     Mỗi mốc phải nói DỪNG Ở ĐÂY CÓ GÌ, không chỉ nói tới bài mấy. */
  const mocBlock = (md.match(/## Bốn mốc dừng được[\s\S]*?\n(\|[\s\S]*?)\n\n/) || [, ''])[1] || '';
  const milestones = [...mocBlock.matchAll(
    /^\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$/gm)]
    .map((r) => ({ ten: stripMd(r[1]), toiBai: stripMd(r[2]), congDon: stripMd(r[3]), coGi: stripMd(r[4]),
                   trongTam: r[1].indexOf('⭐') >= 0 }))
    .filter((r) => r.ten && !/^-+$/.test(r.toiBai) && !/^Mốc$/i.test(r.ten));
  if (milestones.length < 3) {
    throw new Error(`COURSE.md: mục "Bốn mốc dừng được" chỉ đọc được ${milestones.length} mốc — cần ít nhất 3`);
  }

  /* "Bạn sẽ dựng cái gì" — khối console cho thấy kit CHẶN trông ra sao. Người mới cần thấy
     một lần trước khi đọc lý thuyết. */
  const demoBlock = (md.match(/## Bạn sẽ dựng cái gì[\s\S]*?```console\n([\s\S]*?)```/) || [, ''])[1];
  if (!demoBlock) throw new Error('COURSE.md: mục "Bạn sẽ dựng cái gì" thiếu khối ```console``` minh hoạ');
  const demo = demoBlock.replace(/\s+$/, '');

  /* Cây thư mục của kit — lấy NGUYÊN VĂN khối ``` để trang hiển thị đúng thụt lề.
     Mỗi dòng có "← Bài N" là một mốc: file này do bài nào tạo ra. */
  const treeBlock = (md.match(/## Cấu trúc thư mục của bộ kit[\s\S]*?```\n([\s\S]*?)```/) || [, ''])[1];
  if (!treeBlock) throw new Error('COURSE.md: không thấy khối cây thư mục trong "## Cấu trúc thư mục của bộ kit"');
  const kitTree = treeBlock.replace(/\s+$/, '');
  const treeLessonRefs = [...kitTree.matchAll(/←\s*Bài\s+(\d+)/g)].map((x) => Number(x[1]));
  if (treeLessonRefs.length < 10) {
    throw new Error(`COURSE.md: cây thư mục chỉ chú thích ${treeLessonRefs.length} nhánh theo bài — ` +
      'người đọc không biết nhánh nào do bài nào tạo');
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

    /* Tên phần trừu tượng ('Nền tảng tư duy') không nói người mới biết họ CÓ GÌ.
       Dòng này là bắt buộc, và phải nói bằng lời thường. */
    const xong = stripMd((chunk.match(/^>\s*\*\*Xong phần này bạn có:\*\*(.+)$/m) || [, ''])[1]);
    if (!xong) throw new Error(`COURSE.md: PHẦN ${hm[1]} thiếu dòng "> **Xong phần này bạn có:** …"`);

    const lessons = [];
    for (const lc of chunk.split(/^### /m).slice(1)) {
      const lnl = lc.indexOf('\n');
      let lhead = lc.slice(0, lnl).trim();
      const body = lc.slice(lnl + 1);

      // ⭐ đánh dấu bài trọng tâm
      const star = lhead.includes('⭐');
      lhead = lhead.replace(/⭐/g, '').trim();

      // *(2.5h)* ở cuối tiêu đề
      /* *(2.5h · khó)* — thời lượng + MỨC KHÓ. Mức khó gán tay theo nội dung, KHÔNG suy từ
         thời lượng: bài dài chưa chắc khó, và bài ngắn có thể rất dễ làm sai (vd Bài 10 oracle). */
      const dm = lhead.match(/\*\((\d+(?:\.\d+)?h)(?:\s*·\s*(dễ|vừa|khó))?\)\*\s*$/);
      const dur = dm ? dm[1] : null;
      const muc = dm ? (dm[2] || null) : null;
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
      if (!dur) throw new Error(`COURSE.md: Bài ${lm[1]} thiếu thời lượng "*(Xh · mức)*" ở cuối tiêu đề`);
      if (!muc) throw new Error(`COURSE.md: Bài ${lm[1]} thiếu MỨC KHÓ — viết "*(${dur} · dễ|vừa|khó)*". `
        + 'Không có mức thì người mới không biết bài nào lướt được, bài nào phải ngồi kỹ.');

      const have = plain((body.match(/^\*Có gì trong tay:([^*]+)\*/m) || [, ''])[1]);
      if (!have) throw new Error(`COURSE.md: Bài ${lm[1]} thiếu dòng "*Có gì trong tay: …*"`);

      const bullets = [...body.matchAll(/^-\s+(.+)$/gm)].map((x) => classifyBullet(x[1]));
      if (!bullets.length) throw new Error(`COURSE.md: Bài ${lm[1]} không có gạch đầu dòng nội dung nào`);

      /* Liên kết PHỤ: bài này còn dạy qua bài chi tiết nào nữa (khai ở bullet, vd Bài 13 trỏ sang
         evidence.md). Cần cho phép kiểm "cây thư mục khớp bài giảng" — một bài được dạy nội dung
         nằm ở bài chi tiết mà nó chỉ tới. Mọi liên kết phải còn sống. */
      const extraHrefs = [...new Set([...body.matchAll(/\]\((course\/[a-z0-9-]+\.md)\)/g)].map((x) => x[1]))]
        .filter((h) => h !== href);
      for (const h of extraHrefs) {
        if (!fs.existsSync(path.join(root, h))) {
          throw new Error(`COURSE.md: Bài ${lm[1]} có liên kết phụ trỏ tới file KHÔNG tồn tại — ${h}`);
        }
      }

      lessons.push({
        n: lm[1], title: stripMd(lm[2]), have: have, dur: dur, muc: muc,
        href: href, extraHrefs: extraHrefs, star: star, bullets: bullets
      });
      totalLessons++;
    }
    if (!lessons.length) throw new Error(`COURSE.md: PHẦN ${hm[1]} không có bài nào`);
    parts.push({ n: hm[1], title: hm[2].trim(), xong: xong, hours: hm[3] || partHours[hm[1]] || null, lessons: lessons });
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
     là cây trỏ vào bài đã biến mất, và người đọc đi tìm một bài không có. */
  const soBaiCo = new Set(nums);
  const treeSai = [...new Set(treeLessonRefs)].filter((n) => !soBaiCo.has(n));
  if (treeSai.length) {
    throw new Error('COURSE.md: cây thư mục trỏ tới bài KHÔNG tồn tại — Bài ' + treeSai.join(', '));
  }

  // Mọi phần phải khai được số giờ — thiếu thì bảng tổng thời lượng nói dối.
  const noHours = parts.filter((p) => !p.hours).map((p) => p.n);
  if (noHours.length) throw new Error('COURSE.md: PHẦN ' + noHours.join(', ') + ' không có số giờ');

  // "Bạn có gì sau khi làm hết"
  const deliverBlock = (md.match(/## Bạn có gì sau khi làm hết([\s\S]*?)\n---/) || [, ''])[1];
  const deliverables = [...deliverBlock.matchAll(/^-\s+(.+)$/gm)].map((x) => stripMd(x[1]));

  // "Quyết định thiết kế khoá học" — N. **tiêu đề** nội dung
  const designBlock = (md.match(/## Quyết định thiết kế tài liệu này([\s\S]*)$/) || [, ''])[1];
  const decisions = [...designBlock.matchAll(/^\*\*(\d+)\.\s*(.+?)\*\*([\s\S]*?)(?=\n\*\*\d+\.|\s*$)/gm)]
    .map((x) => ({ n: x[1], title: stripMd(x[2]), body: stripMd(x[3]) }));
  if (!decisions.length) throw new Error('COURSE.md: mục "Quyết định thiết kế tài liệu này" không đọc được mục nào');

  /* Bài chi tiết bổ trợ: không đánh số, nhưng được một bài có số trỏ tới. Phải NÊU RA, vì bài giảng
     tồn tại mà không ai dẫn tới thì bằng không tồn tại. */
  const orphanBlock = (md.match(/Bài chi tiết bổ trợ[\s\S]*?\n(\|[\s\S]*?)\n\n/) || [, ''])[1] || '';
  const orphans = [...orphanBlock.matchAll(/^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$/gm)]
    .map((r) => ({ title: plain(r[1]), href: r[2], what: stripMd(r[3]), suggest: stripMd(r[4]) }));
  for (const o of orphans) {
    if (!fs.existsSync(path.join(root, o.href))) {
      throw new Error(`COURSE.md: bài giảng chưa xếp chỗ trỏ tới file KHÔNG tồn tại — ${o.href}`);
    }
  }

  return {
    total, positioning, coreQuestion, outcomes, required, notRequired, warning,
    compare, practiceBugs, demo, milestones, workflow, kitTree, sortRules, parts, deliverables, decisions, orphans,
    lessonCount: totalLessons
  };
}

module.exports = { parseCourse };
