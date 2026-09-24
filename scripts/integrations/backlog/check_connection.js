#!/usr/bin/env node

const axios = require('axios');
const { loadEnv } = require('./utils');

loadEnv();

const LIVE = process.argv.includes('--live');
const TIMEOUT_MS = Number(process.env.INTEGRATION_CHECK_TIMEOUT_MS || 15000);

const checks = [
  { label: 'Backlog URL', keys: ['BACKLOG_BASE_URL', 'BACKLOG_URL'], level: 'required' },
  { label: 'Backlog API key', keys: ['BACKLOG_API_KEY'], level: 'required' },
  { label: 'Backlog project key', keys: ['BACKLOG_PROJECT_KEY'], level: 'required' },
  { label: 'Backlog story key', keys: ['BACKLOG_STORY_KEY', 'TASK_KEY'], level: 'warning' },
  { label: 'Figma token', keys: ['FIGMA_API_KEY'], level: 'warning' },
  { label: 'Figma file', keys: ['FIGMA_FILE_KEY', 'FIGMA_FILE_URL'], level: 'warning' },
  { label: 'Figma node', keys: ['FIGMA_NODE_ID', 'FIGMA_FILE_URL'], level: 'warning' },
  { label: 'Project output', keys: ['PROJECT_OUTPUT_DIR'], level: 'warning' },
  { label: 'Task key', keys: ['TASK_KEY', 'BACKLOG_STORY_KEY'], level: 'warning' },
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
  failed += await runLiveCheck('Backlog', testBacklog);

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

// Backlog auth qua query param `?apiKey=`, không phải header — khác hẳn Backlog (Basic/Bearer).
async function testBacklog() {
  const baseUrl = stripTrailingSlash(process.env.BACKLOG_BASE_URL || process.env.BACKLOG_URL);
  await axios.get(`${baseUrl}/api/v2/users/myself`, {
    params: { apiKey: process.env.BACKLOG_API_KEY },
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
