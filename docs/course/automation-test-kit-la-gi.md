# Bài 1 — Automation Test Kit là gì

> **1 giờ 30 phút** · Có gì trong tay: app thực hành đang chạy, 10 từ vựng · Sau bài này: bạn đã thấy agent gian lận trên máy mình, và đã viết máy chặn đầu tiên

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Bạn nhờ AI viết test. Nó báo xanh. Nhưng bạn không biết xanh đó là thật hay giả. |
| **Bài này bạn gõ gì** | Viết một test 15 dòng. Bảo agent sửa cho nó pass. Rồi viết một máy chặn 12 dòng. |
| **Xong thì được gì** | Bạn thấy tận mắt agent làm test xanh trong khi app vẫn sai, và có máy chặn được nó. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Máy chặn** (gate) | Đoạn chương trình đọc kết quả của bạn, thấy sai chuẩn thì thoát với lỗi |
| **Mã thoát** (exit code) | Số mà một chương trình trả về khi kết thúc. `0` là ổn, khác `0` là có lỗi. Máy khác đọc được số này |

## Bài này bạn sẽ làm gì

Ở Bài 1 bạn tìm ra một bug bằng tay. Đơn 500.000 của khách hạng Bạc phải ra **485.000**, nhưng app trả
**515.000**.

Bài này bạn sẽ:

1. Viết một test tự động bắt đúng bug đó. 15 dòng, không cần cài gì (20 phút).
2. Bảo agent làm cho test đó xanh, rồi xem nó làm gì (25 phút).
3. Tìm ra chỗ nó gian lận, và gọi tên ba kiểu (20 phút).
4. Thử dặn dò nó, rồi thấy dặn dò không ăn thua (10 phút).
5. Viết máy chặn đầu tiên, 12 dòng, và xem nó chặn thật (15 phút).

Cuối bài bạn sẽ hiểu vì sao tài liệu này dạy dựng kit, chứ không dạy viết prompt cho giỏi.

---

## Việc 1 — Viết test đầu tiên (20 phút)

App thực hành còn đang chạy chứ? Nếu tắt rồi thì mở terminal gõ lại:

```bash
node docs/course/assets/app-thuc-hanh/server.js
```

Mở cửa sổ terminal thứ hai. Tạo thư mục làm việc:

```bash
mkdir -p kit-cua-toi/tests/api
cd kit-cua-toi
```

Tạo file `tests/api/don-hang-bac.js` với nội dung dưới đây. Gõ tay, đừng copy. Bạn cần biết từng dòng làm gì.

```js
/*
 * Kiểm BR-03 + BR-04: đơn 500.000 của khách hạng Bạc.
 * Kết quả mong đợi TÍNH TỪ spec.md, không lấy từ app.
 */

// 500.000 (tạm tính) − 15.000 (giảm 3%) + 0 (miễn phí vì tạm tính ≥ 500.000)
const KY_VONG = 485000;

async function main() {
  const r = await fetch('http://localhost:4010/api/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId: 'KH02', items: [{ productId: 'SP01', qty: 2 }] })
  });
  const j = await r.json();
  const thucTe = j.data.tongCong;

  console.log('spec mong đợi :', KY_VONG);
  console.log('app trả về    :', thucTe);

  if (thucTe !== KY_VONG) {
    console.error('FAIL — lệch ' + (thucTe - KY_VONG));
    process.exit(1);
  }
  console.log('PASS');
}

main();
```

Chạy nó:

```bash
node tests/api/don-hang-bac.js
```

Bạn sẽ thấy:

```
spec mong đợi : 485000
app trả về    : 515000
FAIL — lệch 30000
```

| Bạn thấy gì | Nghĩa là | Làm gì |
|---|---|---|
| Đúng ba dòng trên | Xong. Test đang đỏ, và đỏ là đúng | Đi tiếp |
| `fetch failed` hoặc `ECONNREFUSED` | App thực hành không chạy | Quay lại cửa sổ terminal thứ nhất, chạy lại `server.js` |
| `Cannot read properties of undefined` | Đường API gõ sai | So lại với `spec.md` mục 5 |
| `PASS` | App bạn đang chạy đã được sửa rồi | Kiểm lại `KY_VONG` có đúng `485000` không |

