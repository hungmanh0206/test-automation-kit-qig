# Bài 6 — Từ requirement ra testcase bằng AI agent

> **2 giờ 30 phút** · Có gì trong tay: template testcase, 10 case viết tay để so · Sau bài này: bộ case do agent sinh, đã qua Ambiguity Gate

## Mục tiêu

✅ Bóc requirement thành phạm vi và business rule kiểm được.
✅ Sinh testcase bằng agent với ràng buộc định dạng, đối chiếu với 10 case tự viết.
✅ Dừng đúng lúc ở Ambiguity Gate thay vì gen bừa với giả định.
✅ Nhận ra ba dấu hiệu testcase không execute được.
✅ Thực hành trên tài liệu thật của dự án bạn.
✅ Hiểu vì sao review của người không bị thay thế.

---

## 1. Hai lượt, không phải một

Sai lầm phổ biến nhất: một prompt duy nhất *"đọc tài liệu và viết testcase"*. Nó gộp hai việc có **bản chất
khác nhau** và **điều kiện dừng khác nhau**:

| Lượt | Việc | Đầu ra | Dừng khi |
|---|---|---|---|
| **1. Phân tích** | Bóc tài liệu thành mệnh đề kiểm được | Phạm vi · bảng business rule · **bảng chỗ chưa rõ** | Có chỗ chưa rõ ở mức chặn |
| **2. Sinh case** | Biến mệnh đề thành testcase | Bảng 7 cột | Sinh xong |

Gộp hai lượt thì agent **không có chỗ để dừng**. Nó gặp chỗ mơ hồ, chọn một cách hiểu, rồi sinh 40 case trên
giả định đó — và bạn không biết nó đã giả định gì.

Tách ra thì chỗ mơ hồ **lộ trước khi tốn công**.

## 2. Lượt 1 — phân tích

Dùng khuôn 5 phần từ Bài 4. Điểm mới ở đây là **định dạng đầu ra có mã tham chiếu**:

```
VAI TRÒ
Bạn là QA phân tích tài liệu để chuẩn bị sinh testcase. Lượt này KHÔNG sinh testcase.

ĐẦU VÀO
Đọc TOÀN BỘ: docs/course/assets/sample-requirement.md
Gồm mọi bảng và phần "Ghi chú của BA" ở cuối file.

RÀNG BUỘC
- Không suy đoán giá trị nào tài liệu không nói.
- Hai chỗ nói khác nhau thì KHÔNG chọn bên nào — báo cả hai kèm vị trí.
- Mỗi business rule phải trích được: ghi rõ mục nào của tài liệu nói ra nó.

ĐỊNH DẠNG ĐẦU RA
1. Phạm vi: trong phạm vi / ngoài phạm vi.
2. Bảng business rule:
   | Mã | Quy tắc (phát biểu kiểm được) | Trích từ | Ví dụ input → expected |
   Mã đặt dạng BR-01, BR-02…
3. Bảng chỗ chưa rõ:
   | # | Chỗ chưa rõ | Mức (chặn / cần xác nhận / ghi nhận) | Vì sao | Câu hỏi cho BA |

ĐIỀU KIỆN DỪNG
Nếu bảng 3 có dòng nào mức "chặn", ghi "AMBIGUITY_GATE: PENDING" ở cuối rồi DỪNG.
```

**Mã `BR-` không phải trang trí.** Nó là cái neo: ở Bài 7 mỗi kết quả mong đợi sẽ trỏ về một mã `BR-`, và
khi BA đổi rule thì bạn biết ngay case nào phải sửa. Không có mã thì mối liên hệ đó nằm trong đầu người viết.

Lưu kết quả vào `outputs/demo/tasks/PROJ-1234/requirements/phan-tich.md`.

### Kết quả tốt trông như thế nào

Với tài liệu mẫu, bảng business rule nên có ít nhất:

| Mã | Quy tắc | Trích từ |
|---|---|---|
| BR-01 | Giảm giá: Thường 0% · Bạc 3% trần 100.000 · Vàng 5% trần 300.000, tính trên Tạm tính, làm tròn xuống | Mục 3 |
| BR-02 | Phí giao hàng = 30.000 nếu Tạm tính < mốc, ngược lại 0 | Mục 2 khối C |
| BR-03 | Tổng cộng = Tạm tính − Giảm giá + Phí giao hàng | Mục 2 khối C |
| BR-04 | Số lượng: số nguyên 1–999, ngoài khoảng thì chặn tại dòng | Mục 2 khối B, mục 5 |
| BR-05 | Tối đa 20 dòng sản phẩm; đủ 20 thì nút Thêm dòng vô hiệu | Mục 2 khối B |
| BR-06 | Ma trận phân quyền 4 vai trò | Mục 6 |

