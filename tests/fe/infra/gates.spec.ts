import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rules = require('../../../scripts/qa/lib/output_rules.js');

/*
 * Test cho CHÍNH CÁC GATE. Offline: không chạm UAT, không cần creds, không mở browser thật.
 *
 * VÌ SAO CẦN (đo 17/08/2026): 38 script trong `scripts/qa/` mà chỉ 2 xuất hiện trong bất kỳ test nào. Gate gác
 * sản phẩm, nhưng KHÔNG AI GÁC GATE — và gate hỏng âm thầm thì nó báo `✓` trong khi không kiểm gì, tệ hơn
 * không có gate vì người ta tin nó.
 *
 * Không phải giả thuyết. Chỉ trong một ngày, 4 gate mắc đúng lỗi đó:
 *   - check "prompt có đường vào" quét MỘT tầng ⇒ 15 file `dimensions/` chưa từng được kiểm, gate vẫn xanh;
 *   - `Number(x) || 9` làm `--stale-months 0` rơi về 9 âm thầm;
 *   - `dim:coverage` bản đầu định chặn bằng số liệu suy diễn (báo oan);
 *   - `doc_budget` bản đầu khuyên đọc bản FSD thiếu 14/15 tab.
 * Cả 4 chỉ bị bắt vì chọc tay bằng fixture trong scratchpad — mà scratchpad đã bị xoá. File này thay chỗ đó.
 */

const REPO = path.resolve(__dirname, '..', '..', '..');
const node = process.execPath;
const run = (args: string[], env: Record<string, string> = {}) => {
  try {
    return { code: 0, out: execFileSync(node, args, { cwd: REPO, encoding: 'utf8', env: { ...process.env, ...env } }) };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, out: `${err.stdout || ''}${err.stderr || ''}` };
  }
};

const TC_HEADER = '| TC ID | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên | Mức độ rủi ro |\n|---|---|---|---|---|---|---|---|---|\n';
const tcRow = (id: string, module: string, title: string, expected: string) =>
  `| ${id} | ${module} | ${title} | Đăng nhập | - | 1. Mở màn | ${expected} | High | Major |\n`;

/** Task fixture tối thiểu: <pod>/tasks/<task>/{test-cases,requirements}. */
function makeTask(rows: string, opts: { manifest?: unknown; figma?: boolean; uiCatalog?: boolean } = {}) {
  const pod = fs.mkdtempSync(path.join(os.tmpdir(), 'gatepod-'));
  const t = path.join(pod, 'tasks', 'T-1');
  fs.mkdirSync(path.join(t, 'test-cases'), { recursive: true });
  fs.mkdirSync(path.join(t, 'requirements'), { recursive: true });
  fs.writeFileSync(path.join(t, 'test-cases', 'tc.md'), `# fixture\n\n${TC_HEADER}${rows}`, 'utf8');
  if (opts.manifest) fs.writeFileSync(path.join(t, 'requirements', 'dimension_manifest.json'), JSON.stringify(opts.manifest, null, 2), 'utf8');
  if (opts.figma) fs.mkdirSync(path.join(t, 'requirements', 'figma'), { recursive: true });
  if (opts.uiCatalog) fs.writeFileSync(path.join(t, 'requirements', 'ui_catalog.json'), '[]', 'utf8');
  return { pod, env: { TASK_KEY: 'T-1', PROJECT_OUTPUT_DIR: pod } };
}

