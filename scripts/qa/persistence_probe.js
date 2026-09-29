#!/usr/bin/env node
/**
 * persistence_probe.js — TRỤC 3: chuỗi lưu trữ `form → payload → đọc lại (API) → UI`.
 *
 * VÌ SAO CÓ FILE NÀY: một lớp bug rất đắt mà test theo case gần như không bắt: **giá trị nhập vào không sống sót
 * qua chuỗi**. Đo trên CSDL-24395 có 13 bug thuộc trục này, và mỗi cái đều "đúng" ở vài điểm nên nhìn từng điểm
 * riêng lẻ thì thấy bình thường:
 *   - CSDL-28310: form nhập Service Fee 1.000.000 → **BE lưu 0** → đơn tự nhảy "Đã thanh toán" (thất thu).
 *   - CSDL-28376: form tính thành tiền đúng → **payload gửi 0** khi tick "included in Course Payment".
 *   - CSDL-28442: gói chuyển nhượng **không được gửi lên payload**, API trả success nhưng không tạo Order.
 *   - CSDL-28403: tiền USD **không quy đổi** sang VND ⇒ thành tiền sai một bậc độ lớn.
 * Điểm chung: phải so **4 điểm cùng một giá trị mồi**, và phải nói được **mắt nào đứt** — vì "kết quả sai" thì
 * FE và BE đẩy qua đẩy lại, còn "payload đã gửi 0" thì hết tranh luận.
 *
 * PHẠM VI (nói thẳng): việc LÁI form là task-specific (wizard nhiều bước, picker, modal) nên KHÔNG generic hoá ở
 * đây. File này generic hoá 3 thứ dùng lại được: (1) sinh **giá trị mồi phân biệt**, (2) **so 4 điểm** và chỉ ra
 * mắt đứt, (3) phân loại kiểu hỏng. Script execute của task ghi lại 4 điểm rồi gọi vào đây.
 *
 * Dùng:
 *   node scripts/qa/persistence_probe.js --seed number        # in giá trị mồi phân biệt
 *   node scripts/qa/persistence_probe.js --chains <chains.json> [--out <report.md>] [--enforce]
 *
 * chains.json = [{ "name": "...", "points": { "form": ..., "payload": ..., "api": ..., "ui": ... } }]
 * Điểm nào không đo được thì BỎ HẲN key (đừng để null) — engine sẽ nói rõ chuỗi bị khuyết chỗ nào thay vì
 * ngầm coi là đạt.
 */

const fs = require('fs');
const path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const ENFORCE = process.argv.includes('--enforce');

const ORDER = ['form', 'payload', 'api', 'ui'];
const LINK_MEANING = {
  'form→payload': 'FE KHÔNG gửi đúng giá trị người dùng nhập (lỗi tầng FE — payload là bằng chứng, hết tranh luận)',
  'payload→api': 'BE nhận đúng nhưng LƯU/TRẢ khác (lỗi tầng BE)',
  'api→ui': 'BE trả đúng nhưng màn hình hiển thị khác (lỗi tầng FE khi render)',
};

/**
 * Giá trị mồi PHÂN BIỆT: phải không trùng giá trị mặc định/0/round number, để "trùng nhau" không thể là ngẫu
 * nhiên. Đây là bài học từ fixture: hai nguồn cùng giá trị thì không chứng minh được gì.
 */
function seed(kind) {
  const t = Date.now() % 100000;
  if (kind === 'number' || kind === 'money') return 1000000 + (t * 7) % 899999 + 3;   // lẻ, không tròn, không 0
  if (kind === 'percent') return Number((3 + (t % 37) / 7).toFixed(2));
  return `IT test probe ${t}`;                                                        // theo quy ước đặt tên dữ liệu test
}

