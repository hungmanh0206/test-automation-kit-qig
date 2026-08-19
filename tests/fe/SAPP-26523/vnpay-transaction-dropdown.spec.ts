import { test, expect } from '@playwright/test';
import * as path from 'path';
import { OPS_BASE, haveOpsCreds, loginOps } from '../support/opsLogin';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { EvidenceRecorder } = require('../../../scripts/utils/evidence_recorder');

/*
 * SAPP-26523 — VNPay: logic dropdown phụ thuộc ở màn Transaction (OPS).
 * Execute 3 case canonical kéo từ AIO Tests: VNPAY_TC_47 · VNPAY_TC_48 · VNPAY_TC_49.
 *
 * NON-DESTRUCTIVE TUYỆT ĐỐI: chỉ MỞ form "Add Transaction" và đổi dropdown để quan sát ràng buộc,
 * KHÔNG bao giờ bấm nút lưu/submit; TC_47 thuần đọc bảng. Không tạo/sửa/xoá dữ liệu UAT.
 *
 * Chi tiết môi trường đã đo (đừng dò lại):
 *   - Modal Add Transaction là Bootstrap/Metronic `.modal.show`, KHÔNG phải `.ant-modal`.
 *   - Trong modal có 4 `.ant-select` theo thứ tự: Transaction Type · Payment Type · Payment Method ·
 *     Transaction Status. Id `rc_select_N` sinh theo thứ tự render nên KHÔNG dùng làm selector.
 *   - Dropdown của antd portal ra ngoài modal ⇒ tìm ở `.ant-select-dropdown:not(...-hidden)`.
 *
 * VIDEO: cả 3 case là CHUỖI thao tác (chọn → đổi → quan sát ràng buộc), ảnh tĩnh không tả nổi diễn
 * biến ⇒ bật `PW_VIDEO=on` và đính video ở cấp case. Đây cũng là điều gate chất lượng đòi.
 *
 * Fixture TC_47: order 83d65d0f có VNPAY + CASH — cặp PHÂN BIỆT ĐƯỢC (một loại phải có Mã thanh toán,
 * một loại không). Case gợi ý "Chuyển khoản + Tiền mặt", nhưng expected của chính case là "Chuyển khoản
 * HOẶC VNPay" nên VNPay nằm trong spec; hai giao dịch cùng loại thì không chứng minh được gì.
 */

const ORDER_MIXED = '83d65d0f-5817-458b-bc21-05e0de6d0a57';  // VNPAY + CASH
const ORDER_ANY = '0c778c6b-c548-47a9-8b9e-a5496c918dd9';    // đơn IT test, dùng để mở form

const rec = new EvidenceRecorder({
  taskKey: 'SAPP-26523',
  projectOutputDir: process.env.PROJECT_OUTPUT_DIR || 'outputs/lms-operations-automation',
  repoRoot: process.cwd(),
});

const txUrl = (id: string) => `${OPS_BASE}/operations/sales/orders/${id}/detail/list-transaction`;
/** Ô tiêu đề đơn chứa TÊN HỌC VIÊN → luôn mask trong mọi ảnh evidence. */
const piiMask = (page) => [page.locator('h2, h3').first()];

/** Mở dropdown của ant-select thứ `i` trong modal rồi trả về các option đang hiện. */
async function openSelect(page, i: number) {
  await page.locator('.modal.show .ant-select').nth(i).click();
  await page.waitForTimeout(1200);
  const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  return { dd, options: (await dd.locator('.ant-select-item-option').allInnerTexts()).map((s) => s.trim()).filter(Boolean) };
}

async function pickOption(page, i: number, re: RegExp) {
  const { dd } = await openSelect(page, i);
  await dd.locator('.ant-select-item-option').filter({ hasText: re }).first().click();
  await page.waitForTimeout(1200);
}

const selText = (page, i: number) => page.locator('.modal.show .ant-select').nth(i).innerText();
/**
 * Video của chính test này, lưu CẠNH ảnh step rồi trả path repo-relative.
 * `video.path()` KHÔNG dùng được: lúc test còn chạy nó trỏ vào thư mục tạm `.playwright-artifacts-N/`,
 * Playwright chỉ dời file sang chỗ cuối khi context đóng ⇒ status.json ghi đường dẫn không tồn tại.
 * Phải `page.close()` trước rồi `saveAs()` — saveAs đợi video ghi xong và chép tới đích mình chọn.
 */
