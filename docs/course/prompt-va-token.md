# Prompt, Skill, Rule, Command: phân biệt và dùng đúng

> **2 giờ** · Có gì trong tay: repo có kit tối thiểu · Sau bài này: bốn loại file nằm đúng chỗ, và prompt của bạn có điều kiện dừng

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Bạn viết "hãy cẩn thận" trong prompt. Agent vẫn làm sai. Và bạn không hiểu vì sao. |
| **Bài này bạn gõ gì** | Viết một bản mẫu prompt 5 phần, rồi tách luật, kỹ năng, quy trình và lệnh ra bốn chỗ. |
| **Xong thì được gì** | Prompt có điều kiện dừng rõ ràng, và luật chỉ nằm ở một nơi. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Rule** | Luật bất biến. Luôn đúng, không phụ thuộc bạn đang làm việc gì |
| **Skill** | Năng lực theo vai. Agent mở ra khi cần, không tự nạp |
| **Workflow** | Quy trình một chặng: làm gì trước, làm gì sau |
| **Command** | Điểm vào. Gõ một dòng thì nạp đúng file và chạy đúng thứ tự |
| **Điều kiện dừng** | Câu nói cho agent biết khi nào phải dừng lại hỏi, thay vì tự đoán rồi đi tiếp |

## Bài này bạn sẽ làm gì

Bốn việc:

1. Tách bốn loại file, và hiểu vì sao nhồi chung một chỗ là hỏng (25 phút).
2. Viết bản mẫu prompt 5 phần (30 phút).
3. Học cách phân biệt câu ràng buộc có tác dụng với câu chỉ nghe hay (20 phút).
4. So hai prompt trên cùng một tài liệu, rồi đếm xem mỗi bên bắt được mấy chỗ mơ hồ (35 phút).

---

## Việc 1 — Bốn loại file, bốn vai (25 phút)

Người mới hay nhồi tất cả vào một file `CLAUDE.md` 500 dòng. Rồi agent đọc lướt, và không ai hiểu vì sao.

Tách ra bốn loại:

| Loại | Ở đâu | Là gì | Khi nào được đọc |
|---|---|---|---|
| **Rule** | `.agent/rules/` và `CLAUDE.md` | Luật bất biến, đúng với mọi việc | Luôn luôn |
| **Skill** | `.agent/skills/<vai>/` | Năng lực theo vai, ví dụ cách dựng dữ liệu | Khi agent thấy cần |
| **Workflow** | `.agent/workflows/` | Các bước của một chặng | Khi chạy chặng đó |
| **Command** | `.claude/commands/` | Điểm vào, gõ một dòng | Khi bạn gõ `/tên` |

Vì sao phải tách? Vì mỗi loại có tần suất đọc khác nhau.

Rule đọc mỗi lần chạy, nên nó phải ngắn. Skill thì có thể dài, vì chỉ mở khi cần. Nhồi một skill 300 dòng
vào file rule là bắt agent đọc 300 dòng đó ở mọi phiên, kể cả những phiên chẳng liên quan.

Và có một luật nữa, quan trọng không kém:

> Một luật chỉ được viết ở một nơi. Chỗ khác thì trỏ tới nơi đó, đừng chép lại.

Chép lại thì hai bản sẽ lệch nhau. Lúc đó không ai biết bản nào mới đúng, và người ta sẽ chọn bản tiện hơn.

## Việc 2 — Năm phần của một prompt cho việc dài (30 phút)

Prompt hỏi đáp thì một câu là đủ. Prompt giao cả một chặng việc thì cần năm phần. Thiếu phần nào hỏng theo
kiểu của phần đó:

| Phần | Nội dung | Thiếu thì sao |
|---|---|---|
| Vai trò | Bạn là ai trong việc này | Agent tự chọn giọng, thường quá tự tin |
| Đầu vào | Đọc file nào, theo thứ tự nào | Nó đoán, hoặc đọc thiếu |
| Ràng buộc | Điều gì tuyệt đối không được làm | Nó tối ưu cho "xong việc" |
| Định dạng đầu ra | Kết quả trông ra sao | Mỗi lần một kiểu, máy không đọc được |
| Điều kiện dừng | Khi nào phải dừng lại hỏi | Nó không bao giờ dừng |

