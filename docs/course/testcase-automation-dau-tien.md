# Bài 4 — Viết testcase automation đầu tiên có khả năng bắt lỗi

> **2 giờ** · Có gì trong tay: Playwright đã cài, `playwright.config.js` đã cấu hình · Sau bài này: một test chạy thật trên app thực hành, và bạn biết nó đang kiểm cái gì

**Vấn đề**

Bạn có một test mẫu chạy xanh. Nó kiểm một trang trên internet, không kiểm sản phẩm của bạn.

Giờ bạn viết test đầu tiên cho luồng tạo đơn. Nó xanh ngay lần chạy đầu.

Nhưng bạn vừa thấy ở Bài 1 là sản phẩm này **có bug** ở đúng luồng đó. Test xanh mà bug vẫn còn,
nghĩa là test của bạn chưa kiểm cái nó tưởng đang kiểm.

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Test mẫu của Playwright chạy xanh, nhưng nó kiểm trang example.com. Bạn chưa viết dòng nào cho app của mình. |
| **Bài này bạn gõ gì** | Một test cho luồng tạo đơn hàng. Làm nó đỏ trước, rồi mới làm cho xanh. |
| **Xong thì được gì** | Một test chạy thật, và quan trọng hơn: bằng chứng rằng nó thật sự đang kiểm chứ không chỉ chạy qua. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Bốn việc:

1. Viết test đầu tiên cho luồng tạo đơn hàng (35 phút).
2. Làm nó đỏ có chủ đích, để chứng minh nó đang kiểm thật (20 phút).
3. So ba cách viết assertion, chọn cách chứng minh được nhiều nhất (35 phút).
4. Đọc một lượt chạy đỏ cho đúng cách (30 phút).

---

## Việc 1 — Test đầu tiên (35 phút)

Mở app thực hành ở một cửa sổ terminal:

```bash
node docs/course/assets/app-thuc-hanh/server.js
```

Nó chạy ở `http://localhost:4010`. Mở trình duyệt xem qua một lượt: chọn khách, chọn sản phẩm, bấm
tạo đơn. Bạn đã làm việc này bằng tay ở Bài 1 rồi, giờ là lúc bảo máy làm.

Tạo `tests/e2e/tao-don-hang.spec.js`:

```js
const { test, expect } = require('@playwright/test');

test('tạo đơn cho khách hạng Bạc, 2 sản phẩm SP01', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Khách hàng').selectOption('KH02');
  await page.getByLabel('Sản phẩm').selectOption('SP01');
  await page.getByLabel('Số lượng').fill('2');
  await page.getByRole('button', { name: 'Tạo đơn' }).click();

  await expect(page.getByTestId('tong-tien')).toHaveText('485.000');
});
```

Chạy:

```bash
npx playwright test tests/e2e/tao-don-hang.spec.js
```

**Bạn sẽ thấy** test **đỏ**. Và đó là kết quả đúng.

```
Error: expect(locator).toHaveText(expected)
  Expected string: "485.000"
  Received string: "515.000"
```

Chưa vội sửa. Đây là bug thứ nhất của app thực hành, cái bạn đã tìm ra bằng tay ở Bài 1: phí giao
hàng đang so mốc trên số sau giảm giá thay vì số trước giảm giá. Số `485.000` không phải bạn đoán,
nó tính từ [`spec.md`](assets/app-thuc-hanh/spec.md) mục `BR-04`.

| Thấy khác | Nghĩa là | Làm gì |
|---|---|---|
| `net::ERR_CONNECTION_REFUSED` | app chưa chạy | Mở terminal thứ hai, chạy `node server.js` |
| `Timeout ... waiting for getByLabel('Khách hàng')` | tên nhãn không khớp | Mở DevTools, xem `<label>` thật ghi gì |
| Test **xanh** ngay lần đầu | bạn đang chạy trên app đã sửa bug, hoặc assertion không kiểm gì | Đọc Việc 2, phần "test xanh giả" |

Ghi lại điều này, vì nó là thói quen của cả tài liệu: **một test đỏ đúng chỗ có giá trị hơn một test
xanh không rõ vì sao xanh.**

## Việc 2 — Làm nó đỏ có chủ đích (20 phút)

Ở trên bạn gặp một test đỏ vì app sai. Giờ làm ngược lại: đảm bảo test sẽ đỏ **khi app sai**, kể cả
khi bạn chưa biết app sai chỗ nào.