Và bảng chỗ chưa rõ phải bắt được **cả ba** thứ này:

| # | Chỗ chưa rõ | Mức |
|---|---|---|
| 1 | Mốc phí giao hàng: mục 2 ghi 500.000, Ghi chú 2 ghi 700.000 | **chặn** |
| 2 | Rule "Vàng trên 10 triệu phải duyệt ngay" (Ghi chú 1) không có trong luồng chính mục 4 | **chặn** |
| 3 | Khách chưa được phân hạng thì hiển thị gì và tính giảm giá thế nào (Ghi chú 3) | **chặn** |

> Nếu lượt phân tích của bạn **không** bắt được cả ba, đừng sửa tài liệu — **sửa prompt**. Quay lại Bài 4
> mục 2: câu ràng buộc phải kiểm được. Ở đây câu hiệu quả là *"đọc TOÀN BỘ, gồm phần Ghi chú của BA ở cuối"*
> — vì chỗ mơ hồ trong tài liệu thật gần như luôn nằm ở phần ghi chú, không nằm ở phần đặc tả.

## 3. Ambiguity Gate — điểm dừng thật

Ba mức, và chỉ mức đầu được dừng cả lượt:

| Mức | Nghĩa | Làm gì |
|---|---|---|
| **chặn** | Không trả lời thì không sinh case đúng được | **Dừng**, hỏi BA |
| cần xác nhận | Sinh được với giả định, nhưng phải ghi giả định ra | Sinh, kèm mục `Assumptions` |
| ghi nhận | Không ảnh hưởng lượt này | Ghi vào để sau |

Không phân mức thì mọi chỗ hơi mơ hồ đều thành chặn, và bạn sẽ tắt cơ chế này trong tuần.

**Cách hỏi BA cho hiệu quả.** Đừng gửi cả bảng thô. Gửi dạng này:

```
Chào anh/chị, em chuẩn bị viết testcase cho màn Tạo đơn hàng, có 3 chỗ cần chốt:

1. Mốc phí giao hàng: FSD mục 2 ghi 500.000, ghi chú cuối file ghi 700.000. Lấy mốc nào?
2. Ghi chú 1 nói đơn hạng Vàng trên 10 triệu cần trưởng nhóm duyệt ngay ở bước lưu nháp —
   luồng chính mục 4 chưa có bước này. Xác nhận giúp em rule này còn hiệu lực không?
3. Khách chưa được phân hạng thì trường Hạng khách hàng hiển thị gì, và giảm giá tính 0%?

Ba câu này chặn việc viết case tính tiền, nên em chờ trả lời rồi làm tiếp.
```

Ba đặc điểm khiến nó được trả lời nhanh: **trích vị trí cụ thể** · **nói rõ nó chặn cái gì** · **đề xuất một
cách hiểu** để BA chỉ cần xác nhận thay vì tự nghĩ.

## 4. Lượt 2 — sinh case

Chỉ chạy sau khi có câu trả lời. Prompt:

```
VAI TRÒ
Bạn là QA sinh testcase từ bản phân tích ĐÃ ĐƯỢC CHỐT.

ĐẦU VÀO
1. outputs/demo/tasks/PROJ-1234/requirements/phan-tich.md  (bảng business rule + câu trả lời của BA)
2. .agent/config/testcase-template.md                      (đúng 7 cột, không thêm không bớt)

RÀNG BUỘC
- Mỗi case phải trỏ về một mã BR- trong phần Kết quả mong đợi.
- Kết quả mong đợi phải nêu GIÁ TRỊ, URL hoặc element CỤ THỂ. Cấm "hiển thị đúng",
  "thành công", "hoạt động bình thường".
- Kết quả mong đợi đánh số KHỚP TỪNG BƯỚC của Các bước thực hiện.
- Tiền điều kiện nêu dữ liệu cụ thể có mã, không nêu chung chung.
- Ưu tiên chỉ dùng: Critical | High | Medium | Low | Lowest.
- Không sinh case cho phần tài liệu khai NGOÀI PHẠM VI.

ĐỊNH DẠNG ĐẦU RA
Đúng một bảng markdown 7 cột. Không lời dẫn, không kết luận.

ĐIỀU KIỆN DỪNG
Nếu một business rule không đủ thông tin để viết kết quả mong đợi cụ thể, BỎ QUA case đó và
liệt kê ở cuối dưới tiêu đề "CHƯA SINH ĐƯỢC" kèm lý do. Đừng viết case với expected mơ hồ.
```

