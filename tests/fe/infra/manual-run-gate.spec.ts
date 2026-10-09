import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

/*
 * @infra — NHÁNH `manual-run/`: lượt chạy tay của case `Manual-only` (H6).
 *
 * Lỗ hổng nhánh này đóng: kit biết đánh dấu case không tự động hoá được (`[manual]` → Readiness
 * `Manual-only` → Phase 2 ghi `SKIP_SETUP`) rồi DỪNG. Case tồn tại, không ai chạy, và báo cáo in
 * `SKIP_SETUP` như thể đó là kết luận. `SKIP_SETUP` là lời khai "chưa chạy".
 *
 * BA THỨ ĐƯỢC KHOÁ Ở ĐÂY:
 *   ① RANH GIỚI `[manual]`. Không có cửa này thì nhánh chạy tay thành ĐƯỜNG LÁCH: case nào viết
 *      automation khó thì đẩy sang chạy tay, coverage automation tụt mà không ai thấy. Đây là lý do
 *      nhánh này cần máy, không phải chuyện tiện tay.
 *   ② ỦY QUYỀN, không viết luật thứ hai. Evidence cho mọi case kể cả PASS, verdict trong taxonomy, FAIL
 *      phân tầng — đã có `output_gate --mode test-execution`. Test dưới chứng minh gate này GỌI máy đó
 *      chứ không chép luật sang.
 *   ③ NỐI ĐỦ BỀ MẶT. `manual-run` phải có trong `SURFACE_DIRS` của `gate_index` và trong
 *      `branch_parity.json`. Thiếu chỗ đầu thì gate mới bị in ra như mồ côi; thiếu chỗ sau thì một nhánh
 *      SINH VERDICT không được đo độ đều — đúng mẫu hình mà `branch_parity.json` được dựng để bắt.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mr = require(path.join(REPO, 'scripts/qa/manual_run_check.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PARITY = require(path.join(REPO, '.agent/config/branch_parity.json'));

const RUN_DOC = path.join(REPO, 'manual-run/run_manual_execution.md');
const REF_DOC = path.join(REPO, 'manual-run/reference.md');

const HEAD = [
  '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |',
  '|---|---|---|---|---|---|---|---|---|---|',
].join('\n');

const row = (id: string, method: string) =>
  `| ${id} | Functional | [Positive][Validation] | M/validate | ${id} nhập captcha đúng | [${method}] Đã mở màn đăng nhập | mã trên ảnh | 1. Nhập mã rồi Ghi | 1. Vào màn Danh sách | High |`;

const SESSION_OK = [
  '# Lượt chạy tay — T-1',
  '',
  '- Người chạy: Nguyễn Văn A',
  '- Ngày: 09/10/2026',
  '- Môi trường: UAT, https://uat.example.gov.vn',
  '- Build / Version: 2026.10.08-rc2',
  '',
].join('\n');

type Tc = { tcId: string; status: string; comment?: string; evidence?: string[] };

const tcOk = (id: string): Tc => ({
  tcId: id,
  status: 'PASS',
  comment: 'Nhập mã captcha đúng, vào được màn Danh sách học sinh.',
  evidence: [`test-results/artifacts/${id}-step1.png`],
});

/** Dựng task tạm: bộ TC canonical + manual-run/session.md + testcase-status.json. */
function dungTask(o: {
  cases?: [string, string][]; status?: Tc[] | null; session?: string | null; coThuMuc?: boolean;
} = {}) {
  const cases = o.cases ?? [['T_TC_001', 'manual']];
  const pod = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-'));
  const taskDir = path.join(pod, 'tasks', 'T-1');
  fs.mkdirSync(path.join(taskDir, 'test-cases'), { recursive: true });
  fs.writeFileSync(path.join(taskDir, 'test-cases', 'bo.md'),
    `# bộ\n\n${HEAD}\n${cases.map(([id, m]) => row(id, m)).join('\n')}\n`, 'utf8');

  if (o.coThuMuc !== false) {
    fs.mkdirSync(path.join(taskDir, 'manual-run'), { recursive: true });
    if (o.session !== null) fs.writeFileSync(path.join(taskDir, 'manual-run', 'session.md'), o.session ?? SESSION_OK, 'utf8');
  }
  const st = o.status === undefined ? [tcOk(cases[0][0])] : o.status;
  if (st !== null) {
    fs.mkdirSync(path.join(taskDir, 'test-results'), { recursive: true });
    fs.writeFileSync(path.join(taskDir, 'test-results', 'testcase-status.json'),
      JSON.stringify({
        taskKey: 'T-1',
        generatedAt: '2026-10-09',
        // Khối attestation là phần của khuôn status, không phải thứ tuỳ chọn: output_gate đối chiếu nó để
        // chống "tick suông". Fixture phải mang nó, nếu không mọi ca đều lẫn một cảnh báo không liên quan.
        attestation: {
          oracleSource: 'Kết quả mong đợi trong bộ TC canonical',
          executed: true,
          allEvidenceAttached: true,
          failuresClassified: true,
          rerunDone: true,
        },
        tests: st,
      }, null, 2), 'utf8');
  }
  return { pod, taskDir };
}

