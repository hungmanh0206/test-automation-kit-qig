import { test, expect } from '@playwright/test';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { gateEnv } from './_gate_env';

/*
 * @infra — BẢO TRÌ TRI THỨC. Kit chống rất tốt loại sai do BỊA (thiếu `source` ⇒ cấm ghi; bug chưa qua gate
 * ⇒ không được ghi). Loại còn lại khó hơn: **thông tin đúng lúc ghi, sai về sau, hoặc mâu thuẫn với thông
 * tin khác** — không gate nào phán được ngữ nghĩa, nên máy chỉ có thể buộc người xem lại.
 *
 * Ba lỗ đã đo 25/08/2026 và vá ở đây:
 *   ① 0 cơ chế phát hiện mâu thuẫn: hai rule active cùng module nói trái nhau thì agent dùng cái tìm thấy
 *      trước ⇒ oracle sai IM LẶNG (cả hai đều có `source`, đều qua validate).
 *   ② không có `invalid`: chỉ có `superseded` (rule đúng, nghiệp vụ đổi). Rule SAI TỪ ĐẦU trước đây gỡ bằng
 *      tay — không lệnh, không vết ai gỡ và vì sao.
 *   ③ `--stale` so `confirmed_at` với lần execute cuối ⇒ sửa nội dung mà KHÔNG bump `confirmed_at` thì
 *      không gì bắt. Vá bằng `content_sha` (seal), vì đó là thứ duy nhất phân biệt "đổi có chủ đích" với
 *      "ai đó sửa tay rồi quên".
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const DOMAIN = path.join(REPO, 'scripts/qa/domain_rules.js');

/*
 * Dùng SCHEMA THẬT: field phát biểu rule là `rule` (KHÔNG phải `statement`), và `confirmed_by` là bắt buộc.
 * Đây chính là chỗ bản đầu của tôi sai: heuristic đọc `d.statement` nên trên kho thật nó trích được 0 từ
 * và in "0 mâu thuẫn" — sạch vì MÙ. Fixture phải khớp schema thật, nếu không test cũng mù theo.
 */
const RULE = (over: Record<string, unknown> = {}) => ({
  id: 'BR-T-001',
  module: 'Payment',
  rule: 'Uu dai khuyen mai DUOC cong don voi uu dai hoc vien cu khi thanh toan',
  applies_when: 'Hoc vien co ma khuyen mai hop le',
  confirmed_by: 'BA',
  tags: ['discount'],
  version: 1,
  status: 'active',
  confirmed_at: '2026-08-01',
  source: 'FSD Payment v3',
  examples: [{ input: 'KM 10% + HV cu 5%', expected: 'giam 15%' }],
  covered_by: ['OPS_PAY_TC_001'],
  ...over,
});

const store = (rules: Record<string, unknown>[]) => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'know-')), 'domain');
  fs.mkdirSync(dir, { recursive: true });
  for (const r of rules) fs.writeFileSync(path.join(dir, `${r.id}.json`), `${JSON.stringify(r, null, 2)}\n`);
  return dir;
};

