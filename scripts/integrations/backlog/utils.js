/**
 * Backlog Integration - Utility Functions
 * Các hàm xử lý chung cho việc tích hợp Backlog và Figma.
 *
 * Migrated từ Jira (22/09/2026). Backlog auth khác hẳn Jira: query param `apiKey=` (không Basic/Bearer),
 * description là plain text (không ADF) nên không còn hàm convert rich-doc.
 * Confluence (fetch_confluence.js/publish_confluence_page.js) NGOÀI PHẠM VI migrate này — chờ quyết
 * chuyển sang Google Docs/Sheet; các biến CONFLUENCE_ và JIRA_EMAIL đã bị xoá khỏi .env nên 2 file đó hiện
 * không chạy được, đó là trạng thái CỐ Ý (đã ghi trong DOC_ONLY của tests/fe/infra/env-contract.spec.ts).
 */

const fs = require('fs');
const path = require('path');
const {
  getProjectOutputDir,
  getTaskKey,
  getTaskOutputDir,
  isUsableValue,
  loadEnvFiles,
  resolveFromRepo,
} = require('../../utils/runtime_config');
/**
 * Load biến môi trường theo thứ tự ưu tiên local trước, repo sau.
 * Không fail nếu một file env không tồn tại vì project có thể dùng env từ shell/CI.
 */
function loadEnv() {
  loadEnvFiles([
    path.resolve(__dirname, '.env.local'),
    path.resolve(__dirname, '.env'),
  ]);

  normalizeEnvAliases();
}

function normalizeEnvAliases() {
  if (!process.env.BACKLOG_BASE_URL && process.env.BACKLOG_URL) process.env.BACKLOG_BASE_URL = process.env.BACKLOG_URL;
}

/**
 * Validate các biến môi trường bắt buộc
 * @param {string[]} requiredVars - Danh sách tên biến cần kiểm tra
 */
function validateEnvVars(requiredVars) {
  const missing = requiredVars.filter((v) => !isUsableValue(process.env[v]));
  if (missing.length > 0) {
    console.error(`[ERROR] Thiếu biến môi trường: ${missing.join(', ')}`);
    console.error('Hãy kiểm tra file .env và bổ sung đầy đủ.');
    process.exit(1);
  }
}

/**
 * Backlog xác thực qua QUERY PARAM `apiKey`, không phải header. Trả về object `{ apiKey }` để spread vào
 * `params` của axios (hoặc `URLSearchParams`) — không có "headers" cần build như Jira Basic/Bearer.
 * @returns {{apiKey: string}}
 */
function backlogAuthParams() {
  const apiKey = (process.env.BACKLOG_API_KEY || '').trim();
  if (!apiKey) {
    console.error('[ERROR] Thiếu BACKLOG_API_KEY.');
    process.exit(1);
  }
  return { apiKey };
}

/**
 * Format Backlog issue data thành dạng readable — tương đương `formatIssue` bản Jira cũ nhưng field khác
 * hẳn (issue.summary/description ở top-level, không nằm trong `fields.*`; description đã là plain text).
 * @param {object} issue - Backlog issue raw data (GET /api/v2/issues/:issueIdOrKey)
 * @returns {object} Formatted issue
 */
function formatBacklogIssue(issue) {
  return {
    key: issue.issueKey,
    id: issue.id,
    summary: issue.summary || '',
    description: issue.description || '',
    status: issue.status?.name || '',
    priority: issue.priority?.name || '',
    issueType: issue.issueType?.name || '',
    assignee: issue.assignee?.name || 'Unassigned',
    reporter: issue.createdUser?.name || '',
    created: issue.created || '',
    updated: issue.updated || '',
    milestones: (issue.milestone || []).map((m) => m.name),
    categories: (issue.category || []).map((c) => c.name),
  };
}

/**
 * Lưu dữ liệu JSON ra file
 * @param {string} filePath - Đường dẫn file output
 * @param {object} data - Dữ liệu cần lưu
 */
function saveJsonToFile(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`[OK] Đã lưu file: ${filePath}`);
}

/**
 * Lưu nội dung text ra file
 * @param {string} filePath - Đường dẫn file output
 * @param {string} content - Nội dung text
 */
function saveTextToFile(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`[OK] Đã lưu file: ${filePath}`);
}

/**
 * Đọc file JSON
 * @param {string} filePath - Đường dẫn file
 * @returns {object|null} Parsed JSON hoặc null nếu lỗi
 */
function readJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[ERROR] Không đọc được file: ${filePath}`, err.message);
    return null;
  }
}

/**
 * Tạo timestamp string dạng YYYYMMDD_HHmmss
 * @returns {string}
 */
function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/**
 * Resolve tên hiển thị / email -> Backlog user id (numeric), dùng cho assignee.
 * Nếu truyền sẵn id số thì trả nguyên (parse int), không gọi API.
 * @param {string} query - display name, email, hoặc id số
 * @param {number} projectId - Backlog project id (số) — user list lấy theo PROJECT, không space-wide
 * @returns {Promise<number|null>} user id hoặc null nếu không tìm thấy
 */
async function resolveBacklogUserId(query, projectId) {
  const q = String(query || '').trim();
  if (!q) return null;
  if (/^\d+$/.test(q)) return Number(q);
  const base = (process.env.BACKLOG_BASE_URL || process.env.BACKLOG_URL || '').replace(/\/+$/, '');
  if (!base || !projectId) return null;
  try {
    const url = new URL(`${base}/api/v2/projects/${projectId}/users`);
    url.searchParams.set('apiKey', backlogAuthParams().apiKey);
    const res = await fetch(url);
    if (!res.ok) return null;
    const arr = await res.json();
    const exact = (arr || []).find((u) => String(u.name || '').trim() === q
      || String(u.mailAddress || '').toLowerCase() === q.toLowerCase());
    return ((exact || (arr || [])[0]) || {}).id || null;
  } catch (error) {
    log('WARN', `Không resolve được assignee "${q}": ${error.message}`);
    return null;
  }
}

/**
 * Log message với prefix timestamp
 * @param {string} level - LOG | WARN | ERROR
 * @param {string} message - Nội dung log
 */
function log(level, message) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level}]`;
  if (level === 'ERROR') {
    console.error(`${prefix} ${message}`);
  } else if (level === 'WARN') {
    console.warn(`${prefix} ${message}`);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

module.exports = {
  loadEnv,
  normalizeEnvAliases,
  validateEnvVars,
  backlogAuthParams,
  resolveBacklogUserId,
  formatBacklogIssue,
  saveJsonToFile,
  saveTextToFile,
  readJsonFile,
  getTimestamp,
  getProjectOutputDir,
  getTaskKey,
  getTaskOutputDir,
  log,
  resolveFromRepo,
};
