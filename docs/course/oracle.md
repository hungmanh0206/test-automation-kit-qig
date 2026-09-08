# Kỷ luật Oracle: bài học quan trọng nhất

> **2 giờ** · Có gì trong tay: một bộ testcase do agent sinh · Sau bài này: mọi kết quả mong đợi đều chỉ được ra nguồn, và bạn nhận ra kiểu test tự khen mình từ xa

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | AI lấy luôn số app đang trả làm kết quả mong đợi. Thế là test luôn xanh, kể cả khi app sai. |
| **Bài này bạn gõ gì** | Sửa 5 kết quả mong đợi yếu thành loại trỏ được về tài liệu, rồi viết gate chặn số không có nguồn. |
| **Xong thì được gì** | Mọi kết luận đúng sai đều chỉ được ra một dòng luật cụ thể. Đây là bài quan trọng nhất. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Oracle** | Câu trả lời cho "dựa vào đâu mà bảo cái này đúng hay sai" |
| **Test tự khen mình** (tautology) | Test lấy chính app làm chuẩn để chấm app. Nó luôn xanh |
| **Fixture phân biệt** | Dữ liệu thử được dựng sao cho hai khả năng cho ra hai kết quả khác nhau |
| **`OBSERVATION`** | Thấy điều lạ nhưng chưa có nguồn để nói đúng sai. Không phải PASS, không phải FAIL |

## Bài này bạn sẽ làm gì

Năm việc:

1. Đếm xem bộ case của bạn có bao nhiêu chỗ không trỏ về nguồn nào (15 phút).
2. Nhận ra ba kiểu test tự khen mình, kiểu nào cũng trông rất bận rộn (25 phút).
3. Sửa 5 kết quả mong đợi yếu thành loại có neo (20 phút).
4. Dựng một fixture phân biệt (20 phút).
5. Chốt luật oracle vào file luật, và biết ghi gì khi không neo được (20 phút).

---

## Việc 1 — Đếm trước đã (15 phút)

Oracle là câu trả lời cho một câu hỏi rất đơn giản: dựa vào đâu mà bảo cái này đúng hay sai?

Nghe hiển nhiên. Nhưng thử trả lời cho một case thật của bạn xem. Nếu câu trả lời là "vì nhìn thấy nó thế"
thì bạn chưa có oracle. Bạn chỉ có một bản ghi lại hiện trạng.

Một oracle dùng được phải thoả hai điều. Một là nó nằm ngoài hệ thống đang test: tài liệu, công thức, hoặc
một quyết định đã chốt. Hai là nó cụ thể: một con số, một URL, một element, một chuỗi chữ. Tính từ thì không tính.

| Chưa phải oracle | Là oracle |
|---|---|
| "Tổng tiền hiển thị đúng" | "Tổng cộng = 321.000, theo BR-03: 300.000 − 9.000 + 30.000" |
| "Chuyển sang màn chi tiết" | "URL khớp `/orders/{id}` và tiêu đề trang là `Chi tiết đơn hàng`" |
| "Có thông báo lỗi" | "Hiện đúng chữ `Số lượng phải từ 1 đến 999`, theo mục 5" |

Không có oracle thì test chỉ mô tả app đang làm gì. Nó không nói được app làm có đúng không. Đó là ranh giới
giữa kiểm thử và chụp ảnh hiện trạng.

Giờ đếm trên bộ case agent sinh ở Bài 12:

```bash
node -e "
const fs=require('fs');
const {docMarkdown} = require('./scripts/lib/testcase');
const RONG = /^(hiển thị đúng|thành công|không lỗi|hoạt động bình thường|như mong đợi|ok|đúng như thiết kế|dữ liệu chính xác|tính toán chính xác)\.?\$/i;
const c = docMarkdown(fs.readFileSync(process.argv[1],'utf8'));
let rong=0, khongNeo=0;
for (const x of c) {
  const dong = x.expected.split('\n').map(s=>s.replace(/^\d+\.\s*/,'').trim()).filter(Boolean);
  if (dong.some(d => RONG.test(d))) { rong++; console.log('RỖNG  ' + x.tcId + ': ' + dong.find(d=>RONG.test(d))); }
  if (!/BR-|UI-|SM-|mục\s*\d/i.test(x.expected)) khongNeo++;
}
console.log('\n' + c.length + ' case · ' + rong + ' có dòng oracle rỗng · ' + khongNeo + ' không trỏ về nguồn nào');
" outputs/demo/tasks/PROJ-1234/test-cases/agent-sinh.md
```

Ghi lại hai con số. Chúng thường lớn hơn bạn nghĩ. Trên một bộ case thật, nếu prompt chưa ép thì tỉ lệ
không-trỏ-về-nguồn hay vượt quá một nửa.

