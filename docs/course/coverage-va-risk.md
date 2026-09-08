# Bài 14 — Đừng đếm testcase, hãy đo những gì bạn đã phủ

> **3 giờ** · Có gì trong tay: bộ testcase có oracle, chưa biết đủ hay thiếu · Sau bài này: biết bộ của mình trống hẳn loại câu hỏi nào

**Vấn đề**

Requirement nói mỗi đơn Core được thanh toán tối đa ba lần. Bạn viết mười testcase, mỗi case một
số tiền khác nhau, tất cả đều chia đơn thành hai lần trả.

Mười case, tất cả xanh. Trông rất phủ.

Nhưng không case nào thử **lần thứ tư**. Cũng không case nào thử khi một trong ba giao dịch còn ở
trạng thái chưa xác nhận — mà luật thì chỉ đếm giao dịch đã xác nhận.

Mười case, và bỏ sót đúng chỗ hay hỏng nhất.


**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Bộ 200 case nghe thì nhiều, nhưng có khi cả 200 chỉ hỏi đúng một loại câu hỏi. |
| **Bài này bạn gõ gì** | Khai danh mục các loại câu hỏi cần phủ, rồi viết máy đếm và chặn khi thiếu. |
| **Xong thì được gì** | Biết bộ case của mình đang bỏ trống hẳn loại nào, bằng con số chứ không phải cảm giác. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Bảy việc:

1. Hai trục của độ phủ, và vì sao trục thứ hai vô hình (15 phút).
2. Các chiều phủ, và chiều nào hay trống nhất (25 phút).
3. Gắn tag vào từng case để máy đếm được (25 phút).
4. Khai chiều bắt buộc cho dự án bạn, `n/a` phải kèm lý do (25 phút).
5. Viết máy đếm (35 phút).
6. Đọc kết quả cho đúng, và ba cách đọc sai (15 phút).
7. Band rủi ro: cách đọc, và vì sao độ sâu phải theo band (25 phút).

---

## Việc 1 — Hai trục, và trục thứ hai vô hình

Bộ testcase có hai trục độc lập:

| Trục | Trả lời | Bạn đã có từ | Đếm được không |
|---|---|---|---|
| **Module** | Test **ở đâu** | Bài 13 (cột `Module`) | Có — đếm theo cột |
| **Chiều** | Hỏi loại câu hỏi nào | Chưa có gì | **Không** — chưa có gì để đếm |

Và đây là bẫy trung tâm của cả bài:

> Một bộ case phủ kín **mọi module** mà trống hẳn **một chiều** thì vẫn TRÔNG đầy đủ. Bảng coverage theo
> module xanh hết. Số suất case lớn. Không có tín hiệu nào báo là thiếu.

Con số thật ở kit này, đo trên một bộ **530 case** đã review và đã publish:

| Chiều | Số case |
|---|---|
| E2E (luồng đầu-cuối) | **0** |
| Change impact (ảnh hưởng lan khi sửa) | **0–1** |
| Hiển thị (đúng cột, đúng nhãn, đúng định dạng) | **≈12%** — dù mục đó là **bắt buộc** |

530 case, phủ kín module, mà không có case E2E nào. Không ai phát hiện ra bằng cách đọc, bộ trông rất đầy.

## Việc 2 — Các chiều, và chiều nào hay trống

Danh sách này là gợi ý khởi đầu; dự án bạn có thể thêm bớt. Cột cuối là điều đáng chú ý nhất.

| Mã | Chiều | Hỏi gì | Hay trống? |
|---|---|---|---|
| `Validation` | Kiểm ô nhập | Rỗng, quá dài, ký tự lạ, ngoài biên | Ít trống |
| `Display` | Hiển thị | Đủ cột, đúng nhãn, đúng định dạng, empty state | **Rất hay trống** |
| `Calc` | Công thức | Tính đúng, làm tròn đúng, trần/sàn | Trung bình |
| `API` | Hợp đồng API | Mã trạng thái, cấu trúc dữ liệu trả về | Trung bình |
| `E2E` | Luồng đầu-cuối | Cả chuỗi từ đầu tới cuối, dữ liệu sống sót | **Rất hay trống** |
| `Guard` | Chặn tầng dưới | 403/409 khi làm việc không được phép | **Rất hay trống** |
| `Concurrency` | Đồng thời | Hai người sửa cùng lúc, gửi trùng, hết phiên | Rất hay trống |
| `SideEffect` | Tác dụng phụ | Mail, thông báo, job sinh ra sau hành động | Hay trống |
| `Perm` | Phân quyền | Ma trận vai trò × hành động | Trung bình |
| `Impact` | Ảnh hưởng lan | Sửa chỗ này thì chỗ nào vỡ | **Rất hay trống** |

