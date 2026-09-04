import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * Test cho nhóm gate MỞ RỘNG 5 TRỤC — tách khỏi `gates.spec.ts` có chủ đích.
 *
 * VÌ SAO TÁCH FILE: bốn khối test này từng nằm trong `gates.spec.ts` và đã bị dọn mất khi file đó được
 * viết lại trong đợt gỡ công cụ test-management cũ (20/08/2026). Code gate thì còn nguyên — nghĩa là gate vẫn chạy nhưng KHÔNG
 * còn gì canh gate, đúng lớp lỗi mà cả kit này sinh ra để chống. Để riêng thì hai luồng sửa song song
 * không giẫm lên nhau.
 *
 * KHÔNG khôi phục khối `TEST_MANAGEMENT_TOOL`: `scripts/integrations/tms.js` và các entrypoint của công cụ cũ đã bị
 * xoá, nên luật "chạy nhầm tool" hết đối tượng — bỏ là ĐÚNG, không phải mất mát.
 */

const REPO = path.resolve(__dirname, '..', '..', '..');
const node = process.execPath;
const run = (args: string[], env: Record<string, string> = {}) => {
  try {
    return { code: 0, out: execFileSync(node, args, { cwd: REPO, encoding: 'utf8', env: gateEnv(env) }) };
  } catch (e: any) {
    return { code: e.status ?? 1, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
};

const TC_HEADER = '| TC ID | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên | Mức độ rủi ro |\n|---|---|---|---|---|---|---|---|---|\n';
const tcRow = (id: string, expected: string) =>
  `| ${id} | M | [Positive] Case tiền | Đăng nhập | - | 1. Mở màn | ${expected} | High | Major |\n`;

/** Task tối thiểu: có 1 case band HIGH (Ưu tiên High) ĐÃ execute. `withPlan` quyết định có artefact kế hoạch. */
function makeExecutedTask(withPlan: boolean) {
  const pod = fs.mkdtempSync(path.join(os.tmpdir(), 'expgate-'));
  const t = path.join(pod, 'tasks', 'T-1');
  fs.mkdirSync(path.join(t, 'test-cases'), { recursive: true });
  fs.mkdirSync(path.join(t, 'test-results'), { recursive: true });
  fs.mkdirSync(path.join(t, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(t, 'test-cases', 'tc.md'), `# fixture\n\n${TC_HEADER}${tcRow('TC_001', '1. Net = 2.500.000')}`, 'utf8');
  fs.writeFileSync(path.join(t, 'test-results', 'testcase-status.json'), JSON.stringify({
    taskKey: 'T-1',
    tests: [{ tcId: 'TC_001', status: 'PASSED', comment: 'Net đúng 2.500.000 theo bảng giá.', evidence: ['a.png'] }],
  }), 'utf8');
  if (withPlan) fs.writeFileSync(path.join(t, 'reports', 'expansion-plan.md'), '# Kế hoạch mở rộng\n', 'utf8');
  return { env: { TASK_KEY: 'T-1', PROJECT_OUTPUT_DIR: pod }, taskDir: t };
}

// ── 1. Bắt buộc CÂN NHẮC mở rộng, không bắt buộc mở đủ trục ───────────────────────────────────────────────
/*
 * Đo 19/08/2026 trên 9 task (1014 case, 382 band high): 7/9 task có 0/5 trục, mà task DUY NHẤT đủ 5/5 lại
 * có 3 báo cáo `proven=0`. Chặn theo "có artefact hay không" ⇒ chỉ dạy nhau chạm file cho có. Nên chặn thứ
 * rẻ mà quyết định được: đã chạy `expansion:plan` để nhìn chi phí rồi chốt phạm vi hay chưa.
 */
test.describe('@infra mở rộng 5 trục — chặn "chưa cân nhắc", không chặn "chưa mở đủ"', () => {
  test('case band HIGH đã execute mà CHƯA có expansion-plan → CHẶN, kèm lệnh gỡ', () => {
    const { env } = makeExecutedTask(false);
    const r = run([path.join(REPO, 'scripts/qa/self_review.js'), '--task', 'T-1'], env);
    expect(r.out).toMatch(/case band HIGH đã execute nhưng CHƯA có/);
    expect(r.out, 'chặn mà không chỉ đường đi tiếp thì chỉ là bức tường').toMatch(/expansion:plan/);
  });

  test('có expansion-plan rồi thì hết chặn — nhưng vẫn NHẮC trục nào chưa soi', () => {
    const { env } = makeExecutedTask(true);
    const r = run([path.join(REPO, 'scripts/qa/self_review.js'), '--task', 'T-1'], env);
    expect(r.out).not.toMatch(/case band HIGH đã execute nhưng CHƯA có/);
    expect(r.out, 'bỏ chặn không có nghĩa là im').toMatch(/CHƯA ai soi/);
  });

  test('expansion_plan.js ghi artefact MẶC ĐỊNH — kế hoạch không để lại dấu vết thì không gate được', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/expansion_plan.js'), 'utf8');
    expect(src).toMatch(/arg\('out'\)\s*\|\|/);
    expect(src).toContain('expansion-plan.md');
  });
});

// ── 2. self-review phải CÓ RĂNG ở bước finalize ───────────────────────────────────────────────────────────
/*
 * Bản mặc định luôn exit 0 (advisory — đúng hợp đồng đã ghi trong tài liệu), còn `output_gate` ở publish
 * KHÔNG kiểm mở rộng. Nếu finalize cũng chỉ đọc báo cáo thì đường lọt bug vẫn nguyên: execute bám đúng chữ
 * trong case → 0 trục → đẩy "toàn PASS" → không gì cản. `--enforce` là chỗ duy nhất có exit code.
 */
test.describe('@infra self-review --enforce — chặn thật, không chỉ in báo cáo', () => {
  test('mặc định vẫn exit 0 — giữ hợp đồng advisory', () => {
    const { env } = makeExecutedTask(false);
    const r = run([path.join(REPO, 'scripts/qa/self_review.js'), '--task', 'T-1'], env);
    expect(r.code, 'bản thường không được chặn').toBe(0);
    expect(r.out).toMatch(/CHẶN/);
  });

  test('--enforce exit ≠ 0 và nêu ĐÍCH DANH gate còn chặn', () => {
    const { env } = makeExecutedTask(false);
    const r = run([path.join(REPO, 'scripts/qa/self_review.js'), '--task', 'T-1', '--enforce'], env);
    expect(r.code, 'còn CHẶN mà vẫn exit 0 thì gate vô nghĩa').not.toBe(0);
    expect(r.out).toMatch(/--enforce: exit 1 vì còn CHẶN ở: \S+/);
  });

  test('điểm vào Phase 2 phải trỏ bản :enforce, không phải bản advisory', () => {
    const tpl = fs.readFileSync(path.join(REPO, 'prompt_templates/run_phase2_template.md'), 'utf8');
    expect(tpl, 'finalize mà dùng bản advisory thì không chặn được gì').toMatch(/self-review:enforce/);
    expect(tpl).toMatch(/expansion:plan/);
  });
});

// ── 3. Luật mở rộng phải đứng ở CẢ HAI cửa ────────────────────────────────────────────────────────────────
/*
 * `self-review --enforce` là bước NGƯỜI/agent tự chạy — bỏ qua nó rồi đẩy thẳng kết quả lên TCM thì trước
 * đây không gì cản (lượt execute SAPP-26523: 3 case, 0/5 trục, mọi gate xanh). Nên luật đứng thêm ở
 * `push_execution_aio` — chỗ có exit code nằm trên đường GHI THẬT.
 */
test.describe('@infra luật mở rộng — chặn ở cả finalize lẫn đường publish', () => {
  test('push_execution_aio CHẶN khi có case band high mà chưa có kế hoạch (chạy offline)', () => {
    const { env, taskDir } = makeExecutedTask(false);
    const r = run([path.join(REPO, 'scripts/integrations/aio/push_execution_aio.js'), '--task', 'T-1', '--task-output', taskDir], env);
    expect(r.code, 'đường publish không chặn thì bỏ qua finalize là lọt').not.toBe(0);
    expect(r.out).toMatch(/GATE MỞ RỘNG/);
    expect(r.out).toMatch(/expansion:plan/);
    expect(r.out, 'phải có đường thoát có chủ ý').toMatch(/--qa-approved/);
  });

  test('có kế hoạch rồi thì gate mở rộng cho qua', () => {
    const { env, taskDir } = makeExecutedTask(true);
    const r = run([path.join(REPO, 'scripts/integrations/aio/push_execution_aio.js'), '--task', 'T-1', '--task-output', taskDir], env);
    expect(r.out).not.toMatch(/GATE MỞ RỘNG/);
  });

  test('MỘT nguồn: cả hai cửa qua plan_guard, không tự tính band', () => {
    for (const f of ['scripts/qa/self_review.js', 'scripts/integrations/aio/push_execution_aio.js']) {
      const src = fs.readFileSync(path.join(REPO, f), 'utf8');
      expect(src, `${f} phải dùng plan_guard`).toMatch(/plan_guard/);
      expect(src, `${f} không được tự gọi bandOf — luật sẽ trôi khỏi nhau`).not.toMatch(/\.bandOf\(/);
    }
  });
});

// ── 4. Chiều coverage mới phải vào CANONICAL, không chỉ đẻ file prompt ────────────────────────────────────
/*
 * Kit đếm độ phủ theo `DIMS` trong dimension_coverage.js. Thêm `dimensions/NN_x.md` mà quên đăng ký thì
 * chiều đó KHÔNG BAO GIỜ được đếm: prompt bảo làm, máy không biết nó tồn tại, báo cáo coverage vẫn xanh.
 */
test.describe('@infra chiều coverage — file prompt và canonical phải khớp nhau', () => {
  const DIM_DIR = path.join(REPO, 'prompt_templates/phase1/dimensions');
  const covSrc = fs.readFileSync(path.join(REPO, 'scripts/qa/dimension_coverage.js'), 'utf8');
  const navSrc = fs.readFileSync(path.join(REPO, 'prompt_templates/phase1/02_gen_testcases.md'), 'utf8');
  const dimFiles = fs.readdirSync(DIM_DIR).filter((f) => /^\d+_.*\.md$/.test(f));
  const secOf = (f: string) => `§${String(f.match(/^(\d+)/)?.[1] ?? '').replace(/^0+/, '')}`;

  test('mỗi file dimensions/ đều được đăng ký trong DIMS', () => {
    const missing = dimFiles.filter((f) => !covSrc.includes(`sec: '${secOf(f)}'`));
    expect(missing, `chưa vào canonical: ${missing.join(', ')} → thêm vào DIMS + TAG_OF`).toEqual([]);
    expect(dimFiles.length).toBeGreaterThanOrEqual(18);
  });

  test('mỗi file dimensions/ đều có trong bảng điều hướng của 02_gen_testcases', () => {
    const missing = dimFiles.filter((f) => !navSrc.includes(`dimensions/${f}`));
    expect(missing, `bảng điều hướng thiếu: ${missing.join(', ')} → agent sẽ không mở file đó`).toEqual([]);
  });

  test('mỗi chiều trong DIMS đều có TAG_OF — thiếu thì case gắn tag vẫn không được tính', () => {
    const ids = [...covSrc.matchAll(/\{ id: '([a-z0-9_]+)', sec:/g)].map((m) => m[1]);   // e2e có CHỮ SỐ
    const tagBlock = covSrc.slice(covSrc.indexOf('const TAG_OF'), covSrc.indexOf('const COVERAGE_TAGS'));
    const missing = ids.filter((id) => !tagBlock.includes(`${id}:`));
    expect(missing, `thiếu TAG_OF: ${missing.join(', ')}`).toEqual([]);
  });

  test('lệnh mà chiều §20 dạy phải TỒN TẠI (dạy lệnh ma là tự tạo lỗ)', () => {
    const md = fs.readFileSync(path.join(DIM_DIR, '20_bug_history.md'), 'utf8');
    expect(md).toMatch(/npm run bugs:checklist/);
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    expect(pkg.scripts['bugs:checklist'], 'prompt dạy lệnh chưa có trong package.json').toBeTruthy();
    expect(fs.existsSync(path.join(REPO, 'scripts/qa/bugs_checklist.js'))).toBe(true);
  });
});

// ── 5. Bộ đọc UI↔API phải thấy được LƯỚI ─────────────────────────────────────────────────────────────────
/*
 * Đo 20/08/2026: `pairsOf()` chỉ nhận khuôn FORM nên trên màn danh sách đọc được ĐÚNG 1 cặp ⇒ mọi phép đối
 * chiếu UI↔API trên lưới bất khả, và mutation_check báo trục ② 0/5 với lý do "không tìm được nhãn UI".
 * Sau khi thêm khuôn lưới + bỏ qua `tr.ant-table-measure-row` (0 ô): 1 → 18 cặp, trục ② 0/5 → 5/5.
 * Theo file tổng hợp bug: 45% lỗi hiển thị + 43% lỗi tiền — phần lớn sống trên lưới.
 */
test.describe('@infra đối chiếu UI↔API — không được mù với lưới', () => {
  const src = fs.readFileSync(path.join(REPO, 'scripts/qa/cross_surface_diff.js'), 'utf8');

  test('pairsOf đọc được cả bảng, không chỉ khuôn form', () => {
    expect(src, 'thiếu nhánh đọc <thead>/<td> ⇒ màn danh sách chỉ ra 1 cặp').toMatch(/thead th/);
    expect(src).toMatch(/tbody tr/);
  });

  test('bỏ qua dòng đo của Ant Design — lấy dòng ĐẦU TIÊN CÓ Ô', () => {
    expect(src, 'lấy `tbody tr` đầu là trúng tr.ant-table-measure-row (0 ô) ⇒ không sinh được cặp nào')
      .toMatch(/find\(\(r\) => r\.querySelectorAll\('td'\)\.length\)/);
  });

  test('mutation_check dùng page MỚI mỗi mutant — dùng lại page thì SPA cache, không gọi API nữa', () => {
    const mut = fs.readFileSync(path.join(REPO, 'scripts/qa/mutation_check.js'), 'utf8');
    expect(mut).toMatch(/ctx\.newPage\(\)/);
    expect(mut, 'context mới sẽ mất cookie ⇒ phải login lại ⇒ dính khoá đăng nhập của OPS')
      .not.toMatch(/launchPersistentContext\([^)]*\)[\s\S]{0,200}for \(const m of mutants\)/);
  });
});

// ── 6. Hai lỗi refactor: biến chưa khai, và gate báo oan task backend ─────────────────────────────────────
/*
 * Cùng một đợt refactor sinh ra hai lỗi khác loại, và cả hai chỉ lộ khi CHẠY THẬT:
 *  - `traceability_matrix.js` dùng `publishedTc`/`published` mà không nơi nào khai ⇒ ReferenceError. Lệnh
 *    này nằm trong bảng gate bắt buộc của run_phase1_template ⇒ nó vỡ là cả bước Phase 1 vỡ theo.
 *  - `self_review` đòi `ui_catalog.json` cho MỌI bộ, không đọc `dimension_manifest.json` ⇒ task backend
 *    thuần (đã khai đúng ui_display/display_conformance = n/a kèm lý do) bị CHẶN ở finalize. Gate báo oan
 *    thì người ta học cách bỏ qua gate — hỏng nặng hơn không có gate.
 */
test.describe('@infra hồi quy: biến chưa khai + gate báo oan', () => {
  test('traceability_matrix không còn định danh chưa khai', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/traceability_matrix.js'), 'utf8');
    // `publishedTc` phải được DỰNG, không chỉ được DÙNG.
    expect(src, 'publishedTc chỉ có chỗ dùng mà không có chỗ khai').toMatch(/loadPublished|const publishedTc\s*=/);
    // Biến tổng phải là publishedCount — bản cũ còn sót `published` trần ngoài scope map().
    const outside = src.split('rows.map(')[1] || '';
    expect(outside.includes('${published}'), 'còn dùng `published` ngoài phạm vi callback').toBe(false);
  });

  test('không có mirror from-aio thì KHÔNG được kết luận "chưa publish"', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/traceability_matrix.js'), 'utf8');
    expect(src, 'phải phân biệt "chưa kéo mirror" với "chưa publish"').toMatch(/knowPublish/);
  });

  test('self_review đọc dimension_manifest để miễn check bề mặt cho task không UI', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/self_review.js'), 'utf8');
    expect(src, 'không đọc manifest thì task backend nào cũng bị chặn oan').toMatch(/dimension_manifest\.json/);
    expect(src).toMatch(/uiNotApplicable/);
    // Miễn phải kèm LÝ DO — nếu không thì gõ đúng hai chữ "n/a" là thoát.
    expect(src).toMatch(/na_reasons/);
  });
});

