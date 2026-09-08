# Bài 1 — Trước khi automate: một testcase đúng trông như thế nào?

> **2 giờ** · Có gì trong tay: chưa có gì · Sau bài này: bạn đã tự tìm ra một bug bằng tay, và biết mình sắp dựng cái gì trong 64 giờ tới

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | "Automation test kit" là một cụm từ nghe to mà không rõ ranh giới. Bắt đầu từ đâu cũng không biết. |
| **Bài này bạn gõ gì** | Chạy một app có bug cài sẵn, tự tìm ra bug đầu tiên bằng tay, rồi vẽ ra dây chuyền bạn sắp dựng. |
| **Xong thì được gì** | Một bug tự tìm được, mười từ vựng dùng cả tài liệu, và một bản đồ để không lạc. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Bốn việc:

1. Chạy app thực hành và tìm bug đầu tiên bằng tay (45 phút).
2. Ba thứ hay bị gọi lẫn: bộ test, automation project, và test kit (25 phút).
3. Mười từ vựng, mỗi từ một ví dụ lấy từ việc vừa làm (25 phút).
4. Vẽ dây chuyền 11 chặng, đánh dấu chặng nào bạn đang làm bằng tay (25 phút).

Chưa cài gì ngoài Node.js. Chưa viết dòng code nào. Đó là cố ý.

---

## Việc 1 — Tìm bug đầu tiên bằng tay (45 phút)

### Chạy app

```bash
node docs/course/assets/app-thuc-hanh/server.js
```

**Bạn sẽ thấy:**

```
Cửa hàng mini đang chạy ở http://localhost:4010
```

| Thấy khác | Nghĩa là | Làm gì |
|---|---|---|
| `command not found: node` | Chưa cài Node.js | Cài bản LTS ở nodejs.org, mở lại terminal |
| `EADDRINUSE: address already in use` | Cổng 4010 đang bận | `PORT=4011 node server.js` |
| Không có gì in ra, con trỏ đứng im | Bình thường. Nó đang chạy | Mở trình duyệt |

Mở `http://localhost:4010`. Bạn có một trang tạo đơn hàng: chọn khách, chọn sản phẩm, nhập số lượng.

### Đọc đặc tả trước khi bấm

Mở [`spec.md`](assets/app-thuc-hanh/spec.md) trong một cửa sổ khác. Đọc bốn luật này, chỉ bốn thôi:

| Mã | Luật |
|---|---|
| `BR-02` | Tạm tính = tổng (đơn giá × số lượng) |
| `BR-03` | Giảm giá theo hạng khách: Thường 0%, Bạc 3%, Vàng 5% |
| `BR-04` | Phí giao hàng 50.000. Miễn phí khi **tạm tính** đạt 500.000 |
| `BR-05` | Tổng tiền = Tạm tính − Giảm giá + Phí giao hàng |

Để ý chữ **tạm tính** ở `BR-04`. Nó sẽ quan trọng trong mười lăm phút nữa.

### Tính bằng tay trước, bấm sau

Đây là thói quen quan trọng nhất của cả tài liệu, và nó rẻ hơn mọi công cụ: **viết ra con số bạn kỳ
vọng, rồi mới nhìn con số app trả về.**

Lấy giấy. Khách `KH02` (hạng Bạc), sản phẩm `SP01` (225.000), số lượng 2:

```
Tạm tính     = 225.000 × 2        = 450.000
Giảm giá     = 450.000 × 3%       =  13.500
Phí giao hàng: 450.000 < 500.000  =  50.000
Tổng tiền    = 450.000 − 13.500 + 50.000 = 486.500
```

Giờ mới bấm. Nhập đúng bộ đó trên trang, bấm Tạo đơn.

**Bạn sẽ thấy** con số app trả về **khác** con số bạn vừa tính.

Đừng vội kết luận ai sai. Đây là lúc dùng đến `spec.md`: đi từng dòng, xem app lệch ở khâu nào.

| Khâu | Bạn tính | App trả | Khớp? |
|---|---|---|---|
| Tạm tính | 450.000 | | |
| Giảm giá | 13.500 | | |
| Phí giao hàng | 50.000 | | |
| Tổng tiền | 486.500 | | |

