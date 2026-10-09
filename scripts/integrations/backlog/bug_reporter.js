#!/usr/bin/env node
/**
 * Create Backlog Sub-bug issues for failed Playwright test cases.
 *
 * Migrated từ hệ bug-tracking cũ (22/09/2026) — API khác hẳn: auth qua `?apiKey=` (không Basic/Bearer), body
 * form-urlencoded (không JSON), issueType/priority/parent là SỐ (phải resolve theo tên), priority CỐ ĐỊNH
 * 3 mức (không có Critical/Lowest), KHÔNG có Sprint/labels tự do — xem comment ở từng hàm đổi.
 *
 * Default artifact paths are resolved from:
 *   <PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/results.json
 *   <PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/artifacts/
 *   <PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-cases/
 *   With RUN_ID:
 *   <PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/runs/<RUN_ID>/results.json
 *   <PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/runs/<RUN_ID>/artifacts/
 *
 * Usage:
 *   node scripts/integrations/backlog/bug_reporter.js --task <TASK_KEY> --story <BACKLOG_STORY_KEY> --dry-run
 *   node scripts/integrations/backlog/bug_reporter.js --task <TASK_KEY> --story <BACKLOG_STORY_KEY>
 *   node scripts/integrations/backlog/bug_reporter.js --task <TASK_KEY> --story <BACKLOG_STORY_KEY> --tc-id <TC_ID>
 *   node scripts/integrations/backlog/bug_reporter.js --task <TASK_KEY> --story <BACKLOG_STORY_KEY> --run-id <RUN_ID>
 *
 * Nguồn phát hiện (để đo tỉ lệ rò của kit — xem scripts/qa/leak_report.js):
 *   --found-by kit    → đánh dấu `[found-by-kit]`   (máy/automation của kit tự bắt được)
 *   --found-by human  → đánh dấu `[found-by-human]` (người báo: sheet bug, BA, QA thủ công)
 *   (Backlog không có free-text labels như Backlog — đánh dấu này nằm trong summary/description, xem
 *   `buildBugSummary`/`buildBugDescription`, không còn là field riêng lọc được qua API.)
 */

const fs = require('fs');
const path = require('path');
const {
  getProjectOutputDir,
  getRunId,
  getTaskKey,
  getTaskOutputDir,
  getTestResultsDir,
  loadEnvFiles,
} = require('../../utils/runtime_config');
const outputGate = require('../../qa/output_gate'); // gate chất lượng bug (RULE_GLOBAL: ≥1 ảnh/video, video case phức tạp, không run-on)

const SCRIPT_DIR = __dirname;
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..', '..');
const BACKLOG_CACHE_PATH = path.join(REPO_ROOT, '.agent', 'config', '.backlog_cache.json');

loadEnvFiles([
  path.join(SCRIPT_DIR, '.env.local'),
  path.join(SCRIPT_DIR, '.env'),
]);

const args = parseArgs(process.argv.slice(2));
const argString = (key) => (typeof args[key] === 'string' ? args[key].trim() : '');
const argFlag = (key) => args[key] === true || args[key] === 'true';

const PROJECT_OUTPUT_DIR = resolvePath(
  argString('project-output') || getProjectOutputDir(),
);
const TASK_KEY = getTaskKey({ task: argString('task') });
const TASK_OUTPUT_DIR = resolvePath(
  argString('task-output') || getTaskOutputDir({ projectOutputDir: PROJECT_OUTPUT_DIR, taskKey: TASK_KEY }),
);
const RUN_ID = getRunId(argString('run-id') || process.env.RUN_ID);
const TEST_RESULTS_DIR = resolvePath(getTestResultsDir({ taskOutputDir: TASK_OUTPUT_DIR, runId: RUN_ID }));

const RESULTS_FILE = resolvePath(
  argString('results') || path.join(TEST_RESULTS_DIR, 'results.json'),
);
const SELECTION_FILE = resolvePath(
  argString('selection') || path.join(TEST_RESULTS_DIR, 'selected-testcases.json'),
);
const ARTIFACTS_DIR = resolvePath(
  argString('artifacts') || path.join(TEST_RESULTS_DIR, 'artifacts'),
);
const TESTCASES_DIR = resolvePath(
  argString('testcases') || path.join(TASK_OUTPUT_DIR, 'test-cases'),
);
const STORY_KEY = argString('story') || process.env.BACKLOG_STORY_KEY || TASK_KEY;
const PROJECT_KEY = argString('project') || process.env.BACKLOG_PROJECT_KEY || deriveProjectKey(STORY_KEY);
const DRY_RUN = argFlag('dry-run');
const WRITE_LOG = argFlag('write-log') || (!DRY_RUN && !argFlag('no-write-log'));

const BACKLOG_BASE_URL = stripTrailingSlash(process.env.BACKLOG_BASE_URL || process.env.BACKLOG_URL || '');
const BACKLOG_API_KEY = process.env.BACKLOG_API_KEY || '';
const DEV_ASSIGNEE = process.env.BACKLOG_DEV_ASSIGNEE || '';
const FE_DEV_ASSIGNEE = process.env.BACKLOG_FE_ASSIGNEE || '';
const BE_DEV_ASSIGNEE = process.env.BACKLOG_BE_ASSIGNEE || '';
const ISSUE_TYPE = process.env.BACKLOG_BUG_ISSUE_TYPE || 'Sub-bug';
// Custom field id (SỐ) copy nguyên từ Story sang bug — KHÔNG resolve theo tên "Sprint" như bản Backlog cũ:
// Backlog không có khái niệm Sprint (Agile board), field custom mỗi project một kiểu. Để trống = không copy.
const BACKLOG_SPRINT_FIELD_ID = argString('sprint-field') || process.env.BACKLOG_SPRINT_FIELD_ID || '';
const BUG_LAYER_OVERRIDE = normalizeBugLayer(argString('layer') || process.env.BACKLOG_BUG_LAYER || '');
const TC_ID_FILTER = normalizeTcId(argString('tc-id') || argString('tc') || process.env.BACKLOG_BUG_TC_ID || '');
const UPDATE_ISSUE_KEY = normalizeIssueKey(argString('update-issue') || argString('issue') || '');
// Gate chất lượng bug: STRICT mặc định BẬT → chặn tạo bug thiếu ảnh/video (hoặc thiếu video case phức tạp).
// Tắt: --lenient / QA_STRICT=0. QA cố ý bỏ qua: --qa-approved (vẫn log).
const QA_APPROVED = argFlag('qa-approved');
const STRICT = !(argFlag('lenient') || process.env.QA_STRICT === '0');
/*
 * Chủ dự án chốt 06/10/2026: bug lên Backlog CHỈ điền Priority. Assignee, Milestone, Category để TRỐNG
 * cho PM tự phân — QA không đoán hộ.
 * Phải là CỜ TƯỜNG MINH chứ không phải "để trống env rồi coi là xong": mặc định reporter copy
 * Milestone+Category từ Story và DỪNG HẲN nếu không resolve được assignee. Không có cờ thì người chạy
 * buộc phải xoá env assignee hoặc bỏ assignee trên Story — hai thứ ảnh hưởng mọi task khác, và nhìn
 * lại không biết là cố ý hay quên.
 */
const ONLY_PRIORITY = argFlag('only-priority') || process.env.BACKLOG_BUG_ONLY_PRIORITY === '1';
/*
 * Đường cấp nội dung bug TƯỜNG MINH: file JSON `{ "<TC_ID>": { title, preconditions, steps,
 * actualResult, expectedResult } }`, chỉ ghi đè những khoá có mặt.
 *
 * Vì sao cần: reporter dựng title/description từ TESTCASE, mà một case thường kiểm NHIỀU điều. Case
 * trượt ở điều thứ tư thì title vẫn mang tên case (= điều thứ nhất, vốn ĐẠT) và tiền điều kiện vẫn là
 * đơn vị ghi trong case, không phải đơn vị đã chạy thật. Bug kiểu đó dev đọc sẽ đi sai hướng ngay từ
 * tiêu đề. Builder tự động không có cách nào biết assertion nào trượt, nên chỗ này phải do người viết.
 * KHÔNG dùng để nới nội dung cho dễ nghe: mọi giá trị phải khớp evidence và report local.
 */
const BUG_PAYLOAD_FILE = argString('bug-payload');
const BUG_PAYLOAD = BUG_PAYLOAD_FILE ? readBugPayloadFile(resolvePath(BUG_PAYLOAD_FILE)) : {};

