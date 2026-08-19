import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * @infra — assert HÌNH HỌC: bắt đúng những ca mà `toBeVisible()` vẫn PASS.
 *
 * Bất đối xứng oracle: BE có Swagger (máy đọc được) nên assert `total = 540000`; FE chỉ có Figma nên assert thoái
 * hoá thành `toBeVisible()`. Mỗi test dưới đây dựng một DOM mà `toBeVisible()` **xanh** nhưng người dùng **không
 * dùng được** — đó chính là khoảng cách bug FE đang lọt qua.
 */
const geo = require(path.resolve(__dirname, '../../../scripts/utils/ui/geometry.js'));

test.describe('@infra geometry — toBeVisible() không đủ', () => {
  test('element bị ĐÈ lên: toBeVisible PASS nhưng không bấm được', async ({ page }) => {
    await page.setContent(`<div style="position:relative;width:300px;height:100px">
      <button id="btn" style="position:absolute;left:0;top:0;width:200px;height:40px">Thanh toán</button>
      <div id="mask" style="position:absolute;left:0;top:0;width:300px;height:100px;background:#0003"></div>
    </div>`);
    await expect(page.locator('#btn')).toBeVisible();          // ← DOM assertion vẫn XANH
    const r = await geo.inspectGeometry(page, '#btn');
    expect(r.ok, 'hình học phải phát hiện bị đè').toBe(false);
    expect(r.problems.join(' ')).toMatch(/bị ĐÈ/);
  });

  test('chữ trắng trên nền trắng: có text nhưng không đọc được', async ({ page }) => {
    await page.setContent('<div id="t" style="color:#fff;background:#fff;width:200px;height:30px">Tổng: 540.000đ</div>');
    await expect(page.locator('#t')).toContainText('540.000');  // ← vẫn XANH
    const r = await geo.inspectGeometry(page, '#t');
    expect(r.problems.join(' ')).toMatch(/trùng màu nền/);
  });

  test('nội dung BỊ CẮT (ellipsis) — người dùng không đọc đủ', async ({ page }) => {
    await page.setContent(`<div id="c" style="width:80px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
      ${geo.LONG_VI.course}</div>`);
    const r = await geo.inspectGeometry(page, '#c');
    expect(r.problems.join(' ')).toMatch(/BỊ CẮT/);
  });

  test('element ngoài viewport / kích thước 0 đều bị bắt', async ({ page }) => {
    await page.setContent(`<div id="off" style="position:absolute;left:-9999px;width:50px;height:20px">x</div>
      <div id="zero" style="width:0;height:0;overflow:hidden">y</div>`);
    expect((await geo.inspectGeometry(page, '#off')).problems.join(' ')).toMatch(/NGOÀI viewport/);
    expect((await geo.inspectGeometry(page, '#zero')).problems.join(' ')).toMatch(/kích thước 0×0/);
  });

  test('touch target < 44px chỉ bị bắt khi được YÊU CẦU (không báo oan desktop)', async ({ page }) => {
    await page.setContent('<button id="b" style="width:100px;height:24px">Lưu</button>');
    expect((await geo.inspectGeometry(page, '#b')).ok, 'desktop: 24px cao là bình thường').toBe(true);
    const m = await geo.inspectGeometry(page, '#b', { minTouch: 44 });
    expect(m.problems.join(' ')).toMatch(/touch target/);
  });

  test('element lành thì KHÔNG báo gì (chống báo oan)', async ({ page }) => {
    await page.setContent('<div style="padding:20px"><button id="ok" style="width:160px;height:44px;background:#123;color:#fff">Xác nhận</button></div>');
    const r = await geo.inspectGeometry(page, '#ok', { minTouch: 44 });
    expect(r.problems, `không được báo oan: ${r.problems.join(' | ')}`).toEqual([]);
  });
});

test.describe('@infra text dài tiếng Việt — ổ bug testcase không nghĩ tới', () => {
  test('mẫu text dài theo quy ước đặt tên IT test, và dài hơn text ngắn ~2x', () => {
    for (const k of ['name', 'address', 'course', 'note']) {
      expect(geo.LONG_VI[k].startsWith('IT test'), `${k} phải theo quy ước đặt tên dữ liệu test`).toBe(true);
      expect(geo.LONG_VI[k].length).toBeGreaterThan(40);
      expect(/[ăâđêôơưáàảãạếệốộớợứựíìỉĩị]/i.test(geo.LONG_VI[k]), 'phải CÓ DẤU (dòng cao hơn, dễ vỡ layout)').toBe(true);
    }
  });

  test('tên dài làm tràn khung cha thì bị bắt', async ({ page }) => {
    await page.setContent(`<div style="width:120px;overflow:visible;white-space:nowrap">
      <span id="n">${geo.LONG_VI.name}</span></div>`);
    const r = await geo.inspectLongText(page, '#n');
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toMatch(/tràn/);
  });

  test('khung đủ rộng thì text dài KHÔNG bị coi là lỗi', async ({ page }) => {
    await page.setContent(`<div style="width:1200px"><span id="n">${geo.LONG_VI.name}</span></div>`);
    expect((await geo.inspectLongText(page, '#n')).problems).toEqual([]);
  });
});
