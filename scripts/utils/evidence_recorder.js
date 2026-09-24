/**
 * EvidenceRecorder — chuẩn hoá evidence Phase 2 để MỌI case (PASS/FAIL) và MỌI step đều có:
 *   - trạng thái pass/fail theo từng step,
 *   - 1 ảnh evidence highlight vào đúng element được kiểm ở step đó.
 *
 * Ảnh lưu: <projectOutputDir>/tasks/<taskKey>/test-results/artifacts/<TC_ID>/step-NN-<status>.png
 * Ghi ra:  <projectOutputDir>/tasks/<taskKey>/test-results/testcase-status.json
 *   schema đúng với push_test_execution.js:
 *   { taskKey, generatedAt, runId?, tests: [ { tcId, status, comment, evidence:[...], steps:[ {status, comment, evidence:[...]} ] } ] }
 *
 * Cách dùng trong automation task-scoped (standalone Playwright):
 *   const { EvidenceRecorder } = require('<repo>/scripts/utils/evidence_recorder');
 *   const rec = new EvidenceRecorder({ taskKey:'dự án trước-XXXX', projectOutputDir:'outputs/lms-operations-automation', runId });
 *   const tc = rec.case('OPS_ORD_TC_021');
 *   await tc.step(page, 'Mở dropdown Hình thức', { highlight: page.getByLabel('Hình thức'),
 *        assert: async () => (await page.getByRole('option').count()) === 2 });   // pass/fail suy từ assert
 *   await tc.step(page, 'Kiểm giá trị', { highlight: locator, status: 'PASSED' });  // hoặc set tay
 *   await tc.finish();            // status tổng = FAILED nếu có step fail, else PASSED
 *   await rec.write();            // ghi testcase-status.json (merge)
 *
 * TODO không cần evidence: đừng gọi step()/case() cho case chưa chạy — chỉ ghi case đã execute.
 */
const fs = require('fs');
const path = require('path');
const { sanitize } = require('./evidence/sanitize');   // #3: PII safety-net
const { buildManifest, readManifest } = require('./evidence/manifest'); // #3: index evidence + kiểm tồn tại

function pad2(n) { return String(n).padStart(2, '0'); }
function ts() { try { return new Date().toISOString(); } catch { return ''; } }

// G0 (round-3 hardening): tên shard file an toàn + ghi JSON ATOMIC (temp → rename; rename thay thế
// atomic cross-platform qua libuv) → không bao giờ đọc trúng file ghi dở, không mất update do đè.
const STATUS_DIRNAME = 'testcase-status';
function safeName(id) { return String(id || 'unknown').replace(/[^\w.-]+/g, '_'); }
function writeJsonAtomic(file, obj) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * Aggregator (dùng chung): gộp testcase-status.json cũ + mọi shard testcase-status/<TC>.json
 * → ghi lại testcase-status.json (atomic). Idempotent; runner/CI gọi 1 lần cuối để có bản đầy đủ
 * sau khi mọi worker đã ghi shard. shard (per-TC) là source-of-truth, không đua chéo TC.
 */
function aggregateStatus({ testResultsDir, taskKey = '', runId = '', log = false } = {}) {
  const statusFile = path.join(testResultsDir, 'testcase-status.json');
  const shardDir = path.join(testResultsDir, STATUS_DIRNAME);
  const byId = new Map();
  try { const ex = JSON.parse(fs.readFileSync(statusFile, 'utf8')); for (const t of ex.tests || []) if (t && t.tcId) byId.set(t.tcId, t); } catch { /* chưa có / hỏng → bỏ qua */ }
  let shards = 0;
  try {
    for (const f of fs.readdirSync(shardDir)) {
      if (!f.endsWith('.json')) continue;
      try { const s = JSON.parse(fs.readFileSync(path.join(shardDir, f), 'utf8')); if (s && s.test && s.test.tcId) { byId.set(s.test.tcId, s.test); shards++; } } catch { /* shard hỏng → skip */ }
    }
  } catch { /* chưa có shard dir */ }
  const out = { taskKey, generatedAt: ts(), ...(runId ? { runId } : {}), tests: [...byId.values()] };
  writeJsonAtomic(statusFile, out);
  let missingCount = 0;
  try { missingCount = buildManifest(testResultsDir).missingCount; } catch (e) { /* best-effort */ }
  if (log) console.log(`[evidence] aggregate: ${byId.size} case (từ ${shards} shard + status cũ) → ${statusFile}${missingCount ? ` · ⚠ ${missingCount} evidence THIẾU file (xem evidence-manifest.json)` : ''}`);
  return { statusFile, count: byId.size, shards, missingCount };
}

