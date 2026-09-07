#!/usr/bin/env node
/*
 * library_drift.js — CHẶN "thư viện thuật ngữ đã trôi khỏi repo".
 *
 * VÌ SAO CÓ FILE NÀY (đo được, không phải giả định): `docs/library/` là trang tra cứu dùng để onboarding —
 * người mới đọc và TIN. Nhưng nó là lớp DẪN XUẤT: nội dung viết tay, nguồn thì đổi liên tục. Ba lượt cập
 * nhật gần nhất, lần nào cũng tìm ra fact đã cũ mà không có tín hiệu nào báo:
 *   · công cụ test-management cũ vẫn được dạy như đường chính (sau khi nó đã bị bỏ hẳn)
 *   · "9 cột canonical" (thực tế 7) · "15 chiều coverage" (thực tế 20) · "21 skill" (thực tế 22)
 *   · ba mục AIO chỉ ĐỔI TÊN, ruột vẫn mô tả mô hình cũ
 *   · hai chỗ rơi dấu nháy trong data ⇒ trang trắng, mà `build` vẫn báo OK
 * Tức trang chỉ đúng vào lúc có người NHỚ RA phải cập nhật. Đây đúng là lớp lỗi mà kit luôn xử lý bằng
 * cách dựng máy, không bằng cách thêm quy định.
 *
 * KHÔNG kiểm cái gì: nội dung văn xuôi đúng hay sai (máy không đọc được ý nghĩa), và độ phủ tuyệt đối
 * (trang là lớp tra cứu, không phải spec — xem `.agent/config/kit-layers.md`). Chỉ kiểm những mệnh đề
 * ĐỐI CHIẾU ĐƯỢC với source.
 *
 * Mã thoát: 0 = khớp · 1 = có lệch (in rõ từng chỗ).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const LIB = path.join(ROOT, 'docs', 'library');
const SRC = path.join(LIB, 'src');
const ALLOW_FILE = path.join(ROOT, '.agent', 'config', 'library-drift.allow.json');

const rd = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);

const problems = [];
const notes = [];
const ok = [];

/* ── Allowlist: mục nào CỐ Ý không có trên trang, kèm LÝ DO ──────────────────────────
 * Bắt buộc có lý do (giống `dimension_manifest.json` bắt ghi lý do cho `n/a`), và khối lạ
 * thì CHẶN — bài học "allowlist loader bỏ âm thầm config": khoá viết sai thành vô hình với code. */
const ALLOW_BLOCKS = ['_note', 'scripts', 'npmScripts'];
let allow = { scripts: {}, npmScripts: {} };
if (exists(ALLOW_FILE)) {
  let raw;
  try { raw = JSON.parse(rd(ALLOW_FILE)); }
  catch (e) { problems.push(`allowlist không parse được: ${ALLOW_FILE} — ${e.message}`); raw = null; }
  if (raw) {
    for (const k of Object.keys(raw)) {
      if (!ALLOW_BLOCKS.includes(k)) problems.push(`allowlist có khối lạ "${k}" — code không đọc khối này, sửa tên hoặc bỏ đi (đừng để nó vô hình).`);
    }
    for (const blk of ['scripts', 'npmScripts']) {
      const o = raw[blk] || {};
      for (const [key, reason] of Object.entries(o)) {
        if (!String(reason || '').trim()) problems.push(`allowlist ${blk}."${key}" không ghi lý do — miễn trừ phải có lý do, nếu không nó chỉ là chỗ giấu nợ.`);
      }
      allow[blk] = o;
    }
  }
}

/* ── Nạp dữ liệu trang bằng cách EVAL đúng thứ tự build ─────────────────────────── */
const BUILD = rd(path.join(LIB, 'build.js'));
const m = BUILD.match(/DATA_FILES\s*=\s*\[([\s\S]*?)\]/);
if (!m) { console.error('[library-drift] không đọc được DATA_FILES trong build.js'); process.exit(1); }
const DATA_FILES = m[1].match(/'[^']+'/g).map((s) => s.slice(1, -1));

