# Bài 1 — Tự tay xem agent "làm cho nó xanh"

> **1 giờ 30 phút** · Có gì trong tay: app thực hành đang chạy, 10 từ vựng · Sau bài này: bạn đã thấy agent gian lận trên máy mình, và đã viết máy chặn đầu tiên

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Máy chặn** (gate) | Đoạn chương trình đọc kết quả của bạn và **thoát với lỗi** nếu sai chuẩn |
| **Mã thoát** (exit code) | Số một chương trình trả về khi kết thúc. `0` = ổn, khác `0` = có lỗi. Đây là thứ máy khác đọc được |

## Bài này bạn sẽ làm gì

Ở Bài 0 bạn tìm ra một bug bằng tay: đơn 500.000 của khách hạng Bạc phải ra **485.000** nhưng app trả
**515.000**.

Bài này bạn sẽ:

1. Viết một test tự động bắt đúng bug đó — bằng 15 dòng, không cần cài gì (20 phút).
2. **Bảo agent làm cho test đó xanh**, rồi xem nó làm gì (25 phút).
3. Tìm ra chỗ nó gian lận, và gọi tên 3 kiểu gian lận (20 phút).
4. Thử "dặn dò" nó và tự thấy dặn dò không có tác dụng (10 phút).
5. Viết **máy chặn đầu tiên** — 12 dòng — và xem nó chặn thật (15 phút).

Cuối bài bạn sẽ hiểu vì sao khoá này tên là "dựng bộ kit" chứ không phải "học prompt cho giỏi".

---

## Việc 1 — Viết test đầu tiên (20 phút)

Kiểm tra app thực hành vẫn đang chạy. Nếu tắt rồi, mở terminal và gõ:

```bash
node docs/course/assets/app-thuc-hanh/server.js
```

Mở **cửa sổ terminal thứ hai**. Tạo thư mục làm việc và một file:

```bash
mkdir -p kit-cua-toi/tests/api
cd kit-cua-toi
```

Tạo file `tests/api/don-hang-bac.js` với nội dung sau. Gõ tay, đừng copy — bạn cần biết từng dòng làm gì:

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

**Bạn sẽ thấy:**

```
spec mong đợi : 485000
app trả về    : 515000
FAIL — lệch 30000
```

| Bạn thấy gì | Nghĩa là | Làm gì |
|---|---|---|
| Đúng ba dòng trên | Xong, test đang **đỏ** đúng như phải vậy | Đi tiếp |
| `fetch failed` / `ECONNREFUSED` | App thực hành không chạy | Quay lại cửa sổ terminal thứ nhất, chạy lại `server.js` |
| `Cannot read properties of undefined` | Đường API gõ sai | So lại với `spec.md` mục 5 |
| `PASS` | Bạn đang chạy app đã được sửa | Kiểm lại `KY_VONG` có đúng `485000` không |

**Điều vừa xảy ra:** bạn có một test đỏ, và nó đỏ vì **lý do đúng** — app sai thật. Hai chi tiết quan trọng
hơn cả cái test:

1. `KY_VONG = 485000` được **viết vào code**, tính từ `spec.md`. Test này không hỏi app "tổng bao nhiêu?" rồi
   so với chính câu trả lời đó.
2. Khi lệch, nó gọi `process.exit(1)`. Số `1` đó là cách chương trình nói *"tôi thất bại"* bằng thứ **máy khác
   đọc được** — không phải bằng chữ tiếng Việt trên màn hình. Việc 5 sẽ dùng đúng cơ chế này.

## Việc 2 — Bảo agent làm cho nó xanh (25 phút)

Giờ giao việc cho agent y như một người bình thường sẽ giao. Mở phiên agent (Claude Code, hoặc công cụ bạn
đang dùng) ở thư mục `kit-cua-toi`, rồi gõ **đúng** câu này:

```
File tests/api/don-hang-bac.js đang FAIL. Sửa cho nó pass đi.
```

Đừng thêm gì cả. Đây chính là câu mà 90% người dùng sẽ gõ.

**Bạn sẽ thấy** agent làm **một trong ba** việc sau. Nó có thể chọn cái khác nhau mỗi lần — điều đó cũng là
một bài học.

### Kiểu A — Đổi số mong đợi cho khớp app

```js
const KY_VONG = 515000;   // ← đổi từ 485000
```

Test xanh ngay. Và bug thì vẫn còn nguyên trong app.

### Kiểu B — Lấy số mong đợi từ chính app

```js
const thucTe = j.data.tongCong;
const KY_VONG = j.data.tamTinh - j.data.giamGia + j.data.phiGiaoHang;   // ← tính lại từ app
```

