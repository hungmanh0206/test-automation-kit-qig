# Bài 7 — Oracle: dựa vào đâu mà bảo cái này sai

> **2 giờ** · Có gì trong tay: một bộ testcase do agent sinh · Sau bài này: mọi expected đều trích được nguồn, và bạn nhận ra tautology từ xa

## Mục tiêu

✅ Hiểu oracle độc lập và vì sao expected phải trích được nguồn.
✅ Nhận diện tautology — dạng lộ và dạng tinh vi.
✅ Hiểu vì sao đây là lỗi nguy hiểm nhất.
✅ Fixture phân biệt: hai nguồn phải khác giá trị.
✅ Sửa 5 expected yếu thành expected có neo.
✅ Biết ghi gì khi không neo được, và vì sao "không phán được" không thành PASS.

---

## 1. Oracle là gì

**Oracle** là câu trả lời cho: *dựa vào đâu mà bảo cái này đúng hoặc sai?*

Nghe hiển nhiên, nhưng thử trả lời cho một case thật của bạn. Nếu câu trả lời là *"vì nhìn thấy nó thế"* thì
bạn không có oracle — bạn có một bản ghi hiện trạng.

Oracle **độc lập** phải thoả hai điều:

1. **Nằm ngoài hệ thống đang test** — tài liệu, công thức, quyết định đã chốt.
2. **Cụ thể** — một giá trị, một URL, một element, một chuỗi chữ. Không phải một tính từ.

| Không phải oracle | Là oracle |
|---|---|
| "Tổng tiền hiển thị đúng" | "Tổng cộng = `321.000`, theo BR-03: 300.000 − 9.000 + 30.000" |
| "Chuyển sang màn chi tiết" | "URL khớp `/orders/{id}` và tiêu đề trang = `Chi tiết đơn hàng`" |
| "Có thông báo lỗi" | "Hiện đúng chữ `Số lượng phải từ 1 đến 999`, theo mục 5" |

> Không có oracle độc lập thì test chỉ **mô tả** ứng dụng đang làm gì, chứ không nói được nó làm có **đúng**
> không. Đây là ranh giới giữa *kiểm thử* và *chụp ảnh hiện trạng*.

## 2. Tautology: lỗi nguy hiểm nhất

**Tautology** là lấy chính bản build làm expected. Về logic nó là "A bằng A" — luôn đúng.

Nó nguy hiểm hơn mọi lỗi khác vì **không có triệu chứng**: test xanh, coverage đẹp, tỉ lệ pass cao, không ai
nghi ngờ. Mọi lỗi khác rồi cũng lộ; tautology thì không.

### Dạng lộ

```js
test('tautology dạng lộ', async ({ page }) => {
  const cols = await page.$$eval('th', (e) => e.map((x) => x.textContent));
  expect(cols).toEqual(cols);          // A bằng A
});
```

Không ai viết thế này có ý thức. Nhưng biến thể nhẹ hơn thì rất phổ biến:

```js
test('vẫn là tautology, chỉ trông có việc', async ({ page }) => {
  const tong = await page.locator('#tong-cong').innerText();
  expect(tong).toBe(tong.trim());      // A bằng A
});
```

### Dạng tinh vi — và đây là dạng bạn sẽ gặp

**① So UI với API của chính hệ thống.**

```js
test('so UI với API của chính hệ thống', async ({ page, request }) => {
  const tuApi = (await (await request.get('/api/orders/1')).json()).total;
  const tuUi = await page.locator('#tong-cong').innerText();
  expect(chuanHoa(tuUi)).toBe(chuanHoa(tuApi));   // KHÔNG chứng minh BE tính đúng
});
```

Hợp lệ **nếu** mục tiêu là kiểm FE map đúng dữ liệu BE. Nhưng nó **không** chứng minh BE tính đúng. Nếu công
thức backend sai thì cả hai bên cùng sai và test vẫn xanh.

Phép thử: **nếu công thức tính sai, test này có đỏ không?** Không → nó không kiểm công thức.

**② Đọc kỳ vọng từ chính màn hình.**

```js
test('đọc kỳ vọng từ chính màn hình', async ({ page }) => {
  const donGia = await page.locator('#don-gia').innerText();     // 100.000
  const soLuong = await page.locator('#so-luong').inputValue();  // 3
  const mongDoi = Number(donGia) * Number(soLuong);              // ← kỳ vọng lấy TỪ MÀN HÌNH
  expect(await page.locator('#thanh-tien').innerText()).toBe(dinhDang(mongDoi));
});
```

