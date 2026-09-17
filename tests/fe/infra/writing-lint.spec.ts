import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * `writing:lint` — output phải đọc như QA viết cho người đọc, không như máy sinh.
 *
 * File này khoá phần dễ trôi nhất của máy đó: luật cột "Kết quả mong đợi" của bảng testcase.
 *
 * ĐO 17/09/2026 trước khi nối: quét 26 bộ testcase thật, 2.449 ô Kết quả mong đợi, VI PHẠM 0. Ba tín
 * hiệu chất lượng khác cũng 0: ô không có giá trị cụ thể, ô mơ hồ không kèm số, ô ngắn dưới 15 ký tự.
 * Nên đây là phép kiểm PHÒNG NGỪA. Ghi rõ vì một gate bắt 0 lần rất dễ bị tưởng là gate hỏng, rồi bị
 * gỡ đi lúc dọn dẹp.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const MACHINE = path.join(REPO, 'scripts', 'qa', 'writing_lint.js');

function lint(file: string, profile = 'testcase') {
  const r = spawnSync(process.execPath, [MACHINE, file, '--profile', profile], {
    cwd: REPO, encoding: 'utf8', env: gateEnv(),
  });
  return { code: r.status === null ? 1 : r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

/** Bảng testcase tối thiểu, đủ cột để máy tìm được cột theo TÊN header. */
function tcFile(expectedCells: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wlint-'));
  const rows = expectedCells.map((c, i) => `| TC_${String(i + 1).padStart(3, '0')} | Chức năng | tag | Module | Tieu de case | Da dang nhap | data | 1. Mo man | ${c} | High |`);
  const md = [
    '# Bo testcase thu',
    '',
    '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
  const f = path.join(dir, 'bo-case.md');
  fs.writeFileSync(f, md, 'utf8');
  return f;
}

test.describe('@infra writing:lint — cột Kết quả mong đợi phải KIỂM ĐƯỢC', () => {
  test('ô nêu giá trị cụ thể thì QUA', () => {
    const f = tcFile([
      'Cot Paid Amount hien 2.000.000 va trang thai doi thanh Da thanh toan',
      'API GET /api/v1/orders/88213 tra paid_amount = 2000000',
    ]);
    const r = lint(f);
    expect(r.code, r.out).toBe(0);
  });

  test('ô mở đầu bằng "Hệ thống sẽ" thì CHẶN, và chỉ ra ĐÚNG DÒNG', () => {
    const f = tcFile([
      'Cot Paid Amount hien 2.000.000 va trang thai doi thanh Da thanh toan',
      'Hệ thống sẽ hiển thị đúng số tiền đã thanh toán cho người dùng xem',
    ]);
    const r = lint(f);
    expect(r.code).toBe(1);
    expect(r.out).toContain('Hệ thống sẽ');
    expect(r.out).toContain('dòng 6');
  });

  test('bắt đủ các mở đầu kể chuyện khác: Người dùng sẽ, Màn hình sẽ, Có thể', () => {
    for (const bad of ['Người dùng sẽ thấy thông báo thành công sau khi bấm Lưu lại',
      'Màn hình sẽ chuyển sang danh sách đơn hàng và hiển thị bản ghi mới',
      'Có thể thấy số tiền được cập nhật ở cột tương ứng trên lưới']) {
      const r = lint(tcFile([bad]));
      expect(r.code, `chưa chặn: ${bad}`).toBe(1);
      expect(r.out).toContain('phải là điều kiểm được');
    }
  });

  test('tìm cột theo TÊN header, không đếm cứng vị trí', () => {
    /*
     * Bộ cũ 9 cột, bộ mới 10. Đếm cứng vị trí là bẫy lệch chỉ số cột đã dính hai lần trong repo này,
     * nên máy phải đọc header rồi mới lấy chỉ số. Bảng dưới đây đảo thứ tự cột để chứng minh điều đó.
     */
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wlint2-'));
    const md = [
      '# Bo case thu tu cot khac',
      '',
      '| TC ID | Kết quả mong đợi | Các bước thực hiện | Ưu tiên |',
      '|---|---|---|---|',
      '| TC_001 | Hệ thống sẽ hiển thị đúng thông tin đơn hàng vừa tạo ra | 1. Mo man | High |',
      '',
    ].join('\n');
    const f = path.join(dir, 'dao-cot.md');
    fs.writeFileSync(f, md, 'utf8');
    const r = lint(f);
    expect(r.code).toBe(1);
    expect(r.out).toContain('Hệ thống sẽ');
  });

  test('file không có bảng testcase thì KHÔNG phán bừa', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wlint3-'));
    const f = path.join(dir, 'khong-bang.md');
    fs.writeFileSync(f, '# Ghi chu\n\nHệ thống sẽ chạy như mong đợi khi có đủ dữ liệu đầu vào hợp lệ.\n', 'utf8');
    const r = lint(f);
    /* Không có cột nào tên "Kết quả mong đợi" nên luật này không áp. Câu văn kia nằm ngoài bảng. */
    expect(r.out).not.toContain('phải là điều kiểm được');
  });
});
