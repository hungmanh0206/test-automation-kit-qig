import { test, expect } from '@playwright/test';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { gateEnv } from './_gate_env';

/*
 * @infra — SQL KÈM TESTCASE (dự án nặng CSDL).
 *
 * Vì sao có file này: đặt câu truy vấn sẵn trong ô để QA copy đi chạy tay là mở đúng hai đường lách
 * hai luật nặng nhất của kit, và cả hai đều KHÔNG nhìn ra bằng mắt khi bộ có vài trăm case:
 *   ① một câu `UPDATE`/`DELETE` lọt vào ô → QA chạy là MUTATE UAT (CLAUDE.md §2 cấm),
 *   ② `WHERE email = '…'` → PII khách nằm trong testcase rồi lên Google Sheet (CLAUDE.md §1 cấm).
 *
 * BA ÂM-TÍNH cũng quan trọng ngang phần chặn, vì gate hay báo oan thì bị tắt trong một ngày:
 *   - `SELECT` hợp lệ phải đi qua.
 *   - Câu tiếng Việt "Cập nhật đơn hàng" / "Xoá dòng" KHÔNG phải SQL.
 *   - **TRÍCH DẪN** hành vi của proc (`DELETE FROM …` trong ngoặc, không có marker chạy) phải đi qua.
 *     Ca thứ ba là ca thật: bản đầu của luật đã báo oan `CSDL_HS_TC_062`, nơi câu DELETE được trích để
 *     NÓI RA rằng proc xoá cứng và không dọn bảng liên quan — phát hiện có giá trị nhất của case đó.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const GATE = path.join(REPO, 'scripts/qa/output_gate.js');

const HEAD = [
  '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |',
  '|---|---|---|---|---|---|---|---|---|---|',
].join('\n');

/** Dựng 1 bộ testcase tối thiểu trong thư mục tạm rồi chạy gate đúng như pipeline chạy. */
function runGate(rows: string[][]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlgate-'));
  const file = path.join(dir, 'probe.md');
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  fs.writeFileSync(file, `# probe\n\n${HEAD}\n${body}\n`, 'utf8');
  try {
    const r = spawnSync(process.execPath, [GATE, '--mode', 'gen-testcase', '--file', file], {
      cwd: REPO, encoding: 'utf8', env: gateEnv() as NodeJS.ProcessEnv,
    });
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Một dòng testcase hợp lệ, chỉ thay phần bước và kết quả. */
const row = (id: string, tag: string, steps: string, expected: string) =>
  [id, 'Database', tag, 'Đơn', `${id} - kiểm bản ghi sau khi ghi dữ liệu`, '[api] Đã có khách', 'amount=540000', steps, expected, 'High'];

test.describe('@infra SQL kèm testcase — chặn câu GHI và PII, không chặn trích dẫn', () => {
  test('CHẶN: câu SQL GHI ở thế lệnh-để-chạy', () => {
    const r = runGate([row('BAD_TC_001', '[Positive][DbPersist]',
      "1. Chạy: UPDATE orders SET status = 'PAID' WHERE id = :orderId",
      '1. Trạng thái đổi sang PAID')]);
    expect(r.code, 'gate phải CHẶN khi testcase mời chạy câu ghi lên UAT').toBe(1);
    expect(r.out).toMatch(/SQL GHI ở thế lệnh-để-chạy/);
    expect(r.out).toMatch(/UPDATE/);
  });

  test('CHẶN: email thật trong câu SQL', () => {
    const r = runGate([row('BAD_TC_002', '[Positive][DbPersist]',
      "1. Chạy: SELECT id FROM customers WHERE email = 'nguyenvana@gmail.com'",
      '1. Trả về đúng 1 dòng')]);
    expect(r.code, 'PII khách trong testcase phải bị chặn').toBe(1);
    expect(r.out).toMatch(/email thật trong câu SQL/);
  });

  test('CHẶN: số điện thoại thật trong câu SQL', () => {
    const r = runGate([row('BAD_TC_003', '[Positive][DbPersist]',
      "1. Chạy: SELECT id FROM customers WHERE phone = '0912345678'",
      '1. Trả về đúng 1 dòng')]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/số điện thoại thật/);
  });

  test('ÂM TÍNH: SELECT hợp lệ đi qua', () => {
    const r = runGate([row('OK_TC_001', '[Positive][DbPersist]',
      '1. Tạo đơn trên UI<br>2. Chạy: SELECT final_price, deleted_at FROM orders WHERE id = :orderId',
      '1. Đơn hiện trong danh sách<br>2. final_price = 540000, deleted_at IS NULL')]);
    expect(r.code, 'truy vấn đọc hợp lệ không được chặn').toBe(0);
  });

  test('ÂM TÍNH: động từ tiếng Việt "cập nhật"/"xoá" không phải SQL', () => {
    const r = runGate([row('OK_TC_002', '[Positive]',
      '1. Bấm nút Cập nhật đơn hàng<br>2. Xoá dòng thứ hai khỏi lưới',
      '1. Báo lưu thành công<br>2. Lưới còn đúng 1 dòng')]);
    expect(r.code, 'tiếng Việt thường không được tính là SQL').toBe(0);
  });

  test('ÂM TÍNH: TRÍCH DẪN hành vi của proc không bị chặn (ca thật CSDL_HS_TC_062)', () => {
    const r = runGate([row('OK_TC_003', '[Negative][Impact]',
      '1. Tạo học sinh test rồi nhập điểm<br>2. Kích "Xóa học sinh", xác nhận',
      '1. Lưới hiện học sinh test<br>2. Dữ liệu liên quan phải được xử lý nhất quán. '
      + 'Đọc DB: proc `DeleteHocSinh` là XOÁ CỨNG (`DELETE FROM HOC_SINH`), 0 trigger, khoá ngoại `ON DELETE NO_ACTION`')]);
    expect(r.code, 'trích dẫn hành vi proc là phát hiện có giá trị, không phải lệnh mời chạy').toBe(0);
  });

  test('CẢNH BÁO (không chặn): có tag [DbPersist] mà không có SELECT nào để chạy tay', () => {
    const r = runGate([row('WARN_TC_001', '[Positive][DbPersist]',
      '1. Tạo đơn trên UI',
      '1. Đơn hiện trong danh sách, số tiền 540.000đ')]);
    expect(r.code, 'thiếu truy vấn chỉ là cảnh báo, không chặn').toBe(0);
    expect(r.out).toMatch(/không có câu `SELECT` nào để QA chạy tay/);
  });
});
