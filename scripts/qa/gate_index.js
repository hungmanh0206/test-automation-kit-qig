#!/usr/bin/env node
'use strict';
/*
 * gate_index — sinh DANH MỤC GATE của kit từ chính source, không viết tay.
 *
 * VÌ SAO CẦN: kit có 31 npm script dạng gate và 56 file trong `scripts/qa/`, nhưng không chỗ nào trả lời
 * được câu "kit có bao nhiêu gate, mỗi cái CHẶN gì, gọi ở đâu". Hệ quả không phải bất tiện: luận đề của
 * kit là "luật cần MÁY", mà máy không LIỆT KÊ ĐƯỢC thì không kiểm toán được — không ai biết một gate đã
 * âm thầm thành cảnh báo, hay đã mất nơi gọi.
 *
 * Thông tin MỚI mà bảng này ghi (chưa máy nào trong kit ghi): mức CHẶN vs CẢNH BÁO. Suy từ source —
 * có `process.exit(1)` / `exitCode = 1` là CHẶN, chỉ in cảnh báo là CẢNH BÁO. Đây đúng chỗ dễ trôi nhất:
 * nới một gate thành cảnh báo là sửa một dòng, và không có gì ghi lại việc đó.
 *
 * Theo khuôn của kit: generator KHÁC enforcer. `skills_index.js` sinh bảng, `policy_source_check.js` mới
 * chặn khi lệch. Ở đây `--check` làm phần chặn: sinh lại trong bộ nhớ rồi so với file đang track.
 *
 * Dùng: node scripts/qa/gate_index.js [--write] [--check] [--json]
 *   (mặc định in stdout · --write ghi .agent/config/GATES.md · --check exit 1 nếu bảng lệch source)
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.join(REPO, '.agent', 'config', 'GATES.md');
const QA = path.join(REPO, 'scripts', 'qa');

/* Bề mặt có thể GỌI một gate. Thiếu bề mặt nào ở đây thì gate trông như mồ côi — nên danh sách này
 * phải khớp với chỗ `policy_source_check.js` đo reachability, đừng khai lệch. */
const SURFACE_DIRS = ['.github/workflows', '.agent/workflows', 'prompt_templates', '.claude/commands', 'tests/fe/infra'];
const SURFACE_FILES = ['.gitlab-ci.yml', '.claude/settings.json', 'README.md', 'USER_GUIDE.md', 'QUICKSTART.md'];

const readSafe = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };

/** Toàn bộ văn bản của các bề mặt, kèm nhãn ngắn để in "gọi từ đâu". */
function corpus() {
  const out = [];
  const push = (abs, label) => { const t = readSafe(abs); if (t) out.push({ label, txt: t }); };
  for (const f of SURFACE_FILES) push(path.join(REPO, f), f);
  for (const d of SURFACE_DIRS) {
    const abs = path.join(REPO, d);
    if (!fs.existsSync(abs)) continue;
    const walk = (dir) => {
      for (const en of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, en.name);
        if (en.isDirectory()) { walk(p); continue; }
        if (/\.(md|ya?ml|json|ts|js)$/.test(en.name)) push(p, d);
      }
    };
    walk(abs);
  }
  return out;
}

/** Một dòng mô tả: lấy từ header comment dạng `* ten — mo ta` (hoặc `* ten (F3) — mo ta`). */
function purposeOf(text) {
  for (const line of text.split(/\r?\n/).slice(0, 25)) {
    const m = line.match(/^\s*\*\s*[a-z0-9_.]+(?:\s*\([^)]*\))?\s*[—-]\s*(.+)$/i);
    if (m) return m[1].replace(/\s+/g, ' ').trim();
  }
  return '(chưa có mô tả ở header)';
}

/** CHẶN nếu có đường ra exit 1; CẢNH BÁO nếu chỉ in. Cờ --enforce ghi riêng vì nó là chặn CÓ ĐIỀU KIỆN. */
function levelOf(text) {
  const hardBlock = /process\.exit\(1\)|process\.exitCode\s*=\s*1|throw new /.test(text);
  const hasEnforceFlag = /--enforce|'enforce'|"enforce"/.test(text);
  if (hardBlock && hasEnforceFlag) return 'CHẶN (có cờ --enforce)';
  if (hardBlock) return 'CHẶN';
  return 'CẢNH BÁO';
}

