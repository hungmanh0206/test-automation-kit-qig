#!/usr/bin/env node
'use strict';

/*
 * inject_context.js (G7 — round-3) — SessionStart hook: bơm DETERMINISTIC context vào MỌI phiên.
 *
 * Chống "miss đọc file" tận gốc: thay vì trông agent tự nhớ đọc rule/config/input, HARNESS bơm sẵn
 * (1) tóm tắt forcing-functions + con trỏ nguồn (CLAUDE.md, verdict_taxonomy) và (2) kết quả preflight
 * config-integrity NGAY tại session start. Không phụ thuộc agent nhớ chạy gì.
 *
 * Wire (.claude/settings.json — local, như gate_on_write):
 *   "SessionStart": [{ "hooks": [{ "type":"command", "command":"node scripts/qa/hooks/inject_context.js" }] }]
 * Đọc stdin (bỏ qua), in JSON {hookSpecificOutput:{hookEventName:'SessionStart', additionalContext}}.
 * Best-effort: mọi lỗi → vẫn in context tối thiểu (không làm hỏng session).
 */

const path = require('path');

let pf = { problems: [], warnings: [] };
try { pf = require(path.resolve(__dirname, '..', 'preflight_gate')).runPreflight({ mode: 'generic' }) || pf; } catch (e) { /* best-effort */ }

const nProb = (pf.problems || []).length;
const cfgLine = nProb
  ? `⚠ CONFIG/CONTEXT có ${nProb} vấn đề (sửa trước khi làm): ${(pf.problems || []).slice(0, 5).join(' · ')}`
  : '✓ config/context integrity OK';

// Skill của kit nằm ở `.agent/skills/**`, KHÔNG phải `.claude/skills/` → harness không tự phát hiện, và
// prompt chỉ nhắc TÊN nên agent phải tự đoán đường dẫn. Bơm bảng tra vào đây để hết phải đoán.
// Chỉ nêu TÊN + chỗ tra (không nhồi 21 description vào mọi session — tốn context mà phần lớn không dùng tới).
let skillLine = '';
try {
  const { execFileSync } = require('child_process');
  const raw = execFileSync(process.execPath, [path.join(__dirname, '..', 'skills_index.js'), '--json'], { encoding: 'utf8', timeout: 10000 });
  const rows = JSON.parse(raw);
  if (rows.length) {
    skillLine = `Skill của kit (${rows.length}, KHÔNG auto-load — mở file để dùng, tên = tên thư mục): ${rows.map((r) => r.name).join(' · ')}. Mô tả "dùng khi nào" + đường dẫn đầy đủ: .agent/skills/INDEX.md (sinh lại: node scripts/qa/skills_index.js --write).`;
  }
} catch (e) { /* thiếu skill index không được làm hỏng session */ }

const ctx = [
  '[KIT FORCING FUNCTIONS — round-3] Output của bạn bị GATE máy-kiểm (preflight · design_gate · output_gate · risk_gate + harness hook); sai chuẩn = CHẶN, KHÔNG push được. Rule là forcing function, không phải "dặn".',
  'Non-negotiables (đọc): CLAUDE.md. Verdict/rerun (1 nguồn): .agent/config/verdict_taxonomy.json — FAIL bắt buộc kèm failureLayer; rerun 2–3 lần; "không phán được" KHÔNG thành PASS.',
  'TRƯỚC execute (Phase 2): `node scripts/qa/preflight_gate.js --mode phase2 --task <TASK_KEY>` — thiếu input/config hỏng/testcase canonical chưa có = CHẶN.',
  'TRƯỚC finalize/publish: `npm run self-review -- --task <TASK_KEY>` — checklist gộp (preflight+design+row-quality+execution+attestation).',
  `Preflight config integrity (giờ): ${cfgLine}.`,
  skillLine,
].filter(Boolean).join('\n');

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx },
  suppressOutput: true,
}));
