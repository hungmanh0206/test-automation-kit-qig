#!/usr/bin/env node
'use strict';

/*
 * bug_claim — một phát hiện bug phải QUA MÁY trước khi được nói thành lời.
 *
 * VÌ SAO CÓ FILE NÀY. Chủ repo chỉ ra lỗi lặp lại ngày 16/09/2026: ở Phase 2 tôi báo "phát hiện bug,
 * có log không", bạn hỏi lại "chắc chưa", tôi kiểm lại rồi rút lời. Tức phát hiện kỹ thuật sai ngay
 * từ đầu, và câu hỏi của người dùng đang làm việc mà gate lẽ ra phải làm.
 *
 * Chẩn đoán là lỗi THỨ TỰ, không phải bất cẩn. Đo trên chính repo này:
 *   · `.agent/workflows/phase2_03_execute_and_auto_heal.md` dòng 25, chỗ tôi phát hiện và nói ra, đòi
 *     đúng HAI điều kiện: rerun đủ vòng, thu evidence.
 *   · `.agent/workflows/phase2_04_report_and_jira_gate.md` dòng 30, chỗ log Jira, mới là bar thật với
 *     khoảng TÁM điều kiện: oracle độc lập, expected đã xác nhận, phân tầng có chứng minh, bản đồ hệ
 *     thống cho bug thiết kế, cấm lấy app làm expected.
 * Tôi nói ở bước 03 nhưng bar nằm ở bước 04. Nên mọi câu "chắc chưa" đều ép tôi làm sớm phần còn lại,
 * và một trong số đó trượt.
 *
 * LỖI NÀY CHƯA TỪNG ĐƯỢC ĐẾM. Claim bị rút trước khi log thì không lên Jira, nên không vào
 * `knowledge/bugs`. Store đó có 62 bản ghi với 1 Rejected, trong khi memory ghi ít nhất 2 bug Rejected
 * (SAPP-28776, SAPP-28126). Thứ không đo được thì không sửa được, nên `--report` ở đây đếm cả claim
 * bị rút và phép kiểm nào đã bắt được nó.
 *
 * Dùng:
 *   node scripts/qa/bug_claim.js --new <TC_ID>     tạo bản nháp đủ trường để điền
 *   node scripts/qa/bug_claim.js --check           CHẶN nếu claim thiếu trường, hoặc có FAIL
 *                                                  product_bug mà không có claim nào
 *   node scripts/qa/bug_claim.js --report          đếm claim theo trạng thái, kể cả đã rút
 * Exit: 0 đạt · 1 có claim không hợp lệ hoặc thiếu claim · 2 dùng sai.
 */
const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const CFG_PATH = path.join(rc.REPO_ROOT, '.agent', 'config', 'bug_claim.json');

function loadCfg() {
  try {
    return JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
  } catch (e) {
    console.error(`[bug-claim] không đọc được config: ${CFG_PATH} — ${e.message}`);
    process.exit(2);
  }
}
const cfg = loadCfg();

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : '';
};
const has = (flag) => process.argv.includes(`--${flag}`);

function taskDirs() {
  let taskOut;
  try {
    taskOut = rc.getTaskOutputDir();
  } catch (e) {
    console.error(`[bug-claim] ${e.message}`);
    console.error('  Cần TASK_KEY và PROJECT_OUTPUT_DIR, hoặc TASK_ENV=profiles/<TASK>/task.env.');
    process.exit(2);
  }
  return { taskOut, claimDir: path.join(taskOut, cfg.claimDir) };
}

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const atLeast = (v, n) => typeof v === 'string' && v.trim().length >= n;

/** Một `measurement` phải DẪN phép đo, không phải khẳng định. Mẫu khai ở config để soi được. */
function looksLikeMeasurement(s) {
  if (!atLeast(s, cfg.falsification.minMeasurementChars)) return false;
  return cfg.falsification.measurementMustMatchOneOf.some((p) => new RegExp(p).test(s));
}

