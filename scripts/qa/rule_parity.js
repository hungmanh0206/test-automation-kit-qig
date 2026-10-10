#!/usr/bin/env node
'use strict';

/*
 * rule_parity.js — RÚT GỌN `core_rules.md` MÀ KHÔNG MẤT LUẬT NÀO.
 *
 * VÌ SAO CẦN MÁY NÀY. `.agent/rules/core_rules.md` auto-load MỌI phiên, nên nó là chỗ đắt nhất của kit:
 * đo 10/10/2026 là 16.935 byte, khoảng 4,5k token nhân với mọi lượt chạy. Rút gọn nó là nguồn cắt bù
 * chính của v2.5.0.
 *
 * Nhưng rút gọn một file luật là thao tác dễ mất mát nhất trong kit, và mất mát KHÔNG tự lộ ra: một luật
 * biến mất thì không gì đỏ, chỉ là vài tháng sau có người làm sai thứ mà kit từng cấm.
 *
 * HAI PHÉP KIỂM, và phép thứ hai mới là phép thật:
 *
 *   ① TÊN LUẬT không được biến mất. So tập tên với mốc đã chốt trong `.agent/config/rule_parity.json`.
 *      Đây là phép dễ, và nó KHÔNG đủ: giữ nguyên cái tên rồi xoá sạch nội dung vẫn qua được.
 *
 *   ② MỖI LUẬT PHẢI CÓ CON TRỎ GIẢI ĐƯỢC tới nơi giữ chi tiết. Rút gọn hợp lệ nghĩa là chi tiết CHUYỂN
 *      đi, không phải BIẾN MẤT. Nên con trỏ phải trỏ tới một thứ CÓ THẬT: một mục `§` có trong
 *      `RULE_GLOBAL.md`, hoặc một file có trên đĩa.
 *
 * MỘT CA ĐÃ GẶP NGAY LÚC DỰNG MÁY NÀY: luật "Lớp GENERIC vs PROJECT" KHÔNG có trong `RULE_GLOBAL.md`
 * (grep ra 0 lần). Chi tiết của nó sống ở `.agent/config/kit-layers.md`. Nếu phép kiểm chỉ chấp nhận con
 * trỏ `RULE_GLOBAL §…` thì nó sẽ ép người sửa đi bịa một mục không tồn tại — nên con trỏ tới FILE cũng
 * hợp lệ, miễn là file đó có thật.
 *
 * Dùng:
 *   node scripts/qa/rule_parity.js              # báo cáo
 *   node scripts/qa/rule_parity.js --lock       # chốt mốc tên luật hiện tại
 *   node scripts/qa/rule_parity.js --enforce    # CHẶN khi mất luật hoặc con trỏ hỏng
 * Exit: 0 đạt · 1 vi phạm · 2 dùng sai.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const CORE = path.join(REPO, '.agent', 'rules', 'core_rules.md');
const RG = path.join(REPO, 'RULE_GLOBAL.md');
const MOC = path.join(REPO, '.agent', 'config', 'rule_parity.json');
const CHARS_PER_TOK = 3.2;

const flag = (n) => process.argv.includes(`--${n}`);
const doc = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n?/g, '\n');

/** Mỗi luật là một gạch đầu dòng `- **Tên**: …`. Tên là khoá đối chiếu. */
function docLuat() {
  const out = [];
  for (const d of doc(CORE).split('\n')) {
    const m = d.match(/^- \*\*(.+?)\*\*/);
    if (!m) continue;
    out.push({ ten: m[1].trim(), dong: d, dai: d.length });
  }
  return out;
}