Ba chiều hay trống nhất có cùng một nguyên nhân: chúng không nằm trong tài liệu.

Tài liệu đặc tả nói *tính năng làm gì*. Nó không nói *cái gì phải bị chặn*, không nói *luồng đầu-cuối trông
thế nào*, không nói *sửa cái này thì ảnh hưởng gì*. Nên agent đọc tài liệu rồi sinh case sẽ **tự nhiên** bỏ
trống đúng ba chiều đó. Không phải vì nó kém, mà vì nguồn nó đọc không có.

### Ví dụ trên tài liệu mẫu

| Chiều | Tài liệu mẫu có nói? | Case cần có |
|---|---|---|
| `Calc` | Có, mục 3 rất rõ | Giảm giá từng hạng, trần, làm tròn xuống |
| `Validation` | Có, mục 5 | Số suất 0, 1, 999, 1000, để trống |
| `Display` | **Có nhưng dễ bỏ** — bảng khối B liệt kê 4 trường | Khối B đủ 4 cột, đúng thứ tự, đúng nhãn; Đơn giá không sửa được |
| `Guard` | **Không nói rõ** | Kế toán gọi thẳng API lưu đơn → phải **403**, không chỉ ẩn nút |
| `E2E` | **Không** | Tạo đơn → lưu nháp → mở màn chi tiết → mọi giá trị còn nguyên |
| `Concurrency` | **Không** | Bấm Lưu nháp hai lần liên tiếp → có tạo hai đơn không |

Bốn chiều cuối là chỗ bug thật hay nằm, và cũng là chỗ tài liệu im lặng.

## Việc 3 — Gắn tag để đếm được

Chiều là thứ vô hình cho tới khi bạn **gắn nhãn**. Quy ước đơn giản nhất: tag ở đầu tiêu đề case.

```markdown
| TC_012 | Tạo đơn hàng | [Calc] Giảm giá chương trình Elite vượt trần 300.000 | … |
| TC_013 | Tạo đơn hàng | [Display] Khối B đủ 4 cột, đúng thứ tự và nhãn | … |
| TC_014 | Tạo đơn hàng | [Guard] Kế toán gọi API lưu đơn → 403 | … |
| TC_015 | Tạo đơn hàng | [E2E] Tạo → lưu nháp → chi tiết, giá trị còn nguyên | … |
```

Một case được phép nhiều tag: `[Calc][Boundary]`.

> Vì sao tag nằm trong tiêu đề, không phải cột riêng. Ba lý do thực dụng: nó đi theo case khi publish lên
> công cụ test-management (không mất) · người đọc thấy ngay khi quét danh sách · và không phải thêm cột bắt
> buộc thứ tám (Bài 13 mục 2 đã nói vì sao nên tiết chế số cột).

**Ràng buộc kèm theo, quan trọng hơn cái tag:**

> Gắn tag chiều nào thì `Kết quả mong đợi` phải mang bằng chứng của chiều đó.
>
> `[Display]` mà expected chỉ ghi "hiển thị đủ thông tin" → tag nói dối. Phải liệt kê **đúng 4 tên cột theo
> đúng thứ tự. `[Guard]` mà expected ghi "không cho phép" → phải ghi 403** và **thông điệp cụ thể**.

Không có ràng buộc này thì tag chỉ là nhãn dán, và số đếm ở mục 5 thành vô nghĩa.

## Việc 4 — Khai chiều bắt buộc, kèm lý do

Không phải task nào cũng cần đủ mọi chiều. Task sửa một nhãn chữ thì `Concurrency` là vô nghĩa.

Nên mỗi task **khai** chiều nào bắt buộc. Và ghi lý do khi khai một chiều là không áp dụng.

