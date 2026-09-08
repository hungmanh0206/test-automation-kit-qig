# Bài 7 — Để testcase tự sở hữu dữ liệu của nó

> **2 giờ** · Có gì trong tay: config đã tách, dữ liệu test vẫn gõ tay trong từng test · Sau bài này: mỗi test tự dựng dữ liệu của nó và tự dọn sau khi chạy

**Vấn đề**

Test của bạn đang dùng khách `KH02` có sẵn trên môi trường.

Sáng nay nó đỏ. Bạn không sửa dòng nào từ hôm qua.

Hoá ra một người khác đổi hạng của `KH02` từ Bạc sang Vàng để thử một việc khác. Test đỏ, và đỏ
không phải vì sản phẩm sai.

Đó là loại đỏ tệ nhất, vì nó dạy cả team thói quen bỏ qua màu đỏ.

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Test đang dùng khách `KH02` có sẵn trên môi trường. Ai đó sửa `KH02` là test đỏ, mà đỏ không phải vì sản phẩm sai. |
| **Bài này bạn gõ gì** | Một factory tạo dữ liệu qua API, đặt tiền tố nhận diện được, và dọn sạch sau lượt chạy. |
| **Xong thì được gì** | Test chạy được trên môi trường vừa reset, chạy song song không đụng nhau, và không để rác lại. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Test của Bài 4 dùng khách `KH02` có sẵn trên app. Nó chạy được, cho tới khi một trong ba chuyện xảy ra:

- Ai đó sửa hạng của `KH02` từ Bạc sang Vàng. Test đỏ, mà sản phẩm không sai.
- Môi trường được reset. `KH02` biến mất. Test đỏ vì không tìm thấy dữ liệu.
- Hai test cùng chạy, cùng sửa `KH02`. Một trong hai đỏ, và đỏ lúc được lúc không.

Cả ba đều là test đỏ **không phải vì sản phẩm sai**. Đó là loại đỏ tệ nhất, vì nó dạy người ta thói
quen bỏ qua màu đỏ.

Bốn việc:

1. Ba cách dùng dữ liệu sai kinh điển (20 phút).
2. Viết factory tạo dữ liệu qua API (40 phút).
3. Dọn sạch, và ba lớp an toàn để không xoá nhầm (35 phút).
4. Ngẫu nhiên tới đâu thì dừng (25 phút).

---

## Việc 1 — Ba cách sai kinh điển (20 phút)

| Cách làm | Hỏng thế nào | Dấu hiệu nhận ra |
|---|---|---|
| Dùng bản ghi có sẵn trên môi trường | Người khác sửa là test đỏ | Test đỏ sau khi bạn không đụng gì vào code |
| Gắn cứng id (`KH02`, `order_1043`) | Môi trường reset là hỏng | Test chạy được trên máy bạn, đỏ trên CI |
| Nhiều test dùng chung một bản ghi | Chạy song song thì đụng nhau | Đỏ lúc được lúc không, chạy lại thì xanh |

Cách sửa cho cả ba là một: **mỗi test tự dựng dữ liệu của nó**.

Nghe tốn kém, và đúng là tốn thêm vài giây mỗi test. Đổi lại bạn được một thứ đáng giá hơn nhiều:
khi test đỏ, bạn biết chắc nó đỏ vì sản phẩm, không vì dữ liệu. Bài 17 dành cả bài cho việc phân
biệt hai loại đỏ đó, và bài này là cách rẻ nhất để loại bớt một loại ngay từ đầu.

## Việc 2 — Factory (40 phút)

Tạo `tests/support/factory.js`:

