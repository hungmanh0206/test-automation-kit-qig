#!/usr/bin/env node
'use strict';

/*
 * policy_source_check.js (F3) — giữ 1 NGUỒN policy duy nhất: RULE_GLOBAL.md là canonical.
 *
 * KHÔNG bắt trùng-văn-bản (core_rules.md CỐ Ý là digest → paraphrase lại là bình thường, không phải lỗi).
 * Thay vào đó ÉP QUY ƯỚC chống drift:
 *   - core_rules.md PHẢI khai RULE_GLOBAL.md là canonical (khi mâu thuẫn theo RULE_GLOBAL) — mất dòng này = CHẶN.
 *   - Mỗi mục digest NÊN trỏ nguồn "(Đầy đủ: RULE_GLOBAL …)" — thiếu nhiều = CẢNH BÁO (drift dễ xảy ra).
 * Cách này bắt đúng rủi ro "instruction drift" mà không phạt việc tóm tắt hợp lệ.
 *
 * Dùng: node scripts/qa/policy_source_check.js   (exit 1 nếu mất pointer canonical)
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const RULE_GLOBAL = path.join(rc.REPO_ROOT, 'RULE_GLOBAL.md');
const CORE = path.join(rc.REPO_ROOT, '.agent', 'rules', 'core_rules.md');

const problems = [];
const warns = [];

if (!fs.existsSync(RULE_GLOBAL)) problems.push('Thiếu RULE_GLOBAL.md (nguồn policy canonical).');
if (!fs.existsSync(CORE)) {
  warns.push('.agent/rules/core_rules.md không tồn tại (bỏ qua check digest).');
} else {
  const core = fs.readFileSync(CORE, 'utf8');
  // Pointer canonical BẮT BUỘC: nhắc RULE_GLOBAL.md là nguồn đầy đủ / khi mâu thuẫn theo nó.
  const hasCanonicalPointer = /RULE_GLOBAL\.md/.test(core) &&
    /(canonical|đầy đủ|khi mâu thuẫn|theo\s+`?RULE_GLOBAL)/i.test(core);
  if (!hasCanonicalPointer) {
    problems.push('core_rules.md KHÔNG còn khai RULE_GLOBAL.md là canonical → nguy cơ 2 nguồn policy drift. Thêm lại dòng "Rule canonical đầy đủ: RULE_GLOBAL.md — khi mâu thuẫn theo RULE_GLOBAL.md".');
  }
  // Mỗi bullet digest nên trỏ nguồn.
  const bullets = core.split(/\r?\n/).filter((l) => /^\s*[-*]\s/.test(l));
  const withRef = bullets.filter((l) => /Đầy đủ|RULE_GLOBAL|prompt gen|§/i.test(l)).length;
  if (bullets.length >= 5 && withRef / bullets.length < 0.4) {
    warns.push(`Chỉ ${withRef}/${bullets.length} bullet digest trỏ nguồn "(Đầy đủ: RULE_GLOBAL …)" → nên bổ sung ref để chống drift.`);
  }
}

// ─── CLAUDE.md: tầng thứ ba, và là tầng NGUY HIỂM NHẤT khi lệch ────────────────────────────────────────────
// CLAUDE.md được Claude Code tự nạp MỌI session, còn 2 file kia phải mở ra mới đọc. Nên bản drift ở đây là bản
// có ảnh hưởng lớn nhất mà lại không ai kiểm. Đo 12/08/2026: CLAUDE.md ghi đuôi evidence `.png/.jpg/.webp`
// (thiếu `.jpeg`) trong khi canonical có `.jpeg` và code chặn thì còn cho cả gif/bmp/mov/m4v.
const CLAUDE = path.join(rc.REPO_ROOT, 'CLAUDE.md');
if (!fs.existsSync(CLAUDE)) {
  warns.push('CLAUDE.md không tồn tại (bỏ qua check tầng auto-load).');
} else {
  const claude = fs.readFileSync(CLAUDE, 'utf8');
  if (!/RULE_GLOBAL\.md/.test(claude)) {
    problems.push('CLAUDE.md KHÔNG trỏ RULE_GLOBAL.md là canonical → tầng auto-load thành nguồn policy thứ hai.');
  }
  // So danh sách đuôi evidence trong TÀI LIỆU với hằng số THẬT SỰ CHẶN trong code.
  // Đây là loại giá trị máy-kiểm-được: chép tay ra tài liệu thì sớm muộn lệch, mà lệch thì agent tin tài liệu.
  let rules = null;
  try { rules = require(path.join(rc.REPO_ROOT, 'scripts', 'qa', 'lib', 'output_rules.js')); } catch (e) { /* thiếu lib → bỏ qua */ }
  if (rules && rules.VISUAL_EXT) {
    const allowed = new Set(String(rules.VISUAL_EXT.source).replace(/^\\\.\(|\)\$$/g, '').split('|')
      .flatMap((s) => (s === 'jpe?g' ? ['jpg', 'jpeg'] : [s])));
    // Mỗi đuôi gate CHO QUA phải có mime thật, nếu không uploader gắn `application/octet-stream` ⇒ Jira không
    // preview ⇒ reviewer phải tải file về mới xem được, tức evidence không còn làm đúng việc của nó.
    // Đây là ràng buộc từng bị vi phạm thật: gate nhận .bmp/.mov/.m4v mà mime map không có.
    if (rules.mimeOf) {
      const noMime = [...allowed].filter((e) => rules.mimeOf(`.${e}`) === 'application/octet-stream');
      if (noMime.length) problems.push(`VISUAL_EXT cho qua đuôi KHÔNG có mime (${noMime.map((x) => `.${x}`).join(' ')}) → Jira sẽ không preview. Thêm vào MIME_BY_EXT hoặc bỏ khỏi VISUAL_EXT.`);
    }
    for (const [name, file] of [['CLAUDE.md', CLAUDE], ['core_rules.md', CORE], ['RULE_GLOBAL.md', RULE_GLOBAL]]) {
      if (!fs.existsSync(file)) continue;
      const txt = fs.readFileSync(file, 'utf8');
      // chỉ xét các cụm liệt kê đuôi kiểu `.png/.jpg/...` để không quét trúng đường dẫn file lẻ
      const runs = txt.match(/(?:\.[a-z0-9]{2,4}\/){1,}\.[a-z0-9]{2,4}/gi) || [];
      const listed = new Set(runs.flatMap((r) => r.split('/')).map((s) => s.replace(/^\./, '').toLowerCase()));
      const bogus = [...listed].filter((e) => !allowed.has(e) && /^(png|jpe?g|webp|gif|bmp|tiff|svg|mp4|webm|mov|m4v|avi|mkv)$/.test(e));
      if (bogus.length) problems.push(`${name}: liệt kê đuôi evidence KHÔNG được code chấp nhận (${bogus.map((x) => `.${x}`).join(' ')}) — sửa tài liệu hoặc sửa VISUAL_EXT, đừng để 2 luật.`);
      // ảnh: tài liệu nêu png+jpg thì phải nêu cả jpeg, vì code coi jpg và jpeg như nhau
      if (listed.has('jpg') && !listed.has('jpeg')) {
        problems.push(`${name}: nêu \`.jpg\` mà thiếu \`.jpeg\` — code chặn theo \`jpe?g\` nên .jpeg HỢP LỆ; tài liệu thiếu sẽ khiến agent loại oan evidence hợp lệ.`);
      }
    }
  }
}

