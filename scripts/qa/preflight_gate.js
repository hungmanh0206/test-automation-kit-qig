#!/usr/bin/env node
'use strict';

/*
 * preflight_gate.js (G1 — round-3) — CHẶN "miss đọc file / input hỏng" TRƯỚC khi workflow chạy.
 *
 * Vì sao: agent có thể lướt/quên đọc input bắt buộc (project_context, catalog, testcase, config),
 * hoặc config bị malformed → cả phase chạy trên nền sai. Gate này biến "đọc đủ input" thành check
 * THỰC THI, gọi bởi entrypoint/CI (KHÔNG để agent tự nhớ):
 *   - require : file BẮT BUỘC tồn tại — thiếu = CHẶN (miss file).
 *   - parse   : file JSON — tồn tại mà malformed = CHẶN (PARSE_FAILURE).
 *   - recommend: nên có — thiếu = CẢNH BÁO (không chặn).
 *   - phase2 + task: testcase canonical LOCAL phải có trước execute (nếu không = CHẶN).
 *
 * Dùng CLI:
 *   node scripts/qa/preflight_gate.js --mode generic          # CI/static: config integrity
 *   node scripts/qa/preflight_gate.js --mode phase2 --task <TASK_KEY>
 *   thêm --require a,b (bắt buộc thêm) · --allow-missing x,y (hạ xuống cảnh báo) · --qa-approved (bỏ qua có log)
 * Dùng module: const { runPreflight } = require('./preflight_gate'); const { problems, warnings } = runPreflight({ mode, task });
 * Exit: 0 = đạt (hoặc --qa-approved) · 1 = có CHẶN · 2 = lỗi dùng sai.
 */

const fs = require('fs');
const { getTestcaseDirs } = require('../utils/runtime_config');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

// Manifest input bắt buộc theo mode. Chỉ liệt file TRACKED (CI thấy) để không false-block.
//
// `knowledge/index.json` là RECOMMEND, không phải REQUIRE: nó là artifact SINH RA (`domain:index`,
// `system:index`, `decisions --index`, `learn -- --scan`) và từ 12/08/2026 không còn được commit — cả
// `knowledge/**` là dữ liệu công ty, đối xử như `.env`. Gate mà đòi một file generated + không-commit thì
// clone mới hay CI sẽ đỏ vì thiếu DỮ LIỆU, chứ không phải vì thiếu KHUNG — đúng kiểu false-block mà dòng
// trên đã cảnh báo. Thiếu index chỉ là "chưa nạp learning data", nên cảnh báo là đủ.
const MANIFEST = {
  generic: {
    require: ['.agent/config/project_context.md'],
    parse: ['knowledge/index.json', '.agent/config/risk_model.example.json', '.agent/config/dashboard.branding.example.json', '.agent/config/verdict_taxonomy.json'],
    recommend: ['.agent/config/risk_model.json', 'knowledge/index.json'],
  },
  phase1: {
    require: ['.agent/config/project_context.md'],
    parse: ['knowledge/index.json', '.agent/config/risk_model.example.json'],
    recommend: ['.agent/config/risk_model.json', 'knowledge/index.json'],
  },
  phase2: {
    require: ['.agent/config/project_context.md'],
    parse: ['knowledge/index.json'],
    recommend: ['.agent/config/risk_model.json', 'knowledge/index.json'],
    taskTestcase: true,
  },
  publish: {
    require: [],
    parse: ['knowledge/index.json'],
    recommend: ['knowledge/index.json'],
  },
};

const abs = (p) => path.resolve(rc.REPO_ROOT, p);
const rel = (p) => path.relative(rc.REPO_ROOT, p).replace(/\\/g, '/');

/**
 * Chạy preflight thuần (không exit) → { problems, warnings, mode, task }.
 * @param {object} o { mode, task, extraRequire:[], allowMissing:[], projectOutputDir }
 */
