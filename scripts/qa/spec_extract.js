#!/usr/bin/env node
/**
 * spec_extract.js — bảng field trong FSD (markdown) → `screens.json` → (tuỳ chọn) `ui_catalog.json`.
 *
 * VÌ SAO CÓ FILE NÀY (đo baseline 19/08/2026): kit lọt nhiều bug lớp "màn thiếu/thừa/lệch một trường" vì
 * `ui_conformance_check.js` chỉ đối chiếu được những màn mà **người** chịu khai tay vào `ui_catalog.json` —
 * task SAPP-24395 có 28 nhóm chức năng nhưng catalog chỉ có **5 màn**, tức 23 nhóm không có gì kiểm. Khai tay
 * 49 bảng field là việc không ai làm, nên bề mặt cứ rộng ra mà máy kiểm đứng yên.
 *
 * Ý tưởng: FSD ĐÃ có sẵn bảng "Mô tả chi tiết các trường" theo đúng một khuôn (8 cột) — đó là tài sản chưa
 * dùng. Script này đọc bảng đó thành dữ liệu, không cần ai gõ lại.
 *
 * Ranh giới lớp (xem `.agent/config/kit-layers.md`): parser + sinh catalog là **GENERIC**; đường dẫn FSD, URL
 * từng màn và id fixture là **lớp task** — nằm ở file bindings, không hardcode vào đây.
 *
 * Dùng:
 *   node scripts/qa/spec_extract.js --docs <dir chứa .md> --out <screens.json>
 *   node scripts/qa/spec_extract.js --docs <dir> --out <screens.json> --bindings <b.json> --catalog <cat.json>
 *   ... --list-unbound          # in các màn spec CHƯA có binding (biết mình đang không kiểm cái gì)
 *
 * Nguyên tắc: KHÔNG đoán URL, KHÔNG tự bịa binding. Không có binding thì màn đó không vào catalog và bị
 * **liệt kê ra**, vì im lặng ở đây chính là lỗ hổng mà cả chương trình này sinh ra để bịt.
 */

const fs = require('fs');
const path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);

// Heading mà FSD dùng cho bảng field. Đây là quy ước của TÀI LIỆU, không phải của kit ⇒ để một chỗ, đổi tài
// liệu thì đổi đúng dòng này.
const FIELD_TABLE_HEADING = /mô tả chi tiết các trường/i;
// Heading đánh số: "3.1.5. View Order Detail" → số "3.1.5", tên "View Order Detail".
const NUMBERED = /^(\d+(?:\.\d+)*)\.?\s*(.*)$/;

