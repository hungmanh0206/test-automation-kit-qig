# Bài 1 — Trước khi automate: một testcase đúng trông như thế nào?

> **2 giờ** · Có gì trong tay: chưa có gì · Sau bài này: bạn đã tự tìm ra một bug bằng tay, và biết automation sắp thay bạn làm chặng nào

**Vấn đề**

Bạn được giao kiểm màn tạo đơn hàng trên OPS. Requirement nói phí dịch vụ được tính theo một quy
tắc cụ thể, phụ thuộc loại đơn và chương trình học.

Bạn mở màn, chọn học viên, chọn khoá, bấm qua Next rồi Finish rồi Confirm. Màn hình hiện một con số
ở dòng Total.

Con số đó đúng không?

Bạn chưa biết. Vì bạn chưa tính con số nào của riêng mình để so vào.

> Tài liệu này thực hành trên một sản phẩm nhỏ chạy trên máy bạn, không phải trên OPS. Lý do đơn
> giản: bạn cần một chỗ tự do bấm và cố tình làm sai. Nhưng mọi tình huống mở bài đều là tình huống
> thật đã gặp trên OPS và LMS.


**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Bấm xong thì thấy một con số, và không có gì để đối chiếu ngoài cảm giác "trông có vẻ đúng". |
| **Bài này bạn gõ gì** | Không gõ dòng code nào. Bạn test bằng tay, tự tính kết quả từ đặc tả, rồi tìm ra bug đầu tiên. |
| **Xong thì được gì** | Một bug tự tìm được, và một bản đồ chỉ rõ automation sắp thay bạn làm chặng nào. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Năm việc. Bốn việc đầu làm hoàn toàn bằng tay, và đó là cố ý.

1. Nhận việc: chạy sản phẩm, đọc đặc tả, chốt bạn đang kiểm cái gì (20 phút).
2. **Thực hành:** tự tính kết quả trước khi bấm, rồi tìm ra bug đầu tiên (40 phút).
3. Dựng thêm một bộ dữ liệu để biến nghi ngờ thành bằng chứng (20 phút).
4. Nếu mai phải làm lại việc này 100 lần thì sao. Chỗ automation bước vào (25 phút).
5. Ba thứ hay bị gọi lẫn: bộ test, automation project, và test kit (15 phút).

Chưa cài gì ngoài Node.js. Chưa mở trình soạn thảo.

---

## Việc 1 — Nhận việc (20 phút)

### Chạy sản phẩm

Tài liệu này đi kèm một sản phẩm nhỏ để bạn có thứ thật mà bấm.

```bash
node docs/course/assets/app-thuc-hanh/server.js
```

**Bạn sẽ thấy:**

```
Cổng đăng ký khoá học đang chạy ở http://localhost:4010
```

| Thấy khác | Nghĩa là | Làm gì |
|---|---|---|
| `command not found: node` | Chưa cài Node.js | Cài bản LTS ở nodejs.org, rồi mở lại terminal |
| `EADDRINUSE: address already in use` | Cổng 4010 đang bận | `PORT=4011 node server.js` |
| Không in gì, con trỏ đứng im | Bình thường. Nó đang chạy | Mở trình duyệt |

Mở `http://localhost:4010`. Bạn có một trang tạo đơn: chọn học viên, chọn khoá học, nhập số suất.

Bấm thử một lần cho quen tay. Chưa cần kết luận gì.

### Đọc đặc tả, và chỉ đọc bốn dòng

Mở [`spec.md`](assets/app-thuc-hanh/spec.md) ở một cửa sổ khác. Nó dài, nhưng việc hôm nay chỉ cần
bốn luật:

| Mã | Luật |
|---|---|
| `BR-02` | Tạm tính = tổng (đơn giá × số suất) |
| `BR-03` | Giảm giá theo chương trình: Standard 0%, Pro 3%, Elite 5% |
| `BR-04` | Phí dịch vụ 50.000. Miễn phí khi **tạm tính** đạt 500.000 |
| `BR-05` | Tổng tiền = Tạm tính − Giảm giá + Phí dịch vụ |

