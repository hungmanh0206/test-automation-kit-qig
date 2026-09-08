#!/usr/bin/env node
/*
 * course_numbers.js — CHẶN "con số trong bài giảng không khớp sản phẩm thực hành".
 *
 * VÌ SAO CÓ FILE NÀY (đo được, đã trả giá): ví dụ trụ cột của cả tài liệu nằm ở Bài 1, và nó KHÔNG
 * chạy được. Năm chỗ lệch cùng lúc, tồn tại qua nhiều lượt commit, không phép kiểm nào bắt:
 *   · app đặt giá 250.000, bài giảng tính theo 225.000
 *   · app thu phí dịch vụ 30.000, bài giảng viết 50.000
 *   · app nhận trường `customerId`/`qty`, bài giảng viết `hocVienId`/`soSuat` — ai copy cũng lỗi
 *   · ví dụ "tạm tính đúng 520.000" KHÔNG dựng được từ bảng giá của app
 *   · và nặng nhất: với bộ dữ liệu bài giảng dùng, bug cài sẵn KHÔNG hề lộ ra — nên câu "app trả về
 *     khác con số bạn tính" là sai
 *
 * Không gate nào bắt được vì mọi phép kiểm cũ đọc VĂN BẢN. Cái thiếu là một phép kiểm CHẠY sản phẩm
 * rồi so con số.
 *
 * ĐO CÁI GÌ:
 *   1. Khởi động app thực hành, gọi API, so với bảng số CANONICAL khai ở dưới.
 *   2. Quét bài giảng tìm những con số ĐÃ CŨ (khai tường minh) — còn sót là chặn.
 * Mã thoát: 0 khớp · 1 lệch · 2 không đo được (không chạy nổi app).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const APP = path.join(ROOT, 'docs', 'course', 'assets', 'app-thuc-hanh', 'server.js');
const COURSE_DIR = path.join(ROOT, 'docs', 'course');
const PORT = Number(process.env.APP_PORT || 4099);

/* Bảng số CANONICAL. Mỗi dòng là một lượt gọi thật, và con số kỳ vọng SUY TỪ spec.md — không phải
   copy từ app. Chỗ `theoApp` khác `theoSpec` chính là bug cài sẵn, và nó PHẢI khác: một sản phẩm
   thực hành mà bug không lộ ra thì mọi phép đo trong tài liệu mất đối chứng. */
const CA = [
  {
    ten: 'Việc 2 của Bài 1 — bug PHẢI lộ ra',
    body: { hocVienId: 'HV03', items: [{ khoaHocId: 'KH01', soSuat: 2 }] },
    theoSpec: { tamTinh: 520000, giamGia: 26000, phiDichVu: 0, tongCong: 494000 },
    theoApp: { tamTinh: 520000, giamGia: 26000, phiDichVu: 50000, tongCong: 544000 },
    buglo: true,
  },
  {
    ten: 'Việc 3 của Bài 1 — ca phân biệt, app PHẢI khớp spec',
    body: { hocVienId: 'HV03', items: [{ khoaHocId: 'KH01', soSuat: 3 }] },
    theoSpec: { tamTinh: 780000, giamGia: 39000, phiDichVu: 0, tongCong: 741000 },
    theoApp: { tamTinh: 780000, giamGia: 39000, phiDichVu: 0, tongCong: 741000 },
    buglo: false,
  },
];

/* Con số của BẢN CŨ. Còn sót trong bài nào là bài đó đang dạy một phép tính không chạy được.
   Khai tường minh thay vì đoán bằng regex tiền tệ: đoán thì báo oan mọi con số hợp lệ. */
const SO_CU = ['225.000', '450.000', '13.500', '486.500', '515.000', '196.250'];
/* 8.750 KHÔNG nằm trong danh sách này: đã gọi app và xác nhận nó vẫn là giảm giá đúng của ca
   HV03 + KH03 ×1 (5% của 175.000). Bản đầu của gate xếp nó vào số cũ và báo oan 3 chỗ. */

function goi(body) {
  return new Promise((ok, loi) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { host: '127.0.0.1', port: PORT, path: '/api/quote', method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } },
      (res) => {
        let s = '';
        res.on('data', (c) => { s += c; });
        res.on('end', () => { try { ok(JSON.parse(s)); } catch (e) { loi(e); } });
      }
    );
    req.on('error', loi);
    req.write(data);
    req.end();
  });
}

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(APP)) {
    console.error('[so-lieu] ? KHÔNG ĐO ĐƯỢC — không thấy sản phẩm thực hành: ' + path.relative(ROOT, APP));
    process.exit(2);
  }

  const proc = spawn(process.execPath, [APP], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let loiApp = '';
  proc.stderr.on('data', (c) => { loiApp += c; });

  const van = [];
  try {
    /* Chờ app mở cổng. Thử lại thay vì ngủ một khoảng cố định: máy CI chậm hơn máy dev. */
    let song = false;
    for (let i = 0; i < 25 && !song; i++) {
      await cho(120);
      try { await goi(CA[0].body); song = true; } catch (e) { /* chưa mở, thử tiếp */ }
    }
    if (!song) {
      console.error('[so-lieu] ? KHÔNG ĐO ĐƯỢC — app không mở được cổng ' + PORT +
        (loiApp ? '\n  ' + loiApp.trim().split('\n')[0] : ''));
      proc.kill();
      process.exit(2);
    }

    for (const c of CA) {
      const r = await goi(c.body);
      const d = (r && r.data) || {};
      for (const k of Object.keys(c.theoApp)) {
        if (d[k] !== c.theoApp[k]) {
          van.push(`${c.ten}: app trả ${k}=${d[k]}, bảng canonical ghi ${c.theoApp[k]}`);
        }
      }
      /* Ca "bug phải lộ" thì app BẮT BUỘC khác spec. Nếu chúng trùng nhau thì sản phẩm thực hành đã
         mất bug, và cả tài liệu mất phép đối chứng — im lặng. */
      const khac = JSON.stringify(c.theoApp) !== JSON.stringify(c.theoSpec);
      if (c.buglo && !khac) van.push(`${c.ten}: app KHỚP spec, tức là bug cài sẵn đã biến mất`);
      if (!c.buglo && khac) van.push(`${c.ten}: app LỆCH spec, ca này đáng lẽ phải khớp`);
    }
  } finally {
    proc.kill();
  }

  /* Số cũ còn sót trong bài giảng. */
  const sot = [];
  for (const f of fs.readdirSync(COURSE_DIR).filter((x) => x.endsWith('.md'))) {
    if (f === 'TEMPLATE.md') continue;
    const noi = fs.readFileSync(path.join(COURSE_DIR, f), 'utf8');
    for (const s of SO_CU) {
      const n = noi.split(s).length - 1;
      if (n) sot.push(`${f}: còn ${n} lần "${s}"`);
    }
  }

  if (van.length || sot.length) {
    console.error('[so-lieu] ✗ CHẶN');
    if (van.length) {
      console.error('  App thực hành không khớp bảng canonical:');
      for (const v of van) console.error('    ' + v);
    }
    if (sot.length) {
      console.error(`  ${sot.length} chỗ còn con số của BẢN CŨ (phép tính đó không chạy được nữa):`);
      for (const s of sot.slice(0, 14)) console.error('    ' + s);
      if (sot.length > 14) console.error(`    … và ${sot.length - 14} chỗ nữa`);
    }
    process.exit(1);
  }

  console.log(`[so-lieu] ✓ ${CA.length} ca gọi app khớp bảng canonical, và bug cài sẵn vẫn lộ ra. ` +
    'Không bài nào còn con số của bản cũ.');
})();
