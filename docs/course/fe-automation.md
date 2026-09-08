# Bài 9 — Viết UI automation ít gãy hơn

> **2 giờ 30 phút** · Có gì trong tay: fixture dựng được state, test vẫn hay đỏ vì không tìm thấy element · Sau bài này: locator không gãy khi giao diện đổi, và test hết chập chờn

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Test đỏ, mà đỏ vì không tìm thấy nút chứ không phải vì sản phẩm sai. Sửa xong hôm nay, tuần sau gãy chỗ khác. |
| **Bài này bạn gõ gì** | Chọn locator theo thang ưu tiên, đọc DOM thật thay vì đoán, và một máy chặn mẫu ẩu. |
| **Xong thì được gì** | Bộ test FE chịu được thay đổi giao diện, và bạn phân biệt được "không tìm thấy" với "sản phẩm sai". |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Locator** | Cách chỉ cho công cụ biết bạn đang nói tới element nào |
| **Locator gãy** | Giao diện đổi một chút là không khớp nữa, dù element vẫn còn đó |
| **Bắt sai element** | Locator khớp, nhưng khớp nhầm element khác. Nguy hiểm hơn gãy hẳn |
| **Chập chờn** (flaky) | Cùng một test, cùng một app, lúc xanh lúc đỏ |

## Bài này bạn sẽ làm gì

Bốn việc:

1. Thang ưu tiên khi chọn locator (35 phút).
2. Đọc DOM thật thay vì đoán (40 phút).
3. Bốn mẫu locator ẩu, và vì sao chúng nguy hiểm hơn locator gãy (35 phút).
4. Ba nguồn chập chờn, và cách chữa từng cái (30 phút).

Rồi **xây gate** chặn mẫu ẩu mới ở cuối bài.

---

## Việc 1 — Chiến lược locator theo tầng

Xếp theo độ bền giảm dần:

| Tầng | Cách | Bền vì | Ví dụ |
|---|---|---|---|
| 1 | **Vai trò + tên hiển thị** | Đổi CSS không ảnh hưởng; khớp cách người dùng nhìn | `getByRole('button', { name: 'Lưu nháp', exact: true })` |
| 2 | **Nhãn của ô nhập** | Nhãn là hợp đồng với người dùng | `getByLabel('Số lượng')` |
| 3 | **Chữ hiển thị** | Chữ đổi thì test **nên** đỏ | `getByText('Đã lưu đơn nháp', { exact: true })` |
| 4 | **Selector có ngữ nghĩa** | Ổn nếu neo vào cấu trúc, không vào class trang trí | `locator('table thead th')` |
| 5 | **Test id** | Bền nhất — nếu app có phát | `getByTestId('tong-cong')` |

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

`soTestId = 0` nghĩa là tầng 5 là tầng chết với app của bạn. Đừng viết hướng dẫn "ưu tiên test id" rồi
để đó. Nó sẽ khiến người sau đi tìm thứ không tồn tại.

> Chuyện thật ở kit này: `getByTestId` xuất hiện 0 lần dùng thật trong repo (2 chỗ khớp đều nằm trong
> comment giải thích đúng chuyện này), và `tests/**` không có `data-testid` nào. App dựng bằng ant-design cộng
> Metronic nên không phát test id. Kết luận: tầng 5 chết, và locator bền chỉ lấy được bằng cách **đọc DOM**.

## Việc 2 — Đọc DOM thật, đừng đoán

Đây là bước bị bỏ nhiều nhất, và là nguồn lỗi script lớn nhất ở lượt chạy đầu: agent (và người) đoán
locator từ tên tính năng. `#btn-save`, `.total-amount`, rồi test đỏ vì element không tồn tại.

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

/** Liệt kê tên cột của một bảng — dùng cho case chiều [Display] ở Bài 14. */
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

Danh sách "không có locator bền" là danh sách bạn mang đi nhờ Dev thêm `aria-label`. Đó là việc rẻ với họ
và tiết kiệm rất nhiều cho bạn.

## Việc 3 — Bốn mẫu locator ẩu, và vì sao chúng nguy hiểm

| Mẫu | Nó nói gì về bạn | Hậu quả |
|---|---|---|
| `.first()` | "Có nhiều element khớp, tôi lấy cái đầu" | Thứ tự DOM đổi → chạm element khác, **không lỗi**, chỉ sai |
| `.nth(3)` | "Tôi đếm được vị trí" | Thêm một dòng vào bảng là lệch hết |
| `mouse.click(x, y)` | "Tôi không tìm được element" | Đổi layout hoặc zoom là click vào chỗ trống |
| Regex trên `body.innerText` | "Tôi tìm con số ở đâu đó trên trang" | Bắt trúng con số ở khu vực khác |

Con số dưới đây đo bằng `npm run lint:locator` (bạn dựng nó ở cuối bài) trên **một bộ test thật của
một dự án đang chạy**, khoảng 900 tệp. Nó là số của repo đó, không phải một mức trung bình của ngành: `.first()` **2052 lần** · `force: true` **1011** · regex trên
`body.innerText` **204** · `querySelectorAll('*')` **166** · `.nth(N)` 141 · click theo toạ độ 31.

> Điểm chung của cả bốn: chúng không làm test đỏ. Chúng làm test đọc nhầm giá trị, click nhầm nút, rồi
> báo một lỗi không tồn tại. Dev điều tra xong trả về *"log sai"* — mất thời gian hai phía và mất uy tín
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

Nguyên tắc: thu hẹp bằng ngữ cảnh (`filter({ hasText })`, lồng trong vùng cha) chứ không chọn theo vị trí.

