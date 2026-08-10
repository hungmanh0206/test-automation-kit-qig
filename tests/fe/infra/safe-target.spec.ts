import { test, expect } from '@playwright/test';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const T = require('../../../scripts/utils/ui/safe_target');

/*
 * @infra — chứng minh safe_target BIẾN "bắt nhầm element" THÀNH LỖI RÕ RÀNG thay vì im lặng.
 * Chạy trên fixture local (không UAT). Fixture `expand-trap.html`: header "Product" có nhiều icon,
 * icon cuối mở dropdown hàng xóm, button đầu mở modal — đúng cái bẫy gây log-bug-sai ngoài đời.
 */
const FIXTURE = `file://${path.resolve(__dirname, '..', 'fixtures', 'expand-trap.html').replace(/\\/g, '/')}`;

test.describe('@infra safe_target — mơ hồ phải thành LỖI, không chọn bừa', () => {
  test('one(): >1 match → ném script_error kèm danh sách (không tự lấy .first())', async ({ page }) => {
    await page.goto(FIXTURE);
    // 3 icon cùng class "anticon" trong header → mơ hồ
    const err = await T.one(page.locator('.anticon'), { what: 'icon trong header' }).then(() => null, (e: Error) => e);
    expect(err, 'phải ném lỗi thay vì chọn đại').toBeTruthy();
    expect(err.message).toContain('[script_error]');
    expect(err.message).toMatch(/MƠ HỒ: \d+ match/);
    expect((err as any).failureLayer, 'phân loại đúng để KHÔNG bị log Jira').toBe('script_error');
  });

  test('one(): 0 match → ném script_error (không im lặng bỏ qua)', async ({ page }) => {
    await page.goto(FIXTURE);
    const err = await T.one(page.getByRole('button', { name: 'Không tồn tại' }), { what: 'nút ma', timeout: 1500 }).then(() => null, (e: Error) => e);
    expect(err?.message).toContain('0 match');
  });

  test('section() + clickVerified(): bấm nhầm control → phát hiện, Escape, báo lỗi', async ({ page }) => {
    await page.goto(FIXTURE);
    const card = await T.section(page, 'Product', { siblings: ['Add-on Course', 'Promotion Code'] });
    // Cố tình bấm nút promo (mở modal) nhưng kỳ vọng panel mở ra "Add Product"
    const err = await T.clickVerified(page, card.locator('#promo-btn'), {
      what: 'nút mở panel (cố tình sai)', expect: () => card.getByText('Add Product'),
    }).then(() => null, (e: Error) => e);
    expect(err, 'phải phát hiện bấm nhầm').toBeTruthy();
    expect(err.message).toMatch(/mở NHẦM overlay|KHÔNG thấy kết quả mong đợi/);
    // overlay đã được đóng lại (không để lại rác state cho bước sau)
    const stillOpen = await page.evaluate(() => !document.getElementById('md')!.classList.contains('hidden'));
    expect(stillOpen, 'modal mở nhầm phải được Escape').toBeFalsy();
  });

  test('clickVerified(): bấm ĐÚNG control → pass', async ({ page }) => {
    await page.goto(FIXTURE);
    const card = await T.section(page, 'Product', { siblings: ['Add-on Course', 'Promotion Code'] });
    await T.clickVerified(page, card.locator('#prod-toggle'), { what: 'toggle panel Product', expect: () => card.getByText('Add Product') });
    const open = await page.evaluate(() => getComputedStyle(document.getElementById('prod-body') as Element).display === 'block');
    expect(open).toBeTruthy();
  });

  test('assertScreen(): sai màn → chặn ngay, không thao tác mù', async ({ page }) => {
    await page.goto(FIXTURE);
    const err = await T.assertScreen(page, { url: /\/expected-screen/ }).then(() => null, (e: Error) => e);
    expect(err?.message).toContain('sai màn');
  });
});
