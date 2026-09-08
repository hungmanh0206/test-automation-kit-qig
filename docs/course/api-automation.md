# Bài 10 — Kiểm rule phía sau giao diện bằng API

> **2 giờ 30 phút** · Có gì trong tay: bộ test FE chạy được, mọi kiểm tra đều đi qua giao diện · Sau bài này: bắt được lỗi mà giao diện không thể lộ ra

**Vấn đề**

Bạn cần kiểm một luật: đơn đã xác nhận thì không được sửa.

Bạn mở màn chi tiết đơn, thấy nút Edit đã bị ẩn. Test viết xong, chạy xanh, đánh dấu luật này đã phủ.

Nhưng bạn vừa chứng minh được điều gì? Rằng giao diện đã ẩn nút.

Chuyện này đã xảy ra thật trên OPS, và ở một chỗ đắt hơn: API cho phép huỷ một đơn đã thanh toán, và
cho phép xoá một giao dịch đã xác nhận. Giao diện thì không có nút nào cho hai việc đó.


**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Giao diện đã ẩn nút, nên UI test không bao giờ chạm tới được nhánh đó. Lỗi vẫn còn, chỉ là không ai thấy. |
| **Bài này bạn gõ gì** | Test gọi thẳng API, và một máy so cái UI hiện với cái tầng lưu trữ giữ. |
| **Xong thì được gì** | Bắt được bug thứ ba của app thực hành, và biết khoanh lỗi thuộc tầng nào. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Bốn việc:

1. Ba việc API test làm tốt hơn UI test, và một việc nó không làm được (25 phút).
2. Gọi API trong Playwright (40 phút).
3. **Thực hành:** bắt bug thứ ba của app thực hành (40 phút).
4. **Xây gate:** so UI với tầng lưu trữ để khoanh tầng lỗi (45 phút).

---

## Việc 1 — API test làm tốt hơn ở đâu (25 phút)

| Việc | UI test | API test |
|---|---|---|
| Dựng trạng thái ban đầu | Click qua 6 màn hình, 20 giây | Một lời gọi, 200ms |
| Kiểm nhánh giao diện đã ẩn | **Không chạm tới được** | Gọi thẳng, thấy ngay |
| Kiểm nhiều tổ hợp dữ liệu | Mỗi tổ hợp một lượt chạy trình duyệt | Chạy 50 tổ hợp trong vài giây |
| Kiểm thứ người dùng thật sự thấy | **Đúng việc của nó** | Không làm được |

Dòng cuối là lý do API test không thay thế được UI test. Một API trả về đúng `485000` không chứng minh
màn hình hiển thị đúng `485.000`. Bug thứ hai của app thực hành đúng là loại đó: dữ liệu đúng, hiển
thị sai.

Dòng thứ hai là lý do bài này tồn tại. Giao diện là một lớp lọc, và nó lọc cả những thao tác mà phía
sau **vẫn cho phép**. Nút bị ẩn không có nghĩa là hành động bị chặn.

Cách nghĩ thực dụng để phân việc:

> Kiểm **quy tắc nghiệp vụ** thì đi API. Kiểm **thứ người dùng nhìn thấy và chạm vào** thì đi UI.

Một quy tắc như *"đơn đã xác nhận thì không sửa được"* là quy tắc nghiệp vụ. Kiểm nó bằng cách nhìn
xem nút Sửa có bị ẩn không là kiểm nhầm chỗ: bạn đang kiểm giao diện có ẩn nút không, chứ không phải
quy tắc có được thi hành không.

## Việc 2 — Gọi API trong Playwright (40 phút)

Playwright có sẵn một context để gọi HTTP, không cần thư viện thứ hai:

```js
const { test, expect } = require('@playwright/test');

test('BR-04: phí giao hàng so mốc trên TẠM TÍNH', async ({ request }) => {
  const res = await request.post('/api/quote', {
    data: { khachId: 'KH02', items: [{ sanPhamId: 'SP01', soLuong: 2 }] },
  });

  expect(res.status()).toBe(200);
  const bao = await res.json();

  /* Số mong đợi tính từ spec.md BR-02, BR-03, BR-04. KHÔNG lấy từ phản hồi của app. */
  expect(bao.tamTinh).toBe(450000);      // BR-02: 225.000 × 2
  expect(bao.giamGia).toBe(-15000);      // BR-03: hạng Bạc, 
  expect(bao.phiGiaoHang).toBe(50000);   // BR-04: tạm tính 450.000 < mốc 500.000
  expect(bao.tongTien).toBe(485000);
});
```

