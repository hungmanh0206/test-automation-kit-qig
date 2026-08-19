#!/usr/bin/env node
/**
 * spec_gap_report.js — CHIỀU NGƯỢC: build CÓ mà tài liệu KHÔNG NHẮC (B3 của chương trình chống lọt bug).
 *
 * VÌ SAO CÓ FILE NÀY: `ui_conformance_check` chỉ hỏi được một chiều — "tài liệu khai gì, build có đủ không?".
 * Chiều đó bỏ trắng hai vùng:
 *   1. Section trên build mà catalog KHÔNG khai ⇒ mọi field trong đó vô hình với máy. Không phải "đã kiểm và
 *      không có vấn đề", mà là "chưa ai nhìn".
 *   2. Field mọc thêm ⇒ hoặc build làm sai, hoặc **tài liệu thiếu**. Cả hai đều là câu hỏi phải hỏi BA, và nếu
 *      không có chỗ nào ghi lại thì nó biến mất cùng lượt chạy.
 *
 * Đầu vào đều là dữ liệu ĐÃ ĐO, không suy diễn:
 *   - `screens.json`  (spec_extract sinh từ FSD)      = tài liệu nói gì
 *   - `surface.json`  (ui_conformance_check chụp)     = build đang có gì
 *   - `catalog_bindings.json`                         = màn nào nối với URL nào (+ sectionAliases)
 *
 * Dùng:
 *   node scripts/qa/spec_gap_report.js --screens <screens.json> --surface <surface.json> \
 *        --bindings <catalog_bindings.json> [--out <report.md>] [--enforce]
 *
 * `--enforce` CHỈ chặn khi có section build **hoàn toàn chưa được khai** (vùng mù thật sự). Field lẻ mọc thêm
 * để mức cảnh báo: nó có thể là tài liệu chậm cập nhật, chặn ở đó sẽ làm gate mất uy tín.
 */

const fs = require('fs');
const path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const ENFORCE = process.argv.includes('--enforce');

const need = (p, what) => { if (!p || !fs.existsSync(p)) { console.error(`[gap] ✗ thiếu ${what}: ${p || '(không truyền)'}`); process.exit(2); } return JSON.parse(fs.readFileSync(p, 'utf8')); };

const screensDoc = need(arg('screens'), '--screens <screens.json>').screens || [];
const surface = need(arg('surface'), '--surface <surface.json>');
const bindings = need(arg('bindings'), '--bindings <catalog_bindings.json>');

const key = (x) => String(x || '').toLowerCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim();
// Nhãn rác của layout (footer, dấu bản quyền) — không phải field.
const JUNK = /^(\d{4}©|©|·|-|\s*)$/;
const aliases = bindings.sectionAliases || {};
// Bản đồ NGƯỢC: tên build → tên tài liệu, để biết một khối build đã được khai dưới tên khác hay chưa.
const buildToDoc = {};
for (const [doc, build] of Object.entries(aliases)) buildToDoc[key(build)] = doc;

const screenOf = {};                                    // tên màn (theo bindings) → khoá spec
for (const [k, v] of Object.entries(bindings.screens || {})) screenOf[v.name || k] = k;

const rows = [];                                        // section build chưa khai
const extraFields = [];                                 // field mọc thêm trong section đã khai
let coveredSections = 0;

for (const [screenName, buildSecs] of Object.entries(surface)) {
  const sKey = screenOf[screenName];
  if (!sKey) continue;                                  // màn không thuộc bindings ⇒ ngoài phạm vi lượt này
  const specSecs = screensDoc.filter((x) => x.key === sKey && x.section);
  const specByName = new Map(specSecs.map((x) => [key(x.section), x]));
  for (const bs of buildSecs) {
    const labels = (bs.labels || []).filter((l) => !JUNK.test(l));
    const docName = buildToDoc[key(bs.heading)] || bs.heading;
    const spec = specByName.get(key(docName));
    if (!spec) {
      // Khối cha chỉ là tiêu đề gộp (0–1 nhãn) thì không tính là vùng mù — không có field nào để soi.
      if (labels.length >= 2) rows.push({ screen: screenName, heading: bs.heading, labels });
      continue;
    }
    coveredSections += 1;
    const docLabels = new Set(spec.fields.map((f) => key(f.label)));
    const news = labels.filter((l) => !docLabels.has(key(l)));
    if (news.length) extraFields.push({ screen: screenName, heading: bs.heading, docName, fields: news });
  }
}

