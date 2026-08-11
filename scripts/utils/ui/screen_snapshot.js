'use strict';

/*
 * screen_snapshot — biến việc "quan sát UI" thành DỮ LIỆU, không phụ thuộc việc agent có để ý hay không.
 *
 * VÌ SAO CẦN: lớp bug hiển thị (thiếu trường, thừa cột, sai đơn vị tiền, lệch nhãn giữa 2 màn) gần như luôn do
 * NGƯỜI ngồi xem màn hình tìm ra, còn automation thì bỏ qua — không phải vì thiếu quy định, mà vì test theo
 * bước chỉ chạm đúng những element nó cần và MÙ với mọi thứ còn lại. Thiếu một trường thì mọi step vẫn xanh.
 *
 * Script này chụp lại TOÀN BỘ bề mặt đang render (nhãn, giá trị, cột, đơn vị tiền, định dạng số) thành JSON.
 * Nhờ đó:
 *   · viết ui_catalog thành việc DIFF (snapshot vs tài liệu), không phải việc nhớ;
 *   · thứ có trên màn mà tài liệu không nói tự nổi lên (thừa cột / thừa field / đơn vị lạ);
 *   · trộn đơn vị tiền trong cùng một khối được cảnh báo — đúng lớp bug "discount 10 USD in ra 10đ".
 *
 * KHÔNG dùng snapshot làm ORACLE (đó là app==app). Nó chỉ nêu "màn đang có gì" để đối chiếu với tài liệu.
 */

const CURRENCY = [
  // KHÔNG dùng \b sau 'đ': JS \w chỉ tính ASCII nên 'đ' không tạo được word-boundary → "10đ" sẽ không khớp.
  { key: 'VND', re: /\d\s?(?:đ|₫)|VN[DĐ]/i },
  { key: 'USD', re: /(?:\$|\bUSD\b)/i },
  { key: 'EUR', re: /(?:€|\bEUR\b)/i },
];

/**
 * Chụp bề mặt một màn/section thành dữ liệu có cấu trúc.
 * @param {import('@playwright/test').Page} page
 * @param {{scopeSelector?: string, labelSelector?: string}} [opts]
 */
async function snapshotScreen(page, opts = {}) {
  const scope = opts.scopeSelector || 'body';
  const labelSel = opts.labelSelector || 'label, .form-label, dt, th';
  return page.evaluate(({ scope: sc, labelSel: ls, CUR }) => {
    const root = document.querySelector(sc) || document.body;
    const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    };

    // 1) Nhãn đang hiển thị (bỏ dấu ':' và '*' cuối nhãn cho khớp tài liệu)
    const labels = [...root.querySelectorAll(ls)].filter(visible)
      .map((el) => norm(el.textContent).replace(/[:*]\s*$/, '')).filter(Boolean);

    // 2) Cặp nhãn → giá trị (input/select kế bên, hoặc dd/td tương ứng)
    const pairs = [];
    for (const el of [...root.querySelectorAll('label, dt')].filter(visible)) {
      const label = norm(el.textContent).replace(/[:*]\s*$/, '');
      if (!label) continue;
      let val = '';
      const forId = el.getAttribute && el.getAttribute('for');
      const byFor = forId ? root.querySelector('[id="' + forId + '"]') : null;
      const next = byFor || el.nextElementSibling;
      if (next) val = norm(next.value !== undefined && next.value !== null && next.value !== '' ? next.value : next.textContent);
      pairs.push({ label, value: val });
    }

    // 3) Bảng: header + vài dòng đầu (đủ để thấy cột thừa/thiếu và định dạng ô)
    const tableEls = root.tagName === 'TABLE' ? [root] : [...root.querySelectorAll('table')];
    const tables = tableEls.filter(visible).map((t) => ({
      headers: [...t.querySelectorAll('thead th')].map((h) => norm(h.textContent)).filter(Boolean),
      rows: [...t.querySelectorAll('tbody tr')].slice(0, 3).map((tr) => [...tr.querySelectorAll('td')].map((td) => norm(td.textContent))),
    }));

    // 4) Đơn vị tiền xuất hiện trong khối — trộn nhiều loại là dấu hiệu sai đơn vị
    const text = norm(root.innerText || '');
    const found = {};
    for (const c of CUR) {
      const hits = text.match(new RegExp(c.source, `${c.flags.replace(/g/g, '')}g`)) || [];
      if (hits.length) found[c.key] = hits.length;
    }

    return {
      scope: sc,
      labels,
      pairs,
      tables,
      currencies: found,
      mixedCurrency: Object.keys(found).length > 1,
      numberSamples: (text.match(/\b\d[\d.,]{2,}\b/g) || []).slice(0, 20),
    };
  // page.evaluate KHÔNG truyền được RegExp qua boundary → truyền {source, flags} rồi dựng lại trong browser.
  // Cố ý KHÔNG bọc try/catch: lỗi ở đây phải nổ ra, vì snapshot rỗng âm thầm đúng là kiểu "mù" cần tránh.
  }, { scope, labelSel, CUR: CURRENCY.map((c) => ({ key: c.key, source: c.re.source, flags: c.re.flags })) });
}

/**
 * Đối chiếu snapshot với tài liệu. Trả về thứ TÀI LIỆU KHÔNG NÓI mà màn đang có, và ngược lại.
 * @param {any} snap kết quả snapshotScreen
 * @param {{expectedFields?: string[], expectedColumns?: string[]}} doc
 */
function diffWithDoc(snap, doc = {}) {
  const n = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const out = { missingFields: [], extraFields: [], missingColumns: [], extraColumns: [], notes: [] };
  if (Array.isArray(doc.expectedFields) && doc.expectedFields.length) {
    const have = new Set((snap.labels || []).map(n));
    const want = doc.expectedFields.map(n);
    out.missingFields = want.filter((x) => !have.has(x));
    out.extraFields = [...have].filter((x) => !want.includes(x));
  }
  if (Array.isArray(doc.expectedColumns) && doc.expectedColumns.length) {
    const heads = ((snap.tables || [])[0] || {}).headers || [];
    const want = doc.expectedColumns.map(n);
    out.missingColumns = want.filter((x) => !heads.map(n).includes(x));
    out.extraColumns = heads.map(n).filter((x) => !want.includes(x));
  }
  if (snap.mixedCurrency) {
    out.notes.push(`Khối này trộn ${Object.keys(snap.currencies).join(' + ')} — kiểm lại đơn vị tiền của từng field (lớp bug "giá trị USD nhưng in ra đ" thuộc đúng dạng này).`);
  }
  return out;
}

module.exports = { snapshotScreen, diffWithDoc };
