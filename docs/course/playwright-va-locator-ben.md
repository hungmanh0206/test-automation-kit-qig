# Bài 12 — Playwright từ số 0

> **2 giờ 30 phút** · Có gì trong tay: bộ testcase đã review · Sau bài này: suite chạy được, và locator không đoán

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Test tự động viết vội hay đỏ vì tìm nhầm nút, không phải vì app sai. Rồi bạn hết tin nó. |
| **Bài này bạn gõ gì** | Cấu hình Playwright, dò thử giao diện, và viết case đầu tiên chạy trên app thực hành. |
| **Xong thì được gì** | Suite chạy được, và không vỡ mỗi khi giao diện đổi chút ít. |

## Mục tiêu

✅ Cài Playwright, chạy test đầu tiên, hiểu cấu trúc một spec.
✅ Nắm chiến lược locator theo tầng, và **kiểm** app của bạn có phát test id không.
✅ Đọc DOM thật để tìm locator, thay vì đoán từ tên tính năng.
✅ Hiểu vì sao `.first()`, `.nth(N)`, click theo toạ độ đều là dấu hiệu không biết mình chạm cái gì.
✅ Viết 3 test cho 3 màn, không dùng locator mơ hồ nào.
✅ Xử lý ba nguồn chập chờn phổ biến.

---

## 1. Cài và cấu hình

```bash
npm i -D @playwright/test
npx playwright install chromium
```

`playwright.config.js`:

```js
// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  // forbidOnly: chặn .only lọt vào CI — một .only là cả suite chỉ chạy 1 test mà vẫn XANH.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: process.env.APP_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Tắt animation: nguồn chập chờn số một, và tắt được thì không phải chờ thời gian.
    launchOptions: { args: ['--force-prefers-reduced-motion'] }
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
```

Ba dòng đáng để ý, mỗi dòng chặn một lớp lỗi:

| Dòng | Chặn gì |
|---|---|
| `forbidOnly` khi CI | Một `.only` sót lại làm cả suite chỉ chạy **một** test mà vẫn xanh. Cùng lớp lỗi "suite rỗng vẫn xanh" ở Bài 11 |
| `reporter: json` | Sinh `results.json` — Bài 13 và Bài 11 đều đọc file này |
| `retries: 2` chỉ ở CI | Local thì **không** retry: bạn cần thấy nó đỏ để sửa, không phải để nó tự xanh |

## 2. Chiến lược locator theo tầng

Xếp theo độ bền giảm dần:

| Tầng | Cách | Bền vì | Ví dụ |
|---|---|---|---|
| 1 | **Vai trò + tên hiển thị** | Đổi CSS không ảnh hưởng; khớp cách người dùng nhìn | `getByRole('button', { name: 'Lưu nháp', exact: true })` |
| 2 | **Nhãn của ô nhập** | Nhãn là hợp đồng với người dùng | `getByLabel('Số lượng')` |
| 3 | **Chữ hiển thị** | Chữ đổi thì test **nên** đỏ | `getByText('Đã lưu đơn nháp', { exact: true })` |
| 4 | **Selector có ngữ nghĩa** | Ổn nếu neo vào cấu trúc, không vào class trang trí | `locator('table thead th')` |
| 5 | **Test id** | Bền nhất — **nếu app có phát** | `getByTestId('tong-cong')` |

### Kiểm ngay: app của bạn có test id không

Đừng giả định. Đo:

```js
const { test } = require('@playwright/test');

test('khảo sát: app có phát test id không', async ({ page }) => {
  await page.goto('/orders/create');
  const soTestId = await page.locator('[data-testid]').count();
  const soAriaLabel = await page.locator('[aria-label]').count();
  const soLabel = await page.locator('label').count();
  console.log({ soTestId, soAriaLabel, soLabel });
});
```

`soTestId = 0` nghĩa là **tầng 5 là tầng chết** với app của bạn. Đừng viết hướng dẫn "ưu tiên test id" rồi
để đó — nó sẽ khiến người sau đi tìm thứ không tồn tại.

