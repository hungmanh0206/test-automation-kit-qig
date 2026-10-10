'use strict';

/*
 * api_card.js — RENDER request/response THÀNH ẢNH, để test API có evidence hợp luật 4.
 *
 * VÌ SAO CÓ (v2.5.0 G2.2). Non-negotiable §4 đòi MỌI case đã execute phải có ảnh hoặc video, và CẤM
 * `.json/.md/.txt/.log/.html/.csv`. Với test UI thì dễ: chụp màn. Với test API thì **không có gì để
 * chụp** — nên trước file này, một case `Loại case = API` không thể tạo evidence hợp luật. Đường duy nhất
 * còn lại là dán response vào một file `.json`, mà đó chính là thứ luật 4 cấm.
 *
 * ĐÂY KHÔNG PHẢI NỚI LUẬT. Luật 4 giữ nguyên là ảnh; chỉ đổi CÁCH TẠO RA ảnh. Bộ này dựng một thẻ HTML
 * tạm rồi chụp nó thành PNG — bản HTML là trung gian, KHÔNG phải evidence, và không được ghi ra đĩa.
 *
 * GÁC Ở CHỖ SINH RA, KHÔNG GÁC Ở GATE — và lý do là một phép đo: entry trong `testcase-status.json` chỉ
 * có `tcId · status · comment · evidence · runId`, **không có `Loại case`**. Gate không biết case nào là
 * API, nên nó không thể đòi "case API phải có thẻ API". Và gate cũng không đọc được PIXEL để biết ảnh có
 * đủ method/URL/status hay không.
 *
 * Nên phép gác nằm ở đây: `renderApiCard` TỪ CHỐI render khi thiếu `method`, `url` hoặc `status`. Ảnh tồn
 * tại ⇒ ba thứ đó đã có, vì không có đường nào khác tạo ra ảnh này. Nói rõ ra thay vì để ai đó tin gate
 * đang kiểm nội dung ảnh.
 *
 * Dùng (trong spec Playwright, cần một `page` bất kỳ — không điều hướng đi đâu):
 *   const { renderApiCard } = require('scripts/utils/evidence/api_card');
 *   await renderApiCard(page, {
 *     method: 'POST', url: '/api/v2/hoc-sinh', status: 400,
 *     requestBody: { email: 'abc' },
 *     responseBody: { error: 'EMAIL_INVALID' },
 *     note: 'BR-HS-012: email thiếu @ phải bị chặn',
 *   }, 'outputs/.../evidence/TC_088-api-card.png');
 */

const fs = require('fs');
const path = require('path');
const { sanitize, countPII } = require(path.join(__dirname, 'sanitize'));

/** Hậu tố bắt buộc, để người đọc và `ci:scope` nhận ra đây là thẻ API chứ không phải ảnh màn. */
const HAU_TO = '-api-card.png';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** In JSON cho người đọc; chuỗi thì để nguyên. Luôn đi qua `sanitize` trước khi vào HTML. */
function khoiText(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

/**
 * Dựng HTML của thẻ. Tách khỏi phần chụp để test được mà không cần browser.
 *
 * Mọi text đi qua `sanitize` của `scripts/utils/evidence/sanitize.js` — KHÔNG viết bản masker thứ hai.
 * Kit đã có hai bản PII (`sanitize.js` và `PII_PATTERNS` của `output_rules`), thêm bản thứ ba là tạo
 * đúng cái lỗi mà kit đang đi chặn ở chỗ khác.
 */
function buildHtml(o = {}) {
  const thieu = ['method', 'url', 'status'].filter((k) => o[k] === undefined || o[k] === null || String(o[k]).trim() === '');
  if (thieu.length) {
    throw new Error(`[api-card] TỪ CHỐI render: thiếu ${thieu.join(', ')}. Thẻ API phải mang method, URL và status — ảnh thiếu chúng thì nó không chứng minh được gì, và gate KHÔNG đọc được pixel để bắt sau.`);
  }
  const req = sanitize(khoiText(o.requestBody));
  const res = sanitize(khoiText(o.responseBody));
  if (!req && !res) {
    throw new Error('[api-card] TỪ CHỐI render: thiếu CẢ `requestBody` và `responseBody`. Một thẻ chỉ có method/URL/status không nói được app trả về gì.');
  }
  const url = sanitize(String(o.url));
  const note = sanitize(String(o.note || ''));
  const st = Number(o.status);
  const mau = st >= 500 ? '#b91c1c' : st >= 400 ? '#b45309' : '#15803d';

  return `<!doctype html><html lang="vi"><meta charset="utf-8"><body style="margin:0;font:13px/1.5 Consolas,monospace;background:#fff;color:#111;width:980px">
<div style="padding:16px 20px;border-bottom:2px solid #111">
  <div style="font:700 18px/1.3 system-ui"><span style="background:#111;color:#fff;padding:2px 8px;border-radius:3px">${esc(String(o.method).toUpperCase())}</span>
  <span style="margin-left:8px">${esc(url)}</span></div>
  <div style="margin-top:6px;font:700 15px system-ui;color:${mau}">HTTP ${esc(String(st))}</div>
  ${note ? `<div style="margin-top:6px;font:italic 13px system-ui;color:#374151">${esc(note)}</div>` : ''}
</div>
${req ? `<div style="padding:12px 20px"><div style="font:700 12px system-ui;color:#6b7280;letter-spacing:.06em">REQUEST BODY</div>
<pre style="margin:6px 0 0;padding:10px;background:#f3f4f6;border-radius:4px;white-space:pre-wrap;word-break:break-all">${esc(req)}</pre></div>` : ''}
${res ? `<div style="padding:0 20px 16px"><div style="font:700 12px system-ui;color:#6b7280;letter-spacing:.06em">RESPONSE BODY</div>
<pre style="margin:6px 0 0;padding:10px;background:#f3f4f6;border-radius:4px;white-space:pre-wrap;word-break:break-all">${esc(res)}</pre></div>` : ''}
</body></html>`;
}

/**
 * Render thẻ API thành PNG.
 *
 * @param {import('@playwright/test').Page} page  trang Playwright bất kỳ — KHÔNG điều hướng đi đâu
 * @param {object} o   { method, url, status, requestBody?, responseBody?, note? }
 * @param {string} out đường dẫn PNG, bắt buộc kết thúc bằng `-api-card.png`
 */
async function renderApiCard(page, o, out) {
  if (!page || typeof page.setContent !== 'function' || typeof page.screenshot !== 'function') {
    throw new Error('[api-card] cần một `page` của Playwright (có `setContent` và `screenshot`).');
  }
  const duong = String(out || '');
  if (!duong.endsWith(HAU_TO)) {
    throw new Error(`[api-card] đường dẫn phải kết thúc bằng \`${HAU_TO}\` — hậu tố là cách người đọc và máy phân biệt thẻ API với ảnh màn.`);
  }
  const html = buildHtml(o);          // ném TRƯỚC khi chụp nếu thiếu trường

  fs.mkdirSync(path.dirname(duong), { recursive: true });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: duong, fullPage: true });

  return {
    file: duong,
    method: String(o.method).toUpperCase(),
    url: sanitize(String(o.url)),
    status: Number(o.status),
    /* Đếm PII đã che, để báo cáo nói được "có che" thay vì chỉ hứa. */
    piiMasked: countPII(`${khoiText(o.requestBody)} ${khoiText(o.responseBody)} ${o.url} ${o.note || ''}`),
  };
}

module.exports = { renderApiCard, buildHtml, HAU_TO };
