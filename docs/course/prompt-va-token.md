# Bài 4 — Prompt và token: nói cho đúng, và đo cái mình đưa vào

> **2 giờ** · Có gì trong tay: khung kit, một rule canonical · Sau bài này: prompt có ràng buộc, và biết đo tài liệu trước khi đọc

## Mục tiêu

✅ Cấu trúc prompt cho việc dài, gồm cả điều kiện dừng.
✅ Hiểu vì sao "hãy cẩn thận" không có tác dụng, và loại câu nào thì có.
✅ Ambiguity Gate: gộp câu hỏi, dừng chờ, không đoán.
✅ Đo tài liệu đầu vào trước khi đọc.
✅ Nhận biết bẫy tài liệu nhiều tab hoặc nhiều bản.
✅ Thực hành so sánh hai prompt trên cùng một tài liệu.

---

## 1. Năm phần của một prompt cho việc dài

Prompt hỏi–đáp thì một câu là đủ. Prompt giao **cả một chặng việc** thì cần năm phần, và thiếu phần nào sẽ
hỏng theo cách riêng của phần đó.

| Phần | Nội dung | Thiếu thì sao |
|---|---|---|
| **Vai trò** | Bạn là ai trong việc này | Agent tự chọn giọng, thường quá tự tin |
| **Đầu vào** | Đọc file nào, theo thứ tự nào | Nó đoán, hoặc đọc thiếu |
| **Ràng buộc** | Điều gì tuyệt đối không được làm | Nó tối ưu cho "xong việc" |
| **Định dạng đầu ra** | Kết quả trông như thế nào | Mỗi lần một kiểu, không parse được |
| **Điều kiện dừng** | Khi nào phải dừng lại hỏi | **Nó không bao giờ dừng** — phần bị bỏ nhiều nhất |

Điều kiện dừng là phần quan trọng nhất và hay bị quên nhất. Không có nó, agent gặp chỗ mơ hồ sẽ **chọn một
cách hiểu rồi đi tiếp** — và bạn không biết nó đã chọn gì.

### Khuôn dùng được ngay

```
VAI TRÒ
Bạn là QA phân tích tài liệu để chuẩn bị sinh testcase. Bạn CHƯA sinh testcase ở lượt này.

ĐẦU VÀO
Đọc: docs/course/assets/sample-requirement.md
Đọc TOÀN BỘ, gồm cả các bảng và phần "Ghi chú của BA" ở cuối.

RÀNG BUỘC
- Không suy đoán bất cứ giá trị nào tài liệu không nói.
- Nếu hai chỗ trong tài liệu nói khác nhau, KHÔNG chọn một bên — báo cả hai.
- Không đề xuất giải pháp; chỉ báo cáo những gì tài liệu nói và không nói.

ĐỊNH DẠNG ĐẦU RA
1. Phạm vi: những gì màn này làm và không làm.
2. Bảng quy tắc nghiệp vụ kiểm được: | Mã | Quy tắc | Trích từ mục nào |
3. Bảng chỗ chưa rõ: | # | Chỗ chưa rõ | Vì sao chặn | Câu hỏi cho BA |

ĐIỀU KIỆN DỪNG
Nếu bảng 3 có bất kỳ dòng nào ở mức chặn, ghi "AMBIGUITY_GATE: PENDING" ở cuối và DỪNG.
Không sinh testcase cho tới khi tôi trả lời.
```

## 2. Vì sao "hãy cẩn thận" không có tác dụng

Câu dặn dò thất bại vì nó **không kiểm được** và **không nói agent phải làm gì khác đi**.

| Câu không có tác dụng | Vì sao | Câu có tác dụng |
|---|---|---|
| "Hãy cẩn thận" | Không nói cẩn thận với cái gì | "Với mỗi kết quả mong đợi, ghi kèm mục nào của tài liệu nói ra nó" |
| "Đừng bỏ sót gì" | Không có cách biết đã sót | "Liệt kê mọi trường ở Khối B rồi đối chiếu với bảng trong tài liệu, báo số đếm hai bên" |
| "Hãy trung thực" | Agent vốn không thấy mình đang không trung thực | "Nếu không xác định được giá trị đúng, ghi CHƯA_XÁC_ĐỊNH — không được đoán" |
| "Test cho kỹ" | Không định nghĩa được "kỹ" | "Mỗi trường có ràng buộc số phải có case tại biên dưới, biên trên, và ngoài biên" |

Quy tắc chung:

> Câu có tác dụng là câu **kiểm được bằng cách đọc kết quả**. Nếu bạn không thể nhìn đầu ra và nói "câu này
> đã được tuân hay chưa", thì đó là lời dặn, không phải ràng buộc.

Đây chính là forcing function ở tầng prompt — và là bước chuẩn bị cho Phần 4, nơi bạn biến chúng thành máy.

## 3. Ambiguity Gate

Ba cách xử lý chỗ mơ hồ, chỉ một cách đúng:

| Cách | Hậu quả |
|---|---|
| Agent tự đoán, không nói | Cả bộ case dựng trên giả định sai, lộ ra rất muộn |
| Agent hỏi từng câu một | Bạn bị ngắt liên tục, và nó vẫn đoán những chỗ không hỏi |
| **Gộp thành một danh sách, dừng chờ** | ✅ Bạn hỏi BA một lượt, trả lời một lượt |

Ba mức chặn nên phân biệt:

- **Chặn** — không trả lời thì không sinh case được (mâu thuẫn số, thiếu rule cho một nhánh).
- **Cần xác nhận** — có thể sinh case với giả định, nhưng phải ghi rõ giả định đó ra.
- **Ghi nhận** — không ảnh hưởng lượt này, ghi vào để sau.

Chỉ mức **Chặn** mới được dừng cả lượt. Nếu không phân mức, mọi chỗ hơi mơ hồ đều thành chặn và bạn sẽ tắt
luôn cơ chế này.

## 4. Đo tài liệu trước khi đọc

Nghe lạ nhưng đây là bước rất thực dụng, và nó cứu bạn khỏi hai lớp lỗi.

**Ngưỡng.** Ngữ cảnh của agent hữu hạn. Tài liệu quá lớn thì phần đầu bị đẩy ra khỏi ngữ cảnh trước khi nó
đọc xong phần cuối — và **không có thông báo nào**. Nên đo trước:

```bash
wc -c docs/course/assets/sample-requirement.md    # số ký tự
```

Quy ước đơn giản để bắt đầu (điều chỉnh theo công cụ của bạn):

| Cỡ tài liệu | Cách làm |
|---|---|
| Dưới ~30.000 ký tự | Đọc thẳng |
| Trên ngưỡng đó | Giao subagent trích ra bảng cần thiết, rồi chỉ đọc bảng đó |

Với tiếng Việt, nhớ là **chữ có dấu tốn nhiều token hơn** chữ không dấu, nên số ký tự chỉ là sàn.

**Hai bẫy thật, cả hai đều im lặng:**

1. **Tài liệu nhiều tab.** Google Doc có nhiều tab: nếu không bật đúng tuỳ chọn khi đọc thì chỉ lấy được
   **tab đầu tiên**, và agent sẽ phân tích bình thường trên 5% nội dung. Cách phát hiện duy nhất là **đo**:
   tài liệu 20 trang mà đọc ra 8KB thì có gì sai.
2. **Tài liệu nhiều bản.** Cùng một FSD có bản cũ và bản mới, tên gần giống. Đọc bản cũ thì mất hẳn phần bổ
   sung. Cách xử lý: liệt kê **mọi** bản tìm thấy, so ngày sửa, rồi mới chọn — và ghi lại đã chọn bản nào.

## 5. Token: tiết kiệm ở đâu thì đáng

Tiết kiệm token không phải mục tiêu tự thân — mục tiêu là **để phần quan trọng nằm trong ngữ cảnh**.

| Nên | Không nên |
|---|---|
| Giữ file luôn-trong-ngữ-cảnh ngắn | Nhồi mọi luật vào đó "cho chắc" |
| Mở đúng phần tài liệu đang cần | Đọc cả file 12.000 token để trả lời một câu |
| Giao việc đọc–trích cho subagent | Tự đọc rồi giữ nguyên văn trong ngữ cảnh |
| Chia việc dài thành chặng có mốc lưu | Chạy một phiên 4 tiếng rồi mất hết |

Con số minh hoạ từ kit thật: một file luật 465 dòng tốn khoảng **12.800 token** nếu đọc cả file, còn tra
riêng một mục thì **287 token** — rẻ hơn 45 lần. Bài học không phải "đừng viết tài liệu dài" mà là **cho nó
một mục lục và cách tra từng mục**.

---

## Thực hành (55 phút)

Dùng [`assets/sample-requirement.md`](assets/sample-requirement.md) — tài liệu mẫu có cài cắm chỗ mơ hồ và
mâu thuẫn, cố ý giống tài liệu thật.

