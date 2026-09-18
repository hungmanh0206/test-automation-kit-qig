#!/usr/bin/env node
'use strict';

/*
 * docs_index.js — mỗi neo yêu cầu trong tài liệu phải TRA NGƯỢC ĐƯỢC về file và số dòng.
 *
 * VÌ SAO CÓ FILE NÀY. Kit đã bắt buộc mọi phán PASS/FAIL phải kèm `oracle_ref`, và có máy kiểm
 * (`scripts/lib/expansion/finding.js`). Nhưng máy đó chỉ kiểm HÌNH DẠNG chuỗi, dạng `BR-XXX-000`. Nó
 * không hỏi câu quan trọng hơn: **neo đó có thật trong tài liệu không, và nằm ở đâu?**
 *
 * Hệ quả là viết `BR-07` hay `AC-9.9` đều qua cửa như nhau, kể cả khi tài liệu không hề có mục đó.
 * Đây đúng là cách sinh ra một kết luận nghe rất có căn cứ mà không neo vào đâu cả.
 *
 * PHẢI CHẠY TRÊN TÀI LIỆU LÀNH. Trích dẫn cần số dòng, mà file do bộ đổi cũ sinh ra dồn cả trang vào
 * MỘT dòng — trỏ vào "dòng 1" của một trang 8 KB thì không phải trích dẫn. Nên chỉ mục này lấy đúng
 * những file mà `docs_health.js` gọi là lành, và bỏ qua bản cũ của cùng trang.
 *
 * KHÔNG ĐOÁN. Neo nào tài liệu không có thì nói là không có. Tuyệt đối không tìm gần đúng rồi gợi ý
 * một neo khác, vì gợi ý sai ở đây dẫn thẳng tới việc đổi expected cho khớp một luật không tồn tại.
 *
 * Dùng:
 *   node scripts/phase1/docs_index.js --task SAPP-26878 --write   # ghi _anchors.json
 *   node scripts/phase1/docs_index.js --task SAPP-26878 --cite BR-07
 *   node scripts/phase1/docs_index.js --task SAPP-26878 --verify <file.md|file.xlsx.md ...>
 *
 * Exit: 0 đạt · 1 có neo không tra được và đang bật --enforce · 2 dùng sai.
 */

const fs = require('fs');
const path = require('path');
const rc = require('../utils/runtime_config');
const { scanDir, lanh } = require('./docs_health');

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const rest = (n) => {
  const i = argv.indexOf(`--${n}`);
  if (i < 0) return [];
  const out = [];
  for (let k = i + 1; k < argv.length && !argv[k].startsWith('--'); k += 1) out.push(argv[k]);
  return out;
};

/*
 * Neo của TÀI LIỆU, không phải id knowledge của kit.
 *
 * Hai hệ khác hẳn nhau và đừng trộn: `BR-SAPSYNC-003` là luật trong `knowledge/domain/` do
 * `domain_rules.js` gác, còn `BR-07` với `AC-2.1` là mục đánh số trong chính trang Confluence. File
 * này chỉ lo hệ thứ hai. Phần đuôi `(?![A-Za-z])` để `BR-07` không nuốt mất `BR-SAPSYNC-003`.
 */
const ANCHOR_RE = /\b(BR|AC|EC|NFR|OQ|CR|US|FR|REL)-(\d+(?:\.\d+)*)\b(?![A-Za-z])/g;

/** Dòng bảng markdown `| BR-01 | ... |` là ĐỊNH NGHĨA; nhắc trong câu văn chỉ là tham chiếu. */
function laDinhNghia(line, anchor) {
  const t = line.trim();
  if (!t.startsWith('|')) return false;
  const first = t.split('|')[1];
  return first !== undefined && first.trim() === anchor;
}

/*
 * MỖI TRANG CHỈ LẤY MỘT BẢN, và phải là bản tốt nhất.
 *
 * `lanh()` một mình không đủ ở đây. Phép đo MẤT BẢNG cần biết nguồn có `<table>` hay không, mà đó là
 * thông tin lấy từ Confluence. Chỉ mục chạy NGOẠI TUYẾN, nên với file không rõ nguồn thì phép đo đó
 * im lặng và một bản đã mất hết bảng vẫn được coi là lành. Đo thật: 9 file như vậy lọt vào chỉ mục,
 * đều là bản trùng của trang đã có bản tốt hơn.
 *
 * Xếp hạng bằng ba tín hiệu ĐỌC ĐƯỢC TỪ CHÍNH FILE, không cần mạng:
 *   1. có ghi số version lúc fetch  — bản mới ghi mới có, và biết version mới đối chiếu được
 *   2. nhiều dòng bảng hơn          — bản làm phẳng bảng luôn thua bản giữ được bảng
 *   3. ít entity sót hơn, rồi dài hơn
 */
