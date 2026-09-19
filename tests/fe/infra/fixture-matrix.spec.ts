import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * @infra — hợp đồng của ma trận fixture (trục 4 nhánh × trục 5 trạng thái).
 * Luật cốt lõi: mỗi ô phải hoặc CÓ fixture, hoặc khai `na` **kèm lý do**. Ô để trống lặng lẽ chính là chỗ case
 * chìm vào SKIP rồi biến mất khỏi báo cáo — nguyên nhân tầm thường khiến hai trục này rò nhiều nhất.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-dynamic-require, global-require
const fx = require(path.resolve(__dirname, '../../../scripts/qa/fixture_matrix.js'));

const AXES = { branch: ['Bảo lưu', 'Gia hạn'], state: ['Chờ thanh toán', 'Đã hủy'] };
const audit = (cfg: any, recipes: string[] = [], stale = 30) =>
  fx.auditMatrix({ axes: AXES, ...cfg }, new Set(recipes), stale);

test.describe('@infra fixture_matrix — mỗi ô phải có fixture hoặc n/a có lý do', () => {
  test('ô trống là VẤN ĐỀ, không phải "chưa cần"', () => {
    const a = audit({ fixtures: [], na: [] });
    expect(a.cells).toHaveLength(4);
    expect(a.problems).toHaveLength(4);
    expect(a.problems[0]).toContain('chưa có fixture');
  });

  test('n/a KHÔNG lý do bị bắt (n/a không lý do là né, không phải quyết định)', () => {
    const a = audit({ na: [{ branch: 'Bảo lưu', state: 'Đã hủy', reason: '' }] });
    expect(a.problems.some((p: string) => p.includes('KHÔNG có lý do'))).toBe(true);
  });

  test('`how: recipe:<id>` trỏ recipe không tồn tại thì CHẶN', () => {
    const a = audit({ fixtures: [{ branch: 'Bảo lưu', state: 'Đã hủy', id: 'x', how: 'recipe:khong-co', verified: '2026-08-19' }] });
    expect(a.problems.some((p: string) => p.includes('recipe KHÔNG TỒN TẠI'))).toBe(true);
    const b = audit({ fixtures: [{ branch: 'Bảo lưu', state: 'Đã hủy', id: 'x', how: 'recipe:co-that', verified: '2026-08-19' }] }, ['co-that']);
    expect(b.problems.some((p: string) => p.includes('recipe KHÔNG TỒN TẠI'))).toBe(false);
  });

  test('fixture không ghi cách dựng / chưa verified / verified quá cũ → cảnh báo', () => {
    const noHow = audit({ fixtures: [{ branch: 'Bảo lưu', state: 'Đã hủy', id: 'x', verified: '2026-08-19' }] });
    expect(noHow.warnings.some((w: string) => w.includes('không ghi CÁCH dựng'))).toBe(true);
    const noVerified = audit({ fixtures: [{ branch: 'Bảo lưu', state: 'Đã hủy', id: 'x', how: 'tay' }] });
    expect(noVerified.warnings.some((w: string) => w.includes('chưa ghi'))).toBe(true);
    const old = audit({ fixtures: [{ branch: 'Bảo lưu', state: 'Đã hủy', id: 'x', how: 'tay', verified: '2020-01-01' }] });
    expect(old.warnings.some((w: string) => w.includes('quá 30 ngày'))).toBe(true);
  });

  /*
   * Ngày phải TÍNH THEO HÔM NAY, không ghi cứng.
   *
   * Bản đầu ghi `verified: '2026-08-19'`. Luật coi fixture quá 30 ngày là cũ, nên test này xanh cho
   * tới 18/09/2026 rồi tự đỏ sang ngày 19/09 — không ai sửa dòng code nào. Cùng lớp lỗi "kết quả phụ
   * thuộc môi trường chạy", ở đây môi trường là đồng hồ. Ca đối chứng ngay phía trên vẫn ghi cứng
   * `2020-01-01` và ĐÚNG phải ghi cứng, vì nó cần luôn luôn cũ để chứng minh cảnh báo có nổ.
   */
  const ngayGanDay = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  test('ma trận khai đủ (fixture + n/a có lý do) thì SẠCH', () => {
    const a = audit({
      fixtures: [
        { branch: 'Bảo lưu', state: 'Chờ thanh toán', id: 'a', how: 'tay', verified: ngayGanDay },
        { branch: 'Gia hạn', state: 'Chờ thanh toán', id: 'b', how: 'tay', verified: ngayGanDay },
      ],
      na: [
        { branch: 'Bảo lưu', state: 'Đã hủy', reason: 'môi trường không có bản ghi nào' },
        { branch: 'Gia hạn', state: 'Đã hủy', reason: 'môi trường không có bản ghi nào' },
      ],
    });
    expect(a.problems).toHaveLength(0);
    expect(a.warnings).toHaveLength(0);
  });
});
