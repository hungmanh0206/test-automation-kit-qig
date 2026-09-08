#!/usr/bin/env node
/*
 * course_numbers.js — CHẶN "ví dụ trong bài giảng không khớp sản phẩm thực hành".
 *
 * VÌ SAO CÓ FILE NÀY (đo được, đã trả giá hai lần):
 *
 * Lượt một — ví dụ trụ cột của cả tài liệu nằm ở Bài 1, và nó KHÔNG chạy được. Năm chỗ lệch cùng lúc,
 * tồn tại qua nhiều lượt commit, không phép kiểm nào bắt: giá trong app khác giá trong bài, tên trường
 * API khác, bộ dữ liệu của bài không dựng được từ bảng giá, và nặng nhất là bug cài sẵn KHÔNG hề lộ ra
 * với dữ liệu bài dùng — nên câu "app trả về khác con số bạn tính" là sai.
 *
 * Lượt hai — đổi nghiệp vụ sang vận hành lớp học thì lộ thêm: giao diện gửi `customerId`/`qty` trong khi
 * server đọc `hocVienId`/`soSuat`, tức là màn hình của app thực hành đã ngừng chạy từ trước đó, và bài
 * factory thì dạy một API (`POST /api/students`) mà app KHÔNG có.
 *
 * Không gate nào bắt được vì mọi phép kiểm cũ đọc VĂN BẢN. Cái thiếu là một phép kiểm CHẠY sản phẩm.
 *
 * ĐO CÁI GÌ:
 *   1. Khởi động app, gọi API, so với bảng CANONICAL — kết quả kỳ vọng suy từ spec.md.
 *   2. Chứng minh CẢ BA bug cài sẵn vẫn còn sống. Sản phẩm thực hành mất bug thì cả tài liệu mất đối chứng.
 *   3. Mọi đường API mà bài giảng gọi đều phải tồn tại thật.
 *   4. Quét bài giảng tìm dấu vết của nghiệp vụ CŨ — còn sót là chặn.
 * Mã thoát: 0 khớp · 1 lệch · 2 không đo được (không chạy nổi app).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const APP_DIR = path.join(ROOT, 'docs', 'course', 'assets', 'app-thuc-hanh');
const APP = path.join(APP_DIR, 'server.js');
const COURSE_DIR = path.join(ROOT, 'docs', 'course');
const PORT = Number(process.env.APP_PORT || 4099);

/* Bảng CANONICAL. Mỗi dòng là một lượt gọi thật. `theoSpec` suy từ spec.md — KHÔNG copy từ app.
   Chỗ `theoApp` khác `theoSpec` chính là bug cài sẵn, và nó PHẢI khác. */
const CA = [
  {
    ten: 'Bài 1 Việc 2 — bug PHẢI lộ ra (nhóm lớp mới có Foundation sớm hơn)',
    body: { hocVienId: 'HV01' },
    theoSpec: { lopCu: 'CFA01', lopMoc: 'CFA02', hanHienTai: '2026-07-31', hanMoi: '2026-08-31' },
    theoApp: { lopCu: 'CFA01', lopMoc: 'CFA02F', hanHienTai: '2026-07-31', hanMoi: '2026-06-30' },
    buglo: true,
  },
  {
    ten: 'Bài 1 Việc 3 — ca phân biệt, chỉ một lớp mới nên app PHẢI khớp spec',
    body: { hocVienId: 'HV03' },
    theoSpec: { lopCu: 'ACCA01', lopMoc: 'ACCA02', hanHienTai: '2026-07-31', hanMoi: '2026-08-31' },
    theoApp: { lopCu: 'ACCA01', lopMoc: 'ACCA02', hanHienTai: '2026-07-31', hanMoi: '2026-08-31' },
    buglo: false,
  },
  {
    ten: 'Bài 4 bài tập — nhánh chặn hạn âm (BR-05)',
    body: { hocVienId: 'HV02' },
    theoSpec: { lopCu: 'CFA03', lopMoc: 'CFA02', hanHienTai: '2026-12-31', hanMoi: '2026-09-01' },
    theoApp: { lopCu: 'CFA03', lopMoc: 'CFA02', hanHienTai: '2026-12-31', hanMoi: '2026-09-01' },
    buglo: false,
  },
];

