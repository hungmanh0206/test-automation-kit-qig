# Bài 8 — Dựng precondition ổn định với Fixture

> **2 giờ** · Có gì trong tay: factory tạo được dữ liệu, mỗi test vẫn tự gọi tay · Sau bài này: dữ liệu dựng đúng luồng, dọn được, và không phá môi trường của ai
>
> *Bài này không đánh số, nó là phần đào sâu của **Bài 9**. Đọc kèm **Bài 9**.*

**Vấn đề**

Bạn mở ba mươi testcase của mình ra và đọc phần đầu của từng cái.

Cả ba mươi đều bắt đầu bằng gần như đúng tám dòng giống nhau: tạo khách, tạo sản phẩm, tạo đơn, rồi
đưa đơn về trạng thái cần thiết.

Giờ luồng tạo đơn của sản phẩm đổi một bước. Bạn phải sửa ba mươi chỗ, và sẽ có chỗ bị bỏ sót.

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Case chết giữa chừng vì thiếu dữ liệu, rồi bạn tưởng đó là bug của app. |
| **Bài này bạn gõ gì** | Viết hàm tạo dữ liệu qua API, viết fixture dựng và dọn, rồi viết máy quét rác còn sót. |
| **Xong thì được gì** | Mỗi case bắt đầu từ trạng thái biết trước. Và bạn hiểu vì sao có loại bug không có thật. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Bốn việc:

1. Bốn cách dựng dữ liệu, và vì sao không dùng câu lệnh database (25 phút).
2. Viết hàm tạo dữ liệu qua API, có dấu nhận diện để dọn được (45 phút).
3. Viết fixture dựng trước và dọn sau mỗi case (35 phút).
4. Viết máy quét rác còn sót, với ba lớp an toàn (35 phút).

---

## Việc 1 — Vấn đề: 3 test ở Bài 9 đang giả định có sẵn dữ liệu

Nhìn lại `TC_015`:

```js
test('TC_015 …', async ({ page }) => {
  await page.getByLabel('Tìm khách hàng').fill('KH_BAC_01');   // ← mã dữ liệu GÁN CỨNG
  // …
});
```

Test này chỉ chạy được nếu `KH_BAC_01` **tồn tại** và đang hạng Bạc. Ai làm điều đó? Hiện tại: không ai.
Nó chạy được vì tình cờ dữ liệu đó có trên môi trường. Và nó sẽ đỏ vào ngày ai đó xoá hoặc đổi hạng khách đó.

Test phụ thuộc dữ liệu tình cờ không phải test. Nó là một quan sát may mắn.

## Việc 2 — Bốn cách dựng, và cách thứ năm bị cấm

| Cách | Là gì | Dùng khi | Chi phí |
|---|---|---|---|
| **Factory** | Gọi API công khai để tạo dữ liệu | Mặc định, dùng nhiều nhất | Thấp |
| **Fixture** | Dữ liệu cố định, dựng sẵn, dùng lại | Dữ liệu nền ít đổi (danh mục sản phẩm) | Rất thấp |
| **Hook** | Endpoint riêng do Dev làm cho test | Trạng thái không dựng nổi qua luồng thường | Cần Dev |
| **Mock** | Chặn và trả dữ liệu giả ở tầng mạng | Kiểm FE độc lập, hoặc mô phỏng lỗi | Thấp, nhưng không kiểm được BE |
| ~~**DB**~~ | ~~`INSERT`/`UPDATE` thẳng vào bảng~~ | **KHÔNG BAO GIỜ** | Rất cao — xem mục 3 |

Thứ tự ưu tiên: Factory → Fixture → Hook → Mock. Xuống tầng nào thì mất một phần độ thật của test, nên
chỉ xuống khi tầng trên không làm được.

## Việc 3 — Vì sao database bị cấm: bug ma

Đây là mục quan trọng nhất của bài.