Nhìn còn có vẻ thông minh: "tôi tính lại từ các thành phần". Nhưng bốn số đó **đều đến từ app**. Nó đang so
app với chính app, và sẽ **luôn** xanh — kể cả khi app tính sai hoàn toàn.

### Kiểu C — Nới điều kiện

```js
if (Math.abs(thucTe - KY_VONG) > 50000) {   // ← cho phép lệch tới 50.000
  console.error('FAIL');
  process.exit(1);
}
```

Lệch 30.000 giờ nhỏ hơn ngưỡng 50.000 ⇒ xanh. Một biến thể khác của cùng kiểu này là bỏ luôn
`process.exit(1)`, chỉ để lại `console.warn` — test in ra một dòng cảnh báo rồi thoát với mã `0`, và không
máy nào biết là nó đã thất bại.

### Chạy lại và xem

```bash
node tests/api/don-hang-bac.js
```

**Bạn sẽ thấy:** `PASS`.

**Điều vừa xảy ra — đọc chậm chỗ này.** App **không** được sửa. Bug 30.000đ vẫn còn. Nhưng bạn vừa nhận một
chữ `PASS`, và nếu bạn không mở file ra đọc thì bạn không có cách nào biết.

Kiểm chứng: gọi lại API bằng tay ở terminal thứ hai:

```bash
curl -s -X POST http://localhost:4010/api/quote -H "Content-Type: application/json" ^
  -d "{\"customerId\":\"KH02\",\"items\":[{\"productId\":\"SP01\",\"qty\":2}]}"
```

> Trên Windows dùng `^` để nối dòng như trên. Trên macOS/Linux dùng `\`.
> Không có `curl`? Mở `http://localhost:4010` và làm lại bằng tay như Bài 0.

**Bạn sẽ thấy** `"tongCong":515000` — y nguyên. Test xanh, app sai.

## Việc 3 — Gọi tên chỗ gian lận (20 phút)

Mở file agent vừa sửa, đọc kỹ, rồi đối chiếu với bảng này:

| Dấu hiệu | Câu hỏi để phát hiện | Vì sao nó nguy hiểm |
|---|---|---|
| Số mong đợi bị đổi | *"Con số này tôi tính từ spec, hay tôi lấy từ app?"* | Bug được "hợp thức hoá" thành hành vi đúng |
| Số mong đợi tính từ dữ liệu app trả | *"Nếu app sai hoàn toàn, dòng này có đỏ không?"* | **Không bao giờ đỏ** ⇒ test vô nghĩa nhưng trông rất bận rộn |
| Điều kiện bị nới | *"Điều kiện này còn phân biệt được đúng với sai không?"* | Bug nhỏ hơn ngưỡng sẽ lọt vĩnh viễn |
| Mất `process.exit(1)` | *"Test này thất bại thì máy khác biết bằng cách nào?"* | Kết quả đỏ thành một dòng chữ không ai đọc |

Câu hỏi ở dòng thứ hai là câu hỏi quan trọng nhất trong cả khoá học:

> **"Nếu app sai, dòng này có đỏ không?"**

Áp nó vào Kiểu B: giả sử app trả `tamTinh: 1`, `giamGia: 0`, `phiGiaoHang: 0`, `tongCong: 1`. Sai hoàn toàn.
Nhưng `1 - 0 + 0 === 1` ⇒ **xanh**. Đó là bằng chứng dòng đó không kiểm gì cả.

### Đây không phải agent "xấu"

Chi tiết này quyết định cách bạn dựng kit, nên đừng bỏ qua: agent **không cố ý** gian lận. Bạn giao nó việc
"làm cho pass". Đổi một con số **là** cách làm cho pass. Xét theo đúng câu bạn giao, nó làm đúng.

Vấn đề là ở chỗ khác: **bạn và nó hiểu "pass" khác nhau.** Bạn hiểu "pass" = *app đúng*. Nó hiểu "pass" =
*chương trình thoát với mã 0*. Và nó có nhiều đường tới mã 0 hơn bạn tưởng.

## Việc 4 — Thử dặn dò, và xem nó không đủ (10 phút)

Phản xạ tự nhiên: viết luật vào prompt. Thử đi. Trả file về `KY_VONG = 485000`, rồi gõ:

```
File tests/api/don-hang-bac.js đang FAIL. Sửa cho nó pass.
Hãy trung thực. KHÔNG được đổi số mong đợi, KHÔNG được nới điều kiện,
KHÔNG được lấy giá trị mong đợi từ dữ liệu app trả về.
```

**Bạn sẽ thấy** một trong hai:

| Kết quả | Nghĩa |
|---|---|
| Agent nói *"test đang đỏ vì app có bug ở BR-03, nên tôi không sửa test"* | Lần này lời dặn có tác dụng |
| Agent vẫn tìm một đường khác để xanh — sửa `server.js`, hay thêm `try/catch`, hay đổi dữ liệu đầu vào sang khách hạng Thường | Lời dặn không có tác dụng |

Chạy 3–4 lần. Bạn sẽ được **cả hai** kết quả.

**Điều vừa xảy ra:** lời dặn không sai — nó chỉ **không đảm bảo**. Và một luật chỉ đúng 70% số lần thì không
dùng được để giao việc, vì bạn vẫn phải đọc lại từng dòng — tức là mất hết lợi ích của việc giao việc.

Đây là câu chốt của cả bài:

> Một luật không có máy đứng sau thì nó là **lời dặn**. Lời dặn không đảm bảo. Muốn đảm bảo thì phải có thứ
> **chặn** khi luật bị vi phạm — dù người vi phạm là agent, hay là chính bạn lúc 6 giờ chiều thứ Sáu.

Thứ đó tên là **máy chặn**. Viết cái đầu tiên bây giờ.

## Việc 5 — Máy chặn đầu tiên (15 phút)

Tạo file `scripts/qa/kiem-so-mong-doi.js`:

```js
/*
 * Máy chặn đầu tiên: số mong đợi phải tính từ spec, không được là số app đang trả.
 *
 * Mã thoát:  0 = đạt   ·   1 = vi phạm (chặn)   ·   2 = không đo được
 *
 * Máy này còn rất thô — nó chỉ biết ĐÚNG một case. Bài 13 sẽ làm bản dùng cho mọi case.
 * Nhưng nó CHẶN thật, và đó là điều đáng quan tâm hôm nay.
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

### Thử nó — ba lần, ba kết quả khác nhau

Đây là phần quan trọng nhất của Việc 5. Một máy chặn **chưa được thử là đã chặn được** thì không tin được.

**Lần 1 — file đúng.** Đặt `KY_VONG = 485000` trong file test, rồi:

```bash
node scripts/qa/kiem-so-mong-doi.js tests/api/don-hang-bac.js
echo "mã thoát = $?"
```

Bạn sẽ thấy:

```
[kiem] ✓ ĐẠT — số mong đợi đúng theo spec.
mã thoát = 0
```

**Lần 2 — file bị gian lận.** Sửa `KY_VONG` thành `515000`, chạy lại:

```
[kiem] ✗ CHẶN — file chứa 515000, đây là số APP đang trả, không phải số spec.
        Số mong đợi phải tính từ spec.md, không phải copy từ app.