/** Kiểm MỘT claim. Trả mảng lỗi rỗng nghĩa là đạt. */
function validate(claim, file) {
  const e = [];
  const at = (m) => e.push(`${path.basename(file)}: ${m}`);

  if (!nonEmpty(claim.id)) at('thiếu `id`');
  if (!nonEmpty(claim.tc_id)) at('thiếu `tc_id`');
  if (!nonEmpty(claim.summary)) at('thiếu `summary`');
  if (!cfg.statuses.includes(claim.status)) at(`\`status\` phải là một trong ${cfg.statuses.join(', ')}`);

  /*
   * Claim ĐÃ RÚT chỉ cần ghi lý do và phép kiểm nào bắt được. Không bắt nó đủ trường, vì mục đích của
   * bản ghi rút là ĐẾM ĐƯỢC lỗi, không phải phạt việc thành thật. Bắt nó đầy đủ thì lần sau sẽ không
   * ai ghi nữa, và ta quay lại chỗ cũ: lỗi vô hình.
   */
  if (claim.status === 'withdrawn') {
    if (!atLeast(claim.withdrawn_reason, 15)) at('đã rút nhưng `withdrawn_reason` quá ngắn hoặc thiếu');
    if (!nonEmpty(claim.withdrawn_by_check)) at('đã rút nhưng thiếu `withdrawn_by_check` — phép kiểm nào bắt được');
    return e;
  }

  const o = claim.oracle || {};
  if (!cfg.oracleTypes.allowed.includes(o.type)) {
    at(`\`oracle.type\` phải thuộc ${cfg.oracleTypes.allowed.join(', ')} — app không được làm oracle của chính nó`);
  }
  if (!nonEmpty(o.ref)) at('thiếu `oracle.ref` — neo cụ thể, ví dụ BR-12 hoặc FSD §4.1.1');
  if (!atLeast(o.quote, cfg.oracleTypes.minQuoteChars)) {
    at(`\`oracle.quote\` phải TRÍCH nguyên văn từ nguồn, tối thiểu ${cfg.oracleTypes.minQuoteChars} ký tự`);
  }

  const minVal = cfg.field.minExpectedActualChars;
  if (!atLeast(claim.expected, minVal)) at(`\`expected\` quá ngắn, cần ít nhất ${minVal} ký tự và là GIÁ TRỊ`);
  if (!atLeast(claim.actual, minVal)) at(`\`actual\` quá ngắn, cần ít nhất ${minVal} ký tự và là GIÁ TRỊ`);
  if (nonEmpty(claim.expected) && String(claim.expected).trim() === String(claim.actual).trim()) {
    at('`expected` trùng `actual` — không có gì lệch thì không có bug');
  }

  const rr = Array.isArray(claim.reruns) ? claim.reruns : [];
  if (rr.length < cfg.minReruns) {
    at(`\`reruns\` có ${rr.length} lượt, cần ít nhất ${cfg.minReruns} để loại flaky và setup`);
  } else {
    const results = rr.map((r) => String((r && r.result) || '').trim());
    if (results.some((r) => !r)) at('`reruns` có lượt thiếu `result`');
    else if (new Set(results.map((r) => r.toLowerCase())).size > 1) {
      at(`\`reruns\` không ổn định (${results.join(', ')}) — kết quả đổi giữa các lượt là flaky, chưa phải bug`);
    } else if (!cfg.failResults.map((x) => x.toLowerCase()).includes(results[0].toLowerCase())) {
      at(`\`reruns\` toàn "${results[0]}" — claim bug thì mọi lượt phải fail`);
    }
    if (rr.some((r) => !nonEmpty(r && r.at))) at('`reruns` có lượt thiếu `at` (dấu thời gian)');
  }

  if (!['fe', 'be'].includes(claim.layer)) at('`layer` phải là `fe` hoặc `be` — đoán tầng là gán sai người');
  if (!atLeast(claim.layer_probe, cfg.field.minLayerProbeChars)) {
    at('`layer_probe` thiếu — phải nói ĐO BẰNG GÌ mà biết tầng, ví dụ response API trả gì');
  }

  const ins = claim.instrument || {};
  if (!nonEmpty(ins.control_type)) at('thiếu `instrument.control_type` — ant-select, radio, input, cell bảng');
  if (!nonEmpty(ins.read_method)) at('thiếu `instrument.read_method` — đọc value, đọc checked, hay đọc textContent');

  if (!cfg.fixturePaths.allowed.includes(claim.fixture_path)) {
    at(`\`fixture_path\` phải thuộc ${cfg.fixturePaths.allowed.join(', ')} — dựng thẳng DB thì app chưa từng đi qua trạng thái đó`);
  }

  const fal = Array.isArray(claim.falsified) ? claim.falsified : [];
  const need = Object.keys(cfg.falsification.requiredCategories);
  const seen = new Set(fal.map((f) => f && f.category));
  for (const c of need) {
    if (!seen.has(c)) at(`\`falsified\` thiếu nhóm "${c}" — ${cfg.falsification.requiredCategories[c].split('.')[0]}`);
  }
  fal.forEach((f, i) => {
    const w = `\`falsified[${i}]\``;
    if (!nonEmpty(f && f.category)) at(`${w} thiếu \`category\``);
    if (!atLeast(f && f.hypothesis, cfg.falsification.minHypothesisChars)) at(`${w} \`hypothesis\` quá ngắn`);
    if (!looksLikeMeasurement(f && f.measurement)) {
      at(`${w} \`measurement\` chưa dẫn PHÉP ĐO — cần số, lệnh, endpoint hoặc đường dẫn file`);
    }
    if (!nonEmpty(f && f.result)) at(`${w} thiếu \`result\` — phản chứng đó bị loại bằng kết quả gì`);
  });

  return e;
}

