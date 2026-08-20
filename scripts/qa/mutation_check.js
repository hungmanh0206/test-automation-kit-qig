#!/usr/bin/env node
/**
 * mutation_check.js — NEGATIVE CONTROL: cố ý tiêm lỗi rồi xem máy kiểm có ĐỎ không.
 *
 * VÌ SAO ĐÂY LÀ THỨ QUAN TRỌNG NHẤT: mọi máy khác đều **cố bắt thêm bug**; máy này **đo năng lực phát hiện** của
 * chính bộ kiểm. Trước nó, câu "cover đầy đủ mà vẫn lọt" chỉ có thể phỏng đoán — vì kit đang *giả định* suite bắt
 * được bug mà chưa bao giờ chứng minh. Tiêm sai mà bộ kiểm vẫn xanh ⇒ **vùng mù đã được chứng minh**, không phải
 * nghi ngờ. Nó cũng là thước đo duy nhất trả lời được: 5 trục vừa xây có bịt đúng chỗ hay không.
 *
 * AN TOÀN: tiêm ở tầng `page.route()` — bóp méo **response trên đường về browser**, KHÔNG chạm dữ liệu UAT, không
 * ghi gì lên server. Chạy định kỳ (nightly / mỗi release), không phải mỗi PR.
 *
 * Dùng:
 *   TASK_ENV=profiles/<TASK>/task.env \
 *   node scripts/qa/mutation_check.js --catalog <ui_catalog.json> [--mutants <mutants.json>] [--out <report.md>]
 *        [--enforce] [--only <id,id>]
 *
 * Mỗi mutant: { id, why, match (regex url), mutate: {op, path, value} } — `op` ∈ set dưới đây.
 * Chấm điểm: mutant **bị bắt** (killed) nếu bộ kiểm sinh thêm deviation so với lượt chạy nền (baseline).
 * `mutation score = killed / total`. Mutant **sống sót** (survived) = một vùng mù có bằng chứng.
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const { chromium } = require('@playwright/test');
const { checkScreen, login } = require(path.resolve(__dirname, 'ui_conformance_check.js'));
const xsurf = require(path.resolve(__dirname, 'cross_surface_diff.js'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const ENFORCE = process.argv.includes('--enforce');

// `require.main` guard (LẦN THỨ BA trong phiên mắc lỗi này ở 3 file khác nhau: cross_surface_diff, fixture_matrix,
// và đây): thiếu nó thì `require()` trong test làm CLI chạy và `process.exit(2)` vì không có --catalog. Đã thành
// test khoá ở tests/fe/infra/cli-guard.spec.ts.
function loadCatalog() {
  const c = arg('catalog');
  if (!c || !fs.existsSync(c)) { console.error(`[mut] ✗ thiếu --catalog: ${c || '(không truyền)'}`); process.exit(2); }
  return JSON.parse(fs.readFileSync(c, 'utf8'));
}

/**
 * Bộ mutant mặc định — mỗi cái nhắm đúng một lớp bug ĐÃ TỪNG LỌT thật:
 *   zero_out       ← SAPP-28310/28376 (giá trị bị lưu/gửi thành 0)
 *   drop_field     ← SAPP-28404/28442 (field mất khỏi response/payload)
 *   halve_number   ← sai công thức/discount
 *   stringify_num  ← 540000 → "540000.0" (lệch format/kiểu, lớp bug rất hay lọt)
 *   change_status  ← trạng thái sai (paid ↔ pending)
 *   rename_label   ← nhãn lệch ("Phone" vs "Phone number") — đúng ca đang mở với BA
 */
const DEFAULT_MUTANTS = [
  { id: 'zero_out', why: 'giá trị tiền bị 0 (lớp SAPP-28310/28376 — thất thu)', op: 'zero_money' },
  { id: 'drop_field', why: 'field biến mất khỏi response (lớp SAPP-28404/28442)', op: 'drop_first_money' },
  { id: 'halve_number', why: 'số bị sai một nửa (sai công thức/ưu đãi)', op: 'halve_money' },
  { id: 'stringify_num', why: 'số thành chuỗi có .0 — lệch kiểu/format', op: 'stringify_money' },
  { id: 'rename_label', why: 'nhãn text bị đổi (lớp "Phone" vs "Phone number")', op: 'rename_text' },
];

