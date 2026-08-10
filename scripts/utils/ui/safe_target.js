'use strict';

/*
 * safe_target.js — định vị/thao tác UI KHÔNG-ĐOÁN, để không bấm nhầm element rồi kết luận sai bug.
 *
 * NGUYÊN TẮC (đối lập với cách hay dùng):
 *   1. MƠ HỒ = LỖI, không "chọn đại".  `.first()` biến 5 match thành 1 lựa chọn thầm lặng;
 *      `one()` gặp >1 match thì NÉM LỖI kèm danh sách match → sai lộ ra ngay lúc viết script,
 *      thay vì lặng lẽ bấm nhầm rồi assert sai màn.
 *   2. NEO SCOPE TRƯỚC.  Tìm control trong đúng section/card/row/dialog, không quét toàn trang.
 *   3. NGHIỆM THU KẾT QUẢ.  Sau khi bấm phải thấy dấu hiệu mong đợi; nếu bật nhầm overlay thì
 *      tự đóng và báo lỗi, không đi tiếp trong trạng thái sai.
 *   4. ĐỌC GIÁ TRỊ CÓ NEO.  Không regex trên `body.innerText` (dễ vớ số của section khác).
 *
 * Lỗi ném ra đều mang tiền tố [script_error] — khớp `failureLayer: script_error` trong
 * `.agent/config/verdict_taxonomy.json` (loggableAsBug=false) ⇒ FAIL kiểu này KHÔNG được log Jira,
 * phải sửa script. Đây là chốt chặn chính chống "log bug sai vì bắt nhầm element".
 *
 * Dùng (CJS — chạy được trong spec Playwright lẫn script node task-scoped):
 *   const T = require('<repo>/scripts/utils/ui/safe_target');
 *   const card = await T.section(page, 'Product', { siblings: ['Add-on Course','Promotion Code'] });
 *   await T.clickVerified(page, card.getByRole('button', { name: 'Add Product' }), { expect: () => card.getByText('Please Choose') });
 *   const total = await T.readValue(card, 'Total Amount Due');
 */

const ERR = '[script_error]';

/** Ném lỗi phân loại script_error (không phải product bug). */
function scriptError(msg, detail) {
  const e = new Error(`${ERR} ${msg}${detail ? `\n${detail}` : ''}`);
  e.failureLayer = 'script_error';
  return e;
}

/**
 * Resolve ĐÚNG MỘT element. 0 match → lỗi; >1 match → lỗi kèm liệt kê (KHÔNG tự chọn cái đầu).
 * @param {import('@playwright/test').Locator} locator
 * @param {{what?:string, timeout?:number}} [opts]
 */
async function one(locator, opts = {}) {
  const what = opts.what || 'element';
  const timeout = opts.timeout || 8000;
  try { await locator.first().waitFor({ state: 'attached', timeout }); } catch (e) { /* để count() báo 0 */ }
  const n = await locator.count();
  if (n === 0) throw scriptError(`không tìm thấy ${what} (0 match) — locator sai hoặc chưa tới đúng màn/state.`);
  if (n > 1) {
    const sample = [];
    for (let i = 0; i < Math.min(n, 5); i += 1) {
      const t = (await locator.nth(i).innerText().catch(() => '')) || (await locator.nth(i).getAttribute('aria-label').catch(() => '')) || '';
      sample.push(`  [${i}] "${String(t).replace(/\s+/g, ' ').trim().slice(0, 60)}"`);
    }
    throw scriptError(`${what} MƠ HỒ: ${n} match — thu hẹp scope thay vì .first().`, sample.join('\n'));
  }
  return locator.first();
}

/**
 * Neo scope theo tiêu đề section/card. Dừng leo lên trước khi "nuốt" section hàng xóm.
 * @returns {Promise<import('@playwright/test').Locator>} locator trỏ tới khối section
 */
async function section(page, title, opts = {}) {
  const { siblings = [] } = opts;
  const MARK = 'data-xp-section';
  const ok = await page.evaluate(([t, sibs, mark]) => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const own = (e) => norm([...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(''));
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    document.querySelectorAll(`[${mark}]`).forEach((e) => e.removeAttribute(mark));
    const head = [...document.querySelectorAll('*')].find((e) => own(e) === t && vis(e));
    if (!head) return false;
    let scope = head;
    for (let k = 0; k < 5; k += 1) {
      const p = scope.parentElement; if (!p) break;
      const txt = norm(p.innerText || '');
      if ((sibs || []).some((s) => txt.includes(s))) break;   // đã chạm section hàng xóm → dừng
      scope = p;
    }
    scope.setAttribute(mark, '1');
    return true;
  }, [title, siblings, MARK]).catch(() => false);
  if (!ok) throw scriptError(`không neo được section "${title}" — kiểm tra đã tới đúng màn chưa (assertScreen) hoặc tiêu đề khác chữ.`);
  return page.locator(`[${MARK}="1"]`);
}