Tạo `tests/api/bao-gia.spec.js` với nội dung trên rồi chạy:

```bash
npx playwright test tests/api/
```

**Bạn sẽ thấy** nó đỏ ở dòng `phiGiaoHang`, và đỏ nhanh hơn hẳn UI test vì không phải mở trình duyệt.

| Thấy khác | Nghĩa là | Làm gì |
|---|---|---|
| `expect(received).toBe(expected)` ở `tamTinh` | Giá sản phẩm khác `spec.md` | Đọc lại `spec.md`, có thể bạn nhớ nhầm mã sản phẩm |
| `res.status()` là `404` | Đường dẫn API sai | Xem phần API trong `spec.md` |
| `res.status()` là `401` | Cần đăng nhập | Phần dưới |

### Tái dùng token, không đăng nhập lại 200 lần

Với app thật thì API cần token. Đăng nhập lại ở mỗi test là chậm, và với hệ có giới hạn số lần đăng
nhập thì còn làm khoá tài khoản.

Cách làm: đăng nhập một lần, lưu lại, dùng chung.

```js
// tests/support/auth.js
'use strict';

let boNho = null;

async function layToken(request, { taiKhoan, matKhau }) {
  if (boNho && boNho.hetHan > Date.now()) return boNho.token;

  const res = await request.post('/api/login', { data: { taiKhoan, matKhau } });
  if (!res.ok()) throw new Error(`Đăng nhập hỏng: HTTP ${res.status()} — ${await res.text()}`);

  const { token } = await res.json();
  /* Trừ hao 2 phút trước hạn thật. Token hết hạn giữa một lượt chạy dài thì
     nửa sau của bộ test đỏ hàng loạt vì 401, và trông y hệt một lỗi sản phẩm. */
  boNho = { token, hetHan: Date.now() + 28 * 60 * 1000 };
  return token;
}

module.exports = { layToken };
```

Ba điều đáng nhớ khi làm việc với token:

- **Trừ hao trước hạn.** Token hết hạn đúng giữa lượt chạy tạo ra một loạt đỏ trông như lỗi sản phẩm.
- **Đừng in token ra log.** Nó là bí mật, và log thì đi lên CI, lên Jira, lên chỗ nhiều người đọc.
- **Đừng lấy token bằng cách đọc từ trình duyệt** nếu API có đường đăng nhập riêng. Ít bước hơn thì ít
  chỗ hỏng hơn.

## Việc 3 — Bắt bug thứ ba (40 phút)

Đây là bug mà UI test không bao giờ thấy, vì giao diện ẩn nút Sửa sau khi đơn đã xác nhận.

Mở `spec.md` mục `BR-07`:

> Đơn ở trạng thái `CONFIRMED` không được sửa. Mọi yêu cầu sửa phải bị từ chối.

Viết test:

```js
test('BR-07: đơn đã xác nhận thì KHÔNG sửa được', async ({ request }) => {
  // dựng: tạo đơn rồi xác nhận
  const tao = await request.post('/api/orders', {
    data: { khachId: 'KH02', items: [{ sanPhamId: 'SP01', soLuong: 1 }] },
  });
  const don = await tao.json();

  await request.post(`/api/orders/${don.id}/confirm`);

  // hành động: thử sửa
  const sua = await request.patch(`/api/orders/${don.id}`, {
    data: { items: [{ sanPhamId: 'SP01', soLuong: 99 }] },
  });

  // oracle: BR-07 nói phải bị từ chối
  expect(sua.status()).toBeGreaterThanOrEqual(400);
});
```

**Bạn sẽ thấy:**

```
Expected: >= 400
Received: 200
```

App trả `200`. Đơn đã đổi. Không có guard trạng thái nào cả.

Đây là bug thứ ba, và nó minh hoạ đúng điểm mù mà bài này chữa. Giao diện đã ẩn nút Sửa, nên mọi UI
test đều xanh. Ai nhìn vào bộ test cũng thấy nhánh này *"đã được phủ"*. Thực tế là nó chưa từng được
kiểm, vì bộ test chỉ đi qua đúng cái cửa mà sản phẩm đã khoá sẵn.