```js
'use strict';

/*
 * TIỀN TỐ nhận diện. Mọi bản ghi do test tạo ra đều bắt đầu bằng "IT test".
 *
 * Không phải để cho đẹp. Đây là thứ cho phép:
 *   - người vào môi trường nhìn một cái biết ngay bản ghi nào là của test;
 *   - janitor ở Việc 3 có tiêu chí AN TOÀN để xoá, thay vì xoá theo thời gian tạo.
 * Thiếu tiền tố thì việc dọn dẹp trở thành việc đoán, và đoán sai thì mất dữ liệu thật.
 */
const TIEN_TO = 'IT test';

function nhan(maTask, viec) {
  return `${TIEN_TO} ${maTask} ${viec}`;
}

async function taoKhach(request, { maTask, hang = 'BAC' }) {
  const res = await request.post('/api/customers', {
    data: { ten: nhan(maTask, 'khach'), hang: hang },
  });
  if (!res.ok()) {
    throw new Error(`Tạo khách hỏng: HTTP ${res.status()} — ${await res.text()}`);
  }
  return res.json();
}

async function taoDon(request, { maTask, khachId, sanPhamId, soLuong = 1 }) {
  const res = await request.post('/api/orders', {
    data: { khachId, items: [{ sanPhamId, soLuong }], ghiChu: nhan(maTask, 'don') },
  });
  if (!res.ok()) {
    throw new Error(`Tạo đơn hỏng: HTTP ${res.status()} — ${await res.text()}`);
  }
  return res.json();
}

module.exports = { TIEN_TO, nhan, taoKhach, taoDon };
```

Ba điểm đáng để ý, vì chúng lặp lại ở mọi factory bạn viết sau này:

**Tạo qua API, không qua giao diện.** Dựng dữ liệu bằng cách click qua màn hình thì chậm, và tệ hơn:
khi giao diện đổi, cả những test không liên quan tới màn đó cũng đỏ theo.

**Tạo qua API, cũng không qua database.** Ghi thẳng vào database thì nhanh nhất, và sai nhiều nhất.
Sản phẩm còn có validation, trigger, cache, sự kiện kèm theo. Ghi tắt qua database là dựng một trạng
thái mà sản phẩm **không bao giờ tự tạo ra được**, rồi test trên trạng thái đó. Bài 8 kể một trường
hợp cụ thể của chuyện này, và nó dẫn tới một bug không tồn tại được log lên Jira.

**Hỏng thì ném lỗi kèm nội dung phản hồi.** Factory trả về `undefined` im lặng thì test đỏ ở dòng
khác, và bạn mất mười lăm phút tìm ngược. Câu `HTTP 400 — {"loi":"hang không hợp lệ"}` tiết kiệm đúng
mười lăm phút đó.

Đổi test Bài 4 sang dùng factory:

```js
const { test, expect } = require('@playwright/test');
const { taoKhach } = require('../support/factory');

test('tạo đơn cho khách hạng Bạc, 2 sản phẩm SP01', async ({ page, request }) => {
  const khach = await taoKhach(request, { maTask: 'DEMO-1', hang: 'BAC' });

  await page.goto('/');
  await page.getByLabel('Khách hàng').selectOption(khach.id);
  // ... phần còn lại giữ nguyên
});
```

**Bạn sẽ thấy** test chạy như cũ, nhưng giờ nó không phụ thuộc vào `KH02` nữa. Chạy hai lần liên
tiếp cũng được, vì mỗi lần nó tạo một khách mới.

| Thấy khác | Nghĩa là | Làm gì |
|---|---|---|
| `Tạo khách hỏng: HTTP 404` | Endpoint sai đường dẫn | Mở `spec.md` phần API, so lại |
| `selectOption` timeout | Khách vừa tạo chưa hiện trong danh sách | Trang đang cache. Tải lại trang **sau** khi tạo |
| Mỗi lần chạy lại thêm một khách rác | Chưa có janitor | Việc 3 |

## Việc 3 — Dọn sạch, và ba lớp an toàn (35 phút)

Dòng cuối bảng trên là vấn đề thật. Chạy bộ test 50 lần là môi trường có 50 khách rác. Sau một tháng
thì danh sách khách của môi trường thử nghiệm không ai nhìn được nữa.

Nhưng dọn dẹp là thao tác **xoá**, và xoá là thao tác không lùi được. Nên nó cần lớp bảo vệ.

`tests/support/janitor.js`:

```js
'use strict';
const { TIEN_TO } = require('./factory');

/*
 * BA LỚP AN TOÀN. Mỗi lớp chặn một kiểu tai nạn khác nhau, và đều đã xảy ra thật ở đâu đó:
 *   1. chỉ xoá bản ghi mang TIỀN TỐ của test  → không đụng dữ liệu người thật tạo;
 *   2. chỉ xoá bản ghi mang ĐÚNG mã task này → không xoá của lượt chạy song song bên cạnh;
 *   3. từ chối chạy nếu môi trường không nằm trong danh sách cho phép → không dọn nhầm môi
 *      trường thật vì một biến BASE_URL còn sót.
 * Bỏ lớp nào cũng vẫn chạy được. Đó chính là lý do phải viết cả ba ngay từ đầu.
 */
const MOI_TRUONG_CHO_PHEP = [/localhost/, /127\.0\.0\.1/, /\.staging\./];

async function don(request, { maTask, baseURL }) {
  if (!MOI_TRUONG_CHO_PHEP.some((re) => re.test(baseURL))) {
    throw new Error(`Janitor TỪ CHỐI chạy trên ${baseURL} — không nằm trong danh sách cho phép.`);
  }

  const nhanCanXoa = `${TIEN_TO} ${maTask}`;
  const res = await request.get('/api/customers');
  const dsKhach = await res.json();

  let daXoa = 0;
  for (const kh of dsKhach) {
    if (!kh.ten || !kh.ten.startsWith(nhanCanXoa)) continue;
    await request.delete(`/api/customers/${kh.id}`);
    daXoa++;
  }
  return daXoa;
}

module.exports = { don };
```

Gọi nó sau mỗi file test:

```js
const { don } = require('../support/janitor');

test.afterAll(async ({ request, baseURL }) => {
  const n = await don(request, { maTask: 'DEMO-1', baseURL });
  console.log(`[janitor] đã dọn ${n} bản ghi`);
});
```

### Vì sao janitor phải chạy được riêng

Test chết giữa chừng thì `afterAll` không chạy. Máy bạn ngủ, mạng rớt, ai đó bấm Ctrl-C. Nên janitor
phải gọi được từ ngoài:

```json
"scripts": {
  "don:test-data": "node scripts/qa/don-test-data.js"
}
```

Đây là một mẫu chung: **thứ gì chạy tự động thì cũng phải chạy tay được**. Nó cứu bạn đúng vào lúc
tự động không chạy.

## Việc 4 — Ngẫu nhiên tới đâu thì dừng (25 phút)

Phản xạ đầu tiên là dùng số ngẫu nhiên cho mọi thứ:

```js
const ten = `IT test ${Math.random()}`;
```

Đừng. Nó gây ra một vấn đề khó chịu: test đỏ, bạn muốn dựng lại đúng bản ghi đó để xem, và không dựng
lại được nữa.

Ngưỡng vừa đủ là **tựa ngẫu nhiên**: đủ để không trùng, nhưng ghi lại được:

```js
/* Mã lượt chạy: đặt MỘT LẦN cho cả lượt, in ra đầu log, và ghi vào tên mọi bản ghi.
   Test đỏ thì bạn có một chuỗi để tìm ngược ra đúng dữ liệu của lượt đó. */
const MA_LUOT = process.env.MA_LUOT || new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
```

Rồi:

```js
function nhan(maTask, viec) {
  return `${TIEN_TO} ${maTask} ${MA_LUOT} ${viec}`;
}
```

Giờ tên bản ghi là `IT test DEMO-1 20260908143012 khach`. Nhìn là biết task nào, lượt nào, việc gì.

Ba loại giá trị và cách xử lý khác nhau:

| Loại | Nên làm gì | Vì sao |
|---|---|---|
| Tên, mã, email | Tựa ngẫu nhiên có mã lượt | Không trùng, mà truy được |
| Số dùng để tính tiền | **Cố định**, chọn theo `spec.md` | Ngẫu nhiên thì kết quả mong đợi cũng phải tính động, và bạn sẽ tính bằng chính công thức của sản phẩm |
| Ngày tháng | Cố định, hoặc tính từ một mốc khai rõ | Ngày "hôm nay" làm test đỏ vào cuối tháng, cuối năm, hoặc ngày 29/2 |

