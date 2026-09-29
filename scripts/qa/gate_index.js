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

  /*
   * TẬP MÁY = mọi file trong `scripts/qa/` CỘNG mọi file mà một npm script trỏ vào, ở bất kỳ đâu.
   *
   * Bản đầu chỉ đọc `scripts/qa/` nên bảng này bỏ sót 16 file với 26 npm script, trong đó có
   * bước verify riêng (CHẶN) và một cổng người duyệt. Một danh mục tự nhận "liệt kê mọi
   * máy" mà thiếu đúng nhóm cổng chặn thì tệ hơn không có danh mục: người đọc tra không thấy rồi kết
   * luận là không có máy nào canh.
   *
   * Phần "mồ côi" phía dưới VẪN chỉ xét `scripts/qa/`, vì ở đó "không ai gọi" nghĩa là gate chết. Ngoài
   * thư mục đó thì phần lớn `.js` là thư viện được require, không gọi bằng npm là chuyện bình thường.
   */
  const machines = new Map();
  for (const name of fs.readdirSync(QA).sort()) {
    if (name.endsWith('.js')) machines.set(`scripts/qa/${name}`, true);
  }
  for (const cmd of Object.values(scripts)) {
    const m = cmd.match(/(?:^|\s)((?:scripts|docs)\/[A-Za-z0-9_/.-]+\.m?js)/);
    if (m && fs.existsSync(path.join(REPO, m[1]))) machines.set(m[1], true);
  }

  const rows = [];
  const orphanFiles = [];
  for (const rel of [...machines.keys()].sort()) {
    const name = path.basename(rel);
    const text = readSafe(path.join(REPO, rel));

    /*
     * npm script nào trỏ vào file này — VÀ cả cơ chế ĐĂNG KÝ, không chỉ npm.
     * Đã đo và suýt báo sai: `learn_reporter.js` không có npm script nào gọi, nhưng nó là Playwright
     * reporter khai ở `playwright.config.js:89` và chạy TỰ ĐỘNG sau mỗi test run. Xếp nó vào "mồ côi"
     * là dán nhãn CHẾT cho thứ đang SỐNG — danh mục sai kiểu đó thì người đọc thôi tin cả bảng.
     */
    const npm = Object.entries(scripts).filter(([, cmd]) => cmd.includes(rel)).map(([k]) => k);
    const registered = PW_CONFIG.includes(rel) || PW_CONFIG.includes(`./${rel}`);
    if (!npm.length && !registered) {
      if (rel.startsWith('scripts/qa/')) orphanFiles.push(rel);
      continue;
    }

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

/*
 * CẢNH BÁO NGUỒN BẨN — nói thẳng vì sao bảng lệch, thay vì bắt người ta đi truy.
 *
 * Đã trả giá thật ngày 18/09/2026: `GATES.md` được sinh trong cây làm việc đang có
 * `publish qua Drive MCP.js` sửa dở CHƯA COMMIT. Bản sửa đó đổi cách phân loại từ CHẶN sang
 * CHẶN-có-cờ, nên bảng commit lên mang một mức mà source đã commit KHÔNG sinh ra. Máy dev xanh, CI đỏ,
 * và thông báo lúc đó chỉ nói "bảng lệch source" nên mất một vòng mới truy ra.
 *
 * Bảng này là artifact sinh ra, nên nó phải sinh từ NỘI DUNG ĐÃ COMMIT. Đây cũng là họ lỗi "xanh máy
 * dev, đỏ CI" mà kit đã dính ở chỗ khác: kết quả phụ thuộc môi trường chạy thì "xanh" hết nghĩa.
 */
function nguonBan(rows) {
  let doi;
  try {
    /* eslint-disable-next-line global-require */
    const { execFileSync } = require('child_process');
    doi = new Set(execFileSync('git', ['status', '--porcelain', '--'], {
      cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).split('\n').filter(Boolean).map((l) => l.slice(3).trim().split(' -> ').pop()));
  } catch (e) {
    return [];      // không phải git repo (gói phát hành) → bỏ qua, KHÔNG fail
  }
  return rows.map((r) => r.file).filter((f) => doi.has(f));
}

const data = build();
const ban = nguonBan(data.rows);
if (ban.length) {
  console.error(`[gate-index] CẢNH BÁO: ${ban.length} file nguồn đang SỬA DỞ chưa commit, nên bảng sinh ra ở đây`);
  console.error('             có thể khác bảng mà CI sinh từ nội dung đã commit:');
  for (const f of ban) console.error(`               ${f}`);
  console.error('             Commit phần sửa đó TRƯỚC rồi mới chạy `npm run gates:index`.');
}
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
    /*
     * Cây làm việc BẨN thì lệch là chuyện đương nhiên, và kết tội bảng ở đó là oan. Bảng là artifact
     * của nội dung ĐÃ COMMIT, nên chỉ phán được khi source sạch. CI luôn checkout sạch nên nhánh này
     * không bao giờ chạy ở CI — răng của gate giữ nguyên.
     */
    if (ban.length) {
      console.error('[gate-index] KHÔNG PHÁN ĐƯỢC: bảng lệch, nhưng source đang sửa dở nên chưa kết luận được.');
      console.error('             Commit phần sửa ở trên rồi chạy lại. Đây KHÔNG phải là đạt.');
      process.exit(2);
    }
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
