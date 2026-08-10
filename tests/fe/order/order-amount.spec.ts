import { test, expect, type Page } from '@playwright/test';
import { OPS_BASE, haveOpsCreds, loginOps, toNumber } from '../support/opsLogin';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const T = require('../../../scripts/utils/ui/safe_target');

/*
 * F6 — suite FE THẬT (promote từ SAPP-26523 / VNPay split payment).
 * Smoke module Order (Impact 5 — tiền): bất biến "Total Amount Due = Net Amount − Paid Amount + Payback"
 * trên form Create Order (OPS). Deterministic, KHÔNG phụ thuộc chọn product cụ thể.
 * AN TOÀN (non-destructive): chỉ mở form + đọc summary + Cancel; KHÔNG bấm Confirm.
 * Env: OPS_* (profiles/<TASK>/task.env qua TASK_ENV) + ORDER_TEST_DEAL_ID (mặc định deal test UAT).
 */

const DEAL = process.env.ORDER_TEST_DEAL_ID || '62115321374'; // deal test UAT (reuse SAPP-18500/26523)

/*
 * Đọc summary bằng cách NEO THEO NHÃN, không regex trên `body.innerText`.
 * Lý do: regex toàn trang vớ đúng con số đầu tiên khớp mẫu — nhãn trùng ở section khác là lấy nhầm
 * số → oracle sai → kết luận "bug" trong khi sản phẩm đúng. `readValue` phát hiện nhãn xuất hiện
 * >1 chỗ và ném `script_error` thay vì đoán (xem .agent/rules/locator_strategy.md).
 */
async function readOrderSummary(page: Page) {
  // Neo vào ĐÚNG panel summary: khối nhỏ nhất chứa cả 'Net Amount' lẫn 'Total Amount Due'.
  // (Đo trên UAT: 'Total Amount Due' xuất hiện 3 chỗ, 'Paid Amount' 2 chỗ, 'Payback' 0 chỗ —
  //  đọc toàn trang là so số của các section KHÁC NHAU.)
  const scope = await T.sectionContaining(page, ['Net Amount', 'Total Amount Due']);
  const grab = async (label: string) => T.readValue(scope, label, { optional: true });
  return {
    net: await grab('Net Amount'),
    paid: await grab('Paid Amount'),
    payback: await grab('Payback'),
    due: await grab('Total Amount Due'),
  };
}

test.describe('@order @smoke Order — Total Amount Due (SAPP-26523)', () => {
  test.skip(!haveOpsCreds, 'Thiếu OPS creds → skip (chạy ở CI/local có TASK_ENV profile hoặc OPS_* secrets).');

  test('Total Amount Due = Net − Paid + Payback (bất biến, non-destructive)', async ({ page }) => {
    await loginOps(page);

    await page.goto(`${OPS_BASE}/operations/sales/orders`, { waitUntil: 'networkidle', timeout: 40000 });
    await (await T.one(page.getByRole('button', { name: /New Order/i }), { what: 'nút New Order' })).click({ timeout: 6000 });
    await page.waitForTimeout(2000);

    const dealInput = page.locator('input[name=deal_id]');
    await expect(dealInput, 'Không thấy input deal_id — UX Create Order có thể đã đổi').toHaveCount(1);
    await dealInput.fill(DEAL);
    await (await T.one(page.getByRole('button', { name: /Đồng bộ thông tin|Sync/i }), { what: 'nút Đồng bộ' })).click({ timeout: 5000 });
    await page.waitForTimeout(6000);

    const s = await readOrderSummary(page);
    const net = toNumber(s.net);
    const paid = toNumber(s.paid) ?? 0;
    const payback = toNumber(s.payback) ?? 0;
    const due = toNumber(s.due);

    expect(net, `Không đọc được Net Amount (summary: ${JSON.stringify(s)})`).not.toBeNull();
    expect(due, `Không đọc được Total Amount Due (summary: ${JSON.stringify(s)})`).not.toBeNull();
    expect(due).toBe((net as number) - paid + payback);

    // locator-lint-disable-next-line teardown best-effort: có thể có nhiều nút Hủy (form + modal), bấm cái nào cũng thoát được; lỗi ở đây không ảnh hưởng kết quả test
    await page.getByRole('button', { name: /Cancel|Hủy|Huỷ/i }).first().click({ timeout: 4000 }).catch(() => {});
  });
});