// ── output_rules.lintTagDepth: hàm THUẦN nên test trực tiếp ───────────────────────────────────────────────
test.describe('@infra Lớp 1 — bằng chứng tối thiểu theo tag chiều', () => {
  // Mỗi dòng: [tag, expected ĐẠT, expected THIẾU]. Bảng này là hợp đồng của luật — đổi luật phải đổi bảng.
  const CASES: Array<[string, string, string]> = [
    ['calc', '1. Net Price = Gross − Discount = 2.500.000', '1. Hệ thống tính đúng Net Price'],
    ['display', '1. Cột: Version ID, Price — đủ cột', '1. Lưới hiển thị đúng'],
    ['guard', '1. API trả 409, order giữ PAID', '1. Bị chặn'],
    ['bedata', '1. Property phi_dich_vu_dong_lan_1 nhận 100000', '1. Map đúng dữ liệu'],
    ['resilience', '1. Gọi lần hai → vẫn đúng 1 transaction', '1. Không bị trùng'],
    ['perf', '1. Thời gian phản hồi < 2s (p95)', '1. Nhanh, không treo'],
    ['validation', '1. Báo "This field is required"', '1. Báo lỗi'],
  ];

  for (const [tag, ok, bad] of CASES) {
    test(`[${tag}] — nhận expected có bằng chứng, bắt expected thiếu`, () => {
      expect(rules.lintTagDepth({ tcId: 'X', dimensions: [tag], expected: ok }), `"${ok}" phải ĐẠT`).toHaveLength(0);
      expect(rules.lintTagDepth({ tcId: 'X', dimensions: [tag], expected: bad }), `"${bad}" phải bị bắt`).toHaveLength(1);
    });
  }

  test('bẫy đánh số đầu dòng: "1." KHÔNG được tính là con số của [calc]', () => {
    // expectedRaw luôn ở dạng "1. …" nên nếu không strip thì MỌI expected đều "có số" ⇒ luật [calc] vô nghĩa.
    expect(rules.lintTagDepth({ dimensions: ['calc'], expected: '1. Hệ thống tính đúng' })).toHaveLength(1);
  });

  test('chiều CHƯA khai luật thì không gác (thà không gác còn hơn báo oan)', () => {
    for (const d of ['ui', 'api', 'e2e', 'export', 'sideeffect', 'design', 'impact']) {
      expect(rules.lintTagDepth({ dimensions: [d], expected: '1. bất kỳ' }), d).toHaveLength(0);
    }
  });

  // Hai luật dưới đây SINH RA TỪ ĐO THỰC ĐỊA (bộ pilot Bảo lưu 20 case): bản đầu báo oan 4/20, và cả 4 đều
  // do hai chỗ này. Giữ test để lần sau không ai "sửa" ngược lại.
  test('[display]: khẳng định RỖNG là oracle hợp lệ, không phải thiếu bằng chứng', () => {
    for (const e of ['1. Refund Amount rỗng (không có giá trị)', '1. Cột công để trống, KHÔNG phải 0', '1. Không hiển thị nút Export']) {
      expect(rules.lintTagDepth({ dimensions: ['display'], expected: e }), e).toHaveLength(0);
    }
    // nhưng vẫn phải bắt câu nói chung chung
    expect(rules.lintTagDepth({ dimensions: ['display'], expected: '1. Hiển thị đúng thông tin' })).toHaveLength(1);
  });

  test('[guard]: nhánh CHO PHÉP và nhánh CHẶN đòi bằng chứng KHÁC nhau', () => {
    const allow = ['positive', 'guard'];
    const deny = ['negative', 'guard'];
    // CHO PHÉP: kết quả cụ thể của đường hợp lệ là đủ — không có 4xx nào để nêu.
    expect(rules.lintTagDepth({ dimensions: allow, expected: '1. Lưu thành công, Total = 800.000' })).toHaveLength(0);
    expect(rules.lintTagDepth({ dimensions: allow, expected: '1. Báo "Delete successfully", status Đã hủy' })).toHaveLength(0);
    // CHO PHÉP nhưng nói trơ → vẫn bắt.
    expect(rules.lintTagDepth({ dimensions: allow, expected: '1. Sửa được bình thường' })).toHaveLength(1);
    // CHẶN: "bị chặn" một mình KHÔNG đủ, phải có mã lỗi hoặc "dữ liệu không đổi".
    expect(rules.lintTagDepth({ dimensions: deny, expected: '1. Bị chặn' })).toHaveLength(1);
    expect(rules.lintTagDepth({ dimensions: deny, expected: '1. Trả 403, order giữ nguyên status' })).toHaveLength(0);
  });

  test('case không có tag chiều nào → im lặng (không phạt bộ TC cũ)', () => {
    expect(rules.lintTagDepth({ dimensions: ['positive'], expected: '1. ok' })).toHaveLength(0);
    expect(rules.lintTagDepth({ dimensions: [], expected: '1. ok' })).toHaveLength(0);
  });
});