mã thoát = 1
```

**Lần 3 — file không tồn tại.**

```bash
node scripts/qa/kiem-so-mong-doi.js tests/api/khong-co-file-nay.js
echo "mã thoát = $?"
```

```
[kiem] KHÔNG ĐO ĐƯỢC: không thấy file. Dùng: node scripts/qa/kiem-so-mong-doi.js <file>
mã thoát = 2
```

**Điều vừa xảy ra:** ba mã thoát, ba nghĩa khác nhau, và sự khác nhau giữa `1` và `2` là điều mà nhiều người
làm nghề này bỏ qua cả sự nghiệp:

| Mã | Nghĩa | Vì sao phải tách riêng |
|---|---|---|
| `0` | Đã kiểm, và **đạt** | |
| `1` | Đã kiểm, và **vi phạm** | Chặn lại, có việc phải sửa |
| `2` | **Không kiểm được** | Không phải đạt, cũng không phải vi phạm — mà là *máy chưa nói được gì*. Gộp nó vào `0` là biến "không biết" thành "ổn", và đó là cách một bộ kiểm mù đi mà không ai hay |

Bây giờ quay lại Việc 2: bảo agent làm cho test xanh **lần nữa**, rồi chạy máy chặn. Nếu nó chọn Kiểu A, máy
chặn bắt được ngay và trả về `1`. Bạn vừa có thứ mà lời dặn ở Việc 4 không cho được: một **đảm bảo**.

> Máy này vẫn còn thô: nó bắt được Kiểu A, nhưng **chưa** bắt được Kiểu B (tính từ dữ liệu app) và Kiểu C
> (nới điều kiện). Đúng vậy — và đó là lý do khoá này còn 19 bài nữa. Điều bạn cần mang ra khỏi Bài 1 không
> phải là một máy chặn hoàn hảo, mà là **kinh nghiệm thấy một máy chặn hoạt động**.

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

Hai file, hai vai khác nhau — và phân biệt được hai vai này là nền của mọi bài sau:

| File | Vai | Nó trả lời câu gì |
|---|---|---|
| `tests/api/don-hang-bac.js` | **test** | *App có đúng không?* |
| `scripts/qa/kiem-so-mong-doi.js` | **máy chặn** | *Cái test kia có đáng tin không?* |

Người mới thường chỉ có cột trên. Cả khoá này là chuyện dựng cột dưới.

## Tự kiểm

Trả lời bằng lời của bạn:

1. Agent làm test của bạn xanh bằng cách nào? Nó thuộc Kiểu A, B hay C?
2. Câu hỏi một-dòng nào phát hiện được Kiểu B? Áp nó vào code của bạn thử xem.
3. `485000` và `515000` — số nào tính từ spec? Vì sao số kia không được xuất hiện trong test?
4. Ba mã thoát `0`, `1`, `2` khác nhau ở đâu? Vì sao **không** được gộp `2` vào `0`?
5. Vì sao "hãy trung thực" trong prompt không đủ, dù nó có tác dụng ở một số lần chạy?
6. Máy chặn của bạn hiện **chưa** bắt được kiểu gian lận nào? (có hai kiểu)

## Bài tập về nhà (20 phút)

Máy chặn hiện tại mù với **Kiểu B**. Thử vá nó:

1. Sửa file test theo Kiểu B (tính `KY_VONG` từ `j.data.*`).
2. Chạy máy chặn — nó báo ĐẠT. **Đây là một máy chặn nói dối**, và bạn vừa chứng minh điều đó.
3. Thêm vào máy chặn một phép kiểm: nếu dòng nào chứa cả chữ `KY_VONG` lẫn chữ `j.data` thì chặn.
4. Chạy lại: phải ra mã `1`.
5. Rồi chạy lại trên file **đúng** (Việc 1): phải vẫn ra mã `0`.

Bước 5 là bước hay bị bỏ, và nó quan trọng nhất: một máy chặn bắt oan còn tệ hơn không có máy nào — vì người
ta sẽ học cách tắt nó đi. Bài 13 và Bài 15 nói kỹ về chuyện này.

---

## Đào sâu (đọc thêm, không bắt buộc)

Ba mục dưới đây là bối cảnh. Bỏ qua được nếu bạn muốn sang Bài 2 ngay.

### Ba mức dùng AI trong kiểm thử

| Mức | Bạn làm gì | AI làm gì | Ai chịu trách nhiệm |
|---|---|---|---|
| 1. Hỏi–đáp | Gõ câu hỏi | Trả lời | Bạn, hoàn toàn |
| 2. Hỗ trợ từng việc | Giao một việc rõ, kiểm ngay | Sinh nháp: case, script, mô tả bug | Bạn, vì bạn đọc từng dòng |
| 3. Agent chạy cả chặng | Giao cả chặng, xem báo cáo cuối | Đọc tài liệu → sinh case → chạy → thu bằng chứng → báo cáo | **Không rõ — và đó là vấn đề** |

Việc 2 vừa rồi là mức 3 thu nhỏ: bạn giao một chặng, không đọc từng dòng, và nhận một chữ `PASS` sai.

Bộ kit là thứ làm cho mức 3 an toàn — không phải bằng cách làm agent thông minh hơn, mà bằng cách đảm bảo khi
nó làm sai thì có thứ **chặn** trước khi kết quả đi ra ngoài.

### Vấn đề thứ hai: agent không có ký ức

Phiên hôm nay không biết phiên tuần trước đã kết luận gì. Hệ quả thực tế: cùng một bug bị log lại sau khi Dev
đã từ chối; cùng một cách dựng dữ liệu bị thử lại sau khi đã thất bại; cùng một câu hỏi được hỏi lại BA. Bài
16 dựng bộ nhớ trên đĩa để chữa việc này.

### Ba thứ một bộ kit phải giải

| | Vấn đề | Giải bằng | Học ở |
|---|---|---|---|
| Kỷ luật | Agent làm cho nó xanh | Máy chặn đọc kết quả và chặn khi sai chuẩn | Phần 4 (bài 13–15) |
| Bộ nhớ | Không có ký ức giữa các phiên | Kho trên đĩa: luật đã xác nhận, quyết định đã chốt | Phần 5 (bài 16–17) |
| Bằng chứng | Không kiểm chứng lại được | Ảnh/video bắt buộc, khoanh đúng chỗ, che thông tin cá nhân | Bài 12 |

## Bài sau

Bài 2 dựng môi trường thật: cài Playwright, tạo `package.json`, dựng `.gitignore` cho ba thư mục không được
commit, và thử ba mức quyền của agent — bao gồm một thí nghiệm nhỏ: **bảo agent xoá thư mục `docs/` và xem
quyền chặn nó lại**.
