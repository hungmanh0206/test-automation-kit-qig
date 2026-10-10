#!/usr/bin/env node
'use strict';

/*
 * knowledge_bootstrap.js — DỰNG KHUNG `domain/` ở trạng thái `draft`, để kho không ở lại rỗng.
 *
 * VÌ SAO CÓ (v2.5.0 G2.3). Kit chỉ điền `knowledge/domain` khi có người ghi tay sau khi BA chốt. Dự án
 * mới thì kho rỗng, và nó Ở LẠI RỖNG — vì bước đầu tiên khó nhất: phải biết HỎI GÌ trước đã.
 *
 * `seed:knowledge` đã có nhưng làm việc KHÁC: nó nạp lịch sử bug từ Backlog vào
 * `knowledge/{bugs,historical_execution}` để `risk_score` có Likelihood thật thay vì cold-start. Nó KHÔNG
 * chạm `domain/` — và đúng là không nên, vì `domain/` là tầng ORACLE.
 *
 * ĐIỀU BỘ NÀY CỐ Ý KHÔNG LÀM: **không sinh nội dung rule.** Sinh câu rule từ text của Backlog hay từ app
 * là chế oracle — đúng thứ `domain:check` vừa CHẶN ở G1.3 (`source` lấy app làm nguồn). Nên nó chỉ dựng
 * KHUNG RỖNG kèm CÂU HỎI, ở `status: draft`:
 *   · `rule` để trống — draft theo định nghĩa chưa có phát biểu nào;
 *   · `todo` là câu hỏi phải mang đi hỏi BA;
 *   · `covered_by: []` và gate CHẶN nếu nó khác rỗng — draft không bao giờ được làm oracle.
 *
 * NGUỒN MODULE là bộ TESTCASE CANONICAL, không phải Backlog và không phải app. Lý do: cột `Module` của bộ
 * TC là danh mục đã có người viết ra và đã qua `design_gate`, nên nó là mẫu số thật. Discovery của v2.6.0
 * sau này sẽ cấp thêm nguồn module, và lúc đó bộ này nhận thêm `--from-discovery`.
 *
 * Dùng:
 *   npm run knowledge:bootstrap -- --task <K>           # DRY-RUN: in ra sẽ dựng gì
 *   npm run knowledge:bootstrap -- --task <K> --apply   # ghi thật vào knowledge/domain/
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const canonical = require(path.resolve(__dirname, '..', 'lib', 'testcase'));

const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d = '') => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const APPLY = flag('apply');
const REPO = rc.REPO_ROOT;
const DIR = path.resolve(arg('dir', path.join(REPO, 'knowledge', 'domain')));

/** `Module` → phần SLUG của id (`BR-<SLUG>-<NNN>`): bỏ dấu, bỏ ký tự lạ, HOA. */
function slug(s) {
  /*
   * Lấy đoạn TRƯỚC dấu `/`: cột `Module` của bộ TC thật có dạng "Chuyển lớp / Dữ liệu đi kèm" — đoạn sau
   * là màn hoặc biến thể, nên nhồi cả vào slug thì 16 ký tự đầu của nhiều module trùng nhau và id mất
   * nghĩa. Đo được: `BR-THEMMOIHOSOHOCSI-900` và `-901` là hai module KHÁC HẲN, chỉ giống nhau ở phần bị
   * cắt — tức id không còn nói được nó thuộc về đâu.
   */
  return String(s).split('/')[0].normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd').replace(/[^A-Za-z0-9]+/g, '').toUpperCase().slice(0, 16);
}

/** Module có trong bộ TC canonical của task, kèm số case — số case là thứ xếp ưu tiên. */
function moduleTuBoTC(taskDir) {
  const dem = new Map();
  for (const dir of rc.getTestcaseDirs(taskDir)) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('~$') || f.startsWith('.~') || !f.endsWith('.md')) continue;
      let doc;
      try { doc = canonical.parseMarkdown(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
      for (const t of doc.tests || []) {
        const m = String(t.module || '').trim();
        if (m) dem.set(m, (dem.get(m) || 0) + 1);
      }
    }
  }
  return [...dem.entries()].sort((a, b) => b[1] - a[1]);
}

/** Id tiếp theo còn trống cho một slug, để chạy lại không ghi trùng. */
function idTrong(sl, daCo) {
  for (let i = 900; i < 1000; i += 1) {
    const id = `BR-${sl}-${i}`;
    if (!daCo.has(id)) return id;
  }
  return null;
}

function khung(id, module_, soCase) {
  return {
    id,
    module: module_,
    status: 'draft',
    /*
     * `rule` để TRỐNG có chủ đích. Điền sẵn một câu đoán là chế oracle, và `domain:check` sẽ cho nó đi qua
     * vì nó "có nội dung" — đó là cách tệ nhất để lấp một kho rỗng.
     */
    rule: '',
    todo: `Hỏi BA/tài liệu: module "${module_}" (${soCase} case trong bộ TC) có những business rule nào bắt buộc? Mỗi rule cần: phát biểu kiểm được · nguồn (FSD/văn bản gốc/BA xác nhận) · ít nhất một ví dụ input→expected.`,
    covered_by: [],
    version: 1,
    _dung_nhu_the_nao: 'Đây là KHUNG, chưa phải oracle. Điền `rule` + `source` + `examples`, đặt `confirmed_by` (BA|Dev|QA-Lead|PO, hoac `Van-ban-phap-quy` khi neo la van ban phap quy - luc do `source` phai neu so hieu) và `confirmed_at`, rồi đổi `status` thành `active`. `domain:check` CHẶN mọi case trỏ vào một rule còn ở `draft`.',
    _nguon_khung: 'knowledge:bootstrap — module lấy từ cột `Module` của bộ testcase canonical, KHÔNG suy từ app và KHÔNG sinh từ text Backlog.',
  };
}

