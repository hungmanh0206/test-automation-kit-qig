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

/*
 * BA LỖ HỔNG ĐÃ ĐO VÀ BỊT (28/08/2026) — trước đó snapshot MÙ đúng những chỗ này:
 *
 *  ① ant-select: OPS là ant-design, dropdown là `div` chứ không `<select>`, và `input.value` bên trong nó
 *     RỖNG (đó là ô tìm kiếm) ⇒ mọi giá trị dropdown vô hình. Dấu hiệu nhận biết: bộ đọc báo "0 select" ở
 *     một form nghiệp vụ — đó là SỬA CÔNG CỤ, không phải kết luận "form không có field".
 *  ② radio/checkbox: thông tin nằm ở `checked`, không ở `value`. Đọc `value` là ra giá trị ô CHƯA CHỌN.
 *  ③ PII: snapshot ghi nhãn+giá trị ra JSON/artifact mà không che gì ⇒ email/SĐT khách rời khỏi tiến trình.
 *     Đã dính thật ở tầng task: 100 email + 100 SĐT nằm trong một file requirements.
 *
 * Luật mask (cố ý KHÔNG mask theo hình dạng số chung): email che theo MẪU — không khoá nghiệp vụ nào trông
 * giống email; còn họ tên / ngày sinh / CCCD / địa chỉ che theo NHÃN hoặc theo HEADER CỘT. Lý do: luật
 * `d{9,12}` từng che luôn mã liên kết ngoài (11 chữ số) — khoá dùng để nối UI với DB, che nó là mất chính thứ cần đọc.
 */
const PII_LABEL = /^(full ?name|họ (và )?tên|ho ten|tên khách|email|e-?mail|phone( number)?|số điện thoại|so dien thoai|mobile|d\.?o\.?b|ngày sinh|ngay sinh|số cccd|so cccd|cccd|cmnd|hộ chiếu|passport|địa chỉ|dia chi|address)\b/i;
const EMAIL_RE = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
/** SĐT VN bắt đầu bằng 0 — khoá nghiệp vụ của dự án này không bắt đầu bằng 0 nên mẫu này không ăn oan. */
const PHONE_RE = /(?<!\d)0\d{9,10}(?!\d)/g;

/** Chuẩn hoá số hiển thị → chuỗi chữ số (giữ dấu âm). Dùng để so giá trị UI với DB, không phụ thuộc định dạng. */
function normNumber(v) {
  const raw = String(v == null ? '' : v);
  const neg = /^\s*-/.test(raw);
  const d = raw.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
  return d ? (neg ? `-${d}` : d) : '';
}

const CURRENCY = [
  // KHÔNG dùng \b sau 'đ': JS \w chỉ tính ASCII nên 'đ' không tạo được word-boundary → "10đ" sẽ không khớp.
  { key: 'VND', re: /\d\s?(?:đ|₫)|VN[DĐ]/i },
  { key: 'USD', re: /(?:\$|\bUSD\b)/i },
  { key: 'EUR', re: /(?:€|\bEUR\b)/i },
];

/**
 * Chụp bề mặt một màn/section thành dữ liệu có cấu trúc.
 * @param {import('@playwright/test').Page} page
 * @param {{scopeSelector?: string, labelSelector?: string, maskPii?: boolean}} [opts]
 *   `maskPii` mặc định BẬT. Tắt phải tường minh, và khi tắt thì artifact sinh ra CHỨA PII — không được ghi
 *   ra file, không được đính vào evidence/Backlog.
 */
