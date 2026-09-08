# Bài 3 — Cho Playwright chạy testcase đầu tiên

> **2 giờ** · Có gì trong tay: repo rỗng có `.gitignore` và `package.json` · Sau bài này: Playwright chạy được, và bạn hiểu từng dòng trong file cấu hình

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Cài xong một công cụ mới, chạy được test mẫu, nhưng file cấu hình 40 dòng thì không biết dòng nào làm gì. |
| **Bài này bạn gõ gì** | Cài Playwright, đi qua từng tuỳ chọn trong config, và thử ba tuỳ chọn đặt sai gây xanh giả. |
| **Xong thì được gì** | Một `playwright.config.js` bạn hiểu và sửa được, không phải một file copy từ đâu đó. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Bốn việc:

1. Cài Playwright và chạy test mẫu (25 phút).
2. Đi qua từng tuỳ chọn trong file cấu hình (45 phút).
3. Ba tuỳ chọn đặt sai gây xanh giả, thử từng cái (30 phút).
4. Chạy có giao diện và không giao diện, khi nào dùng cái nào (20 phút).

---

## Việc 1 — Cài và chạy thử (25 phút)

Trong thư mục repo của bạn:

```bash
npm init playwright@latest
```

Nó hỏi vài câu. Trả lời thế này, và lý do:

| Câu hỏi | Chọn | Vì sao |
|---|---|---|
| TypeScript hay JavaScript | **JavaScript** | Tài liệu này viết bằng JavaScript. Đổi sang TypeScript sau được, không phải làm lại |
| Thư mục test | `tests` | Bài 5 sẽ chia nhỏ bên trong |
| Thêm GitHub Actions | **Không** | Bài 20 dựng CI từ đầu, hiểu từng dòng |
| Cài trình duyệt | **Có** | Không cài thì không chạy được |

Bước cài trình duyệt tải khá nặng, khoảng vài trăm MB. Đây là lúc pha cà phê.

Chạy test mẫu nó vừa tạo:

```bash
npx playwright test
```

**Bạn sẽ thấy** vài dòng kiểu này:

```
Running 6 tests using 6 workers
  6 passed (4.2s)
```

| Thấy khác | Nghĩa là | Làm gì |
|---|---|---|
| `browserType.launch: Executable doesn't exist` | Trình duyệt chưa tải xong | `npx playwright install` |
| `Error: No tests found` | Đường dẫn thư mục test không khớp config | Xem `testDir` trong `playwright.config.js` |
| Treo rất lâu rồi timeout | Mạng công ty chặn tải trình duyệt | Hỏi IT, hoặc cài qua proxy |

Test mẫu này kiểm trang `playwright.dev`, không kiểm app của bạn. Nó chỉ chứng minh một điều: công cụ
chạy được trên máy này. Xoá nó đi sau khi xem xong.

## Việc 2 — Đi qua từng tuỳ chọn (45 phút)

Mở `playwright.config.js`. Đây là file quyết định chất lượng cả bộ test, nên đáng ngồi 45 phút.