`outputs/demo/tasks/PROJ-1234/requirements/chieu-phu.json`:

```json
{
  "_note": "Chiều nào BẮT BUỘC cho task này. Khai 'n/a' thì PHẢI có lý do — khai n/a không lý do là chỗ giấu nợ.",
  "task": "PROJ-1234",
  "dimensions": {
    "Validation": "required",
    "Display": "required",
    "Calc": "required",
    "Perm": "required",
    "Guard": "required",
    "E2E": "required",
    "API": { "status": "n/a", "reason": "màn này chưa có API công khai để test riêng; đã phủ qua E2E" },
    "Concurrency": { "status": "n/a", "reason": "đơn nháp là dữ liệu cá nhân, không có ca hai người sửa cùng lúc" },
    "SideEffect": { "status": "n/a", "reason": "lưu nháp không sinh mail hay job nào theo mục 4" },
    "Impact": "required"
  }
}
```

Hai điều làm file này có giá trị:

1. `n/a` bắt buộc có lý do. Không lý do thì nó chỉ là cách làm bảng xanh. Có lý do thì người review đọc
   được và phản đối được nếu lý do sai.
2. Quyết định được ghi lại. Sáu tuần sau có bug ở chiều bạn khai `n/a`, bạn đọc lại lý do và biết mình
   đã nghĩ gì, thay vì tự hỏi *"sao lúc đó không làm?"*

> Cảnh báo: nếu bạn khai `n/a` cho một chiều mà artifact của task cho thấy chiều đó có tồn tại (ví dụ khai
> `API: n/a` trong khi task có file đặc tả API), thì đó là khai sai. Bài 14 khi bạn viết gate cho chiều, hãy
> chặn đúng trường hợp đó.

## Việc 5 — Đếm

Giờ mới đếm được. Script đơn giản, đủ dùng:

`scripts/qa/dem_chieu.js`:

```js
#!/usr/bin/env node
/*
 * dem_chieu.js — đếm case theo CHIỀU (tag trong tiêu đề), đối chiếu với chieu-phu.
 *
 * VÌ SAO CẦN: trục "module" đếm được từ đầu, trục "chiều" thì vô hình cho tới khi có tag và có máy đếm.
 * Bộ phủ kín module mà trống một chiều thì vẫn TRÔNG đầy đủ — đo thật trên một bộ 530 case: chiều E2E
 * có 0 case, và không ai phát hiện bằng cách đọc.
 *
 * Mã thoát: 0 = đủ chiều bắt buộc · 1 = thiếu · 2 = không đo được.
 */
'use strict';
const fs = require('fs');
const { docMarkdown } = require('../lib/testcase');

const [tcFile, manifestFile] = process.argv.slice(2);
if (!tcFile || !manifestFile) {
  console.error('Dùng: node scripts/qa/dem_chieu.js <testcase.md> <chieu-phu.json>');
  process.exit(2);
}

let cases, manifest;
try { cases = docMarkdown(fs.readFileSync(tcFile, 'utf8')); }
catch (e) { console.error('Không đọc được testcase: ' + e.message); process.exit(2); }
try { manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); }
catch (e) { console.error('Không đọc được manifest: ' + e.message); process.exit(2); }
if (!cases.length) { console.error('0 case — không có gì để đếm.'); process.exit(2); }

// Đếm theo tag [Xxx] trong tiêu đề. Một case có nhiều tag thì tính cho mọi tag.
const dem = {};
let khongTag = 0;
for (const c of cases) {
  const tags = [...c.title.matchAll(/\[([A-Za-z0-9_]+)\]/g)].map((m) => m[1]);
  if (!tags.length) { khongTag++; continue; }
  for (const t of tags) dem[t] = (dem[t] || 0) + 1;
}

const dims = manifest.dimensions || {};
const batBuoc = Object.entries(dims).filter(([, v]) => v === 'required').map(([k]) => k);
const khaiNA = Object.entries(dims).filter(([, v]) => v && v.status === 'n/a');

console.log(`Đọc ${cases.length} case · ${khongTag} case CHƯA gắn tag chiều\n`);
console.log('Chiều           Khai        Số case');
console.log('─'.repeat(42));
for (const [ten, khai] of Object.entries(dims)) {
  const nhan = khai === 'required' ? 'bắt buộc' : 'n/a';
  console.log(`${ten.padEnd(15)} ${nhan.padEnd(11)} ${dem[ten] || 0}`);
}
const laDu = Object.keys(dem).filter((t) => !dims[t]);
if (laDu.length) console.log('\nTag có trong case mà manifest KHÔNG khai: ' + laDu.join(' · '));

const thieuLyDo = khaiNA.filter(([, v]) => !String(v.reason || '').trim()).map(([k]) => k);
const trong = batBuoc.filter((d) => !dem[d]);

const viPham = [];
if (trong.length) {
  viPham.push(`${trong.length} chiều khai BẮT BUỘC mà có 0 case: ${trong.join(' · ')}`);
}
if (thieuLyDo.length) {
  viPham.push(`${thieuLyDo.length} chiều khai n/a mà KHÔNG có lý do: ${thieuLyDo.join(' · ')}`);
}
if (khongTag > cases.length * 0.5) {
  viPham.push(`${khongTag}/${cases.length} case chưa gắn tag — số đếm chưa đáng tin, gắn tag trước đã`);
}

if (viPham.length) {
  console.error('\n✗ ' + viPham.length + ' vấn đề:');
  for (const v of viPham) console.error('  - ' + v);
  process.exit(1);
}
console.log('\n✓ Mọi chiều bắt buộc đều có case, và mọi n/a đều có lý do.');
process.exit(0);
```