/** Tiêu đề mục có thật trong RULE_GLOBAL, đã bỏ dấu và thường hoá để so lỏng. */
function mucCua(text) {
  return new Set(
    [...text.matchAll(/^#{2,3} (.+)$/gm)]
      .map((m) => m[1].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()),
  );
}

/**
 * Con trỏ của một luật có giải được không.
 *
 * Hai dạng hợp lệ: `RULE_GLOBAL §<tên mục>` trỏ tới mục CÓ THẬT, hoặc một đường dẫn file CÓ THẬT.
 * Không nhận con trỏ trỏ vào hư không — đó đúng là cách một luật biến mất mà vẫn trông như còn.
 */
let _cayFile = null;
/** Tên file có thật ở bất kỳ đâu trong cây đã track. */
function tenFileCoThat(ten) {
  if (!_cayFile) {
    try {
      _cayFile = new Set(require('child_process')
        .execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' })
        .trim().split(/\r?\n/).map((x) => path.basename(x.trim())));
    } catch (e) { _cayFile = new Set(); }
  }
  return _cayFile.has(ten);
}

function conTro(dong, muc) {
  const ra = [];
  for (const m of dong.matchAll(/RULE_GLOBAL(?:\.md)?\s*§\s*"?([^.;)"]+)"?/g)) {
    const chu = m[1].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    /*
     * Bỏ phần ", mục N" ở đuôi trước khi so. Con trỏ kiểu `§5 trục, mục 9` trỏ vào MỤC CON của một section,
     * mà `rule_lookup` chỉ biết tới section. Bản đầu so cả đuôi nên báo hỏng 5 con trỏ ĐÚNG — một phép kiểm
     * báo oan thì người ta tắt nó, chứ không sửa theo nó.
     */
    const tu = chu.replace(/\s*muc\s+[0-9\s-]+$/, '').split(' ').filter((w) => w.length > 1);
    const khop = tu.length > 0 && [...muc].some((x) => tu.every((w) => x.includes(w)));
    ra.push({ loai: 'RULE_GLOBAL', chu: m[1].trim(), ok: khop });
  }
  for (const m of dong.matchAll(/`([a-zA-Z0-9_./-]+\.(?:md|json|js|ts))`/g)) {
    const f = m[1];
    /* Tìm theo ĐƯỜNG DẪN trước, rồi theo TÊN FILE trong cây đã track. Con trỏ trong core_rules hay ghi
     * tên trần (`02_gen_testcases.md`) chứ không ghi đường đầy đủ — bắt oan chúng là làm gate mất uy tín. */
    const co = fs.existsSync(path.join(REPO, f)) || tenFileCoThat(path.basename(f));
    ra.push({ loai: 'file', chu: f, ok: co });
  }
  return ra;
}

function main() {
  if (!fs.existsSync(CORE)) { console.error('[rule-parity] không thấy core_rules.md'); process.exit(2); }
  const luat = docLuat();
  const muc = mucCua(doc(RG));
  const tongKyTu = doc(CORE).length;

  if (flag('lock')) {
    fs.writeFileSync(MOC, `${JSON.stringify({
      _doc: 'MỐC tên luật của core_rules.md. `rule_parity --enforce` CHẶN khi một tên biến mất. '
        + 'Rút gọn được phép làm NGẮN nội dung, KHÔNG được phép làm mất luật.',
      _cach_chot_lai: 'node scripts/qa/rule_parity.js --lock — chỉ chạy khi CỐ Ý thêm hoặc bỏ một luật, và phải nói lý do trong commit.',
      _do_luc_chot: { ky_tu: tongKyTu, token_uoc: Math.round(tongKyTu / CHARS_PER_TOK), so_luat: luat.length },
      ten_luat: luat.map((x) => x.ten),
    }, null, 2)}\n`, 'utf8');
    console.log(`[rule-parity] đã chốt mốc — ${luat.length} luật · ${Math.round(tongKyTu / CHARS_PER_TOK)} token.`);
    return;
  }

  const loi = [];
  const canh = [];

  /* ① Mất luật so với mốc. */
  let moc = null;
  try { moc = JSON.parse(fs.readFileSync(MOC, 'utf8')); } catch (e) { moc = null; }
  if (!moc) {
    canh.push('chưa có `.agent/config/rule_parity.json` ⇒ phép kiểm "không mất luật" CHƯA ĐƯỢC GÁC. Chốt bằng `--lock`.');
  } else {
    const nay = new Set(luat.map((x) => x.ten));
    const mat = (moc.ten_luat || []).filter((t) => !nay.has(t));
    const them = [...nay].filter((t) => !(moc.ten_luat || []).includes(t));
    for (const t of mat) loi.push(`MẤT LUẬT: "${t}" có trong mốc nhưng không còn trong core_rules.md.`);
    for (const t of them) canh.push(`luật MỚI chưa có trong mốc: "${t}" — chốt lại mốc nếu cố ý.`);
  }

  /* ② Con trỏ phải giải được. Đây mới là phép kiểm thật. */
  for (const l of luat) {
    const ct = conTro(l.dong, muc);
    if (!ct.length) {
      loi.push(`KHÔNG CÓ CON TRỎ: "${l.ten}" — rút gọn mà không nói chi tiết nằm ở đâu thì luật đó biến mất.`);
      continue;
    }
    if (!ct.some((x) => x.ok)) {
      loi.push(`CON TRỎ HỎNG: "${l.ten}" trỏ tới ${ct.map((x) => `${x.loai}:${x.chu}`).join(', ')} — không cái nào có thật.`);
    }
  }

  console.log(`[rule-parity] ${luat.length} luật · ${tongKyTu} ký tự · ~${Math.round(tongKyTu / CHARS_PER_TOK)} token`);
  if (moc && moc._do_luc_chot) {
    const d = Math.round(tongKyTu / CHARS_PER_TOK) - moc._do_luc_chot.token_uoc;
    console.log(`  so với mốc: ${d > 0 ? '+' : ''}${d} token · ${luat.length - moc._do_luc_chot.so_luat >= 0 ? '+' : ''}${luat.length - moc._do_luc_chot.so_luat} luật`);
  }

  if (canh.length) {
    console.log(`\n[rule-parity] ⚠ ${canh.length} cảnh báo:`);
    canh.forEach((x) => console.log(`  - ${x}`));
  }
  if (loi.length) {
    console.error(`\n[rule-parity] ✗ ${loi.length} vi phạm:`);
    loi.forEach((x) => console.error(`  - ${x}`));
    if (flag('enforce')) process.exit(1);
    console.error('  (chưa --enforce nên KHÔNG chặn.)');
    return;
  }
  console.log('\n[rule-parity] ✓ ĐẠT — không mất luật, mọi con trỏ đều giải được.');
}

if (require.main === module) main();
module.exports = { docLuat, conTro };
