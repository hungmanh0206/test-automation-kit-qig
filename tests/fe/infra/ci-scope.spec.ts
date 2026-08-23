import { test, expect } from '@playwright/test';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

/*
 * @infra — MÁY GÁC PHẠM VI CI.
 *
 * Vì sao có file này: commit `6773d1e` (của tôi) quét 46 spec theo task + 8 spec DB vào repo, và job
 * nightly chạy `npx playwright test` TRẦN với `OPS_USERNAME`/`OPS_PASSWORD` trong env ⇒ mỗi 01:00 giờ VN
 * CI sẽ drive `student_delete*` · `calendar_destructive` trên OPS UAT. CLAUDE.md §2/§5 cấm rõ điều đó từ
 * lâu; tôi vẫn làm được vì KHÔNG có máy nào đứng sau hai luật ấy.
 *
 * Test này khoá 3 chế độ hỏng, trong đó chế độ 3 là chế độ tôi vừa tự gây ra khi sửa gate:
 *   1. spec theo task được track ⇒ ĐỎ (nợ đã khai ⇒ chỉ cảnh báo)
 *   2. spec drive UAT nằm trong phạm vi nightly ⇒ ĐỎ; spec infra "nhắc tên hàm login" ⇒ KHÔNG báo oan
 *   3. CI còn lệnh `playwright test` TRẦN ⇒ ĐỎ (regex nhận-diện-scope có nhánh rỗng thì gate mất răng
 *      mà vẫn xanh — đúng thứ đã xảy ra một lần trong lượt viết gate này)
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const GATE = path.join(REPO, 'scripts/qa/ci_scope_check.js');

/*
 * Chạy gate trong một repo git GIẢ: `git ls-files` phải thấy đúng bộ file của từng ca, và tuyệt đối
 * không sửa gì trong repo thật. Rẻ: `git init` + 1 commit, ~200ms.
 */
const sandbox = (files: Record<string, string>) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ciscope-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }
  // Gate tự tính REPO_ROOT = ../.. so với chính nó ⇒ phải đặt đúng `scripts/qa/` trong sandbox.
  fs.mkdirSync(path.join(root, 'scripts', 'qa'), { recursive: true });
  fs.copyFileSync(GATE, path.join(root, 'scripts', 'qa', 'ci_scope_check.js'));
  const git = (...a: string[]) => spawnSync('git', a, { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  git('add', '-A');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'x');
  return root;
};