Thêm vào `package.json`:

```json
"dim:coverage": "node scripts/qa/dem_chieu.js"
```

Để ý phép kiểm cuối: nếu **quá nửa** case chưa gắn tag thì script từ chối kết luận. Đếm trên dữ liệu chưa
gắn nhãn thì con số vô nghĩa, và một con số vô nghĩa còn tệ hơn không có con số, nó làm bạn yên tâm sai chỗ.

## Việc 6 — Đọc kết quả cho đúng

Sau khi chạy, ba câu hỏi theo thứ tự:

1. Chiều nào 0 case? Đó là loại câu hỏi bộ của bạn chưa bao giờ hỏi. Nguy hiểm nhất trong ba câu.
2. Chiều nào 1–2 case trong khi module nhiều? Có tag cho đủ lệ, chưa phủ thật.
3. Tag nào có trong case mà manifest không khai? Hoặc bạn quên khai, hoặc agent tự nghĩ ra tag mới.

Với chiều 0 case, đừng lấp bằng cách gắn tag vào case cũ. Viết case mới, vì chiều đó trống nghĩa là bạn
chưa hỏi loại câu hỏi đó, không phải chưa dán nhãn.

---

## Việc 7 — Band rủi ro: chiều thứ hai của độ sâu (25 phút)

Sáu việc trên trả lời câu *"bộ case có phủ đủ các chiều chưa"*. Còn một câu nữa, và nó độc lập với
câu trên:

> Chiều nào cũng có case rồi. Nhưng module nào đáng được test **sâu hơn** module nào?

Phủ đều mọi module nghe công bằng, mà thực tế là phân bổ sai: phần rủi ro cao bị test hời hợt, phần
rủi ro thấp bị test thừa.

### Ba band, và ba mức độ sâu khác nhau

| Band | Dấu hiệu của module | Độ sâu tối thiểu |
|---|---|---|
| **High** | Chạm tiền, chạm dữ liệu khách, hoặc vừa sửa xong | Luồng thuận + biên + nhánh lỗi + trạng thái kế cận |
| **Medium** | Nghiệp vụ bình thường, ít đổi | Luồng thuận + biên |
| **Low** | Màn hiển thị, không có logic tính toán | Luồng thuận |

Ba dấu hiệu ở cột giữa không phải cảm nhận, chúng đo được:

| Dấu hiệu | Đo bằng gì |
|---|---|
| Chạm tiền hoặc dữ liệu khách | Đọc requirement, có mã `BR-` nào nói về tiền hay thông tin cá nhân không |
| Vừa sửa xong | `git log` trên thư mục source của module, 30 ngày gần nhất |
| Từng có bug | Số bug đã log cho module đó |