async function highlight(page, target) {
  if (!target) return null;
  let handle = null;
  try {
    if (typeof target === 'string') handle = await page.$(target);
    else if (typeof target.elementHandle === 'function') handle = await target.first().elementHandle({ timeout: 2000 }).catch(() => null);
    else if (typeof target.evaluate === 'function') handle = target; // đã là ElementHandle
  } catch { handle = null; }
  if (!handle) return null;
  try {
    await page.evaluate((el) => {
      el.__evPrev = { outline: el.style.outline, box: el.style.boxShadow, offset: el.style.outlineOffset };
      el.style.outline = '3px solid #e11d48';
      el.style.outlineOffset = '2px';
      el.style.boxShadow = '0 0 0 4px rgba(225,29,72,.30)';
      el.scrollIntoView({ block: 'center', inline: 'center' });
    }, handle);
  } catch { return null; }
  return handle;
}
async function unhighlight(page, handle) {
  if (!handle) return;
  try { await page.evaluate((el) => { const p = el.__evPrev || {}; el.style.outline = p.outline || ''; el.style.boxShadow = p.box || ''; el.style.outlineOffset = p.offset || ''; }, handle); } catch { /* noop */ }
}

class Case {
  constructor(recorder, tcId) {
    this.rec = recorder;
    this.tcId = tcId;
    this.steps = [];
    this.dir = path.join(recorder.artifactsRoot, tcId);
    fs.mkdirSync(this.dir, { recursive: true });
  }

  /**
   * Chụp evidence 1 step, highlight element cụ thể, đánh dấu pass/fail.
   * opts: { highlight?: Locator|selector|ElementHandle, assert?: ()=>bool|Promise<bool>, status?: 'PASSED'|'FAILED', comment?, mask?: Locator[] }
   */
  async step(page, name, opts = {}) {
    const idx = this.steps.length + 1;
    let status = opts.status;
    let comment = opts.comment || name;
    if (!status && typeof opts.assert === 'function') {
      try { status = (await opts.assert()) ? 'PASSED' : 'FAILED'; }
      catch (e) { status = 'FAILED'; comment = `${name} — lỗi assert: ${e.message}`; }
    }
    if (!status) status = 'PASSED';
    const h = await highlight(page, opts.highlight);
    // #3/problem-4: settle 1 paint (double-rAF) sau highlight+scroll → giảm chụp trúng lúc rerender detach.
    if (h) { try { await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))); } catch (e) { /* settle best-effort */ } }
    const file = path.join(this.dir, `step-${pad2(idx)}-${status.toLowerCase()}.png`);
    try {
      await page.screenshot({ path: file, fullPage: true, mask: opts.mask || [], maskColor: '#8a8a8a' });
    } catch (e) {
      try { await page.screenshot({ path: file, mask: opts.mask || [] }); } catch { /* give up */ }
    }
    await unhighlight(page, h);
    const rel = path.relative(this.rec.repoRoot, file).split(path.sep).join('/');
    this.steps.push({ status, comment: sanitize(comment), evidence: [rel] }); // #3: mask PII lỡ quên
    if (this.rec.log) console.log(`   [step ${idx}] ${status} — ${name} → ${path.basename(file)}`);
    return status;
  }

  /** Kết thúc case: status tổng (mặc định = FAILED nếu có step FAILED). Evidence cấp case = ảnh step lỗi (nếu có) hoặc step cuối. */
  async finish(overallStatus, opts = {}) {
    // opts.evidence: file cấp CASE thêm vào (vd video mô tả cả chuỗi thao tác — ảnh tĩnh không tả nổi).
    const anyFail = this.steps.some((s) => s.status === 'FAILED');
    const status = overallStatus || (anyFail ? 'FAILED' : (this.steps.length ? 'PASSED' : 'TODO'));
    const failEv = this.steps.find((s) => s.status === 'FAILED');
    const caseEv = [...((failEv || this.steps[this.steps.length - 1] || {}).evidence || []), ...[].concat(opts.evidence || [])];
    this.rec._put({
      tcId: this.tcId,
      status,
      comment: sanitize(opts.comment || (anyFail ? 'Có step FAILED — xem step evidence' : 'Executed')),
      evidence: caseEv,
      steps: this.steps,
    });
    return status;
  }
}

