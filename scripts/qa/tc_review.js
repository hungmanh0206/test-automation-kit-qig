#!/usr/bin/env node
'use strict';

/*
 * tc_review.js — CHẤM CHẤT LƯỢNG bộ testcase theo rubric 8 tiêu chí, 0–2 điểm mỗi tiêu chí.
 *
 * VÌ SAO CÓ FILE NÀY. Kit đã có nhiều gate chặn từng lỗi rời rạc (Expected mơ hồ, step gộp range, thiếu tag
 * cách dựng), nhưng không chỗ nào trả lời được câu một người review hỏi đầu tiên: "bộ này dùng được chưa".
 * Thiếu câu đó thì chất lượng bộ TC là cảm nhận của người đọc gần nhất, và cảm nhận thì không so sánh được
 * giữa hai lượt, hai task, hai người.
 *
 * BA LUẬT NỀN, cả ba đều chống đúng một kiểu tự lừa:
 *
 *   ① TÁI DÙNG, KHÔNG VIẾT LẠI. Tiêu chí 2 (Expected đo được) và 4 (data cụ thể) gọi thẳng luật đang chạy ở
 *      `output_rules.js` và `validate.js`. Viết lại là có hai nguồn, và hai nguồn sẽ trôi khỏi nhau — lúc đó
 *      `tc:review` nói một đằng, `gate:gen-testcase` nói một nẻo, và không ai biết tin bên nào.
 *
 *   ② "MÁY KHÔNG PHÁN ĐƯỢC" KHÔNG PHẢI "ĐẠT". Tiêu chí nào máy chỉ đo được một phần thì phần còn lại ghi
 *      `AI` và để người hoặc agent chấm. Cộng điểm cho thứ chưa ai nhìn là cách nhanh nhất biến một máy
 *      chấm thành máy phát chứng chỉ.
 *
 *   ③ HAI TẦNG. Bộ chưa dùng quy ước mới (chưa có tag kỹ thuật) thì tiêu chí 8 ghi `n/a` và KHÔNG tính vào
 *      mẫu số, thay vì cho 0 điểm. Cho 0 điểm là phạt bộ cũ vì một luật ra đời sau nó.
 *
 * Dùng:
 *   npm run tc:review                    # chấm, in bảng, ghi reports/tc-review.md
 *   npm run tc:review:enforce            # thêm: dưới ngưỡng ⇒ exit 1
 * Exit: 0 đạt · 1 dưới ngưỡng (chỉ với --enforce) · 2 dùng sai hoặc không đọc được testcase.
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const canonical = require(path.resolve(__dirname, '..', 'lib', 'testcase'));
const rules = require(path.resolve(__dirname, 'lib', 'output_rules'));

const ENFORCE = process.argv.includes('--enforce');
const CFG = require(path.resolve(__dirname, '..', '..', '.agent', 'config', 'tc_review.json'));

/* ── Đọc bộ testcase canonical ───────────────────────────────────────────────────────────────────── */
const taskDir = rc.getTaskOutputDir({});
const tests = (() => {
  try {
    // Một nguồn: cùng hàm mà bug_tc_matcher / dim:coverage / learn_task đang dùng. Tự ghép đường dẫn
    // tay là lại có hai định nghĩa "thư mục testcase", rồi hai bên trôi khỏi nhau.
    const dirs = rc.getTestcaseDirs(taskDir);
    const out = [];
    for (const d of dirs) {
      if (!fs.existsSync(d)) continue;
      for (const f of fs.readdirSync(d)) {
        if (!f.endsWith('.md')) continue;
        const doc = canonical.parseMarkdown(fs.readFileSync(path.join(d, f), 'utf8'));
        if (doc && doc.tests) out.push(...doc.tests);
      }
    }
    return out;
  } catch (e) {
    console.error(`[tc-review] không đọc được testcase canonical: ${e.message}`);
    return [];
  }
})();

if (!tests.length) {
  console.error('[tc-review] ✗ 0 testcase đọc được — chưa có bộ nào để chấm. Chạy Phase 1 trước.');
  process.exit(2);
}

/* ── Tám tiêu chí ────────────────────────────────────────────────────────────────────────────────── */

