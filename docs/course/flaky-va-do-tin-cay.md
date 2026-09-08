# Bài 25 — Bộ test của bạn đáng tin đến mức nào?

> **3 giờ 30 phút** · Có gì trong tay: bộ test khá lớn, thỉnh thoảng đỏ không rõ lý do · Sau bài này: đo được suite của bạn lệ thuộc retry bao nhiêu, và biết vì sao dọn flaky có thể chôn bug thật

**Vấn đề**

Báo cáo tuần ghi: **98% pass**.

Con số đó nghĩa là sản phẩm tốt, hay nghĩa là bộ test đã chạy lại nhiều lần?

Bạn không biết, vì báo cáo gộp "xanh ngay lần đầu" và "xanh ở lần thứ ba" thành cùng một chữ Pass.

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Báo cáo ghi 98% pass. Con số đó không cho biết app tốt hay chỉ do chạy lại nhiều lần. |
| **Bài này bạn gõ gì** | Tính hai loại tỉ lệ pass, đo khoảng cách giữa chúng, rồi chấm điểm tin cậy từng test. |
| **Xong thì được gì** | Biết suite phụ thuộc vào việc chạy lại đến mức nào, và không chôn nhầm bug thật. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Năm việc:

1. Tính hai đường tỉ lệ, và đọc **khoảng cách** giữa chúng (25 phút).
2. Tính độ tin cậy từng test, xếp hạng, quyết định quarantine (25 phút).
3. Hiểu vì sao dọn flaky có thể chôn bug thật, và cách phân biệt (20 phút).
4. Ba luật liêm chính của phép đo. Không có chúng thì mọi con số trên là trang trí (20 phút).
5. **Thực hành:** tiêm lỗi vào phản hồi API, rồi đếm xem suite có đỏ không (60 phút).

---

## Việc 1 — Hai đường, và khoảng cách giữa chúng (25 phút)

Báo cáo của bạn nói *"98% pass"*. Câu đó thiếu một nửa thông tin: 98% đó là ngay lượt đầu, hay sau khi
chạy lại ba lần?

| Chỉ số | Đo gì | Nói lên điều gì |
|---|---|---|
| **Clean pass rate** | xanh ngay lượt đầu | chất lượng thật của app + suite |
| **Eventual pass rate** | xanh **sau retry** | thứ báo cáo hay khoe |
| **Khoảng cách** | eventual − clean | **mức lệ thuộc retry** |

Khoảng cách là số quan trọng nhất, và không ai báo cáo nó:

| Khoảng cách | Nghĩa |
|---|---|
| ~0% | suite ổn định. Xanh nghĩa là xanh |
| 5–10% | có mấy test chập chờn. Còn kiểm soát được |
| **>15%** | **retry đang che một thứ gì đó** — hoặc suite hỏng, hoặc app thật sự không ổn định |

Trường hợp cuối nguy hiểm vì nó trông giống trường hợp tốt: cả hai đều cho báo cáo xanh.