// ── output_gate: chuẩn hoá nhãn trạng thái từ Xray/Jira ───────────────────────────────────────────────────
test.describe('@infra canonStatus — nhãn Xray "TO DO" không bị loại oan', () => {
  const statusFile = (st: string) => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gatest-'));
    const f = path.join(d, 's.json');
    fs.writeFileSync(f, JSON.stringify({ taskKey: 'T-1', tests: [{ tcId: 'T_TC_001', status: st, comment: '- ok', evidence: 'a.png' }] }), 'utf8');
    return f;
  };
  const rejected = (st: string) => run(['scripts/qa/output_gate.js', '--status', statusFile(st)]).out.includes('không thuộc verdict taxonomy');

  for (const st of ['TO DO', 'to do', 'To_Do', 'TODO', 'PASSED', 'SKIPPED', 'BLOCKED']) {
    test(`nhận "${st}"`, () => expect(rejected(st), `"${st}" phải được nhận`).toBeFalsy());
  }
  test('vẫn LOẠI giá trị rác (không nới thành nhận mọi thứ)', () => {
    expect(rejected('LUNG TUNG'), 'rác phải bị loại').toBeTruthy();
  });
});

// ── dimension_coverage: 2 chế độ + 2 nhánh TỪ CHỐI CHẶN + đối chiếu artifact ──────────────────────────────
test.describe('@infra dim:coverage — chỉ chặn khi số liệu đáng tin', () => {
  test('chế độ GỢI Ý (chưa có tag): TỪ CHỐI --enforce, exit 2', () => {
    const { env } = makeTask(tcRow('T_TC_001', 'Order / Grid', '[Positive] Lưới hiển thị', '1. ok'));
    const r = run(['scripts/qa/dimension_coverage.js', '--enforce'], env);
    expect(r.code, 'phải exit 2 (từ chối), không phải 1 (chặn)').toBe(2);
    expect(r.out).toContain('TỪ CHỐI --enforce');
  });

  test('có tag nhưng CHƯA có manifest: TỪ CHỐI --enforce (không biết chiều nào bắt buộc)', () => {
    const { env } = makeTask(tcRow('T_TC_001', 'Order / Grid', '[Positive][Display] Lưới đủ cột', '1. Cột: A, B'));
    const r = run(['scripts/qa/dimension_coverage.js', '--enforce'], env);
    expect(r.code).toBe(2);
    expect(r.out).toContain('TỪ CHỐI --enforce');
  });

  test('chế độ NHÃN + manifest: đếm theo tag, thiếu chiều required ⇒ exit 1', () => {
    const { env } = makeTask(
      tcRow('T_TC_001', 'Order / Grid', '[Positive][Display] Lưới đủ cột', '1. Cột: A, B')
      + tcRow('T_TC_002', 'Order / Validate', '[Negative][Validation] Bỏ trống → lỗi', '1. Báo "This field is required"'),
      { manifest: { dimensions: { display_conformance: 'required', field_validation: 'required', security: 'required', perf: 'n/a' }, na_reasons: { perf: 'không có SLA' } } },
    );
    const r = run(['scripts/qa/dimension_coverage.js', '--enforce'], env);
    expect(r.code, 'thiếu security ⇒ chặn').toBe(1);
    expect(r.out).toContain('chế độ NHÃN');
    expect(r.out).toMatch(/Security Coverage/);
    expect(r.out, 'chiều khai n/a có lý do thì không bị kêu').not.toMatch(/perf.*KHÔNG có lý do/);
  });

  test('đủ chiều required ⇒ exit 0', () => {
    const { env } = makeTask(
      tcRow('T_TC_001', 'Order / Grid', '[Positive][Display] Lưới đủ cột', '1. Cột: A, B'),
      { manifest: { dimensions: { display_conformance: 'required' }, na_reasons: {} } },
    );
    expect(run(['scripts/qa/dimension_coverage.js', '--enforce'], env).code).toBe(0);
  });

  test('ARTIFACT thắng manifest: có requirements/figma mà khai design "n/a" ⇒ chặn', () => {
    const { env } = makeTask(
      tcRow('T_TC_001', 'Order / Grid', '[Positive][Display] Lưới đủ cột', '1. Cột: A, B'),
      { manifest: { dimensions: { display_conformance: 'required', design_figma: 'n/a' }, na_reasons: { design_figma: 'nghĩ là không có thiết kế' } }, figma: true },
    );
    const r = run(['scripts/qa/dimension_coverage.js', '--enforce'], env);
    expect(r.code, 'artifact chứng minh chiều áp dụng ⇒ chặn').toBe(1);
    expect(r.out).toContain('XUNG ĐỘT');
  });
});