let TERMS, CATS, PAGE_SRC = '';
try {
  for (const f of DATA_FILES) PAGE_SRC += rd(path.join(SRC, f)) + '\n';
  const sandbox = {};
  // eslint-disable-next-line no-new-func
  new Function(PAGE_SRC + '\nthis.TERMS = TERMS; this.CATS = CATS;').call(sandbox);
  TERMS = sandbox.TERMS; CATS = sandbox.CATS;
} catch (e) {
  console.error('[library-drift] dữ liệu trang không nạp được: ' + e.message);
  console.error('  → chạy `node docs/library/build.js` để biết file nào hỏng cú pháp.');
  process.exit(1);
}
const HTML = exists(path.join(LIB, 'index.html')) ? rd(path.join(LIB, 'index.html')) : '';
const SHELL = rd(path.join(SRC, 'shell.html'));
const GUIDE = rd(path.join(SRC, 'guide.js'));
const ALL_TEXT = PAGE_SRC + '\n' + SHELL;      // mọi chữ trên trang, kể cả 2 tab tài liệu

/* ── 1. Toàn vẹn nội bộ: id trùng · rel gãy · thiếu trường bắt buộc ─────────────── */
const ids = new Set();
for (const t of TERMS) {
  if (ids.has(t.id)) problems.push(`id trùng: ${t.id}`);
  ids.add(t.id);
  if (!CATS[t.cat]) problems.push(`${t.id}: nhóm "${t.cat}" không có trong CATS`);
  for (const k of ['t', 'def', 'detail', 'why', 'src']) {
    if (!String(t[k] || '').trim()) problems.push(`${t.id}: thiếu trường bắt buộc "${k}"`);
  }
}
let badRel = 0;
for (const t of TERMS) for (const r of t.rel || []) if (!ids.has(r)) { problems.push(`${t.id}: rel trỏ tới id không tồn tại "${r}"`); badRel++; }
if (!badRel) ok.push(`${TERMS.length} mục · 0 id trùng · 0 rel gãy · đủ trường bắt buộc`);

/* ── 2. Mọi `src:` phải trỏ tới thứ CÓ THẬT trong repo ─────────────────────────── */
let badSrc = 0;
for (const t of TERMS) {
  // bỏ phần chú thích sau § hoặc trong ngoặc: "RULE_GLOBAL.md § Evidence" · "CLAUDE.md (global)"
  const p = String(t.src).split('§')[0].split('(')[0].trim().replace(/[\/\\]$/, '');
  if (!p) continue;
  if (!exists(path.join(ROOT, p))) { problems.push(`${t.id}: src trỏ tới đường dẫn KHÔNG tồn tại — "${t.src}"`); badSrc++; }
}
if (!badSrc) ok.push(`${TERMS.length} đường dẫn src đều tồn tại trong repo`);

/* ── 3. Mọi `npm run X` trên trang phải là script CÓ THẬT ──────────────────────── */
const PKG = JSON.parse(rd(path.join(ROOT, 'package.json')));
const scriptNames = Object.keys(PKG.scripts || {});
const mentioned = new Set();
for (const raw of ALL_TEXT.match(/npm run [a-z0-9:_-]+/g) || []) {
  const name = raw.replace('npm run ', '');
  mentioned.add(name);
  if (!scriptNames.includes(name)) problems.push(`trang nhắc lệnh KHÔNG tồn tại: npm run ${name}`);
}
if (!problems.some((x) => x.includes('KHÔNG tồn tại: npm run'))) ok.push(`${mentioned.size} lệnh npm được nhắc đều tồn tại trong package.json`);