function chay(o: Parameters<typeof dungTask>[0] = {}) {
  const { pod, taskDir } = dungTask(o);
  try { return mr.kiem(taskDir); } finally { fs.rmSync(pod, { recursive: true, force: true }); }
}

const loc = (xs: string[], re: RegExp) => xs.filter((x) => re.test(x));

test.describe('@infra manual-run — ranh giới `[manual]` và ủy quyền output_gate', () => {
  test('③ NỐI BỀ MẶT — `manual-run` có trong SURFACE_DIRS của gate_index', () => {
    /*
     * Thiếu dòng này thì `manual_run_check.js` bị bảng GATES.md in ra như "không bề mặt nào gọi" — tức
     * một máy đang dùng trông như mồ côi. Chính `gate_index.js` đã cảnh báo lớp lỗi đó: "mỗi lần thấy
     * một máy không bề mặt nào thì NGHI BẢNG TRƯỚC, nghi kit sau".
     */
    const gi = fs.readFileSync(path.join(REPO, 'scripts/qa/gate_index.js'), 'utf8');
    const m = gi.match(/const SURFACE_DIRS = \[([\s\S]*?)\];/);
    expect(m, 'không đọc được SURFACE_DIRS').toBeTruthy();
    expect(String(m![1])).toContain("'manual-run'");
  });

  test('③ branch_parity khai nhánh `manual-run`, và file nhánh nhắc đúng máy đã `applies`', () => {
    /*
     * `exploratory` KHÔNG có trong branch_parity vì nó cố ý không kết luận PASS/FAIL. `manual-run` thì
     * SINH VERDICT và ghi vào cột Result, nên nó đúng loại nhánh mà file này được dựng để đo.
     */
    expect(Object.keys(PARITY.branches), 'nhánh sinh verdict phải được đo độ đều').toContain('manual-run');
    const vanBan = fs.readFileSync(RUN_DOC, 'utf8') + fs.readFileSync(REF_DOC, 'utf8');
    const applies = Object.entries(PARITY.machines)
      .filter(([, v]) => ((v as { applies?: string[] }).applies || []).includes('manual-run'))
      .map(([k]) => k);
    expect(applies.length, 'phải có máy thật sự áp dụng, không thì phép đo rỗng').toBeGreaterThanOrEqual(3);
    for (const may of applies) expect(vanBan, `file nhánh KHÔNG nhắc \`${may}\``).toContain(may);
    for (const [may, v] of Object.entries(PARITY.machines)) {
      const w = (v as { waived?: Record<string, string> }).waived || {};
      if ('manual-run' in w) expect(String(w['manual-run']).length, `${may}: miễn trừ phải có lý do`).toBeGreaterThan(40);
    }
  });

  test('luật của kit ĐÈ luật ngoài — ba chỗ phải ghi rõ trong reference', () => {
    const ref = fs.readFileSync(REF_DOC, 'utf8');
    expect(ref, 'gói nguồn chỉ chụp ảnh khi FAIL — luật đó bị BỎ').toMatch(/[Cc]hỉ chụp ảnh khi FAIL/);
    expect(ref, 'kit đòi evidence cho MỌI case kể cả PASS').toMatch(/cả PASS/);
    expect(ref, 'verdict chỉ lấy từ taxonomy').toContain('verdict_taxonomy.json');
    expect(ref, 'FAIL phải rerun rồi mới log bug').toMatch(/rerun 2 đến 3 lần/);
    expect(ref, 'phải nói rõ SKIP_SETUP không phải verdict').toMatch(/SKIP_SETUP.*không phải verdict|không phải verdict/);
  });

  test('chưa có `manual-run/`: KHÔNG phải lỗi, nhánh này là opt-in', () => {
    const r = chay({ coThuMuc: false });
    expect(r.chuaChay).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  test('① CHẶN — case chạy tay mà khai `[api]`, không phải `[manual]`', () => {
    /*
     * Phép kiểm quan trọng nhất của file này. Mất nó thì nhánh chạy tay thành đường lách automation.
     */
    const r = chay({ cases: [['T_TC_001', 'api']] });
    const p = loc(r.problems, /chạy TAY nhưng ô Tiền điều kiện khai/);
    expect(p.length).toBe(1);
    expect(p[0], 'phải nêu đúng tag đang khai để sửa được ngay').toContain('[api]');
    expect(p[0], 'phải gọi đúng tên hậu quả').toMatch(/lách automation/);
    expect(p[0], 'và chỉ đường đúng: sửa lời khai ở Phase 1').toMatch(/Phase 1/);
  });

  test('CHỐNG BÁO OAN — case khai `[manual]` chạy tay thì sạch', () => {
    const r = chay();
    expect(r.problems, 'một gate báo oan một lần là mất uy tín vĩnh viễn').toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.soCase).toBe(1);
  });

  test('mọi method KHÁC `manual` đều bị chặn, không chỉ `api`', () => {
    for (const m of ['api', 'factory', 'test_hook', 'ui', 'pre_existing']) {
      const r = chay({ cases: [['T_TC_001', m]] });
      expect(loc(r.problems, /chạy TAY nhưng/).length, `[${m}] phải bị chặn`).toBe(1);
    }
  });

  test('case `[manual]` CHƯA chạy: cảnh báo, và nói rõ SKIP_SETUP không phải kết luận', () => {
    const r = chay({
      cases: [['T_TC_001', 'manual'], ['T_TC_002', 'manual']],
      status: [tcOk('T_TC_001')],
    });
    expect(r.problems).toEqual([]);
    const w = loc(r.warnings, /CHƯA có lượt chạy tay/);
    expect(w.length).toBe(1);
    expect(w[0]).toContain('1/2');
    expect(w[0], 'phải nói SKIP_SETUP là lời khai chưa chạy').toMatch(/KHÔNG phải kết luận/);
  });

  test('sổ phiên: thiếu file, thiếu trường, hoặc placeholder đều CHẶN', () => {
    expect(loc(chay({ session: null }).problems, /thiếu `manual-run\/session\.md`/).length).toBe(1);

    const thieu = SESSION_OK.split('\n').filter((l) => !l.startsWith('- Build')).join('\n');
    expect(loc(chay({ session: thieu }).problems, /\*\*Build\*\* còn trống/).length).toBe(1);

    const ph = SESSION_OK.replace('Nguyễn Văn A', '______');
    expect(loc(chay({ session: ph }).problems, /\*\*Người chạy\*\* còn trống/).length).toBe(1);

    const tbd = SESSION_OK.replace('2026.10.08-rc2', 'TBD');
    expect(loc(chay({ session: tbd }).problems, /\*\*Build\*\*/).length).toBe(1);
  });

  test('PII khách trong sổ phiên: CHẶN, không có ngoại lệ cho nhánh chạy tay', () => {
    const mail = chay({ session: `${SESSION_OK}\n- Tài khoản khách: khach.hang@gmail.com\n` });
    expect(loc(mail.problems, /PII/).length).toBe(1);

    const sdt = chay({ session: `${SESSION_OK}\n- Liên hệ phụ huynh 0912345678\n` });
    expect(loc(sdt.problems, /PII/).length).toBe(1);
  });

  test('thiếu `testcase-status.json`: CHẶN, vì verdict không về được cột Result', () => {
    const r = chay({ status: null });
    const p = loc(r.problems, /testcase-status\.json/);
    expect(p.length).toBe(1);
    expect(p[0], 'phải chỉ ra máy nào đọc file đó').toContain('merge_execution_status.js');
  });

  test('② ỦY QUYỀN — case PASS thiếu evidence bị chặn BỞI output_gate, không bởi luật chép lại', () => {
    /*
     * Gói nguồn chỉ chụp ảnh khi FAIL. `CLAUDE.md` mục 4 đòi ảnh hoặc video cho MỌI case đã execute.
     * Điều quan trọng không phải là luật đó có hiệu lực — mà là nó có hiệu lực TỪ output_gate, nên chỉ
     * có một nguồn. Tiền tố `[output_gate]` là bằng chứng kiểm được của việc ủy quyền.
     */
    const r = chay({ status: [{ ...tcOk('T_TC_001'), evidence: [] }] });
    const p = loc(r.problems, /^\[output_gate\]/);
    expect(p.length, 'phải có vi phạm đến TỪ output_gate').toBeGreaterThanOrEqual(1);
    expect(p.join(' '), 'và nó phải là chuyện thiếu evidence').toMatch(/evidence|ảnh|video/i);
  });

  test('② verdict ngoài taxonomy cũng do output_gate bắt', () => {
    const r = chay({ status: [{ ...tcOk('T_TC_001'), status: 'Đạt' }] });
    expect(loc(r.warnings, /^\[output_gate\].*taxonomy/).length).toBe(1);
  });

  test('`laManual` đọc đúng tag, kể cả precondition nhiều dòng', () => {
    expect(mr.laManual({ precondition: '[manual] Thiết bị thật đã bật' })).toBe(true);
    expect(mr.laManual({ precondition: '[api] Đã đăng nhập<br>[manual] Có file 2GB thật' })).toBe(true);
    expect(mr.laManual({ precondition: '[api] Đã đăng nhập' })).toBe(false);
    expect(mr.laManual({ precondition: 'Chạy tay thôi' }), 'chữ "tay" trong mô tả KHÔNG phải tag').toBe(false);
    expect(mr.laManual({ precondition: '' })).toBe(false);
  });
});