/* Đường API bài giảng có gọi. Thiếu một đường là có bài đang dạy thứ không tồn tại. */
const DUONG_PHAI_CO = [
  ['GET', '/api/hoc-vien'], ['GET', '/api/lop'], ['GET', '/api/don-hoc-lai'],
  ['GET', '/api/lop/CFA01/hoc-vien'], ['GET', '/api/_store/ghi-danh'],
  ['POST', '/api/hoc-vien'], ['POST', '/api/lop'], ['POST', '/api/ghi-danh'],
  ['POST', '/api/don-hoc-lai'], ['POST', '/api/tinh-han'], ['POST', '/api/dong-bo-hoc-lai'],
  ['POST', '/api/gia-han'], ['POST', '/api/reset'],
];

/* Dấu vết của nghiệp vụ CŨ (cửa hàng bán lẻ). Khai tường minh thay vì đoán bằng regex tiền tệ:
   đoán thì báo oan mọi con số hợp lệ. */
const VET_CU = [
  'tamTinh', 'phiDichVu', 'giamGia', 'tongCong', 'tongTien', 'api/quote', 'api/orders',
  'api/students', 'api/courses', 'customerId', 'productId', 'Cổng đăng ký khoá học',
  'tam-tinh', 'tong-cong', 'tong-tien', 'KH_BAC_01', 'SP_A', 'DH0001',
  '225.000', '450.000', '13.500', '486.500', '515.000', '196.250', '494.000', '544.000', '321.000',
];