Để ý chữ **tạm tính** ở `BR-04`. Nó sẽ quan trọng trong hai mươi phút nữa.

### Chốt lại: bạn đang kiểm cái gì

Trước khi bấm tiếp, viết ra ba câu trả lời. Viết ra giấy cũng được:

| Câu hỏi | Câu trả lời cho việc hôm nay |
|---|---|
| Tôi đang kiểm điều gì? | Bốn luật `BR-02` tới `BR-05` trên màn tạo đơn |
| Sai thì rủi ro là gì? | Sai tiền. Khách trả thừa hoặc công ty thu thiếu |
| "Đúng" nghĩa là gì, lấy chuẩn từ đâu? | Từ `spec.md`, không từ con số sản phẩm đang hiện |

Ba câu này nghe hình thức. Nhưng dòng thứ ba là dòng phân biệt một phép kiểm với một lần bấm thử, và
nó sẽ quay lại ở mọi bài còn lại của tài liệu này.

## Việc 2 — Tự tính trước, bấm sau (40 phút)

Đây là thói quen quan trọng nhất của cả tài liệu, và nó không cần công cụ nào:

> **Viết ra con số bạn kỳ vọng. Rồi mới nhìn con số sản phẩm trả về.**

Thứ tự đó quan trọng. Nhìn trước rồi mới tính thì bạn sẽ vô thức tính sao cho khớp.

### Tính bằng tay

Lấy giấy. Học viên `HV03` (chương trình Elite, giảm 5%), khoá học `KH01` (đơn giá 260.000), số
suất 2:

```
Tạm tính      = 260.000 × 2            = 520.000     (BR-02)
Giảm giá      = 520.000 × 5%           =  26.000     (BR-03)
Phí dịch vụ   : tạm tính 520.000 đã ĐẠT mốc 500.000
                nên theo BR-04 phải MIỄN
                                       =       0     (BR-04)
Tổng phải thu = 520.000 − 26.000 + 0   = 494.000     (BR-05)
```

Khoanh con số `494.000` lại. Đó là thứ bạn mang đi so.

Để ý dòng phí dịch vụ. Tạm tính đã vượt mốc, nên theo `BR-04` con số đó phải là **0**. Đây là chỗ
đáng nhìn kỹ nhất trong cả phép tính.

### Giờ mới bấm

Nhập đúng bộ đó trên trang, bấm Tạo đơn.

**Bạn sẽ thấy** con số sản phẩm trả về **khác** con số bạn vừa tính.

Đừng kết luận ai sai. Việc tiếp theo là tìm chỗ lệch, và cách làm là đi từng khâu:

| Khâu | Bạn tính | Sản phẩm trả | Khớp? |
|---|---|---|---|
| Tạm tính | 520.000 | | |
| Giảm giá | 26.000 | | |
| Phí dịch vụ | **0** | | |
| Tổng phải thu | 494.000 | | |

Điền cột thứ ba vào từ màn hình. Hai dòng đầu khớp. Dòng phí dịch vụ thì không: nó hiện `50.000`,
nên tổng thành `544.000` thay vì `494.000`. Lệch đúng bằng tiền phí.

| Thấy khác | Nghĩa là | Làm gì |
|---|---|---|
| Cả bốn dòng đều khớp | Bạn nhập khác bộ dữ liệu ở trên | Kiểm lại mã học viên và số suất |
| Tạm tính đã lệch | Đơn giá `KH01` khác con số bạn dùng | Mở lại `spec.md` phần bảng giá |
| Màn hình không hiện đủ bốn dòng | Bạn đang xem màn danh sách, không phải màn chi tiết | Bấm vào đơn vừa tạo |

### Vì sao nó lệch

Sản phẩm đang so mốc `500.000` với số **sau khi trừ giảm giá**, chứ không phải với tạm tính:

```
tạm tính               520.000  ≥ 500.000   → BR-04 nói MIỄN phí
sau khi trừ giảm giá   494.000  < 500.000   → sản phẩm thu 50.000
```

Mà `BR-04` nói rõ mốc so trên **tạm tính**. Chọn sai một trong hai số đó là chọn sai cả kết quả, và
với phần lớn bộ dữ liệu khác thì hai cách so cho **cùng một đáp án** nên không ai thấy gì.

Đến đây bạn có một nghi ngờ có cơ sở. Chưa phải bằng chứng. Việc 3 lo phần đó.

## Việc 3 — Biến nghi ngờ thành bằng chứng (20 phút)

Bạn đang có một nghi ngờ: *"nó so mốc trên số sau giảm giá."*

Nhưng có một giải thích thứ hai cũng khớp hoàn hảo với những gì bạn vừa thấy: *"nó luôn thu phí dịch
vụ, bất kể mốc nào."*

Với bộ dữ liệu vừa rồi, **cả hai giải thích cho cùng một con số** `544.000`. Nên bạn chưa phân biệt
được cái nào đúng. Và mang một nghi ngờ chưa phân biệt được sang cho Dev thì họ sẽ tự phân biệt hộ
bạn, thường là theo hướng "không tái hiện được".

### Dựng một bộ dữ liệu mà hai giải thích cho hai đáp án khác nhau

Điều kiện cần: **cả tạm tính và số sau giảm giá đều vượt mốc**. Lúc đó:

| Giải thích | Nó sẽ làm gì | Phí dịch vụ |
|---|---|---|
| A. So mốc trên số sau giảm giá | Số sau giảm cũng vượt mốc, nên vẫn miễn | 0 |
| B. Luôn thu phí bất kể mốc | Vẫn thu | 50.000 |

Hai đáp án khác nhau. Đó là điều kiện của một phép thử phân biệt được.

Vẫn học viên `HV03` (Elite, giảm 5%), nhưng **3 suất** thay vì 2:

```
Tạm tính              = 260.000 × 3   = 780.000    ≥ 500.000
Giảm giá              = 780.000 × 5%  =  39.000
Sau khi trừ giảm giá  = 741.000                    ≥ 500.000  ← cả hai đều vượt mốc

nếu giải thích A đúng → phí = 0        → tổng 741.000
nếu giải thích B đúng → phí = 50.000   → tổng 791.000
```

Bấm thử bộ đó.

**Bạn sẽ thấy** nó trả về `741.000`. Phí dịch vụ bằng 0.

Vậy giải thích B **bị loại**: sản phẩm không hề luôn thu phí, nó biết miễn khi số nó đang so vượt
mốc. Chỉ có điều nó so sai số.

Giờ bạn có một bằng chứng, không còn là nghi ngờ. Và bạn nói được thành một câu Dev đọc là sửa được:

> Với `HV03` + `KH01` × 2: `BR-04` nói miễn phí vì tạm tính `520.000` đã đạt mốc `500.000`, nhưng
> sản phẩm thu `50.000`. Với × 3 thì nó miễn đúng. Nên mốc đang được so với số **sau giảm giá**
> (`494.000`) thay vì với tạm tính.

> Ghi lại bốn bước bạn vừa làm, vì đó là phương pháp của cả tài liệu này:
>
> 1. Đọc đặc tả, viết ra con số kỳ vọng.
> 2. Chạy, ghi con số thực tế.
> 3. Lệch thì đi từng khâu tìm chỗ lệch.
> 4. Dựng thêm một bộ dữ liệu **phân biệt được** hai giải thích.
>
> Bước 4 là bước người ta hay bỏ. Bỏ nó thì bạn mang sang cho Dev một nghi ngờ, và họ sẽ trả về.

### Vì sao sản phẩm này cố tình có bug

Nếu bạn thực hành trên một sản phẩm đúng hoàn toàn thì mọi phép kiểm của bạn đều xanh. Và bạn không
có cách nào biết nó xanh **vì sản phẩm đúng** hay **vì phép kiểm của bạn mù**. Hai thứ đó cho cùng
một dấu hiệu.