## Việc 2 — Ba kiểu test tự khen mình (25 phút)

Đây là lỗi nguy hiểm nhất trong nghề, vì nó không có triệu chứng. Test xanh, độ phủ đẹp, tỉ lệ pass cao,
không ai nghi ngờ gì. Mọi lỗi khác rồi cũng lộ ra. Loại này thì không.

### Dạng lộ, ít gặp

```js
test('tautology dạng lộ', async ({ page }) => {
  const cols = await page.$$eval('th', (e) => e.map((x) => x.textContent));
  expect(cols).toEqual(cols);          // A bằng A
});
```

Không ai viết thế này một cách có ý thức. Nhưng biến thể nhẹ hơn thì gặp suốt:

```js
test('vẫn là tautology, chỉ trông có việc hơn', async ({ page }) => {
  const tong = await page.locator('#tong-cong').innerText();
  expect(tong).toBe(tong.trim());      // A bằng A
});
```

### Kiểu 1: so giao diện với API của chính hệ thống

```js
test('so UI với API của chính hệ thống', async ({ page, request }) => {
  const tuApi = (await (await request.get('/api/orders/1')).json()).total;
  const tuUi = await page.locator('#tong-cong').innerText();
  expect(chuanHoa(tuUi)).toBe(chuanHoa(tuApi));   // không chứng minh backend tính đúng
});
```

Cách này hợp lệ nếu mục tiêu của bạn là kiểm giao diện có lấy đúng dữ liệu backend không. Nhưng nó không nói
gì về chuyện backend tính đúng hay sai. Công thức backend sai thì cả hai bên cùng sai, và test vẫn xanh.

Thử bằng một câu: nếu công thức tính sai, test này có đỏ không? Không đỏ thì nó không kiểm công thức.

### Kiểu 2: lấy kỳ vọng từ chính màn hình

```js
test('đọc kỳ vọng từ chính màn hình', async ({ page }) => {
  const donGia = await page.locator('#don-gia').innerText();     // 100.000
  const soLuong = await page.locator('#so-luong').inputValue();  // 3
  const mongDoi = Number(donGia) * Number(soLuong);              // ← kỳ vọng lấy TỪ MÀN HÌNH
  expect(await page.locator('#thanh-tien').innerText()).toBe(dinhDang(mongDoi));
});
```

Trông rất có tính toán. Nhưng nếu ô Đơn giá hiển thị sai giá thì Thành tiền cũng sai theo, và test vẫn xanh.

Oracle đúng phải là: `SP_A` giá `100.000`, lấy từ danh mục sản phẩm chứ không lấy từ màn hình.

### Kiểu 3: thấy hai nơi giống nhau rồi kết luận đúng

Màn A hiện `20/05/2001`. Màn B cũng hiện `20/05/2001`. Bạn kết luận đúng.

Nhưng hai màn đó cùng đọc một API. Nếu API trả sai thì cả hai cùng sai, và chúng vẫn giống nhau.

> Hai màn hình cùng hiện một giá trị không có nghĩa giá trị đó đúng. Chỉ có nghĩa là cả hai đang đọc từ cùng
> một chỗ. Nếu chỗ đó sai thì cả hai cùng sai.

## Việc 3 — Neo kết quả mong đợi vào nguồn (20 phút)

Ở Bài 12 bạn đã có bảng `BR-`. Giờ dùng nó làm neo. Mỗi kết quả mong đợi trỏ về một mã:

```markdown
| Kết quả mong đợi |
|---|
| 1. Tạm tính = 300.000<br>2. Giảm giá = 9.000 — `BR-01` (Bạc 3%, chưa tới trần 100.000)<br>3. Phí giao hàng = 30.000 — `BR-02` (tạm tính < 500.000)<br>4. **Tổng cộng = 321.000** — `BR-03` |
```

Bạn được ngay ba thứ.

Thứ nhất, người review kiểm chứng được. Họ mở đúng mục tài liệu ra đối chiếu, không phải tin lời bạn.

Thứ hai, đổi luật thì truy được. BA đổi `BR-01` từ 3% sang 4%, bạn tìm mọi case có `BR-01` là biết chính xác
phải sửa những case nào.

Thứ ba, chỗ nào thiếu neo thì lộ ra. Case không trỏ được về mã nào là case đang tự nghĩ ra kỳ vọng.

Ba loại nguồn, dùng cho ba việc khác nhau:

| Neo | Dùng cho | Ví dụ |
|---|---|---|
| `BR-` luật nghiệp vụ | Công thức, điều kiện | `BR-03` tổng cộng |
| `UI-` hợp đồng giao diện | Nhãn, danh sách cột, thứ tự, màu | `UI-01` bốn cột khối B |
| `SM-` bản đồ hệ thống | Trạng thái hợp lệ, ma trận phân quyền | `SM-02` kế toán chỉ được xem |

