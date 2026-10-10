import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — `skills:lint` (v2.5.0 G3.3): mô tả skill có ĐỦ THÔNG TIN ĐỂ CHỌN hay chưa?
 *
 * `skills:index --check` đã khoá rằng `INDEX.md` khớp cây và frontmatter có `name`/`description`. Nó KHÔNG
 * chấm chất lượng: một description 20 ký tự vẫn qua.
 *
 * Mà `description` là thứ DUY NHẤT agent đọc để quyết định có mở skill hay không — 25 skill của kit không
 * auto-load. Mô tả không nói được "dùng khi nào" thì skill đó không bao giờ được gọi, và 25 skill thành 25
 * file chết. Đây là kiểu hỏng IM LẶNG NHẤT trong kit: không gate nào đỏ, không ai báo lỗi, chỉ là công sức
 * viết skill không bao giờ sinh lợi.
 *
 * HAI MỨC, ranh giới là SỐ ĐO (10/10/2026, 25 skill): chặn được ngay những tiêu chí có ÍT ca
 * (description < 80 ký tự: 3 · mô tả trùng ≥ 0.30: **0 cặp** · con trỏ chết: 1), và để mức cảnh báo kèm nợ
 * khoá theo số lượng cho những tiêu chí có NHIỀU ca (thiếu "dùng khi" 17 · thiếu "KHÔNG dùng khi" 16 ·
 * không nhắc máy kiểm 13). Chặn ba cái sau là làm đỏ 17 skill ngay ngày đầu rồi gate bị tắt.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const SL = path.join(REPO, 'scripts/qa/skills_lint.js');

const FM = (desc: string, body = '') => `---
name: x_skill
description: ${desc}
---

# X Skill

## Purpose

Làm một việc cụ thể.
${body}`;

const DESC_OK = 'Làm một việc cụ thể và kiểm được bằng máy cho Phase 2. Dùng khi cần việc đó. KHÔNG dùng khi chưa có bộ testcase canonical.';

function chay(skills: Record<string, string>, argv: string[] = ['--enforce']) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sklint-'));
  for (const [ten, body] of Object.entries(skills)) {
    fs.mkdirSync(path.join(d, 'nhom', ten), { recursive: true });
    fs.writeFileSync(path.join(d, 'nhom', ten, 'SKILL.md'), body, 'utf8');
  }
  const r = spawnSync(process.execPath, [SL, '--dir', d, ...argv], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, d };
}

