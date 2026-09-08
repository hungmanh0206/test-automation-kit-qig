# Bài 22 — Accessibility

> **1 giờ 30 phút** · Có gì trong tay: bộ test FE ổn định · Sau bài này: một phép quét cắm vào test có sẵn, và bạn biết nó phủ được tới đâu

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Không ai kiểm phần này, và khi có yêu cầu thì không biết bắt đầu từ đâu. |
| **Bài này bạn gõ gì** | Cắm phép quét vào test đã có, chọn ngưỡng chặn, và tách phần máy không kiểm được. |
| **Xong thì được gì** | Một lane chạy được, bắt được lỗi thật, và không bị tắt sau một tuần. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Khả năng tiếp cận** | Người dùng bàn phím, trình đọc màn hình, hoặc mắt kém vẫn dùng được sản phẩm |
| **Vai trò** (role) | Element này là nút, là ô nhập, hay là tiêu đề. Trình đọc màn hình đọc theo cái này |
| **Nhãn có thể tiếp cận** | Chuỗi trình đọc màn hình đọc lên khi tới element |
| **Vi phạm** | Một luật cụ thể bị phá, có mã và có mức nghiêm trọng |

## Bài này bạn sẽ làm gì

Ba việc:

1. Vì sao việc này bắt được lỗi thật, không chỉ là việc tuân thủ (25 phút).
2. Cắm phép quét vào test đã có (35 phút).
3. Bốn nhóm máy quét được, bốn nhóm chỉ người kiểm được (30 phút).

---

## Việc 1 — Nó bắt được lỗi thật (25 phút)

Phản xạ thường gặp: đây là việc làm cho đủ thủ tục, phần trăm người dùng bị ảnh hưởng nhỏ.

Thực tế thì phần lớn lỗi loại này cũng là lỗi giao diện thường, chỉ là nhìn từ góc khác:

| Lỗi tiếp cận | Cùng lúc cũng là | Ai gặp |
|---|---|---|
| Nút không có nhãn đọc được | Nút chỉ có icon, không ai biết nó làm gì | Mọi người dùng mới |
| Tương phản màu quá thấp | Chữ mờ, đọc dưới nắng không thấy | Mọi người dùng điện thoại ngoài trời |
| Không đi được bằng bàn phím | Không dùng được Tab để điền form nhanh | Mọi người dùng nhập liệu nhiều |
| Thứ tự tiêu đề nhảy cóc | Cấu trúc trang lộn xộn | Cả công cụ tìm kiếm |

Và một lý do thực dụng hơn nữa: **bộ test của bạn sẽ tốt lên**. Bài 9 khuyên chọn locator theo vai trò
và nhãn (`getByRole`, `getByLabel`). Một trang không có nhãn đọc được thì không dùng được cách đó, nên
bạn phải quay về locator dựa vào cấu trúc, tức là locator dễ gãy.

Nói cách khác: trang càng khó tiếp cận thì bộ automation càng khó viết cho bền. Hai vấn đề có chung
một gốc.

## Việc 2 — Cắm phép quét vào test đã có (35 phút)

Cài:

```bash
npm install --save-dev @axe-core/playwright
```

Đừng viết một bộ test thứ hai. Cắm vào chỗ test hiện tại đã đi tới:

```js
// tests/support/a11y.js
'use strict';
const AxeBuilder = require('@axe-core/playwright').default;

/*
 * Quét TẠI THỜI ĐIỂM test đang đứng. Viết bộ test riêng cho phần này là sai hai lần:
 * phải dựng lại toàn bộ tiền điều kiện, và chỉ quét được màn tĩnh — trong khi lỗi
 * hay nằm ở modal, ở form sau khi báo lỗi, ở trạng thái đã mở menu.
 */
async function quet(page, { boQua = [] } = {}) {
  const kq = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(boQua)
    .analyze();
  return kq.violations;
}

module.exports = { quet };
```

Dùng:

```js
const { quet } = require('../support/a11y');

test('tạo đơn cho khách hạng Bạc', async ({ page }) => {
  await page.goto('/');
  // ... các bước có sẵn của Bài 4

  const viPham = await quet(page);
  const nang = viPham.filter((v) => ['serious', 'critical'].includes(v.impact));
  expect(nang, nang.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
});
```

**Bạn sẽ thấy** lần đầu chạy thường ra một danh sách dài. Đừng hoảng, và đừng sửa hết ngay.

| Thấy khác | Nghĩa là | Làm gì |
|---|---|---|
| 30+ vi phạm ngay lần đầu | Bình thường với trang chưa từng quét | Đọc Việc 3, phần ngưỡng |
| Cùng một vi phạm lặp lại 40 lần | Một component dùng ở 40 chỗ | Sửa một chỗ, hết cả 40 |
| `color-contrast` báo ở chỗ nhìn rõ | Có ảnh nền hoặc gradient phía sau | Kiểm tay, có thể là báo oan |

