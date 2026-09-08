# Bài 8 — Ambiguity Gate: dừng đúng lúc

> **1 giờ 30 phút** · Có gì trong tay: một requirement đã bóc thành bảng `BR-` · Sau bài này: agent không còn đoán khi gặp mơ hồ, và bạn biết công thức viết mọi gate về sau

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Gặp chỗ chưa rõ, agent sẽ tự đoán. Đoán sai thì cả bộ testcase sai theo, mà nhìn vẫn thấy ổn. |
| **Bài này bạn gõ gì** | Soạn bộ câu hỏi kèm sẵn phương án, rồi viết gate chặn không cho sinh case khi chưa chốt. |
| **Xong thì được gì** | Agent hết đoán bừa. Và bạn có cách viết gate dùng lại cho mọi bài sau. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Mơ hồ chặn** (blocking) | Không trả lời được thì **không thể** viết testcase đúng. Phải dừng |
| **Mơ hồ không chặn** | Đoán được, ghi rõ mình đã đoán gì, đi tiếp — sửa sau nếu sai |
| **Giả định đề xuất** | Câu trả lời bạn *nghĩ là đúng*, gửi kèm câu hỏi để BA chỉ cần xác nhận |

## Bài này bạn sẽ làm gì

Bốn việc:

1. Tự thấy agent **đoán** khi gặp mơ hồ — trên một tài liệu có 10 vấn đề cài sẵn (25 phút).
2. Phân mức chặn / không chặn, và viết bộ câu hỏi có giả định đề xuất (20 phút).
3. **Xây gate** chặn không cho sinh testcase khi chưa chốt — và học **công thức viết mọi gate** (30 phút).
4. Chạy lại toàn luồng, thấy gate chặn thật rồi mở ra thật (15 phút).

> Bài này cũng là bài dạy **cách viết một gate**. Từ đây trở đi tài liệu này sẽ nói *"xây gate chặn X"* rất nhiều
> lần; công thức 5 câu hỏi ở Việc 3 dùng cho tất cả.

---

## Việc 1 — Xem agent đoán (25 phút)

Tài liệu này có kèm một đặc tả đặc tả **cố tình mơ hồ**: [`sample-requirement.md`](assets/sample-requirement.md) — một
FSD giả cho màn "Tạo đơn hàng", kèm 3 ghi chú của BA chứa mâu thuẫn và lỗ hổng. Nó có **10 vấn đề cài sẵn**.

Mở phiên agent và gõ **đúng** câu này — câu mà 90% người sẽ gõ:

```
Đọc docs/course/assets/sample-requirement.md rồi sinh testcase cho màn Tạo đơn hàng.
```

**Bạn sẽ thấy** agent trả về một bộ testcase trông rất gọn gàng. Giờ đọc kỹ và tìm ba dấu hiệu:

| Dấu hiệu | Ví dụ cụ thể trong bộ vừa sinh |
|---|---|
| **Số cụ thể xuất hiện từ đâu không rõ** | Case ghi *"Giảm giá = 5%"* trong khi tài liệu có hai chỗ nói hai số khác nhau |
| **Case cho nhánh tài liệu không nói** | Có case cho "khách hạng Kim cương" — tài liệu chưa từng nhắc hạng này |
| **Mâu thuẫn bị làm phẳng** | Tài liệu nói mốc `500.000`, ghi chú BA nói `450.000`. Bộ case chọn **một** số và không nói gì |

**Điều vừa xảy ra:** agent không hỏi bạn câu nào. Nó **đoán**, và đoán một cách hợp lý — nhưng nếu đoán sai
thì **cả bộ testcase sai theo**, và sai theo cách khó thấy nhất: từng case đều "trông đúng".

So với Bài 1: ở đó agent làm cho *một* test xanh sai. Ở đây nó làm cho *cả bộ* sai. Cùng một cơ chế — nó được
giao việc "sinh testcase", và đoán **là** cách hoàn thành việc đó.

### Đếm xem nó bỏ qua mấy vấn đề

Cuối `sample-requirement.md` có bảng **10 vấn đề** giảng viên đã cài. Đối chiếu:

| | Số |
|---|---|
| Vấn đề agent **nêu ra** | ___ |
| Vấn đề agent **im lặng đoán qua** | ___ |

Con số thứ hai là thứ bài này nhắm tới.

## Việc 2 — Phân mức và viết câu hỏi (20 phút)

Không phải mơ hồ nào cũng phải dừng. Dừng hết thì bạn không làm được gì; đoán hết thì bộ case sai. Ranh giới:

> **Chặn** khi không trả lời được thì **kết quả mong đợi không viết được**.
> **Không chặn** khi bạn đoán được và ghi rõ mình đã đoán gì.

