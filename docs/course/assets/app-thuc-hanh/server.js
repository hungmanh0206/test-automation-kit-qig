/*
 * Vận hành lớp học — app thực hành cho tài liệu này.
 *
 * Chạy:  node docs/course/assets/app-thuc-hanh/server.js
 * Mở:    http://localhost:4010
 *
 * Chỉ dùng thư viện có sẵn của Node. Không cần cài gì.
 * Dữ liệu nằm trong bộ nhớ — tắt server là mất, chạy lại là sạch. Bạn không phá được gì.
 *
 * VÌ SAO LẠI LÀ NGHIỆP VỤ NÀY. Một trung tâm luyện thi mở lớp theo khoá. Học viên học không kịp
 * thì đăng ký HỌC LẠI ở khoá sau, và lúc đó hệ thống phải CẮT HẠN TRUY CẬP lớp cũ lại cho khớp
 * với lớp mới. Đó là loại việc mà quy tắc nghe rất gọn khi đọc, nhưng lúc kiểm thì lộ ra ba bốn
 * nhánh, một cái biên, và một chỗ dễ lấy sai mốc. Cả tài liệu neo mọi ví dụ vào đây.
 *
 * ⚠ APP NÀY CÓ 3 BUG CÀI SẴN, CỐ Ý.
 *   Đáp án nằm ở BUGS.md — ĐỪNG mở trước khi làm hết Phần 3.
 *   Bạn biết trước là "có 3 bug", nên nếu bộ kiểm của bạn không bắt được, bạn biết chắc
 *   lỗi ở bộ kiểm, không ở app. Đó gọi là ĐỐI CHỨNG.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 4010);
const GOC = __dirname;

/* ── Ngày ────────────────────────────────────────────────────────────────────
 * Mọi ngày lưu dạng 'YYYY-MM-DD' và tính ở MỨC NGÀY. Không giờ, không múi giờ.
 * Đây là lựa chọn cố ý: hạn truy cập là khái niệm theo ngày, và trộn giờ vào là tự tạo
 * một loại lệch mà chính người kiểm sẽ mất buổi chiều để truy.
 */
const NGAY = 86400000;
const soNgay = (s) => Date.parse(s + 'T00:00:00Z');
const raNgay = (t) => new Date(t).toISOString().slice(0, 10);
const congNgay = (s, n) => raNgay(soNgay(s) + n * NGAY);

/* ── Dữ liệu ────────────────────────────────────────────────────────────────── */

let HOC_VIEN = [
  { id: 'HV01', ten: 'Nguyễn Văn A' },
  { id: 'HV02', ten: 'Trần Thị B' },
  { id: 'HV03', ten: 'Lê Văn C' }
];

/* loai: LESSON là lớp học chính. FOUNDATION và REVISION là lớp đi kèm — cùng môn, nhưng
   KHÔNG phải lớp học chính. Sự phân biệt này chính là chỗ BR-02 nói tới. */
let LOP = [
  { ma: 'CFA01', ten: 'CFA Level 1 — khoá Xuân', loai: 'LESSON', batDau: '2026-03-01', ketThuc: '2026-07-31' },
  { ma: 'CFA02', ten: 'CFA Level 1 — khoá Thu', loai: 'LESSON', batDau: '2026-09-01', ketThuc: '2026-12-31' },
  { ma: 'CFA02F', ten: 'CFA Level 1 — Foundation khoá Thu', loai: 'FOUNDATION', batDau: '2026-07-01', ketThuc: '2026-08-31' },
  { ma: 'CFA03', ten: 'CFA Level 1 — khoá Thu (lớp 2)', loai: 'LESSON', batDau: '2026-09-01', ketThuc: '2026-12-31' },
  { ma: 'ACCA01', ten: 'ACCA F2 — khoá Xuân', loai: 'LESSON', batDau: '2026-03-01', ketThuc: '2026-07-31' },
  { ma: 'ACCA02', ten: 'ACCA F2 — khoá Thu', loai: 'LESSON', batDau: '2026-09-01', ketThuc: '2026-12-31' }
];