function readClaims(claimDir) {
  if (!fs.existsSync(claimDir)) return [];
  return fs.readdirSync(claimDir).filter((f) => f.endsWith('.json')).map((f) => {
    const p = path.join(claimDir, f);
    try {
      return { file: p, claim: JSON.parse(fs.readFileSync(p, 'utf8')) };
    } catch (e) {
      return { file: p, parseError: e.message };
    }
  });
}

/*
 * Nửa quan trọng của máy này: đối chiếu NGƯỢC. Nếu chỉ kiểm claim đã viết thì bỏ qua claim KHÔNG viết,
 * mà đó mới đúng là lỗi cần chặn. Đọc `testcase-status.json` tổng hợp, mọi case FAIL mang failureLayer
 * product_bug hoặc api_bug đều phải có claim.
 */
function missingClaims(taskOut, claims) {
  const statusFile = path.join(taskOut, 'test-results', 'testcase-status.json');
  if (!fs.existsSync(statusFile)) return { checked: false, missing: [] };
  let tests = [];
  try {
    const j = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    tests = Array.isArray(j) ? j : (j.tests || []);
  } catch (e) {
    return { checked: false, missing: [], error: e.message };
  }
  const active = new Set(claims.filter((c) => c.claim && c.claim.status !== 'withdrawn').map((c) => c.claim && c.claim.tc_id));
  const withdrawn = new Set(claims.filter((c) => c.claim && c.claim.status === 'withdrawn').map((c) => c.claim && c.claim.tc_id));
  /*
   * Hai tình huống KHÁC NHAU, và nói gộp thì người đọc sửa nhầm chỗ:
   *   · chưa có claim nào  → viết claim trước khi nói "bug"
   *   · claim ĐÃ RÚT mà case vẫn chấm product_bug → verdict chưa được sửa theo. Rút claim thì phải hạ
   *     verdict, nếu không thì bug đã rút vẫn đi tiếp tới bước log Jira.
   */
  const missing = [];
  let grandfathered = 0;
  for (const t of tests) {
    if (!cfg.blockingLayers.includes(String(t.failureLayer || ''))) continue;
    /*
     * Hai đời khuôn `testcase-status.json` cùng tồn tại: bộ cũ dùng `id`, bộ mới dùng `tcId`. Đọc một
     * khoá thì bộ kia ra `undefined` và thông báo vô dụng. Đã dính thật khi chạy trên SAPP-28905.
     */
    const id = t.id || t.tcId || '(không đọc được id)';
    /*
     * BỎ QUA case ĐÃ CÓ BUG KEY. Gate này sinh ra để chặn claim CHƯA kiểm chứng lọt tới người đọc,
     * không phải để đòi hồi tố cho bug đã log và đã đóng. Case có `bug: SAPP-xxxxx` nghĩa là nó đã đi
     * qua gate của phase2_04 rồi. Bắt nó viết claim ngược là biến gate thành tiếng ồn trên nợ cũ, và
     * gate hay báo oan thì bị tắt. Vẫn ĐẾM và in ra, để việc bỏ qua không âm thầm.
     */
    if (nonEmpty(t.bug)) { grandfathered += 1; continue; }
    if (active.has(id)) continue;
    if (withdrawn.has(id)) {
      missing.push(`${id}: claim ĐÃ RÚT nhưng case vẫn chấm ${t.failureLayer} — sửa verdict trong testcase-status.json cho khớp`);
    } else {
      missing.push(`${id} (${t.failureLayer}) được chấm là bug nhưng KHÔNG có claim — viết claim trước, đừng nói "bug" trước`);
    }
  }
  return { checked: true, total: tests.length, missing, grandfathered };
}