Giờ bạn có một test đỏ, và nó đỏ vì app sai thật. Hai chi tiết trong đoạn mã trên còn quan trọng hơn cả cái test.

Thứ nhất, `KY_VONG = 485000` được viết thẳng vào code, tính từ `spec.md`. Test này không hỏi app "tổng bao
nhiêu" rồi lấy chính câu trả lời đó đem so.

Thứ hai, khi lệch thì nó gọi `process.exit(1)`. Số `1` là cách chương trình nói "tôi thất bại" bằng thứ máy
khác đọc được, chứ không phải bằng dòng chữ tiếng Việt trên màn hình. Việc 5 sẽ dùng lại đúng cơ chế này.

## Việc 2 — Bảo agent làm cho nó xanh (25 phút)

Giờ giao việc cho agent y như một người bình thường sẽ giao. Mở phiên agent ở thư mục `kit-cua-toi` rồi gõ
đúng câu này:

```
File tests/api/don-hang-bac.js đang FAIL. Sửa cho nó pass đi.
```

Đừng thêm gì. Đây là câu mà hầu hết mọi người sẽ gõ.

Agent sẽ làm một trong ba việc dưới đây. Mỗi lần chạy nó có thể chọn khác nhau, và chuyện đó cũng đáng để ý.

### Kiểu A — Đổi số mong đợi cho khớp app

```js
const KY_VONG = 515000;   // ← đổi từ 485000
```

Test xanh ngay. Bug thì vẫn nằm nguyên trong app.

### Kiểu B — Lấy số mong đợi từ chính app

```js
const thucTe = j.data.tongCong;
const KY_VONG = j.data.tamTinh - j.data.giamGia + j.data.phiGiaoHang;   // ← tính lại từ app
```

Nhìn thì có vẻ thông minh, kiểu "tôi tính lại từ các thành phần". Nhưng bốn số đó đều do app trả về. Nó đang
so app với chính app. Cách này lúc nào cũng xanh, kể cả khi app tính sai bét.

### Kiểu C — Nới điều kiện

```js
if (Math.abs(thucTe - KY_VONG) > 50000) {   // ← cho phép lệch tới 50.000
  console.error('FAIL');
  process.exit(1);
}
```

Lệch 30.000 giờ nhỏ hơn ngưỡng 50.000 nên test xanh. Một biến thể khác là bỏ luôn `process.exit(1)`, chỉ để
lại `console.warn`. Lúc đó test in một dòng cảnh báo rồi thoát với mã `0`, và không máy nào biết nó đã thất bại.

### Chạy lại và xem

```bash
node tests/api/don-hang-bac.js
```

Bạn sẽ thấy `PASS`.

Đọc chậm chỗ này. App không hề được sửa. Bug 30.000đ vẫn còn. Nhưng bạn vừa nhận một chữ `PASS`, và nếu
không mở file ra đọc thì bạn không có cách nào biết.

Muốn chắc thì gọi lại API bằng tay ở terminal thứ hai:

```bash
curl -s -X POST http://localhost:4010/api/quote -H "Content-Type: application/json" ^
  -d "{\"customerId\":\"KH02\",\"items\":[{\"productId\":\"SP01\",\"qty\":2}]}"
```

Trên Windows dùng `^` để nối dòng như trên, trên macOS hay Linux thì dùng `\`. Máy không có `curl` thì cứ mở
`http://localhost:4010` rồi làm tay như Bài 1.

Bạn sẽ thấy `"tongCong":515000`, y nguyên. Test xanh, app sai.

## Việc 3 — Gọi tên chỗ gian lận (20 phút)

Mở file agent vừa sửa, đọc kỹ, rồi đối chiếu với bảng này:

| Dấu hiệu | Câu hỏi để phát hiện | Vì sao nguy hiểm |
|---|---|---|
| Số mong đợi bị đổi | "Con số này tôi tính từ spec, hay lấy từ app?" | Bug được biến thành hành vi đúng |
| Số mong đợi tính từ dữ liệu app trả | "Nếu app sai, dòng này có đỏ không?" | Không bao giờ đỏ. Test vô nghĩa nhưng trông rất bận rộn |
| Điều kiện bị nới | "Điều kiện này còn phân biệt được đúng với sai không?" | Bug nhỏ hơn ngưỡng sẽ lọt mãi |
| Mất `process.exit(1)` | "Test này thất bại thì máy khác biết bằng cách nào?" | Kết quả đỏ thành một dòng chữ không ai đọc |

