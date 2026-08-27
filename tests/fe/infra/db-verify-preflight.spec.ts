import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

/*
 * Máy kiểm cho `scripts/qa/lib/db_verify_preflight.js`.
 *
 * Vì sao cần: tầng DB verify có 4 lớp an toàn, nhưng trước 28/08/2026 KHÔNG lớp nào được kiểm ở cửa vào —
 * `db.conventions.json` không được gate nào nhắc tới. Gate mới này chỉ có giá trị nếu nó THẬT SỰ chặn, nên
 * mỗi luật ở đây đi kèm một kiểm-âm (bỏ luật ra thì test phải đỏ).
 *
 * Toàn bộ chạy trên thư mục TẠM: gate đọc `.agent/config/db.conventions.json` + `profiles/<TASK>/task.env`
 * theo `root` truyền vào, nên dựng được cây giả mà không chạm repo thật.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dbv = require(path.join(REPO, 'scripts/qa/lib/db_verify_preflight.js'));

const GOOD_CONV = {
  softDelete: { default: { mode: 'timestamp', column: 'deleted_at' } },
  idColumn: 'id',
  safety: { requireReadonlyUser: true, allowedHosts: ['db-uat.example'], denyHostPatterns: ['prod', 'live'], statementTimeoutMs: 5000, maxRows: 500 },
  fieldMap: { entity: 't', byScreen: { CORE: { _route: '/x', id: 'ID' } }, unanchored: {} },
};
const GOOD_ENV = [
  'LIB_MASTER_DB_RO_HOST=db-uat.example',
  'LIB_MASTER_DB_RO_PORT=5432',
  'LIB_MASTER_DB_RO_NAME=app_uat',
  'LIB_MASTER_DB_RO_USERNAME=qa_readonly',
  'LIB_MASTER_DB_RO_PASSWORD=x',
].join('\n');

/** Dựng cây giả: `<tmp>/.agent/config/db.conventions.json` + `<tmp>/profiles/<task>/task.env`. */
function mkRoot(opts: { conv?: unknown | null; env?: string | null; task?: string } = {}) {
  const task = opts.task || 'T-1';
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dbpf-'));
  if (opts.conv !== null) {
    fs.mkdirSync(path.join(root, '.agent', 'config'), { recursive: true });
    fs.writeFileSync(path.join(root, '.agent', 'config', 'db.conventions.json'),
      typeof opts.conv === 'string' ? opts.conv : JSON.stringify(opts.conv ?? GOOD_CONV, null, 2));
  }
  if (opts.env !== null) {
    fs.mkdirSync(path.join(root, 'profiles', task), { recursive: true });
    fs.writeFileSync(path.join(root, 'profiles', task, 'task.env'), opts.env ?? GOOD_ENV);
  }
  return { root, task };
}
const run = (o: Parameters<typeof mkRoot>[0] = {}) => {
  const { root, task } = mkRoot(o);
  const r = dbv.checkDbVerifyStatic(root, { task, declared: true, why: 'test' });
  fs.rmSync(root, { recursive: true, force: true });
  return r;
};

