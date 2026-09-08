# Bài chi tiết — Viết gate đầu tiên

> **2 giờ 30 phút** · Có gì trong tay: một vòng làm việc hoàn chỉnh — case, chạy, verdict, evidence. Giờ mới có thứ để canh · Sau bài này: một gate chạy được, đã chứng minh có răng
>
> *Bài này không đánh số — nó là phần đào sâu của **Bài 8**. Đọc kèm **Bài 8**.*

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Bạn có luật rồi, nhưng luật chỉ nằm trong tài liệu thì nó vẫn chỉ là lời dặn. |
| **Bài này bạn gõ gì** | Viết một gate hoàn chỉnh, rồi cố tình tạo 3 lỗi để xem nó có chặn thật không. |
| **Xong thì được gì** | Hiểu ba mã thoát 0, 1, 2. Và biết gate chưa thử thì chưa tin được. |

## Mục tiêu

✅ Hiểu vì sao đến bài này mới viết gate.
✅ Viết một gate đọc artifact thật và thoát mã 1 khi phát hiện vi phạm.
✅ Chạy nó trên nội dung thật, soi từng cảnh báo: thật hay oan.
✅ Cảnh báo oan thì sửa LUẬT, không sửa dữ liệu.
✅ Negative control: tiêm lỗi để chứng minh gate bắt được.
✅ Chọn mức: cảnh báo trước, chặn sau.
✅ Hiểu vì sao báo oan tệ hơn không có gate.

---

## 1. Vì sao là Bài 8, không phải Bài 6

Gate là một đoạn mã **đọc artifact rồi phán**. Nên nó cần ba thứ, và cả ba chỉ có sau Phần 3:

| Cần | Có từ bài |
|---|---|
| Artifact thật để đọc (file kết quả, file evidence) | 11–12 |
| Một chuẩn để so vào (trạng thái nào là hợp lệ) | 11 |
| Đủ trải nghiệm để biết chỗ nào hay sai | 9–12 |

Viết gate ở Bài 6 thì bạn đang đoán chỗ nào sẽ sai. Viết ở Bài 8 thì bạn **đã thấy** nó sai.

Mở lại file bạn viết ở **Thực hành Bài 1** — danh sách "nếu agent muốn báo cáo đẹp mà không làm thật, nó sẽ
làm thế nào" cùng những câu dạng *"đọc X, nếu Y thì chặn"*. Hôm nay bạn biến một câu trong đó thành mã.

## 2. Gate là gì, chính xác

Ba thứ, không hơn:

1. **Đọc** một hoặc vài file artifact.
2. **So** với một chuẩn.
3. **Thoát với mã** báo cho thứ gọi nó biết kết quả.

Mã thoát là phần dễ bị làm sai nhất. Ba mã, ba nghĩa **khác nhau**:

| Mã | Nghĩa | Người gọi nên làm gì |
|---|---|---|
| `0` | Đo được, và **khớp** | Đi tiếp |
| `1` | Đo được, và **có vi phạm** | Dừng, sửa vi phạm |
| `2` | **KHÔNG đo được** (thiếu file, thiếu quyền, file hỏng) | Dừng, sửa hạ tầng — **đừng đọc báo cáo của lượt này** |

> **Vì sao phải tách mã 2.** Gộp "không đo được" vào mã 1 là sai lầm tốn kém nhất khi viết gate. Một lần
> thật ở kit này: công cụ kiểm giao diện thiếu credentials nên đứng ở màn đăng nhập, đọc ra **0 cột ở mọi
> màn**, rồi báo cáo *"thiếu toàn bộ cột"*. Báo cáo đó trông **y hệt như ứng dụng hỏng nặng**. Người đọc mất
> nửa ngày điều tra một thứ không xảy ra.
>
> Nguyên tắc: *"không biết"* và *"biết là xấu"* là hai câu trả lời khác nhau. Đừng làm tròn cái trước thành cái sau.

## 3. Chọn gate đầu tiên: evidence