```js
// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',

  /* Chạy song song. Nhanh hơn nhiều, nhưng chỉ đúng khi các test ĐỘC LẬP với nhau.
     Bài 7 đã lo phần đó bằng cách cho mỗi test tự dựng dữ liệu của nó. */
  fullyParallel: true,

  /* CẤM .only lọt lên CI. Người ta hay để .only lại sau khi debug một test,
     và khi đó CI chỉ chạy đúng test đó rồi báo xanh. Xem Việc 3. */
  forbidOnly: !!process.env.CI,

  /* Chạy lại test đỏ. Trên CI thì 1 lần để lọc chập chờn thật. Trên máy bạn thì 0,
     vì bạn cần thấy nó đỏ để sửa, không cần nó tự khỏi. */
  retries: process.env.CI ? 1 : 0,

  /* Số luồng. Để mặc định (theo số nhân CPU) trên máy, cố định trên CI cho kết quả ổn định. */
  workers: process.env.CI ? 2 : undefined,

  /* Báo cáo. 'list' để đọc trong terminal, 'html' để xem lại chi tiết. */
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:4010',

    /* Bản ghi lại lượt chạy. 'on-first-retry' nghĩa là chỉ ghi khi test đỏ rồi chạy lại,
       nên không tốn dung lượng cho hàng trăm lượt xanh. */
    trace: 'on-first-retry',

    /* Ảnh khi đỏ. Bài 11 sẽ thay bằng cách chụp có khoanh đỏ và che dữ liệu khách. */
    screenshot: 'only-on-failure',

    /* Thời gian chờ tối đa cho MỘT thao tác. Không phải cho cả test. */
    actionTimeout: 10_000,
  },

  /* Thời gian chờ tối đa cho MỘT test. Vượt là đỏ. */
  timeout: 30_000,

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

Mười ba tuỳ chọn, nhưng chỉ ba cái quyết định bộ test của bạn có đáng tin không. Việc 3 nói về chúng.

Ba tuỳ chọn thời gian hay bị nhầm lẫn, tách rõ ở đây:

| Tuỳ chọn | Đếm cái gì | Đặt quá thấp thì |
|---|---|---|
| `actionTimeout` | Một thao tác: click, fill, chờ element | Đỏ oan trên máy chậm |
| `timeout` | Cả một test từ đầu tới cuối | Test dài bị cắt giữa chừng |
| `expect.timeout` | Một assertion chờ điều kiện | Đỏ trước khi trang kịp cập nhật |

Đặt quá **cao** cũng có giá: một test hỏng thật sẽ ngồi chờ đủ 30 giây rồi mới đỏ, nhân với 200 test
là mười phút chờ vô ích mỗi lượt chạy.

## Việc 3 — Ba tuỳ chọn gây xanh giả (30 phút)

Xanh giả là khi pipeline báo thành công mà thực tế không có gì được kiểm. Nó nguy hiểm hơn đỏ, vì đỏ
thì có người nhìn, còn xanh thì không ai nhìn.

### 3.1 — `.only` bị bỏ quên

Sửa một test mẫu thành `test.only(...)` rồi chạy:

```bash
npx playwright test
```

**Bạn sẽ thấy** nó chạy đúng **một** test, và báo xanh.

```
Running 1 test using 1 worker
  1 passed (0.8s)
```

Đó là toàn bộ vấn đề: dòng "1 passed" trông y hệt dòng "6 passed" với người lướt qua. Trên CI thì
không ai đếm.

Giờ thử với `forbidOnly`:

```bash
CI=1 npx playwright test
```

**Bạn sẽ thấy** nó **chặn**:

```
Error: item focused with '.only' is not allowed due to the "forbidOnly" CI flag.
```

Đây là ví dụ đầu tiên trong tài liệu này về một ý sẽ quay lại rất nhiều: một quy tắc mà không có máy
kiểm thì sẽ có lúc bị bỏ qua. Không phải vì ai cẩu thả, mà vì lúc gấp thì người ta quên.

### 3.2 — `retries` quá cao

Đặt `retries: 3` thì một test đỏ 3 lần liên tiếp mới bị tính là đỏ. Nghe hợp lý, nhưng nó giấu mất
thông tin quan trọng nhất: **test này có ổn định không**.

Một test xanh nhờ chạy lại lần thứ ba không giống một test xanh ngay lần đầu. Báo cáo gộp chúng làm
một thì bạn mất khả năng nhìn thấy bộ test đang mục dần. Bài 25 sẽ đo đúng khoảng cách đó và gọi tên
nó.

Quy tắc thực dụng: `retries: 1` trên CI, `retries: 0` trên máy bạn. Cao hơn thì phải có lý do ghi lại.

### 3.3 — Không có test nào khớp

Đổi `testDir` thành một thư mục không tồn tại rồi chạy. Tuỳ phiên bản, bạn sẽ thấy một trong hai:

```
Error: No tests found
```

hoặc, nếu ai đó thêm cờ `--pass-with-no-tests`:

```
0 passed (0.1s)
```

Dòng thứ hai là mã thoát `0`. CI xanh. Không có gì được kiểm.

Đây là kiểu hỏng nguy hiểm nhất trong cả bài, vì nó không tạo ra tín hiệu nào. Chỉ cần đổi cấu trúc
thư mục mà quên sửa `testDir` là đủ. Bài 20 sẽ dựng một máy đếm số test trước khi chạy, và chặn khi
con số bằng 0.

## Việc 4 — Có giao diện và không giao diện (20 phút)

```bash
npx playwright test --headed          # hiện cửa sổ trình duyệt
npx playwright test --debug           # dừng từng bước, có thanh điều khiển
npx playwright test --ui              # giao diện chọn test, xem lại từng bước
```

| Cách chạy | Dùng khi | Đừng dùng khi |
|---|---|---|
| Mặc định (không giao diện) | Chạy cả bộ, chạy trên CI | Đang tìm hiểu vì sao một test đỏ |
| `--headed` | Muốn nhìn nó thao tác | Chạy 200 test, sẽ rất chậm |
| `--ui` | Debug một test cụ thể | Trên CI, không có màn hình |

Một mẹo tiết kiệm thời gian: khi một test đỏ mà bạn không hiểu vì sao, đừng thêm `console.log`. Chạy
`--ui` rồi tua tới bước đỏ, nhìn ảnh chụp DOM ở đúng thời điểm đó. Thường thấy ngay: element chưa
hiện, hoặc có hai element khớp, hoặc có một lớp che ở trên.

Khai lệnh vào `package.json` để không phải nhớ:

```json
"scripts": {
  "test": "playwright test",
  "test:ui": "playwright test --ui",
  "test:headed": "playwright test --headed"
}
```

Từ giờ mọi lệnh đều khai vào đây. Lý do đơn giản: người khác gõ `npm run test:ui` được, còn nhớ cả
chuỗi tham số thì không.

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Headless** | Chạy trình duyệt không hiện cửa sổ. Nhanh hơn, nhưng không nhìn được |
| **Retry** | Chạy lại test đỏ. Hữu ích để lọc chập chờn, nguy hiểm nếu dùng để giấu lỗi |
| **Trace** | Bản ghi lại toàn bộ lượt chạy để xem lại sau. Nặng, nên chỉ bật khi cần |
| **Xanh giả** | Pipeline báo thành công trong khi không có gì được kiểm thật |

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .gitignore                    ·  từ Bài 2, nay thêm test-results/ và playwright-report/
├── README.md                     ·  từ Bài 2
├── package.json                  ·  từ Bài 2, nay có 3 lệnh test
├── playwright.config.js          ← MỚI · 13 tuỳ chọn, bạn hiểu từng cái
└── tests/
    └── (rỗng, Bài 4 sẽ viết test đầu tiên)
```

