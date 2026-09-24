/**
 * Backlog Fetcher - Lấy Requirement / Story / Issue từ Backlog
 *
 * Migrated từ backlog_fetcher.js (22/09/2026). Khác Backlog:
 *   - Auth qua query param `apiKey=` (không Basic/Bearer/PAT).
 *   - KHÔNG có JQL — filter theo field (`projectId[]`, `keyword`, `statusId[]`, `parentIssueId[]`...).
 *   - KHÔNG có khái niệm "Epic" — `--epic <KEY>` giờ nghĩa là "lấy issue con của issue cha <KEY>"
 *     (dùng `parentIssueId[]`, gần nhất với Epic children của Backlog).
 *   - description đã là plain text — không cần bước convert rich-doc sang Markdown như hệ cũ.
 *
 * Sử dụng:
 *   node backlog_fetcher.js --issue ABC-123
 *   node backlog_fetcher.js --project ABC --keyword "đăng nhập"
 *   node backlog_fetcher.js --epic ABC-10          (issue con của ABC-10)
 *   node backlog_fetcher.js --issue ABC-123 --output ./output/requirement.json
 */

const path = require('path');
const fs = require('fs');
const {
  loadEnv,
  validateEnvVars,
  backlogAuthParams,
  formatBacklogIssue,
  getProjectOutputDir,
  getTaskKey,
  getTaskOutputDir,
  saveJsonToFile,
  saveTextToFile,
  getTimestamp,
  log,
} = require('./utils');

let BACKLOG_BASE_URL;

function initEnv() {
  loadEnv();
  validateEnvVars(['BACKLOG_BASE_URL', 'BACKLOG_API_KEY']);
  BACKLOG_BASE_URL = process.env.BACKLOG_BASE_URL.replace(/\/+$/, '');
}

function apiUrl(endpoint, params = {}) {
  const url = new URL(`${BACKLOG_BASE_URL}${endpoint}`);
  url.searchParams.set('apiKey', backlogAuthParams().apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(`${key}[]`, v));
    else url.searchParams.set(key, value);
  }
  return url;
}

/** BACKLOG_PROJECT_KEY (text) hoặc key truyền vào → id số project. */
async function resolveProjectId(projectKeyOrId) {
  if (/^\d+$/.test(String(projectKeyOrId))) return Number(projectKeyOrId);
  const res = await fetch(apiUrl(`/api/v2/projects/${encodeURIComponent(projectKeyOrId)}`));
  if (!res.ok) return null;
  const data = await res.json();
  return data?.id || null;
}

/**
 * Lấy một issue cụ thể theo key
 * @param {string} issueKey - VD: "PROJ-123"
 * @returns {object} Issue data
 */
async function fetchIssue(issueKey) {
  log('LOG', `Đang lấy issue: ${issueKey} ...`);
  try {
    const res = await fetch(apiUrl(`/api/v2/issues/${encodeURIComponent(issueKey)}`));
    if (!res.ok) { handleApiError(res, await safeJson(res), `Lấy issue ${issueKey}`); return null; }
    log('LOG', `Đã lấy thành công: ${issueKey}`);
    return await res.json();
  } catch (error) {
    log('ERROR', `[Lấy issue ${issueKey}] ${error.message}`);
    return null;
  }
}

/**
 * Tìm issues theo filter (projectId/keyword/statusId/parentIssueId) — KHÔNG có JQL, chỉ filter field.
 * @param {object} filters - { projectId, keyword, statusId, parentIssueId }
 * @param {number} maxResults
 * @returns {object[]}
 */
async function searchIssues(filters, maxResults = 50) {
  log('LOG', `Đang tìm kiếm với filter: ${JSON.stringify(filters)}`);
  try {
    const allIssues = [];
    const pageSize = Math.min(100, maxResults);
    let offset = 0;
    while (allIssues.length < maxResults) {
      const res = await fetch(apiUrl('/api/v2/issues', { ...filters, count: Math.min(pageSize, maxResults - allIssues.length), offset }));
      if (!res.ok) { handleApiError(res, await safeJson(res), 'Tìm kiếm issues'); break; }
      const page = await res.json();
      if (!page.length) break;
      allIssues.push(...page);
      log('LOG', `Đã lấy ${allIssues.length} issues`);
      if (page.length < pageSize) break;
      offset += pageSize;
    }
    return allIssues;
  } catch (error) {
    log('ERROR', `[Tìm kiếm issues] ${error.message}`);
    return [];
  }
}