Sản phẩm này có đúng 3 bug, biết trước. Nên nếu bộ kiểm của bạn bắt được 0/3 thì lỗi nằm ở bộ kiểm,
không ở sản phẩm.

Hai bug còn lại bạn sẽ gặp ở Bài 9 và Bài 10. Đừng mở [`BUGS.md`](assets/app-thuc-hanh/BUGS.md) trước
khi làm hết Phần 2. Mở sớm thì mất luôn phép đối chứng này.

## Việc 4 — Nếu mai phải làm lại 100 lần thì sao (25 phút)

Bạn vừa hoàn thành một vòng kiểm thử đầy đủ. Không dùng công cụ nào.

Giờ đếm thời gian: bốn mươi phút cho **một** bộ dữ liệu.

Mà bốn luật `BR-02` tới `BR-05` có nhiều bộ đáng kiểm hơn thế. Chương trình có ba mức. Mốc 500.000 có
ba điểm đáng thử là ngay dưới, đúng bằng, ngay trên. Nhân lên là chín bộ, và đó chỉ là một màn hình.

Rồi tuần sau Dev sửa một chỗ khác, và bạn phải làm lại cả chín bộ.

Đó là lúc automation có lý do tồn tại. Không phải vì nó hiện đại.

### Vòng bạn vừa đi, vẽ ra

```
Requirement  →  Prepare  →  Execute  →  Compare  →  Report
```

| Chặng | Bạn vừa làm gì | Máy làm được không |
|---|---|---|
| **Requirement** | Đọc `spec.md`, chốt bốn luật, chốt ba câu hỏi | **Không.** Đây là việc của bạn |
| **Prepare** | Chọn học viên `HV02`, khoá học `KH01`, số suất 2 | Được, và nhanh hơn nhiều |
| **Execute** | Bấm qua ba ô rồi bấm Tạo đơn | Được. Đây là chặng máy giỏi nhất |
| **Compare** | Tính `494.000` rồi so với màn hình | Được, **nếu** bạn nói cho nó số nào là đúng |
| **Report** | Chưa làm. Con số đang nằm trong đầu bạn | Được, và làm tốt hơn bạn |

Dòng đầu là dòng đáng để ý nhất. Máy không đọc được đặc tả để tự biết `494.000` là đúng. Nó chỉ biết
con số bạn đưa cho nó.

Nghĩa là nếu bạn đưa sai, nó sẽ xanh và sai cùng bạn. Cả tài liệu này xoay quanh việc chặn đúng
chuyện đó.

<details>
<summary><b>Xem trước:</b> vòng đầy đủ trong một dự án thật có 11 chặng</summary>

Năm chặng ở trên là bản gọn, đủ để hiểu automation thay bạn làm gì. Trong một dự án có nhiều người,
vòng đó dài hơn:

```
Requirement → Phân tích scope → Thiết kế testcase → QA review → Quản lý testcase
   → Automation execution → Evidence + Report → Triage → Bug → Dev fix → Rerun
```

Bạn chưa cần nhìn 11 chặng lúc này. Đưa vào đây để nếu tò mò thì có chỗ xem, và để bạn biết năm chặng
kia không phải toàn bộ câu chuyện.

Sáu chặng đầu học ở Phần 1 và 2. Năm chặng sau học ở Phần 3 và 4.

</details>

## Việc 5 — Bộ test, project, và kit (15 phút)

Ba cụm này hay bị gọi lẫn, và ranh giới giữa chúng quyết định bạn đang dựng cái gì.

| | Là gì | Dấu hiệu | Sang dự án khác |
|---|---|---|---|
| **Một bộ test** | Vài file test chạy được | Chạy bằng cách gõ tên file | Viết lại từ đầu |
| **Một automation project** | Bộ test + cấu trúc + cấu hình + CI | Có `package.json`, có lệnh `npm run`, thư mục rõ ràng | Copy rồi sửa nhiều chỗ |
| **Một test kit** | Project + tách hai tầng + quy trình + máy kiểm | Đổi dự án bằng cách đổi **một file cấu hình** | Clone, khai profile, chạy |

