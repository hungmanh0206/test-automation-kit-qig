#!/usr/bin/env node
'use strict';

/*
 * matrix_coverage.js — PAIRWISE PHỦ CẶP GIÁ TRỊ, KHÔNG PHỦ KẾT QUẢ.
 *
 * VÌ SAO CÓ (v2.5.0 G1.9, nhận ý của A `qig-qa-automation`). Ma trận pairwise bảo đảm mọi CẶP giá trị
 * giữa hai chiều bất kỳ xuất hiện ít nhất một lần. Nó KHÔNG bảo đảm mọi **lớp kết quả** xuất hiện — và
 * lớp kết quả mới là thứ người đọc quan tâm. Ví dụ cụ thể: một chức năng có 3 kết quả theo spec (lưu
 * được · chặn vì sai định dạng · chặn vì trùng mã), pairwise 9 bộ hoàn toàn có thể chỉ chạm 2 trong 3.
 * Lúc đó bảng coverage vẫn báo "pairwise 100%", mà một nhánh nghiệp vụ chưa ai test.
 *
 * KHỚP THEO MÃ, KHÔNG DÒ CHỮ. Gate đòi ma trận có cột mã lớp kết quả (`OC-1`…) chứ không đi so chuỗi
 * trong cột `Kết quả mong đợi`. Dò chữ ở đây sẽ là một gate ĐOÁN: "chặn" và "không cho lưu" là cùng một
 * lớp, còn "lưu thành công" và "lưu thành công nhưng cảnh báo" là hai lớp khác nhau — máy không phân biệt
 * được bằng từ khoá. Đã trả giá đúng kiểu đó nhiều lần (xem `locator_lint` rule `body-regex`).
 *
 * LỚP KẾT QUẢ PHẢI CÓ `oracle_ref`. Không có neo thì chính danh sách lớp là do người viết tự nghĩ ra, và
 * gate sẽ đi gác một mẫu số tự khai — đúng thứ `scope_anchor` tồn tại để chống.
 *
 * ⚠️ ĐO 10/10/2026: repo có **0 file `*_matrix.md`** trong cả 5 task (11 file tên "matrix" đều là
 * `traceability-matrix` hoặc `fixture-matrix`, việc khác hẳn). Nghĩa là skill `combinatorial_matrix` chưa
 * từng sinh artifact nào. Gate này vì vậy HIỆN CHƯA GÁC DỮ LIỆU THẬT NÀO, và nó phải nói ra điều đó thay
 * vì in "✓ ĐẠT" — một gate không có gì để gác mà báo xanh là đúng lớp lỗi "xanh mà không gác gì".
 *
 * Dùng:
 *   npm run matrix:coverage                  # báo cáo
 *   npm run matrix:coverage:enforce          # thiếu lớp kết quả → exit 1
 *   node scripts/qa/matrix_coverage.js --dir <thư mục>   # quét một thư mục cụ thể (dùng trong test)
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d = '') => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const ENFORCE = flag('enforce');

/*
 * Tiêu đề khối khai lớp kết quả. Nhận cả tiếng Anh để bộ TC cũ không bị bỏ qua âm thầm.
 *
 * KHÔNG dùng `\b` ở cuối: bản đầu viết `…kết quả)\b` và nó KHÔNG khớp `## Lớp kết quả` — `ả` không phải
 * word-char trong regex JS, nên `\b` giữa `ả` và hết dòng là giữa hai ký tự non-word, tức không có biên.
 * Gate im lặng báo "chưa có khối khai" cho một file khai đủ. Cùng họ với các ca `\b` đã trả giá trong
 * phiên này (`\bOPS\b`, `\btest(`), và là lý do luôn phải chạy thử trên fixture trước khi tin một regex.
 */
const RE_KHOI = /^#{2,4}\s*(?:lớp kết quả|output class(?:es)?)\s*$/i;
/** Cột mang MÃ lớp kết quả trong bảng ma trận. */
const RE_COT_MA = /^(?:lớp kết quả|output class|oc)$/i;
/** Mã lớp kết quả: `OC-` + số hoặc chữ. Khuôn hẹp để một ô ghi tự do không lọt thành mã. */
const RE_MA = /\bOC-[A-Z0-9]+\b/g;

/** Tách các hàng của MỌI bảng markdown trong văn bản, kèm header đã chuẩn hoá. */
function docBang(text) {
  const dong = text.replace(/\r\n?/g, '\n').split('\n');
  const bang = [];
  let cur = null;
  for (let i = 0; i < dong.length; i += 1) {
    const d = dong[i].trim();
    const laHang = d.startsWith('|') && d.endsWith('|');
    if (!laHang) { cur = null; continue; }
    const o = d.slice(1, -1).split('|').map((x) => x.trim());
    if (!cur) {
      /* Dòng kế tiếp phải là dòng gạch `|---|` mới coi đây là header — nếu không thì đó là hàng rời. */
      const ke = (dong[i + 1] || '').trim();
      if (!/^\|[\s:|-]+\|$/.test(ke)) { continue; }
      cur = { header: o, rows: [], dong: i + 1 };
      bang.push(cur);
      i += 1;
      continue;
    }
    cur.rows.push(o);
  }
  return bang;
}

