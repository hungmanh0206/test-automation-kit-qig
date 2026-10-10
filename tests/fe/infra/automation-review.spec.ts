import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ar = require('../../../scripts/qa/automation_review.js');

/*
 * @infra — `auto:review` (v2.5.0 G1.4): gác 6 chiều chất lượng code mà `lint:locator` KHÔNG gác.
 *
 * PHÉP ĐO ĐÃ THU HẸP HẠNG MỤC NÀY. Kế hoạch G1.4 định viết 7 nhóm luật; grep trước khi viết thì
 * `locator_lint` đã có `xpath-locator`, và có MỘT PHẦN `blind-wait` (chỉ `waitForTimeout >= 5000`) và
 * `weak-assert` (chỉ `toBeTruthy`/`not.toBeNull`). Nên file này không chép luật locator — chiều đó được
 * GỌI (`--with-locator`). Hai bản cùng một luật là nguồn trôi, và kit vừa trả giá đúng chuyện đó ở hai
 * bản lint SQL (`guard.ts` thiếu `EXEC` trong khi `uatDbClient.ts` có).
 *
 * PHẦN LỚN TEST Ở ĐÂY LÀ ÂM BẢN, vì gate này báo oan BỐN lần trong lúc dựng — và mỗi lần đều là một
 * lớp lỗi khác nhau, không phải cùng một lỗi lặp lại:
 *   ① `\btest(` khớp cả `TEN_CU.test('…')` ⇒ mọi lời gọi regex bị đọc thành một test rỗng (201 finding).
 *   ② thân test cắt tới `test(` kế tiếp, kể cả cái nằm TRONG MỘT CHUỖI fixture ⇒ báo oan test có assert.
 *   ③ bộ xoá chuỗi không biết regex literal: `/^['"|>&*]/` làm nó vào trạng thái chuỗi rồi nuốt luôn
 *      `expect(` cách đó 5 dòng. Tôi đã ghi chú "sai theo chiều này chỉ gây BỎ SÓT" — câu đó SAI, và
 *      đó là bài học riêng: một giả định về chiều sai mà không đo thì chính nó là lỗi.
 *   ④ luật `task-key-in-shared` khớp `ISO-8601` và `RFC-2119` ⇒ đã BỎ, chuyển xuống mục cần người xem.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const AR = path.join(REPO, 'scripts/qa/automation_review.js');

/**
 * Chay gate. `cay` la cay DUOC QUET, truyen qua `--repo` chu khong qua `cwd`: `REPO_ROOT` suy tu vi tri
 * cua chinh script nen `cwd` khong doi duoc pham vi quet. Ban dau cua spec nay sai dung cho do.
 */
function chay(argv: string[] = [], cay?: string) {
  const av = cay ? [AR, '--repo', cay, ...argv] : [AR, ...argv];
  const r = spawnSync(process.execPath, av, { cwd: cay || REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

/** Cây tạm có `tests/` + `.agent/config/auto_review.json`, để chạy gate trên nội dung do test dựng. */
function cayTam(files: Record<string, string>, no: Record<string, number> = {}): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'autorev-'));
  fs.mkdirSync(path.join(d, '.agent/config'), { recursive: true });
  fs.writeFileSync(path.join(d, '.agent/config/auto_review.json'),
    JSON.stringify({ hardSleepDebt: no, probeMarker: '@auto-review-probe:' }), 'utf8');
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf8');
  }
  return d;
}

const HEAD = "import { test, expect } from '@playwright/test';\n";

