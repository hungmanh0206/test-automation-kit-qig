#!/usr/bin/env node
'use strict';

/*
 * Seed Knowledge từ lịch sử Backlog (Suggest-only, DRY-RUN mặc định).
 *
 * Migrated từ seed_knowledge_from_backlog.js (22/09/2026). Khác Backlog:
 *   - KHÔNG có JQL — filter theo field (projectId/issueTypeId/statusId/updatedSince).
 *   - KHÔNG có Components/Labels tự do — module suy từ Category (gần nhất với Backlog Components).
 *   - Có Resolution (Fixed/Won't Fix/Duplicate/Invalid/Cannot Reproduce...) — giữ được logic lọc "chỉ
 *     seed bug đã fix thật", tên resolution có thể khác Backlog đôi chút, review bảng map khi seed lần đầu.
 *
 * Vì sao: kit chỉ điền knowledge/ khi bug qua gate ở Phase 2 (learning_recorder).
 * Dự án mới → knowledge rỗng → risk_score cold-start chỉ dựa Impact (đoán Likelihood).
 * Script này nạp bug đã resolved trên Backlog vào
 * knowledge/{bugs,historical_execution} → risk_score có ngay Likelihood thật
 * (bugCount + failRate) thay vì cold-start. Không đổi risk_score, chỉ cấp dữ liệu.
 *
 * AN TOÀN:
 *   - DRY-RUN mặc định (chỉ in preview + bảng map module). Phải --apply mới ghi file.
 *   - Chỉ đọc Backlog (GET). KHÔNG tạo/sửa issue.
 *   - KHÔNG ghi PII: mask email/SĐT trong mô tả; chỉ trích field theo SCHEMA (không description/assignee).
 *   - Idempotent: dedup theo bug id (chạy lại không nhân đôi).
 *   - Chỉ seed bug có resolution = fix thật (loại Duplicate/Won't Fix/Cannot Reproduce...).
 *   - Đánh dấu source="backlog-seed" để phân biệt với bug qua kit-gate (learning_recorder).
 *
 * Dùng:
 *   node scripts/qa/seed_knowledge_from_backlog.js                         # dry-run, project = BACKLOG_PROJECT_KEY
 *   node scripts/qa/seed_knowledge_from_backlog.js --project dự án trước --since 2025-01-01
 *   node scripts/qa/seed_knowledge_from_backlog.js --apply                 # ghi thật vào knowledge/
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const backlogUtils = require(path.resolve(__dirname, '..', 'integrations', 'backlog', 'utils'));

backlogUtils.loadEnv();

const KNOW = path.join(rc.REPO_ROOT, 'knowledge');
const BASE = String(process.env.BACKLOG_BASE_URL || process.env.BACKLOG_URL || '').replace(/\/+$/, '');

// ---------- args ----------
const has = (n) => process.argv.includes(`--${n}`);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };

const APPLY = has('apply');
const PROJECT = arg('project', process.env.BACKLOG_PROJECT_KEY);
const SINCE = arg('since', '');
const MAX = parseInt(arg('max', '500'), 10);
const ISSUE_TYPE_NAME = arg('issue-type', 'Bug');
const INCLUDE_ALL_RES = has('include-all-resolutions');

// Resolution KHÔNG phải fix thật → không seed (không phải confirmed product bug).
const NON_FIX_RES = /duplicate|won'?t\s*(do|fix)|cannot\s*reproduce|can'?t\s*reproduce|not\s*a\s*bug|rejected|declined|incomplete|gone\s*away|as\s*designed|invalid/i;

// ---------- helpers ----------
const today = () => new Date().toISOString().slice(0, 10);
const kebab = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
const scrubPII = (s) => String(s || '')
  .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[email]')
  .replace(/(?<![\w.])(?:\+?84|0)\d{8,10}(?![\w.])/g, '[phone]');

// Backlog statusId cố định: 1=Open, 2=In Progress, 3=Resolved, 4=Closed (không phải statusCategory động như Backlog).
function backlogStatusOf(issue) {
  const id = issue.status?.id;
  if (id === 3 || id === 4) return 'Done';
  if (id === 2) return 'In Progress';
  return 'Open';
}

// Module suy từ Category (Backlog KHÔNG có Components/free-text Labels như Backlog).
function resolveModule(issue, fallbackModule) {
  const cats = (issue.category || []).map((c) => c.name).filter(Boolean);
  if (cats.length) return cats[0];
  const milestones = (issue.milestone || []).map((m) => m.name).filter(Boolean);
  if (milestones.length) return milestones[0];
  return fallbackModule || null;
}

function tagsOf(issue) {
  const raw = [
    ...(issue.category || []).map((c) => c.name),
    ...(issue.milestone || []).map((m) => m.name),
    issue.priority && issue.priority.name,
  ].filter(Boolean).map((t) => kebab(t)).filter(Boolean);
  return [...new Set(raw)].slice(0, 6);
}

function apiUrl(endpoint, params = {}) {
  const url = new URL(`${BASE}${endpoint}`);
  url.searchParams.set('apiKey', process.env.BACKLOG_API_KEY);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(`${key}[]`, v));
    else url.searchParams.set(key, value);
  }
  return url;
}

async function resolveProjectId(projectKeyOrId) {
  if (/^\d+$/.test(String(projectKeyOrId))) return Number(projectKeyOrId);
  const res = await fetch(apiUrl(`/api/v2/projects/${encodeURIComponent(projectKeyOrId)}`));
  if (!res.ok) return null;
  return (await res.json())?.id || null;
}

async function resolveIssueTypeId(projectId, name) {
  const res = await fetch(apiUrl(`/api/v2/projects/${projectId}/issueTypes`));
  if (!res.ok) return null;
  const types = await res.json();
  const match = (types || []).find((t) => String(t.name || '').trim().toLowerCase() === name.trim().toLowerCase());
  return match?.id || null;
}

async function searchIssues(params, cap) {
  const out = [];
  let offset = 0;
  const pageSize = Math.min(100, cap);
  while (out.length < cap) {
    const res = await fetch(apiUrl('/api/v2/issues', { ...params, count: Math.min(pageSize, cap - out.length), offset }));
    if (!res.ok) throw new Error(`Backlog API ${res.status}: ${await res.text()}`);
    const page = await res.json();
    if (!page.length) break;
    out.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return out.slice(0, cap);
}

// ---------- knowledge writes ----------
function purgeById(dir, id) {
  const p = path.join(KNOW, dir);
  if (!fs.existsSync(p)) return;
  for (const f of fs.readdirSync(p)) {
    if (!f.endsWith('.json')) continue;
    try { const o = JSON.parse(fs.readFileSync(path.join(p, f), 'utf8')); if (o.id === id) fs.unlinkSync(path.join(p, f)); } catch { /* ignore */ }
  }
}
function rebuildIndex() {
  const entries = [];
  const add = (type, dir, statusPick) => {
    const p = path.join(KNOW, dir);
    if (!fs.existsSync(p)) return;
    for (const f of fs.readdirSync(p).filter((x) => x.endsWith('.json'))) {
      let o; try { o = JSON.parse(fs.readFileSync(path.join(p, f), 'utf8')); } catch { continue; }
      entries.push({ type, file: `${dir}/${f}`, module: o.module || null, tags: o.tags || [], task_key: o.task_key || o.id || null, status: statusPick(o) });
    }
  };
  add('bug', 'bugs', (o) => o.backlog_status || o.backlog_status || null);
  add('root_cause', 'root_causes', (o) => o.status || null);
  add('historical_execution', 'historical_execution', () => null);
  add('locator', 'locators', () => null);
  fs.writeFileSync(path.join(KNOW, 'index.json'), JSON.stringify({ version: 1, updated_at: today(), entries }, null, 2), 'utf8');
  return entries.length;
}

