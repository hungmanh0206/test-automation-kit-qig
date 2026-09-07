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
 * Thông tin MỚI mà bảng này ghi (chưa máy nào trong kit ghi): CHẶN vs SINH vs BÁO CÁO. Suy từ source —
 * `exit 1` là CHẶN, ghi artifact là SINH, chỉ in là BÁO CÁO. Chỗ CHẶN đúng là chỗ dễ trôi nhất:
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

/*
 * Bề mặt có thể GỌI một gate. Danh sách này THIẾU thì bảng nói SAI theo hướng tệ nhất: máy đang được
 * dùng bị in ra như thể mồ côi. Đã dính đúng vậy hai lần trong ngày đầu:
 *   · `explore:check`    → có ở `exploratory/run_exploratory_session.md` (bỏ sót cả thư mục)
 *   · `expansion:audit`  → có ở `RULE_GLOBAL.md` (bỏ sót chính file canonical)
 * Nên: quét rộng, và mỗi lần thấy một máy "không bề mặt nào" thì NGHI BẢNG TRƯỚC, nghi kit sau.
 *
 * LOẠI TRỪ có chủ đích:
 *   · `.agent/config/GATES.md` — chính file này sinh ra; tính nó là bề mặt thì MỌI máy đều trông như
 *     được gọi, và cột "Gọi từ" mất hết ý nghĩa.
 *   · `package.json` — nơi ĐỊNH NGHĨA npm script, không phải nơi gọi.
 */
const SURFACE_DIRS = [
  '.github/workflows', '.agent/workflows', '.agent/rules', '.agent/skills',
  'prompt_templates', 'exploratory', 'partial-rerun', '.claude/commands', 'tests/fe/infra',
];
const SURFACE_FILES = [
  '.gitlab-ci.yml', '.claude/settings.json',
  'RULE_GLOBAL.md', 'CLAUDE.md', 'README.md', 'USER_GUIDE.md', 'QUICKSTART.md', 'scripts/qa/README.md',
];
const SURFACE_EXCLUDE = /(^|\/)GATES\.md$/;

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
        if (SURFACE_EXCLUDE.test(p.split(path.sep).join('/'))) continue;
        if (/\.(md|ya?ml|json|ts|js)$/.test(en.name)) push(p, d);
      }
    };
    walk(abs);
  }
  return out;
}

/**
 * Một dòng mô tả, lấy từ header comment. Phải chịu được CẢ HAI kiểu header đang có trong kit:
 *   `/* ten — mo ta`   (khối)   và   `// Nhãn Nhiều Chữ — mo ta`   (dòng)
 * Bản đầu chỉ nhận một token chữ thường trước gạch ⇒ 9/58 gate bị in "(chưa có mô tả)" TRONG KHI
 * chúng có mô tả đầy đủ. Đó là lỗi của bảng, không phải lỗ của kit — và loại lỗi tệ nhất ở một
 * danh mục: nó tố oan.
 */
function purposeOf(text) {
  for (const raw of text.split(/\r?\n/).slice(0, 30)) {
    const line = raw.replace(/^\s*(\/\*+|\*+\/?|\/\/)\s?/, '').trim();
    if (!line || /^#!|^'use strict'/.test(line)) continue;
    if (/^(VÌ SAO|Dùng|Exit|Input|Output|Ghi chú)\b/i.test(line)) continue;   // đoạn giải thích, không phải nhãn
    const m = line.match(/^(.{2,60}?)\s+[—–-]\s+(.+)$/);
    return (m ? m[2] : line).replace(/\s+/g, ' ').trim();
  }
  return '(chưa có mô tả ở header)';
}

/**
 * BA loại, suy từ source — không phải hai.
 *
 * Bản đầu chỉ có CHẶN/CẢNH BÁO, và nó dán nhãn "CẢNH BÁO" cho `bugs:checklist`. Sai về BẢN CHẤT:
 * script đó không phát hiện vi phạm gì cả, nó IN BRIEF bug lịch sử cho lúc sinh case; việc chặn nằm
 * ở `dim:coverage` (chiều `bug_history` §20, minCasesPerDimension = 5). Gọi nó là "cảnh báo" khiến
 * người đọc tưởng có một gate đang bị nới — trong khi vòng đó kín.
 *
 *   CHẶN    — có đường ra exit 1 (kèm ghi chú nếu chặn phụ thuộc cờ --enforce)
 *   SINH    — không chặn, nhưng GHI artifact (index/dashboard/report)
 *   BÁO CÁO — không chặn, không ghi; chỉ in cho người/agent đọc
 */
function levelOf(text) {
  const hardBlock = /process\.exit\(1\)|process\.exitCode\s*=\s*1|throw new /.test(text);
  const hasEnforceFlag = /--enforce|'enforce'|"enforce"/.test(text);
  if (hardBlock) return hasEnforceFlag ? 'CHẶN (có cờ --enforce)' : 'CHẶN';
  if (/writeFileSync|appendFileSync/.test(text)) return 'SINH';
  return 'BÁO CÁO';
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
  const order = { 'CHẶN': 0, 'CHẶN (có cờ --enforce)': 1, 'SINH': 2, 'BÁO CÁO': 3 };
  const sorted = rows.slice().sort((a, b) => (order[a.level] - order[b.level]) || a.file.localeCompare(b.file));
  const nBlock = rows.filter((r) => r.level.startsWith('CHẶN')).length;

  /* Dấu `|` trong mô tả phải thoát khỏi bảng markdown. Dùng entity `&#124;` chứ KHÔNG dùng backslash:
   * chuỗi escape trong string literal là đúng chỗ bẫy `no-useless-escape`, và cũng là chỗ tầng vận
   * chuyển hay ăn mất backslash (đã dính trong lượt viết file này). */
  const L = [];
  L.push('# Danh mục GATE của kit');
  L.push('');
  L.push('> **SINH TỰ ĐỘNG** bởi `node scripts/qa/gate_index.js --write`. Đừng sửa tay — `--check` sẽ chặn khi');
  L.push('> bảng lệch source. Cột **Mức** suy từ code: `exit 1` = CHẶN · ghi artifact = SINH · chỉ in = BÁO CÁO.');
  L.push('');
  const nGen = rows.filter((r) => r.level === 'SINH').length;
  const nRep = rows.filter((r) => r.level === 'BÁO CÁO').length;
  L.push(`Tổng **${rows.length}** máy — **${nBlock} CHẶN** · ${nGen} SINH (ghi artifact) · ${nRep} BÁO CÁO (chỉ in).`);
  L.push('');
  L.push('SINH/BÁO CÁO **không phải gate bị nới** — chúng không kiểm vi phạm. Ví dụ `bugs:checklist` in brief bug');
  L.push('lịch sử, còn việc CHẶN nằm ở `dim:coverage` (chiều `bug_history` §20).');
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
