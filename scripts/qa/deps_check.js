#!/usr/bin/env node
'use strict';

/*
 * deps_check.js — MỖI DEPENDENCY PHẢI CÓ NƠI DÙNG, HOẶC CÓ MỘT DÒNG GIẢI THÍCH.
 *
 * VÌ SAO CÓ MÁY NÀY. Một lượt rà độc lập (10/10/2026) kết luận `xlsx` là dependency chết: nó khai
 * bằng URL tới CDN của SheetJS, `npm ci` trả 403 ở môi trường có proxy, và `grep` trong `scripts/`
 * cùng `tests/` không thấy ai `require` nó.
 *
 * Kết luận đó SAI, và sai theo một kiểu đáng ghi lại: phép grep bỏ qua `outputs/**` — nơi có 11 file
 * automation của task đang dùng `xlsx`. Gỡ dep theo kết luận đó là làm gãy automation của một task
 * đang chạy. Cái thiếu không phải một lần grep rộng hơn, mà là MỘT CHỖ KHAI: dep này dùng ở đâu, và
 * vì sao nó khai bằng URL.
 *
 * Nên máy này không chỉ tìm dep chết. Nó bắt mọi dep KHÔNG tự chứng minh được phải có một dòng trong
 * `.agent/config/deps_allow.json` nói rõ nơi dùng và lý do. Lần rà sau đọc dòng đó thay vì đoán lại.
 *
 * BỐN PHÉP KIỂM:
 *   ① dep không có nơi dùng và không có miễn trừ            ⇒ CHẶN
 *   ② dep khai bằng URL/`git+` mà miễn trừ không có `url_ok` ⇒ CHẶN
 *   ③ dep khai bằng URL mà lockfile KHÔNG có `integrity`     ⇒ CHẶN (tải về không khoá băm)
 *   ④ miễn trừ thừa (dep đã tự chứng minh, hoặc không còn trong package.json) ⇒ CẢNH BÁO
 *
 * ④ là cảnh báo chứ không chặn, nhưng nó quan trọng: một danh sách miễn trừ không ai dọn sẽ dần che
 * đúng thứ nó phải soi.
 *
 * Dùng: node scripts/qa/deps_check.js [--json]
 * Exit: 0 đạt · 1 có vi phạm CHẶN
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/*
 * `--repo <dir>` de spec chay phep kiem nay tren MOT CAY GIA.
 *
 * Can that, chu khong phai tien cho test: am ban cua gate nay la "them mot dep chet thi phai do".
 * Khong co `--repo` thi am ban buoc phai sua `package.json` THAT roi hoan lai -- mot phep kiem lam
 * ban cay lam viec, va hong giua duong thi de lai mot package.json sai.
 */
