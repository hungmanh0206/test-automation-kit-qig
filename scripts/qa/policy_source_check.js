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
    // Mỗi đuôi gate CHO QUA phải có mime thật, nếu không uploader gắn `application/octet-stream` ⇒ Backlog không
    // preview ⇒ reviewer phải tải file về mới xem được, tức evidence không còn làm đúng việc của nó.
    // Đây là ràng buộc từng bị vi phạm thật: gate nhận .bmp/.mov/.m4v mà mime map không có.
    if (rules.mimeOf) {
      const noMime = [...allowed].filter((e) => rules.mimeOf(`.${e}`) === 'application/octet-stream');
      if (noMime.length) problems.push(`VISUAL_EXT cho qua đuôi KHÔNG có mime (${noMime.map((x) => `.${x}`).join(' ')}) → Backlog sẽ không preview. Thêm vào MIME_BY_EXT hoặc bỏ khỏi VISUAL_EXT.`);
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
  // QUÉT ĐỆ QUY + REACHABILITY 2 CHẶNG. Hai lỗ của bản trước, cả hai đều làm check này BỎ SÓT chứ không báo sai:
  //
  //   1. `readdirSync(phase)` chỉ đi MỘT tầng ⇒ 15 chương trong `prompt_templates/phase1/dimensions/`
  //      (tách ra 14/08/2026) CHƯA TỪNG được kiểm. Check tồn tại mà không nhìn vào file cần nhìn thì tệ hơn
  //      không có check: nó tạo cảm giác đã gác.
  //   2. Chỉ nhận đường vào TRỰC TIẾP từ `run_phase*` ⇒ nếu bật đệ quy thôi thì ~9 chương chiều bị báo oan,
  //      vì chúng tới được qua BẢNG ĐIỀU HƯỚNG trong `02_gen_testcases.md` — mà `02` lại được `run_phase1` trỏ.
  //      Đó là đường đi HỢP LỆ (2 chặng), y như `run_phase2 → phase2/04 → qa_instincts`.
  //
  // Nên mô hình đúng là LAN TRUYỀN: seed = text của `run_phase*`; file nào được một file ĐÃ tới được nhắc thì
  // cũng tới được; lặp tới khi không thêm gì. Ai không nằm trong tập đó mới là mồ côi thật.
  const allPrompts = [];
  (function walkPT(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walkPT(p); continue; }
      if (!e.name.endsWith('.md')) continue;
      const rel = path.relative(PT_DIR, p).replace(/\\/g, '/');
      if (/^run_phase.*\.md$/.test(rel)) continue;                 // chính điểm vào, không tự kiểm
      // Link trong prompt là đường dẫn TƯƠNG ĐỐI so với file đang viết: `02_gen_testcases.md` trỏ chương chiều
      // bằng `dimensions/05_api.md`, KHÔNG phải `phase1/dimensions/05_api.md`. So bằng rel đầy đủ thì báo oan
      // hàng loạt (đo: 6 chương bị gọi là mồ côi trong khi bảng điều hướng của `02` có đủ 15 link).
      // Nên nhận MỌI hậu tố theo ranh giới `/`. An toàn vì 30/30 tên file trong prompt_templates là DUY NHẤT.
      const parts = rel.split('/');
      const refs = parts.map((_, i) => parts.slice(i).join('/'));
      allPrompts.push({ rel, refs, text: fs.readFileSync(p, 'utf8') });
    }
  })(PT_DIR);

  const reached = new Set();
  let frontier = routerText;
  for (let hop = 0; hop < 6; hop += 1) {                            // 6 chặng là quá đủ; chặn vòng lặp vô hạn
    const added = allPrompts.filter((p) => !reached.has(p.rel) && p.refs.some((r) => frontier.includes(r)));
    if (!added.length) break;
    added.forEach((p) => reached.add(p.rel));
    frontier = added.map((p) => p.text).join('\n');                 // chỉ lan từ file MỚI tới được
  }

  for (const p of allPrompts) {
    if (reached.has(p.rel)) continue;
    if (p.refs.some((r) => alsoText.includes(r))) { warns.push(`prompt_templates/${p.rel}: không tới được từ \`run_phase*\` (kể cả qua prompt trung gian) — chỉ tới được qua workflow/skill. Nên thêm vào bảng "Bản đồ prompt".`); continue; }
    problems.push(`prompt_templates/${p.rel}: KHÔNG có đường vào — không \`run_phase*\`, prompt trung gian, workflow hay skill nào trỏ tới ⇒ prompt mồ côi, sẽ drift âm thầm. Thêm vào bảng "Bản đồ prompt" của run_phase tương ứng, hoặc gộp nội dung rồi xoá file.`);
  }
  console.log(`[policy] ✓ ${reached.size}/${allPrompts.length} prompt tới được từ run_phase* (tính cả đường qua prompt trung gian).`);
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

