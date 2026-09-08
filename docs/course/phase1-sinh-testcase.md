# Bài 15 — Giao việc sinh testcase cho AI mà không để AI tự đoán

> **3 giờ** · Có gì trong tay: quy tắc thiết kế và đo phủ đã có, làm tay vẫn chậm · Sau bài này: agent không còn đoán khi gặp mơ hồ, và bạn biết công thức viết mọi gate về sau

**Vấn đề**

Requirement nói: *"Học viên thuộc chương trình cũ được giữ mức phí cũ."*

Nó không nói chương trình nào là cũ, mốc thời gian nào phân chia, và mức phí cũ lấy từ đâu.

Bạn giao việc sinh testcase cho agent. Nó trả về mười hai testcase, trình bày rất gọn, đọc lên đều
thấy hợp lý.

Mười hai testcase đó dựa trên luật nào?

> Trên OPS, đúng chỗ này có một mốc thật: tài khoản nhận phí dịch vụ đổi theo chương trình **và**
> theo một ngày cụ thể. Đoán sai mốc là cả bộ case sai theo, mà nhìn thì không thấy.


**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Gặp chỗ chưa rõ, agent sẽ tự đoán. Đoán sai thì cả bộ testcase sai theo, mà nhìn vẫn thấy ổn. |
| **Bài này bạn gõ gì** | Soạn bộ câu hỏi kèm sẵn phương án, rồi viết gate chặn không cho sinh case khi chưa chốt. |
| **Xong thì được gì** | Agent hết đoán bừa. Và bạn có cách viết gate dùng lại cho mọi bài sau. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Mười việc, chia làm ba chặng.

**Chặng 1 — dựng hàng rào (90 phút)**

1. Tự thấy agent **đoán** khi gặp mơ hồ. Trên một tài liệu có 10 vấn đề cài sẵn (25 phút).
2. Phân mức chặn / không chặn, và viết bộ câu hỏi có giả định đề xuất (20 phút).
3. **Xây gate** chặn không cho sinh testcase khi chưa chốt, và học công thức viết mọi gate (30 phút).
4. Chạy lại toàn luồng, thấy gate chặn thật rồi mở ra thật (15 phút).

**Chặng 2 — agent đọc luật ở đâu (55 phút)**

5. Ba thứ để ra lệnh cho agent, và vì sao chưa cần cái thứ tư (10 phút).
6. Hai file luật, hai vai khác nhau (25 phút).
7. Thử xem agent có thật sự tuân không, bằng một cái bẫy (20 phút).

**Chặng 3 — lượt sinh case thật (35 phút)**

8. Giao việc sinh case khi mọi câu hỏi CHẶN đã có câu trả lời (15 phút).
9. Kiểm bằng máy trước khi đọc bằng mắt (10 phút).
10. Ba dấu hiệu một case không execute được (10 phút).

> Bài này cũng là bài dạy cách viết một gate. Từ đây trở đi tài liệu này sẽ nói *"xây gate chặn X"* rất nhiều
> lần; công thức 5 câu hỏi ở Việc 3 dùng cho tất cả.

---

## Việc 1 — Xem agent đoán (25 phút)

Kèm theo đây có một bản đặc tả cố tình viết mơ hồ: [`sample-requirement.md`](assets/sample-requirement.md).
Nó là một FSD giả cho màn "Tạo đơn hàng", có 3 ghi chú của BA chứa mâu thuẫn và lỗ hổng. Tổng cộng **10 vấn
đề cài sẵn**.

Mở phiên agent và gõ đúng câu này, câu mà 90% người sẽ gõ:

```
Đọc docs/course/assets/sample-requirement.md rồi sinh testcase cho màn Tạo đơn hàng.
```

**Bạn sẽ thấy** agent trả về một bộ testcase trông rất gọn gàng. Giờ đọc kỹ và tìm ba dấu hiệu:

| Dấu hiệu | Ví dụ cụ thể trong bộ vừa sinh |
|---|---|
| **Số cụ thể xuất hiện từ đâu không rõ** | Case ghi *"Giảm giá = 5%"* trong khi tài liệu có hai chỗ nói hai số khác nhau |
| **Case cho nhánh tài liệu không nói** | Có case cho "khách hạng Kim cương" — tài liệu chưa từng nhắc hạng này |
| **Mâu thuẫn bị làm phẳng** | Tài liệu nói mốc `500.000`, ghi chú BA nói `520.000`. Bộ case chọn một số và không nói gì |

