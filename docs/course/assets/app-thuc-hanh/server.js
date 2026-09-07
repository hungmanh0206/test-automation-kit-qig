/*
 * Cửa hàng mini — app thực hành cho khoá học.
 *
 * Chạy:  node docs/course/assets/app-thuc-hanh/server.js
 * Mở:    http://localhost:4010
 *
 * Chỉ dùng thư viện có sẵn của Node. Không cần cài gì.
 * Dữ liệu nằm trong bộ nhớ — tắt server là mất, chạy lại là sạch. Bạn không phá được gì.
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

/* ── Dữ liệu ────────────────────────────────────────────────────────────────── */

const KHACH = [
  { id: 'KH01', ten: 'Nguyễn Văn A', hang: 'THUONG' },
  { id: 'KH02', ten: 'Trần Thị B', hang: 'BAC' },
  { id: 'KH03', ten: 'Lê Văn C', hang: 'VANG' }
];

const SAN_PHAM = [
  { id: 'SP01', ten: 'Bàn gỗ', gia: 250000 },
  { id: 'SP02', ten: 'Ghế nhựa', gia: 100000 },
  { id: 'SP03', ten: 'Đèn bàn', gia: 175000 }
];

const GIAM_THEO_HANG = { THUONG: 0, BAC: 0.03, VANG: 0.05 };

let donHang = [];
let demId = 0;

/* ── Tính tiền ──────────────────────────────────────────────────────────────── */

function tinhTien(khach, items) {
  const tamTinh = items.reduce((s, it) => {
    const sp = SAN_PHAM.find((p) => p.id === it.productId);
    return s + (sp ? sp.gia * it.qty : 0);
  }, 0);

  const giamGia = Math.round(tamTinh * (GIAM_THEO_HANG[khach.hang] || 0));

  // BR-03: miễn phí giao hàng khi TẠM TÍNH từ 500.000 trở lên.
  const phiGiaoHang = (tamTinh - giamGia) >= 500000 ? 0 : 30000;

  const tongCong = tamTinh - giamGia + phiGiaoHang;
  return { tamTinh, giamGia, phiGiaoHang, tongCong };
}

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
  const body = fs.readFileSync(p);
  res.writeHead(200, { 'Content-Type': kieu + '; charset=utf-8' });
  res.end(body);
}