> **Ghi lại ý này**, nó quay lại ở Bài 16 dưới dạng một trục mở rộng: *"giao diện chặn không có nghĩa
> là hệ thống chặn"*. Mỗi khi bạn thấy một nút bị ẩn hoặc bị làm mờ, đó là một chỗ đáng thử ở tầng
> dưới.

## Việc 4 — Xây gate: so UI với tầng lưu trữ (45 phút)

Bug thứ hai của app thực hành là loại ngược lại: API trả đúng, màn hình hiện sai. Kiểm một tầng thì
không thấy. Phải đọc cả hai rồi so.

App thực hành có một endpoint đọc thẳng tầng lưu trữ: `GET /api/_store/orders`. Nó cố ý dùng **tên
trường khác** với API thường, vì trong dự án thật thì đúng là như vậy: cùng một thứ, ba tầng gọi ba
tên khác nhau.

Khai bản đồ tên trong `.agent/config/anh-xa-luu-tru.json`:

```json
{
  "moTa": "Một trường, ba tên gọi. Thiếu bảng này thì mỗi lần so lại phải đoán.",
  "truong": {
    "giamGia": { "ui": "giam-gia", "api": "giamGia", "luuTru": "discount_amount" },
    "tongTien": { "ui": "tong-tien", "api": "tongTien", "luuTru": "total_amount" },
    "phiGiaoHang": { "ui": "phi-giao-hang", "api": "phiGiaoHang", "luuTru": "shipping_fee" }
  }
}
```

`scripts/qa/doi-chieu-luu-tru.js`:

```js
#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const GOC = path.resolve(__dirname, '..', '..');
const ANH_XA = JSON.parse(fs.readFileSync(path.join(GOC, '.agent/config/anh-xa-luu-tru.json'), 'utf8'));

/*
 * Nhận vào KẾT QUẢ ĐÃ ĐỌC của hai tầng, không tự đi gọi. Lý do: gate phải chạy được cả trên
 * dữ liệu chụp lại từ một lượt chạy trước, không chỉ chạy trực tiếp. Gate chỉ chạy được khi
 * có môi trường sống thì không dùng được lúc điều tra một lượt đỏ của hôm qua.
 */
function doiChieu(uiDoc, luuTruDoc) {
  const lech = [];
  for (const [ten, m] of Object.entries(ANH_XA.truong)) {
    const ui = uiDoc[m.ui];
    const lt = luuTruDoc[m.luuTru];
    if (ui === undefined || lt === undefined) {
      lech.push({ truong: ten, tang: 'KHÔNG ĐO ĐƯỢC', ui, luuTru: lt });
      continue;
    }
    if (Number(ui) !== Number(lt)) {
      lech.push({ truong: ten, tang: 'HIỂN THỊ', ui, luuTru: lt });
    }
  }
  return lech;
}

if (require.main === module) {
  const [fUi, fLt] = process.argv.slice(2);
  if (!fUi || !fLt) {
    console.error('Dùng: node doi-chieu-luu-tru.js <ui.json> <luu-tru.json>');
    process.exit(2);
  }
  const lech = doiChieu(
    JSON.parse(fs.readFileSync(fUi, 'utf8')),
    JSON.parse(fs.readFileSync(fLt, 'utf8'))
  );

  const khongDo = lech.filter((x) => x.tang === 'KHÔNG ĐO ĐƯỢC');
  if (khongDo.length) {
    console.error('[doi-chieu] ? KHÔNG ĐO ĐƯỢC — thiếu trường: ' +
      khongDo.map((x) => x.truong).join(', '));
    process.exit(2);
  }
  if (lech.length) {
    console.error('[doi-chieu] ✗ CHẶN — lệch giữa hai tầng:');
    for (const x of lech) {
      console.error(`  ${x.truong}: màn hình ${x.ui} · tầng lưu trữ ${x.luuTru} ⇒ lỗi tầng ${x.tang}`);
    }
    process.exit(1);
  }
  console.log('[doi-chieu] ✓ hai tầng khớp.');
}

module.exports = { doiChieu };
```

### Ba mã thoát, và vì sao mã 2 quan trọng

| Mã | Nghĩa | Đừng làm gì |
|---|---|---|
| `0` | Đã đo, và khớp | |
| `1` | Đã đo, và lệch | |
| `2` | **Không đo được** | Đừng gộp `2` vào `0` |

Dòng cuối là chỗ dễ sai nhất, và nó đắt. "Không đo được" trông giống "không có vấn đề" trong mọi báo
cáo. Nếu bạn cho nó thoát `0` thì một hôm bảng ánh xạ sai tên trường, gate im lặng báo đạt, và bạn
mất khả năng phát hiện cả lớp lỗi này mà không hay biết.