/* ── 4. Máy trong scripts/qa/ phải xuất hiện trên trang (hoặc có miễn trừ) ─────── */
const qaFiles = fs.readdirSync(path.join(ROOT, 'scripts', 'qa')).filter((f) => f.endsWith('.js'));
const missMachines = [];
for (const f of qaFiles) {
  const base = f.replace(/\.js$/, '');
  // đủ điều kiện "có mặt" nếu trang nhắc tên file HOẶC tên máy (đường dẫn src / nội dung)
  if (ALL_TEXT.includes(f) || ALL_TEXT.includes('scripts/qa/' + f) || new RegExp('\\b' + base + '\\b').test(ALL_TEXT)) continue;
  if (allow.scripts[base] || allow.scripts[f]) continue;
  missMachines.push(f);
}
if (missMachines.length) problems.push(`${missMachines.length}/${qaFiles.length} máy trong scripts/qa/ chưa có mặt trên trang: ${missMachines.join(' ')} — thêm mục, hoặc khai miễn trừ KÈM LÝ DO ở ${path.relative(ROOT, ALLOW_FILE)}`);
else ok.push(`${qaFiles.length} máy trong scripts/qa/ đều có mặt (hoặc được miễn trừ có lý do)`);

/* Miễn trừ đã mục: khai cho thứ không còn tồn tại thì phải dọn, nếu không allowlist thành rác. */
for (const key of Object.keys(allow.scripts)) {
  const f = key.endsWith('.js') ? key : key + '.js';
  if (!qaFiles.includes(f)) problems.push(`allowlist scripts."${key}" trỏ tới máy KHÔNG còn tồn tại — dọn đi.`);
}
for (const key of Object.keys(allow.npmScripts)) {
  if (!scriptNames.includes(key)) problems.push(`allowlist npmScripts."${key}" trỏ tới lệnh KHÔNG còn tồn tại — dọn đi.`);
}

/* ── 5. Con số trang KHẲNG ĐỊNH phải khớp source ───────────────────────────────── */
const num = (re, text) => { const x = text.match(re); return x ? Number(x[1]) : null; };