/** Động từ mệnh lệnh hay mở đầu một hành động — dùng để phát hiện step gộp nhiều việc. */
const DONG_TU = /\b(mở|bấm|nhấn|nhập|chọn|xoá|xóa|sửa|lưu|ghi|tải|gửi|kiểm|đóng|kéo|tick|bỏ tick|đăng nhập|đăng xuất)\b/gi;
/** Actor chung chung — A cấm đúng mấy chữ này, và cấm có lý: "Người dùng" không nói được ai có quyền gì. */
const ACTOR_CHUNG = /\b(người dùng|nguoi dung|user|tester|qa|admin nào đó|ai đó)\b/i;
/** Dấu hiệu case phụ thuộc case khác chạy trước. */
const PHU_THUOC = /\b(sau khi (chạy|thực hiện) (tc|case)|tiếp theo tc|dùng kết quả (của )?tc|như tc)\b/i;
/** Data còn placeholder chưa điền. */
const PLACEHOLDER = /(<[^>]{2,}>|\bXXX+\b|\bTBD\b|\bN\/A\b|\bchưa rõ\b|\bđiền sau\b)/i;

/**
 * Chấm một case. Trả `{ diem, toiDa, chiTiet[] }`.
 * Mỗi tiêu chí trả `{ ma, diem, toiDa, ai, vi_pham }` — `ai: true` nghĩa là máy mới đo được một phần.
 */
