import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * @infra — LUẬT ORACLE của phần mở rộng quanh case, và độ sâu theo risk band.
 *
 * Đây là chốt chặn quan trọng nhất của cả ý tưởng 5 trục: mở sang field/bề mặt lân cận mà không có nguồn thì kit
 * sẽ mặc định "app đang hiện thế là đúng" ⇒ tautology nhân theo số trục, tạo ra **PASS giả nhìn rất thuyết phục**.
 * Test dưới đây khoá đúng ranh giới đó.
 */

const L = (p: string) => require(path.resolve(__dirname, '../../../scripts/lib/expansion', p));
const fnd = L('finding');
const depth = L('depth');

test.describe('@infra luật oracle — nhất quán KHÔNG phải bằng chứng của đúng', () => {
  test('bẫy PASS giả (ca thật CSDL-28403): 4 điểm khớp nhau, không neo ⇒ OBSERVATION', () => {
    // form/payload/api/ui đều = 10 trong khi giá trị ĐÚNG là 260.500 (USD không quy đổi).
    const f = fnd.makeFinding({ axis: 'persist', base_tc: 'OPS_PAY_TC_363', surface: 'form→payload→api→ui', expected: '10', actual: '10' });
    expect(f.verdict, 'khớp mà không có oracle thì KHÔNG được PASS').toBe('OBSERVATION');
    expect(f.downgraded).toBe('PASS→OBSERVATION');
    expect(String(f.open_question)).not.toHaveLength(0);
  });

  test('app tự mâu thuẫn ⇒ EXPANSION_FINDING, KHÔNG cần oracle ngoài', () => {
    const f = fnd.makeFinding({ axis: 'surface', base_tc: 'X', surface: 'list vs detail', self_inconsistent: true, expected: '600.000đ', actual: '700.000đ' });
    expect(f.verdict).toBe('EXPANSION_FINDING');
    expect(f.oracle_ref, 'không bắt buộc có neo cho loại này').toBeNull();
  });

  test('có oracle hợp lệ mới ra PASS/FAIL', () => {
    const ok = fnd.makeFinding({ axis: 'field', expected: '700.000', actual: '700.000', oracle_ref: 'BR-BAOLUU-001' });
    expect(ok.verdict).toBe('PASS');
    const bad = fnd.makeFinding({ axis: 'field', expected: '700.000', actual: '0', oracle_ref: 'BR-BAOLUU-001' });
    expect(bad.verdict).toBe('FAIL');
    expect(bad.reason).toContain('BR-BAOLUU-001');
  });

  test('oracle_ref sai dạng bị BỎ, coi như không có neo (không nhận id tự bịa)', () => {
    for (const ref of ['theo tôi thấy', 'BR-001', 'FSD mục 4.2', 'BR-baoluu-001']) {
      const f = fnd.makeFinding({ axis: 'field', expected: '1', actual: '1', oracle_ref: ref });
      expect(f.verdict, `"${ref}" không được coi là oracle`).toBe('OBSERVATION');
      expect(f.oracle_invalid).toContain(ref);
    }
    // Các store hợp lệ: BR/SM/PM/SS/DM + UI (contract FE trích từ design)
    for (const ref of ['BR-TXN-004', 'SM-TXN-001', 'UI-CHECKOUT-001']) {
      expect(fnd.makeFinding({ axis: 'field', expected: '1', actual: '1', oracle_ref: ref }).verdict).toBe('PASS');
    }
  });

  test('audit bắt được file finding bị sửa tay để "lên" PASS', () => {
    const bad = fnd.auditFindings([
      { axis: '②surface', base_tc: 'T1', verdict: 'PASS', oracle_ref: null },
      { axis: '③persist', base_tc: 'T2', verdict: 'OBSERVATION' },                       // thiếu open_question
      { axis: '①field', base_tc: 'T3', verdict: 'ĐẠT' },                                  // verdict lạ
    ]);
    expect(bad).toHaveLength(3);
    expect(bad[0]).toContain('KHÔNG có oracle_ref');
    expect(bad[1]).toContain('open_question');
    expect(fnd.auditFindings([{ axis: '①field', verdict: 'PASS', oracle_ref: 'BR-X-001' }])).toHaveLength(0);
  });
});

test.describe('@infra độ sâu theo risk band (chi phí là thật)', () => {
  test('band lấy CÁI NẶNG HƠN giữa Mức độ rủi ro và Ưu tiên', () => {
    expect(depth.bandOf({ risk: 'Blocker', priority: 'Low' })).toBe('high');
    expect(depth.bandOf({ risk: 'Minor', priority: 'High' }), 'Minor mà Ưu tiên High vẫn là đường chính').toBe('high');
    expect(depth.bandOf({ risk: 'Major', priority: 'Medium' })).toBe('medium');
    expect(depth.bandOf({ risk: 'Minor', priority: 'Low' })).toBe('low');
    expect(depth.bandOf({}), 'thiếu cả hai cột ⇒ mỏng nhất, không tự cho là High').toBe('low');
  });

  test('high mở đủ trục runtime; medium/low thu hẹp', () => {
    const hi = depth.axesFor({ risk: 'Critical' });
    for (const a of ['field', 'surface', 'persist', 'concurrency', 'reverse']) expect(hi).toContain(a);
    expect(depth.axesFor({ risk: 'Major' })).toEqual(['persist', 'state']);
    expect(depth.axesFor({ risk: 'Minor', priority: 'Low' })).toEqual(['persist']);
  });

  test('ước lượng chi phí tăng theo band — để quyết TRƯỚC khi chạy', () => {
    const hi = depth.estimate([{ risk: 'Blocker' }]);
    const lo = depth.estimate([{ risk: 'Minor', priority: 'Low' }]);
    expect(hi.loads).toBeGreaterThan(lo.loads);
    expect(hi.shots).toBeGreaterThan(lo.shots);
    const many = depth.estimate(Array.from({ length: 100 }, () => ({ risk: 'Blocker' })));
    expect(many.mb, '100 case High phải ra con số MB đáng kể, không được ẩn chi phí').toBeGreaterThan(10);
  });

  test('④branch/⑤state được đánh dấu thuộc Phase 1 (đoán trước được từ tài liệu)', () => {
    expect(fnd.AXES.branch.phase, 'case ④ sinh được từ permission matrix ⇒ Phase 1').toBe(1);
    expect(fnd.AXES.state.phase, 'case ⑤ sinh được từ state machine ⇒ Phase 1').toBe(1);
    for (const a of ['field', 'surface', 'persist', 'concurrency', 'reverse']) {
      expect(fnd.AXES[a].phase, `${a} cần DOM/response thật ⇒ Phase 2`).toBe(2);
    }
  });
});