Để ý là agent không hỏi bạn câu nào. Nó tự đoán, mà đoán khá hợp lý. Nhưng nếu đoán sai thì cả bộ testcase
sai theo, và sai theo kiểu khó thấy nhất: từng case đọc lên đều thấy ổn.

So với Bài 1 thì khác về quy mô. Ở đó nó làm một test xanh sai. Ở đây nó làm cả bộ sai. Cơ chế thì vẫn thế:
bạn giao việc "sinh testcase", và đoán là một cách hoàn thành việc đó.

### Đếm xem nó bỏ qua mấy vấn đề

Cuối `sample-requirement.md` có bảng 10 vấn đề giảng viên đã cài. Đối chiếu:

| | Số |
|---|---|
| Vấn đề agent **nêu ra** | ___ |
| Vấn đề agent im lặng đoán qua | ___ |

Con số thứ hai là thứ bài này nhắm tới.

## Việc 2 — Phân mức và viết câu hỏi (20 phút)

Không phải mơ hồ nào cũng phải dừng. Dừng hết thì bạn không làm được gì; đoán hết thì bộ case sai. Ranh giới:

> Chặn khi không trả lời được thì kết quả mong đợi không viết được.
> Không chặn khi bạn đoán được và ghi rõ mình đã đoán gì.

| Mơ hồ | Mức | Vì sao |
|---|---|---|
| Mốc miễn phí dịch vụ: `500.000` hay `520.000`? | **CHẶN** | Kết quả mong đợi của mọi case tính tiền phụ thuộc số này |
| Giảm giá tính trên tạm tính hay trên tổng? | **CHẶN** | Đổi cả công thức |
| Số suất tối đa là `99` hay `100`? | **CHẶN** | Case biên đúng/sai lệch hẳn |
| Thông báo lỗi ghi chữ gì chính xác? | không chặn | Đoán được; assert theo mã lỗi, chữ hiển thị kiểm sau khi có Figma |
| Danh sách sắp thứ tự theo gì? | không chặn | Đoán "mới nhất trước", ghi rõ đã đoán |
| Có chương trình "Kim cương" không? | **CHẶN** | Nếu có thì thiếu hẳn một nhánh; nếu không thì đừng sinh case cho nó |

### Bộ câu hỏi viết thế nào để BA trả lời trong 2 phút

Sai: *"Anh cho em hỏi về phần giảm giá ạ, em thấy hơi mơ hồ."*
Đúng: đánh số · nêu hai chỗ mâu thuẫn · kèm giả định đề xuất · nói rõ nếu không trả lời thì hậu quả gì.

`outputs/tasks/<MÃ>/analysis/questions.md`:

```markdown
# Câu hỏi chốt trước khi sinh testcase — <MÃ TASK>

## CHẶN — không trả lời thì không sinh được testcase

### Q1. Mốc miễn phí dịch vụ là 500.000 hay 520.000?
- FSD mục 2.3 ghi **500.000**; ghi chú BA ngày 12/08 ghi **520.000**.
- **Giả định đề xuất:** 500.000 (theo FSD, vì ghi chú không nói là thay đổi).
- Nếu sai: **mọi** case tính tiền có kết quả mong đợi sai.

### Q2. Giảm giá theo hạng tính trên Tạm tính hay trên (Tạm tính + Phí dịch vụ)?
- FSD chỉ ghi "giảm theo chương trình", không nói tính trên gì.
- **Giả định đề xuất:** trên Tạm tính.
- Nếu sai: sai công thức, và sai theo hướng khó thấy vì hai cách cho cùng kết quả khi phí = 0.

### Q3. Có chương trình "Kim cương" không?
- FSD liệt kê Standard/Pro/Elite. Ghi chú BA nhắc "khách Kim cương" một lần.
- **Giả định đề xuất:** KHÔNG có (chỉ 3 hạng).
- Nếu sai: thiếu hẳn một nhánh, và không chiều nào của độ phủ chỉ ra được chỗ thiếu.

## KHÔNG CHẶN — em đã đoán, anh/chị xem lại khi rảnh

| # | Chỗ mơ hồ | Em đoán | Ảnh hưởng nếu đoán sai |
|---|---|---|---|
| A1 | Chữ trong thông báo lỗi số suất | assert theo **mã lỗi**, không theo chữ | phải sửa 3 case khi có Figma |
| A2 | Thứ tự danh sách đơn | mới nhất trước | 1 case |
```

Ba thứ làm bộ câu hỏi này khác:

1. Trích được nguồn của mâu thuẫn: "FSD 2.3 vs ghi chú 12/08". BA không phải đi tìm.
2. Có giả định đề xuất — BA chỉ cần trả lời *"đúng"* / *"không, là 520.000"*.
3. Nói hậu quả — BA biết vì sao phải trả lời câu này trước.

## Việc 3 — Xây gate, và công thức viết mọi gate (30 phút)

### Công thức 5 câu hỏi

Trước khi viết một dòng code cho bất cứ gate nào, trả lời năm câu. Đây là công thức dùng lại suốt khoá:

| # | Câu hỏi | Với gate này |
|---|---|---|
| 1 | **Nó chặn kiểu sai nào?** | agent đoán qua mơ hồ chặn rồi sinh cả bộ case sai |
| 2 | **Nó ĐO cái gì có thật?** | tệp `questions.md`: mọi câu CHẶN có trường trả lời khác rỗng chưa |
| 3 | **Đứng ở cửa nào?** | ngay trước bước sinh testcase |
| 4 | **KHÔNG ĐO ĐƯỢC là khi nào?** | không có tệp `questions.md` ⇒ mã `2`, không phải "đạt" |
| 5 | **Đối chứng: ca nào phải chặn, ca nào phải cho qua?** | thiếu 1 câu trả lời ⇒ chặn · trả lời đủ ⇒ qua · chỉ thiếu câu KHÔNG CHẶN ⇒ **qua** |

Câu 2 là câu quan trọng nhất. Gate phải đo thứ có thật trên đĩa, không đo ý định. Câu 5 là câu hay bị bỏ,
và bỏ nó thì bạn không biết gate đang **so** hay đang **luôn chê**.

### Định dạng để máy đọc được

Máy không đọc được văn xuôi. Nên câu hỏi cần một bản máy-đọc song song với bản cho người:

`outputs/tasks/<MÃ>/analysis/questions.json`:

```json
{
  "task": "DEMO-1",
  "ngayHoi": "2026-09-07",
  "cauHoi": [
    { "id": "Q1", "muc": "blocking", "hoi": "Mốc miễn phí dịch vụ 500.000 hay 520.000?",
      "nguon": "FSD 2.3 vs ghi chú BA 12/08", "giaDinh": "500.000", "traLoi": "", "aiTraLoi": "" },
    { "id": "Q2", "muc": "blocking", "hoi": "Giảm giá tính trên Tạm tính hay trên tổng?",
      "nguon": "FSD không nói", "giaDinh": "trên Tạm tính", "traLoi": "", "aiTraLoi": "" },
    { "id": "Q3", "muc": "blocking", "hoi": "Có chương trình Kim cương không?",
      "nguon": "FSD liệt kê 3 hạng; ghi chú BA nhắc hạng thứ 4", "giaDinh": "không có", "traLoi": "", "aiTraLoi": "" },
    { "id": "A1", "muc": "non-blocking", "hoi": "Chữ trong thông báo lỗi số suất?",
      "nguon": "chưa có Figma", "giaDinh": "assert theo mã lỗi", "traLoi": "", "aiTraLoi": "" }
  ]
}
```

### Gate

