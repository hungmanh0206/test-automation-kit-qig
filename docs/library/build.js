#!/usr/bin/env node
/**
 * build.js — ghép src/ thành docs/library/index.html (một file duy nhất, self-contained).
 * Chạy: node docs/library/build.js
 *
 * Vì sao tách src/: data.js là phần người sửa thường xuyên (thêm/sửa thuật ngữ); style/app ổn định hơn.
 * Output cố tình KHÔNG phụ thuộc mạng (font hệ thống, logo nhúng base64) để mở offline hoặc host tĩnh đều chạy.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

// Thứ tự QUAN TRỌNG: _cats khai CATS, các nhóm khai TERMS_*, _merge gộp lại.
const DATA_FILES = ['terms/_cats.js','terms/rules.js','terms/gates.js','terms/gates_expansion.js','terms/gates_kit.js','terms/gates_knowledge.js','terms/skills.js',
  'terms/concepts.js','terms/concepts_expansion.js','terms/status.js','terms/flow.js','terms/flow_kit.js','terms/_merge.js','guide.js'];

const logo = 'data:image/png;base64,' +
  fs.readFileSync(path.join(ROOT, '..', 'brand', 'logo-sapp.png')).toString('base64');

/* Tab "Khoá học" DẪN XUẤT từ docs/COURSE.md — markdown là nguồn canonical, không chép tay sang
   file .js của trang (hai nguồn thì sẽ trôi). Parse lỗi thì build CHẾT, không sinh tab rỗng. */
const { parseCourse } = require(path.join(SRC, 'course_parse.js'));
const COURSE_MD = path.join(ROOT, '..', 'COURSE.md');
let course;
try { course = parseCourse(COURSE_MD); }
catch (e) { console.error('LỖI đọc COURSE.md: ' + e.message); process.exit(1); }
const courseJs = '/* SINH TỰ ĐỘNG từ docs/COURSE.md — đừng sửa ở đây, sửa file markdown. */\n' +
  'const COURSE = ' + JSON.stringify(course) + ';\n';

/* TOÀN VĂN 43 bài giảng, nhúng thẳng vào trang.
 *
 * VÌ SAO: tiêu đề bài trên trang trỏ tới `course/<slug>.md`. Trong repo thì bấm được, còn trang xuất
 * bản là MỘT file HTML tự chứa — không có tệp .md nào bên cạnh. Người đọc nhìn thấy 43 bài mà không
 * mở được bài nào, và đó là toàn bộ nội dung của tài liệu.
 *
 * Giá phải trả: khoảng 890 KB markdown, nên trang lên cỡ 1,2 MB. Đổi lại là trang tự chứa THẬT —
 * gửi qua chat, lưu offline, mở lại sau ba tháng đều đọc được đủ. */
const COURSE_DIR = path.join(ROOT, '..', 'course');
const lessons = {};
for (const f of fs.readdirSync(COURSE_DIR).filter((x) => x.endsWith('.md'))) {
  if (f === 'TEMPLATE.md') continue;
  const raw = fs.readFileSync(path.join(COURSE_DIR, f), 'utf8');
  const h1 = (raw.match(/^#\s+(.+)$/m) || ['', f])[1].trim();
  lessons[f.replace(/\.md$/, '')] = { t: h1, md: raw };
}
if (Object.keys(lessons).length < 20) {
  console.error('LỖI: chỉ đọc được ' + Object.keys(lessons).length + ' bài giảng trong docs/course/');
  process.exit(1);
}
const lessonJs = '/* SINH TỰ ĐỘNG từ docs/course/*.md — đừng sửa ở đây, sửa file markdown. */\n' +
  'const LESSONS = ' + JSON.stringify(lessons) + ';\n';

let html = read('shell.html')
  .replace('/*__CSS__*/', () => read('style.css') + '\n' + read('style.extra.css'))
  .replace('__LOGO__', () => logo)
  .replace('/*__DATA__*/', () => courseJs + lessonJs + DATA_FILES.map(read).join('\n'))
  .replace('/*__APP__*/', () => read('md.js') + '\n' + read('graph3d.js') + '\n' + read('app.js'));

// Kiểm cú pháp TỪNG file nguồn trước khi ghép. Ghép rồi mới lỗi thì thông báo trỏ vào file gộp,
// không biết hỏng ở file nào; mà một dấu nháy rơi trong data là cả trang chết trắng.
for (const f of DATA_FILES.concat(['app.js', 'graph3d.js'])) {
  try { new (require('vm').Script)(read(f), { filename: f }); }
  catch (e) { console.error('LỖI CÚ PHÁP ở ' + f + ': ' + e.message); process.exit(1); }
}

// Kiểm tra không còn placeholder nào sót — sót là trang vỡ im lặng.
const left = html.match(/__[A-Z]+__/g);
if (left) { console.error('CHƯA THAY placeholder:', left.join(', ')); process.exit(1); }

const out = path.join(ROOT, 'index.html');
fs.writeFileSync(out, html, 'utf8');

const n = DATA_FILES.map(f => (read(f).match(/^\{ id:/gm) || []).length).reduce((a, b) => a + b, 0);
console.log('OK  ' + path.relative(process.cwd(), out) +
  '  (' + (html.length / 1024).toFixed(1) + ' KB, ' + n + ' thuật ngữ)');
