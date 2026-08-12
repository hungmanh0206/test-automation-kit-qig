#!/usr/bin/env node
'use strict';

/*
 * skills_index — sinh bảng tra skill từ frontmatter của `.agent/skills/**\/SKILL.md`.
 *
 * VÌ SAO CẦN: skill của kit KHÔNG nằm ở `.claude/skills/` (đường dẫn harness tự phát hiện) và cũng không
 * được hook nào bơm vào. Prompt/workflow chỉ nhắc TÊN skill trong backtick, nên muốn dùng được thì agent phải
 * tự đoán ra file nằm ở `.agent/skills/<phase>/<tên>/SKILL.md` rồi tự mở. Thiếu một mắt xích là skill bị bỏ
 * qua ÂM THẦM — không lỗi, không cảnh báo, chỉ là nội dung không bao giờ được đọc. (Đã đo: 21/21 skill được
 * prompt nhắc tên, 0 skill được nạp tự động.)
 *
 * Script này chỉ làm một việc: đọc frontmatter → bảng `tên · đường dẫn · description`. Cố ý giữ dạng dữ liệu
 * trung lập (markdown + JSON, đường dẫn `.agent/`), KHÔNG phụ thuộc hãng nào:
 *   · Claude Code : SessionStart hook bơm bảng này vào context (scripts/qa/hooks/inject_context.js)
 *   · agent khác  : trỏ file always-read của hãng đó vào `.agent/skills/INDEX.md`
 *
 * Dùng: node scripts/qa/skills_index.js [--write] [--json]
 *   (mặc định in ra stdout; --write ghi .agent/skills/INDEX.md)
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const ROOT = path.join(rc.REPO_ROOT, '.agent', 'skills');
const OUT = path.join(ROOT, 'INDEX.md');

/** Đọc frontmatter tối giản (chỉ cần name + description, mỗi cái 1 dòng). */
function frontmatter(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out.name ? out : null;
}

function collect() {
  const rows = [];
  const walk = (dir) => {
    for (const e of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (e.name !== 'SKILL.md') continue;
      const fm = frontmatter(p);
      const rel = path.relative(rc.REPO_ROOT, p).replace(/\\/g, '/');
      // KHOÁ theo TÊN THƯ MỤC, không theo frontmatter `name`: prompt/workflow nhắc skill bằng tên thư mục
      // (vd `git_impact_analyzer`). Index khoá nhầm khoá thì tra là trượt — đúng kiểu hỏng âm thầm mà index
      // này sinh ra để chống. Lịch sử: 5/21 skill từng ghi frontmatter kiểu gạch-ngang; cảnh báo ở đây chỉ
      // nhắc chứ không chặn nên tồn đọng lâu ⇒ 12/08/2026 đã dọn hết và chốt bằng gate trong
      // `policy_source_check.js` (lệch tên = exit 1). Cảnh báo dưới đây giữ lại để báo sớm ngay khi sinh index.
      const dirName = path.basename(path.dirname(p));
      if (!fm) { rows.push({ name: dirName, file: rel, description: '(THIẾU frontmatter name/description)', group: rel.split('/')[2] || '', broken: true }); continue; }
      rows.push({
        name: dirName,
        aliasInFile: fm.name && fm.name !== dirName ? fm.name : null,
        file: rel,
        description: fm.description || '(thiếu description)',
        group: rel.split('/')[2] || '',
        broken: !fm.description,
      });
    }
  };
  walk(ROOT);
  return rows.sort((a, b) => `${a.group}${a.name}`.localeCompare(`${b.group}${b.name}`));
}

const rows = collect();

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
  process.exit(0);
}

const L = [
  '# Skills Index (SINH TỰ ĐỘNG — đừng sửa tay)',
  '',
  '> Sinh bởi `node scripts/qa/skills_index.js --write`. Skill của kit nằm ở `.agent/skills/**` — KHÔNG phải',
  '> `.claude/skills/`, nên harness không tự phát hiện. Bảng này là cách agent biết skill nào có và nằm ở đâu.',
  '',
  '| Skill | Nhóm | File | Dùng khi |',
  '|---|---|---|---|',
];
for (const r of rows) L.push(`| \`${r.name}\` | ${r.group || '-'} | \`${r.file}\` | ${String(r.description).replace(/\|/g, '\\|')} |`);
const alias = rows.filter((r) => r.aliasInFile);
L.push('', `> ${rows.length} skill. Thiếu description: ${rows.filter((r) => r.broken).length}.`);
if (alias.length) {
  L.push('', `> ⚠ ${alias.length} skill có frontmatter \`name\` LỆCH tên thư mục. Tra cứu dùng tên thư mục (đó là tên prompt/workflow nhắc); nên sửa frontmatter cho khớp: ${alias.map((a) => `\`${a.name}\` (file ghi \`${a.aliasInFile}\`)`).join(' · ')}`);
}
const md = `${L.join('\n')}\n`;

if (process.argv.includes('--write')) {
  fs.writeFileSync(OUT, md, 'utf8');
  console.log(`[skills] ${rows.length} skill → ${path.relative(rc.REPO_ROOT, OUT).replace(/\\/g, '/')}`);
  const broken = rows.filter((r) => r.broken);
  if (broken.length) console.log(`[skills] ⚠ ${broken.length} skill thiếu name/description trong frontmatter: ${broken.map((b) => b.name).join(', ')} — agent sẽ không biết khi nào nên dùng.`);
} else {
  process.stdout.write(md);
}
