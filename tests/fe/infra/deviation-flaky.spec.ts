import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * @infra — hai cơ chế lọt bug mà kit chưa gác: **nhân nhượng** (agent làm cho nó chạy) và **flaky chôn bug thật**.
 */
const dev = require(path.resolve(__dirname, '../../../scripts/lib/expansion/deviation.js'));
const tax = require(path.resolve(__dirname, '../../../.agent/config/verdict_taxonomy.json'));

test.describe('@infra sổ nhân nhượng — deviation là TÍN HIỆU, không phải tiện lợi', () => {
  test('PASS mà sổ không rỗng ⇒ PASS_WITH_DEVIATION, và phải có dòng ghi vào Actual', () => {
    const led = dev.newLedger('T1');
    expect(led.verdict('PASS'), 'sổ rỗng thì PASS vẫn là PASS').toBe('PASS');
    led.note('extra-wait', 'chờ thêm 3s vì nút chưa enable');
    led.note('refresh', 'phải tải lại trang mới thấy dữ liệu');
    expect(led.verdict('PASS')).toBe('PASS_WITH_DEVIATION');
    expect(led.count()).toBe(2);
    expect(led.actualNote()).toContain('2 lần lệch kịch bản');
  });

  test('deviation KHÔNG làm đổi FAIL/SKIP (chỉ làm PASS đáng ngờ)', () => {
    const led = dev.newLedger('T2');
    led.note('retry', 'thử lại 2 lần');
    expect(led.verdict('FAIL')).toBe('FAIL');
    expect(led.verdict('SKIP')).toBe('SKIP');
  });

  test('audit chuẩn hoá status: bản ghi ghi PASSED vẫn phải được xét', () => {
    expect(dev.canonStatus('PASSED')).toBe('PASS');
    expect(dev.canonStatus('pass')).toBe('PASS');
    const w = dev.auditExecution([{ tcId: 'T3', status: 'PASSED', comment: 'phải chờ thêm 5s mới bấm được' }], {});
    expect(w, 'so thẳng với "PASS" từng bỏ qua sạch 563 case ghi PASSED').toHaveLength(1);
  });

  test('KHÔNG báo oan khi từ khoá là NỘI DUNG của chính case', () => {
    const cases = [{ tcId: 'T4', status: 'PASSED', comment: 'Retry sau sync fail: sửa Deal ID rồi đồng bộ lại — recover thành công' }];
    expect(dev.auditExecution(cases, {}), 'không đối chiếu kịch bản thì báo oan').toHaveLength(1);
    const withScript = { T4: { title: 'Retry đồng bộ sau khi fail', stepsRaw: '1. Nhập Deal sai 2. Retry với Deal đúng' } };
    expect(dev.auditExecution(cases, withScript), 'case VỀ retry thì retry không phải nhân nhượng').toHaveLength(0);
  });
});

test.describe('@infra flaky không được chôn bug thật', () => {
  test('taxonomy có SUSPECT_REAL_BUG và nó LOG ĐƯỢC bug', () => {
    const s = tax.statuses.SUSPECT_REAL_BUG;
    expect(s, 'phải có trạng thái riêng cho FAIL bất định chưa giải thích được').toBeTruthy();
    expect(s.loggableAsBug, 'chưa giải thích được cơ chế thì vẫn là nghi bug thật, không phải bỏ qua').toBe(true);
    expect(s.aio).toBe('Failed');
  });

  test('luật rerun đòi CƠ CHẾ trước khi được gọi là flaky', () => {
    expect(String(tax.rerun.flakyRequiresMechanism)).toMatch(/CƠ CHẾ/);
    expect(String(tax.rerun.flakyRequiresMechanism)).toMatch(/SUSPECT_REAL_BUG/);
  });

  test('PASS_WITH_DEVIATION map sang AIO Passed nhưng KHÔNG loggable, và nêu rõ phải liệt kê deviation', () => {
    const s = tax.statuses.PASS_WITH_DEVIATION;
    expect(s.aio).toBe('Passed');
    expect(s.loggableAsBug).toBe(false);
    expect(String(s.meaning)).toMatch(/liệt kê deviation/);
  });
});
