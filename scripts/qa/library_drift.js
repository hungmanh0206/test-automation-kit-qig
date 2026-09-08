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
  const p = String(t.src).split('§')[0].split('(')[0].trim().replace(/[/\\]$/, '');
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
       vào lỗi của tài liệu chứ không phải lỗi của mình — và mất niềm tin vào cả tài liệu này.
       Chỉ kiểm CÚ PHÁP: logic thì máy không đọc được (một lỗi ưu tiên toán tử trong bài 15 đã lọt qua
       phép kiểm này, và đó là lý do mỗi gate trong tài liệu này đều bắt buộc có negative control). */
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
    /* Cây thư mục trong COURSE.md phải KHỚP TÊN FILE với bài giảng nó chú thích.
     *
     * VÌ SAO CÓ PHÉP KIỂM NÀY (đo được, không phải giả định): lượt thêm 4 bài gần nhất làm cây lệch
     * ĐÚNG 4 chỗ — `gate-mo-rong.js` trong cây vs `gate_mo_rong.js` trong bài, và 3 file bài giảng dạy
     * viết mà cây không có. Không gate nào bắt; phải soát bằng mắt mới thấy.
     *
     * ĐO CÁI GÌ: mỗi lá trong cây có chú thích "Bài N" và có đuôi .js/.json — nếu Bài N đã có bài giảng
     * thì bài giảng đó PHẢI nhắc đúng tên file ấy. Cây nói "bài này tạo file X" mà bài không nhắc X
     * nghĩa là một trong hai bên sai, và học viên là người phát hiện.
     */
    const treeLeaves = [...cs.kitTree.matchAll(/([A-Za-z0-9_.-]+\.(?:js|json))\s+[←·]\s*Bài\s+(\d+)/g)]
      .map((x) => ({ file: x[1], n: Number(x[2]) }));
    /* Mỗi bài có thể dạy qua NHIỀU file: href chính + liên kết phụ khai ở bullet của COURSE.md
       (vd Bài 13 trỏ sang evidence.md cho phần chụp ảnh). */
    const hrefTheoSo = {};
    for (const p of cs.parts) for (const l of p.lessons) {
      if (l.href) hrefTheoSo[Number(l.n)] = [l.href].concat(l.extraHrefs || []);
    }

    /* Một bài được phép dạy qua bài chi tiết mà nó LIÊN KẾT TỚI — vd Bài 13 trỏ sang evidence.md cho
       phần chụp ảnh. Nên tìm cả trong các bài giảng mà bài chính link sang (1 chặng, không đệ quy sâu:
       2 chặng thì "có nhắc ở đâu đó trong tài liệu này" và phép kiểm mất nghĩa). */
    /* Gom nội dung mọi file bài giảng của một bài, cộng các bài chi tiết mà chính file đó link sang
       (1 chặng, không đệ quy sâu: 2 chặng thì thành "có nhắc ở đâu đó trong tài liệu này" và phép kiểm mất nghĩa). */
    const noiDungCoTheDay = (hrefs) => {
      let gop = '';
      for (const h of hrefs) {
        const chinh = rd(path.join(ROOT, 'docs', h));
        gop += '\n' + chinh;
        for (const lk of chinh.matchAll(/\]\(([a-z0-9-]+\.md)\)/g)) {
          const f = path.join(ROOT, 'docs', 'course', lk[1]);
          if (fs.existsSync(f)) gop += '\n' + rd(f);
        }
      }
      return gop;
    };

    const cayLech = [];
    for (const leaf of treeLeaves) {
      const hrefs = hrefTheoSo[leaf.n];
      if (!hrefs) continue;                      // bài chưa có bài giảng thì chưa đối chiếu được
      if (!noiDungCoTheDay(hrefs).includes(leaf.file)) {
        cayLech.push(`cây ghi "${leaf.file} ← Bài ${leaf.n}" nhưng ${hrefs.map((h) => path.basename(h)).join(' / ')} ` +
          '(và các bài chi tiết chúng link sang) KHÔNG nhắc tên file đó');
      }
    }
    if (cayLech.length) {
      problems.push(`cây thư mục lệch tên file với bài giảng:\n      ${cayLech.join('\n      ')}`);
    } else if (treeLeaves.length) {
      ok.push(`${treeLeaves.length} lá trong cây khớp tên file với bài giảng`);
    }

    /* SỐ BÀI trong file phải KHỚP giáo trình.
     *
     * VÌ SAO CÓ PHÉP KIỂM NÀY (đo được): sau khi đổi cấu trúc sang 8 phần / 30 bài, **19/34 file**
     * vẫn mang số cũ — bấm "Bài 11" trong giáo trình thì rơi vào file có tiêu đề "Bài 8". Không gate
     * nào bắt, và người đọc là người phát hiện. Đây đúng loại lỗi làm mất niềm tin ngay trang đầu.
     *
     * Bài BỔ TRỢ thì NGƯỢC LẠI: không được mang số, vì nó không có chỗ trong dãy 0–29. */
    const soLech = [];
    const boTroFile = new Set(cs.orphans.map((o) => path.basename(o.href)));
    for (const p of cs.parts) for (const l of p.lessons) {
      if (!l.href) continue;
      const h1 = (rd(path.join(ROOT, 'docs', l.href)).match(/^#\s+(.+)$/m) || ['', ''])[1].replace(' ⭐', '').trim();
      const mong = `Bài ${l.n} — ${l.title}`;
      if (h1 !== mong) soLech.push(`${path.basename(l.href)}: tiêu đề "${h1}" ≠ giáo trình "${mong}"`);
    }
    for (const o of cs.orphans) {
      const h1 = (rd(path.join(ROOT, 'docs', o.href)).match(/^#\s+(.+)$/m) || ['', ''])[1].trim();
      if (/^Bài\s+\d/.test(h1)) {
        soLech.push(`${path.basename(o.href)}: là bài BỔ TRỢ nhưng tiêu đề vẫn mang số — "${h1}"`);
      }
    }
    if (soLech.length) {
      problems.push(`${soLech.length} file bài giảng lệch số/tiêu đề so với giáo trình:\n      ` +
        soLech.slice(0, 12).join('\n      '));
    } else {
      ok.push(`${Object.keys(cs.parts).length ? cs.lessonCount + boTroFile.size : 0} file bài giảng khớp số + tiêu đề giáo trình`);
    }

    /* Không tệp nguồn nào được chứa byte điều khiển.
     *
     * VÌ SAO: một bài giảng có ví dụ code kiểm tệp nhị phân, và ký tự NUL trong ví dụ đó được gõ
     * THẲNG vào markdown thay vì viết dạng escape. Hệ quả không phải hiển thị xấu — cả tệp bị mọi
     * công cụ text coi là nhị phân: `grep` trả về "Binary file matches" thay vì dòng khớp, diff
     * không đọc được, và mọi phép soát chạy bằng grep đều lặng lẽ bỏ qua tệp đó. Nó nằm ở đấy suốt
     * và không có gì báo. Escape (\x00) hiển thị y hệt mà tệp vẫn là text. */
    const byteLa = [];
    for (const rel of lessonFiles) {
      const raw = fs.readFileSync(path.join(ROOT, 'docs', rel));
      const n = raw.filter((b) => b < 9 || (b > 13 && b < 32) || b === 11 || b === 12).length;
      if (n) byteLa.push(`${path.basename(rel)}: ${n} byte điều khiển — viết dạng escape (\\x00) thay vì gõ thẳng`);
    }
    if (byteLa.length) problems.push(`${byteLa.length} tệp bài giảng bị công cụ text coi là NHỊ PHÂN:\n      ` + byteLa.join('\n      '));
    else ok.push(`${lessonFiles.length} tệp bài giảng đều là text sạch (0 byte điều khiển)`);

    /* ── Bài giảng khớp giáo trình ở BA mệnh đề nữa, ngoài số + tiêu đề ────────────────
     *
     * VÌ SAO: lượt tái cấu trúc vừa rồi đổi số 29 bài và đổi tiêu đề 18 bài. Số + tiêu đề thì
     * gate cũ bắt được, còn BA thứ này thì không, nên chúng trôi im lặng — đo được 41 chỗ lệch:
     *   · thời lượng trong bài ≠ thời lượng giáo trình (6 bài, lệch tới 1 giờ)
     *   · dòng "Có gì trong tay" nói người đọc đang cầm thứ của bài KHÁC (11 bài)
     *   · thiếu hẳn mục "Bài sau" (15 bài) — người đọc từ số 0 mất luôn sợi dây nối sang bài kế
     * Cả ba đều là thứ người đọc thấy ngay ở dòng đầu và dòng cuối mỗi bài. */
    const phutTuGio = (t) => {
      const m = /^(\d+(?:\.\d+)?)h$/.exec(t.trim());
      if (m) return Math.round(parseFloat(m[1]) * 60);
      let p = 0;
      const g = /(\d+)\s*giờ/.exec(t); if (g) p += Number(g[1]) * 60;
      const ph = /(\d+)\s*phút/.exec(t); if (ph) p += Number(ph[1]);
      return p;
    };
    const lechBai = [];
    const soCoTruoc = new Set(cs.parts.flatMap((p) => p.lessons.map((l) => Number(l.n))));
    const baiCuoi = Math.max(...soCoTruoc);
    for (const p of cs.parts) for (const l of p.lessons) {
      if (!l.href) continue;
      const ten = path.basename(l.href);
      const noi = rd(path.join(ROOT, 'docs', l.href));

      const meta = /^> \*\*([^*]+)\*\* · Có gì trong tay:([^·]*)·/m.exec(noi);
      if (!meta) { lechBai.push(`${ten}: thiếu dòng metadata đầu bài`); continue; }

      if (phutTuGio(meta[1]) !== phutTuGio(l.dur)) {
        lechBai.push(`${ten}: thời lượng "${meta[1]}" ≠ giáo trình "${l.dur}"`);
      }
      const co = meta[2].trim().replace(/\.$/, '').toLowerCase();
      const mongCo = String(l.have || '').trim().replace(/\.$/, '').toLowerCase();
      if (mongCo && co.slice(0, 28) !== mongCo.slice(0, 28)) {
        lechBai.push(`${ten}: vào bài "${co.slice(0, 40)}" ≠ giáo trình "${mongCo.slice(0, 40)}"`);
      }

      /* Mục "Bài sau" phải nhắc bài kế tiếp — Ở BẤT KỲ ĐÂU trong khối, không chỉ ở tham chiếu
         đầu tiên. Bản đầu chỉ đọc ref đầu tiên và báo oan 3 bài mở bằng "Hết Bài N là hết Mốc ②". */
      if (Number(l.n) !== baiCuoi) {
        const ms = /(?:^|\n)## Bài sau\s*\n([\s\S]*)$/.exec(noi);
        if (!ms) lechBai.push(`${ten}: thiếu mục "Bài sau" — người đọc mất sợi dây nối sang bài kế`);
        else {
          const refs = [...ms[1].matchAll(/Bài (\d+)/g)].map((x) => Number(x[1]));
          if (refs.length && !refs.includes(Number(l.n) + 1)) {
            lechBai.push(`${ten}: "Bài sau" nhắc ${JSON.stringify(refs)}, không nhắc Bài ${Number(l.n) + 1}`);
          }
        }
      }
    }
    if (lechBai.length) {
      problems.push(`${lechBai.length} chỗ bài giảng lệch giáo trình (thời lượng · vào bài · bài sau):\n      ` +
        lechBai.slice(0, 12).join('\n      '));
    } else {
      ok.push('mọi bài khớp giáo trình: thời lượng · dòng vào bài · mục "Bài sau"');
    }

    /* Mọi tham chiếu "Bài N" trong bài giảng phải trỏ tới bài CÓ THẬT. */
    const soCo = new Set(cs.parts.flatMap((p) => p.lessons.map((l) => Number(l.n))));
    const troHong = [];
    for (const rel of lessonFiles) {
      const noi = rd(path.join(ROOT, 'docs', rel));
      for (const m of noi.matchAll(/Bài\s+(\d+)/g)) {
        if (!soCo.has(Number(m[1]))) troHong.push(`${path.basename(rel)}: nhắc "Bài ${m[1]}" — không có bài này`);
      }
    }
    if (troHong.length) {
      problems.push(`${troHong.length} tham chiếu tới bài KHÔNG tồn tại:\n      ` +
        [...new Set(troHong)].slice(0, 10).join('\n      '));
    } else {
      ok.push('mọi tham chiếu "Bài N" đều trỏ tới bài có thật');
    }

    /* XƯNG HÔ: tài liệu này nói THẲNG với người đọc ("bạn"), không gọi họ là "học viên"/"người học".
     * Vì sao thành máy chứ không phải lời dặn: hai từ đó rất dễ lọt lại khi thêm bài mới, và mỗi lần
     * lọt là một chỗ giọng văn đổi từ "hướng dẫn" sang "giáo án" — thứ người đọc cảm được ngay. */
    /* Cấm cả cách TỰ XƯNG là "khoá học". Đây là tài liệu hướng dẫn, không phải giáo án.
     * CHỈ cấm cụm tự xưng — "các khoá AI Testing hiện có" / "khoá phổ biến trên thị trường"
     * là so sánh với khoá của NGƯỜI KHÁC, hoàn toàn hợp lệ. Cấm từ trần "khoá" thì bắt oan cả
     * "khoảng cách", "tài khoản", "khoá API". */
    const XUNG_HO_CAM = /học viên|người học|Học viên|Người học|khoá học này|cả khoá(?! AI| phổ biến| nhẹ| khác)|sau khoá học|cuối khoá|toàn khoá|trong khoá(?! AI)|khoá này(?! nhẹ)/;
    const viPhamXungHo = [];
    for (const rel of lessonFiles.concat(['COURSE.md'])) {
      const f = rel === 'COURSE.md' ? COURSE_MD : path.join(ROOT, 'docs', rel);
      const noi = rd(f);
      noi.split('\n').forEach((dong, i) => {
        if (XUNG_HO_CAM.test(dong)) {
          viPhamXungHo.push(`${path.basename(f)}:${i + 1} — "${dong.trim().slice(0, 70)}"`);
        }
      });
    }
    if (viPhamXungHo.length) {
      problems.push(`${viPhamXungHo.length} chỗ còn xưng kiểu giáo án ("học viên"/"người học"/tự gọi là "khoá học") — ` +
        `xưng "bạn", gọi đây là "tài liệu/hướng dẫn":\n      ${viPhamXungHo.slice(0, 12).join('\n      ')}`);
    } else {
      ok.push('xưng hô nhất quán: nói thẳng với "bạn", không tự xưng là khoá học');
    }

    /* KHÔNG được dán nội bộ của kit CÓ SẴN vào tài liệu hướng dẫn.
     *
     * VÌ SAO: người đọc phải TỰ DỰNG kit của họ và tự đặt tên. Dán tên file, tên biến, con số của
     * một kit đã hoàn thiện vào đây là bắt họ chép chứ không phải dựng — và những tên đó vô nghĩa
     * với dự án của họ. Đã dính 220 chỗ một lần.
     *
     * Tài liệu chỉ được dùng tên mà chính nó dựng ra trong các bài. */
    const NOI_BO_KIT = [
      'RULE_GLOBAL', 'verdict_taxonomy', 'dimension-manifest', 'dimension_manifest',
      'policy_check', 'gates_index', 'self_review', 'preflight_gate', 'inventory_gate',
      'secret_scan', 'PROJECT_OUTPUT_DIR', 'TASK_KEY', 'SAPP'
    ];
    const danKit = [];
    for (const rel of lessonFiles.concat(['COURSE.md'])) {
      const f = rel === 'COURSE.md' ? COURSE_MD : path.join(ROOT, 'docs', rel);
      const noi = rd(f);
      for (const t of NOI_BO_KIT) {
        if (noi.includes(t)) danKit.push(`${path.basename(f)}: còn "${t}"`);
      }
    }
    if (danKit.length) {
      problems.push(`${danKit.length} chỗ còn dán nội bộ của kit có sẵn vào tài liệu ` +
        `(người đọc phải tự đặt tên kit của họ):\n      ${[...new Set(danKit)].slice(0, 12).join('\n      ')}`);
    } else {
      ok.push('không dán nội bộ kit có sẵn — tài liệu chỉ dùng tên do chính nó dựng');
    }

    /* GIỌNG VĂN: đếm mấy dạng viết nghe như máy, và chặn khi vượt sàn.
     *
     * VÌ SAO ĐẶT SÀN CHỨ KHÔNG CẤM TUYỆT ĐỐI: gạch ngang dài đôi khi dùng đúng, ví dụ ngăn nhãn với
     * mô tả trong danh sách. Cấm sạch thì gate bắt oan. Đặt sàn thì bắt được lúc lối viết cũ quay lại
     * hàng loạt, mà không phiền vài chỗ dùng hợp lý.
     *
     * Sàn lấy từ số đo THẬT sau khi đã dọn một lượt, cộng biên độ nhỏ. */
    const SAN_GIONG = { gachNgang: 8, trichDamDau: 5 };
    function vanXuoi(md) {
      const ra = [];
      let trongMa = false;
      for (const d of md.split('\n')) {
        if (d.trim().startsWith('```')) { trongMa = !trongMa; continue; }
        if (trongMa || d.trim().startsWith('|')) continue;
        ra.push(d);
      }
      return ra.join('\n');
    }
    let demGach = 0, demTrich = 0;
    const lapTu = [];
    for (const rel of lessonFiles) {
      const raw = rd(path.join(ROOT, 'docs', rel));
      const s = vanXuoi(raw);
      /* Đếm ĐÚNG những chỗ đáng sửa: bỏ tiêu đề, bỏ dòng metadata đầu bài, và bỏ gạch ngang
         nằm trong **...** (đó là nhãn danh sách, không phải nối vế). */
      for (const dong of s.split('\n')) {
        if (dong.trim().startsWith('#')) continue;
        if (/^> \*\*.+\*\* · Có gì trong tay/.test(dong.trim())) continue;
        for (const mm of dong.matchAll(/[a-zà-ỹ0-9)”"`\]] — [a-zà-ỹ(“"`[]/g)) {
          const truocDo = dong.slice(0, mm.index);
          if ((truocDo.match(/\*\*/g) || []).length % 2 === 1) continue;   // trong cụm in đậm
          if (/^\s*[-*] /.test(dong) && /(\)|Bài \d+|\*\*)\s*$/.test(truocDo + mm[0][0])) continue;
          demGach++;
        }
      }
      /* BỎ dòng metadata đầu bài. Quy ước của tài liệu BẮT BUỘC nó mở đầu bằng thời lượng in đậm
         ("> **2 giờ** · Có gì trong tay: …"), nên đếm nó là phạt bài giảng vì đã đúng quy ước —
         và sàn thì tự trôi lên mỗi lần thêm một bài. Bộ đếm gạch ngang ngay trên đã loại dòng này
         từ đầu; bộ đếm trích dẫn thì bỏ sót. */
      demTrich += (s.match(/^> \*\*[^*]+\*\*.*$/gm) || [])
        .filter((d) => !/^> \*\*[^*]+\*\* · Có gì trong tay/.test(d)).length;
      /* Lặp từ: dấu vết của một lượt thay chuỗi hàng loạt bị chồng lên nhau. Đã dính 2 lần. */
      for (const m of s.matchAll(/\b([a-zà-ỹ]{3,}) \1\b/g)) {
        if (['song', 'mãi', 'luôn', 'nhau', 'từng', 'chung', 'riêng'].includes(m[1])) continue;   // từ láy hợp lệ
        lapTu.push(`${path.basename(rel)}: "${m[0]}"`);
      }
    }
    if (lapTu.length) {
      problems.push(`${lapTu.length} chỗ LẶP TỪ (dấu vết thay chuỗi hàng loạt bị chồng):\n      ` +
        lapTu.slice(0, 10).join('\n      '));
    } else {
      ok.push('không có chỗ lặp từ');
    }
    const vuot = [];
    if (demGach > SAN_GIONG.gachNgang) vuot.push(`gạch ngang nối vế: ${demGach} > sàn ${SAN_GIONG.gachNgang}`);
    if (demTrich > SAN_GIONG.trichDamDau) vuot.push(`trích dẫn mở đầu bằng in đậm: ${demTrich} > sàn ${SAN_GIONG.trichDamDau}`);
    if (vuot.length) {
      problems.push('lối viết cũ đang quay lại:\n      ' + vuot.join('\n      ') +
        '\n      Viết câu ngắn, dùng dấu chấm thay gạch ngang, bỏ in đậm dẫn đầu trong trích dẫn.');
    } else {
      ok.push(`giọng văn trong ngưỡng (gạch ngang ${demGach}/${SAN_GIONG.gachNgang} · ` +
        `trích dẫn in đậm ${demTrich}/${SAN_GIONG.trichDamDau})`);
    }

    /* Mỗi bài phải có khối "Từ mới của bài này".
     *
     * VÌ SAO: người đọc từ số 0 gặp từ lạ ngay giữa bài thì phải dừng lại tra, và thường là tra sai.
     * Gom từ mới lên đầu bài, giải thích bằng ví dụ, thì đọc một mạch được.
     *
     * Miễn trừ phải khai TƯỜNG MINH kèm lý do — giống mọi allowlist khác trong kit. */
    const MIEN_TU_MOI = {
      'truoc-khi-bat-dau.md': 'bài này DẠY 10 từ vựng làm nội dung chính (Việc 4), nên không có khối riêng',
      'lo-trinh-sau-khoa.md': 'bài khép lại, chỉ nhìn lại và chỉ đường đi tiếp, không giới thiệu từ nào mới'
    };
    const thieuTuMoi = lessonFiles.filter((rel) => {
      const ten = path.basename(rel);
      if (MIEN_TU_MOI[ten]) return false;
      return !rd(path.join(ROOT, 'docs', rel)).includes('## Từ mới của bài này');
    });
    if (thieuTuMoi.length) {
      problems.push(`${thieuTuMoi.length} bài thiếu khối "Từ mới của bài này": ` +
        thieuTuMoi.map((f) => path.basename(f)).join(', ') +
        ' — thêm khối, hoặc khai miễn trừ kèm lý do trong library_drift.js');
    } else if (lessonFiles.length) {
      ok.push(`${lessonFiles.length - Object.keys(MIEN_TU_MOI).length} bài có khối từ mới ` +
        `(${Object.keys(MIEN_TU_MOI).length} bài miễn trừ có lý do)`);
    }
    /* Miễn trừ trỏ tới bài không còn tồn tại thì phải dọn, nếu không allowlist thành rác. */
    for (const ten of Object.keys(MIEN_TU_MOI)) {
      if (!lessonFiles.some((rel) => path.basename(rel) === ten)) {
        problems.push(`miễn trừ "Từ mới" trỏ tới bài KHÔNG còn tồn tại — ${ten}. Dọn đi.`);
      }
    }

    /* Mỗi bài phải mở đầu bằng khối tóm tắt 3 dòng.
     * Bài dài 400–700 dòng mà mở đầu bằng bảng thuật ngữ thì người mới chưa biết bài này
     * chữa vấn đề gì của mình đã phải học từ vựng. */
    const thieuTomTat = lessonFiles.filter((rel) =>
      !rd(path.join(ROOT, 'docs', rel)).includes('| **Bạn đang khổ vì** |'));
    if (thieuTomTat.length) {
      problems.push(`${thieuTomTat.length} bài thiếu khối "Tóm tắt bài này": ` +
        thieuTomTat.map((f) => path.basename(f)).join(', '));
    } else if (lessonFiles.length) {
      ok.push(`${lessonFiles.length} bài đều mở đầu bằng tóm tắt 3 dòng`);
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
