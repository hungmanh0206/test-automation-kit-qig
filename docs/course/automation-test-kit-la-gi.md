# Bài 1 — Trước khi automate: một testcase đúng trông như thế nào?

> **2 giờ** · Có gì trong tay: chưa có gì · Sau bài này: bạn đã tự tìm ra một bug bằng tay, và biết automation sắp thay bạn làm chặng nào

**Vấn đề**

Học viên xin học lại khoá sau. Việc này chạy hằng ngày trên OPS: hệ thống nhận đơn học lại, xếp học
viên vào lớp mới, rồi **cắt hạn truy cập lớp cũ** lại cho khớp. Không để hai lớp cùng mở.

Bạn được giao kiểm chuyện đó. Bạn mở màn Lớp › Học viên, chọn một học viên, bấm đồng bộ. Cột thời hạn
đổi sang một ngày mới.

Ngày đó đúng không?

Bạn chưa biết. Vì bạn chưa tự suy ra ngày nào của riêng mình để so vào.

> Tài liệu này thực hành trên một sản phẩm nhỏ chạy trên máy bạn, không phải trên OPS. Lý do đơn
> giản: bạn cần một chỗ tự do bấm và cố tình làm sai. Nhưng mọi tình huống mở bài đều là tình huống
> thật đã gặp trên OPS và LMS.


**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Bấm xong thì thấy một ngày, và không có gì để đối chiếu ngoài cảm giác "trông có vẻ đúng". |
| **Bài này bạn gõ gì** | Không gõ dòng code nào. Bạn test bằng tay, tự suy kết quả từ đặc tả, rồi tìm ra bug đầu tiên. |
| **Xong thì được gì** | Một bug tự tìm được, và một bản đồ chỉ rõ automation sắp thay bạn làm chặng nào. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Năm việc. Bốn việc đầu làm hoàn toàn bằng tay, và đó là cố ý.

1. Nhận việc: chạy sản phẩm, đọc đặc tả, chốt bạn đang kiểm cái gì (20 phút).
2. **Thực hành:** tự suy kết quả trước khi bấm, rồi tìm ra bug đầu tiên (40 phút).
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
Vận hành lớp học đang chạy: http://localhost:4010
```

| Thấy khác | Nghĩa là | Làm gì |
|---|---|---|
| `command not found: node` | Chưa cài Node.js | Cài bản LTS ở nodejs.org, rồi mở lại terminal |
| `EADDRINUSE: address already in use` | Cổng 4010 đang bận | `PORT=4011 node server.js` |
| Không in gì, con trỏ đứng im | Bình thường. Nó đang chạy | Mở trình duyệt |

Mở `http://localhost:4010`. Bạn có ba khối: chọn lớp, bảng học viên trong lớp, và khối đồng bộ học
lại.

Bấm thử **Xem hạn mới** một lần cho quen tay. Chưa cần kết luận gì.

### Đọc đặc tả, và chỉ đọc bốn dòng

Mở [`spec.md`](assets/app-thuc-hanh/spec.md) ở một cửa sổ khác. Nó dài, nhưng việc hôm nay chỉ cần
bốn luật:

| Mã | Luật |
|---|---|
| `BR-02` | Lớp mốc là lớp mới **loại Lớp chính** có ngày bắt đầu sớm nhất. Foundation và Revision không được dùng làm mốc |
| `BR-03` | Hạn mới của lớp cũ = ngày bắt đầu lớp mốc **trừ 1 ngày** |
| `BR-05` | Nếu hạn mới sớm hơn ngày bắt đầu lớp cũ thì lấy ngày bắt đầu lớp cũ |
| `BR-06` | Chưa có lớp mới nào thì giữ nguyên hạn |

Để ý chữ **Lớp chính** ở `BR-02`. Nó sẽ quan trọng trong hai mươi phút nữa.

### Chốt lại: bạn đang kiểm cái gì

Trước khi bấm tiếp, viết ra ba câu trả lời. Viết ra giấy cũng được:

| Câu hỏi | Câu trả lời cho việc hôm nay |
|---|---|
| Tôi đang kiểm điều gì? | Bốn luật `BR-02`, `BR-03`, `BR-05`, `BR-06` ở khối đồng bộ học lại |
| Sai thì rủi ro là gì? | Học viên mất quyền vào lớp sớm hơn quyền họ đã mua, hoặc giữ quyền lâu hơn |
| "Đúng" nghĩa là gì, lấy chuẩn từ đâu? | Từ `spec.md`, không từ ngày sản phẩm đang hiện |

Ba câu này nghe hình thức. Nhưng dòng thứ ba là dòng phân biệt một phép kiểm với một lần bấm thử, và
nó sẽ quay lại ở mọi bài còn lại của tài liệu này.

## Việc 2 — Tự suy trước, bấm sau (40 phút)

Đây là thói quen quan trọng nhất của cả tài liệu, và nó không cần công cụ nào:

> **Viết ra kết quả bạn kỳ vọng. Rồi mới nhìn kết quả sản phẩm trả về.**

Thứ tự đó quan trọng. Nhìn trước rồi mới suy thì bạn sẽ vô thức suy sao cho khớp.

### Suy bằng tay

Lấy giấy. Học viên `HV01`, lớp cũ `CFA01` (đang có hạn tới 31/07/2026). Bảng đơn học lại trong
`spec.md` nói học viên này đã được xếp vào **hai** lớp mới:

| Lớp mới | Loại | Bắt đầu |
|---|---|---|
| `CFA02F` | Foundation | 01/07/2026 |
| `CFA02` | **Lớp chính** | 01/09/2026 |

Giờ áp luật:

```
Lớp mốc   : chỉ xét lớp LOẠI LỚP CHÍNH   → CFA02          (BR-02)
            CFA02F là Foundation, KHÔNG được dùng làm mốc
Ngày mốc  : CFA02 bắt đầu                  01/09/2026
Hạn mới   : ngày mốc trừ 1 ngày          = 31/08/2026     (BR-03)
Kiểm BR-05: 31/08/2026 có sớm hơn ngày bắt đầu lớp cũ (01/03/2026)?
            Không. Giữ 31/08/2026.
```

Khoanh ngày `31/08/2026` lại. Đó là thứ bạn mang đi so.

Để ý bước đầu tiên. Có **hai** lớp mới, và luật chỉ cho phép **một** trong hai được làm mốc. Đây là
chỗ đáng nhìn kỹ nhất trong cả phép suy này.

### Giờ mới bấm

Chọn `HV01` ở khối đồng bộ học lại, bấm **Xem hạn mới**.

**Bạn sẽ thấy** ngày sản phẩm trả về **khác** ngày bạn vừa suy ra.

Đừng kết luận ai sai. Việc tiếp theo là tìm chỗ lệch, và cách làm là đi từng khâu:

| Khâu | Bạn suy ra | Sản phẩm trả | Khớp? |
|---|---|---|---|
| Lớp cũ | `CFA01` | | |
| Lớp lấy làm mốc | `CFA02` (Lớp chính) | | |
| Hạn hiện tại | 31/07/2026 | | |
| Hạn mới | **31/08/2026** | | |

Điền cột thứ ba vào từ màn hình. Hai dòng đầu đã đủ chỉ ra vấn đề: sản phẩm hiện lớp mốc là
`CFA02F (Foundation)`, và hạn mới là `30/06/2026` thay vì `31/08/2026`.

| Thấy khác | Nghĩa là | Làm gì |
|---|---|---|
| Cả bốn dòng đều khớp | Bạn đang chọn học viên khác | Kiểm lại ô Học viên, phải là `HV01` |
| Ô lớp mốc hiện dấu gạch | Đơn học lại chưa có lớp mới nào | Gọi `POST /api/reset` rồi thử lại |
| Không có ô nào đổi | Bạn chưa bấm **Xem hạn mới** | Bấm nút đó, không phải nút Áp dụng |

