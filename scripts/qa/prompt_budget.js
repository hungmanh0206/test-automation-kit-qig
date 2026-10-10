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

/*
 * `--root <dir>`: đo trên một cây KHÁC thay vì repo này. Chỉ để KIỂM-ÂM: hai phép kiểm của H9 phải
 * chứng minh gate đỏ khi tài liệu phình, mà làm việc đó bằng cách sửa file thật thì spec khác đọc cùng
 * file trong lúc nó đang phình sẽ đỏ ngẫu nhiên (Playwright chạy song song theo file).
 */
function goc() {
  const i = process.argv.indexOf('--root');
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return path.resolve(process.argv[i + 1]);
  return path.resolve(__dirname, '..', '..');
}
const REPO = goc();
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

/*
 * Đọc một file prompt. Thiếu file ⇒ TRẢ RỖNG, và rỗng nghĩa là 0 token.
 *
 * Chỗ này từng là một đường tự tắt: file KHAI trong `load_map.json` mà không có trên đĩa thì luồng đó
 * cộng được ít token hơn thực tế, và ngân sách báo ĐẠT trong khi đúng ra phải báo thiếu file. Nên `docKhai`
 * (dùng cho đường dẫn ĐÃ KHAI) KÊU; `doc` trần vẫn im lặng cho các lượt quét theo glob, nơi file vắng
 * mặt là bình thường.
 */