// ── policy_source_check: chống "scanner quét 0 file mà vẫn báo OK" ────────────────────────────────────────
test.describe('@infra gate:policy — phải THẬT SỰ quét, không no-op', () => {
  test('báo số lượng đã quét, và số đó không được tầm thường', () => {
    const r = run(['scripts/qa/policy_source_check.js']);
    expect(r.code, 'repo hiện tại phải đạt').toBe(0);

    // Đây là bài học đắt nhất: check cũ quét 1 tầng nên BỎ SÓT 15 file mà vẫn in ✓. Nếu tương lai ai đổi
    // bộ đi-file thành quét 0 file, nó sẽ lại in ✓ — trừ khi có test kẹp NGƯỠNG như dưới đây.
    const prompts = r.out.match(/(\d+)\/(\d+) prompt tới được/);
    expect(prompts, 'phải in số prompt đã quét').toBeTruthy();
    expect(Number(prompts![2]), 'quét được ít hơn 20 prompt là dấu hiệu scanner hỏng').toBeGreaterThanOrEqual(20);
    expect(Number(prompts![1]), 'mọi prompt phải tới được').toBe(Number(prompts![2]));

    const scripts = r.out.match(/(\d+) npm script đều có nơi nhắc/);
    expect(scripts, 'phải in số npm script đã kiểm').toBeTruthy();
    expect(Number(scripts![1]), 'ít hơn 50 script là dấu hiệu đọc sai package.json').toBeGreaterThanOrEqual(50);
  });
});

/*
 * CÔNG TẮC TEST-MANAGEMENT-TOOL (Xray → AIO).
 *
 * Vì sao phải có test: hai bộ script ăn CHUNG đầu vào (Excel canonical, `testcase-status.json`), nên gọi
 * nhầm bộ KHÔNG sinh lỗi — nó chạy trót lọt rồi ghi vào sai hệ thống, và AIO thì không có API xoá để lùi.
 * Test chạy trên SCRIPT THẬT, không phải fixture: cửa chặn nằm ngay sau `loadEnv()` nên script dừng trước
 * khi cần creds hay TASK_KEY.
 */
const XRAY_ENTRYPOINTS = [
  'scripts/integrations/jira/publish_testcases.js',
  'scripts/integrations/jira/push_test_execution.js',
  'scripts/integrations/jira/update_xray_steps.js',
  'scripts/integrations/jira/cleanup_xray_tests.js',
  'scripts/integrations/jira/pull_testcases.js',
];