Chỗ sản phẩm này in ra **lớp nó đã chọn làm mốc**, không chỉ in ra ngày cuối, là một may mắn: nó cho
bạn thấy bước trung gian. Hệ thống thật thường không có. Bài 12 nói về việc đòi cho được những bước
trung gian đó.

### Vì sao nó lệch

Sản phẩm đang xếp mọi lớp mới theo ngày bắt đầu rồi lấy lớp sớm nhất, **bất kể loại lớp**:

```
mọi lớp mới, xếp theo ngày    CFA02F  01/07/2026   ← sản phẩm lấy cái này
                              CFA02   01/09/2026
chỉ lớp CHÍNH, xếp theo ngày  CFA02   01/09/2026   ← BR-02 nói phải lấy cái này
```

Mà `BR-02` nói rõ mốc chỉ lấy trong **lớp chính**. Học viên vì thế mất quyền vào lớp cũ **sớm hơn
hai tháng** so với thứ đặc tả cho phép.

Đến đây bạn có một nghi ngờ có cơ sở. Chưa phải bằng chứng. Việc 3 lo phần đó.

## Việc 3 — Biến nghi ngờ thành bằng chứng (20 phút)

Bạn đang có một nghi ngờ: *"nó chọn sai lớp làm mốc."*

Nhưng có một giải thích thứ hai cũng khớp hoàn hảo với những gì bạn vừa thấy: *"công thức cắt hạn của
nó hỏng hoàn toàn, sai với mọi học viên."*

Với bộ dữ liệu vừa rồi, **cả hai giải thích cho cùng một kết quả** `30/06/2026`. Nên bạn chưa phân
biệt được cái nào đúng. Và hai giải thích đó dẫn tới hai kết luận rất khác nhau:

| Giải thích | Ai bị ảnh hưởng | Nghiêm trọng thế nào |
|---|---|---|
| A. Chọn sai lớp làm mốc | Chỉ học viên có lớp đi kèm bắt đầu sớm hơn lớp chính | Một nhánh dữ liệu |
| B. Công thức cắt hạn hỏng | **Mọi** học viên học lại | Chặn phát hành |

Mang một nghi ngờ chưa phân biệt được sang cho Dev thì họ sẽ tự phân biệt hộ bạn, thường là theo
hướng "không tái hiện được".

### Dựng một bộ dữ liệu mà hai giải thích cho hai kết quả khác nhau

Điều kiện cần: một học viên mà **chỉ có đúng một** lớp mới, và lớp đó là lớp chính. Lúc đó bước
"chọn lớp nào" không còn chỗ để sai, vì chỉ có một ứng viên. Kết quả vẫn lệch thì lỗi nằm ở phép tính
ngày; kết quả đúng thì lỗi nằm ở bước chọn.

| Giải thích | Nó sẽ trả gì cho ca một-lớp-mới |
|---|---|
| A. Chọn sai lớp làm mốc | Đúng — vì không có lớp nào khác để chọn sai |
| B. Công thức cắt hạn hỏng | Vẫn sai |

Hai kết quả khác nhau. Đó là điều kiện của một phép thử phân biệt được.

Học viên `HV03` là ca đó: lớp cũ `ACCA01`, và đúng một lớp mới `ACCA02` (Lớp chính, bắt đầu
01/09/2026).

```
Lớp mốc : chỉ có một ứng viên             → ACCA02
Hạn mới : 01/09/2026 trừ 1 ngày           = 31/08/2026
```

Chọn `HV03`, bấm **Xem hạn mới**.

**Bạn sẽ thấy** nó trả về `31/08/2026`. Đúng bằng ngày bạn suy ra.

Vậy giải thích B **bị loại**: phép trừ ngày của sản phẩm không hỏng, và cắt hạn vẫn chạy đúng với
học viên bình thường. Chỉ có điều nó chọn sai ứng viên khi có nhiều hơn một lớp mới.