Điều kiện dừng là phần quan trọng nhất, và cũng là phần hay bị quên nhất. Không có nó thì agent gặp chỗ mơ
hồ sẽ tự chọn một cách hiểu rồi đi tiếp. Bạn không biết nó đã chọn gì.

### Khuôn dùng được ngay

```
VAI TRÒ
Bạn là QA phân tích tài liệu để chuẩn bị sinh testcase. Lượt này CHƯA sinh testcase.

ĐẦU VÀO
Đọc: docs/course/assets/sample-requirement.md
Đọc toàn bộ, gồm cả các bảng và phần "Ghi chú của BA" ở cuối.

RÀNG BUỘC
- Không suy đoán bất cứ giá trị nào tài liệu không nói.
- Hai chỗ trong tài liệu nói khác nhau thì KHÔNG chọn bên nào. Báo cả hai.
- Không đề xuất giải pháp. Chỉ báo cáo tài liệu nói gì và không nói gì.

ĐỊNH DẠNG ĐẦU RA
1. Phạm vi: màn này làm gì và không làm gì.
2. Bảng luật kiểm được: | Mã | Luật | Trích từ mục nào |
3. Bảng chỗ chưa rõ: | # | Chỗ chưa rõ | Vì sao chặn | Câu hỏi cho BA |

ĐIỀU KIỆN DỪNG
Bảng 3 có bất kỳ dòng nào ở mức chặn thì ghi "CHUA_CHOT" ở cuối và DỪNG.
Không sinh testcase cho tới khi tôi trả lời.
```

Lưu khuôn này vào `prompt_templates/phase1/01_phan_tich.md`.

## Việc 3 — Câu ràng buộc nào có tác dụng (20 phút)

Câu dặn dò thất bại vì hai lý do. Một là không kiểm được. Hai là nó không nói agent phải làm gì khác đi.

| Câu không có tác dụng | Vì sao | Câu có tác dụng |
|---|---|---|
| "Hãy cẩn thận" | Không nói cẩn thận với cái gì | "Với mỗi kết quả mong đợi, ghi kèm mục nào của tài liệu nói ra nó" |
| "Đừng bỏ sót gì" | Không có cách nào biết đã sót | "Liệt kê mọi trường ở Khối B rồi đối chiếu với bảng trong tài liệu, báo số đếm hai bên" |
| "Hãy trung thực" | Agent vốn không thấy mình đang không trung thực | "Không xác định được giá trị đúng thì ghi CHƯA_XÁC_ĐỊNH, không được đoán" |
| "Test cho kỹ" | Không ai định nghĩa được "kỹ" | "Mỗi trường có ràng buộc số phải có case ở biên dưới, biên trên, và ngoài biên" |

Cách phân biệt gọn:

> Câu có tác dụng là câu mà đọc kết quả xong bạn nói được ngay là nó đã được tuân hay chưa. Nếu nhìn đầu ra
> mà không trả lời được câu đó thì bạn đang viết lời dặn, không phải ràng buộc.

Đây là forcing function ở tầng prompt. Từ Bài 15 trở đi bạn sẽ biến chúng thành máy chặn thật.

### Ba mức mơ hồ

Không phải chỗ mơ hồ nào cũng phải dừng cả lượt:

- **Chặn**: không trả lời thì không sinh case được. Ví dụ hai chỗ nói hai con số khác nhau.
- **Cần xác nhận**: sinh case được với một giả định, nhưng phải ghi rõ giả định đó ra.
- **Ghi nhận**: không ảnh hưởng lượt này, ghi lại để sau.

Chỉ mức chặn mới được dừng cả lượt. Không phân mức thì mọi chỗ hơi mơ hồ đều thành chặn, và sau ba lần bạn
sẽ tắt luôn cơ chế này. Bài 15 sẽ biến nó thành gate.

## Việc 4 — So hai prompt trên cùng một tài liệu (35 phút)

Dùng [`assets/sample-requirement.md`](assets/sample-requirement.md). Đây là tài liệu mẫu, cố ý cài cắm chỗ
mơ hồ và mâu thuẫn giống tài liệu thật.