| Mơ hồ | Mức | Vì sao |
|---|---|---|
| Mốc miễn phí giao hàng: `500.000` hay `450.000`? | **CHẶN** | Kết quả mong đợi của mọi case tính tiền phụ thuộc số này |
| Giảm giá tính trên tạm tính hay trên tổng? | **CHẶN** | Đổi cả công thức |
| Số lượng tối đa là `99` hay `100`? | **CHẶN** | Case biên đúng/sai lệch hẳn |
| Thông báo lỗi ghi chữ gì chính xác? | không chặn | Đoán được; assert theo mã lỗi, chữ hiển thị kiểm sau khi có Figma |
| Danh sách sắp thứ tự theo gì? | không chặn | Đoán "mới nhất trước", ghi rõ đã đoán |
| Có hạng khách "Kim cương" không? | **CHẶN** | Nếu có thì thiếu hẳn một nhánh; nếu không thì đừng sinh case cho nó |

### Bộ câu hỏi viết thế nào để BA trả lời trong 2 phút

Sai: *"Anh cho em hỏi về phần giảm giá ạ, em thấy hơi mơ hồ."*
Đúng: **đánh số · nêu hai chỗ mâu thuẫn · kèm giả định đề xuất · nói rõ nếu không trả lời thì hậu quả gì.**

`outputs/tasks/<MÃ>/analysis/questions.md`:

```markdown
# Câu hỏi chốt trước khi sinh testcase — <MÃ TASK>

## CHẶN — không trả lời thì không sinh được testcase

### Q1. Mốc miễn phí giao hàng là 500.000 hay 450.000?
- FSD mục 2.3 ghi **500.000**; ghi chú BA ngày 12/08 ghi **450.000**.
- **Giả định đề xuất:** 500.000 (theo FSD, vì ghi chú không nói là thay đổi).
- Nếu sai: **mọi** case tính tiền có kết quả mong đợi sai.

### Q2. Giảm giá theo hạng tính trên Tạm tính hay trên (Tạm tính + Phí giao hàng)?
- FSD chỉ ghi "giảm theo hạng khách", không nói tính trên gì.
- **Giả định đề xuất:** trên Tạm tính.
- Nếu sai: sai công thức, và sai theo hướng khó thấy vì hai cách cho cùng kết quả khi phí = 0.

### Q3. Có hạng khách "Kim cương" không?
- FSD liệt kê Thường/Bạc/Vàng. Ghi chú BA nhắc "khách Kim cương" một lần.
- **Giả định đề xuất:** KHÔNG có (chỉ 3 hạng).
- Nếu sai: thiếu hẳn một nhánh, và không chiều nào của độ phủ chỉ ra được chỗ thiếu.

## KHÔNG CHẶN — em đã đoán, anh/chị xem lại khi rảnh

| # | Chỗ mơ hồ | Em đoán | Ảnh hưởng nếu đoán sai |
|---|---|---|---|
| A1 | Chữ trong thông báo lỗi số lượng | assert theo **mã lỗi**, không theo chữ | phải sửa 3 case khi có Figma |
| A2 | Thứ tự danh sách đơn | mới nhất trước | 1 case |
```

Ba thứ làm bộ câu hỏi này khác:

1. **Trích được nguồn của mâu thuẫn** — "FSD 2.3 vs ghi chú 12/08". BA không phải đi tìm.
2. **Có giả định đề xuất** — BA chỉ cần trả lời *"đúng"* / *"không, là 450.000"*.
3. **Nói hậu quả** — BA biết vì sao phải trả lời câu này trước.

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

Câu 2 là câu quan trọng nhất. Gate phải đo **thứ có thật trên đĩa**, không đo ý định. Câu 5 là câu hay bị bỏ,
và bỏ nó thì bạn không biết gate đang **so** hay đang **luôn chê**.

### Định dạng để máy đọc được

Máy không đọc được văn xuôi. Nên câu hỏi cần một bản máy-đọc song song với bản cho người:

`outputs/tasks/<MÃ>/analysis/questions.json`:

```json
{
  "task": "DEMO-1",
  "ngayHoi": "2026-09-07",
  "cauHoi": [
    { "id": "Q1", "muc": "blocking", "hoi": "Mốc miễn phí giao hàng 500.000 hay 450.000?",
      "nguon": "FSD 2.3 vs ghi chú BA 12/08", "giaDinh": "500.000", "traLoi": "", "aiTraLoi": "" },
    { "id": "Q2", "muc": "blocking", "hoi": "Giảm giá tính trên Tạm tính hay trên tổng?",
      "nguon": "FSD không nói", "giaDinh": "trên Tạm tính", "traLoi": "", "aiTraLoi": "" },
    { "id": "Q3", "muc": "blocking", "hoi": "Có hạng khách Kim cương không?",
      "nguon": "FSD liệt kê 3 hạng; ghi chú BA nhắc hạng thứ 4", "giaDinh": "không có", "traLoi": "", "aiTraLoi": "" },
    { "id": "A1", "muc": "non-blocking", "hoi": "Chữ trong thông báo lỗi số lượng?",
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
 * 5. Đối chứng: xem mục "Thử nó" trong Bài 8.
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

Câu cuối là câu đáng dán lên tường: **đừng điền giả định vào chỗ câu trả lời.** Nó làm gate xanh và biến một
phỏng đoán thành "đã chốt" — đúng loại gian lận mà Bài 1 dạy nhận ra, chỉ ở một chỗ khác.

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
{ "id": "Q1", "muc": "blocking", "hoi": "Mốc miễn phí giao hàng 500.000 hay 450.000?",
  "nguon": "FSD 2.3 vs ghi chú BA 12/08", "giaDinh": "500.000",
  "traLoi": "500.000 — ghi chú 12/08 là bản nháp, bỏ", "aiTraLoi": "BA Hương, 07/09" }
```