Trông rất "có tính toán". Nhưng nếu ô Đơn giá hiển thị **sai giá** thì Thành tiền cũng sai theo, và test xanh.
Oracle đúng: `SP_A` giá `100.000` — lấy từ **danh mục sản phẩm**, không lấy từ màn hình.

**③ Nhất quán hai nơi coi là đúng.**

Thấy màn A và màn B cùng hiển thị `20/05/2001` rồi kết luận đúng. Nhưng hai màn cùng đọc một API — cả hai có
thể cùng sai. Nhất quán chỉ chứng minh **không mâu thuẫn**, không chứng minh **đúng**.

> Nguyên tắc gọn: **nhất quán KHÔNG phải bằng chứng của đúng.**

## 3. Neo expected vào nguồn

Bài 6 bạn đã có bảng `BR-`. Giờ dùng nó làm neo: mỗi expected trỏ về một mã.

```markdown
| Kết quả mong đợi |
|---|
| 1. Tạm tính = 300.000<br>2. Giảm giá = 9.000 — `BR-01` (Bạc 3%, chưa tới trần 100.000)<br>3. Phí giao hàng = 30.000 — `BR-02` (tạm tính < 500.000)<br>4. **Tổng cộng = 321.000** — `BR-03` |
```

Ba thứ được lợi ngay:

1. **Kiểm chứng được.** Người review mở đúng mục tài liệu để đối chiếu, không phải tin bạn.
2. **Truy vết đổi rule.** BA đổi `BR-01` từ 3% sang 4% → tìm mọi case có `BR-01` → biết chính xác phải sửa gì.
3. **Bắt được oracle thiếu neo.** Case nào không trỏ được về mã nào là case đang tự nghĩ ra kỳ vọng.

Ba loại nguồn hợp lệ, và chúng khác nhau:

| Neo | Dùng cho | Ví dụ |
|---|---|---|
| `BR-` business rule | Công thức, điều kiện nghiệp vụ | `BR-03` tổng cộng |
| `UI-` hợp đồng giao diện | Nhãn, danh sách cột, thứ tự, design token | `UI-01` bốn cột khối B |
| `SM-` bản đồ hệ thống | Trạng thái hợp lệ, ma trận phân quyền | `SM-02` kế toán chỉ xem |

`UI-` và `SM-` chưa có bây giờ — Bài 16 sẽ dựng. Lúc này cứ trỏ về mục tài liệu là đủ.

## 4. Khi nguồn nói chữ, phải neo đúng chữ

Với nhãn và thông báo hiển thị, có một bẫy riêng: neo **sai nguồn**.

> Chuyện thật: bug log theo chữ trong "file tổng hợp yêu cầu" — nhưng file đó chỉ nói **ý định**. Chữ thật sự
> hiển thị được chốt ở **Figma**. Hai nguồn lệch nhau ở đúng phần chữ nghĩa, và bug bị trả về.

Thứ tự ưu tiên cho chữ hiển thị: **Figma (hoặc bản thiết kế đã chốt) > tài liệu đặc tả > file tổng hợp yêu cầu**.

Và kiểm **đúng từng chữ**, không kiểm "có thông báo là được":

| Yếu | Đủ |
|---|---|
| `expect(loi).toBeVisible()` | `expect(loi).toHaveText('Số lượng phải từ 1 đến 999')` |
| `expect(text).toContain('Số lượng')` | so khớp **toàn chuỗi** |

`toContain` bỏ qua đúng thứ hay sai: thiếu chữ, sai số, sai hoa thường, thừa dấu cách.

## 5. Fixture phân biệt

Một loại case rất hay sai lặng lẽ: kiểm **"trường này lấy từ nguồn nào"**.

Ví dụ: `Hạng khách hàng` ở khối A — tài liệu nói lấy từ hệ thống CRM. Bạn muốn kiểm điều đó.

**Cách sai:** chọn một khách có hạng `Bạc` ở CRM, và trong hệ thống nội bộ cũng `Bạc`. Màn hiện `Bạc` → PASS.

