/*
 * Giao diện của Vận hành lớp học. Chạy trong trình duyệt.
 *
 * Đọc được file này là một phần của bài học: khi test đỏ, bạn cần biết
 * chữ trên màn hình đến từ đâu.
 */
'use strict';

const $ = (s) => document.querySelector(s);
const q = (t) => document.querySelector(`[data-testid="${t}"]`);

let lopDs = [];
let hocVienDs = [];
let hangDs = [];
let hanDangXem = null;
let ghiDanhDangSua = null;

/* Ngày lưu dạng YYYY-MM-DD, hiện dạng dd/mm/yyyy. */
const ngay = (s) => (s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '—');
const khoang = (a, b) => ngay(a) + ' - ' + ngay(b);

const TEN_LOAI = { NORMAL: 'Thường', RETOOK: 'Học lại', RESERVED: 'Bảo lưu' };
const LOP_LOAI = { LESSON: 'Lớp chính', FOUNDATION: 'Foundation', REVISION: 'Revision' };

async function goi(duong, tuyChon) {
  const r = await fetch(duong, { headers: { 'Content-Type': 'application/json' }, ...tuyChon });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'lỗi ' + r.status);
  return j.data;
}

function hienLoi(chu, o) {
  const el = o || q('loi');
  if (!chu) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = chu;
}