// ---------- main ----------
async function seedBugs() {
  const projectId = await resolveProjectId(PROJECT);
  if (!projectId) { console.error(`[seed] Không resolve được project: ${PROJECT}`); process.exit(1); }
  const issueTypeId = await resolveIssueTypeId(projectId, ISSUE_TYPE_NAME);
  if (!issueTypeId) { console.error(`[seed] Không resolve được issue type "${ISSUE_TYPE_NAME}" trong project ${PROJECT}.`); process.exit(1); }

  const filterParams = {
    projectId: [projectId],
    issueTypeId: [issueTypeId],
    statusId: [3, 4], // Resolved, Closed — tương đương statusCategory = Done của Backlog
    updatedSince: SINCE || undefined,
  };
  console.log(`[seed] Backlog filter: ${JSON.stringify(filterParams)}`);
  const issues = await searchIssues(filterParams, MAX);
  console.log(`[seed] Backlog trả ${issues.length} bug (cap ${MAX}).`);

  const planned = []; const skipped = { resolution: 0, noModule: 0 };
  const perModule = {};
  for (const it of issues) {
    const resName = it.resolution?.name || '';
    if (!INCLUDE_ALL_RES && resName && NON_FIX_RES.test(resName)) { skipped.resolution++; continue; }
    const module = resolveModule(it);
    if (!module) { skipped.noModule++; continue; }
    const summary = scrubPII(it.summary || '');
    const slug = kebab(summary) || kebab(it.issueKey);
    const entry = {
      id: it.issueKey,
      bug: summary,
      module,
      tags: tagsOf(it),
      task_key: it.issueKey,
      detected_phase: 'historical',
      confirmed_via_gate: true,
      backlog_status: backlogStatusOf(it),
      created_at: (it.created || '').slice(0, 10) || today(),
      source: 'backlog-seed',
      backlog_resolution: resName || null,
      resolved_at: (it.updated || '').slice(0, 10) || null,
    };
    planned.push({ file: `bugs/${it.issueKey}__${slug}.json`, entry, cats: (it.category || []).map((c) => c.name) });
    perModule[module] = (perModule[module] || 0) + 1;
  }

  console.log(`\n[seed] Map module (theo Category):`);
  console.log('  Module'.padEnd(34) + '#bug');
  Object.entries(perModule).sort((a, b) => b[1] - a[1]).forEach(([m, n]) => console.log('  ' + m.padEnd(32) + ' ' + n));
  console.log(`\n[seed] Mẫu 8 map đầu (KEY → module ← nguồn):`);
  planned.slice(0, 8).forEach((p) => console.log(`  ${p.entry.id} → "${p.entry.module}"  ←  category[${p.cats.join(',') || '-'}]`));
  console.log(`\n[seed] Sẽ ghi ${planned.length} bug · bỏ ${skipped.resolution} (resolution không phải fix) · ${skipped.noModule} (không suy được module).`);

  if (APPLY && planned.length) {
    fs.mkdirSync(path.join(KNOW, 'bugs'), { recursive: true });
    for (const p of planned) { purgeById('bugs', p.entry.id); fs.writeFileSync(path.join(KNOW, p.file), JSON.stringify(p.entry, null, 2), 'utf8'); }
    console.log(`[seed] ✓ Đã ghi ${planned.length} file vào knowledge/bugs/.`);
  }
  return planned.length;
}