Giờ bạn có một bằng chứng, không còn là nghi ngờ. Và bạn nói được thành một câu Dev đọc là sửa được:

> Với `HV01`: `BR-02` nói mốc lấy theo lớp chính `CFA02` (01/09) nên hạn mới phải là `31/08/2026`,
> nhưng sản phẩm lấy `CFA02F` (Foundation, 01/07) và trả `30/06/2026`. Với `HV03`, tức ca chỉ có một
> lớp mới, nó trả đúng. Nên lỗi nằm ở bước **chọn lớp mốc**, không ở phép trừ ngày.

> Ghi lại bốn bước bạn vừa làm, vì đó là phương pháp của cả tài liệu này:
>
> 1. Đọc đặc tả, viết ra kết quả kỳ vọng.
> 2. Chạy, ghi kết quả thực tế.
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

Giờ đếm thời gian: bốn mươi phút cho **một** học viên.

Mà bốn luật `BR-02`, `BR-03`, `BR-05`, `BR-06` có nhiều ca đáng kiểm hơn thế. Nhóm lớp mới có ba
hình dạng đáng thử: một lớp chính, lớp chính kèm Foundation bắt đầu sớm hơn, và lớp chính kèm
Foundation bắt đầu muộn hơn. Nhánh `BR-05` có ba điểm đáng thử quanh chỗ hạn mới rơi đúng vào ngày
bắt đầu lớp cũ. Cộng thêm nhánh `BR-06`. Nhân lên là mười ca, và đó chỉ là một khối trên một màn.

Rồi tuần sau Dev sửa một chỗ khác, và bạn phải làm lại cả mười ca.

Đó là lúc automation có lý do tồn tại. Không phải vì nó hiện đại.

### Vòng bạn vừa đi, vẽ ra

```
Requirement  →  Prepare  →  Execute  →  Compare  →  Report
```

| Chặng | Bạn vừa làm gì | Máy làm được không |
|---|---|---|
| **Requirement** | Đọc `spec.md`, chốt bốn luật, chốt ba câu hỏi | **Không.** Đây là việc của bạn |
| **Prepare** | Chọn học viên `HV01`, biết trước nhóm lớp mới của họ gồm những gì | Được, và nhanh hơn nhiều |
| **Execute** | Chọn học viên rồi bấm Xem hạn mới | Được. Đây là chặng máy giỏi nhất |
| **Compare** | Suy ra `31/08/2026` rồi so với màn hình | Được, **nếu** bạn nói cho nó kết quả nào là đúng |
| **Report** | Chưa làm. Ngày đó đang nằm trong đầu bạn | Được, và làm tốt hơn bạn |

Dòng đầu là dòng đáng để ý nhất. Máy không đọc được đặc tả để tự biết `31/08/2026` là đúng. Nó chỉ
biết kết quả bạn đưa cho nó.

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

Ba thứ đó rất phổ biến, và chúng đều là một đống script. Khác biệt không nằm ở số lượng test.

## Gọi tên những gì bạn vừa làm

Giờ mới đặt tên, vì bạn đã chạm vào từng thứ rồi. Cột thứ ba là cột làm bảng này khác một từ điển.

