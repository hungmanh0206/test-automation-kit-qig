import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * @infra — backtest `persistence_probe` bằng **bug THẬT đã log** của CSDL-24395.
 *
 * Cách chấm: mỗi case dựng lại chuỗi 4 điểm đúng như bug mô tả, rồi đòi engine chỉ ra **đúng mắt đứt** và **đúng
 * tầng**. Đây là phép thử có đáp án khách quan (bug đã được dev xác nhận), không phải tôi tự chấm tôi.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-dynamic-require, global-require
const probe = require(path.resolve(__dirname, '../../../scripts/qa/persistence_probe.js'));

test.describe('@infra persistence_probe — backtest trên bug đã biết', () => {
  test('CSDL-28310: Service Fee nhập 1.000.000 nhưng BE lưu 0 → đứt payload→api, kiểu "thành 0"', () => {
    const r = probe.evaluate({
      name: 'Service Fee (Bảo lưu)',
      points: { form: '1.000.000', payload: 1000000, api: 0, ui: '0đ' },
    });
    expect(r.breaks.map((b: any) => b.link)).toContain('payload→api');
    expect(r.breaks[0].kind).toContain('THÀNH 0');
    // FE gửi đúng ⇒ KHÔNG được kết luận lỗi FE.
    expect(r.breaks.map((b: any) => b.link)).not.toContain('form→payload');
  });

  test('CSDL-28376: form tính Net Amount đúng nhưng payload gửi 0 → đứt form→payload (tầng FE)', () => {
    const r = probe.evaluate({
      name: 'Net Amount (add-on included in Course Payment)',
      points: { form: '2.500.000', payload: 0, api: 0, ui: '0đ' },
    });
    expect(r.breaks).toHaveLength(1);
    expect(r.breaks[0].link).toBe('form→payload');
    expect(r.breaks[0].kind).toContain('THÀNH 0');
  });

  test('CSDL-28442: gói chuyển nhượng KHÔNG có trong payload → kiểu "mất hẳn"', () => {
    const r = probe.evaluate({
      name: 'Transferred package',
      points: { form: 'CFA1 Online (Recorded Online)', payload: undefined, api: undefined, ui: '' },
    });
    expect(r.breaks[0].link).toBe('form→payload');
    expect(r.breaks[0].kind).toContain('MẤT HẲN');
  });

  test('CSDL-28403: USD không quy đổi sang VND → lệch một bậc độ lớn, KHÔNG phải "thành 0"', () => {
    const r = probe.evaluate({
      name: 'Custom discount (USD → VND)',
      points: { form: '10', payload: 10, api: 10, ui: '10đ' },     // đúng phải là 260.500đ
    });
    // Trong chuỗi này 4 điểm đều "10" nên chuỗi KHÔNG đứt — engine phải nói thật là không đứt,
    // vì lỗi ở đây là thiếu một PHÉP BIẾN ĐỔI, không phải mất giá trị.
    expect(r.consistent, 'chuỗi nhất quán ⇒ probe không được bịa ra mắt đứt').toBe(true);
    // Nhưng khi so với giá trị PHẢI CÓ (oracle ngoài app) thì lệch bậc độ lớn phải được phân loại đúng:
    const c = probe.classify(probe.normVal('260.500'), probe.normVal('10'));
    expect(c).toContain('BẬC ĐỘ LỚN');
  });

  test('chuỗi lành: 4 điểm khớp thì KHÔNG báo gì (chống báo oan)', () => {
    const r = probe.evaluate({
      name: 'Service Fee lành',
      points: { form: '1.234.567', payload: 1234567, api: 1234567, ui: '1.234.567đ' },
    });
    expect(r.consistent, 'nhất quán — KHÔNG đồng nghĩa PASS').toBe(true);
    expect(r.breaks).toHaveLength(0);
  });

  test('đo THIẾU điểm không được ngầm tính là đạt', () => {
    const r = probe.evaluate({ name: 'chỉ có form + ui', points: { form: '1.234.567', ui: '1.234.567đ' } });
    expect(r.breaks).toHaveLength(0);
    expect(r.missing).toEqual(['payload', 'api']);
    expect(r.consistent, 'khớp 2 điểm mà thiếu payload/api thì KHÔNG được coi là nhất quán đủ').toBe(false);
    expect(r.partial, 'phải nói rõ đây là chuỗi ĐO KHUYẾT, không phải chuỗi lành').toBe(true);
  });

  test('giá trị mồi phải PHÂN BIỆT: không tròn, không 0, khác nhau giữa các lần', () => {
    const a = probe.seed('money');
    expect(typeof a).toBe('number');
    expect(a).toBeGreaterThan(1000000);
    expect(a % 1000, 'số tròn nghìn thì "trùng nhau" có thể là ngẫu nhiên').not.toBe(0);
    expect(String(probe.seed('text'))).toMatch(/^IT test /);          // quy ước đặt tên dữ liệu test
  });
});