test.describe('@infra TEST_MANAGEMENT_TOOL — chạy nhầm bộ phải bị CHẶN, không im lặng ghi sai chỗ', () => {
  for (const script of XRAY_ENTRYPOINTS) {
    test(`aio → ${path.basename(script)} bị chặn VÀ được chỉ lệnh thay thế`, () => {
      const r = run([path.join(REPO, script), '--dry-run'], { TEST_MANAGEMENT_TOOL: 'aio' });
      expect(r.code, 'phải thoát khác 0').not.toBe(0);
      expect(r.out).toMatch(/CHẶN: TEST_MANAGEMENT_TOOL=aio/);
      // Chặn mà không chỉ đường đi tiếp thì chỉ là bức tường — bắt buộc có dòng "→ Dùng:".
      expect(r.out, 'thiếu lệnh thay thế').toMatch(/→ Dùng: \S+/);
    });
  }

  test('xray (mặc định) KHÔNG bị chặn oan — phải đi tiếp tới lỗi thiếu config bình thường', () => {
    const r = run([path.join(REPO, XRAY_ENTRYPOINTS[1]), '--dry-run'], { TEST_MANAGEMENT_TOOL: 'xray' });
    expect(r.out).not.toMatch(/CHẶN: TEST_MANAGEMENT_TOOL/);
  });

  test('override --test-management-tool xray thắng biến môi trường aio', () => {
    const r = run([path.join(REPO, XRAY_ENTRYPOINTS[1]), '--dry-run', '--test-management-tool', 'xray'], { TEST_MANAGEMENT_TOOL: 'aio' });
    expect(r.out).not.toMatch(/CHẶN: TEST_MANAGEMENT_TOOL/);
  });

  test('giá trị lạ KHÔNG được âm thầm thành xray (đó là đường đẻ issue Jira sai loại)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tms = require(path.join(REPO, 'scripts/integrations/tms.js'));
    const saved = process.env.TEST_MANAGEMENT_TOOL;
    process.env.TEST_MANAGEMENT_TOOL = 'khong-ton-tai';
    try {
      expect(tms.activeTool([])).toBe('jira');
      process.env.TEST_MANAGEMENT_TOOL = 'AIO-Tests';
      expect(tms.activeTool([])).toBe('aio');
    } finally {
      if (saved === undefined) delete process.env.TEST_MANAGEMENT_TOOL; else process.env.TEST_MANAGEMENT_TOOL = saved;
    }
  });
});

/*
 * THƯ MỤC TESTCASE CANONICAL — phải đi qua MỘT nguồn.
 *
 * Bug đã xảy ra khi thêm nguồn `from-aio/`: 7 script tự ghép tay đường dẫn và chỉ biết `from-xray`.
 * `preflight_gate` thì chặn oan ("không thấy testcase canonical") — còn thấy được. Nguy hơn là
 * `dimension_coverage`/`bug_tc_matcher`/`domain_rules`/`system_map`/`learn_task`: KHÔNG lỗi, chỉ đếm
 * thiếu, báo cáo vẫn ra số và trông vẫn đúng. Test này chặn kiểu hardcode đó quay lại.
 */
test.describe('@infra testcase dirs — thêm nguồn mới không được làm script đếm thiếu trong im lặng', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const rt = require(path.resolve(__dirname, '../../../scripts/utils/runtime_config.js'));

  test('helper trả đủ test-cases/ + MỌI bản kéo về', () => {
    const dirs = rt.getTestcaseDirs('/x/task').map((d: string) => d.split(path.sep).join('/'));
    expect(dirs).toContain('/x/task/test-cases');
    for (const m of rt.TESTCASE_MIRROR_DIRS) expect(dirs).toContain(`/x/task/test-cases/${m}`);
    expect(rt.TESTCASE_MIRROR_DIRS).toEqual(expect.arrayContaining(['from-xray', 'from-aio']));
  });

  test('mirrorsFirst đặt bản kéo về TRƯỚC bản người viết', () => {
    const d = rt.getTestcaseDirs('/x/task', { mirrorsFirst: true }).map((s: string) => s.split(path.sep).join('/'));
    expect(d[d.length - 1]).toBe('/x/task/test-cases');
  });

  test('KHÔNG script nào trong scripts/qa/ còn tự ghép đường dẫn "from-xray"', () => {
    const dir = path.join(REPO, 'scripts', 'qa');
    // Chỉ bắt việc GHÉP ĐƯỜNG DẪN, không bắt chữ 'from-xray' trong comment.
    const HARDCODED = new RegExp(String.raw`path\.(join|resolve)\([^)]*['"]from-xray['"]`);
    const offenders: string[] = [];
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.js'))) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      // Chỉ bắt việc GHÉP ĐƯỜNG DẪN (path.join/resolve … 'from-xray'), không bắt chữ trong comment.
      if (HARDCODED.test(src)) offenders.push(f);
    }
    expect(offenders, `còn hardcode: ${offenders.join(', ')} → dùng getTestcaseDirs()`).toEqual([]);
  });
});