Gate đầu tiên nên thoả bốn điều: đọc artifact bạn **đã có** · bắt một lỗi **thật** · viết xong trong một
buổi · và **tiêm lỗi vào được** để nghiệm thu.

Luật cần canh nằm ở `CLAUDE.md` mục 4 bạn viết từ Bài 2:

> Mọi case đã chạy (kể cả PASS) phải có ảnh hoặc video đúng màn.

Nó lý tưởng để làm gate đầu tiên vì **phán được bằng máy tuyệt đối**: hoặc có file, hoặc không.

### Đầu vào: file trạng thái

Bài 13 bạn đã có file kết quả. Nếu chưa đúng dạng này thì tạo một file mẫu để làm việc:

`outputs/demo/tasks/PROJ-1234/test-results/testcase-status.json`

```json
[
  { "id": "TC_001", "status": "PASS", "evidence": ["outputs/demo/tasks/PROJ-1234/evidence/tc001.png"] },
  { "id": "TC_002", "status": "FAIL", "failureLayer": "product_bug",
    "evidence": ["outputs/demo/tasks/PROJ-1234/evidence/tc002.png"] },
  { "id": "TC_003", "status": "SKIP", "reason": "chưa có hook dựng dữ liệu" }
]
```

Chú ý `TC_003`: trạng thái `SKIP` là **chưa chạy**, nên **không** đòi evidence. Gate phải biết phân biệt —
đây chính là chỗ dễ báo oan đầu tiên.

## 4. Viết gate

`scripts/qa/gate-bang-chung.js`:

```js
#!/usr/bin/env node
/*
 * gate-bang-chung.js — CHẶN: case đã chạy mà không có bằng chứng kiểm chứng được.
 *
 * VÌ SAO CÓ FILE NÀY: luật "mọi case đã chạy phải có ảnh/video" nằm ở CLAUDE.md mục 4. Nhưng luật viết
 * thành văn thì không ai bị chặn khi vi phạm, và sáu tuần sau không ai biết tỉ lệ thật là bao nhiêu.
 *
 * Mã thoát: 0 = khớp · 1 = có vi phạm · 2 = KHÔNG đo được (đừng đọc báo cáo của lượt exit 2).
 */
'use strict';
const fs = require('fs');
const path = require('path');

// Đuôi file được CHẤP NHẬN làm bằng chứng. Log, JSON, trace KHÔNG có trong danh sách này — có chủ ý.
const ANH = ['.png', '.jpg', '.jpeg', '.webp'];
const VIDEO = ['.mp4', '.webm'];

// Trạng thái nghĩa là ĐÃ CHẠY ⇒ mới đòi bằng chứng. Lấy đúng từ file taxonomy ở Bài 13.
const DA_CHAY = ['PASS', 'FAIL'];

function khongDoDuoc(msg) {
  console.error('[evidence-gate] KHÔNG ĐO ĐƯỢC: ' + msg);
  console.error('  → sửa hạ tầng rồi chạy lại. ĐỪNG đọc kết quả của lượt này.');
  process.exit(2);
}

function main() {
  const statusPath = process.argv[2];
  if (!statusPath) khongDoDuoc('thiếu tham số. Dùng: node scripts/qa/gate-bang-chung.js <status.json>');
  if (!fs.existsSync(statusPath)) khongDoDuoc('không thấy file trạng thái: ' + statusPath);

  let cases;
  try { cases = JSON.parse(fs.readFileSync(statusPath, 'utf8')); }
  catch (e) { khongDoDuoc('file trạng thái không parse được — ' + e.message); }
  if (!Array.isArray(cases)) khongDoDuoc('file trạng thái phải là MẢNG các case');
  if (!cases.length) khongDoDuoc('file trạng thái rỗng — 0 case thì không có gì để kiểm');

  const viPham = [];
  let soDaChay = 0;

  for (const c of cases) {
    if (!c || !c.id) { viPham.push('có phần tử không có "id" — không truy được là case nào'); continue; }
    if (!DA_CHAY.includes(c.status)) continue;   // chưa chạy thì không đòi bằng chứng
    soDaChay++;

    const ev = Array.isArray(c.evidence) ? c.evidence : (c.evidence ? [c.evidence] : []);
    if (!ev.length) {
      viPham.push(`${c.id}: status=${c.status} (đã chạy) nhưng KHÔNG có evidence`);
      continue;
    }
    for (const f of ev) {
      const ext = path.extname(String(f)).toLowerCase();
      if (!ANH.includes(ext) && !VIDEO.includes(ext)) {
        viPham.push(`${c.id}: "${f}" không phải ảnh/video — chỉ nhận ${[...ANH, ...VIDEO].join(' ')}`);
        continue;
      }
      if (!fs.existsSync(f)) {
        viPham.push(`${c.id}: đường dẫn evidence trỏ tới file KHÔNG tồn tại — ${f}`);
        continue;
      }
      // File 0 byte là bẫy thật: chụp lỗi thì Playwright vẫn tạo file, chỉ là rỗng.
      if (fs.statSync(f).size < 1024) {
        viPham.push(`${c.id}: "${f}" chỉ ${fs.statSync(f).size} byte — gần như chắc chắn là ảnh trắng`);
      }
    }
  }

  console.log(`[evidence-gate] đã kiểm ${cases.length} case, trong đó ${soDaChay} case đã chạy.`);
  if (viPham.length) {
    console.error(`\n[evidence-gate] ✗ ${viPham.length} vi phạm:`);
    for (const v of viPham) console.error('  - ' + v);
    console.error('\nLuật: mọi case ĐÃ CHẠY (kể cả PASS) phải có ảnh hoặc video — CLAUDE.md mục 4.');
    process.exit(1);
  }
  console.log('[evidence-gate] ✓ ĐẠT — mọi case đã chạy đều có bằng chứng tồn tại thật.');
  process.exit(0);
}

main();
```