// ─── npm script phải CÓ NƠI NHẮC TỚI (điểm mù cũ của gate này) ─────────────────────────────────────────
//
// Gate này vốn gác 5 chiều: canonical pointer · CLAUDE.md ↔ code · rule mồ côi · prompt bước có đường vào ·
// lệnh workflow có mặt ở `run_phase*`. Nhưng KHÔNG chiều nào bắt được ca đơn giản nhất: **một `npm run` tồn
// tại trong `package.json` mà KHÔNG nơi nào nhắc tới** ⇒ không ai chạy ⇒ cái nó gác lặng lẽ không xảy ra.
//
// Đây không phải rủi ro lý thuyết: kit ĐÃ bị đúng thế (11 lệnh gate chỉ nằm ở `.agent/workflows/`, mà
// `run_phase2` không trỏ tới workflow nào ⇒ ai theo điểm vào thì không bao giờ chạy chúng). Và đo 17/08/2026:
// 3 lệnh thêm ngày 14/08 (`knowledge:backup`, `howto:find`, `bug:tc-match`) nằm ngoài README/USER_GUIDE và
// ngoài mọi điểm vào suốt 3 ngày — phát hiện bằng cách rà tay, không phải bằng gate.
//
// CHANGELOG cố ý KHÔNG tính là "nơi nhắc": nó kể lịch sử, không điều hướng ai tới lệnh.
{
  const pkgPath = path.join(rc.REPO_ROOT, 'package.json');
  let scripts = {};
  try { scripts = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).scripts || {}; } catch (e) { /* không có package.json */ }
  // `partial-rerun` cũng là ĐIỂM VÀO (agent đọc prompt trong đó để chạy nhánh phụ) — thiếu nó thì lệnh chỉ
  // được nhắc ở nhánh phụ sẽ bị báo mồ côi oan. Lộ ra khi chuyển Xray → AIO: `backlog:testcase-cleanup:dry-run`
  // chỉ còn nằm ở mục LEGACY của `partial-rerun/run_testcase_cleanup.md`.
  const SEARCH_ROOTS = ['prompt_templates', '.agent', 'scripts', '.github', 'exploratory', 'partial-rerun'];
  const SEARCH_FILES = ['README.md', 'USER_GUIDE.md', 'QUICKSTART.md', 'RULE_GLOBAL.md', 'CLAUDE.md', '.gitlab-ci.yml', 'knowledge/SCHEMA.md', '.env.example'];
  const corpus = [];
  const collect = (p) => {
    let st; try { st = fs.statSync(p); } catch (e) { return; }
    if (st.isDirectory()) { for (const f of fs.readdirSync(p)) collect(path.join(p, f)); return; }
    if (!/\.(md|js|mjs|ts|json|ya?ml)$/.test(p)) return;
    if (path.basename(p) === 'package.json' || path.basename(p) === 'CHANGELOG.md') return;
    try { corpus.push(fs.readFileSync(p, 'utf8')); } catch (e) { /* bỏ qua file đọc lỗi */ }
  };
  for (const r of SEARCH_ROOTS) collect(path.join(rc.REPO_ROOT, r));
  for (const f of SEARCH_FILES) collect(path.join(rc.REPO_ROOT, f));
  // Thân của script khác cũng tính (vd `pretest` được gọi bởi `test`) — nếu không thì báo oan hàng loạt.
  const bodies = Object.values(scripts).join('\n');
  const blob = `${corpus.join('\n')}\n${bodies}`;
  // Script vòng đời npm do CHÍNH npm gọi, không tài liệu nào cần trỏ tới ⇒ miễn, nếu không thì báo oan ngay
  // lần đầu ai đó thêm `prepare`/`postinstall`. Đây là ca báo oan DUY NHẤT đoán trước được; ca khác thì để gate
  // kêu rồi xử lý theo từng ca, đừng nới allowlist cho êm.
  const LIFECYCLE = new Set(['prepare', 'preinstall', 'install', 'postinstall', 'prepublishOnly', 'prepack', 'postpack', 'start']);
  const orphanNpm = Object.keys(scripts).filter((k) => !LIFECYCLE.has(k) && !blob.includes(k));
  if (orphanNpm.length) {
    problems.push(`${orphanNpm.length} npm script KHÔNG nơi nào nhắc tới (không prompt/rule/skill/workflow/README/CI nào trỏ) ⇒ sẽ không ai chạy, và thứ nó gác sẽ lặng lẽ không xảy ra: ${orphanNpm.join(', ')}. Trỏ nó từ điểm vào đang cần, hoặc xoá nếu đã hết dùng.`);
  } else {
    console.log(`[policy] ✓ ${Object.keys(scripts).length} npm script đều có nơi nhắc tới (không lệnh nào mồ côi).`);
  }
}