/*
 * TAXONOMY ↔ AIO: mọi verdict phải có đường sang trạng thái của AIO.
 *
 * Bug đã xảy ra: `push_execution_aio` dùng bảng hardcode thiếu `PASS_WITH_DEVIATION` và
 * `SUSPECT_REAL_BUG` ⇒ hai verdict này rơi về mặc định "Not Run" — case ĐÃ chạy bị báo là CHƯA chạy,
 * và không có gì kêu lên. Nay ánh xạ đọc từ taxonomy, còn ID trạng thái đọc từ `GET /config` của AIO.
 */
test.describe('@infra verdict taxonomy — mọi verdict phải ánh xạ được sang AIO', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const tax = require(path.resolve(__dirname, '../../../.agent/config/verdict_taxonomy.json'));

  test('mọi status khai cột "aio" (null là CỐ Ý, undefined là bỏ sót)', () => {
    const missing = Object.entries(tax.statuses)
      .filter(([, v]: [string, any]) => !Object.prototype.hasOwnProperty.call(v, 'aio'))
      .map(([k]) => k);
    expect(missing, `thiếu cột aio: ${missing.join(', ')}`).toEqual([]);
    expect(Object.keys(tax.statuses).length).toBeGreaterThan(5);
  });

  test('push_execution_aio KHÔNG hardcode ID trạng thái — phải hỏi AIO', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/integrations/aio/push_execution_aio.js'), 'utf8');
    const HARDCODE = new RegExp(String.raw`(PASSED|FAILED|BLOCKED|TODO)\s*:\s*[1-5]\b`);
    expect(HARDCODE.test(src), 'lại xuất hiện bảng ID hardcode → dùng verdict_taxonomy + GET /config').toBe(false);
    expect(src).toContain("'/config'");
  });
});

/*
 * CHECK #10 — CHẶN "chưa cân nhắc mở rộng", KHÔNG chặn "chưa mở đủ trục".
 *
 * Vì sao đúng chỗ này: đo 19/08/2026 trên 9 task (1014 case, 382 band high) — 7/9 task có 0/5 trục, và task
 * DUY NHẤT đủ 5/5 lại có 3 báo cáo `proven=0`. Chặn theo "có artefact hay không" ⇒ dạy cả hệ thống chạm vào
 * file cho có. Nên chỉ chặn thứ rẻ mà quyết định được: đã chạy `expansion:plan` (đọc Excel, vài giây) để
 * nhìn chi phí rồi chốt phạm vi hay chưa. `npm run expansion:audit` đo lại con số này bất cứ lúc nào.
 */