```js
#!/usr/bin/env node
/*
 * do-metrics.js — tính clean pass rate, eventual pass rate, và KHOẢNG CÁCH giữa hai đường.
 *
 * VÌ SAO KHOẢNG CÁCH LÀ SỐ CHÍNH: "98% pass" không phân biệt được "app tốt" với "retry đang che".
 * Hai chuyện đó cho cùng một con số, và chỉ khoảng cách tách được chúng.
 *
 * ĐẦU VÀO: results.json của Playwright — mỗi test có mảng results, MỖI LƯỢT CHẠY LẠI là một phần tử.
 * Mã thoát: 0 = trong ngưỡng · 1 = khoảng cách vượt ngưỡng · 2 = không đo được
 */
'use strict';
const fs = require('fs');

const NGUONG_KHOANG_CACH = Number(process.env.METRICS_GAP_MAX || 0.15);

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Dùng: node scripts/qa/do-metrics.js <test-results/results.json>');
  process.exit(2);
}
let bao;
try { bao = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error('[metrics] KHÔNG ĐO ĐƯỢC: JSON hỏng — ' + e.message); process.exit(2); }

/** Duyệt cây suite của Playwright, gom mọi test kèm danh sách lượt chạy. */
function gom(suites, ra) {
  for (const s of suites || []) {
    for (const sp of s.specs || []) {
      for (const t of sp.tests || []) ra.push({ ten: sp.title, luot: t.results || [] });
    }
    gom(s.suites, ra);
  }
  return ra;
}
const ds = gom(bao.suites, []);

/* Bỏ test SKIPPED khỏi mẫu số. Test không chạy thì nó không nói gì về độ ổn định —
   tính nó vào là làm loãng cả hai đường. */
const chay = ds.filter((t) => t.luot.length && t.luot.some((r) => r.status !== 'skipped'));
if (!chay.length) {
  console.error('[metrics] KHÔNG ĐO ĐƯỢC: 0 test thực sự chạy (tất cả skipped?)');
  process.exit(2);
}

const xanhNgay = chay.filter((t) => t.luot[0] && t.luot[0].status === 'passed');
const xanhCuoi = chay.filter((t) => {
  const c = t.luot[t.luot.length - 1];
  return c && c.status === 'passed';
});
const canRetry = chay.filter((t) => t.luot.length > 1);

const clean = xanhNgay.length / chay.length;
const eventual = xanhCuoi.length / chay.length;
const gap = eventual - clean;
const pc = (x) => (x * 100).toFixed(1) + '%';

console.log(`[metrics] ${chay.length} test đã chạy`);
console.log(`  clean pass rate    : ${pc(clean)}   (${xanhNgay.length}/${chay.length} xanh NGAY lượt đầu)`);
console.log(`  eventual pass rate : ${pc(eventual)}   (${xanhCuoi.length}/${chay.length} xanh sau retry)`);
console.log(`  KHOẢNG CÁCH        : ${pc(gap)}   ← mức lệ thuộc retry`);
console.log(`  ${canRetry.length} test phải chạy lại ít nhất một lần`);

if (canRetry.length) {
  console.log('\n  Test phải chạy lại:');
  for (const t of canRetry.slice(0, 15)) {
    const chuoi = t.luot.map((r) => (r.status === 'passed' ? '✓' : '✗')).join('');
    console.log(`    ${chuoi.padEnd(6)} ${t.ten}`);
  }
}

if (gap > NGUONG_KHOANG_CACH) {
  console.error(`\n[metrics] ✗ khoảng cách ${pc(gap)} vượt ngưỡng ${pc(NGUONG_KHOANG_CACH)}.`);
  console.error('  Retry đang CHE một thứ gì đó. Trước khi tin báo cáo xanh, trả lời:');
  console.error('   - test chập chờn vì chờ sai (locator/thời gian)?  ⇒ sửa test');
  console.error('   - hay vì APP thật sự không ổn định?               ⇒ đó là BUG, đừng dọn nó đi');
  process.exit(1);
}
console.log('\n[metrics] ✓ khoảng cách trong ngưỡng.');
```

Chạy trên lượt chạy gần nhất:

```bash
node scripts/qa/do-metrics.js test-results/results.json
```

**Bạn sẽ thấy** ba con số và danh sách test phải chạy lại, kèm chuỗi kết quả của từng test, `✗✓` nghĩa
là đỏ rồi xanh, `✗✗✓` là đỏ hai lần mới xanh.

Chuỗi đó là dữ liệu, không phải trang trí: `✗✓` lặp lại ở cùng một test qua nhiều lượt là dấu hiệu rất khác
với `✗✓` xuất hiện một lần.

## Việc 2 — Độ tin cậy từng test và quarantine (25 phút)

Tỉ lệ toàn bộ suite không nói test **nào** yếu. Cần điểm theo từng test, tích luỹ qua nhiều lượt.

`knowledge/reliability/<tên-test>.json`:

```json
{
  "test": "tao-don.spec.js > tính tổng cộng khách hạng Bạc",
  "soLuot": 40,
  "xanhNgay": 31,
  "xanhSauRetry": 38,
  "doTinCay": 0.775,
  "hang": "chap-chon",
  "lanCuoi": "2026-09-08",
  "ghiChu": "hay đỏ ở lượt đầu sau khi deploy — nghi app chậm ấm máy, chưa xác nhận"
}
```

`doTinCay` = `xanhNgay ÷ soLuot`. Xếp hạng:

| Hạng | Độ tin cậy | Làm gì |
|---|---|---|
| `on-dinh` | ≥ 0.95 | dùng bình thường |
| `can-de-y` | 0.80 – 0.95 | ghi chú, xem lại khi rảnh |
| `chap-chon` | 0.50 – 0.80 | **phải điều tra**, chưa quarantine |
| `khong-tin-duoc` | < 0.50 | **quarantine** |

### Quarantine không phải là xoá

| | Quarantine | Xoá |
|---|---|---|
| Test còn chạy không | **có** — ở luồng riêng, không chặn ai | không |
| Kết quả có tính vào cổng chặn không | **không** | — |
| Còn thấy nó không | **có** — nằm trong báo cáo, có nhãn | không |
| Ai đó sẽ quay lại sửa không | có, vì nó còn hiện | **không** |

> Xoá một test chập chờn là cách rẻ nhất để mất luôn phần phủ mà nó đang giữ, và không ai biết phần đó
> đã mất. Quarantine giữ lại tín hiệu "chỗ này chưa được canh".

Và một luật đi kèm:

> Quarantine phải có hạn. Không hạn thì nó thành nghĩa địa. Đặt 30 ngày: quá hạn mà chưa ai điều tra thì
> báo cáo nêu tên nó lên, mỗi lượt.

## Việc 3 — Dọn flaky có thể chôn bug thật (20 phút)

Đây là mục quan trọng nhất của bài.

Một test đỏ lượt đầu, xanh lượt sau. Phản xạ: *"flaky, chạy lại là xong"*. Nhưng có **hai** nguyên nhân cho
cùng một hiện tượng:

| Nguyên nhân | Bản chất | Đúng ra phải làm |
|---|---|---|
| Test chờ sai — bấm trước khi element hiện xong | lỗi **test** | sửa test |
| **App thật sự chậm/không ổn định** ở lần gọi đầu | **bug sản phẩm** | **log bug** |

Retry làm cả hai cùng chuyển xanh. Nên "dọn flaky" theo phản xạ sẽ **chôn** nguyên nhân thứ hai, và nó
thường là bug hiệu năng hoặc race condition, tức loại bug đắt nhất.

### Bốn dấu hiệu phân biệt

| Dấu hiệu | Nghiêng về **lỗi test** | Nghiêng về **bug app** |
|---|---|---|
| Đỏ ở đâu | luôn cùng một dòng assert/locator | rải rác nhiều chỗ |
| Thông báo lỗi | `locator not found`, `timeout waiting for` | lỗi từ **response** — 5xx, dữ liệu thiếu, số sai |
| Khi nào hay đỏ | ngẫu nhiên | **có quy luật** — ngay sau deploy, giờ cao điểm, lượt chạy song song |
| Chạy chậm lại thì sao | hết đỏ | **vẫn đỏ** |

Dòng cuối là phép thử rẻ nhất và ít ai làm:

> Chạy lại một mình, tuần tự, không song song. Vẫn đỏ ⇒ không phải flaky. Đó là bug, hoặc dữ liệu.

### Đưa vào quy trình, không để thành lời dặn

Trước khi gắn nhãn `flaky` cho bất cứ test nào, bắt buộc ghi:

```json
{
  "test": "tao-don.spec.js > tính tổng cộng khách hạng Bạc",
  "nhan": "flaky",
  "daThu": {
    "chayMotMinhTuanTu": "xanh 5/5 lượt",
    "loiHayGap": "timeout waiting for [data-testid=tong-cong]",
    "coQuyLuatTheoThoiDiem": false
  },
  "ketLuan": "lỗi test — chờ sai, phải chờ giá trị KHÁC '—' thay vì chờ element xuất hiện",
  "nguoiKetLuan": "QA Minh, 08/09/2026"
}
```

Không điền được `daThu` thì chưa được gắn nhãn flaky. Đây là cách biến một phản xạ thành một bước có
bằng chứng, cùng cơ chế với `tangLoi` ở Bài 17.

## Việc 4 — Ba luật liêm chính của phép đo (20 phút)

Mọi con số trên chỉ có nghĩa nếu ba luật sau đúng. Thiếu một là số đẹp mà rỗng.

### Luật 1 — `forbidOnly` phải bật ở CI

`test.only` lọt vào nhánh chính thì runner chỉ chạy một test và báo **xanh**. Clean pass rate `100%` với
mẫu số bằng 1.

```js
// playwright.config.js
module.exports = {
  // Có test.only trong mã ⇒ CI ĐỎ. Không có dòng này thì "100% pass" có thể là 1/1.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0
};
```

`retries: 0` ở máy cá nhân là cố ý: bạn cần **thấy** test chập chờn khi phát triển, thay vì để retry giấu nó.

### Luật 2 — bỏ `skipped` khỏi mẫu số

Test bị skip không nói gì về độ ổn định. Tính nó vào là làm loãng cả hai đường, và tệ hơn: skip thêm test là
cách làm đẹp số mà không sửa gì. `do-metrics.js` ở trên đã lọc.

### Luật 3 — độ phủ phải có ngưỡng tối thiểu cho **mỗi** chiều

"Phủ 20/danh mục chiều" nghe rất tốt cho tới khi bạn thấy 12 chiều có đúng một case. Ngưỡng phải theo từng
chiều, không phải tổng (Bài 14).

### Và một câu chốt

> Metrics không phải để khoe. Nó để trả lời "tháng này bộ kiểm của tôi tốt lên hay xấu đi".

Nên số nào không đổi được hành động thì đừng đo. Ba số đáng theo hàng tháng:

| Số | Tụt thì nghĩa là |
|---|---|
| Mutation score (Bài 25) | có oracle vừa bị làm yếu đi |
| Khoảng cách clean ↔ eventual | suite đang lệ thuộc retry hơn |
| Số test hạng `chap-chon` trở xuống | nợ kỹ thuật đang tích |

## Việc 5 — Tiêm lỗi: đo chính bộ kiểm của bạn (60 phút)

Bốn việc trên đo **độ ổn định** của suite. Còn một câu chưa ai trả lời, và nó quan trọng hơn:

> Bộ test của bạn có thật sự bắt được bug không, hay nó chỉ đang chạy?

Một suite 500 case, xanh hết, chạy 40 phút mỗi đêm. Nghe rất tốt. Nhưng nếu sản phẩm hỏng thì nó có
đỏ không? Không ai biết, vì sản phẩm đang đúng nên chưa có cơ hội thử.

Cách trả lời là **cố tình làm hỏng, rồi đếm**.

### Cách làm: chặn phản hồi và đổi nó đi

Bạn không sửa source của sản phẩm. Bạn chặn ở giữa và đổi phản hồi trước khi test nhìn thấy nó.

```js
// tests/support/tiem-loi.js
'use strict';

/*
 * Mỗi "mutant" là MỘT lỗi cụ thể được tiêm vào phản hồi. Khai tường minh, không sinh ngẫu nhiên:
 * ngẫu nhiên thì lượt sau ra kết quả khác, và một phép đo không lặp lại được thì không so được
 * giữa hai sprint.
 */
const MUTANTS = {
  'giam-gia-bang-0':    (d) => ({ ...d, giamGia: 0 }),
  'phi-giao-hang-mien': (d) => ({ ...d, phiGiaoHang: 0 }),
  'tong-lech-1000':     (d) => ({ ...d, tongTien: d.tongTien + 1000 }),
  'thieu-truong':       (d) => { const x = { ...d }; delete x.giamGia; return x; },
  'trang-thai-sai':     (d) => ({ ...d, trangThai: 'CONFIRMED' }),
};

async function gan(page, tenMutant, duongDan) {
  const doi = MUTANTS[tenMutant];
  if (!doi) throw new Error('Không có mutant tên "' + tenMutant + '"');

  await page.route(duongDan, async (route) => {
    const res = await route.fetch();
    const goc = await res.json();
    await route.fulfill({ response: res, json: doi(goc) });
  });
}

module.exports = { MUTANTS, gan };
```