/*
 * ── NO-LEGACY-TOOLS: kit chỉ còn Backlog (bug) + Google Sheet (testcase/execution) ─────────────
 *
 * VÌ SAO CẤM CẢ CHỮ: bản trước của luật này chỉ chặn "dạy Xray như đường chính" và cho qua dòng có
 * nhãn `legacy`. Nhưng khi Xray đã bị bỏ hẳn (script xoá, biến env xoá, dữ liệu đã di trú và đối
 * soát 2103/2103 run), thì mỗi câu còn nhắc nó là một đường mòn dẫn người/agent đi lạc: đi tìm lệnh
 * không còn tồn tại, cấu hình biến không ai đọc, hoặc tưởng còn hai lối để chọn.
 *
 * Phạm vi: mọi bề mặt kit dùng để LÀM VIỆC — prompt, workflow, skill, rule, script, test, doc gốc,
 * `.env.example`. KHÔNG soi `CHANGELOG.md`, `outputs/`, `knowledge/`: đó là LỊCH SỬ, xoá đi là
 * xoá dấu vết việc đã làm.
 */
{
  const ROOTS = ['prompt_templates', '.agent', 'partial-rerun', 'docs/library/src', 'scripts', 'tests'];
  const FILES = ['README.md', 'QUICKSTART.md', 'USER_GUIDE.md', 'RULE_GLOBAL.md', 'CLAUDE.md', '.env.example'];
  /*
   * HAI mẫu, vì tên đầy đủ KHÔNG đủ. Đo 07/09/2026: sơ đồ `phase-selection.png` mang badge `XR` cho
   * bước publish — vết của công cụ đã bỏ, SỐNG SÓT qua đợt xoá 20/08 vì `/xray/i` không khớp hai chữ
   * viết tắt, và ảnh là NHỊ PHÂN nên không gate nào đọc được nội dung. Người dùng nhìn badge của một
   * công cụ không còn tồn tại suốt 2 tuần. Nên siết thêm NHÃN VIẾT TẮT ở chính source sinh ảnh.
   * `\bXR\b` phân biệt hoa-thường và có biên từ: đo được 0 chỗ trùng trong toàn bộ ROOTS ⇒ không báo oan.
   */
  /*
   * MỞ RỘNG 24/09/2026 — chủ dự án yêu cầu bỏ HOÀN TOÀN Jira, Confluence và AIO Tests.
   * Trước đó gate chỉ chặn Xray, nên ba công cụ kia rụng dần bằng tay và vẫn còn 910 dòng nhắc tới
   * chúng ở 146 file. Bằng tay thì lần sau lại mọc lại — nên đưa vào đúng cái máy đã giữ được Xray sạch.
   *
   * Thay thế: Jira → Backlog (REST riêng, `scripts/integrations/backlog/`) · AIO Tests → Google Sheet ·
   * Confluence → KHÔNG có bản thay thế lập trình; tài liệu soạn trong Obsidian vault rồi đưa sang
   * `<TASK_OUTPUT_DIR>/docs/` dạng Markdown.
   *
   * `\bAIO\b` phân biệt hoa-thường + biên từ, để không bắt oan chữ thường trong từ khác.
   */
  const BANNED = [/xray/i, /\bXR\b/, /jira/i, /confluence/i, /\bAIO\b/];
  /*
   * HAI FILE ĐƯỢC MIỄN, và chỉ hai: chính LUẬT này và TEST khoá luật. Ở đó cái tên xuất hiện với vai trò
   * "thứ bị cấm", không phải "đường được dạy" — không miễn thì luật tự tố chính nó và không ai chạy nổi.
   * Miễn theo ĐƯỜNG DẪN CỤ THỂ (không phải theo pattern) để nó không thành lỗ hổng mở rộng dần.
   */
  const SELF = new Set([
    'scripts/qa/policy_source_check.js',
    'tests/fe/infra/gates.spec.ts',
    /*
     * Thêm 07/09/2026: glossary của kit ĐỊNH NGHĨA chính khái niệm "NO-XRAY (cấm cả cái tên)".
     * Ở đó cái tên cũng đứng ở vai trò "thứ bị cấm" — đúng lý do miễn trừ đã viết ở trên, không phải
     * nới luật. Miễn theo ĐƯỜNG DẪN CỤ THỂ như hai file kia.
     */
    'docs/library/src/terms/concepts_expansion.js',
  ]);

  const hits = [];
  const scanFile = (abs) => {
    const rel = path.relative(rc.REPO_ROOT, abs).replace(/\\/g, '/');
    if (SELF.has(rel)) return;
    fs.readFileSync(abs, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (BANNED.some((re) => re.test(line))) hits.push(`${rel}:${i + 1}`);
    });
  };
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const en of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, en.name);
      if (en.isDirectory()) { if (!/node_modules|\.git/.test(en.name)) walk(abs); continue; }
      /*
       * PHỔ ĐUÔI FILE, đo 04/09/2026 trong các ROOTS này: .ts 138 · .js 125 · .md 104 · .json 18 · .yml 6 ·
       * .mjs 1 — và BỎ SÓT .sh (1) + .html (2). Đúng chỗ đó có một vi phạm thật: script khai CI Variables in
       * "[Backlog / Xray / tài liệu nguồn]" ra màn hình suốt, mà gate vẫn báo ✓ vì `.sh` không nằm trong bộ lọc.
       * Thêm luôn `bash|ps1|yaml|sql` để đuôi mới không lại thành lỗ hổng lặng.
       * KHÔNG quét `.env`: đó là file creds (gitignored), không phải bề mặt của kit, và soi vào chỉ tăng
       * nguy cơ secret rơi vào thông báo lỗi.
       */
      if (/\.(md|js|mjs|ts|json|yml|yaml|example|sh|bash|ps1|sql|html)$/.test(en.name)) scanFile(abs);
    }
  };
  for (const r of ROOTS) walk(path.join(rc.REPO_ROOT, r));
  for (const f of FILES) { const abs = path.join(rc.REPO_ROOT, f); if (fs.existsSync(abs)) scanFile(abs); }

  if (hits.length) {
    problems.push(`NO-LEGACY-TOOLS: ${hits.length} chỗ còn nhắc công cụ đã bỏ (Xray · Jira · Confluence · AIO Tests). Thay bằng: bug→Backlog, testcase/execution→Google Sheet, tài liệu→Markdown trong task folder: ${hits.slice(0, 15).join(' · ')}${hits.length > 15 ? ` … (+${hits.length - 15})` : ''}. Xoá hoặc viết lại — đừng để lại đường mòn dẫn tới lệnh/biến không còn tồn tại.`);
  } else {
    console.log('[policy] ✓ không bề mặt nào của kit còn nhắc công cụ đã bỏ (NO-LEGACY-TOOLS sạch: Xray · Jira · Confluence · AIO).');
  }
}


