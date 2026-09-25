#!/usr/bin/env node
'use strict';

/*
 * scope_anchor.js — NEO MẪU SỐ của Phase 1.
 *
 * VÌ SAO CÓ FILE NÀY (đo trên task thật CSDL-3544, 25/09/2026): Phase 1 có ba con số quyết định "thế nào
 * là đủ", và cả ba đều do CHÍNH AGENT viết ra, rồi gate lấy chính nó làm chuẩn để chấm:
 *   1. `dimension_manifest.json` — agent khai 10 chiều `required`, 10 chiều `n/a` ⇒ `dim:coverage --enforce`
 *      báo "10/10 đạt". `dimension_coverage.js` đã lường trước và ghi rõ "chỉ CHẶN theo manifest do NGƯỜI
 *      khai", nhưng không máy nào kiểm được rằng người đã khai — nên thực tế agent tự khai.
 *   2. "Tổng requirement in-scope = 12" trong `phase1-summary.md` — agent tự đếm ⇒ coverage 10/12 = 83,3%.
 *      Nếu số thật là 30 thì coverage là 33%, và KHÔNG gì trong kit phát hiện được.
 *   3. `ui_catalog.json` — dựng từ ảnh chụp build, trong khi `run_phase1_template.md` §2b CẤM đúng việc đó
 *      (oracle tautological).
 *
 * TRIỆU CHỨNG NGƯỜI DÙNG THẤY: Phase 1 sinh 50 case, QA đọc thấy thiếu, yêu cầu rà lại ⇒ lượt sau ra nhiều
 * hơn hẳn. Không phải lượt sau giỏi hơn — là lượt đầu KHÔNG CÓ GÌ NEO nên dừng ở chỗ nó thấy hợp lý. Khi
 * người review là gate duy nhất có thật, số case là hàm của việc QA đẩy lại mấy lần, không phải hàm của spec.
 *
 * GATE NÀY KHÔNG đếm hộ case và KHÔNG tự quyết phạm vi — đoán phạm vi hộ thì sai một lần là mất uy tín
 * (cùng lý lẽ đã ghi trong `dimension_coverage.js`). Nó kiểm XUẤT XỨ của mẫu số:
 *   - mỗi quyết định THU HẸP phạm vi (`n/a`) có lý do và có người ký chưa?
 *   - con số mẫu số có danh mục liệt kê từng mục kèm NGUỒN không?
 *   - catalog expected lấy từ tài liệu hay lấy từ build?
 *   - lượt này so lượt trước: số case đổi mà danh mục KHÔNG đổi ⇒ lượt trước đã sinh thiếu.
 * Thiếu neo thì không được kết luận PASS — con số vẫn in ra, nhưng phải mang nhãn "chưa neo".
 *
 * Dùng:
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/qa/scope_anchor.js
 *   ... --enforce      # có vấn đề CHẶN ⇒ exit 1
 *   ... --record       # ghi sổ lượt này vào requirements/.scope_ledger.json (để lượt sau so delta)
 *   ... --init         # in sẵn khung scope_inventory.md để dán (không đè file đã có)
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const canonical = require(path.resolve(__dirname, '..', 'lib', 'testcase'));

const has = (n) => process.argv.includes(`--${n}`);
const ENFORCE = has('enforce');

/* Ngưỡng delta: dưới mức này coi là chỉnh sửa lặt vặt, trên mức này là "bộ case đổi bản chất".
 * 10% chọn theo ca thật: 50 -> 60 case là +20%, đúng loại nhảy mà QA phát hiện bằng mắt. */
const DELTA_PCT = 0.1;

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };
const readText = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };

/* Giá trị "có vẻ đã điền nhưng thực ra chưa" — placeholder là cách dễ nhất để lách một trường bắt buộc. */
const PLACEHOLDER = /^(|-+|n\/?a|tbd|todo|\?+|<[^>]*>|\[[^\]]*\]|xxx+|agent|claude|ai|auto)$/i;
const isFilled = (v) => typeof v === 'string' && v.trim() !== '' && !PLACEHOLDER.test(v.trim());

/**
 * Đọc MỌI bảng Markdown có cột "Nguồn" → danh mục phạm vi (danh mục thật hay chia nhiều bảng theo
 * loại mục). Bảng không có cột "Nguồn" bị bỏ qua — nhờ vậy bảng "đã cân nhắc và loại" không bị đếm nhầm
 * thành mục trong phạm vi.
 * Khuôn cố ý tối giản (ID | Mục | Nguồn) để người viết tay được trong vài phút; nếu bắt khai JSON thì
 * không ai khai, và một danh mục không ai viết thì vô dụng hơn một danh mục thô.
 * @returns {{rows: {id:string,item:string,source:string}[], hasTable: boolean}}
 */
