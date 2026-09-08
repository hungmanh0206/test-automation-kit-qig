#!/usr/bin/env node
/*
 * course_maturity.js — sinh khối "Bộ kit của bạn đang ở đâu" cho từng bài giảng.
 *
 * VÌ SAO CÓ FILE NÀY: người đọc từ số 0 mất phương hướng ở khoảng bài thứ mười bảy. Họ không biết
 * còn bao nhiêu, và quan trọng hơn là không biết mình ĐÃ QUA được cái gì. Đo trên 43 bài: 43 bài
 * không có chỗ nào trả lời hai câu đó.
 *
 * VÌ SAO SINH TỰ ĐỘNG chứ không viết tay: khối này nhắc số bài, số cấp độ, tên bài kế tiếp — toàn
 * những thứ đã đổi ba lần trong một tuần. Viết tay thì nó trôi khỏi giáo trình và không ai biết.
 * Ở đây nó là lớp DẪN XUẤT của docs/COURSE.md, y như trang thư viện.
 *
 * Dùng:
 *   npm run course:maturity            ghi khối vào từng bài
 *   npm run course:maturity -- --check chặn nếu có bài lệch (dùng ở CI)
 * Mã thoát: 0 = khớp · 1 = có bài lệch · 2 = không đọc được nguồn.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const COURSE = path.join(ROOT, 'docs', 'COURSE.md');
const CHECK = process.argv.includes('--check');

const MOC = '## Bộ kit của bạn đang ở đâu';

/* Bốn cấp độ, và bài nào thuộc cấp nào. Khai ở ĐÂY vì COURSE.md chia theo PHẦN (5 phần) còn cấp độ
   gộp phần 3 với phần 4 — hai cách chia khác nhau, cố ý. */
const CAP_DO = [
  { n: 1, ten: 'AUTOMATE', tu: 1, den: 4, noiDuoc: 'Tôi chạy được test và tôi hiểu kết quả của nó.' },
  { n: 2, ten: 'BUILD', tu: 5, den: 11, noiDuoc: 'Tôi có một Test Kit.' },
  { n: 3, ten: 'CONTROL', tu: 12, den: 20, noiDuoc: 'Tôi có một QA workflow được enforce trong team.' },
  { n: 4, ten: 'EVOLVE', tu: 21, den: 29, noiDuoc: 'Tôi mở rộng, đo được độ tin cậy, tích luỹ learning và chứng minh reuse.' },
];

let md;
try {
  md = fs.readFileSync(COURSE, 'utf8');
} catch (e) {
  console.error('[maturity] không đọc được docs/COURSE.md — ' + e.message);
  process.exit(2);
}