class EvidenceRecorder {
  constructor({ taskKey, projectOutputDir, runId = '', repoRoot = process.cwd(), log = true } = {}) {
    if (!taskKey || !projectOutputDir) throw new Error('EvidenceRecorder cần taskKey + projectOutputDir');
    this.taskKey = taskKey;
    this.runId = runId;
    this.repoRoot = repoRoot;
    this.log = log;
    this.taskDir = path.join(repoRoot, projectOutputDir, 'tasks', taskKey);
    this.testResults = path.join(this.taskDir, 'test-results');
    this.artifactsRoot = path.join(this.testResults, 'artifacts');
    fs.mkdirSync(this.artifactsRoot, { recursive: true });
    this.statusFile = path.join(this.testResults, 'testcase-status.json');
    // G0: thư mục shard per-TC (atomic, chống race) — nguồn để aggregate ra statusFile.
    this.shardDir = path.join(this.testResults, STATUS_DIRNAME);
    fs.mkdirSync(this.shardDir, { recursive: true });
    this._tests = new Map();
    this.startedAt = Date.now();
  }
  case(tcId) { return new Case(this, tcId); }
  _put(entry) {
    // `recordedAt` = lúc case NÀY thật sự chạy xong. Provenance phải bám vào từng case: nếu chỉ dựa
    // `generatedAt` của file thì mỗi lần write() lại đóng dấu mới cho cả case cũ → rửa sạch dấu vết.
    entry.recordedAt = ts();
    this._tests.set(entry.tcId, entry);
    // G0: PERSIST NGAY per-TC shard (atomic) khi case finish → process chết vẫn giữ case đã xong;
    // mỗi TC 1 file riêng → 2 worker khác TC KHÔNG đè nhau (khác file cũ read→merge→write chung).
    try {
      const shard = path.join(this.shardDir, `${safeName(entry.tcId)}.json`);
      writeJsonAtomic(shard, { taskKey: this.taskKey, ...(this.runId ? { runId: this.runId } : {}), at: ts(), test: entry });
    } catch (e) { if (this.log) console.warn(`[evidence] ghi shard ${entry.tcId} lỗi: ${e.message} (giữ in-memory, write() sẽ gộp)`); }
  }