// ─── Mọi file trong .agent/rules/ phải CÓ ĐƯỜNG ĐI TỚI lúc agent cần ──────────────────────────────────────
// Rule không ai trỏ tới = rule không tồn tại: agent không biết mà đọc, còn nội dung thì âm thầm drift khỏi
// chỗ đang thật sự được dùng. Đã xảy ra: `playwright_fe.md` + `playwright_api.md` chỉ được `AUDIT_REFERENCES.md`
// (bản KIỂM KÊ, không phải nơi tiêu thụ) nhắc tới, trong khi chính prompt execute FE/API lại tự chép lại một
// phần rule của chúng ⇒ tồn tại bản thứ hai không ai canh. Cùng lớp vấn đề mà `.agent/skills/INDEX.md` đã chống
// cho skill; nay chống cho rule.
const RULES_DIR = path.join(rc.REPO_ROOT, '.agent', 'rules');
// Chỉ những nơi THỰC SỰ dẫn agent đọc mới tính là consumer. Cố ý loại `AUDIT_REFERENCES.md` (kiểm kê) và
// `CHANGELOG.md` (lịch sử) — hai file đó nhắc tên file mà không hề đưa ai tới đọc nó.
const CONSUMER_DIRS = ['prompt_templates', '.agent/skills', '.agent/workflows', 'scripts', 'exploratory'];
const CONSUMER_FILES = ['CLAUDE.md', 'README.md'];
if (fs.existsSync(RULES_DIR)) {
  const walk = (dir, acc = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, acc);
      else if (/\.(md|js|json|ya?ml)$/i.test(e.name)) acc.push(p);
    }
    return acc;
  };
  const haystack = [];
  for (const d of CONSUMER_DIRS) {
    const abs = path.join(rc.REPO_ROOT, d);
    if (fs.existsSync(abs)) haystack.push(...walk(abs));
  }
  for (const f of CONSUMER_FILES) {
    const abs = path.join(rc.REPO_ROOT, f);
    if (fs.existsSync(abs)) haystack.push(abs);
  }
  const corpus = haystack.map((p) => ({ p, txt: fs.readFileSync(p, 'utf8') }));
  for (const name of fs.readdirSync(RULES_DIR).filter((x) => x.endsWith('.md') && x.toLowerCase() !== 'readme.md')) {
    const refs = corpus.filter((c) => !c.p.endsWith(path.join('.agent', 'rules', name)) && c.txt.includes(name));
    if (!refs.length) {
      problems.push(`.agent/rules/${name}: KHÔNG nơi nào dẫn agent đọc (prompt_templates/skills/workflows/scripts/exploratory/CLAUDE.md đều không trỏ) → rule mồ côi, sẽ drift âm thầm. Trỏ nó từ prompt/skill/gate đang cần, hoặc gộp nội dung rồi xoá file.`);
    }
  }
}