/* ── Định tuyến ─────────────────────────────────────────────────────────────── */

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const duong = u.pathname;
  const cach = req.method;

  try {
    if (cach === 'GET' && (duong === '/' || duong === '/index.html')) return traFile(res, 'index.html', 'text/html');
    if (cach === 'GET' && duong === '/app.js') return traFile(res, 'app.js', 'text/javascript');

    if (cach === 'GET' && duong === '/api/customers') return traJson(res, 200, { data: KHACH });
    if (cach === 'GET' && duong === '/api/products') return traJson(res, 200, { data: SAN_PHAM });

    // Báo giá: tính tiền mà chưa tạo đơn. Màn tạo đơn gọi API này mỗi lần bạn đổi gì đó.
    if (cach === 'POST' && duong === '/api/quote') {
      const b = await docBody(req);
      const khach = KHACH.find((k) => k.id === b.customerId);
      if (!khach) return traJson(res, 400, { error: 'khách không tồn tại' });
      const items = Array.isArray(b.items) ? b.items : [];
      for (const it of items) {
        // BR-05: số lượng phải trong khoảng 1..99
        if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 99) {
          return traJson(res, 400, { error: 'Số lượng phải từ 1 đến 99' });
        }
      }
      return traJson(res, 200, { data: tinhTien(khach, items) });
    }

    if (cach === 'GET' && duong === '/api/orders') {
      return traJson(res, 200, { data: donHang });
    }

    if (cach === 'GET' && /^\/api\/orders\/[^/]+$/.test(duong)) {
      const id = duong.split('/').pop();
      const d = donHang.find((x) => x.id === id);
      if (!d) return traJson(res, 404, { error: 'không thấy đơn' });
      return traJson(res, 200, { data: d });
    }

    if (cach === 'POST' && duong === '/api/orders') {
      const b = await docBody(req);
      const khach = KHACH.find((k) => k.id === b.customerId);
      if (!khach) return traJson(res, 400, { error: 'khách không tồn tại' });
      const items = Array.isArray(b.items) ? b.items : [];
      if (!items.length) return traJson(res, 400, { error: 'đơn phải có ít nhất 1 sản phẩm' });
      for (const it of items) {
        if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 99) {
          return traJson(res, 400, { error: 'Số lượng phải từ 1 đến 99' });
        }
      }
      const tien = tinhTien(khach, items);
      const don = {
        id: 'DH' + String(++demId).padStart(4, '0'),
        customerId: khach.id,
        customerName: khach.ten,
        hang: khach.hang,
        items,
        ...tien,
        status: 'CHO_XAC_NHAN',
        createdAt: new Date().toISOString()
      };
      donHang.push(don);
      return traJson(res, 201, { data: don });
    }

    if (cach === 'POST' && /^\/api\/orders\/[^/]+\/confirm$/.test(duong)) {
      const id = duong.split('/')[3];
      const d = donHang.find((x) => x.id === id);
      if (!d) return traJson(res, 404, { error: 'không thấy đơn' });
      if (d.status !== 'CHO_XAC_NHAN') return traJson(res, 409, { error: 'đơn không ở trạng thái chờ xác nhận' });
      d.status = 'DA_XAC_NHAN';
      return traJson(res, 200, { data: d });
    }

    // BR-06: đơn ĐÃ XÁC NHẬN thì không được sửa nữa.
    if (cach === 'PATCH' && /^\/api\/orders\/[^/]+$/.test(duong)) {
      const id = duong.split('/').pop();
      const d = donHang.find((x) => x.id === id);
      if (!d) return traJson(res, 404, { error: 'không thấy đơn' });
      const b = await docBody(req);
      if (Array.isArray(b.items) && b.items.length) {
        const khach = KHACH.find((k) => k.id === d.customerId);
        d.items = b.items;
        Object.assign(d, tinhTien(khach, b.items));
      }
      return traJson(res, 200, { data: d });
    }

    /* Cửa nhìn TẦNG LƯU TRỮ — dùng cho Bài 15 (kiểm song song UI ↔ nơi lưu).
     *
     * Đây là bản ghi THẬT đang được lưu, không phải bản đã đi qua tầng hiển thị. Nó đóng vai
     * "câu SELECT" trong dự án thật: cùng một bản ghi, nhìn từ tầng dưới.
     *
     * CHỈ ĐỌC. Không có đường nào ghi qua đây — vì tiền điều kiện KHÔNG được dựng bằng
     * tầng lưu trữ, dù tầng đó đang mở (Bài 15).
     */
    if (cach === 'GET' && duong === '/api/_store/orders') {
      return traJson(res, 200, {
        data: donHang.map((d) => ({
          id: d.id,
          customer_id: d.customerId,
          rank: d.hang,
          subtotal_amount: d.tamTinh,
          discount_amount: d.giamGia,       // giá trị THẬT, chưa qua làm tròn của giao diện
          shipping_fee: d.phiGiaoHang,
          total_amount: d.tongCong,
          status: d.status,
          item_count: d.items.reduce((s, i) => s + i.qty, 0),
          created_at_utc: d.createdAt       // luôn là UTC — giao diện hiển thị theo giờ máy
        }))
      });
    }

    // Đặt lại toàn bộ dữ liệu — dùng cho tiền điều kiện của test (Bài 10)
    if (cach === 'POST' && duong === '/api/reset') {
      donHang = []; demId = 0;
      return traJson(res, 200, { data: { ok: true } });
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('không có đường này: ' + cach + ' ' + duong);
  } catch (e) {
    traJson(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, () => {
  console.log(`Cửa hàng mini đang chạy: http://localhost:${PORT}`);
  console.log('Dừng: Ctrl + C');
});
