import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * @infra — verification THEO ASSERTION: điều kiện tiên quyết để gate "đủ assertion" được phép CHẶN.
 *
 * Đo trên bản ghi thật: 68% case ghi ít verification hơn số assertion — nhưng đó chỉ là **proxy** (`steps[]` là bằng
 * chứng theo *bước*). Có `assertions[]` rồi thì "assertion nào chưa ai kiểm" là **sự thật đọc được** ⇒ mới chặn được.
 */
const A = require(path.resolve(__dirname, '../../../scripts/lib/testcase/assertions.js'));

test.describe('@infra assertions — tách nguyên tử & chặn khi thiếu bằng chứng', () => {
  test('mỗi dòng expected = 1 assertion, bỏ số đầu dòng', () => {
    const d = A.deriveAssertions({ expectedRaw: '1. Tổng 540.000đ<br>2. Số dư giảm 540.000đ' });
    expect(d).toHaveLength(2);
    expect(d[0].text, 'số đánh dòng của format canonical không phải nội dung').toBe('Tổng 540.000đ');
    expect(d.every((x: any) => x.verified === false && x.evidence === null), 'khung sinh ra phải TRỐNG để người điền').toBe(true);
  });

  test('dòng NHỒI nhiều điều kiện bị đánh dấu, KHÔNG tự tách', () => {
    const d = A.deriveAssertions({ expectedRaw: '1. Format có dấu phân cách, và số dư giảm tương ứng' });
    expect(d).toHaveLength(1);
    expect(d[0].compound, 'phải nêu ra để Phase 1 tách nguyên tử').toBe(true);
    // Tự tách theo dấu phẩy sẽ cắt sai đúng những câu có số:
    const money = A.deriveAssertions({ expectedRaw: '1. Tổng 1.234.567đ, đúng định dạng' });
    expect(money).toHaveLength(1);
  });

  test('verified=true mà thiếu evidence ⇒ CHẶN', () => {
    const r = A.auditCase({ tcId: 'T', assertions: [{ text: 'a', verified: true }] });
    expect(r.blocking.join(' ')).toMatch(/KHÔNG có evidence/);
  });

  test('chưa verified mà không nêu lý do ⇒ CHẶN; có lý do ⇒ chỉ cảnh báo', () => {
    expect(A.auditCase({ tcId: 'T', assertions: [{ text: 'a', verified: false }] }).blocking).toHaveLength(1);
    const withNote = A.auditCase({ tcId: 'T', assertions: [{ text: 'a', verified: false, note: 'BA chưa cấp oracle' }] });
    expect(withNote.blocking).toHaveLength(0);
    expect(withNote.warnings.join(' ')).toMatch(/BA chưa cấp oracle/);
  });

  test('case ĐỦ bằng chứng thì sạch (chống báo oan)', () => {
    const r = A.auditCase({ tcId: 'T', assertions: [{ text: 'a', verified: true, evidence: 'x.png' }, { text: 'b', verified: true, evidence: 'y.png' }] });
    expect(r.blocking).toEqual([]);
    expect(r.covered).toBe(2);
    expect(r.total).toBe(2);
  });

  test('bản ghi CŨ (không có assertions[]) KHÔNG bị phạt, nhưng phải báo tỉ lệ áp dụng', () => {
    const r = A.auditExecution([{ tcId: 'old', status: 'PASSED', steps: [{}] }]);
    expect(r.blocking).toEqual([]);
    expect(r.withData).toBe(0);
    expect(r.adoption).toBe(0);
  });

  test('trộn cũ và mới: chỉ case có dữ liệu mới bị chặn, và tỉ lệ tính đúng', () => {
    const r = A.auditExecution([
      { tcId: 'old', status: 'PASSED' },
      { tcId: 'new', status: 'PASSED', assertions: [{ text: 'a', verified: true, evidence: 'e.png' }, { text: 'b', verified: false }] },
    ]);
    expect(r.withData).toBe(1);
    expect(r.all).toBe(2);
    expect(r.adoption).toBe(50);
    expect(r.coverage).toBe(50);
    expect(r.blocking).toHaveLength(1);
  });
});