const TEMPLATE = (tcId) => ({
  id: `CLAIM-${tcId}`,
  tc_id: tcId,
  summary: '',
  status: 'claimed',
  oracle: { type: '', ref: '', quote: '' },
  expected: '',
  actual: '',
  reruns: [{ at: '', result: 'fail' }, { at: '', result: 'fail' }],
  layer: '',
  layer_probe: '',
  instrument: { control_type: '', read_method: '' },
  fixture_path: '',
  falsified: Object.entries(cfg.falsification.requiredCategories).map(([category, why]) => ({
    category, hypothesis: '', measurement: '', result: '', _goi_y: why,
  })),
});

function main() {
  if (has('new')) {
    const tcId = arg('new');
    if (!tcId) { console.error('[bug-claim] cần: --new <TC_ID>'); process.exit(2); }
    const { claimDir } = taskDirs();
    fs.mkdirSync(claimDir, { recursive: true });
    const out = path.join(claimDir, `${tcId}.json`);
    if (fs.existsSync(out)) { console.error(`[bug-claim] đã có: ${out}`); process.exit(2); }
    fs.writeFileSync(out, `${JSON.stringify(TEMPLATE(tcId), null, 2)}\n`, 'utf8');
    console.log(`[bug-claim] đã tạo bản nháp: ${path.relative(rc.REPO_ROOT, out).split(path.sep).join('/')}`);
    console.log('  Điền đủ rồi chạy `npm run bug:claim` TRƯỚC khi nhắc chữ "bug" trong hội thoại.');
    process.exit(0);
  }

  const { taskOut, claimDir } = taskDirs();
  const claims = readClaims(claimDir);

  if (has('report')) {
    const by = {};
    const caught = {};
    for (const c of claims) {
      const s = (c.claim && c.claim.status) || '(hỏng)';
      by[s] = (by[s] || 0) + 1;
      if (c.claim && c.claim.status === 'withdrawn') {
        const k = c.claim.withdrawn_by_check || '(không ghi)';
        caught[k] = (caught[k] || 0) + 1;
      }
    }
    console.log(`[bug-claim] ${claims.length} claim trong ${path.relative(rc.REPO_ROOT, claimDir).split(path.sep).join('/')}`);
    for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`);
    const w = by.withdrawn || 0;
    if (claims.length) console.log(`  tỉ lệ rút: ${((w / claims.length) * 100).toFixed(0)}%`);
    if (w) {
      console.log('  phép kiểm đã bắt được:');
      for (const [k, v] of Object.entries(caught).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(3)}  ${k}`);
    }
    process.exit(0);
  }

  // mặc định là --check
  const problems = [];
  for (const c of claims) {
    if (c.parseError) { problems.push(`${path.basename(c.file)}: không parse được — ${c.parseError}`); continue; }
    problems.push(...validate(c.claim, c.file));
  }

  const mc = missingClaims(taskOut, claims);
  for (const m of mc.missing) problems.push(`case ${m}`);

  const ok = claims.filter((c) => c.claim && !c.parseError);
  const nActive = ok.filter((c) => c.claim.status !== 'withdrawn').length;
  const nWithdrawn = ok.length - nActive;

  if (problems.length) {
    console.error(`[bug-claim] CHẶN: ${problems.length} vấn đề trên ${claims.length} claim.`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error('');
    console.error('  Luật: claim phải qua máy TRƯỚC khi nói thành lời. Câu hỏi cho người dùng khi đó chỉ còn là');
    console.error('  "có log không", không phải "có phải bug không". Tạo bản nháp: `npm run bug:claim:new -- --new <TC_ID>`.');
    process.exit(1);
  }

  const scope = mc.checked ? `, đối chiếu ${mc.total} case trong testcase-status.json` : ', chưa có testcase-status.json để đối chiếu';
  const gf = mc.grandfathered ? ` Bỏ qua ${mc.grandfathered} case đã có bug key (đã log trước khi có gate này).` : '';
  console.log(`[bug-claim] OK — ${nActive} claim hợp lệ, ${nWithdrawn} đã rút${scope}.${gf}`);
  process.exit(0);
}

if (require.main === module) main();
