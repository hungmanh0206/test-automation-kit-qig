#!/usr/bin/env node
'use strict';

/*
 * design_gate.js (G5 — round-3) — Gate CHẤT LƯỢNG THIẾT KẾ testcase (Phase 1), THỰC THI.
 *
 * Biến `tc_validator` (SKILL agent-gọi, bỏ được) thành check máy-chặn cho phần CHƯA được ép ở nơi khác:
 *   - STRUCTURAL : bảng testcase phải đủ cột canonical (thiếu/đổi tên cột = CHẶN → downstream vỡ).
 *   - COMPLETENESS: mỗi TC không được rỗng ô lõi (Module/Trường hợp/Các bước/Ưu tiên/Mức độ rủi ro) = CHẶN.
 *   - VALUE      : Ưu tiên ∈ 5 priority Backlog · Mức độ rủi ro ∈ High|Medium|Low = CHẶN (bug lấy Priority TỪ cột này;
 *                  risk:gate ép độ sâu theo cột kia — giá trị lạ bị bỏ qua âm thầm). 2 cột nói ngược nhau = cảnh báo.
 *   - DIMENSION  : bộ testcase nên có ≥1 case [Negative]; High-risk nên có [Boundary]/[Security] = cảnh báo.
 * KHÔNG viết lại phần đã có: row-quality/oracle → output_gate (--mode gen-testcase); depth/dimension
 * per-module theo risk band → risk_gate (npm run risk:gate:enforce). design_gate ĐIỀU PHỐI + bổ khuyết.
 *
 * Dùng: node scripts/qa/design_gate.js --file <testcase.md> [--dir test-cases/] [--with-rows] [--publish] [--qa-approved]
 *       node scripts/qa/design_gate.js --mode checklist --file <checklist.md>
 *
 * `--mode checklist`: gate 4 tiêu chí cho CHECKLIST RÀ TAY (sub-mode của `05_manual_quick.md`).
 * Checklist KHÔNG phải bộ testcase — 7 cột khác hẳn, không Tiền điều kiện, không Các bước — nên nó có
 * parser riêng ở `lib/checklist.js`. Nhưng bộ từ "kỳ vọng chung chung" thì DÙNG LẠI của output_rules,
 * vì hai danh sách từ cấm là hai danh sách lệch nhau.
 *
 * `--publish`: bật các luật CHỈ áp lúc đẩy ra ngoài. Hiện có một luật — còn `[NeedsVerify]` là CHẶN.
 * Tag đó sinh ra để tồn tại TRONG LÚC Phase 1 chạy (người viết thừa nhận chưa có bằng chứng), nên
 * chặn nó từ sớm là cấm người ta thừa nhận, và họ sẽ gỡ tag thay vì đi tìm bằng chứng. Nhưng lên
 * Sheet rồi thì cả đội đọc nó như một khẳng định chắc chắn — nên cửa đặt đúng ở đây.
 *   --with-rows: chạy kèm output_gate gen-testcase (row-quality/oracle) để ra 1 báo cáo Phase-1 đầy đủ.
 * Exit: 0 = đạt (hoặc --qa-approved) · 1 = có CHẶN · 2 = lỗi dùng sai.
 */

const fs = require('fs');
const path = require('path');
const outputGate = require(path.resolve(__dirname, 'output_gate'));
const testcaseModel = require(path.resolve(__dirname, '..', 'lib', 'testcase')); // #1: parser canonical DUY NHẤT
const engine = require(path.resolve(__dirname, 'lib', 'gate_engine'));
/* `--compact`: in gọn mỗi vi phạm một dòng `MÃ · TC ID · ý chính`. Lớp TRÌNH BÀY, không lọc.
 * Phạm vi MODULE chứ không trong `main()`: nhánh `chayChecklist` cũng dùng, và khai trong main là
 * ReferenceError lúc chạy nhánh đó. Lint bắt được lần này; lần sau thì chưa chắc. */
const COMPACT = process.argv.includes('--compact');

// #1 (formalize): gateDesign DELEGATE canonical.validate (structural + completeness + dimension) —
// KHÔNG còn giữ logic riêng. validate() là superset đã dựng ở #1 GĐ1a; 1 nguồn kiểm thiết kế.
function gateDesign(md) {
  const doc = testcaseModel.parseMarkdown(md);
  if (!doc.tests.length) return { found: false, problems: [], warnings: [], rowCount: 0 };
  const { problems, warnings } = testcaseModel.validate(doc);
  return { found: true, problems, warnings, rowCount: doc.tests.length };
}