Rồi chạy cả suite một lần cho **mỗi** mutant:

```bash
for m in giam-gia-bang-0 phi-giao-hang-mien tong-lech-1000 thieu-truong trang-thai-sai; do
  MUTANT=$m npx playwright test --reporter=json > "outputs/mutant-$m.json" || true
done
```

**Bạn sẽ thấy** mỗi lượt mất đúng bằng một lượt chạy bình thường, nên năm mutant là năm lần thời
gian. Đó là lý do phép đo này chạy hằng tuần chứ không chạy mỗi lần push.

### Đọc kết quả

| Mutant | Suite có đỏ không | Nghĩa là |
|---|---|---|
| `giam-gia-bang-0` | ✓ đỏ | Có case kiểm giảm giá thật |
| `phi-giao-hang-mien` | ✓ đỏ | Có case kiểm phí giao hàng |
| `tong-lech-1000` | ✓ đỏ | Có case kiểm tổng |
| `thieu-truong` | ✗ **xanh** | Không case nào kiểm trường này có tồn tại hay không |
| `trang-thai-sai` | ✗ **xanh** | Không case nào kiểm trạng thái đơn |

Điểm số: **3/5**.

Con số đó là thứ bạn mang đi họp được. Nó khác hẳn câu *"tôi thấy bộ test khá đầy đủ"*, và nó chỉ
thẳng vào hai chỗ cần viết thêm case.

> Mutant nào cũng xanh thì đó là tin **xấu**, không phải tin tốt. Nó nghĩa là suite của bạn đang
> chạy qua chứ không đang kiểm.

### Ba cái bẫy

**Bẫy 1: mutant quá dễ.** Đổi phản hồi thành `null` thì mọi test đều đỏ, và điểm 5/5 không nói lên
gì. Mutant tốt là mutant **giống một bug thật**: lệch một chút, thiếu một trường, sai một trạng thái.

**Bẫy 2: đếm test đỏ thay vì đếm mutant bị bắt.** Một mutant làm đỏ 40 test cũng chỉ tính là **một**
mutant bị bắt. Đếm số test đỏ thì con số phồng lên theo kích thước suite chứ không theo chất lượng.

**Bẫy 3: chạy mutant trên môi trường có người khác dùng.** `page.route` chỉ chặn trong trình duyệt
của lượt chạy đó nên an toàn. Nhưng nếu bạn tiêm bằng cách sửa dữ liệu thật thì bạn vừa phá môi
trường của cả team.

### Dùng con số này thế nào

Đừng đặt ngưỡng ngay lần đầu. Đo, ghi lại, rồi lần sau so với chính nó:

```
Sprint 12: 3/5 mutant bị bắt
Sprint 13: 5/5 — đã thêm case cho trường thiếu và trạng thái đơn
```

Đây cùng một kỷ luật với Bài 23: chưa có ngưỡng thì so với lần đo trước của chính mình. Một con số
đi kèm lịch sử thì hành động được, còn một con số đứng một mình thì chỉ để ngắm.

Chi tiết đầy đủ, kèm cách khai `mutants.json` và cách gộp kết quả năm lượt chạy, nằm ở bài
[Đo chính bộ kiểm](do-chinh-bo-kiem.md).