const MONEY_KEYS = /(amount|fee|price|total|paid|discount|convertible)/i;

/** Biến đổi body JSON theo op. Trả {changed, note}. */
function mutateBody(body, op) {
  let changed = null;
  let original = null;
  const walk = (o) => {
    if (!o || typeof o !== 'object' || changed) return;
    for (const k of Object.keys(o)) {
      if (changed) return;
      const v = o[k];
      // API này trả tiền dưới dạng **CHUỖI** ("900000"), nên bản đầu đòi `typeof v === 'number'` không bao giờ
      // khớp ⇒ 4/5 mutant "không tiêm được". Nhận cả hai kiểu, và GHI LẠI giá trị gốc để sau còn xét mutant có
      // liên quan tới màn hay không.
      const isNum = typeof v === 'number' || (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v));
      const nv = typeof v === 'number' ? v : parseFloat(v);
      if (isNum && MONEY_KEYS.test(k) && nv !== 0) {
        const keep = typeof v === 'number' ? (x) => x : (x) => String(x);
        if (op === 'zero_money') { o[k] = keep(0); changed = `${k}: ${v} → 0`; original = String(v); return; }
        if (op === 'halve_money') { o[k] = keep(Math.round(nv / 2)); changed = `${k}: ${v} → ${o[k]}`; original = String(v); return; }
        if (op === 'stringify_money') { o[k] = `${nv}.0`; changed = `${k}: ${v} → "${nv}.0"`; original = String(v); return; }
        if (op === 'drop_first_money') { delete o[k]; changed = `xoá field ${k} (giá trị ${v})`; original = String(v); return; }
      }
      if (typeof v === 'string' && op === 'rename_text' && /^[A-Za-zÀ-ỹ ]{4,28}$/.test(v) && MONEY_KEYS.test(k) === false && /name|label|title|status|type/i.test(k)) {
        o[k] = `${v} X`; changed = `${k}: "${v}" → "${v} X"`; original = v; return;
      }
      if (v && typeof v === 'object') walk(v);
    }
  };
  walk(body);
  return { changed, original };
}