function runFile(file, { withRows }) {
  const md = fs.readFileSync(file, 'utf8');
  const base = path.basename(file);
  const d = gateDesign(md);
  if (!d.found) { console.log(`[design] ${base}: không thấy bảng testcase 9 cột — bỏ qua.`); return { problems: [], warnings: [], rowCount: 0, found: false }; }
  const problems = d.problems.map((p) => `${base} · ${p}`);
  const warnings = d.warnings.map((p) => `${base} · ${p}`);
  // Điều phối: chạy kèm row-quality/oracle của output_gate (không viết lại).
  if (withRows) {
    const parsed = outputGate.parseTestcaseTable(md);
    for (const r of parsed.rows) {
      const g = outputGate.gateTestcaseRow(r);
      g.problems.forEach((p) => problems.push(`${base} · [row] ${p}`));
      g.warnings.forEach((p) => warnings.push(`${base} · [row] ${p}`));
    }
  }
  return { problems, warnings, rowCount: d.rowCount, found: true };
}

/*
 * Nhánh CHECKLIST. Tách hẳn khỏi nhánh testcase thay vì nhồi `if` vào giữa: hai nhánh đọc hai khuôn bảng
 * khác nhau và in hai bộ nhắc khác nhau, trộn vào nhau thì mỗi lần sửa một bên lại phải đọc cả hai.
 */
function chayChecklist(files, { QA_APPROVED }) {
  const checklist = require(path.resolve(__dirname, 'lib', 'checklist'));
  const problems = []; const warnings = []; let itemCount = 0; let fileCount = 0; const loai = [];
  for (const f of files) {
    if (!fs.existsSync(f)) { console.error(`[design] không thấy: ${f}`); continue; }
    const base = path.basename(f);
    const r = checklist.gateChecklistFile(f);
    if (!r.found) { console.log(`[design] ${base}: không thấy tiêu đề "## … Checklist …" — bỏ qua.`); continue; }
    fileCount++; itemCount += r.itemCount;
    if (r.type) loai.push(`${base}: ${r.type.ten} (${r.itemCount}/${r.type.min}-${r.type.max} mục)`);
    r.problems.forEach((p) => problems.push(`${base} · ${p}`));
    r.warnings.forEach((p) => warnings.push(`${base} · ${p}`));
  }

  console.log(`[design] mode CHECKLIST — ${fileCount} file · ${itemCount} mục · ${problems.length} CHẶN · ${warnings.length} cảnh báo.`);
  loai.forEach((l) => console.log(`  · ${l}`));
  if (warnings.length) {
    console.log('\n[design] ⚠ Cảnh báo (nên sửa, không chặn):');
    if (COMPACT) engine.inGon(warnings, { nhan: '~' });
    else { warnings.slice(0, 40).forEach((p) => console.log(`  ~ ${p}`)); if (warnings.length > 40) console.log(`  … +${warnings.length - 40} nữa`); }
  }
  if (!problems.length) {
    if (!fileCount) { console.log('\n[design] không có checklist nào để kiểm.'); process.exit(0); }
    console.log('\n[design] ✓ ĐẠT — 4 tiêu chí checklist: verify được · luồng sống còn có P1 · component khai đủ · đúng quy mô.');
    process.exit(0);
  }
  console.log('\n[design] ✗ VI PHẠM CHẶN (checklist chưa dùng được để rà tay):');
  problems.forEach((p) => console.log(`  - ${p}`));
  console.log('\n  Nhắc: khuôn checklist và 4 tiêu chí ở `prompt_templates/phase1/05_manual_quick.md`; ngưỡng số mục ở `.agent/config/checklist_types.json`.');
  if (QA_APPROVED) { console.log('\n[design] [--qa-approved] bỏ qua → exit 0 (đã log).'); process.exit(0); }
  console.log('\n[design] BLOCK.');
  process.exit(1);
}

