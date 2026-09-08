# Bài 12 — Trước khi viết test: expected của bạn đến từ đâu?

> **2 giờ** · Có gì trong tay: bộ automation chạy được, nhưng chưa ai hỏi nó đang kiểm cái gì · Sau bài này: bộ case do agent sinh, đã qua Ambiguity Gate

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Tài liệu nằm ở bốn nơi. Mỗi nơi nói một kiểu. Bạn không biết bắt đầu từ đâu. |
| **Bài này bạn gõ gì** | Bóc một requirement thật thành bảng luật, kèm danh sách chỗ chưa rõ. |
| **Xong thì được gì** | Có bảng luật để làm chuẩn cho mọi kết quả mong đợi về sau. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Một trong những lỗi phổ biến khi mới học automation là bắt đầu bằng việc tìm locator và viết script
ngay khi nhận requirement.

Nhưng trước khi automation một testcase, có ba câu phải trả lời được:

| # | Câu hỏi | Không trả lời được thì |
|---|---|---|
| 1 | Chúng ta đang kiểm thử điều gì? | Bạn viết script cho một thứ không ai yêu cầu |
| 2 | Rủi ro nào cần được phủ? | Công sức rải đều, chỗ nguy hiểm bị test hời hợt |
| 3 | Kết quả nào được xem là đúng? | Không viết được assertion, hoặc viết bừa rồi tự tin |

Bài này lo cả ba, và không viết một dòng test nào. Năm việc:

1. Vì sao phải tách làm hai lượt, không gộp một (15 phút).
2. Lượt 1: bóc requirement thành bảng luật có mã `BR-` (40 phút).
3. Đo tài liệu trước khi đọc nó (20 phút).
4. Đối chiếu với 10 case bạn tự viết tay (25 phút).
5. Vì sao review của người không bị thay thế (20 phút).

---

## Việc 1 — Hai lượt, không phải một

Sai lầm phổ biến nhất: một prompt duy nhất *"đọc tài liệu và viết testcase"*. Nó gộp hai việc có **bản chất
khác nhau** và **điều kiện dừng khác nhau**:

| Lượt | Việc | Đầu ra | Dừng khi |
|---|---|---|---|
| **1. Phân tích** | Bóc tài liệu thành mệnh đề kiểm được | Phạm vi · bảng business rule · bảng chỗ chưa rõ | Có chỗ chưa rõ ở mức chặn |
| **2. Sinh case** | Biến mệnh đề thành testcase | Bảng 7 cột | Sinh xong |

Gộp hai lượt thì agent không có chỗ để dừng. Nó gặp chỗ mơ hồ, chọn một cách hiểu, rồi sinh 40 case trên
giả định đó, và bạn không biết nó đã giả định gì.

Tách ra thì chỗ mơ hồ lộ trước khi tốn công.

## Việc 2 — Lượt 1 — phân tích

Dùng khuôn 5 phần từ Bài 15. Điểm mới ở đây là định dạng đầu ra có mã tham chiếu:

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

**Mã `BR-` không phải trang trí.** Nó là cái neo: ở Bài 13 mỗi kết quả mong đợi sẽ trỏ về một mã `BR-`, và
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

> Nếu lượt phân tích của bạn không bắt được cả ba, đừng sửa tài liệu — **sửa prompt**. Quay lại Bài 15
> mục 2: câu ràng buộc phải kiểm được. Ở đây câu hiệu quả là *"đọc TOÀN BỘ, gồm phần Ghi chú của BA ở cuối"*
> — vì chỗ mơ hồ trong tài liệu thật gần như luôn nằm ở phần ghi chú, không nằm ở phần đặc tả.

## Việc 3 — Đo tài liệu trước khi đọc nó (20 phút)

Một việc rẻ làm trước khi ngồi đọc: đo xem tài liệu này có đủ để sinh testcase không.

`scripts/utils/do-tai-lieu.js` đếm bốn thứ và khuyến nghị chiến lược:

| Đếm gì | Thấp thì nghĩa là |
|---|---|
| Số luật có mã (`BR-`, `UI-`) | Chưa bóc xong, hoặc tài liệu viết dạng văn xuôi |
| Số giá trị cụ thể (con số, chuỗi) | Kết quả mong đợi sẽ phải đoán |
| Số nhánh điều kiện ("nếu", "khi") | Ít nhánh quá thì thường là tài liệu chỉ tả luồng thuận |
| Số chỗ mâu thuẫn giữa các nguồn | Cao thì phải hỏi trước khi viết dòng nào |

Nó **cảnh báo chứ không chặn**, và đó là cố ý. Tài liệu sơ sài không phải lỗi của bạn, và có những task
vẫn phải làm với tài liệu sơ sài. Cái bạn cần là biết trước mình đang đứng ở đâu, để nói được với
quản lý rằng độ phủ sẽ bị giới hạn bởi nguồn, không bởi công sức.

## Việc 4 — Đối chiếu với 10 case bạn viết tay

Đây là bước quan trọng nhất của bài, vì nó nói cho bạn biết agent mạnh và yếu ở đâu trên chính dự án bạn.

| Đối chiếu | Nghĩa là gì |
|---|---|
| Agent có, bạn không | ✅ Nó phủ rộng hơn — thường ở phần biên và tổ hợp |
| Bạn có, agent không | ⚠️ Chỗ đáng chú ý nhất. Thường là kiến thức ngầm bạn có mà tài liệu không nói |
| Cả hai có | Vùng an toàn |
| Agent có nhưng expected mơ hồ | ⚠️ Ràng buộc prompt chưa đủ chặt |

Nhóm thứ hai là chỗ học được nhiều nhất. Nếu bạn có case mà agent không nghĩ ra, hãy hỏi: **vì sao tôi biết
mà tài liệu không nói?** Câu trả lời thường là một business rule chưa được ghi ở đâu — và đó chính là thứ
phải ghi vào bộ nhớ dự án ở Bài 26.

## Việc 5 — Vì sao review của người không bị thay thế

Agent làm tốt: đọc hết tài liệu · phủ rộng và đều · giữ đúng định dạng · không mỏi.

Agent không làm được: biết **rule ngầm** không có trong tài liệu · biết chỗ nào **hay hỏng** ở dự án này ·
quyết định coverage đã đủ chưa so với rủi ro và thời gian còn lại.

Ba việc đó là việc của bạn, và không có prompt nào chuyển được sang agent. Cách nghĩ đúng: **agent đề xuất,
bạn quyết**. Nó làm phần rộng, bạn làm phần sâu.

---

## Thực hành (75 phút)

### Bước 1 — Lượt phân tích (20 phút)

Chạy prompt mục 2 trên tài liệu mẫu. Kiểm đầu ra có: phạm vi · bảng `BR-` có cột trích từ · bảng chỗ chưa rõ
có phân mức. Đối chiếu với bảng ở cuối mục 2, bắt được mấy trong ba chỗ chặn?

Không đủ ba thì sửa prompt rồi chạy lại **phiên mới**, ghi lại bạn đã sửa gì.

### Bước 2 — Trả lời như BA (5 phút)

Bạn đóng vai BA, trả lời ba câu. Với tài liệu mẫu, dùng đáp án này để cả lớp có cùng nền:

1. Mốc phí giao hàng: **500.000** (bảng giá mới chưa hiệu lực).
2. Rule Vàng trên 10 triệu: còn hiệu lực, cần trưởng nhóm duyệt ngay ở bước lưu nháp.
3. Khách chưa phân hạng: hiển thị `Chưa phân hạng`, giảm giá 0%.

Ghi vào cuối `phan-tich.md` dưới tiêu đề `Câu trả lời của BA`.

### Bước 3 — Lượt sinh case (20 phút)

Chạy prompt mục 4. Kiểm bằng parser theo mục 5.

### Bước 4 — Soi ba dấu hiệu (15 phút)

Đọc 10 case đầu, chấm theo mục 6:

| TC ID | Expected đo được? | Tiền điều kiện dựng được? | Bước tách rõ? |
|---|---|---|---|