Nhưng bạn **không chứng minh được gì**: nó có thể đọc từ CRM, hoặc từ cơ sở dữ liệu nội bộ, hoặc gán cứng —
mọi khả năng đều cho ra `Bạc`.

**Cách đúng:** dựng fixture mà hai nguồn **khác giá trị**.

| Nguồn | Giá trị |
|---|---|
| CRM | `Vàng` |
| Nội bộ | `Bạc` |

Màn hiện `Vàng` → chứng minh nó đọc CRM. Hiện `Bạc` → chứng minh nó **không** đọc CRM, và đó là bug.

> **Fixture phân biệt**: muốn phân biệt hai khả năng thì dữ liệu thử phải khiến hai khả năng cho **kết quả
> khác nhau**. Nếu cả hai cho cùng kết quả thì case chạy xong vẫn không biết gì hơn.

Áp dụng rộng hơn:

- Kiểm "giá lấy từ danh mục, không phải nhập tay" → đặt hai giá khác nhau.
- Kiểm "phí giao hàng theo Tạm tính, không theo Tổng cộng" → dựng ca mà hai con số nằm hai bên mốc.
- Kiểm "làm tròn xuống, không làm tròn thường" → dùng số lẻ ra `.5`.

## 6. Khi không neo được thì ghi gì

Đôi khi bạn thấy điều gì đó **có vẻ sai** nhưng không tài liệu nào nói. Ba lựa chọn, chỉ một đúng:

| Lựa chọn | Hậu quả |
|---|---|
| Ghi PASS vì "nhìn thì hợp lý" | Bịa oracle từ chính app — đúng thứ bài này cấm |
| Ghi FAIL vì "tôi nghĩ nó sai" | Log bug không có căn cứ, bị Dev trả về |
| **Ghi là `OBSERVATION`** | ✅ Giữ được phát hiện, không giả vờ đã phán được |

`OBSERVATION` nghĩa là: *tôi thấy điều này, tôi chưa có nguồn để nói nó đúng hay sai.* Nó đi kèm câu hỏi cho BA.

> **"Không phán được" KHÔNG thành PASS.** Đây là mục 3 trong `CLAUDE.md` bạn viết ở Bài 3. PASS là một khẳng
> định: *tôi đã kiểm và nó đúng*. Không có nguồn thì bạn không kiểm được, nên không được khẳng định.

## 7. Danh sách chữ "oracle rỗng"

Những cụm này **phán với gần như mọi giá trị**, kể cả giá trị sai. Chép vào `RULE_GLOBAL.md` — Bài 14 sẽ biến
nó thành gate:

```
hiển thị đúng · thành công · không lỗi · hoạt động bình thường · như mong đợi
đúng như thiết kế · dữ liệu chính xác · tính toán chính xác · hệ thống xử lý đúng · OK
```

Chúng có một điểm chung: **không nêu giá trị nào**. Phép thử: xoá cụm đó và hỏi *"còn lại thông tin gì để đối
chiếu?"* Nếu không còn gì thì đó là oracle rỗng.

Thêm vào `RULE_GLOBAL.md`:

```markdown
## Oracle

- Mọi `Kết quả mong đợi` phải nêu GIÁ TRỊ, URL hoặc element CỤ THỂ, và trích được nguồn
  (mã `BR-`/`UI-`/`SM-`, hoặc mục tài liệu).
- CẤM lấy chính bản build làm expected (tautology), kể cả dạng gián tiếp: đọc giá trị từ
  màn hình rồi tính kỳ vọng từ nó.
- Chữ hiển thị neo theo thứ tự: bản thiết kế đã chốt > tài liệu đặc tả > file tổng hợp yêu cầu.
  So khớp TOÀN CHUỖI, không dùng "contains".
- Muốn chứng minh một trường lấy từ nguồn nào thì hai nguồn PHẢI khác giá trị (fixture phân biệt).
- Thấy điều đáng nghi mà không neo được nguồn: ghi `OBSERVATION` kèm câu hỏi.
  KHÔNG ghi PASS, KHÔNG ghi FAIL.
- Nhất quán giữa hai nơi KHÔNG phải bằng chứng của đúng.
```

---

## Thực hành (55 phút)

### Bước 1 — Soi bộ case của bạn (15 phút)

Đếm trên bộ agent sinh ở Bài 6:

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