/* Đơn học lại: học viên này xin học lại lớp cũ nào, và đã được xếp vào những lớp mới nào. */
let DON_HOC_LAI = [
  { hocVienId: 'HV01', lopCu: 'CFA01', lopMoi: ['CFA02F', 'CFA02'] },
  { hocVienId: 'HV02', lopCu: 'CFA03', lopMoi: ['CFA02'] },
  { hocVienId: 'HV03', lopCu: 'ACCA01', lopMoi: ['ACCA02'] }
];

const layLop = (ma) => LOP.find((l) => l.ma === ma);

/* Ghi danh = một học viên trong một lớp. Mỗi ghi danh có THỜI HẠN RIÊNG, không nhất thiết
   trùng thời hạn của lớp — đó là lý do có bug số 2. */
let ghiDanh = [];
let demId = 0;
let demHV = 0;
let demLop = 0;

const HOC_VIEN_GOC = JSON.parse(JSON.stringify(HOC_VIEN));
const LOP_GOC = JSON.parse(JSON.stringify(LOP));
const DON_GOC = JSON.parse(JSON.stringify(DON_HOC_LAI));

function dungLaiDuLieu() {
  HOC_VIEN = JSON.parse(JSON.stringify(HOC_VIEN_GOC));
  LOP = JSON.parse(JSON.stringify(LOP_GOC));
  DON_HOC_LAI = JSON.parse(JSON.stringify(DON_GOC));
  ghiDanh = [];
  demId = 0;
  demHV = 0;
  demLop = 0;
  const them = (hocVienId, lopMa) => {
    const l = layLop(lopMa);
    ghiDanh.push({
      id: 'GD' + String(++demId).padStart(3, '0'),
      hocVienId,
      lopMa,
      type: 'NORMAL',          // BR-01
      batDau: l.batDau,
      ketThuc: l.ketThuc,
      giaHan: 0,
      lyDoGiaHan: '',
      lichSu: []
    });
  };
  them('HV01', 'CFA01');
  them('HV02', 'CFA03');
  them('HV03', 'ACCA01');
}
dungLaiDuLieu();

/* ── Luật nghiệp vụ ─────────────────────────────────────────────────────────── */

/*
 * Cắt hạn lớp cũ theo lớp mới. Đọc kèm spec.md — BR-02 tới BR-06.
 *
 * Trả về cả LỚP MỐC đã chọn, không chỉ trả ngày. Một API chỉ trả kết quả cuối thì lúc lệch
 * bạn không biết nó lệch ở bước nào; trả cả bước trung gian thì phán được ngay.
 */
function tinhHan(hocVienId) {
  const don = DON_HOC_LAI.find((d) => d.hocVienId === hocVienId);
  if (!don) return null;

  const gd = ghiDanh.find((g) => g.hocVienId === hocVienId && g.lopMa === don.lopCu);
  if (!gd) return null;

  const dsLopMoi = don.lopMoi.map(layLop).filter(Boolean);

  // BR-06: chưa được xếp vào lớp mới nào thì giữ nguyên hạn.
  if (!dsLopMoi.length) {
    return { lopCu: don.lopCu, lopMoc: null, hanHienTai: gd.ketThuc, hanMoi: gd.ketThuc, lyDo: 'chưa có lớp mới' };
  }

  // BR-02: mốc là lớp mới LOẠI LESSON có ngày bắt đầu sớm nhất.
  const ungVien = [...dsLopMoi].sort((a, b) => soNgay(a.batDau) - soNgay(b.batDau));
  const lopMoc = ungVien[0];

  // BR-03: hạn mới = ngày bắt đầu của lớp mốc trừ 1 ngày.
  let hanMoi = congNgay(lopMoc.batDau, -1);

  // BR-05: chặn hạn âm.
  let lyDo = 'cắt theo lớp mốc';
  if (soNgay(hanMoi) < soNgay(gd.batDau)) {
    hanMoi = gd.batDau;
    lyDo = 'chặn hạn âm — lấy ngày bắt đầu lớp cũ';
  }

  return { lopCu: don.lopCu, lopMoc: lopMoc.ma, lopMocLoai: lopMoc.loai, hanHienTai: gd.ketThuc, hanMoi, lyDo };
}

/* BR-10: ngày hết hạn = hạn của ghi danh + số ngày gia hạn. */
const ngayHetHan = (gd) => congNgay(gd.ketThuc, gd.giaHan);