`UI-` và `SM-` thì Bài 26 mới dựng. Lúc này cứ trỏ về mục tài liệu là đủ.

### Chữ hiển thị thì neo vào bản thiết kế

Với nhãn và thông báo có một cái bẫy riêng: neo sai nguồn.

Chuyện có thật. Một bug được log theo chữ trong file tổng hợp yêu cầu. Nhưng file đó chỉ ghi ý định. Chữ
thật sự hiển thị thì đã chốt ở Figma. Hai bên lệch nhau đúng ở phần chữ, và bug bị trả về.

Thứ tự ưu tiên cho chữ hiển thị: bản thiết kế đã chốt, rồi tới tài liệu đặc tả, cuối cùng mới tới file tổng
hợp yêu cầu.

Và kiểm đúng từng chữ, đừng kiểm kiểu "có thông báo là được":

| Yếu | Đủ |
|---|---|
| `expect(loi).toBeVisible()` | `expect(loi).toHaveText('Số lượng phải từ 1 đến 999')` |
| `expect(text).toContain('Số lượng')` | so khớp toàn chuỗi |

`toContain` bỏ qua đúng những thứ hay sai nhất: thiếu chữ, sai số, sai hoa thường, thừa dấu cách.

### Sửa 5 case

Chọn 5 case yếu nhất trong bộ của bạn, sửa tay. Mỗi case điền một dòng:

| TC ID | Kết quả mong đợi cũ | Cái mới | Neo về | Vì sao cái cũ chưa đủ |
|---|---|---|---|---|

Yêu cầu: cái mới phải nêu giá trị cụ thể, và trỏ về một mã `BR-`.

## Việc 4 — Fixture phân biệt (20 phút)

Có một loại case rất hay sai mà không ai nhận ra: case kiểm "trường này lấy từ nguồn nào".

Ví dụ. Trường `Hạng khách hàng` ở khối A, tài liệu nói lấy từ hệ thống CRM. Bạn muốn kiểm điều đó.

**Cách hay làm và nó sai.** Chọn một khách có hạng `Bạc` ở CRM. Trong hệ thống nội bộ cũng `Bạc`. Màn hiện
`Bạc`, bạn ghi PASS.

Nhưng bạn chưa chứng minh được gì. App có thể đọc từ CRM, có thể đọc từ cơ sở dữ liệu nội bộ, cũng có thể
gán cứng. Cả ba khả năng đều cho ra `Bạc`.

**Cách đúng.** Dựng dữ liệu sao cho hai nguồn khác giá trị:

| Nguồn | Giá trị |
|---|---|
| CRM | `Vàng` |
| Nội bộ | `Bạc` |

Màn hiện `Vàng` thì chứng minh nó đọc CRM. Hiện `Bạc` thì chứng minh nó không đọc CRM, và đó là bug.

Nguyên tắc chung: muốn phân biệt hai khả năng thì dữ liệu thử phải làm hai khả năng đó cho ra kết quả khác
nhau. Nếu cả hai cho cùng một kết quả thì chạy xong bạn vẫn không biết gì thêm.

Áp rộng ra:

- Kiểm "giá lấy từ danh mục chứ không phải nhập tay" thì đặt hai giá khác nhau.
- Kiểm "phí giao hàng tính theo Tạm tính chứ không theo Tổng cộng" thì dựng ca mà hai số đó nằm hai bên mốc.
- Kiểm "làm tròn xuống chứ không làm tròn thường" thì dùng số lẻ ra `.5`.

Giờ tự viết một case. Chọn một trong hai tình huống trên, rồi viết đủ ba phần: tiền điều kiện nêu cả hai giá
trị, kết quả mong đợi nêu giá trị nào phải thắng, và một câu nói rõ nếu ra giá trị kia thì kết luận gì.

## Việc 5 — Không neo được thì ghi gì (20 phút)

Đôi khi bạn thấy một thứ có vẻ sai nhưng không tài liệu nào nói tới. Ba cách xử lý, chỉ một cách đúng:

| Cách | Hậu quả |
|---|---|
| Ghi PASS vì "nhìn thì hợp lý" | Bạn vừa tự bịa ra oracle từ chính app. Đúng thứ bài này cấm |
| Ghi FAIL vì "tôi nghĩ nó sai" | Log bug không có căn cứ, dev trả về |
| Ghi `OBSERVATION` | Giữ được phát hiện, mà không giả vờ là đã kết luận được |

`OBSERVATION` nghĩa là: tôi thấy điều này, tôi chưa có nguồn để nói nó đúng hay sai. Nó đi kèm một câu hỏi
cho BA.

