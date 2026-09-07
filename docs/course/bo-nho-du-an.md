# Bài 16 — Bộ nhớ dự án: làm gì khi chưa có dữ liệu nào

> **2 giờ 30 phút** · Có gì trong tay: kit có kỷ luật, nhưng chưa có ký ức · Sau bài này: năm store, có mầm dữ liệu thật, và thu tự động

## Mục tiêu

✅ Năm store và câu hỏi mỗi store trả lời.
✅ **Giải bài toán cold start**: từ 0 thì dữ liệu ở đâu ra.
✅ Hiểu vì sao bộ nhớ này là dữ liệu công ty: không commit, phải sao lưu ngoài repo.
✅ Thu dữ liệu tự động qua reporter, không qua lệnh phải nhớ gọi.
✅ Chỉ số theo thời gian: độ tin cậy từng case, tỉ lệ chập chờn, cách ly test bất ổn.
✅ Ghi 3 rule và 1 recipe, rồi dùng lại chúng ở lượt sinh case sau.

---

## 1. Vấn đề: agent không có ký ức

Bạn đã có kit khá đầy đủ. Nhưng thử tình huống này:

> Tuần 1: bạn phát hiện màn Chi tiết đơn hiển thị sai định dạng ngày. Log bug. Dev điều tra, kết luận
> **đúng thiết kế** — hai tab cố ý dùng hai định dạng vì hai đối tượng người dùng khác nhau. Bug bị từ chối.
>
> Tuần 4: task khác, cùng màn đó. Agent thấy đúng hiện tượng ấy, và **log lại đúng bug đó**.

Không ai làm sai. Chỉ là kết luận tuần 1 nằm trong hội thoại của tuần 1, và hội thoại đó đã mất.

Ba thứ mất theo cách này:

| Mất gì | Hậu quả cụ thể |
|---|---|
| **Cái đúng là gì** | Oracle phải suy lại từ đầu, hoặc tệ hơn: suy từ app (Bài 7) |
| **Vì sao đã kết luận thế** | Log lại bug đã bị từ chối; đánh FAIL oan case đã chốt là vướng môi trường |
| **Làm sao dựng được state** | Mò lại một cách dựng đã thử và thất bại |

## 2. Năm store, năm câu hỏi

| Store | Trả lời câu | Ví dụ nội dung | Ghi bằng |
|---|---|---|---|
| `domain/` | **Cái đúng là gì?** | `BR-01`: Bạc 3%, trần 100.000, làm tròn xuống | Tay, sau khi BA xác nhận |
| `system/` | **Hệ thống được phép làm gì?** | `SM-02`: Kế toán chỉ xem; chuyển `NHAP→HUY` hợp lệ | Tay, sau khi khảo sát |
| `decisions/` | **Vì sao đã kết luận thế?** | Lệch định dạng ngày = đúng thiết kế, Dev chốt ngày X | Tay, sau mỗi kết luận |
| `setup_recipes/` | **Làm sao dựng được?** | Để có đơn Chuyển đổi: các bước + cạm bẫy đã vấp | Tay, sau khi dựng thành công |
| `environment/` | **Quirk nào hay làm test hỏng?** | Token hết hạn sau 30 phút; login sai 5 lần thì khoá | Tay, sau khi vấp |

Hai store nữa thu **tự động**: `metrics/` (KPI mỗi lượt chạy) và `bugs/` (nạp từ hệ thống quản lý việc).

Cấu trúc:

```text
knowledge/
├── SCHEMA.md            ← cái này CÓ commit: mô tả hình dạng dữ liệu
├── domain/              ← business rule đã XÁC NHẬN
├── system/              ← state machine · ma trận phân quyền · bề mặt dùng chung
├── decisions/           ← lý do các kết luận đã chốt
├── setup_recipes/       ← cách dựng state, kèm cạm bẫy
├── environment/         ← quirk hạ tầng
├── metrics/             ← thu tự động sau mỗi lượt test
└── bugs/                ← nạp từ hệ thống quản lý việc
```

