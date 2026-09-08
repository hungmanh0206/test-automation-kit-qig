# Bài 21 — Desktop xanh chưa có nghĩa Mobile cũng xanh

> **1 giờ 30 phút** · Có gì trong tay: bộ test chạy trên desktop · Sau bài này: cùng suite chạy trên viewport điện thoại, và bạn biết chọn cái gì đáng chạy

**Vấn đề**

Bộ test desktop của bạn xanh hết.

Học viên mở LMS trên điện thoại để vào lớp, rồi gửi ảnh cho bộ phận vận hành: nút vào phòng học bị
bàn phím ảo che mất. Không bấm được.

Bộ test của bạn không hề thấy chuyện này, vì nó chưa từng chạy ở kích thước đó. Mà phần lớn học viên
thì vào bằng điện thoại.


**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Bộ test xanh hết, rồi người dùng báo lỗi trên điện thoại. Không ai từng chạy thử ở kích thước đó. |
| **Bài này bạn gõ gì** | Khai thiết bị trong config, sửa ba thứ hỏng ngay, và chọn tập case đáng chạy trên mobile. |
| **Xong thì được gì** | Một lane mobile chạy được, đủ nhẹ để không ai muốn tắt nó. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Ba việc:

1. Chạy bộ test hiện tại ở viewport điện thoại, xem cái gì hỏng (30 phút).
2. Ba nhóm hỏng và cách chữa từng nhóm (35 phút).
3. Chọn tập case đáng chạy trên mobile (25 phút).

---

## Việc 1 — Chạy thử và xem cái gì hỏng (30 phút)

Đừng đặt kích thước bằng tay. Playwright có sẵn bộ khai thiết bị:

```js
// playwright.config.js
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // ... phần còn lại giữ nguyên từ Bài 3
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile',   use: { ...devices['Pixel 7'] } },
  ],
});
```

Vì sao dùng bộ khai sẵn thay vì `viewport: { width: 393, height: 852 }`: vì viewport chỉ là một trong
bốn thứ khác nhau. Bộ khai sẵn đặt luôn user agent, tỉ lệ điểm ảnh, và cờ `isMobile` mà một số trang
đọc để quyết định render bản nào. Đặt tay mỗi viewport thì bạn được một trình duyệt desktop bị thu
nhỏ, và đó không phải thứ người dùng đang gặp.

Chạy:

```bash
npx playwright test --project=mobile
```

**Bạn sẽ thấy** một số test đỏ, và phần lớn không phải lỗi sản phẩm.

| Đầu ra | Nghĩa là | Thuộc nhóm |
|---|---|---|
| `element is not visible` với một nút vẫn có trong DOM | Nút nằm trong menu đã thu gọn | Nhóm 1 |
| `element is outside of the viewport` | Phải cuộn tới mới chạm được | Nhóm 2 |
| Đỏ lúc được lúc không ở ô nhập liệu | Bàn phím ảo che mất | Nhóm 3 |

## Việc 2 — Ba nhóm hỏng (35 phút)

### Nhóm 1 — Element chuyển chỗ, không biến mất

Ở desktop, thanh điều hướng hiện đủ. Ở mobile, nó thu vào nút ba gạch.

```js
async function moDonHang(page) {
  /* Trên mobile phải mở menu trước. Kiểm bằng ĐIỀU KIỆN, không kiểm bằng tên project:
     viết if (project === 'mobile') thì hôm nào thêm máy tính bảng là sai lại. */
  const nutMenu = page.getByRole('button', { name: 'Mở menu' });
  if (await nutMenu.isVisible()) await nutMenu.click();

  await page.getByRole('link', { name: 'Đơn hàng' }).click();
}
```

Nguyên tắc: **hỏi trạng thái, đừng hỏi thiết bị**. Test dựa vào tên project sẽ sai khi có thiết bị
thứ ba, và sai im lặng.

### Nhóm 2 — Chạm khác click

```js
async function bamTaoDon(page) {
  await page.getByRole('button', { name: 'Tạo đơn' }).tap();
}
```

`tap()` chỉ hoạt động khi context bật `hasTouch`, mà bộ khai thiết bị đã bật sẵn. Ba khác biệt đáng
nhớ:

| | Click | Tap |
|---|---|---|
| Có trạng thái di chuột trước không | Có | **Không** |
| Cuộn tới element trước khi chạm | Có | Có |
| Kích hoạt được menu hiện khi di chuột không | Có | **Không** |

Dòng cuối là nguồn của một lớp lỗi thật: menu chỉ hiện khi di chuột thì trên điện thoại không có cách
nào mở. Người dùng thật gặp, mà test desktop thì luôn xanh.

### Nhóm 3 — Bàn phím ảo che

Ô nhập ở nửa dưới màn hình bị bàn phím che sau khi bấm vào. Playwright không mô phỏng bàn phím ảo,
nên test **không đỏ**, nhưng người dùng thật thì không bấm được nút Lưu nằm dưới ô đó.

