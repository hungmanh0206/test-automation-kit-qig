/**
 * env_signals.js — ASSERT tín hiệu môi trường trong lúc execute, không chỉ dùng để triage khi đã fail.
 *
 * VÌ SAO CÓ FILE NÀY: mỗi lượt execute đã mở trang thật và gọi API thật, tức đang có sẵn một kho tín hiệu mà
 * **không case nào assert** — JS exception, request 4xx/5xx chạy nền, response lệch contract. Đây là bắt bug
 * gần-như-miễn-phí: không thêm case, không thêm lượt tải trang, và bắt được cả bug **không liên quan** tới case
 * đang chạy (UI xanh nhưng một API phụ đang 500).
 *
 * Nói rõ để không ai tưởng là đã có: trước file này kit **không có collector nào** — `qa_instincts.md` chỉ *dặn*
 * agent tự soi console/Network khi điều tra. Dặn không phải forcing function.
 *
 * Dùng:
 *   const sig = attachEnvSignals(page, { ignore: [/analytics/] });
 *   … chạy case …
 *   const r = sig.report();            // { pageErrors, consoleErrors, httpErrors, contractViolations }
 *   sig.assertClean();                 // throw nếu có tín hiệu ⇒ dùng khi muốn zero-tolerance
 *
 * Chính sách: `pageerror` (JS exception) là **zero-tolerance** — có exception trong lúc chạy là finding, dù case
 * PASS. Còn 4xx thì phân biệt: 4xx do case negative CỐ Ý gây ra là hợp lệ, nên phải `expect4xx()` để khai trước.
 */

const DEFAULT_IGNORE = [
  /google-analytics|googletagmanager|gtag|facebook\.net|hotjar|sentry|clarity\.ms|yandex/i,   // tracking bên thứ ba
  /\/favicon\.ico$/i,
];

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ignore?: RegExp[], contracts?: {match: RegExp, validate: (body:any)=>string[]}[] }} opts
 */
function attachEnvSignals(page, opts = {}) {
  const ignore = [...DEFAULT_IGNORE, ...(opts.ignore || [])];
  const contracts = opts.contracts || [];
  const pageErrors = [];
  const consoleErrors = [];
  const httpErrors = [];
  const contractViolations = [];
  const expected4xx = [];                          // do case negative khai trước: { rx, why }

  const skip = (url) => ignore.some((rx) => rx.test(url));

  page.on('pageerror', (err) => {
    pageErrors.push({ message: String(err && err.message || err).slice(0, 300), stack: String(err && err.stack || '').split('\n')[1] || null });
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (skip(text)) return;
    consoleErrors.push({ text: text.slice(0, 300), location: msg.location() ? `${msg.location().url}:${msg.location().lineNumber}` : null });
  });
  page.on('response', async (res) => {
    const url = res.url();
    const status = res.status();
    if (skip(url)) return;
    if (status >= 400) {
      const claimed = expected4xx.find((e) => e.rx.test(url) && status < 500);
      httpErrors.push({ url: url.slice(0, 200), status, method: res.request().method(), expected: claimed ? claimed.why : null });
      return;
    }
    // Lệch contract: chỉ kiểm khi task khai contract cho endpoint đó (không tự đoán schema).
    const c = contracts.find((x) => x.match.test(url));
    if (!c) return;
    try {
      const body = await res.json();
      const bad = c.validate(body) || [];
      if (bad.length) contractViolations.push({ url: url.slice(0, 200), problems: bad.slice(0, 8) });
    } catch (e) { /* không phải JSON — bỏ, đây không phải chỗ phán */ }
  });

  return {
    /** Khai trước rằng một 4xx là CỐ Ý (case negative) — không khai thì nó bị tính là tín hiệu lạ. */
    expect4xx(rx, why) { expected4xx.push({ rx, why: why || 'case negative cố ý gây lỗi' }); },
    report() {
      return {
        pageErrors,
        consoleErrors,
        httpErrors: httpErrors.filter((h) => !h.expected),
        httpErrorsExpected: httpErrors.filter((h) => h.expected),
        contractViolations,
        clean: !pageErrors.length && !consoleErrors.length && !httpErrors.filter((h) => !h.expected).length && !contractViolations.length,
      };
    },
    /** Zero-tolerance: JS exception / console error / 4xx-5xx không khai trước / lệch contract ⇒ throw. */
    assertClean(label = '') {
      const r = this.report();
      if (r.clean) return r;
      const lines = [];
      for (const e of r.pageErrors) lines.push(`JS exception: ${e.message}`);
      for (const e of r.consoleErrors) lines.push(`console.error: ${e.text}`);
      for (const e of r.httpErrors) lines.push(`HTTP ${e.status} ${e.method} ${e.url}`);
      for (const e of r.contractViolations) lines.push(`lệch contract ${e.url}: ${e.problems.join(' · ')}`);
      throw new Error(`[env-signals]${label ? ` ${label}:` : ''} ${lines.length} tín hiệu môi trường — ${lines.join(' | ')}`);
    },
  };
}

/**
 * Đổi report thành finding của trục ①/môi trường để ghi vào expansion_findings.
 * Mỗi tín hiệu là app **tự mâu thuẫn với chính nó** (JS chết / API lỗi trong khi UI báo bình thường) ⇒
 * `EXPANSION_FINDING`, không cần oracle ngoài.
 */
function toFindings(report, { base_tc, surface } = {}) {
  const fnd = require('../../lib/expansion/finding');
  const out = [];
  const push = (kind, actual) => out.push(fnd.makeFinding({
    axis: 'field', base_tc, surface: surface || kind, self_inconsistent: true,
    expected: 'không có tín hiệu lỗi trong lúc chạy', actual,
  }));
  for (const e of report.pageErrors) push('pageerror', `JS exception: ${e.message}`);
  for (const e of report.consoleErrors) push('console', `console.error: ${e.text}`);
  for (const e of report.httpErrors) push('http', `HTTP ${e.status} ${e.method} ${e.url}`);
  for (const e of report.contractViolations) push('contract', `lệch contract ${e.url}: ${e.problems.join(' · ')}`);
  return out;
}

module.exports = { attachEnvSignals, toFindings, DEFAULT_IGNORE };