function chonBanTot(rows) {
  const theoTrang = new Map();
  for (const r of rows) {
    if (!theoTrang.has(r.id)) theoTrang.set(r.id, []);
    theoTrang.get(r.id).push(r);
  }
  const diem = (r) => [r.version ? 1 : 0, r.dongBang, -r.entity, r.bytes];
  const tot = [];
  for (const ban of theoTrang.values()) {
    tot.push(ban.slice().sort((a, b) => {
      const x = diem(a); const y = diem(b);
      for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return y[i] - x[i];
      return a.file.localeCompare(b.file);
    })[0]);
  }
  return tot;
}

function buildIndex(dir) {
  const rows = scanDir(dir);
  /* Mỗi trang một bản tốt nhất, rồi bản đó vẫn phải qua `lanh()`. Không qua thì bỏ hẳn trang. */
  const ungVien = chonBanTot(rows);
  const dung = ungVien.filter(lanh);
  const boQua = ungVien.filter((r) => !lanh(r));

  const anchors = new Map();
  for (const r of dung) {
    const lines = fs.readFileSync(r.file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      ANCHOR_RE.lastIndex = 0;
      const seen = new Set();
      let m = ANCHOR_RE.exec(line);
      while (m) {
        const key = m[0];
        if (!seen.has(key)) {
          seen.add(key);
          if (!anchors.has(key)) anchors.set(key, { anchor: key, dinhNghia: [], nhacToi: [] });
          const viTri = { file: r.file, line: i + 1, pageId: r.id, text: line.trim().slice(0, 220) };
          anchors.get(key)[laDinhNghia(line, key) ? 'dinhNghia' : 'nhacToi'].push(viTri);
        }
        m = ANCHOR_RE.exec(line);
      }
    });
  }
  return { anchors, soFileDung: dung.length, trangBoQua: [...new Set(boQua.map((r) => r.id))] };
}

/** Trang nào định nghĩa neo này. */
function soTrangDinhNghia(rec) {
  return new Set(rec.dinhNghia.map((c) => c.pageId)).size;
}

/*
 * MƠ HỒ THẬT = cùng một mã nhưng NỘI DUNG luật khác nhau giữa các trang. Đếm số trang là chưa đủ, và
 * bản đầu đếm kiểu đó đã báo oan hai nhóm:
 *   · `US-xx` là tên TRANG, không phải luật. Trang US-01 hiển nhiên được nhắc ở nhiều nơi.
 *   · `NFR-02` nằm cả trong FS lẫn BRD nhưng là CÙNG MỘT luật chép sang, không phải hai luật.
 * Cái đáng cảnh báo là `BR-07`: US-01 nói về email khi lỗi, US-13 nói về rollback A/R Memo.
 */
function moHoThat(rec) {
  if (rec.anchor.startsWith('US-')) return false;
  if (soTrangDinhNghia(rec) < 2) return false;
  const chuan = (t) => t.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase().slice(0, 120);
  return new Set(rec.dinhNghia.map((c) => chuan(c.text))).size > 1;
}

function inCite(idx, anchor, trong) {
  const rec = idx.anchors.get(anchor);
  if (!rec) {
    console.error(`KHÔNG TRA ĐƯỢC: tài liệu không có "${anchor}".`);
    console.error('    Không có nghĩa là "chắc ở đâu đó". Nghĩa là chưa có căn cứ để phán PASS/FAIL.');
    return 1;
  }
  let dn = rec.dinhNghia.length ? rec.dinhNghia : rec.nhacToi;
  if (trong) {
    const loc = dn.filter((c) => c.pageId === trong || path.basename(c.file).includes(trong));
    if (!loc.length) {
      console.error(`KHÔNG TRA ĐƯỢC: có "${anchor}" nhưng không nằm trong trang khớp "${trong}".`);
      return 1;
    }
    dn = loc;
  }
  for (const c of dn.slice(0, 6)) {
    console.log(`${path.relative(process.cwd(), c.file)}:${c.line}`);
    console.log(`    ${c.text}`);
  }
  /*
   * Đo thật trên SAPP-26878: `BR-07` có DỊNH NGHĨA ở 5 trang US khác nhau, mỗi trang một luật khác
   * hẳn. Tài liệu đánh số BR theo TỪNG US, nên một testcase chỉ ghi "BR-07" là chưa chỉ ra được luật
   * nào. Phải kèm trang, kiểu "US-01 BR-07".
   */
  if (!trong && moHoThat(rec)) {
    console.log(`\n  MƠ HỒ: "${anchor}" được định nghĩa ở ${soTrangDinhNghia(rec)} trang khác nhau.`);
    console.log('  Tài liệu đánh số theo từng US, nên trích một mình neo này chưa chỉ ra luật nào.');
    console.log(`  Thu hẹp bằng: --cite ${anchor} --in <US-xx hoặc pageId>`);
  } else if (rec.dinhNghia.length && rec.nhacToi.length) {
    console.log(`  (còn ${rec.nhacToi.length} chỗ nhắc tới neo này ngoài dòng định nghĩa)`);
  }
  return 0;
}