/* Cộng ngày ở tầng hiển thị, để màn hình không phải chờ server mỗi lần đổi số. */
function congNgay(s, n) {
  const t = Date.parse(s + 'T00:00:00Z') + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/* ── Bảng học viên ─────────────────────────────────────────────────────────── */

async function veBangHocVien() {
  const maLop = q('lop').value;
  const lop = lopDs.find((l) => l.ma === maLop);
  hangDs = await goi(`/api/lop/${maLop}/hoc-vien`);

  q('lop-loai').textContent = LOP_LOAI[lop.loai] || lop.loai;
  q('lop-thoi-han').textContent = khoang(lop.batDau, lop.ketThuc);
  q('lop-si-so').textContent = String(hangDs.length);

  const tb = q('bang-hoc-vien');
  tb.innerHTML = '';
  for (const [i, g] of hangDs.entries()) {
    const loai = (g.type || '').toLowerCase();
    const nhan = loai === 'retook' ? 'hoclai' : loai === 'reserved' ? 'baoluu' : 'thuong';
    // Ngày hết hạn: thời hạn của lớp cộng số ngày gia hạn của học viên.
    const hetHan = congNgay(lop.ketThuc, g.giaHan);
    const tr = document.createElement('tr');
    tr.setAttribute('data-ghi-danh', g.id);
    tr.innerHTML =
      `<td>${i + 1}</td>` +
      `<td>${g.hocVienTen}</td>` +
      `<td><span class="nhan ${nhan}">${TEN_LOAI[g.type] || g.type}</span></td>` +
      `<td>${khoang(g.batDau, g.ketThuc)}</td>` +
      `<td class="so">${g.giaHan === 0 ? '—' : g.giaHan}</td>` +
      `<td>${ngay(hetHan)}</td>` +
      `<td><span class="menu">` +
        `<button data-menu="${g.id}" aria-label="Hành động">⋮</button>` +
        `<ul hidden data-menu-cua="${g.id}">` +
          `<li><button data-gia-han="${g.id}">Gia hạn</button></li>` +
          `<li><button data-lich-su="${g.id}">Lịch sử</button></li>` +
        `</ul>` +
      `</span></td>`;
    tb.appendChild(tr);
  }
  $('#hvTrong').hidden = hangDs.length > 0;
}

/* ── Đồng bộ học lại ───────────────────────────────────────────────────────── */

function xoaOHan() {
  for (const t of ['lop-cu', 'lop-moc', 'han-hien-tai', 'han-moi']) q(t).textContent = '—';
  q('ap-dung').disabled = true;
  hanDangXem = null;
}

async function xemHan() {
  try {
    const d = await goi('/api/tinh-han', {
      method: 'POST',
      body: JSON.stringify({ hocVienId: q('hoc-vien').value })
    });
    hienLoi('');
    hanDangXem = d;
    q('lop-cu').textContent = d.lopCu;
    q('lop-moc').textContent = d.lopMoc ? `${d.lopMoc} (${LOP_LOAI[d.lopMocLoai] || d.lopMocLoai})` : '— chưa có lớp mới';
    q('han-hien-tai').textContent = ngay(d.hanHienTai);
    q('han-moi').textContent = ngay(d.hanMoi);
    q('ap-dung').disabled = false;
  } catch (e) {
    xoaOHan();
    hienLoi(e.message);
  }
}

async function apDung() {
  try {
    await goi('/api/dong-bo-hoc-lai', {
      method: 'POST',
      body: JSON.stringify({ hocVienId: q('hoc-vien').value })
    });
    hienLoi('');
    xoaOHan();
    await veBangHocVien();
  } catch (e) {
    hienLoi(e.message);
  }
}

/* ── Gia hạn ───────────────────────────────────────────────────────────────── */

function moGiaHan(id) {
  const g = hangDs.find((x) => x.id === id);
  ghiDanhDangSua = g;
  q('gia-han-hv').textContent = `${g.hocVienTen} · thời hạn hiện tại ${khoang(g.batDau, g.ketThuc)}`;
  q('so-ngay').value = '30';
  q('ly-do').value = '';
  q('dem-ly-do').textContent = '0/60';
  hienLoi('', q('loi-gia-han'));
  $('#hopGiaHan').showModal();
}

async function luuGiaHan() {
  try {
    await goi('/api/gia-han', {
      method: 'POST',
      body: JSON.stringify({
        ghiDanhId: ghiDanhDangSua.id,
        soNgay: Number(q('so-ngay').value),
        lyDo: q('ly-do').value
      })
    });
    $('#hopGiaHan').close();
    await veBangHocVien();
  } catch (e) {
    hienLoi(e.message, q('loi-gia-han'));
  }
}

async function moLichSu(id) {
  const ds = await goi(`/api/ghi-danh/${id}/lich-su`);
  const tb = q('bang-lich-su');
  tb.innerHTML = ds.map((r, i) =>
    `<tr><td>${i + 1}</td><td>${khoang(r.tu, r.den)}</td><td>${r.lyDo}</td><td>${r.boi}</td></tr>`
  ).join('');
  q('lich-su-trong').hidden = ds.length > 0;
  $('#hopLichSu').showModal();
}

/* ── Khởi động ─────────────────────────────────────────────────────────────── */

async function khoiDong() {
  lopDs = await goi('/api/lop');
  hocVienDs = await goi('/api/hoc-vien');

  q('lop').innerHTML = lopDs
    .map((l) => `<option value="${l.ma}">${l.ma} — ${l.ten}</option>`).join('');
  q('hoc-vien').innerHTML = hocVienDs
    .map((h) => `<option value="${h.id}">${h.id} — ${h.ten}</option>`).join('');

  await veBangHocVien();
}

/* ── Sự kiện ───────────────────────────────────────────────────────────────── */

q('lop').addEventListener('change', async () => { await veBangHocVien(); });
q('xem-han').addEventListener('click', xemHan);
q('ap-dung').addEventListener('click', apDung);
q('hoc-vien').addEventListener('change', xoaOHan);

q('bang-hoc-vien').addEventListener('click', (e) => {
  const el = e.target;
  if (!el.getAttribute) return;
  const mo = el.getAttribute('data-menu');
  if (mo) {
    const ul = document.querySelector(`[data-menu-cua="${mo}"]`);
    const dangMo = !ul.hidden;
    for (const x of document.querySelectorAll('[data-menu-cua]')) x.hidden = true;
    ul.hidden = dangMo;
    return;
  }
  const gh = el.getAttribute('data-gia-han');
  if (gh) { for (const x of document.querySelectorAll('[data-menu-cua]')) x.hidden = true; moGiaHan(gh); return; }
  const ls = el.getAttribute('data-lich-su');
  if (ls) { for (const x of document.querySelectorAll('[data-menu-cua]')) x.hidden = true; moLichSu(ls); }
});

q('ly-do').addEventListener('input', () => {
  q('dem-ly-do').textContent = `${q('ly-do').value.length}/60`;
});
q('luu-gia-han').addEventListener('click', luuGiaHan);
q('huy-gia-han').addEventListener('click', () => $('#hopGiaHan').close());
q('dong-lich-su').addEventListener('click', () => $('#hopLichSu').close());

khoiDong().catch((e) => hienLoi('Không nối được server: ' + e.message));
