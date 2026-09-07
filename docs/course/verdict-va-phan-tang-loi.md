# Bài 11 — Verdict và phân tầng lỗi

> **2 giờ 30 phút** · Có gì trong tay: test chạy được, có dữ liệu dựng đúng luồng · Sau bài này: `verdict_taxonomy.json` và `testcase-status.json` — hai file mà Phần 4 sẽ đọc

## Mục tiêu

✅ Khai một file duy nhất cho mọi trạng thái kết quả và ngưỡng rerun.
✅ Phân tầng lỗi: chỉ hai loại đáng log cho Dev.
✅ Chạy lại 2–3 lần trước khi kết luận, và hiểu vì sao đúng con số đó.
✅ Nhận diện lỗi script: fail lặp lại ổn định nhưng làm tay lại đúng.
✅ Hai trạng thái dễ bỏ qua, cả hai đều đang chôn bug thật.
✅ Log bug: đủ bốn phần, gán đúng tầng sau khi đã đọc response thật.

---

## 1. Vì sao phải khai trạng thái ra một file

Phản xạ tự nhiên: ghi `PASS`/`FAIL` trong báo cáo, xong. Nhưng ngay tuần sau bạn cần thêm `SKIP`. Rồi cần
phân biệt *skip vì chưa dựng được dữ liệu* với *skip vì không tự động hoá được*. Rồi Bài 13 cần biết trạng thái
nào là **đã chạy** để đòi bằng chứng.

Nếu mỗi chỗ tự khai thì:

```
báo cáo ghi "Passed"  ·  script ghi "PASS"  ·  gate kiểm "pass"  ·  công cụ TMS hiểu "Passed"
```

Bốn cách viết cho cùng một thứ. Gate so chuỗi rồi trượt. Không ai biết vì nó **trượt im lặng** — coi như không
có case nào đã chạy, và báo ✓.

Nên: **một file, mọi nơi trỏ về.**

`.agent/config/verdict_taxonomy.json`:

```json
{
  "_note": "NGUỒN DUY NHẤT cho trạng thái kết quả + ngưỡng rerun. Prompt, script và gate TRỎ VỀ ĐÂY, không hardcode rải rác. Đổi nghĩa thì sửa ở đây.",

  "statuses": {
    "PASS": {
      "daChay": true, "logJira": false, "tms": "Passed",
      "nghia": "Chạy thật, đúng kỳ vọng theo oracle độc lập. VẪN bắt buộc có bằng chứng."
    },
    "FAIL": {
      "daChay": true, "logJira": true, "tms": "Failed",
      "nghia": "Chạy thật, sai kỳ vọng. BẮT BUỘC kèm tangLoi."
    },
    "PASS_WITH_DEVIATION": {
      "daChay": true, "logJira": false, "tms": "Passed",
      "nghia": "Chỉ pass sau khi lệch khỏi kịch bản (thêm wait, retry, đổi locator, refresh). Phải liệt kê deviation trong phần Actual và xếp vào diện cần review. KHÔNG ghi PASS trơn."
    },
    "SUSPECT_REAL_BUG": {
      "daChay": true, "logJira": true, "tms": "Failed",
      "nghia": "Fail không ổn định mà CHƯA giải thích được cơ chế. Chỉ được đổi sang tangLoi=flaky khi nêu được cơ chế cụ thể."
    },
    "SKIP": {
      "daChay": false, "logJira": false, "tms": "Not Run",
      "nghia": "Không chạy — phải kèm lyDo và khả năng khắc phục."
    },
    "BLOCKED_SETUP": {
      "daChay": false, "logJira": false, "tms": "Blocked",
      "nghia": "Mức sẵn sàng là 'cần hook' mà capability chưa có. Phải nêu CỤ THỂ thiếu gì."
    },
    "SKIP_SETUP": {
      "daChay": false, "logJira": false, "tms": "Not Run",
      "nghia": "Mức sẵn sàng là 'chỉ làm tay'. Không ai phải làm gì thêm."
    }
  },

  "dongNghia": { "Passed": "PASS", "Failed": "FAIL", "Skipped": "SKIP", "Blocked": "BLOCKED_SETUP" },

  "tangLoi": {
    "product_bug": { "logJira": true,  "nghia": "Lỗi thật của sản phẩm. Ghi rõ tầng FE hay BE." },
    "api_bug":     { "logJira": true,  "nghia": "API trả sai hoặc thiếu so với spec. Chỉ kết luận sau khi ĐỌC response thật." },
    "setup_failure": { "logJira": false, "nghia": "Lỗi dựng dữ liệu, xác thực, hook, môi trường. Lỗi của phía test." },
    "script_error":  { "logJira": false, "nghia": "Lỗi script: bắt sai element, click nhầm, đọc sai vùng. Triệu chứng: FAIL LẶP LẠI ỔN ĐỊNH nhưng làm tay lại đúng." },
    "infra":       { "logJira": false, "nghia": "Hạ tầng, CI, timeout môi trường. Khác api_bug: API chết hẳn, không phải trả sai." },
    "flaky":       { "logJira": false, "nghia": "Chập chờn — pass sau retry, VÀ đã nêu được cơ chế." },
    "dependency":  { "logJira": false, "nghia": "Phụ thuộc ngoài chưa sẵn. Ghi rõ đang chờ gì, từ ai." }
  },

  "rerun": {
    "min": 2, "max": 3,
    "mucDich": "Loại chập chờn và lỗi dựng dữ liệu TRƯỚC khi kết luận là bug sản phẩm."
  }
}
```