test.describe('@infra preflight DB verify — phát hiện task có KHAI dùng §23', () => {
  const mkTask = (files: Record<string, string>) => {
    const pod = fs.mkdtempSync(path.join(os.tmpdir(), 'dbpod-'));
    for (const [rel, body] of Object.entries(files)) {
      const f = path.join(pod, 'tasks', 'T-1', rel);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, body);
    }
    return pod;
  };
  const detect = (pod: string) => dbv.detectDbVerifyDeclared(path.dirname(pod), {
    task: 'T-1',
    projectOutputDir: path.basename(pod),
    testcaseDirs: (d: string) => [path.join(d, 'test-cases')],
  });

  test('manifest khai db_persistence required ⇒ declared', () => {
    const pod = mkTask({ 'requirements/dimension_manifest.json': JSON.stringify({ dimensions: { db_persistence: 'required' } }) });
    expect(detect(pod).declared).toBe(true);
    const pod2 = mkTask({ 'requirements/dimension_manifest.json': JSON.stringify({ dimensions: { db_persistence: { required: true, min: 3 } } }) });
    expect(detect(pod2).declared).toBe(true);
  });

  test('testcase .md có tag [DbPersist] ⇒ declared (kể cả khi chưa có manifest)', () => {
    const pod = mkTask({ 'test-cases/tc.md': '| T_TC_001 | [Negative][DbPersist] Xoá đơn | 1. deleted_at IS NOT NULL |' });
    const d = detect(pod);
    expect(d.declared).toBe(true);
    expect(d.why).toContain('tc.md');
  });

  test('KHÔNG khai ⇒ gate im lặng TUYỆT ĐỐI (kiểm-âm: chặn oan task không đụng DB là cách gate bị tắt)', () => {
    const pod = mkTask({
      'requirements/dimension_manifest.json': JSON.stringify({ dimensions: { display_conformance: 'required', db_persistence: 'n/a' } }),
      'test-cases/tc.md': '| T_TC_001 | [Positive][Display] Lưới đủ cột | 1. Cột: A, B |',
    });
    expect(detect(pod).declared).toBe(false);
    // và khi không khai thì hàm kiểm tĩnh không sinh ra vấn đề nào, dù conventions có hỏng đến đâu
    const { root, task } = mkRoot({ conv: null, env: null });
    const r = dbv.checkDbVerifyStatic(root, { task, declared: false, why: '' });
    fs.rmSync(root, { recursive: true, force: true });
    expect(r.problems).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});

test.describe('@infra preflight DB verify — kiểm TĨNH có răng', () => {
  test('cấu hình ĐÚNG ⇒ 0 chặn (không chặn oan)', () => {
    const r = run();
    expect(r.problems, JSON.stringify(r.problems)).toEqual([]);
  });

  test('THIẾU db.conventions.json ⇒ chặn', () => {
    expect(run({ conv: null }).problems.join(' ')).toMatch(/THIẾU .*db\.conventions\.json/);
  });

  test('conventions không parse được ⇒ chặn PARSE_FAILURE', () => {
    expect(run({ conv: '{ khong-phai-json' }).problems.join(' ')).toMatch(/PARSE_FAILURE/);
  });

  test('requireReadonlyUser: false ⇒ chặn, và nói rõ đây là non-negotiable', () => {
    const conv = JSON.parse(JSON.stringify(GOOD_CONV));
    conv.safety.requireReadonlyUser = false;
    const p = run({ conv }).problems.join(' ');
    expect(p).toMatch(/requireReadonlyUser = false/);
    expect(p).toMatch(/non-negotiable|CLAUDE\.md/);
  });

  test('fieldMap.byScreen rỗng ⇒ chặn (chưa neo cột nào thì không được phán bằng DB)', () => {
    const conv = JSON.parse(JSON.stringify(GOOD_CONV));
    conv.fieldMap.byScreen = {};
    expect(run({ conv }).problems.join(' ')).toMatch(/chưa có fieldMap\.byScreen/);
  });

  test('thiếu task.env ⇒ chặn, và nhắc creds KHÔNG ở .env chung', () => {
    const p = run({ env: null }).problems.join(' ');
    expect(p).toMatch(/THIẾU profiles\/T-1\/task\.env/);
    expect(p).toMatch(/KHÔNG ở \.env chung/);
  });

  test('thiếu khoá creds ⇒ chặn và LIỆT KÊ đúng khoá thiếu', () => {
    const p = run({ env: 'LIB_MASTER_DB_RO_HOST=db-uat.example\nLIB_MASTER_DB_RO_USERNAME=qa_readonly\n' }).problems.join(' ');
    expect(p).toMatch(/LIB_MASTER_DB_RO_NAME/);
    expect(p).toMatch(/LIB_MASTER_DB_RO_PASSWORD/);
    expect(p, 'khoá ĐÃ có thì không được kêu').not.toMatch(/thiếu.*LIB_MASTER_DB_RO_HOST/);
  });

  test('HOST khớp denyHostPatterns ⇒ chặn (đây là lớp chặn trỏ vào prod)', () => {
    const p = run({ env: GOOD_ENV.replace('db-uat.example', 'db-prod.example') }).problems.join(' ');
    expect(p).toMatch(/denyHostPatterns/);
  });

  test('HOST không có trong allowedHosts ⇒ chặn (host lạ phải thêm có chủ ý)', () => {
    const p = run({ env: GOOD_ENV.replace('db-uat.example', 'db-la.example') }).problems.join(' ');
    expect(p).toMatch(/không có trong safety\.allowedHosts/);
  });

  test('tên user không giống read-only ⇒ CẢNH BÁO, KHÔNG chặn (chặn theo tên là chặn theo phỏng đoán)', () => {
    const r = run({ env: GOOD_ENV.replace('qa_readonly', 'app_user') });
    expect(r.problems, 'không được chặn chỉ vì cái tên').toEqual([]);
    expect(r.warnings.join(' ')).toMatch(/không có dấu hiệu read-only/);
  });

  test('user tên đúng quy ước ⇒ không cảnh báo (không nhiễu)', () => {
    for (const u of ['qa_readonly', 'sapp_qa_readonly', 'svc_ro', 'reporting_ro_1']) {
      const r = run({ env: GOOD_ENV.replace('qa_readonly', u) });
      expect(r.warnings.join(' '), `"${u}" bị cảnh báo oan`).not.toMatch(/dấu hiệu read-only/);
    }
  });
});

test.describe('@infra preflight DB verify — phán read-only từ dòng quyền (hàm thuần)', () => {
  test('chỉ SELECT ⇒ sạch', () => {
    expect(dbv.readonlyVerdictFromRows([{ privilege_type: 'SELECT', n: 232 }], 'u')).toEqual([]);
  });

  test('có quyền ghi ⇒ chặn, và nói RÕ quyền gì trên bao nhiêu bảng', () => {
    const p = dbv.readonlyVerdictFromRows([{ privilege_type: 'SELECT', n: 232 }, { privilege_type: 'INSERT', n: 232 }], 'u').join(' ');
    expect(p).toMatch(/CÓ quyền ghi/);
    expect(p).toMatch(/INSERT=232 bảng/);
  });

  test('0 dòng quyền ⇒ PHÉP ĐO HỎNG, KHÔNG phải "sạch"', () => {
    /*
     * Đây là nhánh dễ sai nhất: không đọc được quyền nào thì `filter(write)` ra rỗng, và một cài đặt hồn
     * nhiên sẽ kết luận "read-only". Phải chặn — "không phán được" KHÔNG thành PASS.
     */
    const p = dbv.readonlyVerdictFromRows([], 'u').join(' ');
    expect(p).toMatch(/PHÉP ĐO HỎNG/);
    expect(p).not.toMatch(/^\s*$/);
  });

  test('REFERENCES/TRIGGER không tính là quyền ghi (không chặn oan)', () => {
    expect(dbv.readonlyVerdictFromRows([{ privilege_type: 'SELECT', n: 1 }, { privilege_type: 'REFERENCES', n: 1 }, { privilege_type: 'TRIGGER', n: 1 }], 'u')).toEqual([]);
  });

  test('từ vựng quyền phải KHỚP với types.ts (một nguồn, không hai bản trôi khỏi nhau)', () => {
    const src = fs.readFileSync(path.join(REPO, 'tests/support/setup/db/types.ts'), 'utf8');
    const m = src.match(/WRITE_PRIVILEGES: readonly Privilege\[\] = \[([^\]]+)\]/);
    expect(m, 'không đọc được WRITE_PRIVILEGES ở types.ts').toBeTruthy();
    const fromTypes = m![1].split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean).sort();
    expect([...dbv.WRITE_PRIVILEGES].sort()).toEqual(fromTypes);
  });
});