const iRepo = process.argv.indexOf('--repo');
const REPO = iRepo >= 0 && process.argv[iRepo + 1]
  ? path.resolve(process.argv[iRepo + 1])
  : path.resolve(__dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
const cfgPath = path.join(REPO, '.agent', 'config', 'deps_allow.json');

const cfgLoad = require(path.join(__dirname, 'lib', 'config_load'));
const cfg = cfgLoad.napConfigGate({
  duong: cfgPath,
  nhan: '`.agent/config/deps_allow.json`',
  phepKiem: 'miễn trừ dependency (mỗi dep phải có nơi dùng hoặc một dòng giải thích)',
  khiThieu: { mien_tru: {} },
}) || { mien_tru: {} };
const MIEN = cfg.mien_tru || {};

const DEPS = {
  ...(pkg.dependencies || {}),
  ...(pkg.devDependencies || {}),
  ...(pkg.optionalDependencies || {}),
};

const laUrl = (v) => /^(https?:|git\+|file:|github:)/.test(String(v));

/* ── Nơi dùng: ba bề mặt, vì một dep hợp lệ có thể chỉ xuất hiện ở một trong ba ───────────────── */

function fileTrack() {
  try {
    return execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' })
      .trim().split(/\r?\n/).filter(Boolean);
  } catch (e) {
    /* Không có `.git` (vd chạy từ gói đã giải nén) thì phép kiểm này KHÔNG phán được. Nói ra rồi
     * thoát 0: kết luận "mọi dep đều chết" ở đây là báo oan toàn bộ. */
    console.error('[deps] KHÔNG PHÁN ĐƯỢC: không có `git ls-files` (chạy ngoài repo git?).');
    process.exit(0);
  }
}

/** Nguồn mã đã track: nơi `require`/`import` xuất hiện. */
function nguonMa(files) {
  return files
    .filter((f) => /\.(js|mjs|cjs|ts|tsx)$/.test(f))
    .map((f) => { try { return fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { return ''; } })
    .join('\n');
}

/** Bề mặt gọi bằng DÒNG LỆNH: npm script, CI. `eslint`/`typescript` không bao giờ bị `require`. */
function nguonLenh(files) {
  const ci = files.filter((f) => /^\.github\/workflows\/|^\.gitlab-ci\.yml$/.test(f))
    .map((f) => { try { return fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { return ''; } });
  return [JSON.stringify(pkg.scripts || {}), ...ci].join('\n');
}

function duocDung(ten, ma, lenh) {
  const q = ten.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`require\\(\\s*['"\`]${q}(/[^'"\`]*)?['"\`]`).test(ma)) return 'require';
  if (new RegExp(`from\\s+['"\`]${q}(/[^'"\`]*)?['"\`]`).test(ma)) return 'import';
  if (new RegExp(`import\\s+['"\`]${q}(/[^'"\`]*)?['"\`]`).test(ma)) return 'import';
  // Bin gọi qua dòng lệnh: neo vào ranh giới từ để `eslint` không khớp `eslint-config-x`.
  if (new RegExp(`(^|[\\s"'\`/])${q}([\\s"'\`]|$)`, 'm').test(lenh)) return 'dòng lệnh';
  return '';
}

function integrityCuaLock(ten) {
  try {
    const lock = JSON.parse(fs.readFileSync(path.join(REPO, 'package-lock.json'), 'utf8'));
    const e = (lock.packages || {})[`node_modules/${ten}`];
    return e ? e.integrity || '' : '';
  } catch (e) { return ''; }
}

function main() {
  const files = fileTrack();
  const ma = nguonMa(files);
  const lenh = nguonLenh(files);

  const chan = [];
  const canh = [];
  const bang = [];

  for (const [ten, ver] of Object.entries(DEPS)) {
    const noi = duocDung(ten, ma, lenh);
    const m = MIEN[ten];
    const url = laUrl(ver);
    bang.push({ ten, ver, noi: noi || (m ? 'miễn trừ' : '—'), url });

    // ① không nơi dùng, không miễn trừ
    if (!noi && !m) {
      chan.push(`${ten}: KHÔNG thấy nơi dùng trong file đã track, và KHÔNG có miễn trừ.`
        + ' Hoặc gỡ dep, hoặc thêm một dòng vào `.agent/config/deps_allow.json` nói rõ nơi dùng + lý do.');
    }

    // ② URL mà miễn trừ không cho phép
    if (url && !(m && m.url_ok)) {
      chan.push(`${ten}: khai bằng URL/\`git+\` (${String(ver).slice(0, 60)}) mà miễn trừ không có \`url_ok\`.`
        + ' Dep dạng URL không qua registry: phải khai rõ vì sao chấp nhận.');
    }

    // ③ URL mà lockfile không khoá băm
    if (url && !integrityCuaLock(ten)) {
      chan.push(`${ten}: dep dạng URL mà \`package-lock.json\` KHÔNG có \`integrity\`.`
        + ' Tải về không khoá băm thì nội dung có thể đổi dưới chân mình mà lockfile vẫn "khớp".');
    }

    // ④ miễn trừ thừa
    if (m && noi && noi !== 'miễn trừ' && !url) {
      canh.push(`${ten}: có miễn trừ nhưng dep đã tự chứng minh (thấy ở ${noi}) — xoá dòng miễn trừ đi.`);
    }
    if (m && !m.vi_sao) canh.push(`${ten}: miễn trừ thiếu \`vi_sao\` — miễn trừ không có lý do thì không ai rà lại được.`);
  }

  for (const ten of Object.keys(MIEN)) {
    if (!(ten in DEPS)) canh.push(`${ten}: có miễn trừ nhưng KHÔNG còn trong package.json — xoá dòng đó.`);
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ bang, chan, canh }, null, 2));
    process.exit(chan.length ? 1 : 0);
  }

  console.log(`[deps] ${bang.length} dependency:`);
  for (const r of bang) console.log(`  ${r.ten.padEnd(22)} ${r.url ? 'URL ' : '    '}${r.noi}`);

  if (canh.length) {
    console.log(`\n[deps] ⚠ ${canh.length} cảnh báo:`);
    canh.forEach((x) => console.log(`  - ${x}`));
  }
  if (chan.length) {
    console.error(`\n[deps] ✗ ${chan.length} vi phạm CHẶN:`);
    chan.forEach((x) => console.error(`  - ${x}`));
    process.exit(1);
  }
  console.log('\n[deps] ✓ ĐẠT — mọi dependency đều có nơi dùng hoặc một dòng giải thích.');
}

if (require.main === module) main();
module.exports = { duocDung, laUrl };