Dựng dữ liệu bằng `UPDATE` thẳng vào bảng tạo ra trạng thái mà **luồng ứng dụng thật không bao giờ sinh ra
được. Ứng dụng xử lý sai với trạng thái đó là chuyện dễ hiểu, nhưng nó không phải bug**, vì trạng thái
đó không xảy ra trong thực tế.

Ví dụ cụ thể trên tài liệu mẫu:

```sql
-- Muốn có đơn "đã thanh toán rồi hủy" để test, nên làm nhanh:
UPDATE orders SET status = 'CANCELLED' WHERE id = 123;
```

Nhưng luồng thật khi hủy đơn còn làm bốn việc nữa: ghi bản ghi hoàn tiền · cập nhật tồn kho · sinh thông báo ·
ghi log audit. Câu `UPDATE` trên bỏ hết. Giờ bạn có một đơn `CANCELLED` mà không có bản ghi hoàn tiền —
trạng thái không tồn tại trong sản phẩm thật.

Test trên đó rồi thấy màn Chi tiết hiển thị sai → bạn log bug → Dev điều tra → phát hiện dữ liệu không hợp lệ
→ trả về. Mất thời gian hai phía, và mất uy tín của báo cáo.

> Trước khi kết luận là bug, phải tái hiện được trên dữ liệu dựng đúng luồng
> ứng dụng**. Chỉ tái hiện được trên dữ liệu dựng tay ở tầng DB thì rất có thể đó là hệ quả của cách dựng.

**Vậy DB dùng để làm gì?** Để **đọc**, và chỉ ở những chỗ UI và API không phân biệt được:

- Xoá mềm hay xoá thật?
- Có sinh bản ghi mồ côi không (cascade)?
- Trường có trong DB nhưng màn không render?
- Có ghi trùng hai bản ghi không?

Và kể cả khi đọc: kết quả truy vấn DB không phải bằng chứng (Bài 17). Nó là công cụ điều tra.

## Việc 4 — Factory: cách mặc định

`tests/support/setup/factory.js`:

```js
/*
 * factory.js — dựng dữ liệu test qua API CÔNG KHAI của ứng dụng.
 *
 * VÌ SAO QUA API, KHÔNG QUA DB: API đi đúng luồng nghiệp vụ nên trạng thái sinh ra là trạng thái CÓ THẬT.
 * Dựng bằng DB tạo ra trạng thái mà luồng thật không sinh được ⇒ test trên đó đẻ ra "bug ma".
 *
 * MỌI dữ liệu tạo ra đều mang tiền tố nhận diện được, để dọn được và để người khác biết đây là dữ liệu test.
 */
'use strict';

// Tiền tố BẮT BUỘC. Nhìn bản ghi là biết ngay: test tạo, task nào, lúc nào.
const TIEN_TO = 'IT test';

function tenDuyNhat(mo_ta) {
  const task = process.env.MA_TASK || 'NOTASK';
  return `${TIEN_TO} ${task} ${mo_ta} ${Date.now()}`;
}

/**
 * Tạo khách hàng ở hạng cho trước.
 * @param {import('@playwright/test').APIRequestContext} api
 */
async function taoKhachHang(api, { hang = 'Thường' } = {}) {
  const body = { ten: tenDuyNhat('KH'), hang, sdt: '0900000000' };
  const r = await api.post('/api/customers', { data: body });
  if (!r.ok()) {
    // Ném lỗi RÕ RÀNG: đây là setup_failure, không phải bug sản phẩm (Bài 17).
    throw new Error(`SETUP: tạo khách hàng thất bại ${r.status()} — ${await r.text()}`);
  }
  return r.json();
}

/** Tạo đơn nháp có sẵn dòng sản phẩm. */
async function taoDonNhap(api, { khachHangId, sanPhamId, soLuong = 1 } = {}) {
  const r = await api.post('/api/orders', {
    data: { khachHangId, dong: [{ sanPhamId, soLuong }], trangThai: 'NHAP' }
  });
  if (!r.ok()) throw new Error(`SETUP: tạo đơn nháp thất bại ${r.status()} — ${await r.text()}`);
  return r.json();
}

/** Dọn: xoá qua API, đúng luồng. Không throw — dọn thất bại không được làm test đỏ. */
async function don(api, { customers = [], orders = [] } = {}) {
  for (const id of orders) {
    try { await api.delete(`/api/orders/${id}`); } catch (e) { console.warn('dọn đơn ' + id + ' lỗi'); }
  }
  for (const id of customers) {
    try { await api.delete(`/api/customers/${id}`); } catch (e) { console.warn('dọn KH ' + id + ' lỗi'); }
  }
}

module.exports = { TIEN_TO, tenDuyNhat, taoKhachHang, taoDonNhap, don };
```