async function main() {
  if (!BASE) { console.error('[seed] Thiếu BACKLOG_BASE_URL. Điền .env (xem .env.example ở gốc repo).'); process.exit(1); }
  if (!process.env.BACKLOG_API_KEY) { console.error('[seed] Thiếu BACKLOG_API_KEY.'); process.exit(1); }
  if (!PROJECT) { console.error('[seed] Thiếu --project hoặc BACKLOG_PROJECT_KEY.'); process.exit(1); }
  console.log(`[seed] MODE: ${APPLY ? 'APPLY (ghi thật)' : 'DRY-RUN (chỉ preview — thêm --apply để ghi)'} · project=${PROJECT}`);

  await seedBugs();

  if (APPLY) {
    const n = rebuildIndex();
    console.log(`[seed] ✓ Rebuild knowledge/index.json (${n} entry).`);
    console.log('[seed] Xong. Chạy `npm run risk` để thấy Likelihood có dữ liệu (hết cold-start). QA nên soi lại bảng map module.');
  } else {
    console.log('\n[seed] DRY-RUN — chưa ghi gì. Kiểm bảng map module ở trên; ổn thì chạy lại với --apply.');
  }
}

main().catch((e) => { console.error('[seed] LỖI:', e && e.message ? e.message : e); process.exit(1); });