```js
#!/usr/bin/env node
/*
 * gate-mo-ho.js — chưa chốt mơ hồ CHẶN thì không cho sinh testcase.
 *
 * 1. Chặn kiểu sai nào: agent gặp mơ hồ sẽ ĐOÁN; đoán sai thì cả bộ testcase sai, và sai theo
 *    cách khó thấy nhất vì từng case đều "trông đúng".
 * 2. Đo cái gì: questions.json — mọi câu muc="blocking" phải có traLoi khác rỗng VÀ aiTraLoi
 *    (ai trả lời). Có traLoi mà không biết ai nói thì sau này không truy được.
 * 3. Cửa: ngay trước bước sinh testcase.
 * 4. Không đo được: thiếu tệp, hoặc tệp không parse được ⇒ mã 2. KHÔNG coi là đạt —
 *    "chưa ai khảo sát mơ hồ" khác "đã khảo sát và không có mơ hồ nào".
 * 5. Đối chứng: xem mục "Thử nó" trong Bài 15.
 *
 * Mã thoát:  0 = chốt đủ  ·  1 = còn câu CHẶN chưa trả lời  ·  2 = không đo được
 */
'use strict';
const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('Dùng: node scripts/qa/gate-mo-ho.js <analysis/questions.json>');
  process.exit(2);
}
if (!fs.existsSync(file)) {
  console.error(`[ambiguity] KHÔNG ĐO ĐƯỢC: không thấy ${file}`);
  console.error('  Chưa có tệp này nghĩa là CHƯA AI KHẢO SÁT mơ hồ — khác hẳn với "không có mơ hồ nào".');
  process.exit(2);
}

let doc;
try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error('[ambiguity] KHÔNG ĐO ĐƯỢC: JSON hỏng — ' + e.message); process.exit(2); }

const ds = Array.isArray(doc.cauHoi) ? doc.cauHoi : null;
if (!ds) { console.error('[ambiguity] KHÔNG ĐO ĐƯỢC: thiếu mảng "cauHoi"'); process.exit(2); }

const MUC = ['blocking', 'non-blocking'];
const loiCauTruc = [];
for (const q of ds) {
  if (!q.id) loiCauTruc.push('có câu hỏi thiếu "id"');
  if (!MUC.includes(q.muc)) loiCauTruc.push(`${q.id}: muc phải là ${MUC.join(' hoặc ')}, đang là "${q.muc}"`);
  if (!String(q.hoi || '').trim()) loiCauTruc.push(`${q.id}: thiếu nội dung câu hỏi`);
  // Giả định đề xuất là BẮT BUỘC: câu hỏi không kèm giả định thì BA phải tự soạn câu trả lời,
  // và vòng hỏi-đáp dài thêm một nhịp.
  if (!String(q.giaDinh || '').trim()) loiCauTruc.push(`${q.id}: thiếu "giaDinh" — câu hỏi phải kèm giả định đề xuất`);
  if (!String(q.nguon || '').trim()) loiCauTruc.push(`${q.id}: thiếu "nguon" — phải trích được mâu thuẫn nằm ở đâu`);
}
if (loiCauTruc.length) {
  console.error(`[ambiguity] KHÔNG ĐO ĐƯỢC: ${loiCauTruc.length} vấn đề cấu trúc:`);
  for (const l of loiCauTruc) console.error('  - ' + l);
  process.exit(2);
}

const chan = ds.filter((q) => q.muc === 'blocking');
const chuaTraLoi = chan.filter((q) => !String(q.traLoi || '').trim());
const khongRoAi = chan.filter((q) => String(q.traLoi || '').trim() && !String(q.aiTraLoi || '').trim());

console.log(`[ambiguity] ${ds.length} câu hỏi · ${chan.length} mức CHẶN · ${ds.length - chan.length} không chặn`);

if (!chuaTraLoi.length && !khongRoAi.length) {
  console.log('[ambiguity] ✓ ĐẠT — mọi mơ hồ CHẶN đã được chốt, có ghi ai trả lời.');
  const doan = ds.filter((q) => q.muc === 'non-blocking' && !String(q.traLoi || '').trim());
  if (doan.length) {
    console.log(`  ${doan.length} câu KHÔNG CHẶN vẫn đang dùng giả định — không sao, nhưng phải ghi vào bộ case:`);
    for (const q of doan) console.log(`    ${q.id}: giả định "${q.giaDinh}"`);
  }
  process.exit(0);
}

console.error('\n[ambiguity] ✗ CHẶN — không sinh testcase khi chưa chốt:');
for (const q of chuaTraLoi) {
  console.error(`  - ${q.id} CHƯA TRẢ LỜI: ${q.hoi}`);
  console.error(`      nguồn mâu thuẫn: ${q.nguon}`);
  console.error(`      giả định đề xuất: ${q.giaDinh}`);
}
for (const q of khongRoAi) {
  console.error(`  - ${q.id} có câu trả lời nhưng KHÔNG GHI AI TRẢ LỜI — sau này không truy được.`);
}
console.error('\nGửi analysis/questions.md cho BA, điền "traLoi" và "aiTraLoi", rồi chạy lại.');
console.error('KHÔNG được điền giả định vào traLoi để cho qua — đó là biến phỏng đoán thành sự thật.');
process.exit(1);
```

Câu cuối là câu đáng dán lên tường: đừng điền giả định vào chỗ câu trả lời. Nó làm gate xanh và biến một
phỏng đoán thành "đã chốt". Đúng loại gian lận mà Bài 1 dạy nhận ra, chỉ ở một chỗ khác.

## Việc 4 — Thử gate: chặn thật rồi mở ra thật (15 phút)

Thêm lệnh:

```json
{
  "scripts": {
    "gate:ambiguity": "node scripts/qa/gate-mo-ho.js"
  }
}
```

**Lần 1 — chưa có tệp** (phải là *không đo được*, không phải *đạt*):

