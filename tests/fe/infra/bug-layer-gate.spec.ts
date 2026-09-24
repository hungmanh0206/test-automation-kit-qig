import { test, expect } from '@playwright/test';
import * as path from 'path';

/*
 * Regression cho `lintBeVsFeLayer` — bug đã gán tầng [FE]/[BE] thì phải có dấu vết API.
 *
 * Vì sao có test này: nhìn UI sai chỉ chứng minh CÓ lỗi, không chứng minh lỗi NẰM Ở ĐÂU. Gán sai tầng thì
 * ticket đi nhầm người, dev bounce lại, mất trọn một vòng lặp. Đo trên 99 bug đã log: 71 (72%) gán tầng mà
 * description không có dấu vết API nào ⇒ luật để mức CẢNH BÁO, và test này khoá đúng hành vi đó.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rules = require(path.resolve(__dirname, '../../../scripts/qa/lib/output_rules.js'));

const BASE = { steps: '1. Mở màn Order detail', expectedResult: 'Phải khớp spec' };

test.describe('@infra beVsFe — gán tầng FE/BE phải có bằng chứng API', () => {
  test('gán tầng mà KHÔNG có dấu vết API → 1 cảnh báo (không phải problem)', () => {
    const out = rules.lintBeVsFeLayer({ ...BASE, summary: '[BE] Order detail hiển thị sai Net Amount', description: 'Màn hiện 0đ' });
    expect(out).toHaveLength(1);
    expect(out[0].level).toBe('warning');       // KHÔNG được là 'problem': chặn ngay là đỏ oan 72% bug
  });

  test('có method + path thật → im lặng', () => {
    const out = rules.lintBeVsFeLayer({
      summary: '[FE] Order detail hiển thị sai Net Amount',
      description: 'GET /api/v1/product-orders/abc trả net_amount=5400000 nhưng màn hiện 0đ',
    });
    expect(out).toEqual([]);
  });

  test('KHÔNG gán tầng → không cảnh báo (đừng kêu oan bug chưa kết luận tầng)', () => {
    const out = rules.lintBeVsFeLayer({ summary: 'Order detail hiển thị sai Net Amount', description: 'Màn hiện 0đ' });
    expect(out).toEqual([]);
  });

  test('SỐ TIỀN Việt không được tính là mã status HTTP', () => {
    // Bug thật của phiên bản đầu: STATUS_CODE dùng `[45]\d\d` trần nên "5.400.000đ" khớp cụm `400`
    // (đứng sau dấu chấm nên vẫn thoả \b) ⇒ bug chỉ nói về số tiền bị coi là "đã bắt API" và lọt cảnh báo.
    const out = rules.lintBeVsFeLayer({
      summary: '[BE] Order detail hiển thị sai Net Amount',
      description: 'Màn hiện 0đ trong khi hợp đồng ghi 5.400.000đ, chênh 1.200.000đ',
    });
    expect(out).toHaveLength(1);
  });

  test('mã status CÓ từ ngữ cảnh → tính là đã bắt API', () => {
    for (const d of ['API trả về 500 khi tạo order', 'status code: 422', 'HTTP 403 cho role hạn chế']) {
      expect(rules.lintBeVsFeLayer({ summary: '[BE] x', description: d })).toEqual([]);
    }
  });

  test('lời nhắc lấy TỪ config beVsFe, không hardcode trong code', () => {
    const out = rules.lintBeVsFeLayer({
      summary: '[BE] x',
      description: 'không có gì',
      beVsFe: { howTo: ['CÂU-TỪ-CONFIG-DÙNG-ĐỂ-KIỂM'] },
    });
    expect(out[0].message).toContain('CÂU-TỪ-CONFIG-DÙNG-ĐỂ-KIỂM');
  });
});

/*
 * Gate phải chấp nhận CHÍNH nguồn canonical của nó.
 *
 * Bug đã xảy ra: `verdict_taxonomy.json` định nghĩa khoá `product_bug`/`api_bug` (gạch dưới), nhưng regex
 * của `hasFailureLayer` chỉ nhận biến thể có DẤU CÁCH ⇒ khai ĐÚNG chuẩn `failureLayer: "product_bug"`
 * lại bị chặn oan — đúng vào 2 tầng duy nhất được phép log Backlog. Lỗi này sống sót vì test cũ chỉ thử
 * vài chuỗi văn xuôi tự nghĩ ra, không bơm toàn bộ khoá canonical qua gate.
 *
 * Luật rút ra (áp cho mọi gate nhận diện bằng regex): thứ gate ĐÒI phải là thứ gate NHẬN.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const taxonomy = require(path.resolve(__dirname, '../../../.agent/config/verdict_taxonomy.json'));

test.describe('@infra failureLayer — canonical value phải lọt qua chính gate của nó', () => {
  test('MỌI khoá trong verdict_taxonomy.failureLayers đều được chấp nhận', () => {
    const keys = Object.keys(taxonomy.failureLayers);
    expect(keys.length).toBeGreaterThan(3);   // taxonomy rỗng/đổi tên field thì test này phải đỏ, không im
    const rejected = keys.filter((k) => !rules.hasFailureLayer(k));
    expect(rejected, `khoá canonical bị gate chặn oan: ${rejected.join(', ')}`).toEqual([]);
  });

  test('vẫn KHÔNG nhận chuỗi rỗng nghĩa — nới cho canonical không được biến thành nhận bừa', () => {
    for (const noise of ['', 'FAILED', 'không rõ', 'chưa xác định', 'lỗi']) {
      expect(rules.hasFailureLayer(noise), `nhận bừa: ${JSON.stringify(noise)}`).toBe(false);
    }
  });
});