function parseInventory(md) {
  const lines = String(md || '').split(/\r?\n/);
  const rows = [];
  let cols = null;
  let sawTable = false;   // cols bị reset ở cuối mỗi bảng, nên không dùng nó để trả lời "file có bảng không"
  for (const ln of lines) {
    // Hết một bảng KHÔNG có nghĩa hết danh mục: danh mục thật hay chia nhiều bảng theo loại mục
    // (mã chức năng · business rule · khối field · chuỗi phụ thuộc…). Dừng ở bảng đầu là ĐẾM THIẾU, và một
    // gate đếm thiếu sẽ báo 'lệch mẫu số' oan — mất uy tín ngay lượt đầu. Đóng bảng rồi đọc tiếp.
    if (!ln.trim().startsWith('|')) { cols = null; continue; }
    const cells = ln.split('|').slice(1, -1).map((c) => c.trim());
    if (!cells.length) continue;
    if (/^:?-{2,}/.test(cells[0])) continue;                       // dòng kẻ
    if (!cols) {                                                    // dòng tiêu đề
      const f = cells.map(fold);
      const iSrc = f.findIndex((c) => c.includes('nguon'));
      if (iSrc < 0) { cols = null; continue; }
      sawTable = true;
      cols = { id: 0, item: f.findIndex((c) => c.includes('muc') || c.includes('hang')), source: iSrc };
      if (cols.item < 0) cols.item = 1;
      continue;
    }
    rows.push({
      id: cells[cols.id] || '',
      item: cells[cols.item] || '',
      source: cells[cols.source] || '',
    });
  }
  return { rows, hasTable: sawTable };
}

/** Lấy "Tổng requirement in-scope" khai trong Phase 1 summary. */
function declaredDenominator(md) {
  for (const ln of String(md || '').split(/\r?\n/)) {
    if (!ln.trim().startsWith('|')) continue;
    const cells = ln.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const label = fold(cells[0]);
    if (label.includes('requirement') && (label.includes('in-scope') || label.includes('in scope'))) {
      const m = String(cells[1]).match(/\d+/);
      if (m) return Number(m[0]);
    }
  }
  return null;
}

