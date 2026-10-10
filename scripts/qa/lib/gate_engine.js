'use strict';

/*
 * gate_engine.js (#2 architecture hardening) — INTERFACE gate CHUẨN + aggregator.
 *
 * Round-3 đẻ ra nhiều gate (preflight/design/output/risk/inventory...), mỗi cái tự console.log +
 * tự quyết exit → khó gộp "task fail vì gate nào?". GateEngine chuẩn hoá:
 *   GateResult = { gateId, status: PASS|WARN|FAIL|SKIP, severity: P0|P1|P2, findings:[{level,message}], counts }
 * và `aggregate()` gộp → 1 quyết định. Đa số gate đã trả {problems, warnings} → `toResult()` bọc lại;
 * KHÔNG cần sửa lõi gate (CI/hook/bug_reporter vẫn gọi hàm cũ). Engine là lớp GỘP thêm (self_review dùng).
 *
 * @typedef {'PASS'|'WARN'|'FAIL'|'SKIP'} GateStatus
 * @typedef {{ level: 'FAIL'|'WARN', message: string }} Finding
 * @typedef {{ gateId: string, status: GateStatus, severity: 'P0'|'P1'|'P2', findings: Finding[], note: string, counts: {fail:number, warn:number} }} GateResult
 */

/*
 * ── IN GỌN (`--compact`, H5 của token-diet) ──────────────────────────────────────────────────────────
 *
 * VÌ SAO: đo bằng `npm run token:audit` trên 4 lượt chạy task thật thì `output gate` chiếm 4,3 đến 8,9%
 * khối lượng kết quả tool, khoảng 54k token mỗi lượt. Phần lớn là lời giải thích DÀI lặp lại cho từng
 * case. Lời giải thích đó cần thiết lần đầu; từ lần thứ hai nó là bản sao.
 *
 * VÀ ĐÂY LÀ LỚP TRÌNH BÀY, KHÔNG PHẢI LỚP LỌC. Hai ràng buộc không được phá:
 *   ① KHÔNG bỏ dòng nào. Mọi vi phạm đều xuất hiện, kể cả vi phạm không khớp mã nào (nhận mã `KHAC`).
 *      `--compact` làm output ngắn bằng cách bớt LỜI GIẢI THÍCH, không bằng cách bớt VI PHẠM.
 *   ② KHÔNG sửa thông điệp gốc. Hàng chục spec đang khớp theo chữ trong thông điệp; thêm mã vào thông
 *      điệp sẽ làm đỏ chúng hàng loạt. Mã được gán bằng cách KHỚP vào thông điệp, nên chế độ đầy đủ
 *      giữ nguyên từng chữ.
 *
 * Spec tương đương (`compact-mode.spec.ts`) khoá cả hai: cùng exit code, và cùng TẬP (mã, TC ID).
 */
let CODES_CACHE = null;
function loadCodes() {
  if (CODES_CACHE) return CODES_CACHE;
  try {
    /* require TĨNH: đường dẫn cứng nên không cần `path.resolve`, và không cần tắt luật lint nào. */
    const cfg = require('../../../.agent/config/gate_codes.json');
    CODES_CACHE = {
      nguong: cfg.nguong_gop || 5,
      codes: (cfg.codes || []).map((c) => ({ code: c.code, re: new RegExp(c.khop, 'i'), y: c.y })),
    };
  } catch (e) {
    CODES_CACHE = { nguong: 5, codes: [] };
  }
  return CODES_CACHE;
}

/** Mã ổn định của một thông điệp vi phạm. Không khớp mã nào thì `KHAC` — vẫn được in. */
function maCua(message) {
  const s = String(message || '');
  for (const c of loadCodes().codes) if (c.re.test(s)) return c.code;
  return 'KHAC';
}

/** TC ID trong thông điệp, nếu có. Không có thì trả chuỗi rỗng — KHÔNG bịa. */
function tcIdTrong(message) {
  const m = String(message || '').match(/\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_TC_\d+)\b/);
  return m ? m[1] : '';
}

