# Bài 13 — Thiết kế testcase có nguồn đáng tin

> **2 giờ 30 phút** · Có gì trong tay: bảng luật `BR-` đã bóc từ requirement · Sau bài này: template 7 cột, một parser, và 10 case viết tay để đối chứng

**Vấn đề**

Sản phẩm trả về `3.850.000`. Test của bạn viết `expect(total).toBe(3850000)`. Chạy xanh.

Test đó vừa chứng minh được gì?

Nó chứng minh sản phẩm trả về đúng con số mà test vừa copy từ chính sản phẩm. Tức là sản phẩm bằng
chính nó.

Nó chưa chứng minh sản phẩm đúng requirement. Mà công thức phí dịch vụ có tới ba nhánh theo loại đơn,
nên "đúng" ở đây không hiển nhiên chút nào.


**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Mỗi người viết testcase một kiểu nên không công cụ nào đọc được cả bộ. |
| **Bài này bạn gõ gì** | Chốt 7 cột bắt buộc, viết một bộ đọc dùng chung, rồi viết tay 10 case. |
| **Xong thì được gì** | Bộ case có khuôn cố định, xuất ra Excel được, và máy đọc được. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Năm việc:

1. Chốt bảy cột bắt buộc, và hiểu vì sao thiếu cột nào cũng có chỗ vỡ (20 phút).
2. Viết một bộ đọc dùng chung, chỉ một cái thôi (30 phút).
3. Tránh bẫy tách cột khi ô chứa dấu gạch đứng (15 phút).
4. Viết tay 10 case để làm bản đối chứng (25 phút).
5. Xuất Excel và chạy phép kiểm đầu tiên (30 phút).

---

## Việc 1 — Vì sao cần "canonical" chứ không phải "một cái template"

Template chỉ là cái khuôn. Canonical là một cam kết: đây là bản gốc, mọi bản khác phải đọc từ đây.

Không có cam kết đó thì chuyện dưới đây xảy ra, và xảy ra rất nhanh:

```
Agent sinh testcase ở dạng markdown
   → bạn copy sang Excel để gửi BA, sửa vài chỗ trong Excel
      → publish lên công cụ test-management từ markdown (bản CŨ)
         → execute đọc từ công cụ đó
            → giờ có BA BẢN khác nhau, và không ai biết bản nào đúng
```

Chọn canonical nghĩa là chọn một bản duy nhất để mọi công cụ đọc. Các bản khác đều sinh ra từ nó.

## Việc 2 — Bảy cột, và vì sao mỗi cột tồn tại

| # | Cột | Trả lời câu gì | Thiếu thì sao |
|---|---|---|---|
| 1 | `TC ID` | Truy vết: case nào | Không nối được kết quả về case, không nối được bug về case |
| 2 | `Module` | Test **ở đâu** | Không chấm rủi ro theo module được (Bài 27) |
| 3 | `Trường hợp kiểm thử` | Kiểm **điều gì** | Đọc case mà không biết nó nhằm gì |
| 4 | `Tiền điều kiện` | Cần trạng thái nào trước | Case chết giữa chừng lúc execute (Bài 9) |
| 5 | `Các bước thực hiện` | Làm **thế nào** | Không automate được, không tái hiện được |
| 6 | `Kết quả mong đợi` | **Đúng là gì** | Không phán được PASS/FAIL — case vô nghĩa (Bài 13) |
| 7 | `Ưu tiên` | Làm **trước sau** | Không xếp được thứ tự, và mất cả đầu vào cho độ sâu mở rộng |

Bảy cột này là mức tối thiểu. Dự án bạn cần thêm cột thì cứ thêm. Nhưng thiếu một trong bảy cột trên thì
sẽ có một công cụ phía sau vỡ.

> Đừng thêm cột chỉ vì thấy "có thể cần". Mỗi cột bắt buộc là một thứ agent phải điền cho mọi case. Cột ít
> dùng rồi sẽ được điền cho có, và thành dữ liệu rác. Dữ liệu rác còn khó chịu hơn ô trống, vì nó trông
> như thật.

### Template markdown

```markdown
| TC ID | Module | Trường hợp kiểm thử | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|---|
| TC_001 | Tạo đơn hàng | Tính Tổng cộng khi học viên chương trình Pro, tạm tính dưới mốc phí dịch vụ | Khách `KH_BAC_01` chương trình Pro; sản phẩm `SP_A` giá 100.000 còn bán | 1. Mở màn Tạo đơn hàng<br>2. Chọn học viên `KH_BAC_01`<br>3. Thêm `SP_A`, số suất 3 | 1. Tạm tính = 300.000<br>2. Giảm giá = 9.000 (3% của 300.000)<br>3. Phí dịch vụ = 30.000<br>4. **Tổng cộng = 321.000** | High |
```

