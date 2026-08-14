#!/usr/bin/env node
'use strict';

/*
 * sheet_fetch_public.js — tải Google Sheet đang BẬT LINK CHIA SẺ về .xlsx, KHÔNG cần credential.
 *
 * VÌ SAO CẦN: `sheet_reader.js` đi qua Sheets API nên đòi `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` hoặc
 * `GOOGLE_API_KEY`. Đo 14/08/2026: cả hai đều RỖNG trong `.env`, token OAuth của `google_doc` chỉ có scope
 * `documents.readonly` + `drive.readonly`, mà Drive API lại đang bị TẮT ở GCP project ⇒ mọi đường qua API
 * đều chết, và spec dạng Google Sheet (bảng mapping field↔property, biểu phí, công thức) thì BA gửi liên
 * tục. Endpoint `/export?format=xlsx` chỉ cần quyền đọc-bằng-link — đúng dạng link BA vẫn gửi.
 *
 * GIỚI HẠN phải biết: đây là ảnh chụp TĨNH. Không có comment, không có suggested edit, không thấy dữ liệu
 * của sheet bị ẩn-bằng-quyền. Nếu sheet KHÔNG bật chia sẻ thì Google trả về HTML trang login — script phát
 * hiện và báo lỗi rõ thay vì lưu file rác (đã từng là bẫy: file .xlsx 90KB hoá ra là trang HTML).
 *
 * Dùng:
 *   node scripts/integrations/google_sheet/sheet_fetch_public.js <URL hoặc ID> [--out <đường dẫn .xlsx>]
 *   ... [--md]        # convert luôn sang .md bằng xlsx_to_md.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const input = process.argv[2];
if (!input || input.startsWith('--')) { console.error('[sheet-fetch] cần <URL hoặc spreadsheet ID>.'); process.exit(2); }

/** Rút ID từ URL /spreadsheets/d/<ID>/... hoặc nhận thẳng ID. */
function extractId(s) {
  const m = String(s).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;
  return null;
}

const id = extractId(input);
if (!id) { console.error(`[sheet-fetch] không rút được spreadsheet ID từ: ${input}`); process.exit(2); }

const out = path.resolve(arg('out', path.join(process.cwd(), `sheet_${id.slice(0, 10)}.xlsx`)));

(async () => {
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
  const res = await fetch(url, { redirect: 'follow' });
  const ct = res.headers.get('content-type') || '';
  const buf = Buffer.from(await res.arrayBuffer());

  // Google trả 200 + HTML trang đăng nhập khi sheet KHÔNG chia sẻ ⇒ phải chặn ở đây, nếu không file "xlsx"
  // lưu ra sẽ là HTML và mọi bước sau báo lỗi ở chỗ khác hẳn nguyên nhân thật.
  const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;   // "PK" = zip = xlsx
  if (!res.ok || !isZip) {
    console.error(`[sheet-fetch] KHÔNG tải được xlsx (http ${res.status}, content-type "${ct}", ${buf.length} bytes).`);
    console.error('  Nguyên nhân thường gặp: sheet chưa bật chia sẻ "Anyone with the link" ⇒ Google trả trang đăng nhập.');
    console.error('  Cách xử lý: nhờ chủ sheet bật link chia sẻ, hoặc cấp GOOGLE_SERVICE_ACCOUNT_KEY_PATH rồi dùng sheet_reader.js.');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  console.log(`[sheet-fetch] OK: ${out} (${buf.length} bytes)`);

  if (process.argv.includes('--md')) {
    const conv = path.resolve(__dirname, '..', '..', 'convert_excel', 'xlsx_to_md.js');
    execFileSync(process.execPath, [conv, out], { stdio: 'inherit' });
  }
})().catch((e) => { console.error('[sheet-fetch] lỗi:', e.message); process.exit(1); });