Điền cả ba câu CHẶN → **mã `0`**, và nó **vẫn liệt kê** câu không chặn đang dùng giả định. Đó là cố ý: gate
cho qua, nhưng không để bạn quên là mình đã đoán.

**Lần 4 — đối chứng âm quan trọng nhất:** để câu `A1` (không chặn) **trống** và trả lời đủ 3 câu chặn.
Gate phải ra **`0`**. Nếu ra `1` thì gate của bạn đang chặn cả mơ hồ không chặn — tức nó sẽ chặn **mọi** task,
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
khỏi việc sinh** và **cấm nó đi tiếp**. Đây là lý do Bài 7 và Bài 9 là hai bài riêng, không phải một.

## Cây thư mục sau bài này

```
kit-cua-toi/
├── prompt_templates/phase1/
│   ├── 01_phan_tich.md               ·  từ Bài 6
│   └── 01b_khao_sat_mo_ho.md         ← MỚI · CẤM sinh testcase, chỉ liệt kê mơ hồ
├── scripts/qa/
│   ├── kiem-file-cam.js              ·  từ Bài 5
│   └── gate-mo-ho.js             ← MỚI · còn câu CHẶN chưa chốt ⇒ chặn (exit 0/1/2)
└── outputs/tasks/<MÃ>/analysis/
    ├── business-rules.md             ·  từ Bài 7
    ├── questions.md                  ← MỚI · bản cho người — gửi BA
    └── questions.json                ← MỚI · bản cho máy — gate đọc cái này
```

Hai tệp `questions.*` là một cặp có chủ ý: **người** đọc markdown, **máy** đọc JSON. Nhưng chỉ **một** trong
hai là canonical — chọn JSON, và sinh markdown từ nó. Hai bản viết tay song song thì sẽ trôi khỏi nhau, đúng
luật một-nguồn của Bài 6.

## Tự kiểm

1. Ranh giới giữa mơ hồ **chặn** và **không chặn** là gì? Nêu bằng một câu.
2. Ba thứ làm bộ câu hỏi được BA trả lời nhanh — kể ra.
3. Vì sao thiếu tệp `questions.json` là mã `2` chứ không phải mã `0`?
4. Vì sao gate bắt buộc có `giaDinh` và `nguon`, không chỉ `hoi`?
5. Vì sao gate bắt buộc có `aiTraLoi`, không chỉ `traLoi`?
6. Điền giả định vào `traLoi` để gate xanh — sai ở đâu? Nó giống kiểu gian lận nào ở Bài 1?
7. Năm câu hỏi của **công thức viết gate** — kể lại. Câu nào hay bị bỏ nhất?

## Bài tập về nhà (25 phút)

Áp công thức 5 câu hỏi để viết **một gate mới** cho dự án bạn — tự chọn thứ cần chặn. Ví dụ: *"không cho
publish testcase nếu chưa có ai review"*, hoặc *"không cho execute nếu chưa khai môi trường"*.

Viết ra giấy **cả năm câu trả lời trước khi viết code**. Rồi:

1. Viết gate, đúng ba mã thoát.
2. Làm đủ hai đối chứng: một ca **phải chặn**, một ca **phải cho qua**.
3. Chạy nó trên một task **thật** đã xong. Nếu nó báo đỏ trên task đã xong đúng — thì gate của bạn sai, không
   phải task sai. Sửa gate.

Bước 3 là cách rẻ nhất để phát hiện gate bắt oan: chạy nó **ngược** lên dữ liệu đã biết là tốt.

## Đọc thêm

- [Viết gate đầu tiên](viet-gate-dau-tien.md) — bài chi tiết về cơ chế `exit 0/1/2` và ba phép tiêm lỗi để
  chứng minh gate chặn thật.
- [Bộ gate nền](bo-gate-nen.md) — `lib/gate.js` dùng chung, để mọi gate về sau không phải viết lại phần khung.
- Bài 28 — [khi kit chặn sai](mot-nguon-va-may-chong-troi.md): gate bắt oan mất uy tín, và đó là cách một kit
  chết.