Đọc nó từ mã, đừng chép lại:

```js
/* Đọc taxonomy — MỘT nguồn. Mọi nơi cần biết "trạng thái nào là đã chạy" đều gọi hàm này. */
'use strict';
const fs = require('fs');
const path = require('path');

const TAXONOMY = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../.agent/config/verdict_taxonomy.json'), 'utf8'));

const DA_CHAY = Object.entries(TAXONOMY.statuses)
  .filter(([, v]) => v.daChay).map(([k]) => k);

const LOG_JIRA = Object.entries(TAXONOMY.tangLoi)
  .filter(([, v]) => v.logJira).map(([k]) => k);

module.exports = { TAXONOMY, DA_CHAY, LOG_JIRA };
```

> Nhớ lại Bài 13: gate bằng chứng có hằng số `DA_CHAY = ['PASS', 'FAIL']` **viết tay**. Đó là bản đơn giản
> để học. Bản đúng là đọc từ file này — vì khi bạn thêm `PASS_WITH_DEVIATION`, gate viết tay sẽ **bỏ sót**
> nó (nó đã chạy nhưng gate không đòi bằng chứng), mà bỏ sót thì không có tín hiệu nào báo.

## 2. Bảy tầng lỗi, và chỉ hai đáng log

Khi test đỏ, câu hỏi **không** phải "bug gì" mà là **"lỗi ở tầng nào"**.

| Tầng | Log Jira? | Nhận ra bằng |
|---|---|---|
| `product_bug` | ✅ | Dữ liệu BE đúng, màn hiện sai |
| `api_bug` | ✅ | Đọc response thật: BE trả sai hoặc thiếu |
| `setup_failure` | ❌ | Lỗi ném ra từ factory (chữ `SETUP:` ở Bài 10) |
| `script_error` | ❌ | Fail **lặp lại ổn định**, nhưng làm tay thì đúng |
| `infra` | ❌ | API không phản hồi, timeout mạng, CI hết bộ nhớ |
| `flaky` | ❌ | Pass sau retry, **và** nêu được cơ chế |
| `dependency` | ❌ | Hệ thống ngoài chưa sẵn |

> Log năm tầng dưới lên Jira là **tiếng ồn**: Dev mở ra, điều tra, phát hiện không phải lỗi của họ, trả về.
> Mất thời gian hai phía và làm nhiễu thống kê defect của sprint.

### Phân tầng FE hay BE: đọc response trước khi kết luận

Với `product_bug`, phải nói rõ FE hay BE — nếu không bug đi lòng vòng qua hai đội trước khi tới người sửa được.

Quy trình bốn bước, và **không được bỏ bước 2**:

1. Thấy sai trên màn.
2. **Mở request tương ứng, đọc dữ liệu BE trả về.**
3. BE trả đúng mà màn hiện sai → **FE**. BE trả sai → **BE**.
4. Dính cả hai tầng → giao **BE trước**, xong họ chuyển lại FE.