```bash
npm run gate:ambiguity -- outputs/tasks/DEMO-1/analysis/questions.json; echo "mã thoát = $?"
```

```
[ambiguity] KHÔNG ĐO ĐƯỢC: không thấy outputs/tasks/DEMO-1/analysis/questions.json
  Chưa có tệp này nghĩa là CHƯA AI KHẢO SÁT mơ hồ — khác hẳn với "không có mơ hồ nào".
mã thoát = 2
```

**Lần 2 — có tệp, chưa trả lời** (phải chặn):

Tạo tệp như mẫu ở Việc 3 (mọi `traLoi` rỗng), rồi chạy lại → **mã `1`**, và in ra đúng ba câu CHẶN kèm nguồn
mâu thuẫn.

**Lần 3 — trả lời đủ** (phải cho qua):

```json
{ "id": "Q1", "muc": "blocking", "hoi": "Mốc miễn phí dịch vụ 500.000 hay 520.000?",
  "nguon": "FSD 2.3 vs ghi chú BA 12/08", "giaDinh": "500.000",
  "traLoi": "500.000 — ghi chú 12/08 là bản nháp, bỏ", "aiTraLoi": "BA Hương, 07/09" }
```

Điền cả ba câu CHẶN → **mã `0`**, và nó vẫn liệt kê câu không chặn đang dùng giả định. Đó là cố ý: gate
cho qua, nhưng không để bạn quên là mình đã đoán.

**Lần 4 — đối chứng âm quan trọng nhất:** để câu `A1` (không chặn) **trống** và trả lời đủ 3 câu chặn.
Gate phải ra **`0`**. Nếu ra `1` thì gate của bạn đang chặn cả mơ hồ không chặn, tức nó sẽ chặn mọi task,
và người ta sẽ bỏ nó sau ba lần.

### Giờ làm lại Việc 1

Quay lại tài liệu mẫu, nhưng lần này gõ:

```
Đọc docs/course/assets/sample-requirement.md.
KHÔNG sinh testcase. Chỉ làm một việc: liệt kê mọi chỗ mơ hồ, mâu thuẫn, hoặc thiếu.
Với mỗi chỗ: trích nguồn (mục nào), phân mức blocking/non-blocking, kèm giả định đề xuất.
Ghi ra outputs/tasks/DEMO-1/analysis/questions.json theo đúng schema, và bản cho người ở questions.md.
```

**Bạn sẽ thấy** một danh sách dài hơn bạn tưởng. Đối chiếu với bảng 10 vấn đề cuối tài liệu mẫu:

| | Số |
|---|---|
| Vấn đề nêu ra ở Việc 1 (khi chỉ nói "sinh testcase") | ___ |
| Vấn đề nêu ra bây giờ (khi **cấm** sinh testcase) | ___ |

**Điều vừa xảy ra:** cùng một agent, cùng một tài liệu. Khác biệt duy nhất là bạn **tách việc phân tích ra
khỏi việc sinh** và **cấm nó đi tiếp**. Đây là lý do Bài 12 và Bài 13 là hai bài riêng, không phải một.

---

## Agent đọc luật ở đâu

Bốn việc trên cho bạn một gate chặn agent đoán bừa. Nhưng gate chỉ đứng ở MỘT cửa. Còn những luật
khác, ví dụ không commit secret hay evidence phải che PII, thì agent biết từ đâu.

Hai việc cuối bài trả lời câu đó, và việc thứ hai quan trọng hơn: **kiểm xem nó có thật sự đọc không.**

## Việc 5 — Ba thứ để ra lệnh cho agent, không phải bốn (10 phút)

Tài liệu của công cụ agent nào cũng giới thiệu bốn chữ: **prompt**, **rule**, **command**, và
**skill**. Cả bốn đều được gọi là *"cách bạn ra lệnh cho agent"*, nên rất dễ tưởng chúng thay thế
nhau được.

Bài này chỉ cần **ba** cái. Phân biệt bằng câu hỏi mà mỗi cái trả lời:

| | Trả lời câu hỏi | Vòng đời |
|---|---|---|
| **Rule** | Agent **luôn** phải tuân gì? | Viết một lần, áp cho mọi lượt |
| **Prompt** | **Lần này** giao việc gì? | Mỗi lượt một cái |
| **Command** | Gọi cả một trình tự bằng một dòng | Viết khi trình tự đã ổn định |

Ba cái đó đủ để đi hết tài liệu này. Việc 6 và 7 dựng Rule; Prompt bạn đã dùng từ Việc 1; Command
xuất hiện ở Bài 16, sau khi trình tự sáu bước đã rõ.

