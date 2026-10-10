#!/usr/bin/env node
'use strict';

/*
 * token_audit.js — ĐO ĐỘNG: một lượt chạy thật đã tiêu token vào đâu.
 *
 * VÌ SAO CẦN RIÊNG MÁY NÀY, trong khi đã có `prompt_budget.js`. Đo tĩnh trả lời "hướng dẫn dài bao nhiêu".
 * Nó KHÔNG trả lời "token thật đã đi đâu", và hai câu đó có thể lệch nhau rất xa: đo trên 4 lượt chạy thật
 * của kit (CSDL-9001 đến 9004), `Read` vào tài liệu của kit chỉ có 6 lượt trong tổng 1.140 lượt `Read`.
 * Cắt tài liệu mà không đo động thì rất dễ tối ưu đúng chỗ không tốn.
 *
 * BA LỖI ĐÃ MẮC KHI DỰNG PHÉP ĐO NÀY, cài sẵn cách tránh vào code:
 *   ① Gộp phiên SỬA KIT với phiên CHẠY TASK. Một phiên đọc `USER_GUIDE.md` 20 lần là phiên đang SỬA file đó,
 *      không phải phiên chạy task — tính vào chi phí task là sai hẳn một bậc.
 *   ② Phân loại phiên bằng "có đọc prompt chạy phase không". Sai: phiên chạy task hầu như không `Read`
 *      prompt (nó được nạp qua slash command). Nên neo bằng bằng chứng không thể hiểu nhiều nghĩa:
 *      phiên nào GHI nhiều vào `outputs/<project>/tasks/`.
 *   ③ Dùng hệ số 3,6 ký tự/token. Kit dùng 3,2 ở mọi phép đo khác.
 *
 * KHÔNG GHI NỘI DUNG TRANSCRIPT RA FILE. Transcript có thể chứa PII khách hoặc secret. Máy này chỉ ghi SỐ
 * ĐẾM, TÊN FILE và TÊN TOOL. Chạy `npm run secret:scan` sau khi ghi.
 *
 * Dùng:
 *   node scripts/qa/token_audit.js --list                       # liệt kê transcript + phân loại phiên
 *   node scripts/qa/token_audit.js --transcript <file.jsonl>     # đo một phiên
 *   ... --json                                                  # ghi docs/token-diet/baseline.dynamic.json
 * Exit: 0 đạt · 2 dùng sai hoặc không có transcript.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const REPO = path.resolve(__dirname, '..', '..');
const CHARS_PER_TOK = 3.2;
const OUT_DIR = path.join(REPO, 'docs', 'token-diet');

const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };

/* Thư mục transcript của Claude Code. Harness khác thì viết adapter trả cùng khuôn `{usage, content[]}`. */
function thuMucTranscript() {
  const base = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(base)) return null;
  /* Claude Code đặt tên thư mục theo đường dẫn repo, nhưng quy tắc thay ký tự không ổn định giữa các bản
   * (dấu gạch dưới có lúc thành gạch ngang, chữ hoa chữ thường không nhất quán). Nên KHÔNG dựng lại tên:
   * chuẩn hoá cả hai phía rồi so. Dựng lại tên đã hỏng một lần, và nó hỏng im lặng — máy báo "không có
   * transcript" trong khi transcript nằm ngay đó. */
  const chuan = (x) => String(x).replace(/[^a-z0-9]+/gi, '').toLowerCase();
  const muc = chuan(REPO);
  const hit = fs.readdirSync(base).find((d) => chuan(d) === muc);
  return hit ? path.join(base, hit) : null;
}

