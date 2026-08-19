/**
 * geometry.js — assert HÌNH HỌC, không chỉ `toBeVisible()`.
 *
 * VÌ SAO CÓ FILE NÀY (bất đối xứng oracle FE vs BE): backend có contract máy đọc được (Swagger) nên assertion là
 * `total = 540000`; frontend chỉ có Figma nên assertion thoái hoá thành `toBeVisible()` / `toContainText()`. Mà
 * `toBeVisible()` vẫn **PASS** khi element: bị element khác **đè lên** · lệch ra ngoài viewport · cao 2px · chữ
 * trắng trên nền trắng · bị **truncate** (`text-overflow: ellipsis`). Bug FE sống ở **hình học và thị giác**, còn
 * kit đang assert **cấu trúc DOM** — hai không gian khác nhau, và khoảng cách đó đúng là chỗ bug lọt.
 *
 * File này KHÔNG cần Figma: mọi phép dưới đây là **bất biến tự thân** (self-evident invariant) — không cần biết
 * thiết kế cũng khẳng định được là sai. Nhờ vậy nó không rơi vào bẫy tautology "đúng vì app đang hiện thế".
 */

/**
 * Đo một element và trả về các vi phạm hình học. Chạy trong trang để đọc được layout thật.
 * @returns {Promise<{ok: boolean, problems: string[], box: object}>}
 */
async function inspectGeometry(page, selector, opts = {}) {
  const minTouch = opts.minTouch || 0;              // >0 thì kiểm touch target (mobile: 44)
  return page.evaluate(({ sel, minT }) => {
    const el = document.querySelector(sel);
    if (!el) return { ok: false, problems: [`không tìm thấy element: ${sel}`], box: null };
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    const problems = [];
    const box = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };

    // 1) Kích thước vô nghĩa: `toBeVisible()` vẫn pass với element 0×0 nếu nó chỉ overflow-hidden.
    if (r.width <= 0 || r.height <= 0) problems.push(`kích thước ${box.w}×${box.h} — không thể nhìn thấy dù DOM có`);
    if (r.width < 0 || r.height < 0) problems.push('kích thước ÂM');

    // 2) Nằm ngoài viewport (một lớp bug responsive rất hay lọt).
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) problems.push(`nằm NGOÀI viewport (${vw}×${vh}) tại (${box.x},${box.y})`);
    if (r.right > vw + 1) problems.push(`tràn ngang ${Math.round(r.right - vw)}px ra ngoài viewport`);

    // 3) Bị element KHÁC đè lên đúng tâm — `toBeVisible()` không biết chuyện này.
    const cx = Math.min(Math.max(r.x + r.width / 2, 1), vw - 1);
    const cy = Math.min(Math.max(r.y + r.height / 2, 1), vh - 1);
    const top = document.elementFromPoint(cx, cy);
    if (top && top !== el && !el.contains(top) && !top.contains(el)) {
      problems.push(`bị ĐÈ tại tâm bởi <${top.tagName.toLowerCase()}${top.className ? `.${String(top.className).split(/\s+/)[0]}` : ''}>`);
    }

    // 4) Chữ trùng màu nền (không đọc được nhưng DOM vẫn "có text").
    const fg = st.color;
    let bgEl = el;
    let bg = st.backgroundColor;
    while (bgEl && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) { bgEl = bgEl.parentElement; bg = bgEl ? getComputedStyle(bgEl).backgroundColor : 'rgb(255, 255, 255)'; }
    const rgb = (c) => (String(c).match(/\d+/g) || []).slice(0, 3).map(Number);
    const [r1, g1, b1] = rgb(fg);
    const [r2, g2, b2] = rgb(bg);
    if ([r1, g1, b1, r2, g2, b2].every((n) => Number.isFinite(n))) {
      const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
      if ((el.textContent || '').trim() && diff < 30) problems.push(`chữ gần trùng màu nền (${fg} trên ${bg}) — có text nhưng không đọc được`);
    }

    // 5) Bị CẮT NGẮN: nội dung rộng hơn khung + có ellipsis ⇒ người dùng không đọc được đủ.
    if (el.scrollWidth > el.clientWidth + 1 && /ellipsis|clip/.test(st.textOverflow + st.overflow)) {
      problems.push(`nội dung BỊ CẮT: scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth} (${st.textOverflow})`);
    }

    // 6) Touch target (chỉ kiểm khi được yêu cầu — mobile ≥ 44px).
    if (minT && Math.min(r.width, r.height) < minT) problems.push(`touch target ${box.w}×${box.h} < ${minT}px`);

    return { ok: problems.length === 0, problems, box };
  }, { sel: selector, minT: minTouch });
}

/**
 * TEXT DÀI TIẾNG VIỆT — ổ bug FE mà testcase gen từ tài liệu gần như không bao giờ nghĩ tới.
 * Tiếng Việt dài hơn tiếng Anh ~20–30% và **có dấu** (dòng cao hơn), nên layout thiết kế cho text ngắn sẽ vỡ:
 * tên người dài, địa chỉ dài, tên khoá học dài → truncate · overflow · xuống dòng xấu · đè chồng.
 * Trả về chuỗi mẫu dùng làm dữ liệu test (đúng quy ước đặt tên: bắt đầu bằng "IT test").
 */
const LONG_VI = {
  name: 'IT test Nguyễn Hoàng Thị Phương Quỳnh Nhược Nguyệt Ánh Diệp Khả Ái',
  address: 'IT test Số 1234/56B7 đường Nguyễn Hữu Thọ nối dài, Khu phố Đông Bắc, Phường Tân Hưng Thuận Đông, Quận Bình Tân Mở Rộng, Thành phố Hồ Chí Minh',
  course: 'IT test Khoá ôn thi Chứng chỉ Kế toán Quản trị Hoa Kỳ CMA Part 1 & Part 2 — lớp tối cuối tuần có kèm ôn tập chuyên sâu',
  note: 'IT test Ghi chú ưu đãi đặc biệt dành cho học viên đăng ký sớm kèm điều kiện hoàn phí trong vòng ba mươi ngày kể từ ngày khai giảng',
};

/** Đo xem một element có "vỡ" khi nhận text dài: tràn khung cha, bị cắt, hoặc đẩy layout. */
async function inspectLongText(page, selector) {
  const g = await inspectGeometry(page, selector);
  const extra = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return [];
    const p = el.parentElement;
    const out = [];
    if (p) {
      const er = el.getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      if (er.right > pr.right + 1) out.push(`tràn ${Math.round(er.right - pr.right)}px ra ngoài khung cha`);
      if (er.bottom > pr.bottom + 1) out.push(`tràn ${Math.round(er.bottom - pr.bottom)}px xuống dưới khung cha`);
    }
    return out;
  }, selector);
  return { ok: g.ok && !extra.length, problems: [...g.problems, ...extra], box: g.box };
}

module.exports = { inspectGeometry, inspectLongText, LONG_VI };