### Bước 1: prompt sơ sài

Mở phiên mới, gõ đúng câu này, không thêm gì:

```
Đọc file docs/course/assets/sample-requirement.md và viết testcase cho màn này.
```

Lưu kết quả vào `docs/bai-06-so-sai.md`.

### Bước 2: prompt có ràng buộc

Mở phiên **mới**. Chỗ này quan trọng, vì phiên cũ đã có ngữ cảnh rồi. Dùng khuôn 5 phần ở Việc 2.

Lưu kết quả vào `docs/bai-06-co-rang-buoc.md`.

### Bước 3: đếm

Tài liệu mẫu cài ba chỗ mơ hồ có chủ ý, tất cả nằm ở phần "Ghi chú của BA" cuối file:

| # | Chỗ mơ hồ | Lượt sơ sài có bắt? | Lượt có ràng buộc có bắt? |
|---|---|---|---|
| 1 | Hai mốc phí giao hàng khác nhau, 500.000 và 700.000 | | |
| 2 | Luật "hạng Vàng trên 10 triệu phải duyệt ngay" không có trong luồng chính | | |
| 3 | Khách chưa được phân hạng thì tính giảm giá thế nào | | |

Điền bảng. Kết quả hay gặp: lượt sơ sài bỏ cả ba và không hỏi câu nào. Lượt có ràng buộc bắt được ít nhất
chỗ số 1.

### Bước 4: viết câu ràng buộc của riêng bạn

Nhìn những chỗ mà lượt có ràng buộc vẫn bỏ sót. Viết thêm một câu để lần sau bắt được.

Nhớ tiêu chí ở Việc 3: câu đó phải kiểm được bằng cách đọc kết quả.

Ghi vào `prompt_templates/`. Đây là dòng đầu tiên trong bộ prompt của bạn.

```bash
git add docs prompt_templates
git commit -m "docs: bài 6 — so prompt sơ sài với prompt có ràng buộc"
```

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/
│   ├── rules/                    ·  từ Bài 5
│   ├── skills/
│   │   └── <vai>/SKILL.md        ← MỚI · năng lực theo vai, agent mở khi cần
│   └── workflows/
│       └── phase1.md             ← MỚI · quy trình, gọi prompt theo thứ tự
├── prompt_templates/
│   └── phase1/
│       └── 01_phan_tich.md       ← MỚI · 5 phần, có ĐIỀU KIỆN DỪNG
└── docs/
    ├── bai-06-so-sai.md          ← MỚI · kết quả lượt prompt sơ sài
    └── bai-06-co-rang-buoc.md    ← MỚI · kết quả lượt có ràng buộc
```

Giữ lại hai file kết quả ở `docs/`. Vài bài nữa bạn sẽ mở lại chúng để so.

## Tự kiểm

1. Kể bốn loại file và vai của từng loại. Vì sao skill không nên nằm trong file rule?
2. Năm phần của prompt việc dài là gì? Phần nào hay bị quên nhất, và quên thì hỏng ra sao?
3. Vì sao "hãy cẩn thận" không có tác dụng? Viết lại nó thành câu có tác dụng.
4. Cách phân biệt câu ràng buộc với lời dặn, nói bằng một câu.
5. Ba mức mơ hồ là gì? Vì sao không nên coi mọi chỗ mơ hồ đều là chặn?
6. Ở Bước 3, lượt sơ sài bắt được mấy trên ba? Lượt có ràng buộc thì mấy?

## Bài tập về nhà

Lấy một tài liệu thật của dự án bạn. Chạy khuôn 5 phần lên nó, nhưng chỉ tới bước liệt kê chỗ chưa rõ. Chưa
sinh testcase.

Mang bảng "chỗ chưa rõ" đó đi hỏi BA thật. Đếm xem bao nhiêu câu là câu đáng hỏi.

Con số đó cho biết prompt của bạn đã đủ tốt chưa. Nó cũng là cách nhanh nhất để BA thấy cách làm này có giá trị.

## Bài sau

Bài 12 vào việc thật: đọc requirement nằm rải ở bốn nơi, mỗi nơi nói một kiểu, và bóc nó thành bảng luật dùng
được.