Điền cột "App trả" vào. Ba dòng đầu thường khớp, dòng phí giao hàng thì không.

### Vì sao nó sai

App đang tính miễn phí giao hàng dựa trên số **sau khi trừ giảm giá**, chứ không phải tạm tính. Mà
`BR-04` nói rõ là **tạm tính**.

Thử thêm một bộ nữa để chắc chắn: khách hạng Vàng (5%), tạm tính đúng `520.000`. Theo `BR-04` thì
miễn phí giao hàng, vì tạm tính đã vượt mốc. Nhưng sau giảm giá còn `494.000`, dưới mốc. Nếu app tính
nhầm chỗ thì nó sẽ thu `50.000` phí.

Bấm thử. Nếu nó thu phí thật, bạn vừa **chứng minh** được chỗ sai chứ không chỉ đoán.

> **Ghi lại cách bạn vừa làm**, vì đó chính là phương pháp của cả tài liệu này:
> 1. Đọc đặc tả, viết ra con số kỳ vọng.
> 2. Chạy, ghi con số thực tế.
> 3. Lệch thì đi từng khâu tìm chỗ lệch.
> 4. Dựng thêm một bộ dữ liệu **phân biệt được** hai giả thuyết, để chắc.
>
> Bước 4 là bước người ta hay bỏ. Bỏ nó thì bạn có một nghi ngờ, không phải một bằng chứng.

### Vì sao app này cố tình có bug

Nếu bạn thực hành trên một app đúng hoàn toàn thì bộ kiểm của bạn sẽ luôn xanh. Và bạn không có cách
nào biết nó xanh **vì app đúng** hay **vì bộ kiểm của bạn mù**. Hai thứ đó cho cùng một dấu hiệu.

App này có đúng 3 bug, biết trước. Nên nếu bộ kiểm của bạn bắt được 0/3 thì lỗi nằm ở bộ kiểm, không
ở app. Đó gọi là **đối chứng**, và nó là ý tưởng trung tâm của mọi phép đo trong tài liệu này.

Hai bug còn lại bạn sẽ gặp ở Bài 9 và Bài 10. Đừng mở [`BUGS.md`](assets/app-thuc-hanh/BUGS.md) trước
khi làm hết Phần 2. Mở sớm thì mất luôn phép đối chứng.

## Việc 2 — Bộ test, project, và kit (25 phút)

Ba thứ này hay bị gọi lẫn, và ranh giới giữa chúng quyết định bạn đang dựng cái gì.

| | Là gì | Dấu hiệu | Sang dự án khác |
|---|---|---|---|
| **Một bộ test** | Vài file test chạy được | Chạy bằng cách gõ tên file | Viết lại từ đầu |
| **Một automation project** | Bộ test + cấu trúc + config + CI | Có `package.json`, có lệnh `npm run`, có thư mục rõ ràng | Copy rồi sửa nhiều chỗ |
| **Một test kit** | Project + tách hai tầng + quy trình + máy kiểm | Đổi dự án bằng cách đổi **một file cấu hình** | Clone, khai profile, chạy |

Khác biệt thật nằm ở dòng cuối cùng. Một project automation tốt vẫn gắn với sản phẩm nó được viết
cho: URL nằm trong code, dữ liệu test là bản ghi có sẵn trên môi trường, quy tắc nghiệp vụ nằm rải
trong assertion.

Một kit thì tách làm hai tầng:

| Tầng | Chứa gì | Mang sang dự án mới |
|---|---|---|
| **Chung** | Khung chạy, factory, evidence, máy kiểm, quy trình | Không sửa một chữ |
| **Dự án** | URL, tài khoản, quy tắc nghiệp vụ, bản đồ tên trường | Khai lại một lần |

Nghe đơn giản, nhưng giữ được ranh giới đó là việc khó nhất của cả tài liệu, và Bài 28 sẽ chỉ ra vì
sao nhầm ranh giới không phải chuyện gọn gàng mà là chuyện **an toàn**.

### Và cái gì không phải kit

Một thư mục có 200 file `.spec.js` và không ai dám xoá cái nào. Một bộ test mà cách duy nhất để biết
nó còn đúng là chạy lên xem có đỏ không. Một quy trình nằm trong đầu một người.