// ── 7. Cột `Loại case` — trục phân loại RIÊNG, không suy từ nhóm chức năng ────────────────────────────────
/*
 * Đo trên 1.399 case đã publish: 96% rơi về `Functional`, `Integration` và `Performance` = 0 — vì kit SUY
 * case type từ tên nhóm chức năng. Đó là hai trục khác nhau ("test Ở ĐÂU" vs "LOẠI KIỂM THỬ NÀO"), ép cái
 * này ra cái kia thì sai là tất yếu, và hậu quả là lọc/báo cáo theo Case Type trên AIO vô dụng.
 */
test.describe('@infra Loại case — cột người khai, không suy từ nhóm chức năng', () => {
  const model = require(path.join(REPO, 'scripts/lib/testcase'));
  // eslint-disable-next-line global-require
  const CASE_TYPES = require(path.join(REPO, '.agent/config/case_types.json'));

  test('parser đọc được cột Loại case (và các tên gọi tương đương)', () => {
    const head = '| TC ID | Loại case | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên | Mức độ rủi ro |';
    const sep = '|---|---|---|---|---|---|---|---|---|---|';
    const row = '| T1 | Integration | M | [Positive] Đồng bộ HubSpot | - | - | 1. Mở | 1. OK | High | Major |';
    const doc = model.parseMarkdown([head, sep, row].join('\n'));
    expect(doc.tests[0].caseType).toBe('Integration');
  });

  test('giá trị ngoài 9 loại đã chốt thì bị chặn — không để consumer bỏ qua âm thầm', () => {
    const head = '| TC ID | Case Type | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên | Mức độ rủi ro |';
    const sep = '|---|---|---|---|---|---|---|---|---|---|';
    const bad = '| T1 | Smoke | M | [Positive] X | - | - | 1. Mở | 1. OK | High | Major |';
    const doc = model.parseMarkdown([head, sep, bad].join('\n'));
    const v = model.validate(doc);
    expect(v.problems.join(' '), 'giá trị lạ phải bị nêu tên').toMatch(/Loại case.*Smoke/);
  });

  test('publish KHÔNG còn suy case type từ tên nhóm', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/integrations/aio/publish_testcases_aio.js'), 'utf8');
    expect(src, 'còn suy từ group là quay lại đúng chỗ cũ: 96% Functional').not.toMatch(/typeOf\(t\.group/);
    expect(src).toMatch(/caseTypeResolver/);
    // ID phải hỏi AIO, không hardcode con số như bản cũ (4 = API, 6 = Security).
    expect(src).toMatch(/cfg\.caseTypes/);
  });

  test('template sinh case DẠY đủ 9 loại, kèm ĐỊNH NGHĨA và ca "KHÔNG chọn khi"', () => {
    const md = fs.readFileSync(path.join(REPO, 'prompt_templates/phase1/02_gen_testcases.md'), 'utf8');
    expect(md).toMatch(/\| TC ID \| Loại case \|/);
    /*
     * Không chỉ đòi có TÊN loại: tên trần thì agent vẫn phải đoán. Bảng phải mang cả ĐỊNH NGHĨA và
     * mục "KHÔNG chọn khi" — chính hai cột đó tách được các ca chồng lấn ([Display] nhưng lỗi do BE
     * tính sai ⇒ Functional chứ không phải UI). Thiếu chúng thì cột `Loại case` lại thành trường điền bừa.
     */
    for (const t of CASE_TYPES.types) {
      expect(md, `template thiếu loại ${t.name}`).toContain(`\`${t.name}\``);
      expect(md, `template có tên ${t.name} nhưng thiếu định nghĩa`).toContain(t.definition);
      expect(md, `template có tên ${t.name} nhưng thiếu ca "KHÔNG chọn khi"`).toContain(t.not_when);
    }
  });

  test('mọi tag trong case_types.json phải là tag chiều CÓ THẬT của kit', () => {
    /*
     * Bảng loại case gợi ý tag; hệ tag chiều lại có máy kiểm riêng (`dim:coverage`). Nếu bảng dạy một tag
     * mà `TAG_OF` không biết, agent gắn tag đó rồi bị gate chiều loại — bảng và gate đánh nhau, người dùng
     * lãnh đủ. Test này giữ hai bên khớp.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/dimension_coverage.js'), 'utf8');
    const m = src.match(/const TAG_OF = \{([^}]*)\}/);
    expect(m, 'không đọc được TAG_OF — đổi tên biến thì phải sửa test này').toBeTruthy();
    const known = new Set([...m![1].matchAll(/'([a-z0-9]+)'/g)].map((x) => x[1]));
    const missing = CASE_TYPES.types.flatMap((t: any) => t.tags.filter((g: string) => !known.has(g.toLowerCase())).map((g: string) => `${t.name}→[${g}]`));
    expect(missing, `tag không có trong TAG_OF: ${missing.join(', ')}`).toEqual([]);
  });

  test('publisher KHÔNG còn hạ ngầm về Functional khi tên loại không khớp AIO', () => {
    /*
     * Bản cũ in một dòng ⚠ rồi vẫn ghi với `Functional`. Cảnh báo trôi mất trong log của lệnh đẩy hàng
     * trăm case, còn dữ liệu trên AIO sai vĩnh viễn vì AIO không có API xoá. Đúng cơ chế đã làm 14 case
     * `Highest` tụt xuống Medium.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/integrations/aio/publish_testcases_aio.js'), 'utf8');
    expect(src, 'còn hằng số fallback = còn đường hạ ngầm').not.toMatch(/CASE_TYPE_FALLBACK/);
    expect(src, 'phải DỪNG trước vòng ghi').toMatch(/CT\.problem\(\)/);
  });

  test('pull mang Case Type từ AIO về lại Excel — round-trip không mất trục', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/integrations/aio/pull_testcases_aio.js'), 'utf8');
    expect(src).toMatch(/'Loại case'/);
    expect(src).toMatch(/\(c\.type \|\| \{\}\)\.name/);
  });
});

/*
 * @infra — CHIỀU §22 (callback ĐẾN từ bên thứ ba). Thêm 23/08/2026 sau khi ĐO giao thức thật của dự án:
 * GraphQL/WebSocket/SSE/gRPC/SOAP = 0 dấu vết trong `knowledge/`+`tests/`, nên KHÔNG thêm (thêm chỉ phình
 * kit). Nhưng callback thanh toán thì có thật, và đã có bug thật do NGƯỜI phát hiện: callback trùng làm
 * `Paid Amount` cộng đôi (SAPP-28236) — nghĩa là máy lẽ ra phải bắt mà không có chiều nào dạy sinh case đó.
 *
 * Bẫy đã dính khi thêm: khai chiều ở `dimension_coverage.js` là KHÔNG đủ. `dimensionsOf` của model chỉ nhận
 * tag nằm trong `DIMENSION_TAGS`, nên case gắn `[Callback]` vẫn đếm 0 — gate im lặng báo "thiếu chiều" trong
 * khi case có thật. Test dưới khoá cả ba mắt xích: tag parse được · máy đếm được · tài liệu tới được.
 */
test.describe('@infra §22 inbound callback — 3 mắt xích phải khớp', () => {
  const DIMCOV = path.join(REPO, 'scripts/qa/dimension_coverage.js');

  test('tag `[Callback]` được model nhận (khai ở DIMENSION_TAGS, không chỉ ở gate)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const model = require(path.join(REPO, 'scripts/lib/testcase/model.js'));
    expect(model.dimensionsOf('[Callback] Gửi lại callback trùng'), 'thiếu ở DIMENSION_TAGS ⇒ đếm 0 mà không ai biết').toContain('callback');
    expect(model.DIMENSION_TAGS).toContain('callback');
  });

  test('gate coverage biết chiều §22 và map đúng tag', () => {
    const src = fs.readFileSync(DIMCOV, 'utf8');
    expect(src).toContain("id: 'inbound_callback'");
    expect(src, 'TAG_OF thiếu ⇒ chế độ NHÃN không cộng case nào cho §22').toMatch(/inbound_callback: 'callback'/);
  });

  test('file chiều tồn tại, có checklist thật, và neo vào bug đã xảy ra', () => {
    const p = path.join(REPO, 'prompt_templates/phase1/dimensions/22_inbound_callback.md');
    const body = fs.readFileSync(p, 'utf8');
    // Checklist, không phải 5 gạch đầu dòng: mỗi ca phải nói rõ dựng thế nào + oracle đo ở đâu.
    expect(body.split('\n').filter((l) => /^\| \d+ \|/.test(l)).length, 'cần ≥8 ca cụ thể').toBeGreaterThanOrEqual(8);
    for (const must of ['HMAC', 'replay', 'at-least-once', 'SAPP-28236']) expect(body).toContain(must);
    // Không được lấy response callback làm oracle (app==app).
    expect(body).toMatch(/tautology|app==app/);
  });

  test('§22 có trong bảng chỉ mục chiều của prompt gen (nếu không thì không ai mở file)', () => {
    const idx = fs.readFileSync(path.join(REPO, 'prompt_templates/phase1/02_gen_testcases.md'), 'utf8');
    expect(idx).toContain('22_inbound_callback.md');
    expect(idx).toContain('`[Callback]`');
  });

  test('§5 và §9 phải trỏ sang §22 — hai chiều dễ bị tưởng đã phủ', () => {
    for (const f of ['05_api.md', '09_side_effect.md']) {
      const body = fs.readFileSync(path.join(REPO, 'prompt_templates/phase1/dimensions', f), 'utf8');
      expect(body, `${f} không trỏ §22 ⇒ agent đọc nó sẽ tưởng idempotency/webhook đã phủ hết`).toContain('22_inbound_callback.md');
    }
  });
});

/*
 * @infra — CHIỀU §23 (bản ghi dưới DB sau case CRUD). Cùng khuôn kiểm 3 mắt xích như §22, vì đúng bẫy đó đã
 * dính một lần: khai chiều ở `dimension_coverage` mà quên `DIMENSION_TAGS` của model thì case gắn tag vẫn
 * đếm ra 0, và gate báo "thiếu chiều" trong khi case có thật.
 */
test.describe('@infra §23 db persistence — 3 mắt xích + nối pipeline', () => {
  test('tag `[DbPersist]` được model nhận', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const model = require(path.join(REPO, 'scripts/lib/testcase/model.js'));
    expect(model.DIMENSION_TAGS).toContain('dbpersist');
    expect(model.dimensionsOf('[DbPersist] Xoá mềm đúng cột')).toContain('dbpersist');
  });

  test('gate coverage biết §23 và map đúng tag', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/dimension_coverage.js'), 'utf8');
    expect(src).toContain("id: 'db_persistence'");
    expect(src).toMatch(/db_persistence: 'dbpersist'/);
  });

  test('file chiều có checklist thật + 4 ràng buộc chống bug ma', () => {
    const body = fs.readFileSync(path.join(REPO, 'prompt_templates/phase1/dimensions/23_db_persistence.md'), 'utf8');
    expect(body.split('\n').filter((l) => /^\| \d+ \|/.test(l)).length, 'cần ≥7 ca cụ thể').toBeGreaterThanOrEqual(7);
    for (const must of ['tautology', 'fieldMap.byScreen', 'valueMaps', 'RUN_ID', 'KHÔNG phải evidence']) expect(body, `thiếu "${must}"`).toContain(must);
    // Phải nói rõ giới hạn ĐÃ ĐO, không hứa thứ máy không làm được.
    expect(body).toMatch(/audit/i);
    expect(body).toContain('inconclusive');
  });

  test('§23 có trong bảng chỉ mục chiều + Case Type Database có tag', () => {
    expect(fs.readFileSync(path.join(REPO, 'prompt_templates/phase1/02_gen_testcases.md'), 'utf8')).toContain('23_db_persistence.md');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ct = require(path.join(REPO, '.agent/config/case_types.json'));
    const db = (ct.types || []).find((t: { name?: string; type?: string }) => (t.name || t.type) === 'Database');
    expect(db.tags.map((x: string) => x.toLowerCase())).toContain('dbpersist');
  });

  test('nối CẢ workflow lẫn điểm-vào (F3 đòi 2 chặng)', () => {
    expect(fs.readFileSync(path.join(REPO, '.agent/workflows/phase2_02_generate_or_update_automation.md'), 'utf8')).toContain('dbVerify');
    expect(fs.readFileSync(path.join(REPO, 'prompt_templates/run_phase2_template.md'), 'utf8')).toContain('readonly.verify.spec.ts');
  });
});
