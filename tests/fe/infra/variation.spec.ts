import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * @infra — xoay data theo RUN_ID mà vẫn TÁI LẬP được.
 *
 * Hai yêu cầu đối nghịch phải cùng đúng: (a) mỗi lượt chạy chạm một hình dạng data khác (nếu không thì độ phủ đóng
 * băng: 20 lượt vẫn 1 hình dạng); (b) cùng RUN_ID phải cho cùng data — random thuần làm bug "biến mất khi chạy lại",
 * phá nguyên tắc rerun 2–3 lần và biến bug thật thành flaky.
 */
const v = require(path.resolve(__dirname, '../../../scripts/lib/expansion/variation.js'));

test.describe('@infra variation — xoay nhưng tái lập', () => {
  test('cùng RUN_ID ⇒ cùng kết quả (điều kiện sống còn để rerun tái hiện được)', () => {
    const a = v.pick('money_valid', v.CLASSES.money_valid, 'run-123');
    const b = v.pick('money_valid', v.CLASSES.money_valid, 'run-123');
    expect(a).toBe(b);
    expect(v.plan(v.CLASSES, 'run-123')).toEqual(v.plan(v.CLASSES, 'run-123'));
  });

  test('đổi RUN_ID ⇒ có xoay thật (không phải luôn trả phần tử đầu)', () => {
    const seen = new Set();
    for (let i = 0; i < 40; i += 1) seen.add(v.pick('money_valid', v.CLASSES.money_valid, `run-${i}`));
    expect(seen.size, 'sau 40 RUN_ID phải chạm >1 hình dạng, nếu không thì độ phủ vẫn đóng băng').toBeGreaterThan(1);
  });

  test('hai lớp khác nhau KHÔNG xoay trùng pha (cùng seed vẫn độc lập)', () => {
    const idx = (name: string, values: any[]) => values.indexOf(v.pick(name, values, 'seed-x'));
    const arr = [10, 20, 30, 40, 50];
    const i1 = idx('lop_A', arr);
    const i2 = idx('lop_B', arr);
    expect(i1).toBeGreaterThanOrEqual(0);
    expect(i2).toBeGreaterThanOrEqual(0);
    // không bắt buộc khác nhau, nhưng tên lớp PHẢI tham gia vào seed:
    expect(v.hash('lop_A::seed-x')).not.toBe(v.hash('lop_B::seed-x'));
  });

  test('thiếu RUN_ID phải NÓI RA (mọi lượt giống nhau = độ phủ đóng băng)', () => {
    const p = v.plan({ money_valid: v.CLASSES.money_valid }, '');
    expect(String(p._runId)).toMatch(/đóng băng/);
  });

  test('lớp tương đương phải khác HÌNH DẠNG, không phải khác giá trị ngẫu nhiên', () => {
    expect(v.CLASSES.money_edge, 'phải có 0 và số âm — nơi bug thất thu hay nằm').toContain(0);
    expect(v.CLASSES.money_edge.some((x: number) => x < 0)).toBe(true);
    expect(v.CLASSES.name_shape.every((s: string) => s.startsWith('IT test')), 'theo quy ước đặt tên dữ liệu test').toBe(true);
    expect(v.CLASSES.name_shape.some((s: string) => /[ăâđêôơư]/i.test(s)), 'phải có tên dài CÓ DẤU').toBe(true);
    expect(v.CLASSES.count_shape, 'phải có 0 để chạm empty-state').toContain(0);
  });

  test('mảng rỗng ⇒ báo lỗi, không im lặng trả undefined', () => {
    expect(() => v.pick('x', [])).toThrow(/không rỗng/);
  });
});
