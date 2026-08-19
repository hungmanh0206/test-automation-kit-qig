#!/usr/bin/env node
'use strict';

/*
 * leak_report.js — đo "kit đang rò bao nhiêu và rò kiểu gì" (baseline cho mọi cải tiến sau).
 *
 * Vì sao cần: nhãn `auto-bug` chỉ chứng minh bug được TẠO qua tool của kit, KHÔNG chứng minh tool
 * TÌM ra nó. Không tách được "ai phát hiện" thì mọi tranh luận "kit lọt nhiều hay ít" là cảm tính
 * (đã xảy ra thật: từng báo nhầm "bắt 8 / lọt 13" trong khi thực tế QA tìm toàn bộ).
 *
 * Máy này làm 2 việc:
 *   1) Đếm bug theo NGUỒN PHÁT HIỆN — dựa nhãn `found-by-kit` / `found-by-human` (bug_reporter
 *      ghi khi log). Bug cũ chưa có nhãn → xếp vào "chưa phân loại" và nêu tên để gắn bù.
 *   2) Phân loại bug theo TRỤC PHÁT HIỆN — trục nào đang rò thì biết phải thêm máy nào:
 *        1 field    — thừa/thiếu/sai nhãn field, cột              → ui_conformance_check (spec→UI)
 *        2 surface  — cùng giá trị hiển thị khác nhau giữa các màn → cross_surface_diff (chưa có)
 *        3 persist  — form/payload đúng nhưng đọc lại mất giá trị  → persistence_probe (chưa có)
 *        4 branch   — nhánh/biến thể khác của cùng màn            → fixture matrix (chưa có)
 *        5 state    — trạng thái kế cận (sau hủy/hoàn/lost)        → fixture matrix (chưa có)
 *      Phân loại bằng từ khoá trên summary+description ⇒ là GỢI Ý, không phải phán quyết; dòng nào
 *      máy không chắc thì để "chưa rõ" cho người soi, KHÔNG đoán bừa.
 *
 * Dùng:
 *   node scripts/qa/leak_report.js --story SAPP-24395 [--out <file.md>] [--json]
 * Env: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN (đọc từ .env / task.env như các script Jira khác).
 * Exit: 0 (báo cáo, không chặn).
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes(`--${n}`);

const STORY = arg('story', process.env.JIRA_STORY_KEY || '');
const TASK = arg('task', process.env.TASK_KEY || '');
const BASE = String(process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');
const AUTH = 'Basic ' + Buffer.from(`${process.env.JIRA_EMAIL || ''}:${process.env.JIRA_API_TOKEN || ''}`).toString('base64');

// Trục phát hiện: mỗi trục = một loại máy. Từ khoá lấy từ cách bug thật được mô tả trong task.
const AXES = [
  {
    id: 1,
    key: 'field',
    ten: 'Field/cột trên một màn',
    may: 'ui_conformance_check (spec → UI)',
    rx: /thiếu (?:trường|field|cột)|thừa (?:trường|field|cột)|không hiển thị field|hiển thị thêm field|sai tên cột|bộ cột|thiếu cột|đủ \d+ field|section .*thiếu|không có trường/i,
  },
  {
    id: 2,
    key: 'surface',
    ten: 'Cùng giá trị, khác nơi hiển thị',
    may: 'cross_surface_diff (chưa có)',
    rx: /hai màn|2 màn|màn (?:khác|còn lại)|trong khi (?:màn|tab)|checkout .*(?:khác|sai)|tab hubspot|đồng bộ sang hubspot|list .*detail|mâu thuẫn nhau/i,
  },
  {
    id: 3,
    key: 'persist',
    ten: 'Chuỗi lưu trữ form → payload → đọc lại',
    may: 'persistence_probe (chưa có)',
    rx: /payload .*(?:nhưng|trong khi)|không lưu|lưu thành 0|đọc lại .*(?:0|null|rỗng)|trả về 0|backend .*không lưu|gửi lên .*nhưng/i,
  },
  {
    id: 4,
    key: 'branch',
    ten: 'Nhánh/biến thể khác của cùng màn',
    may: 'fixture matrix (chưa có)',
    rx: /phương pháp|method|loại phí|nhánh|option .*(?:thiếu|không)|trường hợp .*(?:fixed|percentage)|dropdown .*thiếu/i,
  },
  {
    id: 5,
    key: 'state',
    ten: 'Trạng thái kế cận (sau hủy/hoàn/lost)',
    may: 'fixture matrix (chưa có)',
    rx: /sau khi (?:hủy|huỷ|hoàn|thanh toán|xác nhận|edit)|đã hủy|cancel(?:led)? order|deal lost|trạng thái .*(?:không|vẫn)|guard|chặn .*trạng thái/i,
  },
];

function adfText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.text) return node.text;
  return (node.content || []).map(adfText).join(' ');
}

async function jira(pathname) {
  const res = await fetch(BASE + pathname, { headers: { Authorization: AUTH, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Jira ${res.status} ${pathname.slice(0, 80)}`);
  return res.json();
}

function classify(text) {
  const hits = AXES.filter((a) => a.rx.test(text));
  return hits.length ? hits : [];
}

(async () => {
  if (!STORY) { console.error('[leak-report] thiếu --story <JIRA_STORY_KEY> (hoặc env JIRA_STORY_KEY).'); process.exit(2); }
  if (!BASE || !process.env.JIRA_API_TOKEN) { console.error('[leak-report] thiếu JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN.'); process.exit(2); }

  const jql = `parent = "${STORY}" AND issuetype in ("Sub-bug", "Bug") ORDER BY key ASC`;
  const data = await jira(`/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=summary,status,labels,description&maxResults=200`);
  const issues = data.issues || [];

  const rows = issues.map((i) => {
    const labels = i.fields.labels || [];
    const text = `${i.fields.summary || ''} || ${adfText(i.fields.description)}`;
    const source = labels.includes('found-by-kit') ? 'kit'
      : labels.includes('found-by-human') ? 'human'
        : (labels.some((l) => /^(bug-)?sheet-stt/.test(l)) ? 'human (suy từ nhãn sheet)' : 'chưa phân loại');
    return {
      key: i.key,
      status: (i.fields.status || {}).name || '',
      summary: (i.fields.summary || '').slice(0, 120),
      source,
      axes: classify(text).map((a) => a.key),
    };
  });

  const bySource = rows.reduce((m, r) => { m[r.source] = (m[r.source] || 0) + 1; return m; }, {});
  const byAxis = AXES.map((a) => ({ ...a, n: rows.filter((r) => r.axes.includes(a.key)).length }));
  const unclassified = rows.filter((r) => !r.axes.length);
  const needLabel = rows.filter((r) => r.source === 'chưa phân loại');

  const L = [];
  L.push(`# Leak report — ${STORY}${TASK ? ` (task ${TASK})` : ''}`);
  L.push('');
  L.push(`Tổng bug dưới story: **${rows.length}**`);
  L.push('');
  L.push('## 1. Nguồn phát hiện (ai TÌM ra, không phải ai log)');
  L.push('');
  L.push('| Nguồn | Số bug |');
  L.push('|---|---|');
  Object.entries(bySource).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => L.push(`| ${k} | ${v} |`));
  L.push('');
  if (needLabel.length) {
    L.push(`> ${needLabel.length} bug **chưa có nhãn nguồn** → tỉ lệ rò chưa đo được chính xác. Từ nay log bug kèm \`--found-by kit|human\`; bug cũ gắn bù bằng tay nếu cần số liệu lịch sử.`);
    L.push('');
  }
  L.push('## 2. Trục phát hiện — trục nào đang rò thì thiếu máy đó');
  L.push('');
  L.push('| # | Trục | Máy tương ứng | Số bug khớp |');
  L.push('|---|---|---|---|');
  byAxis.forEach((a) => L.push(`| ${a.id} | ${a.ten} | ${a.may} | ${a.n} |`));
  L.push('');
  L.push(`Không khớp trục nào (cần người soi): **${unclassified.length}**`);
  L.push('');
  L.push('> Phân loại bằng từ khoá ⇒ là **gợi ý để biết nên xây máy nào trước**, không phải phán quyết. Một bug có thể khớp nhiều trục.');
  L.push('');
  L.push('## 3. Chi tiết');
  L.push('');
  L.push('| Key | Trạng thái | Nguồn | Trục | Tiêu đề |');
  L.push('|---|---|---|---|---|');
  rows.forEach((r) => L.push(`| ${r.key} | ${r.status} | ${r.source} | ${r.axes.join(', ') || '—'} | ${r.summary.replace(/\|/g, '\\|')} |`));
  const md = L.join('\n') + '\n';

  const out = arg('out', '');
  if (out) {
    fs.mkdirSync(path.dirname(path.resolve(rc.REPO_ROOT, out)), { recursive: true });
    fs.writeFileSync(path.resolve(rc.REPO_ROOT, out), md, 'utf8');
    console.log(`[leak-report] đã ghi: ${out}`);
  }
  if (has('json')) console.log(JSON.stringify({ story: STORY, total: rows.length, bySource, byAxis: byAxis.map(({ id, key, ten, may, n }) => ({ id, key, ten, may, n })), rows }, null, 2));
  else if (!out) console.log(md);
  else {
    console.log(`\nNguồn phát hiện: ${Object.entries(bySource).map(([k, v]) => `${k}=${v}`).join(' | ')}`);
    console.log(`Trục: ${byAxis.map((a) => `${a.key}=${a.n}`).join(' | ')} | không khớp=${unclassified.length}`);
  }
})().catch((e) => { console.error('[leak-report] lỗi:', e.message); process.exit(1); });
