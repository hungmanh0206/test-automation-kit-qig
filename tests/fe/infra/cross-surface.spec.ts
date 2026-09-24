import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * @infra — hợp đồng phân loại của `cross_surface_diff`: phải tách được **khác GIÁ TRỊ** với **khác ĐỊNH DẠNG**,
 * và phải từ chối kết luận khi không đọc được giá trị. Cả hai luật đều sinh ra từ lượt chạy thật đầu tiên:
 * lượt đó báo oan `600.000đ` vs API `600000`, và kết luận "✓ khớp" cho hai ô trống.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-dynamic-require, global-require
const x = require(path.resolve(__dirname, '../../../scripts/qa/cross_surface_diff.js'));

test.describe('@infra cross_surface_diff — chuẩn hoá & thẩm quyền kết luận', () => {
  test('tiền: format khác nhau nhưng CÙNG giá trị', () => {
    expect(x.core('600.000đ').v).toBe(x.core('600000').v);
    expect(x.core('1.234.567 đ').v).toBe(x.core('1234567').v);
  });

  test('ngày: dd/mm/yyyy và yyyy-mm-dd là cùng một ngày (CSDL-28521 là lệch ĐỊNH DẠNG)', () => {
    expect(x.core('20/05/2001').v).toBe(x.core('2001-05-20').v);
    expect(x.core('20/05/2001').v).not.toBe(x.core('2001-05-21').v);
  });

  test('khác giá trị thật thì KHÔNG được coi là khác định dạng', () => {
    expect(x.core('600.000đ').v).not.toBe(x.core('700.000đ').v);
  });

  test('ô trống / undefined / "(không thấy nhãn)" đều KHÔNG phải giá trị đọc được', () => {
    for (const v of ['', '-', '—', 'N/A', 'undefined', 'null', '(không thấy nhãn "X")']) {
      expect(x.isReadable(v), `"${v}" phải bị coi là không đọc được`).toBe(false);
    }
    expect(x.isReadable('600.000đ')).toBe(true);
    expect(x.isReadable('0')).toBe(true);        // 0 LÀ một giá trị, không phải rỗng
  });
});