function cham(tc, boDaDungKyThuat) {
  const ct = [];
  const buoc = Array.isArray(tc.steps) ? tc.steps : [];
  const expected = String(tc.expectedRaw || '');
  const tien = String(tc.precondition || '');
  const data = String(tc.data || '');

  // ① RÕ RÀNG — step đánh số, mỗi step một hành động.
  {
    const gopRange = rules.hasRangeGrouping(tc.stepsRaw);
    const gopHanhDong = buoc.filter((b) => (String(b).match(DONG_TU) || []).length >= 3);
    let d = 2;
    const vp = [];
    if (!buoc.length) { d = 0; vp.push('không có bước nào'); }
    if (gopRange) { d = 0; vp.push('gộp range (vd `1-2.`)'); }
    if (gopHanhDong.length) {
      d = Math.min(d, 1);
      vp.push(`${gopHanhDong.length} bước gộp từ 3 hành động trở lên: "${String(gopHanhDong[0]).slice(0, 60)}"`);
    }
    ct.push({ ma: '1-ro-rang', diem: d, toiDa: 2, ai: false, vi_pham: vp });
  }

  // ② EXPECTED ĐO ĐƯỢC — TÁI DÙNG luật đang chạy, không viết lại.
  {
    const mo = rules.vagueExpectedLines(expected);
    const tauto = rules.looksTautology(expected);
    let d = 2;
    const vp = [];
    if (!expected.trim()) { d = 0; vp.push('Kết quả mong đợi RỖNG'); }
    else if (mo.length) { d = 0; vp.push(`${mo.length} dòng chung chung: "${mo[0].slice(0, 60)}"`); }
    if (tauto) { d = Math.min(d, 1); vp.push('có dấu hiệu tautology (app==app)'); }
    ct.push({ ma: '2-expected-do-duoc', diem: d, toiDa: 2, ai: false, vi_pham: vp });
  }

  // ③ ĐỘC LẬP — có tag cách dựng, và không tham chiếu case khác.
  {
    const coTag = /^\s*\[(api|factory|test_hook|ui|pre_existing|manual)\]/i.test(tien);
    const phuThuoc = PHU_THUOC.test(tien) || PHU_THUOC.test(String(tc.stepsRaw || ''));
    let d = 2;
    const vp = [];
    if (!tien.trim()) { d = 0; vp.push('Tiền điều kiện rỗng'); }
    else if (!coTag) { d = Math.min(d, 1); vp.push('Tiền điều kiện thiếu tag cách dựng'); }
    if (phuThuoc) { d = 0; vp.push('phụ thuộc case khác chạy trước'); }
    ct.push({ ma: '3-doc-lap', diem: d, toiDa: 2, ai: false, vi_pham: vp });
  }

  // ④ DATA CỤ THỂ.
  {
    const ph = data.match(PLACEHOLDER);
    let d = 2;
    const vp = [];
    if (ph) { d = 0; vp.push(`còn placeholder: "${ph[0]}"`); }
    ct.push({ ma: '4-data-cu-the', diem: d, toiDa: 2, ai: false, vi_pham: vp });
  }

  // ⑤ TRUY VẾT — oracle-ref, KHÔNG phải "cột REQ ID" như gói nguồn.
  {
    const refs = tc.oracleRefs || [];
    const d = refs.length ? 2 : 0;
    ct.push({
      ma: '5-truy-vet',
      diem: d,
      toiDa: 2,
      ai: false,
      vi_pham: refs.length ? [] : ['không có oracle-ref (`BR-`/`SM-`/`UI-`) để truy ngược về rule'],
    });
  }

  // ⑥ ĐÚNG TRỌNG TÂM — máy chỉ bắt được dấu hiệu thô, phần còn lại AI chấm.
  {
    const title = String(tc.title || '');
    const haiHanhVi = /\bvà\b.*\bvà\b/i.test(title) || /;/.test(title);
    const vp = [];
    let d = 2;
    if (haiHanhVi) { d = 1; vp.push('tiêu đề có dấu hiệu gộp nhiều hành vi'); }
    ct.push({ ma: '6-dung-trong-tam', diem: d, toiDa: 2, ai: true, vi_pham: vp });
  }

  // ⑦ ACTOR + CONTEXT đọc từ `Tiền điều kiện` — KHÔNG thêm cột.
  {
    const vp = [];
    let d = 2;
    if (ACTOR_CHUNG.test(tien)) {
      d = 0;
      vp.push(`actor chung chung trong Tiền điều kiện: "${(tien.match(ACTOR_CHUNG) || [])[0]}"`);
    } else if (!/vai trò|role|đăng nhập|tài khoản|quyền/i.test(tien)) {
      d = 1;
      vp.push('Tiền điều kiện không nêu được AI thao tác');
    }
    ct.push({ ma: '7-actor-context', diem: d, toiDa: 2, ai: true, vi_pham: vp });
  }

  // ⑧ KỸ THUẬT — dùng kết quả H1. Bộ chưa dùng quy ước thì n/a, KHÔNG cho 0 điểm.
  {
    const ks = tc.techniques || [];
    if (!boDaDungKyThuat) {
      ct.push({ ma: '8-ky-thuat', diem: null, toiDa: 0, ai: false, vi_pham: ['n/a — bộ chưa dùng tag kỹ thuật'] });
    } else {
      ct.push({
        ma: '8-ky-thuat',
        diem: ks.length ? 2 : 0,
        toiDa: 2,
        ai: false,
        vi_pham: ks.length ? [] : ['thiếu tag kỹ thuật, trong khi bộ này đã dùng quy ước'],
      });
    }
  }

  const diem = ct.reduce((s, c) => s + (c.diem == null ? 0 : c.diem), 0);
  const toiDa = ct.reduce((s, c) => s + c.toiDa, 0);
  return { diem, toiDa, chiTiet: ct };
}

/* ── Chạy ────────────────────────────────────────────────────────────────────────────────────────── */
const boDaDungKyThuat = tests.some((t) => (t.techniques || []).length);
const ketQua = tests.map((tc) => ({ tc, ...cham(tc, boDaDungKyThuat) }));

/** Xếp loại theo TỈ LỆ, không theo điểm tuyệt đối — mẫu số đổi khi tiêu chí 8 là n/a. */
const xepLoai = (r) => {
  const ti = r.toiDa ? r.diem / r.toiDa : 0;
  if (ti >= CFG.nguong.tot) return 'tốt';
  if (ti >= CFG.nguong.can_sua) return 'cần sửa';
  return 'viết lại';
};

const duoiNguong = ketQua.filter((r) => (r.toiDa ? r.diem / r.toiDa : 0) < CFG.nguong.can_sua);
const tbTiLe = ketQua.reduce((s, r) => s + (r.toiDa ? r.diem / r.toiDa : 0), 0) / ketQua.length;