/* ── Tiện ích HTTP ──────────────────────────────────────────────────────────── */

function traJson(res, ma, data) {
  const body = JSON.stringify(data);
  res.writeHead(ma, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function docBody(req) {
  return new Promise((giai, tuChoi) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 1e6) tuChoi(new Error('body quá lớn')); });
    req.on('end', () => { try { giai(s ? JSON.parse(s) : {}); } catch (e) { tuChoi(e); } });
  });
}

function traFile(res, ten, kieu) {
  const p = path.join(GOC, ten);
  if (!fs.existsSync(p)) { res.writeHead(404); res.end('không thấy ' + ten); return; }
  res.writeHead(200, { 'Content-Type': kieu + '; charset=utf-8' });
  res.end(fs.readFileSync(p));
}

/* ── Định tuyến ─────────────────────────────────────────────────────────────── */

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const duong = u.pathname;
  const cach = req.method;

  try {
    if (cach === 'GET' && (duong === '/' || duong === '/index.html')) return traFile(res, 'index.html', 'text/html');
    if (cach === 'GET' && duong === '/app.js') return traFile(res, 'app.js', 'text/javascript');

    if (cach === 'GET' && duong === '/api/hoc-vien') return traJson(res, 200, { data: HOC_VIEN });
    if (cach === 'GET' && duong === '/api/lop') return traJson(res, 200, { data: LOP });
    if (cach === 'GET' && duong === '/api/don-hoc-lai') return traJson(res, 200, { data: DON_HOC_LAI });

    /* Danh sách học viên trong một lớp — đây là nguồn của bảng trên màn hình. */
    if (cach === 'GET' && /^\/api\/lop\/[^/]+\/hoc-vien$/.test(duong)) {
      const ma = duong.split('/')[3];
      if (!layLop(ma)) return traJson(res, 404, { error: 'không thấy lớp' });
      const rows = ghiDanh.filter((g) => g.lopMa === ma).map((g) => ({
        ...g,
        hocVienTen: (HOC_VIEN.find((h) => h.id === g.hocVienId) || {}).ten,
        ngayHetHan: ngayHetHan(g)
      }));
      return traJson(res, 200, { data: rows });
    }

    /* ── Đường DỰNG dữ liệu ───────────────────────────────────────────────
     * Có mặt để bài factory và bài fixture dựng được dữ liệu của riêng lượt chạy,
     * thay vì mượn bản ghi có sẵn trên môi trường. Ở hệ thống thật đây là API nội bộ
     * hoặc luồng đồng bộ — không phải câu lệnh vào tầng lưu trữ.
     */
    if (cach === 'POST' && duong === '/api/hoc-vien') {
      const b = await docBody(req);
      if (!b.ten || !String(b.ten).trim()) return traJson(res, 400, { error: 'phải có tên học viên' });
      const hv = { id: 'HV' + String(100 + ++demHV), ten: String(b.ten) };
      HOC_VIEN.push(hv);
      return traJson(res, 201, { data: hv });
    }

    if (cach === 'DELETE' && /^\/api\/hoc-vien\/[^/]+$/.test(duong)) {
      const id = duong.split('/').pop();
      const i = HOC_VIEN.findIndex((h) => h.id === id);
      if (i < 0) return traJson(res, 404, { error: 'không thấy học viên' });
      HOC_VIEN.splice(i, 1);
      ghiDanh = ghiDanh.filter((g) => g.hocVienId !== id);
      DON_HOC_LAI = DON_HOC_LAI.filter((d) => d.hocVienId !== id);
      return traJson(res, 200, { data: { daXoa: id } });
    }

    if (cach === 'POST' && duong === '/api/lop') {
      const b = await docBody(req);
      const loai = b.loai || 'LESSON';
      if (!['LESSON', 'FOUNDATION', 'REVISION'].includes(loai)) {
        return traJson(res, 400, { error: 'loại lớp phải là LESSON, FOUNDATION hoặc REVISION' });
      }
      for (const k of ['batDau', 'ketThuc']) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b[k] || ''))) {
          return traJson(res, 400, { error: `${k} phải có dạng YYYY-MM-DD` });
        }
      }
      const l = { ma: 'LOP' + String(100 + ++demLop), ten: b.ten || 'Lớp không tên', loai,
        batDau: b.batDau, ketThuc: b.ketThuc };
      LOP.push(l);
      return traJson(res, 201, { data: l });
    }

    if (cach === 'DELETE' && /^\/api\/lop\/[^/]+$/.test(duong)) {
      const ma = duong.split('/').pop();
      const i = LOP.findIndex((l) => l.ma === ma);
      if (i < 0) return traJson(res, 404, { error: 'không thấy lớp' });
      LOP.splice(i, 1);
      ghiDanh = ghiDanh.filter((g) => g.lopMa !== ma);
      return traJson(res, 200, { data: { daXoa: ma } });
    }

    if (cach === 'POST' && duong === '/api/ghi-danh') {
      const b = await docBody(req);
      const hv = HOC_VIEN.find((h) => h.id === b.hocVienId);
      const l = layLop(b.lopMa);
      if (!hv) return traJson(res, 400, { error: 'học viên không tồn tại' });
      if (!l) return traJson(res, 400, { error: 'lớp không tồn tại' });
      if (ghiDanh.some((g) => g.hocVienId === hv.id && g.lopMa === l.ma)) {
        return traJson(res, 409, { error: 'học viên đã có trong lớp này' });
      }
      const gd = { id: 'GD' + String(++demId).padStart(3, '0'), hocVienId: hv.id, lopMa: l.ma,
        type: 'NORMAL', batDau: l.batDau, ketThuc: l.ketThuc, giaHan: 0, lyDoGiaHan: '', lichSu: [] };
      ghiDanh.push(gd);
      return traJson(res, 201, { data: { ...gd, ngayHetHan: ngayHetHan(gd) } });
    }

    if (cach === 'POST' && duong === '/api/don-hoc-lai') {
      const b = await docBody(req);
      if (!ghiDanh.some((g) => g.hocVienId === b.hocVienId && g.lopMa === b.lopCu)) {
        return traJson(res, 400, { error: 'học viên chưa có ghi danh ở lớp cũ' });
      }
      const lopMoi = Array.isArray(b.lopMoi) ? b.lopMoi.filter(layLop) : [];
      DON_HOC_LAI = DON_HOC_LAI.filter((d) => d.hocVienId !== b.hocVienId);
      const don = { hocVienId: b.hocVienId, lopCu: b.lopCu, lopMoi };
      DON_HOC_LAI.push(don);
      return traJson(res, 201, { data: don });
    }

    /* TÍNH hạn mới mà KHÔNG ghi gì. Màn hình gọi API này để xem trước, và bài học đầu tiên
       của tài liệu cũng gọi đúng nó — vì nó cho phép so con số mà không làm bẩn dữ liệu. */
    if (cach === 'POST' && duong === '/api/tinh-han') {
      const b = await docBody(req);
      const kq = tinhHan(b.hocVienId);
      if (!kq) return traJson(res, 400, { error: 'không có đơn học lại cho học viên này' });
      return traJson(res, 200, { data: kq });
    }

    /* ÁP hạn mới: đổi type sang RETOOK và ghi hạn. */
    if (cach === 'POST' && duong === '/api/dong-bo-hoc-lai') {
      const b = await docBody(req);
      const kq = tinhHan(b.hocVienId);
      if (!kq) return traJson(res, 400, { error: 'không có đơn học lại cho học viên này' });
      const gd = ghiDanh.find((g) => g.hocVienId === b.hocVienId && g.lopMa === kq.lopCu);
      gd.lichSu.unshift({ tu: gd.batDau, den: gd.ketThuc, lyDo: 'đồng bộ học lại', boi: 'hệ thống' });
      gd.type = 'RETOOK';
      gd.ketThuc = kq.hanMoi;
      return traJson(res, 200, { data: { ...gd, ngayHetHan: ngayHetHan(gd), lopMoc: kq.lopMoc } });
    }

    /* Gia hạn thêm ngày — BR-09, BR-10. */
    if (cach === 'POST' && duong === '/api/gia-han') {
      const b = await docBody(req);
      const gd = ghiDanh.find((g) => g.id === b.ghiDanhId);
      if (!gd) return traJson(res, 404, { error: 'không thấy ghi danh' });
      if (!Number.isInteger(b.soNgay) || b.soNgay < 1 || b.soNgay > 180) {
        return traJson(res, 400, { error: 'Số ngày gia hạn phải từ 1 đến 180' });
      }
      if (!b.lyDo || !String(b.lyDo).trim()) {
        return traJson(res, 400, { error: 'Phải nhập lý do gia hạn' });
      }
      if (String(b.lyDo).length > 60) {
        return traJson(res, 400, { error: 'Lý do gia hạn tối đa 60 ký tự' });
      }
      gd.lichSu.unshift({ tu: gd.batDau, den: ngayHetHan(gd), lyDo: b.lyDo, boi: 'người dùng' });
      gd.giaHan += b.soNgay;
      gd.lyDoGiaHan = b.lyDo;
      return traJson(res, 200, { data: { ...gd, ngayHetHan: ngayHetHan(gd) } });
    }

    if (cach === 'GET' && /^\/api\/ghi-danh\/[^/]+\/lich-su$/.test(duong)) {
      const id = duong.split('/')[3];
      const gd = ghiDanh.find((g) => g.id === id);
      if (!gd) return traJson(res, 404, { error: 'không thấy ghi danh' });
      return traJson(res, 200, { data: gd.lichSu });
    }

    /* BR-08: học viên type RETOOK KHÔNG có đường về NORMAL. */
    if (cach === 'PATCH' && /^\/api\/ghi-danh\/[^/]+$/.test(duong)) {
      const id = duong.split('/').pop();
      const gd = ghiDanh.find((g) => g.id === id);
      if (!gd) return traJson(res, 404, { error: 'không thấy ghi danh' });
      const b = await docBody(req);
      if (b.type) gd.type = b.type;
      if (b.ketThuc) gd.ketThuc = b.ketThuc;
      return traJson(res, 200, { data: { ...gd, ngayHetHan: ngayHetHan(gd) } });
    }

    /* BR-07: học viên type khác NORMAL thì không xoá được khỏi lớp. */
    if (cach === 'DELETE' && /^\/api\/ghi-danh\/[^/]+$/.test(duong)) {
      const id = duong.split('/').pop();
      const i = ghiDanh.findIndex((g) => g.id === id);
      if (i < 0) return traJson(res, 404, { error: 'không thấy ghi danh' });
      const bo = ghiDanh.splice(i, 1)[0];
      return traJson(res, 200, { data: { daXoa: bo.id } });
    }

    /* Cửa nhìn TẦNG LƯU TRỮ — dùng cho bài kiểm song song màn hình ↔ nơi lưu.
     *
     * Đây là bản ghi THẬT đang được lưu, không phải bản đã đi qua tầng hiển thị. Nó đóng vai
     * "câu SELECT" trong dự án thật: cùng một bản ghi, nhìn từ tầng dưới.
     *
     * CHỈ ĐỌC. Không có đường nào ghi qua đây — vì tiền điều kiện KHÔNG được dựng bằng
     * tầng lưu trữ, dù tầng đó đang mở.
     */
    if (cach === 'GET' && duong === '/api/_store/ghi-danh') {
      return traJson(res, 200, {
        data: ghiDanh.map((g) => ({
          id: g.id,
          student_id: g.hocVienId,
          class_code: g.lopMa,
          student_type: g.type,
          duration_start: g.batDau,
          duration_end: g.ketThuc,          // giá trị THẬT của ghi danh, chưa qua tầng hiển thị
          extended_days: g.giaHan,
          expire_date: ngayHetHan(g),
          history_rows: g.lichSu.length
        }))
      });
    }

    // Đặt lại toàn bộ dữ liệu — dùng cho tiền điều kiện của test.
    if (cach === 'POST' && duong === '/api/reset') {
      dungLaiDuLieu();
      return traJson(res, 200, { data: { ok: true } });
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('không có đường này: ' + cach + ' ' + duong);
  } catch (e) {
    traJson(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, () => {
  console.log(`Vận hành lớp học đang chạy: http://localhost:${PORT}`);
  console.log('Dừng: Ctrl + C');
});