/** Ý chính: bỏ tiền tố file và TC ID, cắt còn tối đa `max` ký tự. */
function yChinh(message, max = 120) {
  let s = String(message || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[^\u00b7]*\.md \u00b7 /, '');
  const i = s.indexOf(': ');
  if (i > 0 && i < 40) s = s.slice(i + 2);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/**
 * Dựng các dòng in gọn từ danh sách thông điệp.
 * Trả `{ dong, tap }` — `tap` là tập (mã, TC ID) dùng để chứng minh tương đương với chế độ đầy đủ.
 */
function nenGon(messages) {
  const { nguong } = loadCodes();
  const theoMa = new Map();
  const tap = new Set();
  for (const m of messages || []) {
    const ma = maCua(m);
    const id = tcIdTrong(m);
    tap.add(ma + '|' + id);
    if (!theoMa.has(ma)) theoMa.set(ma, []);
    theoMa.get(ma).push({ id, y: yChinh(m) });
  }
  const dong = [];
  for (const [ma, list] of theoMa) {
    for (const x of list.slice(0, nguong)) {
      dong.push(ma + ' \u00b7 ' + (x.id || '-') + ' \u00b7 ' + x.y);
    }
    if (list.length > nguong) {
      const con = list.slice(nguong);
      const ids = con.map((x) => x.id).filter(Boolean);
      dong.push(ma + ' \u00b7 và ' + con.length + ' case cùng lỗi' + (ids.length ? ': ' + ids.join(', ') : ''));
    }
  }
  return { dong, tap };
}

/** In khối vi phạm ở chế độ gọn. `nhan` là chữ đứng đầu mỗi dòng. */
function inGon(messages, { nhan = '-', log = console.log } = {}) {
  const { dong } = nenGon(messages);
  dong.forEach((d) => log('  ' + nhan + ' ' + d));
  /* Chú thích phải NGẮN. Đo trên dải 1, 2, 3, 4, 6, 8, 11 vi phạm: bản chú thích dài tốn khoảng
   * 125 byte, đủ để chế độ GỌN to hơn chế độ đầy đủ ở khoảng 3 đến 6 vi phạm. Một chế độ tiết kiệm
   * mà tốn thêm là một chế độ không ai bật. */
  if (dong.length >= 3) log('  (bỏ --compact để xem giải thích đầy đủ)');
  return dong.length;
}

const STATUS = { PASS: 'PASS', WARN: 'WARN', FAIL: 'FAIL', SKIP: 'SKIP' };
const SEVERITY = { P0: 'P0', P1: 'P1', P2: 'P2' };

/**
 * Bọc kết quả 1 gate (shape {problems, warnings}) → GateResult chuẩn.
 * @param {string} gateId
 * @param {{ problems?: string[], warnings?: string[], skipped?: boolean, severity?: string, note?: string }} o
 * @returns {GateResult}
 */
function toResult(gateId, { problems = [], warnings = [], skipped = false, severity = SEVERITY.P1, note = '' } = {}) {
  const findings = [
    ...problems.map((m) => ({ level: STATUS.FAIL, message: String(m) })),
    ...warnings.map((m) => ({ level: STATUS.WARN, message: String(m) })),
  ];
  const status = skipped ? STATUS.SKIP : (problems.length ? STATUS.FAIL : (warnings.length ? STATUS.WARN : STATUS.PASS));
  return { gateId, status, severity, findings, note, counts: { fail: problems.length, warn: warnings.length } };
}

/**
 * Gộp nhiều GateResult → quyết định tổng. overall = FAIL nếu có gate FAIL, else WARN nếu có WARN, else PASS.
 * @param {GateResult[]} results
 */
function aggregate(results) {
  const list = (results || []).filter(Boolean);
  const totalFail = list.reduce((s, r) => s + r.counts.fail, 0);
  const totalWarn = list.reduce((s, r) => s + r.counts.warn, 0);
  const status = list.some((r) => r.status === STATUS.FAIL) ? STATUS.FAIL
    : (list.some((r) => r.status === STATUS.WARN) ? STATUS.WARN : STATUS.PASS);
  const blockers = list.filter((r) => r.status === STATUS.FAIL).map((r) => r.gateId);
  return { status, totalFail, totalWarn, blockers, results: list };
}

const MARK = { PASS: '✓ OK', WARN: '⚠ warn', FAIL: '✗ CHẶN', SKIP: '○ n/a' };

/** Format 1 báo cáo checklist người-đọc từ aggregate(). */
function format(agg, { title = 'GATE ENGINE', failHead = 15, warnHead = 8 } = {}) {
  const L = [`\n=== ${title} ===`];
  for (const r of agg.results) {
    L.push(`\n${MARK[r.status] || r.status}  [${r.severity}] ${r.gateId}${r.note ? ` (${r.note})` : ''}`);
    const fails = r.findings.filter((f) => f.level === STATUS.FAIL);
    fails.slice(0, failHead).forEach((f) => L.push(`    - ${f.message}`));
    if (fails.length > failHead) L.push(`    … +${fails.length - failHead} CHẶN nữa`);
    const warns = r.findings.filter((f) => f.level === STATUS.WARN);
    warns.slice(0, warnHead).forEach((f) => L.push(`    ~ ${f.message}`));
    if (warns.length > warnHead) L.push(`    … +${warns.length - warnHead} cảnh báo nữa`);
  }
  L.push(`\n=== Tổng: ${agg.totalFail} CHẶN · ${agg.totalWarn} cảnh báo · overall ${agg.status}${agg.blockers.length ? ` (CHẶN ở: ${agg.blockers.join(', ')})` : ''} ===`);
  return L.join('\n');
}

module.exports = { STATUS, SEVERITY, toResult, aggregate, format, maCua, tcIdTrong, yChinh, nenGon, inGon,};