function runPreflight({ mode = 'generic', task = '', extraRequire = [], allowMissing = [], projectOutputDir = process.env.PROJECT_OUTPUT_DIR || '' } = {}) {
  const cfg = MANIFEST[mode];
  if (!cfg) return { error: `mode "${mode}" không hỗ trợ (generic|phase1|phase2|publish)`, problems: [], warnings: [] };
  const problems = [];
  const warnings = [];
  const allow = new Set(allowMissing);

  // 1) require exist
  for (const p of [...(cfg.require || []), ...extraRequire]) {
    if (!fs.existsSync(abs(p))) {
      if (allow.has(p)) warnings.push(`(allow-missing) không thấy: ${p}`);
      else problems.push(`THIẾU input bắt buộc: ${p}`);
    }
  }
  // 2) parse JSON (tồn tại mà malformed = CHẶN)
  for (const p of cfg.parse || []) {
    const a = abs(p);
    if (!fs.existsSync(a)) continue;
    try { JSON.parse(fs.readFileSync(a, 'utf8')); } catch (e) { problems.push(`PARSE_FAILURE: ${p} không phải JSON hợp lệ (${e.message})`); }
  }
  // 3) recommend (thiếu = cảnh báo)
  for (const p of cfg.recommend || []) {
    if (!fs.existsSync(abs(p))) warnings.push(`nên có (không chặn): ${p}`);
  }
  // 4) phase2 + task: testcase canonical LOCAL phải có trước execute.
  if (cfg.taskTestcase && task) {
    if (!projectOutputDir) {
      warnings.push('phase2: chưa set PROJECT_OUTPUT_DIR → không kiểm được testcase canonical local (bỏ qua check này)');
    } else {
      const taskDir = abs(path.join(projectOutputDir, 'tasks', task));
      const tcDir = path.join(taskDir, 'test-cases');
      let found = 0;
      for (const d of getTestcaseDirs(taskDir, { mirrorsFirst: true })) {
        try { found += fs.readdirSync(d).filter((f) => /\.xlsx$/i.test(f)).length; } catch (e) { /* dir chưa có */ }
      }
      if (!found) problems.push(`phase2: KHÔNG thấy testcase canonical local ở ${rel(tcDir)}(/from-aio) — Phase 2 phải kéo từ AIO (\`npm run aio:pull:write\`) hoặc có Excel TRƯỚC execute`);

      /*
       * ĐỘ TƯƠI CỦA MIRROR. AIO là source of truth ⇒ "có file" chưa đủ, phải biết file là AIO LÚC NÀO.
       * `aio:pull:write` ghi manifest kèm `updatedDate` từng case; ở đây chỉ đọc local (preflight phải
       * chạy được offline), phần so với AIO thật là `npm run aio:verify:enforce`.
       * Ngưỡng 12 giờ: đủ để một buổi làm việc không bị nhắc liên tục, nhưng mirror qua đêm thì phải
       * pull lại — QA sửa expected trên AIO là chuyện thường ngày.
       */
      const mirrorDir = path.join(tcDir, 'from-aio');
      if (fs.existsSync(mirrorDir)) {
        const mans = fs.readdirSync(mirrorDir).filter((f) => f.endsWith('.manifest.json'));
        if (!mans.length) {
          warnings.push(`phase2: mirror from-aio KHÔNG có manifest ⇒ không biết bản này là AIO lúc nào. Chạy \`npm run aio:pull:write\` (bản mới ghi manifest) rồi \`npm run aio:verify:enforce\` trước khi execute.`);
        } else {
          for (const f of mans) {
            let m; try { m = JSON.parse(fs.readFileSync(path.join(mirrorDir, f), 'utf8')); } catch (e) { continue; }
            const ageH = (Date.now() - Date.parse(m.pulledAt)) / 3600000;
            if (!Number.isFinite(ageH)) continue;
            if (ageH > 12) problems.push(`phase2: mirror \`${f.replace(/\.manifest\.json$/, '.xlsx')}\` pull cách đây ${Math.round(ageH)} giờ — AIO là source of truth nên execute trên bản này có thể chấm theo expected ĐÃ BỊ SỬA. Chạy \`npm run aio:pull:write\` rồi \`npm run aio:verify:enforce\`.`);
            else warnings.push(`phase2: mirror pull cách đây ${ageH < 1 ? '<1' : Math.round(ageH)} giờ (${Object.keys(m.cases || {}).length} case) — vẫn nên chạy \`npm run aio:verify:enforce\` để chắc AIO chưa đổi.`);
          }
        }
      }
    }
  }

  // Hai chiều "im lặng là hỏng": harness hook tắt · knowledge chưa có bản sao ngoài máy.
  // Tách thành hàm thuần (xuất ở cuối file) để có test kiểm chính nó, thay vì kiểm bằng mắt.
  warnings.push(...checkHarnessHooks(rc.REPO_ROOT));
  warnings.push(...checkKnowledgeBackup(rc.REPO_ROOT, process.env));

  return { problems, warnings, mode, task };
}

/*
 * HARNESS HOOK — hai hook mạnh nhất nằm NGOÀI git (cấu hình ở `.claude/settings.json`, đã gitignore).
 * Máy mới clone: hook không chạy mà không có tiếng động nào — đúng bẫy kit vốn chống ("harness chống
 * quên" lại phụ thuộc người nhớ cấu hình tay). CẢNH BÁO chứ không CHẶN: đây là cấu hình máy-cá-nhân,
 * chặn ở đây sẽ khoá cả CI lẫn người mới vào việc.
 */