Có case nào lỗi thì thêm một câu ràng buộc vào prompt, chạy lại, và so hai lượt.

### Bước 5 — Đối chiếu với bộ tay (15 phút)

Điền bảng mục 7. Với mỗi case bạn có mà agent không, viết một dòng: *vì sao tôi biết mà tài liệu không nói?*

Giữ danh sách đó lại, nó là đầu vào cho Bài 26.

### Bước 6 — Commit

```bash
git add outputs/demo/tasks/PROJ-1234 prompt_templates
git commit -m "docs(course): bài 6 — phân tích + sinh case qua Ambiguity Gate, đối chiếu với bộ viết tay"
```

---

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Luật kiểm được** | Câu luật nêu giá trị cụ thể, đọc xong là biết đúng sai thế nào |
| **Bảng `BR-`** | Danh sách luật, mỗi luật một mã. Về sau mọi kết quả mong đợi đều trỏ về đây |
| **Hai lượt** | Lượt phân tích và lượt sinh case tách riêng, không gộp làm một |

## Cây thư mục sau bài này

```
kit-cua-toi/
├── prompt_templates/phase1/
│   ├── 01_phan_tich.md           ·  từ Bài 12
│   └── 02_sinh_testcase.md       ← MỚI · LƯỢT RIÊNG, không gộp với phân tích
└── outputs/tasks/<MÃ>/
    └── analysis/
        ├── business-rules.md     ← MỚI · bảng BR- — đầu vào của oracle ở Bài 9
        └── questions.md          ← MỚI · câu hỏi cho BA, đánh số, có assumption đề xuất
```

## Bộ kit của bạn đang ở đâu

```
CẤP ĐỘ 3 · CONTROL      bài 1/9 của cấp độ này
███░░░░░░░░░░░░░░░░░░░░░░░░░

cả tài liệu           bài 12/29
████████████░░░░░░░░░░░░░░░░
```

**Hết cấp độ 3 bạn nói được:** Tôi có một QA workflow được enforce trong team.

Cấp độ này còn 8 bài nữa.

## Tự kiểm

- [ ] Tôi tách **hai lượt** phân tích và sinh case, không gộp.
- [ ] Lượt phân tích bắt được **cả ba** chỗ chặn trong tài liệu mẫu.
- [ ] Bảng chỗ chưa rõ có **phân mức**, không phải mọi thứ đều chặn.
- [ ] Mỗi business rule có mã `BR-` và cột trích từ mục nào.
- [ ] Prompt sinh case có điều kiện dừng cho rule thiếu thông tin.
- [ ] Parser đọc được bộ case agent sinh mà không cần tôi sửa tay.
- [ ] Tôi đã chấm 10 case theo ba dấu hiệu ở mục 6.
- [ ] Tôi có danh sách "case tôi có mà agent không" kèm lý do.

## Bài tập về nhà

Chạy đúng hai lượt này trên một tài liệu thật của dự án bạn. Mang bảng chỗ chưa rõ đi hỏi BA thật, rồi
đếm hai con số:

1. Bao nhiêu câu BA trả lời được ngay? (⇒ tài liệu thiếu, không phải bạn hiểu sai)
2. Bao nhiêu câu BA cũng chưa biết? (⇒ khoảng trống thật của sản phẩm, và đó là phát hiện có giá trị)

Con số thứ hai thường làm BA ngạc nhiên. Và nó là cách nhanh nhất để họ thấy giá trị của cách làm này.

## Đọc thêm

- Phần "Ghi chú cho giảng viên" ở cuối [`assets/sample-requirement.md`](assets/sample-requirement.md):
  **10** chỗ cài cắm, không chỉ 3. Đọc sau khi làm xong để biết mình còn bỏ sót gì.
- Bài 13 sẽ soi kỹ vào cột Kết quả mong đợi, phần dễ trông-như-đúng nhất.

## Bài sau

Bài 13 soi vào cột dễ trông-như-đúng nhất của bảng testcase: Kết quả mong đợi. Cụ thể là câu hỏi con
số trong đó lấy từ đâu ra.
