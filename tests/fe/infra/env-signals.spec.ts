import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * @infra — collector tín hiệu môi trường.
 *
 * Lý do tồn tại: mỗi lượt execute đã mở trang thật và gọi API thật, nhưng **không case nào assert** JS exception /
 * request 4xx-5xx chạy nền / lệch contract. Trước file `env_signals.js` kit KHÔNG có collector nào — `qa_instincts`
 * chỉ *dặn* agent tự soi. Test dưới đây dựng đúng 4 loại tín hiệu để chắc chắn collector bắt được, và quan trọng
 * hơn: chắc chắn nó **không báo oan** với tracking bên thứ ba và với 4xx do case negative cố ý gây ra.
 */

const { attachEnvSignals, toFindings } = require(path.resolve(__dirname, '../../../scripts/utils/runtime/env_signals.js'));

/*
 * CHỜ THEO ĐIỀU KIỆN, KHÔNG NGỦ ĐỦ LÂU.
 *
 * Bản trước dùng `waitForTimeout(300..500)` sau mỗi `fetch`, và nó đỏ ngẫu nhiên 2/5 lượt khi chạy CẢ BỘ
 * trong khi chạy riêng thì 3/3 xanh — đúng hình dạng của một cuộc đua: chạy riêng thì máy rảnh nên 400ms
 * thừa, chạy cùng 580 test khác thì không.
 *
 * `report()` là ảnh chụp đồng bộ nên hỏi lại được bao nhiêu lần tuỳ thích. Chờ tới khi tín hiệu CÓ MẶT thì
 * đúng nhanh và đúng chắc: máy rảnh thì xong sau một nhịp, máy bận thì nó đợi thêm thay vì phán bừa.
 */
const doiTinHieu = async (lay: () => number, viSao: string) => {
  await expect.poll(lay, { message: viSao, timeout: 10_000, intervals: [25, 50, 100, 200] }).toBeGreaterThan(0);
};

test.describe('@infra env_signals — assert thay vì chỉ dùng để triage', () => {
  test('bắt JS exception (zero-tolerance, dù màn trông bình thường)', async ({ page }) => {
    const sig = attachEnvSignals(page);
    await page.setContent('<h1>Màn trông rất ổn</h1><script>setTimeout(()=>{ throw new Error("boom trong runtime") },10)</script>');
    await doiTinHieu(() => sig.report().pageErrors.length, 'collector không bắt được JS exception');
    const r = sig.report();
    expect(r.pageErrors[0].message).toContain('boom');
    expect(r.clean, 'có exception thì KHÔNG được coi là sạch').toBe(false);
    await expect(async () => sig.assertClean('màn X')).rejects.toThrow(/env-signals/);
  });

  test('bắt request 4xx/5xx chạy nền trong khi UI vẫn xanh', async ({ page }) => {
    await page.route('**/api/phu**', (r) => r.fulfill({ status: 500, body: 'boom' }));
    const sig = attachEnvSignals(page);
    await page.setContent('<h1>OK</h1><script>fetch("https://x.test/api/phu").catch(()=>{})</script>');
    await doiTinHieu(() => sig.report().httpErrors.length, 'API phụ 500 phải bị bắt dù UI không báo gì');
    const r = sig.report();
    expect(r.httpErrors[0].status).toBe(500);
  });

  test('KHÔNG báo oan: tracking bên thứ ba và 4xx do case negative khai trước', async ({ page }) => {
    await page.route('**/gtag/**', (r) => r.fulfill({ status: 404, body: '' }));
    await page.route('**/api/validate**', (r) => r.fulfill({ status: 422, body: '{}' }));
    const sig = attachEnvSignals(page);
    sig.expect4xx(/\/api\/validate/, 'case negative: gửi payload thiếu field để đòi 422');
    await page.setContent('<h1>OK</h1><script>fetch("https://www.googletagmanager.com/gtag/js").catch(()=>{});fetch("https://x.test/api/validate").catch(()=>{})</script>');
    /*
     * PHẢI chờ tín hiệu MONG ĐỢI tới TRƯỚC, rồi mới khẳng định danh sách "lạ" là rỗng. Bản trước ngủ rồi
     * assert `toHaveLength(0)` ngay: nếu request chưa kịp về thì mọi danh sách đều rỗng và test XANH mà
     * chưa kiểm gì. Một phép kiểm chống-báo-oan có thể pass rỗng thì nó không chứng minh được điều nó nói.
     */
    await doiTinHieu(() => sig.report().httpErrorsExpected.length, '422 cố ý vẫn phải được GHI LẠI, không im lặng');
    const r = sig.report();
    expect(r.httpErrors, 'gtag 404 + 422 đã khai trước ⇒ không phải tín hiệu lạ').toHaveLength(0);
  });

  test('lệch contract chỉ kiểm khi task KHAI contract (không tự đoán schema)', async ({ page }) => {
    await page.route('**/api/orders**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { total: '540000.0' } }) }));
    const sig = attachEnvSignals(page, {
      contracts: [{ match: /\/api\/orders/, validate: (b: any) => (typeof b?.data?.total === 'number' ? [] : ['`data.total` phải là number, nhận string']) }],
    });
    await page.setContent('<h1>OK</h1><script>fetch("https://x.test/api/orders").catch(()=>{})</script>');
    await doiTinHieu(() => sig.report().contractViolations.length, 'khai contract rồi mà lệch kiểu vẫn lọt');
    const r = sig.report();
    expect(r.contractViolations[0].problems[0]).toContain('number');
  });

  test('đổi thành finding: tín hiệu môi trường = app tự mâu thuẫn ⇒ EXPANSION_FINDING (không cần oracle)', () => {
    const items = toFindings({
      pageErrors: [{ message: 'x is not a function' }],
      consoleErrors: [],
      httpErrors: [{ status: 500, method: 'GET', url: '/api/phu' }],
      contractViolations: [],
    }, { base_tc: 'OPS_PAY_TC_001' });
    expect(items).toHaveLength(2);
    for (const f of items) {
      expect(f.verdict, 'JS chết / API 500 trong khi UI báo bình thường là app tự mâu thuẫn').toBe('EXPANSION_FINDING');
      expect(f.base_tc).toBe('OPS_PAY_TC_001');
    }
  });
});