---

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Clean pass rate** | Tỉ lệ case xanh ngay lượt đầu, không cần chạy lại |
| **Eventual pass rate** | Tỉ lệ case xanh sau khi đã chạy lại vài lần |
| **Reliability index** | Điểm tin cậy của **từng test**: nó xanh-ngay bao nhiêu phần trăm số lần |
| **Quarantine** | Tách một test ra khỏi luồng chính vì nó quá chập chờn — nhưng **không xoá** |

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   └── nguong-metrics.json           ← MỚI · ngưỡng khoảng cách + mốc xếp hạng độ tin cậy
├── scripts/qa/
│   ├── do-metrics.js                 ← MỚI · clean vs eventual + KHOẢNG CÁCH (exit 0/1/2)
│   └── do-tin-cay.js                 ← SỬA · thêm xếp hạng + hạn quarantine 30 ngày
└── knowledge/reliability/            ← MỚI · điểm tin cậy theo từng test; Bài 26 sẽ đưa cả thư mục này vào kỷ luật chung
    └── <ten-test>.json               ← MỚI · soLuot · xanhNgay · doTinCay · hang · daThu
```

## Bộ kit của bạn đang ở đâu

```
CẤP ĐỘ 4 · EVOLVE      bài 5/9 của cấp độ này
████████████████░░░░░░░░░░░░

cả tài liệu           bài 25/29
████████████████████████░░░░
```

**Hết cấp độ 4 bạn nói được:** Tôi mở rộng, đo được độ tin cậy, tích luỹ learning và chứng minh reuse.

Cấp độ này còn 4 bài nữa.

## Tự kiểm

1. Báo cáo nói "98% pass". Bạn cần hỏi thêm câu gì trước khi tin?
2. Khoảng cách clean ↔ eventual nói lên điều gì? Bao nhiêu là đáng lo?
3. Một test `✗✓`. Hai nguyên nhân có thể là gì? Phép thử **rẻ nhất** để phân biệt?
4. Vì sao quarantine không phải là xoá? Xoá thì mất gì mà không ai biết?
5. Vì sao quarantine phải có **hạn**?
6. `forbidOnly` không bật thì clean pass rate sai thế nào?
7. Vì sao bỏ `skipped` khỏi mẫu số? Không bỏ thì có cách "làm đẹp số" nào?
8. `retries: 0` ở máy cá nhân, vì sao là cố ý?

## Bài tập về nhà (25 phút)

1. Chạy `do-metrics.js` trên 5 lượt chạy gần nhất của bạn. Ghi khoảng cách từng lượt. Nó ổn định hay
   đang giãn ra?
2. Lấy test có chuỗi `✗✓` gần nhất. Chạy nó một mình, tuần tự 5 lần. Vẫn đỏ lần nào không?
   - Không đỏ lần nào ⇒ nhiều khả năng lỗi test. Sửa cách chờ.
   - **Có đỏ** ⇒ đừng gắn nhãn flaky. Đi tìm nguyên nhân ở app, bạn có thể đang cầm một bug thật.
3. Điền `daThu` cho mọi test đang mang nhãn flaky trong dự án bạn. Cái nào không điền nổi thì gỡ nhãn —
   nó chưa được chứng minh là flaky.

Bước 3 thường lộ ra vài test bị dán nhãn theo phản xạ, và trong số đó đôi khi có một bug thật đã nằm im
nhiều tháng.

## Đọc thêm

- Bài 25 — [mutation testing](do-chinh-bo-kiem.md): mutation run phải chạy `retries=0`, đúng lý do bài này.
- Bài 17 — [phân tầng lỗi](triage-va-rerun.md): pass-sau-retry là `PASS_WITH_DEVIATION`, không phải
  `PASS`.
- Bài 11 — dashboard: ba số ở cuối Việc 4 là ba đường cần vẽ, và chỉ ba đường đó.

## Bài sau

Bài 26 hỏi một câu mà bộ test nào cũng nên bị hỏi: đã chạy hàng trăm case qua nhiều sprint, nó học
được gì từ ngần ấy lượt chạy.