Khác biệt thật nằm ở cột cuối. Một automation project tốt vẫn gắn với sản phẩm nó được viết cho: địa
chỉ nằm trong code, dữ liệu test là bản ghi có sẵn trên môi trường, quy tắc nghiệp vụ rải trong từng
phép so.

Một kit thì tách làm hai tầng:

| Tầng | Chứa gì | Mang sang dự án mới |
|---|---|---|
| **Chung** | Khung chạy, cách dựng dữ liệu, cách thu bằng chứng, máy kiểm, quy trình | Không sửa một chữ |
| **Dự án** | Địa chỉ, tài khoản, quy tắc nghiệp vụ, bản đồ tên trường | Khai lại một lần |

Giữ được ranh giới đó là việc khó nhất của cả tài liệu, và Bài 28 sẽ chỉ ra vì sao nhầm ranh giới
không phải chuyện gọn gàng mà là chuyện an toàn.

### Và cái gì không phải kit

Một thư mục có 200 file test mà không ai dám xoá cái nào. Một bộ test mà cách duy nhất để biết nó còn
đúng là chạy lên xem có đỏ không. Một quy trình nằm trong đầu một người.

Ba thứ đó rất phổ biến, và chúng đều là một đống script. Khác biệt không nằm ở số suất test.

## Gọi tên những gì bạn vừa làm

Giờ mới đặt tên, vì bạn đã chạm vào từng thứ rồi. Cột thứ ba là cột làm bảng này khác một từ điển.

| Từ | Nghĩa gọn | Bạn vừa gặp nó ở đâu |
|---|---|---|
| **Đặc tả** | Tài liệu nói sản phẩm phải làm gì | `spec.md`, bốn luật ở Việc 1 |
| **Test Data** | Dữ liệu bạn đưa vào trước khi chạy | Học viên `HV02`, khoá học `KH01`, số suất 2 |
| **Precondition** | Trạng thái phải có trước khi kiểm | Phải tồn tại một học viên chương trình Pro và một sản phẩm còn hàng |
| **Expected Result** | Con số bạn viết ra **trước** khi bấm | `494.000` bạn tính trên giấy ở Việc 2 |
| **Actual Result** | Con số sản phẩm trả về | Con số bạn điền vào cột thứ ba của bảng |
| **Oracle** | Căn cứ để nói cái nào đúng | `BR-04`, chỗ nói mốc so trên *tạm tính* |
| **Triage** | Việc tìm xem hai số lệch nhau vì đâu | Việc bạn làm khi đi từng khâu ở Việc 2 |
| **Bug biên** | Lỗi chỉ lộ ra ngay chỗ chuyển trạng thái | Tạm tính đúng `520.000`, ngay trên mốc, ở Việc 3 |
| **Đối chứng** | Biết trước đáp án để đo xem cách kiểm có hiệu quả | Biết có 3 bug, bắt 0/3 thì bộ kiểm mù |
| **Gate** | Máy chặn, không cho đi tiếp khi có vi phạm | Chưa gặp. Bài 2 bạn viết cái đầu tiên |

Ba từ hay bị dùng sai nhất, nói rõ luôn:

**Oracle không phải Expected Result.** Expected Result là con số `494.000`. Oracle là **lý do** con
số đó là `494.000`, tức là `BR-02` cộng `BR-03` cộng `BR-04`. Viết được con số mà không chỉ được mã
luật thì bạn đang đoán, và Bài 13 dựng một máy chặn đúng chuyện đó.

**"Không phán được" không phải là Pass.** Nếu bạn không đọc được con số vì trang lỗi, kết quả là
*chưa đo được*, không phải *đạt*. Trộn hai thứ này là cách bảng kết quả trở nên đẹp trong khi độ phủ
thật giảm đi.

