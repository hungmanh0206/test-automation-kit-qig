#!/usr/bin/env node
'use strict';

/*
 * docs_health.js — trả lời "tài liệu tôi đang đọc có còn đúng không" bằng MỘT LỆNH.
 *
 * VÌ SAO CÓ FILE NÀY. Ngày 18/09/2026 soát lại CSDL-26878 bằng tay và thấy ba chuyện, cả ba đều im lặng:
 *
 *   1. 14 trên 23 trang tài liệu nguồn đã bị SỬA sau ngày fetch. Trang mới nhất sửa 16/09, bản trong task
 *      fetch từ 20/08. Một CR đã bị RÚT trong khoảng đó, gỡ theo 4 neo yêu cầu.
 *   2. 2 file fetch về RỖNG hoàn toàn: 72 và 91 byte, chỉ có tiêu đề. Không lỗi, không cảnh báo.
 *   3. 12 trên 12 trang có bảng ở nguồn nhưng file trong task 0 dòng bảng, do bộ đổi cũ (xem
 *      bộ đổi tài liệu đời cũ). AC của dự án này nằm trong bảng.
 *
 * Cả ba đều KHÔNG thể phát hiện bằng cách đọc file. File vẫn có chữ, vẫn có tiêu đề, đọc vào vẫn hợp lý.
 * Đó là lý do phải có máy: mắt người không phân biệt được "tài liệu nói thế" với "tài liệu CÒN nói thế".
 *
 * BA PHÉP ĐO, mỗi phép ứng với một sự cố ĐÃ XẢY RA, không phải rủi ro tưởng tượng.
 * (Phép đo thứ tư — LỆCH BẢN, so version sống với bản đã fetch — đã BỎ ngày 24/09/2026 cùng lượt gỡ
 *  công cụ tài liệu cũ khỏi kit. Nó là phép đo DUY NHẤT cần gọi API; ba phép còn lại đọc file nên vẫn đúng với
 *  tài liệu Markdown soạn trong Obsidian rồi đưa sang task folder.)
 *   · RỖNG       — thân tài liệu dưới ngưỡng, tức là fetch hỏng mà không báo.
 *   · MẤT BẢNG   — nguồn có <table> mà file không có dòng bảng nào.
 *   · CÒN ENTITY — chữ còn ở dạng `&agrave;` thay vì `à`. Đo được 10.555 lần trên 16/16 file của một
 *     thư mục fetch bằng đường khác. Đây không phải chuyện thẩm mỹ: `tr&ecirc;n` không khớp khi tìm
 *     "trên", nên tài liệu vẫn nằm đó mà tra cứu không ra.
 *
 * MẶC ĐỊNH KHÔNG CHẶN. Đây là báo cáo, không phải cổng. Tài liệu lệch bản là chuyện bình thường của dự
 * án đang chạy; chặn ở đây sẽ biến một tín hiệu hữu ích thành tiếng ồn bị tắt. `--strict` dành cho ai
 * muốn chặn có chủ đích.
 *
 * Dùng:
 *   node scripts/phase1/docs_health.js --task CSDL-26878
 *   node scripts/phase1/docs_health.js --task CSDL-26878 --json
 *   node scripts/phase1/docs_health.js --task CSDL-26878 --strict     # lệch bản thì exit 1
 *   node scripts/phase1/docs_health.js --dir <đường-dẫn>              # soát một thư mục bất kỳ
 *
 * Exit: 0 đạt (hoặc chỉ báo cáo) · 1 có vấn đề và đang bật --strict · 2 dùng sai hoặc thiếu env.
 */

const fs = require('fs');
const path = require('path');
const rc = require('../utils/runtime_config');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, dflt = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};

/* Thân tài liệu dưới ngưỡng này là fetch hỏng. Hai file thật gặp hôm 18/09 là 72 và 91 byte. */
const NGUONG_RONG = 400;

function loadEnv() {
  try { rc.loadEnvFiles(); } catch { /* .env thiếu thì báo ở bước kiểm creds */ }
}