const run = (root: string) => {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'qa', 'ci_scope_check.js')], { cwd: root, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

const CFG = (over: Record<string, unknown> = {}) => JSON.stringify({
  nightly: ['tests/fe/infra'],
  uatImports: ['opsLogin', 'lmsLogin', 'support/auth/'],
  uatEnvPrefixes: ['OPS_', 'LMS_', 'HUBSPOT_'],
  taskSpecDebt: [],
  allowedTaskSpecDirs: [],
  ...over,
});

/*
 * CI "đúng chuẩn": cả 2 file đều LẤY phạm vi từ config (`npm run -s ci:scope -- --print-nightly`) rồi
 * truyền vào lệnh chạy. Fixture phải có ĐỦ hai nửa — thiếu bước lấy scope thì gate đỏ vì rule ③, và đó
 * là lỗi fixture chứ không phải gate báo oan.
 */
const GH_SCOPE_STEP = '      - run: echo "paths=$(npm run -s ci:scope -- --print-nightly)" >> "$GITHUB_OUTPUT"\n';
const CI_OK = {
  '.github/workflows/ci.yml': `jobs:\n  a:\n    steps:\n${GH_SCOPE_STEP}      - run: npx playwright test \${{ steps.scope.outputs.paths }} --shard=1/4\n`,
  '.gitlab-ci.yml': 'job:\n  script:\n    - export SCOPE="$(npm run -s ci:scope -- --print-nightly)"\n    - npx playwright test $SCOPE --reporter=blob\n',
};
const INFRA_OK = { 'tests/fe/infra/gates.spec.ts': "import { test } from '@playwright/test';\ntest('x', () => {});\n" };

test.describe('@infra ci:scope — spec theo task không được vào suite chung', () => {
  test('spec trong thư mục SAPP-<số> được track ⇒ CHẶN, kèm cách gỡ', () => {
    const root = sandbox({
      ...CI_OK, ...INFRA_OK, '.agent/config/ci_scope.json': CFG(),
      'tests/mobile-web/SAPP-22827/student_delete.spec.ts': "import { test } from '@playwright/test';\n",
    });
    const r = run(root);
    expect(r.code, 'để lọt = nightly sẽ chạy nó trên UAT').toBe(1);
    expect(r.out).toContain('SAPP-22827');
    expect(r.out, 'phải nói cách gỡ, không chỉ mắng').toContain('git rm --cached');
  });

  test('nợ ĐÃ KHAI ở taskSpecDebt ⇒ cảnh báo, không chặn (nợ thấy được ≠ nợ ngầm)', () => {
    const f = 'tests/fe/SAPP-26523/dropdown.spec.ts';
    const root = sandbox({
      ...CI_OK, ...INFRA_OK, '.agent/config/ci_scope.json': CFG({ taskSpecDebt: [f] }),
      [f]: "import { test } from '@playwright/test';\n",
    });
    const r = run(root);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('⚠');
    expect(r.out).toContain('SAPP-26523');
  });
});

test.describe('@infra ci:scope — nightly không được tự chạm UAT', () => {
  test('spec IMPORT helper đăng nhập mà nằm trong nightly ⇒ CHẶN', () => {
    const root = sandbox({
      ...CI_OK, ...INFRA_OK, '.agent/config/ci_scope.json': CFG(),
      'tests/fe/infra/leak.spec.ts': "import { opsLogin } from '../support/opsLogin';\n",
    });
    const r = run(root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('import opsLogin');
  });

  test('spec ĐỌC env creds mà nằm trong nightly ⇒ CHẶN', () => {
    const root = sandbox({
      ...CI_OK, ...INFRA_OK, '.agent/config/ci_scope.json': CFG(),
      'tests/fe/infra/leak2.spec.ts': 'const u = process.env.OPS_USERNAME;\n',
    });
    expect(run(root).out).toContain('env OPS_USERNAME');
  });

  test('spec infra chỉ NHẮC TÊN hàm login trong assert ⇒ KHÔNG báo oan', () => {
    // Đo bằng import + process.env, không grep chữ tự do: `infra/auth-session-lock` (nhắc `loginOps`
    // trong comment/assert) và `infra/screen-snapshot` (goto file fixture) từng bị gắn cờ oan.
    const root = sandbox({
      ...CI_OK, '.agent/config/ci_scope.json': CFG(),
      'tests/fe/infra/unit.spec.ts': "import { test, expect } from '@playwright/test';\n// nhánh SEED của loginOps chỉ nghiệm thu được bằng UAT smoke\ntest('x', () => { expect('storageState').toBe('storageState'); });\n",
    });
    const r = run(root);
    expect(r.code, `gate báo oan là gate bị tắt:\n${r.out}`).toBe(0);
  });

  test('phạm vi nightly KHÔNG có spec nào ⇒ CHẶN (xanh mà chẳng chạy gì là false-green)', () => {
    // Có spec trong repo (nếu KHÔNG có spec nào thì gate báo "phép đo hỏng" — ca khác, đã test riêng),
    // nhưng không spec nào nằm trong phạm vi nightly đã khai.
    const root = sandbox({
      ...CI_OK, '.agent/config/ci_scope.json': CFG({ nightly: ['tests/fe/khong-ton-tai'] }),
      'tests/fe/order/order.spec.ts': "import { test } from '@playwright/test';\n",
    });
    const r = run(root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('false-green');
  });
});

test.describe('@infra ci:scope — CI không được chạy cả suite', () => {
  test('lệnh `playwright test` TRẦN ⇒ CHẶN', () => {
    const root = sandbox({
      ...INFRA_OK, '.agent/config/ci_scope.json': CFG(),
      '.github/workflows/ci.yml': 'jobs:\n  a:\n    steps:\n      - run: npx playwright test --shard=1/4 --reporter=blob\n',
      '.gitlab-ci.yml': 'job:\n  script:\n    - npx playwright test $SCOPE\n',
    });
    const r = run(root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('CẢ suite');
  });

  test('dòng bị comment ⇒ không tính; `--list` ⇒ không tính (chỉ đếm test, không chạy)', () => {
    const root = sandbox({
      ...INFRA_OK, '.agent/config/ci_scope.json': CFG(),
      '.github/workflows/ci.yml': `jobs:\n  a:\n    steps:\n${GH_SCOPE_STEP}      # npx playwright test --shard=1/4\n      - run: npx playwright test \${{ steps.scope.outputs.paths }}\n      - run: npx playwright test --list\n`,
      '.gitlab-ci.yml': CI_OK['.gitlab-ci.yml'],
    });
    expect(run(root).code, run(root).out).toBe(0);
  });

  test('CI KHÔNG hề nhắc ci:scope ⇒ CHẶN (config không ai đọc thì chỉ là trang trí)', () => {
    const root = sandbox({
      ...INFRA_OK, '.agent/config/ci_scope.json': CFG(),
      '.github/workflows/ci.yml': 'jobs:\n  a:\n    steps:\n      - run: echo hi\n',
      '.gitlab-ci.yml': 'job:\n  script:\n    - npx playwright test $SCOPE\n',
    });
    const r = run(root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('trang trí');
  });
});

test.describe('@infra ci:scope — repo THẬT phải sạch', () => {
  test('2 file CI thật + spec thật hiện tại: không vi phạm nào', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { check } = require(GATE);
    const r = check();
    expect(r.problems, JSON.stringify(r.problems, null, 2)).toEqual([]);
    expect(r.specs.length, 'phải đếm được spec thật, 0 = phép đo hỏng').toBeGreaterThan(20);
  });
});