```js
const { test, expect } = require('../support/fixtures');

test('bắt response để khoanh tầng lỗi', async ({ page }) => {
  // Bắt response TRƯỚC khi thao tác, để có dữ liệu BE mà đối chiếu khi màn hiện sai
  const choResponse = page.waitForResponse((r) =>
    r.url().includes('/api/orders') && r.request().method() === 'POST');

  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  const res = await choResponse;
  const beTraVe = await res.json();

  const trenMan = await page.locator('#tong-ket').getByLabel('Tổng cộng').innerText();

  // Ghi CẢ HAI giá trị vào báo cáo — đây là thứ khoanh tầng, không phải phỏng đoán
  console.log({ beTraVe: beTraVe.tongCong, trenMan, status: res.status() });
  expect(trenMan).toBe('321.000');
});
```

## 3. Chạy lại 2–3 lần

Case đỏ thì **chạy lại tối thiểu 2 lần, tối đa 3** trước khi kết luận.

| Kết quả rerun | Kết luận |
|---|---|
| Lần 2 xanh | Chập chờn hoặc lỗi dựng — **không** phải bug. Nhưng xem mục 5 trước khi dán nhãn `flaky` |
| Cả 3 lần đỏ, cùng lỗi | Ổn định → có thể là bug **hoặc** `script_error` (mục 4) |
| Đỏ với lỗi **khác nhau** mỗi lần | Gần như luôn là môi trường hoặc dữ liệu |

Vì sao 2–3 chứ không phải 1 hay 10: một lần chạy lại đủ loại phần lớn chập chờn; hơn ba lần thì tốn thời gian
mà không thêm thông tin. Con số này khai trong taxonomy để **đổi ở một chỗ**.

> **Cảnh báo: kết quả rerun hết hạn.** Nếu môi trường được triển khai bản mới giữa lúc bạn rerun hoặc giữa lúc
> viết báo cáo thì kết luận cũ không còn nói gì về bản hiện tại. Chuyện thật: kết quả **lật ngược sau khoảng
> 30 phút** vì có bản triển khai chen vào. Cách phòng: xác nhận lại **sát giờ** viết báo cáo, và giữ một case
> đối chứng đã biết kết quả để phát hiện môi trường vừa đổi.

## 4. `script_error`: loại dễ log nhầm nhất

Đây là tầng lỗi tốn kém nhất vì nó **trông giống bug thật**: fail ổn định, tái hiện được 100%.

**Triệu chứng nhận dạng:**

> FAIL lặp lại **rất ổn định** — rerun không cứu được — nhưng **làm tay theo đúng các bước đó thì kết quả lại
> đúng**.

Phép thử: **làm tay**. Mất năm phút và tiết kiệm một buổi của Dev.

Ba nguyên nhân hay gặp, cả ba đều từ Bài 9:

| Nguyên nhân | Ví dụ |
|---|---|
| Bắt sai element | `.first()` trên trang có 20 nút Xoá → xoá dòng khác |
| Đọc sai vùng | Regex trên cả trang bắt trúng con số ở khu vực khác → báo "tổng tiền sai" |
| Thao tác khi chưa đúng màn | Click trước khi modal đóng xong → click vào element phía sau |

## 5. Hai trạng thái dễ bỏ qua

Hai trạng thái này không có trong sách giáo khoa, nhưng chúng chặn hai đường mà bug thật hay lọt qua.

### `PASS_WITH_DEVIATION` — pass nhờ lệch kịch bản

Case chỉ pass **sau khi** bạn (hoặc agent) thêm wait, thêm retry, đổi locator, refresh, hoặc đi đường khác.

> Đây là rủi ro **đặc thù của agent**: gặp trở ngại thì có xu hướng **làm cho nó chạy**, và mỗi lần như vậy là
> một bug tiềm năng bị lấp. Deviation là **tín hiệu**, không phải tiện lợi.

| Deviation | Có thể đang che gì |
|---|---|
| Thêm `wait 3s` mới thấy element | App chậm thật — bug hiệu năng |
| Phải refresh mới thấy dữ liệu mới | Thiếu cập nhật lại sau khi ghi — bug thật |
| Đổi locator sang element khác | Element đúng có thể đang hỏng |
| Retry mới ăn click | Có thể có race condition |

Luật: **liệt kê từng deviation trong phần Actual**, xếp case vào diện cần review, **không ghi PASS trơn**.