**"Nhất quán" không phải "đúng".** Hai màn hình cùng hiện một con số chỉ chứng minh chúng đọc chung
một nguồn. Cả hai vẫn có thể sai so với `spec.md`.

## Cây thư mục sau bài này

Trước khi sang Bài 2, ghi lại điểm xuất phát. Tạo `docs/xuat-phat.md` trong thư mục bạn sẽ làm việc:

```markdown
# Điểm xuất phát — <ngày>

## Hiện tại tôi kiểm thử thế nào
(viết thật, kể cả nếu câu trả lời là "bấm tay và ghi vào Excel")

## Trong 5 chặng ở Việc 4, chặng nào tốn nhiều thời gian nhất
## Nếu chỉ tự động hoá được MỘT chặng, tôi chọn chặng nào, vì sao
```

```
kit-cua-toi/
└── docs/
    └── xuat-phat.md              ← MỚI · mở lại ở Bài 29 để đối chiếu
```

Đúng một file, và nó không phải code. Bài 2 mới bắt đầu dựng repo.

Nghe hình thức, nhưng nó có tác dụng thật: trí nhớ về *"hồi đó khổ thế nào"* mờ rất nhanh. Không có
file này thì bạn không có cách nào đo mình đã đi được bao xa.

## Bộ kit của bạn đang ở đâu

```
CẤP ĐỘ 1 · AUTOMATE      bài 1/4 của cấp độ này
███████░░░░░░░░░░░░░░░░░░░░░

cả tài liệu           bài 1/29
█░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

**Hết cấp độ 1 bạn nói được:** Tôi chạy được test và tôi hiểu kết quả của nó.

Cấp độ này còn 3 bài nữa.

## Tự kiểm

1. Vì sao phải viết con số kỳ vọng ra giấy **trước** khi bấm, chứ không phải sau?
2. Ba câu hỏi ở Việc 1 là gì? Câu nào phân biệt một phép kiểm với một lần bấm thử?
3. Bước thứ tư trong phương pháp ở Việc 3 là gì? Bỏ nó thì bạn thiếu cái gì?
4. Vì sao bộ dữ liệu ở Việc 2 **không** phân biệt được hai giải thích?
5. Vì sao sản phẩm thực hành cố tình có bug?
6. Trong 5 chặng ở Việc 4, chặng nào máy **không** làm được, và vì sao?
7. Câu "nếu bạn đưa sai, nó sẽ xanh và sai cùng bạn" nói về chặng nào?
8. Ba mức bộ test, project, kit. Ranh giới thật nằm ở đâu?
9. Oracle khác Expected Result ở chỗ nào?
10. Vì sao hai màn hình cùng hiện một con số vẫn chưa chứng minh được gì?

## Bài tập về nhà

Lấy một chức năng của sản phẩm bạn đang test thật, và làm đúng Việc 1 và Việc 2 lên nó: đọc tài liệu,
viết ra kết quả kỳ vọng, rồi mới thao tác.

Đếm hai con số:

1. Bao nhiêu chỗ bạn **không viết ra được** kết quả kỳ vọng vì tài liệu không nói?
2. Bao nhiêu chỗ bạn viết ra được, nhưng bằng cách nhớ *"lâu nay nó chạy thế"*?

Con số thứ hai là phần nguy hiểm. Đó là chỗ bạn đang lấy chính sản phẩm làm chuẩn đối chiếu, mà không
nhận ra. Bài 13 dựng một máy chặn đúng chuyện đó.

## Bài sau

Bốn mươi phút cho một bộ dữ liệu, và bạn còn tám bộ nữa. Nên từ Bài 2 chúng ta bắt đầu dựng chỗ làm
việc cho máy.

Bài 2 ngắn, và có một chi tiết nghe nhỏ mà đắt: `.gitignore` được viết trước cả README. Vì chỉ cần
một lần `git add .` lúc chưa có nó là đủ đẩy tài khoản hoặc dữ liệu khách lên repo, mà lịch sử git
thì không xoá sạch được dễ dàng.
