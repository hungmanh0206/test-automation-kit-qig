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
    expect(snap.labels).toContain('Giá gốc');
    expect(snap.pairs.find((p: any) => p.label === 'Add-on Product')?.value).toBe('Becker CMA Part 1');
    expect(snap.labels).not.toContain('Giá sau giảm');   // fixture cố tình thiếu
  });

  test('diff vs tài liệu: nêu ĐÚNG field thiếu và field lạ — không cần ai để ý', async ({ page }) => {
    await page.goto(FIXTURE);
    const snap = await snapshotScreen(page, { scopeSelector: '#addon-info' });
    const d = diffWithDoc(snap, { expectedFields: ['Add-on Product', 'Version', 'Giá gốc', 'Giá sau giảm'] });
    expect(d.missingFields).toEqual(['Giá sau giảm']);
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
      <div><div>Tổng tiền</div><div>5.400.000đ</div></div>
      <div><div>Giá sau giảm</div><div>5.400.000đ</div></div>
      <div><div>Test Subject</div><div>MA1</div></div>
    </div>`);
    const snap = await snapshotScreen(page, { scopeSelector: '#ov' });
    expect(snap.labels).toHaveLength(0);                       // đúng: không có <label>/<th> nào
    expect(snap.labelsLoose).toContain('Giá sau giảm');           // nhánh div cứu được
    expect(snap.pairsLoose.find((p: any) => p.label === 'Test Subject')?.value).toBe('MA1');

    const d = diffWithDoc(snap, { expectedFields: ['Tổng tiền', 'Giá sau giảm', 'Test Subject', 'Monetary Unit'] });
    expect(d.missingFields).toEqual(['Monetary Unit']);        // chỉ thiếu đúng 1 field, KHÔNG báo thiếu hết
  });

  test('khối đơn vị thống nhất → KHÔNG cảnh báo (không kêu oan)', async ({ page }) => {
    await page.setContent('<div id="m2"><label>Price</label><span>5.000.000đ</span><label>Net</label><span>4.250.000đ</span></div>');
    const snap = await snapshotScreen(page, { scopeSelector: '#m2' });
    expect(snap.mixedCurrency).toBe(false);
    expect(diffWithDoc(snap, {}).notes).toEqual([]);
  });
});

/*
 * Ba lỗ hổng ĐÃ ĐO của bộ đọc (28/08/2026) — mỗi cái kèm kiểm-âm.
 *
 * Vì sao đáng có test riêng: `snapshotScreen` là instrument, và instrument mù thì mọi kết luận dựa trên nó
 * đều xanh mà sai. Cụ thể: tôi gần như kết luận "form không có payment_method" chỉ vì bộ đọc không thấy
 * ant-select; và một artifact đã rò 100 email + 100 SĐT vì snapshot không mask gì.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { normNumber } = require(path.resolve(__dirname, '../../../scripts/utils/ui/screen_snapshot.js'));

test.describe('screen_snapshot — instrument không được MÙ', () => {
  test('① ant-select: đọc được giá trị (input.value của nó RỖNG)', async ({ page }) => {
    await page.goto(FIXTURE);
    const snap = await snapshotScreen(page, { scopeSelector: '#pay-form' });
    const sel = snap.controls.filter((c: any) => c.kind === 'ant-select');
    expect(sel.length, 'không thấy ant-select nào ⇒ instrument vẫn mù').toBe(2);
    expect(sel.find((c: any) => c.label === 'Payment Method')?.value).toBe('Trả góp');
    // Kiểm-âm: nếu chỉ đọc input.value thì giá trị này rỗng — chứng minh test có răng.
    expect(await page.locator('#pay-form .ant-select input').first().inputValue()).toBe('');
    expect(sel.find((c: any) => c.label === 'Recipient Bank Account')?.disabled, 'phải nhận ra ant-select bị disable').toBe(true);
  });

  test('② radio: lấy theo `checked`, KHÔNG theo `value`', async ({ page }) => {
    await page.goto(FIXTURE);
    const snap = await snapshotScreen(page, { scopeSelector: '#pay-form' });
    const radios = snap.controls.filter((c: any) => c.kind === 'radio');
    expect(radios.length).toBe(2);
    const chosen = radios.filter((r: any) => r.value);
    expect(chosen.length, 'chỉ một ô được chọn').toBe(1);
    expect(chosen[0].value).toBe('CHỌN:INSTALLMENT');
    // Kiểm-âm: ô chưa chọn phải RỖNG. Đọc `value` thô sẽ ra 'ONETIME' — đúng cái sai cần chặn.
    expect(radios.find((r: any) => r.value === 'CHỌN:ONETIME'), 'ô chưa chọn không được có giá trị').toBeUndefined();
  });

  test('③ PII: che theo NHÃN và theo HEADER CỘT, nhưng KHÔNG che khoá nghiệp vụ', async ({ page }) => {
    await page.goto(FIXTURE);
    const form = await snapshotScreen(page, { scopeSelector: '#pay-form' });
    const byLabel = (l: string) => form.controls.find((c: any) => c.label === l)?.value;
    expect(byLabel('Full name'), 'họ tên phải bị che (không có mẫu nhận biết được)').toBe('<masked>');
    expect(byLabel('Email')).toBe('<masked>');
    expect(byLabel('Mã hồ sơ'), 'Mã hồ sơ là KHOÁ NGHIỆP VỤ — che nó là mất thứ cần đọc').toBe('64333601619');

    const grid = await snapshotScreen(page, { scopeSelector: '#cust' });
    const row = grid.tables[0].rows[0];
    expect(row[0], 'cột Mã hồ sơ không phải PII').toBe('64333601619');
    expect(row[2], 'cột Email phải bị che').toBe('<masked>');
    expect(row[3], 'cột Phone phải bị che').toBe('<masked>');
    expect(row[4], 'cột tiền giữ nguyên').toBe('60 000 000');
    expect(JSON.stringify(grid), 'snapshot không được còn email nào').not.toMatch(/@example\.com/);
    expect(JSON.stringify(grid), 'snapshot không được còn SĐT nào').not.toContain('0339299199');
  });

  test('③b tắt mask phải TƯỜNG MINH (kiểm-âm: chứng minh mask là thứ đang chạy)', async ({ page }) => {
    await page.goto(FIXTURE);
    const raw = await snapshotScreen(page, { scopeSelector: '#cust', maskPii: false });
    expect(JSON.stringify(raw), 'maskPii:false thì dữ liệu thật phải hiện ra — nếu không, mask không hề chạy')
      .toContain('a.that@example.com');
  });

  test('normNumber: so số không phụ thuộc ĐỊNH DẠNG nghìn của từng màn', () => {
    /*
     * Đo thật: màn CORE hiện "60 000 000" (dấu cách), màn Add-on hiện "5.000.000" (dấu chấm). Hàm so chỉ bỏ
     * khoảng trắng thì trượt 129/133 hàng, và suýt bị ghi nhận thành phát hiện "UI hiện số khác hẳn DB".
     */
    expect(normNumber('60 000 000')).toBe('60000000');
    expect(normNumber('5.000.000')).toBe('5000000');
    expect(normNumber('-24,300,000đ')).toBe('-24300000');
    expect(normNumber('0đ')).toBe('0');
    expect(normNumber('')).toBe('');
    expect(normNumber('N/A')).toBe('');
  });
});
