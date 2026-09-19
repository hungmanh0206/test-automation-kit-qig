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
/*
 * CHUẨN HOÁ CRLF NGAY Ở CỬA ĐỌC — nếu không, bản build PHỤ THUỘC NỀN.
 *
 * Đo 08/09/2026: nội dung bài học đi qua JSON.stringify nên \r sống sót thành escape trong chuỗi JS.
 * Checkout trên Windows (core.autocrlf) cho ra index.html KHÁC bản build trên Linux, dù nguồn y hệt.
 * Hệ quả: phép đối chiếu nội dung của `--check` sẽ đỏ ở Windows mà xanh ở CI — đúng kiểu sai đã làm
 * mất tin vào gate này một lần. Chuẩn hoá ở đây khiến output chỉ phụ thuộc NỘI DUNG, không phụ thuộc
 * cách git checkout.
 */
const norm = (s) => s.replace(/\r\n/g, "\n");
const read = f => norm(fs.readFileSync(path.join(SRC, f), 'utf8'));

// Thứ tự QUAN TRỌNG: _cats khai CATS, các nhóm khai TERMS_*, _merge gộp lại.
const DATA_FILES = ['terms/_cats.js','terms/rules.js','terms/gates.js','terms/gates_expansion.js','terms/gates_kit.js','terms/gates_knowledge.js','terms/gates_do_luong.js','terms/skills.js',
  'terms/concepts.js','terms/concepts_expansion.js','terms/status.js','terms/flow.js','terms/flow_kit.js','terms/_merge.js','guide.js'];

/* Không nhúng logo: trang này dùng chung bảng màu trung tính với ảnh User Guide (19/09/2026). */

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
  const raw = norm(fs.readFileSync(path.join(COURSE_DIR, f), 'utf8'));
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

/*
 * `--check`: ghép trong bộ nhớ rồi ĐỐI CHIẾU NỘI DUNG với index.html, không ghi gì.
 *
 * Vì sao cần: `library_drift` trước đây hỏi "bản build có mới hơn nguồn không" bằng mtime. Sai trên CI
 * một cách luôn-đỏ, vì git không giữ mtime nên sau clone thì mtime chỉ là thứ tự checkout. Chuyển sang
 * so thời điểm commit thì hết đỏ oan, nhưng lại sinh lỗi ngược: commit một file nguồn mà output KHÔNG
 * đổi (vd chỉ thêm ghi chú) sẽ làm index.html trông như cũ hơn mãi mãi.
 *
 * So nội dung không có cả hai lỗi đó, và build này đã đo là TẤT ĐỊNH (hai lượt cho ra byte giống nhau)
 * nên so được. Dùng chính đường ghép thật, không nhân bản logic sang gate.
 */
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (norm(cur) !== norm(html)) {   // `norm` khai ở đầu file, dùng chung với cửa đọc
    console.error('index.html KHÔNG khớp nguồn — chạy `node docs/library/build.js` rồi commit lại.');
    process.exit(1);
  }
  console.log('OK  index.html khớp nguồn (' + DATA_FILES.length + ' file dữ liệu)');
  process.exit(0);
}

fs.writeFileSync(out, html, 'utf8');

const n = DATA_FILES.map(f => (read(f).match(/^\{ id:/gm) || []).length).reduce((a, b) => a + b, 0);
console.log('OK  ' + path.relative(process.cwd(), out) +
  '  (' + (html.length / 1024).toFixed(1) + ' KB, ' + n + ' thuật ngữ)');