async function snapshotScreen(page, opts = {}) {
  const scope = opts.scopeSelector || 'body';
  const labelSel = opts.labelSelector || 'label, .form-label, dt, th';
  const maskPii = opts.maskPii !== false;
  return page.evaluate(({ scope: sc, labelSel: ls, CUR, mask: doMask, piiLabel, emailRe, phoneRe }) => {
    const root = document.querySelector(sc) || document.body;
    const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    };

    const PII = new RegExp(piiLabel.source, piiLabel.flags);
    const isPiiLabel = (l) => PII.test(String(l || '').trim());
    const maskText = (t) => {
      if (!doMask) return t;
      return String(t == null ? '' : t)
        .replace(new RegExp(emailRe.source, emailRe.flags), '<email-masked>')
        .replace(new RegExp(phoneRe.source, phoneRe.flags), '<phone-masked>');
    };
    /** Giá trị đứng cạnh nhãn PII thì che HẲN — họ tên/ngày sinh không có mẫu nhận biết được. */
    const maskValue = (label, v) => (doMask && isPiiLabel(label) ? '<masked>' : maskText(v));

    // 1) Nhãn đang hiển thị (bỏ dấu ':' và '*' cuối nhãn cho khớp tài liệu)
    const labels = [...root.querySelectorAll(ls)].filter(visible)
      .map((el) => norm(el.textContent).replace(/[:*]\s*$/, '')).map(maskText).filter(Boolean);

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
      pairs.push({ label, value: maskValue(label, val) });
    }

    // 2b) LAYOUT DIV: nhiều màn detail (Metronic/React) KHÔNG dùng <label>/<dt>/<table> — nhãn và giá trị là
    // 2 div/span cạnh nhau. Đo thật trên một màn Order detail: khối 1) trả về 0 nhãn ⇒ snapshot MÙ hoàn toàn.
    // Nên bổ sung nhánh đọc theo LEAF NODE liền kề. Giữ riêng (`labelsLoose`/`pairsLoose`) chứ không trộn vào
    // `labels`, để hành vi cũ và regression hiện có không đổi; `diffWithDoc` chỉ dùng khi `labels` rỗng.
    const leaves = [...root.querySelectorAll('div,span,p,td')].filter((el) => !el.children.length && visible(el))
      .map((el) => norm(el.textContent)).filter((t) => t && t.length <= 80);
    const looksValue = (t) => /\d/.test(t) || /^(có|không|yes|no|-|N\/A)$/i.test(t);
    const looksLabel = (t) => t.length >= 2 && t.length <= 60 && !looksValue(t);
    const labelsLoose = []; const pairsLoose = [];
    for (let i = 0; i < leaves.length - 1; i += 1) {
      const a = leaves[i].replace(/[:*]\s*$/, ''); const bNext = leaves[i + 1];
      if (!looksLabel(a) || !bNext) continue;
      labelsLoose.push(maskText(a));
      pairsLoose.push({ label: maskText(a), value: maskValue(a, bNext) });
    }

    /*
     * 2c) CONTROL — ô nhập thật sự. Ba loại, KHÔNG phải một:
     *   · input/textarea  → `el.value`
     *   · ant-select      → text ở `.ant-select-selection-item` (là `div`; `input.value` bên trong RỖNG)
     *   · radio/checkbox  → trạng thái `checked` (đọc `value` là ra giá trị của ô CHƯA CHỌN)
     * Thiếu khối này thì mọi form ant-design trả về "0 dropdown" và ta kết luận sai là "form không có field".
     */
    const labelFor = (el) => {
      const r = el.getBoundingClientRect();
      const texts = [...root.querySelectorAll('div,span,p,label,td,th')]
        .filter((e) => !e.children.length && visible(e) && norm(e.textContent))
        /*
         * Chữ nằm TRONG một control khác không phải nhãn — nó là GIÁ TRỊ của control đó.
         * Đã dính: ô "Recipient Bank Account" nhận nhãn "Trả góp" vì đó là chữ hiển thị của
         * ant-select phía trên (span `.ant-select-selection-item` flow xuống gần nó).
         */
        .filter((e) => !e.closest('.ant-select, .ant-select-dropdown, [role="option"]'))
        .map((e) => ({ t: norm(e.textContent), b: e.getBoundingClientRect() }))
        .filter((x) => x.t.length <= 90);
      let best = null;
      for (const x of texts) {
        const left = Math.abs(x.b.y - r.y) <= 24 && x.b.x < r.x;
        const above = x.b.y < r.y && r.y - x.b.y <= 40 && Math.abs(x.b.x - r.x) <= 40;
        if (!left && !above) continue;
        const d = left ? r.x - x.b.x : (r.y - x.b.y) * 3;
        if (!best || d < best.d) best = { d, t: x.t };
      }
      return best ? best.t.replace(/[:*]\s*$/, '') : '';
    };
    const controls = [];
    for (const el of [...root.querySelectorAll('.ant-select')].filter(visible)) {
      const item = el.querySelector('.ant-select-selection-item');
      controls.push({
        label: labelFor(el), kind: 'ant-select',
        value: maskValue(labelFor(el), norm(item ? item.textContent : '')),
        disabled: el.classList.contains('ant-select-disabled'),
      });
    }
    for (const el of [...root.querySelectorAll('input, select, textarea')].filter((e) => e.type !== 'hidden' && visible(e))) {
      let v = '';
      let kind = el.tagName.toLowerCase();
      if (el.tagName === 'SELECT') {
        const o = el.options[el.selectedIndex];
        v = norm(o ? o.textContent : '');
      } else if (el.type === 'radio' || el.type === 'checkbox') {
        kind = el.type;
        v = el.checked ? `CHỌN:${el.value || 'on'}` : '';
      } else v = norm(el.value || '');
      const label = labelFor(el);
      controls.push({ label, kind, value: maskValue(label, v), disabled: !!(el.disabled || el.readOnly) });
    }

    // 3) Bảng: header + vài dòng đầu (đủ để thấy cột thừa/thiếu và định dạng ô)
    const tableEls = root.tagName === 'TABLE' ? [root] : [...root.querySelectorAll('table')];
    /*
     * Mask ô của bảng theo HEADER CỘT — cột Email/Phone/Họ tên không có nhãn kề bên nên mask-theo-nhãn
     * không tới được. Đây chính là chỗ đã rò 100 email + 100 SĐT ra một file requirements.
     */
    const tables = tableEls.filter(visible).map((t) => {
      const headers = [...t.querySelectorAll('thead th')].map((h) => norm(h.textContent)).filter(Boolean);
      const piiCols = new Set(headers.map((h, i) => (isPiiLabel(h) ? i : -1)).filter((i) => i >= 0));
      return {
        headers,
        rows: [...t.querySelectorAll('tbody tr')].slice(0, 3).map((tr) => [...tr.querySelectorAll('td')]
          .map((td, i) => (doMask && piiCols.has(i) ? '<masked>' : maskText(norm(td.textContent))))),
      };
    });

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
      labelsLoose: [...new Set(labelsLoose)],
      pairs,
      pairsLoose,
      controls,
      tables,
      currencies: found,
      mixedCurrency: Object.keys(found).length > 1,
      // Mask TRƯỚC khi lấy mẫu số: SĐT là chuỗi số, để nguyên thì nó lọt vào numberSamples.
      numberSamples: (maskText(text).match(/\b\d[\d.,]{2,}\b/g) || []).slice(0, 20),
    };
  // page.evaluate KHÔNG truyền được RegExp qua boundary → truyền {source, flags} rồi dựng lại trong browser.
  // Cố ý KHÔNG bọc try/catch: lỗi ở đây phải nổ ra, vì snapshot rỗng âm thầm đúng là kiểu "mù" cần tránh.
  }, { scope, labelSel, CUR: CURRENCY.map((c) => ({ key: c.key, source: c.re.source, flags: c.re.flags })),
    mask: maskPii, piiLabel: { source: PII_LABEL.source, flags: PII_LABEL.flags },
    emailRe: { source: EMAIL_RE.source, flags: EMAIL_RE.flags }, phoneRe: { source: PHONE_RE.source, flags: PHONE_RE.flags } });
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
    // Layout div: `labels` rỗng ⇒ dùng `labelsLoose` (nhãn suy từ leaf node liền kề) thay vì báo THIẾU HẾT.
    const src = (snap.labels && snap.labels.length) ? snap.labels : (snap.labelsLoose || []);
    const have = new Set(src.map(n));
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

module.exports = { snapshotScreen, diffWithDoc, normNumber, PII_LABEL };