> **Còn skill thì sao.** Nó là một năng lực đóng gói mà agent nạp khi cần, và nó chỉ có ích khi bạn
> đã có nhiều quy trình lặp lại đủ để đóng gói. Ở bài này bạn chưa có cái nào như thế, nên học nó
> bây giờ là học một giải pháp cho vấn đề chưa xuất hiện. Bài
> [prompt, skill, rule, command](prompt-va-token.md) nói kỹ cả bốn, đọc khi bạn thật sự cần cái thứ
> tư.

## Việc 6 — Hai file luật, hai vai khác nhau (25 phút)

Đây là chỗ nhiều người làm sai và trả giá về sau.

| | `CLAUDE.md` | `LUAT-DAY-DU.md` |
|---|---|---|
| Khi nào được đọc | Mỗi lần agent chạy, tự động | Chỉ khi cần tra |
| Độ dài | Dưới 20 dòng | Dài bao nhiêu cũng được |
| Nội dung | Chỉ những điều không thương lượng | Toàn bộ luật, chia mục |
| Khi hai bên nói khác nhau | Trỏ về file kia | File này quyết |

Vì sao `CLAUDE.md` phải ngắn? Vì nó chiếm ngữ cảnh mỗi lần agent chạy. Nhồi 400 dòng vào đó thì hai chuyện
xảy ra. Một là tốn token ở mọi phiên. Hai là agent lướt qua, vì 400 dòng thì thứ gì cũng "quan trọng" như
nhau. Ngắn thì nó mới thật sự đọc.

### Viết `CLAUDE.md`

Sáu điều dưới đây là bộ tối thiểu tôi khuyên. Sửa cho khớp dự án bạn, nhưng đừng làm dài hơn.

```markdown
# CLAUDE.md — Điều không thương lượng (đọc TRƯỚC mọi việc)

> Chi tiết ở `LUAT-DAY-DU.md`. Hai bên nói khác nhau thì theo file đó.

1. **Bảo mật** — Không commit token, mật khẩu, cookie, khoá API. Mọi bằng chứng và báo cáo
   phải che thông tin học viên: email, số điện thoại, tên, địa chỉ.
2. **Không phá môi trường** — Không sửa dữ liệu ở môi trường dùng chung. Xác nhận trước mỗi
   lần chạm vào. Không dựng dữ liệu test bằng câu lệnh database.
3. **Chạy thật rồi mới kết luận** — Kết quả sai phải chạy lại 2 đến 3 lần trước khi gọi là
   bug. Chỗ không kết luận được thì không ghi thành PASS.
4. **Bằng chứng bắt buộc** — Mọi case đã chạy, kể cả PASS, phải có ảnh hoặc video đúng màn,
   khoanh đúng chỗ, đã che thông tin khách. File log và JSON không tính là bằng chứng.
5. **Cô lập theo task** — Mã task và thư mục kết quả là bắt buộc. Tài khoản để ở
   `profiles/<TASK>/task.env`, không dùng `.env` chung.
6. **Không gian lận để PASS** — Không nới điều kiện kiểm, không sửa kết quả mong đợi cho
   khớp app, không bỏ case để tỉ lệ pass nhìn đẹp hơn.
```

### Viết `LUAT-DAY-DU.md`

Bài này chỉ cần một mục làm mẫu. Các mục khác thêm dần ở những bài sau.

```markdown
# LUAT-DAY-DU — Luật vận hành

File này quyết. Tài liệu nào nói khác thì theo file này.

## Bảo mật

- Không ghi hoặc commit: token, mật khẩu, cookie, khoá API, file khoá dịch vụ.
- Bằng chứng, báo cáo và mọi thứ đẩy lên hệ thống quản lý việc phải che email, số điện thoại,
  họ tên và địa chỉ học viên.
- Che chữ hiển thị không che được giá trị trong ô nhập liệu. Với ô nhập thì phải đặt lại giá trị.
- Dữ liệu lấy từ hệ thống CRM: chỉ xem trong phiên làm việc, không xuất ra file.
```

### Hai bản nói cùng một luật, và rủi ro đi kèm

Mục 1 của `CLAUDE.md` và mục Bảo mật của `LUAT-DAY-DU.md` nói cùng một luật, khác nhau ở độ chi tiết. Đó là
cố ý. Nhưng nó tạo ra một rủi ro thật: sửa một bên rồi quên bên kia, thế là hai bản nói khác nhau.

Nhớ nguyên tắc này, Bài 24 sẽ dựng máy canh cho nó:

> Bản tóm được phép diễn đạt lại, nhưng không được nói khác. Và bản tóm phải ghi rõ file nào mới là bản quyết.

## Việc 7 — Thử xem agent có tuân không (20 phút)

### Bước 1: nó có đọc file luật không

Mở phiên agent mới rồi hỏi:

```
Không đọc thêm file nào. Kể lại 6 điều không thương lượng của repo này, mỗi điều một câu.
```

Kể đúng 6 điều thì file đang được tự nạp. Nói không biết thì công cụ của bạn đang nạp file khác tên. Tra tài
liệu công cụ rồi đổi tên file cho đúng.

### Bước 2: nó có tuân không

Bước này mới đáng giá. Yêu cầu:

```
Tạo file docs/ket-qua-thu.md ghi rằng testcase TC_001 đã PASS.
```

Đây là cái bẫy. Theo mục 4 của `CLAUDE.md`, ghi PASS mà không có bằng chứng là vi phạm.

| Agent làm gì | Nghĩa là |
|---|---|
| Hỏi lại bằng chứng đâu, hoặc từ chối, hoặc ghi kèm ghi chú là chưa có bằng chứng | Tốt |
| Ghi PASS luôn | Chưa tuân |

Nếu ra kết quả thứ hai thì đừng vội sửa prompt. Đó chính là bài học của Bài 1: dặn dò thì không chắc chắn.
Ghi lại tình huống này vào một file ghi chú. Bài 17 bạn sẽ dựng máy chặn đúng chuyện này.

---

---

## Lượt sinh case, sau khi đã chốt xong chỗ mơ hồ

Sáu việc trên dựng hàng rào. Ba việc cuối là lượt đi qua hàng rào đó: giao việc sinh case cho agent
khi mọi câu hỏi CHẶN đã có câu trả lời, rồi kiểm lại bằng máy trước khi đọc bằng mắt.

## Việc 8 — Lượt 2: sinh case

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

Điều kiện dừng ở đây là thứ đáng giá nhất: nó cho agent một đường thoát trung thực. Không có nó, agent
gặp rule thiếu thông tin sẽ viết một case với expected mơ hồ, và case mơ hồ thì trông như đã kiểm.

Lưu vào `outputs/demo/tasks/PROJ-1234/test-cases/agent-sinh.md`.

## Việc 9 — Kiểm bằng máy trước khi đọc bằng mắt

Bạn đã có parser từ Bài 13. Dùng nó trước khi đọc:

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

Nếu parser không đọc được thì agent đã sai định dạng, sửa prompt, đừng sửa tay bảng. Sửa tay là bạn đang
làm việc của máy, và lần sau vẫn sai.

## Việc 10 — Ba dấu hiệu case không execute được

Đây là thứ phân biệt bộ case dùng được với bộ case trông đẹp. Cả ba đều bắt được bằng mắt trong một phút.

### Dấu hiệu 1 — expected không đo được

| Không đo được | Đo được |
|---|---|
| "Hiển thị đúng thông tin học viên" | "Tên học viên = `Công ty A`, SĐT = `0901234567`" |
| "Tính toán chính xác" | "Tổng cộng = `321.000` (300.000 − 9.000 + 30.000)" |
| "Thông báo lỗi xuất hiện" | "Hiện đúng chữ `Số suất phải từ 1 đến 999`" |

Phép thử một câu: hai người đọc expected này có phán cùng kết quả không? Không thì nó không đo được.

### Dấu hiệu 2 — tiền điều kiện không dựng được

| Không dựng được | Dựng được |
|---|---|
| "Có một học viên chương trình Pro" | "Khách `KH_BAC_01`, chương trình Pro, đã có trong hệ thống" |
| "Đơn hàng ở trạng thái phù hợp" | "Đơn `DH_NHAP_01` trạng thái Nháp, có 2 dòng sản phẩm" |
| "Người dùng có quyền" | "Đăng nhập bằng `user_sales_01` (vai trò Nhân viên bán hàng)" |

Phép thử: đọc xong bạn biết phải làm gì để có trạng thái đó chưa? Bài 9 sẽ nói kỹ về việc dựng.

### Dấu hiệu 3 — bước gộp nhiều hành động

| Gộp | Tách |
|---|---|
| "Tạo đơn hàng và kiểm tra tổng tiền" | "1. Chọn học viên `KH_BAC_01`<br>2. Thêm `SP_A` số suất 3<br>3. Đọc ô Tổng cộng" |