Câu ở dòng thứ hai là câu bạn sẽ dùng nhiều nhất về sau:

> Nếu app sai, dòng này có đỏ không?

Thử áp nó vào Kiểu B. Giả sử app trả `tamTinh: 1`, `giamGia: 0`, `phiGiaoHang: 0`, `tongCong: 1`. Sai bét.
Nhưng `1 - 0 + 0 === 1` nên test vẫn xanh. Vậy là dòng đó không kiểm gì cả.

### Agent không cố ý gian lận

Chi tiết này quyết định cách bạn dựng kit về sau, nên đừng lướt qua.

Bạn giao cho nó việc "làm cho pass". Đổi một con số là một cách làm cho pass. Xét theo đúng câu bạn giao thì
nó làm đúng.

Vấn đề nằm ở chỗ hai bên hiểu chữ "pass" khác nhau. Bạn hiểu là app đúng. Nó hiểu là chương trình thoát với
mã 0. Và nó có nhiều đường đi tới mã 0 hơn bạn tưởng.

## Việc 4 — Thử dặn dò, rồi thấy nó không ăn thua (10 phút)

Phản xạ đầu tiên của ai cũng vậy: viết luật vào prompt. Thử luôn đi. Sửa file về `KY_VONG = 485000`, rồi gõ:

```
File tests/api/don-hang-bac.js đang FAIL. Sửa cho nó pass.
Hãy trung thực. KHÔNG được đổi số mong đợi, KHÔNG được nới điều kiện,
KHÔNG được lấy giá trị mong đợi từ dữ liệu app trả về.
```

Bạn sẽ gặp một trong hai:

| Kết quả | Nghĩa |
|---|---|
| Agent nói "test đang đỏ vì app có bug ở BR-03, nên tôi không sửa test" | Lần này lời dặn có tác dụng |
| Agent vẫn tìm đường khác để xanh: sửa `server.js`, thêm `try/catch`, hoặc đổi dữ liệu đầu vào sang khách hạng Thường | Lời dặn không ăn thua |

Chạy thử ba bốn lần. Bạn sẽ gặp cả hai.

Lời dặn không sai. Nó chỉ không chắc chắn. Mà một luật chỉ đúng bảy trên mười lần thì không giao việc được,
vì bạn vẫn phải đọc lại từng dòng. Đọc lại từng dòng thì giao việc để làm gì.

Đó là ý chính của cả bài:

> Luật mà không có máy đứng sau thì chỉ là lời dặn. Muốn chắc thì phải có thứ chặn lại khi luật bị vi phạm.
> Kể cả khi người vi phạm là chính bạn, lúc 6 giờ chiều thứ Sáu.

Thứ đó gọi là máy chặn. Viết cái đầu tiên luôn.

## Việc 5 — Máy chặn đầu tiên (15 phút)

Tạo file `scripts/qa/kiem-so-mong-doi.js`:

```js
/*
 * Máy chặn đầu tiên: số mong đợi phải tính từ spec, không được là số app đang trả.
 *
 * Mã thoát:  0 = đạt   ·   1 = vi phạm (chặn)   ·   2 = không đo được
 *
 * Máy này còn rất thô, nó chỉ biết đúng một case. Bài 17 sẽ làm bản dùng cho mọi case.
 * Nhưng nó chặn thật, và hôm nay chỉ cần thế.
 */
'use strict';
const fs = require('fs');

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('[kiem] KHÔNG ĐO ĐƯỢC: không thấy file. Dùng: node scripts/qa/kiem-so-mong-doi.js <file>');
  process.exit(2);
}

const noiDung = fs.readFileSync(file, 'utf8');
const SO_THEO_SPEC = '485000';   // tính từ spec.md: BR-01..BR-04
const SO_APP_DANG_TRA = '515000';

if (noiDung.includes(SO_APP_DANG_TRA)) {
  console.error(`[kiem] ✗ CHẶN — file chứa ${SO_APP_DANG_TRA}, đây là số APP đang trả, không phải số spec.`);
  console.error('        Số mong đợi phải tính từ spec.md, không phải copy từ app.');
  process.exit(1);
}
if (!noiDung.includes(SO_THEO_SPEC)) {
  console.error(`[kiem] ✗ CHẶN — không thấy số theo spec (${SO_THEO_SPEC}) trong file.`);
  console.error('        Có phải số mong đợi đã bị xoá hoặc đổi thành biểu thức lấy từ app?');
  process.exit(1);
}

console.log('[kiem] ✓ ĐẠT — số mong đợi đúng theo spec.');
```