const clean = (s) => String(s || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

// Nhãn ở FSD hay kèm chú thích in nghiêng dài ("*Hệ thống hiển thị …*") — phần đó là mô tả, không phải tên.
// Hàng nhóm còn hay dính markdown link trỏ sang sheet phụ ("Customer Info [Đăng ký thi CBE](https://…) …") ⇒
// tên section ra rác và không khớp được tiêu đề trên UI. Đo thật: 8/257 hàng nhóm bị dính.
const stripNote = (s) => {
  const base = clean(s).replace(/\*[^*]{15,}\*/g, '');
  const noLink = base.replace(/\[[^\]]*\]\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  return noLink || base.replace(/\s+/g, ' ').trim();      // nếu tên CHỈ là link thì thà giữ nguyên còn hơn rỗng
};

// Field CÓ ĐIỀU KIỆN: chỉ hiện trong một số trường hợp ⇒ KHÔNG được đưa vào tập "phải có", nếu không mọi đơn
// không thoả điều kiện sẽ bị báo thiếu oan. Bài học đã trả giá: luật báo oan làm người dùng học cách phớt
// cảnh báo, rồi cảnh báo thật cũng bị bỏ.
const CONDITIONAL = /chỉ hiển thị|trong trường hợp|khi user tick|nếu có giá trị|chỉ áp dụng|tuỳ theo|tùy theo/i;
// Type KHÔNG phải "trường dữ liệu có nhãn" ⇒ loại khỏi tập phải-có. Chỉ gồm hành động thuần: nút/icon/link.
// Bản đầu tôi loại cả dropdown/combobox/checkbox/tag — đo trên FSD thật thì đó là **78 field**, và chúng nằm
// đúng nơi bug hay sống (SAPP-28311 "Service Fee không phải Combobox", SAPP-28318 "dropdown thiếu option").
// Loại chúng là tự bịt mắt mình ở chỗ cần nhìn nhất.
const CONTROL_TYPE = /^(button|icon|link)\b/i;

function parseRow(line) {
  const cells = line.split('|');
  cells.shift();                                              // '|' đầu dòng
  if (cells.length && !cells[cells.length - 1].trim()) cells.pop();
  return cells.map((c) => clean(c));
}

/** Đọc một bảng markdown bắt đầu tại `i`; trả {rows, next}. */
function readTable(lines, i) {
  const rows = [];
  while (i < lines.length) {
    const ln = lines[i];
    if (/^\s*$/.test(ln)) { i += 1; if (rows.length) break; continue; }
    if (!ln.trim().startsWith('|')) break;
    rows.push(parseRow(ln));
    i += 1;
  }
  return { rows, next: i };
}

/** Phân loại các hàng của một bảng field thành tab / section / field. */
function classify(rows, stats) {
  const out = [];                                             // [{tab, section, fields:[…]}]
  let tab = null;
  let section = null;
  const push = (f) => {
    let bucket = out.find((b) => b.tab === tab && b.section === section);
    if (!bucket) { bucket = { tab, section, fields: [] }; out.push(bucket); }
    bucket.fields.push(f);
  };
  for (const cells of rows) {
    if (!cells.length) continue;
    if (cells.every((c) => !c || /^-{2,}$/.test(c))) continue;                    // hàng phân cách
    if (/^#$/.test(cells[0]) || /^field$/i.test(cells[1] || '')) continue;        // hàng tiêu đề
    const rest = cells.slice(1).join('').trim();
    if (cells[0] && !rest) {                                                      // hàng nhóm
      const name = stripNote(cells[0]);
      if (/^tab\s*\d+/i.test(name)) { tab = name; section = null; stats.tabs += 1; } else { section = name; stats.sections += 1; }
      continue;
    }
    const label = cells[2];
    if (label) {
      const meta = [cells[5], cells[6], cells[7]].join(' ');
      push({
        stt: cells[0] || null,
        key: cells[1] || null,
        label,
        required: cells[3] || null,
        type: cells[4] || null,
        conditional: CONDITIONAL.test(meta) || undefined,
        dynamic: /#/.test(`${cells[1] || ''}${label}`) || undefined,              // "…lần #" = field lặp theo giao dịch
        control: CONTROL_TYPE.test(cells[4] || '') || undefined,
        note: cells[5] ? cells[5].slice(0, 200) : undefined,
      });
      stats.fields += 1;
      continue;
    }
    stats.unclassified.push(cells.slice(0, 3).join(' | ').slice(0, 100));          // KHÔNG bỏ im lặng
  }
  return out;
}

function extract(docsDir) {
  const files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md')).sort();
  const stats = { files: 0, tables: 0, tabs: 0, sections: 0, fields: 0, unclassified: [] };
  const screens = [];
  for (const file of files) {
    const lines = fs.readFileSync(path.join(docsDir, file), 'utf8').split(/\r?\n/);
    stats.files += 1;
    const stack = [];                                                             // heading gần nhất theo cấp
    for (let i = 0; i < lines.length; i += 1) {
      const h = lines[i].match(/^(#{1,6})\s+(.*)$/);
      if (!h) continue;
      const lvl = h[1].length;
      // Heading trong FSD hay bị bọc in nghiêng/bold: "##### *4.4.1.1.5.2. Mô tả chi tiết các trường*" ⇒ để
      // nguyên thì regex số mục không khớp và specRef mất số (đo thật: cả file 4.4 bị rụng). Bỏ dấu nhấn ở
      // heading, KHÔNG bỏ ở ô bảng (stripNote còn cần cặp *…* để nhận chú thích).
      const text = clean(h[2]).replace(/[*_]/g, '').trim();
      stack.length = Math.max(0, lvl - 1);
      stack[lvl - 1] = text;
      if (!FIELD_TABLE_HEADING.test(text)) continue;
      // Màn = heading CHA (vd "3.1.5. View Order Detail"); heading hiện tại chỉ là "…2. Mô tả chi tiết các trường".
      const parent = [...stack].slice(0, lvl - 1).reverse().find((t) => t && NUMBERED.test(t)) || '';
      const pm = parent.match(NUMBERED) || [];
      const selfNum = (text.match(NUMBERED) || [])[1] || null;
      const { rows, next } = readTable(lines, i + 1);
      if (!rows.length) continue;
      stats.tables += 1;
      // Key PHẢI mang cả file: FSD tự đánh trùng số mục giữa các tab (file Chuyển nhượng có cả mục "4.3.1.6"
      // của Chuyển đổi do copy-paste). Key chỉ theo số ⇒ binding trỏ một URL nhưng lấy tập field của LOẠI ĐƠN
      // KHÁC ⇒ sinh deviation giả hàng loạt. Tiền tố `f<NN>` là số thứ tự file trong bản pull tab.
      const fileNo = (file.match(/^(\d+)/) || [])[1] || file.slice(0, 4);
      for (const b of classify(rows, stats)) {
        screens.push({
          key: `f${fileNo}:${pm[1] || selfNum || '?'}${b.tab ? `#${b.tab.replace(/[^A-Za-z0-9]+/g, '_').toLowerCase()}` : ''}`,
          feature: pm[2] || parent || file.replace(/\.md$/, ''),
          featureNo: pm[1] || null,
          tab: b.tab,
          section: b.section,
          specRef: `${file} §${selfNum || ''}`.trim(),
          fields: b.fields,
        });
      }
      i = next - 1;
    }
  }
  return { stats, screens };
}

// ── sinh ui_catalog.json ────────────────────────────────────────────────────────────────────────────────────
// Chỉ những màn CÓ binding (url thật) mới vào catalog. Field bị loại khỏi tập "phải có": có điều kiện, lặp
// động, hoặc control không nhãn. Section còn loại nào thì đặt `mode: 'superset'` — vì field điều kiện XUẤT
// HIỆN không phải là sai lệch.
// Hàng "nhóm" trong FSD có loại là khung sườn TÀI LIỆU chứ không phải khối trên UI ("CÁC TRƯỜNG THÔNG TIN",
// "CÁC NÚT CHỨC NĂNG", "Pop-up …"). Đưa chúng vào danh sách section-lạ chỉ sinh nhiễu.
const DOC_SCAFFOLD = /^(các nút chức năng|các trường thông tin|pop-?up|màn hình tham khảo)/i;

function toCatalog(screens, bindings) {
  const byKey = bindings.screens || {};
  const out = [];
  const unbound = [];
  const grouped = new Map();
  for (const s of screens) {
    const b = byKey[s.key] || byKey[String(s.featureNo)];
    if (!b) { unbound.push(s); continue; }
    const gk = b.name || s.key;
    if (!grouped.has(gk)) grouped.set(gk, { name: gk, url: b.url, settle: b.settle || 6000, fields: [] });
    const g = grouped.get(gk);
    const keep = s.fields.filter((f) => !f.conditional && !f.dynamic && !f.control);
    const dropped = s.fields.length - keep.length;
    if (keep.length < 2) continue;                            // 1 nhãn thì không còn là "kiểm kê tập hợp"
    // FSD có hàng lặp thật (khối "ĐỒNG BỘ TỪ HUBSPOT" của Chuyển nhượng ghi `Phone` hai lần, một Number một
    // Text). Nhãn trùng làm phép so tập hoá vô nghĩa ⇒ gộp, và ĐẾM lại để còn báo được cho BA.
    const labels = [];
    const dupes = [];
    for (const f of keep) {
      if (labels.some((l) => l.toLowerCase() === f.label.toLowerCase())) dupes.push(f.label);
      else labels.push(f.label);
    }
    const entry = {
      name: s.section || s.tab || gk,
      headingText: s.section || s.tab || gk,
      expectedFields: labels,
      _source: `${s.specRef} > ${[s.tab, s.section].filter(Boolean).join(' > ')} (spec_extract)`,
    };
    // Field điều kiện → `optionalFields` (miễn trừ ĐÍCH DANH). Chỉ field lặp động mới cần `superset`, vì nhãn
    // của chúng không liệt kê được ("Phí dịch vụ lần 1..N"). Bản đầu đặt `superset` cho cả hai nhóm ⇒ backtest
    // STT 42 lộ ra rằng nó tắt luôn phép bắt field THỪA — đúng lớp bug cần bắt. Xem `optionalFields` trong
    // ui_conformance_check.js.
    const optional = s.fields.filter((f) => f.conditional && !f.dynamic && !f.control).map((f) => f.label);
    if (optional.length) entry.optionalFields = optional;
    const dynamicOnes = s.fields.filter((f) => f.dynamic);
    if (dynamicOnes.length) {
      entry.mode = 'superset';
      entry._superset_why = `${dynamicOnes.length} field lặp động (${dynamicOnes.map((f) => f.label).join(', ').slice(0, 80)}) — nhãn không liệt kê được`;
    }
    const ctrl = s.fields.filter((f) => f.control).length;
    if (ctrl) entry._dropped_controls = `${ctrl} control (button/icon/link) — không đọc bằng nhãn`;
    if (dupes.length) entry._doc_duplicates = `tài liệu ghi lặp nhãn: ${[...new Set(dupes)].join(', ')} — đã gộp, nên hỏi BA`;
    if (b.labelSelector) entry.labelSelector = b.labelSelector;
    g.fields.push(entry);
    g._specSections = [...new Set([...(g._specSections || []), entry.headingText])];
    g._srcKeys = [...new Set([...(g._srcKeys || []), s.key])];
    g._srcTabs = [...new Set([...(g._srcTabs || []), s.tab || ''])];
  }
  // SECTION LẠ — lớp bug mà kiểm-kê-field không chạm tới: màn hiện đúng các field của nó, nhưng mọc thêm cả
  // một section của LOẠI ĐƠN KHÁC (backtest STT 54: tab Hub Info của Chuyển nhượng hiện khối "Thông tin Deal
  // trừ" — thứ chỉ thuộc Chuyển đổi). Ứng viên = section cùng TAB nhưng thuộc FILE khác, trừ section của
  // chính màn này. Đây là kiểm theo TÊN nên chỉ nêu đúng những tên có trong tài liệu, không bịa.
  for (const g of grouped.values()) {
    if (!g.fields.length) continue;
    // "Của màn này" = MỌI section trong các block spec được bind vào màn, kể cả section không vào `fields`
    // (vd chỉ toàn field lặp động nên dưới ngưỡng 2). Bản đầu chỉ lấy section đã vào catalog ⇒ khối
    // "DỮ LIỆU ĐỒNG BỘ THEO GIAO DỊCH" của chính màn bị tố là section lạ. Báo oan kiểu này giết uy tín gate.
    const ownKeys = new Set(g._srcKeys || []);
    const own = new Set(screens.filter((s) => ownKeys.has(s.key)).map((s) => (s.section || '').toLowerCase()));
    const foreign = new Set();
    for (const s of screens) {
      // Phân biệt theo KHOÁ MÀN, không theo file: FSD copy-paste khối của Chuyển đổi vào file Chuyển nhượng
      // (mục "4.3.1.6" nằm trong file 4.4), nên lọc theo file làm mất đúng "Thông tin Deal trừ" của STT 54.
      if (ownKeys.has(s.key)) continue;
      if (!(g._srcTabs || []).some((t) => (t || '').toLowerCase() === (s.tab || '').toLowerCase())) continue;
      const nm = s.section || '';
      if (!nm || own.has(nm.toLowerCase())) continue;
      if (DOC_SCAFFOLD.test(nm)) continue;
      foreign.add(nm);
    }
    if (foreign.size) g.forbiddenSections = [...foreign].sort();
    out.push(g);
  }
  return { screens: out, unbound };
}

// ── main ────────────────────────────────────────────────────────────────────────────────────────────────────
const docs = arg('docs', '');
if (!docs || !fs.existsSync(docs)) { console.error('[spec] ✗ thiếu --docs <dir chứa .md của FSD>'); process.exit(2); }

const { stats, screens } = extract(docs);
console.log(`[spec] ${stats.files} file · ${stats.tables} bảng field · ${stats.tabs} tab · ${stats.sections} section · ${stats.fields} field`);
const count = (fn) => screens.reduce((n, s) => n + s.fields.filter(fn).length, 0);
console.log(`[spec] trong đó: ${count((f) => f.conditional)} field có điều kiện · ${count((f) => f.dynamic)} field lặp động · ${count((f) => f.control)} control không nhãn (đều KHÔNG vào tập phải-có)`);
if (stats.unclassified.length) {
  console.log(`[spec] ⚠ ${stats.unclassified.length} hàng KHÔNG phân loại được (in ra để soi, không bỏ im lặng):`);
  for (const u of stats.unclassified.slice(0, 10)) console.log(`[spec]   · ${u}`);
  if (stats.unclassified.length > 10) console.log(`[spec]   … (+${stats.unclassified.length - 10})`);
}

const outPath = arg('out', '');
if (outPath) {
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify({ _generated_by: 'scripts/qa/spec_extract.js', _docs: docs, screens }, null, 2)}\n`);
  console.log(`[spec] đã ghi ${outPath} (${screens.length} khối màn×section)`);
}

const catPath = arg('catalog', '');
if (catPath) {
  const bPath = arg('bindings', '');
  if (!bPath || !fs.existsSync(bPath)) {
    console.error('[spec] ✗ TỪ CHỐI sinh catalog: chưa có --bindings. URL/fixture là dữ liệu của TASK, script không được đoán.');
    console.error('[spec]   Khung bindings: { "screens": { "<key>": { "name": "…", "url": "/…", "settle": 6000 } } }');
    console.error(`[spec]   Key có sẵn (12 đầu): ${[...new Set(screens.map((s) => s.key))].slice(0, 12).join(' · ')}`);
    process.exit(2);
  }
  const bindings = JSON.parse(fs.readFileSync(bPath, 'utf8'));
  const { screens: catScreens, unbound } = toCatalog(screens, bindings);
  const existing = fs.existsSync(catPath) ? JSON.parse(fs.readFileSync(catPath, 'utf8')) : {};
  const merged = { ...existing, screens: catScreens };
  if (bindings.login) merged.login = bindings.login;
  fs.writeFileSync(catPath, `${JSON.stringify(merged, null, 2)}\n`);
  const nf = catScreens.reduce((n, s) => n + s.fields.length, 0);
  console.log(`[spec] catalog: ${catScreens.length} màn · ${nf} section được kiểm kê → ${catPath}`);
  const ub = [...new Set(unbound.map((s) => `${s.featureNo} ${s.feature}${s.tab ? ` / ${s.tab}` : ''}`))];
  console.log(`[spec] ⚠ ${ub.length} màn spec CHƯA có binding ⇒ KHÔNG được kiểm. Đây là phần đang mù, không phải phần đã đạt.`);
  if (flag('list-unbound')) for (const u of ub) console.log(`[spec]   · ${u}`);
}
