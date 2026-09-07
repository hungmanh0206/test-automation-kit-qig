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

/* Tab "Hành trình" DẪN XUẤT từ docs/BUILD_JOURNAL.md — markdown là nguồn canonical, không chép tay sang
   file .js của trang (hai nguồn thì sẽ trôi). Parse lỗi thì build CHẾT, không sinh tab rỗng. */
/* Tab "Khoá học" cũng DẪN XUẤT — từ docs/COURSE.md. Cùng lý do một-nguồn. */
const { parseCourse } = require(path.join(SRC, 'course_parse.js'));
const COURSE_MD = path.join(ROOT, '..', 'COURSE.md');
let course;
try { course = parseCourse(COURSE_MD); }
catch (e) { console.error('LỖI đọc COURSE.md: ' + e.message); process.exit(1); }
const courseJs = '/* SINH TỰ ĐỘNG từ docs/COURSE.md — đừng sửa ở đây, sửa file markdown. */\n' +
  'const COURSE = ' + JSON.stringify(course) + ';\n';

const { parseJournal } = require(path.join(SRC, 'journal_parse.js'));
const JOURNAL_MD = path.join(ROOT, '..', 'BUILD_JOURNAL.md');
let journal;
try { journal = parseJournal(JOURNAL_MD); }
catch (e) { console.error('LỖI đọc BUILD_JOURNAL.md: ' + e.message); process.exit(1); }
const journalJs = '/* SINH TỰ ĐỘNG từ docs/BUILD_JOURNAL.md — đừng sửa ở đây, sửa file markdown. */\n' +
  'const JOURNAL = ' + JSON.stringify(journal) + ';\n';

let html = read('shell.html')
  .replace('/*__CSS__*/', () => read('style.css') + '\n' + read('style.extra.css'))
  .replace('__LOGO__', () => logo)
  .replace('/*__DATA__*/', () => courseJs + journalJs + DATA_FILES.map(read).join('\n'))
  .replace('/*__APP__*/', () => read('graph3d.js') + '\n' + read('app.js'));

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