async function runOnce(page, screens, mutant) {
  let injected = null;
  let originalValue = null;
  let mutantValue = null;
  let lastBizUrl = null;
  if (mutant) {
    // Chỉ bóp endpoint NGHIỆP VỤ. Bản đầu chặn `**/api/**` nên bóp cả `analytics.tiktok.com/api/v2/pixel` và
    // `/api/v1/me` — vô nghĩa, mà lại làm mutant "sống sót" một cách giả (tiêm vào thứ màn không hiển thị).
    // Danh từ nghiệp vụ KHÔNG phải lúc nào cũng đứng ngay sau `/api/v1/`.
    // Đo 20/08/2026: endpoint thật của OPS là `/api/v1/product-orders/transactions` và
    // `/api/v1/product-orders/<id>` — bản cũ đòi khớp NGAY sau `/api/v\d+/` nên TRƯỢT SẠCH ⇒ route handler
    // không bắn lần nào ⇒ cả 5 mutant báo "không tìm được field phù hợp". Đó là **phép đo hỏng**, rất dễ
    // đọc nhầm thành "bộ kiểm mù 0%". Nay cho phép vài đoạn path ở giữa, nhưng VẪN chỉ nhận danh từ nghiệp
    // vụ — không nới thành bắt-tất-cả dưới /api/ (bản đầu làm thế thì bóp cả pixel của analytics).
    // (Dùng comment DÒNG: chuỗi có `*` + `/` liền nhau sẽ đóng sớm khối /* */ và biến phần sau thành code.)
    const BIZ = mutant.match ? new RegExp(mutant.match)
      : /\/api\/v\d+\/(?:[a-z0-9-]+\/)*(service-fee-orders|product-orders|add-on-orders|orders|transactions|products|combos)\b/i;
    await page.route((url) => BIZ.test(String(url)), async (route) => {
      const res = await route.fetch();
      const ct = res.headers()['content-type'] || '';
      if (!/json/.test(ct)) { await route.fulfill({ response: res }); return; }
      let body;
      try { body = JSON.parse(await res.text()); } catch (e) { await route.fulfill({ response: res }); return; }
      if (process.argv.includes('--debug')) {
        const keys = [];
        const scan = (o, pre) => { if (!o || typeof o !== 'object') return; for (const k of Object.keys(o)) { const v = o[k]; if (typeof v === 'number') keys.push(`${pre}${k}=${v}`); else if (v && typeof v === 'object') scan(v, `${pre}${k}.`); } };
        scan(body, '');
        console.log(`[mut][debug] ${route.request().url().slice(-60)} · số: ${keys.slice(0, 10).join(' ') || '(không có field số)'}`);
      }
      if (!injected) {
        const m = mutateBody(body, mutant.op);
        if (m.changed) { injected = `${route.request().url().split('?')[0].slice(-48)} · ${m.changed}`; originalValue = m.original; lastBizUrl = route.request().url(); mutantValue = String(m.changed).split('→').pop().replace(/["\s]/g, ''); }
      }
      await route.fulfill({ response: res, body: JSON.stringify(body), headers: { ...res.headers(), 'content-type': 'application/json' } });
    });
  }
  let dev = 0;
  const base = (process.env.OPS_BASE_URL || '').replace(/\/+$/, '');
  for (const screen of screens) {
    // PHẢI điều hướng trước: `checkScreen` KHÔNG tự goto (CLI làm việc đó). Bản đầu tôi bỏ bước này ⇒ trang chưa
    // mở, không có request nào để bóp, và cả 5 mutant đều "không tiêm được" — baseline 4 deviation chính là dấu
    // hiệu: nó là số của màn login, không phải của màn cần kiểm.
    // eslint-disable-next-line no-await-in-loop
    if (screen.url) await page.goto(/^https?:/.test(screen.url) ? screen.url : base + screen.url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(screen.settle || 6000);
    // eslint-disable-next-line no-await-in-loop
    const r = await checkScreen(page, base, screen);
    dev += (r || []).filter((d) => !String(d.type).startsWith('info.')).length;
  }
  // BẪY PHƯƠNG PHÁP phải xử trước khi kết luận về trục ②: nếu mutation chặn CẢ request của app LẪN request
  // xác minh của máy kiểm thì hai bên cùng bị bóp ⇒ không bao giờ lệch ⇒ trục ② "không bắt được" một cách GIẢ.
  // Đây đúng là tautology, chỉ ở tầng harness. Cách xử: bỏ route SAU KHI app đã load (UI giữ giá trị đã bóp),
  // rồi mới fetch API sạch để so — đó chính là phép so cùng-giá-trị-khác-bề-mặt.
  // Chạy ĐÚNG logic trục ② (hàm của `cross_surface_diff`), không phải phép so tự chế của harness — nếu tự chế
  // thì harness đang tự chấm mình, đúng loại tautology mà cả vòng này sinh ra để chống.
  let xsurfCaught = null;
  let xsurfDetail = null;
  if (mutant && originalValue) {
    await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
    const pairs = await xsurf.pairsOf(page).catch(() => ({}));       // UI: đang giữ giá trị ĐÃ BÓP
    const tok = await page.evaluate(() => localStorage.getItem('actToken')).catch(() => null);
    const apiFresh = await page.evaluate(async ([u, t]) => {
      const r = await fetch(u, { headers: { Authorization: `Bearer ${t}` } });
      return r.ok ? await r.json() : null;
    }, [lastBizUrl, tok]).catch(() => null);
    // Tìm nhãn UI nào đang mang giá trị bị bóp, rồi so với giá trị GỐC trong nguồn sạch — bằng `core()` của xsurf.
    if (process.argv.includes('--debug')) {
      const near = Object.entries(pairs).filter(([k]) => /amount|fee|price|total|paid|discount|convertible/i.test(k));
      console.log(`[mut][debug] nhãn TIỀN đọc được trên UI sau khi tiêm: ${near.map(([k, v]) => `${k}="${v}"`).join(' · ') || '(không có)'}`);
      console.log(`[mut][debug] tổng số cặp nhãn→giá trị: ${Object.keys(pairs).length}`);
    }
    const mutCore = xsurf.core(mutantValue).v;
    const origCore = xsurf.core(originalValue).v;
    // Phép đúng cho MỌI op: suy nhãn UI từ TÊN FIELD bị bóp, đọc giá trị UI của nhãn đó, rồi so với giá trị GỐC
    // ở nguồn sạch. Không phụ thuộc "giá trị bị bóp là gì" — chẩn đoán thật cho thấy khi xoá `convertible_amount`
    // thì FE render "0đ" (không trống, không mất nhãn), nên cách tìm-theo-giá-trị-bị-bóp của bản trước trượt.
    const fieldKey = (String(injected || '').match(/(?:xoá field )?([a-z0-9_]+)\s*[:(]/i) || [])[1]
      || (String(injected || '').match(/·\s*([a-z0-9_]+):/i) || [])[1];
    const wantLabel = String(fieldKey || '').replace(/_/g, ' ').toLowerCase().trim();
    const hit = wantLabel
      ? Object.entries(pairs).find(([k]) => k.toLowerCase().replace(/\s+/g, ' ').trim() === wantLabel)
      : null;
    if (hit && apiFresh) {
      const flat = JSON.stringify(apiFresh);
      const apiHasOriginal = flat.includes(String(originalValue)) || flat.includes(String(Number(originalValue)));
      const uiCore = xsurf.core(hit[1]).v;
      const origCore2 = xsurf.core(originalValue).v;
      xsurfCaught = !!(apiHasOriginal && uiCore !== origCore2);
      xsurfDetail = `UI "${hit[0]}" = ${hit[1]} (core ${uiCore}) ↔ nguồn sạch giữ ${originalValue} (core ${origCore2})`;
    } else {
      xsurfCaught = false;
      xsurfDetail = hit ? 'không đọc được nguồn sạch để so' : `không tìm được nhãn UI ứng với field "${fieldKey || '?'}"`;
    }
  }

  // Mutant chỉ CÓ NGHĨA nếu giá trị bị bóp thật sự hiển thị trên màn đang kiểm. Không kiểm điều này thì
  // "sống sót" có thể chỉ là tiêm vào field màn không dùng — và mutation score thành số vô nghĩa.
  let relevant = null;
  if (mutant && originalValue) {
    const digits = String(originalValue).replace(/\D/g, '');
    relevant = digits
      ? await page.evaluate((d) => document.body.innerText.replace(/\D/g, '').includes(d), digits).catch(() => null)
      : await page.evaluate((t) => document.body.innerText.includes(t), String(originalValue)).catch(() => null);
  }
  if (mutant) await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
  return { dev, injected, relevant, originalValue, xsurfCaught, xsurfDetail };
}

async function main() {
  const catalog = loadCatalog();
  const only = String(arg('only', '')).split(',').filter(Boolean);
  const mutants = (arg('mutants') && fs.existsSync(arg('mutants')) ? JSON.parse(fs.readFileSync(arg('mutants'), 'utf8')) : DEFAULT_MUTANTS)
    .filter((m) => !only.length || only.includes(m.id));
  const screens = (catalog.screens || []).slice(0, Number(arg('screens', '2')));
  if (!screens.length) { console.error('[mut] ✗ catalog không có màn nào'); process.exit(2); }

  const ctx = await chromium.launchPersistentContext('', { headless: true, viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const rows = [];
  try {
    await login(page, catalog.login || { site: 'ops' });
    const base = await runOnce(page, screens, null);
    console.log(`[mut] BASELINE: ${base.dev} deviation trên ${screens.length} màn (đây là mốc so sánh)`);
    for (const m of mutants) {
      // eslint-disable-next-line no-await-in-loop
      const r = await runOnce(page, screens, m);
      const killed = r.dev > base.dev;
      rows.push({ ...m, dev: r.dev, killed, injected: r.injected, relevant: r.relevant, xsurfCaught: r.xsurfCaught, xsurfDetail: r.xsurfDetail });
      const tag = !r.injected ? '⚠ KHÔNG TIÊM ĐƯỢC'
        : killed ? '✓ BỊ BẮT'
          : r.relevant === false ? 'ⓘ KHÔNG LIÊN QUAN (giá trị không hiển thị trên màn này)' : '✗ SỐNG SÓT';
      console.log(`[mut] ${tag} · ${m.id} — ${m.why}`);
      console.log(`[mut]     tiêm: ${r.injected || '(không tìm được field phù hợp)'} · deviation ${base.dev} → ${r.dev}`);
      if (r.xsurfCaught !== null && r.relevant !== false) console.log(`[mut]     TRỤC ② (chạy hàm thật của cross_surface_diff): ${r.xsurfCaught ? 'BẮT ĐƯỢC' : 'không bắt'} — ${r.xsurfDetail}`);
    }
  } catch (e) { console.error('[mut] FATAL', e.message.slice(0, 250)); process.exitCode = 2; } finally { await ctx.close(); }

  // Score chỉ tính trên mutant CÓ LIÊN QUAN: tiêm vào field màn không hiển thị thì không nói được gì.
  const applied = rows.filter((r) => r.injected && r.relevant !== false);
  const irrelevant = rows.filter((r) => r.injected && r.relevant === false);
  const killed = applied.filter((r) => r.killed);
  const score = applied.length ? Math.round((killed.length / applied.length) * 100) : 0;
  const xsurfCatch = applied.filter((r) => r.xsurfCaught).length;
  if (applied.length) console.log(`[mut] NĂNG LỰC TRỤC ② (so 2 bề mặt UI ↔ API sạch): ${xsurfCatch}/${applied.length} mutant sẽ bị bắt — đây là phần máy kiểm-kê-field KHÔNG chạm tới`);
  console.log(`[mut] MUTATION SCORE = ${killed.length}/${applied.length} = ${score}%  · không liên quan: ${irrelevant.length} · không tiêm được: ${rows.filter((r) => !r.injected).length}`);
  if (applied.length && killed.length < applied.length) {
    console.log('[mut] Mutant SỐNG SÓT = vùng mù CÓ BẰNG CHỨNG — không phải phỏng đoán:');
    for (const r of applied.filter((x) => !x.killed)) console.log(`[mut]   · ${r.id}: ${r.why} ⇒ bộ kiểm hiện tại không thấy`);
  }

  const out = arg('out');
  if (out) {
    const L = [`<!-- gate: proven=${killed.length} inconclusive=${rows.length - applied.length} broken=${applied.length - killed.length} -->`,
      '# Mutation check — bộ kiểm có THẬT SỰ bắt được bug không?', '',
      '> Sinh bởi `scripts/qa/mutation_check.js`. Tiêm lỗi ở tầng `page.route()` (**không chạm dữ liệu UAT**) rồi xem',
      '> máy kiểm có đỏ lên không. Mutant **sống sót** = vùng mù **có bằng chứng**. Đây là thước đo năng lực phát',
      '> hiện, khác hẳn mọi máy còn lại (chúng cố bắt thêm bug, máy này đo xem có bắt được không).', '',
      `- Mutation score (máy kiểm-kê-field): **${killed.length}/${applied.length} = ${score}%**`,
      `- Năng lực **trục ②** (chạy hàm thật của cross_surface_diff): **${applied.filter((r) => r.xsurfCaught).length}/${applied.length}** mutant bị bắt`, '',
      '| Mutant | Lớp bug nhắm tới | Đã tiêm | Kết quả |', '|---|---|---|---|',
      ...rows.map((r) => `| \`${r.id}\` | ${r.why} | ${r.injected || '_(không tiêm được)_'} | ${!r.injected ? '⚠ chưa đo' : r.killed ? '✓ bị bắt' : '✗ **sống sót**'} |`)];
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, `${L.join('\n')}\n`);
    console.log(`[mut] báo cáo: ${out}`);
  }
  if (ENFORCE && applied.length && killed.length < applied.length) process.exit(1);
}

if (require.main === module) main();

module.exports = { mutateBody, DEFAULT_MUTANTS, MONEY_KEYS };
