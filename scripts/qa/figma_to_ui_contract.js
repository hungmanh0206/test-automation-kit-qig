#!/usr/bin/env node
/**
 * figma_to_ui_contract.js — biến DESIGN thành ORACLE MÁY ĐỌC ĐƯỢC (`knowledge/system/UI-*.json`).
 *
 * VÌ SAO CÓ FILE NÀY — fix gốc của **bất đối xứng oracle**:
 *   Backend: có Swagger/contract ⇒ assertion là `total = 540000`, sai là đỏ.
 *   Frontend: chỉ có Figma (hình ảnh, máy không đọc được) ⇒ assertion thoái hoá thành `toBeVisible()`.
 * Hệ quả: mọi phép kiểm FE đều so app với **chính nó** (tautology). Kit đã cấm tautology ở tầng BE nhưng chưa ép
 * được ở tầng FE, đơn giản vì FE **không có nguồn nào để so**. File này tạo ra nguồn đó.
 *
 * Cách làm: đọc dump node của Figma (đã pull sẵn), lấy các node TEXT **đang hiển thị** trong frame chỉ định, nhóm
 * theo tiêu đề (dựa cỡ chữ/độ đậm — cùng nguyên tắc `surfaceOf` dùng cho build), rồi ghi thành record
 * `type: "ui_contract"` có `id`/`source`/`confirmed_by`/`confirmed_at`/`aliases`.
 *
 * KHÔNG BỊA XÁC NHẬN: bắt buộc truyền `--confirmed-by` và `--confirmed-at`; thiếu là từ chối ghi. Nhãn trích bằng
 * máy nên `extraction` luôn ghi rõ mức tin cậy, và `aliases` để khai chỗ design ≠ build (đã trả giá ở
 * `sectionAliases`: FSD tiếng Việt vs OPS tiếng Anh).
 *
 * Dùng:
 *   node scripts/qa/figma_to_ui_contract.js --dump <figma_node.json> --frame "Order detail" \
 *        --id UI-ORDERDETAIL-001 --screen "Service Fee Order — Detail" --modules "Order Detail" \
 *        --confirmed-by QA-Lead --confirmed-at 2026-08-19 [--out knowledge/system/UI-ORDERDETAIL-001.json] [--dry]
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const DRY = process.argv.includes('dry') || process.argv.includes('--dry');

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** Cỡ + độ đậm của một node TEXT → "cấp tiêu đề" (cùng nguyên tắc đang dùng cho build). */
function rankOf(node) {
  const st = node.style || {};
  const size = st.fontSize || 0;
  const weight = st.fontWeight || 400;
  return (weight >= 600 && size >= 14) ? weight * 100 + Math.round(size) : 0;
}

/** Node có bị ẩn trong design? (Figma: `visible: false`) */
const isHidden = (n) => n.visible === false;

/** Tìm frame/section theo tên (khớp chuỗi con, không phân biệt hoa thường). */
function findFrame(node, want, out = []) {
  if (!node || isHidden(node)) return out;
  const nm = clean(node.name);
  if (/^(FRAME|SECTION|COMPONENT|INSTANCE|GROUP)$/.test(node.type) && nm.toLowerCase().includes(want.toLowerCase())) out.push(node);
  for (const c of node.children || []) findFrame(c, want, out);
  return out;
}

/** Thu mọi TEXT hiển thị trong frame, theo thứ tự đọc (trên→dưới, trái→phải). */
function collectTexts(node, acc = []) {
  if (!node || isHidden(node)) return acc;
  if (node.type === 'TEXT' && clean(node.characters)) {
    const bb = node.absoluteBoundingBox || {};
    acc.push({ text: clean(node.characters), rank: rankOf(node), x: Math.round(bb.x || 0), y: Math.round(bb.y || 0) });
  }
  for (const c of node.children || []) collectTexts(c, acc);
  return acc;
}

// LỌC RÁC CỦA CANVAS MOCKUP — đây là chỗ quyết định contract dùng được hay thành oracle GIẢ. Trên canvas thiết kế,
// chữ chú thích ("Dung lượng tối đa mỗi file là 500MB…"), số callout ("1", "2", "3") và ghi chú kỹ thuật cũng in
// đậm/cỡ lớn, nên nhóm theo cỡ chữ một cách thô sẽ ra tiêu đề kiểu "Or" hoặc "File supported: .jpg". Đo lần đầu:
// 12 khối trích ra thì hầu hết là rác ⇒ phải lọc trước, và nếu vẫn bẩn thì KHÔNG ghi knowledge (thà không có oracle
// còn hơn có oracle giả).
const isCallout = (t) => /^\d{1,3}$/.test(t) || t.length <= 2;
const isAnnotation = (t) => t.length > 48 || /\.(jpg|png|jpeg|pdf)\b/i.test(t) || /^(ghi chú|note|lưu ý|file supported|dung lượng)/i.test(t);
const looksLikeHeading = (t) => t.length <= 32 && !/[.:]$/.test(t) && !/\d{3,}/.test(t) && !isAnnotation(t);

