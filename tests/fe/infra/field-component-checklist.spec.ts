import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — DANH MỤC LOẠI FIELD và COMPONENT (H4).
 *
 * Vì sao có file này: form input chỉ là một phần của app. Lưới dữ liệu, modal, toast và vòng đời CRUD là
 * những NHÓM HÀNH VI rải trên nhiều chiều, nên không chiều nào tự liệt kê chúng ra — và thứ không được
 * liệt kê thì "đã rà đủ" chỉ có nghĩa "agent thấy đủ".
 *
 * BA THỨ ĐƯỢC KHOÁ Ở ĐÂY:
 *   ① DRIFT. Danh mục ở config và checklist ở file chiều phải khớp. Đây là phép kiểm quan trọng nhất:
 *      người ta sửa bảng trong file chiều chứ không sửa config, và từ hôm đó máy gác theo một danh mục
 *      khác với danh mục con người đang đọc. Lệch âm thầm còn tệ hơn không có danh mục.
 *   ② HAI TẦNG. Manifest chưa có khối `components` ⇒ KHÔNG chặn, nhưng phải KÊU. Bộ cũ không được đỏ oan.
 *   ③ GIỚI HẠN ĐƯỢC TUYÊN BỐ. Component không phải tag nên máy KHÔNG đếm được "component X có mấy case".
 *      Nó chỉ gác xuất xứ của lời khai. Mất phép kiểm này thì ai đó sẽ tưởng đây là phép đo per-component.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const GATE = path.join(REPO, 'scripts/qa/dimension_coverage.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CFG = require(path.join(REPO, '.agent/config/ui_components.json'));

const DIM_DIR = path.join(REPO, 'prompt_templates/phase1/dimensions');

/* Artifact giả cho nhánh XUNG ĐỘT: `knowSystem()` đọc knowledge/system/ thật, nên phải đặt file ở đó rồi
 * xoá đi — cùng cách `ui-contract-check.spec.ts` đã làm. ID cố ý nhìn là biết fixture. */
const KS_DIR = path.join(REPO, 'knowledge', 'system');
const KS_FILE = path.join(KS_DIR, 'PM-TEST-999.json');

const HEAD = [
  '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |',
  '|---|---|---|---|---|---|---|---|---|---|',
].join('\n');

const row = (id: string) =>
  `| ${id} | Functional | [Negative][Validation] | M/validate | ${id} bỏ trống ô Họ tên | [api] Đã đăng nhập | rỗng | 1. Bỏ trống rồi Ghi | 1. Báo "Bắt buộc nhập" | High |`;

const LY_DO = 'Màn này không có thành phần đó, đã rà ngày 09/10/2026 trên cả năm cấp học.';

/** Dựng task tạm (manifest + bộ TC) rồi chạy gate đúng như pipeline chạy. */
function chay(manifest: Record<string, unknown> | null, { enforce = false, soCase = 3 } = {}) {
  const pod = fs.mkdtempSync(path.join(os.tmpdir(), 'uic-'));
  const taskDir = path.join(pod, 'tasks', 'T-1');
  fs.mkdirSync(path.join(taskDir, 'test-cases'), { recursive: true });
  fs.mkdirSync(path.join(taskDir, 'requirements'), { recursive: true });
  const rows = Array.from({ length: soCase }, (_, i) => row(`T_TC_${String(i + 1).padStart(3, '0')}`));
  fs.writeFileSync(path.join(taskDir, 'test-cases', 'bo.md'), `# bộ\n\n${HEAD}\n${rows.join('\n')}\n`, 'utf8');
  if (manifest) {
    fs.writeFileSync(path.join(taskDir, 'requirements', 'dimension_manifest.json'),
      JSON.stringify(manifest, null, 2), 'utf8');
  }
  try {
    const r = spawnSync(process.execPath, [GATE, ...(enforce ? ['--enforce'] : [])], {
      cwd: REPO,
      encoding: 'utf8',
      env: { ...gateEnv(), PROJECT_OUTPUT_DIR: pod, TASK_KEY: 'T-1' } as NodeJS.ProcessEnv,
    });
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  } finally {
    fs.rmSync(pod, { recursive: true, force: true });
  }
}

/** Manifest tối thiểu: chỉ chiều Validation bắt buộc, phần còn lại n/a. */
const base = (extra: Record<string, unknown> = {}) => {
  const dims: Record<string, string> = {};
  for (const id of ['ui_display', 'api', 'e2e', 'export_import', 'resilience', 'side_effect', 'guard',
    'design_figma', 'display_conformance', 'business_logic', 'be_conformance', 'security', 'perf',
    'change_impact', 'ordering', 'bug_history', 'accessibility', 'inbound_callback', 'db_persistence']) {
    dims[id] = 'n/a';
  }
  return { dimensions: { field_validation: 'required', ...dims }, ...extra };
};

/** Sáu component đều khai `n/a` kèm lý do — dùng làm nền cho các ca chỉ đổi MỘT biến. */
const cpNa = () => {
  const components: Record<string, string> = {};
  const na_reasons: Record<string, string> = {};
  for (const c of CFG.components) { components[c.code] = 'n/a'; na_reasons[c.code] = LY_DO; }
  return { components, na_reasons };
};

test.describe('@infra loại field + component — danh mục đọc từ config, không chép vào test', () => {
  test('① DRIFT — mọi mục trong config phải CÓ MẶT trong file chiều của nó', () => {
    /*
     * Phép kiểm quan trọng nhất của file này. Người ta sửa bảng trong file chiều chứ không sửa config, nên
     * nếu không khoá thì máy sẽ gác theo một danh mục khác với danh mục con người đang đọc — và không ai
     * biết, vì cả hai bên vẫn "có nội dung".
     */
    const fv = fs.readFileSync(path.join(DIM_DIR, '03_field_validation.md'), 'utf8');
    for (const f of CFG.field_types) {
      expect(fv, `loại field "${f.ten}" khai ở config mà KHÔNG có trong 03_field_validation.md`).toContain(f.neo);
    }
    for (const c of CFG.components) {
      const doc = fs.readFileSync(path.join(DIM_DIR, c.o), 'utf8');
      expect(doc, `component "${c.ten}" khai ở config mà KHÔNG có trong ${c.o}`).toContain(c.neo);
    }
  });

  test('config khai đủ thứ gate cần, và tuyên bố rõ giới hạn của chính nó', () => {
    expect(CFG.field_types.length, '10 loại kit vốn có HỢP 15 loại gói nguồn, trùng 7').toBe(18);
    expect(CFG.components.length).toBe(6);
    const codes = new Set(CFG.field_types.map((f: { code: string }) => f.code));
    expect(codes.size, 'mã loại field không được trùng nhau').toBe(18);
    for (const c of CFG.components) {
      expect(String(c.kich_hoat || '').length, `${c.code} thiếu điều kiện kích hoạt`).toBeGreaterThan(15);
      expect(fs.existsSync(path.join(DIM_DIR, c.o)), `${c.code} trỏ tới file chiều không tồn tại`).toBe(true);
      expect(Array.isArray(c.chieu) && c.chieu.length, `${c.code} chưa khai chiều nào chứa nó`).toBeTruthy();
    }
    expect(CFG._gioi_han_da_do, 'giới hạn phải ghi trong config, không chỉ trong đầu người viết').toMatch(/KHÔNG đếm được/);
    const coSignal = CFG.components.filter((c: { artifact_signal?: string }) => c.artifact_signal);
    expect(coSignal.length, 'chỉ permission_matrix và state_machine có artifact ⇒ chỉ 2 chỗ chặn được').toBe(2);
  });

  test('② TẦNG 1 — manifest CHƯA có khối components: KHÔNG chặn, nhưng phải KÊU và đưa khung', () => {
    const r = chay(base());
    expect(r.out).toMatch(/component CHƯA ĐƯỢC GÁC/);
    expect(r.out, 'kêu mà không đưa khung thì người đọc phải tự tra config').toMatch(/Khung để dán/);
    expect(r.out).toContain('"data_table"');
    expect(r.out, 'bộ cũ không được đỏ oan vì một luật mới').not.toMatch(/✗ .*lời khai component/);
  });

  test('TẦNG 2 — có khối rồi mà thiếu một component: CẢNH BÁO, nêu tên và điều kiện kích hoạt', () => {
    const m = cpNa();
    delete m.components.modal;
    const r = chay(base(m));
    expect(r.out).toMatch(/⚠ component "Modal \/ Dialog" CHƯA KHAI/);
    expect(r.out, 'phải nói khi nào component này áp dụng, không chỉ kêu thiếu').toMatch(/hộp thoại/);
    expect(r.out, '"không áp dụng" và "quên rà" phải phân biệt được').toMatch(/im lặng bỏ qua/);
  });

  test('n/a mà KHÔNG có lý do: CHẶN khi --enforce', () => {
    const m = cpNa();
    m.na_reasons.toast = '';
    const r = chay(base(m), { enforce: true });
    expect(r.code, 'thu hẹp phạm vi mà không ai chịu trách nhiệm').toBe(1);
    expect(r.out).toMatch(/na_reasons\.toast/);
  });

  test('n/a mà lý do chỉ là placeholder cũng bị bắt', () => {
    const m = cpNa();
    m.na_reasons.toast = 'TBD';
    const r = chay(base(m), { enforce: true });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/na_reasons\.toast/);
  });

  test('sáu component khai n/a KÈM lý do: đi qua, không kêu gì', () => {
    const r = chay(base(cpNa()));
    // Neo vào ĐÚNG thông điệp của khối component. Bảng chiều phía dưới cũng nhắc `na_reasons`, nên khuôn
    // rộng sẽ đỏ vì chuyện không liên quan — và một test đỏ vì chuyện khác thì không ai tin nó nữa.
    expect(r.out, 'chống báo oan — khai đủ rồi thì phải im').not.toMatch(/component "[^"]*" CHƯA KHAI/);
    expect(r.out).not.toMatch(/na_reasons\.(data_table|crud|permission|modal|toast|status_flow)/);
    expect(r.out).not.toMatch(/component CHƯA ĐƯỢC GÁC/);
  });

  test('③ XUNG ĐỘT — khai n/a trong khi knowledge/system CÓ artifact chứng minh áp dụng: CHẶN', () => {
    /*
     * Đây là chỗ DUY NHẤT máy có bằng chứng độc lập với lời khai, nên là chỗ duy nhất được chặn mà không
     * sợ báo oan: artifact có thật thì component đó áp dụng, hết bàn. Chiều ngược lại KHÔNG đúng và cố ý
     * không cài — artifact vắng không chứng minh được component không áp dụng.
     */
    fs.mkdirSync(KS_DIR, { recursive: true });
    fs.writeFileSync(KS_FILE, JSON.stringify({
      type: 'permission_matrix', id: 'PM-TEST-999', source: 'fixture test — không phải ma trận thật',
      roles: ['admin'], actions: ['xem'], allow: [['admin', 'xem']], deny_expected: '403',
    }, null, 2), 'utf8');
    try {
      const m = base(cpNa()) as { dimensions: Record<string, string> };
      // Cửa CHIỀU chặn trước cửa COMPONENT, nên muốn đo được cửa sau thì cửa trước phải thông. Và đó
      // chính là ca mà chỉ cửa component bắt được: chiều khai `required` mà component khai `n/a`.
      m.dimensions.security = 'required';
      const r = chay(m, { enforce: true });
      expect(r.code).toBe(1);
      expect(r.out).toMatch(/XUNG ĐỘT: component "Permission \/ Role"/);
      expect(r.out).toMatch(/permission_matrix/);
    } finally {
      fs.rmSync(KS_FILE, { force: true });
    }
  });

  test('khai required mà MỌI chiều chứa checklist của nó đều n/a: CẢNH BÁO hai lời khai chống nhau', () => {
    const m = cpNa();
    m.components.crud = 'required';          // chiều business_logic + db_persistence đều n/a ở base()
    delete m.na_reasons.crud;
    const r = chay(base(m));
    expect(r.out).toMatch(/⚠ component "CRUD lifecycle" khai required nhưng mọi chiều/);
    expect(r.out).toMatch(/business_logic, db_persistence/);
  });

  test('LOẠI FIELD — mã lạ: CHẶN', () => {
    const r = chay(base({ ...cpNa(), field_types: ['text', 'email', 'khong_co_loai_nay'] }), { enforce: true });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/mã loại field lạ: khong_co_loai_nay/);
  });

  test('LOẠI FIELD — khai nhiều loại hơn số case [Validation]: CẢNH BÁO, KHÔNG chặn', () => {
    /*
     * Mức cảnh báo là CỐ Ý, và giới hạn phải in ra cùng lời cảnh báo: phép đo này chỉ so TỔNG, nó KHÔNG
     * biết case nào thuộc loại nào. Lý do không đo được per-field: `ui_conformance_check.js` kiểm kê TÊN
     * field (`expectedFields` là mảng chuỗi nhãn) chứ không có thuộc tính LOẠI, nên inventory theo loại
     * field không tồn tại — và suy loại từ tên nhãn là dò chữ, đúng thứ đã gây dương tính giả nhiều lần.
     */
    const r = chay(base({ ...cpNa(), field_types: ['text', 'email', 'phone', 'date', 'number'] }), { soCase: 2 });
    expect(r.out).toMatch(/⚠ khai 5 loại field mà chỉ có 2 case \[Validation\]/);
    expect(r.out, 'giới hạn phải đi kèm con số, không để người đọc tự suy').toMatch(/chỉ so TỔNG/);
  });

  test('LOẠI FIELD — số case đủ thì im lặng; chưa khai thì nói rõ mẫu số là số tự nhận', () => {
    const du = chay(base({ ...cpNa(), field_types: ['text', 'email'] }), { soCase: 3 });
    expect(du.out).not.toMatch(/⚠ khai \d+ loại field/);

    const chuaKhai = chay(base(cpNa()));
    expect(chuaKhai.out, 'không khai thì 76 case Validation cũng không so được với gì').toMatch(/số tự nhận/);
  });
});