Nhớ điều này: chỗ không kết luận được thì không ghi thành PASS. Đó là mục 3 trong `CLAUDE.md` bạn viết ở Bài 5.
PASS là một lời khẳng định, nghĩa là tôi đã kiểm và nó đúng. Không có nguồn thì bạn chưa kiểm được, nên chưa
khẳng định được.

### Danh sách chữ nghe như kết luận nhưng không kết luận gì

Những cụm dưới đây đúng với gần như mọi giá trị, kể cả giá trị sai:

```
hiển thị đúng · thành công · không lỗi · hoạt động bình thường · như mong đợi
đúng như thiết kế · dữ liệu chính xác · tính toán chính xác · hệ thống xử lý đúng · OK
```

Chúng có chung một điểm: không nêu giá trị nào. Cách thử nhanh là xoá cụm đó đi rồi hỏi còn lại thông tin gì
để đối chiếu. Không còn gì thì đó là oracle rỗng.

Thêm mục này vào `LUAT-DAY-DU.md`:

```markdown
## Oracle

- Mọi Kết quả mong đợi phải nêu giá trị, URL hoặc element cụ thể, và trỏ được về nguồn
  (mã `BR-`, `UI-`, `SM-`, hoặc mục tài liệu).
- Cấm lấy chính app làm chuẩn để chấm app, kể cả kiểu gián tiếp: đọc giá trị từ màn hình
  rồi tính kỳ vọng từ nó.
- Chữ hiển thị neo theo thứ tự: bản thiết kế đã chốt, rồi tài liệu đặc tả, rồi file tổng hợp
  yêu cầu. So khớp toàn chuỗi, không dùng contains.
- Muốn chứng minh một trường lấy từ nguồn nào thì hai nguồn phải khác giá trị.
- Thấy điều đáng nghi mà không neo được nguồn thì ghi `OBSERVATION` kèm câu hỏi.
  Không ghi PASS, không ghi FAIL.
- Hai nơi giống nhau không phải bằng chứng của đúng.
```

Rồi commit:

```bash
git add LUAT-DAY-DU.md outputs/demo/tasks/PROJ-1234/test-cases
git commit -m "feat(rule): mục Oracle — cấm test tự khen mình, ép neo nguồn, fixture phân biệt

Sửa 5 kết quả mong đợi yếu thành có neo. Bộ hiện tại: <N> case, còn <X> dòng oracle rỗng."
```

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/rules/
│   └── oracle.md                 ← MỚI · khối luật: không neo được thì ghi OBSERVATION
├── LUAT-DAY-DU.md                ← SỬA · thêm mục Oracle
├── scripts/qa/
│   └── gate-oracle.js            ← MỚI · giá trị tính toán không trỏ nguồn thì chặn
└── outputs/tasks/<MÃ>/analysis/
    └── business-rules.md         ·  từ Bài 12 — giờ là nguồn của mọi kết quả mong đợi
```

## Tự kiểm

1. Oracle dùng được phải thoả hai điều gì?
2. Kể ba kiểu test tự khen mình. Kiểu nào bạn thấy quen nhất trong bộ case của mình?
3. Câu hỏi một dòng nào phát hiện được cả ba kiểu đó?
4. Vì sao `toContain` yếu hơn so khớp toàn chuỗi? Nó bỏ qua những lỗi nào?
5. Chữ hiển thị thì neo vào nguồn nào trước? Vì sao không neo vào file tổng hợp yêu cầu?
6. Bạn kiểm "hạng khách lấy từ CRM" mà cả hai nguồn đều là `Bạc`. Chạy xong bạn biết thêm được gì?
7. Thấy điều đáng nghi mà không có tài liệu nào nói thì ghi gì? Vì sao không ghi PASS?

## Bài tập về nhà

Lấy một bộ testcase thật đang dùng ở dự án bạn. Chạy script đếm ở Việc 1 lên nó, ghi ba con số:

1. Bao nhiêu phần trăm case có dòng oracle rỗng?
2. Bao nhiêu phần trăm case không trỏ về nguồn nào?
3. Trong số case kiểm tính toán, bao nhiêu case lấy số liệu từ màn hình để tính kỳ vọng?

Con số thứ ba đáng sợ nhất, vì những case đó luôn xanh và không ai biết.

Đừng sửa hàng loạt ngay bây giờ. Bài 14 sẽ cho bạn gate, và Bài 25 sẽ cho bạn cách đo xem bộ kiểm có thật sự
bắt được lỗi giá trị hay không.

## Bài sau

Bài 14 trả lời câu này: bộ 200 case của bạn nghe thì nhiều, nhưng có khi cả 200 chỉ hỏi đúng một loại câu hỏi.
Làm sao biết mình đang bỏ trống loại nào?