/** Nhóm nhãn theo tiêu đề: gặp text có rank > 0 thì mở khối mới. */
function groupSections(texts) {
  const sorted = texts.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const sections = [];
  let cur = null;
  for (const t of sorted) {
    if (isCallout(t.text) || isAnnotation(t.text)) continue;                 // rác của canvas, không phải UI
    if (t.rank > 0 && looksLikeHeading(t.text)) { cur = { heading: t.text, rank: t.rank, labels: [] }; sections.push(cur); continue; }
    if (cur) cur.labels.push(t.text);
  }
  // Bỏ khối rỗng và khối chỉ có 1 nhãn (không đủ để "kiểm kê tập hợp").
  return sections.filter((s) => s.labels.length >= 2).map((s) => ({ heading: s.heading, labels: [...new Set(s.labels)] }));
}

// Bọc phần CLI trong main() + `require.main` guard. Đây là lần thứ SÁU trong phiên mắc lỗi này ở 6 file khác
// nhau — và lần này `tests/fe/infra/cli-guard.spec.ts` đã bắt được, đúng như lý do nó được viết ra.
function main() {
const dumpPath = arg('dump');
if (!dumpPath || !fs.existsSync(dumpPath)) { console.error(`[fig] ✗ thiếu --dump <figma json>: ${dumpPath || '(không truyền)'}`); process.exit(2); }
const frameWant = arg('frame');
if (!frameWant) { console.error('[fig] ✗ thiếu --frame "<tên frame/section trong Figma>"'); process.exit(2); }

const sizeMB = Math.round(fs.statSync(dumpPath).size / 1024 / 1024);
if (sizeMB > 50) console.log(`[fig] ⓘ dump ${sizeMB} MB — nạp cả file vào RAM; nếu chậm/OOM thì cắt bớt node trước khi truyền vào (bài học doc_budget: đừng đọc cả file khổng lồ mỗi lần).`);

const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
const roots = Object.values(dump.nodes || {}).map((n) => n.document).filter(Boolean);
if (!roots.length) { console.error('[fig] ✗ dump không có `nodes[*].document` — đây có phải dump từ Figma API không?'); process.exit(2); }

const frames = roots.flatMap((r) => findFrame(r, frameWant));
console.log(`[fig] tìm "${frameWant}": ${frames.length} frame/section khớp`);
if (!frames.length) {
  const names = [];
  const walk = (n, d = 0) => { if (!n || d > 2) return; if (/^(FRAME|SECTION)$/.test(n.type)) names.push(clean(n.name)); (n.children || []).forEach((c) => walk(c, d + 1)); };
  roots.forEach((r) => walk(r));
  console.error(`[fig] ✗ không khớp. Frame/section cấp cao đang có: ${[...new Set(names)].slice(0, 20).join(' · ')}`);
  process.exit(2);
}

const target = frames.sort((a, b) => collectTexts(b).length - collectTexts(a).length)[0];
const texts = collectTexts(target);
const sections = groupSections(texts);
console.log(`[fig] frame "${clean(target.name)}" · ${texts.length} text hiển thị · ${sections.length} khối có ≥2 nhãn`);
for (const s of sections.slice(0, 12)) console.log(`[fig]   ${s.heading} → ${s.labels.length} nhãn: ${s.labels.slice(0, 6).join(' | ')}`);

// ─── KẾT LUẬN ĐO ĐƯỢC, KHÔNG PHẢI PHỎNG ĐOÁN ───────────────────────────────────────────────────────────────
// Trích trên canvas THẬT (173 text) ra 7 khối, nhưng vẫn lẫn: tiêu đề kiểu "Drag & Drop your file here", và một
// khối trộn nhãn của hai màn ("Add-on Courses | Deal ID | Cancel | Send"). Nguyên nhân bản chất: canvas Figma là
// **bảng mockup nhiều màn cạnh nhau**, nhóm theo trục Y sẽ tràn giữa các màn. Vì thế:
//   MẶC ĐỊNH = xuất BẢN NHÁP để người soi (không ghi knowledge).
//   `--write` = chỉ ghi khi có `--sections <file đã người curate>`; ghi từ bản trích thô là tạo **oracle GIẢ**,
//   mà oracle giả tệ hơn không có oracle (nó biến mọi so sánh sau đó thành sai một cách tự tin).
const WRITE = process.argv.includes('--write');
const curated = arg('sections');

if (!WRITE) {
  const draft = arg('draft', path.join(path.dirname(dumpPath), '..', 'reports', 'ui-contract-draft.md'));
  const L = [`<!-- gate: proven=0 inconclusive=${sections.length} broken=0 -->`,
    '# Bản NHÁP contract FE trích từ Figma — CẦN NGƯỜI SOI', '',
    '> Máy chỉ **thu hẹp** phạm vi: từ ' + texts.length + ' node TEXT xuống ' + sections.length + ' khối ứng viên.',
    '> **Chưa phải oracle.** Canvas Figma là bảng mockup nhiều màn cạnh nhau nên nhóm theo trục Y bị tràn giữa các',
    '> màn — đo thật thấy có khối trộn nhãn của 2 màn, và tiêu đề kiểu "Drag & Drop your file here".',
    '>', '> Cách dùng: xoá/gộp/sửa các khối dưới đây thành 1 file JSON `[{"heading":"…","labels":[…]}]`, rồi:',
    '> `node scripts/qa/figma_to_ui_contract.js --dump … --frame … --write --sections <file.json> --id UI-…-001',
    '> --confirmed-by BA --confirmed-at YYYY-MM-DD`', '',
    `- Frame: **${clean(target.name)}** · nguồn: ${dump.name || '?'} (lastModified ${dump.lastModified || '?'})`, '',
    '| # | Tiêu đề ứng viên | Số nhãn | Nhãn |', '|---|---|---|---|',
    ...sections.map((x, i) => `| ${i + 1} | ${x.heading} | ${x.labels.length} | ${x.labels.join(' · ')} |`)];
  fs.mkdirSync(path.dirname(path.resolve(draft)), { recursive: true });
  fs.writeFileSync(draft, `${L.join('\n')}\n`);
  console.log(`[fig] BẢN NHÁP: ${draft} — KHÔNG ghi knowledge. Soi/curate rồi chạy lại với --write --sections <file>.`);
  process.exit(0);
}

const id = arg('id');
const confirmedBy = arg('confirmed-by');
const confirmedAt = arg('confirmed-at');
if (!id || !confirmedBy || !confirmedAt) {
  console.error('[fig] ✗ TỪ CHỐI ghi contract: thiếu --id / --confirmed-by / --confirmed-at.');
  console.error('[fig]   Contract là ORACLE — phải có người CHỐT và ngày chốt, không được sinh ẩn danh rồi dùng để phán PASS/FAIL.');
  process.exit(2);
}
if (!curated || !fs.existsSync(curated)) {
  console.error('[fig] ✗ TỪ CHỐI ghi contract từ bản trích THÔ: thiếu --sections <file người đã curate>.');
  console.error('[fig]   Lý do đo được: trích thô trên canvas mockup còn lẫn tiêu đề chú thích và nhãn của màn khác.');
  console.error('[fig]   Ghi thẳng = tạo ORACLE GIẢ, tệ hơn không có oracle. Chạy không --write để lấy bản nháp.');
  process.exit(2);
}
const curatedSections = JSON.parse(fs.readFileSync(curated, 'utf8'));
if (!Array.isArray(curatedSections) || !curatedSections.length) { console.error('[fig] ✗ --sections phải là mảng [{heading, labels[]}] không rỗng'); process.exit(2); }

const record = {
  type: 'ui_contract',
  id,
  screen: arg('screen', clean(target.name)),
  modules: String(arg('modules', '')).split(',').map((x) => x.trim()).filter(Boolean),
  source: `Figma "${dump.name || '(không rõ file)'}" node ${Object.keys(dump.nodes || {})[0]} › frame "${clean(target.name)}" · version ${dump.version || '?'} · lastModified ${dump.lastModified || '?'}`,
  confirmed_by: confirmedBy,
  confirmed_at: confirmedAt,
  status: 'active',
  version: Number(arg('version', '1')) || 1,
  extraction: `Máy thu hẹp từ ${texts.length} node TEXT xuống ${sections.length} khối ứng viên; NGƯỜI curate lại thành ${curatedSections.length} khối (canvas mockup nhiều màn nên trích thô bị tràn giữa các màn). Nhãn có thể lệch so với build do design đổi copy — dùng \`aliases\` để khai, và khi lệch thì hỏi BA trước khi kết luận bug.`,
  sections: curatedSections,
  aliases: {},
  covered_by: [],
};
if (!record.modules.length) record.modules = [record.screen];

const out = arg('out', path.join(rc.REPO_ROOT, 'knowledge', 'system', `${id}.json`));
if (DRY) { console.log(`[fig] DRY-RUN — chưa ghi. Record sẽ là:\n${JSON.stringify(record, null, 2).slice(0, 900)}`); process.exit(0); }
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`);
console.log(`[fig] đã ghi ${out} — chạy \`npm run system:check\` để validate, rồi dùng id "${id}" làm \`oracle_ref\`.`);

}

if (require.main === module) main();

// Xuất các hàm lọc để test khoá được luật (canvas mockup rất nhiều rác — luật lọc là phần dễ trôi nhất).
module.exports = { rankOf, collectTexts, groupSections, isCallout, isAnnotation, looksLikeHeading };