test.describe('@infra auto:review — repo hiện tại', () => {
  test('repo hiện tại: ĐẠT ở tầng chặn, và nợ đã khai được nêu ra chứ không biến mất', () => {
    const r = chay(['--enforce']);
    expect(r.code, r.out).toBe(0);
    expect(r.out, 'phải in rõ tầng nào là tầng chặn').toMatch(/tầng CHẶN/);
  });

  test('chiều locator KHÔNG bị chép lại — gate tự nói là nó gọi máy khác', () => {
    /*
     * Neo vào chính mã nguồn: `automation_review.js` không được chứa luật locator của `locator_lint`.
     * Đây là phép kiểm chống trôi, cùng loại với "hai bản lint SQL" vừa gộp.
     */
    const src = fs.readFileSync(AR, 'utf8');
    for (const cam of ['xpath', 'force\\s*:\\s*true', 'querySelectorAll', 'mouse.click']) {
      expect(new RegExp(`re:\\s*/[^\\n]*${cam}`, 'i').test(src),
        `luật locator "${cam}" KHÔNG được viết lại ở đây — nó thuộc lint:locator`).toBe(false);
    }
    expect(chay([]).out).toMatch(/lint:locator/);
  });

  test('`RULES` không có luật nào thiếu `why`/`fix` — luật không giải thích được thì bị tắt', () => {
    expect(ar.RULES.length).toBeGreaterThan(3);
    for (const r of ar.RULES) {
      expect(String(r.why || ''), `${r.id} thiếu "vì sao đây là lỗi"`).not.toHaveLength(0);
      expect(String(r.fix || ''), `${r.id} thiếu cách sửa`).not.toHaveLength(0);
      expect(['P0', 'P1'], `${r.id} sev lạ`).toContain(r.sev);
    }
  });
});

