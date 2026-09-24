import { test, expect } from '@playwright/test';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { gateEnv } from './_gate_env';

/*
 * @infra — ĐO ĐỘ PHỦ PHẢI ĐỊNH LƯỢNG, KHÔNG NHỊ PHÂN.
 *
 * Trước 23/08/2026 `dimension_coverage` chỉ hỏi "chiều X có ≥1 case?" — không có phép chia nào trong cả
 * file. Hệ quả đo được, và chính comment trong kit tự thừa nhận: bộ 530 case thật có §12 (Display, chiều
 * BẮT BUỘC luôn được nạp) chỉ ~12% case mà gate vẫn PASS. **Có mặt ≠ đủ.**
 *
 * Nay ngưỡng lấy từ `depthPolicy[band].minCasesPerDimension` — CÙNG file `risk_model.json` mà `risk_gate`
 * đọc `minCount`, để không sinh nguồn thứ hai cho cùng một câu hỏi ("task này cần sâu tới đâu").
 *
 * Test khoá 3 điều: ngưỡng theo band có răng · hạ ngưỡng phải KHAI RÕ (không im lặng) · phân bố lệch phải
 * lộ ra. Kèm âm tính: bộ phủ đủ thì KHÔNG được báo oan.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const DIM = path.join(REPO, 'scripts/qa/dimension_coverage.js');

const HEAD = '| TC ID | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên | Mức độ rủi ro |\n|---|---|---|---|---|---|---|---|---|\n';
const row = (i: number, tag: string) => `| TC_${String(i).padStart(3, '0')} | Order / Grid | ${tag} ca ${i} | [ui] x | d | 1. bước | kết quả | Cao | High |\n`;

/** Task giả: N case tag A + M case tag B, band lấy từ risk-register. */
const task = (opts: { a: number; b: number; band: string; manifest: unknown }) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'dimthr-'));
  const dir = path.join(base, 'tasks', 'T1');
  for (const d of ['test-cases', 'requirements', 'reports']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  let rows = '';
  let i = 1;
  for (let k = 0; k < opts.a; k += 1, i += 1) rows += row(i, '[Validation]');
  for (let k = 0; k < opts.b; k += 1, i += 1) rows += row(i, '[Display]');
  fs.writeFileSync(path.join(dir, 'test-cases', 'a.md'), `# T\n\n${HEAD}${rows}`);
  fs.writeFileSync(path.join(dir, 'reports', 'risk-register.json'), JSON.stringify([{ module: 'Order', band: opts.band }]));
  fs.writeFileSync(path.join(dir, 'requirements', 'dimension_manifest.json'), JSON.stringify(opts.manifest));
  return base;
};