async function saveVideo(page, tcId: string): Promise<string[]> {
  const v = page.video();
  if (!v) return [];
  const dest = path.join(process.cwd(), process.env.PROJECT_OUTPUT_DIR || 'outputs/lms-operations-automation',
    'tasks', 'SAPP-26523', 'test-results', 'artifacts', tcId, 'flow.webm');
  try {
    await page.close();
    await v.saveAs(dest);
    return [path.relative(process.cwd(), dest).split(path.sep).join('/')];
  } catch { return []; }
}

test.describe('@order SAPP-26523 — Transaction dropdown phụ thuộc (read-only)', () => {
  test.skip(!haveOpsCreds, 'Thiếu OPS creds → skip.');
  test.describe.configure({ mode: 'serial' });

  test('VNPAY_TC_47 — Mã thanh toán chỉ có giá trị với Chuyển khoản/VNPay', async ({ page }) => {
    test.setTimeout(180000);
    const c = rec.case('VNPAY_TC_47');
    await loginOps(page);
    await page.goto(txUrl(ORDER_MIXED), { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(4000);

    const rows = page.locator('.ant-table-tbody .ant-table-row');
    const heads = await page.locator('.ant-table-thead th').allInnerTexts();
    const colCode = heads.findIndex((h) => /Mã thanh toán/i.test(h));
    const colMethod = heads.findIndex((h) => /Payment Method/i.test(h));

    await c.step(page, 'Mở Transaction List của order có cả VNPay và Tiền mặt', {
      highlight: page.locator('.ant-table-thead th').nth(colCode),
      assert: async () => colCode >= 0 && colMethod >= 0 && (await rows.count()) >= 2,
      mask: piiMask(page),
    });

    // Đọc từng dòng: method → mã thanh toán.
    const seen: { method: string; code: string }[] = [];
    for (let i = 0; i < await rows.count(); i++) {
      const tds = await rows.nth(i).locator('td').allInnerTexts();
      seen.push({ method: (tds[colMethod] || '').trim(), code: (tds[colCode] || '').trim() });
    }
    const needCode = seen.filter((r) => /VNPay|Chuyển khoản/i.test(r.method));
    const noCode = seen.filter((r) => /Tiền mặt|Quẹt POS/i.test(r.method));

    const ok = needCode.length > 0 && noCode.length > 0
      && needCode.every((r) => r.code && r.code !== '-')
      && noCode.every((r) => !r.code || r.code === '-');

    const moTa = seen.map((r) => `${r.method} → ${r.code || 'trống'}`).join('; ');
    await c.step(page, `So sánh cột Mã thanh toán giữa các giao dịch (${moTa})`, {
      highlight: rows.first().locator('td').nth(colCode),
      assert: async () => ok,
      mask: piiMask(page),
    });

    expect(needCode.length, 'Fixture thiếu giao dịch VNPay/Chuyển khoản → không phán được').toBeGreaterThan(0);
    expect(noCode.length, 'Fixture thiếu giao dịch Tiền mặt/Quẹt POS → không có mặt đối chứng').toBeGreaterThan(0);
    await c.finish(ok ? 'PASSED' : 'FAILED', {
      evidence: await saveVideo(page, 'VNPAY_TC_47'),
      comment: ok
        ? `Mã thanh toán có giá trị ở ${needCode.length} giao dịch VNPay/Chuyển khoản và để trống ở ${noCode.length} giao dịch Tiền mặt/Quẹt POS — đúng spec.`
        : `product_bug: cột Mã thanh toán không theo Payment method. Quan sát được ${moTa}.`,
    });
    expect(ok, `Mã thanh toán sai theo Payment method: ${JSON.stringify(seen)}`).toBe(true);
  });

  test('VNPAY_TC_48 — Payment Type = Trả góp → Payment method chỉ Quẹt POS', async ({ page }) => {
    test.setTimeout(180000);
    const c = rec.case('VNPAY_TC_48');
    await loginOps(page);
    await page.goto(txUrl(ORDER_ANY), { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(4000);
    await page.getByRole('button', { name: /Add Transaction/i }).click();
    await page.waitForSelector('.modal.show', { timeout: 30000 });
    await page.waitForTimeout(2500);

    await c.step(page, 'Mở form Add Transaction (Transaction Type = Thanh toán học phí)', {
      highlight: '.modal.show .ant-select',
      assert: async () => /học phí/i.test(await selText(page, 0)),
      mask: piiMask(page),
    });

    await pickOption(page, 1, /Trả góp/i);
    await c.step(page, 'Chọn Payment Type = Trả góp', {
      highlight: page.locator('.modal.show .ant-select').nth(1),
      assert: async () => /Trả góp/i.test(await selText(page, 1)),
      mask: piiMask(page),
    });

    const { options } = await openSelect(page, 2);
    const onlyPos = options.length > 0 && options.every((o) => /Quẹt POS/i.test(o));
    await c.step(page, `Mở dropdown Payment method, thấy các lựa chọn: ${options.join(', ') || 'không có lựa chọn nào'}`, {
      highlight: '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
      assert: async () => onlyPos,
      mask: piiMask(page),
    });

    await c.finish(onlyPos ? 'PASSED' : 'FAILED', {
      evidence: await saveVideo(page, 'VNPAY_TC_48'),
      comment: onlyPos
        ? `Khi Payment Type là Trả góp, dropdown Payment method chỉ còn lựa chọn ${options.join(', ')} — đúng spec.`
        : `product_bug: Trả góp lẽ ra chỉ cho Quẹt POS, thực tế dropdown còn cho chọn ${options.join(', ')}.`,
    });
    expect(onlyPos, `Payment method khi Trả góp = ${JSON.stringify(options)} (kỳ vọng chỉ Quẹt POS)`).toBe(true);
  });

  test('VNPAY_TC_49 — Đổi Trả thẳng → Trả góp RESET Payment method', async ({ page }) => {
    test.setTimeout(180000);
    const c = rec.case('VNPAY_TC_49');
    await loginOps(page);
    await page.goto(txUrl(ORDER_ANY), { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(4000);
    await page.getByRole('button', { name: /Add Transaction/i }).click();
    await page.waitForSelector('.modal.show', { timeout: 30000 });
    await page.waitForTimeout(2500);

    await pickOption(page, 1, /Trả thẳng/i);
    await pickOption(page, 2, /Tiền mặt/i);
    const before = (await selText(page, 2)).trim();
    await c.step(page, 'Chọn Payment Type Trả thẳng rồi chọn Payment method Tiền mặt', {
      highlight: page.locator('.modal.show .ant-select').nth(2),
      assert: async () => /Tiền mặt/i.test(before),
      mask: piiMask(page),
    });

    await pickOption(page, 1, /Trả góp/i);
    await c.step(page, 'Đổi Payment Type = Trả góp', {
      highlight: page.locator('.modal.show .ant-select').nth(1),
      assert: async () => /Trả góp/i.test(await selText(page, 1)),
      mask: piiMask(page),
    });

    const after = (await selText(page, 2)).trim();
    // RESET = không còn giữ lựa chọn cũ. Placeholder "Select Payment Method" cũng là reset hợp lệ.
    const wasReset = !/Tiền mặt/i.test(after);
    // ant-select in text nhiều dòng (label + value) → chỉ lấy dòng đầu cho comment người đọc.
    const afterShort = after.split(String.fromCharCode(10))[0].trim();
    await c.step(page, `Xem lại Payment method sau khi đổi, giờ hiển thị ${afterShort}`, {
      highlight: page.locator('.modal.show .ant-select').nth(2),
      assert: async () => wasReset,
      mask: piiMask(page),
    });

    await c.finish(wasReset ? 'PASSED' : 'FAILED', {
      evidence: await saveVideo(page, 'VNPAY_TC_49'),
      comment: wasReset
        ? [`- Đổi Payment Type sang Trả góp: lựa chọn Tiền mặt của Trả thẳng không còn được giữ.`,
           `- Ô Payment method chuyển sang ${afterShort}, không về rỗng.`,
           `- Sắc thái cần BA xác nhận: form tự chọn luôn lựa chọn hợp lệ duy nhất của Trả góp; nếu spec hiểu "reset" là ô phải trống thì đây là lệch.`].join(String.fromCharCode(10))
        : `product_bug: đổi Payment Type sang Trả góp nhưng Payment method vẫn giữ lựa chọn ${afterShort} của Trả thẳng.`,
    });
    expect(wasReset, `Payment method KHÔNG reset: vẫn "${after}"`).toBe(true);
  });

  test.afterAll(() => { rec.write(); });
});
