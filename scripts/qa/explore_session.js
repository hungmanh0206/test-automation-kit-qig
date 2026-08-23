#!/usr/bin/env node
'use strict';

/*
 * explore_session.js — MÁY cho nhánh exploratory: kiểm phiên + đóng vòng học.
 *
 * VÌ SAO CÓ FILE NÀY: `exploratory/` trước đây toàn văn bản. Mọi rule ("phải có bước tái hiện", "evidence
 * là ảnh/video", "không PII", "draft KHÔNG được vào coverage", "4 file output") chỉ là lời dặn — không gì
 * kiểm. Đúng lớp lỗ hổng lặp lại của kit: thiếu MÁY, không thiếu quy định. Và phiên xong thì tri thức nằm
 * lại trong `<TASK_OUTPUT_DIR>` rồi thôi ⇒ sprint sau dò lại đúng chỗ cũ.
 *
 * HAI VIỆC:
 *   `--check`  (mặc định)  kiểm output của phiên; `--enforce` thì lệch = exit 1.
 *   `--close`             ghi record vào `knowledge/explorations/` để lần sau biết vùng nào đã soi.
 *
 * KHÔNG tự kết luận PASS/FAIL, KHÔNG đẩy draft vào coverage — đúng ranh giới của nhánh phụ.
 *
 * Dùng:
 *   TASK_ENV=profiles/<TASK>/task.env npm run explore:check
 *   ... npm run explore:check -- --enforce
 *   ... npm run explore:close -- --areas "Checkout,Transaction list" --tours "D,T,Interruption"
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const rules = require(path.resolve(__dirname, 'lib', 'output_rules'));

const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const csv = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

const FILES = ['session-charter.md', 'observations.md', 'crash-log.md', 'draft-testcases.md'];
/* Ảnh/video mới là evidence — dùng CHUNG regex đuôi của output_rules để không sinh luật thứ hai. */
const VISUAL = rules.VISUAL_EXT;   // regex sẵn có của output_rules — 1 nguồn cho đuôi evidence, không khai lại
/* PII: cùng họ pattern với gate output (email/sđt VN). Cố ý KHÔNG bắt tên người — quá nhiều báo oan. */
const PII = [/[\w.+-]+@[\w-]+\.[\w.]+/, /(?:^|[^\d])(0\d{9}|\+84\d{9})(?!\d)/];

/** Nội dung có "bước tái hiện" hay chỉ là cảm nhận? Nhận cả 2 cách viết: đánh số hoặc mục "Bước". */
const hasRepro = (block) => /(^|\n)\s*1[.)]\s+\S/.test(block) || /b(ướ|uo)c t(á|a)i hi(ệ|e)n/i.test(block) || /không tái hiện/i.test(block);

function readSession(dir) {
  const out = {};
  for (const f of FILES) {
    const p = path.join(dir, f);
    out[f] = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  }
  return out;
}

