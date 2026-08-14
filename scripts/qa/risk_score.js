#!/usr/bin/env node
'use strict';

/*
 * Risk Scorer — Risk-Based Testing CÓ THỰC THI (Suggest-only).
 * Đọc knowledge/{bugs,historical_execution} (+ requirements/git-impact.md nếu có) + .agent/config/risk_model.json
 * → chấm Risk = Likelihood × Impact per module → reports/risk-register.{md,json}.
 *
 * CHỐNG COLD-START (knowledge rỗng là MẶC ĐỊNH): Likelihood có prior = Impact và blend theo lượng data.
 *   L = confidence*observed + (1-confidence)*prior   (floor 1). confidence=0 (chưa data) → L=prior=Impact
 *   → band ở dự án mới do IMPACT dẫn (module tiền/bảo mật vẫn High), rồi sắc lại khi bug/historical tích luỹ.
 *
 * Suggest-only: chỉ sinh register, KHÔNG đổi scope, KHÔNG PASS/FAIL. QA review + override band (band_override
 * + override_reason trong risk-register.json). depthPolicy trong risk_model.json là nguồn duy nhất cho gate.
 *
 * Dùng: TASK_ENV=profiles/<TASK>/task.env node scripts/qa/risk_score.js [--out <dir>] [--task-output <dir>]
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const DEFAULT_MODEL = JSON.parse(fs.readFileSync(path.join(rc.REPO_ROOT, '.agent', 'config', 'risk_model.example.json'), 'utf8'));

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

function loadModel() {
  try {
    const o = JSON.parse(fs.readFileSync(path.join(rc.REPO_ROOT, '.agent', 'config', 'risk_model.json'), 'utf8'));
    return { ...DEFAULT_MODEL, ...o,
      impact: { ...DEFAULT_MODEL.impact, ...(o.impact || {}) },
      likelihood: { ...DEFAULT_MODEL.likelihood, ...(o.likelihood || {}) },
      bands: { ...DEFAULT_MODEL.bands, ...(o.bands || {}) },
      depthPolicy: { ...DEFAULT_MODEL.depthPolicy, ...(o.depthPolicy || {}) },
    };
  } catch (e) { return DEFAULT_MODEL; }
}

function readJsonDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return null; } })
    .filter(Boolean);
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

function taskOutputDir() {
  const explicit = arg('task-output');
  if (explicit) return explicit;
  try { return rc.getTaskOutputDir(); } catch (e) { return null; }
}

function main() {
  const model = loadModel();
  const KNOW = path.join(rc.REPO_ROOT, 'knowledge');
  const bugs = readJsonDir(path.join(KNOW, 'bugs'));
  const hist = readJsonDir(path.join(KNOW, 'historical_execution'));
  // QA override band ở task trước được lưu dài hạn trong knowledge/decisions/ (type risk_override).
  // NHẮC LẠI ở register để QA không phải override tay mỗi lần — vẫn SUGGEST-ONLY: không tự đổi band.
  const overrides = readJsonDir(path.join(KNOW, 'decisions'))
    .filter((d) => d && d.type === 'risk_override' && d.status === 'active');

  const tod = taskOutputDir();
  const OUT = path.resolve(arg('out', tod ? path.join(tod, 'reports') : path.join(process.cwd(), 'reports')));
  fs.mkdirSync(OUT, { recursive: true });

  // git-impact.md (optional): lấy tên module ở cột "Module" của bảng markdown.
  const impactModulesTouched = new Set();
  if (tod) {
    const gi = path.join(tod, 'requirements', 'git-impact.md');
    if (fs.existsSync(gi)) {
      for (const line of fs.readFileSync(gi, 'utf8').split(/\r?\n/)) {
        const m = line.split('|').map((s) => s.trim());
        if (m.length >= 4 && m[2] && !/^-+$/.test(m[2]) && m[2] !== 'Module') impactModulesTouched.add(m[2]);
      }
    }
  }

  // Gom tín hiệu per module.
  const modules = new Map();
  const ensure = (name) => { if (!modules.has(name)) modules.set(name, { module: name, bugCount: 0, bugWeighted: 0, fail: 0, total: 0, tags: new Set() }); return modules.get(name); };
  // Key `_...` là ghi chú trong config, KHÔNG phải module. Không lọc thì `ensure()` dựng ra một dòng module
  // tên "_canonical_note" với Impact là chuỗi ⇒ bảng có dòng rác và executeOrder trỏ vào nó.
  const declaredModules = Object.keys(model.impact.modules || {}).filter((m) => !m.startsWith('_'));
  for (const m of declaredModules) ensure(m);                               // module đã khai (cold-start có giá trị)
  // VÒNG ĐỜI BUG: bug KHÔNG nặng như nhau mãi mãi. Trước đây đếm mọi bug bằng nhau ⇒ bug đã Done từ
  // nửa năm trước vẫn kéo Likelihood y như bug mới mở → risk model lệch về QUÁ KHỨ, chỉ vùng từng-hỏng
  // luôn High dù đã fix xong, còn vùng vừa hỏng lại không nổi lên.
  // Trọng số mỗi bug = statusWeight(jira_status) × decay(tuổi). Cả 2 tuỳ chỉnh trong risk_model.json;
  // thiếu config → dùng default ở đây (Done 0.4, half-life 180 ngày).
  const lk = model.likelihood || {};
  const statusW = lk.statusWeight || { Open: 1, 'In Progress': 1, Reopened: 1, Done: 0.4, Closed: 0.4, Rejected: 0.1 };
  const halfLife = Number(lk.halfLifeDays != null ? lk.halfLifeDays : 180);
  const DAY = 86400000;
  const ageDays = (b) => {
    const d = String(b.resolved_at || b.created_at || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;               // thiếu ngày → không decay (bảo thủ)
    const ms = Date.now() - new Date(`${d}T00:00:00Z`).getTime();
    return ms > 0 ? ms / DAY : 0;
  };
  const bugWeightOf = (b) => {
    const sw = statusW[String(b.jira_status || 'Open')] != null ? statusW[String(b.jira_status || 'Open')] : 1;
    const age = ageDays(b);
    const decay = (halfLife > 0 && age != null) ? 0.5 ** (age / halfLife) : 1;
    return sw * decay;
  };
  for (const b of bugs) {
    if (!b.module) continue;
    const e = ensure(b.module);
    e.bugCount += 1;                                  // số bug THÔ (để báo cáo/audit)
    e.bugWeighted += bugWeightOf(b);                   // số bug HIỆU DỤNG (dùng để chấm Likelihood)
    (b.tags || []).forEach((t) => e.tags.add(String(t).toLowerCase()));
  }
  for (const h of hist) for (const [mod, v] of Object.entries(h.modules || {})) { const e = ensure(mod); e.fail += Number(v.fail || 0); e.total += Number(v.total || 0); }
  for (const m of impactModulesTouched) ensure(m);

  const impactOf = (e) => {
    if (model.impact.modules && model.impact.modules[e.module] != null) return { v: model.impact.modules[e.module], known: true, src: 'config.module' };
    let tw = 0; for (const t of e.tags) if (model.impact.tagWeights[t] != null) tw = Math.max(tw, model.impact.tagWeights[t]);
    if (tw > 0) return { v: tw, known: true, src: 'config.tag' };
    return { v: model.impact.default, known: false, src: 'default' };
  };

  // "(unmapped)" KHÔNG phải module: learn_bugs gán nhãn này cho bug thiếu label tcId nên không tra ra
  // được Module của testcase. Nếu để nó vào bảng thì nó thành một "module" có thể leo lên High (đã gặp:
  // 13 bug → risk 15) rồi chen vào executeOrder — tức chỉ đường test tới một đối tượng không tồn tại,
  // đồng thời CHE mất sự thật là các module thật đang thiếu tín hiệu. Tách ra thành cảnh báo dữ liệu.
  const UNMAPPED = '(unmapped)';
  const unmapped = modules.get(UNMAPPED);
  modules.delete(UNMAPPED);

  const rows = [];
  for (const e of modules.values()) {
    const imp = impactOf(e);
    const I = imp.v;
    const failRate = e.total > 0 ? e.fail / e.total : 0;
    const effBugs = e.bugWeighted || 0;   // bug hiệu dụng sau statusWeight × decay (xem vòng đời bug ở trên)
    const observed = clamp(model.likelihood.bugWeight * Math.min(5, effBugs) + model.likelihood.failRateWeight * (failRate * 5), 0, 5);
    const signals = e.bugCount + e.total;   // confidence dựa số tín hiệu THÔ (đã có dữ liệu hay chưa), không phụ thuộc decay
    const confidence = clamp(signals / (model.likelihood.confidenceFull || 5), 0, 1);
    const prior = model.likelihood.prior === 'impact' ? I : Number(model.likelihood.prior);
    const L = clamp(Math.round(confidence * observed + (1 - confidence) * prior), 1, 5);
    const risk = L * I;
    const coldStart = signals === 0;
    let band;
    if (!imp.known && coldStart) band = 'UNKNOWN';
    else band = risk >= model.bands.High ? 'High' : risk >= model.bands.Medium ? 'Medium' : 'Low';
    rows.push({
      module: e.module, impact: I, likelihood: L, risk, band,
      cold_start: coldStart,
      drivers: { bugCount: e.bugCount, bugEffective: Math.round(effBugs * 100) / 100, failRate: Math.round(failRate * 100) / 100, impactSource: imp.src, confidence: Math.round(confidence * 100) / 100 },
      band_override: null, override_reason: null, gate_waiver: null,
    });
  }
  const order = { High: 0, UNKNOWN: 1, Medium: 2, Low: 3 };
  rows.sort((a, b) => (order[a.band] - order[b.band]) || (b.risk - a.risk));

  const register = {
    generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    note: 'Suggest-only. QA review + override band (band_override + override_reason). Cold-start (confidence 0) → band từ Impact; UNKNOWN nếu chưa khai Impact & chưa có data.',
    depthPolicyRef: '.agent/config/risk_model.json (depthPolicy) — nguồn duy nhất cho density; risk_gate.js đọc chính nó.',
    executeOrder: rows.map((r) => r.module),
    modules: rows,
  };
  fs.writeFileSync(path.join(OUT, 'risk-register.json'), JSON.stringify(register, null, 2), 'utf8');

  const L = ['# Risk Register (Risk-Based Testing)', '',
    `> ${register.generatedAt} · Suggest-only — QA chốt/override band. depthPolicy: xem risk_model.json.`,
    '> Cold-start (chưa có bug/historical) → band do **Impact** dẫn; sắc lại khi learning data tích luỹ.',
    '> Vòng đời bug: Likelihood dùng bug **hiệu dụng** = statusWeight[jira_status] × 0.5^(tuổi/halfLifeDays) — bug đã Done/cũ nhẹ hơn bug mới mở, để risk phản ánh HIỆN TẠI. Tuỳ chỉnh ở risk_model.json §likelihood.',
    '> Thứ tự execute (High trước): ' + (register.executeOrder.join(' → ') || '(trống)'), '',
    '| Module | Impact | Likelihood | Risk | Band | Cold-start | Drivers (bug thô→hiệu dụng / failRate / src, conf) | QA override |',
    '|---|---|---|---|---|---|---|---|'];
  for (const r of rows) L.push(`| ${r.module} | ${r.impact} | ${r.likelihood} | ${r.risk} | ${r.band} | ${r.cold_start ? 'yes' : ''} | ${r.drivers.bugCount}→${r.drivers.bugEffective}/${r.drivers.failRate}/${r.drivers.impactSource}, c=${r.drivers.confidence} | |`);
  if (unmapped && unmapped.bugCount) {
    L.push('', '## ⚠ Bug chưa map được module (không tính vào bảng trên)', '',
      `**${unmapped.bugCount} bug** trong \`knowledge/bugs/\` có \`module: "(unmapped)"\` — thiếu label \`<tcId>\` trên Jira nên không tra ra được cột Module của testcase.`,
      'Hệ quả: Likelihood của các module THẬT đang thiếu đúng số bug đó (risk bị chấm thấp hơn thực tế).',
      'Sửa tận gốc ở lúc log bug: bug tạo qua `bug_reporter.js` phải có label `<tcId>`; bug lịch sử thì bổ sung label rồi chạy lại `npm run learn:bugs:apply`.');
  }
  // LỆCH TÊN MODULE giữa config Impact và dữ liệu thật.
  //
  // VÌ SAO PHẢI BÁO TO: `impact.modules` khai theo tên gì thì chỉ tên ĐÚNG Y NGUYÊN mới nhận Impact đó; lệch
  // một chữ là rơi về `default`. Đo 14/08/2026: config khai 18 tên tiếng Anh (Payment/Order/...) trong khi
  // bug + snapshot dùng tên module canonical của bộ testcase (tiếng Việt) ⇒ 18 dòng cold-start ngồi ở High
  // với 0 bug, còn ~30 module CÓ bug thật thì Impact=default nên trần chỉ tới Medium. Bảng vẫn "xanh đỏ" đủ
  // nên không ai thấy sai; nhưng `executeOrder` lại chỉ đi test mấy dòng phantom. Đây là lỗi CẤU HÌNH, không
  // phải lỗi dữ liệu, nên không tự sửa — chỉ nêu đúng tên để người sửa được trong một lượt.
  const declared = declaredModules;
  const withData = new Set(rows.filter((r) => r.drivers.bugCount > 0 || (r.drivers.failRate && r.drivers.failRate !== '0')).map((r) => r.module));
  const phantom = declared.filter((m) => !withData.has(m));
  const orphanData = rows.filter((r) => withData.has(r.module) && r.drivers.impactSource === 'default').map((r) => r.module);
  if (phantom.length && orphanData.length) {
    L.push('', '## ⚠ Lệch tên module giữa `risk_model.json` và dữ liệu thật', '',
      `**${phantom.length}/${declared.length} tên khai trong \`impact.modules\` không có bug/snapshot nào dùng**, trong khi **${orphanData.length} module CÓ dữ liệu thật đang lấy Impact = default (${model.impact.default})**.`,
      'Hệ quả: dòng đầu bảng là phantom (Impact cao, 0 bug) còn module thật bị chặn trần band — `executeOrder` chỉ sai chỗ.', '',
      `Tên khai nhưng không có dữ liệu: ${phantom.map((m) => `\`${m}\``).join(', ')}`, '',
      `Module có dữ liệu mà thiếu Impact: ${orphanData.map((m) => `\`${m}\``).join(', ')}`, '',
      'Sửa: khai `impact.modules` theo ĐÚNG tên cột `Module` của bộ testcase canonical (hoặc dùng `impact.tagWeights` nếu muốn chấm theo tag).');
  }
  if (overrides.length) {
    L.push('', '## QA override đã lưu dài hạn (`knowledge/decisions/`)', '',
      '> Suggest-only — script KHÔNG tự đổi band. Áp lại nếu vẫn còn đúng; hết hiệu lực thì chuyển `status: superseded`.', '',
      '| Decision | Module | Chốt | Vì sao | Ngày · người |', '|---|---|---|---|---|');
    for (const d of overrides) {
      const mods = ((d.scope || {}).modules || []).join(', ');
      L.push(`| ${d.id} | ${mods} | ${String(d.decision || '').replace(/\|/g, '\\|')} | ${String(d.rationale || '').replace(/\|/g, '\\|')} | ${d.decided_at} · ${d.decided_by} |`);
    }
  }
  L.push('', '> QA: sửa `band_override` + `override_reason` trong `risk-register.json` nếu không đồng ý; `gate_waiver` để miễn gate cho module có lý do.');
  fs.writeFileSync(path.join(OUT, 'risk-register.md'), L.join('\n'), 'utf8');

  const high = rows.filter((r) => r.band === 'High').length;
  const unk = rows.filter((r) => r.band === 'UNKNOWN').length;
  console.log(`[risk] Đã tạo: ${path.join(OUT, 'risk-register.md')}`);
  if (unmapped && unmapped.bugCount) console.log(`[risk] ⚠ ${unmapped.bugCount} bug chưa map được module (thiếu label tcId) → KHÔNG vào bảng; Likelihood các module thật đang thiếu đúng số đó. Xem cuối register.`);
  if (phantom.length && orphanData.length) console.log(`[risk] ⚠ LỆCH TÊN MODULE: ${phantom.length}/${declared.length} tên trong impact.modules không có dữ liệu, còn ${orphanData.length} module CÓ dữ liệu đang lấy Impact=default → band bị chặn trần. Xem cuối register.`);
  if (overrides.length) console.log(`[risk] ${overrides.length} QA override đã lưu (knowledge/decisions/) — nhắc lại ở cuối register, KHÔNG tự áp.`);
  console.log(`[risk] ${rows.length} module · ${high} High · ${unk} UNKNOWN (${bugs.length} bug, ${hist.length} snapshot làm dữ liệu)`);
  if (!bugs.length && !hist.length) console.log('[risk] Cold-start: chưa có learning data → band từ Impact/config. QA xác nhận band trước khi bật gate --enforce.');
}

main();
