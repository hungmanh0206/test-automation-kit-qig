#!/usr/bin/env node
'use strict';

/*
 * prompt_budget.js — ĐO TĨNH: mỗi điểm vào bảo AI đọc bao nhiêu token hướng dẫn.
 *
 * VÌ SAO CẦN. Kit có 6 điểm vào (slash command), và mỗi điểm vào dẫn tới một chuỗi: command → workflow →
 * template → sub-prompt → rule. Không chỗ nào trả lời được câu "chạy `/phase2` thì AI phải nạp bao nhiêu
 * chữ trước khi làm việc đầu tiên". Hệ quả không phải bất tiện: mọi quyết định cắt gọt về sau sẽ là cảm
 * tính, và `doc_budget.js` chỉ đo TÀI LIỆU ĐẦU VÀO CỦA TASK, không đo hướng dẫn của chính kit.
 *
 * BA LOẠI, và việc tách chúng ra mới là giá trị của máy này:
 *   BẮT BUỘC     — luồng nào cũng phải nạp.
 *   CÓ ĐIỀU KIỆN — chỉ nạp khi có API, có bug, có chiều X. Đây là chỗ tiết kiệm được mà không mất gì.
 *   NGƯỜI ĐỌC    — các đoạn "Vì sao…", "Đo thật…", lịch sử, ví dụ dài. AI không cần đọc trước để làm đúng;
 *                  nó học khi gate báo lỗi.
 *
 * KHÔNG ĐOÁN THAY NGƯỜI. Máy này phân loại bằng DẤU HIỆU VĂN BẢN, và dấu hiệu thì sai được. Nên:
 *   - mỗi file "có điều kiện" đều in kèm CÂU đã kích hoạt phân loại đó, để người soi lại trong vài giây;
 *   - không nhận dạng được thì ghi `chưa rõ`, KHÔNG mặc định là bắt buộc (mặc định sai làm con số đẹp lên
 *     một cách giả tạo, và cả phép đo mất nghĩa).
 *
 * Dùng:
 *   node scripts/qa/prompt_budget.js              # in bảng
 *   ... --json                                    # ghi docs/token-diet/baseline.static.json
 *   ... --dup                                     # kèm báo cáo đoạn trùng ý giữa các lớp
 *   ... --enforce                                 # CHẶN khi vượt ngưỡng ở .agent/config/prompt_budget.json
 * Exit: 0 đạt · 1 vượt ngưỡng (chỉ với --enforce) · 2 dùng sai.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const CHARS_PER_TOK = 3.2;          // cùng hệ số doc_budget.js — 1 nguồn, không khai lại
const OUT_DIR = path.join(REPO, 'docs', 'token-diet');

const flag = (n) => process.argv.includes(`--${n}`);

/* Điểm vào = slash command. Danh sách đọc từ đĩa, không gõ tay: thêm command mới là tự có mặt. */
const CMD_DIR = path.join(REPO, '.claude', 'commands');

/* Thư mục được coi là TÀI LIỆU HƯỚNG DẪN. Ngoài danh sách này thì không lần theo — nếu không, một con trỏ
 * tới `scripts/` sẽ kéo cả source code vào phép đo. */
const DOC_ROOTS = [
  'prompt_templates', '.agent/workflows', '.agent/rules', '.agent/skills',
  'partial-rerun', 'exploratory', 'manual-run',
];

/* Dấu hiệu CÓ ĐIỀU KIỆN. Bắt trên CÂU chứa con trỏ tới file, không bắt trên nội dung file được trỏ. */
const DK = [
  /chỉ khi/i, /chỉ ở/i, /chỉ còn cần khi/i, /\bnếu\b/i, /khi (?:task|scope|bộ|có|cần)/i,
  /applicable/i, /\bopt-?in\b/i, /khai `?required`?/i, /tuỳ chọn/i, /optional/i,
  /khi cần/i, /trường hợp/i,
];

