import { test, expect } from '@playwright/test';
import * as path from 'path';

/*
 * Regression cho screen_snapshot — biến quan sát UI thành DỮ LIỆU.
 * Fixture tái tạo 3 lớp bug hiển thị mà test theo bước bỏ sót vì nó chỉ chạm element nó cần:
 *   · section thiếu một trường           · bảng thừa một cột       · trộn đơn vị tiền (USD vs đ)
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { snapshotScreen, diffWithDoc } = require(path.resolve(__dirname, '../../../scripts/utils/ui/screen_snapshot.js'));

const FIXTURE = `file://${path.resolve(__dirname, '../fixtures/field-inventory.html').replace(/\\/g, '/')}`;

test.describe('screen_snapshot — thứ có trên màn mà tài liệu không nói phải TỰ nổi lên', () => {
  test('snapshot đọc được nhãn, cặp nhãn→giá trị và bảng', async ({ page }) => {
    await page.goto(FIXTURE);
    const snap = await snapshotScreen(page, { scopeSelector: '#addon-info' });
    expect(snap.labels).toContain('Gross Price');
    expect(snap.pairs.find((p: any) => p.label === 'Add-on Product')?.value).toBe('Becker CMA Part 1');
    expect(snap.labels).not.toContain('Net Price');   // fixture cố tình thiếu
  });

  test('diff vs tài liệu: nêu ĐÚNG field thiếu và field lạ — không cần ai để ý', async ({ page }) => {
    await page.goto(FIXTURE);
    const snap = await snapshotScreen(page, { scopeSelector: '#addon-info' });
    const d = diffWithDoc(snap, { expectedFields: ['Add-on Product', 'Version', 'Gross Price', 'Net Price'] });
    expect(d.missingFields).toEqual(['Net Price']);
    expect(d.extraFields).toContain('Custom Discount');   // có trên màn, tài liệu (ở ví dụ này) không khai
  });

  test('bảng: cột thừa nổi lên qua extraColumns', async ({ page }) => {
    await page.goto(FIXTURE);
    const snap = await snapshotScreen(page, { scopeSelector: '#tx' });
    const d = diffWithDoc(snap, { expectedColumns: ['No', 'Payment Code', 'Amount', 'Payment Method', 'Status'] });
    expect(d.extraColumns).toEqual(['Tuition Payment Office']);
    expect(d.missingColumns).toEqual([]);
  });

  test('trộn đơn vị tiền trong cùng khối → cảnh báo (lớp bug "USD in ra đ")', async ({ page }) => {
    await page.setContent(`<div id="money">
      <label>Monetary Unit</label><span>USD</span>
      <label>Price</label><span>170 USD</span>
      <label>Total Custom Discount Note</label><span>10đ</span>
    </div>`);
    const snap = await snapshotScreen(page, { scopeSelector: '#money' });
    expect(snap.mixedCurrency).toBe(true);
    expect(Object.keys(snap.currencies).sort()).toEqual(['USD', 'VND']);
    expect(diffWithDoc(snap, {}).notes.join(' ')).toMatch(/trộn|đơn vị tiền/);
  });

  test('layout DIV (không có label/table) → vẫn đọc được nhãn+giá trị, diff vẫn chạy', async ({ page }) => {
    // Màn Order detail của OPS render bằng div: đo thật thì `labels` = 0 ⇒ snapshot MÙ hoàn toàn.
    // Nhánh labelsLoose phải cứu được ca này, và diffWithDoc phải tự dùng nó khi `labels` rỗng.
    await page.setContent(`<div id="ov">
      <div><div>Gross Amount</div><div>5.400.000đ</div></div>
      <div><div>Net Price</div><div>5.400.000đ</div></div>
      <div><div>Test Subject</div><div>MA1</div></div>
    </div>`);
    const snap = await snapshotScreen(page, { scopeSelector: '#ov' });
    expect(snap.labels).toHaveLength(0);                       // đúng: không có <label>/<th> nào
    expect(snap.labelsLoose).toContain('Net Price');           // nhánh div cứu được
    expect(snap.pairsLoose.find((p: any) => p.label === 'Test Subject')?.value).toBe('MA1');

    const d = diffWithDoc(snap, { expectedFields: ['Gross Amount', 'Net Price', 'Test Subject', 'Monetary Unit'] });
    expect(d.missingFields).toEqual(['Monetary Unit']);        // chỉ thiếu đúng 1 field, KHÔNG báo thiếu hết
  });

  test('khối đơn vị thống nhất → KHÔNG cảnh báo (không kêu oan)', async ({ page }) => {
    await page.setContent('<div id="m2"><label>Price</label><span>5.000.000đ</span><label>Net</label><span>4.250.000đ</span></div>');
    const snap = await snapshotScreen(page, { scopeSelector: '#m2' });
    expect(snap.mixedCurrency).toBe(false);
    expect(diffWithDoc(snap, {}).notes).toEqual([]);
  });
});