> Chuyện thật ở kit này: `getByTestId` xuất hiện **0 lần dùng thật** trong repo (2 chỗ khớp đều nằm trong
> comment giải thích đúng chuyện này), và `tests/**` không có `data-testid` nào. App dựng bằng ant-design cộng
> Metronic nên **không phát test id**. Kết luận: tầng 5 chết, và locator bền chỉ lấy được bằng cách **đọc DOM**.

## 3. Đọc DOM thật, đừng đoán

Đây là bước bị bỏ nhiều nhất, và là **nguồn lỗi script lớn nhất ở lượt chạy đầu**: agent (và người) đoán
locator từ tên tính năng — `#btn-save`, `.total-amount` — rồi test đỏ vì element không tồn tại.

`tests/support/kham-pha-dom.js`:

```js
/*
 * kham-pha-dom.js — khảo sát DOM thật của một màn để tìm locator BỀN.
 *
 * VÌ SAO CẦN: kit có chuẩn locator, có máy kiểm chất lượng locator, nhưng thiếu bước khám phá LÚC ĐẦU.
 * Không có nó thì agent đoán locator từ tên tính năng — nguồn script_error lớn nhất ở lượt chạy đầu.
 */
'use strict';

/** Liệt kê mọi element tương tác được, kèm locator ĐỀ XUẤT theo tầng ưu tiên. */
async function khaoSat(page) {
  return page.evaluate(() => {
    const ra = [];
    const els = document.querySelectorAll('button, a[href], input, select, textarea, [role=button]');
    for (const el of els) {
      const role = el.getAttribute('role') ||
        ({ BUTTON: 'button', A: 'link', INPUT: 'textbox', SELECT: 'combobox', TEXTAREA: 'textbox' })[el.tagName];
      const ten = (el.getAttribute('aria-label') ||
        el.textContent?.trim() ||
        el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').slice(0, 50);
      const testId = el.getAttribute('data-testid');
      const nhan = el.labels && el.labels[0] ? el.labels[0].textContent.trim() : null;

      let deXuat;
      if (testId) deXuat = `getByTestId('${testId}')`;
      else if (nhan) deXuat = `getByLabel('${nhan}')`;
      else if (role && ten) deXuat = `getByRole('${role}', { name: '${ten}', exact: true })`;
      else deXuat = null;   // null = KHÔNG có locator bền ⇒ cần nhờ Dev thêm nhãn

      ra.push({ tag: el.tagName.toLowerCase(), role, ten, nhan, testId, deXuat });
    }
    return ra;
  });
}

/** Liệt kê tên cột của một bảng — dùng cho case chiều [Display] ở Bài 11. */
async function cotBang(page, selectorBang = 'table') {
  return page.$$eval(`${selectorBang} thead th`,
    (ths) => ths.map((t) => t.textContent.replace(/\s+/g, ' ').trim()));
}

module.exports = { khaoSat, cotBang };
```

Chạy nó một lần cho mỗi màn mới, **trước khi** viết test:

```js
const { test } = require('@playwright/test');
const { khaoSat, cotBang } = require('./support/kham-pha-dom');

test('khám phá màn Tạo đơn hàng', async ({ page }) => {
  await page.goto('/orders/create');
  const els = await khaoSat(page);
  console.log('Không có locator bền:', els.filter((e) => !e.deXuat));
  console.log('Đề xuất:', els.filter((e) => e.deXuat).map((e) => e.deXuat));
  console.log('Cột khối B:', await cotBang(page, '#products-table'));
});
```

Danh sách **"không có locator bền"** là danh sách bạn mang đi nhờ Dev thêm `aria-label`. Đó là việc rẻ với họ
và tiết kiệm rất nhiều cho bạn.

## 4. Bốn mẫu locator ẩu, và vì sao chúng nguy hiểm

| Mẫu | Nó nói gì về bạn | Hậu quả |
|---|---|---|
| `.first()` | "Có nhiều element khớp, tôi lấy cái đầu" | Thứ tự DOM đổi → chạm element khác, **không lỗi**, chỉ sai |
| `.nth(3)` | "Tôi đếm được vị trí" | Thêm một dòng vào bảng là lệch hết |
| `mouse.click(x, y)` | "Tôi không tìm được element" | Đổi layout hoặc zoom là click vào chỗ trống |
| Regex trên `body.innerText` | "Tôi tìm con số ở đâu đó trên trang" | Bắt trúng con số **ở khu vực khác** |