const run = (base: string, args: string[] = []) => {
  const r = spawnSync(process.execPath, [DIM, ...args], {
    cwd: REPO, encoding: 'utf8', env: gateEnv({ TASK_KEY: 'T1', PROJECT_OUTPUT_DIR: base }),
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

const REQUIRED_TWO = { dimensions: { field_validation: 'required', display_conformance: 'required' }, na_reasons: {} };

test.describe('@infra dim:coverage — ngưỡng theo risk band', () => {
  test('band High: chiều bắt buộc có 1/5 case ⇒ CHẶN với --enforce', () => {
    const r = run(task({ a: 9, b: 1, band: 'High', manifest: REQUIRED_TWO }), ['--enforce']);
    expect(r.code, 'đây chính là ca "§12 chỉ 12% mà vẫn PASS" trước đây').toBe(1);
    expect(r.out).toContain('DƯỚI NGƯỠNG');
    expect(r.out).toContain('MỎNG 1/5');
  });

  test('band Low: cùng bộ case đó ⇒ ĐẠT (ngưỡng ≥1, không siết chỗ không cần)', () => {
    const r = run(task({ a: 9, b: 1, band: 'Low', manifest: REQUIRED_TWO }), ['--enforce']);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('band cao nhất của task = Low');
  });

  test('band High + đủ 5 case mỗi chiều ⇒ KHÔNG báo oan', () => {
    const r = run(task({ a: 6, b: 5, band: 'High', manifest: REQUIRED_TWO }), ['--enforce']);
    expect(r.code, r.out).toBe(0);
    expect(r.out).not.toContain('DƯỚI NGƯỠNG');
  });

  test('hạ ngưỡng được, nhưng phải KHAI RÕ trong manifest (không im lặng)', () => {
    const base = task({
      a: 9, b: 1, band: 'High',
      manifest: { dimensions: { field_validation: 'required', display_conformance: { required: true, min: 1 } }, na_reasons: {} },
    });
    const r = run(base, ['--enforce']);
    expect(r.code, 'khai min=1 có chủ đích thì cho qua — nhưng nó nằm trong file, ai cũng đọc được').toBe(0);
  });

  test('% từng chiều + độ lệch phân bố phải in ra (rộng ≠ sâu)', () => {
    const r = run(task({ a: 19, b: 1, band: 'Medium', manifest: REQUIRED_TWO }));
    expect(r.out, 'cột % để không ai phải tự cộng lại').toMatch(/\|\s*95%\s*\|/);
    expect(r.out).toContain('phân bố:');
    expect(r.out, '3 chiều giữ ~100% là lệch') .toContain('LỆCH');
  });

  test('ngưỡng đọc từ risk_model.json, KHÔNG hardcode trong script', () => {
    const src = fs.readFileSync(DIM, 'utf8');
    expect(src).toContain('minCasesPerDimension');
    expect(src, 'phải lấy từ risk_model.json — cùng nguồn với risk_gate').toMatch(/risk_model\.json/);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rm = require(path.join(REPO, '.agent/config/risk_model.json'));
    for (const band of ['High', 'Medium', 'Low', 'UNKNOWN']) {
      expect(rm.depthPolicy[band].minCasesPerDimension, `band ${band} phải khai ngưỡng`).toBeGreaterThan(0);
    }
    expect(rm.depthPolicy.High.minCasesPerDimension).toBeGreaterThan(rm.depthPolicy.Low.minCasesPerDimension);
  });

  test('chưa có risk-register ⇒ dùng band UNKNOWN, vẫn có ngưỡng (không âm thầm thành 0)', () => {
    const base = task({ a: 9, b: 1, band: 'High', manifest: REQUIRED_TWO });
    fs.rmSync(path.join(base, 'tasks', 'T1', 'reports', 'risk-register.json'));
    const r = run(base, ['--enforce']);
    expect(r.out).toContain('band cao nhất của task = UNKNOWN');
    expect(r.code, 'UNKNOWN ⇒ ngưỡng 3, bộ có 1 case ⇒ vẫn chặn').toBe(1);
  });
});

/*
 * PHASE 2 — ba ngưỡng từng để lỏng, nay có số và có máy.
 *   ① khâu sinh CODE automation không có gate (Phase 1 có design_gate, Phase 2 thì không) ⇒ nối lint:locator
 *      vào phase2_02 + điểm-vào, thêm 2 rule: XPath và assertion yếu.
 *   ② "rerun đủ vòng" — taxonomy đã khai `rerun.min=2` nhưng không máy nào đếm ⇒ output_gate đòi `reruns`
 *      ở FAIL tầng product/api (case sắp thành bug Backlog), KHÔNG đòi ở setup/script (chúng đi sửa, không đi Backlog).
 *   ③ mutation `--enforce` từng chặn khi còn 1 mutant sống = ngưỡng NGẦM 100% ⇒ `--min-score` khai được.
 */
test.describe('@infra phase2 — ngưỡng rerun/lint/mutation có số', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const gate = require(path.join(REPO, 'scripts/qa/output_gate.js'));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const TAX = require(path.join(REPO, '.agent/config/verdict_taxonomy.json'));

  const doc = (o: Record<string, unknown>) => ({ taskKey: 'T', tests: [{ tcId: 'TC_1', status: 'FAILED', comment: 'so với BR-X: expected 5, actual 7', evidence: ['a.png'], ...o }] });
  const rerunProblems = (d: unknown) => gate.gateTestExecution(d).problems.filter((p: string) => /rerun/i.test(p));

  test('FAIL tầng product_bug không khai `reruns` ⇒ CHẶN (đây là case sắp thành bug Backlog)', () => {
    expect(rerunProblems(doc({ failureLayer: 'product_bug' })).length).toBeGreaterThan(0);
  });

  test(`rerun dưới ngưỡng taxonomy (${TAX.rerun.min}) ⇒ CHẶN, kèm đúng con số`, () => {
    const p = rerunProblems(doc({ failureLayer: 'product_bug', reruns: 1 }));
    expect(p.length).toBe(1);
    expect(p[0]).toContain(`≥${TAX.rerun.min}`);
  });

  test('rerun đủ ngưỡng ⇒ cho qua', () => {
    expect(rerunProblems(doc({ failureLayer: 'product_bug', reruns: TAX.rerun.min }))).toEqual([]);
  });

  test('setup_failure / script_error KHÔNG bị đòi rerun (không đi Backlog ⇒ siết là báo oan)', () => {
    for (const layer of ['setup_failure', 'script_error', 'infra_flaky']) {
      expect(rerunProblems(doc({ failureLayer: layer })), layer).toEqual([]);
    }
  });

  test('ngưỡng rerun đọc từ verdict_taxonomy, không hardcode trong gate', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/output_gate.js'), 'utf8');
    expect(src).toMatch(/loadTaxonomy\(\)[^;]*rerun/);
    expect(TAX.rerun.min).toBeGreaterThanOrEqual(2);
  });

  test('lint:locator có rule XPath + assertion yếu, và mẫu hợp lệ KHÔNG bị bắt', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RULES } = require(path.join(REPO, 'scripts/qa/locator_lint.js'));
    const re = (id: string) => {
      const r = RULES.find((x: { id: string }) => x.id === id);
      expect(r, `thiếu rule ${id}`).toBeTruthy();
      return r.re as RegExp;
    };
    expect(re('xpath-locator').test("page.locator('//div[@id=\"x\"]')")).toBe(true);
    expect(re('xpath-locator').test("page.locator('.app-btn')"), 'CSS thường KHÔNG phải XPath').toBe(false);
    expect(re('weak-assert').test('expect(await row.textContent()).toBeTruthy()')).toBe(true);
    // 219 chỗ trong tests/fe/infra dùng toBeTruthy() cho giá trị JS thuần — bắt hết là gate chết ngay lần đầu.
    expect(re('weak-assert').test('expect(cfg.enabled).toBeTruthy()'), 'giá trị JS thuần KHÔNG được bắt').toBe(false);
  });

  test('require lint:locator KHÔNG làm CLI chạy (bẫy đã gặp ở mutation_check)', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/locator_lint.js'), 'utf8');
    expect(src).toMatch(/require\.main === module/);
  });

  test('gate code automation được nối vào CẢ workflow lẫn điểm-vào (F3)', () => {
    for (const f of ['.agent/workflows/phase2_02_generate_or_update_automation.md', 'prompt_templates/run_phase2_template.md']) {
      expect(fs.readFileSync(path.join(REPO, f), 'utf8'), f).toContain('lint:locator');
    }
  });

  test('mutation_check có `--min-score` khai được, mặc định 100 (giữ hành vi cũ)', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/mutation_check.js'), 'utf8');
    expect(src).toMatch(/arg\('min-score', '100'\)/);
    expect(src, 'phải so với ngưỡng, không phải "còn mutant sống là chặn"').toMatch(/score < MIN_SCORE/);
  });

  test('self-review nhắc mutation khi có case band HIGH (trigger, không phụ thuộc người nhớ)', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/self_review.js'), 'utf8');
    expect(src).toMatch(/mutation:check/);
    expect(src, 'phải là CẢNH BÁO — mutation cần app sống + catalog, chặn sẽ khoá task backend').toMatch(/warnings\.push\('task có case band HIGH/);
  });
});