/** Lấy Final Decision đã kết luận. */
function finalDecision(md) {
  const m = String(md || '').match(/Final Decision[\s\S]{0,200}?\b(CONDITIONAL PASS|BLOCKED|PASS|FAIL)\b/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Kiểm xuất xứ mẫu số của một task.
 * @param {string} taskDir
 * @returns {{problems: string[], warnings: string[], info: string[], stats: object}}
 */
function gateScopeAnchor(taskDir) {
  const problems = [];
  const warnings = [];
  const info = [];
  const reqDir = path.join(taskDir, 'requirements');
  const repDir = path.join(taskDir, 'reports');

  // ---- 1. Manifest: mỗi `n/a` là một quyết định THU HẸP phạm vi, phải có lý do và có người ký ----
  const manPath = path.join(reqDir, 'dimension_manifest.json');
  const man = readJson(manPath);
  let naCount = 0;
  let reqCount = 0;
  if (!man) {
    warnings.push('Chưa có `requirements/dimension_manifest.json` — `dim:coverage --enforce` không có gì để chặn, nên "đủ chiều" hiện là tự nhận.');
  } else {
    const dims = man.dimensions || {};
    const reasons = man.na_reasons || {};
    for (const [d, v] of Object.entries(dims)) {
      if (fold(v) === 'n/a' || fold(v) === 'na') {
        naCount += 1;
        if (!isFilled(reasons[d])) problems.push(`Manifest: chiều \`${d}\` khai \`n/a\` mà \`na_reasons.${d}\` trống/placeholder — bỏ một chiều coverage phải nói được vì sao.`);
      } else if (fold(v) === 'required') reqCount += 1;
    }
    if (!isFilled(man.reviewed_by) || !isFilled(man.reviewed_at)) {
      problems.push(`Manifest: thiếu \`reviewed_by\`/\`reviewed_at\` — ${naCount} chiều đang bị loại khỏi phạm vi mà không ai ký. Agent được ĐỀ XUẤT manifest, nhưng người phải DUYỆT; nếu không thì \`dim:coverage --enforce\` đang chấm bài của chính người viết đề.`);
    } else {
      info.push(`Manifest do ${man.reviewed_by} duyệt ${man.reviewed_at} · ${reqCount} chiều bắt buộc · ${naCount} chiều n/a.`);
    }
  }

  // ---- 2. Mẫu số coverage phải có danh mục liệt kê từng mục kèm nguồn ----
  const sumPath = path.join(repDir, 'phase1-summary.md');
  const sumMd = readText(sumPath);
  const denom = declaredDenominator(sumMd);
  const invPath = ['scope_inventory.md', 'scope_inventory.markdown']
    .map((f) => path.join(reqDir, f)).find((p) => fs.existsSync(p));
  const inv = invPath ? parseInventory(readText(invPath)) : null;

  if (denom == null && sumMd) {
    warnings.push('`phase1-summary.md` không có dòng "Tổng requirement in-scope" → không đọc được mẫu số coverage.');
  }
  if (!inv || !inv.hasTable) {
    if (denom != null) {
      problems.push(`Coverage khai mẫu số **${denom}** nhưng không có \`requirements/scope_inventory.md\` liệt kê đủ ${denom} mục kèm nguồn. Con số ${denom} hiện KHÔNG NEO VÀO GÌ — nếu phạm vi thật rộng gấp đôi thì coverage chỉ còn một nửa, và không máy nào trong kit phát hiện được. Chạy \`npm run scope:anchor -- --init\` để lấy khung.`);
    } else {
      warnings.push('Chưa có `requirements/scope_inventory.md` — chưa có gì neo phạm vi. `--init` in sẵn khung.');
    }
  } else {
    const n = inv.rows.length;
    const noSource = inv.rows.filter((r) => !isFilled(r.source));
    if (noSource.length) {
      problems.push(`Danh mục phạm vi: ${noSource.length}/${n} mục không ghi nguồn (${noSource.slice(0, 3).map((r) => r.id || r.item).join(' · ')}${noSource.length > 3 ? ' …' : ''}). Mục không truy được về tài liệu thì nó là mục do người viết nghĩ ra, không phải phạm vi.`);
    }
    if (denom != null && denom !== n) {
      problems.push(`Lệch mẫu số: \`phase1-summary.md\` khai **${denom}** requirement in-scope, danh mục có **${n}** mục. Một trong hai sai — coverage % đang tính trên mẫu số không khớp danh mục.`);
    }
    info.push(`Danh mục phạm vi: ${n} mục${denom != null && denom === n ? ' (khớp mẫu số khai trong summary)' : ''}.`);
  }

  // ---- 3. ui_catalog là oracle của mọi case hiển thị — lấy từ build là tautology ----
  const catPath = path.join(reqDir, 'ui_catalog.json');
  const cat = readJson(catPath);
  if (cat) {
    const src = fold(JSON.stringify(cat.source || cat._source || cat.provenance || ''));
    const fromBuild = /screenshot|anh chup|anh build|tu build|from build|http/.test(src);
    const marked = /observation/i.test(JSON.stringify(cat));
    if (fromBuild && !marked) {
      problems.push('`ui_catalog.json` khai nguồn từ BUILD (ảnh chụp/URL) mà không đánh dấu máy đọc được. `run_phase1_template.md` §2b cấm lấy expected hiển thị từ build đang chạy — làm vậy là app==app, case sẽ xanh kể cả khi build sai. Ghi cảnh báo bằng văn xuôi trong `_source`/`.md` là KHÔNG đủ: không gate nào đọc được văn xuôi. Thêm `"oracle": "OBSERVATION"` ở gốc file, rồi mọi case hiển thị dựa vào catalog này không được kết luận PASS/FAIL.');
    } else if (!isFilled(cat.source || cat._source || cat.provenance || '')) {
      warnings.push('`ui_catalog.json` không ghi `source` — không biết expected hiển thị lấy từ tài liệu nào, nên không kiểm được nó có phải oracle độc lập không.');
    }
  }

  // ---- 4. Delta giữa các lượt: số case đổi mà danh mục KHÔNG đổi ⇒ lượt trước sinh thiếu ----
  // Đọc bộ case THEO taskDir được truyền vào, không theo env toàn cục: gate nhận tham số thì phải trả lời
  // đúng về tham số đó, nếu không thì test trên task tạm sẽ đo nhầm sang task đang cấu hình trong .env.
  const seen = new Set();
  let tcDirs = [path.join(taskDir, 'test-cases')];
  try {
    const abs = path.resolve(taskDir);
    tcDirs = tcDirs.concat(rc.getTestcaseDirs().filter((d) => path.resolve(d).startsWith(abs)));
  } catch (e) { /* không có runtime config: thư mục mặc định ở trên là đủ */ }
  try {
    for (const dir of [...new Set(tcDirs)]) {
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) {
        if (f.startsWith('~$') || f.startsWith('.~') || !f.endsWith('.md')) continue;
        try {
          const doc = canonical.parseMarkdown(readText(path.join(dir, f)));
          for (const t of doc.tests || []) if (t.tcId) seen.add(t.tcId);
        } catch (e) { /* không phải bảng testcase */ }
      }
    }
  } catch (e) { /* không đọc được bộ case: phần delta bỏ qua, các check trên vẫn có giá trị */ }
  const tcCount = seen.size;

  const ledgerPath = path.join(reqDir, '.scope_ledger.json');
  const ledger = readJson(ledgerPath) || { runs: [] };
  const prev = ledger.runs && ledger.runs.length ? ledger.runs[ledger.runs.length - 1] : null;
  const invCount = inv && inv.hasTable ? inv.rows.length : null;

  if (prev && tcCount && prev.tc_count) {
    const d = Math.abs(tcCount - prev.tc_count) / prev.tc_count;
    if (d >= DELTA_PCT && prev.inventory_count === invCount) {
      problems.push(`Số case đổi ${prev.tc_count} → ${tcCount} (${(d * 100).toFixed(0)}%) mà danh mục phạm vi KHÔNG đổi (${invCount} mục). Phạm vi y nguyên thì bộ case lẽ ra phải y nguyên: chênh lệch này nghĩa là một trong hai lượt sai. Nếu lượt sau đúng thì lượt trước đã SINH THIẾU — ghi defect vào \`knowledge/bugs/\`, đừng coi là "đã cải thiện". Nếu phạm vi thật có mở rộng thì bổ sung mục vào \`scope_inventory.md\` trước.`);
    }
  }

  if (has('record')) {
    ledger.runs = (ledger.runs || []).concat([{
      at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      tc_count: tcCount,
      inventory_count: invCount,
      dims_required: reqCount || null,
      dims_na: naCount || null,
    }]).slice(-20);
    try {
      fs.mkdirSync(reqDir, { recursive: true });
      fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
      info.push(`Đã ghi sổ lượt này: ${tcCount} case · ${invCount == null ? 'chưa có' : invCount} mục phạm vi.`);
    } catch (e) { warnings.push(`Không ghi được \`.scope_ledger.json\`: ${e.message}`); }
  }

  // ---- 5. Chưa neo thì không được kết luận PASS ----
  const decision = finalDecision(sumMd);
  if (problems.length && decision && /PASS/.test(decision)) {
    problems.push(`\`Final Decision: ${decision}\` trong khi mẫu số chưa neo (${problems.length} vấn đề ở trên). Coverage tính trên mẫu số tự khai không đủ cơ sở để kết luận PASS — dùng \`BLOCKED\`, hoặc neo xong rồi kết luận lại.`);
  }

  return { problems, warnings, info, stats: { tcCount, invCount, denom, naCount, reqCount, decision } };
}

const INIT_TEMPLATE = `# Danh mục phạm vi (Scope Inventory)

> Mẫu số của mọi con số coverage ở Phase 1. Mỗi dòng là MỘT mục phạm vi, và phải truy được về tài liệu
> nguồn — mục không có nguồn là mục do người viết nghĩ ra.
> Sửa danh mục này TRƯỚC khi sinh thêm case, không phải sau.

| ID | Mục | Nguồn |
|---|---|---|
| INV-001 | <màn/rule/endpoint/flow cụ thể> | <file.md#anchor hoặc comment id> |
| INV-002 |  |  |

## Đã cân nhắc và loại khỏi phạm vi

| Mục | Vì sao loại |
|---|---|
|  |  |
`;

function main() {
  let taskDir;
  try { taskDir = rc.getTaskOutputDir(); } catch (e) {
    console.error(`[scope] ✗ không xác định được TASK_OUTPUT_DIR: ${e.message}`);
    console.error('      Truyền TASK_ENV=profiles/<TASK_KEY>/task.env như mọi command khác của kit.');
    process.exit(2);
  }

  if (has('init')) {
    const p = path.join(taskDir, 'requirements', 'scope_inventory.md');
    if (fs.existsSync(p)) { console.log(`[scope] đã có ${p} — không đè.`); process.exit(0); }
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, INIT_TEMPLATE, 'utf8');
    console.log(`[scope] đã tạo khung ${p} — điền rồi chạy lại gate.`);
    process.exit(0);
  }

  const r = gateScopeAnchor(taskDir);
  console.log(`[scope] NEO MẪU SỐ — ${taskDir}`);
  r.info.forEach((m) => console.log(`  · ${m}`));
  r.warnings.forEach((m) => console.log(`  ⚠ ${m}`));
  r.problems.forEach((m) => console.log(`  ✗ ${m}`));
  if (!r.problems.length && !r.warnings.length) console.log('  ✓ mẫu số có neo: danh mục khớp, manifest có người duyệt.');

  const verdict = r.problems.length ? 'CHẶN' : (r.warnings.length ? 'CẢNH BÁO' : 'ĐẠT');
  console.log(`\n[scope] ${verdict} — ${r.problems.length} chặn · ${r.warnings.length} cảnh báo`);
  if (r.problems.length && ENFORCE) process.exit(1);
}

if (require.main === module) main();

module.exports = { gateScopeAnchor, parseInventory, declaredDenominator, finalDecision, isFilled };