/*
 * F12 — CÂN BẰNG GIỮA CÁC NHÁNH. Mẫu hình lặp 5 lần trong đợt rà 23/08/2026: kit xây cơ chế tốt nhưng nối
 * KHÔNG ĐỀU — 7 gate mạnh nhất chỉ là npm script · `knowledge:backup` không ai gọi · khâu sinh code Phase 2
 * không có gate · nhánh rerun 0 gate máy dù nó là nhánh TRỰC TIẾP chuyển bug sang Done. Mỗi lần đều do
 * người ngoài chỉ ra, vì không phép đo nào trả lời được "cơ chế nào đã có mà chưa dùng ở nhánh cần nó".
 * Nay có: `.agent/config/branch_parity.json` khai máy nào phải xuất hiện ở nhánh nào; không áp dụng thì
 * phải ghi `waived` KÈM LÝ DO — miễn trừ viết ra được thì tranh luận được, im lặng thì không.
 */
{
  const cfgPath = path.join(rc.REPO_ROOT, '.agent', 'config', 'branch_parity.json');
  let cfg = null;
  try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch (e) { problems.push(`branch_parity.json không đọc được (${e.message}) ⇒ không đo được độ đều giữa các nhánh.`); }
  if (cfg) {
    const textOf = (rel) => {
      const abs = path.join(rc.REPO_ROOT, rel);
      if (!fs.existsSync(abs)) return '';
      if (fs.statSync(abs).isDirectory()) {
        let all = '';
        for (const f of fs.readdirSync(abs)) { const p2 = path.join(abs, f); if (fs.statSync(p2).isFile()) all += fs.readFileSync(p2, 'utf8'); }
        return all;
      }
      return fs.readFileSync(abs, 'utf8');
    };
    const branchText = {};
    for (const [b, paths] of Object.entries(cfg.branches || {})) branchText[b] = paths.map(textOf).join(String.fromCharCode(10));
    let checked = 0;
    for (const [machine, spec] of Object.entries(cfg.machines || {})) {
      for (const b of spec.applies || []) {
        checked += 1;
        if (!branchText[b]) { problems.push(`branch_parity: nhánh "${b}" khai trong \`applies\` của \`${machine}\` nhưng KHÔNG có file nào ⇒ phép đo hỏng.`); continue; }
        if (!branchText[b].includes(machine)) {
          problems.push(`branch_parity: nhánh **${b}** KHÔNG nhắc \`${machine}\` — ${spec.why} Nối vào bước của nhánh đó, hoặc khai \`waived.${b}\` kèm lý do trong \`.agent/config/branch_parity.json\`.`);
        }
      }
      for (const [b, reason] of Object.entries(spec.waived || {})) {
        if (!String(reason || '').trim()) problems.push(`branch_parity: \`${machine}\` miễn trừ nhánh "${b}" mà KHÔNG có lý do — miễn trừ im lặng là cách bỏ cơ chế mà không ai thấy.`);
        if ((spec.applies || []).includes(b)) problems.push(`branch_parity: \`${machine}\` vừa \`applies\` vừa \`waived\` nhánh "${b}" — khai xung đột.`);
      }
    }
    if (!problems.some((x) => x.startsWith('branch_parity'))) console.log(`[policy] ✓ ${checked} cặp (máy × nhánh) đều được nối; miễn trừ nào cũng có lý do.`);
  }
}

for (const w of warns) console.log(`[policy] ⚠ ${w}`);
if (problems.length) {
  console.error('[policy] ✗ Vi phạm 1-nguồn-policy (F3):');
  problems.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}
console.log('[policy] ✓ RULE_GLOBAL.md canonical; core_rules.md là digest có pointer. OK.');