/* Dấu hiệu đoạn CHỈ ĐỂ NGƯỜI ĐỌC. Bắt trên TIÊU ĐỀ mục và câu mở đoạn. */
const NGUOI_DOC = [
  /^#+\s*(vì sao|tại sao|lý do|bài học|lịch sử|bối cảnh|đo thật|số đo|phụ lục|đọc thêm|ghi chú)/i,
  /^\*{0,2}(vì sao|đo \d{2}\/\d{2}|đo thật|bài học|lịch sử)/i,
];

const doc = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };
const tok = (s) => s.length / CHARS_PER_TOK;
const rel = (p) => path.relative(REPO, p).replace(/\\/g, '/');

const trongDocRoot = (r) => DOC_ROOTS.some((d) => r === d || r.startsWith(`${d}/`));

/**
 * Bóc mọi đường dẫn tài liệu được nhắc trong một đoạn văn bản, kèm CÂU đã nhắc nó.
 * Nhận cả `[nhãn](đường/dẫn.md)` và `` `đường/dẫn.md` `` và đường dẫn trần.
 */
function conTro(text) {
  const out = [];
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const re = /(?:\]\(([^)\s]+\.md)[^)]*\)|`([^`\s]+\.md)`|(?:^|\s)((?:\.agent|prompt_templates|partial-rerun|exploratory|manual-run)\/[^\s`)|,;]+\.md))/g;
    let m;
    while ((m = re.exec(line))) {
      const raw = (m[1] || m[2] || m[3] || '').replace(/^\.\//, '');
      if (!raw) continue;
      out.push({ raw, cau: line.trim() });
    }
  }
  return out;
}

/** Giải một con trỏ thành đường dẫn thật trong repo (thử tương đối với file đang đọc, rồi với gốc repo). */
function giai(raw, tuFile) {
  const thu = [
    path.resolve(path.dirname(tuFile), raw),
    path.resolve(REPO, raw),
    path.resolve(REPO, raw.replace(/^\.\.\//, '')),
  ];
  for (const p of thu) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      const r = rel(p);
      if (trongDocRoot(r)) return p;
    }
  }
  return null;
}

/** Đếm token của phần "chỉ để người đọc" trong một file, bằng cách chia theo mục. */
function phanNguoiDoc(text) {
  const lines = String(text || '').split(/\r?\n/);
  let n = 0;
  let dang = false;
  for (const line of lines) {
    if (/^#+\s/.test(line)) {
      /* Tiêu đề QUYẾT LẠI trạng thái: mục lý-do bắt đầu ở đây, hoặc mục khác kết thúc mục lý-do trước đó.
       * Nhánh "đang trong mục lý-do mà gặp tiêu đề thì tắt" là nhánh CHẾT — dòng trên đã lo cả hai chiều. */
      dang = NGUOI_DOC.some((re) => re.test(line));
    } else if (!dang && NGUOI_DOC.some((re) => re.test(line))) {
      /* Vùng mở bằng câu (không bằng tiêu đề) chạy tới tiêu đề kế tiếp. Chấp nhận ước lượng rộng hơn
       * thực tế ở đây: con số này được dùng làm SÀN, và một cái sàn quá thấp thì vô dụng. */
      dang = true;
    }
    if (dang) n += line.length + 1;
  }
  return n / CHARS_PER_TOK;
}

