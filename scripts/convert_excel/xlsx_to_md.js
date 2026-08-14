#!/usr/bin/env node
'use strict';

/*
 * xlsx_to_md.js — .xlsx → Markdown đọc được (chiều ngược của `md_to_xlsx.js`).
 *
 * VÌ SAO CẦN: spec của BA hay ở dạng Google Sheet (bảng mapping field↔property, biểu phí, công thức, danh
 * sách mã). Tải về .xlsx thì agent KHÔNG đọc trực tiếp được, mà `scripts/lib/testcase/parseXlsx.js` chỉ hiểu
 * đúng khuôn bảng TESTCASE. Thiếu bước này thì spec dạng sheet nằm ngoài tầm đọc của mọi phase.
 *
 * BA hay để sheet 1000 dòng × 30 cột mà chỉ ~20 dòng có dữ liệu, kèm ô gộp và cột trống ở giữa. Nên:
 *   - CẮT vùng dữ liệu thật (bỏ hàng/cột rỗng hoàn toàn) — không cắt thì md phình ra toàn dấu `|` rỗng và
 *     ngốn context vô ích;
 *   - ô GỘP: ExcelJS chỉ giữ giá trị ở ô góc trên-trái, các ô còn lại là null. Điền xuống theo hàng để bảng
 *     không bị lệch nghĩa (đúng cách sheet mapping của BA hay viết: cột 1 gộp nhiều dòng);
 *   - giữ hyperlink dạng `[text](url)` — link trong sheet thường trỏ tới sheet/tài liệu spec khác, mất link
 *     là mất đường lần tiếp (đã gặp: bảng mapping TK nhận phí nằm sau đúng một link như vậy).
 *
 * Dùng:
 *   node scripts/convert_excel/xlsx_to_md.js <file.xlsx> [--out <file.md>] [--sheet "<tên>"] [--max-rows N]
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const src = process.argv[2];
if (!src || src.startsWith('--')) { console.error('[xlsx-md] cần <file.xlsx>.'); process.exit(2); }
const MAXROWS = parseInt(arg('max-rows', '0'), 10) || 0;
const ONLY = arg('sheet', '');
const out = path.resolve(arg('out', src.replace(/\.xlsx$/i, '') + '.md'));

/**
 * Giá trị ô → text: gỡ richText/formula/hyperlink/date về dạng người đọc được.
 *
 * Ô GỘP: ExcelJS chỉ giữ value ở ô "master" (góc trên-trái), các ô còn lại value = null. Lấy value của
 * master để bảng không lệch nghĩa. Dùng metadata `isMerged`/`master` chứ KHÔNG điền-xuống theo phỏng đoán —
 * bản đầu tôi fill-down theo hàng trên và nó nhân bản luôn cả header thành "↑ ↑ ↑ STT" ở sheet 1001 dòng.
 */
function cellText(cell) {
  if (cell && cell.isMerged && cell.master && cell.master !== cell) return cellText(cell.master);
  const v = cell && cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text || '').join('');
    if (v.text !== undefined) {
      // `text` của ô hyperlink có thể LẠI là object richText ⇒ String() cho ra "[object Object]" và mất luôn
      // nhãn link (đã gặp thật trong sheet của BA). Phải gỡ một lớp nữa.
      const t = (v.text && v.text.richText) ? v.text.richText.map((r) => r.text || '').join('') : String(v.text);
      return v.hyperlink && v.hyperlink !== t ? `[${t || v.hyperlink}](${v.hyperlink})` : t;
    }
    if (v.hyperlink) return `[${v.hyperlink}](${v.hyperlink})`;
    if (v.formula !== undefined) return v.result !== undefined && v.result !== null ? String(v.result) : `=${v.formula}`;
    if (v.error) return String(v.error);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v);
}

const clean = (s) => String(s).replace(/\r?\n+/g, ' ').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(src));

  let md = `# ${path.basename(src)}\n\n> Nguồn: \`${path.resolve(src)}\` · chuyển ${new Date().toISOString().slice(0, 10)} · ${wb.worksheets.length} sheet\n`;
  md += `>\n> Đã CẮT vùng dữ liệu thật (bỏ hàng/cột rỗng) và điền xuống ô GỘP theo hàng. Bản gốc là ảnh tĩnh: KHÔNG có comment/suggested edit.\n\n`;
  md += `## Danh sách sheet\n\n`;
  const stats = [];

  const bodies = [];
  for (const ws of wb.worksheets) {
    if (ONLY && ws.name !== ONLY) continue;
    // Thu vùng dữ liệu thật
    const rows = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = [];
      for (let c = 1; c <= ws.columnCount; c++) vals.push(clean(cellText(row.getCell(c))));
      if (vals.some((v) => v !== '')) rows.push(vals);
    });
    if (!rows.length) { stats.push({ name: ws.name, rows: 0, cols: 0 }); bodies.push(`\n## Sheet: ${ws.name}\n\n_(rỗng)_\n`); continue; }
    const width = Math.max(...rows.map((r) => r.length));
    const keepCol = [];
    for (let c = 0; c < width; c++) if (rows.some((r) => (r[c] || '') !== '')) keepCol.push(c);
    let grid = rows.map((r) => keepCol.map((c) => r[c] || ''));

    // (Ô gộp đã được giải quyết ngay ở `cellText` bằng metadata merge của ExcelJS — không fill-down phỏng đoán.)
    if (MAXROWS && grid.length > MAXROWS) grid = grid.slice(0, MAXROWS).concat([[`… CẮT BỚT: còn ${rows.length - MAXROWS} hàng nữa (bỏ --max-rows để lấy đủ)`]]);

    stats.push({ name: ws.name, rows: grid.length, cols: keepCol.length });
    let body = `\n## Sheet: ${ws.name}\n\n`;
    body += `> ${grid.length} hàng có dữ liệu × ${keepCol.length} cột (gốc ${ws.rowCount}×${ws.columnCount})\n\n`;
    const head = grid[0].map((h, i) => h || `col${i + 1}`);
    body += `| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n`;
    for (const r of grid.slice(1)) body += `| ${head.map((_, i) => r[i] || '').join(' | ')} |\n`;
    bodies.push(body);
  }

  for (const s of stats) md += `- **${s.name}** — ${s.rows} hàng × ${s.cols} cột\n`;
  md += bodies.join('\n');

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, md, 'utf8');
  console.log(`[xlsx-md] OK: ${out} (${md.length} ký tự · ${stats.length} sheet)`);
})().catch((e) => { console.error('[xlsx-md] lỗi:', e.message); process.exit(1); });