/*
 * Đọc page id + version. PHẢI nhận nhiều khuôn vì trong cùng một task đang tồn tại ba kiểu đầu file do
 * ba đợt fetch khác nhau sinh ra. Bản đầu của máy này chỉ nhận khuôn `Page ID:` nên bỏ sót nguyên một
 * thư mục 16 file — một máy đo bỏ sót thì tệ hơn không có máy, vì nó phát ra tín hiệu "sạch" sai.
 */
function docMeta(text, fileName) {
  const id = (text.match(/Page ID:\s*(\d+)/) || [])[1]
    || (text.match(/^>\s*id\s+(\d+)/m) || [])[1]
    || (fileName.match(/^(\d{6,})/) || [])[1]
    /*
     * Id cũng có thể nằm GIỮA tên file, kiểu `ref_1437794348_fs-bulk-update.md`. Đòi nó đứng đầu thì
     * bỏ sót. Nhưng ở giữa thì bắt buộc 9 chữ số trở lên: id tài liệu nguồn thật dài 9 tới 10 chữ số, còn
     * `8` chữ số sẽ nuốt nhầm ngày tháng kiểu `spec-20260918-v2.md`.
     */
    || (fileName.match(/(?:^|[^\d])(\d{9,})(?:[^\d]|$)/) || [])[1]
    || null;
  const v = (text.match(/Version:\s*v(\d+)/) || [])[1]
    || (text.match(/^>\s*id\s+\d+\s*[^\d]+\s*version\s+(\d+)/m) || [])[1]
    || null;
  return { id, version: v ? Number(v) : null };
}

/*
 * `requireId: false` lấy CẢ tài liệu không mang page id.
 *
 * `docs_health` cần id vì việc của nó là đối chiếu version, không có id thì không hỏi tài liệu nguồn được.
 * Nhưng `docs_index` chỉ cần trích dẫn, mà trích dẫn chỉ cần file với số dòng. Đo thật trên CSDL-28515:
 * 108 KB spec lành, có bảng đầy đủ, nhưng tên file là `spec_bao-luu-...md` nên không có id, và cả hai
 * máy coi như task đó KHÔNG CÓ tài liệu nào. Vứt tài liệu tốt vì thiếu một con số là sai.
 */