Ba quy ước trong ví dụ trên, và mỗi cái có lý do:

1. Kết quả mong đợi đánh số khớp từng bước. `1.` ứng với bước `1.` Không gộp kiểu "các giá trị hiển thị
   đúng", đó là oracle rỗng, Bài 13 sẽ nói kỹ.
2. Tiền điều kiện nêu dữ liệu cụ thể, có mã. Không viết "có một học viên chương trình Pro", lúc execute thì
   *khách nào*?
3. Giá trị cụ thể trong kết quả mong đợi, kèm cách tính. `321.000` chứ không "tổng đúng".

## Việc 3 — Một parser, không phải bốn

Bạn sẽ phải đọc testcase từ nhiều chỗ. Markdown khi agent sinh ra. Excel khi BA sửa. Sau này còn từ công
cụ quản lý testcase nữa. Phản xạ tự nhiên là viết một hàm đọc cho mỗi nơi. Đừng làm thế.

> Chuyện thật ở kit này: có 4 parser trùng nhau, và một trong số đó tách cột bằng `split('|')` thô nên
> lệch cột khi ô chứa `\|`. Ba parser kia đúng. Nghĩa là cùng một file testcase đọc ra hai kết quả khác
> nhau tuỳ công cụ nào đọc, và không có gì báo.

Cách đúng: một model canonical, một hàm đọc cho mỗi định dạng, cùng trả về cùng một hình dạng.

`scripts/lib/testcase/index.js`:

```js
/*
 * Model canonical cho testcase. MỘT nguồn đọc duy nhất cho mọi định dạng.
 *
 * VÌ SAO: đọc testcase là việc xảy ra ở nhiều nơi (sinh case, publish, execute, đối chiếu bug). Mỗi nơi
 * tự viết hàm đọc thì cùng một file cho ra kết quả khác nhau tuỳ ai đọc, và không có gì báo lệch.
 */
'use strict';

const COT = ['tcId', 'module', 'title', 'precondition', 'steps', 'expected', 'priority'];

const NHAN = {
  tcId: 'TC ID',
  module: 'Module',
  title: 'Trường hợp kiểm thử',
  precondition: 'Tiền điều kiện',
  steps: 'Các bước thực hiện',
  expected: 'Kết quả mong đợi',
  priority: 'Ưu tiên'
};

/**
 * Tách một dòng bảng markdown thành các ô.
 *
 * BẪY THẬT: `split('|')` thô làm LỆCH CỘT khi ô chứa `\|` (hay gặp: bước thao tác có biểu thức
 * "a | b", hoặc mô tả regex). Lệch cột thì mọi cột sau đó đọc sai — im lặng, không lỗi.
 * Nên phải tách theo dấu `|` KHÔNG bị thoát.
 */
function tachO(dong) {
  const o = [];
  let cur = '';
  for (let i = 0; i < dong.length; i++) {
    if (dong[i] === '\\' && dong[i + 1] === '|') { cur += '|'; i++; continue; }
    if (dong[i] === '|') { o.push(cur); cur = ''; continue; }
    cur += dong[i];
  }
  o.push(cur);
  // `| a | b |` cho ra ô rỗng ở đầu và cuối — bỏ đi
  if (o.length && o[0].trim() === '') o.shift();
  if (o.length && o[o.length - 1].trim() === '') o.pop();
  return o.map((s) => s.trim());
}

/** Đọc bảng markdown → mảng object canonical. Ném lỗi nếu thiếu cột bắt buộc. */
function docMarkdown(md) {
  const dong = md.split('\n').filter((l) => l.trim().startsWith('|'));
  if (dong.length < 2) throw new Error('không thấy bảng markdown nào (cần dòng tiêu đề + dòng phân cách)');

  const tieuDe = tachO(dong[0]);
  const viTri = {};
  for (const key of COT) {
    const i = tieuDe.indexOf(NHAN[key]);
    if (i < 0) throw new Error(`thiếu cột bắt buộc "${NHAN[key]}" — có: ${tieuDe.join(' · ')}`);
    viTri[key] = i;
  }

  const cases = [];
  for (const l of dong.slice(2)) {              // bỏ dòng tiêu đề và dòng |---|
    const o = tachO(l);
    if (!o.length || !o[viTri.tcId]) continue;  // dòng rỗng
    const c = {};
    for (const key of COT) c[key] = o[viTri[key]] || '';
    // <br> trong ô là quy ước xuống dòng của markdown table → chuyển về \n cho dễ xử lý
    c.steps = c.steps.replace(/<br\s*\/?>/gi, '\n');
    c.expected = c.expected.replace(/<br\s*\/?>/gi, '\n');
    cases.push(c);
  }
  return cases;
}

module.exports = { COT, NHAN, tachO, docMarkdown };
```