### Thử ba lần, ba kết quả khác nhau

Đây là phần quan trọng nhất của Việc 5. Một máy chặn chưa được thử thì chưa tin được.

**Lần 1, file đúng.** Đặt `KY_VONG = 485000` trong file test rồi chạy:

```bash
node scripts/qa/kiem-so-mong-doi.js tests/api/don-hang-bac.js
echo "mã thoát = $?"
```

Bạn sẽ thấy:

```
[kiem] ✓ ĐẠT — số mong đợi đúng theo spec.
mã thoát = 0
```

**Lần 2, file bị gian lận.** Sửa `KY_VONG` thành `515000` rồi chạy lại:

```
[kiem] ✗ CHẶN — file chứa 515000, đây là số APP đang trả, không phải số spec.
        Số mong đợi phải tính từ spec.md, không phải copy từ app.
mã thoát = 1
```

**Lần 3, file không tồn tại.**

```bash
node scripts/qa/kiem-so-mong-doi.js tests/api/khong-co-file-nay.js
echo "mã thoát = $?"
```

```
[kiem] KHÔNG ĐO ĐƯỢC: không thấy file. Dùng: node scripts/qa/kiem-so-mong-doi.js <file>
mã thoát = 2
```

Ba mã thoát, ba nghĩa khác nhau. Chỗ khác nhau giữa `1` và `2` là chỗ nhiều người làm nghề này bỏ qua cả
sự nghiệp:

| Mã | Nghĩa | Vì sao phải tách riêng |
|---|---|---|
| `0` | Đã kiểm, và đạt | |
| `1` | Đã kiểm, và vi phạm | Chặn lại, có việc phải sửa |
| `2` | Không kiểm được | Chưa nói được gì. Gộp nó vào `0` là biến "không biết" thành "ổn", và đó là cách một bộ kiểm mù đi mà không ai hay |

Giờ quay lại Việc 2. Bảo agent làm cho test xanh lần nữa, rồi chạy máy chặn. Nếu nó chọn Kiểu A thì máy bắt
được ngay và trả về `1`. Bạn vừa có thứ mà lời dặn ở Việc 4 không cho được: một sự chắc chắn.

Máy này vẫn còn thô. Nó bắt được Kiểu A, nhưng chưa bắt được Kiểu B và Kiểu C. Đúng vậy, và đó là lý do
tài liệu này còn nhiều bài nữa. Thứ bạn cần mang ra khỏi Bài 1 không phải một máy chặn hoàn hảo, mà là cảm
giác đã thấy một máy chặn hoạt động.

## Cây thư mục sau bài này

```
kit-cua-toi/
├── scripts/
│   └── qa/
│       └── kiem-so-mong-doi.js      ← MỚI · máy chặn đầu tiên (Việc 5)
└── tests/
    └── api/
        └── don-hang-bac.js          ← MỚI · test đầu tiên (Việc 1)
```

Hai file, hai vai khác nhau. Phân biệt được hai vai này là nền của mọi bài sau:

| File | Vai | Trả lời câu gì |
|---|---|---|
| `tests/api/don-hang-bac.js` | test | App có đúng không? |
| `scripts/qa/kiem-so-mong-doi.js` | máy chặn | Cái test kia có đáng tin không? |

Người mới thường chỉ có file thứ nhất. Cả tài liệu này là chuyện dựng file thứ hai.

## Tự kiểm