/** Cắt file quan sát thành từng mục theo heading `##`/`###` để kiểm từng phát hiện, không kiểm cả file. */
function sections(md) {
  const parts = String(md || '').split(/\n(?=#{2,3}\s)/).map((s) => s.trim()).filter(Boolean);
  return parts.filter((p) => /^#{2,3}\s/.test(p));
}

function check(dir) {
  const problems = []; const warnings = []; const info = [];
  const s = readSession(dir);

  const missing = FILES.filter((f) => s[f] === null);
  if (missing.length === FILES.length) {
    problems.push(`Không thấy file nào của phiên trong ${path.relative(rc.REPO_ROOT, dir)} — chạy phiên theo \`exploratory/run_exploratory_session.md\` trước.`);
    return { problems, warnings, info };
  }
  for (const f of missing) problems.push(`Thiếu \`${f}\` — phiên exploratory phải để lại đủ 4 file (charter · observations · crash-log · draft). Không có file nào thì coi như không có phiên đó.`);

  // charter: phải có scope + timebox, nếu không thì "dò tự do" chứ không phải charter-based
  if (s['session-charter.md']) {
    const c = s['session-charter.md'];
    if (!/timebox|thời lượng|phút|giờ/i.test(c)) problems.push('`session-charter.md` không nêu **timebox** — không có giới hạn thì phiên trở thành dò vô hạn, và không so được giữa các phiên.');
    if (!/scope|phạm vi|màn|luồng|module/i.test(c)) problems.push('`session-charter.md` không nêu **scope** (màn/luồng/module) — charter không có vùng dò thì không ai biết phiên này đã soi cái gì.');
    if (!/tour/i.test(c)) warnings.push('`session-charter.md` chưa nêu **tour** đã chọn — nêu 2–3 tour từ `exploratory/tours.md` để phiên sau biết chỗ nào đã dò theo kiểu nào.');
  }

  // observations: mỗi mục phải có bước tái hiện + evidence ảnh/video
  const obs = sections(s['observations.md']);
  if (s['observations.md'] !== null && !obs.length) {
    warnings.push('`observations.md` không có mục nào (`##`) — phiên không quan sát được gì cũng là kết quả, nhưng phải ghi rõ đã dò phép nào mà không thấy.');
  }
  let noRepro = 0; let noEv = 0;
  for (const o of obs) {
    const title = o.split('\n')[0].replace(/^#+\s*/, '').slice(0, 60);
    if (!hasRepro(o)) { noRepro++; problems.push(`observation "${title}": thiếu **bước tái hiện** (đánh số 1./2./… hoặc ghi rõ "không tái hiện"). Quan sát không tái hiện được mà không nói ra thì người sau không kiểm lại được.`); }
    if (!VISUAL.test(o)) { noEv++; problems.push(`observation "${title}": thiếu **evidence ảnh/video**. File \`.md/.json/.log\` KHÔNG phải evidence (luật chung của kit).`); }
  }

  // crash-log: có crash thì phải có bước lặp lại; và crash nghiêm trọng ⇒ nhắc dừng dò
  const crashes = sections(s['crash-log.md']);
  for (const c of crashes) {
    const title = c.split('\n')[0].replace(/^#+\s*/, '').slice(0, 60);
    if (!hasRepro(c)) problems.push(`crash "${title}": thiếu bước lặp lại — crash không tái hiện được thì Phase 2 không triage được.`);
  }
  if (crashes.length) info.push(`${crashes.length} crash đã ghi ⇒ luật DỪNG SỚM: chuyển triage (Phase 2) chứ không dò tiếp trên hệ thống đang lỗi.`);

  // draft: KHÔNG được nằm trong test-cases/ (đó là đường vào coverage)
  const tcDir = path.join(path.dirname(dir), 'test-cases');
  if (fs.existsSync(tcDir)) {
    const leaked = fs.readdirSync(tcDir).filter((f) => /draft|exploratory|explore/i.test(f));
    if (leaked.length) problems.push(`Draft exploratory nằm trong \`test-cases/\` (${leaked.join(', ')}) — đó là thư mục canonical mà mọi gate đếm coverage. Draft phải ở \`exploratory/\` tới khi qua \`tc_validator\` + mục 17.`);
  }

  // PII trong mọi file
  for (const f of FILES) {
    if (!s[f]) continue;
    for (const re of PII) {
      const hit = s[f].match(re);
      if (hit) { problems.push(`\`${f}\`: có dấu hiệu PII khách (${String(hit[0]).slice(0, 4)}…) — mask trước khi lưu (luật chung, không có ngoại lệ cho exploratory).`); break; }
    }
  }

  // "đáng chính thức hoá": tiêu chí máy đọc được, nêu ra để người quyết chứ không tự đẩy
  const drafts = sections(s['draft-testcases.md']);
  if (drafts.length) {
    const weak = drafts.filter((d) => !/oracle_ref|BR-|SM-|PM-|SS-|DM-|UI-/.test(d) && !/tự mâu thuẫn|self.?inconsistent/i.test(d));
    info.push(`${drafts.length} draft · ${drafts.length - weak.length} có NEO (oracle_ref hoặc app tự mâu thuẫn).`);
    if (weak.length) warnings.push(`${weak.length}/${drafts.length} draft chưa có neo (\`oracle_ref\` hoặc "app tự mâu thuẫn") ⇒ theo tiêu chí "đáng chính thức hoá" thì CHƯA đủ để vào backlog Phase 1: giữ ở \`observations.md\` + câu hỏi mở cho BA. Nhất quán KHÔNG phải bằng chứng của đúng.`);
  }

  if (noRepro || noEv) info.push(`Tổng: ${noRepro} quan sát thiếu bước tái hiện · ${noEv} thiếu evidence.`);
  return { problems, warnings, info };
}

/** Ghi record vào kho — để phiên sau KHÔNG dò lại chỗ cũ và để charter proposer xếp hạng được. */
function close(dir, taskKey) {
  const s = readSession(dir);
  const areas = csv(arg('areas', ''));
  const tours = csv(arg('tours', ''));
  if (!areas.length) { console.error('ERROR: cần `--areas "<vùng đã dò>"` — không ghi vùng thì record vô dụng cho lần sau.'); process.exit(2); }

  const obs = sections(s['observations.md']).length;
  const crashes = sections(s['crash-log.md']).length;
  const drafts = sections(s['draft-testcases.md']).length;
  const today = new Date().toISOString().slice(0, 10);
  const slug = `${taskKey}__${today}`.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-');
  const rec = {
    id: slug,
    task_key: taskKey,
    date: today,
    areas,
    tours,
    counts: { observations: obs, crashes, drafts },
    charter_excerpt: String(s['session-charter.md'] || '').split('\n').filter((l) => l.trim() && !l.startsWith('#')).slice(0, 3).join(' ').slice(0, 300),
    _why_matters: 'Vùng đã soi bằng exploratory: lần sau chọn charter thì tránh dò lại chỗ này (trừ khi vùng đã đổi), và risk có thêm tín hiệu "đã được soi kỹ".',
  };
  const outDir = path.join(rc.REPO_ROOT, 'knowledge', 'explorations');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${slug}.json`);
  fs.writeFileSync(out, `${JSON.stringify(rec, null, 2)}\n`);
  console.log(`[explore] đã ghi kho: knowledge/explorations/${slug}.json`);
  console.log(`[explore]   vùng: ${areas.join(' · ')} · tour: ${tours.join(' · ') || '(chưa nêu)'} · ${obs} quan sát · ${crashes} crash · ${drafts} draft`);
  console.log('[explore] ⓘ knowledge/** KHÔNG được commit (dữ liệu công ty) — nhớ `npm run knowledge:backup`.');
}

function main() {
  const taskKey = rc.getTaskKey();
  const dir = path.join(rc.getTaskOutputDir(), 'exploratory');

  if (flag('close')) { close(dir, taskKey); return; }

  const { problems, warnings, info } = check(dir);
  console.log(`[explore] phiên của ${taskKey} · ${path.relative(rc.REPO_ROOT, dir)}`);
  info.forEach((i) => console.log(`[explore] ⓘ ${i}`));
  warnings.forEach((w) => console.log(`[explore] ⚠ ${w}`));
  if (problems.length) {
    console.error(`[explore] ✗ ${problems.length} vi phạm:`);
    problems.forEach((p) => console.error(`  - ${p}`));
    if (flag('enforce')) process.exit(1);
    return;
  }
  console.log('[explore] ✓ phiên đủ chuẩn: 4 file · mọi quan sát có bước tái hiện + evidence · không PII · draft chưa lọt vào coverage.');
}

if (require.main === module) main();
module.exports = { check, sections, hasRepro };
