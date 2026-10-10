import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — QUY ƯỚC PLAYWRIGHT (v2.5.0 G1.5): quy ước không có máy gác thì sau vài sprint không còn ai theo.
 *
 * PHÉP ĐO ĐÃ THU HẸP HẠNG MỤC NÀY ĐÁNG KỂ. Kế hoạch G1.5 liệt kê 7 quy ước "đo được" để giao cho
 * `auto:review`. Đo lại trên repo trước khi viết:
 *   · `test.skip()` thiếu lý do — **0 ca**;
 *   · tên test chỉ là mã TC trần — **0 ca**;
 *   · `test.only` lọt — đã có `ci:scope` gác từ trước;
 *   · selector dễ vỡ không ghi chú — đã có `lint:locator` gác (marker bắt buộc có lý do);
 *   · "chuẩn hoá khoảng trắng trước khi so text" — KHÔNG đo được bằng tĩnh mà không đoán, nên nó ở lại
 *     dạng quy ước kèm lý do, không dựng gate giả.
 * Còn đúng MỘT quy ước vừa đo được vừa chưa có máy: spec gọi `page.locator` trực tiếp.
 *
 * PHÉP KIỂM CHỐNG TRÔI quan trọng nhất ở đây không phải một luật lint mới, mà là: **mọi câu "⚙️ Máy:
 * `npm run X`" trong tài liệu phải trỏ tới lệnh CÓ THẬT.** Tài liệu hứa có máy gác mà lệnh không tồn tại
 * thì người đọc tin là đã được gác — cùng lớp lỗi với "hai tài liệu dạy sai số cột" ở G4.1.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const DOC = path.join(REPO, '.agent/rules/playwright_fe.md');
const AR = path.join(REPO, 'scripts/qa/automation_review.js');