| Từ | Nghĩa gọn | Bạn vừa gặp nó ở đâu |
|---|---|---|
| **Đặc tả** | Tài liệu nói sản phẩm phải làm gì | `spec.md`, bốn luật ở Việc 1 |
| **Test Data** | Dữ liệu bạn đưa vào trước khi chạy | Học viên `HV01` và nhóm lớp mới của họ |
| **Precondition** | Trạng thái phải có trước khi kiểm | Phải tồn tại một đơn học lại, và lớp mới phải đã được xếp |
| **Expected Result** | Kết quả bạn viết ra **trước** khi bấm | `31/08/2026` bạn suy trên giấy ở Việc 2 |
| **Actual Result** | Kết quả sản phẩm trả về | Ngày bạn điền vào cột thứ ba của bảng |
| **Oracle** | Căn cứ để nói cái nào đúng | `BR-02`, chỗ nói mốc lấy theo *lớp chính* |
| **Triage** | Việc tìm xem hai kết quả lệch nhau vì đâu | Việc bạn làm khi đi từng khâu ở Việc 2 |
| **Ca phân biệt** | Bộ dữ liệu mà hai giải thích cho hai kết quả khác nhau | `HV03` — chỉ một lớp mới — ở Việc 3 |
| **Đối chứng** | Biết trước đáp án để đo xem cách kiểm có hiệu quả | Biết có 3 bug, bắt 0/3 thì bộ kiểm mù |
| **Gate** | Máy chặn, không cho đi tiếp khi có vi phạm | Chưa gặp. Bài 2 bạn viết cái đầu tiên |

Ba từ hay bị dùng sai nhất, nói rõ luôn:

**Oracle không phải Expected Result.** Expected Result là ngày `31/08/2026`. Oracle là **lý do** ngày
đó là `31/08/2026`, tức là `BR-02` cộng `BR-03`. Viết được kết quả mà không chỉ được mã luật thì bạn
đang đoán, và Bài 13 dựng một máy chặn đúng chuyện đó.

**"Không phán được" không phải là Pass.** Nếu bạn không đọc được ngày vì trang lỗi, kết quả là
*chưa đo được*, không phải *đạt*. Trộn hai thứ này là cách bảng kết quả trở nên đẹp trong khi độ phủ
thật giảm đi.

**"Nhất quán" không phải "đúng".** Hai màn hình cùng hiện một ngày chỉ chứng minh chúng đọc chung
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

1. Vì sao phải viết kết quả kỳ vọng ra giấy **trước** khi bấm, chứ không phải sau?
2. Ba câu hỏi ở Việc 1 là gì? Câu nào phân biệt một phép kiểm với một lần bấm thử?
3. Bước thứ tư trong phương pháp ở Việc 3 là gì? Bỏ nó thì bạn thiếu cái gì?
4. Vì sao bộ dữ liệu ở Việc 2 **không** phân biệt được hai giải thích?
5. Vì sao ca `HV03`, ca chỉ có một lớp mới, lại loại được giải thích B?
6. Vì sao sản phẩm thực hành cố tình có bug?
7. Trong 5 chặng ở Việc 4, chặng nào máy **không** làm được, và vì sao?
8. Câu "nếu bạn đưa sai, nó sẽ xanh và sai cùng bạn" nói về chặng nào?
9. Oracle khác Expected Result ở chỗ nào?
10. Vì sao hai màn hình cùng hiện một ngày vẫn chưa chứng minh được gì?

## Bài tập về nhà

Lấy một chức năng của sản phẩm bạn đang test thật, và làm đúng Việc 1 và Việc 2 lên nó: đọc tài liệu,
viết ra kết quả kỳ vọng, rồi mới thao tác.

Đếm hai con số:

1. Bao nhiêu chỗ bạn **không viết ra được** kết quả kỳ vọng vì tài liệu không nói?
2. Bao nhiêu chỗ bạn viết ra được, nhưng bằng cách nhớ *"lâu nay nó chạy thế"*?

Con số thứ hai là phần nguy hiểm. Đó là chỗ bạn đang lấy chính sản phẩm làm chuẩn đối chiếu, mà không
nhận ra. Bài 13 dựng một máy chặn đúng chuyện đó.

## Bài sau

Bốn mươi phút cho một học viên, và bạn còn chín ca nữa. Nên từ Bài 2 chúng ta bắt đầu dựng chỗ làm
việc cho máy.

Bài 2 ngắn, và có một chi tiết nghe nhỏ mà đắt: `.gitignore` được viết trước cả README. Vì chỉ cần
một lần `git add .` lúc chưa có nó là đủ đẩy tài khoản hoặc dữ liệu khách lên repo, mà lịch sử git
thì không xoá sạch được dễ dàng.
