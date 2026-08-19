'use strict';

/*
 * plan_guard.js — MỘT nguồn cho luật "task có case band HIGH thì phải có kế hoạch mở rộng".
 *
 * VÌ SAO TÁCH RA: luật này phải đứng ở HAI cửa khác nhau — `self_review --enforce` (bước finalize) và
 * `push_execution_aio` (đường publish). Chép logic sang cửa thứ hai là tự tạo drift: sửa band ở một nơi,
 * nơi kia vẫn chặn theo luật cũ. Kit đã có luật cấm ghép tay đường dẫn testcase vì đúng lý do này.
 *
 * CHẶN CÁI GÌ: chỉ chặn việc QUYẾT ĐỊNH bị bỏ qua trong im lặng, KHÔNG chặn "đã mở đủ trục chưa".
 * Đo 19/08/2026 trên 9 task: siết theo "có artefact hay không" làm đỏ 7/9, mà task xanh duy nhất cũng chỉ
 * 2 trục thật sự chứng minh được gì (3 báo cáo `proven=0`) ⇒ ép kiểu đó chỉ đẻ artefact rỗng.
 * `expansion:plan` chỉ đọc Excel (vài giây, không mở browser) và in ra chi phí để người chốt phạm vi.
 *
 * KHÔNG TRA ĐƯỢC BAND ≠ ĐẠT: trả `unknown` để nơi gọi CẢNH BÁO, không im lặng cho qua.
 */

const fs = require('fs');
const path = require('path');
const depth = require('./depth');
const canonical = require('../testcase');
const rc = require('../../utils/runtime_config');

/** Đọc mọi bảng testcase canonical (.md) của task → map TC ID (HOA) → testcase. */
function loadCanonical(taskDir) {
  const byId = {};
  for (const d of rc.getTestcaseDirs(taskDir)) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.md'))) {
      try {
        for (const t of canonical.parseMarkdown(fs.readFileSync(path.join(d, f), 'utf8')).tests || []) {
          byId[String(t.tcId).toUpperCase()] = t;
        }
      } catch (e) { /* file không phải bảng canonical */ }
    }
  }
  return byId;
}

/** Đã có artefact kế hoạch chưa (expansion_plan.js ghi mặc định vào reports/expansion-plan.md). */
function hasPlan(taskDir) {
  const dir = path.join(taskDir, 'reports');
  try { return fs.readdirSync(dir).some((f) => /expansion-plan/i.test(f)); } catch (e) { return false; }
}

/**
 * @param {string} taskDir
 * @param {string[]} executedTcIds  TC ID của các case ĐÃ execute (verdict PASS/FAIL)
 * @returns {{high:string[], unknown:number, planned:boolean, problem:string|null, warning:string|null}}
 */
function checkPlan(taskDir, executedTcIds) {
  const executed = [...new Set((executedTcIds || []).map((s) => String(s || '').toUpperCase()).filter(Boolean))];
  const out = { high: [], unknown: 0, planned: hasPlan(taskDir), problem: null, warning: null };
  if (!executed.length) return out;

  const byId = loadCanonical(taskDir);
  const known = executed.filter((id) => byId[id]);
  out.unknown = executed.length - known.length;
  out.high = known.filter((id) => depth.bandOf(byId[id]) === 'high');

  if (!known.length) {
    out.warning = `${executed.length} case đã execute nhưng KHÔNG tra được band nào từ \`test-cases/*.md\` — luật "đã cân nhắc mở rộng chưa" KHÔNG chạy được cho task này (im lặng ≠ đạt). Cần bảng testcase canonical dạng .md.`;
    return out;
  }
  if (out.high.length && !out.planned) {
    out.problem = `${out.high.length} case band HIGH đã execute nhưng CHƯA có \`reports/expansion-plan.md\` — chưa ai cân nhắc mở rộng trục nào cho chúng. Chạy \`npm run expansion:plan\` (chỉ đọc Excel, vài giây) để thấy chi phí rồi chốt phạm vi; muốn không mở trục nào thì ghi lý do vào báo cáo, đừng bỏ qua im lặng.`;
  }
  return out;
}

/** Tiện cho nơi chỉ có file status: rút TC ID đã execute (verdict PASS/FAIL). */
function executedFromStatus(doc) {
  const list = Array.isArray(doc) ? doc : ((doc && doc.tests) || []);
  return list.filter((t) => /^(PASS|FAIL)/i.test(String((t && t.status) || '').trim()))
    .map((t) => String(t.tcId || '').toUpperCase()).filter(Boolean);
}

module.exports = { checkPlan, executedFromStatus, hasPlan };