  /**
   * Aggregate → testcase-status.json (atomic). Gộp: status cũ + mọi shard per-TC trên đĩa (mọi
   * worker/run) + case in-memory lần này. Giữ API cũ (consumer vẫn đọc testcase-status.json).
   * Idempotent — dưới parallel, gọi write()/aggregateStatus() lần cuối cho bản đầy đủ.
   */
  write() {
    const byId = new Map();
    /*
     * KẾ THỪA KẾT QUẢ CŨ — phải ĐÁNH DẤU, không được im lặng.
     * Gộp mọi shard là CỐ Ý (nhiều worker, và giữ được case đã xong khi process chết). Nhưng nó cũng
     * kéo theo kết quả của những LƯỢT CHẠY TRƯỚC: chạy lại 3 case mà status ra 51 case PASSED, đóng
     * dấu `generatedAt` hôm nay — đẩy lên TCM là báo PASS cho 48 case lượt này chưa hề chạy.
     * (Đã xảy ra thật: CSDL-26523 chạy 3 case, status gộp thành 51, 48 case từ 13/07.)
     * Nên: entry cũ hơn lượt này được gắn `carriedOver` + `carriedFrom`, và cảnh báo ra stdout.
     * Ngưỡng GRACE 6h chứ không so đúng mốc start: Playwright khởi động các worker LỆCH NHAU vài giây,
     * so chính xác sẽ gắn nhầm cờ cho case của worker chạy trước.
     */
    const GRACE_MS = 6 * 60 * 60 * 1000;
    const cutoff = this.startedAt - GRACE_MS;
    const mark = (t, fileAt) => {
      // Sticky: đã từng bị đánh dấu thì giữ nguyên — không có đường "tẩy trắng" bằng cách write() lại.
      if (t.carriedOver) return t;
      const at = Date.parse(t.recordedAt || '') || fileAt;
      return at && at < cutoff ? { ...t, carriedOver: true, carriedFrom: new Date(at).toISOString() } : t;
    };

    // 1) status cũ (giữ TC không thuộc lần này — tương thích ngược)
    try {
      const ex = JSON.parse(fs.readFileSync(this.statusFile, 'utf8'));
      const at = Date.parse(ex.generatedAt || '') || 0;
      for (const t of ex.tests || []) if (t && t.tcId) byId.set(t.tcId, mark(t, at));
    } catch { /* new */ }
    // 2) shard trên đĩa (mọi worker) — nguồn atomic, không đua chéo TC
    try {
      for (const f of fs.readdirSync(this.shardDir)) {
        if (!f.endsWith('.json')) continue;
        try {
          const s = JSON.parse(fs.readFileSync(path.join(this.shardDir, f), 'utf8'));
          if (s && s.test && s.test.tcId) byId.set(s.test.tcId, mark(s.test, Date.parse(s.at || '') || 0));
        } catch { /* skip shard hỏng */ }
      }
    } catch { /* chưa có shard dir */ }
    // 3) case in-memory lần này — LUÔN thắng, và không bao giờ mang cờ carriedOver.
    for (const [id, e] of this._tests) byId.set(id, e);
    const out = { taskKey: this.taskKey, generatedAt: ts(), ...(this.runId ? { runId: this.runId } : {}), tests: [...byId.values()] };
    writeJsonAtomic(this.statusFile, out);
    const carried = out.tests.filter((t) => t.carriedOver);
    if (carried.length && this.log) {
      console.warn(`\n⚠ ${carried.length}/${out.tests.length} case KẾ THỪA từ lượt chạy trước (lượt này chỉ chạy ${this._tests.size}).`);
      console.warn(`  Chúng mang cờ "carriedOver" — ĐỪNG đẩy lên TCM như kết quả hôm nay. Dọn: xoá ${path.relative(this.repoRoot, this.shardDir).split(path.sep).join('/')}`);
    }
    // #3: sinh evidence-manifest.json (index + kiểm tồn tại) cạnh status.
    try { buildManifest(this.testResults, { repoRoot: this.repoRoot }); } catch (e) { if (this.log) console.warn(`[evidence] manifest skip: ${e.message}`); }
    if (this.log) console.log(`\nĐã ghi ${byId.size} case (aggregate shard+in-memory, atomic) → ${path.relative(this.repoRoot, this.statusFile).split(path.sep).join('/')}`);
    return this.statusFile;
  }
}

module.exports = { EvidenceRecorder, highlight, unhighlight, aggregateStatus, writeJsonAtomic, sanitize, buildManifest, readManifest };

// CLI: gộp shard → testcase-status.json (chạy 1 lần cuối ở global-teardown / job merge CI).
//   node scripts/utils/evidence_recorder.js --aggregate --test-results <dir> [--task <KEY>] [--run <RUN_ID>]
if (require.main === module && process.argv.includes('--aggregate')) {
  const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
  const dir = arg('test-results', '');
  if (!dir) { console.error('[evidence] --aggregate cần --test-results <dir chứa testcase-status.json + testcase-status/>'); process.exit(2); }
  const r = aggregateStatus({ testResultsDir: path.resolve(dir), taskKey: arg('task', ''), runId: arg('run', ''), log: true });
  console.log(`[evidence] aggregate xong: ${r.count} case (${r.shards} shard).`);
}