## 3. Cold start: dữ liệu ở đâu ra khi chưa có gì

Đây là mục quan trọng nhất của bài, và là chỗ mà mọi hướng dẫn khác im lặng.

Bốn nguồn, xếp theo thứ tự nên làm:

### Nguồn 1 — Bạn đã có sẵn từ Bài 6 mà chưa nhận ra

Bảng `BR-` bạn sinh ở lượt phân tích **chính là** nội dung của `domain/`. Nó đã có: phát biểu kiểm được ·
trích từ mục nào · và ví dụ input→expected. Chỉ cần **chuyển nó vào store**.

Đây là lý do Bài 6 bắt đặt mã `BR-`: để hôm nay có thứ mà lưu.

### Nguồn 2 — Câu trả lời của BA ở Ambiguity Gate

Mỗi câu BA trả lời là **một business rule đã được xác nhận**. Ở Bài 6 bạn đã có ba câu. Ghi cả ba.

Và ghi luôn **nguồn xác nhận**: ai chốt, ngày nào. Sáu tuần sau bạn cần điều đó.

### Nguồn 3 — Lịch sử hệ thống quản lý việc

Nếu dự án đã chạy một thời gian thì đã có bug lịch sử. Quét về làm mầm cho `bugs/` — nó là đầu vào của
Bài 17 (chấm rủi ro) và của việc đối chiếu "lỗi từng xảy ra đã có case canh chưa".

Nhưng **suggest-only**: nạp dữ liệu, không tự kết luận. Lý do ở Bài 17 mục 5.

### Nguồn 4 — Chấp nhận trống, nhưng trống **có kiểm soát**

Đây là phần khó nhất về tâm lý.

`system/` gần như chắc chắn trống ở tuần đầu — bạn chưa khảo sát máy trạng thái, chưa dựng ma trận phân quyền.
Hai lựa chọn:

| Lựa chọn | Hậu quả |
|---|---|
| Bịa cho đầy | Store có nội dung sai. Mọi oracle trích từ nó về sau đều sai, **im lặng** |
| **Trống có kiểm soát** | ✅ Ghi rõ *"chưa khảo sát"*, và mỗi lần cần thì khảo sát đúng một phần |

Trống mà **khai rõ là trống** thì an toàn. Store có nội dung không ai xác nhận thì nguy hiểm hơn store rỗng —
vì nó trông như đã có nguồn.

```json
{
  "_note": "Bản đồ hệ thống. CHỈ ghi thứ đã XÁC NHẬN (đọc mã, hỏi Dev, hoặc thử nghiệm chứng minh được). Chưa xác nhận thì để trống và ghi rõ, đừng suy đoán.",
  "entities": {
    "order": {
      "trangThai": ["NHAP", "CHO_DUYET", "DA_DUYET", "HUY"],
      "chuyenHopLe": [["NHAP", "CHO_DUYET"], ["CHO_DUYET", "DA_DUYET"], ["NHAP", "HUY"]],
      "nguon": "Đọc mã OrderStateMachine.java, Dev xác nhận ngày 2026-xx-xx",
      "chuaKhaoSat": ["chuyển từ DA_DUYET — chưa rõ có được HUY không"]
    }
  }
}
```

Trường `chuaKhaoSat` là thứ làm file này trung thực. Nó cũng là danh sách việc.

## 4. Ghi rule: có kiểm, không phải ghi bừa

`knowledge/domain/BR-01-giam-gia.json`:

```json
{
  "ma": "BR-01",
  "phatBieu": "Giảm giá tính trên Tạm tính theo hạng khách: Thường 0%, Bạc 3% (trần 100.000), Vàng 5% (trần 300.000). Làm tròn XUỐNG đến đồng.",
  "nguon": "FSD Tạo đơn hàng mục 3; BA xác nhận ngày 2026-xx-xx",
  "viDu": [
    { "input": "hang=Bạc, tamTinh=300000", "expected": "giamGia=9000" },
    { "input": "hang=Bạc, tamTinh=5000000", "expected": "giamGia=100000 (đụng trần)" },
    { "input": "hang=Bạc, tamTinh=33333", "expected": "giamGia=999 (làm tròn xuống từ 999.99)" },
    { "input": "hang=chưa phân hạng, tamTinh=300000", "expected": "giamGia=0" }
  ],
  "coveredBy": ["TC_012", "TC_018", "TC_019"],
  "version": 1
}
```

Bốn trường bắt buộc, mỗi cái có lý do:

| Trường | Vì sao bắt buộc |
|---|---|
| `nguon` | Không có nguồn thì đây chỉ là ý kiến của người ghi |
| `viDu` với input→expected **cụ thể** | Phát biểu bằng chữ thì hai người đọc ra hai nghĩa. Ví dụ số thì không |
| `coveredBy` | BA đổi rule → tìm mã này → biết **chính xác** case nào phải sửa |
| `version` | Rule đổi thì tăng version, giữ lịch sử |

Máy kiểm store:

```js
#!/usr/bin/env node
/*
 * kiem-domain.js — kiểm store domain/ đúng hình dạng và không rỗng nghĩa.
 *
 * VÌ SAO CẦN: store là nền của mọi oracle. Một rule thiếu `nguon` là một ý kiến đội lốt sự thật, và
 * mọi expected trích từ nó về sau đều không kiểm chứng được.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = path.join(process.cwd(), 'knowledge', 'domain');
const BAT_BUOC = ['ma', 'phatBieu', 'nguon', 'viDu'];
const PII = /[\w.+-]+@[\w.-]+\.\w{2,}|\b0\d{9}\b/;   // email · SĐT Việt Nam

if (!fs.existsSync(DIR)) {
  console.log('[domain] store chưa có — bình thường ở tuần đầu. Tạo knowledge/domain/ khi có rule đầu tiên.');
  process.exit(0);
}

const loi = [];
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
for (const f of files) {
  let r;
  try { r = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); }
  catch (e) { loi.push(`${f}: không parse được — ${e.message}`); continue; }

  for (const k of BAT_BUOC) {
    if (!r[k] || (Array.isArray(r[k]) && !r[k].length)) loi.push(`${f}: thiếu "${k}"`);
  }
  for (const v of r.viDu || []) {
    if (!v.input || !v.expected) loi.push(`${f}: có ví dụ thiếu input hoặc expected`);
  }
  // Store này KHÔNG commit, nhưng vẫn không được chứa PII — nó sẽ vào bản sao lưu và vào ngữ cảnh agent
  if (PII.test(JSON.stringify(r))) loi.push(`${f}: nghi có PII (email hoặc SĐT) — dùng dữ liệu ẩn danh`);
}

console.log(`[domain] ${files.length} rule`);
if (loi.length) {
  console.error(`\n[domain] ✗ ${loi.length} vấn đề:`);
  for (const l of loi) console.error('  - ' + l);
  process.exit(1);
}
console.log('[domain] ✓ ĐẠT');
```

## 5. Không commit — và phải sao lưu ngoài repo

`knowledge/` là **dữ liệu công ty**, đối xử như `.env`:

```gitignore
knowledge/*
!knowledge/SCHEMA.md
!knowledge/.gitkeep
```

Nhưng đây là chỗ có một rủi ro thật, và nó khác với `.env`:

> `.env` nạp lại được — bạn có credentials ở chỗ khác. `knowledge/` thì **một phần không nạp lại được từ
> nguồn máy nào**: mọi thứ **ghi tay** (rule đã xác nhận, quyết định đã chốt, recipe kèm cạm bẫy) chỉ tồn tại
> ở đó. Mất là mất hẳn.

Nên phải sao lưu **ra ngoài repo**:

```js
#!/usr/bin/env node
/*
 * sao-luu-knowledge.js — sao lưu các store KHÔNG nạp lại được.
 *
 * VÌ SAO CẦN: metrics/ và bugs/ nạp lại được (chạy lại test, quét lại hệ thống quản lý việc). Nhưng
 * domain/ system/ decisions/ setup_recipes/ environment/ là GHI TAY — không nguồn máy nào sinh lại được.
 *
 * Đích lưu PHẢI ngoài repo (biến KNOWLEDGE_BACKUP_DIR), nếu không sao lưu cùng chết với repo.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const GHI_TAY = ['domain', 'system', 'decisions', 'setup_recipes', 'environment'];
const dich = process.env.KNOWLEDGE_BACKUP_DIR;

if (!dich) {
  console.error('[backup] KHÔNG ĐO ĐƯỢC: chưa khai KNOWLEDGE_BACKUP_DIR');
  console.error('  → trỏ nó vào một thư mục NGOÀI repo (ổ khác, thư mục đồng bộ mây, hoặc chia sẻ mạng)');
  process.exit(2);
}
if (path.resolve(dich).startsWith(path.resolve(process.cwd()))) {
  console.error('[backup] KHÔNG ĐO ĐƯỢC: đích lưu nằm TRONG repo — mất repo là mất cả sao lưu');
  process.exit(2);
}

const moc = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const goi = path.join(dich, `knowledge-${moc}`);
let soFile = 0;

for (const store of GHI_TAY) {
  const src = path.join(process.cwd(), 'knowledge', store);
  if (!fs.existsSync(src)) continue;
  const dst = path.join(goi, store);
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    fs.copyFileSync(path.join(src, f), path.join(dst, f));
    soFile++;
  }
}

if (!soFile) {
  console.log('[backup] 0 file ghi tay — chưa có gì để sao lưu (bình thường ở tuần đầu)');
  process.exit(0);
}
fs.writeFileSync(path.join(goi, 'MANIFEST.txt'),
  `Sao lưu ${moc}\n${soFile} file từ: ${GHI_TAY.join(' ')}\n`, 'utf8');
console.log(`[backup] đã sao lưu ${soFile} file → ${goi}`);
```

## 6. Thu tự động: gắn vào reporter

Với `metrics/`, đừng gắn vào một lệnh phải nhớ gọi. Gắn vào **reporter** của test runner — nó chạy sau **mỗi**
lượt test, mặc định, không ai phải nhớ.

`tests/support/reporter-hoc.js`:

```js
/*
 * reporter-hoc.js — Playwright reporter TỰ ĐỘNG thu dữ liệu học sau mỗi lượt chạy.
 *
 * VÌ SAO LÀ REPORTER, KHÔNG PHẢI LỆNH RIÊNG: việc gì phải nhớ gọi thì sớm muộn sẽ quên, và dữ liệu học là
 * thứ mất IM LẶNG — không ai phát hiện ra là nó thiếu. Reporter thì chạy mặc định.
 *
 * KHÔNG BAO GIỜ throw: reporter lỗi làm cả lượt chạy đỏ, tức mất kết quả thật vì một việc phụ.
 */
'use strict';
const fs = require('fs');
const path = require('path');

class ReporterHoc {
  constructor() { this.ban = []; }

  onTestEnd(test, result) {
    this.ban.push({
      key: test.title.match(/^(TC_\d+)/)?.[1] || test.title.slice(0, 60),
      file: path.relative(process.cwd(), test.location.file).replace(/\\/g, '/'),
      status: result.status,
      soLanThu: result.retry + 1,
      chapChon: result.retry > 0 && result.status === 'passed',
      giay: Math.round(result.duration / 100) / 10
    });
  }

  async onEnd(result) {
    try {
      const task = process.env.TASK_KEY;
      if (!task) return;                       // không có ngữ cảnh task thì bỏ qua, đừng ghi rác
      if (!this.ban.length) return;            // 0 test thì không ghi — tránh dòng rỗng làm nhiễu xu hướng

      const dir = path.join(process.cwd(), 'knowledge', 'metrics');
      fs.mkdirSync(dir, { recursive: true });

      const luot = {
        luc: new Date().toISOString(),
        task,
        soTest: this.ban.length,
        pass: this.ban.filter((t) => t.status === 'passed').length,
        fail: this.ban.filter((t) => t.status === 'failed').length,
        chapChon: this.ban.filter((t) => t.chapChon).length,
        giay: Math.round(result.duration / 1000)
      };
      fs.appendFileSync(path.join(dir, 'luot-chay.jsonl'), JSON.stringify(luot) + '\n');
      for (const t of this.ban) {
        fs.appendFileSync(path.join(dir, 'lich-su-case.jsonl'),
          JSON.stringify({ luc: luot.luc, task, ...t }) + '\n');
      }
    } catch (e) {
      console.warn('[reporter-hoc] không ghi được dữ liệu học: ' + e.message);
    }
  }
}
module.exports = ReporterHoc;
```