/**
 * Đọc MỘT file ma trận. Trả về:
 *  - `khai`: các lớp kết quả đã khai (mã → { ten, oracle_ref })
 *  - `dung`: mã xuất hiện trong bảng ma trận, kèm số hàng
 *  - `coKhoi` / `coCotMa`: để phân biệt "chưa khai" với "khai mà không truy được"
 */
function docMaTran(duong) {
  const text = fs.readFileSync(duong, 'utf8').replace(/\r\n?/g, '\n');
  const dong = text.split('\n');
  const iKhoi = dong.findIndex((d) => RE_KHOI.test(d.trim()));
  const khai = new Map();
  let coKhoi = false;

  let iHet = -1;
  if (iKhoi >= 0) {
    coKhoi = true;
    /* Khối khai kết thúc ở heading kế tiếp cùng cấp hoặc cao hơn. */
    const capKhoi = (dong[iKhoi].match(/^#+/) || ['##'])[0].length;
    iHet = dong.length;
    for (let i = iKhoi + 1; i < dong.length; i += 1) {
      const m = dong[i].match(/^(#+)\s/);
      if (m && m[1].length <= capKhoi) { iHet = i; break; }
    }
    for (const b of docBang(dong.slice(iKhoi, iHet).join('\n'))) {
      const iMa = b.header.findIndex((h) => /^(?:mã|code|id)$/i.test(h));
      const iTen = b.header.findIndex((h) => /^(?:lớp kết quả|output class|mô tả|description)$/i.test(h));
      const iRef = b.header.findIndex((h) => /oracle/i.test(h));
      if (iMa < 0) continue;
      for (const r of b.rows) {
        const ma = (r[iMa] || '').match(/\bOC-[A-Z0-9]+\b/);
        if (!ma) continue;
        khai.set(ma[0], { ten: iTen >= 0 ? r[iTen] || '' : '', oracle_ref: iRef >= 0 ? r[iRef] || '' : '' });
      }
    }
  }

  /* Bảng MA TRẬN = bảng (ngoài khối khai) có cột mã lớp kết quả. */
  const dung = new Map();
  let coCotMa = false;
  /*
   * Phải loại CẢ KHỐI KHAI, không chỉ dòng tiêu đề của nó. Bản đầu chỉ bỏ dòng tiêu đề, nên bảng trong
   * khối khai — vốn cũng có cột tên `Lớp kết quả`, nhưng chứa TÊN lớp chứ không chứa mã — bị đọc thành
   * bảng ma trận. Hệ quả: `coCotMa` thành true, `dung` rỗng, và gate báo CẢ BA lớp "không có bộ nào phủ"
   * thay vì báo đúng vấn đề là "bảng ma trận không có cột Lớp kết quả". Đúng thông điệp sai nguyên nhân —
   * người đọc sẽ đi thêm bộ vào ma trận trong khi việc cần làm là thêm một CỘT.
   */
  const ngoaiKhoi = iKhoi >= 0 ? dong.slice(0, iKhoi).concat(dong.slice(iHet)) : dong;
  for (const b of docBang(ngoaiKhoi.join('\n'))) {
    const iCot = b.header.findIndex((h) => RE_COT_MA.test(h));
    if (iCot < 0) continue;
    coCotMa = true;
    for (const r of b.rows) {
      for (const ma of String(r[iCot] || '').match(RE_MA) || []) dung.set(ma, (dung.get(ma) || 0) + 1);
    }
  }
  return { khai, dung, coKhoi, coCotMa };
}

/** Tìm file ma trận: `*_matrix.md` trong `test-cases/` của task, hoặc trong `--dir`. */
function timFile() {
  const dir = arg('dir');
  if (dir) {
    const goc = path.resolve(dir);
    const ra = [];
    const di = (d, sau = 0) => {
      if (sau > 4) return;
      let es;
      try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of es) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) di(p, sau + 1);
        else if (/_matrix\.md$/i.test(e.name)) ra.push(p);
      }
    };
    di(goc);
    return { ra, goc };
  }
  let taskOut;
  try { taskOut = rc.getTaskOutputDir(); } catch (e) {
    console.error(`[matrix-coverage] ${e.message}`);
    console.error('  Cần TASK_KEY + PROJECT_OUTPUT_DIR, hoặc dùng `--dir <thư mục>`.');
    process.exit(2);
  }
  const d = path.join(taskOut, 'test-cases');
  let ra = [];
  try { ra = fs.readdirSync(d).filter((f) => /_matrix\.md$/i.test(f)).map((f) => path.join(d, f)); } catch { ra = []; }
  return { ra, goc: d };
}

function main() {
  const { ra, goc } = timFile();
  const rel = (p) => path.relative(goc, p).split(path.sep).join('/') || path.basename(p);

  if (!ra.length) {
    /*
     * KHÔNG in "✓ ĐẠT" ở đây. Không có ma trận nào thì gate không gác gì, và nói "đạt" là nói sai —
     * đúng lớp lỗi mà `config_load.js` được dựng ra để chống.
     */
    console.log(`[matrix-coverage] 0 file \`*_matrix.md\` trong ${rel(goc) || goc} ⇒ phép kiểm "mọi lớp kết quả xuất hiện ít nhất một lần" CHƯA GÁC GÌ.`);
    console.log('  Đây KHÔNG phải đạt. Ma trận tổ hợp sinh ra bởi skill `combinatorial_matrix`; khi có file đầu tiên thì gate này bắt đầu có hiệu lực.');
    process.exit(0);
  }

  const van = [];
  const canhBao = [];
  let nKhai = 0;
  let nPhu = 0;

  for (const f of ra) {
    const { khai, dung, coKhoi, coCotMa } = docMaTran(f);
    const ten = rel(f);

    if (!coKhoi) {
      canhBao.push(`${ten}: chưa có khối \`## Lớp kết quả\` ⇒ phép kiểm phủ lớp kết quả CHƯA ĐƯỢC GÁC cho file này`);
      continue;
    }
    if (!khai.size) {
      van.push(`${ten}: có khối \`## Lớp kết quả\` nhưng không khai được mã nào (cần bảng có cột \`Mã\` chứa \`OC-…\`)`);
      continue;
    }
    if (!coCotMa) {
      van.push(`${ten}: đã khai ${khai.size} lớp kết quả nhưng bảng ma trận KHÔNG có cột \`Lớp kết quả\` ⇒ không truy được bộ nào phủ lớp nào. Khai mà không truy được thì lời khai không kiểm được`);
      continue;
    }

    nKhai += khai.size;
    for (const [ma, o] of khai) {
      if (!String(o.oracle_ref || '').trim()) {
        van.push(`${ten}: lớp \`${ma}\` thiếu \`oracle_ref\` — không có neo thì danh sách lớp kết quả là do người viết tự nghĩ, và gate sẽ gác một mẫu số tự khai`);
      }
      const n = dung.get(ma) || 0;
      if (n === 0) van.push(`${ten}: lớp kết quả \`${ma}\`${o.ten ? ` ("${o.ten}")` : ''} KHÔNG có bộ nào phủ — pairwise phủ cặp giá trị, không phủ kết quả`);
      else nPhu += 1;
    }
    for (const ma of dung.keys()) {
      if (!khai.has(ma)) van.push(`${ten}: bảng ma trận dùng mã \`${ma}\` mà khối khai KHÔNG có — hoặc sai chính tả, hoặc một lớp kết quả chưa được khai`);
    }
  }

  console.log(`[matrix-coverage] ${ra.length} file ma trận · ${nPhu}/${nKhai} lớp kết quả có bộ phủ · ${van.length} vấn đề`);
  canhBao.forEach((c) => console.log(`  ⚠ ${c}`));
  if (van.length) {
    van.forEach((v) => console.log(`  ✗ ${v}`));
    if (ENFORCE) {
      console.log('\n[matrix-coverage] ✗ CHẶN. Thêm bộ phủ lớp còn thiếu (business-critical combo), hoặc khai lý do loại lớp đó khỏi scope ở `phase1-summary.md` §Coverage Gaps.');
      process.exit(1);
    }
    console.log('\nChặn được bằng: npm run matrix:coverage:enforce');
    process.exit(0);
  }
  /*
   * KHÔNG nói "ĐẠT" khi chưa gác lớp nào. Bản đầu in "✓ ĐẠT" cho một file hoàn toàn không khai lớp kết
   * quả — tức báo xanh cho đúng tình huống gate không làm gì. "Không có gì để gác" KHÔNG phải "đạt".
   */
  if (!nKhai) {
    console.log('[matrix-coverage] KHÔNG lớp kết quả nào được khai ⇒ phép kiểm CHƯA GÁC GÌ. Đây KHÔNG phải đạt.');
    process.exit(0);
  }
  console.log(ENFORCE ? '[matrix-coverage] ✓ ĐẠT — mọi lớp kết quả đã khai đều có ít nhất một bộ phủ.' : 'Chặn được bằng: npm run matrix:coverage:enforce');
  process.exit(0);
}

module.exports = { docMaTran, docBang };
if (require.main === module) main();