/* Quy KẾT QUẢ TOOL về nguồn. Thứ tự quan trọng: khớp cái cụ thể trước cái chung. */
function nguonCua(toolName, input) {
  const s = JSON.stringify(input || {});
  if (/^mcp__.*playwright/i.test(toolName) && /snapshot/i.test(toolName)) return 'snapshot MCP';
  if (/^mcp__.*playwright/i.test(toolName)) return 'Playwright MCP khác';
  if (/^mcp__.*(drive|sheet|doc)/i.test(toolName)) return 'Drive MCP';
  if (/^mcp__/i.test(toolName)) return 'MCP khác';
  if (toolName === 'Read') return /\.(png|jpe?g|webp|mp4|webm)/i.test(s) ? 'ảnh và video' : 'Read file';
  if (toolName === 'Grep' || toolName === 'Glob') return 'tìm kiếm';
  if (toolName === 'Write' || toolName === 'Edit' || toolName === 'NotebookEdit') return 'ghi file';
  if (toolName === 'Bash' || toolName === 'PowerShell') {
    if (/playwright[^"]*test/i.test(s)) return 'output playwright test';
    if (/scripts\/qa\/|npm run (gate|gates|design|dim|risk|self-review|output)/i.test(s)) return 'output gate';
    return 'bash khác';
  }
  return toolName || 'khác';
}

/** Kích thước văn bản của một khối tool_result. */
/*
 * MẪU LỆNH — bỏ đối số cụ thể, giữ script hoặc tool cộng cờ chính.
 *
 * VÌ SAO ĐẾM THEO MẪU, không đếm theo độ dài output. Chi phí một lượt chạy tỉ lệ với
 * (context mỗi message) × (số message), và mỗi lượt gọi tool là một message kèm cả context (~500k token,
 * cache-hit 98,5%). Nên một lệnh in ra 5 dòng và một lệnh in ra 500 dòng tốn GẦN NHƯ NHAU. Muốn giảm
 * thì phải giảm SỐ LƯỢT, và muốn giảm số lượt thì phải biết lượt nào lặp nhiều nhất.
 *
 * `cd <d>&&` đếm RIÊNG thành một mẫu `cd &&`: nó không phải việc, nó là thuế dán vào mọi lệnh khác.
 */
function mauCua(cmd) {
  let c = String(cmd || '').trim().replace(/\s+/g, ' ');
  if (!c) return '';
  const coCd = /^cd\s+[^&;|]+(&&|;)/.test(c);
  c = c.replace(/^cd\s+[^&;|]+(&&|;)\s*/, '');

  /*
   * BỘC TIỀN TỐ ENV. Đây là một lỗi đo thật, đã mắc ở bản đầu: `TASK_ENV=profiles/<T>/task.env npx
   * playwright test ...` bị xếp vào mẫu `TASK_ENV=profiles/<T>/task.env`, nên 274 lượt `playwright test`
   * biến mất khỏi bảng và bảng nói dịu hẳn đi. Tệ hơn: mỗi task một đường profile nên nó còn tự chia
   * thành nhiều mẫu. Ba dạng phải bóc: `VAR=v` (POSIX), `$env:VAR='v';` (PowerShell), và `export VAR=v;`.
   */
  for (let i = 0; i < 6; i += 1) {
    const truoc = c;
    c = c.replace(/^export\s+/, '')
      .replace(/^\$env:[A-Za-z_][A-Za-z0-9_]*\s*=\s*('[^']*'|"[^"]*"|[^;\s]+)\s*;?\s*/, '')
      .replace(/^[A-Za-z_][A-Za-z0-9_]*=('[^']*'|"[^"]*"|[^\s]*)\s+/, '');
    if (c === truoc) break;
  }
  if (!c) return coCd ? 'cd &&' : '';
  const dau = c.split(/\s+/)[0] || '';
  const sau = c.slice(dau.length).trim();

  // npm run <script> / npx <bin> <sub> / node <script.js>
  let mau;
  if (/^npm$/.test(dau)) {
    const m = sau.match(/^(run|run-script|ci|install|test)\s*(--silent\s+)?([a-z0-9:_-]+)?/i);
    mau = m ? `npm ${m[1]}${m[3] ? ` ${m[3]}` : ''}` : 'npm';
  } else if (/^npx(\.cmd)?$/.test(dau)) {
    const m = sau.replace(/^--no-install\s+/, '').match(/^([a-z0-9@/._-]+)(\s+([a-z0-9:_-]+))?/i);
    mau = m ? `npx ${m[1]}${m[3] ? ` ${m[3]}` : ''}` : 'npx';
  } else if (/^node$/.test(dau)) {
    const m = sau.match(/^(-e|--eval)\b/) ? ['', '-e'] : sau.match(/([a-z0-9_./-]+\.js)/i);
    mau = `node ${m ? (m[1] || '-e') : '?'}`;
  } else {
    mau = dau;
  }

  /* Cờ chính: giữ TÊN cờ, bỏ GIÁ TRỊ. Giữ giá trị là mỗi task một mẫu riêng, và bảng đếm vô dụng. */
  const co = [...new Set((c.match(/(^|\s)--[a-z][a-z0-9-]*/gi) || []).map((x) => x.trim()))].slice(0, 3);
  if (co.length) mau += ` ${co.join(' ')}`;
  return (coCd ? 'cd && ' : '') + mau;
}

function coTextKetQua(blk) {
  const c = blk.content;
  if (typeof c === 'string') return c.length;
  if (Array.isArray(c)) return c.reduce((n, x) => n + (x && typeof x.text === 'string' ? x.text.length : 0), 0);
  return 0;
}

/** Đọc một transcript, trả số đếm. KHÔNG giữ nội dung. */
async function doMotPhien(file) {
  const r = {
    file: path.basename(file),
    message: 0,
    inputTok: 0,
    outputTok: 0,
    cacheRead: 0,
    cacheCreate: 0,
    toolCalls: {},
    mauLenh: {},
    nguon: {},
    docReads: {},
    ghiVaoTask: 0,
    suaTaiLieuKit: 0,
  };
  const DOC_KIT = /(prompt_templates[/\\]|\.agent[/\\](rules|workflows|skills)[/\\]|RULE_GLOBAL\.md|CLAUDE\.md|README\.md|USER_GUIDE\.md|QUICKSTART\.md)/i;

  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  const tenTheoId = new Map();
  for await (const line of rl) {
    if (!line || line[0] !== '{') continue;
    let rec;
    try { rec = JSON.parse(line); } catch (e) { continue; }
    const msg = rec.message || {};
    const u = msg.usage;
    if (u) {
      r.message += 1;
      r.inputTok += Number(u.input_tokens || 0);
      r.outputTok += Number(u.output_tokens || 0);
      r.cacheRead += Number(u.cache_read_input_tokens || 0);
      r.cacheCreate += Number(u.cache_creation_input_tokens || 0);
    }
    const content = msg.content;
    if (!Array.isArray(content)) continue;
    for (const blk of content) {
      if (!blk || typeof blk !== 'object') continue;
      if (blk.type === 'tool_use') {
        const nm = blk.name || '?';
        r.toolCalls[nm] = (r.toolCalls[nm] || 0) + 1;
        if (/^(Bash|PowerShell)$/.test(nm)) {
          const mau = mauCua((blk.input || {}).command);
          if (mau) r.mauLenh[mau] = (r.mauLenh[mau] || 0) + 1;
        }
        tenTheoId.set(blk.id, { nm, nguon: nguonCua(nm, blk.input) });
        const fp = String((blk.input || {}).file_path || '');
        if (nm === 'Read' && DOC_KIT.test(fp)) {
          const key = path.relative(REPO, fp).replace(/\\/g, '/');
          r.docReads[key] = (r.docReads[key] || 0) + 1;
        }
        if (/^(Write|Edit|NotebookEdit)$/.test(nm)) {
          const s = JSON.stringify(blk.input || {});
          if (/outputs[/\\][^"]*tasks[/\\]/.test(s)) r.ghiVaoTask += 1;
          if (DOC_KIT.test(fp)) r.suaTaiLieuKit += 1;
        }
      } else if (blk.type === 'tool_result') {
        const meta = tenTheoId.get(blk.tool_use_id);
        if (!meta) continue;
        const n = coTextKetQua(blk);
        r.nguon[meta.nguon] = (r.nguon[meta.nguon] || 0) + n;
      }
    }
  }
  /* Phân loại phiên — neo bằng số lượt GHI vào outputs/tasks, không bằng việc có đọc prompt hay không. */
  r.loai = r.ghiVaoTask >= 20 ? 'CHẠY TASK' : (r.suaTaiLieuKit > 0 ? 'SỬA KIT' : 'khác');
  return r;
}

const k = (n) => `${Math.round(n / 100) / 10}k`;
const M = (n) => `${Math.round(n / 1e5) / 10}M`;

function inMotPhien(r) {
  const tongKetQua = Object.values(r.nguon).reduce((a, b) => a + b, 0) / CHARS_PER_TOK;
  console.log(`[token-audit] ${r.file} · ${r.loai} · ${r.message} message`);
  console.log(`  input ${k(r.inputTok)} · output ${k(r.outputTok)} · cache read ${M(r.cacheRead)} · cache create ${k(r.cacheCreate)}`);
  const tongVao = r.inputTok + r.cacheRead + r.cacheCreate;
  const hit = tongVao ? (r.cacheRead / tongVao) * 100 : 0;
  console.log(`  cache-hit ${hit.toFixed(1)}% · context trung bình mỗi message ~${k(r.message ? tongVao / r.message : 0)} token`);
  console.log('');
  console.log('| Nguồn | ~token kết quả | % |');
  console.log('|---|---|---|');
  for (const [nm, by] of Object.entries(r.nguon).sort((a, b) => b[1] - a[1])) {
    const t = by / CHARS_PER_TOK;
    console.log(`| ${nm} | ${k(t)} | ${tongKetQua ? ((t / tongKetQua) * 100).toFixed(1) : '0'}% |`);
  }
  const reread = Object.entries(r.docReads).sort((a, b) => b[1] - a[1]);
  console.log('');
  const tongRead = Object.values(r.toolCalls).length ? (r.toolCalls.Read || 0) : 0;
  const soDoc = reread.reduce((n, x) => n + x[1], 0);
  console.log(`Read vào TÀI LIỆU của kit: ${soDoc} lượt / ${tongRead} lượt Read.`);
  if (reread.length) {
    console.log('');
    console.log('| Lượt đọc | File tài liệu kit |');
    console.log('|---|---|');
    for (const [f, n] of reread.slice(0, 20)) console.log(`| ${n} | \`${f}\` |`);
  }
  console.log('');
  console.log('| Tool | Lượt gọi |');
  console.log('|---|---|');
  for (const [nm, n] of Object.entries(r.toolCalls).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`| ${nm} | ${n} |`);
  }
  inMauLenh(r.mauLenh, Object.entries(r.toolCalls).filter(([x]) => /^(Bash|PowerShell)$/.test(x)).reduce((a, b) => a + b[1], 0));
  canhBaoNguong(r);
}

/** Top mẫu lệnh theo SỐ LƯỢT — đây là bảng dùng để chọn việc cần gộp, bó hoặc đổi tool. */
function inMauLenh(mauLenh, tongShell, tran = 15) {
  const rows = Object.entries(mauLenh || {}).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return;
  console.log('');
  console.log(`| Lượt | % shell | Mẫu lệnh (đã bỏ đối số) |`);
  console.log('|---|---|---|');
  for (const [m, c] of rows.slice(0, tran)) {
    console.log(`| ${c} | ${tongShell ? ((c / tongShell) * 100).toFixed(1) : '0'}% | \`${m}\` |`);
  }
  /*
   * BẢNG THỨ HAI — GOM THÔ: bỏ cả cờ và bỏ `cd &&`.
   *
   * Bảng có cờ bên trên phân mảnh nặng: đo 10/10/2026, 59,6% lượt rơi vào "1807 mẫu còn lại" vì
   * `npx playwright test` và các gate có hàng chục tổ hợp cờ. Muốn chọn việc để GỘP hay BÓ thì phải
   * đếm theo VIỆC, không theo cách gọi. Bảng có cờ vẫn giữ, vì nó cho biết cùng một việc đang được
   * gọi bằng bao nhiêu kiểu khác nhau.
   */
  const tho = {};
  for (const [m, c] of rows) {
    const k2 = m.replace(/^cd && /, '').replace(/\s--[a-z][a-z0-9-]*/gi, '').trim();
    tho[k2] = (tho[k2] || 0) + c;
  }
  const rowsTho = Object.entries(tho).sort((a, b) => b[1] - a[1]);
  console.log('');
  console.log('| Lượt | % shell | Việc (gom thô: bỏ cờ và bỏ cd) |');
  console.log('|---|---|---|');
  for (const [m, c] of rowsTho.slice(0, tran)) {
    console.log(`| ${c} | ${tongShell ? ((c / tongShell) * 100).toFixed(1) : '0'}% | \`${m}\` |`);
  }
  const conTho = rowsTho.slice(tran).reduce((a, b) => a + b[1], 0);
  if (conTho) console.log(`| ${conTho} | ${tongShell ? ((conTho / tongShell) * 100).toFixed(1) : '0'}% | _(${rowsTho.length - tran} việc còn lại)_ |`);

  /*
   * ĐÁNG LẼ DÙNG TOOL CHUYÊN DỤNG — con số đòn bẩy lớn nhất của H0.
   *
   * `grep` đã có tool Grep, `sed -n`/`cat`/`head`/`tail` đã có Read (có offset và limit), `ls`/`find` đã có
   * Glob. Mỗi lượt shell là một message kèm cả context, nên đi đường vòng qua Bash không rẻ hơn — nó
   * chỉ khó đếm hơn.
   *
   * Đây là CẢNH BÁO, không phải CHẶN: có những lượt `grep` thật sự cần pipe hoặc cần đếm, và chặn
   * ở đây là báo oan. Nhưng con số phải được in ra: một lượt 2.765 lượt trông y như một lượt 100 nếu
   * không ai đếm.
   */
  const COCU = { grep: 'Grep', rg: 'Grep', 'Select-String': 'Grep', sed: 'Read', cat: 'Read', head: 'Read', tail: 'Read', 'Get-Content': 'Read', ls: 'Glob', find: 'Glob', 'Get-ChildItem': 'Glob' };
  const theoTool = {};
  for (const [m, c] of rowsTho) {
    const t = COCU[m];
    if (t) theoTool[t] = (theoTool[t] || 0) + c;
  }
  const tongCocu = Object.values(theoTool).reduce((a, b) => a + b, 0);
  if (tongCocu) {
    console.log('');
    console.log(`ĐÁNG LẼ DÙNG TOOL CHUYÊN DỤNG: ${tongCocu} lượt (${tongShell ? ((tongCocu / tongShell) * 100).toFixed(1) : '0'}% số lượt shell)`);
    for (const [t, c] of Object.entries(theoTool).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(c).padStart(5)} → ${t}`);
    }
    console.log('  Mỗi lượt shell là một message kèm cả context. Đi vòng qua Bash không rẻ hơn, chỉ khó đếm hơn.');
  }

  const con = rows.slice(tran).reduce((a, b) => a + b[1], 0);
  if (con) console.log(`| ${con} | ${tongShell ? ((con / tongShell) * 100).toFixed(1) : '0'}% | _(${rows.length - tran} mẫu còn lại)_ |`);
}

/*
 * CẢNH BÁO NGƯỠNG — ngưỡng đặt trong `.agent/config/prompt_budget.json`, không ghi cứng ở đây.
 *
 * Không CHẶN: đây là máy BÁO CÁO, và nó đo một lượt ĐÃ CHẠY RỒI — chặn lúc đó không cứu được gì.
 * Nhưng phải KÊU, vì một lượt 2.800 lượt shell trông y như một lượt 300 lượt nếu không ai đếm.
 */
function canhBaoNguong(r) {
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent', 'config', 'prompt_budget.json'), 'utf8')); } catch (e) { return; }
  const ng = cfg.nguong_mot_luot;
  if (!ng) {
    console.log('\n[token-audit] ⚠ thiếu `nguong_mot_luot` trong prompt_budget.json ⇒ cảnh báo chi phí một lượt CHƯA ĐƯỢC GÁC.');
    return;
  }
  if (r.loai !== 'CHẠY TASK') return;
  const soShell = Object.entries(r.toolCalls).filter(([x]) => /^(Bash|PowerShell)$/.test(x)).reduce((a, b) => a + b[1], 0);
  const tongVao = r.inputTok + r.cacheRead + r.cacheCreate;
  const ctx = r.message ? tongVao / r.message : 0;
  const y = [];
  if (ng.so_luot_shell && soShell > ng.so_luot_shell) {
    y.push(`${soShell} lượt shell > ngưỡng ${ng.so_luot_shell}`);
  }
  if (ng.context_tb_moi_message && ctx > ng.context_tb_moi_message) {
    y.push(`context TB ${k(ctx)}/message > ngưỡng ${k(ng.context_tb_moi_message)}`);
  }
  if (!y.length) return;
  console.log(`\n[token-audit] ⚠ lượt này vượt ngưỡng: ${y.join(' · ')}`);
  for (const d of (ng.de_xuat || [])) console.log(`  → ${d}`);
}

async function inTopMau(dir) {
    /* GỘP mọi phiên CHẠY TASK. Một phiên đơn lẻ dễ mang đặc thù của task đó; bảng để ra quyết định
     * sửa kit thì phải đếm trên nhiều lượt. Phiên SỬA KIT bị LOẠI — chi phí của nó không phải chi phí task. */
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(dir, f));
    const gop = {};
    let soShell = 0;
    const phien = [];
    for (const f of files) {
      const r = await doMotPhien(f);
      if (r.loai !== 'CHẠY TASK') continue;
      phien.push(r.file.slice(0, 8));
      for (const [m, c] of Object.entries(r.mauLenh)) gop[m] = (gop[m] || 0) + c;
      soShell += Object.entries(r.toolCalls).filter(([x]) => /^(Bash|PowerShell)$/.test(x)).reduce((a, b) => a + b[1], 0);
    }
    if (!phien.length) {
      console.error('[token-audit] không có phiên CHẠY TASK nào ⇒ không đo được mẫu lệnh của một lượt task.');
      process.exit(2);
    }
    console.log(`[token-audit] top mẫu lệnh trên ${phien.length} phiên CHẠY TASK (${phien.join(', ')}) — ${soShell} lượt shell`);
    inMauLenh(gop, soShell, Number(arg('top', '15')));
    const tongMau = Object.keys(gop).length;
    console.log(`\n${tongMau} mẫu khác nhau trên ${soShell} lượt — trung bình mỗi mẫu lặp ${(soShell / tongMau).toFixed(1)} lần.`);
}

async function main() {
  const dir = thuMucTranscript();

  if (flag('list')) {
    if (!dir) { console.error('[token-audit] không tìm thấy thư mục transcript (~/.claude/projects/<project>).'); process.exit(2); }
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(dir, f));
    console.log(`[token-audit] ${files.length} transcript ở ${dir}`);
    console.log('');
    console.log('| Phiên | Loại | message | ghi vào task | context TB/message | File |');
    console.log('|---|---|---|---|---|---|');
    for (const f of files) {
      const r = await doMotPhien(f);
      const tongVao = r.inputTok + r.cacheRead + r.cacheCreate;
      console.log(`| ${r.file.slice(0, 8)} | ${r.loai} | ${r.message} | ${r.ghiVaoTask} | ~${k(r.message ? tongVao / r.message : 0)} | \`${r.file}\` |`);
    }
    console.log('\nPhiên `CHẠY TASK` mới dùng được làm mốc. `SỬA KIT` là phiên bảo trì kit, chi phí của nó KHÔNG phải chi phí của task.');
    return;
  }

  /* `--mau` GOP nhieu phien nen no khong can `--transcript`. Dat TRUOC cho chan duoi. */
  if (flag('mau') && !arg('transcript', '')) { await inTopMau(dir); return; }

  const t = arg('transcript', '');
  if (!t) {
    console.error('[token-audit] cần --transcript <file.jsonl>, hoặc --list để xem danh sách.');
    console.error('  Không có transcript thì chỉ dùng được số đo tĩnh (`npm run prompt:budget`).');
    process.exit(2);
  }
  const file = fs.existsSync(t) ? t : (dir ? path.join(dir, t) : t);
  if (!fs.existsSync(file)) { console.error(`[token-audit] không thấy transcript: ${t}`); process.exit(2); }

  const r = await doMotPhien(file);
  inMotPhien(r);
  if (r.loai !== 'CHẠY TASK') {
    console.log(`\n[token-audit] ⚠ Phiên này phân loại là ${r.loai} (ghi vào outputs/tasks: ${r.ghiVaoTask} lượt).`);
    console.log('  Dùng nó làm mốc cho "chi phí một lượt chạy task" là SAI. Chạy --list để chọn phiên CHẠY TASK.');
  }

  if (flag('json')) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const p = path.join(OUT_DIR, 'baseline.dynamic.json');
    const cu = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { _doc: '', phien: {} };
    cu._doc = 'Đo ĐỘNG từ transcript. CHỈ số đếm, tên file, tên tool — KHÔNG có nội dung transcript. Sinh bằng `npm run token:audit`.';
    cu._he_so = `${CHARS_PER_TOK} ký tự/token`;
    cu.phien = cu.phien || {};
    cu.phien[r.file] = { ...r, file: r.file };
    fs.writeFileSync(p, `${JSON.stringify(cu, null, 2)}\n`, 'utf8');
    console.log(`\n[token-audit] đã ghi ${path.relative(REPO, p).replace(/\\/g, '/')} — chạy \`npm run secret:scan\` sau bước này.`);
  }
}

module.exports = { doMotPhien, nguonCua, mauCua, CHARS_PER_TOK };

if (require.main === module) main();