const run = (dir: string, args: string[] = []) => {
  const r = spawnSync(process.execPath, [DOMAIN, '--dir', dir, ...args], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

test.describe('@infra domain:check --conflict — hai rule active nói trái nhau', () => {
  test('cùng module + cùng câu + trái chiều phủ định ⇒ NÊU NGHI VẤN', () => {
    const dir = store([
      RULE({ id: 'BR-T-001' }),
      RULE({ id: 'BR-T-002', rule: 'Uu dai khuyen mai KHONG duoc cong don voi uu dai hoc vien cu khi thanh toan' }),
    ]);
    const r = run(dir, ['--conflict']);
    expect(r.out).toContain('NGHI MÂU THUẪN');
    expect(r.out, 'phải nói rõ 3 đường xử lý: invalid / superseded / ghi điều kiện áp dụng').toMatch(/invalid[\s\S]{0,200}superseded/);
  });

  test('cùng module nhưng KHÁC chủ đề ⇒ KHÔNG báo oan (dù một bên có từ phủ định)', () => {
    // Bản đầu gộp cả `tags` + `title` vào từ khoá chủ đề ⇒ trùng tag `discount` + động từ chung `nhan`
    // ("ghi nhan" vs "xac nhan") là đủ để báo oan. Nay chỉ lấy từ trong `statement`, và đòi cả TỈ LỆ trùng.
    const dir = store([
      RULE({ id: 'BR-T-003', rule: 'Khoan thu vuot duoc ghi nhan de hoan tra hoc vien' }),
      RULE({ id: 'BR-T-004', rule: 'Hoa don KHONG duoc xuat khi don chua xac nhan' }),
    ]);
    expect(run(dir, ['--conflict']).out, 'gate báo oan là gate sẽ bị tắt').not.toContain('NGHI MÂU THUẪN');
  });

  test('rule đã superseded KHÔNG bị đem so (chỉ so bản đang hiệu lực)', () => {
    const dir = store([
      RULE({ id: 'BR-T-005' }),
      RULE({ id: 'BR-T-006', status: 'superseded', rule: 'Uu dai khuyen mai KHONG duoc cong don voi uu dai hoc vien cu khi thanh toan' }),
    ]);
    expect(run(dir, ['--conflict']).out).not.toContain('NGHI MÂU THUẪN');
  });

  test('chỉ CẢNH BÁO, không chặn — máy không phán đúng/sai ngữ nghĩa', () => {
    const dir = store([
      RULE({ id: 'BR-T-007' }),
      RULE({ id: 'BR-T-008', rule: 'Uu dai khuyen mai KHONG duoc cong don voi uu dai hoc vien cu khi thanh toan' }),
    ]);
    expect(run(dir, ['--conflict', '--enforce']).code, 'chặn theo heuristic ngữ nghĩa = báo oan có hệ thống').toBe(0);
  });
});

test.describe('@infra status invalid — rule SAI TỪ ĐẦU, khác superseded', () => {
  test('invalid mà thiếu `invalidated_reason` ⇒ CHẶN (gỡ oracle không được im lặng)', () => {
    const dir = store([RULE({ status: 'invalid', covered_by: ['T_TC_1', 'T_TC_2'] })]);
    const r = run(dir, ['--validate', '--enforce']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('invalidated_reason');
  });

  test('invalid đủ lý do ⇒ hợp lệ, và LIỆT KÊ TC phải REVIEW LẠI (không phải chỉ chạy lại)', () => {
    const dir = store([RULE({
      status: 'invalid',
      invalidated_reason: 'Doc nham bang FSD — dong do la vi du, khong phai rule',
      invalidated_at: '2026-08-20',
      covered_by: ['T_TC_3', 'T_TC_4'],
    })]);
    const r = run(dir, ['--validate']);
    expect(r.code, r.out).toBe(0);
    const full = run(dir, []);
    expect(full.out).toContain('REVIEW LẠI');
    expect(full.out, 'phải nêu đúng TC nào').toContain('T_TC_3');
  });

  test('`invalid` là trạng thái HỢP LỆ trong schema (không bị coi là status lạ)', () => {
    const src = fs.readFileSync(DOMAIN, 'utf8');
    expect(src).toMatch(/STATUSES = \[[^\]]*'invalid'/);
    // Và heuristic phải đọc ĐÚNG field của schema thật.
    expect(src, 'đọc `statement` là đọc field không tồn tại ⇒ gate mù').toMatch(/d\.rule \|\| d\.statement/);
  });
});

test.describe('@infra content_sha — sửa nội dung tại chỗ mà không bump confirmed_at', () => {
  test('seal rồi sửa `statement` ⇒ CHẶN, nói rõ cách xử lý', () => {
    const dir = store([RULE()]);
    expect(run(dir, ['--seal']).out).toContain('seal');
    const p = path.join(dir, 'BR-T-001.json');
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    d.rule = d.rule.replace('DUOC', 'KHONG duoc');   // đổi oracle, giữ nguyên confirmed_at
    fs.writeFileSync(p, `${JSON.stringify(d, null, 2)}\n`);

    const r = run(dir, ['--validate', '--enforce']);
    expect(r.code, 'đây chính là lỗ mà --stale không thấy').toBe(1);
    expect(r.out).toContain('ĐÃ ĐỔI sau lần seal');
    expect(r.out, 'phải chỉ đường ra: bump confirmed_at rồi seal lại').toMatch(/confirmed_at[\s\S]{0,120}--seal/);
  });

  test('seal xong KHÔNG sửa gì ⇒ im lặng (không báo oan mỗi lần chạy)', () => {
    const dir = store([RULE()]);
    run(dir, ['--seal']);
    const r = run(dir, ['--validate', '--enforce']);
    expect(r.code, r.out).toBe(0);
    expect(r.out).not.toContain('ĐÃ ĐỔI');
  });

  test('rule CHƯA seal ⇒ không chặn (kho cũ vẫn dùng được, seal là tiến hoá dần)', () => {
    const dir = store([RULE()]);
    const r = run(dir, ['--validate', '--enforce']);
    expect(r.code, 'bắt seal ngay là chặn toàn bộ kho hiện có').toBe(0);
  });

  test('seal LẠI sau khi đổi có chủ đích ⇒ hết chặn', () => {
    const dir = store([RULE()]);
    run(dir, ['--seal']);
    const p = path.join(dir, 'BR-T-001.json');
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    d.rule = 'Uu dai khuyen mai KHONG duoc cong don';
    d.confirmed_at = '2026-08-25';
    fs.writeFileSync(p, `${JSON.stringify(d, null, 2)}\n`);
    run(dir, ['--seal']);
    expect(run(dir, ['--validate', '--enforce']).code).toBe(0);
  });
});

test.describe('@infra tái xác nhận định kỳ — đã có sẵn, đừng làm trùng', () => {
  test('rule quá `--stale-months` ⇒ cảnh báo oracle có thể lạc hậu', () => {
    const dir = store([RULE({ confirmed_at: '2024-01-01' })]);
    const r = run(dir, ['--stale-months', '9']);
    expect(r.out).toMatch(/tháng trước.*chưa ai soi lại|lạc hậu/);
  });

  test('`--stale-months 0` phải có tác dụng (bẫy `Number(x) || 9`)', () => {
    const src = fs.readFileSync(DOMAIN, 'utf8');
    expect(src, 'dùng `|| 9` thì cờ 0 bị bỏ qua im lặng').toMatch(/rawMonths !== ''/);
  });
});

test.describe('@infra --conflict — điều kiện áp dụng khác nhau thì KHÔNG phải mâu thuẫn', () => {
  test('cùng chủ đề + trái chiều NHƯNG `applies_when` khác ⇒ không nghi (hai nhánh của một quy tắc)', () => {
    const dir = store([
      RULE({ id: 'BR-T-010', applies_when: 'Hoc vien VIP' }),
      RULE({
        id: 'BR-T-011',
        applies_when: 'Hoc vien thuong',
        rule: 'Uu dai khuyen mai KHONG duoc cong don voi uu dai hoc vien cu khi thanh toan',
      }),
    ]);
    expect(run(dir, ['--conflict']).out, 'điều kiện khác nhau là thiết kế, không phải xung đột').not.toContain('NGHI MÂU THUẪN');
  });

  test('cùng `applies_when` + trái chiều ⇒ VẪN nghi', () => {
    const dir = store([
      RULE({ id: 'BR-T-012' }),
      RULE({ id: 'BR-T-013', rule: 'Uu dai khuyen mai KHONG duoc cong don voi uu dai hoc vien cu khi thanh toan' }),
    ]);
    expect(run(dir, ['--conflict']).out).toContain('NGHI MÂU THUẪN');
  });
});