### Xuất Excel

```bash
npm i -D xlsx
```

`scripts/convert_excel/md_to_xlsx.js`:

```js
#!/usr/bin/env node
/* md_to_xlsx.js — xuất bộ testcase canonical ra Excel. KHÔNG parse lại; dùng lại parser dùng chung. */
'use strict';
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { COT, NHAN, docMarkdown } = require('../lib/testcase');

const [inFile, outFile] = process.argv.slice(2);
if (!inFile || !outFile) {
  console.error('Dùng: node scripts/convert_excel/md_to_xlsx.js <vào.md> <ra.xlsx>');
  process.exit(2);
}

let cases;
try { cases = docMarkdown(fs.readFileSync(inFile, 'utf8')); }
catch (e) { console.error('Không đọc được testcase: ' + e.message); process.exit(1); }
if (!cases.length) { console.error('0 case — không xuất file rỗng.'); process.exit(1); }

const rows = cases.map((c) => COT.reduce((r, k) => { r[NHAN[k]] = c[k]; return r; }, {}));
const ws = XLSX.utils.json_to_sheet(rows, { header: COT.map((k) => NHAN[k]) });
ws['!cols'] = [{ wch: 10 }, { wch: 18 }, { wch: 46 }, { wch: 32 }, { wch: 40 }, { wch: 40 }, { wch: 10 }];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Testcases');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
XLSX.writeFile(wb, outFile);
console.log(`Đã xuất ${cases.length} case → ${outFile}`);
```

Để ý: file này không tự parse markdown. Nó gọi `docMarkdown` từ thư viện chung. Đó chính là "một parser".

## Việc 4 — Ưu tiên và Severity: hai trục, và một cái không thuộc testcase

Hai khái niệm này bị lẫn ở gần như mọi dự án.

| | `Ưu tiên` | `Severity` |
|---|---|---|
| Trả lời | Làm trước hay sau | **Hậu quả** nếu lỗi xảy ra |
| Thang | `Critical` `High` `Medium` `Low` `Lowest` | `Blocker` `Critical` `Major` `Minor` `Trivial` |
| Thuộc về | **Testcase** | **Bug** |

Hai thứ này độc lập với nhau. Một lỗi hậu quả rất lớn nhưng hiếm khi gặp thì vẫn có thể để ưu tiên thấp.

**Nhưng Severity không nên là cột bắt buộc của testcase.** Lý do rất thẳng:

> Chấm severity lúc **viết case** là đoán trước hậu quả của một lỗi chưa xảy ra. Bạn chưa biết nó sẽ hỏng
> kiểu gì. Severity là thuộc tính của bug, chấm nó khi bug xuất hiện thì mới có căn cứ.
>
> Kit này từng có cột đó và đã **bỏ** (đo trên 1977 case: bỏ hẳn cột này làm đổi độ sâu mở rộng đúng **0
> case** — nó dư thật, chỉ đang che một lỗi khác của thang ưu tiên).

**Một cảnh báo về thang giá trị.** Chọn thang khớp với công cụ bạn sẽ publish lên, không phải thang bạn
thích. Chuyện thật: bộ case dùng `Highest` (thang Jira) trong khi công cụ test-management map theo **tên** và
thang của nó là `Critical`. Nên 14 case bị tụt về `Medium` khi publish, mà không ai biết.

Thêm phép kiểm này vào parser:

```js
const UU_TIEN_HOP_LE = /^(critical|high|medium|low|lowest)$/i;

/** Kiểm giá trị hợp lệ. Trả về mảng vấn đề — Bài 14 sẽ biến nó thành gate. */
function kiemTra(cases) {
  const loi = [];
  const daThay = new Set();
  for (const c of cases) {
    if (daThay.has(c.tcId)) loi.push(`${c.tcId}: TC ID TRÙNG — không truy vết được`);
    daThay.add(c.tcId);
    for (const k of ['module', 'title', 'steps', 'expected', 'priority']) {
      if (!c[k]) loi.push(`${c.tcId}: ô "${NHAN[k]}" rỗng`);
    }
    if (c.priority && !UU_TIEN_HOP_LE.test(c.priority)) {
      loi.push(`${c.tcId}: Ưu tiên = "${c.priority}" ngoài thang Critical|High|Medium|Low|Lowest. ` +
        'Giá trị lạ bị công cụ publish bỏ qua âm thầm và rơi về mặc định.');
    }
  }
  return loi;
}
```

## Việc 5 — Nguồn nào là canonical, khi nào

Câu trả lời đổi theo giai đoạn, và đây là chỗ dễ nhầm:

| Giai đoạn | Canonical | Vì sao |
|---|---|---|
| Sinh và sửa case (Phần 2) | **Excel / markdown trong repo** | Đang biên soạn, cần diff và review được |
| Publish lên công cụ test-management | Excel là nguồn đẩy đi | Một chiều: repo → công cụ |
| Execute (Phần 3) | **Công cụ test-management** | Cả team đã thấy và đã sửa ở đó |

Nên khi chạy test, phải kéo bản mới nhất về trước. Chạy trên bản sao cũ nghĩa là bạn đang chấm theo kết quả
mong đợi đã bị người khác sửa rồi. Kết quả nhìn thì hợp lệ, nhưng không có nghĩa gì. Bài 18 sẽ dựng máy
kiểm chuyện này.

---

---

## Kỷ luật oracle — phần quan trọng nhất của cả tài liệu

Sáu việc trên làm cho bảng testcase đủ cột và đọc được bằng máy. Nhưng còn một câu chưa ai hỏi:
**cột Kết quả mong đợi lấy số từ đâu.**

Đây là chỗ hỏng âm thầm nhất trong nghề này, và bốn việc sau cho bạn thấy nó xảy ra trước mắt.

## Việc 6 — Bảo agent làm cho nó xanh (25 phút)

Giờ giao việc cho agent y như một người bình thường sẽ giao. Mở phiên agent ở thư mục `kit-cua-toi` rồi gõ
đúng câu này:

```
File tests/api/don-hang-bac.js đang FAIL. Sửa cho nó pass đi.
```

Đừng thêm gì. Đây là câu mà hầu hết mọi người sẽ gõ.

Agent sẽ làm một trong ba việc dưới đây. Mỗi lần chạy nó có thể chọn khác nhau, và chuyện đó cũng đáng để ý.

### Kiểu A — Đổi số mong đợi cho khớp app

```js
const KY_VONG = 544000;   // ← đổi từ 485000
```

Test xanh ngay. Bug thì vẫn nằm nguyên trong app.

### Kiểu B — Lấy số mong đợi từ chính app

```js
const thucTe = j.data.tongCong;
const KY_VONG = j.data.tamTinh - j.data.giamGia + j.data.phiDichVu;   // ← tính lại từ app
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
  -d "{\"customerId\":\"HV02\",\"items\":[{\"productId\":\"KH01\",\"qty\":2}]}"
```

Trên Windows dùng `^` để nối dòng như trên, trên macOS hay Linux thì dùng `\`. Máy không có `curl` thì cứ mở
`http://localhost:4010` rồi làm tay như Bài 1.

Bạn sẽ thấy `"tongCong":544000`, y nguyên. Test xanh, app sai.

## Việc 7 — Gọi tên chỗ gian lận (20 phút)

Mở file agent vừa sửa, đọc kỹ, rồi đối chiếu với bảng này:

| Dấu hiệu | Câu hỏi để phát hiện | Vì sao nguy hiểm |
|---|---|---|
| Số mong đợi bị đổi | "Con số này tôi tính từ spec, hay lấy từ app?" | Bug được biến thành hành vi đúng |
| Số mong đợi tính từ dữ liệu app trả | "Nếu app sai, dòng này có đỏ không?" | Không bao giờ đỏ. Test vô nghĩa nhưng trông rất bận rộn |
| Điều kiện bị nới | "Điều kiện này còn phân biệt được đúng với sai không?" | Bug nhỏ hơn ngưỡng sẽ lọt mãi |
| Mất `process.exit(1)` | "Test này thất bại thì máy khác biết bằng cách nào?" | Kết quả đỏ thành một dòng chữ không ai đọc |