### Bước 1 — Đo trước

```bash
wc -c docs/course/assets/sample-requirement.md
```

Ghi con số lại. Nó nằm trong ngưỡng đọc thẳng hay không?

### Bước 2 — Prompt sơ sài

Mở phiên mới, gõ đúng câu này, không thêm gì:

```
Đọc file docs/course/assets/sample-requirement.md và viết testcase cho màn này.
```

Lưu kết quả vào `docs/course/bai-04-ket-qua-so-sai.md`.

### Bước 3 — Prompt có ràng buộc

Mở phiên **mới** (quan trọng — phiên cũ đã có ngữ cảnh), dùng khuôn 5 phần ở mục 1.

Lưu kết quả vào `docs/course/bai-04-ket-qua-co-rang-buoc.md`.

### Bước 4 — Đối chiếu

Tài liệu mẫu cài **ba** chỗ mơ hồ có chủ ý, tất cả nằm ở phần "Ghi chú của BA" cuối file:

| # | Chỗ mơ hồ | Lượt sơ sài có bắt? | Lượt có ràng buộc có bắt? |
|---|---|---|---|
| 1 | Hai mốc phí giao hàng khác nhau (500.000 vs 700.000) | | |
| 2 | Rule "hạng Vàng trên 10 triệu phải duyệt ngay" không có trong luồng chính | | |
| 3 | Khách chưa được phân hạng thì tính giảm giá thế nào | | |

Điền bảng này. Kết quả điển hình: lượt sơ sài bỏ cả ba và **không hỏi gì**; lượt có ràng buộc bắt được ít
nhất chỗ số 1.

### Bước 5 — Rút ra câu ràng buộc của riêng bạn

Nhìn những chỗ **lượt có ràng buộc vẫn bỏ sót**, viết thêm một câu ràng buộc để lần sau bắt được. Nhớ tiêu
chí ở mục 2: câu đó phải **kiểm được bằng cách đọc kết quả**.

Ghi câu đó vào `prompt_templates/` — đây là dòng đầu tiên của bộ prompt template của bạn.

### Bước 6 — Commit

```bash
git add docs/course prompt_templates
git commit -m "docs(course): bài 4 — so sánh prompt sơ sài vs có ràng buộc"
```

---

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/
│   ├── rules/
│   │   └── core_rules.md         ·  từ Bài 2 · digest
│   ├── skills/
│   │   └── <vai>/SKILL.md        ← MỚI · năng lực theo vai, KHÔNG tự nạp
│   └── workflows/
│       └── phase1.md             ← MỚI · quy trình, gọi prompt theo thứ tự
└── prompt_templates/
    └── phase1/
        └── 01_phan_tich.md       ← MỚI · 5 phần: vai · đầu vào · ràng buộc · định dạng · ĐIỀU KIỆN DỪNG
```

## Tự kiểm

- [ ] Tôi nêu được 5 phần của prompt việc dài, và phần nào hay bị quên nhất.
- [ ] Tôi viết được 3 câu ràng buộc **kiểm được**, và giải thích được vì sao "hãy cẩn thận" thì không.
- [ ] Tôi phân biệt được ba mức chặn / cần xác nhận / ghi nhận.
- [ ] Tôi đã đo cỡ tài liệu **trước** khi cho agent đọc.
- [ ] Tôi kể được hai bẫy tài liệu im lặng và cách phát hiện từng cái.
- [ ] Tôi đã điền xong bảng đối chiếu ở Bước 4.
- [ ] Tôi có ít nhất một câu ràng buộc của riêng mình trong `prompt_templates/`.

## Bài tập về nhà

Lấy **một** tài liệu thật của dự án bạn. Đo cỡ. Rồi chạy khuôn 5 phần ở mục 1 lên nó — chỉ tới bước liệt kê
chỗ chưa rõ, **chưa sinh testcase**.

Mang bảng "chỗ chưa rõ" đó đi hỏi BA thật. Đếm bao nhiêu câu là câu đáng hỏi. Đó là thước đo prompt của bạn
đã đủ tốt hay chưa — và cũng là cách nhanh nhất để BA thấy giá trị của cách làm này.

## Đọc thêm

- Phần "Ghi chú cho giảng viên" ở cuối [`assets/sample-requirement.md`](assets/sample-requirement.md) —
  liệt kê đủ **10** chỗ cài cắm. Đọc sau khi đã tự làm.
- Bài 6 sẽ dùng lại đúng tài liệu này để sinh testcase thật.