Thêm vào `package.json`:

```json
"scripts": {
  "gate:evidence": "node scripts/qa/gate-bang-chung.js"
}
```

Ba chi tiết trong đoạn mã trên **không phải trang trí**, và mỗi cái đến từ một lần vấp thật:

| Dòng | Vì sao có |
|---|---|
| `if (!cases.length) khongDoDuoc(...)` | File rỗng thì gate sẽ báo ✓ — **xanh giả**. Cùng lớp lỗi với "suite 0 test vẫn PASSED" ở Bài 11 |
| `if (!DA_CHAY.includes(c.status)) continue` | Đòi bằng chứng cho case chưa chạy là **báo oan**, và đó là cách nhanh nhất làm người ta tắt gate |
| `if (fs.statSync(f).size < 1024)` | Chụp lỗi thì file vẫn được tạo, chỉ là **ảnh trắng**. Có đường dẫn không chứng minh có bằng chứng |

## 5. Chạy trên nội dung thật, rồi soi từng cảnh báo

Đây là bước mà đa số người bỏ, và bỏ nó thì gate không đáng tin.

```bash
npm run gate:evidence -- outputs/demo/tasks/PROJ-1234/test-results/testcase-status.json
```

Với **mỗi** dòng vi phạm, tự trả lời: **thật hay oan?**

| Nếu | Thì |
|---|---|
| Thật | Sửa dữ liệu — bổ sung bằng chứng thiếu |
| **Oan** | Sửa **LUẬT** trong gate, **không** sửa dữ liệu cho vừa luật |

> Từ kinh nghiệm của kit này: khi dựng một danh mục gate mới, **bốn "phát hiện" đầu tiên đều là lỗi của
> BẢNG, không của kit**. Con số đầu tiên một máy mới đưa ra rất hay sai — và nó sai theo hướng làm bạn tin.

Ba kiểu báo oan bạn sẽ gặp ngay:

1. **Trạng thái ngoài danh sách.** Bài 13 có thêm `PASS_WITH_DEVIATION` chẳng hạn — nó *đã chạy* nên phải
   đòi bằng chứng, nhưng `DA_CHAY` của bạn chưa có nó ⇒ gate **bỏ sót**, không phải báo oan. Cũng nguy hiểm.