/**
 * Lấy tất cả issues của một project theo type
 * @param {string} projectKey - VD: "PROJ"
 * @param {string} [keyword] - lọc theo từ khoá (KHÔNG có filter theo issue type name trực tiếp — Backlog
 *   issueTypeId là số, cần resolve trước nếu muốn lọc theo loại; để trống = lấy mọi loại)
 * @param {number} maxResults
 * @returns {object[]}
 */
async function fetchProjectIssues(projectKey, keyword = '', maxResults = 100) {
  const projectId = await resolveProjectId(projectKey);
  if (!projectId) { log('ERROR', `Không resolve được project: ${projectKey}`); return []; }
  return searchIssues({ projectId: [projectId], keyword: keyword || undefined }, maxResults);
}

/**
 * Lấy tất cả issue con (subtask) của một issue cha — thay cho "Epic children" của Backlog (Backlog không có
 * Epic; parent-child issue là cấu trúc gần nhất).
 * @param {string} parentKey - VD: "PROJ-10"
 * @returns {object[]}
 */
async function fetchParentChildren(parentKey) {
  const parent = await fetchIssue(parentKey);
  if (!parent?.id) { log('ERROR', `Không tìm thấy issue cha: ${parentKey}`); return []; }
  return searchIssues({ projectId: [parent.projectId], parentIssueId: [parent.id] }, 200);
}

/**
 * Lấy comments của một issue
 * @param {string} issueKey
 * @returns {object[]}
 */
async function fetchComments(issueKey) {
  log('LOG', `Đang lấy comments của: ${issueKey} ...`);
  try {
    const res = await fetch(apiUrl(`/api/v2/issues/${encodeURIComponent(issueKey)}/comments`));
    if (!res.ok) { handleApiError(res, await safeJson(res), `Lấy comments ${issueKey}`); return []; }
    return await res.json();
  } catch (error) {
    log('ERROR', `[Lấy comments ${issueKey}] ${error.message}`);
    return [];
  }
}

/**
 * Download tất cả attachments của một issue
 * @param {object} rawIssue - Raw issue data từ Backlog API
 * @param {string} outputDir - Thư mục lưu file
 * @returns {object[]} Danh sách file đã tải
 */