test.describe('@infra check #10 — kế hoạch mở rộng là bắt buộc, mở đủ trục thì chưa', () => {
  const runSelfReview = (env: Record<string, string>) =>
    run([path.join(REPO, 'scripts/qa/self_review.js'), '--task', 'T-1'], env);

  /** Fixture: task có case band HIGH đã execute (Ưu tiên High ⇒ band high). */
  function execTask(withPlan: boolean) {
    const { pod, env } = makeTask(tcRow('TC_001', 'M', 'Case tiền', '1. Net = 2.500.000'));
    const t = path.join(pod, 'tasks', 'T-1');
    fs.mkdirSync(path.join(t, 'test-results'), { recursive: true });
    fs.mkdirSync(path.join(t, 'reports'), { recursive: true });
    fs.writeFileSync(path.join(t, 'test-results', 'testcase-status.json'), JSON.stringify({
      taskKey: 'T-1',
      tests: [{ tcId: 'TC_001', status: 'PASSED', comment: 'Net đúng 2.500.000 theo bảng giá.', evidence: ['a.png'] }],
    }), 'utf8');
    if (withPlan) fs.writeFileSync(path.join(t, 'reports', 'expansion-plan.md'), '# Kế hoạch mở rộng\n', 'utf8');
    return env;
  }

  test('case band HIGH đã execute mà CHƯA có expansion-plan → CHẶN', () => {
    const r = runSelfReview(execTask(false));
    expect(r.out).toMatch(/case band HIGH đã execute nhưng CHƯA có/);
    expect(r.out, 'phải chỉ đúng lệnh chạy, không chỉ mắng').toMatch(/expansion:plan/);
  });

  test('có expansion-plan rồi thì HẾT chặn — dù 0/5 trục vẫn chỉ cảnh báo', () => {
    const r = runSelfReview(execTask(true));
    expect(r.out).not.toMatch(/case band HIGH đã execute nhưng CHƯA có/);
    // Vẫn phải NHẮC là chưa trục nào chạy — bỏ chặn không có nghĩa là im.
    expect(r.out).toMatch(/CHƯA ai soi/);
  });

  test('expansion_plan.js ghi artefact MẶC ĐỊNH, không cần --out', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/expansion_plan.js'), 'utf8');
    // Kế hoạch không để lại dấu vết thì không gate được — đó là lý do 0/9 task từng có artefact.
    expect(src).toMatch(/arg\('out'\)\s*\|\|/);
    expect(src).toContain('expansion-plan.md');
  });

  test('proven=0 ở báo cáo TRỤC là CHẶN, nhưng chỉ trong phạm vi 4 trục', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/self_review.js'), 'utf8');
    expect(src).toMatch(/proven === 0\) problems\.push/);
    // Nới glob sang expansion-findings/mutation-check là chặn oan lượt soi SẠCH (proven=0 = không thấy gì).
    expect(src).not.toMatch(/expansion-findings\|mutation-check/);
  });
});

/*
 * self-review phải CÓ RĂNG ở bước finalize.
 *
 * Bản mặc định luôn exit 0 (advisory, đúng hợp đồng đã ghi trong tài liệu) — nhưng `output_gate` ở publish
 * KHÔNG kiểm mở rộng 5 trục, nên nếu finalize cũng chỉ đọc báo cáo thì đường lọt bug vẫn nguyên: execute
 * bám đúng chữ trong case → 0 trục → đẩy "toàn PASS" → không gì cản. `--enforce` là chỗ duy nhất có exit code.
 */
test.describe('@infra self-review --enforce — chặn thật, không chỉ in báo cáo', () => {
  function taskWithBlock() {
    const { pod, env } = makeTask(tcRow('TC_001', 'M', 'Case tiền', '1. Net = 2.500.000'));
    const t = path.join(pod, 'tasks', 'T-1');
    fs.mkdirSync(path.join(t, 'test-results'), { recursive: true });
    fs.mkdirSync(path.join(t, 'reports'), { recursive: true });
    // case band HIGH đã execute + KHÔNG có expansion-plan ⇒ chắc chắn có ít nhất 1 khối CHẶN
    fs.writeFileSync(path.join(t, 'test-results', 'testcase-status.json'), JSON.stringify({
      taskKey: 'T-1',
      tests: [{ tcId: 'TC_001', status: 'PASSED', comment: 'Net đúng 2.500.000 theo bảng giá.', evidence: ['a.png'] }],
    }), 'utf8');
    return env;
  }

  test('mặc định vẫn exit 0 — giữ hợp đồng advisory', () => {
    const r = run([path.join(REPO, 'scripts/qa/self_review.js'), '--task', 'T-1'], taskWithBlock());
    expect(r.code, 'bản thường không được chặn').toBe(0);
    expect(r.out).toMatch(/CHẶN/);
  });

  test('--enforce exit ≠ 0 và nêu ĐÍCH DANH gate còn chặn', () => {
    const r = run([path.join(REPO, 'scripts/qa/self_review.js'), '--task', 'T-1', '--enforce'], taskWithBlock());
    expect(r.code, 'còn CHẶN mà vẫn exit 0 thì gate vô nghĩa').not.toBe(0);
    expect(r.out, 'chặn thì phải nói chặn ở đâu').toMatch(/--enforce: exit 1 vì còn CHẶN ở: \S+/);
  });

  test('điểm vào Phase 2 phải trỏ bản :enforce, không phải bản advisory', () => {
    const tpl = fs.readFileSync(path.join(REPO, 'prompt_templates/run_phase2_template.md'), 'utf8');
    expect(tpl, 'finalize mà dùng bản advisory thì không chặn được gì').toMatch(/self-review:enforce/);
    expect(tpl).toMatch(/expansion:plan/);
  });
});

