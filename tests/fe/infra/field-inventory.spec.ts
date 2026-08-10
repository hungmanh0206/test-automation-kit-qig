import { test, expect } from '@playwright/test';
import * as path from 'path';

/*
 * Regression cho khối `fields` của ui_conformance_check — KIỂM KÊ TẬP FIELD của màn.
 *
 * Vì sao có test này: rà lại một task thật cho thấy cả một cụm bug lọt qua automation vì không có gì
 * liệt kê "màn này phải có đúng những trường/cột nào" — case chỉ hỏi "giá trị X đúng chưa", nên
 * THIẾU trường và THỪA cột không bao giờ lộ ra (mọi step vẫn chạy, mọi assert vẫn xanh).
 * Fixture tái tạo đúng 2 ca đó + 1 ca hai màn lệch nhãn nhau.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { checkScreen } = require(path.resolve(__dirname, '../../../scripts/qa/ui_conformance_check.js'));

const FIXTURE = `file://${path.resolve(__dirname, '../fixtures/field-inventory.html').replace(/\\/g, '/')}`;
const typesOf = (dev: any[]) => dev.map((d) => d.type);

test.describe('field inventory — bắt thiếu/thừa/lệch mà test theo bước bỏ sót', () => {
  test('THIẾU field trong section → fields.missing (đúng lớp bug "thiếu Net Price")', async ({ page }) => {
    await page.goto(FIXTURE);
    const dev = await checkScreen(page, '', {
      name: 'Add-on Product Info',
      fields: [{
        name: 'Add-on Product Info',
        containerSelector: '#addon-info',
        expectedFields: ['Add-on Product', 'Version', 'Gross Price', 'Custom Discount', 'Net Price'],
      }],
    });
    expect(typesOf(dev)).toContain('fields.missing');
    const miss = dev.find((d: any) => d.type === 'fields.missing');
    expect(miss.expected).toEqual(['Net Price']);
  });

  test('THỪA cột trong bảng → columns.count + columns.title/order (đúng lớp bug "thừa cột Tuition Payment Office")', async ({ page }) => {
    await page.goto(FIXTURE);
    const dev = await checkScreen(page, '', {
      name: 'Transaction List',
      scopeSelector: '#tx',
      table: {
        headerSelector: 'thead th',
        expectedColumns: ['No', 'Payment Code', 'Amount', 'Payment Method', 'Status'],
      },
    });
    expect(typesOf(dev)).toContain('columns.count');
    const cnt = dev.find((d: any) => d.type === 'columns.count');
    expect(cnt.actual).toBe(6);            // build có 6 cột
    expect(cnt.expected).toBe(5);          // tài liệu khai 5
    expect(cnt.detail).toContain('Tuition Payment Office');
  });

  test('field lạ ngoài tài liệu → fields.extra; mode superset thì tha', async ({ page }) => {
    await page.goto(FIXTURE);
    const screen = (mode?: string) => ({
      name: 'Order Detail',
      fields: [{
        name: 'Order Detail',
        containerSelector: '#order-detail',
        expectedFields: ['Service Fee Type', 'Amount'],
        ...(mode ? { mode } : {}),
      }],
    });
    const strict = await checkScreen(page, '', screen());
    expect(typesOf(strict)).toContain('fields.extra');
    expect(strict.find((d: any) => d.type === 'fields.extra').actual).toEqual(['Course Extension Package']);

    const loose = await checkScreen(page, '', screen('superset'));
    expect(typesOf(loose)).not.toContain('fields.extra');
  });

  test('hai màn cùng dữ liệu nhưng lệch nhãn → mỗi màn tự lộ ra (bug "hiển thị không đồng nhất")', async ({ page }) => {
    await page.goto(FIXTURE);
    const expected = ['Service Fee Type', 'Course Extension Package', 'Amount'];
    const detail = await checkScreen(page, '', {
      name: 'Order Detail',
      fields: [{ name: 'detail', containerSelector: '#order-detail', expectedFields: expected }],
    });
    const createEdit = await checkScreen(page, '', {
      name: 'Create/Edit',
      fields: [{ name: 'create-edit', containerSelector: '#create-edit', expectedFields: expected }],
    });
    expect(detail).toHaveLength(0);                       // màn đúng tài liệu → sạch
    expect(typesOf(createEdit)).toContain('fields.missing'); // màn lệch → thiếu 'Course Extension Package'
    expect(typesOf(createEdit)).toContain('fields.extra');   // và mọc 'Extension Package'
  });

  test('khai fields mà quên expectedFields → báo ngay, không im lặng bỏ qua', async ({ page }) => {
    await page.goto(FIXTURE);
    const dev = await checkScreen(page, '', {
      name: 'x',
      fields: [{ name: 'x', containerSelector: '#addon-info' }],
    });
    expect(typesOf(dev)).toContain('fields.no-expected');
  });
});