function main() {
  const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
  const has = (n) => process.argv.includes(`--${n}`);
  const FILE = arg('file', ''); const DIR = arg('dir', ''); const WITH_ROWS = has('with-rows'); const QA_APPROVED = has('qa-approved');
  const PUBLISH = has('publish');

  const MODE = arg('mode', 'testcase');
  if (MODE !== 'testcase' && MODE !== 'checklist') {
    console.error(`[design] --mode lạ: "${MODE}". Chỉ nhận "testcase" (mặc định) hoặc "checklist".`);
    process.exit(2);
  }

  let files = [];
  if (FILE) files = [FILE];
  else if (DIR) { try { files = fs.readdirSync(DIR).filter((f) => f.endsWith('.md')).map((f) => path.join(DIR, f)); } catch (e) { console.error(`[design] đọc --dir lỗi: ${e.message}`); process.exit(2); } }
  else { console.error('[design] cần --file <testcase.md> hoặc --dir <test-cases/>'); process.exit(2); }

  if (MODE === 'checklist') { chayChecklist(files, { QA_APPROVED }); return; }

  const problems = []; const warnings = []; let rowCount = 0; let fileCount = 0;
  for (const f of files) {
    if (!fs.existsSync(f)) { console.error(`[design] không thấy: ${f}`); continue; }
    const r = runFile(f, { withRows: WITH_ROWS });
    if (r.found) fileCount++;
    rowCount += r.rowCount; problems.push(...r.problems); warnings.push(...r.warnings);
  }

  // XOÁ BẢN GHI — nhắc chiều "bền vững dữ liệu" (§13b), mức CẢNH BÁO.
  // Case xoá là chỗ UI/API mù nhất: sau khi xoá thì màn hết thấy và `GET` trả 404 — GIỐNG HỆT NHAU dù là
  // soft-delete (bản ghi còn, chỉ set cờ) hay hard-delete, và bản ghi con mồ côi thì màn cha không hiển thị.
  // Chỉ CẢNH BÁO chứ không chặn: công cụ không biết được case này có thật sự cần xuống tầng bản ghi hay không
  // (nhiều "xoá" chỉ là gỡ item khỏi form, chưa chạm DB). Đo 12/08/2026: 11/17 bộ có case xoá thật, cả 11 đều
  // chưa dùng `db_readonly` lần nào — nên đây là nhắc-một-lần-mỗi-bộ, không phải tiếng ồn theo từng dòng.
  // CỐ Ý loại "huỷ/cancel": trong các bộ này phần lớn là chuyển TRẠNG THÁI (huỷ đơn, huỷ phép), không phải xoá.
  {
    let delRows = 0; let hasDbCheck = false;
    for (const f of files) {
      if (!fs.existsSync(f)) continue;
      const txt = fs.readFileSync(f, 'utf8');
      if (/db_readonly/i.test(txt)) hasDbCheck = true;
      delRows += (txt.split(/\r?\n/).filter((l) => /^\|\s*[A-Z][A-Z0-9_]*_TC_/.test(l) && /xoá|xóa|\bdelete\b|\bremove\b/i.test(l))).length;
    }
    if (delRows && !hasDbCheck) {
      warnings.push(`Bộ có ${delRows} case XOÁ bản ghi nhưng KHÔNG case nào kiểm ở tầng bản ghi (\`db_readonly: SELECT …\`). Sau khi xoá, UI hết thấy và GET trả 404 y hệt nhau dù là soft-delete hay hard-delete, và bản ghi con mồ côi thì màn cha không hiển thị. Xem prompt gen §13b (5 tình huống cần, kèm ranh giới: read-only, không dựng state, không phải evidence). Nếu đã cân nhắc và không cần thì bỏ qua dòng này.`);
    }
  }

  // UI CATALOG — bộ có case hiển thị thì phải có artifact kiểm kê field/cột, không chỉ có case bằng chữ.
  // Vì sao chặn: đây là thứ DUY NHẤT bắt được "màn thiếu một trường" / "mọc thêm cột lạ" / "hai màn lệch nhãn"
  // — case theo bước không thấy vì thiếu field thì mọi step vẫn xanh. Một bộ 530 case thật đã có đủ mục
  // Display Conformance trong prompt mà vẫn để lọt cả cụm bug loại này, chính vì không ai dựng catalog.
  // Legacy/ngoại lệ: --no-catalog (phải nêu lý do ở report), hoặc --qa-approved.
  if (!has('no-catalog') && !QA_APPROVED) {
    const DISPLAY = /hiển thị|hien thi|format|định dạng|dinh dang|\blabel\b|cột |cot |placeholder|tooltip|empty[- ]state|tiêu đề|tieu de/i;
    let display = 0; let taskDir = '';
    for (const f of files) {
      if (!fs.existsSync(f)) continue;
      if (!taskDir) {
        const m = path.resolve(f).split(path.sep);
        const i = m.lastIndexOf('test-cases');
        if (i > 0) taskDir = m.slice(0, i).join(path.sep);
      }
      try {
        const doc = testcaseModel.parseMarkdown(fs.readFileSync(f, 'utf8'));
        display += ((doc && doc.tests) || []).filter((t) => DISPLAY.test(`${t.title || ''} ${t.expected || ''}`)).length;
      } catch (e) { /* file không parse được đã báo ở trên */ }
    }
    if (display && taskDir) {
      const cat = path.join(taskDir, 'requirements', 'ui_catalog.json');
      if (!fs.existsSync(cat)) {
        problems.push(`Bộ có ${display} case hiển thị nhưng THIẾU \`requirements/ui_catalog.json\` — không có kiểm kê field/cột thì thiếu-trường/thừa-cột/lệch-nhãn giữa 2 màn KHÔNG BAO GIỜ lộ ra (mọi step vẫn xanh). Dựng catalog theo schema \`scripts/qa/ui_conformance_check.js\` (table.expectedColumns + fields[] mỗi section), rồi Phase 2 chạy \`node scripts/qa/ui_conformance_check.js --catalog <file>\`. Task cũ/không áp dụng: chạy kèm \`--no-catalog\` và nêu lý do trong report.`);
      } else {
        try {
          const c = JSON.parse(fs.readFileSync(cat, 'utf8'));
          const screens = Array.isArray(c.screens) ? c.screens : [];
          if (!screens.length) problems.push('`requirements/ui_catalog.json` có nhưng `screens` RỖNG — catalog rỗng không kiểm được gì.');
          else {
            const noInv = screens.filter((s) => !(s.table && (s.table.expectedColumns || []).length) && !((s.fields || []).length));
            if (noInv.length) warnings.push(`${noInv.length}/${screens.length} màn trong ui_catalog chưa khai \`table.expectedColumns\` lẫn \`fields[]\` (chỉ có texts/tokens) → chưa kiểm kê được tập field: ${noInv.slice(0, 3).map((s) => s.name || '?').join(', ')}`);
          }
        } catch (e) { problems.push(`\`requirements/ui_catalog.json\` lỗi JSON: ${e.message}`); }
      }
    }
  }

  /*
   * --publish: nâng cảnh báo [NeedsVerify] thành CHẶN.
   *
   * Tag đó sinh ra để tồn tại TRONG LÚC Phase 1 chạy — nó là cách người viết thừa nhận "chỗ này tôi chưa
   * có bằng chứng". Chặn từ sớm là cấm người ta thừa nhận, và họ sẽ GỠ TAG thay vì đi tìm bằng chứng, tức
   * mất luôn tín hiệu. Nhưng lên Sheet rồi thì cả đội đọc case như một khẳng định chắc chắn, nên cửa đặt
   * đúng ở ranh giới publish.
   */
  if (PUBLISH) {
    const canXac = warnings.filter((w) => /NeedsVerify/.test(w));
    for (const w of canXac) problems.push(w.replace(/^/, '[publish] '));
  }

  console.log(`[design] ${fileCount} file · ${rowCount} testcase · ${problems.length} CHẶN · ${warnings.length} cảnh báo${WITH_ROWS ? ' (kèm row-quality)' : ''}.`);
  if (warnings.length) {
    console.log('\n[design] ⚠ Cảnh báo (nên sửa, không chặn):');
    if (COMPACT) engine.inGon(warnings, { nhan: '~' });
    else { warnings.slice(0, 40).forEach((p) => console.log(`  ~ ${p}`)); if (warnings.length > 40) console.log(`  … +${warnings.length - 40} nữa`); }
  }
  if (!problems.length) { console.log('\n[design] ✓ ĐẠT — đủ cột canonical, không rỗng ô lõi.'); process.exit(0); }

  console.log('\n[design] ✗ VI PHẠM CHẶN (thiết kế testcase dở — sửa rồi chạy lại):');
  if (COMPACT) engine.inGon(problems, { nhan: '-' });
  else problems.forEach((p) => console.log(`  - ${p}`));
  console.log('\n  Nhắc: đủ 8 cột canonical (TC ID/Module/Trường hợp/Tiền điều kiện/Các bước/Kết quả mong đợi/Ưu tiên/Mức độ rủi ro); không rỗng ô lõi. Depth per-module: risk:gate:enforce.');
  if (QA_APPROVED) { console.log('\n[design] [--qa-approved] bỏ qua → exit 0 (đã log).'); process.exit(0); }
  console.log('\n[design] BLOCK.');
  process.exit(1);
}

module.exports = { gateDesign };

if (require.main === module) main();