Cách làm là tự phá. Sửa tạm giá trị mong đợi thành một số chắc chắn sai:

```js
// trong test của Việc 1, đổi đúng dòng assertion:
// await expect(page.getByTestId('tong-tien')).toHaveText('999.999');
```

Chạy lại. Nó phải đỏ. Nếu nó vẫn xanh thì bạn có một **test xanh giả**, và nguyên nhân thường là một
trong ba:

| Nguyên nhân | Dấu hiệu | Cách kiểm |
|---|---|---|
| Locator không trỏ vào đâu cả | Playwright báo timeout chứ không báo lệch giá trị | Thêm `await expect(locator).toBeVisible()` trước |
| Assertion không so gì | Bạn viết `expect(x)` mà quên `.toHaveText(...)` | Đọc lại dòng đó, nó phải có một mệnh đề so sánh |
| Test kết thúc trước khi trang cập nhật | Đỏ lúc được lúc không | Việc 3 nói về chỗ này |

Rồi trả lại `485.000`.

Nghe thừa, nhưng đây là phép thử rẻ nhất bạn có. Một assertion không bao giờ đỏ thì nó không phải một
phép kiểm, nó là một dòng trang trí. Bài 25 sẽ làm đúng chuyện này ở quy mô cả bộ test, và gọi tên
nó là tiêm lỗi.

## Việc 3 — Ba cách viết assertion (35 phút)

Cùng một ý "tổng tiền phải là 485.000", ba cách viết, và chúng không tương đương nhau:

```js
async function baCach(page, expect) {
// Cách A — đọc rồi so bằng JavaScript
const text = await page.getByTestId('tong-tien').textContent();
expect(text).toBe('485.000');

// Cách B — assertion của Playwright
await expect(page.getByTestId('tong-tien')).toHaveText('485.000');

// Cách C — so cả cụm liên quan
await expect(page.getByTestId('tam-tinh')).toHaveText('450.000');
await expect(page.getByTestId('giam-gia')).toHaveText('-15.000');
await expect(page.getByTestId('phi-giao-hang')).toHaveText('50.000');
await expect(page.getByTestId('tong-tien')).toHaveText('485.000');
}
```

Khác nhau ở đâu:

| | Chờ trang cập nhật | Khi đỏ thì biết được gì |
|---|---|---|
| A | Không. Đọc một lần, được gì so nấy | Chỉ biết tổng sai |
| B | Có. Tự thử lại tới khi hết thời gian chờ | Chỉ biết tổng sai |
| C | Có | Biết **sai ở đâu trong chuỗi tính** |

Cách A là nguồn của phần lớn test chập chờn: trang chưa kịp render xong thì nó đã đọc. Đừng dùng,
trừ khi bạn thật sự cần giá trị đó để tính tiếp.

Cách C dài hơn nhưng trả lời được câu hỏi mà người đọc report sẽ hỏi ngay: *"sai ở khâu nào"*. Với
ví dụ này, cách C cho thấy tạm tính đúng, giảm giá đúng, **phí giao hàng sai**, tổng sai theo. Cách
B chỉ nói tổng sai, và Dev sẽ phải tự dò.

Đổi test của bạn sang cách C rồi chạy lại.

**Bạn sẽ thấy** nó vẫn đỏ, nhưng đỏ ở đúng dòng `phi-giao-hang`. Ba dòng trên xanh. Đó là khác biệt
giữa một test báo lỗi và một test **chỉ được chỗ lỗi**.

> Đây cũng là lần đầu bạn chạm vào một ý sẽ quay lại suốt tài liệu: kiểm từng trường riêng lẻ thì bỏ
> sót lỗi **quan hệ giữa các trường**. Bug thứ hai của app thực hành đúng là loại đó, và Bài 13 sẽ
> quay lại nó.

## Việc 4 — Đọc một lượt chạy đỏ (30 phút)

Đầu ra của Playwright khi đỏ khá dài. Đọc theo thứ tự này, không đọc từ trên xuống:

1. **Dòng `Error:`** — loại lỗi. `toHaveText` là lệch giá trị. `Timeout` là không tìm thấy element.
   Hai thứ này cần cách xử lý hoàn toàn khác nhau.
2. **`Expected` và `Received`** — nếu Received rỗng thì element tồn tại nhưng chưa có nội dung, tức
   là vấn đề thời điểm chứ không phải vấn đề giá trị.