### `SUSPECT_REAL_BUG` — fail chưa giải thích được cơ chế

Fail 1/5 lần. Phản xạ thông thường: dán nhãn `flaky`, bỏ qua.

> Nhưng cơ chế triage flaky có thể đang **chôn bug thật**. Race condition, cache, lệch múi giờ lúc chuyển ngày
> — cả ba đều **trông y hệt flaky**: retry ba lần có một lần xanh.

Luật: chỉ được đổi sang `flaky` khi **nêu được cơ chế cụ thể và cách chứng minh**. Không nêu được thì giữ
`SUSPECT_REAL_BUG`.

| Không phải lời giải thích | Là lời giải thích |
|---|---|
| "Rerun thấy xanh" | "Animation của modal 400ms, test click ở 350ms — đã chứng minh bằng cách tăng lên 500ms thì đỏ 0/10" |
| "Chắc do mạng" | "Response chậm hơn 2s ở 1/5 lần, đo bằng log timing" |
| "Môi trường không ổn định" | "Job đồng bộ chạy mỗi 5 phút, ghi đè dữ liệu test — trùng khung giờ fail" |

## 6. Sinh `testcase-status.json`

Đây là file **Phần 4 sẽ đọc**. Sinh nó từ kết quả Playwright, không viết tay.

`scripts/qa/sinh-status.js`:

```js
#!/usr/bin/env node
/*
 * sinh-status.js — biến results.json của Playwright thành testcase-status.json canonical.
 *
 * VÌ SAO CẦN: results.json là định dạng của runner, gắn với runner. Mọi thứ phía sau (gate bằng chứng,
 * đẩy kết quả lên công cụ TMS, log bug) đọc MỘT định dạng canonical — đổi runner thì chỉ sửa file này.
 *
 * TC ID lấy từ TÊN TEST (quy ước Bài 9: tên test bắt đầu bằng TC ID).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { TAXONOMY } = require('../lib/verdict');

const [inFile, outFile] = process.argv.slice(2);
if (!inFile || !outFile) {
  console.error('Dùng: node scripts/qa/sinh-status.js <results.json> <testcase-status.json>');
  process.exit(2);
}
if (!fs.existsSync(inFile)) {
  console.error('[sinh-status] KHÔNG ĐO ĐƯỢC: không thấy ' + inFile);
  process.exit(2);
}

const kq = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const ra = [];

/** Đi sâu vào cây suite của Playwright để lấy mọi test. */
function di(suites) {
  for (const s of suites || []) {
    for (const spec of s.specs || []) {
      for (const t of spec.tests || []) {
        const lanCuoi = t.results && t.results[t.results.length - 1];
        if (!lanCuoi) continue;

        const tcId = (spec.title.match(/^(TC_\d+)/) || [])[1];
        if (!tcId) { console.warn('BỎ QUA (tên test không mở đầu bằng TC ID): ' + spec.title); continue; }

        // Ánh xạ trạng thái runner → trạng thái canonical
        let status;
        if (lanCuoi.status === 'passed') {
          // Pass sau retry ⇒ đã LỆCH khỏi kịch bản một lần ⇒ không phải PASS trơn
          status = (t.results.length > 1) ? 'PASS_WITH_DEVIATION' : 'PASS';
        } else if (lanCuoi.status === 'skipped') {
          status = 'SKIP';
        } else {
          // Lỗi dựng dữ liệu tự nhận diện qua chữ SETUP: mà factory ném ra (Bài 10)
          const loi = (lanCuoi.error && lanCuoi.error.message) || '';
          status = /^SETUP:|SETUP: /.test(loi) ? 'BLOCKED_SETUP' : 'FAIL';
        }

        const item = { id: tcId, status, ten: spec.title };
        if (status === 'PASS_WITH_DEVIATION') {
          item.deviation = [`pass ở lần thử thứ ${t.results.length} (đã retry)`];
        }
        if (status === 'FAIL') {
          // Tầng lỗi KHÔNG suy tự động được — người phải chấm sau khi rerun và đọc response
          item.tangLoi = null;
          item.loi = ((lanCuoi.error && lanCuoi.error.message) || '').split('\n')[0].slice(0, 200);
        }
        if (status === 'BLOCKED_SETUP') {
          item.lyDo = ((lanCuoi.error && lanCuoi.error.message) || '').split('\n')[0].slice(0, 200);
        }
        // Bằng chứng: Bài 12 sẽ điền. Ở đây lấy attachment mà runner đã có.
        item.evidence = (lanCuoi.attachments || [])
          .filter((a) => /^(image|video)\//.test(a.contentType || ''))
          .map((a) => path.relative(process.cwd(), a.path).replace(/\\/g, '/'));
        ra.push(item);
      }
    }
    di(s.suites);
  }
}
di(kq.suites);

if (!ra.length) {
  console.error('[sinh-status] KHÔNG ĐO ĐƯỢC: 0 test đọc được từ ' + inFile);
  process.exit(2);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(ra, null, 2), 'utf8');

const dem = ra.reduce((a, x) => { a[x.status] = (a[x.status] || 0) + 1; return a; }, {});
console.log(`[sinh-status] ${ra.length} case → ${outFile}`);
console.log('  ' + Object.entries(dem).map(([k, v]) => `${k}=${v}`).join(' · '));

const chuaChamTang = ra.filter((x) => x.status === 'FAIL' && !x.tangLoi);
if (chuaChamTang.length) {
  console.log(`\n⚠ ${chuaChamTang.length} case FAIL chưa chấm tầng lỗi: ` +
    chuaChamTang.map((x) => x.id).join(' '));
  console.log('  Rerun 2–3 lần, đọc response, rồi điền tangLoi. Chỉ ' +
    Object.entries(TAXONOMY.tangLoi).filter(([, v]) => v.logJira).map(([k]) => k).join('/') +
    ' mới được log Jira.');
}
```

