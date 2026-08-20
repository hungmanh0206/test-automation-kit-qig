#!/usr/bin/env node

const axios = require('axios');
const { loadEnv, buildJiraHeaders } = require('./utils');

loadEnv();

const LIVE = process.argv.includes('--live');
const TIMEOUT_MS = Number(process.env.INTEGRATION_CHECK_TIMEOUT_MS || 15000);

const checks = [
  { label: 'Jira URL', keys: ['JIRA_BASE_URL', 'JIRA_URL'], level: 'required' },
  { label: 'Jira user', keys: ['JIRA_EMAIL', 'JIRA_USERNAME'], level: 'required' },
  { label: 'Jira token hoặc PAT', keys: ['JIRA_API_TOKEN', 'JIRA_PAT'], level: 'required' },
  { label: 'Jira project key', keys: ['JIRA_PROJECT_KEY'], level: 'required' },
  { label: 'Jira story key', keys: ['JIRA_STORY_KEY', 'TASK_KEY'], level: 'warning' },
  // AIO Tests là test-management tool mặc định từ GĐ5 (Xray đóng băng sau 21/08/2026).
  { label: 'AIO token', keys: ['AIO_API_TOKEN'], level: 'required' },
  { label: 'AIO project key', keys: ['AIO_PROJECT_KEY', 'JIRA_PROJECT_KEY'], level: 'required' },
  { label: 'Confluence URL', keys: ['CONFLUENCE_URL'], level: 'warning' },
  { label: 'Confluence user', keys: ['CONFLUENCE_USERNAME', 'JIRA_EMAIL', 'JIRA_USERNAME'], level: 'warning' },
  { label: 'Confluence token', keys: ['CONFLUENCE_API_TOKEN'], level: 'warning' },
  { label: 'Confluence page id', keys: ['CONFLUENCE_PAGE_ID'], level: 'warning' },
  { label: 'Figma token', keys: ['FIGMA_API_KEY'], level: 'warning' },
  { label: 'Figma file', keys: ['FIGMA_FILE_KEY', 'FIGMA_FILE_URL'], level: 'warning' },
  { label: 'Figma node', keys: ['FIGMA_NODE_ID', 'FIGMA_FILE_URL'], level: 'warning' },
  { label: 'Project output', keys: ['PROJECT_OUTPUT_DIR'], level: 'warning' },
  { label: 'Task key', keys: ['TASK_KEY', 'JIRA_STORY_KEY'], level: 'warning' },
];

function isConfigured(key) {
  const value = String(process.env[key] || '').trim();
  return Boolean(value) && !/^<.+>$/.test(value);
}

let missingRequiredCount = 0;
let warningCount = 0;

console.log(LIVE ? 'Integration config + live connection check' : 'Integration config check');
console.log('Secrets are masked; this command only checks presence.');

for (const { label, keys, level } of checks) {
  const foundKey = keys.find(isConfigured);
  if (foundKey) {
    console.log(`[OK] ${label}: ${foundKey}`);
  } else if (level === 'required') {
    missingRequiredCount += 1;
    console.log(`[MISSING] ${label}: ${keys.join(' or ')}`);
  } else {
    warningCount += 1;
    console.log(`[WARN] ${label}: ${keys.join(' or ')} (bổ sung theo từng task khi cần)`);
  }
}

if (missingRequiredCount > 0) {
  console.log(`Result: thiếu ${missingRequiredCount} cấu hình bắt buộc. Bổ sung .env.local hoặc .env trước khi gọi external APIs.`);
  process.exit(1);
}

if (warningCount > 0) {
  console.log(`Result: cấu hình bắt buộc đã đủ; còn ${warningCount} mục task-specific cần bổ sung khi chạy task tương ứng.`);
} else {
  console.log('Result: integration env config is complete enough for API calls.');
}

if (LIVE) {
  runLiveChecks().catch((error) => {
    console.error(`[ERROR] Live check failed unexpectedly: ${formatApiError(error)}`);
    process.exit(1);
  });
}