// ─── Prompt bước phải có ĐƯỜNG VÀO từ một `run_phase*` ─────────────────────────────────────────────────────
// `run_phase*_template.md` là điểm vào của mỗi phase: người/agent được bảo "đọc file này". Prompt bước nào
// không được nó trỏ tới thì coi như không tồn tại — đúng lớp hỏng đã xảy ra thật: `run_phase2` KHÔNG trỏ tới
// `04_execute_fe_playwright.md` và `05_execute_api_playwright.md` (47KB kỷ luật execute), nên ai chỉ đọc
// run_phase2 là chạy test mà thiếu toàn bộ phần khoanh tầng lỗi FE/BE, oracle mapping và conformance.
// Đo 13/08/2026 trước khi vá: 8/11 prompt bước mồ côi, 4 trong số đó không nơi nào trỏ tới.
// `.agent/workflows/` và SKILL cũng tính là đường vào hợp lệ (chúng dẫn agent tới đọc thật).
const PT_DIR = path.join(rc.REPO_ROOT, 'prompt_templates');
if (fs.existsSync(PT_DIR)) {
  const entryTexts = fs.readdirSync(PT_DIR).filter((f) => /^run_phase.*\.md$/.test(f))
    .map((f) => fs.readFileSync(path.join(PT_DIR, f), 'utf8'));
  const routerText = entryTexts.join('\n');
  const alsoDirs = [path.join(rc.REPO_ROOT, '.agent', 'workflows'), path.join(rc.REPO_ROOT, '.agent', 'skills')];
  const alsoText = alsoDirs.filter((d) => fs.existsSync(d)).map((d) => {
    const acc = [];
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p); else if (e.name.endsWith('.md')) acc.push(fs.readFileSync(p, 'utf8'));
    });
    walk(d);
    return acc.join('\n');
  }).join('\n');
  for (const phase of fs.readdirSync(PT_DIR, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    for (const f of fs.readdirSync(path.join(PT_DIR, phase.name)).filter((x) => x.endsWith('.md'))) {
      const ref = `${phase.name}/${f}`;
      if (routerText.includes(ref)) continue;
      if (alsoText.includes(ref)) { warns.push(`prompt_templates/${ref}: không được \`run_phase*\` nào trỏ tới (chỉ tới được qua workflow/skill) — nên thêm vào bảng "Bản đồ prompt" để ai đọc run_phase là thấy.`); continue; }
      problems.push(`prompt_templates/${ref}: KHÔNG có đường vào — không \`run_phase*\`, workflow hay skill nào trỏ tới ⇒ prompt mồ côi, sẽ drift âm thầm. Thêm vào bảng "Bản đồ prompt" của run_phase tương ứng, hoặc gộp nội dung rồi xoá file.`);
    }
  }
}