function verify(idx, files) {
  const thieu = new Map();
  const nhac = new Set();
  let tong = 0;
  /*
   * Neo được coi là CÓ PHẠM VI khi cùng dòng đã có `US-xx` đứng trước nó.
   *
   * Bản đầu chỉ nhận khi `US-xx` nằm sát ngay trước, và đếm ra 76 neo "không phạm vi". Đọc lại các
   * dòng đó thì phần lớn viết đúng, kiểu `| ... / US-02 Incoming Payment | ... BR-09 ...` hay
   * `US-01 BR-02/BR-03`. Cảnh báo kêu vào chỗ viết đúng thì người ta sẽ tắt cả cảnh báo.
   */
  const khongPhamVi = new Set();
  for (const f of files) {
    if (!fs.existsSync(f)) { console.error(`bỏ qua, không thấy file: ${f}`); continue; }
    const dung = new Set();
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      ANCHOR_RE.lastIndex = 0;
      let m = ANCHOR_RE.exec(line);
      while (m) {
        dung.add(m[0]);
        if (!/\bUS-\d+\b/.test(line.slice(0, m.index))) khongPhamVi.add(m[0]);
        m = ANCHOR_RE.exec(line);
      }
    }
    for (const a of dung) {
      tong += 1;
      nhac.add(a);
      if (!idx.anchors.has(a)) {
        if (!thieu.has(a)) thieu.set(a, []);
        thieu.get(a).push(path.basename(f));
      }
    }
  }
  console.log(`[docs-index] ${idx.anchors.size} neo trong ${idx.soFileDung} tài liệu lành.`);
  console.log(`             ${tong} neo được nhắc ở ${files.length} file đang soát.`);

  /* Neo tra được nhưng định nghĩa ở nhiều trang: trích một mình nó chưa chỉ ra luật nào. */
  const moHo = [...idx.anchors.values()]
    .filter((r) => moHoThat(r) && nhac.has(r.anchor) && khongPhamVi.has(r.anchor))
    .map((r) => `${r.anchor} (${soTrangDinhNghia(r)} trang)`);
  if (moHo.length) {
    console.log(`\n  MƠ HỒ (${moHo.length}) — tài liệu đánh số theo từng US, nên neo trần chưa đủ chỉ luật:`);
    console.log(`    ${moHo.sort().join(' · ')}`);
    console.log('    Testcase nên ghi kèm trang, kiểu "US-01 BR-07".');
  }

  if (!thieu.size) {
    console.log('\n             Mọi neo đều tra ngược được về tài liệu.');
    return 0;
  }
  console.log(`\n  KHÔNG TRA ĐƯỢC (${thieu.size}) — nhắc trong testcase mà tài liệu không có:`);
  for (const [a, fl] of [...thieu].sort()) console.log(`    ${a}  ·  ${[...new Set(fl)].join(', ')}`);
  console.log('\n  Mỗi neo ở đây là một phán quyết không có căn cứ, hoặc một neo đã bị gỡ khỏi spec.');
  if (idx.trangBoQua.length) {
    console.log(`  Lưu ý: ${idx.trangBoQua.length} trang bị bỏ vì không có bản lành, neo trong đó không vào chỉ mục.`);
    console.log('  Chạy `npm run docs:health` trước để biết trang nào cần fetch lại.');
  }
  return 1;
}

function main() {
  const dir = opt('dir') || (() => {
    const taskKey = opt('task') || process.env.TASK_KEY;
    if (!taskKey) { console.error('CHẶN: cần --task <TASK_KEY> hoặc --dir <đường-dẫn>.'); process.exit(2); }
    return path.join(rc.getTaskOutputDir({ taskKey }), 'requirements');
  })();
  if (!fs.existsSync(dir)) { console.error(`CHẶN: không thấy thư mục ${dir}`); process.exit(2); }

  const idx = buildIndex(dir);

  const cite = opt('cite');
  if (cite) process.exit(inCite(idx, cite.toUpperCase(), opt('in')));

  const files = rest('verify');
  if (files.length) process.exit(flag('enforce') ? verify(idx, files) : (verify(idx, files), 0));

  const out = path.join(dir, '_anchors.json');
  const data = {
    _sinh_boi: 'node scripts/phase1/docs_index.js --write',
    _chi_lay_tai_lieu_lanh: true,
    soFileDung: idx.soFileDung,
    trangBoQua: idx.trangBoQua,
    anchors: Object.fromEntries([...idx.anchors].sort()),
  };
  if (flag('write')) {
    fs.writeFileSync(out, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[docs-index] đã ghi ${path.relative(process.cwd(), out)}`);
  }
  const coDinhNghia = [...idx.anchors.values()].filter((r) => r.dinhNghia.length).length;
  console.log(`[docs-index] ${idx.anchors.size} neo · ${coDinhNghia} có dòng định nghĩa · ${idx.soFileDung} tài liệu lành.`);
  if (idx.trangBoQua.length) {
    console.log(`             bỏ ${idx.trangBoQua.length} trang chưa có bản lành — chạy \`npm run docs:health\`.`);
  }
  process.exit(0);
}

module.exports = { buildIndex, ANCHOR_RE, laDinhNghia };

if (require.main === module) main();