### Đối chứng

```bash
# Ca phải CHO QUA — hai tầng khớp
node scripts/qa/doi-chieu-luu-tru.js mau/ui-khop.json mau/lt-khop.json     # → ✓, mã 0

# Ca phải CHẶN — bug thứ hai của app thực hành
node scripts/qa/doi-chieu-luu-tru.js mau/ui-lech.json mau/lt-lech.json     # → ✗, mã 1
#   giamGia: màn hình 8000 · tầng lưu trữ 8750 ⇒ lỗi tầng HIỂN THỊ

# Ca phải báo KHÔNG ĐO ĐƯỢC — xoá một trường khỏi file lưu trữ
node scripts/qa/doi-chieu-luu-tru.js mau/ui-khop.json mau/lt-thieu.json    # → ?, mã 2
```

Ba ca, không phải hai. Gate nào có trạng thái "không đo được" thì phải chứng minh cả ba.

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Tầng lưu trữ** | Nơi dữ liệu thật sự nằm. Giao diện chỉ là một cách hiển thị nó |
| **Guard trạng thái** | Luật chặn thao tác không hợp lệ, ví dụ sửa đơn đã xác nhận |
| **Kiểm song song** | Cùng một sự việc, đọc từ hai nguồn, rồi so |
| **Khoanh tầng lỗi** | Xác định lỗi nằm ở giao diện hay ở phía sau, trước khi báo cho ai |

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   ├── env-allow.json            ·  từ Bài 6
│   ├── locator-baseline.json     ·  từ Bài 9
│   └── anh-xa-luu-tru.json       ← MỚI · một trường, ba tên gọi
├── scripts/qa/
│   ├── lint-locator.js           ·  từ Bài 9
│   └── doi-chieu-luu-tru.js      ← MỚI · lệch hai tầng ⇒ chặn, thiếu trường ⇒ mã 2
└── tests/
    ├── support/
    │   ├── factory.js            ·  từ Bài 7
    │   └── auth.js               ← MỚI · lấy token một lần, dùng chung
    ├── e2e/                      ·  từ Bài 4
    └── api/
        ├── bao-gia.spec.js       ← MỚI · BR-02, BR-03, BR-04
        └── guard-trang-thai.spec.js  ← MỚI · BR-07, bug thứ ba
```

## Bộ kit của bạn đang ở đâu

```
CẤP ĐỘ 2 · BUILD      bài 6/7 của cấp độ này
████████████████████████░░░░

cả tài liệu           bài 10/29
██████████░░░░░░░░░░░░░░░░░░
```

**Hết cấp độ 2 bạn nói được:** Tôi có một Test Kit.

Cấp độ này còn 1 bài nữa.

## Tự kiểm

1. Ba việc API test làm tốt hơn UI test, và một việc nó không làm được?
2. Câu hỏi nào giúp bạn quyết định kiểm một thứ ở tầng nào?
3. Vì sao kiểm luật *"đơn đã xác nhận không sửa được"* bằng cách nhìn nút Sửa có bị ẩn không là kiểm nhầm chỗ?
4. Ba điều phải nhớ khi làm việc với token?
5. Vì sao gate đối chiếu nhận dữ liệu đã đọc thay vì tự đi gọi API?
6. Ba mã thoát, và vì sao gộp `2` vào `0` là tự vô hiệu hoá gate?
7. Vì sao gate này cần **ba** phép đối chứng chứ không phải hai?
8. Bảng ánh xạ tên trường giải quyết vấn đề gì?

## Bài tập về nhà

Mở bộ test của dự án bạn đang tham gia. Tìm một testcase kiểm quy tắc nghiệp vụ bằng cách nhìn giao
diện, kiểu *"kiểm nút Xoá không hiện với người dùng thường"*.

Rồi tự hỏi: nếu gọi thẳng API xoá với tài khoản đó thì chuyện gì xảy ra. Nếu bạn không biết câu trả
lời, thì nhánh đó đang chưa được kiểm, dù bảng testcase ghi là đã phủ.

## Bài sau

Bài 11 lo phần còn thiếu: bộ test giờ chạy được cả hai tầng, nhưng kết quả vẫn chỉ nằm trong console.
Người không ngồi cạnh bạn thì không thấy gì.