## Việc 4 — Ba nguồn chập chờn, và cách chữa từng cái

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
> tôi chờ bừa.* Và ở Bài 17 bạn sẽ thấy nó còn tệ hơn thế. Một cái `wait` thêm vào để cho test xanh có thể
> đang lấp một bug hiệu năng thật.


## Xây gate — chặn mẫu ẩu MỚI, không bắt sửa hết lịch sử

Bốn mẫu ở Việc 3 đếm được bằng máy. Nhưng bật một gate làm đỏ 200 chỗ có sẵn thì nó bị tắt trong một
ngày. Nên gate này dùng **mốc so sánh**: ghi lại số hiện tại, và chỉ chặn khi số đó tăng.

`scripts/qa/lint-locator.js`:

```js
#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const GOC = path.resolve(__dirname, '..', '..');
const MOC = path.join(GOC, '.agent/config/locator-baseline.json');

const MAU_AU = [
  { ten: 'first',      re: /\.first\(\)/g,                 vi: 'không biết đang chạm element nào trong nhiều element khớp' },
  { ten: 'nth',        re: /\.nth\(\d+\)/g,                vi: 'phụ thuộc thứ tự DOM, mà thứ tự DOM thay đổi được' },
  { ten: 'force',      re: /force:\s*true/g,               vi: 'bấm xuyên qua lớp che, nên bỏ qua đúng thứ cần kiểm' },
  { ten: 'toa-do',     re: /mouse\.click\(\s*\d/g,         vi: 'toạ độ tuyệt đối, đổi cỡ màn hình là sai' },
];

function quet(thuMuc) {
  const dem = {};
  const dsFile = [];
  (function di(d) {
    for (const en of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, en.name);
      if (en.isDirectory()) { di(p); continue; }
      if (/\.(js|ts)$/.test(en.name)) dsFile.push(p);
    }
  })(thuMuc);

  for (const f of dsFile) {
    const noi = fs.readFileSync(f, 'utf8');
    for (const m of MAU_AU) {
      const n = (noi.match(m.re) || []).length;
      if (n) dem[m.ten] = (dem[m.ten] || 0) + n;
    }
  }
  return dem;
}

const nay = quet(path.join(GOC, 'tests'));

if (process.argv.includes('--ghi-moc')) {
  fs.writeFileSync(MOC, JSON.stringify(nay, null, 2) + '\n');
  console.log('[locator] đã ghi mốc: ' + JSON.stringify(nay));
  process.exit(0);
}

const truoc = fs.existsSync(MOC) ? JSON.parse(fs.readFileSync(MOC, 'utf8')) : {};
const tang = [];
for (const m of MAU_AU) {
  const cu = truoc[m.ten] || 0;
  const moi = nay[m.ten] || 0;
  if (moi > cu) tang.push(`${m.ten}: ${cu} → ${moi}   (${m.vi})`);
}

if (tang.length) {
  console.error('[locator] ✗ CHẶN — mẫu ẩu tăng thêm:\n  ' + tang.join('\n  '));
  console.error('  Sửa chỗ mới thêm. Nếu thật sự cần, khai lý do trong review rồi chạy --ghi-moc.');
  process.exit(1);
}

console.log('[locator] ✓ không có mẫu ẩu mới.');
```

### Đối chứng

```bash
# Ghi mốc hiện tại
node scripts/qa/lint-locator.js --ghi-moc

# Ca phải CHO QUA
npm run lint:locator            # → ✓, mã thoát 0

# Ca phải CHẶN — thêm một .first() vào một file test
npm run lint:locator            # → ✗ CHẶN, first: 0 → 1, mã thoát 1
```

Rồi bỏ dòng vừa thêm.

Điểm quan trọng của cơ chế mốc: nó **không tha** cho code mới, mà cũng **không đòi** bạn dọn hết lịch
sử trong một hôm. Một gate làm đỏ toàn bộ repo là một gate sắp bị tắt.

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   ├── env-allow.json            ·  từ Bài 6
│   └── locator-baseline.json     ← MỚI · số mẫu ẩu hiện tại
├── scripts/qa/
│   ├── kiem-cau-hinh.js          ·  từ Bài 6
│   └── lint-locator.js           ← MỚI · mẫu ẩu tăng thêm ⇒ chặn
└── tests/
    ├── support/
    │   ├── factory.js            ·  từ Bài 7
    │   ├── janitor.js            ·  từ Bài 7
    │   └── fixtures/             ·  từ Bài 8
    └── e2e/
        └── tao-don-hang.spec.js  ·  từ Bài 4, nay locator đã sửa
```

## Tự kiểm

1. Thang ưu tiên chọn locator, từ trên xuống?
2. Vì sao "bắt sai element" nguy hiểm hơn "locator gãy hẳn"?
3. Bốn mẫu locator ẩu, và mỗi mẫu nói lên điều gì về người viết?
4. Ba nguồn chập chờn, và cách chữa từng cái?
5. Vì sao chờ theo thời gian là cách chữa tệ nhất?
6. Vì sao gate locator dùng mốc so sánh thay vì cấm tuyệt đối?
7. Sửa mốc để hết đỏ thì hậu quả là gì?

## Bài tập về nhà

Chạy `npm run lint:locator` trên chính bộ test bạn đã viết tới giờ. Ghi lại con số.

Rồi mở một bộ test của dự án bạn đang tham gia và chạy lên đó. Con số thường lớn hơn nhiều. Đừng sửa
vội, chỉ cần nhìn: mỗi con số trong đó là một chỗ mà người viết không thật sự biết mình đang chạm vào
element nào.

## Bài sau

Bài 10 hỏi một câu khó chịu: có những lỗi mà giao diện **không thể** lộ ra, vì giao diện đã ẩn nút
đi rồi. Bug thứ ba của app thực hành đúng là loại đó, và bắt nó cần một tầng khác.