/** Chuẩn hoá để so: bỏ ký hiệu tiền, dấu phân cách nghìn, khoảng trắng; giữ dấu âm và phần thập phân. */
function normVal(v) {
  if (v === null || v === undefined) return { kind: 'missing', n: null, s: '' };
  if (typeof v === 'boolean') return { kind: 'bool', n: v ? 1 : 0, s: String(v) };
  const s = String(v).trim();
  const cleaned = s.replace(/[₫đ$€\s]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(/,(?=\d{3}\b)/g, '').replace(/,/g, '.');
  if (cleaned !== '' && /^-?\d+(\.\d+)?%?$/.test(cleaned)) return { kind: 'num', n: parseFloat(cleaned), s };
  return { kind: 'text', n: null, s };
}

const same = (a, b) => {
  if (a.kind === 'num' && b.kind === 'num') return Math.abs(a.n - b.n) < 0.005;
  return a.s.replace(/\s+/g, ' ').toLowerCase() === b.s.replace(/\s+/g, ' ').toLowerCase();
};

/** Kiểu hỏng — để người đọc biết NGAY nên nghi gì, thay vì chỉ biết "hai số khác nhau". */
function classify(from, to) {
  if (to.kind === 'missing') return 'GIÁ TRỊ BỊ MẤT HẲN (field không có trong payload/response — nghi FE không gửi hoặc BE bỏ qua)';
  if (to.kind === 'num' && to.n === 0 && from.kind === 'num' && from.n !== 0) return 'GIÁ TRỊ THÀNH 0 (lớp bug thất thu: đơn có thể tự nhảy "đã thanh toán")';
  if (to.s === '' && from.s !== '') return 'GIÁ TRỊ THÀNH RỖNG';
  if (from.kind === 'num' && to.kind === 'num' && from.n !== 0) {
    const r = to.n / from.n;
    for (const [f, why] of [[1000, 'nghi sai đơn vị nghìn'], [100, 'nghi sai đơn vị trăm/percent']]) {
      if (Math.abs(r - f) < 0.01 || Math.abs(r - 1 / f) < 1e-6) return `LỆCH ĐÚNG ${f} LẦN (${why})`;
    }
    if (r > 1.5 || r < 0.67) return 'LỆCH MỘT BẬC ĐỘ LỚN (nghi thiếu quy đổi tiền tệ hoặc lấy sai field)';
    if (Math.abs(to.n - Math.round(from.n)) < 0.005) return 'BỊ LÀM TRÒN';
    return 'LỆCH GIÁ TRỊ';
  }
  if (from.kind === 'text' && to.kind === 'text' && to.s.length < from.s.length && from.s.startsWith(to.s)) return 'BỊ CẮT NGẮN (nghi giới hạn độ dài ở BE/DB)';
  return 'LỆCH GIÁ TRỊ';
}

function evaluate(chain) {
  const pts = chain.points || {};
  const present = ORDER.filter((k) => Object.prototype.hasOwnProperty.call(pts, k));
  const missing = ORDER.filter((k) => !present.includes(k));
  const breaks = [];
  for (let i = 0; i < present.length - 1; i += 1) {
    const a = normVal(pts[present[i]]);
    const b = normVal(pts[present[i + 1]]);
    if (!same(a, b)) {
      breaks.push({
        link: `${present[i]}→${present[i + 1]}`,
        from: String(pts[present[i]]),
        to: pts[present[i + 1]] === undefined ? '(không có)' : String(pts[present[i + 1]]),
        kind: classify(a, b),
      });
    }
  }
  // `ok` PHẢI đòi đủ 4 điểm: chuỗi khớp ở 2 điểm mà thiếu payload/api thì chưa chứng minh được gì — trả `ok`
  // ở đó đúng là kiểu "im lặng thành đạt" mà cả bộ gate này sinh ra để chống. Chuỗi khuyết ⇒ `partial`.
  return {
    name: chain.name,
    present,
    missing,
    breaks,
    // KHÔNG đặt tên `ok`: 4 điểm khớp CHỈ chứng minh **nhất quán**, không chứng minh ĐÚNG. Ca thật CSDL-28403
    // (USD không quy đổi) khớp cả 4 điểm ở giá trị 10 trong khi đúng phải 260.500 ⇒ tên `ok` là mầm PASS giả.
    // Muốn PASS thì phải có `oracle_ref` — xem scripts/lib/expansion/finding.js.
    consistent: breaks.length === 0 && missing.length === 0,
    partial: breaks.length === 0 && missing.length > 0,
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const kind = arg('seed');
  if (kind) { console.log(String(seed(kind))); process.exit(0); }

  const cPath = arg('chains');
  if (!cPath || !fs.existsSync(cPath)) {
    console.error('[probe] ✗ thiếu --chains <chains.json> (hoặc --seed number|money|percent|text)');
    process.exit(2);
  }
  const chains = JSON.parse(fs.readFileSync(cPath, 'utf8'));
  const results = (Array.isArray(chains) ? chains : chains.chains || []).map(evaluate);
  const broken = results.filter((r) => r.breaks.length);
  const partial = results.filter((r) => !r.breaks.length && r.missing.length);

  console.log(`[probe] ${results.length} chuỗi · ${broken.length} có mắt ĐỨT · ${partial.length} chuỗi đo thiếu điểm`);
  for (const r of results) {
    if (!r.breaks.length && !r.missing.length) { console.log(`[probe] ~ ${r.name} — ${r.present.length}/4 điểm NHẤT QUÁN (chưa phải PASS: cần oracle_ref)`); continue; }
    if (r.breaks.length) {
      console.log(`[probe] ✗ ${r.name} — đứt ${r.breaks.length} mắt (đo ${r.present.join(' → ')})`);
      for (const b of r.breaks) {
        console.log(`[probe]    ${b.link}: "${b.from}" ⇒ "${b.to}"  · ${b.kind}`);
        console.log(`[probe]      TẦNG: ${LINK_MEANING[b.link] || 'so hai điểm liền nhau'}`);
      }
    } else {
      console.log(`[probe] ⚠ ${r.name} — khớp ở ${r.present.length} điểm nhưng THIẾU: ${r.missing.join(', ')} ⇒ chưa chứng minh được cả chuỗi`);
    }
  }

  // Xuất FINDING có cấu trúc để gate/triage đọc được, và để luật oracle được ÉP bằng máy:
  // mắt đứt ⇒ EXPANSION_FINDING (app tự mâu thuẫn, không cần oracle ngoài) · nhất quán mà KHÔNG neo ⇒ OBSERVATION.
  const taskDir = arg('task-dir');
  if (taskDir) {
    const fnd = require(path.resolve(__dirname, '..', 'lib', 'expansion', 'finding'));
    const srcList = Array.isArray(chains) ? chains : chains.chains || [];
    const items = [];
    for (const r of results) {
      const src = srcList.find((c) => c.name === r.name) || {};
      if (r.breaks.length) {
        for (const b of r.breaks) {
          items.push(fnd.makeFinding({
            axis: 'persist', base_tc: src.base_tc, surface: b.link, self_inconsistent: true,
            expected: b.from, actual: b.to, oracle_ref: src.oracle_ref, evidence: src.evidence,
          }));
        }
      } else {
        const pts = src.points || {};
        items.push(fnd.makeFinding({
          axis: 'persist', base_tc: src.base_tc, surface: r.present.join('→'),
          expected: src.expected !== undefined ? src.expected : pts[r.present[0]],
          actual: pts[r.present[r.present.length - 1]],
          oracle_ref: src.oracle_ref, evidence: src.evidence,
          open_question: src.oracle_ref ? undefined : `Chuỗi nhất quán ${r.present.length} điểm, nhưng chưa có rule nào nói giá trị ĐÚNG phải là bao nhiêu — cần BR-/SM- rồi mới kết luận PASS.`,
        }));
      }
    }
    const w = fnd.writeFindings(taskDir, items, { append: process.argv.includes('append') });
    console.log(`[probe] finding: EXPANSION_FINDING ${w.summary.EXPANSION_FINDING} · PASS ${w.summary.PASS} · FAIL ${w.summary.FAIL} · OBSERVATION ${w.summary.OBSERVATION} → ${path.relative(process.cwd(), w.mdPath)}`);
    for (const v of w.violations) console.log(`[probe] ✗ ${v}`);
  }

  const out = arg('out');
  if (out) {
    const proven = results.filter((r) => r.consistent).length;
    const L = [`<!-- gate: proven=${proven} inconclusive=${partial.length} broken=${broken.length} -->`,
      '# Probe chuỗi lưu trữ (form → payload → API → UI)', '',
      '> Sinh bởi `scripts/qa/persistence_probe.js`. Giá trị mồi phải **phân biệt** (không tròn, không 0), nếu không',
      '> thì "trùng nhau" có thể là ngẫu nhiên. Mắt đứt chỉ ra **tầng lỗi** — payload là bằng chứng khách quan.', '',
      `- Chuỗi đo: **${results.length}** · có mắt đứt: **${broken.length}** · đo thiếu điểm: **${partial.length}**`, '',
      '| Chuỗi | Điểm đã đo | Mắt đứt | Từ ⇒ Đến | Kiểu hỏng | Tầng |', '|---|---|---|---|---|---|'];
    for (const r of results) {
      if (!r.breaks.length) { L.push(`| ${r.name} | ${r.present.join(' → ')} | — | — | — | ${r.missing.length ? `thiếu ${r.missing.join(', ')}` : 'OK'} |`); continue; }
      for (const b of r.breaks) L.push(`| ${r.name} | ${r.present.join(' → ')} | \`${b.link}\` | ${b.from} ⇒ ${b.to} | ${b.kind} | ${(LINK_MEANING[b.link] || '').split('(')[0].trim()} |`);
    }
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, `${L.join('\n')}\n`);
    console.log(`[probe] báo cáo: ${out}`);
  }

  if (ENFORCE && broken.length) process.exit(1);
}

module.exports = { seed, evaluate, normVal, classify };