Bốn quyết định trong đoạn trên, mỗi cái chặn một vấn đề:

| Quyết định | Chặn gì |
|---|---|
| Tiền tố `IT test` + `MA_TASK` | Người khác nhìn bản ghi biết là dữ liệu test của task nào — không xoá nhầm, không tưởng là dữ liệu thật |
| `Date.now()` trong tên | Chạy song song không đụng nhau |
| Ném lỗi có chữ `SETUP:` | Bài 17 phân loại được đây là lỗi dựng, không log Jira |
| `don()` không throw | Dọn thất bại làm test đỏ thì bạn mất kết quả thật của lượt chạy |

## Việc 5 — Fixture của Playwright: dựng và dọn tự động

`tests/support/fixtures.js`:

```js
const base = require('@playwright/test');
const { taoKhachHang, taoDonNhap, don } = require('./setup/factory');

/*
 * Fixture bọc factory lại: test chỉ khai "tôi cần khách hạng Bạc", không cần biết dựng thế nào.
 * Phần dọn chạy SAU mỗi test, kể cả khi test đỏ — đó là lý do dùng fixture chứ không gọi factory trực tiếp.
 */
const test = base.test.extend({
  duLieu: async ({ request }, use) => {
    const daTao = { customers: [], orders: [] };

    const api = {
      async khachHang(opts) {
        const kh = await taoKhachHang(request, opts);
        daTao.customers.push(kh.id);
        return kh;
      },
      async donNhap(opts) {
        const d = await taoDonNhap(request, opts);
        daTao.orders.push(d.id);
        return d;
      }
    };

    await use(api);

    // Dọn LUÔN chạy, kể cả test đỏ. Không để lại bản ghi mồ côi trên môi trường dùng chung.
    await don(request, daTao);
  }
});

module.exports = { test, expect: base.expect };
```

Test giờ đọc rất gọn, và không còn phụ thuộc dữ liệu tình cờ:

```js
const { test, expect } = require('../support/fixtures');

test('TC_015 [E2E] tạo đơn → lưu nháp → chi tiết, giá trị còn nguyên', async ({ page, duLieu }) => {
  // Tiền điều kiện dựng BẰNG MÁY, không giả định dữ liệu có sẵn
  const kh = await duLieu.khachHang({ hang: 'Bạc' });

  await page.goto('/orders/create');
  await page.getByLabel('Tìm khách hàng').fill(kh.ma);
  await page.getByRole('option', { name: kh.ma, exact: true }).click();
  // … phần còn lại như Bài 9
});
```

## Việc 6 — Ba mức sẵn sàng

Không phải tiền điều kiện nào cũng dựng được. Phân **ba mức**, và mỗi mức dẫn tới một trạng thái kết quả khác:

| Mức | Nghĩa | Trạng thái ở Bài 17 nếu chưa chạy được |
|---|---|---|
| **Ready** | Dựng được ngay bằng factory hoặc fixture | — (chạy bình thường) |
| **Cần hook** | Cần Dev làm endpoint riêng; nêu rõ thiếu cái gì | `BLOCKED_SETUP` |
| **Chỉ làm tay** | Bản chất không tự động được | `SKIP_SETUP` |