async function runLiveChecks() {
  console.log('');
  console.log('Live connection check');

  let failed = 0;
  failed += await runLiveCheck('Jira', testJira);

  if (isConfigured('AIO_API_TOKEN') && (isConfigured('AIO_PROJECT_KEY') || isConfigured('JIRA_PROJECT_KEY'))) {
    failed += await runLiveCheck('AIO Tests', testAio);
  } else {
    console.log('[WARN] AIO live: thiếu AIO_API_TOKEN / project key, bỏ qua live check.');
  }

  if (hasAll(['CONFLUENCE_URL', 'CONFLUENCE_USERNAME', 'CONFLUENCE_API_TOKEN'])) {
    failed += await runLiveCheck('Confluence', testConfluence);
  } else {
    console.log('[WARN] Confluence live: thiếu URL/user/token, bỏ qua live check.');
  }

  if (isConfigured('FIGMA_API_KEY')) {
    failed += await runLiveCheck('Figma', testFigma);
  } else {
    console.log('[WARN] Figma live: thiếu FIGMA_API_KEY, bỏ qua live check.');
  }

  if (failed > 0) {
    console.log(`Live result: ${failed} service(s) không kết nối được.`);
    process.exit(1);
  }

  console.log('Live result: các service đủ cấu hình đã kết nối thành công.');
}

async function runLiveCheck(label, fn) {
  try {
    await fn();
    console.log(`[OK] ${label} live connection`);
    return 0;
  } catch (error) {
    console.log(`[ERROR] ${label} live connection: ${formatApiError(error)}`);
    return 1;
  }
}

async function testJira() {
  const baseUrl = stripTrailingSlash(process.env.JIRA_BASE_URL || process.env.JIRA_URL);
  await axios.get(`${baseUrl}/rest/api/3/myself`, {
    headers: buildJiraHeaders(),
    timeout: TIMEOUT_MS,
  });
}

/*
 * AIO: gọi `GET /config` của chính project — endpoint nhẹ nhất và cũng là nơi kit đọc enum trạng thái.
 * LƯU Ý đặc tính đã đo: rate limit của AIO trả **body rỗng** chứ không phải 429, nên body rỗng ở đây
 * cũng tính là lỗi tạm thời, không phải "kết nối OK".
 */
async function testAio() {
  const base = stripTrailingSlash(process.env.AIO_BASE_URL || 'https://tcms.aiojiraapps.com/aio-tcms/api/v1');
  const project = process.env.AIO_PROJECT_KEY || process.env.JIRA_PROJECT_KEY;
  const res = await axios.get(`${base}/project/${encodeURIComponent(project)}/config`, {
    headers: { Authorization: `AioAuth ${process.env.AIO_API_TOKEN}`, Accept: 'application/json' },
    timeout: TIMEOUT_MS,
  });
  if (!res.data || !Object.keys(res.data).length) throw new Error('AIO trả body rỗng (dấu hiệu rate limit), thử lại sau.');
}

async function testConfluence() {
  const baseUrl = stripTrailingSlash(process.env.CONFLUENCE_URL);
  const pageId = firstConfigured(['CONFLUENCE_PAGE_ID'])?.value;
  const path = pageId ? `/rest/api/content/${encodeURIComponent(pageId)}` : '/rest/api/space?limit=1';

  await axios.get(`${baseUrl}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${process.env.CONFLUENCE_USERNAME}:${process.env.CONFLUENCE_API_TOKEN}`).toString('base64')}`,
    },
    timeout: TIMEOUT_MS,
  });
}

async function testFigma() {
  await axios.get('https://api.figma.com/v1/me', {
    headers: {
      'X-Figma-Token': process.env.FIGMA_API_KEY,
    },
    timeout: TIMEOUT_MS,
  });
}

function hasAll(keys) {
  return keys.every(isConfigured);
}

function firstConfigured(keys) {
  const key = keys.find(isConfigured);
  return key ? { key, value: String(process.env[key]).trim() } : null;
}

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function formatApiError(error) {
  const status = error.response?.status;
  const data = error.response?.data;
  if (status) {
    const body = data?.errorMessages || data?.errors || data?.message || data?.err || data;
    return `${status} ${JSON.stringify(body).slice(0, 500)}`;
  }
  return String(error.message || error).slice(0, 500);
}