const doc = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };
const thieuKhai = [];
const docKhai = (p) => {
  const t = doc(p);
  if (!t) thieuKhai.push(path.relative(REPO, p).replace(/\\/g, '/'));
  return t;
};
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

  /* `--moc` vào cùng nhánh với `--enforce`: để ĐỌC được số đo thì không nên bắt ai bật chế độ chặn.
   * Riêng việc CHẶN vẫn chỉ xảy ra khi có `--enforce` (xem chỗ thoát ở cuối nhánh). */
  if (flag('enforce') || flag('moc')) {
    /*
     * ĐO THEO LỜI KHAI, KHÔNG THEO HEURISTIC CỦA CHÍNH MÁY NÀY.
     *
     * Cột `batBuoc` ở bảng trên suy từ dấu hiệu văn bản, và nó chỉ nhận được file ở depth 0 — nên nó ra
     * ~5,6k cho MỌI điểm vào, tức gần như chỉ có nền auto-load. Chặn theo con số đó là chặn theo một phép
     * đo mà chính máy này đã tuyên bố là không đáng tin (xem cột "chưa phân loại").
     *
     * Nguồn đúng là `.agent/config/load_map.json`: ở đó NGƯỜI khai file nào bắt buộc, file nào có điều
     * kiện. H2 dựng lời khai đó; H9 chỉ đặt ngưỡng lên nó.
     */
    /* `--cfg <duong>` de AM BAN chay duoc ma khong sua config that. Khong co no thi am ban buoc
     * phai ha `moc` trong file that roi hoan lai, va hong giua duong la de lai mot moc sai. */
    const iCfg = process.argv.indexOf('--cfg');
    const cfgPath = iCfg >= 0 && process.argv[iCfg + 1]
      ? path.resolve(process.argv[iCfg + 1])
      : path.join(REPO, '.agent', 'config', 'prompt_budget.json');
    const mapPath = path.join(REPO, '.agent', 'config', 'load_map.json');
    for (const p of [cfgPath, mapPath]) {
      if (!fs.existsSync(p)) {
        console.error(`\n[prompt-budget] ✗ TỪ CHỐI --enforce: chưa có ${rel(p)}.`);
        process.exit(2);
      }
    }
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    const loi = [];

/*
     * HAI PHÉP SO, không phải một.
     *
     * `luong` là TRẦN: đặt ngay trên mức hiện tại để không đỏ oan ngày đặt. Nhưng chính vì vậy nó còn
     * chỗ trống: đo 10/10/2026, phase1 còn 1,2k và phase2 còn 1,5k dưới trần. Tức một đợt thêm chữ vẫn đi
     * qua gate mà vẫn làm mọi phiên đắt hơn. Trần chặn chuyện phình TO; nó không chặn chuyện phình DẦN.
     *
     * `moc` là MỐC: số ĐÃ ĐO tại thời điểm chốt. Phần bắt buộc TĂNG so với mốc là CHẶN, dù vẫn dưới trần.
     * Muốn thêm chữ vào phần bắt buộc thì phải CẮT BÙ trong CÙNG luồng. Hạ mốc thì cập nhật số ở đây —
     * đó là một việc thấy được trong diff, không phải một con số trôi đi trong im lặng.
     */
    const moc = cfg.moc || {};
    const soDo = {};

    for (const [ten, l] of Object.entries(map.luong || {})) {
      const nguong = (cfg.luong || {})[ten];
      if (!nguong || !l.bat_buoc) continue;
      let n = tokNen;
      if (l.diem_vao) n += tok(docKhai(path.join(REPO, l.diem_vao)));
      for (const f of l.bat_buoc) n += tok(docKhai(path.join(REPO, f)));
      n = Math.round(n);
      soDo[ten] = n;
      const m = moc[ten];
      const soSanh = typeof m === 'number'
        ? (n > m ? `TĂNG +${n - m} so với mốc ${k(m)}` : (n < m ? `giảm ${n - m} so với mốc ${k(m)}` : 'bằng mốc'))
        : 'CHƯA CÓ MỐC';
      console.log(`[prompt-budget] ${ten.padEnd(10)} bắt buộc ${k(n).padStart(7)} / ngưỡng ${k(nguong)} · ${soSanh}`);
      if (n > nguong) loi.push(`luồng ${ten}: bắt buộc ${k(n)} vượt ngưỡng ${k(nguong)}`);
      if (typeof m === 'number' && n > m) {
        loi.push(`luồng ${ten}: phần bắt buộc TĂNG ${n - m} token so với mốc (${m} → ${n}).`
          + ' Thêm chữ vào phần bắt buộc thì phải CẮT BÙ trong cùng luồng.');
      }
      if (typeof m !== 'number') {
        loi.push(`luồng ${ten}: CHƯA CÓ MỐC trong \`moc\` ⇒ phép kiểm "không được tăng" CHƯA ĐƯỢC GÁC.`
          + ` Chốt mốc: thêm \`"${ten}": ${n}\` vào \`moc\` trong .agent/config/prompt_budget.json.`);
      }
    }

    /* Mốc khai cho một luồng không còn tồn tại là mốc chết — nó làm bảng số nói dối mà không ai biết. */
    for (const ten of Object.keys(moc)) {
      if (!(ten in soDo)) loi.push(`\`moc.${ten}\`: luồng này không có trong load_map — xoá mốc chết đi.`);
    }

    if (flag('moc')) {
      console.log('\n[prompt-budget] số đo hiện tại, dán vào `moc`:');
      console.log(JSON.stringify(soDo, null, 2));
    }

    for (const [f, nguong] of Object.entries(cfg.the_chay || {})) {
      const abs = path.join(REPO, f);
      if (!fs.existsSync(abs)) { loi.push(`thẻ chạy khai trong ngân sách mà KHÔNG tồn tại: ${f}`); continue; }
      const t = Math.round(tok(doc(abs)));
      if (t > nguong) loi.push(`${f}: ${k(t)} vượt ngưỡng thẻ chạy ${k(nguong)}`);
    }

    /*
      * File ĐÃ KHAI mà không có trên đĩa là lỗi, không phải "0 token". Phải báo TRƯỚC phần ngưỡng:
      * thiếu file thì con số ngưỡng bên dưới đã không đúng nữa, nên "ĐẠT" ở đó không có nghĩa gì.
      */
    if (thieuKhai.length) {
      const d = [...new Set(thieuKhai)];
      console.error(`\n[prompt-budget] ✗ ${d.length} file KHAI trong load_map.json nhưng KHÔNG có trên đĩa:`);
      d.forEach((x) => console.error(`  - ${x}`));
      console.error('  Thiếu file ⇒ luồng đó cộng được ít token hơn thực tế, nên NGÂN SÁCH CHƯA ĐƯỢC GÁC.');
      console.error('  Hoặc thêm file, hoặc gỡ nó khỏi load_map.json — đừng để bản khai và cây thật nói ngược nhau.');
      process.exit(1);
    }

    if (loi.length) {
      console.error('\n[prompt-budget] ✗ VƯỢT NGƯỠNG:');
      loi.forEach((x) => console.error(`  - ${x}`));
      console.error('\n  CẮT NỘI DUNG, hoặc chuyển phần "vì sao" sang docs/rationale/. KHÔNG nới số trong');
      console.error('  .agent/config/prompt_budget.json — nới ngưỡng để cho xanh biến gate thành đồ trang trí.');
      if (flag('enforce')) process.exit(1);
      console.error('  (chỉ `--moc` nên KHÔNG chặn — thêm `--enforce` để chặn.)');
    }
    console.log('\n[prompt-budget] ✓ ĐẠT — mọi luồng và thẻ chạy trong ngưỡng.');
  }
}

module.exports = { chuoiNap, doTrung, phanNguoiDoc, CHARS_PER_TOK };

if (require.main === module) main();