Câu ở dòng thứ hai là câu bạn sẽ dùng nhiều nhất về sau:

> Nếu app sai, dòng này có đỏ không?

Thử áp nó vào Kiểu B. Giả sử app trả `tamTinh: 1`, `giamGia: 0`, `phiDichVu: 0`, `tongCong: 1`. Sai bét.
Nhưng `1 - 0 + 0 === 1` nên test vẫn xanh. Vậy là dòng đó không kiểm gì cả.

### Agent không cố ý gian lận

Chi tiết này quyết định cách bạn dựng kit về sau, nên đừng lướt qua.

Bạn giao cho nó việc "làm cho pass". Đổi một con số là một cách làm cho pass. Xét theo đúng câu bạn giao thì
nó làm đúng.

Vấn đề nằm ở chỗ hai bên hiểu chữ "pass" khác nhau. Bạn hiểu là app đúng. Nó hiểu là chương trình thoát với
mã 0. Và nó có nhiều đường đi tới mã 0 hơn bạn tưởng.

## Việc 8 — Thử dặn dò, rồi thấy nó không ăn thua (10 phút)

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
| Agent vẫn tìm đường khác để xanh: sửa `server.js`, thêm `try/catch`, hoặc đổi dữ liệu đầu vào sang khách chương trình Standard | Lời dặn không ăn thua |

Chạy thử ba bốn lần. Bạn sẽ gặp cả hai.

Lời dặn không sai. Nó chỉ không chắc chắn. Mà một luật chỉ đúng bảy trên mười lần thì không giao việc được,
vì bạn vẫn phải đọc lại từng dòng. Đọc lại từng dòng thì giao việc để làm gì.

Đó là ý chính của cả bài:

> Luật mà không có máy đứng sau thì chỉ là lời dặn. Muốn chắc thì phải có thứ chặn lại khi luật bị vi phạm.
> Kể cả khi người vi phạm là chính bạn, lúc 6 giờ chiều thứ Sáu.

Thứ đó gọi là máy chặn. Viết cái đầu tiên luôn.

## Việc 9 — Máy chặn đầu tiên (15 phút)

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
const SO_APP_DANG_TRA = '544000';

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

**Lần 2, file bị gian lận.** Sửa `KY_VONG` thành `544000` rồi chạy lại:

```
[kiem] ✗ CHẶN — file chứa 544000, đây là số APP đang trả, không phải số spec.
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


---

## Thực hành (55 phút)

### Bước 1 — Chốt template (10 phút)

Tạo `.agent/config/testcase-template.md` với bảng 7 cột và một dòng ví dụ đầy đủ. Nếu dự án bạn cần thêm
cột, thêm. Nhưng viết luôn một câu vì sao cột đó bắt buộc.

### Bước 2 — Viết parser (20 phút)

Viết `scripts/lib/testcase/index.js` theo mục 3. Rồi **kiểm bẫy `\|` ngay**:

```bash
node -e "
const {tachO} = require('./scripts/lib/testcase');
console.log(tachO('| TC_001 | Đơn | Lọc theo trạng thái a \\\\| b | | 1. Mở | 1. OK | High |'));
"
```

Phải ra **7 ô**, và ô thứ ba chứa `Lọc theo trạng thái a | b`. Nếu ra 8 ô thì `tachO` của bạn đang bị bẫy —
sửa trước khi đi tiếp. Thử lại bằng `split('|')` thô để **thấy** nó lệch.

### Bước 3 — Viết 10 case tay (15 phút)

Dùng [`assets/sample-requirement.md`](assets/sample-requirement.md). Viết **tay**, không dùng agent, đây là
bản đối chứng cho Bài 12.

Phân bổ gợi ý: 3 case luồng chính · 3 case công thức (giảm giá, phí dịch vụ, tổng cộng) · 2 case biên
(số suất 1 và 999) · 2 case luồng lỗi.

Lưu ở `outputs/demo/tasks/PROJ-1234/test-cases/tay-10-case.md`.

### Bước 4 — Xuất Excel và kiểm (10 phút)

```bash
npm i -D xlsx
node scripts/convert_excel/md_to_xlsx.js \
  outputs/demo/tasks/PROJ-1234/test-cases/tay-10-case.md \
  outputs/demo/tasks/PROJ-1234/test-cases/tay-10-case.xlsx