Vì sao phải tách hai mức cuối: chúng là hai việc khác nhau.

- `Cần hook` là một yêu cầu gửi tới Dev — có đường xử lý.
- `Chỉ làm tay` là một quyết định về phạm vi — không ai phải làm gì thêm.

Gộp cả hai vào `SKIP` thì không ai biết cái nào cần đòi Dev, cái nào chấp nhận làm tay. Và ghi *"thiếu
capability"* chung chung cũng vô dụng, phải ghi thiếu hook nào, thiếu quyền gì.

## Việc 7 — Hợp đồng tiền điều kiện

Với mỗi tiền điều kiện, ghi bốn thứ. Đặt trong `requirements/setup-strategy.md`:

```markdown
## PRE-01 — Khách hàng hạng Bạc

| | |
|---|---|
| **Loại** | Dữ liệu nghiệp vụ |
| **Cách dựng** | Factory — `POST /api/customers` với `hang: "Bạc"` |
| **Verify** | Đọc lại `GET /api/customers/{id}`, khẳng định `hang === "Bạc"` |
| **Dọn** | `DELETE /api/customers/{id}` sau mỗi test (fixture tự chạy) |
| **Sẵn sàng** | Ready |

## PRE-02 — Đơn đã thanh toán rồi bị hủy

| | |
|---|---|
| **Loại** | Trạng thái phức hợp |
| **Cách dựng** | Chưa dựng được: API công khai không có đường hủy đơn ĐÃ thanh toán |
| **Verify** | — |
| **Dọn** | — |
| **Sẵn sàng** | **Cần hook** — thiếu `POST /api/test/orders/{id}/force-cancel`. Đã gửi Dev ngày <ngày>. |
```

Ba lý do hợp đồng này đáng viết:

1. Case chết giữa chừng lộ ra ở Phase 1, không phải giữa lúc execute.
2. **Phần verify** là thứ hay bị bỏ. Dựng xong mà không kiểm thì bạn không biết nó đã dựng đúng.
3. **Phần dọn** viết ra thì mới có người làm.

> Vì sao phải kiểm lại sau khi dựng. Hàm tạo dữ liệu trả về `200` không có nghĩa dữ liệu đúng như bạn muốn. API có thể bỏ
> qua field `hang` (không có trong danh sách cho phép ghi) và tạo khách hạng `Thường`. Test sau đó kiểm giảm
> giá 3% và đỏ. Bạn tưởng công thức sai, thực ra khách sai hạng. **Verify bắt được ngay.**

## Việc 8 — Non-destructive: đừng phá việc của người khác

Môi trường test là môi trường **dùng chung**: BA đang demo, Dev đang debug, QA khác đang chạy suite.

Ba luật:

1. Chỉ chạm dữ liệu mình tạo. Không sửa, không xoá bản ghi có sẵn, kể cả khi trông như rác.
2. Xác nhận trước mỗi lượt chạm có khả năng thay đổi dữ liệu, khi làm thủ công.
3. Dọn thứ mình tạo, và có một janitor dọn định kỳ cho phần rơi lại.

`scripts/qa/don-du-lieu-test.js`:

```js
#!/usr/bin/env node
/*
 * don-du-lieu-test.js — janitor: dọn dữ liệu test rơi lại (test bị ngắt giữa chừng, máy sập…).
 *
 * VÌ SAO CẦN: fixture dọn sau mỗi test, nhưng test bị Ctrl+C hay CI bị kill thì phần dọn không chạy.
 * Vài trăm bản ghi rác tích luỹ làm màn danh sách chậm đi và làm người sau không phân biệt được
 * đâu là dữ liệu thật.
 *
 * AN TOÀN: chỉ xoá bản ghi mang ĐÚNG tiền tố của factory, và mặc định là XEM TRƯỚC.
 */
'use strict';
const { TIEN_TO } = require('../../tests/support/setup/factory');

const APPLY = process.argv.includes('--apply');
const CU_HON_GIO = Number(process.env.CLEANUP_OLDER_THAN_HOURS || 24);

async function main() {
  const base = process.env.APP_BASE_URL;
  const token = process.env.APP_API_TOKEN;
  if (!base || !token) {
    console.error('[janitor] KHÔNG ĐO ĐƯỢC: thiếu APP_BASE_URL hoặc APP_API_TOKEN');
    process.exit(2);
  }

  const r = await fetch(`${base}/api/customers?q=${encodeURIComponent(TIEN_TO)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) { console.error('[janitor] KHÔNG ĐO ĐƯỢC: API trả ' + r.status); process.exit(2); }
  const all = await r.json();

  const nguong = Date.now() - CU_HON_GIO * 3600e3;
  const canDon = all.filter((c) =>
    c.ten.startsWith(TIEN_TO) && new Date(c.createdAt).getTime() < nguong);

  console.log(`[janitor] ${all.length} bản ghi mang tiền tố "${TIEN_TO}" · ` +
    `${canDon.length} cũ hơn ${CU_HON_GIO}h`);
  if (!APPLY) {
    canDon.slice(0, 20).forEach((c) => console.log('  sẽ xoá: ' + c.ten));
    console.log('\nXem trước. Thêm --apply để xoá thật.');
    return;
  }
  let ok = 0;
  for (const c of canDon) {
    const d = await fetch(`${base}/api/customers/${c.id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (d.ok) ok++;
  }
  console.log(`[janitor] đã xoá ${ok}/${canDon.length}`);
}

main().catch((e) => { console.error('[janitor] lỗi: ' + e.message); process.exit(1); });
```

Ba lớp an toàn: chỉ tiền tố của factory · chỉ bản ghi cũ hơn N giờ (không xoá thứ đang chạy) ·
**mặc định xem trước**.

---

## Thực hành (55 phút)

### Bước 1 — Viết factory (20 phút)

Viết `tests/support/setup/factory.js` cho **hai** thực thể của dự án bạn. Bắt buộc: tiền tố nhận diện được ·
`MA_TASK` trong tên · ném lỗi có chữ `SETUP:` khi thất bại · hàm `don()` không throw.

### Bước 2 — Fixture (10 phút)

Viết `tests/support/fixtures.js`. Sửa 3 test ở Bài 9 để dùng `duLieu` thay vì mã dữ liệu gán cứng.

Chạy lại. Chúng phải **vẫn xanh** — và giờ không còn phụ thuộc dữ liệu tình cờ.

### Bước 3 — Kiểm phần dọn có thật chạy (10 phút)

Đây là bước hay bị bỏ:

```bash
# Đếm bản ghi test TRƯỚC
# chạy suite
npx playwright test
# Đếm LẠI — phải bằng con số trước
```

Không bằng nhau nghĩa là `don()` không chạy hoặc chạy không hết. Sửa trước khi đi tiếp, nếu không bạn đang
tích luỹ rác trên môi trường dùng chung.

Thử luôn ca xấu: cho một test **đỏ** có chủ ý, xác nhận phần dọn **vẫn chạy**.

### Bước 4 — Hợp đồng tiền điều kiện (10 phút)

Viết `requirements/setup-strategy.md` cho mọi tiền điều kiện của bộ case Bài 14. Với mỗi cái, chấm **mức sẵn
sàng**. Đếm:

| Mức | Số tiền điều kiện |
|---|---|
| Ready | |
| Cần hook | |
| Chỉ làm tay | |

Hai mức cuối là danh sách bạn mang đi nói chuyện với Dev và với QA Lead. Với mỗi `Cần hook`, ghi **chính xác**
endpoint bạn cần.

### Bước 5 — Commit

```bash
git add tests/support scripts/qa/don-du-lieu-test.js outputs/demo/tasks/PROJ-1234/requirements
git commit -m "feat(setup): factory + fixture tự dọn + janitor + hợp đồng tiền điều kiện

<N> tiền điều kiện: <a> Ready, <b> cần hook, <c> chỉ làm tay.
Kiểm dọn: số bản ghi test trước và sau khi chạy suite bằng nhau, kể cả khi test đỏ."
```

---

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Tiền điều kiện** | Trạng thái phải có sẵn trước khi bước 1 của case bắt đầu |
| **Factory** | Hàm tạo dữ liệu qua đúng đường app dùng, chứ không ghi thẳng vào database |
| **Bug ma** | Bug bạn tưởng là thật, nhưng nó chỉ xuất hiện vì bạn dựng dữ liệu sai cách |

## Cây thư mục sau bài này

```
kit-cua-toi/tests/support/
├── factory.js                    ← MỚI · tạo dữ liệu qua API, prefix "IT test" + mã task
├── fixtures/
│   └── donHang.js                ← MỚI · dựng trước test, dọn sau test
└── janitor.js                    ← MỚI · dọn rác còn sót, 3 lớp an toàn
```

Cả ba file nằm ở `tests/support/`, không ở `scripts/qa/`: chúng không tự chạy được và không chặn gì —
chúng là hạ tầng test. Câu hỏi phân loại ở Bài 1 vẫn dùng được.

## Bộ kit của bạn đang ở đâu

```
CẤP ĐỘ 2 · BUILD      bài 4/7 của cấp độ này
████████████████░░░░░░░░░░░░

cả tài liệu           bài 8/29
████████░░░░░░░░░░░░░░░░░░░░
```

**Hết cấp độ 2 bạn nói được:** Tôi có một Test Kit.

Cấp độ này còn 3 bài nữa.

## Tự kiểm

- [ ] 3 test của tôi **không còn** mã dữ liệu gán cứng; chúng dựng dữ liệu bằng fixture.
- [ ] Mọi dữ liệu factory tạo ra mang tiền tố nhận diện được và có `MA_TASK`.
- [ ] Lỗi dựng ném ra có chữ `SETUP:` để Bài 17 phân loại được.
- [ ] Hàm `don()` **không throw** — dọn lỗi không làm test đỏ.
- [ ] Tôi đã đếm bản ghi trước và sau khi chạy suite, và hai số bằng nhau.
- [ ] Tôi đã thử ca test đỏ, và phần dọn **vẫn chạy**.
- [ ] Hợp đồng tiền điều kiện của tôi có đủ bốn phần, gồm cả **verify**.
- [ ] Tôi phân biệt được `Cần hook` với `Chỉ làm tay`, và mỗi `Cần hook` ghi rõ endpoint cần.
- [ ] Tôi giải thích được **bug ma** bằng một ví dụ cụ thể của dự án mình.
- [ ] Janitor của tôi có ba lớp an toàn: tiền tố · tuổi · xem trước.

## Bài tập về nhà

Tìm trong suite hoặc trong bộ testcase của dự án bạn một chỗ đang dựng dữ liệu bằng câu lệnh database
(hoặc bằng cách sửa tay trong công cụ quản trị). Với chỗ đó, trả lời:

1. Trạng thái đó có thể xảy ra qua luồng ứng dụng thật không?
2. Nếu có, dựng qua API cần những bước nào?
3. Nếu không, thì test đó đang kiểm một trạng thái không tồn tại. Nó còn nghĩa gì?

Câu 3 là câu khó và cũng là câu đáng giá nhất.

## Đọc thêm

- Bài 17 sẽ dùng chữ `SETUP:` trong lỗi factory để phân loại `setup_failure`, loại không log Jira.
- [`tests/support/setup/`](../../tests/support/setup/) của kit này, setup layer đầy đủ, gồm cả guarded client
  chỉ-đọc cho database.

## Bài sau

Bài 9 quay lại một chuyện đã âm ỉ từ Bài 4: test đỏ vì không tìm thấy element, chứ không phải vì sản
phẩm sai. Sửa xong hôm nay, tuần sau gãy chỗ khác.
