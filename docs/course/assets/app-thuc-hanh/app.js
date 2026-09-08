/*
 * Giao diện của Cổng đăng ký khoá học. Chạy trong trình duyệt.
 *
 * Đọc được file này là một phần của bài học: khi test đỏ, bạn cần biết
 * chữ trên màn hình đến từ đâu.
 */
'use strict';

const $ = (s) => document.querySelector(s);
const q = (t) => document.querySelector(`[data-testid="${t}"]`);

let khachDs = [];
let sanPhamDs = [];
let gio = [];

const tien = (n) => new Intl.NumberFormat('vi-VN').format(n) + ' đ';

async function goi(duong, tuyChon) {
  const r = await fetch(duong, {
    headers: { 'Content-Type': 'application/json' },
    ...tuyChon
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'lỗi ' + r.status);
  return j.data;
}

function hienLoi(chu) {
  const el = q('loi');
  if (!chu) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = chu;
}

function veGio() {
  const tb = q('gio');
  tb.innerHTML = '';
  for (const [i, it] of gio.entries()) {
    const sp = sanPhamDs.find((p) => p.id === it.productId);
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${sp.ten}</td>` +
      `<td class="so">${tien(sp.gia)}</td>` +
      `<td class="so">${it.qty}</td>` +
      `<td class="so">${tien(sp.gia * it.qty)}</td>` +
      `<td><button class="phu" data-xoa="${i}">Xoá</button></td>`;
    tb.appendChild(tr);
  }
  $('#gioTrong').hidden = gio.length > 0;
  $('#taoDon').disabled = gio.length === 0;
}

async function capNhatTien() {
  if (!gio.length) {
    for (const t of ['tam-tinh', 'giam-gia', 'phi-dich-vu', 'tong-cong']) q(t).textContent = '—';
    return;
  }
  try {
    const t = await goi('/api/quote', {
      method: 'POST',
      body: JSON.stringify({ customerId: q('khach').value, items: gio })
    });
    hienLoi('');
    q('tam-tinh').textContent = tien(t.tamTinh);
    // Làm tròn xuống nghìn cho gọn mắt
    q('giam-gia').textContent = tien(Math.floor(t.giamGia / 1000) * 1000);
    q('phi-dich-vu').textContent = t.phiDichVu === 0 ? 'Miễn phí' : tien(t.phiDichVu);
    q('tong-cong').textContent = tien(t.tongCong);
  } catch (e) {
    hienLoi(e.message);
  }
}

async function veDsDon() {
  const ds = await goi('/api/orders');
  const tb = q('ds-don');
  tb.innerHTML = '';
  for (const d of ds) {
    const cho = d.status === 'CHO_XAC_NHAN';
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${d.id}</td>` +
      `<td>${d.customerName}</td>` +
      `<td class="so">${tien(d.tongCong)}</td>` +
      `<td><span class="nhan ${cho ? 'cho' : 'xong'}">${cho ? 'Chờ xác nhận' : 'Đã xác nhận'}</span></td>` +
      `<td>${cho ? `<button class="phu" data-xacnhan="${d.id}">Xác nhận</button>` : ''}</td>`;
    tb.appendChild(tr);
  }
  $('#donTrong').hidden = ds.length > 0;
}

async function khoiDong() {
  khachDs = await goi('/api/students');
  sanPhamDs = await goi('/api/courses');

  const tenHang = { THUONG: 'Thường', BAC: 'Bạc', VANG: 'Vàng' };
  q('khach').innerHTML = khachDs
    .map((k) => `<option value="${k.id}">${k.ten} — hạng ${tenHang[k.hang]}</option>`).join('');
  q('sanpham').innerHTML = sanPhamDs
    .map((p) => `<option value="${p.id}">${p.ten} — ${tien(p.gia)}</option>`).join('');

  await veDsDon();
}

/* ── Sự kiện ────────────────────────────────────────────────────────────────── */

$('#them').addEventListener('click', async () => {
  const sl = Number(q('soluong').value);
  if (!Number.isInteger(sl) || sl < 1 || sl > 99) { hienLoi('Số suất phải từ 1 đến 99'); return; }
  const pid = q('sanpham').value;
  const co = gio.find((x) => x.productId === pid);
  if (co) co.qty += sl; else gio.push({ productId: pid, qty: sl });
  veGio();
  await capNhatTien();
});

q('gio').addEventListener('click', async (e) => {
  const i = e.target.getAttribute && e.target.getAttribute('data-xoa');
  if (i === null || i === undefined) return;
  gio.splice(Number(i), 1);
  veGio();
  await capNhatTien();
});

q('khach').addEventListener('change', capNhatTien);

$('#taoDon').addEventListener('click', async () => {
  try {
    await goi('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ customerId: q('khach').value, items: gio })
    });
    gio = [];
    veGio();
    await capNhatTien();
    await veDsDon();
    hienLoi('');
  } catch (e) {
    hienLoi(e.message);
  }
});

q('ds-don').addEventListener('click', async (e) => {
  const id = e.target.getAttribute && e.target.getAttribute('data-xacnhan');
  if (!id) return;
  try { await goi(`/api/orders/${id}/confirm`, { method: 'POST' }); await veDsDon(); }
  catch (err) { hienLoi(err.message); }
});

khoiDong().catch((e) => hienLoi('Không nối được server: ' + e.message));
