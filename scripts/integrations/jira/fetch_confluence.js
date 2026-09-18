const https = require('https');
const fs = require('fs');
const path = require('path');
const {
  getProjectOutputDir,
  getTaskKey,
  getTaskOutputDir,
  loadEnv,
} = require('./utils');
const { storageToMarkdown } = require('../../lib/confluence/storage_to_markdown');

loadEnv();

const CONFLUENCE_URL = (process.env.CONFLUENCE_URL || '').replace(/\/+$/, '');
const CONFLUENCE_USERNAME = process.env.CONFLUENCE_USERNAME || process.env.JIRA_EMAIL;
const CONFLUENCE_API_TOKEN = process.env.CONFLUENCE_API_TOKEN;
const PAGE_ID = process.env.CONFLUENCE_PAGE_ID;
const TASK_KEY = getTaskKey();
const PROJECT_OUTPUT_DIR = getProjectOutputDir();
const TASK_OUTPUT_DIR = getTaskOutputDir({ projectOutputDir: PROJECT_OUTPUT_DIR, taskKey: TASK_KEY });
const OUT_DIR = process.env.CONFLUENCE_OUTPUT_DIR
  ? path.resolve(process.env.CONFLUENCE_OUTPUT_DIR)
  : path.resolve(__dirname, '..', '..', '..', TASK_OUTPUT_DIR, 'requirements', 'confluence');

if (!CONFLUENCE_URL || !CONFLUENCE_USERNAME || !CONFLUENCE_API_TOKEN || !PAGE_ID) {
  console.error('ERROR: Missing CONFLUENCE_URL, CONFLUENCE_USERNAME, CONFLUENCE_API_TOKEN, or CONFLUENCE_PAGE_ID.');
  process.exit(1);
}

const confluence = new URL(CONFLUENCE_URL);
const basePath = confluence.pathname.replace(/\/+$/, '');
const auth = Buffer.from(`${CONFLUENCE_USERNAME}:${CONFLUENCE_API_TOKEN}`).toString('base64');

const options = {
  hostname: confluence.hostname,
  path: `${basePath}/rest/api/content/${PAGE_ID}?expand=body.storage`,
  headers: {
    Authorization: `Basic ${auth}`,
    Accept: 'application/json',
  },
};

let data = '';
const req = https.get(options, (res) => {
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const payload = JSON.parse(data);
      const title = payload.title || 'No title';
      const bodyRaw = payload.body?.storage?.value || '';
      const bodyText = storageToMarkdown(bodyRaw);
      const output = `# ${title}\n\n## Page ID: ${PAGE_ID}\n\n${bodyText}`;

      if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
      const outFile = path.join(OUT_DIR, `confluence_${PAGE_ID}.md`);
      fs.writeFileSync(outFile, output, 'utf8');

      console.log('TITLE:', title);
      console.log('SAVED:', outFile);
      console.log('PREVIEW:', bodyText.substring(0, 500));
    } catch (error) {
      console.error('Parse error:', error.message);
      console.error('Raw response:', data.substring(0, 500));
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error.message);
  process.exit(1);
});