Khai ở **cuối** danh sách reporter:

```js
// playwright.config.js
module.exports = {
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['./tests/support/reporter-hoc.js']   // ← CUỐI, xem cảnh báo bên dưới
  ]
};
```

> **Vì sao phải ở cuối, và vì sao không dùng `globalTeardown`.** Đo thật: `globalTeardown` chạy **trước** khi
> reporter `json` ghi xong `results.json` — nên nếu bạn đọc file đó ở teardown thì đọc bản cũ hoặc không có
> file. Reporter khai cuối thì chạy sau các reporter trước nó.

## 7. Độ tin cậy từng case, và cách ly test bất ổn

Có `lich-su-case.jsonl` tích luỹ, giờ trả lời được câu mà một lượt chạy không trả lời được: **case nào không
đáng tin?**

```js
#!/usr/bin/env node
/*
 * do-tin-cay.js — tính độ tin cậy từng testcase qua NHIỀU lượt chạy.
 *
 * VÌ SAO CẦN: một lần fail có thể là xui. Nhưng case pass 18/20 lần mà 9 lần phải retry thì nó không đo
 * được gì cả — và mỗi lần nó đỏ là cả team mất công điều tra vô ích.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const F = path.join(process.cwd(), 'knowledge', 'metrics', 'lich-su-case.jsonl');
if (!fs.existsSync(F)) {
  console.log('[tin-cay] chưa có lịch sử — chạy suite vài lượt rồi quay lại.');
  process.exit(0);
}

const TOI_THIEU_LUOT = Number(process.env.MIN_RUNS || 5);
const NGUONG_CACH_LY = Number(process.env.QUARANTINE_BELOW || 0.8);

const theoCase = {};
for (const dong of fs.readFileSync(F, 'utf8').split('\n').filter(Boolean)) {
  let r; try { r = JSON.parse(dong); } catch (e) { continue; }
  const c = (theoCase[r.key] = theoCase[r.key] || { tong: 0, passSach: 0, phaiRetry: 0, fail: 0 });
  c.tong++;
  if (r.status === 'passed' && r.soLanThu === 1) c.passSach++;
  if (r.status === 'passed' && r.soLanThu > 1) c.phaiRetry++;
  if (r.status === 'failed') c.fail++;
}

const bang = Object.entries(theoCase)
  .filter(([, c]) => c.tong >= TOI_THIEU_LUOT)
  .map(([key, c]) => ({
    key,
    luot: c.tong,
    // Độ tin = pass SẠCH (không cần retry) / tổng. Pass-nhờ-retry KHÔNG tính là pass sạch.
    doTin: c.passSach / c.tong,
    tiLeChapChon: c.phaiRetry / c.tong
  }))
  .sort((a, b) => a.doTin - b.doTin);

console.log(`Case  Lượt  Độ tin  Chập chờn  (chỉ tính case đã chạy ≥ ${TOI_THIEU_LUOT} lượt)`);
console.log('─'.repeat(56));
for (const r of bang) {
  console.log(`${r.key.padEnd(12)} ${String(r.luot).padStart(4)}  ` +
    `${(r.doTin * 100).toFixed(0).padStart(5)}%  ${(r.tiLeChapChon * 100).toFixed(0).padStart(8)}%`);
}

const canCachLy = bang.filter((r) => r.doTin < NGUONG_CACH_LY);
if (canCachLy.length) {
  console.log(`\n⚠ ${canCachLy.length} case độ tin dưới ${NGUONG_CACH_LY * 100}% — nên CÁCH LY:`);
  for (const r of canCachLy) console.log(`  ${r.key} (${(r.doTin * 100).toFixed(0)}%)`);
  console.log('\nCách ly = vẫn chạy, vẫn ghi nhận, nhưng KHÔNG làm đỏ kết quả chung.');
  console.log('Đó là trạng thái TẠM: nhiều case bị cách ly nghĩa là độ tin cả suite giảm.');
}
```