function scanDir(dir, { requireId = true } = {}) {
  const out = [];
  (function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.md')) continue;
      const text = fs.readFileSync(p, 'utf8');
      const meta = docMeta(text, e.name);
      if (requireId && !meta.id) continue;          // không đối chiếu version được
      const body = text.replace(/^#[^\n]*\n/gm, '').trim();
      out.push({
        file: p,
        /* Không có id thì lấy chính đường dẫn làm khoá, để hai file khác nhau không bị gộp làm một. */
        id: meta.id || `file:${p}`,
        coId: Boolean(meta.id),
        version: meta.version,
        bytes: body.length,
        dongBang: text.split('\n').filter((l) => l.trim().startsWith('|')).length,
        /* `&#124;` là dấu `|` do chính bộ đổi chèn vào ô bảng, không phải entity sót. */
        entity: (text.replace(/&#\d+;/g, '').match(/&[A-Za-z][A-Za-z0-9]*;/g) || []).length,
      });
    }
  }(dir));
  return out;
}

/*
 * NGƯỠNG ENTITY — số lấy từ corpus thật, không chọn cho tròn.
 * Đo trên 483 tài liệu: 58 file còn entity, tách thành hai chế độ rõ rệt.
 *   · rải rác       — cao nhất 1,00 trên 1000 ký tự (4 entity trong 4 KB). Chữ vẫn đọc được.
 *   · hỏng hệ thống — thấp nhất 1,55, lên tới 28. Đây là file chưa giải entity bao giờ.
 * Ngưỡng đặt vào giữa khoảng trống đó.
 */
const NGUONG_ENTITY_RATE = 1.2;

/** Một file coi là LÀNH khi không dính phép đo nào. */
function lanh(r) {
  if (r.bytes < NGUONG_RONG) return false;
  if (r.srcTables > 0 && r.dongBang === 0) return false;
  if (r.entity / (r.bytes / 1000) > NGUONG_ENTITY_RATE) return false;
  return true;
}

function baoCao(rows, { strict }) {
  /*
   * Cùng một page id thường có nhiều bản trong task, do fetch nhiều đợt. Nếu đã có một bản LÀNH thì
   * các bản cũ của cùng id chỉ là rác lịch sử — vẫn phải nói ra, nhưng gộp một dòng. Kêu tên từng file
   * đã bị thay là cách nhanh nhất để người ta học cách bỏ qua báo cáo này.
   */
  const coBanLanh = new Set(rows.filter(lanh).map((r) => r.id));
  const daBiThay = rows.filter((r) => !lanh(r) && coBanLanh.has(r.id));
  const soat = rows.filter((r) => !daBiThay.includes(r));

  const rong = soat.filter((r) => r.bytes < NGUONG_RONG);
  const matBang = soat.filter((r) => r.srcTables > 0 && r.dongBang === 0);
  const conEntity = soat.filter((r) => r.entity / (r.bytes / 1000) > NGUONG_ENTITY_RATE);

  console.log(`[docs-health] ${rows.length} tài liệu · ${coBanLanh.size} trang có bản lành.`);
  if (daBiThay.length) {
    console.log(`  (bỏ qua ${daBiThay.length} file cũ của trang đã có bản lành)`);
  }

  if (rong.length) {
    console.log(`\n  RỖNG — fetch hỏng mà không báo lỗi (${rong.length}):`);
    for (const r of rong) console.log(`    ${r.bytes} byte · ${path.relative(process.cwd(), r.file)}`);
  }
  if (matBang.length) {
    console.log(`\n  MẤT BẢNG — nguồn có bảng, file không còn dòng bảng nào (${matBang.length}):`);
    for (const r of matBang) {
      console.log(`    ${r.srcTables} bảng ở nguồn · ${path.relative(process.cwd(), r.file)}`);
    }
    console.log('    Đây là dấu vết bộ đổi CŨ. Fetch lại để lấy bảng, vì AC thường nằm trong bảng.');
  }
  if (conEntity.length) {
    console.log(`\n  CÒN ENTITY — chữ chưa giải mã, tìm kiếm sẽ trượt (${conEntity.length}):`);
    for (const r of conEntity) {
      console.log(`    ${r.entity} chỗ · ${path.relative(process.cwd(), r.file)}`);
    }
    console.log('    "tr&ecirc;n" không khớp khi tra "trên". Tài liệu nằm đó mà tra cứu không ra.');
  }

  console.log('');
  return strict && xau > 0 ? 1 : 0;
}

function main() {
  loadEnv();
  let dir = opt('dir');
  if (!dir) {
    const taskKey = opt('task') || process.env.TASK_KEY;
    if (!taskKey) {
      console.error('CHAN: can --task <TASK_KEY> hoac --dir <duong-dan>.');
      process.exit(2);
    }
    dir = path.join(rc.getTaskOutputDir({ taskKey }), 'requirements');
  }
  if (!fs.existsSync(dir)) {
    console.error(`CHAN: khong thay thu muc ${dir}`);
    process.exit(2);
  }

  /*
   * `requireId: false` tu 24/09/2026. Truoc day may nay BAT BUOC page id vi phep do LECH BAN can id de
   * hoi version qua API. Phep do do da bo cung voi tài liệu nguồn, nen doi id nua la loai oan tai lieu khoi
   * phep soat — dung loai "tin hieu sach gia" ma chinh file nay canh bao: 11 task tung in ra "khong co
   * tai lieu nao" trong khi co 68 file spec lanh.
   */
  const rows = scanDir(dir, { requireId: false });
  if (!rows.length) {
    console.log(`[docs-health] khong thay tai lieu nao trong ${dir}.`);
    process.exit(0);
  }

  if (flag('json')) {
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  }
  process.exit(baoCao(rows, { strict: flag('strict') }));
}

/*
 * `docs_index.js` dùng lại `scanDir` và `lanh` để CHỈ lập chỉ mục trên tài liệu lành. Trích dẫn cần số
 * dòng, mà file do bộ đổi cũ sinh ra dồn cả trang vào một dòng — trích dẫn vào đó là vô nghĩa. Vì vậy
 * phải chép chung một định nghĩa "lành", không được có hai bản lệch nhau.
 */
module.exports = { scanDir, lanh, docMeta, NGUONG_RONG, NGUONG_ENTITY_RATE };

if (require.main === module) {
  try { main(); } catch (e) { console.error(e.message); process.exit(2); }
}