function goi(cach, duong, body) {
  return new Promise((ok, loi) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      { host: '127.0.0.1', port: PORT, path: duong, method: cach,
        headers: data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {} },
      (res) => {
        let s = '';
        res.on('data', (c) => { s += c; });
        res.on('end', () => {
          let j = null;
          try { j = JSON.parse(s); } catch (e) { /* không phải JSON — trả nguyên trạng */ }
          ok({ ma: res.statusCode, body: j, tho: s });
        });
      }
    );
    req.on('error', loi);
    if (data) req.write(data);
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
      try { const r = await goi('GET', '/api/hoc-vien'); song = r.ma === 200; } catch (e) { /* chưa mở */ }
    }
    if (!song) {
      console.error('[so-lieu] ? KHÔNG ĐO ĐƯỢC — app không mở được cổng ' + PORT +
        (loiApp ? '\n  ' + loiApp.trim().split('\n')[0] : ''));
      proc.kill();
      process.exit(2);
    }

    /* ── 1 + 2a. Bảng canonical, và bug số 1 phải còn sống ─────────────────── */
    await goi('POST', '/api/reset', {});
    for (const c of CA) {
      const r = await goi('POST', '/api/tinh-han', c.body);
      const d = (r.body && r.body.data) || {};
      for (const k of Object.keys(c.theoApp)) {
        if (d[k] !== c.theoApp[k]) {
          van.push(`${c.ten}: app trả ${k}=${JSON.stringify(d[k])}, bảng canonical ghi ${JSON.stringify(c.theoApp[k])}`);
        }
      }
      const khac = JSON.stringify(c.theoApp) !== JSON.stringify(c.theoSpec);
      if (c.buglo && !khac) van.push(`${c.ten}: app KHỚP spec, tức là bug cài sẵn đã biến mất`);
      if (!c.buglo && khac) van.push(`${c.ten}: app LỆCH spec, ca này đáng lẽ phải khớp`);
    }

    /* ── 2b. Bug số 3 — chốt trạng thái vẫn phải THIẾU ở backend ───────────── */
    await goi('POST', '/api/reset', {});
    const db = await goi('POST', '/api/dong-bo-hoc-lai', { hocVienId: 'HV01' });
    const gdId = db.body && db.body.data && db.body.data.id;
    if (!gdId || db.body.data.type !== 'RETOOK') {
      van.push('BUG-3: không dựng được ghi danh loại RETOOK để thử chốt trạng thái');
    } else {
      const patch = await goi('PATCH', '/api/ghi-danh/' + gdId, { type: 'NORMAL' });
      if (patch.ma >= 400) van.push(`BUG-3a đã biến mất: PATCH RETOOK→NORMAL trả ${patch.ma}, đáng lẽ phải là 200`);
      await goi('POST', '/api/reset', {});
      await goi('POST', '/api/dong-bo-hoc-lai', { hocVienId: 'HV01' });
      const xoa = await goi('DELETE', '/api/ghi-danh/' + gdId);
      if (xoa.ma >= 400) van.push(`BUG-3b đã biến mất: DELETE ghi danh RETOOK trả ${xoa.ma}, đáng lẽ phải là 200`);
    }

    /* ── 2c. Bug số 2 — nằm ở tầng hiển thị, đo bằng nguồn của chính nó ─────
       Không mở trình duyệt ở gate này (verify.js lo phần đó), nhưng vẫn phải chắc dòng cài bug
       còn nguyên: giao diện cộng số ngày gia hạn vào hạn của LỚP thay vì hạn của GHI DANH. */
    const fe = fs.readFileSync(path.join(APP_DIR, 'app.js'), 'utf8');
    if (!/congNgay\(lop\.ketThuc,\s*g\.giaHan\)/.test(fe)) {
      van.push('BUG-2 đã biến mất khỏi app.js: giao diện không còn cộng gia hạn vào hạn của LỚP');
    }

    /* ── 3. Mọi đường API bài giảng gọi đều phải tồn tại ───────────────────── */
    await goi('POST', '/api/reset', {});
    for (const [cach, duong] of DUONG_PHAI_CO) {
      const r = await goi(cach, duong, cach === 'POST' ? {} : null);
      if (r.ma === 404 && /^không có đường này/.test(r.tho)) {
        van.push(`${cach} ${duong}: app KHÔNG có đường này, nhưng bài giảng có gọi`);
      }
    }
  } finally {
    proc.kill();
  }

  /* ── 4. Dấu vết nghiệp vụ cũ còn sót trong bài giảng ─────────────────────── */
  const sot = [];
  const quet = (thuMuc) => {
    for (const f of fs.readdirSync(thuMuc)) {
      const p = path.join(thuMuc, f);
      if (fs.statSync(p).isDirectory()) { if (f !== 'app-thuc-hanh') quet(p); continue; }
      if (!f.endsWith('.md') || f === 'TEMPLATE.md') continue;
      const noi = fs.readFileSync(p, 'utf8');
      for (const v of VET_CU) {
        const n = noi.split(v).length - 1;
        if (n) sot.push(`${path.relative(COURSE_DIR, p)}: còn ${n} lần "${v}"`);
      }
    }
  };
  quet(COURSE_DIR);

  if (van.length || sot.length) {
    console.error('[so-lieu] ✗ CHẶN');
    if (van.length) {
      console.error('  App thực hành không khớp bảng canonical:');
      for (const v of van) console.error('    ' + v);
    }
    if (sot.length) {
      console.error(`  ${sot.length} chỗ còn dấu vết nghiệp vụ CŨ (ví dụ đó không chạy được nữa):`);
      for (const s of sot.slice(0, 14)) console.error('    ' + s);
      if (sot.length > 14) console.error(`    … và ${sot.length - 14} chỗ nữa`);
    }
    process.exit(1);
  }

  console.log(`[so-lieu] ✓ ${CA.length} ca gọi app khớp bảng canonical · cả 3 bug cài sẵn còn sống · ` +
    `${DUONG_PHAI_CO.length} đường API bài giảng gọi đều tồn tại · không bài nào còn dấu vết nghiệp vụ cũ.`);
})();