Nhớ thêm hai dòng vào `.gitignore`:

```
test-results/
playwright-report/
```

Hai thư mục này sinh lại mỗi lượt chạy, nặng, và chứa ảnh có thể có dữ liệu khách.

## Bộ kit của bạn đang ở đâu

```
CẤP ĐỘ 1 · AUTOMATE      bài 3/4 của cấp độ này
█████████████████████░░░░░░░

cả tài liệu           bài 3/29
███░░░░░░░░░░░░░░░░░░░░░░░░░
```

**Hết cấp độ 1 bạn nói được:** Tôi chạy được test và tôi hiểu kết quả của nó.

Cấp độ này còn 1 bài nữa.

## Tự kiểm

1. Vì sao chọn JavaScript thay vì TypeScript cho tài liệu này, và đổi sau có tốn không?
2. `actionTimeout`, `timeout`, `expect.timeout` đếm ba thứ khác nhau. Là ba thứ gì?
3. Đặt timeout quá **cao** thì hại ở đâu?
4. `.only` bị bỏ quên gây ra chuyện gì trên CI? Tuỳ chọn nào chặn nó?
5. Vì sao `retries: 3` làm bạn mất thông tin, dù bộ test trông ổn định hơn?
6. Kiểu xanh giả nào không tạo ra tín hiệu nào cả?
7. Khi một test đỏ mà bạn không hiểu, nên làm gì trước khi thêm `console.log`?

## Bài tập về nhà

Mở `playwright.config.js` và đọc lại từ trên xuống. Với mỗi tuỳ chọn, tự trả lời: *"đặt sai giá trị
này thì bộ test của tôi hỏng kiểu gì"*.

Có ít nhất ba tuỳ chọn mà câu trả lời là *"nó vẫn chạy, chỉ là không kiểm gì nữa"*. Tìm ra cả ba.

## Bài sau

Bài 4 viết test đầu tiên cho app thực hành. Và nó bắt đầu bằng một việc nghe ngược đời: làm cho test
đỏ trước, rồi mới làm cho xanh.