test.describe('@infra skills:lint — tiêu chí CHẶN', () => {
  test('description < 80 ký tự ⇒ CHẶN, và nói vì sao nó quan trọng', () => {
    const r = chay({ a: FM('Sinh test data.') });
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/ký tự < 80/);
    expect(r.out, 'phải nói đây là thứ DUY NHẤT agent đọc để chọn').toMatch(/DUY NHẤT agent đọc/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('hai mô tả GIỐNG NHAU ⇒ CHẶN — agent không có căn cứ để chọn', () => {
    const r = chay({ a: FM(DESC_OK), b: FM(DESC_OK) });
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/mô tả giống nhau 1\.00/);
    expect(r.out).toMatch(/không có căn cứ để chọn/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ÂM BẢN: hai mô tả khác nhau ⇒ KHÔNG chặn', () => {
    const r = chay({
      a: FM(DESC_OK),
      b: FM('Chặn response bằng page.route để cô lập dependency ngoài phạm vi. Dùng khi dependency không sẵn. KHÔNG dùng để mock chính logic đang kiểm thử.'),
    });
    expect(r.code, r.out).toBe(0);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('wikilink `[[x]]` trỏ skill KHÔNG tồn tại ⇒ CHẶN', () => {
    /*
     * Ca thật: `lighthouse_check` trỏ `[[accessibility_check]]` mà không có skill tên đó — nó là một
     * SCRIPT (`scripts/qa/accessibility_check.js`). Dùng sai dạng con trỏ thì người đọc đi tìm một skill
     * không tồn tại.
     */
    const r = chay({ a: FM(DESC_OK, '\n## Related\n\n- [[khong_ton_tai]] — gì đó.\n') });
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/không có skill tên này/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ÂM BẢN: wikilink trỏ skill CÓ thật ⇒ KHÔNG chặn', () => {
    const r = chay({
      a: FM(DESC_OK, '\n## Related\n\n- [[b]] — skill kia.\n'),
      b: FM('Việc khác hẳn: đọc log lượt chạy rồi khoanh nguyên nhân. Dùng khi một case đã đỏ. KHÔNG dùng khi chưa chạy lần nào.'),
    });
    expect(r.code, r.out).toBe(0);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('đường dẫn REPO chết ⇒ CHẶN; đường dẫn của TASK_OUTPUT_DIR thì KHÔNG', () => {
    /*
     * Đây là dương tính giả lớn nhất của bản đầu: nó kiểm mọi chuỗi có `/` và báo oan 14 ca —
     * `reports/phase1-summary.md`, `requirements/git-impact.md`, `reports/tc-review.md` là đường dẫn tương
     * đối với `<TASK_OUTPUT_DIR>`, chúng KHÔNG nên tồn tại trong repo.
     *
     * Nó còn báo oan một câu VĂN XUÔI: `ops-transactions.load/.stress/.soak.js` trong `load_check` là cách
     * viết gọn ba tên file ĐÃ BỊ GỠ, không phải một đường dẫn.
     */
    const task = chay({ a: FM(DESC_OK, '\n- Ghi ra `reports/phase1-summary.md` và `requirements/git-impact.md`.\n') });
    expect(task.code, `đường dẫn của task KHÔNG được đòi tồn tại trong repo:\n${task.out}`).toBe(0);
    fs.rmSync(task.d, { recursive: true, force: true });

    const repoChet = chay({ a: FM(DESC_OK, '\n- Máy: `scripts/qa/khong_ton_tai.js`.\n') });
    expect(repoChet.code, repoChet.out).toBe(1);
    expect(repoChet.out).toMatch(/đường dẫn không tồn tại/);
    fs.rmSync(repoChet.d, { recursive: true, force: true });

    const vanXuoi = chay({ a: FM(DESC_OK, '\n- Ba file đã gỡ: `ops-transactions.load/.stress/.soak.js`.\n') });
    expect(vanXuoi.code, `văn xuôi không phải đường dẫn:\n${vanXuoi.out}`).toBe(0);
    fs.rmSync(vanXuoi.d, { recursive: true, force: true });
  });
});

test.describe('@infra skills:lint — nợ khoá theo số lượng', () => {
  const THIEU = FM('Một mô tả đủ dài để qua ngưỡng tám mươi ký tự nhưng cố ý không nói rõ dùng vào lúc nào cả.');

  test('thiếu "dùng khi" / "KHÔNG dùng khi" / máy kiểm ⇒ CẢNH BÁO, không chặn', () => {
    const r = chay({ a: THIEU });
    expect(r.code, 'nợ cũ lớn nên ba tiêu chí này chỉ cảnh báo').toBe(0);
    expect(r.out).toMatch(/thiếu mục "dùng khi"/);
    expect(r.out).toMatch(/thiếu mục "KHÔNG dùng khi"/);
    expect(r.out).toMatch(/không nhắc máy kiểm nào/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('nợ VƯỢT số khai ⇒ CHẶN (nợ không được phình âm thầm)', () => {
    /* Cây tạm dùng config THẬT (nợ 15/15/13), nên 16 skill thiếu là vượt. */
    const nhieu: Record<string, string> = {};
    for (let i = 0; i < 16; i += 1) nhieu[`s${i}`] = FM(`Mô tả thứ ${i} đủ dài để qua ngưỡng tám mươi ký tự nhưng cố ý không nói rõ dùng lúc nào cả.`);
    const r = chay(nhieu);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/nợ khai 15 ⇒ 1 cái MỚI/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('miễn trừ máy kiểm phải CÓ LÝ DO — skill thuần phán đoán thì khai, đừng bịa gate', () => {
    const r = chay({ a: FM(DESC_OK, '\n> KHÔNG có máy kiểm vì đây là phân tích phán đoán, không có gì đo được bằng máy.\n') });
    /*
     * Khớp theo HÌNH DẠNG CÓ SỐ ĐẾM (`: N/M skill`), không khớp nhãn trần: dòng "nợ đã sạch ⇒ hạ về 0"
     * cũng chứa đúng nhãn đó, nên assertion lỏng sẽ đỏ trong khi gate làm đúng.
     */
    expect(r.out, 'khai rồi thì không bị tính là finding').not.toMatch(/không nhắc máy kiểm nào: \d+\/\d+ skill/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('nợ GIẢM ⇒ nhắc hạ số, để con số không nằm lại cao hơn thực tế', () => {
    const r = chay({ a: FM(DESC_OK, '\n- Máy: `npm run skills:lint`.\n') });
    expect(r.out).toMatch(/đã sạch \(khai 1[35]\) ⇒ hạ về 0|nợ đã GIẢM/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });
});

test.describe('@infra skills:lint — repo thật và giới hạn đã nói', () => {
  test('repo hiện tại: ĐẠT', () => {
    const r = spawnSync(process.execPath, [SL, '--enforce'], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
  });

  test('gate TỰ NÓI giới hạn: không chấm mô tả có ĐÚNG hay không', () => {
    /*
     * Không nói ra thì người đọc tin gate đã kiểm nội dung. Nó chỉ kiểm mô tả có ĐỦ THÔNG TIN ĐỂ CHỌN.
     */
    const r = spawnSync(process.execPath, [SL], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(`${r.stdout}${r.stderr}`).toMatch(/KHÔNG chấm mô tả có ĐÚNG hay không/);
  });

  test('0 skill ⇒ KHÔNG phán được, và nói rõ đây không phải đạt', () => {
    const r = chay({}, []);
    expect(r.out).toMatch(/KHÔNG phán được/);
    expect(r.out).toMatch(/không phải đạt/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('config ghi SỐ ĐO làm căn cứ cho từng mức, và `skills_lint.json` vào ALLOW', () => {
    const cfg = fs.readFileSync(path.join(REPO, '.agent/config/skills_lint.json'), 'utf8');
    expect(cfg, 'ngưỡng 80 phải có số đo: 3 skill dưới ngưỡng').toMatch(/chỉ 3 skill/);
    expect(cfg, 'ngưỡng trùng mô tả phải có số đo: 0 cặp').toMatch(/\*\*0 cặp\*\*/);
    expect(cfg, 'và nói rõ vì sao ba tiêu chí kia chỉ cảnh báo').toMatch(/17 skill thiếu/);
    const pk = fs.readFileSync(path.join(REPO, 'scripts/qa/package_kit.js'), 'utf8');
    expect(pk, '.agent/config/* là DENY mặc định — thiếu khai thì bản đóng gói báo CHƯA ĐƯỢC GÁC').toContain('.agent/config/skills_lint.json');
  });
});