3. **Dòng có tên file test của bạn** — bỏ qua các dòng trong `node_modules`.
4. **`Call log`** — Playwright kể nó đã thử gì. Chỗ này nói cho bạn biết locator có khớp element nào
   không.

Ba loại lỗi hay gặp nhất ở tuần đầu:

| Đầu ra | Nghĩa là | Sửa ở đâu |
|---|---|---|
| `Timeout 5000ms exceeded` + `waiting for locator` | Locator không khớp element nào | Locator, không phải app |
| `Received: ""` | Element có, nội dung chưa có | Chờ điều kiện, xem Bài 9 |
| `Expected "485.000" Received "515.000"` | Cả hai bên đều đọc được, số lệch | **App sai**, hoặc số mong đợi của bạn sai |

Dòng cuối bảng là chỗ dễ nhầm nhất. Test đỏ **không tự động nghĩa là app sai**. Nó chỉ nghĩa là hai
con số khác nhau, và một trong hai sai. Bài 17 dành cả bài cho câu hỏi này, còn ở đây thì cách kiểm
rẻ nhất là: mở `spec.md`, tính lại bằng tay, xem con số nào đúng.

Với ví dụ này, `spec.md` mục `BR-04` nói phí giao hàng miễn phí khi **tạm tính** đạt `500.000`. Tạm
tính là `450.000`, chưa đạt, nên phí `50.000` là đúng. Nhưng app lại tính miễn phí dựa trên số sau
giảm giá. Vậy app sai. Bạn vừa xác nhận bug thứ nhất bằng automation.

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Assertion** | Câu khẳng định trong test. Sai thì test đỏ. Không có assertion thì test chỉ đang bấm qua màn hình |
| **Locator** | Cách chỉ cho Playwright biết bạn đang nói tới element nào trên trang |
| **Đỏ có chủ đích** | Cố tình làm test sai để xem nó có bắt được không. Nếu không đỏ thì assertion của bạn vô dụng |

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .gitignore                    ·  từ Bài 2
├── README.md                     ·  từ Bài 2
├── package.json                  ·  từ Bài 2
├── playwright.config.js          ·  từ Bài 3
└── tests/
    └── e2e/
        └── tao-don-hang.spec.js  ← MỚI · test đầu tiên của bạn
```

Chỉ một file mới. Bài 5 sẽ hỏi vì sao không nên để nó nằm một mình mãi.

## Bộ kit của bạn đang ở đâu

```
CẤP ĐỘ 1 · AUTOMATE      bài 4/4 của cấp độ này
████████████████████████████

cả tài liệu           bài 4/29
████░░░░░░░░░░░░░░░░░░░░░░░░
```

**Hết cấp độ 1 bạn nói được:** Tôi chạy được test và tôi hiểu kết quả của nó.

Đây là bài cuối của cấp độ 1. Bài 5 mở cấp độ 2 · BUILD.

## Tự kiểm

1. Vì sao một test đỏ đúng chỗ đáng tin hơn một test xanh không rõ lý do?
2. Ba nguyên nhân làm một test xanh giả là gì?
3. Vì sao cách A (đọc rồi so bằng JavaScript) hay gây test chập chờn?
4. Cách C dài hơn cách B. Nó đổi lại được gì?
5. Test đỏ với `Expected 485.000 / Received 515.000`. Kết luận "app sai" đã đủ căn cứ chưa?
6. `Received: ""` khác `Timeout` ở chỗ nào?
7. Bạn chứng minh assertion của mình có tác dụng bằng cách nào?

## Bài tập về nhà

Viết thêm một test cho khách hạng Vàng, 1 sản phẩm SP03. Tự tính kết quả mong đợi từ `spec.md` trước
khi chạy, ghi con số đó ra giấy.

Rồi chạy. Nếu số của bạn khác số app trả, đừng sửa test cho khớp app. Ghi lại cả hai số và đi tiếp,
Bài 13 sẽ nói vì sao phản xạ "sửa expected cho khớp" là thứ nguy hiểm nhất trong nghề này.

## Bài sau

Bài 5 nhìn vào thư mục hiện tại và hỏi một câu: khi có 10 test thay vì 1, thì file này nằm ở đâu, và
những đoạn code lặp lại giữa chúng đi đâu.