2. **Đường dẫn tương đối.** Gate chạy ở gốc repo, đường dẫn trong file lại tính từ thư mục task ⇒ báo "không
   tồn tại" oan hàng loạt. Chốt **một** quy ước rồi ghi vào luật.
3. **Ngưỡng 1024 byte.** Ảnh chụp một vùng nhỏ có thể dưới 1KB thật. Đo vài ảnh thật của bạn rồi mới chốt số.

## 6. Negative control: chứng minh gate có răng

**Gate chưa từng đỏ là gate chưa được nghiệm thu.** Nó có thể đang xanh vì không kiểm gì cả.

Ba mũi tiêm, mỗi mũi nhắm một nhánh mã khác nhau:

```bash
cp .../testcase-status.json /tmp/goc.json

# ① case đã chạy mà không có evidence → mong đợi exit 1
node -e "const f=process.argv[1],fs=require('fs');const a=JSON.parse(fs.readFileSync(f));
delete a[0].evidence;fs.writeFileSync(f,JSON.stringify(a,null,2))" .../testcase-status.json
npm run gate:evidence -- .../testcase-status.json; echo "exit=$?"     # → 1

# ② evidence là file .log → mong đợi exit 1
cp /tmp/goc.json .../testcase-status.json
node -e "const f=process.argv[1],fs=require('fs');const a=JSON.parse(fs.readFileSync(f));
a[0].evidence=['outputs/demo/log.txt'];fs.writeFileSync(f,JSON.stringify(a,null,2))" .../testcase-status.json
npm run gate:evidence -- .../testcase-status.json; echo "exit=$?"     # → 1

# ③ file trạng thái không tồn tại → mong đợi exit 2, KHÔNG phải 1
cp /tmp/goc.json .../testcase-status.json
npm run gate:evidence -- khong-co-file.json; echo "exit=$?"           # → 2
```

Mũi ③ là mũi quan trọng nhất: nếu nó ra `1` thay vì `2` thì gate của bạn đang **gộp "không đo được" với
"có vi phạm"** — sửa ngay.

## 7. Chọn mức: cảnh báo trước, chặn sau

Gate mới **không** nên chặn ngay. Lý do là con số, không phải sự thận trọng:

> Đo trên 9 task thật khi định siết một luật khác: chấm theo "có artifact hay không" làm **đỏ 7/9 task**, mà
> task xanh duy nhất cũng chỉ có 2 trong 5 mục thật sự chứng minh được gì. Ép kiểu đó chỉ đẻ ra artifact rỗng
> cho qua chuyện.

Đường đi an toàn, ba bước:

1. **Cảnh báo** — in vi phạm, luôn `exit 0`. Chạy vài tuần, xem tỉ lệ oan.
2. **Chặn có cờ mở** — `exit 1`, nhưng cho phép `--qa-approved` kèm **lý do ghi vào báo cáo**.
3. **Chặn hẳn** — khi tỉ lệ oan đã về gần 0.

Thêm cờ vào gate:

```js
const CHI_CANH_BAO = process.argv.includes('--warn-only');
// ... ở cuối:
if (viPham.length) {
  // ...in ra...
  process.exit(CHI_CANH_BAO ? 0 : 1);
}
```

## 8. Vì sao báo oan tệ hơn không có gate

Không có gate: mọi người biết là không có gì canh, nên tự cẩn thận.

Gate báo oan: đỏ vài lần không do lỗi thật → người ta học được rằng **đỏ không có nghĩa gì** → khi có lỗi
thật, họ cũng bỏ qua. Bạn vừa mất cả cơ chế canh **và** sự cẩn thận tự nhiên.

Có một biến thể tệ hơn, gặp thật ở kit này: một job CI đọc credentials từ file không có trên CI nên **không
thể xanh**. Vì là job thủ công, hệ thống tự đánh dấu "được phép thất bại" ⇒ pipeline hiện vàng và lỗi im
lặng mãi. Cách chữa **không** phải biến đỏ thành vàng, mà là để job chỉ **tồn tại** khi có credentials.