test.describe('@infra auto:review — từng luật, và ÂM BẢN của nó', () => {
  test('no-assert: test rỗng bị bắt, test có assert thì KHÔNG', () => {
    const d = cayTam({
      'tests/a.spec.ts': `${HEAD}test('rỗng', async ({ page }) => { await page.goto('/x'); });\n`,
      'tests/b.spec.ts': `${HEAD}test('có assert', async ({ page }) => { await expect(page).toHaveTitle('X'); });\n`,
    });
    const r = chay(['--enforce'], d);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('a.spec.ts');
    expect(r.out, 'test có assertion KHÔNG được bị bắt').not.toContain('b.spec.ts');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('no-assert: helper `assertX`/`expectX` ĐƯỢC tính là khẳng định', () => {
    /* Bước nghiệm thu của kit nằm trong `assertScreen`/`clickVerified`, không phải `expect` trần. */
    const d = cayTam({
      'tests/c.spec.ts': `${HEAD}import { assertScreen } from './h';\ntest('x', async ({ page }) => { await assertScreen(page, 'Danh sách'); });\n`,
    });
    const r = chay(['--enforce'], d);
    expect(r.code, r.out).toBe(0);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('no-assert: `test.skip`/`test.fixme` KHÔNG bị đòi assertion', () => {
    const d = cayTam({
      'tests/d.spec.ts': `${HEAD}test.skip('chưa dựng được tiền đề', async () => {});\ntest.fixme('đang vỡ', async () => {});\n`,
    });
    expect(chay(['--enforce'], d).code).toBe(0);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ÂM BẢN ①: `regex.test("…")` KHÔNG được đọc thành một test rỗng', () => {
    /* Lỗi thật: 201 finding `no-assert`, trong đó có `test("App là ant-design + Metronic")` — một CHUỖI. */
    const d = cayTam({
      'tests/e.spec.ts': `${HEAD}const RE = /x/;\ntest('thật', () => { expect(RE.test('App là ant-design')).toBe(false); });\n`,
    });
    const r = chay(['--enforce'], d);
    expect(r.code, r.out).toBe(0);
    expect(ar.testKhongAssert("const RE=/x/;\nif (RE.test('abc')) {}\n"),
      'không có test nào thì không được sinh finding nào').toEqual([]);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ÂM BẢN ②: `test(` nằm TRONG CHUỖI fixture không được cắt ngắn thân test', () => {
    const than = ar.testKhongAssert(
      `${HEAD}test('ngoài', () => {\n  const fx = "test('trong', () => {})";\n  expect(fx).toBeTruthy();\n});\n`,
    );
    expect(than, 'test ngoài CÓ expect, và `test(` trong chuỗi không phải một test').toEqual([]);
  });

  test('ÂM BẢN ③: regex literal chứa dấu nháy không được nuốt `expect(`', () => {
    /*
     * Ca thật: `ci-config-valid.spec.ts` có `/^['"|>&*]/` rồi `expect(bad, …)` cách 5 dòng. Bộ xoá chuỗi
     * bản đầu vào trạng thái chuỗi ở dấu `'` trong regex và xoá trắng tới dấu `'` kế tiếp.
     */
    const src = `${HEAD}test('x', () => {\n  const s = '- a: b';\n  if (/^['"|>&*]/.test(s)) return;\n  expect(s).toContain('a');\n});\n`;
    expect(ar.testKhongAssert(src), 'regex có dấu nháy không được làm mất expect').toEqual([]);
    const blank = ar.xoaRuotChuoi(src);
    expect(blank.length, 'bản làm trắng phải GIỮ NGUYÊN độ dài để chỉ số còn trỏ đúng').toBe(src.length);
    expect(blank.split('\n').length, 'và giữ nguyên số dòng').toBe(src.split('\n').length);
    expect(blank, 'phải còn `expect(` thật').toContain('expect(');
  });

  test('hard-sleep: 1–5s bị bắt; <1s và ≥5s thì KHÔNG (≥5s là của lint:locator)', () => {
    const d = cayTam({
      'tests/f.spec.ts': `${HEAD}test('x', async ({ page }) => {\n  await page.waitForTimeout(300);\n  await page.waitForTimeout(6000);\n  await expect(page).toHaveTitle('X');\n});\n`,
    });
    const r0 = chay(['--enforce'], d);
    expect(r0.code, `<1s và >=5s KHÔNG thuộc luật này:\n${r0.out}`).toBe(0);
    fs.writeFileSync(path.join(d, 'tests/f.spec.ts'),
      `${HEAD}test('x', async ({ page }) => {\n  await page.waitForTimeout(2000);\n  await expect(page).toHaveTitle('X');\n});\n`, 'utf8');
    const r1 = chay(['--enforce'], d);
    expect(r1.code, r1.out).toBe(1);
    expect(r1.out).toContain('hard-sleep');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('hard-sleep: marker CÓ LÝ DO thì bỏ qua, marker TRỐNG thì không', () => {
    const than = (mk: string) => `${HEAD}test('x', async ({ page }) => {\n  ${mk}\n  await page.waitForTimeout(2000);\n  await expect(page).toHaveTitle('X');\n});\n`;
    const d1 = cayTam({ 'tests/g.spec.ts': than('// auto-review-disable-next-line postback Telerik sinh lại captcha') });
    expect(chay(['--enforce'], d1).code, 'có lý do ⇒ bỏ qua').toBe(0);
    const d2 = cayTam({ 'tests/g.spec.ts': than('// auto-review-disable-next-line') });
    expect(chay(['--enforce'], d2).code, 'marker TRỐNG ⇒ vẫn tính vi phạm').toBe(1);
    [d1, d2].forEach((d) => fs.rmSync(d, { recursive: true, force: true }));
  });

  test('cred-literal: mật khẩu viết thẳng bị bắt, `process.env` thì KHÔNG', () => {
    /*
     * Fixture CỐ Ý dùng `APP_PASSWORD`, không phải `OPS_PASSWORD`. `ci:scope` tìm spec chạm UAT bằng cách
     * quét `process.env.<TÊN>` rồi so với tiền tố `OPS_`/`LMS_`, nên bản đầu của fixture này bị nó xếp là
     * spec drive UAT. Lần thứ ba trong cùng một phiên một CHUỖI MẪU làm gate quét-chữ báo oan (trước đó:
     * mệnh đề import ở `old-project-refs.spec.ts`, và `test(` trong chuỗi ở chính gate `auto:review`).
     * Bài học chung: fixture của test gate phải tránh ĐÚNG những chuỗi mà các gate khác đang quét.
     */
    const d = cayTam({
      'tests/h.spec.ts': `${HEAD}const pass = process.env.APP_PASSWORD;\ntest('x', async () => { expect(pass).toBeDefined(); });\n`,
    });
    expect(chay(['--enforce'], d).code, 'đọc từ env là ĐÚNG, không được bắt').toBe(0);
    fs.writeFileSync(path.join(d, 'tests/h.spec.ts'),
      `${HEAD}const password = 'Abc12345';\ntest('x', async () => { expect(password).toBeDefined(); });\n`, 'utf8');
    const r = chay(['--enforce'], d);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('cred-literal');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('vacuous-url: `toHaveURL(/./)` bị bắt, đường dẫn cụ thể thì KHÔNG', () => {
    const d = cayTam({
      'tests/i.spec.ts': `${HEAD}test('x', async ({ page }) => { await expect(page).toHaveURL(/\\/hoc-sinh\\/danh-sach/); });\n`,
    });
    expect(chay(['--enforce'], d).code, 'URL cụ thể là ĐÚNG').toBe(0);
    fs.writeFileSync(path.join(d, 'tests/i.spec.ts'),
      `${HEAD}test('x', async ({ page }) => { await expect(page).toHaveURL(/./); });\n`, 'utf8');
    const r = chay(['--enforce'], d);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('vacuous-url');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ÂM BẢN ④: luật quét mã task đã BỎ, và mã nguồn phải nói vì sao', () => {
    /* Giữ lời giải thích trong code: không có nó thì lần sau có người thêm lại đúng luật báo oan đó. */
    const src = fs.readFileSync(AR, 'utf8');
    expect(src, 'phải ghi lại ca báo oan ISO-8601/RFC-2119').toMatch(/ISO-8601/);
    expect(ar.CAN_NGUOI_XEM.join(' '), 'và chuyển việc đó cho người xem, không im lặng bỏ').toMatch(/task-specific|TASK-SPECIFIC/i);
  });
});

test.describe('@infra auto:review — hai tầng, nợ có số, và cây không-git', () => {
  test('nợ khai đủ ⇒ ĐẠT; thêm MỘT cái mới ⇒ CHẶN', () => {
    const than = (n: number) => `${HEAD}test('x', async ({ page }) => {\n${'  await page.waitForTimeout(2000);\n'.repeat(n)}  await expect(page).toHaveTitle('X');\n});\n`;
    const d = cayTam({ 'tests/j.spec.ts': than(2) }, { 'tests/j.spec.ts': 2 });
    /* Cây tạm KHÔNG phải repo git ⇒ tầng `khong-phan-duoc` ⇒ không chặn. Dựng git để test tầng nợ. */
    spawnSync('git', ['init', '-q'], { cwd: d });
    spawnSync('git', ['add', '.'], { cwd: d });
    const r0 = chay(['--enforce'], d);
    expect(r0.code, `nợ khai 2, thực 2 ⇒ ĐẠT:\n${r0.out}`).toBe(0);

    fs.writeFileSync(path.join(d, 'tests/j.spec.ts'), than(3), 'utf8');
    spawnSync('git', ['add', '.'], { cwd: d });
    const r1 = chay(['--enforce'], d);
    expect(r1.code, r1.out).toBe(1);
    expect(r1.out, 'phải nói rõ có bao nhiêu cái MỚI so với nợ khai').toMatch(/nợ vượt khai|cái MỚI/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('nợ GIẢM ⇒ cảnh báo hạ số, không để con số cao hơn thực tế', () => {
    const d = cayTam({ 'tests/k.spec.ts': `${HEAD}test('x', async ({ page }) => { await expect(page).toHaveTitle('X'); });\n` },
      { 'tests/k.spec.ts': 3 });
    spawnSync('git', ['init', '-q'], { cwd: d });
    spawnSync('git', ['add', '.'], { cwd: d });
    const r = chay([], d);
    expect(r.out, 'nợ khai 3 mà thực 0 ⇒ phải nhắc hạ số').toMatch(/nợ đã GIẢM/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('file CHƯA TRACK không chặn — gate không được làm con tin của WIP người khác', () => {
    /*
     * Số đo lúc dựng: 169 file dưới `tests/**` có `console.log` là file CHƯA track (probe/chẩn đoán của
     * người đang làm task), chỉ 9 file track có. Chặn theo cả cây thì gate đỏ vì việc của người khác.
     */
    const d = cayTam({ 'tests/l.spec.ts': `${HEAD}test('rỗng', async ({ page }) => { await page.goto('/x'); });\n` });
    spawnSync('git', ['init', '-q'], { cwd: d });   // KHÔNG `git add` ⇒ file ở tầng wip
    const r = chay(['--enforce'], d);
    expect(r.code, `file chưa track KHÔNG được chặn:\n${r.out}`).toBe(0);
    expect(r.out).toMatch(/wip 1|wip [1-9]/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('KHÔNG phải repo git ⇒ coi cả `tests/**` là tầng CHẶN (đó là hình dạng bản đóng gói)', () => {
    /*
     * Bản đầu của gate trả nhãn "không phán được" rồi bỏ qua, vì "không biết file nào là WIP". Lý lẽ đó bỏ
     * qua cây không-git LÀ CÁI GÌ: `package:kit` chỉ ship file được git track, nên trong gói không có WIP —
     * `tests/**` ở đó chính là suite dùng chung. Chặn mới đúng, và nhờ vậy `release:verify` thật sự gác.
     */
    const d = cayTam({ 'tests/m.spec.ts': `${HEAD}test('rỗng', async ({ page }) => { await page.goto('/x'); });\n` });
    const r = chay(['--enforce'], d);
    expect(r.out, 'phải nói rõ vì sao coi cả cây là tầng chặn').toMatch(/bản ĐÃ ĐÓNG GÓI/);
    expect(r.code, r.out).toBe(1);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('thiếu `auto_review.json` ⇒ KÊU "CHƯA ĐƯỢC GÁC", không im lặng', () => {
    const d = cayTam({ 'tests/n.spec.ts': `${HEAD}test('x', async ({ page }) => { await expect(page).toHaveTitle('X'); });\n` });
    fs.rmSync(path.join(d, '.agent/config/auto_review.json'));
    const r = chay([], d);
    expect(r.out, 'ba nước của config_load: thiếu thì phải kêu').toMatch(/CHƯA ĐƯỢC GÁC/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('`auto_review.json` HỎNG JSON ⇒ CHẶN, không coi như rỗng', () => {
    const d = cayTam({ 'tests/o.spec.ts': `${HEAD}test('x', async ({ page }) => { await expect(page).toHaveTitle('X'); });\n` });
    fs.writeFileSync(path.join(d, '.agent/config/auto_review.json'), '{ "hardSleepDebt": ', 'utf8');
    const r = chay([], d);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/HỎNG JSON/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('spec khai `@auto-review-probe:` CÓ LÝ DO thì không bị đòi assertion', () => {
    const d = cayTam({
      'tests/p.spec.ts': `/* @auto-review-probe: bản dò dữ liệu, in ứng viên cho người đọc */\n${HEAD}test('dump', async ({ page }) => { await page.goto('/x'); });\n`,
    });
    spawnSync('git', ['init', '-q'], { cwd: d });
    spawnSync('git', ['add', '.'], { cwd: d });
    const r = chay(['--enforce'], d);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/khai là bản DÒ/);

    /* Marker TRỐNG thì không được tính — y như `locator-lint-disable-next-line` không lý do. */
    fs.writeFileSync(path.join(d, 'tests/p.spec.ts'),
      `/* @auto-review-probe: */\n${HEAD}test('dump', async ({ page }) => { await page.goto('/x'); });\n`, 'utf8');
    spawnSync('git', ['add', '.'], { cwd: d });
    expect(chay(['--enforce'], d).code, 'marker trống ⇒ vẫn đòi assertion').toBe(1);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('mục "máy KHÔNG phán được" phải được IN RA, không chỉ nằm trong code', () => {
    /* Nếu nó không in ra thì người đọc tưởng gate đã phủ hết — đúng lớp "xanh mà không gác gì". */
    const r = chay([]);
    expect(r.out).toMatch(/Máy KHÔNG phán được/);
    for (const s of ar.CAN_NGUOI_XEM) expect(r.out).toContain(s.slice(0, 40));
  });
});