test.describe('@infra quy ước Playwright — tài liệu không được hứa máy gác không có', () => {
  test('mọi `npm run X` nhắc trong tài liệu đều là script CÓ THẬT', () => {
    const doc = fs.readFileSync(DOC, 'utf8');
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    const co = new Set(Object.keys(pkg.scripts || {}));
    /*
     * Kit viết tên script dạng `` `auto:review` ``, không dạng `npm run auto:review` — bản đầu của phép
     * quét này chỉ tìm `npm run …` nên nó thấy 0 lệnh và báo oan "tài liệu không trỏ tới máy nào".
     * Neo vào HÌNH DẠNG tên script của kit (có dấu hai chấm) thay vì vào một cách viết.
     */
    const nhac = [...doc.matchAll(/`([a-z][a-z0-9_-]*:[a-z0-9:_-]+)/g)].map((m) => m[1]);
    expect(nhac.length, 'tài liệu phải thật sự trỏ tới máy, không chỉ dặn suông').toBeGreaterThan(3);
    const thieu = [...new Set(nhac)].filter((s) => !co.has(s));
    expect(thieu, 'tài liệu hứa có máy gác mà lệnh không tồn tại ⇒ người đọc tin là đã được gác').toEqual([]);
  });

  test('mọi rule id nhắc trong tài liệu đều có trong `auto:review`', () => {
    /* Cùng lý do: nhắc tên một rule không tồn tại thì người đọc đi tìm và mất lòng tin cả trang. */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RULES } = require('../../../scripts/qa/automation_review.js');
    const co = new Set(RULES.map((r: { id: string }) => r.id));
    const doc = fs.readFileSync(DOC, 'utf8');
    const nhac = [...doc.matchAll(/rule `([a-z-]+)`/g)].map((m) => m[1]);
    expect(nhac.length).toBeGreaterThan(0);
    expect(nhac.filter((x) => !co.has(x)), 'rule nhắc trong tài liệu phải có thật').toEqual([]);
  });

  test('phần BỎ của G1.5 đã thật sự bỏ', () => {
    const doc = fs.readFileSync(DOC, 'utf8');
    /* Viewport riêng cho Playwright MCP: bỏ, và v2.6.0 còn cấm dùng MCP để bò UI. */
    expect(doc, 'không còn dặn resize cho Playwright MCP').not.toMatch(/Playwright MCP, resize/);
    /* Allure: không bắt buộc reporter ngoài nào. */
    expect(doc).toMatch(/Không bắt buộc Allure/);
  });

  test('giới hạn phạm vi được NÓI THẲNG: chỉ Playwright, mobile chỉ mobile-web', () => {
    /*
     * Nói ra chỗ này rẻ hơn nhiều so với để người dùng tự phát hiện sau khi đã dựng xong profile và viết
     * xong một nửa bộ case.
     */
    const doc = fs.readFileSync(DOC, 'utf8');
    expect(doc).toMatch(/chỉ dành cho \*\*Playwright\*\*/);
    expect(doc).toMatch(/mobile-web/);
    expect(doc, 'phải nói rõ là KHÔNG có Selenium/Appium, không để người đọc tự suy').toMatch(/Không có Selenium/);
  });

  test('quy ước nào KHÔNG đo được thì ghi lý do, không dựng gate giả', () => {
    /*
     * "Chuẩn hoá khoảng trắng trước khi so text" là quy ước thật và có lý do thật (dấu tiếng Việt tổ hợp
     * khác cách cho hai chuỗi hiển thị y hệt mà khác byte). Nhưng phát hiện nó bằng phân tích tĩnh thì
     * phải đoán "chuỗi này đến từ app hay từ spec", nên kit KHÔNG dựng gate cho nó.
     */
    const doc = fs.readFileSync(DOC, 'utf8');
    expect(doc).toMatch(/normalize\('NFC'\)/);
    expect(doc, 'phải nói VÌ SAO cần chuẩn hoá, không chỉ ra lệnh').toMatch(/khác nhau về byte/);
  });
});

test.describe('@infra auto:review — rule `spec-page-locator`', () => {
  function chay(files: Record<string, string>, argv: string[]) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pwconv-'));
    for (const [rel, body] of Object.entries(files)) {
      const p = path.join(d, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, body, 'utf8');
    }
    fs.mkdirSync(path.join(d, '.agent/config'), { recursive: true });
    fs.writeFileSync(path.join(d, '.agent/config/auto_review.json'), JSON.stringify({ hardSleepDebt: {} }), 'utf8');
    const r = spawnSync(process.execPath, [AR, '--repo', d, ...argv], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, d };
  }

  const SPEC = "import { test, expect } from '@playwright/test';\ntest('x', async ({ page }) => {\n  await expect(page.locator('#a')).toBeVisible();\n});\n";

  test('bắt ở tầng TASK, KHÔNG bắt ở suite dùng chung', () => {
    /*
     * Vì sao `taskOnly`: đo được ở suite dùng chung chỉ ~6 lượt `page.locator`, và cả 6 nằm trong spec có
     * việc kiểm CHÍNH bộ locator (`safe-target`, `screen-snapshot`, `geometry`). Gắn cờ chúng là sai —
     * spec kiểm bộ locator thì phải gọi locator.
     */
    const r1 = chay({ 'tests/a.spec.ts': SPEC }, ['--include-tasks']);
    expect(r1.out, 'suite dùng chung KHÔNG bị bắt').not.toContain('spec-page-locator');
    fs.rmSync(r1.d, { recursive: true, force: true });

    const r2 = chay({ 'outputs/P/tasks/T/automation/b.spec.ts': SPEC }, ['--include-tasks']);
    expect(r2.out, 'tầng task thì bắt').toContain('spec-page-locator');
    fs.rmSync(r2.d, { recursive: true, force: true });
  });

  test('chỉ bắt trong `*.spec.ts` — helper của task thì KHÔNG', () => {
    const r = chay({ 'outputs/P/tasks/T/automation/helper.ts': SPEC }, ['--include-tasks']);
    expect(r.out, 'helper được phép giữ locator, đó chính là chỗ nó nên nằm').not.toContain('spec-page-locator');
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('là P1 và KHÔNG chặn — 1381 dòng không phải 1381 lỗi', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RULES } = require('../../../scripts/qa/automation_review.js');
    const r = RULES.find((x: { id: string }) => x.id === 'spec-page-locator');
    expect(r, 'rule phải tồn tại').toBeTruthy();
    expect(r.sev, 'P0 ở đây sẽ chặn 254/354 spec ngay ngày đầu, và gate sẽ bị tắt').toBe('P1');
    const z = chay({ 'outputs/P/tasks/T/automation/b.spec.ts': SPEC }, ['--include-tasks', '--enforce']);
    expect(z.code, 'P1 ở tầng task thì không được chặn').toBe(0);
    fs.rmSync(z.d, { recursive: true, force: true });
  });

  test('KHÔNG hiện khi chưa `--include-tasks` — nợ cũ không làm ngập báo cáo thường', () => {
    const r = spawnSync(process.execPath, [AR], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(`${r.stdout}${r.stderr}`).not.toContain('spec-page-locator');
  });

  test('số đo trong rule khớp số gate TỰ đếm trên repo', () => {
    /*
     * Neo con số vào máy. `why` của rule ghi 1381 — nếu repo đổi mà con số trong chữ không đổi thì tài
     * liệu thành sai, đúng lớp lỗi G4.1. Cho sai số ±10% để một vài spec mới không làm đỏ oan.
     */
    const r = spawnSync(process.execPath, [AR, '--include-tasks'], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    const m = /P1\s+(\d+)\s+spec-page-locator/.exec(`${r.stdout}${r.stderr}`);
    if (!m) { test.skip(true, 'máy này không có spec theo task (lớp PROJECT)'); return; }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RULES } = require('../../../scripts/qa/automation_review.js');
    const khai = Number((/(\d+) lượt ở/.exec(RULES.find((x: { id: string }) => x.id === 'spec-page-locator').why) || [])[1]);
    const thuc = Number(m[1]);
    expect(Math.abs(thuc - khai) / khai, `rule khai ${khai} lượt, gate đếm ${thuc} ⇒ cập nhật con số trong \`why\``).toBeLessThan(0.1);
  });
});