> Một nút luôn-đỏ là cách nhanh nhất dạy người ta bỏ qua CI.

---

## Thực hành (70 phút)

### Bước 1 — Chuẩn bị artifact (10 phút)

Dùng kết quả thật từ Bài 13–12. Không có thì tạo file mẫu ở mục 3, cùng 2 file ảnh thật (chụp bất cứ màn nào).

### Bước 2 — Viết gate (25 phút)

Gõ lại đoạn mã ở mục 4. **Gõ, đừng copy** — bạn cần hiểu từng dòng để sửa được ở Bước 4.

### Bước 3 — Chạy trên nội dung thật (10 phút)

Chạy, rồi lập bảng cho mọi dòng vi phạm:

| # | Vi phạm gate báo | Thật hay oan | Tôi sửa gì |
|---|---|---|---|

### Bước 4 — Sửa luật cho phần báo oan (10 phút)

Với mỗi dòng "oan", sửa **gate**. Ghi lại vì sao vào comment ngay tại dòng đó — sáu tuần sau bạn sẽ cảm ơn.

### Bước 5 — Negative control (15 phút)

Chạy đủ ba mũi tiêm ở mục 6. Điền bảng:

| Mũi tiêm | Mã mong đợi | Mã thật | Đạt? |
|---|---|---|---|
| ① thiếu evidence | 1 | | |
| ② evidence sai đuôi | 1 | | |
| ③ file trạng thái không có | 2 | | |

**Cả ba phải đạt.** Chưa đạt thì gate chưa xong — đừng đi tiếp.

### Bước 6 — Commit

```bash
git add scripts/qa/gate-bang-chung.js package.json
git commit -m "feat(gate): gate-bang-chung — chặn case đã chạy mà không có bằng chứng

Nghiệm thu bằng negative control: 3/3 mũi tiêm bắt đúng, phân biệt exit 1 với exit 2."
```

---

## Cây thư mục sau bài này

```
kit-cua-toi/scripts/qa/
├── kiem-so-mong-doi.js           ·  từ Bài 1 · bản thô, chỉ biết một case
└── gate-bang-chung.js              ← MỚI · máy chặn ĐẦY ĐỦ đầu tiên, exit 0/1/2
```

## Tự kiểm

- [ ] Tôi giải thích được vì sao gate không thể viết ở Bài 6.
- [ ] Gate của tôi phân biệt **exit 1** (có vi phạm) với **exit 2** (không đo được).
- [ ] Gate không đòi bằng chứng cho case chưa chạy.
- [ ] Gate chặn cả trường hợp file trạng thái **rỗng**.
- [ ] Tôi đã chạy trên nội dung thật và lập bảng thật/oan cho từng dòng.
- [ ] Với dòng oan, tôi sửa **gate** chứ không sửa dữ liệu.
- [ ] **3/3 mũi tiêm** cho đúng mã mong đợi.
- [ ] Tôi nói được vì sao gate báo oan tệ hơn không có gate.

## Bài tập về nhà

Mở lại danh sách "phép kiểm đề xuất" từ **Thực hành Bài 1**. Chọn **một** câu nữa và viết thành gate thứ hai
— tự làm, không cần khuôn. Gợi ý những cái vừa sức và bắt lỗi thật:

- Mọi case `FAIL` phải có `failureLayer`, và giá trị đó phải thuộc danh sách ở file taxonomy Bài 13.
- Case `SKIP` phải có `reason` không rỗng.
- Mọi `id` trong file trạng thái phải tồn tại trong bộ testcase canonical (bắt case "mọc thêm từ đâu").

Với gate mới, **vẫn phải làm negative control**. Không có ngoại lệ cho quy tắc này.

## Đọc thêm

- [`scripts/qa/library_drift.js`](../../scripts/qa/library_drift.js) của kit này — một gate thật, để ý phần
  allowlist bắt buộc ghi lý do (sẽ học ở Bài 28).
- Bài 11 sẽ gộp gate của bạn vào một bộ có helper dùng chung.