### Ngưỡng: bật hết mức là bị tắt sau một tuần

Một gate làm đỏ 200 chỗ có sẵn thì nó bị tắt. Cùng cơ chế mốc như Bài 9:

| Mức | Xử lý |
|---|---|
| `critical`, `serious` | **Chặn**, nhưng chỉ với phần tăng thêm so với mốc |
| `moderate` | Cảnh báo, ghi vào report |
| `minor` | Ghi số, không cảnh báo |

Ghi mốc hiện tại vào `.agent/config/a11y-baseline.json`, rồi chỉ chặn khi con số tăng. Nguyên tắc
giống hệt gate locator: **không tha cho code mới, không đòi dọn hết lịch sử trong một hôm**.

## Việc 3 — Máy quét được tới đâu (30 phút)

Đây là phần quan trọng nhất của bài, vì nó quyết định bạn có tự lừa mình hay không.

**Bốn nhóm máy quét được:**

| Nhóm | Ví dụ vi phạm |
|---|---|
| Nhãn thiếu | Nút chỉ có icon, ô nhập không có `<label>` |
| Tương phản màu | Chữ xám trên nền trắng dưới ngưỡng |
| Cấu trúc | Thứ tự tiêu đề nhảy từ `h1` sang `h3` |
| Thuộc tính sai | `aria-*` trỏ tới id không tồn tại |

**Bốn nhóm chỉ người kiểm được:**

| Nhóm | Vì sao máy không kiểm được |
|---|---|
| Nhãn có nghĩa không | Máy thấy có nhãn "Nút 1" là đạt. Người biết nó vô nghĩa |
| Thứ tự Tab có hợp lý không | Máy thấy đi được hết. Người biết nó nhảy lung tung |
| Trình đọc màn hình đọc lên có hiểu không | Phải nghe mới biết |
| Thông báo lỗi có được đọc lên không | Cần thao tác thật trong ngữ cảnh thật |

Con số quét được thường phủ khoảng một phần ba số vi phạm thật. Đó là con số đáng nói ra trong report,
vì nếu không thì "quét đạt" bị hiểu thành "không có vấn đề".

Cách viết trung thực trong report:

```
Khả năng tiếp cận: quét tự động 0 vi phạm mức serious trở lên trên 12 màn.
Phần chưa phủ: nhãn có nghĩa · thứ tự Tab · trình đọc màn hình. Cần kiểm tay.
```

Hai câu. Câu đầu là thứ đã đo. Câu sau là thứ chưa đo. Bỏ câu sau thì câu đầu thành một lời hứa
không giữ được.

> Đây là cùng một kỷ luật với Bài 21 (bàn phím ảo) và Bài 16 (`OBSERVATION`): thứ chưa đo được thì
> ghi là chưa đo, không ghi là đạt.

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   ├── locator-baseline.json     ·  từ Bài 9
│   └── a11y-baseline.json        ← MỚI · số vi phạm hiện tại theo mức
└── tests/
    ├── support/
    │   └── a11y.js               ← MỚI · quét tại chỗ test đang đứng
    └── e2e/                      ·  từ Bài 4, nay có thêm phép quét cuối test
```

Không có thư mục `tests/a11y/` riêng, và đó là cố ý: phép quét chạy trong test có sẵn, ở đúng trạng
thái mà test đã dựng ra.

## Tự kiểm

1. Ba lỗi tiếp cận cũng là lỗi giao diện thường, kể ra?
2. Vì sao trang khó tiếp cận thì bộ automation cũng khó viết cho bền?
3. Vì sao quét tại chỗ test đang đứng, thay vì viết bộ test riêng?
4. Ba mức xử lý theo độ nghiêm trọng?
5. Vì sao dùng mốc so sánh thay vì chặn mọi vi phạm?
6. Bốn nhóm máy quét được, bốn nhóm chỉ người kiểm được?
7. Vì sao report phải có câu thứ hai nói phần chưa phủ?

## Bài tập về nhà

Mở sản phẩm bạn đang test. Rút phích chuột ra, hoặc chỉ đơn giản là không chạm vào nó.

Đi hết một luồng chính bằng bàn phím: Tab, Shift-Tab, Enter, Space, mũi tên. Ghi lại mọi chỗ bạn bị
kẹt hoặc không biết mình đang đứng ở đâu.

Danh sách đó là phần máy không quét được, và nó thường dài hơn danh sách máy quét ra.

## Bài sau

Bài 23 chuyển sang một loại câu hỏi khác: không phải "có đúng không" mà là "có đủ nhanh không, và
chịu được bao nhiêu người cùng lúc".