function build() {
  const pkg = JSON.parse(readSafe(path.join(REPO, 'package.json')) || '{}');
  const scripts = pkg.scripts || {};
  const surf = corpus();
  const PW_CONFIG = readSafe(path.join(REPO, 'playwright.config.js'));

  const rows = [];
  const orphanFiles = [];
  for (const name of fs.readdirSync(QA).sort()) {
    if (!name.endsWith('.js')) continue;
    const rel = `scripts/qa/${name}`;
    const text = readSafe(path.join(QA, name));

    /*
     * npm script nào trỏ vào file này — VÀ cả cơ chế ĐĂNG KÝ, không chỉ npm.
     * Đã đo và suýt báo sai: `learn_reporter.js` không có npm script nào gọi, nhưng nó là Playwright
     * reporter khai ở `playwright.config.js:89` và chạy TỰ ĐỘNG sau mỗi test run. Xếp nó vào "mồ côi"
     * là dán nhãn CHẾT cho thứ đang SỐNG — danh mục sai kiểu đó thì người đọc thôi tin cả bảng.
     */
    const npm = Object.entries(scripts).filter(([, cmd]) => cmd.includes(rel)).map(([k]) => k);
    const registered = PW_CONFIG.includes(rel) || PW_CONFIG.includes(`./${rel}`);
    if (!npm.length && !registered) { orphanFiles.push(rel); continue; }

    // bề mặt nào nhắc tới npm script đó
    const called = [...new Set(surf.filter((c) => npm.some((n) => c.txt.includes(n))).map((c) => c.label))];
    if (registered) called.unshift('playwright.config.js (tự động)');
    rows.push({
      file: rel,
      npm: npm.length ? npm : ['(không npm — đăng ký ở playwright.config.js)'],
      level: levelOf(text),
      purpose: purposeOf(text),
      called,
    });
  }
  return { rows, orphanFiles };
}

function render({ rows, orphanFiles }) {
  const order = { 'CHẶN': 0, 'CHẶN (có cờ --enforce)': 1, 'CẢNH BÁO': 2 };
  const sorted = rows.slice().sort((a, b) => (order[a.level] - order[b.level]) || a.file.localeCompare(b.file));
  const nBlock = rows.filter((r) => r.level.startsWith('CHẶN')).length;

  /* Dấu `|` trong mô tả phải thoát khỏi bảng markdown. Dùng entity `&#124;` chứ KHÔNG dùng backslash:
   * chuỗi escape trong string literal là đúng chỗ bẫy `no-useless-escape`, và cũng là chỗ tầng vận
   * chuyển hay ăn mất backslash (đã dính trong lượt viết file này). */
  const L = [];
  L.push('# Danh mục GATE của kit');
  L.push('');
  L.push('> **SINH TỰ ĐỘNG** bởi `node scripts/qa/gate_index.js --write`. Đừng sửa tay — `--check` sẽ chặn khi');
  L.push('> bảng lệch source. Cột **Mức** suy từ code: có đường ra `exit 1` là CHẶN, chỉ in là CẢNH BÁO.');
  L.push('');
  L.push(`Tổng: **${rows.length} gate** — ${nBlock} chặn, ${rows.length - nBlock} cảnh báo.`);
  L.push('');
  L.push('| Mức | npm script | Chặn/kiểm cái gì | File | Gọi từ |');
  L.push('|---|---|---|---|---|');
  for (const r of sorted) {
    const p = r.purpose.length > 110 ? `${r.purpose.slice(0, 107)}...` : r.purpose;
    L.push(`| ${r.level} | \`${r.npm.join('`, `')}\` | ${p.replace(/\|/g, '&#124;')} | \`${r.file}\` | ${r.called.length ? r.called.join(' · ') : '**KHÔNG BỀ MẶT NÀO**'} |`);
  }
  if (orphanFiles.length) {
    L.push('');
    L.push('## File trong `scripts/qa/` KHÔNG có npm script nào gọi');
    L.push('');
    L.push('Không hẳn là lỗi — có thể là thư viện dùng chung. Nhưng nếu là gate thì nó đang chết.');
    L.push('');
    for (const f of orphanFiles) L.push(`- \`${f}\``);
  }
  L.push('');
  return L.join('\n');
}

const data = build();
const md = render(data);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(data, null, 2));
} else if (process.argv.includes('--check')) {
  const cur = readSafe(OUT);
  if (!cur) {
    console.error('[gate-index] CHẶN: thiếu .agent/config/GATES.md — chạy `npm run gates:index`.');
    process.exit(1);
  }
  if (cur.replace(/\r\n/g, '\n').trim() !== md.trim()) {
    console.error('[gate-index] CHẶN: .agent/config/GATES.md LỆCH source (gate được thêm/xoá, hoặc một gate đã đổi mức CHẶN <-> CẢNH BÁO mà bảng không ghi). Chạy `npm run gates:index` rồi commit.');
    process.exit(1);
  }
  console.log(`[gate-index] OK — ${data.rows.length} gate, bảng khớp source.`);
} else if (process.argv.includes('--write')) {
  fs.writeFileSync(OUT, md, 'utf8');
  console.log(`[gate-index] đã ghi .agent/config/GATES.md — ${data.rows.length} gate.`);
} else {
  console.log(md);
}