/*
 * LUẬT MỞ RỘNG PHẢI ĐỨNG Ở CẢ HAI CỬA.
 *
 * `self-review --enforce` là bước NGƯỜI/agent tự chạy — bỏ qua nó rồi đẩy thẳng kết quả lên TCM thì
 * trước đây không gì cản (lượt SAPP-26523: 3 case, 0/5 trục, mọi gate xanh). Nên luật đứng thêm ở
 * `push_execution_aio` — chỗ có exit code nằm trên đường GHI THẬT. Cả hai đọc chung
 * `scripts/lib/expansion/plan_guard.js`; chép logic sang cửa thứ hai là mời drift.
 */
test.describe('@infra luật mở rộng — chặn ở cả finalize lẫn đường publish', () => {
  function taskNoPlan() {
    const { pod, env } = makeTask(tcRow('TC_001', 'M', 'Case tiền', '1. Net = 2.500.000'));
    const t = path.join(pod, 'tasks', 'T-1');
    fs.mkdirSync(path.join(t, 'test-results'), { recursive: true });
    fs.mkdirSync(path.join(t, 'reports'), { recursive: true });
    fs.writeFileSync(path.join(t, 'test-results', 'testcase-status.json'), JSON.stringify({
      taskKey: 'T-1',
      tests: [{ tcId: 'TC_001', status: 'PASSED', comment: 'Net đúng 2.500.000 theo bảng giá.', evidence: ['a.png'] }],
    }), 'utf8');
    return { env, taskDir: t };
  }

  test('push_execution_aio CHẶN khi có case band high mà chưa có kế hoạch (chạy offline, trước khi gọi API)', () => {
    const { env, taskDir } = taskNoPlan();
    const r = run([path.join(REPO, 'scripts/integrations/aio/push_execution_aio.js'), '--task', 'T-1', '--task-output', taskDir], env);
    expect(r.code, 'đường publish mà không chặn thì bỏ qua finalize là lọt').not.toBe(0);
    expect(r.out).toMatch(/GATE MỞ RỘNG/);
    expect(r.out, 'chặn thì phải chỉ lệnh gỡ').toMatch(/expansion:plan/);
    expect(r.out, 'phải có đường thoát có chủ ý').toMatch(/--qa-approved/);
  });

  test('có kế hoạch rồi thì gate mở rộng cho qua', () => {
    const { env, taskDir } = taskNoPlan();
    fs.writeFileSync(path.join(taskDir, 'reports', 'expansion-plan.md'), '# Kế hoạch\n', 'utf8');
    const r = run([path.join(REPO, 'scripts/integrations/aio/push_execution_aio.js'), '--task', 'T-1', '--task-output', taskDir], env);
    expect(r.out).not.toMatch(/GATE MỞ RỘNG/);
  });

  test('MỘT nguồn: cả hai cửa đều qua plan_guard, không tự tính band', () => {
    for (const f of ['scripts/qa/self_review.js', 'scripts/integrations/aio/push_execution_aio.js']) {
      const src = fs.readFileSync(path.join(REPO, f), 'utf8');
      expect(src, `${f} phải dùng plan_guard`).toMatch(/plan_guard/);
      expect(src, `${f} không được tự gọi bandOf — luật sẽ trôi khỏi nhau`).not.toMatch(/\.bandOf\(/);
    }
  });
});