console.log(`[gap] ${Object.keys(surface).length} màn đã chụp bề mặt · ${coveredSections} section khớp tài liệu`);
console.log(`[gap] ${rows.length} section trên build CHƯA được tài liệu/catalog khai (vùng mù)`);
console.log(`[gap] ${extraFields.length} section có field mọc thêm ngoài tài liệu`);

for (const r of rows) console.log(`[gap] ✗ VÙNG MÙ · ${r.screen} › "${r.heading}" (${r.labels.length} field: ${r.labels.slice(0, 6).join(' | ')}${r.labels.length > 6 ? ' …' : ''})`);
for (const e of extraFields) console.log(`[gap] ⚠ ${e.screen} › "${e.heading}" mọc thêm: ${e.fields.join(' | ')}`);

const out = arg('out');
if (out) {
  const L = [];
  L.push('# Chiều ngược: build CÓ mà tài liệu KHÔNG NHẮC');
  L.push('');
  L.push('> Sinh bởi `scripts/qa/spec_gap_report.js` từ **dữ liệu đã đo**: `screens.json` (FSD) × `surface.json`');
  L.push('> (bề mặt build thật). Đây KHÔNG phải danh sách bug — mỗi dòng là **một câu hỏi phải hỏi BA**: build sai,');
  L.push('> hay tài liệu thiếu? Bỏ trống chỗ này thì phát hiện biến mất cùng lượt chạy.');
  L.push('');
  L.push(`- Màn đã chụp bề mặt: **${Object.keys(surface).length}**`);
  L.push(`- Section khớp tài liệu: **${coveredSections}**`);
  L.push(`- Section chưa khai (vùng mù): **${rows.length}**`);
  L.push(`- Section có field mọc thêm: **${extraFields.length}**`);
  L.push('');
  if (rows.length) {
    L.push('## 1. Vùng mù — section trên build không có trong tài liệu của màn đó');
    L.push('');
    L.push('| Màn | Khối trên build | Số field | Field |');
    L.push('|---|---|---|---|');
    for (const r of rows) L.push(`| ${r.screen} | ${r.heading} | ${r.labels.length} | ${r.labels.join(' · ')} |`);
    L.push('');
    L.push('**Phải làm gì:** hoặc bổ sung khối vào FSD (rồi `spec:extract` tự sinh lại catalog), hoặc xác nhận');
    L.push('build mọc thêm khối không đúng thiết kế. Trong lúc chờ, đây là vùng **chưa ai soi** — không được coi là đạt.');
    L.push('');
  }
  if (extraFields.length) {
    L.push('## 2. Field mọc thêm trong khối đã khai');
    L.push('');
    L.push('| Màn | Khối (build) | Tên trong tài liệu | Field mọc thêm |');
    L.push('|---|---|---|---|');
    for (const e of extraFields) L.push(`| ${e.screen} | ${e.heading} | ${e.docName} | ${e.fields.join(' · ')} |`);
    L.push('');
  }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, `${L.join('\n')}\n`);
  console.log(`[gap] báo cáo: ${out}`);
}

if (ENFORCE && rows.length) {
  console.error(`[gap] ✗ CHẶN: ${rows.length} section trên build chưa được khai ⇒ toàn bộ field trong đó không có gì kiểm.`);
  console.error('[gap]   Khai vào FSD/catalog, hoặc ghi thành "Vùng chưa kiểm" kèm lý do trong reports/ rồi chạy lại.');
  process.exit(1);
}