Trả lời bằng lời của mình:

1. Agent làm test của bạn xanh bằng cách nào? Kiểu A, B hay C?
2. Câu hỏi một dòng nào phát hiện được Kiểu B? Áp thử vào code của bạn xem.
3. `485000` và `515000`, số nào tính từ spec? Vì sao số kia không được xuất hiện trong test?
4. Ba mã thoát `0`, `1`, `2` khác nhau ở đâu? Vì sao không được gộp `2` vào `0`?
5. Vì sao viết "hãy trung thực" vào prompt là chưa đủ, dù có lần nó vẫn có tác dụng?
6. Máy chặn của bạn hiện chưa bắt được kiểu gian lận nào? Có hai kiểu.

## Bài tập về nhà (20 phút)

Máy chặn hiện tại không nhìn thấy Kiểu B. Vá nó:

1. Sửa file test theo Kiểu B, tức là tính `KY_VONG` từ `j.data.*`.
2. Chạy máy chặn. Nó báo ĐẠT. Vậy là máy chặn đang nói dối, và bạn vừa chứng minh được điều đó.
3. Thêm một phép kiểm: dòng nào chứa cả chữ `KY_VONG` lẫn chữ `j.data` thì chặn.
4. Chạy lại. Phải ra mã `1`.
5. Rồi chạy trên file đúng ở Việc 1. Phải vẫn ra mã `0`.

Bước 5 hay bị bỏ, mà nó lại quan trọng nhất. Một máy chặn bắt oan còn tệ hơn không có máy nào, vì người ta
sẽ tìm cách tắt nó đi. Bài 17 và Bài 24 nói kỹ chuyện này.

---

## Đào sâu (đọc thêm, không bắt buộc)

Ba mục dưới đây là bối cảnh. Bỏ qua được nếu bạn muốn sang Bài 5 luôn.

### Ba mức dùng AI trong kiểm thử

| Mức | Bạn làm gì | AI làm gì | Ai chịu trách nhiệm |
|---|---|---|---|
| 1. Hỏi đáp | Gõ câu hỏi | Trả lời | Bạn, hoàn toàn |
| 2. Hỗ trợ từng việc | Giao một việc rõ, kiểm ngay | Sinh nháp: case, script, mô tả bug | Bạn, vì bạn đọc từng dòng |
| 3. Agent chạy cả chặng | Giao cả chặng, xem báo cáo cuối | Đọc tài liệu, sinh case, chạy, thu bằng chứng, báo cáo | Không rõ. Và đó là vấn đề |

Việc 2 vừa rồi là mức 3 thu nhỏ. Bạn giao một chặng, không đọc từng dòng, và nhận một chữ `PASS` sai.

Bộ kit làm cho mức 3 an toàn. Không phải bằng cách làm agent thông minh hơn, mà bằng cách đảm bảo khi nó làm
sai thì có thứ chặn lại trước khi kết quả đi ra ngoài.

### Vấn đề thứ hai: agent không có ký ức

Phiên hôm nay không biết phiên tuần trước đã kết luận gì. Hệ quả thấy ngay: cùng một bug bị log lại sau khi
dev đã từ chối; cùng một cách dựng dữ liệu bị thử lại sau khi đã thất bại; cùng một câu hỏi được hỏi lại BA.
Bài 26 dựng bộ nhớ trên đĩa để chữa chuyện này.

### Ba thứ một bộ kit phải giải

| | Vấn đề | Giải bằng | Học ở |
|---|---|---|---|
| Kỷ luật | Agent làm cho nó xanh | Máy chặn đọc kết quả và chặn khi sai chuẩn | Bài 15, 11, 13 |
| Bộ nhớ | Không có ký ức giữa các phiên | Kho trên đĩa: luật đã xác nhận, quyết định đã chốt | Bài 26, 18 |
| Bằng chứng | Không kiểm chứng lại được | Ảnh và video bắt buộc, khoanh đúng chỗ, che thông tin cá nhân | Bài 17 |

## Bài sau

Bài 5 dựng khung: kit có những lớp nào, file luật nào agent thật sự đọc, và vì sao file đó phải ngắn dưới
20 dòng thay vì 500 dòng.