test.describe('@infra preflight DB verify — nối vào gate thật', () => {
  test('preflight_gate xuất nhóm kiểm DB và gọi phép đo sống ở CLI', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/preflight_gate.js'), 'utf8');
    expect(src, 'gate chưa require module kiểm DB').toContain("lib', 'db_verify_preflight'");
    expect(src, 'chưa gọi kiểm tĩnh trong runPreflight').toContain('dbv.checkDbVerifyStatic');
    expect(src, 'chưa gọi phép đo sống ở main()').toContain('dbv.checkDbReadonlyLive');
    expect(src, 'main phải async để await được phép đo sống').toContain('async function main()');
    expect(src, 'phải có đường thoát tường minh').toContain('skip-db-live');
    // runPreflight (sync, harness hook gọi) KHÔNG được chứa phép đo sống.
    const rp = src.slice(src.indexOf('function runPreflight'), src.indexOf('function checkHarnessHooks'));
    expect(rp, 'phép đo sống lọt vào runPreflight ⇒ hook sẽ chờ mạng').not.toContain('checkDbReadonlyLive');
  });

  test('§23 phải nhắc lệnh preflight (gate không ai gọi thì không phải gate)', () => {
    const doc = fs.readFileSync(path.join(REPO, 'prompt_templates/phase1/dimensions/23_db_persistence.md'), 'utf8');
    expect(doc).toMatch(/preflight_gate|npm run preflight/);
  });
});

