#!/usr/bin/env node
'use strict';

/*
 * docs_health.js — trả lời "tài liệu tôi đang đọc có còn đúng không" bằng MỘT LỆNH.
 *
 * VÌ SAO CÓ FILE NÀY. Ngày 18/09/2026 soát lại SAPP-26878 bằng tay và thấy ba chuyện, cả ba đều im lặng:
 *
 *   1. 14 trên 23 trang Confluence đã bị SỬA sau ngày fetch. Trang mới nhất sửa 16/09, bản trong task
 *      fetch từ 20/08. Một CR đã bị RÚT trong khoảng đó, gỡ theo 4 neo yêu cầu.
 *   2. 2 file fetch về RỖNG hoàn toàn: 72 và 91 byte, chỉ có tiêu đề. Không lỗi, không cảnh báo.
 *   3. 12 trên 12 trang có bảng ở nguồn nhưng file trong task 0 dòng bảng, do bộ đổi cũ (xem
 *      `scripts/lib/confluence/storage_to_markdown.js`). AC của dự án này nằm trong bảng.
 *
 * Cả ba đều KHÔNG thể phát hiện bằng cách đọc file. File vẫn có chữ, vẫn có tiêu đề, đọc vào vẫn hợp lý.
 * Đó là lý do phải có máy: mắt người không phân biệt được "tài liệu nói thế" với "tài liệu CÒN nói thế".
 *
 * BỐN PHÉP ĐO, mỗi phép ứng với một sự cố ĐÃ XẢY RA, không phải rủi ro tưởng tượng:
 *   · LỆCH BẢN   — version trên Confluence khác version lúc fetch.
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
 *   node scripts/phase1/docs_health.js --task SAPP-26878
 *   node scripts/phase1/docs_health.js --task SAPP-26878 --json
 *   node scripts/phase1/docs_health.js --task SAPP-26878 --strict     # lệch bản thì exit 1
 *   node scripts/phase1/docs_health.js --dir <đường-dẫn>              # soát một thư mục bất kỳ
 *
 * Exit: 0 đạt (hoặc chỉ báo cáo) · 1 có vấn đề và đang bật --strict · 2 dùng sai hoặc thiếu env.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
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
    || null;
  const v = (text.match(/Version:\s*v(\d+)/) || [])[1]
    || (text.match(/^>\s*id\s+\d+\s*[^\d]+\s*version\s+(\d+)/m) || [])[1]
    || null;
  return { id, version: v ? Number(v) : null };
}

function scanDir(dir) {
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
      if (!meta.id) continue;                       // không phải tài liệu fetch từ Confluence
      const body = text.replace(/^#[^\n]*\n/gm, '').trim();
      out.push({
        file: p,
        id: meta.id,
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

function confluenceClient() {
  const url = (process.env.CONFLUENCE_URL || `${process.env.JIRA_BASE_URL || ''}/wiki`).replace(/\/+$/, '');
  const user = process.env.CONFLUENCE_USERNAME || process.env.JIRA_EMAIL || process.env.JIRA_USERNAME;
  const token = process.env.CONFLUENCE_API_TOKEN;
  if (!url || !user || !token) return null;
  const base = new URL(url);
  const auth = Buffer.from(`${user}:${token}`).toString('base64');
  return (apiPath) => new Promise((resolve, reject) => {
    let data = '';
    https.get({
      hostname: base.hostname,
      path: `${base.pathname.replace(/\/+$/, '')}${apiPath}`,
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    }, (res) => {
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error(`HTTP ${res.statusCode}`)); }
      });
    }).on('error', reject);
  });
}

/** Một file coi là LÀNH khi không dính phép đo nào. */
function lanh(r) {
  if (r.bytes < NGUONG_RONG) return false;
  if (r.srcTables > 0 && r.dongBang === 0) return false;
  if (r.entity > 0) return false;
  if (r.liveVersion && r.version !== r.liveVersion) return false;
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
  const conEntity = soat.filter((r) => r.entity > 0);
  const lech = soat.filter((r) => r.liveVersion && r.version && r.liveVersion !== r.version);
  const chuaBiet = soat.filter((r) => r.liveVersion && !r.version);

  console.log(`[docs-health] ${rows.length} tài liệu Confluence · ${coBanLanh.size} trang có bản lành.`);
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
  if (lech.length) {
    console.log(`\n  LỆCH BẢN — Confluence đã sửa sau ngày fetch (${lech.length}):`);
    for (const r of lech) {
      console.log(`    v${r.version} tại chỗ, v${r.liveVersion} trên Confluence (sửa ${r.liveWhen}) · ${r.title || r.id}`);
    }
  }
  if (chuaBiet.length) {
    console.log(`\n  KHÔNG ĐỐI CHIẾU ĐƯỢC — file không ghi version lúc fetch (${chuaBiet.length}):`);
    for (const r of chuaBiet) {
      console.log(`    hiện là v${r.liveVersion} (sửa ${r.liveWhen}) · ${path.relative(process.cwd(), r.file)}`);
    }
    console.log('    File ghi bằng bản fetcher cũ. Fetch lại thì dòng `## Version:` sẽ có.');
  }

  const xau = rong.length + matBang.length + conEntity.length + lech.length;
  if (!xau && !chuaBiet.length) console.log('  Không thấy vấn đề nào.');
  console.log('');
  return strict && xau > 0 ? 1 : 0;
}

async function main() {
  loadEnv();
  let dir = opt('dir');
  if (!dir) {
    const taskKey = opt('task') || process.env.TASK_KEY;
    if (!taskKey) {
      console.error('CHẶN: cần --task <TASK_KEY> hoặc --dir <đường-dẫn>.');
      process.exit(2);
    }
    dir = path.join(rc.getTaskOutputDir({ taskKey }), 'requirements');
  }
  if (!fs.existsSync(dir)) {
    console.error(`CHẶN: không thấy thư mục ${dir}`);
    process.exit(2);
  }

  const rows = scanDir(dir);
  if (!rows.length) {
    console.log(`[docs-health] không có tài liệu Confluence nào trong ${dir}`);
    process.exit(0);
  }

  /*
   * Mỗi page id hỏi Confluence ĐÚNG MỘT LẦN, dù nhiều file cùng trỏ vào nó. Bản fetch cũ và bản mới
   * hay nằm song song trong cùng task, hỏi hai lần là tốn quota mà không thêm thông tin.
   */
  const get = confluenceClient();
  if (get) {
    const cache = new Map();
    for (const r of rows) {
      if (!cache.has(r.id)) {
        try {
          const j = await get(`/rest/api/content/${r.id}?expand=version,body.storage`);
          cache.set(r.id, {
            title: j.title,
            liveVersion: j.version && j.version.number,
            liveWhen: j.version && String(j.version.when).slice(0, 10),
            srcTables: ((j.body && j.body.storage && j.body.storage.value) || '').match(/<table/gi)?.length || 0,
          });
        } catch (e) {
          cache.set(r.id, { err: e.message });
        }
      }
      Object.assign(r, cache.get(r.id));
    }
  } else {
    console.log('[docs-health] thiếu CONFLUENCE_API_TOKEN nên chỉ soát được phần đọc file.');
    console.log('              Khai lane doc-read để kiểm cả LỆCH BẢN và MẤT BẢNG.\n');
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
module.exports = { scanDir, lanh, docMeta, NGUONG_RONG };

if (require.main === module) {
  main().catch((e) => { console.error(e.message); process.exit(2); });
}