// ─── Lệnh GATE trong workflow phải xuất hiện ở `run_phase*` ────────────────────────────────────────────────
// `run_phase*` là thứ người/agent được bảo "đọc file này rồi chạy". Lệnh gate nào chỉ nằm trong
// `.agent/workflows/` mà điểm vào không nhắc thì THỰC TẾ KHÔNG BAO GIỜ ĐƯỢC CHẠY. Đã xảy ra đúng vậy:
// `run_phase2` thiếu hẳn `self-review` (G9) và `learn`/`learn:bugs:apply` — nên không ai chạy self-review
// trước finalize, và vòng học đứt (đó là lý do knowledge/ bị cũ). Đo 13/08/2026: 11 lệnh gate chỉ có ở
// workflows. Coi `npm run X` và câu lệnh `node …` mà nó trỏ tới là MỘT (phân giải qua package.json), nếu
// không thì cùng một gate viết hai kiểu sẽ báo nhầm là thiếu.
{
  const WF_DIR = path.join(rc.REPO_ROOT, '.agent', 'workflows');
  const PT = path.join(rc.REPO_ROOT, 'prompt_templates');
  if (fs.existsSync(WF_DIR) && fs.existsSync(PT)) {
    let scripts = {};
    try { scripts = (JSON.parse(fs.readFileSync(path.join(rc.REPO_ROOT, 'package.json'), 'utf8')).scripts) || {}; } catch (e) { /* bỏ qua */ }
    // mỗi lệnh → tập biến thể tương đương (tên npm + phần `node scripts/...js` mà nó gọi)
    const variants = (cmd) => {
      const out = new Set([cmd]);
      const m = cmd.match(/^npm run ([a-z0-9:_-]+)$/i);
      if (m && scripts[m[1]]) {
        const body = scripts[m[1]];
        out.add(body);
        const js = body.match(/node\s+(scripts\/[\w./-]+\.js)/);
        if (js) out.add(js[1]);
      }
      const js2 = cmd.match(/^node\s+(scripts\/[\w./-]+\.js)$/);
      if (js2) {
        out.add(js2[1]);
        for (const [n, body] of Object.entries(scripts)) if (body.includes(js2[1])) out.add(`npm run ${n}`);
      }
      return [...out];
    };
    const entryFor = (wfName) => {
      if (/^phase1/.test(wfName)) return 'run_phase1_template.md';
      if (/^phase2/.test(wfName)) return 'run_phase2_template.md';
      if (/^rerun/.test(wfName)) return 'run_phase_re-run_template.md';
      return null;
    };
    for (const wf of fs.readdirSync(WF_DIR).filter((f) => f.endsWith('.md'))) {
      const entryName = entryFor(wf);
      if (!entryName) continue;
      const entryPath = path.join(PT, entryName);
      if (!fs.existsSync(entryPath)) continue;
      const entryTxt = fs.readFileSync(entryPath, 'utf8');
      const wfTxt = fs.readFileSync(path.join(WF_DIR, wf), 'utf8');
      const cmds = [...new Set(wfTxt.match(/npm run [a-z0-9:_-]+|node scripts\/[\w./-]+\.js/gi) || [])];
      const missing = cmds.filter((c) => !variants(c).some((v) => entryTxt.includes(v)));
      if (missing.length) {
        problems.push(`.agent/workflows/${wf}: lệnh ${missing.map((x) => `\`${x}\``).join(', ')} KHÔNG có trong \`prompt_templates/${entryName}\` — điểm vào không nhắc thì thực tế không ai chạy. Thêm vào bảng "Gate bắt buộc" của điểm vào.`);
      }
    }
  }
}

// ─── Skill: frontmatter `name` phải KHỚP tên thư mục ──────────────────────────────────────────────────────
// Tra cứu skill dùng TÊN THƯ MỤC (đó là tên prompt/workflow/INDEX.md nhắc tới). Frontmatter ghi khác đi thì
// người đọc file tưởng skill tên A trong khi mọi nơi gọi nó là B — và `skills_index.js` chỉ CẢNH BÁO, không
// chặn, nên 5/21 skill lệch tên suốt một thời gian mà không ai sửa. Đã dọn hết 12/08/2026 ⇒ chốt lại bằng gate.
const SKILLS_DIR = path.join(rc.REPO_ROOT, '.agent', 'skills');
if (fs.existsSync(SKILLS_DIR)) {
  for (const group of fs.readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const groupDir = path.join(SKILLS_DIR, group.name);
    for (const skill of fs.readdirSync(groupDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const f = path.join(groupDir, skill.name, 'SKILL.md');
      if (!fs.existsSync(f)) continue;
      const m = fs.readFileSync(f, 'utf8').match(/^name:[ \t]*(.+)$/m);
      const declared = m ? m[1].trim() : '';
      if (declared && declared !== skill.name) {
        problems.push(`.agent/skills/${group.name}/${skill.name}/SKILL.md: frontmatter \`name: ${declared}\` LỆCH tên thư mục \`${skill.name}\` — tra cứu dùng tên thư mục, sửa frontmatter cho khớp.`);
      }
    }
  }
}

for (const w of warns) console.log(`[policy] ⚠ ${w}`);
if (problems.length) {
  console.error('[policy] ✗ Vi phạm 1-nguồn-policy (F3):');
  problems.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}
console.log('[policy] ✓ RULE_GLOBAL.md canonical; core_rules.md là digest có pointer. OK.');