const bai = [];
for (const m of md.matchAll(/^### \[Bài (\d+) — ([^\]]+)\]\((course\/[a-z0-9-]+\.md)\)/gm)) {
  bai.push({ n: Number(m[1]), ten: m[2].trim(), href: m[3] });
}
if (bai.length < 10) {
  console.error(`[maturity] chỉ đọc được ${bai.length} bài từ COURSE.md — nguồn hỏng?`);
  process.exit(2);
}
bai.sort((a, b) => a.n - b.n);
const tongBai = bai.length;

/** Thanh tiến độ bằng ký tự khối. Dài cố định để mọi bài xếp thẳng hàng khi đọc cạnh nhau. */
function thanh(daXong, tong, rong) {
  const day = Math.round((daXong / tong) * rong);
  return '█'.repeat(day) + '░'.repeat(Math.max(0, rong - day));
}

function khoiCho(b) {
  const cap = CAP_DO.find((c) => b.n >= c.tu && b.n <= c.den);
  const thuTuTrongCap = b.n - cap.tu + 1;
  const soBaiTrongCap = cap.den - cap.tu + 1;
  const ke = bai.find((x) => x.n === b.n + 1);

  const dong = [
    MOC,
    '',
    '```',
    `CẤP ĐỘ ${cap.n} · ${cap.ten}      bài ${thuTuTrongCap}/${soBaiTrongCap} của cấp độ này`,
    `${thanh(thuTuTrongCap, soBaiTrongCap, 28)}`,
    '',
    `cả tài liệu           bài ${b.n}/${tongBai}`,
    `${thanh(b.n, tongBai, 28)}`,
    '```',
    '',
    `**Hết cấp độ ${cap.n} bạn nói được:** ${cap.noiDuoc}`,
  ];

  if (thuTuTrongCap < soBaiTrongCap) {
    dong.push('');
    dong.push(`Cấp độ này còn ${soBaiTrongCap - thuTuTrongCap} bài nữa.`);
  } else if (ke) {
    const capKe = CAP_DO.find((c) => ke.n >= c.tu && ke.n <= c.den);
    dong.push('');
    dong.push(`Đây là bài cuối của cấp độ ${cap.n}. Bài ${ke.n} mở cấp độ ${capKe.n} · ${capKe.ten}.`);
  } else {
    dong.push('');
    dong.push('Đây là bài cuối của cả tài liệu.');
  }
  return dong.join('\n') + '\n';
}

/* Chèn khối NGAY TRƯỚC mục "Tự kiểm". Lý do chọn chỗ này: người đọc gặp nó sau khi đã làm xong việc,
   không phải lúc mới vào bài — lúc mới vào thì một thanh tiến độ chỉ làm họ thấy còn xa. */
const MOC_SAU = ['## Tự kiểm', '## Bài tập về nhà', '## Bài sau'];

const lech = [];
let daGhi = 0;

for (const b of bai) {
  const p = path.join(ROOT, 'docs', b.href);
  if (!fs.existsSync(p)) { lech.push(`${b.href}: không tồn tại`); continue; }
  let s = fs.readFileSync(p, 'utf8');
  const khoi = khoiCho(b);

  const i = s.indexOf(MOC);
  if (i >= 0) {
    /* Đã có khối: cắt tới mục tiếp theo rồi so. */
    const sau = s.slice(i + MOC.length);
    const j = sau.search(/\n## /);
    const cu = s.slice(i, j >= 0 ? i + MOC.length + j + 1 : s.length);
    if (cu.trim() === khoi.trim()) continue;
    if (CHECK) { lech.push(`${path.basename(b.href)}: khối độ chín đã cũ`); continue; }
    s = s.slice(0, i) + khoi + '\n' + s.slice(j >= 0 ? i + MOC.length + j + 1 : s.length);
  } else {
    if (CHECK) { lech.push(`${path.basename(b.href)}: thiếu khối độ chín`); continue; }
    let cho = -1;
    for (const m of MOC_SAU) { cho = s.indexOf('\n' + m); if (cho >= 0) break; }
    if (cho < 0) { lech.push(`${path.basename(b.href)}: không thấy chỗ chèn (thiếu cả Tự kiểm)`); continue; }
    s = s.slice(0, cho + 1) + khoi + '\n' + s.slice(cho + 1);
  }
  fs.writeFileSync(p, s);
  daGhi++;
}

if (CHECK) {
  if (lech.length) {
    console.error(`[maturity] ✗ CHẶN — ${lech.length} bài lệch khối độ chín:`);
    for (const l of lech.slice(0, 10)) console.error('  ' + l);
    console.error('  Chạy `npm run course:maturity` để sinh lại. Đừng sửa tay khối này.');
    process.exit(1);
  }
  console.log(`[maturity] ✓ ${tongBai} bài đều có khối độ chín khớp giáo trình.`);
  process.exit(0);
}

if (lech.length) {
  console.error(`[maturity] ${lech.length} bài không xử lý được:`);
  for (const l of lech) console.error('  ' + l);
}
console.log(`[maturity] đã ghi khối độ chín cho ${daGhi}/${tongBai} bài.`);