Ba thứ đó rất phổ biến, và chúng đều là **một đống script**, không phải một kit. Khác biệt không nằm
ở số lượng test.

## Việc 3 — Mười từ vựng (25 phút)

Mỗi từ kèm một ví dụ lấy từ đúng việc bạn vừa làm ở Việc 1. Đọc định nghĩa suông thì quên, gắn vào
việc đã làm thì nhớ.

| Từ | Nghĩa | Ví dụ vừa rồi |
|---|---|---|
| **Đặc tả** | Tài liệu nói sản phẩm phải làm gì | `spec.md`, mục `BR-04` |
| **Oracle** | Căn cứ để phán đúng sai | `BR-04` nói mốc so trên *tạm tính*, không phải số sau giảm giá |
| **Kết quả mong đợi** | Con số bạn viết ra **trước** khi chạy | `486.500` bạn tính trên giấy |
| **Kết quả thực tế** | Con số app trả về | Con số bạn điền vào cột bên phải |
| **Tiền điều kiện** | Trạng thái phải có trước khi kiểm | Phải có khách hạng Bạc và sản phẩm `SP01` |
| **Bug biên** | Lỗi chỉ lộ ra ngay chỗ chuyển trạng thái | Tạm tính đúng `520.000`, ngay trên mốc |
| **Bằng chứng** | Thứ chứng minh bạn đã kiểm thật | Ảnh màn hình có khoanh đỏ ô sai |
| **Tầng lỗi** | Lỗi nằm ở giao diện, phía sau, hay dữ liệu | Bug này ở phía sau: API trả sai từ đầu |
| **Đối chứng** | Biết trước đáp án để đo cách kiểm | Biết app có 3 bug, bắt 0/3 thì bộ kiểm mù |
| **Gate** | Máy chặn, không cho đi tiếp khi có vi phạm | Bài 6 bạn viết cái đầu tiên |

Ba từ hay bị dùng sai nhất, nói rõ luôn:

**Oracle không phải là "kết quả mong đợi".** Kết quả mong đợi là con số `486.500`. Oracle là **lý do**
con số đó là `486.500`, tức là `BR-02` cộng `BR-03` cộng `BR-04`. Viết được con số mà không chỉ được
mã luật thì bạn đang đoán, và Bài 13 sẽ dựng một máy chặn đúng chuyện đó.

**"Không phán được" không phải là PASS.** Nếu bạn không đọc được con số vì trang lỗi, kết quả là *chưa
đo được*, không phải *đạt*. Trộn hai thứ này là cách bảng kết quả trở nên đẹp trong khi độ phủ thật
giảm đi.

**"Nhất quán" không phải là "đúng".** Hai màn hình cùng hiện `515.000` chỉ chứng minh chúng đọc chung
một nguồn. Cả hai vẫn có thể sai so với `spec.md`.

## Việc 4 — Dây chuyền bạn sắp dựng (25 phút)

Ở Việc 1 bạn vừa đi qua một vòng kiểm thử hoàn chỉnh, chỉ là làm hết bằng tay. Vẽ nó ra:

```
Requirement          ← bạn đọc spec.md
   ↓
Phân tích scope      ← bạn chọn kiểm 4 luật BR-02..BR-05
   ↓
Thiết kế testcase    ← bạn viết ra bộ dữ liệu và con số kỳ vọng
   ↓
QA review            ← (chưa có, bạn tự làm tự duyệt)
   ↓
Quản lý testcase     ← (chưa có, nó nằm trên giấy)
   ↓
Automation execution ← (chưa có, bạn tự bấm)
   ↓
Evidence + Report    ← (chưa có, kết quả nằm trong đầu bạn)
   ↓
Triage               ← bạn đi từng khâu tìm chỗ lệch
   ↓
Bug                  ← (chưa có, chưa báo cho ai)
   ↓
Dev fix              ← (chưa có)
   ↓
Rerun                ← (chưa có)
```

Bốn chặng bạn đã làm. Bảy chặng còn để trống.

Đó là bản đồ của cả tài liệu này, và nó cũng trả lời câu *"bao giờ thì dùng được"*:

| Tới bài | Lấp được chặng nào |
|---|---|
| Bài 4 | Automation execution, ở mức thô |
| Bài 11 | Evidence + Report |
| Bài 17 | Triage |
| Bài 19 | Bug, Dev fix, Rerun |
| Bài 18 | Quản lý testcase |
| Bài 15 | QA review |

Để ý thứ tự: chặng **Quản lý testcase** và **QA review** nằm ở giữa dây chuyền nhưng học sau cùng. Đó
là cố ý. Chúng chỉ có nghĩa khi đã có nhiều người cùng làm, và học chúng khi bạn còn đang một mình
thì chỉ là thêm thủ tục.

### Việc phụ — ghi lại điểm xuất phát

Tạo `docs/xuat-phat.md` trong thư mục bạn sẽ làm việc, và trả lời ba câu:

```markdown
# Điểm xuất phát — <ngày>

## Hiện tại tôi kiểm thử thế nào
(viết thật, kể cả nếu câu trả lời là "bấm tay và ghi vào Excel")

## Chặng nào trong 11 chặng đang tốn nhiều thời gian nhất
## Nếu chỉ tự động hoá được MỘT chặng, tôi chọn chặng nào, vì sao
```

Nghe hình thức, nhưng nó có tác dụng thật: đến Bài 29 bạn mở lại file này và đối chiếu. Không có nó
thì bạn không có cách nào đo mình đã đi được bao xa, vì trí nhớ về "hồi đó khổ thế nào" mờ rất nhanh.

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Đặc tả** (spec) | Tài liệu nói sản phẩm *phải* làm gì. Nguồn để phán đúng sai |
| **Oracle** | Câu trả lời cho *"dựa vào đâu mà bảo cái này sai"*. Phải là một thứ cụ thể |
| **Bug biên** | Lỗi chỉ lộ ra ở ngay chỗ chuyển trạng thái, ví dụ đúng mốc `500.000` |
| **Đối chứng** | Biết trước đáp án để đo xem cách kiểm của mình có hiệu quả không |

## Cây thư mục sau bài này

```
kit-cua-toi/
└── docs/
    └── xuat-phat.md              ← MỚI · điểm xuất phát, mở lại ở Bài 29
```

Đúng một file, và nó không phải code. Bài 2 mới bắt đầu dựng repo thật.

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

1. Vì sao phải viết con số kỳ vọng ra giấy **trước** khi bấm?
2. Bước thứ tư trong phương pháp ở Việc 1 là gì, và bỏ nó thì bạn thiếu cái gì?
3. Vì sao app thực hành cố tình có bug?
4. Ba mức: bộ test, automation project, test kit. Ranh giới thật nằm ở đâu?
5. Hai tầng của một kit, và tầng nào được mang đi không sửa?
6. Oracle khác "kết quả mong đợi" ở chỗ nào?
7. Vì sao "không phán được" không được ghi thành PASS?
8. Vì sao hai màn hình cùng hiện một con số vẫn chưa chứng minh được gì?
9. Trong 11 chặng, bạn đã làm được mấy chặng bằng tay ở Việc 1?
10. Vì sao "Quản lý testcase" nằm giữa dây chuyền nhưng học gần cuối?

## Bài tập về nhà

Lấy một chức năng của sản phẩm bạn đang test thật, và làm đúng Việc 1 lên nó: đọc tài liệu, viết ra
kết quả kỳ vọng, rồi mới thao tác.

Đếm hai con số:

1. Bao nhiêu chỗ bạn **không viết ra được** kết quả kỳ vọng vì tài liệu không nói?
2. Bao nhiêu chỗ bạn viết ra được, nhưng bằng cách nhớ *"lâu nay nó chạy thế"*?

Con số thứ hai là phần nguy hiểm. Đó là chỗ bạn đang lấy chính sản phẩm làm chuẩn đối chiếu, và Bài 13
sẽ dựng một máy chặn đúng chuyện đó.

## Bài sau

Bài 2 dựng repo. Ngắn, và có một chi tiết nghe nhỏ mà đắt: `.gitignore` được viết trước cả README, vì
chỉ cần một lần `git add .` sai là đủ đẩy thứ không nên đẩy lên.
