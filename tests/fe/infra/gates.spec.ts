import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { gateEnv } from './_gate_env';

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
    return { code: 0, out: execFileSync(node, args, { cwd: REPO, encoding: 'utf8', env: gateEnv(env) }) };
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

  /*
   * TÊN CỘT VIẾT HOA cũng là tên field. Luật cũ dò `/[a-z][a-z0-9]*_[a-z0-9_]{2,}/` — chỉ chữ thường,
   * mà CẢ schema của hệ thống này viết HOA (`MA_NAM_HOC`, `API_MA_BO`, `NHAN_SU`). Đo 30/09/2026:
   * `CSDL_NHANSU_TC_259` nêu đích danh cột `API_MA_BO` ngay trong Kết quả mong đợi mà vẫn bị báo
   * "thiếu tên field" — gate đòi thứ case đã có, chỉ vì không đọc được chữ hoa.
   */
  test('[bedata] — tên cột viết HOA cũng tính là tên field', () => {
    expect(
      rules.lintTagDepth({ dimensions: ['bedata'], expected: '1. Phản hồi mang cột API_MA_BO gồm 10 chữ số' }),
      'API_MA_BO là tên cột cụ thể, soi lại được — không được đòi thêm',
    ).toHaveLength(0);
  });

  test('[bedata] — trích MỘT TC ID khác KHÔNG phải là nêu tên field', () => {
    // Nới sang chữ hoa kéo theo dương tính giả: "CSDL_HS_TC_062" cũng có dạng snake_case.
    expect(
      rules.lintTagDepth({ dimensions: ['bedata'], expected: '1. Kết quả giống CSDL_HS_TC_062 đã ghi nhận' }),
      'nhắc TC khác không cho biết trường nào đang được kiểm',
    ).toHaveLength(1);
  });

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

// ── output_rules.lintStrayAnomaly: ranh giới từ phải tính theo chữ cái Unicode ────────────────────────
test.describe('@infra lintStrayAnomaly — không bắt oan chữ tiếng Việt', () => {
  /*
   * VÌ SAO (đo 06/10/2026): luật dùng `\bnghi\b`, mà `\b` của JavaScript tính theo ASCII — ranh giới rơi
   * đúng giữa "i" và "ệ", nên nó KHỚP VÀO chữ "nghiệp". Mọi case trích nhãn thật trên form GDTX
   * "Hướng nghiệp, dạy nghề" đều bị chặn với lý do "PASS mà có ghi nhận bất thường", trong khi kết luận
   * không có một chữ nghi ngờ nào. Gác nhầm kiểu này đẩy người viết tới chỗ sửa chữ TRÍCH DẪN cho lọt
   * gate — tức là làm sai evidence, đúng thứ mà gate sinh ra để chặn.
   */
  const batOan = ['Hướng nghiệp, dạy nghề | Bán trú | Giải thể', 'nghiệp vụ chạy đúng như đặc tả', 'lớp hướng nghiệp'];
  for (const c of batOan) {
    test(`không bắt: ${c.slice(0, 32)}`, () => {
      expect(rules.lintStrayAnomaly({ status: 'PASSED', comment: c })).toBeNull();
    });
  }

  /* Vẫn phải bắt được anomaly thật — nới luật không được làm luật mất tác dụng. */
  const batThat = ['tôi nghi ngờ chỗ này sai', 'có vẻ chưa đúng với đặc tả', 'chưa rõ vì sao app cho qua'];
  for (const c of batThat) {
    test(`vẫn bắt: ${c.slice(0, 32)}`, () => {
      expect(rules.lintStrayAnomaly({ status: 'PASSED', comment: c })).not.toBeNull();
    });
  }

  test('anomaly thật nhưng đã có nơi đến thì thôi bắt', () => {
    expect(rules.lintStrayAnomaly({ status: 'PASSED', comment: 'nghi ngờ thiếu cấu hình — đã hỏi BA' })).toBeNull();
  });

  test('chỉ xét case PASS', () => {
    expect(rules.lintStrayAnomaly({ status: 'FAILED', comment: 'có vẻ chưa đúng' })).toBeNull();
  });
});