Dòng cuối là dòng mạnh nhất, và cũng là dòng bạn **chưa có** lúc này: nó cần lịch sử bug của vài
sprint. Bài 27 dựng máy chấm điểm đọc từ lịch sử đó, và ép độ sâu theo band.

Bài này chỉ cần bạn làm một việc rẻ: mở bảng module của dự án, gán tay mỗi module một band, và ghi
**lý do** bên cạnh.

```
outputs/tasks/<MÃ>/analysis/band.md

| Module      | Band   | Vì sao                                        |
|-------------|--------|-----------------------------------------------|
| Thanh toán  | High   | BR-12..BR-19 đều về tiền; sửa 3 lần tháng này |
| Đơn hàng    | Medium | nghiệp vụ ổn định, không chạm tiền            |
| Trang chủ   | Low    | chỉ hiển thị, không tính toán                 |
```

Cột "Vì sao" là cột quan trọng nhất. Không có nó thì band trở thành ý kiến, và ý kiến thì không tranh
luận được. Có nó thì người không đồng ý sẽ chỉ vào đúng dòng lý do mà nói *"chỗ này tôi thấy khác"*,
và đó là một cuộc trao đổi có ích.

> Đừng gán tất cả thành High. Nghe an toàn nhưng nó xoá luôn tác dụng của việc phân band: nếu mọi
> thứ đều quan trọng nhất thì không có gì được ưu tiên.

---

## Thực hành (55 phút)

### Bước 1 — Khai manifest (10 phút)

Viết `chieu-phu.json` cho task của bạn. Với mỗi `n/a`, viết lý do **cụ thể** — không viết "không cần".

Tự kiểm: đưa lý do cho người khác đọc, họ phản đối được không? Nếu lý do mơ hồ tới mức không ai phản đối
được thì nó chưa phải lý do.

### Bước 2 — Gắn tag cho bộ hiện có (15 phút)

Gắn tag chiều vào tiêu đề mọi case trong bộ Bài 12–7. Đừng gắn cho đủ, gắn đúng cái case **thật sự** đang hỏi.

Case nào bạn không biết gắn tag gì thường là case không rõ mục đích. Dấu hiệu cần viết lại.

### Bước 3 — Đếm (10 phút)

```bash
node scripts/qa/dem_chieu.js \
  outputs/demo/tasks/PROJ-1234/test-cases/agent-sinh.md \
  outputs/demo/tasks/PROJ-1234/requirements/chieu-phu.json
```

Điền bảng:

| Chiều | Khai | Số case | Nhận xét |
|---|---|---|---|

### Bước 4 — Viết case cho chiều trống (15 phút)

Chọn **hai** chiều đang 0 case và viết case thật. Gợi ý cho tài liệu mẫu, đây là hai chiều gần như luôn trống:

**`[Guard]`** — Kế toán chỉ được xem (mục 6). Nhưng ẩn nút **không phải** chặn:

| Trường | Nội dung |
|---|---|
| Tiêu đề | `[Guard][Perm]` Kế toán gọi API lưu đơn nháp → bị chặn ở tầng dưới |
| Tiền điều kiện | Đăng nhập `user_ketoan_01` (vai trò Kế toán); có sẵn payload đơn hợp lệ |
| Các bước | 1. Lấy token của `user_ketoan_01`<br>2. Gọi thẳng API lưu đơn nháp với payload hợp lệ |
| Kết quả mong đợi | 1. Mã trạng thái = **403**<br>2. Đơn không được tạo (kiểm lại danh sách đơn: số suất không đổi) — `BR-06` |

**`[E2E]`** — luồng đầu-cuối, và giá trị phải sống sót qua chuyển màn:

| Trường | Nội dung |
|---|---|
| Tiêu đề | `[E2E]` Tạo đơn → lưu nháp → màn chi tiết: mọi giá trị còn nguyên |
| Tiền điều kiện | Khách `KH_BAC_01` chương trình Pro; `SP_A` giá 100.000 |
| Các bước | 1. Tạo đơn với `SP_A` số suất 3<br>2. Bấm Lưu nháp<br>3. Ở màn chi tiết, đọc lại 4 giá trị của khối C |
| Kết quả mong đợi | 1. Hiện đúng chữ `Đã lưu đơn nháp`<br>2. URL khớp `/orders/{id}`<br>3. Tạm tính 300.000 · Giảm giá 9.000 · Phí 30.000 · **Tổng cộng 321.000** — giống hệt trước khi lưu — `BR-01` `BR-02` `BR-03` |