Đo thật trên một task lớn ở kit này: `.first()` **2052 lần** · `force: true` **1011** · regex trên
`body.innerText` **204** · `querySelectorAll('*')` **166** · `.nth(N)` **141** · click theo toạ độ **31**.

> Điểm chung của cả bốn: **chúng không làm test đỏ.** Chúng làm test đọc nhầm giá trị, click nhầm nút, rồi
> báo một lỗi **không tồn tại**. Dev điều tra xong trả về *"log sai"* — mất thời gian hai phía và mất uy tín
> của báo cáo.

### Cách chữa: thu hẹp vùng, đừng chọn thứ tự

```js
const { test, expect } = require('@playwright/test');

test('thu hẹp vùng thay vì chọn theo thứ tự', async ({ page }) => {
  await page.goto('/orders/create');

  // ✗ SAI: có 20 nút Xoá trên trang, lấy cái đầu là ngẫu nhiên
  // await page.getByRole('button', { name: 'Xoá' }).first().click();

  // ✓ ĐÚNG: neo vào DÒNG chứa sản phẩm cần xoá, rồi tìm nút trong dòng đó
  const dong = page.getByRole('row').filter({ hasText: 'SP_A' });
  await dong.getByRole('button', { name: 'Xoá', exact: true }).click();

  // ✓ ĐÚNG: đọc giá trị trong đúng vùng, không regex cả trang
  const tongCong = page.locator('#tong-ket').getByLabel('Tổng cộng');
  await expect(tongCong).toHaveText('321.000');
});
```

Nguyên tắc: **thu hẹp bằng ngữ cảnh** (`filter({ hasText })`, lồng trong vùng cha) chứ không **chọn theo vị trí**.

## 5. Ba nguồn chập chờn, và cách chữa từng cái

| Nguồn | Triệu chứng | Chữa sai | Chữa đúng |
|---|---|---|---|
| Animation chưa xong | Click không ăn, hoặc ăn vào element cũ | `waitForTimeout(1000)` | Tắt animation ở config; chờ **trạng thái** |
| Chờ thời gian | Máy nhanh thì pass, CI chậm thì đỏ | Tăng thời gian chờ | `expect(...).toBeVisible()` — chờ điều kiện |
| Toạ độ lấy trước khi layout ổn định | Click lệch vài pixel | Thêm chờ trước khi click | Dùng locator, để Playwright tự chờ |

```js
const { test, expect } = require('@playwright/test');

test('chờ trạng thái, không chờ thời gian', async ({ page }) => {
  await page.goto('/orders/create');
  await page.getByLabel('Số lượng').fill('3');

  // ✗ SAI: đoán 500ms là đủ. Máy chậm hơn thì đỏ, máy nhanh hơn thì chậm vô ích.
  // await page.waitForTimeout(500);

  // ✓ ĐÚNG: chờ đúng ĐIỀU KIỆN mình cần. Playwright tự thử lại tới khi đạt hoặc hết hạn.
  await expect(page.locator('#tong-ket').getByLabel('Tổng cộng')).toHaveText('321.000');
});
```

> `waitForTimeout` trong mã production của suite là **mùi**. Nó nói: *tôi không biết chờ điều kiện gì, nên
> tôi chờ bừa.* Và ở Bài 13 bạn sẽ thấy nó còn tệ hơn thế — một cái `wait` thêm vào để cho test xanh có thể
> đang **lấp một bug hiệu năng thật**.

## 6. Một spec đầy đủ

Nối lại: case `[E2E]` từ Bài 11, oracle có neo từ Bài 10.

`tests/orders/tao-don.spec.js`:

```js
const { test, expect } = require('@playwright/test');

test.describe('Tạo đơn hàng', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/orders/create');
  });

  // TC_015 [E2E] — oracle: BR-01 BR-02 BR-03 (xem requirements/phan-tich.md)
  test('TC_015 [E2E] tạo đơn → lưu nháp → chi tiết, giá trị còn nguyên', async ({ page }) => {
    // Tiền điều kiện: KH_BAC_01 hạng Bạc, SP_A giá 100.000 (Bài 12 sẽ dựng bằng factory)
    await page.getByLabel('Tìm khách hàng').fill('KH_BAC_01');
    await page.getByRole('option', { name: 'KH_BAC_01', exact: true }).click();

    await page.getByRole('button', { name: 'Thêm dòng', exact: true }).click();
    const dong = page.getByRole('row').filter({ hasText: 'Chọn sản phẩm' });
    await dong.getByLabel('Sản phẩm').selectOption('SP_A');
    await dong.getByLabel('Số lượng').fill('3');

    // Oracle từ TÀI LIỆU, không đọc Đơn giá từ màn hình rồi tự tính (Bài 10 mục 2 dạng ②)
    const tongKet = page.locator('#tong-ket');
    await expect(tongKet.getByLabel('Tạm tính')).toHaveText('300.000');      // BR-03
    await expect(tongKet.getByLabel('Giảm giá')).toHaveText('9.000');        // BR-01: Bạc 3%
    await expect(tongKet.getByLabel('Phí giao hàng')).toHaveText('30.000');  // BR-02: < 500.000
    await expect(tongKet.getByLabel('Tổng cộng')).toHaveText('321.000');     // BR-03

    await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();

    // Chữ hiển thị: so khớp TOÀN CHUỖI, không dùng contains (Bài 10 mục 4)
    await expect(page.getByRole('alert')).toHaveText('Đã lưu đơn nháp');
    await expect(page).toHaveURL(/\/orders\/\d+$/);

    // Giá trị phải SỐNG SÓT qua chuyển màn — đây là phần [E2E] thật sự
    const ketChiTiet = page.locator('#tong-ket');
    await expect(ketChiTiet.getByLabel('Tổng cộng')).toHaveText('321.000');
  });

  // TC_013 [Display] — oracle: bảng khối B trong tài liệu mục 2
  test('TC_013 [Display] khối B đủ 4 cột, đúng thứ tự và nhãn', async ({ page }) => {
    const cot = await page.$$eval('#products-table thead th',
      (ths) => ths.map((t) => t.textContent.replace(/\s+/g, ' ').trim()));
    // So khớp CHÍNH XÁC cả nội dung lẫn thứ tự — không dùng "có chứa"
    expect(cot).toEqual(['Sản phẩm', 'Số lượng', 'Đơn giá', 'Thành tiền']);
  });
});
```

Ba điều làm spec này khác spec thông thường:

1. **Tên test mang `TC ID` và tag chiều** — nối được kết quả về testcase canonical (Bài 13 cần điều này).
2. **Comment ghi mã oracle** — người review biết kiểm đối chiếu ở đâu.
3. **Giá trị kỳ vọng là hằng số từ tài liệu**, không tính từ màn hình.

## 7. Chạy và đọc kết quả

```bash
npx playwright test                       # cả suite
npx playwright test --list                # đếm — Bài 11 dùng để chống suite rỗng
npx playwright test -g "TC_015"           # một test
npx playwright test --headed --debug      # xem tận mắt khi đỏ
npx playwright show-report                # báo cáo HTML
```

`--list` là lệnh bạn nên chạy **mỗi lần sửa cấu trúc thư mục**. Nó trả lời: *runner có còn thấy test của tôi
không?* Bài 11 sẽ biến nó thành gate.

---

## Thực hành (75 phút)

### Bước 1 — Cài và cấu hình (10 phút)

Cài Playwright, tạo `playwright.config.js` theo mục 1. Chạy `npx playwright test --list` — phải in ra `0 test`
(chưa có spec nào), không phải lỗi.

### Bước 2 — Khảo sát app của bạn (15 phút)

Viết `tests/support/kham-pha-dom.js` và một spec khảo sát. Chạy rồi ghi ba con số:

| Chỉ số | Số | Nghĩa |
|---|---|---|
| Element có `data-testid` | | 0 ⇒ tầng 5 là tầng chết |
| Element có `aria-label` | | càng nhiều càng dễ |
| Element **không có locator bền** | | danh sách mang đi nhờ Dev |

### Bước 3 — Viết 3 test (30 phút)

Chọn 3 case từ bộ Bài 11, ưu tiên khác chiều nhau: một `[Calc]`, một `[Display]`, một `[E2E]`.

Ràng buộc **không được vi phạm**:
- Không `.first()`, không `.nth(N)`, không `mouse.click(x, y)`, không regex trên `body.innerText`.
- Không `waitForTimeout`.
- Giá trị kỳ vọng là **hằng số từ tài liệu**.
- Tên test mang `TC ID` và tag chiều.

### Bước 4 — Tự soi bằng máy (10 phút)

```bash
grep -rn "\.first()\|\.nth(\|mouse\.click\|waitForTimeout\|body\.innerText" tests/ && \
  echo "^ CÒN MẪU ẨU — sửa trước khi commit" || echo "sạch"
```

Còn dòng nào thì sửa. **Đừng thêm vào danh sách bỏ qua** — ở Bài 11 bạn sẽ biến chính lệnh này thành gate,
và lúc đó nó sẽ đỏ.

### Bước 5 — Commit

```bash
git add playwright.config.js tests package.json
git commit -m "feat(test): suite đầu tiên — 3 test, locator theo tầng, không mẫu ẩu

Khảo sát DOM: <N> element có testid, <M> element chưa có locator bền (đã gửi Dev)."
```

---

## Cây thư mục sau bài này

```
kit-cua-toi/
├── playwright.config.js          ← SỬA · forbidOnly · retries chỉ ở CI · reporter json
├── scripts/utils/
│   └── kham-pha-dom.js           ← MỚI · dò locator có sẵn trước khi đoán
├── scripts/qa/
│   └── locator_lint.js           ← MỚI · class động / xpath theo vị trí ⇒ chặn
└── tests/
    ├── support/
    │   └── fixtures/index.js     ← MỚI · fixture chung
    └── e2e/
        └── tao-don.spec.js        ← MỚI · case đầu tiên qua giao diện
```

## Tự kiểm

- [ ] `npx playwright test --list` in ra đúng số test tôi đã viết.
- [ ] Tôi **đo được** app của mình có bao nhiêu `data-testid`, không đoán.
- [ ] Tôi đã khảo sát DOM **trước** khi viết test, và có danh sách element chưa có locator bền.
- [ ] 3 test của tôi không có `.first()`, `.nth(N)`, click toạ độ, hay regex toàn trang.
- [ ] 3 test của tôi không có `waitForTimeout` nào.
- [ ] Giá trị kỳ vọng lấy từ **tài liệu**, không đọc từ màn hình rồi tự tính.
- [ ] Tên test mang `TC ID` và tag chiều.
- [ ] `forbidOnly` đã bật cho CI, và tôi hiểu nó chặn lớp lỗi gì.
- [ ] Lệnh grep ở Bước 4 chạy ra **sạch**.

## Bài tập về nhà

Chạy lệnh grep ở Bước 4 lên **suite thật** của dự án bạn (nếu có). Đếm từng mẫu.

Đừng sửa hàng loạt. Thay vào đó chọn **một** test có `.first()` và làm phép thử này: đổi thứ tự dữ liệu trên
màn (thêm một dòng vào đầu bảng chẳng hạn) rồi chạy lại. Test vẫn **xanh** không? Nếu xanh thì nó đang kiểm
một element khác so với ý bạn — và đó chính là lớp lỗi *log sai bug* ở mục 4.

## Đọc thêm

- [`.agent/skills/phase2/ui_debug_agent/SKILL.md`](../../.agent/skills/phase2/ui_debug_agent/SKILL.md) —
  skill khám phá DOM của kit này, bản đầy đủ.
- Bài 12 sẽ dựng dữ liệu cho phần tiền điều kiện mà 3 test này đang giả định có sẵn.