**Cách ly** là đường giữa giữa hai lựa chọn tệ: để nguyên thì suite luôn đỏ và người ta ngừng đọc; xoá đi thì
mất luôn phần kiểm. Cách ly giữ tín hiệu mà không để nó làm nhiễu.

---

## Thực hành (65 phút)

### Bước 1 — Chuyển bảng `BR-` vào store (15 phút)

Lấy bảng business rule từ Bài 6, chuyển thành file JSON trong `knowledge/domain/`. Với **mỗi** rule, bắt buộc
có `nguon`, và ít nhất **hai** ví dụ input→expected (một ca thường, một ca biên).

Viết `scripts/qa/kiem-domain.js`, chạy, sửa cho tới khi ĐẠT.

### Bước 2 — Ghi quyết định đầu tiên (10 phút)

Lấy **một** kết luận QA thật của bạn (bug bị từ chối, case PASS kèm ghi chú, một cách test đã thử và thất bại)
và ghi vào `knowledge/decisions/`:

```json
{
  "loai": "by_design",
  "trieuChung": "Ngày sinh hiển thị khác định dạng giữa tab Tổng quan và tab Thông tin CRM",
  "ketLuan": "Đúng thiết kế — hai tab phục vụ hai đối tượng người dùng khác nhau",
  "lyDo": "Dev đọc mã xác nhận: tab CRM cố ý giữ định dạng gốc của hệ thống nguồn để đối soát",
  "aiChot": "Dev <tên>", "ngay": "2026-xx-xx",
  "hetHan": null
}
```

Trường `lyDo` **để trống là vô dụng** — chính nó là thứ khiến task sau không kết luận lại từ đầu.

### Bước 3 — Ghi một recipe kèm cạm bẫy (10 phút)

Lấy tiền điều kiện khó nhất ở Bài 10 và ghi vào `knowledge/setup_recipes/`. Phần **`camBay`** là phần giá trị
nhất — đó là thứ chỉ biết sau khi đã vấp:

```json
{
  "mucTieu": "Có đơn hàng ở trạng thái CHO_DUYET",
  "cach": "factory",
  "buoc": [
    "POST /api/customers tạo khách (nhớ tiền tố IT test)",
    "POST /api/orders với trangThai NHAP",
    "POST /api/orders/{id}/submit để chuyển sang CHO_DUYET"
  ],
  "camBay": [
    "Gọi submit ngay sau create thì trả 409 — cần đợi đơn có ít nhất 1 dòng sản phẩm",
    "submit KHÔNG nhận trangThai trong body; truyền vào thì bị bỏ qua âm thầm"
  ],
  "verify": "GET /api/orders/{id} → trangThai === 'CHO_DUYET'",
  "donDep": "DELETE /api/orders/{id}",
  "daDungO": ["TC_022", "TC_023"]
}
```

### Bước 4 — Reporter và sao lưu (15 phút)

Viết `reporter-hoc.js`, khai ở **cuối** danh sách reporter. Chạy suite **ba lần**, rồi kiểm:

```bash
wc -l knowledge/metrics/luot-chay.jsonl        # phải là 3
wc -l knowledge/metrics/lich-su-case.jsonl     # phải là 3 × số test
```

Viết `sao-luu-knowledge.js`, khai `KNOWLEDGE_BACKUP_DIR` trỏ **ngoài repo**, chạy thử. Rồi thử trỏ nó **vào
trong** repo và xác nhận nó ra `exit 2`.

### Bước 5 — Đo độ tin cậy (10 phút)

Chạy suite **năm lần** (đủ ngưỡng tối thiểu), rồi:

```bash
node scripts/qa/do-tin-cay.js
```

Có case nào dưới ngưỡng thì đó là danh sách cần truy nguyên nhân — quay lại Bài 9 mục 5.

### Bước 6 — Dùng lại store ở lượt sinh case (5 phút)

Đây là bước chứng minh bộ nhớ **có tác dụng**. Chạy lại lượt sinh case ở Bài 6, nhưng thêm vào đầu vào:

```
ĐẦU VÀO
1. docs/course/assets/sample-requirement.md
2. knowledge/domain/*.json        ← business rule ĐÃ XÁC NHẬN, dùng làm oracle
3. knowledge/decisions/*.json     ← những gì đã chốt, ĐỪNG kết luận lại
```

So với lượt Bài 6: agent có còn hỏi lại ba câu đã được BA trả lời không? **Không nên** — vì câu trả lời giờ đã
nằm trong `domain/`.

### Bước 7 — Commit

```bash
git add knowledge/SCHEMA.md .gitignore scripts/qa tests/support/reporter-hoc.js playwright.config.js
git commit -m "feat(knowledge): 5 store + reporter thu tự động + đo độ tin cậy + sao lưu ngoài repo

knowledge/** KHÔNG commit (dữ liệu công ty). Cold start: chuyển bảng BR- từ lượt phân tích vào domain/.
Store ghi tay không nạp lại được từ nguồn máy ⇒ bắt buộc sao lưu ngoài repo."
```

---

## Tự kiểm

- [ ] Tôi kể được năm store và câu hỏi mỗi store trả lời.
- [ ] `knowledge/**` bị `.gitignore`, chỉ `SCHEMA.md` được commit.
- [ ] Mọi rule trong `domain/` có `nguon` và ít nhất hai ví dụ input→expected.
- [ ] `kiem-domain.js` của tôi chặn rule thiếu nguồn, và cảnh báo khi nghi có PII.
- [ ] Quyết định tôi ghi có trường `lyDo` **không rỗng**, và có ai chốt + ngày.
- [ ] Recipe của tôi có phần `camBay` — thứ chỉ biết sau khi vấp.
- [ ] Reporter khai ở **cuối**, và tôi biết vì sao không dùng `globalTeardown`.
- [ ] Reporter **không bao giờ throw**, và bỏ qua khi thiếu ngữ cảnh task.
- [ ] Sao lưu ra `exit 2` khi đích nằm trong repo.
- [ ] Tôi phân biệt được **pass sạch** với **pass nhờ retry** trong công thức độ tin cậy.
- [ ] Ở Bước 6, agent **không hỏi lại** những câu đã có trong `domain/`.

## Bài tập về nhà

Chọn ba kết luận QA gần nhất của bạn — bug bị từ chối, case PASS kèm ghi chú, cách test đã thử và thất bại —
và ghi cả ba vào `decisions/`.

Rồi tự trả lời: **trong sáu tháng qua, bao nhiêu lần team bạn kết luận lại một thứ đã kết luận rồi?** Con số
đó nhân với thời gian mỗi lần là chi phí của việc không có store này.

## Đọc thêm

- Bài 17 sẽ dùng `bugs/` và `metrics/` để chấm rủi ro — và giải bài toán cold start của **chính việc chấm**.
- [`knowledge/SCHEMA.md`](../../knowledge/SCHEMA.md) của kit này (nếu repo bạn có) — hình dạng đầy đủ của
  bảy store.