Dòng giữa là chỗ dễ sai nhất, và nó đáng để nói kỹ. Nếu số lượng ngẫu nhiên thì bạn không viết được
kết quả mong đợi cố định, nên bạn sẽ viết một hàm tính kết quả mong đợi. Hàm đó sẽ giống hệt công
thức trong sản phẩm. Và lúc đó test của bạn đang so sản phẩm với chính nó.

Đó gọi là **tautology**, và Bài 13 dành cả bài cho nó, vì nó là cách hỏng âm thầm nhất trong nghề
này: test luôn xanh, và không chứng minh được gì.

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Factory** | Hàm tạo ra dữ liệu test theo yêu cầu, trả về đúng thứ test cần dùng |
| **Dữ liệu mồ côi** | Bản ghi test tạo ra rồi không ai xoá. Tích lại theo tháng |
| **Janitor** | Thứ dọn dữ liệu sau lượt chạy. Có thể chạy riêng khi test chết giữa chừng |
| **Dữ liệu tựa ngẫu nhiên** | Ngẫu nhiên đủ để không trùng, nhưng lặp lại được khi cần điều tra |

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .env.example                  ·  từ Bài 6
├── .agent/config/env-allow.json  ·  từ Bài 6
├── profiles/DEMO-1/task.env      ·  từ Bài 6
├── scripts/
│   ├── lib/config.js             ·  từ Bài 6
│   └── qa/
│       ├── kiem-cau-hinh.js      ·  từ Bài 6
│       └── don-test-data.js      ← MỚI · gọi janitor từ ngoài
└── tests/
    ├── support/
    │   ├── factory.js            ← MỚI · tạo dữ liệu qua API, có tiền tố
    │   └── janitor.js            ← MỚI · dọn, ba lớp an toàn
    └── e2e/
        └── tao-don-hang.spec.js  ·  từ Bài 4, nay dùng factory
```

## Bộ kit của bạn đang ở đâu

```
CẤP ĐỘ 2 · BUILD      bài 3/7 của cấp độ này
████████████░░░░░░░░░░░░░░░░

cả tài liệu           bài 7/29
███████░░░░░░░░░░░░░░░░░░░░░
```

**Hết cấp độ 2 bạn nói được:** Tôi có một Test Kit.

Cấp độ này còn 4 bài nữa.

## Tự kiểm

1. Ba cách dùng dữ liệu sai kinh điển, và dấu hiệu nhận ra từng cái?
2. Vì sao tạo dữ liệu qua API chứ không qua giao diện?
3. Vì sao cũng không nên tạo qua database, dù nó nhanh nhất?
4. Ba lớp an toàn của janitor, mỗi lớp chặn tai nạn gì?
5. Vì sao janitor phải chạy tay được, không chỉ chạy trong `afterAll`?
6. Vì sao `Math.random()` thuần lại gây khó khi điều tra một lượt đỏ?
7. Số dùng để tính tiền thì nên cố định hay ngẫu nhiên? Ngẫu nhiên thì dẫn tới chuyện gì?
8. Tiền tố `IT test` phục vụ hai mục đích nào?

## Bài tập về nhà

Chạy bộ test 5 lần liên tiếp, rồi mở danh sách khách trên app thực hành.

Đếm xem còn bao nhiêu bản ghi rác. Nếu còn, tìm xem janitor bỏ sót ở đâu: nó không chạy, hay nó chạy
mà tiêu chí lọc không khớp.

Rồi thử một thứ đáng sợ hơn: đặt `BASE_URL` thành một địa chỉ không nằm trong danh sách cho phép, và
chạy janitor. Nó phải **từ chối**. Nếu nó chạy thì lớp an toàn thứ ba của bạn chưa hoạt động.

## Bài sau

Bài 8 đi tiếp một bậc. Factory tạo được dữ liệu, nhưng testcase thường không nói *"cần một khách hạng
Bạc"*, nó nói *"cần một đơn hàng ở trạng thái Pending"*. Trạng thái thì không tạo thẳng được, phải
đi qua vài bước. Đó là chỗ fixture xuất hiện.