function readBugPayloadFile(file) {
  if (!fs.existsSync(file)) fail(`--bug-payload không thấy file: ${file}`);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`--bug-payload không đọc được JSON (${file}): ${error.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('--bug-payload phải là object dạng { "<TC_ID>": { ... } }.');
  }
  return parsed;
}

/** Lấy phần ghi đè cho 1 tcId, so khớp mã đã chuẩn hoá để không phụ thuộc cách viết hoa/gạch. */
function bugOverrideFor(tcId) {
  const want = normalizeTcId(tcId);
  const hit = Object.keys(BUG_PAYLOAD).find((k) => normalizeTcId(k) === want);
  return hit ? BUG_PAYLOAD[hit] || {} : {};
}
/*
 * Priority Backlog CỐ ĐỊNH 3 mức (không tạo thêm được, không đổi tên): 2=High, 3=Normal, 4=Low. Kit vẫn
 * nhận input priority 5 mức quen thuộc (Critical/High/Medium/Low/Lowest, có thể đọc từ testcase) và MAP
 * xuống 3 mức — không có đường 1-1, đây là mất mát dữ liệu có chủ đích (Critical/High đều → High).
 */
const BACKLOG_PRIORITY_ID = { critical: 2, high: 2, blocker: 2, p0: 2, p1: 2, major: 2,
  medium: 3, normal: 3, p2: 3,
  low: 4, lowest: 4, minor: 4, trivial: 4, p3: 4, p4: 4 };
const BACKLOG_PRIORITY_NAME = { 2: 'High', 3: 'Normal', 4: 'Low' };

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    const [rawKey, inlineValue] = token.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      out[rawKey] = inlineValue;
      continue;
    }

    const next = argv[i + 1];
    out[rawKey] = next && !next.startsWith('--') ? argv[++i] : true;
  }
  return out;
}

function resolvePath(inputPath) {
  if (!inputPath) return inputPath;
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(REPO_ROOT, inputPath);
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function deriveProjectKey(issueKey) {
  const match = String(issueKey || '').match(/^([A-Z][A-Z0-9]+)-\d+$/i);
  return match ? match[1].toUpperCase() : '';
}

function normalizeIssueKey(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeBugLayer(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (['FE', 'FRONTEND', 'UI', 'E2E'].includes(normalized)) return 'FE';
  if (['BE', 'BACKEND', 'API'].includes(normalized)) return 'BE';
  return '';
}

/** Chuỗi priority bất kỳ (Critical/High/Medium/Low/Lowest, hoặc P0-P4...) → Backlog priorityId (2/3/4), hoặc 0 nếu không nhận diện được (không set priority, Backlog tự áp default). Idempotent: gọi lại trên kết quả đã convert (2/3/4) trả nguyên — pipeline gọi hàm này nhiều lớp (parse testcase → main() → createIssue). */
function normalizeBacklogPriority(value) {
  if (typeof value === 'number') return [2, 3, 4].includes(value) ? value : 0;
  const normalized = normalizeForMatch(
    String(value || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[*_]/g, ' '),
  );
  if (!normalized) return 0;

  const compact = normalized.replace(/\s+/g, '');
  if (BACKLOG_PRIORITY_ID[compact]) return BACKLOG_PRIORITY_ID[compact];

  const words = normalized.split(/\s+/).filter(Boolean);
  for (const word of words) {
    if (BACKLOG_PRIORITY_ID[word]) return BACKLOG_PRIORITY_ID[word];
  }

  return 0;
}

/*
 * Issue type có được dùng để log bug hay không.
 *
 * Bản cũ đòi TÊN type chứa "sub"/"child". Sai cơ chế: trong Backlog, con hay không là do
 * `parentIssueId` (reporter luôn set, xem createIssue), KHÔNG do tên type. Đo trên project CSDL
 * (06/10/2026) — `GET /api/v2/projects/:k/issueTypes` trả về: Bug · Renew · Task · Request · Other.
 * Không có type nào tên "Sub-*", nên luật cũ chặn MỌI cấu hình hợp lệ của project này.
 *
 * Thứ thật sự cần chặn là khai bug thành việc-cần-làm (prompt 08: "Không dùng Sub-task cho bug").
 * Nên: nhận type mang nghĩa BUG, từ chối type mang nghĩa TASK.
 */
function isChildIssueType(issueType) {
  const t = String(issueType || '').trim();
  if (!t) return false;
  if (/task|việc|cong viec|công việc/i.test(t)) return false;
  return /bug|lỗi|loi\b|defect|sub|child/i.test(t);
}

function validate() {
  if (!STORY_KEY) {
    fail('Missing story key. Set BACKLOG_STORY_KEY or pass --story <KEY>.');
  }
  if (!RESULTS_FILE || !fs.existsSync(RESULTS_FILE)) {
    fail(`results.json not found: ${RESULTS_FILE}`);
  }
  if (!PROJECT_KEY) {
    fail('Missing Backlog project key. Set BACKLOG_PROJECT_KEY or pass --project <KEY>.');
  }

  if (DRY_RUN) return;

  if (!BACKLOG_BASE_URL) fail('Missing BACKLOG_BASE_URL or BACKLOG_URL.');
  if (!BACKLOG_API_KEY) fail('Missing Backlog auth. Set BACKLOG_API_KEY.');
  if (!isChildIssueType(ISSUE_TYPE)) {
    fail('Backlog bug work type must be a child issue type (default: Sub-bug). Set BACKLOG_BUG_ISSUE_TYPE if your project names it differently.');
  }
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

/**
 * Backlog auth: KHÔNG dùng header — mọi request thêm `apiKey=BACKLOG_API_KEY` vào query string (đã verify
 * hoạt động qua `GET /api/v2/users/myself`). Khác Backlog: không Basic/Bearer, không cần build header đặc biệt.
 */
async function backlogRequest(method, endpoint, options = {}) {
  const url = new URL(`${BACKLOG_BASE_URL}${endpoint}`);
  url.searchParams.set('apiKey', BACKLOG_API_KEY);
  for (const [key, value] of Object.entries(options.params || {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(`${key}[]`, v);
    } else {
      url.searchParams.set(key, value);
    }
  }

  const controller = new AbortController();
  const timeoutMs = options.timeout || 30000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const isFormData = Boolean(options.formData);
    // Backlog nhận body form-urlencoded ở create/update issue (KHÔNG phải JSON như Backlog) — xem
    // developer.nulab.com/docs/backlog/api/2/add-issue/. `options.body` là object phẳng {key: value|value[]}.
    let body;
    let headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (isFormData) {
      body = options.formData;
    } else if (options.body !== undefined) {
      const form = new URLSearchParams();
      for (const [key, value] of Object.entries(options.body)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) value.forEach((v) => form.append(`${key}[]`, v));
        else form.append(key, value);
      }
      body = form;
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    const response = await fetch(url, { method, headers, body, signal: controller.signal });

    const text = await response.text();
    const data = parseJsonOrText(text);
    if (!response.ok) throw buildApiError(response, data);

    return {
      data,
      status: response.status,
      headers: headersToObject(response.headers),
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`Request timeout after ${timeoutMs}ms`);
      timeoutError.response = null;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonOrText(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function headersToObject(headers) {
  const out = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function buildApiError(response, data) {
  const error = new Error(`Backlog API ${response.status}`);
  error.response = {
    status: response.status,
    data,
    headers: headersToObject(response.headers),
  };
  return error;
}

async function withRetry(fn, retries = 3) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = error.response?.status;

      if (status === 429 && attempt < retries - 1) {
        const retryAfter = Number(error.response.headers?.['retry-after'] || 5);
        await sleep(retryAfter * 1000);
        continue;
      }

      if ((!status || status >= 500) && attempt < retries - 1) {
        await sleep(1000 * (attempt + 1));
        continue;
      }

      throw error;
    }
  }
  throw lastError;
}

function getBacklogCache() {
  return readJson(BACKLOG_CACHE_PATH, {});
}

function saveBacklogCache(cache) {
  fs.mkdirSync(path.dirname(BACKLOG_CACHE_PATH), { recursive: true });
  fs.writeFileSync(BACKLOG_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

/** BACKLOG_PROJECT_KEY (text) → id số của project, cache lại (đọc 1 lần/máy). */
async function resolveProjectId() {
  const cache = getBacklogCache();
  if (cache.projectId?.[PROJECT_KEY]) return cache.projectId[PROJECT_KEY];

  const response = await withRetry(() => backlogRequest('GET', `/api/v2/projects/${encodeURIComponent(PROJECT_KEY)}`));
  const id = response.data?.id;
  if (!id) fail(`Backlog project not found: ${PROJECT_KEY}`);

  cache.projectId = { ...(cache.projectId || {}), [PROJECT_KEY]: id };
  saveBacklogCache(cache);
  return id;
}

/** Tên issue type (vd "Sub-bug") → id số, resolve theo `GET /projects/:id/issueTypes`. Lỗi rõ ràng liệt kê type thật có nếu không khớp — không tự chọn bừa. */
async function resolveIssueTypeId(projectId) {
  const cache = getBacklogCache();
  const cacheKey = `${projectId}:${ISSUE_TYPE}`;
  if (cache.issueTypeId?.[cacheKey]) return cache.issueTypeId[cacheKey];

  const response = await withRetry(() => backlogRequest('GET', `/api/v2/projects/${projectId}/issueTypes`));
  const types = response.data || [];
  const match = types.find((t) => String(t.name || '').trim().toLowerCase() === ISSUE_TYPE.trim().toLowerCase());
  if (!match) {
    fail(`Backlog issue type "${ISSUE_TYPE}" not found in project ${PROJECT_KEY}. Types có sẵn: ${types.map((t) => t.name).join(', ') || '(none)'}. Set BACKLOG_BUG_ISSUE_TYPE cho khớp.`);
  }

  cache.issueTypeId = { ...(cache.issueTypeId || {}), [cacheKey]: match.id };
  saveBacklogCache(cache);
  return match.id;
}

/** Tên/email → id số user trong project (assignee). Cache theo email/tên gõ vào. */
async function resolveAssigneeAccountId(nameOrEmail, projectId) {
  if (!nameOrEmail) return null;
  if (/^\d+$/.test(String(nameOrEmail).trim())) return Number(nameOrEmail);

  const cache = getBacklogCache();
  cache.assignee = cache.assignee || {};
  if (cache.assignee[nameOrEmail]) return cache.assignee[nameOrEmail];

  try {
    const response = await withRetry(() => backlogRequest('GET', `/api/v2/projects/${projectId}/users`));
    const users = response.data || [];
    const q = String(nameOrEmail).trim().toLowerCase();
    const match = users.find((u) => String(u.mailAddress || '').toLowerCase() === q || String(u.name || '').toLowerCase() === q);
    if (!match) return null;

    cache.assignee[nameOrEmail] = match.id;
    saveBacklogCache(cache);
    return match.id;
  } catch (error) {
    console.warn(`WARN: Could not resolve assignee "${nameOrEmail}": ${formatApiError(error)}`);
    return null;
  }
}

async function resolveBugAssigneeAccountId(layer, parentIssue, cache, projectId) {
  const normalizedLayer = normalizeBugLayer(layer) || 'FE';
  const configuredAssignee =
    DEV_ASSIGNEE ||
    (normalizedLayer === 'BE' ? BE_DEV_ASSIGNEE : FE_DEV_ASSIGNEE);

  if (configuredAssignee) {
    const cacheKey = `${normalizedLayer}:${configuredAssignee}`;
    if (!cache[cacheKey]) cache[cacheKey] = await resolveAssigneeAccountId(configuredAssignee, projectId);
    if (cache[cacheKey]) {
      console.log(`Assignee: ${normalizedLayer} bug assigned by project rule.`);
      return cache[cacheKey];
    }
  }

  const parentAssigneeId = parentIssue?.assignee?.id || null;
  if (parentAssigneeId) {
    console.log('Assignee: using parent Story/Task assignee as fallback.');
    return parentAssigneeId;
  }

  return null;
}

/*
 * Backlog KHÔNG có JQL, và KHÔNG có free-text labels như Backlog ("labels = tcId AND labels = auto-bug") —
 * đánh dấu tcId ngay trong SUMMARY (xem `buildBugSummary`: `[<layer>][<tcId>] ...`) rồi search bằng
 * `keyword`, lọc lại phía client theo parentIssueId + status còn mở. Đây là full-text match, KHÔNG chính
 * xác tuyệt đối như JQL — có thể sót/thừa nếu 2 case khác nhau trùng phần đầu keyword; review tay khi nghi ngờ.
 */
async function searchExistingBug(tcId, projectId, parentIssueNumericId) {
  const marker = `[${tcId}]`;
  try {
    const response = await withRetry(() =>
      backlogRequest('GET', '/api/v2/issues', {
        params: {
          projectId: [projectId],
          parentIssueId: [parentIssueNumericId],
          keyword: tcId,
          // 1=Open, 2=In Progress — loại 3=Resolved, 4=Closed (tương đương statusCategory != Done của Backlog).
          statusId: [1, 2],
          count: 20,
        },
      }),
    );
    const issues = response.data || [];
    /*
     * Doi chieu CA HAI cho. Marker nay da doi tu summary xuong description (06/10/2026), nhung bug log
     * TRUOC do van mang no o summary — bo ve summary la moi bug cu bi log lai mot lan nua.
     */
    const match = issues.find((issue) => issue.parentIssueId === parentIssueNumericId
      && (String(issue.summary || '').includes(marker) || String(issue.description || '').includes(marker)));
    return match || null;
  } catch (error) {
    console.warn(`WARN: Duplicate check failed for ${tcId}: ${formatApiError(error)}`);
    return null;
  }
}

async function assertParentIssue(projectId) {
  try {
    const response = await withRetry(() => backlogRequest('GET', `/api/v2/issues/${encodeURIComponent(STORY_KEY)}`));
    const issue = response.data;
    if (!issue?.id) fail(`Parent Story/Task not found: ${STORY_KEY}`);
    console.log(`Parent Story/Task verified: ${issue.issueKey} - ${issue.summary || ''}`);
    // In ra để lượt chạy nào bỏ trống Assignee/Milestone/Category cũng thấy ngay là CỐ Ý, không phải quên.
    if (ONLY_PRIORITY) console.log('Chế độ --only-priority: chỉ điền Priority; Assignee/Milestone/Category để trống.');
    return issue;
  } catch (error) {
    fail(`Cannot verify parent Story/Task "${STORY_KEY}": ${formatApiError(error)}`);
  }
}

async function createIssue({ tcId, summary, description, assigneeId, priority, parentIssue, projectId, issueTypeId }) {
  const body = {
    projectId,
    issueTypeId,
    summary,
    description,
    parentIssueId: parentIssue.id,
  };

  if (assigneeId) body.assigneeId = assigneeId;

  const priorityId = normalizeBacklogPriority(priority);
  if (priorityId) body.priorityId = priorityId;

  if (!ONLY_PRIORITY) copyMilestoneAndCategory(body, parentIssue);

  const response = await withRetry(() => backlogRequest('POST', '/api/v2/issues', { body }));
  return response.data;
}

async function updateIssue(issueIdOrKey, { summary, description, priority, parentIssue }) {
  const body = { summary, description };

  const priorityId = normalizeBacklogPriority(priority);
  if (priorityId) body.priorityId = priorityId;

  if (parentIssue && !ONLY_PRIORITY) copyMilestoneAndCategory(body, parentIssue);

  const response = await withRetry(() => backlogRequest('PATCH', `/api/v2/issues/${encodeURIComponent(issueIdOrKey)}`, { body }));
  return response.data;
}

/** Copy Milestone/Category từ Story sang bug con — thay cho fixVersions/Sprint của bản Backlog cũ (không có
 * tương đương trực tiếp: Milestone Backlog hướng release giống fixVersions hơn là Sprint). Nếu project cần
 * copy thêm 1 custom field cụ thể (số, không resolve theo tên), set BACKLOG_SPRINT_FIELD_ID. */
function copyMilestoneAndCategory(body, parentIssue) {
  const milestoneIds = (parentIssue?.milestone || []).map((m) => m.id).filter(Boolean);
  if (milestoneIds.length) body.milestoneId = milestoneIds;
  const categoryIds = (parentIssue?.category || []).map((c) => c.id).filter(Boolean);
  if (categoryIds.length) body.categoryId = categoryIds;
  if (BACKLOG_SPRINT_FIELD_ID) {
    const field = (parentIssue?.customFields || []).find((f) => String(f.id) === String(BACKLOG_SPRINT_FIELD_ID));
    if (field && field.value != null) body[`customField_${BACKLOG_SPRINT_FIELD_ID}`] = field.value;
  }
}

/** Upload evidence lên Backlog: 2 bước (`POST /space/attachment` rồi gắn `attachmentId[]` vào issue) —
 * khác Backlog (1 bước multipart thẳng vào issue). Trả về attachmentId (hoặc null nếu lỗi). */
async function uploadAttachmentFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  if (!isBugEvidenceAttachment(filePath)) {
    console.warn(`WARN: Skipped non-visual bug evidence attachment: ${path.basename(filePath)}`);
    return null;
  }

  const form = new FormData();
  form.append('file', await fs.openAsBlob(filePath), path.basename(filePath));

  try {
    const response = await withRetry(() =>
      backlogRequest('POST', '/api/v2/space/attachment', { formData: form, timeout: 60000 }),
    );
    return response.data?.id || null;
  } catch (error) {
    console.warn(`WARN: Attachment upload failed for ${path.basename(filePath)}: ${formatApiError(error)}`);
    return null;
  }
}

/** Gắn danh sách attachmentId đã upload vào 1 issue. GHI CHÚ CHƯA VERIFY: giả định `attachmentId[]` trên
 * PATCH issue THAY THẾ toàn bộ set hiện có (không cộng dồn) — vì vậy gọi 1 LẦN với ĐỦ danh sách, không gọi
 * lặp lại nhiều lần cho cùng issue. Kiểm lại hành vi thật khi chạy `--apply` lần đầu (xem plan Verification). */
/** Tên file các attachment đang có trên issue — để update không đính kèm lại cùng một ảnh. */
async function layTenFileDaDinhKem(issueIdOrKey) {
  try {
    const res = await withRetry(() => backlogRequest('GET', `/api/v2/issues/${encodeURIComponent(issueIdOrKey)}/attachments`));
    return new Set((res.data || []).map((a) => a.name).filter(Boolean));
  } catch (error) {
    // Không đọc được thì coi như chưa có gì: thà đính kèm trùng còn hơn bug thiếu bằng chứng.
    console.warn(`WARN: không đọc được danh sách attachment của ${issueIdOrKey}: ${formatApiError(error)}`);
    return new Set();
  }
}

async function attachIssueAttachments(issueId, attachmentIds) {
  if (!attachmentIds.length) return true;
  try {
    await withRetry(() => backlogRequest('PATCH', `/api/v2/issues/${issueId}`, { body: { attachmentId: attachmentIds } }));
    return true;
  } catch (error) {
    console.warn(`WARN: Could not attach ${attachmentIds.length} file(s) to issue ${issueId}: ${formatApiError(error)}`);
    return false;
  }
}

function isBugEvidenceAttachment(filePath) {
  return /\.(png|jpe?g|webp|gif|mp4|webm)$/i.test(String(filePath || ''));
}

// Ai PHÁT HIỆN ra bug — không phải ai LOG. Không đo được thì không biết kit đang rò bao nhiêu.
// `--found-by kit` = máy/automation của kit phát hiện; `--found-by human` = người báo (sheet bug, BA, QA thủ công).
// Backlog không có labels tự do như Backlog (không còn nhãn `found-by-kit`/`found-by-human` ở field riêng) —
// giá trị này giờ chỉ nằm trong TEXT mô tả (xem `buildBugDescription`), `leak_report.js` phải đọc lại bằng
// keyword search thay vì lọc theo label field.
function foundBySource() {
  const raw = argString('found-by').toLowerCase();
  if (!raw) return '';
  if (['kit', 'auto', 'automation'].includes(raw)) return 'kit';
  if (['human', 'manual', 'qa', 'ba', 'sheet'].includes(raw)) return 'human';
  console.warn(`[bug-reporter] --found-by "${raw}" không hợp lệ (kit|human) — bỏ qua đánh dấu nguồn phát hiện.`);
  return '';
}

/*
 * Backlog description la TEXT, khong phai rich-doc JSON — ghep thang string, khong can content-tree.
 *
 * DO 06/10/2026 qua `GET /api/v2/projects`: project dang dung `textFormattingRule = markdown`, nen
 * `**dam**` RENDER THAT. Ban truoc dung `■ <ten muc>` vi tin rang Backlog khong co markdown — niem tin
 * do sai, va no lam bon tieu de muc chim lan vao van ban. Nay in dam theo yeu cau cua chu du an.
 *
 * Doi project sang `textFormattingRule = backlog` thi phai doi lai thanh `''dam''`, va phai DO lai
 * bang chinh API tren chu dung doan.
 */
function buildBugDescription(payload) {
  const parts = [];
  parts.push('**Tiền điều kiện:**');
  parts.push(String(payload.preconditions || '(không có thông tin)').slice(0, 30000));
  parts.push('');
  parts.push('**Bước:**');
  parts.push(formatNumberedOrParagraph(payload.steps, '(xem file test case gốc)'));
  parts.push('');
  parts.push('**Kết quả hiện tại:**');
  parts.push(formatBulletOrParagraph(payload.actualResult, '(không có thông tin)'));
  parts.push('');
  parts.push('**Kết quả mong muốn:**');
  parts.push(formatBulletOrParagraph(payload.expectedResult, '(xem file test case gốc)'));
  if (payload.foundBy) {
    const tag = payload.foundBy === 'human' ? 'found-by-human' : 'found-by-kit';
    const desc = payload.foundBy === 'human' ? 'người báo (sheet bug/BA/QA thủ công)' : 'kit (automation tự bắt được)';
    parts.push('');
    parts.push(`**[${tag}] Nguồn phát hiện:** ${desc}`);
  }
  /*
   * MARKER MAY DOC, khong phai mot muc cua description.
   * De o CUOI va KHONG in dam, de nguoi doc luot qua duoc va de `lintBugHeadings` khong dem no thanh
   * muc thu 5. Mat dong nay thi moi luot rerun lai log them mot bug trung, va bug do khong map duoc
   * ve Module nen khong vao duoc risk model.
   */
  if (payload.tcId || payload.layer) {
    parts.push('');
    const dau = [];
    if (payload.tcId) dau.push(`TC: [${payload.tcId}]`);
    if (payload.layer) dau.push(`Tầng: [${String(payload.layer).toUpperCase()}]`);
    parts.push(dau.join(' · '));
  }
  return parts.join('\n');
}

function formatNumberedOrParagraph(value, fallback) {
  const items = Array.isArray(value)
    ? value.filter(Boolean).map(String)
    : String(value || '')
        .split(/\r?\n/)
        .map((line) => line.replace(/^\d+[.)]\s*/, '').trim())
        .filter(Boolean);

  if (!items.length) return String(fallback || '');
  return items.map((item, i) => `${i + 1}. ${item.slice(0, 3000)}`).join('\n');
}

// Kết quả hiện tại / mong muốn: mỗi ý một bullet cho dễ đọc. Nhận string (tách theo dòng, hỗ trợ <br>)
// hoặc mảng ý. 1 ý -> paragraph; >=2 ý -> bulletList.
function splitIdeas(value) {
  return (Array.isArray(value)
    ? value.filter(Boolean).map(String)
    : String(value || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .split(/\r?\n/))
    .map((line) => line.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
    .filter(Boolean);
}

function formatBulletOrParagraph(value, fallback) {
  const items = splitIdeas(value);
  if (!items.length) return String(fallback || '');
  if (items.length === 1) return items[0].slice(0, 3000);
  return items.map((item) => `- ${item.slice(0, 3000)}`).join('\n');
}

function extractFailedTests(resultsPath) {
  const raw = readJson(resultsPath);
  const failed = [];

  function walkSuites(suites = [], inheritedFile = '') {
    for (const suite of suites) {
      const suiteFile = suite.file || inheritedFile;
      walkSuites(suite.suites || [], suiteFile);

      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          const lastResult = (test.results || [])[test.results.length - 1];
          const status = lastResult?.status || test.status;
          if (!['failed', 'timedOut', 'interrupted'].includes(status)) continue;

          const title = [...(spec.titlePath || []), spec.title].filter(Boolean).join(' > ');
          const tcId = extractTcId(title || spec.title || test.title || test.id);

          failed.push({
            tcId,
            title: spec.title || test.title || tcId,
            status,
            sourceFile: spec.file || suiteFile,
            error: normalizeError(lastResult?.error || lastResult?.errors?.[0]),
            steps: extractResultSteps(lastResult),
          });
        }
      }
    }
  }

  walkSuites(raw.suites || []);
  return failed;
}

function extractTcId(text) {
  const source = String(text || '');
  const full = source.match(/[A-Z0-9]+(?:[-_][A-Z0-9]+)*[-_]TC[-_]?\d+/i);
  if (full) return normalizeTcId(full[0]);

  const generated = source.match(/\b(?:UI|API|E2E)[-_]\d+\b/i);
  if (generated) return normalizeTcId(generated[0]);

  const short = source.match(/\bTC[-_]?\d+\b/i);
  if (short) return normalizeTcId(short[0]);

  return normalizeTcId(source.slice(0, 60) || 'UNKNOWN_TC');
}

function normalizeTcId(value) {
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function extractResultSteps(result) {
  const steps = [];

  function walk(stepList = []) {
    for (const step of stepList) {
      if (step.title) steps.push(step.title);
      walk(step.steps || []);
    }
  }

  walk(result?.steps || []);
  return [...new Set(steps)].slice(0, 30);
}

function normalizeError(error) {
  if (!error) return 'No error message in Playwright results.json';
  return stripAnsi(String(error.message || error.value || error.stack || JSON.stringify(error))).slice(0, 4000);
}

function determineBugLayer(testCase, tcInfo = {}) {
  if (BUG_LAYER_OVERRIDE) return BUG_LAYER_OVERRIDE;

  const source = [
    testCase.sourceFile,
    tcInfo.source,
    testCase.tcId,
    testCase.title,
  ].filter(Boolean).join(' ').toLowerCase();

  if (/\b(api|be|backend|contract|request|response)\b/.test(source)) return 'BE';
  if (/\b(fe|frontend|ui|e2e|browser|page|screen)\b/.test(source)) return 'FE';
  return 'FE';
}

function buildBugSummary(layer, title, actualResult, tcId = '') {
  const rawTitle = stripPositiveNegativePrefix(String(title || '').replace(/\s+/g, ' ').trim());
  const rawActual = stripAnsi(String(actualResult || '').replace(/\s+/g, ' ').trim());
  const isTcOnlyTitle = normalizeTcId(rawTitle) === normalizeTcId(tcId);
  let bugName = '';

  const missingHeaders = rawActual.match(/Missing headers:\s*([^]+?)(?:\s+expect\(|\s+Expected:|$)/i);
  if (missingHeaders) {
    bugName = `Khong hien thi du cot nghiep vu bat buoc: ${missingHeaders[1].trim()}`;
  }

  if (!bugName && !isTcOnlyTitle) bugName = rawTitle;
  if (!bugName) bugName = rawActual || 'Loi phat hien khi execute automation';
  /*
   * TIEU DE CHI CO TEN BUG — khong ma, khong tang. Chu du an chot 06/10/2026: title la thu dev doc
   * luot trong danh sach bug, nen no phai noi LOI GI. Truoc day no mo dau bang hai khoi ngoac
   * `[FE][TC_ID]` ma dev doc khong dung duoc vao viec gi.
   *
   * HAI MARKER KHONG MAT, ca hai xuong dong cuoi description (xem buildBugDescription):
   *   - `TC: [<tcId>]` — `searchExistingBug` doi chieu de chong trung, `learn_bugs` map bug ve Module.
   *   - `Tang: [<layer>]` — `lintBeVsFeLayer` doi no de doi dau vet API.
   * Bo bat ky dong nao la mot may lang le ngung lam viec, va khong cai nao bao loi.
   */
  return String(bugName).slice(0, 255);
}

function stripPositiveNegativePrefix(value) {
  return String(value || '').replace(/^\[(Positive|Negative|Boundary|Edge)\]\s*/i, '').trim();
}

function stripAnsi(value) {
  return String(value || '').replace(/\u001b\[[0-9;]*m/g, '');
}

function buildActualResult(testCase, artifactInfo, displayTitle = '') {
  const error = stripAnsi(testCase.error || '').trim();
  const context = stripAnsi(artifactInfo.actualResult || '').trim();
  const title = stripAnsi(displayTitle || testCase.title || '').trim();
  const missingHeaders = error.match(/Missing headers:\s*([^\n]+)/i);

  if (missingHeaders) {
    const headerText = missingHeaders[1].replace(/\s+/g, ' ').trim();
    const expected = error.match(/Expected:\s*>=\s*(\d+)/i)?.[1] || '';
    const received = error.match(/Received:\s*(\d+)/i)?.[1] || '';
    const countText = expected && received ? ` Automation kỳ vọng tối thiểu ${expected} header nhưng chỉ nhận ${received}.` : '';
    return `Màn danh sách mở thành công nhưng bảng không hiển thị đủ các cột nghiệp vụ theo testcase. Thiếu: ${headerText}.${countText}`;
  }

  const apiStatusInArray = error.match(/Expected value:\s*(\d+)[\s\S]*?Received array:\s*\[([^\]]+)\]/i);
  if (apiStatusInArray) {
    const actualStatus = apiStatusInArray[1];
    const expectedStatuses = apiStatusInArray[2].replace(/\s+/g, ' ').trim();
    return [
      `API trả HTTP ${actualStatus}, không khớp contract/expected status của testcase (${expectedStatuses}).`,
      title ? `Case liên quan: ${stripPositiveNegativePrefix(title)}.` : '',
      'Response đã được ghi nhận trong Playwright result/evidence local và không được paste nguyên văn nếu có dữ liệu nhạy cảm.',
    ].filter(Boolean).join('\n');
  }

  const statusToBe = error.match(/Expected:\s*(\d+)[\s\S]*?Received:\s*(\d+)/i);
  if (statusToBe) {
    return [
      `Hệ thống trả kết quả thực tế là ${statusToBe[2]}, trong khi testcase mong muốn ${statusToBe[1]}.`,
      title ? `Case liên quan: ${stripPositiveNegativePrefix(title)}.` : '',
    ].filter(Boolean).join('\n');
  }

  const retainedInvalidValue = error.match(/Expected:\s*not\s*"([^"]+)"/i);
  if (retainedInvalidValue) {
    return [
      `Sau khi thực hiện flow, hệ thống vẫn giữ giá trị không còn hợp lệ: "${retainedInvalidValue[1]}".`,
      'Theo testcase, giá trị này phải được reset, bị invalid hoặc bị chặn trước khi người dùng lưu dữ liệu.',
      title ? `Case liên quan: ${stripPositiveNegativePrefix(title)}.` : '',
    ].filter(Boolean).join('\n');
  }

  if (/Received:\s*false/i.test(error)) {
    const firstLine = error.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !/^Error:\s*$/i.test(line));
    return [
      `Điều kiện nghiệp vụ mong muốn không được đảm bảo khi execute testcase.${firstLine ? ` Chi tiết quan sát được: ${firstLine.replace(/^Error:\s*/i, '')}.` : ''}`,
      title ? `Case liên quan: ${stripPositiveNegativePrefix(title)}.` : '',
    ].filter(Boolean).join('\n');
  }

  const subjectSetup = error.match(/Unable to load\s+(.+?)\s+subjects.*status=(\d+)/i);
  if (subjectSetup) {
    return `Không thể chuẩn bị dữ liệu automation vì API danh sách môn học của ${subjectSetup[1]} trả HTTP ${subjectSetup[2]}. Đây là blocker setup/environment, không đủ điều kiện log product bug nếu chưa có evidence nghiệp vụ khác.`;
  }

  if (/Ops UI login did not leave login page/i.test(error)) {
    return 'Không thể đi qua bước đăng nhập Operations trong lần chạy hiện tại. Đây là blocker auth/login flow của môi trường execute, cần re-validation trước khi kết luận product bug.';
  }

  const missingFixture = error.match(/No\s+(.+?)\s+fixture(?:\s+for\s+(.+?))?\s+was found in Ops data/i);
  if (missingFixture) {
    return `Không tìm thấy dữ liệu fixture bắt buộc trong Ops data (${missingFixture[1]}${missingFixture[2] ? ` cho ${missingFixture[2]}` : ''}). Đây là blocker test data/setup, cần bổ sung dữ liệu hoặc re-validation trước khi kết luận product bug.`;
  }

  if (context && !/^Following Playwright test failed\.?$/i.test(context)) {
    return context;
  }

  const firstErrorLines = error
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^\s*(at\s+|>|expect\(|Received array:|Expected value:|Expected:|Received:)/i.test(line))
    .slice(0, 4);
  if (firstErrorLines.length) {
    return `Khi execute testcase, hệ thống trả kết quả không đúng expected. Chi tiết đã sanitize:\n${firstErrorLines.join('\n')}`;
  }

  return 'Khi execute testcase, hệ thống trả kết quả không đúng expected. Xem evidence ảnh/video và Playwright result local để đối chiếu chi tiết.';
}

function findTestCaseInfo(tcId, testcasesDir) {
  if (!testcasesDir || !fs.existsSync(testcasesDir)) return {};

  const mdFiles = listFiles(testcasesDir, (filePath) => filePath.toLowerCase().endsWith('.md'));
  for (const filePath of mdFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const tableInfo = findTableRowInfo(content, tcId);
    if (tableInfo) {
      return {
        ...tableInfo,
        source: path.relative(REPO_ROOT, filePath),
      };
    }

    const section = extractTcSection(content, tcId);
    if (!section) continue;

    return {
      preconditions: findField(section, [
        'precondition',
        'pre-condition',
        'tien dieu kien',
        'tiền điều kiện',
      ]),
      steps: findSteps(section),
      expectedResult: findField(section, [
        'expected result',
        'expected',
        'ket qua mong muon',
        'kết quả mong muốn',
      ]),
      priority: normalizeBacklogPriority(findField(section, [
        'priority',
        'uu tien',
        'ưu tiên',
        'muc do uu tien',
        'mức độ ưu tiên',
      ])),
      source: path.relative(REPO_ROOT, filePath),
    };
  }

  return {};
}

function findSelectedTestCaseInfo(tcId) {
  if (!SELECTION_FILE || !fs.existsSync(SELECTION_FILE)) return {};
  const selection = readJson(SELECTION_FILE, {});
  const normalizedTcId = normalizeTcId(tcId);
  const selected = (selection.items || []).find((item) => normalizeTcId(item.id) === normalizedTcId);
  if (!selected) return {};
  return {
    title: selected.scenario || '',
    priority: normalizeBacklogPriority(selected.priority),
    source: path.relative(REPO_ROOT, SELECTION_FILE),
  };
}

function findTableRowInfo(content, tcId) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const variants = [tcId, tcId.replace(/_/g, '-'), tcId.replace(/_/g, ' ')]
    .map((value) => value.toUpperCase());

  for (let i = 0; i < lines.length; i += 1) {
    if (!/^\s*\|/.test(lines[i])) continue;
    const header = splitMarkdownRow(lines[i]);
    const normalizedHeader = header.map(normalizeForMatch);
    const tcIndex = normalizedHeader.findIndex((cell) => cell === 'tc id' || cell.includes('tc id'));
    if (tcIndex === -1) continue;

    for (let j = i + 1; j < lines.length; j += 1) {
      if (!/^\s*\|/.test(lines[j])) break;
      if (/^\s*\|?\s*:?-{3,}:?\s*\|/.test(lines[j])) continue;

      const cells = splitMarkdownRow(lines[j]);
      const rowTcId = normalizeTcId(cells[tcIndex] || '');
      if (!variants.includes(rowTcId) && !variants.includes(String(cells[tcIndex] || '').toUpperCase())) continue;

      const title = pickByHeader(cells, normalizedHeader, [
        'truong hop kiem thu',
        'test case',
        'title',
        'summary',
      ]);
      const preconditions = pickByHeader(cells, normalizedHeader, [
        'tien dieu kien',
        'precondition',
        'pre condition',
      ]);
      const rawSteps = pickByHeader(cells, normalizedHeader, [
        'cac buoc thuc hien',
        'buoc thuc hien',
        'steps',
      ]);
      const expectedResult = pickByHeader(cells, normalizedHeader, [
        'ket qua mong doi',
        'ket qua mong muon',
        'expected result',
        'expected',
      ]);
      const priority = pickByHeader(cells, normalizedHeader, [
        'uu tien',
        'muc do uu tien',
        'priority',
        'priority level',
      ]);
      if (!title && !preconditions && !rawSteps && !expectedResult) continue;

      return {
        title: cellToText(title),
        preconditions: cellToText(preconditions),
        steps: cellToList(rawSteps),
        expectedResult: cellToText(expectedResult),
        priority: normalizeBacklogPriority(priority),
      };
    }
  }

  return null;
}

function splitMarkdownRow(line) {
  return String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function pickByHeader(cells, normalizedHeader, names) {
  const normalizedNames = names.map(normalizeForMatch);
  const index = normalizedHeader.findIndex((header) =>
    normalizedNames.some((name) => header === name || header.includes(name)),
  );
  return index === -1 ? '' : cells[index] || '';
}

function cellToText(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<[^>]+>/g, '')
    .split(/\n+/)
    .map(cleanField)
    .filter(Boolean)
    .join('\n');
}

function cellToList(value) {
  return cellToText(value)
    .split(/\n+/)
    .map(cleanField)
    .filter(Boolean);
}

function extractTcSection(content, tcId) {
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const variants = [tcId, tcId.replace(/_/g, '-'), tcId.replace(/_/g, ' ')];
  const lines = normalizedContent.split('\n');
  let start = -1;

  for (let i = 0; i < lines.length; i += 1) {
    if (variants.some((variant) => lines[i].toUpperCase().includes(variant.toUpperCase()))) {
      start = i;
      break;
    }
  }
  if (start === -1) return '';

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/\b[A-Z0-9]+(?:[-_][A-Z0-9]+)*[-_]TC[-_]?\d+\b/i.test(lines[i])) {
      end = i;
      break;
    }
  }

  return lines.slice(start, end).join('\n');
}

function findField(section, labels) {
  const lines = section.split('\n');
  const labelPattern = labels.map(escapeRegex).join('|');
  const inline = new RegExp(`(?:${labelPattern})\\s*[:|]\\s*(.+)`, 'i');

  for (let i = 0; i < lines.length; i += 1) {
    const line = stripMarkdownTableCell(lines[i]);
    const match = line.match(inline);
    if (match?.[1]) return cleanField(match[1]);

    if (new RegExp(labelPattern, 'i').test(line)) {
      const next = stripMarkdownTableCell(lines[i + 1] || '');
      if (next && !new RegExp(labelPattern, 'i').test(next)) return cleanField(next);
    }
  }

  return '';
}

function findSteps(section) {
  const lines = section.split('\n').map(stripMarkdownTableCell);
  const stepLines = [];
  let capture = false;

  for (const line of lines) {
    if (/^(steps?|buoc thuc hien|bước thực hiện)\b/i.test(line)) {
      capture = true;
      const inline = line.replace(/^(steps?|buoc thuc hien|bước thực hiện)\s*[:|]?\s*/i, '').trim();
      if (inline) stepLines.push(inline);
      continue;
    }

    if (capture && /^(expected|actual|ket qua|kết quả|priority|uu tien|ưu tiên|muc do uu tien|mức độ ưu tiên|status|evidence)\b/i.test(line)) break;
    if (capture && line) stepLines.push(line);
  }

  return stepLines.map(cleanField).filter(Boolean).slice(0, 30);
}

function readArtifactInfo(artifactsDir, tcId) {
  const out = {
    actualResult: '',
    screenshotPath: null,
    videoPath: null,
    errorContextPath: null,
  };

  if (!artifactsDir || !fs.existsSync(artifactsDir)) return out;

  const artifactDir = findArtifactDir(artifactsDir, tcId);
  if (!artifactDir) return out;

  const files = listFiles(artifactDir);
  out.errorContextPath = files.find((file) => path.basename(file).toLowerCase() === 'error-context.md') || null;
  out.screenshotPath =
    files.find((file) => /test-failed.*\.png$/i.test(path.basename(file))) ||
    files.find((file) => /\.png$/i.test(file)) ||
    null;
  out.videoPath = files.find((file) => /\.(webm|mp4)$/i.test(file)) || null;

  if (out.errorContextPath) {
    const text = fs.readFileSync(out.errorContextPath, 'utf8').trim();
    out.actualResult = summarizeErrorContext(text);
  }

  return out;
}

function findArtifactDir(artifactsDir, tcId) {
  const variants = [
    tcId,
    tcId.replace(/_/g, '-'),
    tcId.replace(/_/g, '').toLowerCase(),
  ].map((value) => value.toLowerCase());

  const dirs = listDirectories(artifactsDir);
  const dirByName = dirs.find((dir) => {
    const normalized = path.basename(dir).toLowerCase();
    return variants.some((variant) => normalized.includes(variant));
  });
  if (dirByName) return dirByName;

  const tcTitlePattern = new RegExp(`\\bName:\\s*.*${escapeRegExp(tcId)}`, 'i');
  const dirByContextTitle = dirs.find((dir) => {
    const contextPath = path.join(dir, 'error-context.md');
    if (!fs.existsSync(contextPath)) return false;
    const context = fs.readFileSync(contextPath, 'utf8');
    return tcTitlePattern.test(context);
  });
  if (dirByContextTitle) return dirByContextTitle;

  return (
    dirs.find((dir) => {
      const contextPath = path.join(dir, 'error-context.md');
      if (!fs.existsSync(contextPath)) return false;
      const context = fs.readFileSync(contextPath, 'utf8').toLowerCase();
      return variants.some((variant) => context.includes(variant));
    }) || null
  );
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function summarizeErrorContext(text) {
  if (!text) return '';
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .filter(Boolean);

  const important = lines.find((line) => /(error|fail|timeout|expected|actual)/i.test(line) && line.length > 10);
  return (important || lines.slice(0, 6).join('\n')).slice(0, 2000);
}

function listFiles(dir, predicate = () => true) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(fullPath, predicate));
    else if (entry.isFile() && predicate(fullPath)) files.push(fullPath);
  }
  return files;
}

function listDirectories(dir) {
  const dirs = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    dirs.push(fullPath, ...listDirectories(fullPath));
  }
  return dirs;
}

function stripMarkdownTableCell(line) {
  return String(line || '')
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .replace(/\s*\|\s*/g, ' ')
    .trim();
}

function cleanField(value) {
  return String(value || '')
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/^:+|:+$/g, '')
    .trim();
}

function normalizeForMatch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (fallback !== null) return fallback;
    throw error;
  }
}

function formatApiError(error) {
  const status = error.response?.status;
  const data = error.response?.data;
  if (status) return `${status} ${JSON.stringify(data?.errors || data?.errorMessages || data || error.message)}`;
  return error.message;
}

function buildSummary(rows) {
  const tableRows = rows
    .map((row) => `| ${row.tcId} | ${row.issueKey} | ${row.status} | ${row.url || '-'} |`)
    .join('\n');

  return [
    '## Backlog Bug Report Log',
    '',
    '| TC ID | Backlog Issue | Status | URL |',
    '|---|---|---|---|',
    tableRows,
    '',
  ].join('\n');
}

function writeSummary(summaryText) {
  const reportDir = RUN_ID
    ? path.join(TASK_OUTPUT_DIR, 'reports', 'runs', RUN_ID)
    : path.join(TASK_OUTPUT_DIR, 'reports');
  const preferred = path.join(reportDir, 'execution-summary.md');
  const fallback = path.join(reportDir, 'backlog_bug_log.md');

  fs.mkdirSync(reportDir, { recursive: true });
  if (fs.existsSync(preferred)) {
    fs.appendFileSync(preferred, `\n${summaryText}`, 'utf8');
    return preferred;
  }

  fs.writeFileSync(fallback, summaryText, 'utf8');
  return fallback;
}

async function main() {
  validate();

  const timestamp = new Date().toISOString();
  console.log(`Reading Playwright results: ${path.relative(REPO_ROOT, RESULTS_FILE)}`);
  let failedTests = extractFailedTests(RESULTS_FILE);
  if (TC_ID_FILTER) {
    failedTests = failedTests.filter((testCase) => testCase.tcId === TC_ID_FILTER);
    if (failedTests.length === 0) {
      fail(`No failed test matched --tc-id ${TC_ID_FILTER}.`);
    }
  }

  if (failedTests.length === 0) {
    console.log('No failed tests found. Nothing to report.');
    return;
  }
  if (UPDATE_ISSUE_KEY && failedTests.length !== 1) {
    fail('--update-issue/--issue mode requires exactly one failed testcase. Pass --tc-id <TC_ID>.');
  }

  console.log(`Found ${failedTests.length} failed test(s). Story: ${STORY_KEY}. Project: ${PROJECT_KEY}.`);
  if (TC_ID_FILTER) console.log(`TC filter: ${TC_ID_FILTER}`);
  if (UPDATE_ISSUE_KEY) console.log(`Update existing issue: ${UPDATE_ISSUE_KEY}`);
  if (DRY_RUN) console.log('DRY RUN: Backlog will not be changed.');

  let parentIssue = null;
  let projectId = null;
  let issueTypeId = null;
  const assigneeCache = {};
  if (!DRY_RUN) {
    projectId = await resolveProjectId();
    parentIssue = await assertParentIssue(projectId);
    issueTypeId = await resolveIssueTypeId(projectId);
  }

  const rows = [];

  const bugGateProblems = []; // gom vi phạm gate bug (RULE_GLOBAL)
  for (const testCase of failedTests) {
    const tcInfo = findTestCaseInfo(testCase.tcId, TESTCASES_DIR);
    const selectedTcInfo = findSelectedTestCaseInfo(testCase.tcId);
    const artifactInfo = readArtifactInfo(ARTIFACTS_DIR, testCase.tcId);
    const override = bugOverrideFor(testCase.tcId);
    const displayTitle = override.title || tcInfo.title || selectedTcInfo.title || testCase.title;
    const layer = determineBugLayer(testCase, tcInfo);
    /*
     * `--bug-payload` được phép khai Priority — trước đây là trường DUY NHẤT nó không khai được.
     *
     * Priority vốn chỉ lấy từ file testcase, mà `findTestCaseInfo` chỉ đọc `.md`. Task nào giữ
     * testcase canonical ở `.xlsx` (CSDL-9004) thì không có nguồn priority nào, và Backlog từ chối
     * tạo issue với `400 error.invalid : priorityId`. Tức: khai tay được cả title/steps/kết quả
     * nhưng vẫn không log được, mà thông báo lỗi lại không chỉ ra thiếu gì.
     */
    const priority = normalizeBacklogPriority(
      override.priority || tcInfo.priority || selectedTcInfo.priority || testCase.priority,
    );
    const actualResult = override.actualResult || buildActualResult(testCase, artifactInfo, displayTitle);
    // Title do người viết thì dùng nguyên văn: buildBugSummary chỉ để CỨU title máy dựng từ case.
    const summary = override.title
      ? String(override.title).replace(/\s+/g, ' ').trim().slice(0, 255)
      : buildBugSummary(layer, displayTitle, actualResult, testCase.tcId);
    const prioritySuffix = priority ? ` (Priority: ${BACKLOG_PRIORITY_NAME[priority] || priority})` : '';

    // GATE chất lượng bug (RULE_GLOBAL): ≥1 ảnh/video, video cho case phức tạp, KQ không run-on.
    /*
     * Evidence ƯU TIÊN file khai tường minh trong --bug-payload (`screenshot`, `video`).
     * Vì sao: `readArtifactInfo` ưu tiên `test-failed-*.png` — ảnh Playwright tự chụp lúc assertion
     * trượt, KHÔNG khoanh vùng. Luật 06/10/2026 bắt buộc highlight, nên ảnh đã khoanh phải thắng.
     */
    // `screenshots` (mảng) cho bug cần nhiều ảnh — vd form nhiều tab, một ảnh không chở hết.
    const anhKhai = []
      .concat(override.screenshots || [])
      .concat(override.screenshot ? [override.screenshot] : [])
      .map((p) => resolvePath(p));
    const videoKhai = override.video ? resolvePath(override.video) : null;
    for (const f of anhKhai.concat(videoKhai ? [videoKhai] : [])) {
      if (!fs.existsSync(f)) fail(`--bug-payload ${testCase.tcId}: không thấy file evidence ${f}`);
    }
    const attachmentsPreview = (anhKhai.length ? anhKhai : [artifactInfo.screenshotPath])
      .concat([videoKhai || artifactInfo.videoPath])
      .filter(isBugEvidenceAttachment);
    /*
     * Mảng ý phải XUỐNG DÒNG trước khi vào gate. `looksRunOn` làm `String(text)`, mà `String(['a','b'])`
     * nối bằng DẤU PHẨY thành một dòng — nội dung đã đúng một-ý-một-dòng vẫn bị chấm run-on, và càng
     * tách ý ra thì càng nhiều dấu phẩy nên càng chắc bị chặn. `buildBugDescription` không mắc lỗi này
     * vì nó có nhánh riêng cho mảng; chỗ truyền cho gate thì không.
     */
    const dongHoaYs = (v) => (Array.isArray(v) ? v.join('\n') : v);
    const gateProblems = outputGate.gateBug({
      id: testCase.tcId,
      summary,
      actualResult: dongHoaYs(actualResult),
      expectedResult: dongHoaYs(override.expectedResult || tcInfo.expectedResult || ''),
      attachments: attachmentsPreview,
    });
    if (gateProblems.length) bugGateProblems.push(...gateProblems);
    const blockedByGate = gateProblems.length > 0 && STRICT && !QA_APPROVED;

    console.log(`Processing ${testCase.tcId}: ${displayTitle}${prioritySuffix}`);

    if (DRY_RUN) {
      /*
       * In TITLE + DESCRIPTION thật ra console. Trước đây dry-run chỉ in một dòng "Would create" nên
       * không soát được nội dung — mà nội dung mới là thứ dễ sai nhất (title mang tên case, tiền điều
       * kiện của đơn vị khác). Preview không đọc được thì nó không phải preview.
       */
      console.log(`  TITLE: ${summary}`);
      console.log(buildBugDescription({
        preconditions: override.preconditions || tcInfo.preconditions || '(không có thông tin tiền điều kiện)',
        steps: override.steps?.length ? override.steps : (tcInfo.steps?.length ? tcInfo.steps : testCase.steps),
        actualResult,
        expectedResult: override.expectedResult || tcInfo.expectedResult || '(xem file test case gốc)',
        foundBy: foundBySource(),
        tcId: testCase.tcId,
        layer,
      }).split('\n').map((l) => `  | ${l}`).join('\n'));
      console.log(`  ĐÍNH KÈM: ${attachmentsPreview.length ? attachmentsPreview.map((a) => path.basename(a)).join(', ') : '(KHÔNG CÓ — gate sẽ chặn)'}`);
      rows.push({
        tcId: testCase.tcId,
        issueKey: UPDATE_ISSUE_KEY || 'DRY-RUN',
        status: UPDATE_ISSUE_KEY
          ? `Would update existing ${layer} bug${prioritySuffix}`
          : `Would create child ${layer} bug${prioritySuffix}`,
        url: UPDATE_ISSUE_KEY ? `${BACKLOG_BASE_URL}/view/${UPDATE_ISSUE_KEY}` : '-',
      });
      continue;
    }

    if (blockedByGate) {
      console.warn(`  ⚠ GATE chặn ${testCase.tcId}: ${gateProblems.join('; ')}`);
      rows.push({ tcId: testCase.tcId, issueKey: 'BLOCKED', status: `BLOCKED by gate: ${gateProblems.join('; ')}`, url: '-' });
      continue;
    }

    const description = buildBugDescription({
      preconditions: override.preconditions || tcInfo.preconditions || '(không có thông tin tiền điều kiện)',
      steps: override.steps?.length ? override.steps : (tcInfo.steps?.length ? tcInfo.steps : testCase.steps),
      actualResult,
      expectedResult: override.expectedResult || tcInfo.expectedResult || '(xem file test case gốc)',
      foundBy: foundBySource(),
      tcId: testCase.tcId,
      layer,
    });

    if (UPDATE_ISSUE_KEY) {
      try {
        /*
         * Backlog trả 400 "No comment content" (code 7) khi PATCH không đổi gì — vd chạy lại update
         * trên issue đã đúng nội dung. Đó KHÔNG phải lỗi: coi là không-có-gì-để-sửa rồi đi tiếp sang
         * đính kèm. Để nó ném ra thì một bug đã log đúng chữ sẽ vĩnh viễn không bổ sung được ảnh.
         */
        try {
          await updateIssue(UPDATE_ISSUE_KEY, { summary, description, priority, parentIssue });
        } catch (error) {
          if (!/No comment content/i.test(formatApiError(error))) throw error;
          console.log('  nội dung đã đúng sẵn, không cần sửa chữ — đi tiếp phần đính kèm.');
        }
        /*
         * Update cũng phải mang evidence. Trước đây nhánh này KHÔNG upload gì, nên sửa mô tả bug mà
         * ảnh vẫn là bộ cũ — mô tả và bằng chứng lệch nhau mà không ai báo.
         * Bỏ qua file đã đính kèm (so theo tên) để chạy lại không nhân bản ảnh.
         */
        const daCo = await layTenFileDaDinhKem(UPDATE_ISSUE_KEY);
        const canThem = attachmentsPreview.filter((f) => !daCo.has(path.basename(f)));
        if (canThem.length) {
          const ids = [];
          for (const f of canThem) {
            const id = await uploadAttachmentFile(f);
            console.log(`  attachment ${path.basename(f)}: ${id ? 'OK' : 'WARN'}`);
            if (id) ids.push(id);
          }
          if (ids.length) await attachIssueAttachments(UPDATE_ISSUE_KEY, ids);
        }
        console.log(`  evidence: ${daCo.size} file đã có · thêm ${canThem.length} file`);
        rows.push({
          tcId: testCase.tcId,
          issueKey: UPDATE_ISSUE_KEY,
          status: 'Updated',
          url: `${BACKLOG_BASE_URL}/view/${UPDATE_ISSUE_KEY}`,
        });
      } catch (error) {
        const message = formatApiError(error);
        console.error(`  update failed: ${message}`);
        rows.push({ tcId: testCase.tcId, issueKey: UPDATE_ISSUE_KEY, status: `Error: ${message}`, url: '-' });
      }
      continue;
    }

    // --only-priority: KHÔNG resolve assignee và không dừng vì thiếu — để trống cho PM phân.
    const assigneeId = ONLY_PRIORITY
      ? null
      : await resolveBugAssigneeAccountId(layer, parentIssue, assigneeCache, projectId);
    if (!ONLY_PRIORITY && !assigneeId) {
      fail('Missing assignee. Configure BACKLOG_FE_ASSIGNEE/BACKLOG_BE_ASSIGNEE or assign the parent Story/Task.');
    }

    const existing = await searchExistingBug(testCase.tcId, projectId, parentIssue.id);
    if (existing) {
      rows.push({
        tcId: testCase.tcId,
        issueKey: existing.issueKey,
        status: 'Skipped (duplicate)',
        url: `${BACKLOG_BASE_URL}/view/${existing.issueKey}`,
      });
      continue;
    }

    try {
      const created = await createIssue({
        tcId: testCase.tcId,
        summary,
        description,
        assigneeId,
        priority,
        parentIssue,
        projectId,
        issueTypeId,
      });

      /*
       * DÙNG LẠI `attachmentsPreview` — đúng danh sách gate đã duyệt và dry-run đã in ra.
       * Trước đây chỗ này dựng LẠI danh sách từ `artifactInfo`, nên preview nói 3 file mà thực tế chỉ
       * upload 1: preview và hành động là hai nhánh code khác nhau thì preview không bảo chứng gì cả.
       */
      const attachments = attachmentsPreview;

      if (attachments.length) {
        const attachmentIds = [];
        for (const attachment of attachments) {
          const id = await uploadAttachmentFile(attachment);
          console.log(`  attachment ${path.basename(attachment)}: ${id ? 'OK' : 'WARN'}`);
          if (id) attachmentIds.push(id);
        }
        if (attachmentIds.length) await attachIssueAttachments(created.id, attachmentIds);
      }

      rows.push({
        tcId: testCase.tcId,
        issueKey: created.issueKey,
        status: 'Created',
        url: `${BACKLOG_BASE_URL}/view/${created.issueKey}`,
      });
    } catch (error) {
      const message = formatApiError(error);
      console.error(`  create failed: ${message}`);
      rows.push({ tcId: testCase.tcId, issueKey: 'ERROR', status: `Error: ${message}`, url: '-' });
    }
  }

  if (bugGateProblems.length) {
    console.log(`\n[gate bug] ${bugGateProblems.length} vi phạm chất lượng (RULE_GLOBAL):`);
    bugGateProblems.forEach((p) => console.log(`  - ${p}`));
    console.log(`  → Bug cần ≥1 ảnh/video; case phức tạp cần video; KQ hiện tại/mong muốn mỗi ý 1 dòng. Bổ sung rồi chạy lại.${STRICT ? ' Bỏ qua có chủ đích: --qa-approved.' : ' (STRICT tắt → chỉ cảnh báo, vẫn tạo bug.)'}`);
  }

  const summaryText = buildSummary(rows);
  if (WRITE_LOG) {
    const summaryPath = writeSummary(summaryText);
    console.log(`Bug report log saved: ${path.relative(REPO_ROOT, summaryPath)}`);
  }

  const created = rows.filter((row) => row.status === 'Created').length;
  const duplicates = rows.filter((row) => row.status.startsWith('Skipped')).length;
  const errors = rows.filter((row) => row.status.startsWith('Error')).length;

  console.log('');
  console.log('Backlog Bug Report complete');
  console.log(`  Story:      ${STORY_KEY}`);
  console.log(`  Failed TC:  ${failedTests.length}`);
  console.log(`  Created:    ${created}`);
  console.log(`  Duplicate:  ${duplicates}`);
  console.log(`  Errors:     ${errors}`);

  if (DRY_RUN) console.log(summaryText.trim());
  if (errors > 0) process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(`Fatal: ${formatApiError(error)}`);
  process.exit(1);
});