async function downloadAttachments(rawIssue, outputDir) {
  const attachments = rawIssue.attachments || [];
  if (attachments.length === 0) {
    log('LOG', `${rawIssue.issueKey}: Không có attachment`);
    return [];
  }

  const issueDir = path.join(outputDir, rawIssue.issueKey);
  if (!fs.existsSync(issueDir)) fs.mkdirSync(issueDir, { recursive: true });

  const downloaded = [];
  for (const att of attachments) {
    const filePath = path.join(issueDir, att.name);
    try {
      log('LOG', `Đang tải: ${att.name} (${(att.size / 1024).toFixed(1)} KB)`);
      const res = await fetch(apiUrl(`/api/v2/issues/${rawIssue.id}/attachments/${att.id}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(filePath, buf);
      downloaded.push({ filename: att.name, path: filePath, size: att.size });
      log('LOG', `Đã tải: ${att.name}`);
    } catch (error) {
      log('ERROR', `Không tải được ${att.name}: ${error.message}`);
    }
  }

  log('LOG', `${rawIssue.issueKey}: Đã tải ${downloaded.length}/${attachments.length} attachments`);
  return downloaded;
}

/**
 * Lấy danh sách attachment metadata từ issue (không download)
 * @param {object} rawIssue - Raw issue data
 * @returns {object[]} Danh sách attachment info
 */
function getAttachmentList(rawIssue) {
  return (rawIssue.attachments || []).map((att) => ({
    id: att.id,
    filename: att.name,
    size: att.size,
    created: att.created,
  }));
}

/**
 * Chuyển issue thành Requirement Document (Markdown)
 * @param {object} rawIssue - Raw issue data từ Backlog API
 * @param {string} [attachmentDir] - Thư mục chứa attachments (để tạo link)
 * @returns {string} Markdown content
 */
function issueToRequirementMarkdown(rawIssue, attachmentDir) {
  const issue = formatBacklogIssue(rawIssue);
  const attachments = getAttachmentList(rawIssue);

  let md = '';
  md += `# ${issue.key}: ${issue.summary}\n\n`;
  md += `| Thuộc tính | Giá trị |\n`;
  md += `|---|---|\n`;
  md += `| **Issue Key** | ${issue.key} |\n`;
  md += `| **Loại** | ${issue.issueType} |\n`;
  md += `| **Trạng thái** | ${issue.status} |\n`;
  md += `| **Độ ưu tiên** | ${issue.priority} |\n`;
  md += `| **Người giao** | ${issue.assignee} |\n`;
  md += `| **Người báo** | ${issue.reporter} |\n`;
  md += `| **Milestone** | ${issue.milestones.join(', ') || 'N/A'} |\n`;
  md += `| **Category** | ${issue.categories.join(', ') || 'N/A'} |\n`;
  md += `| **Attachments** | ${attachments.length > 0 ? attachments.length + ' file(s)' : 'N/A'} |\n`;
  md += `| **Ngày tạo** | ${issue.created} |\n`;
  md += `| **Cập nhật** | ${issue.updated} |\n`;
  md += `\n## Mô tả (Description)\n\n`;
  md += issue.description || '_Không có mô tả_';
  md += '\n';

  if (attachments.length > 0) {
    md += `\n## Attachments (${attachments.length} file)\n\n`;
    md += `| # | Filename | Size |\n`;
    md += `|---|----------|------|\n`;
    attachments.forEach((att, i) => {
      const sizeStr = att.size < 1024
        ? `${att.size} B`
        : att.size < 1024 * 1024 ? `${(att.size / 1024).toFixed(1)} KB` : `${(att.size / (1024 * 1024)).toFixed(1)} MB`;
      const relPath = attachmentDir === 'same-folder' ? att.filename : attachmentDir ? `${issue.key}/${att.filename}` : '';
      const nameCell = relPath ? `[${att.filename}](${relPath})` : att.filename;
      md += `| ${i + 1} | ${nameCell} | ${sizeStr} |\n`;
    });
  }

  return md;
}

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

/**
 * Xử lý lỗi từ Backlog API
 */
function handleApiError(res, data, context) {
  const status = res.status;
  log('ERROR', `[${context}] HTTP ${status}`);
  if (status === 401 || status === 403) {
    log('ERROR', 'Lỗi xác thực/quyền. Kiểm tra BACKLOG_API_KEY và quyền trên project Backlog.');
  } else if (status === 404) {
    log('ERROR', 'Không tìm thấy resource. Kiểm tra BACKLOG_BASE_URL và issue key.');
  } else {
    log('ERROR', `Response: ${JSON.stringify(data)}`);
  }
}

// ============ CLI ============

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || Object.keys(args).length === 0) {
    printUsage();
    return;
  }

  initEnv();

  let results = [];
  let mode = 'unknown';

  if (args.issue) {
    mode = 'single';
    const raw = await fetchIssue(args.issue);
    if (raw) results.push(raw);
  } else if (args.project) {
    mode = 'project';
    results = await fetchProjectIssues(args.project, args.keyword || '', parseInt(args.max) || 100);
  } else if (args.epic) {
    mode = 'children';
    results = await fetchParentChildren(args.epic);
  }

  if (results.length === 0) {
    log('WARN', 'Không có kết quả nào.');
    return;
  }

  log('LOG', `Tổng số issues: ${results.length}`);

  let ticketKey;
  if (args.epic) ticketKey = args.epic;
  else if (args.issue) ticketKey = args.issue;
  else if (args.project) ticketKey = `${args.project}_issues`;
  else ticketKey = `search_${getTimestamp()}`;

  const projectOutputDir = getProjectOutputDir();
  const taskKey = getTaskKey({ task: process.env.TASK_KEY || process.env.TASK_SCOPE || ticketKey });
  const taskOutputDir = getTaskOutputDir({ projectOutputDir, taskKey });
  const baseOutputDir = args.output || path.resolve(__dirname, '..', '..', '..', taskOutputDir, 'requirements', 'backlog');

  const ticketDir = path.join(baseOutputDir, ticketKey);
  if (!fs.existsSync(ticketDir)) fs.mkdirSync(ticketDir, { recursive: true });

  if (args.attachments) {
    for (const issue of results) await downloadAttachments(issue, ticketDir);
  }

  if (args.format === 'md' || args.format === 'markdown') {
    const hasAttachments = !!args.attachments;

    for (const rawIssue of results) {
      const issueKey = rawIssue.issueKey;
      const issueDir = path.join(ticketDir, issueKey);
      if (!fs.existsSync(issueDir)) fs.mkdirSync(issueDir, { recursive: true });

      const mdContent = issueToRequirementMarkdown(rawIssue, hasAttachments ? 'same-folder' : null);
      const mdFile = path.join(issueDir, `${issueKey}_requirement.md`);
      saveTextToFile(mdFile, mdContent);
    }

    if (results.length > 1) {
      let overview = `# ${ticketKey} — Tổng quan\n\n`;
      overview += `> Tổng số issues: ${results.length} | Ngày lấy: ${new Date().toISOString()}\n\n`;
      overview += `| # | Key | Type | Status | Summary | Attachments |\n`;
      overview += `|---|-----|------|--------|---------|-------------|\n`;
      results.forEach((r, i) => {
        const f = formatBacklogIssue(r);
        const attCount = (r.attachments || []).length;
        const attInfo = attCount > 0 ? `📎 ${attCount}` : '—';
        overview += `| ${i + 1} | [${f.key}](./${f.key}/${f.key}_requirement.md) | ${f.issueType} | ${f.status} | ${f.summary} | ${attInfo} |\n`;
      });
      const overviewFile = path.join(ticketDir, `${ticketKey}_overview.md`);
      saveTextToFile(overviewFile, overview);
    }
  } else {
    const formatted = results.map((r) => {
      const f = formatBacklogIssue(r);
      f.attachments = getAttachmentList(r);
      return f;
    });

    const jsonFile = path.join(ticketDir, `${ticketKey}_issues.json`);
    saveJsonToFile(jsonFile, {
      fetchedAt: new Date().toISOString(),
      mode,
      ticketKey,
      total: formatted.length,
      issues: formatted,
    });

    console.log('\n--- Tóm tắt kết quả ---');
    formatted.forEach((issue) => {
      const attCount = issue.attachments?.length || 0;
      const attInfo = attCount > 0 ? ` | 📎 ${attCount} files` : '';
      console.log(`  ${issue.key} | ${issue.issueType} | ${issue.status} | ${issue.summary}${attInfo}`);
    });
  }

  log('LOG', `Output: ${ticketDir}`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.replace('--', '');
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function printUsage() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║             BACKLOG FETCHER                                  ║
║     Lấy Requirement / Story / Issue từ Backlog                ║
╚══════════════════════════════════════════════════════════════╝

Cách sử dụng:
  node backlog_fetcher.js [options]

Options:
  --issue <KEY>       Lấy 1 issue cụ thể (VD: PROJ-123)
  --project <KEY>     Lấy issues theo project key
  --keyword <TEXT>    Lọc theo từ khoá (dùng với --project) — Backlog KHÔNG có JQL
  --epic <KEY>        Lấy issue con (subtask) của issue cha <KEY> — gần nhất với "Epic children" của Backlog
  --max <NUMBER>      Số kết quả tối đa - default: 50/100 tuỳ mode
  --format <FMT>      Định dạng output: json (default) hoặc md
  --attachments       Tải kèm file đính kèm (lưu vào <ticketKey>/<issueKey>/)
  --output <DIR>      Thư mục lưu file output
  --help              Hiển thị hướng dẫn này

Ví dụ:
  node backlog_fetcher.js --issue PROJ-123
  node backlog_fetcher.js --project PROJ --keyword "đăng nhập" --max 20
  node backlog_fetcher.js --epic PROJ-10 --format md
  node backlog_fetcher.js --epic PROJ-10 --format md --attachments
  node backlog_fetcher.js --issue PROJ-123 --format md --output ./<PROJECT_OUTPUT_DIR>/tasks/PROJ-123/requirements/backlog
  `);
}

module.exports = {
  fetchIssue,
  searchIssues,
  fetchProjectIssues,
  fetchParentChildren,
  fetchComments,
  downloadAttachments,
  getAttachmentList,
  issueToRequirementMarkdown,
};

if (require.main === module) {
  main().catch((err) => {
    log('ERROR', `Unexpected error: ${err.message}`);
    process.exit(1);
  });
}