Điều kiện dừng ở đây là thứ đáng giá nhất: nó cho agent **một đường thoát trung thực**. Không có nó, agent
gặp rule thiếu thông tin sẽ viết một case với expected mơ hồ — và case mơ hồ thì trông như đã kiểm.

Lưu vào `outputs/demo/tasks/PROJ-1234/test-cases/agent-sinh.md`.

## 5. Kiểm bằng máy trước khi đọc bằng mắt

Bạn đã có parser từ Bài 5. Dùng nó **trước** khi đọc:

```bash
node -e "
const fs=require('fs');
const {docMarkdown, kiemTra} = require('./scripts/lib/testcase');
const c = docMarkdown(fs.readFileSync(process.argv[1],'utf8'));
const loi = kiemTra(c);
console.log('Đọc được ' + c.length + ' case · ' + loi.length + ' vấn đề cấu trúc');
loi.forEach(l => console.log('  - ' + l));
" outputs/demo/tasks/PROJ-1234/test-cases/agent-sinh.md
```

Nếu parser **không đọc được** thì agent đã sai định dạng — sửa prompt, đừng sửa tay bảng. Sửa tay là bạn đang
làm việc của máy, và lần sau vẫn sai.

## 6. Ba dấu hiệu case không execute được

Đây là thứ phân biệt bộ case dùng được với bộ case trông đẹp. Cả ba đều bắt được bằng mắt trong một phút.

### Dấu hiệu 1 — expected không đo được

| Không đo được | Đo được |
|---|---|
| "Hiển thị đúng thông tin khách hàng" | "Tên khách hàng = `Công ty A`, SĐT = `0901234567`" |
| "Tính toán chính xác" | "Tổng cộng = `321.000` (300.000 − 9.000 + 30.000)" |
| "Thông báo lỗi xuất hiện" | "Hiện đúng chữ `Số lượng phải từ 1 đến 999`" |

Phép thử một câu: **hai người đọc expected này có phán cùng kết quả không?** Không thì nó không đo được.

### Dấu hiệu 2 — tiền điều kiện không dựng được

| Không dựng được | Dựng được |
|---|---|
| "Có một khách hàng hạng Bạc" | "Khách `KH_BAC_01`, hạng Bạc, đã có trong hệ thống" |
| "Đơn hàng ở trạng thái phù hợp" | "Đơn `DH_NHAP_01` trạng thái Nháp, có 2 dòng sản phẩm" |
| "Người dùng có quyền" | "Đăng nhập bằng `user_sales_01` (vai trò Nhân viên bán hàng)" |

Phép thử: **đọc xong bạn biết phải làm gì để có trạng thái đó chưa?** Bài 10 sẽ nói kỹ về việc dựng.

### Dấu hiệu 3 — bước gộp nhiều hành động

| Gộp | Tách |
|---|---|
| "Tạo đơn hàng và kiểm tra tổng tiền" | "1. Chọn khách `KH_BAC_01`<br>2. Thêm `SP_A` số lượng 3<br>3. Đọc ô Tổng cộng" |

Bước gộp thì khi FAIL bạn không biết **hỏng ở bước nào** — và đó là nửa công việc điều tra.

## 7. Đối chiếu với 10 case bạn viết tay

Đây là bước quan trọng nhất của bài, vì nó nói cho bạn biết agent **mạnh và yếu ở đâu** trên chính dự án bạn.

| Đối chiếu | Nghĩa là gì |
|---|---|
| Agent có, bạn không | ✅ Nó phủ rộng hơn — thường ở phần biên và tổ hợp |
| Bạn có, agent không | ⚠️ **Chỗ đáng chú ý nhất.** Thường là kiến thức ngầm bạn có mà tài liệu không nói |
| Cả hai có | Vùng an toàn |
| Agent có nhưng expected mơ hồ | ⚠️ Ràng buộc prompt chưa đủ chặt |

Nhóm thứ hai là chỗ học được nhiều nhất. Nếu bạn có case mà agent không nghĩ ra, hãy hỏi: **vì sao tôi biết
mà tài liệu không nói?** Câu trả lời thường là một business rule chưa được ghi ở đâu — và đó chính là thứ
phải ghi vào bộ nhớ dự án ở Bài 16.

## 8. Vì sao review của người không bị thay thế

Agent làm tốt: đọc hết tài liệu · phủ rộng và đều · giữ đúng định dạng · không mỏi.