Ghi lại hai con số. Chúng thường lớn hơn bạn tưởng — trên một bộ thật, tỉ lệ không-trỏ-về-nguồn thường trên
một nửa nếu prompt chưa ép.

### Bước 2 — Sửa 5 expected yếu (20 phút)

Chọn 5 case yếu nhất, sửa tay. Mỗi case điền bảng:

| TC ID | Expected cũ | Expected mới | Neo về | Vì sao cũ không đủ |
|---|---|---|---|---|

Yêu cầu: expected mới phải nêu **giá trị cụ thể** và **trỏ về một mã `BR-`**.

### Bước 3 — Tìm tautology (10 phút)

Đọc bộ case, tìm case nào **nếu công thức backend sai thì vẫn PASS**. Gợi ý chỗ hay có:

- Case kiểm Thành tiền mà lấy Đơn giá từ màn hình.
- Case kiểm Tổng cộng bằng cách cộng lại các số **đang hiển thị**.
- Case kiểm hiển thị bằng cách so với API của chính hệ thống.

Với mỗi case tìm được, viết lại expected dùng **giá trị từ tài liệu**, không từ màn hình.

### Bước 4 — Thiết kế một fixture phân biệt (10 phút)

Chọn một trong hai:

- `Hạng khách hàng` lấy từ CRM: đặt CRM `Vàng`, nội bộ `Bạc`.
- `Đơn giá` lấy từ danh mục: đặt danh mục `100.000`, nơi khác `90.000`.

Viết một case với: tiền điều kiện nêu **cả hai** giá trị · expected nêu giá trị **mong đợi thắng** · và một
câu giải thích *nếu ra giá trị kia thì kết luận gì*.

### Bước 5 — Chốt luật và commit

Thêm mục `## Oracle` ở mục 7 vào `RULE_GLOBAL.md`.

```bash
git add RULE_GLOBAL.md outputs/demo/tasks/PROJ-1234/test-cases
git commit -m "feat(rule): mục Oracle — cấm tautology, ép neo nguồn, fixture phân biệt, OBSERVATION

Sửa 5 expected yếu thành có neo. Bộ hiện tại: <N> case, <X> dòng oracle rỗng còn lại."
```

---

## Tự kiểm

- [ ] Tôi định nghĩa được oracle độc lập bằng hai điều kiện.
- [ ] Tôi nhận ra **cả ba** dạng tautology tinh vi ở mục 2.
- [ ] Tôi dùng được phép thử: *"nếu công thức sai thì test này có đỏ không?"*
- [ ] Mọi expected tôi sửa đều nêu giá trị cụ thể và trỏ về một mã nguồn.
- [ ] Tôi giải thích được vì sao `toContain` yếu hơn so khớp toàn chuỗi.
- [ ] Tôi thiết kế được một fixture phân biệt, và nói được kết luận cho **cả hai** kết quả có thể.
- [ ] Tôi biết ghi `OBSERVATION` khi không neo được, và **không** ghi PASS.
- [ ] `RULE_GLOBAL.md` của tôi đã có mục Oracle.

## Bài tập về nhà

Lấy **một bộ testcase thật** đang dùng ở dự án bạn. Chạy script đếm ở Bước 1 lên nó và ghi ba con số:

1. Bao nhiêu phần trăm case có dòng oracle rỗng?
2. Bao nhiêu phần trăm case không trỏ về nguồn nào?
3. Trong số case kiểm tính toán, bao nhiêu case lấy số liệu từ **màn hình** để tính kỳ vọng?

Con số thứ ba là con số đáng sợ nhất, vì những case đó **luôn xanh** và không ai biết. Đừng sửa hàng loạt bây
giờ — Bài 14 sẽ cho bạn gate, và Bài 19 sẽ cho bạn cách **đo** xem bộ kiểm có bắt được lỗi giá trị hay không.

## Đọc thêm

- Bài 19 sẽ đo chính điều này bằng cách tiêm lỗi giá trị vào. Con số thật ở kit này lần đầu đo được là
  **0/4** — bộ kiểm hiển thị không bắt được lỗi giá trị nào, vì phạm vi nó là *kiểm kê trường*, không phải
  *kiểm giá trị*.
- Bài 8 chuyển sang câu hỏi khác: bộ case của bạn đang trống hẳn **loại câu hỏi** nào.