Hai quyết định thiết kế đáng để ý:

| Quyết định | Vì sao |
|---|---|
| Pass sau retry → `PASS_WITH_DEVIATION`, không phải `PASS` | Retry **là** một deviation. Ghi PASS trơn là mất tín hiệu |
| `tangLoi = null` cho FAIL, không suy tự động | Máy không biết lỗi ở tầng nào. Để `null` thì nó **hiện ra là việc chưa làm**, thay vì đoán bừa |

## 7. Log bug: bốn phần, không hơn không kém

Chỉ log khi tầng lỗi là `product_bug` hoặc `api_bug`, và đã rerun.

```markdown
**Môi trường:** UAT · bản build <hash hoặc thời điểm> · Chrome 120

**Bước tái hiện**
1. Đăng nhập `user_sales_01`
2. Mở `/orders/create`
3. Chọn khách `IT test PROJ-1234 KH 1712...` (hạng Bạc)
4. Thêm `SP_A`, số lượng 3
5. Đọc ô Tổng cộng ở khối Tổng kết

**Kết quả mong đợi**
Tổng cộng = `321.000` (Tạm tính 300.000 − Giảm giá 9.000 + Phí 30.000) — theo FSD mục 2 và 3, `BR-03`

**Kết quả thực tế**
Tổng cộng = `330.000`. API `POST /api/orders` trả `tongCong: 330000` ⇒ **tầng BE**: giảm giá không được trừ.
Rerun 3/3 lần cùng kết quả.

**Bằng chứng:** `evidence/TC_012-tong-cong-sai.png` (đã khoanh ô Tổng cộng và ô Giảm giá)
```

Bốn đặc điểm khiến bug này được nhận ngay: **bước tái hiện khớp fixture thật** (mã dữ liệu cụ thể, không
"một khách hạng Bạc") · **mong đợi trích nguồn** · **thực tế nêu cả dữ liệu API** nên tầng đã được khoanh ·
**đã rerun**.

---

## Thực hành (60 phút)

### Bước 1 — Khai taxonomy (15 phút)

Viết `.agent/config/verdict_taxonomy.json` và `scripts/lib/verdict.js`. Rồi **sửa `evidence_gate.js` ở Bài 13**
để đọc `DA_CHAY` từ file thay vì hằng số viết tay.

*(Nếu bạn học theo thứ tự bài thì Bài 13 chưa tới — ghi việc này vào danh sách để làm lúc đó.)*

### Bước 2 — Sinh status (15 phút)

Viết `scripts/qa/sinh-status.js`. Chạy suite rồi sinh:

```bash
npx playwright test
node scripts/qa/sinh-status.js \
  test-results/results.json \
  outputs/demo/tasks/PROJ-1234/test-results/testcase-status.json
```

Mở file ra đọc. Kiểm: mỗi case có `id` đúng `TC ID` · trạng thái hợp lệ theo taxonomy · case FAIL có
`tangLoi: null` (chờ người chấm).

### Bước 3 — Tạo một FAIL thật rồi phân tầng (15 phút)

Cố ý làm một test đỏ theo **hai** cách khác nhau, rồi phân tầng:

| Cách làm đỏ | Tầng đúng | Nhận ra bằng |
|---|---|---|
| Đổi giá trị kỳ vọng thành số sai | `script_error` | Fail ổn định, làm tay thì đúng |
| Chặn API trả lỗi 500 (`page.route`) | `infra` hoặc `api_bug` | Đọc response |

Với mỗi cái: rerun 2 lần · làm tay · đọc response · rồi điền `tangLoi`. Ghi lại **bạn dùng bằng chứng gì** để
chấm tầng.

### Bước 4 — Thử `PASS_WITH_DEVIATION` (10 phút)

Làm một test **chỉ pass sau retry**: thêm một điều kiện chập chờn (ví dụ chờ một element xuất hiện muộn).
Chạy với `retries: 1`.

Kiểm `sinh-status.js` có ghi `PASS_WITH_DEVIATION` không, và có ghi mảng `deviation` không.

Rồi trả lời câu quan trọng: **cái deviation đó có đang che gì?**

### Bước 5 — Viết một bug đủ bốn phần (5 phút)

Lấy case FAIL ở Bước 3, viết mô tả bug theo mẫu mục 7. Tự kiểm: người khác đọc xong **tái hiện được** không?

### Bước 6 — Commit

```bash
git add .agent/config/verdict_taxonomy.json scripts/lib/verdict.js scripts/qa/sinh-status.js
git commit -m "feat(verdict): taxonomy MỘT nguồn + sinh testcase-status canonical

7 trạng thái, 7 tầng lỗi, ngưỡng rerun 2-3. Pass sau retry → PASS_WITH_DEVIATION.
tangLoi để null cho FAIL — máy không đoán, người chấm sau khi rerun và đọc response."
```

---

## Tự kiểm

- [ ] Chỉ có **một** file khai trạng thái; không hardcode chuỗi trạng thái ở đâu khác.
- [ ] Tôi phân biệt được cả bảy tầng lỗi, và biết chỉ hai tầng được log Jira.
- [ ] Tôi biết quy trình bốn bước khoanh tầng FE/BE, và **không bỏ bước đọc response**.
- [ ] Tôi nhận ra `script_error` bằng triệu chứng "fail ổn định nhưng làm tay đúng".
- [ ] `sinh-status.js` của tôi map pass-sau-retry thành `PASS_WITH_DEVIATION`.
- [ ] `tangLoi` để `null` cho FAIL — máy không đoán tầng.
- [ ] Tôi nêu được cho `SUSPECT_REAL_BUG` một lời giải thích **là cơ chế**, không phải "rerun thấy xanh".
- [ ] Tôi đã phân tầng **hai** ca FAIL thật, và ghi lại bằng chứng dùng để chấm.
- [ ] Bug tôi viết có bước tái hiện **khớp fixture thật**, không viết chung chung.

## Bài tập về nhà

Mở **năm** bug gần nhất team bạn log lên Jira. Với mỗi bug, chấm lại tầng theo bảng ở mục 2 và trả lời:

1. Bug đó có phải `product_bug`/`api_bug` thật không, hay là `setup_failure`/`script_error`?
2. Có đủ bốn phần mô tả không?
3. Có đọc response trước khi gán FE/BE không?

Nếu có bug bị Dev từ chối, xem lại nó rơi vào tầng nào. Rất thường là `script_error` hoặc `setup_failure` —
và cả hai đều **không nên** lên Jira ngay từ đầu.

## Đọc thêm

- [`.agent/config/verdict_taxonomy.json`](../../.agent/config/verdict_taxonomy.json) của kit này — bản đầy đủ,
  gồm cả `EXPANSION_FINDING` cho phát hiện từ việc mở rộng (Bài 19).
- Bài 12 sẽ điền phần `evidence` cho file trạng thái bạn vừa sinh.