const HARNESS_HOOKS = [
  ['scripts/qa/hooks/gate_on_write.js', 'chặn output sai NGAY LÚC agent ghi file'],
  ['scripts/qa/hooks/inject_context.js', 'bơm context để agent không bỏ qua file phải đọc'],
];
function checkHarnessHooks(root) {
  const out = [];
  const settingsPath = path.join(root, '.claude', 'settings.json');
  let declared = '';
  if (fs.existsSync(settingsPath)) {
    try { declared = JSON.stringify(JSON.parse(fs.readFileSync(settingsPath, 'utf8')).hooks || {}); } catch (e) { out.push('harness: `.claude/settings.json` KHÔNG parse được ⇒ hook coi như TẮT. Sửa JSON rồi mở lại /hooks.'); }
  } else {
    out.push('harness: KHÔNG có `.claude/settings.json` ⇒ 2 hook forcing-function đang TẮT. Copy mẫu trong `scripts/qa/hooks/README.md`. Không chặn, nhưng biết mà chạy thì khác hẳn: gate lúc-ghi-file bắt sai sớm hơn gate cuối phase.');
  }
  for (const [f, why] of HARNESS_HOOKS) {
    if (!fs.existsSync(path.join(root, f))) continue;            // hook không có trong repo thì không đòi khai
    if (declared.includes(path.basename(f))) continue;
    out.push(`harness: hook \`${path.basename(f)}\` có trong repo nhưng CHƯA được khai trong \`.claude/settings.json\` ⇒ đang tắt (${why}). Mẫu JSON: \`scripts/qa/hooks/README.md\`.`);
  }
  return out;
}

/*
 * KNOWLEDGE BACKUP — `knowledge:backup` là lệnh KHÔNG được nhắc ở bất kỳ prompt/workflow/rule nào (đo
 * 23/08/2026: 0 nơi). Nó bảo vệ đúng phần đắt nhất: store ghi tay từ FSD/BA/dev — mất là làm lại công
 * sức người, không phải chạy lại script. Và `knowledge/**` bị gitignore nên không remote nào giữ hộ.
 */
const PRECIOUS_STORES = ['domain', 'system', 'decisions', 'setup_recipes', 'environment', 'locators', 'explorations'];
function checkKnowledgeBackup(root, env) {
  let count = 0;
  for (const s of PRECIOUS_STORES) {
    const d = path.join(root, 'knowledge', s);
    if (!fs.existsSync(d)) continue;
    try { count += fs.readdirSync(d).filter((f) => f.endsWith('.json')).length; } catch (e) { /* thư mục không đọc được: bỏ qua, không phán */ }
  }
  if (!count || String((env || {}).KNOWLEDGE_BACKUP_DIR || '').trim()) return [];
  return [`knowledge: ${count} record thuộc nhóm KHÔNG NẠP LẠI ĐƯỢC mà chưa khai \`KNOWLEDGE_BACKUP_DIR\` ⇒ chưa có bản sao nào ngoài máy này (knowledge/** bị gitignore). Chạy \`KNOWLEDGE_BACKUP_DIR=<thư mục NGOÀI repo> npm run knowledge:backup\`.`];
}

function main() {
  const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
  const has = (n) => process.argv.includes(`--${n}`);
  const csv = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

  const mode = arg('mode', 'generic');
  const task = arg('task', process.env.TASK_KEY || '');
  const QA_APPROVED = has('qa-approved');

  const res = runPreflight({ mode, task, extraRequire: csv(arg('require', '')), allowMissing: csv(arg('allow-missing', '')) });
  if (res.error) { console.error(`[preflight] ${res.error}`); process.exit(2); }
  const { problems, warnings } = res;

  console.log(`[preflight] mode=${mode}${task ? ` · task=${task}` : ''} · ${problems.length} CHẶN · ${warnings.length} cảnh báo.`);
  if (warnings.length) { console.log('\n[preflight] ⚠ Cảnh báo:'); warnings.forEach((w) => console.log(`  ~ ${w}`)); }
  if (!problems.length) { console.log('\n[preflight] ✓ ĐẠT — input bắt buộc đủ & config parse được.'); process.exit(0); }

  console.log('\n[preflight] ✗ VI PHẠM (input bắt buộc thiếu/hỏng — ĐỌC/SỬA rồi chạy lại, đừng bắt đầu workflow):');
  problems.forEach((p) => console.log(`  - ${p}`));
  if (QA_APPROVED) { console.log('\n[preflight] [--qa-approved] cố ý bỏ qua → exit 0 (đã log vi phạm).'); process.exit(0); }
  console.log('\n[preflight] BLOCK.');
  process.exit(1);
}

module.exports = { runPreflight, MANIFEST, checkHarnessHooks, checkKnowledgeBackup };

if (require.main === module) main();