/** Lần theo chuỗi nạp từ một điểm vào. Trả map file → {tok, loai, viSao, sau} (sâu bao nhiêu lớp). */
function chuoiNap(cmdFile) {
  const thay = new Map();
  const hang = [{ p: cmdFile, sau: 0, dk: false, cau: '' }];
  const daVao = new Set([cmdFile]);

  while (hang.length) {
    const { p, sau, dk, cau } = hang.shift();
    const text = doc(p);
    const r = rel(p);
    if (!thay.has(r)) {
      thay.set(r, {
        tok: Math.round(tok(text)),
        nguoiDoc: Math.round(phanNguoiDoc(text)),
        loai: sau === 0 ? 'bắt buộc' : (dk ? 'có điều kiện' : 'chưa rõ'),
        viSao: dk ? cau.slice(0, 160) : '',
        sau,
      });
    }
    for (const { raw, cau: c } of conTro(text)) {
      const dich = giai(raw, p);
      if (!dich || daVao.has(dich)) continue;
      daVao.add(dich);
      hang.push({ p: dich, sau: sau + 1, dk: DK.some((re) => re.test(c)), cau: c });
    }
  }
  return thay;
}

/** Câu đã chuẩn hoá, dùng để tìm đoạn trùng ý giữa các lớp. */
const chuanHoa = (s) => String(s || '')
  .normalize('NFC').replace(/[`*_>#|-]/g, ' ').replace(/\s+/g, ' ')
  .trim().toLowerCase();

function doTrung(files) {
  const theoCau = new Map();
  for (const r of files) {
    const text = doc(path.join(REPO, r));
    for (const cau of text.split(/(?<=[.!?:])\s+|\r?\n/)) {
      const k = chuanHoa(cau);
      if (k.length < 60) continue;
      if (!theoCau.has(k)) theoCau.set(k, new Set());
      theoCau.get(k).add(r);
    }
  }
  const out = [];
  for (const [k, set] of theoCau) {
    if (set.size >= 2) out.push({ tok: Math.round(tok(k)), soFile: set.size, files: [...set], cau: k.slice(0, 120) });
  }
  out.sort((a, b) => (b.tok * (b.soFile - 1)) - (a.tok * (a.soFile - 1)));
  return out;
}

function main() {
  if (!fs.existsSync(CMD_DIR)) { console.error('[prompt-budget] không thấy .claude/commands/'); process.exit(2); }
  const cmds = fs.readdirSync(CMD_DIR).filter((f) => f.endsWith('.md')).sort();

  /* Luật nền auto-load, tính vào MỌI luồng: CLAUDE.md nạp sẵn, core_rules là digest của nó. */
  const NEN = ['CLAUDE.md', '.agent/rules/core_rules.md'];
  const tokNen = NEN.reduce((n, r) => n + tok(doc(path.join(REPO, r))), 0);

  const ketQua = {};
  const moiFile = new Set();
  for (const c of cmds) {
    const map = chuoiNap(path.join(CMD_DIR, c));
    const rows = [...map.entries()].map(([r, v]) => ({ file: r, ...v }));
    rows.forEach((x) => moiFile.add(x.file));
    const sum = (loai) => rows.filter((x) => x.loai === loai).reduce((n, x) => n + x.tok, 0);
    ketQua[`/${c.replace(/\.md$/, '')}`] = {
      soFile: rows.length,
      batBuoc: Math.round(sum('bắt buộc') + tokNen),
      coDieuKien: sum('có điều kiện'),
      chuaRo: sum('chưa rõ'),
      nguoiDoc: rows.reduce((n, x) => n + x.nguoiDoc, 0),
      tong: Math.round(rows.reduce((n, x) => n + x.tok, 0) + tokNen),
      files: rows.sort((a, b) => b.tok - a.tok),
    };
  }

  console.log(`[prompt-budget] luật nền auto-load: ~${Math.round(tokNen / 100) / 10}k token (${NEN.join(' · ')})`);
  console.log('');
  console.log('| Điểm vào | File trong chuỗi | Bắt buộc | Có điều kiện | Chưa rõ | Người đọc | TỔNG nếu đọc hết |');
  console.log('|---|---|---|---|---|---|---|');
  const k = (n) => `${Math.round(n / 100) / 10}k`;
  for (const [ten, v] of Object.entries(ketQua)) {
    console.log(`| \`${ten}\` | ${v.soFile} | ${k(v.batBuoc)} | ${k(v.coDieuKien)} | ${k(v.chuaRo)} | ${k(v.nguoiDoc)} | **${k(v.tong)}** |`);
  }

  console.log('');
  console.log('File nặng nhất trong toàn bộ các chuỗi:');
  const top = [...moiFile].map((r) => ({ r, t: tok(doc(path.join(REPO, r))), nd: phanNguoiDoc(doc(path.join(REPO, r))) }))
    .sort((a, b) => b.t - a.t).slice(0, 12);
  console.log('');
  console.log('| ~token | trong đó "người đọc" | File |');
  console.log('|---|---|---|');
  for (const x of top) console.log(`| ${k(x.t)} | ${k(x.nd)} | \`${x.r}\` |`);

  let trung = [];
  if (flag('dup') || flag('json')) {
    trung = doTrung([...moiFile]);
    if (flag('dup')) {
      console.log('');
      console.log(`Đoạn TRÙNG Ý giữa các lớp (câu từ 60 ký tự, xuất hiện ở ≥2 file): ${trung.length} câu`);
      console.log('');
      console.log('| ~token | Số file | Câu (rút gọn) |');
      console.log('|---|---|---|');
      for (const d of trung.slice(0, 15)) console.log(`| ${d.tok} | ${d.soFile} | ${d.cau} |`);
    }
  }

  if (flag('json')) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const p = path.join(OUT_DIR, 'baseline.static.json');
    fs.writeFileSync(p, `${JSON.stringify({
      _doc: 'Đo TĨNH chuỗi nạp của từng điểm vào. Sinh bằng `npm run prompt:budget -- --json`, KHÔNG sửa tay.',
      _he_so: `${CHARS_PER_TOK} ký tự/token, cùng hệ số doc_budget.js`,
      _canh_bao: 'Cột "chưa rõ" là file máy KHÔNG phân loại được, không phải file bắt buộc. Soi tay rồi khai vào load_map.',
      doAt: new Date().toISOString().slice(0, 10),
      luatNen: { files: NEN, tok: Math.round(tokNen) },
      diemVao: ketQua,
      trungY: trung.slice(0, 50),
    }, null, 2)}\n`, 'utf8');
    console.log(`\n[prompt-budget] đã ghi ${rel(p)}`);
  }

  if (flag('enforce')) {
    const cfgPath = path.join(REPO, '.agent', 'config', 'prompt_budget.json');
    if (!fs.existsSync(cfgPath)) {
      console.error(`\n[prompt-budget] ✗ TỪ CHỐI --enforce: chưa có ${rel(cfgPath)} nên không có ngưỡng nào để so.`);
      process.exit(2);
    }
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const loi = [];
    for (const [ten, v] of Object.entries(ketQua)) {
      const nguong = (cfg.luong || {})[ten];
      if (nguong && v.batBuoc > nguong) loi.push(`${ten}: bắt buộc ${k(v.batBuoc)} vượt ngưỡng ${k(nguong)}`);
    }
    for (const [f, nguong] of Object.entries(cfg.the_chay || {})) {
      const t = tok(doc(path.join(REPO, f)));
      if (t > nguong) loi.push(`${f}: ${k(t)} vượt ngưỡng thẻ chạy ${k(nguong)}`);
    }
    if (loi.length) {
      console.error('\n[prompt-budget] ✗ VƯỢT NGƯỠNG:');
      loi.forEach((x) => console.error(`  - ${x}`));
      console.error('\n  Cắt nội dung, hoặc chuyển phần "vì sao" sang docs/rationale/. KHÔNG nới ngưỡng.');
      process.exit(1);
    }
    console.log('\n[prompt-budget] ✓ ĐẠT — mọi luồng và thẻ chạy trong ngưỡng.');
  }
}

module.exports = { chuoiNap, doTrung, phanNguoiDoc, CHARS_PER_TOK };

if (require.main === module) main();