/* ── Trùng lặp: cùng bước + cùng data ────────────────────────────────────────────────────────────── */
const gon = (x) => String(x || '').replace(/\s+/g, ' ').trim().toLowerCase();
const theoVanTay = new Map();
for (const r of ketQua) {
  const k = `${gon(r.tc.stepsRaw)}|${gon(r.tc.data)}`;
  if (!k.replace('|', '')) continue;
  if (!theoVanTay.has(k)) theoVanTay.set(k, []);
  theoVanTay.get(k).push(r.tc.tcId || '(no-id)');
}
const trung = [...theoVanTay.values()].filter((v) => v.length > 1);

/* ── In ──────────────────────────────────────────────────────────────────────────────────────────── */
console.log(`[tc-review] ${tests.length} testcase · trung bình ${(tbTiLe * 100).toFixed(1)}% `
  + `· ngưỡng "cần sửa" ${(CFG.nguong.can_sua * 100).toFixed(0)}%`);
if (!boDaDungKyThuat) {
  console.log('[tc-review] tiêu chí 8 (kỹ thuật) = n/a: bộ chưa dùng tag kỹ thuật, KHÔNG tính vào mẫu số.');
}
for (const r of duoiNguong.slice(0, 15)) {
  const loi = r.chiTiet.filter((c) => c.vi_pham.length && c.diem !== null && c.diem < c.toiDa);
  console.log(`[tc-review] ✗ ${r.tc.tcId || '(no-id)'} ${r.diem}/${r.toiDa} (${xepLoai(r)}) — `
    + loi.map((c) => `${c.ma}: ${c.vi_pham[0]}`).join(' · ').slice(0, 150));
}
if (duoiNguong.length > 15) console.log(`[tc-review]   … và ${duoiNguong.length - 15} case nữa`);
if (trung.length) console.log(`[tc-review] ⚠ ${trung.length} nhóm TC TRÙNG (cùng bước + cùng data): `
  + trung.slice(0, 3).map((g) => g.join('≡')).join(' · '));

/* ── Ghi report ──────────────────────────────────────────────────────────────────────────────────── */
const reportDir = path.join(taskDir, 'reports');
fs.mkdirSync(reportDir, { recursive: true });
const md = [];
md.push('# Review chất lượng bộ testcase');
md.push('');
md.push(`Sinh bằng \`npm run tc:review\`. ${tests.length} case, trung bình **${(tbTiLe * 100).toFixed(1)}%**.`);
md.push('');
md.push('> Tiêu chí đánh dấu `AI` là chỗ máy mới đo được một phần. Phần còn lại người hoặc agent chấm.');
md.push('> **Không cộng "máy không phán được" thành đạt** — làm thế là biến máy chấm thành máy phát chứng chỉ.');
md.push('');
md.push('| TC ID | Điểm | Xếp loại | Chưa đạt ở đâu |');
md.push('|---|---|---|---|');
for (const r of ketQua) {
  const loi = r.chiTiet.filter((c) => c.vi_pham.length && c.diem !== null && c.diem < c.toiDa)
    .map((c) => `${c.ma}: ${c.vi_pham.join('; ')}`).join('<br>') || '—';
  md.push(`| ${r.tc.tcId || '(no-id)'} | ${r.diem}/${r.toiDa} | ${xepLoai(r)} | ${loi} |`);
}
if (trung.length) {
  md.push('');
  md.push('## TC trùng (cùng bước + cùng dữ liệu) — cân nhắc gộp');
  for (const g of trung) md.push(`- ${g.join(' ≡ ')}`);
}
const outPath = path.join(reportDir, 'tc-review.md');
fs.writeFileSync(outPath, `${md.join('\n')}\n`, 'utf8');
console.log(`[tc-review] đã ghi ${path.relative(rc.REPO_ROOT, outPath)}`);

if (ENFORCE && duoiNguong.length) {
  console.error(`[tc-review] ✗ CHẶN: ${duoiNguong.length} case dưới ngưỡng "cần sửa". Sửa rồi chạy lại.`);
  process.exit(1);
}
if (ENFORCE && tbTiLe < CFG.nguong.trung_binh_bo) {
  console.error(`[tc-review] ✗ CHẶN: trung bình bộ ${(tbTiLe * 100).toFixed(1)}% `
    + `< ngưỡng ${(CFG.nguong.trung_binh_bo * 100).toFixed(0)}%.`);
  process.exit(1);
}
console.log('[tc-review] ✓ ĐẠT');