// 5a. số skill
const skillRows = (rd(path.join(ROOT, '.agent', 'skills', 'INDEX.md')).match(/^\| `/gm) || []).length;
const pageSkillTerms = TERMS.filter((t) => t.cat === 'skill').length;
if (pageSkillTerms !== skillRows) problems.push(`số skill lệch: repo có ${skillRows} (theo .agent/skills/INDEX.md), trang có ${pageSkillTerms} mục nhóm skill`);
else ok.push(`số skill khớp: ${skillRows}`);
for (const [label, text] of [['shell.html', SHELL], ['guide.js', GUIDE], ['dữ liệu mục', PAGE_SRC]]) {
  const n = num(/(\d+)\s+skill/, text);
  if (n !== null && n !== skillRows) problems.push(`${label} còn ghi "${n} skill" — repo đang là ${skillRows}`);
}

// 5b. số chiều coverage
const dimsFile = rd(path.join(ROOT, 'scripts', 'qa', 'dimension_coverage.js'));
const dimCount = (dimsFile.match(/\{\s*id:\s*'/g) || []).length;
const pageDim = num(/(\d+)\s+chiều/, ALL_TEXT);
if (dimCount && pageDim !== null && pageDim !== dimCount) problems.push(`số chiều coverage lệch: repo đếm ${dimCount} chiều trong dimension_coverage.js, trang ghi ${pageDim}`);
else if (dimCount) ok.push(`số chiều coverage khớp: ${dimCount}`);

// 5c. cột canonical bắt buộc
const validate = rd(path.join(ROOT, 'scripts', 'lib', 'testcase', 'validate.js'));
const reqBlock = validate.match(/REQUIRED_COLS\s*=\s*\[([\s\S]*?)\n\]/);
if (reqBlock) {
  const cols = [...reqBlock[1].matchAll(/\['([^']+)'/g)].map((x) => x[1]);
  /* PHẢI neo vào cụm "N cột bắt buộc". Bản đầu dùng /(\d+)\s+cột/ và bắt trúng "mọi màn đọc ra 0 cột"
     trong bảng lỗi thường gặp ⇒ báo "trang ghi 0 cột" — lỗi của GATE, không của trang. */
  const pageCols = num(/(\d+)\s+cột\s+bắt\s+buộc/i, ALL_TEXT);
  if (pageCols !== null && pageCols !== cols.length) problems.push(`số cột canonical lệch: repo có ${cols.length} cột bắt buộc, trang ghi ${pageCols}`);
  const missCol = cols.filter((c) => !ALL_TEXT.includes(c));
  if (missCol.length) problems.push(`trang không nêu đủ tên cột bắt buộc, thiếu: ${missCol.join(' · ')}`);
  if (!missCol.length) ok.push(`${cols.length} cột canonical khớp và đủ tên`);
}

// 5d. verdict status + failureLayer
const vt = JSON.parse(rd(path.join(ROOT, '.agent', 'config', 'verdict_taxonomy.json')));
const missVerdict = Object.keys(vt.statuses || {}).filter((s) => !ALL_TEXT.includes(s));
const missLayer = Object.keys(vt.failureLayers || {}).filter((s) => !ALL_TEXT.includes(s));
if (missVerdict.length) problems.push(`trang thiếu status trong verdict_taxonomy: ${missVerdict.join(' ')}`);
if (missLayer.length) problems.push(`trang thiếu failureLayer trong verdict_taxonomy: ${missLayer.join(' ')}`);
if (!missVerdict.length && !missLayer.length) ok.push(`đủ ${Object.keys(vt.statuses).length} status + ${Object.keys(vt.failureLayers).length} tầng lỗi`);
const rrMin = vt.rerun && vt.rerun.min, rrMax = vt.rerun && vt.rerun.max;
if (rrMin && rrMax && !ALL_TEXT.includes(`${rrMin}–${rrMax}`) && !ALL_TEXT.includes(`${rrMin}-${rrMax}`)) {
  problems.push(`ngưỡng rerun lệch: verdict_taxonomy khai ${rrMin}–${rrMax}, trang không nêu đúng con số đó`);
} else if (rrMin) ok.push(`ngưỡng rerun khớp: ${rrMin}–${rrMax}`);

// 5e. slash command
const cmdDir = path.join(ROOT, '.claude', 'commands');
if (exists(cmdDir)) {
  const cmds = fs.readdirSync(cmdDir).filter((f) => f.endsWith('.md')).map((f) => '/' + f.replace(/\.md$/, ''));
  const missCmds = cmds.filter((c) => !ALL_TEXT.includes(c));
  if (missCmds.length) problems.push(`trang thiếu slash command: ${missCmds.join(' ')}`);
  else ok.push(`đủ ${cmds.length} slash command`);
}

// 5f. con số danh mục gate — trang KHẲNG ĐỊNH "N máy: A CHẶN · B SINH · C BÁO CÁO"
const GATES_MD = path.join(ROOT, '.agent', 'config', 'GATES.md');
if (exists(GATES_MD)) {
  const h = rd(GATES_MD).match(/Tổng\s+\*\*(\d+)\*\*\s+máy\s+—\s+\*\*(\d+)\s+CHẶN\*\*\s+·\s+(\d+)\s+SINH[^·]*·\s+(\d+)\s+BÁO CÁO/);
  const p = ALL_TEXT.match(/(\d+)\s+máy:\s*(\d+)\s+CHẶN\s*·\s*(\d+)\s+SINH\s*·\s*(\d+)\s+BÁO CÁO/);
  if (h && p) {
    const lbl = ['tổng máy', 'CHẶN', 'SINH', 'BÁO CÁO'];
    for (let i = 1; i <= 4; i++) {
      if (h[i] !== p[i]) problems.push(`danh mục gate lệch (${lbl[i - 1]}): GATES.md ghi ${h[i]}, trang ghi ${p[i]} — chạy npm run gates:index rồi sửa trang`);
    }
    if (h.slice(1, 5).join() === p.slice(1, 5).join()) ok.push(`danh mục gate khớp: ${h[1]} máy / ${h[2]} CHẶN`);
  } else if (h && !p) {
    notes.push('trang không nêu con số danh mục gate — không chặn, nhưng đó là số liệu đáng có');
  }
}

// 5g. phiên bản kit
const pageVer = (ALL_TEXT.match(/\b(\d+\.\d+\.\d+)\b/g) || []);
if (PKG.version && !pageVer.includes(PKG.version)) notes.push(`trang không nêu phiên bản hiện tại (${PKG.version}) — không chặn, nhưng nên cập nhật mục "Phiên bản kit"`);
else if (PKG.version) ok.push(`phiên bản kit khớp: ${PKG.version}`);

/* ── 5i. Giáo trình: parse được, link bài giảng còn sống, trang render đủ số bài ─── */
const COURSE_MD = path.join(ROOT, 'docs', 'COURSE.md');
if (!exists(COURSE_MD)) {
  problems.push('thiếu docs/COURSE.md — tab "Khoá học" của trang dẫn xuất từ file này');
} else {
  let cs = null;
  try { cs = require(path.join(SRC, 'course_parse.js')).parseCourse(COURSE_MD); }
  catch (e) { problems.push('COURSE.md không parse được: ' + e.message); }
  if (cs) {
    /* Link bài giảng chết là lỗi im lặng đáng sợ nhất của một giáo trình: học viên bấm vào rồi không có gì.
       (parseCourse đã throw nếu file không tồn tại, nên tới đây là đã sống — kiểm thêm phần rỗng.) */
    const empty = [];
    for (const p of cs.parts) for (const l of p.lessons) {
      if (!l.href) continue;
      const f = path.join(ROOT, 'docs', l.href);
      if (rd(f).trim().length < 400) empty.push('Bài ' + l.n);
    }
    if (empty.length) problems.push(`bài giảng gần như rỗng: ${empty.join(', ')} — link có mà nội dung không có thì tệ hơn không có link`);

    /* Mã trong bài giảng phải PARSE ĐƯỢC. Học viên copy nguyên khối, nên một dấu ngoặc rơi là họ vấp
       vào lỗi của tài liệu chứ không phải lỗi của mình — và mất niềm tin vào cả khoá.
       Chỉ kiểm CÚ PHÁP: logic thì máy không đọc được (một lỗi ưu tiên toán tử trong bài 15 đã lọt qua
       phép kiểm này, và đó là lý do mỗi gate trong khoá đều bắt buộc có negative control). */
    /* QUÉT MỌI FILE trong docs/course/, KHÔNG chỉ bài có link trong COURSE.md.
       Lý do: bản đầu chỉ quét bài có link, và khi giáo trình đổi cấu trúc thì 22 khối mã lặng lẽ
       rơi khỏi phép kiểm — gate vẫn báo ✓ với độ phủ thấp hơn. File chưa xếp chỗ vẫn là file học
       viên đọc được. */
    const vm = require('vm');
    const badBlocks = [];
    let blockCount = 0;
    const COURSE_DIR = path.join(ROOT, 'docs', 'course');
    const lessonFiles = fs.existsSync(COURSE_DIR)
      ? fs.readdirSync(COURSE_DIR).filter((f) => f.endsWith('.md')).map((f) => 'course/' + f)
      : [];
    for (const rel of lessonFiles) {
      const md = rd(path.join(ROOT, 'docs', rel));
      const nhan = path.basename(rel, '.md');
      for (const [i, b] of [...md.matchAll(/```js\n([\s\S]*?)```/g)].entries()) {
        blockCount++;
        try { new vm.Script(b[1]); }
        catch (e) { badBlocks.push(`${nhan} khối js #${i + 1}: ${e.message}`); }
      }
      for (const [i, b] of [...md.matchAll(/```json\n([\s\S]*?)```/g)].entries()) {
        const t = b[1].trim();
        if (!t.startsWith('{') && !t.startsWith('[')) continue;   // đoạn cắt từ package.json thì bỏ qua
        blockCount++;
        try { JSON.parse(t); }
        catch (e) { badBlocks.push(`${nhan} khối json #${i + 1}: ${e.message}`); }
      }
    }
    /* MỌI bài giảng phải có khối "Cây thư mục sau bài này".
       Lý do: người học từ số 0 không hình dung được file mới nằm ở đâu và cạnh cái gì — thiếu khối này
       thì bài giảng thành một chuỗi lệnh rời, không thành một bộ kit. */
    const thieuCay = lessonFiles.filter((rel) => !rd(path.join(ROOT, 'docs', rel)).includes('Cây thư mục'));
    if (thieuCay.length) {
      problems.push(`${thieuCay.length} bài giảng KHÔNG có khối "Cây thư mục sau bài này": ` +
        thieuCay.map((f) => path.basename(f)).join(', '));
    } else if (lessonFiles.length) {
      ok.push(`${lessonFiles.length} bài giảng đều có cây thư mục`);
    }

    /* Ngưỡng sàn: nếu số khối kiểm được tụt dưới mức đã đạt thì gần như chắc là phép kiểm
       bị hẹp lại, không phải bài giảng bớt mã đi. */
    const SAN_KHOI_MA = 78;
    if (blockCount < SAN_KHOI_MA) {
      problems.push(`chỉ kiểm được ${blockCount} khối mã, sàn là ${SAN_KHOI_MA} — phép kiểm bị hẹp lại? ` +
        `(${lessonFiles.length} file trong docs/course/)`);
    }
    if (badBlocks.length) problems.push(`mã trong bài giảng KHÔNG parse được:\n      ${badBlocks.join('\n      ')}`);
    else if (blockCount) ok.push(`${blockCount} khối mã trong bài giảng đều parse được`);
    if (HTML) {
      const built = (HTML.match(/"lessonCount":(\d+)/) || [])[1];
      if (String(cs.lessonCount) !== built) problems.push(`index.html render ${built} bài nhưng COURSE.md có ${cs.lessonCount} — chạy npm run library:build`);
      else ok.push(`giáo trình khớp: ${cs.lessonCount} bài · ${cs.parts.length} phần · ${cs.parts.flatMap((p) => p.lessons).filter((l) => l.href).length} bài đã có bài giảng`);
    }
  }
}