function main() {
  let taskDir;
  try { taskDir = rc.getTaskOutputDir(); } catch (e) {
    console.error(`[bootstrap] ${e.message}`);
    console.error('  Cần TASK_KEY + PROJECT_OUTPUT_DIR, hoặc TASK_ENV=profiles/<TASK>/task.env.');
    process.exit(2);
  }

  const mods = moduleTuBoTC(taskDir);
  if (!mods.length) {
    console.log('[bootstrap] 0 module đọc được từ bộ TC canonical ⇒ KHÔNG dựng gì. Đây không phải đạt: kéo bộ TC về trước (`test-cases/*.md`).');
    process.exit(0);
  }

  /* Module nào ĐÃ có rule (bất kể trạng thái) thì không dựng lại — chạy lại phải idempotent. */
  const daCo = new Set();
  const moduleDaCo = new Set();
  if (fs.existsSync(DIR)) {
    for (const f of fs.readdirSync(DIR)) {
      if (!f.endsWith('.json')) continue;
      try {
        const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
        if (j.id) daCo.add(j.id);
        if (j.module) moduleDaCo.add(String(j.module).trim());
      } catch { /* file hỏng đã có `domain:check` lo */ }
    }
  }

  const se = [];
  for (const [m, n] of mods) {
    if (moduleDaCo.has(m)) continue;
    const id = idTrong(slug(m), daCo);
    if (!id) { console.log(`[bootstrap] ⚠ hết dải id 900–999 cho module "${m}" — đặt tay.`); continue; }
    daCo.add(id);
    se.push(khung(id, m, n));
  }

  console.log(`[bootstrap] ${mods.length} module trong bộ TC · ${moduleDaCo.size} module đã có rule · ${se.length} khung sẽ dựng`);
  if (!se.length) {
    console.log('[bootstrap] Không có gì để dựng — mọi module đã có rule. Đây là trạng thái TỐT, không phải lỗi.');
    process.exit(0);
  }
  se.slice(0, 12).forEach((k) => console.log(`  ${k.id.padEnd(24)} ${k.module}`));
  if (se.length > 12) console.log(`  … +${se.length - 12}`);

  if (!APPLY) {
    console.log('\nDRY-RUN — đây là DANH SÁCH VIỆC, và phần lớn giá trị nằm ở chính nó.');
    console.log('  Khung ở `status: draft`: `rule` TRỐNG có chủ đích (điền sẵn một câu đoán là chế oracle),');
    console.log('  `todo` là câu hỏi mang đi hỏi BA, và `domain:check` CHẶN mọi case trỏ vào rule còn ở `draft`.');
    console.log(`  Ghi thật: thêm \`--apply\` KÈM \`--top <n>\` hoặc \`--module "<tên>"\`. Không có hai cờ đó thì`);
    console.log('  nó TỪ CHỐI — dồn hàng chục file rỗng vào tầng oracle chưa chắc tốt hơn một kho rỗng.');
    process.exit(0);
  }

  /*
   * `--apply` ĐÒI chọn phạm vi, có chủ đích. Đo trên CSDL-9003: 44 module ⇒ 44 khung rỗng, và một
   * `domain:index` đầy ô trắng không giúp ai. Phần giá trị của bộ này là DANH SÁCH VIỆC (bản dry-run),
   * còn file khung chỉ nên dựng cho phần sắp làm. Buộc chọn phạm vi là cách giữ đúng tỉ lệ đó.
   */
  const top = parseInt(arg('top', ''), 10);
  const chiMod = arg('module', '');
  if (!chiMod && !(top > 0)) {
    console.error('\n[bootstrap] ✗ TỪ CHỐI ghi: `--apply` phải kèm `--top <n>` hoặc `--module "<tên>"`.');
    console.error(`  Đang có ${se.length} module chưa có rule. Dồn hết vào tầng oracle là tạo ${se.length} file rỗng phải bảo trì,`);
    console.error('  và `domain:index` đầy ô trắng. Dựng khung cho phần SẮP LÀM, không dựng cho cả danh mục.');
    process.exit(2);
  }
  const chon = chiMod
    ? se.filter((k) => k.module === chiMod)
    : se.slice(0, top);
  if (!chon.length) {
    console.error(`[bootstrap] ✗ không module nào khớp \`--module "${chiMod}"\` trong danh sách chưa có rule.`);
    process.exit(2);
  }

  fs.mkdirSync(DIR, { recursive: true });
  for (const k of chon) {
    const f = path.join(DIR, `${k.id.toLowerCase()}.json`);
    fs.writeFileSync(f, `${JSON.stringify(k, null, 2)}\n`, 'utf8');
  }
  console.log(`\n[bootstrap] đã ghi ${chon.length}/${se.length} khung vào ${path.relative(REPO, DIR).split(path.sep).join('/')}`);
  console.log('  Bước tiếp: mang `todo` của từng khung đi hỏi BA, điền `rule`+`source`+`examples`, rồi `confirmed_by` + `status: active`.');
  console.log('  Chạy `npm run domain:index` sau khi chốt, và `npm run knowledge:backup` vì `knowledge/**` KHÔNG nạp lại được.');
  process.exit(0);
}

module.exports = { slug, khung, moduleTuBoTC };
if (require.main === module) main();