Chạy lại `dim:coverage`, xác nhận hai chiều đó không còn 0.

### Bước 5 — Commit

```bash
git add scripts/qa/dem_chieu.js package.json outputs/demo/tasks/PROJ-1234
git commit -m "feat(coverage): trục CHIỀU — tag trong tiêu đề + manifest có lý do + máy đếm

Trước: <N> chiều bắt buộc có 0 case. Sau: bổ sung case cho Guard và E2E."
```

---

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Chiều phủ** | Loại câu hỏi mà một case đang hỏi. Ví dụ: giá trị biên, phân quyền, đồng thời |
| **Ngưỡng theo chiều** | Mỗi chiều bắt buộc phải có ít nhất bao nhiêu case |
| **`n/a` có lý do** | Chiều không áp dụng cho màn này, nhưng phải ghi vì sao |

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   └── chieu-phu.json   ← MỚI · chiều nào áp, `n/a` PHẢI kèm lý do
└── scripts/qa/
    ├── dem_chieu.js              ← MỚI · chiều bắt buộc chưa đủ ngưỡng ⇒ chặn
    └── tu-soi.js            ← MỚI · gọi mọi máy chặn một lượt
```

## Bộ kit của bạn đang ở đâu

```
CẤP ĐỘ 3 · CONTROL      bài 3/9 của cấp độ này
█████████░░░░░░░░░░░░░░░░░░░

cả tài liệu           bài 14/29
██████████████░░░░░░░░░░░░░░
```

**Hết cấp độ 3 bạn nói được:** Tôi có một QA workflow được enforce trong team.

Cấp độ này còn 6 bài nữa.

## Tự kiểm

- [ ] Tôi giải thích được hai trục, và vì sao trục chiều vô hình cho tới khi có tag.
- [ ] Tôi nói được vì sao ba chiều `Guard` `E2E` `Impact` hay trống, và nguyên nhân chung của cả ba.
- [ ] Mọi case trong bộ của tôi đã có tag chiều.
- [ ] Case gắn `[Display]` có expected liệt kê tên cột, không phải "hiển thị đủ".
- [ ] `chieu-phu.json` của tôi có lý do cho mọi `n/a`, và lý do đó phản đối được.
- [ ] Máy đếm từ chối kết luận khi quá nửa case chưa gắn tag.
- [ ] Tôi đã viết case mới cho hai chiều trống, không lấp bằng cách dán tag vào case cũ.
- [ ] Case `[Guard]` của tôi kiểm 403 ở tầng dưới, không chỉ kiểm nút bị ẩn.

## Bài tập về nhà

Lấy bộ testcase **thật** lớn nhất ở dự án bạn. Gắn tag chiều cho một mẫu 50 case (không cần cả bộ), rồi đếm.

Rất có thể bạn tìm ra ít nhất một chiều có **0 case** trong một bộ mà cả team đã review và đã chạy nhiều lần.
Đó không phải lỗi của ai. Đó là điểm mù có hệ thống: tài liệu không nói thì không ai nghĩ ra.

Ghi con số lại. Ở Bài 25 bạn sẽ có một cách khác để tìm điểm mù: không hỏi *"tôi thiếu loại câu hỏi nào"* mà
hỏi *"bộ kiểm của tôi có bắt được lỗi không"* — và đo được bằng số.

## Đọc thêm

- [`scripts/qa/dimension_coverage.js`](../../scripts/qa/dimension_coverage.js) của kit này, bản đầy đủ,
  **20** chiều và có cả phần chặn khi khai `n/a` trái với artifact thật.
- Phần 3 (Bài 9–12) chuyển sang chạy thật: locator bền, dựng dữ liệu, verdict, bằng chứng.

## Bài sau

Bài 15 chuyển việc sinh testcase cho agent, rồi xem chuyện gì xảy ra khi nó gặp một chỗ tài liệu
viết mơ hồ. Gợi ý: nó không hỏi bạn.