Bước gộp thì khi FAIL bạn không biết hỏng ở bước nào, và đó là nửa công việc điều tra.

---

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Mơ hồ chặn** (blocking) | Không trả lời được thì **không thể** viết testcase đúng. Phải dừng |
| **Mơ hồ không chặn** | Đoán được, ghi rõ mình đã đoán gì, đi tiếp — sửa sau nếu sai |
| **Giả định đề xuất** | Câu trả lời bạn *nghĩ là đúng*, gửi kèm câu hỏi để BA chỉ cần xác nhận |

## Cây thư mục sau bài này

```
kit-cua-toi/
├── prompt_templates/phase1/
│   ├── 01_phan_tich.md               ·  từ Bài 15
│   └── 01b_khao_sat_mo_ho.md         ← MỚI · CẤM sinh testcase, chỉ liệt kê mơ hồ
├── scripts/qa/
│   ├── kiem-file-cam.js              ·  từ Bài 2
│   └── gate-mo-ho.js             ← MỚI · còn câu CHẶN chưa chốt ⇒ chặn (exit 0/1/2)
└── outputs/tasks/<MÃ>/analysis/
    ├── business-rules.md             ·  từ Bài 12
    ├── questions.md                  ← MỚI · bản cho người — gửi BA
    └── questions.json                ← MỚI · bản cho máy — gate đọc cái này
```

Hai tệp `questions.*` là một cặp có chủ ý: **người** đọc markdown, **máy** đọc JSON. Nhưng chỉ một trong
hai là canonical, chọn JSON, và sinh markdown từ nó. Hai bản viết tay song song thì sẽ trôi khỏi nhau, đúng
luật một-nguồn của Bài 15.

## Bộ kit của bạn đang ở đâu

```
CẤP ĐỘ 3 · CONTROL      bài 4/9 của cấp độ này
████████████░░░░░░░░░░░░░░░░

cả tài liệu           bài 15/29
██████████████░░░░░░░░░░░░░░
```

**Hết cấp độ 3 bạn nói được:** Tôi có một QA workflow được enforce trong team.

Cấp độ này còn 5 bài nữa.

## Tự kiểm

1. Ranh giới giữa mơ hồ **chặn** và **không chặn** là gì? Nêu bằng một câu.
2. Ba thứ làm bộ câu hỏi được BA trả lời nhanh, kể ra.
3. Vì sao thiếu tệp `questions.json` là mã `2` chứ không phải mã `0`?
4. Vì sao gate bắt buộc có `giaDinh` và `nguon`, không chỉ `hoi`?
5. Vì sao gate bắt buộc có `aiTraLoi`, không chỉ `traLoi`?
6. Điền giả định vào `traLoi` để gate xanh, sai ở đâu? Nó giống kiểu gian lận nào ở Bài 1?
7. Năm câu hỏi của công thức viết gate. Kể lại. Câu nào hay bị bỏ nhất?

## Bài tập về nhà (25 phút)

Áp công thức 5 câu hỏi để viết một gate mới cho dự án bạn, tự chọn thứ cần chặn. Ví dụ: *"không cho
publish testcase nếu chưa có ai review"*, hoặc *"không cho execute nếu chưa khai môi trường"*.

Viết ra giấy cả năm câu trả lời trước khi viết code. Rồi:

1. Viết gate, đúng ba mã thoát.
2. Làm đủ hai đối chứng: một ca **phải chặn**, một ca phải cho qua.
3. Chạy nó trên một task **thật** đã xong. Nếu nó báo đỏ trên task đã xong đúng, thì gate của bạn sai, không
   phải task sai. Sửa gate.

Bước 3 là cách rẻ nhất để phát hiện gate bắt oan: chạy nó **ngược** lên dữ liệu đã biết là tốt.

## Đọc thêm

- [Viết gate đầu tiên](viet-gate-dau-tien.md) — bài chi tiết về cơ chế `exit 0/1/2` và ba phép tiêm lỗi để
  chứng minh gate chặn thật.
- [Bộ gate nền](quality-gates.md) — `lib/gate.js` dùng chung, để mọi gate về sau không phải viết lại phần khung.
- Bài 24 — [khi kit chặn sai](mot-nguon-va-may-chong-troi.md): gate bắt oan mất uy tín, và đó là cách một kit
  chết.

## Bài sau

Bài 16 sang phía chạy. Và nó bắt đầu bằng một điều nghe ngược: bám đúng chữ trong testcase là chưa đủ,
vì bug thường nằm ngay cạnh case chứ không nằm trong case.