/* ── 6. Bản build phải mới hơn nguồn ───────────────────────────────────────────── */
if (!HTML) {
  problems.push('chưa có docs/library/index.html — chạy `node docs/library/build.js`');
} else {
  const outAt = fs.statSync(path.join(LIB, 'index.html')).mtimeMs;
  const stale = [...DATA_FILES, 'shell.html', 'style.css', 'style.extra.css', 'app.js', 'graph3d.js', 'course_parse.js']
    .filter((f) => exists(path.join(SRC, f)) && fs.statSync(path.join(SRC, f)).mtimeMs > outAt);
  if (fs.statSync(COURSE_MD).mtimeMs > outAt) stale.push('docs/COURSE.md');
  if (stale.length) problems.push(`index.html CŨ hơn nguồn (${stale.join(' ')}) — chạy \`node docs/library/build.js\``);
  else ok.push('index.html mới hơn mọi file nguồn');
  if (/https?:\/\//.test(HTML.replace(/https?:\/\/www\.w3\.org[^"' )]*/g, ''))) {
    problems.push('index.html còn gọi host NGOÀI — CSP của Artifact chặn, trang sẽ hỏng im lặng');
  } else ok.push('index.html tự chứa (0 host ngoài)');
}

/* ── In kết quả ────────────────────────────────────────────────────────────────── */
for (const s of ok) console.log('[library-drift] ✓ ' + s);
for (const s of notes) console.log('[library-drift] ⚠ ' + s);
if (problems.length) {
  console.error('\n[library-drift] ✗ ' + problems.length + ' chỗ TRÔI:');
  for (const p of problems) console.error('  - ' + p);
  console.error('\nTrang là lớp DẪN XUẤT: nguồn quyết luôn là repo. Sửa trang cho khớp, đừng sửa ngược.');
  process.exit(1);
}
console.log('\n[library-drift] ✓ ĐẠT — thư viện thuật ngữ khớp repo.');