test.describe('@infra preflight DB verify — nhánh SỐNG (tiêm client, không cần mạng)', () => {
  const withEnv = async (rows: unknown, fail?: string) => {
    const { root, task } = mkRoot();
    const client = {
      connect: async () => { if (fail) throw new Error(fail); },
      query: async () => ({ rows }),
      end: async () => {},
    };
    const r = await dbv.checkDbReadonlyLive(root, { task, clientFactory: () => client });
    fs.rmSync(root, { recursive: true, force: true });
    return r.join(' ');
  };

  test('user chỉ SELECT ⇒ không chặn', async () => {
    expect(await withEnv([{ privilege_type: 'SELECT', n: 10 }])).toBe('');
  });

  test('user có UPDATE ⇒ CHẶN và chỉ ra xin DBA role chỉ SELECT', async () => {
    const p = await withEnv([{ privilege_type: 'UPDATE', n: 7 }]);
    expect(p).toMatch(/CÓ quyền ghi/);
    expect(p).toMatch(/DBA/);
  });

  test('không kết nối được ⇒ VẪN CHẶN, và nói ra đường thoát tường minh', async () => {
    /*
     * Chủ ý: task khai dùng §23 mà không tới được DB thì không chạy được — "không phán được" KHÔNG thành
     * PASS. Nhưng phải có đường thoát ghi rõ, nếu không gate thành bẫy chặn oan lúc mất VPN.
     */
    const p = await withEnv([], 'ECONNREFUSED');
    expect(p).toMatch(/không kết nối được/);
    expect(p).toMatch(/--skip-db-live/);
  });
});

test.describe('@infra tầng DB — seam đủ trung tính để thêm MySQL/Mongo', () => {
  const read = (f: string) => fs.readFileSync(path.join(REPO, 'tests/support/setup/db', f), 'utf8');

  test('dbVerify.ts (lớp NGHĨA) không được chứa SQL', () => {
    /*
     * Seam đúng chỗ thì thêm adapter mới KHÔNG phải sửa dbVerify.ts. Đo bằng máy: lớp nghĩa không được có
     * câu SQL nào. Chỗ duy nhất được biết phương ngữ là dòng chọn adapter theo `conn.dialect`.
     */
    const src = read('dbVerify.ts');
    for (const kw of ['SELECT ', 'INSERT ', 'UPDATE ', 'DELETE ', 'information_schema', '::uuid', ' WHERE ']) {
      expect(src, `dbVerify.ts lọt SQL: "${kw}"`).not.toContain(kw);
    }
    expect(src, 'dbVerify.ts phải là nơi DUY NHẤT biết dialect nào có adapter').toContain("conn.dialect !== 'postgres'");
  });

  test('guard.ts (lớp PHÁN) không được import adapter nào', () => {
    expect(read('guard.ts'), 'lớp phán không được biết phương ngữ nào').not.toContain("from './adapters");
  });

  test('từ vựng quyền khai MỘT nơi, adapter chịu trách nhiệm chuẩn hoá', () => {
    const types = read('types.ts');
    expect(types, 'types.ts phải khai hàm chuẩn hoá').toContain('export function normalizePrivilege');
    expect(types, 'phải nêu cả từ Mongo để người thêm adapter biết phải dịch').toMatch(/REMOVE|DROP/);
    // guard.ts KHÔNG được khai lại danh sách quyền ghi
    expect(read('guard.ts'), 'guard.ts khai lại WRITE_PRIVILEGES ⇒ hai bản sẽ trôi khỏi nhau')
      .not.toContain('WRITE_PRIVILEGES = [');
    // postgres adapter phải chuẩn hoá ở CẢ HAI chỗ đọc quyền
    const pg = fs.readFileSync(path.join(REPO, 'tests/support/setup/db/adapters/postgres.ts'), 'utf8');
    expect((pg.match(/normalizePrivilege\(/g) || []).length, 'adapter phải chuẩn hoá ở mọi chỗ trả GrantRow').toBeGreaterThanOrEqual(2);
  });

  test('normalizePrivilege dịch đúng từ vựng của cả SQL và Mongo', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { normalizePrivilege } = require(path.join(REPO, 'tests/support/setup/db/types'));
    for (const [raw, want] of [['SELECT', 'SELECT'], ['find', 'SELECT'], ['insert', 'INSERT'],
      ['remove', 'DELETE'], ['drop', 'TRUNCATE'], ['REFERENCES', 'OTHER'], ['', 'OTHER']] as [string, string][]) {
      expect(normalizePrivilege(raw), `"${raw}"`).toBe(want);
    }
  });
});