Agent không làm được: biết **rule ngầm** không có trong tài liệu · biết chỗ nào **hay hỏng** ở dự án này ·
quyết định coverage **đã đủ chưa** so với rủi ro và thời gian còn lại.

Ba việc đó là việc của bạn, và không có prompt nào chuyển được sang agent. Cách nghĩ đúng: **agent đề xuất,
bạn quyết**. Nó làm phần rộng, bạn làm phần sâu.

---

## Thực hành (75 phút)

### Bước 1 — Lượt phân tích (20 phút)

Chạy prompt mục 2 trên tài liệu mẫu. Kiểm đầu ra có: phạm vi · bảng `BR-` có cột trích từ · bảng chỗ chưa rõ
có phân mức. Đối chiếu với bảng ở cuối mục 2 — bắt được mấy trong ba chỗ chặn?

Không đủ ba thì sửa prompt rồi chạy lại **phiên mới**, ghi lại bạn đã sửa gì.

### Bước 2 — Trả lời như BA (5 phút)

Bạn đóng vai BA, trả lời ba câu. Với tài liệu mẫu, dùng đáp án này để cả lớp có cùng nền:

1. Mốc phí giao hàng: **500.000** (bảng giá mới chưa hiệu lực).
2. Rule Vàng trên 10 triệu: **còn hiệu lực**, cần trưởng nhóm duyệt ngay ở bước lưu nháp.
3. Khách chưa phân hạng: hiển thị `Chưa phân hạng`, **giảm giá 0%**.

Ghi vào cuối `phan-tich.md` dưới tiêu đề `Câu trả lời của BA`.

### Bước 3 — Lượt sinh case (20 phút)

Chạy prompt mục 4. Kiểm bằng parser theo mục 5.

### Bước 4 — Soi ba dấu hiệu (15 phút)

Đọc **10 case đầu**, chấm theo mục 6:

| TC ID | Expected đo được? | Tiền điều kiện dựng được? | Bước tách rõ? |
|---|---|---|---|

Có case nào lỗi thì thêm một câu ràng buộc vào prompt, chạy lại, và so hai lượt.

### Bước 5 — Đối chiếu với bộ tay (15 phút)

Điền bảng mục 7. Với mỗi case **bạn có mà agent không**, viết một dòng: *vì sao tôi biết mà tài liệu không nói?*

Giữ danh sách đó lại — nó là đầu vào cho Bài 16.

### Bước 6 — Commit

```bash
git add outputs/demo/tasks/PROJ-1234 prompt_templates
git commit -m "docs(course): bài 6 — phân tích + sinh case qua Ambiguity Gate, đối chiếu với bộ viết tay"
```

---

## Tự kiểm

- [ ] Tôi tách **hai lượt** phân tích và sinh case, không gộp.
- [ ] Lượt phân tích bắt được **cả ba** chỗ chặn trong tài liệu mẫu.
- [ ] Bảng chỗ chưa rõ có **phân mức**, không phải mọi thứ đều chặn.
- [ ] Mỗi business rule có mã `BR-` và cột trích từ mục nào.
- [ ] Prompt sinh case có **điều kiện dừng** cho rule thiếu thông tin.
- [ ] Parser đọc được bộ case agent sinh mà **không cần tôi sửa tay**.
- [ ] Tôi đã chấm 10 case theo ba dấu hiệu ở mục 6.
- [ ] Tôi có danh sách "case tôi có mà agent không" kèm lý do.

## Bài tập về nhà

Chạy đúng hai lượt này trên **một tài liệu thật** của dự án bạn. Mang bảng chỗ chưa rõ đi hỏi BA thật, rồi
đếm hai con số:

1. Bao nhiêu câu BA trả lời được ngay? (⇒ tài liệu thiếu, không phải bạn hiểu sai)
2. Bao nhiêu câu **BA cũng chưa biết**? (⇒ khoảng trống thật của sản phẩm, và đó là phát hiện có giá trị)

Con số thứ hai thường làm BA ngạc nhiên — và nó là cách nhanh nhất để họ thấy giá trị của cách làm này.

## Đọc thêm

- Phần "Ghi chú cho giảng viên" ở cuối [`assets/sample-requirement.md`](assets/sample-requirement.md):
  **10** chỗ cài cắm, không chỉ 3. Đọc sau khi làm xong để biết mình còn bỏ sót gì.
- Bài 7 sẽ soi kỹ vào cột Kết quả mong đợi — phần dễ trông-như-đúng nhất.