/** Đếm overlay đang mở (modal/dropdown). KHÔNG dùng offsetParent (position:fixed luôn null). */
function overlayCount(page) {
  return page.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return false; const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && c.opacity !== '0'; };
    const sel = '.ant-modal-wrap, .ant-modal, [role=dialog], .modal.show, .ant-drawer-open, .ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-picker-dropdown:not(.ant-picker-dropdown-hidden), .swal2-container';
    return [...document.querySelectorAll(sel)].filter(vis).length;
  }).catch(() => 0);
}

/**
 * Click có NGHIỆM THU: bấm xong phải thấy `expect()` hiện ra. Nếu chỉ bật nhầm overlay → Escape + ném lỗi.
 * @param {{expect:()=>import('@playwright/test').Locator, what?:string, settleMs?:number}} opts
 */
async function clickVerified(page, target, opts = {}) {
  const { expect: expectFn, what = 'control', settleMs = 800 } = opts;
  if (typeof expectFn !== 'function') throw scriptError('clickVerified cần { expect: () => locator } để nghiệm thu kết quả.');
  const el = await one(target, { what });
  const before = await overlayCount(page);
  await el.click({ timeout: 8000 });
  await page.waitForTimeout(settleMs);
  try {
    await expectFn().first().waitFor({ state: 'visible', timeout: 6000 });
    return true;
  } catch (e) {
    const after = await overlayCount(page);
    if (after > before) {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
      throw scriptError(`bấm "${what}" mở NHẦM overlay (modal/dropdown) thay vì kết quả mong đợi — đã Escape. Locator trỏ sai control.`);
    }
    throw scriptError(`bấm "${what}" xong KHÔNG thấy kết quả mong đợi → nhiều khả năng bấm trúng phần tử khác (hoặc thao tác chưa đủ điều kiện).`);
  }
}

/**
 * Đọc giá trị có NEO theo nhãn, trong phạm vi `scope` (KHÔNG regex toàn trang).
 * Tìm theo thứ tự: input/textarea gắn nhãn → text ngay sau nhãn trong cùng khối.
 */
async function readValue(scope, label, opts = {}) {
  const v = await scope.evaluate((root, lbl) => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const own = (e) => norm([...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(''));
    const nodes = [...root.querySelectorAll('*')].filter((e) => own(e) === lbl || own(e) === `${lbl}:`);
    for (const n of nodes) {
      let box = n;
      for (let k = 0; k < 4 && box; k += 1) {
        const inp = box.querySelector && box.querySelector('input, textarea');
        if (inp && inp.value !== undefined && inp.value !== '') return inp.value;
        box = box.parentElement;
      }
      const sib = n.nextElementSibling;
      if (sib && norm(sib.innerText)) return norm(sib.innerText);
      const parentTxt = norm(n.parentElement ? n.parentElement.innerText : '');
      if (parentTxt.startsWith(lbl)) { const rest = parentTxt.slice(lbl.length).replace(/^[:\s]+/, ''); if (rest) return rest.split('\n')[0]; }
    }
    return null;
  }, label).catch(() => null);
  if (v === null && !opts.optional) throw scriptError(`không đọc được giá trị của nhãn "${label}" trong scope — kiểm tra nhãn/scope, ĐỪNG fallback regex toàn trang.`);
  return v;
}

/** Chốt đang ở ĐÚNG màn trước khi thao tác (chống chuỗi lỗi do lạc trang). */
async function assertScreen(page, { url, heading } = {}) {
  if (url) {
    const cur = page.url();
    const okUrl = url instanceof RegExp ? url.test(cur) : cur.includes(url);
    if (!okUrl) throw scriptError(`sai màn: URL hiện tại "${cur}" không khớp ${url}.`);
  }
  if (heading) {
    const h = page.getByRole('heading', { name: heading });
    if (!(await h.count())) throw scriptError(`sai màn: không thấy tiêu đề "${heading}".`);
  }
  return true;
}

module.exports = { one, section, clickVerified, readValue, assertScreen, overlayCount, scriptError, ERR };