```

Mở file Excel ra kiểm mắt: đủ 7 cột, không lệch cột, xuống dòng trong ô hiển thị đúng.

Rồi chạy `kiemTra` trên bộ của bạn:

```bash
node -e "
const fs=require('fs');
const {docMarkdown, kiemTra} = require('./scripts/lib/testcase');
const c = docMarkdown(fs.readFileSync(process.argv[1],'utf8'));
const loi = kiemTra(c);
console.log('Đọc được ' + c.length + ' case, ' + loi.length + ' vấn đề:');
loi.forEach(l => console.log('  - ' + l));
" outputs/demo/tasks/PROJ-1234/test-cases/tay-10-case.md
```

*(Nhớ export `kiemTra` và `UU_TIEN_HOP_LE` trong `module.exports`.)*

### Bước 5 — Commit

```bash
git add scripts/lib scripts/convert_excel .agent/config/testcase-template.md package.json
git commit -m "feat(testcase): model canonical 7 cột + MỘT parser (xử lý đúng ô chứa \\|) + xuất Excel"
```

---

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Canonical** | Bản gốc. Mọi bản khác sinh ra từ nó, không ai sửa riêng |
| **Parser** | Đoạn mã đọc file testcase thành dữ liệu cho máy dùng |
| **Ưu tiên và Severity** | Một cái nói làm trước sau, một cái nói hậu quả nếu lỗi xảy ra. Hai thứ khác nhau |

## Cây thư mục sau bài này

```
kit-cua-toi/
├── scripts/lib/testcase/
│   └── index.js                  ← MỚI · MỘT bộ đọc/ghi dùng chung cho md và xlsx
├── scripts/qa/
│   └── tc_validate.js            ← MỚI · thiếu cột bắt buộc / ô rỗng ⇒ chặn
└── outputs/tasks/<MÃ>/test-cases/
    ├── testcases.md              ← MỚI · bản CANONICAL
    └── testcases.xlsx            ← MỚI · bản SINH RA từ .md, không sửa tay
```

## Bộ kit của bạn đang ở đâu

```
CẤP ĐỘ 3 · CONTROL      bài 2/9 của cấp độ này
██████░░░░░░░░░░░░░░░░░░░░░░

cả tài liệu           bài 13/29
█████████████░░░░░░░░░░░░░░░
```

**Hết cấp độ 3 bạn nói được:** Tôi có một QA workflow được enforce trong team.

Cấp độ này còn 7 bài nữa.

## Tự kiểm

- [ ] Template của tôi có 7 cột, và tôi giải thích được vì sao **từng** cột bắt buộc.
- [ ] `tachO` xử lý đúng ô chứa `\|`. Tôi đã thử và thấy `split('|')` thô lệch cột.
- [ ] Chỉ có một chỗ đọc markdown; công cụ xuất Excel gọi lại nó, không tự parse.
- [ ] Tôi phân biệt được Ưu tiên với Severity, và nói được vì sao severity không thuộc testcase.
- [ ] Thang Ưu tiên của tôi khớp công cụ sẽ publish lên, không phải thang tôi thích.
- [ ] Tôi có 10 case viết tay, và biết chúng dùng làm gì ở Bài 12.
- [ ] `kiemTra` bắt được: TC ID trùng, ô lõi rỗng, Ưu tiên ngoài thang.
- [ ] Tôi nói được canonical đổi thế nào giữa giai đoạn biên soạn và giai đoạn execute.

## Bài tập về nhà

Lấy một bộ testcase **thật** đang dùng ở dự án bạn, chạy `docMarkdown` + `kiemTra` lên nó (chuyển sang
markdown nếu cần). Đếm ba con số:

1. Bao nhiêu case thiếu ô lõi?
2. Bao nhiêu case có `Ưu tiên` ngoài thang?
3. Bao nhiêu case có `TC ID` trùng?

Ba con số này là điểm khởi đầu của bộ case hiện tại. Đừng sửa gì lúc này — Bài 14 sẽ biến `kiemTra` thành
gate, và lúc đó bạn có máy để sửa hàng loạt.

## Đọc thêm

- [`scripts/lib/testcase/`](../../scripts/lib/testcase/) của kit này, bản đầy đủ, có cả phần đọc Excel.
- Bài 12 sẽ dùng chính parser này để kiểm bộ case do agent sinh.

## Bài sau

Bài 14 hỏi câu tiếp theo: bộ case của bạn có oracle rồi, nhưng đủ hay thiếu. Và vì sao đếm số suất
testcase không trả lời được câu đó.