// ── output_gate: chuẩn hoá nhãn trạng thái người-đọc-được ─────────────────────────────────────────────
test.describe('@infra canonStatus — nhãn "TO DO" (biến thể cũ) không bị loại oan', () => {
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

  test('đủ chiều required + ngưỡng đã khai ⇒ exit 0', () => {
    // Từ 23/08/2026 độ phủ có NGƯỠNG (depthPolicy.minCasesPerDimension): "có 1 case" không còn tự động đạt.
    // Task 1 case mà muốn qua thì phải khai min có chủ đích — đúng tinh thần "hạ ngưỡng được, nhưng phải viết ra".
    const { env } = makeTask(
      tcRow('T_TC_001', 'Order / Grid', '[Positive][Display] Lưới đủ cột', '1. Cột: A, B'),
      { manifest: { dimensions: { display_conformance: { required: true, min: 1 } }, na_reasons: {} } },
    );
    expect(run(['scripts/qa/dimension_coverage.js', '--enforce'], env).code).toBe(0);
  });

  test('§23 đếm ĐÚNG theo tag [DbPersist] — khoá HÀNH VI, không chỉ khoá văn bản', () => {
    /*
     * Vì sao có test này: `dimension_coverage.js` từng bị shell/heredoc biến word-boundary (\\b) trong regex §23 thành ký tự
     * 0x08, nên luật nhận `deleted_at` HỎNG ÂM THẦM. Gate quét-ký-tự-lạ bắt được triệu chứng, nhưng nếu chỉ
     * xoá ký tự lạ thì regex mất word-boundary mà mọi gate vẫn xanh — hỏng về NGHĨA, không ai biết. Nên phải
     * có một phép kiểm chạy CLI thật và xem con số đếm, chứ không đọc file dưới dạng chuỗi.
     */
    const { env } = makeTask(
      tcRow('T_TC_001', 'Order / Delete', '[Negative][DbPersist] Xoá đơn → deleted_at được set', '1. Bản ghi còn, deleted_at IS NOT NULL')
      + tcRow('T_TC_002', 'Order / Delete', '[Negative][DbPersist] Xoá đơn con → bảng nối không còn hàng', '1. expectCount(...) = 0'),
      { manifest: { dimensions: { db_persistence: { required: true, min: 2 } }, na_reasons: {} } },
    );
    const r = run(['scripts/qa/dimension_coverage.js', '--enforce'], env);
    expect(r.out, 'phải đếm được chiều §23').toMatch(/DB Persistence/);
    expect(r.code, `§23 đủ 2 case mà vẫn chặn:
${r.out}`).toBe(0);
  });

  test('§23 thiếu case ⇒ VẪN chặn (kiểm-âm: test trên không xanh vì gate bị vô hiệu)', () => {
    const { env } = makeTask(
      tcRow('T_TC_001', 'Order / Delete', '[Negative][DbPersist] Xoá đơn → deleted_at được set', '1. deleted_at IS NOT NULL'),
      { manifest: { dimensions: { db_persistence: { required: true, min: 2 } }, na_reasons: {} } },
    );
    const r = run(['scripts/qa/dimension_coverage.js', '--enforce'], env);
    expect(r.code, 'mới 1/2 case mà không chặn ⇒ ngưỡng không có tác dụng').toBe(1);
    expect(r.out).toMatch(/MỎNG 1\/2|DB Persistence/);
  });

  test('chiều required chỉ 1 case mà KHÔNG khai ngưỡng ⇒ CHẶN (phủ hình thức)', () => {
    const { env } = makeTask(
      tcRow('T_TC_001', 'Order / Grid', '[Positive][Display] Lưới đủ cột', '1. Cột: A, B'),
      { manifest: { dimensions: { display_conformance: 'required' }, na_reasons: {} } },
    );
    const r = run(['scripts/qa/dimension_coverage.js', '--enforce'], env);
    expect(r.code, 'band UNKNOWN ⇒ ngưỡng 3; 1 case là MỎNG').toBe(1);
    expect(r.out).toContain('DƯỚI NGƯỠNG');
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
 * NO-LEGACY-TOOLS (gate:policy): không bề mặt nào của kit được nhắc Xray/Jira/Confluence/AIO Tests.
 *
 * Vì sao khoá bằng test: luật này là thứ giữ cho việc "bỏ hẳn" không bị trôi lại từng dòng một. Bản
 * trước còn cửa thoát `legacy`, và chính cửa đó để sót 12 chỗ dạy lệnh đã bị xoá. Nay cấm tuyệt đối,
 * nên phải chứng minh: repo thật sạch, VÀ luật thực sự bắt được khi có người viết lại.
 */
test.describe('@infra gate:policy — NO-LEGACY-TOOLS', () => {
  const GATE = path.join(REPO, 'scripts/qa/policy_source_check.js');
  const LF = String.fromCharCode(10);

  test('repo thật: không bề mặt nào của kit nhắc công cụ cũ', () => {
    const r = run([GATE]);
    expect(r.out).toContain('NO-LEGACY-TOOLS sạch');
    expect(r.code, 'gate:policy phải xanh trên repo thật').toBe(0);
  });

  test('luật CÓ RĂNG: một dòng nhắc lại công cụ cũ là CHẶN (không có cửa legacy)', () => {
    // File thật trong root đang được quét, xoá ngay trong finally — gate đọc đĩa, fixture trong RAM vô dụng.
    const tmp = path.join(REPO, 'partial-rerun', '_noxray_probe.md');
    fs.writeFileSync(tmp, ['# probe', '', 'Đường LEGACY: chạy Xray như trước.'].join(LF) + LF);
    try {
      const r = run([GATE]);
      expect(r.code, 'phải chặn').not.toBe(0);
      expect(r.out).toContain('_noxray_probe.md');
      expect(r.out).toContain('NO-LEGACY-TOOLS');
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  test('lịch sử KHÔNG bị soi: CHANGELOG/outputs là biên bản việc đã làm', () => {
    // CHANGELOG có hàng chục chỗ nhắc công cụ cũ (đó là lịch sử di trú) — gate vẫn phải xanh.
    const changelog = fs.readFileSync(path.join(REPO, 'CHANGELOG.md'), 'utf8');
    expect(/xray/i.test(changelog), 'CHANGELOG phải còn dấu vết lịch sử để test này có nghĩa').toBe(true);
    expect(run([GATE]).code).toBe(0);
  });
});

/*
 * @infra F12 — CÂN BẰNG GIỮA CÁC NHÁNH (`branch_parity`).
 *
 * Vì sao có: mẫu hình lặp 5 lần trong đợt rà 23/08/2026 — kit xây cơ chế tốt nhưng NỐI KHÔNG ĐỀU. 7 gate
 * mạnh nhất chỉ là npm script · `knowledge:backup` không ai gọi · khâu sinh code Phase 2 không gate · nhánh
 * rerun 0 gate máy dù nó là nhánh TRỰC TIẾP chuyển bug sang Done. Cả 5 lần đều do người ngoài chỉ ra, vì
 * không phép đo nào trả lời "cơ chế nào đã có mà chưa dùng ở nhánh cần nó". Nay câu đó là một phép đo.
 */
test.describe('@infra branch parity — cơ chế đã có phải dùng ở MỌI nhánh cần nó', () => {
  const CFG = path.join(REPO, '.agent/config/branch_parity.json');

  test('config khai đủ: máy nào cũng có `why`, miễn trừ nào cũng có lý do', () => {
    const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
    expect(Object.keys(cfg.branches)).toEqual(expect.arrayContaining(['phase1', 'phase2', 'rerun']));
    for (const [name, spec] of Object.entries<Record<string, never>>(cfg.machines)) {
      expect(String((spec as { why?: string }).why || ''), `${name} thiếu \`why\``).not.toBe('');
      const applies = (spec as { applies?: string[] }).applies || [];
      const waived = (spec as { waived?: Record<string, string> }).waived || {};
      expect(applies.length, `${name} không áp dụng cho nhánh nào ⇒ khai để làm gì`).toBeGreaterThan(0);
      for (const [b, why] of Object.entries(waived)) {
        expect(String(why || '').trim(), `${name} miễn trừ ${b} mà không có lý do`).not.toBe('');
        expect(applies, `${name}: ${b} vừa applies vừa waived`).not.toContain(b);
      }
      // Mỗi nhánh phải được QUYẾT: hoặc applies, hoặc waived có lý do. Không được bỏ lửng.
      for (const b of Object.keys(cfg.branches)) {
        expect(applies.includes(b) || Object.keys(waived).includes(b), `${name}: nhánh ${b} chưa được quyết (không applies, không waived)`).toBe(true);
      }
    }
  });

  test('nhánh rerun PHẢI có output_gate + expansion + bugs:checklist (nhánh đóng bug, hậu quả cao nhất)', () => {
    const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
    for (const m of ['output_gate.js', 'expansion:plan', 'bugs:checklist']) {
      expect(cfg.machines[m].applies, `${m} phải áp cho rerun`).toContain('rerun');
    }
    const text = cfg.branches.rerun.map((rel: string) => {
      const abs = path.join(REPO, rel);
      if (!fs.existsSync(abs)) return '';
      return fs.statSync(abs).isDirectory()
        ? fs.readdirSync(abs).map((f) => fs.readFileSync(path.join(abs, f), 'utf8')).join('\n')
        : fs.readFileSync(abs, 'utf8');
    }).join('\n');
    for (const m of ['output_gate.js', 'expansion:plan', 'bugs:checklist']) expect(text, `rerun chưa nhắc ${m}`).toContain(m);
  });

  test('MỌI nhánh của kit phải có trong config — F12 ban đầu bỏ sót partial-rerun', () => {
    /*
     * Lỗi một tầng cao hơn: phép đo bỏ sót chính đối tượng cần đo. F12 lúc mới viết chỉ khai 3 nhánh
     * (phase1/phase2/rerun) nên KHÔNG thể bắt được chuyện `partial-rerun` — nhánh chuyên xử lý
     * "requirement đổi" — lại là nhánh duy nhất không cập nhật kho tri thức về requirement.
     * Test này khoá: có thư mục/điểm-vào của một nhánh thì nhánh đó phải nằm trong config.
     */
    const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
    const known = Object.keys(cfg.branches);
    expect(known, 'thiếu nhánh nào là F12 mù nhánh đó').toEqual(expect.arrayContaining(['phase1', 'phase2', 'rerun', 'partial-rerun']));
    // Điểm-vào `run_*` nào tồn tại trên đĩa cũng phải được một nhánh nào đó trỏ tới.
    const declared = Object.values<string[]>(cfg.branches).flat().join(' ');
    const entries = fs.readdirSync(path.join(REPO, 'prompt_templates')).filter((f) => /^run_.*\.md$/.test(f));
    for (const e of entries) expect(declared, `điểm-vào ${e} chưa thuộc nhánh nào trong branch_parity`).toContain(e);
  });

  test('nhánh partial-rerun PHẢI phiên bản hoá oracle + có gate nội dung', () => {
    const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
    for (const m of ['domain:check', 'design:gate', 'dim:coverage']) {
      expect(cfg.machines[m].applies, `${m} phải áp cho partial-rerun`).toContain('partial-rerun');
    }
    const body = fs.readFileSync(path.join(REPO, 'partial-rerun/run_requirement_apply_approved.md'), 'utf8');
    // Phiên bản hoá, không sửa tại chỗ: mất khả năng trả lời "hôm đó case PASS theo rule nào".
    for (const must of ['supersedes', 'confirmed_at', '--stale', 'superseded']) expect(body, `apply_approved thiếu "${must}"`).toContain(must);
    expect(body, 'gate nội dung cho phần vừa merge').toMatch(/design:gate/);
  });

  test('gate CÓ RĂNG: gỡ 1 máy khỏi nhánh applies ⇒ gate:policy đỏ', () => {
    // Chạy gate trên bản config đã bẻ (trỏ nhánh rerun sang thư mục rỗng) — không sửa file thật.
    const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
    cfg.branches.rerun = ['.gitignore'];   // file KHÔNG nhắc output_gate.js (branch_parity.json tự chứa tên máy)
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-'));
    const bak = fs.readFileSync(CFG, 'utf8');
    try {
      fs.writeFileSync(CFG, JSON.stringify(cfg, null, 2));
      let out = '';
      let code = 0;
      try { out = execFileSync(process.execPath, [path.join(REPO, 'scripts/qa/policy_source_check.js')], { cwd: REPO, encoding: 'utf8' }); }
      catch (e) { code = 1; out = `${(e as { stdout?: string }).stdout || ''}${(e as { stderr?: string }).stderr || ''}`; }
      expect(code, 'phải đỏ').toBe(1);
      expect(out).toContain('branch_parity');
    } finally {
      fs.writeFileSync(CFG, bak);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