Đây là giới hạn thật của công cụ, và cách trung thực là nói ra thay vì giả vờ đã phủ:

> Nhóm lỗi này máy không kiểm được. Ghi vào danh sách kiểm tay, đừng ghi là đã tự động hoá.

Bài 22 sẽ gặp lại đúng kiểu ranh giới này: có thứ máy quét được, có thứ chỉ người kiểm được, và trộn
hai loại vào một con số độ phủ là tự lừa mình.

## Việc 3 — Chọn cái gì đáng chạy (25 phút)

Chạy toàn bộ suite trên mobile là nhân đôi thời gian mà không nhân đôi giá trị. Phần lớn quy tắc
nghiệp vụ không đổi theo kích thước màn hình.

Ba nhóm đáng chạy trên mobile, và một nhóm không:

| Nhóm | Ví dụ | Chạy trên mobile |
|---|---|---|
| Luồng chính người dùng đi nhiều nhất | đăng nhập, tạo đơn, thanh toán | **Có** |
| Màn có bố cục đổi hẳn | bảng nhiều cột thành thẻ dọc | **Có** |
| Thao tác đặc thù chạm | vuốt, kéo thả, cuộn vô hạn | **Có** |
| Quy tắc tính toán | công thức tính tiền, guard trạng thái | Không. Đã phủ ở tầng API |

Đánh dấu bằng tag thay vì tách thư mục riêng, để một case không phải tồn tại hai bản:

```js
test('tạo đơn cho học viên chương trình Pro @mobile', async ({ page }) => { /* ... */ });
```

```js
// playwright.config.js — thêm grep vào project 'mobile'
const project = { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ };
```

Vì sao tag chứ không phải thư mục `tests/mobile/`: vì cùng một case chạy hai nơi thì hai bản sẽ trôi
xa nhau. Sửa một bản, quên bản kia, và bạn có hai testcase nói hai điều khác nhau về cùng một quy tắc.

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Viewport** | Kích thước vùng hiển thị. Không phải kích thước màn hình vật lý |
| **Chạm** (tap) | Thao tác của điện thoại. Khác click ở chỗ không có trạng thái di chuột |
| **Thiết bị khai sẵn** | Bộ cấu hình có sẵn cho từng máy: viewport, user agent, tỉ lệ điểm ảnh |
| **Lane** | Một nhánh chạy riêng trong CI, có tập test và lịch chạy riêng |

## Cây thư mục sau bài này

```
kit-cua-toi/
├── playwright.config.js          ·  từ Bài 3, nay có project 'mobile'
└── tests/
    ├── e2e/                      ·  từ Bài 4, một số case nay có tag @mobile
    ├── api/                      ·  từ Bài 10
    └── mobile-web/
        └── chi-chay-tren-mobile.spec.js   ← MỚI · case CHỈ có nghĩa trên mobile
```

Thư mục `mobile-web/` chỉ chứa case **không tồn tại trên desktop**, ví dụ vuốt để xoá. Case chạy cả
hai nơi thì ở nguyên chỗ cũ, gắn tag.

## Bộ kit của bạn đang ở đâu

```
CẤP ĐỘ 4 · EVOLVE      bài 1/9 của cấp độ này
███░░░░░░░░░░░░░░░░░░░░░░░░░

cả tài liệu           bài 21/29
████████████████████░░░░░░░░
```

**Hết cấp độ 4 bạn nói được:** Tôi mở rộng, đo được độ tin cậy, tích luỹ learning và chứng minh reuse.

Cấp độ này còn 8 bài nữa.

## Tự kiểm

1. Vì sao dùng bộ khai thiết bị thay vì đặt viewport bằng tay?
2. Ba nhóm hỏng khi chạy trên mobile?
3. Vì sao kiểm bằng điều kiện tốt hơn kiểm bằng tên project?
4. Ba khác biệt giữa click và tap? Cái nào gây ra lỗi thật cho người dùng?
5. Bàn phím ảo che nút Lưu. Vì sao test không đỏ, và bạn ghi chuyện này vào đâu?
6. Nhóm nào không đáng chạy trên mobile, và vì sao?
7. Vì sao dùng tag thay vì thư mục riêng cho case chạy cả hai nơi?

## Bài tập về nhà

Chạy bộ test hiện tại trên `devices['iPhone 14']` và `devices['Pixel 7']`.

Nếu có case đỏ ở máy này mà xanh ở máy kia, dừng lại xem kỹ. Đó thường là chỗ giao diện đang phụ thuộc
vào một kích thước cụ thể, và nó là lỗi thật.

## Bài sau

Bài 22 hỏi một câu ít người hỏi: bộ test của bạn có bao giờ kiểm xem người dùng bàn phím, người dùng
trình đọc màn hình có dùng được sản phẩm không.
