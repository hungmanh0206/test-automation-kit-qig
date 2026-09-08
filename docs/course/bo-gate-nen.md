# Bài chi tiết — Bộ gate nền

> **2 giờ 30 phút** · Có gì trong tay: một gate tự viết, đã chứng minh có răng · Sau bài này: 4 gate + một lệnh gộp
>
> *Bài này không đánh số, nó là phần đào sâu của **Bài 11**. Đọc kèm **Bài 11**.*

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Mỗi gate lại viết lại phần khung một lần. Mười gate thành mười kiểu báo lỗi khác nhau. |
| **Bài này bạn gõ gì** | Viết một thư viện khung dùng chung, thêm máy kiểm tồn kho, máy quét mật khẩu, và một lệnh gộp. |
| **Xong thì được gì** | Một lệnh chạy hết mọi máy chặn. Và chỗ chưa đo được thì không bị coi là đạt. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Khung gate dùng chung** | Thư viện lo phần lặp lại, để mỗi gate chỉ viết phần riêng của nó |
| **Suite rỗng vẫn xanh** | Không test nào chạy, mà báo cáo vẫn báo pass |
| **Lệnh gộp** | Một lệnh chạy hết mọi máy chặn, in ra một bảng kết quả |

## Bài này bạn sẽ làm gì

Bốn việc:

1. Viết khung dùng chung, để gate sau khỏi lặp lại phần vỏ (30 phút).
2. Viết gate chống suite rỗng vẫn xanh (35 phút).
3. Viết máy quét mật khẩu trên file đã đưa lên git (30 phút).
4. Nối tất cả vào một lệnh, rồi cố tình làm sai từng thứ để xem đúng gate nào đỏ (55 phút).

---

## 1. Bốn lớp lỗi cần canh, và thứ tự nguy hiểm

Bài 8 bạn canh **bằng chứng**. Còn bốn lớp nữa, xếp theo mức nguy hiểm giảm dần:

| # | Lớp lỗi | Vì sao nguy hiểm | Gate |
|---|---|---|---|
| 1 | **Suite rỗng vẫn xanh** | Không tạo ra tín hiệu nào cả. Pipeline xanh, báo cáo xanh, mà thực tế 0 thứ được kiểm | `kiem-ton-kho` |
| 2 | **Chạy trên nền sai** | Thiếu input ⇒ cả phase chạy sai, và hỏng tới cuối mới lộ | `kiem-dau-vao_gate` |
| 3 | **Bí mật lọt vào repo** | Không hồi phục được — lịch sử git không xoá sạch dễ | `quet-secret` |
| 4 | **Bộ testcase sai thiết kế** | Công sức execute đổ đi hết | `design_gate` |

Lớp 1 đứng đầu vì nó là lớp **duy nhất** không có triệu chứng. Ba lớp còn lại rồi cũng lộ; lớp 1 thì không.

## 2. Trước tiên: helper dùng chung

Bốn gate cùng in kết quả một kiểu, cùng ba mã thoát. Chép logic đó bốn lần là tự tạo trôi: sửa cách in ở
một chỗ, ba chỗ kia vẫn kiểu cũ.

`scripts/qa/lib/gate.js`:

```js
/*
 * gate.js — khuôn dùng chung cho mọi gate.
 *
 * VÌ SAO TÁCH RA: bốn gate cùng cần "in vi phạm rồi thoát đúng mã". Chép bốn lần thì sửa một chỗ,
 * ba chỗ còn lại trôi. Tách ra còn cho phép Bài 28 gộp nhiều gate thành một báo cáo, vì tất cả
 * trả về CÙNG một hình dạng kết quả.
 */
'use strict';

/** Kết quả chuẩn của một gate. Bài 28 sẽ cộng dồn những object này. */
function ketQua(gateId, { viPham = [], ghiChu = [], daKiem = '' } = {}) {
  return { gateId, viPham, ghiChu, daKiem };
}

/** Không đo được — KHÁC hẳn với "đo được và xấu". Xem Bài 8 mục 2. */
function khongDoDuoc(gateId, msg) {
  console.error(`[${gateId}] KHÔNG ĐO ĐƯỢC: ${msg}`);
  console.error('  → sửa hạ tầng rồi chạy lại. ĐỪNG đọc kết quả của lượt này.');
  process.exit(2);
}

/** In kết quả rồi thoát. warnOnly = true thì luôn exit 0 (giai đoạn cảnh báo, xem Bài 8 mục 7). */
function ketThuc(kq, { warnOnly = false } = {}) {
  if (kq.daKiem) console.log(`[${kq.gateId}] đã kiểm ${kq.daKiem}`);
  for (const g of kq.ghiChu) console.log(`[${kq.gateId}] ⚠ ${g}`);
  if (kq.viPham.length) {
    console.error(`\n[${kq.gateId}] ✗ ${kq.viPham.length} vi phạm:`);
    for (const v of kq.viPham) console.error('  - ' + v);
    process.exit(warnOnly ? 0 : 1);
  }
  console.log(`[${kq.gateId}] ✓ ĐẠT`);
  process.exit(0);
}

/** Danh sách file ĐANG ĐƯỢC GIT TRACK. Chịu được trường hợp KHÔNG có .git. */
function fileDangTrack(cwd = process.cwd()) {
  try {
    const out = require('child_process').execSync('git ls-files', { cwd, encoding: 'utf8' });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch (e) {
    return null;   // null = không có git ⇒ người gọi tự quyết, đừng crash
  }
}

module.exports = { ketQua, khongDoDuoc, ketThuc, fileDangTrack };
```

> `fileDangTrack` trả `null` chứ không throw. Điều này đến từ một lần vấp thật: hai gate của kit gọi
> `git ls-files` vô điều kiện và **crash** khi chạy trong thư mục đã giải nén (không có `.git`). Nó chỉ lộ ra
> khi có người thử đúng trải nghiệm của người nhận gói. Ba gate sau đó dùng chung một helper thay vì vá lần
> thứ ba.

## 3. Gate 1 — chống suite rỗng vẫn xanh

Lớp lỗi này có thật và rất dễ xảy ra: đổi cấu trúc thư mục, sửa một glob, đổi tên `describe`, bất cứ cái nào
cũng có thể làm bộ test không khớp file nào. Mà nhiều runner có cờ *"không có test thì vẫn coi là thành công"*.

`scripts/qa/kiem-ton-kho.js`:

```js
#!/usr/bin/env node
/*
 * kiem-ton-kho.js — CHẶN "suite rỗng vẫn xanh".
 *
 * VÌ SAO CÓ FILE NÀY: đây là lớp lỗi DUY NHẤT không tạo ra tín hiệu nào. Một glob sai đường dẫn là đủ
 * để 0 test được chạy, trong khi pipeline, báo cáo và tỉ lệ pass đều xanh. Không ai phát hiện được.
 *
 * Cách đo: hỏi chính runner "mày thấy bao nhiêu test", KHÔNG tự đếm file — đếm file thì lệch với
 * thứ runner thật sự chạy.
 */
'use strict';
const { spawnSync } = require('child_process');
const { ketQua, khongDoDuoc, ketThuc } = require('./lib/gate');

const GATE = 'inventory-gate';
const TOI_THIEU = Number(process.env.MIN_TESTS || 1);

const r = spawnSync('npx', ['playwright', 'test', '--list', '--reporter=json'],
  { encoding: 'utf8', shell: true });

if (r.error) khongDoDuoc(GATE, 'không chạy được runner — ' + r.error.message);

let soTest = 0;
try {
  // --reporter=json in ra JSON; lấy phần { … } để bỏ dòng cảnh báo nếu có
  const raw = r.stdout.slice(r.stdout.indexOf('{'), r.stdout.lastIndexOf('}') + 1);
  const json = JSON.parse(raw);
  const dem = (specs) => (specs || []).reduce((a, s) => a + (s.tests ? s.tests.length : 0), 0);
  const walk = (suites) => (suites || []).reduce(
    (a, s) => a + dem(s.specs) + walk(s.suites), 0);
  soTest = walk(json.suites);
} catch (e) {
  khongDoDuoc(GATE, 'không đọc được danh sách test từ runner — ' + e.message);
}

const kq = ketQua(GATE, { daKiem: `${soTest} test runner nhìn thấy` });
if (soTest < TOI_THIEU) {
  kq.viPham.push(`runner chỉ thấy ${soTest} test (tối thiểu ${TOI_THIEU}). ` +
    'Suite rỗng mà runner vẫn báo thành công là XANH GIẢ — kiểm lại glob testMatch, ' +
    'tên thư mục, và cờ bỏ-qua-khi-không-có-test.');
}
ketThuc(kq);
```

Để ý `khongDoDuoc` xuất hiện **hai lần**: runner không chạy được và runner trả về thứ không đọc được đều là
*không đo được*, không phải *suite rỗng*. Gộp lại là đúng lỗi mà Bài 8 mục 2 cảnh báo.

## 4. Gate 2 — quét secret trên file đã track

```js
#!/usr/bin/env node
/*
 * quet-secret.js — CHẶN secret bị commit nhầm.
 *
 * VÌ SAO QUÉT FILE ĐÃ TRACK, không quét cả thư mục: thứ nguy hiểm là thứ ĐÃ VÀO GIT. File nằm trong
 * .gitignore thì không rời khỏi máy bạn. Quét cả thư mục thì node_modules làm nhiễu tới mức không ai đọc.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { ketQua, khongDoDuoc, ketThuc, fileDangTrack } = require('./lib/gate');

const GATE = 'secret-scan';

// Mẫu HIGH-SIGNAL: thà bỏ sót vài dạng lạ còn hơn báo oan. Báo oan = gate bị tắt (Bài 8 mục 8).
const MAU = [
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
  [/\b(gh[pousr]_[A-Za-z0-9]{20,})/, 'GitHub token'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/"type"\s*:\s*"service_account"/, 'Google service-account JSON'],
  [/\b(password|passwd|pwd)\s*[:=]\s*['"][^'"\s]{8,}['"]/i, 'password gán cứng'],
  [/\b(api[_-]?key|secret|token)\s*[:=]\s*['"][A-Za-z0-9_\-]{24,}['"]/i, 'khoá/API key gán cứng']
];

// File mẫu và tài liệu thì CHỨA placeholder là đúng — bỏ qua, nếu không gate đỏ mãi.
const BO_QUA = [/\.example$/, /\.sample$/, /(^|\/)docs\//, /\.md$/, /(^|\/)scripts\/qa\/quet-secret\.js$/];
const BINARY = /\.(png|jpg|jpeg|webp|gif|mp4|webm|pdf|zip|xlsx|woff2?|ico)$/i;

const files = fileDangTrack();
if (files === null) khongDoDuoc(GATE, 'không có .git nên không biết file nào đang được track');
if (!files.length) khongDoDuoc(GATE, 'git không track file nào — 0 file thì không có gì để quét');

const kq = ketQua(GATE, { daKiem: `${files.length} file đang được git track` });

for (const f of files) {
  if (BINARY.test(f) || BO_QUA.some((re) => re.test(f))) continue;
  let noiDung;
  try { noiDung = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (noiDung.includes(' ')) continue;                 // binary lọt lưới đuôi file
  noiDung.split('\n').forEach((dong, i) => {
    for (const [re, ten] of MAU) {
      if (re.test(dong)) kq.viPham.push(`${f}:${i + 1} — nghi là ${ten}`);
    }
  });
}
if (kq.viPham.length) {
  kq.ghiChu.push('Lọt vào lịch sử git thì PHẢI xoay vòng lại credential — xoá commit là không đủ.');
}
ketThuc(kq);
```

Hai danh sách `BO_QUA` và `BINARY` không phải để làm gate dễ dãi. Chúng là phần chống báo oan. Không có
chúng thì mọi file `.env.example` và mọi trang tài liệu có ví dụ token đều đỏ, và bạn sẽ tắt gate trong tuần.

## 5. Gate 3 — kiem-dau-vao: bạn tự viết

Đây là bài tập, không phải bài đọc. Đặc tả:

**Tên:** `scripts/qa/kiem-dau-vao.js` · **Chạy:** `npm run kiem-dau-vao -- --task PROJ-1234`

**Phải kiểm:**
1. Biến `MA_TASK` và `THU_MUC_KET_QUA` có giá trị (không rỗng).
2. Thư mục `<THU_MUC_KET_QUA>/tasks/<MA_TASK>/` **tồn tại**.
3. File `profiles/<MA_TASK>/task.env` **tồn tại** — nếu không thì credentials sẽ rơi về `.env` chung.
4. **Mọi** file `.json` trong thư mục task **parse được**.
5. Bộ testcase canonical đã có (ít nhất một file trong `test-cases/`).

**Mã thoát:** thiếu biến hoặc thiếu thư mục → `2` (không đo được). JSON hỏng hoặc thiếu testcase → `1`.

> Vì sao mục 3 quan trọng đến thế. Quên truyền file env riêng của task là lỗi kinh điển: env rơi về file
> chung, thiếu credentials, công cụ đứng ở màn đăng nhập, và mọi màn đọc ra 0 cột. Báo cáo trông y hệt
> như ứng dụng hỏng thật. Đó chính là câu chuyện ở Bài 8 mục 2, và kiem-dau-vao là nơi chặn nó sớm nhất.

**Tự kiểm sau khi viết:** thiếu `MA_TASK` → `2` · JSON hỏng → `1` kèm tên file và số dòng · đủ mọi thứ → `0`.

## 6. Gate 4 — design: soi thiết kế bộ testcase

Bài 9 bạn chốt 7 cột bắt buộc. Gate này canh chúng:

**Tầng cấu trúc** (chặn ngay, thiếu là mọi công cụ sau vỡ):
- Đủ 7 cột, **đúng tên**. Thiếu hoặc đổi tên → `exit 1`.
- Mọi dòng có `TC ID` không rỗng và không trùng.

**Tầng chất lượng dòng** (cảnh báo trước, chặn sau):
- `Kết quả mong đợi` rỗng, hoặc chỉ có chữ dạng "hiển thị đúng", "thành công" — **oracle rỗng**.
- `Ưu tiên` nằm ngoài thang đã khai.
- `Các bước thực hiện` chỉ một dòng cho case nhiều bước.

Mẫu bắt oracle rỗng, đây là phần đáng giá nhất của gate này:

```js
// Cụm chữ KHÔNG phán được gì: pass với gần như mọi giá trị, kể cả giá trị sai.
const ORACLE_RONG = [
  /^hiển thị đúng\.?$/i, /^thành công\.?$/i, /^không lỗi\.?$/i,
  /^hoạt động bình thường\.?$/i, /^như mong đợi\.?$/i, /^ok\.?$/i
];
if (ORACLE_RONG.some((re) => re.test(String(row.expected).trim()))) {
  kq.viPham.push(`${row.tcId}: "Kết quả mong đợi" không phán được gì — ` +
    'phải nêu GIÁ TRỊ, URL hoặc element cụ thể, và trích được nguồn (Bài 10).');
}
```

## 7. Lệnh gộp

Bốn gate chạy rời thì sẽ có lần bạn quên một cái. Gộp lại:

`scripts/qa/tu-soi.js`:

```js
#!/usr/bin/env node
/*
 * tu-soi.js — chạy CẢ BỘ gate và gom thành MỘT báo cáo.
 *
 * VÌ SAO CẦN: trước khi kết thúc một task, thứ nguy hiểm không phải lỗi bạn biết, mà là gate bạn QUÊN
 * chạy. Một lệnh gộp biến "check chưa kỹ" thành thứ có bằng chứng thay vì cảm tính.
 *
 * KHÔNG viết lại logic kiểm — chỉ ĐIỀU PHỐI. Mỗi gate vẫn chạy được riêng.
 */
'use strict';
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const task = (args[args.indexOf('--task') + 1]) || process.env.MA_TASK || '';
const statusFile = (args[args.indexOf('--status') + 1]) || '';

const BO_GATE = [
  { ten: 'kiem-dau-vao',  lenh: ['scripts/qa/kiem-dau-vao.js', '--task', task] },
  { ten: 'inventory',  lenh: ['scripts/qa/kiem-ton-kho.js'] },
  { ten: 'secret',     lenh: ['scripts/qa/quet-secret.js'] },
  { ten: 'design',     lenh: ['scripts/qa/design_gate.js'] },
  { ten: 'evidence',   lenh: statusFile ? ['scripts/qa/gate-bang-chung.js', statusFile] : null }
];

const bang = [];
for (const g of BO_GATE) {
  if (!g.lenh) { bang.push([g.ten, 'BỎ QUA', 'thiếu tham số đầu vào']); continue; }
  const r = spawnSync(process.execPath, g.lenh, { encoding: 'utf8' });
  const out = ((r.stdout || '') + (r.stderr || '')).trim().split('\n');
  const cuoi = out.filter((l) => l.includes('✗') || l.includes('✓') || l.includes('KHÔNG ĐO ĐƯỢC'));
  const nhan = r.status === 0 ? 'ĐẠT' : (r.status === 2 ? 'KHÔNG ĐO ĐƯỢC' : 'VI PHẠM');
  bang.push([g.ten, nhan, (cuoi[cuoi.length - 1] || '').trim()]);
}

console.log('\n' + '─'.repeat(72));
console.log('SELF-REVIEW' + (task ? ' · task ' + task : ''));
console.log('─'.repeat(72));
for (const [ten, nhan, chiTiet] of bang) {
  console.log(`  ${ten.padEnd(11)} ${nhan.padEnd(16)} ${chiTiet.slice(0, 42)}`);
}
console.log('─'.repeat(72));

const viPham = bang.filter((r) => r[1] === 'VI PHẠM');
const khongDo = bang.filter((r) => r[1] === 'KHÔNG ĐO ĐƯỢC');
if (khongDo.length) {
  console.error(`\n✗ ${khongDo.length} gate KHÔNG ĐO ĐƯỢC — sửa hạ tầng trước, đừng kết luận gì từ lượt này.`);
  process.exit(2);
}
if (viPham.length) {
  console.error(`\n✗ ${viPham.length} gate có vi phạm. Chạy riêng từng gate để xem chi tiết.`);
  process.exit(1);
}
console.log('\n✓ Cả bộ gate ĐẠT.');
process.exit(0);
```

`package.json`:

```json
"scripts": {
  "kiem-dau-vao": "node scripts/qa/kiem-dau-vao.js",
  "inventory:gate": "node scripts/qa/kiem-ton-kho.js",
  "secret:scan": "node scripts/qa/quet-secret.js",
  "design:gate": "node scripts/qa/design_gate.js",
  "gate:evidence": "node scripts/qa/gate-bang-chung.js",
  "self-review": "node scripts/qa/tu-soi.js"
}
```

Ba quyết định thiết kế trong `tu-soi` đáng để ý:

| Quyết định | Vì sao |
|---|---|
| Chỉ **điều phối**, không viết lại logic | Chép logic là tạo nguồn thứ hai — sửa luật ở gate, lệnh gộp vẫn chặn theo luật cũ |
| Mỗi gate vẫn chạy được **riêng** | Khi lệnh gộp đỏ, bạn cần chạy riêng để xem chi tiết |
| `KHÔNG ĐO ĐƯỢC` **thắng** `VI PHẠM` | Có gate không đo được thì cả báo cáo không đáng tin. Đừng để nó lẫn trong danh sách vi phạm |

---

## Thực hành (75 phút)

### Bước 1 — Helper + 2 gate (25 phút)

Viết `lib/gate.js`, `kiem-ton-kho.js`, `quet-secret.js`. Chạy từng cái, xác nhận `exit 0`.

### Bước 2 — Tự viết kiem-dau-vao (20 phút)

Theo đặc tả mục 5. Xong thì tự kiểm ba trường hợp ở cuối mục đó.

### Bước 3 — design_gate tầng cấu trúc (15 phút)

Chỉ cần tầng cấu trúc: đủ 7 cột, `TC ID` không rỗng và không trùng. Tầng chất lượng dòng để bài tập về nhà.

### Bước 4 — Lệnh gộp (10 phút)

Viết `tu-soi.js`, chạy `npm run tu-soi -- --task PROJ-1234 --status <đường/dẫn/status.json>`.

### Bước 5 — Cố tình làm sai từng thứ (15 phút)

Bảng này là nghiệm thu của cả bài. Mỗi dòng chỉ được làm đúng một gate đỏ. Nếu hai gate cùng đỏ thì
phạm vi của chúng đang chồng nhau, cần tách lại.

| Làm sai gì | Gate nào phải đỏ | Mã | Thật ra đỏ gate nào | Đạt? |
|---|---|---|---|---|
| Đổi `testMatch` thành glob không khớp file nào | inventory | 1 | | |
| Thêm `password = "abc12345678"` vào một file đã track | secret | 1 | | |
| Xoá `profiles/PROJ-1234/task.env` | kiem-dau-vao | 2 | | |
| Làm hỏng một dấu ngoặc trong file `.json` của task | kiem-dau-vao | 1 | | |
| Đổi tên cột `Ưu tiên` thành `Priority` | design | 1 | | |
| Xoá `evidence` của một case `PASS` | evidence | 1 | | |

Nhớ **hoàn nguyên** sau mỗi dòng.

### Bước 6 — Commit

```bash
git add scripts/qa package.json
git commit -m "feat(gate): bộ gate nền + lệnh gộp self-review

4 gate: inventory (chống xanh giả) · secret · kiem-dau-vao · design.
Nghiệm thu: 6/6 tình huống làm sai đều đỏ đúng gate mong đợi."
```

---

## Cây thư mục sau bài này

```
kit-cua-toi/scripts/
├── lib/
│   └── gate.js                   ← MỚI · khung chung: ketQua · khongDoDuoc · fileDangTrack
└── qa/
    ├── kiem-ton-kho.js         ← MỚI · artifact bắt buộc thiếu ⇒ chặn
    ├── quet-secret.js            ← MỚI · secret trên file đã track ⇒ chặn
    └── tu-soi.js            ← SỬA · gộp mọi gate; KHÔNG ĐO ĐƯỢC thắng VI PHẠM
```

`lib/gate.js` ở `scripts/lib/` vì gõ `node scripts/lib/gate.js` không làm gì cả, nó là thư viện.
Ba file kia ở `scripts/qa/` vì mỗi file tự chạy được và thoát với mã khác 0 khi có vi phạm.

## Tự kiểm

- [ ] Bốn gate dùng chung `lib/gate.js`, không chép logic in kết quả.
- [ ] `fileDangTrack` **không crash** khi không có `.git`.
- [ ] `kiem-ton-kho` hỏi runner, không tự đếm file.
- [ ] `quet-secret` bỏ qua file `.example` và tài liệu, và tôi hiểu vì sao đó không phải nới lỏng.
- [ ] `kiem-dau-vao` phân biệt đúng `exit 2` với `exit 1`.
- [ ] `tu-soi` chỉ điều phối, và mỗi gate vẫn chạy được riêng.
- [ ] Trong `tu-soi`, `KHÔNG ĐO ĐƯỢC` thắng `VI PHẠM`.
- [ ] **6/6 dòng** ở bảng Bước 5 đỏ đúng gate mong đợi, không gate nào chồng phạm vi.

## Bài tập về nhà

1. Tầng chất lượng dòng cho `design_gate`. Bắt oracle rỗng theo mẫu ở mục 6. Chạy trên bộ testcase thật
   của bạn rồi **đếm**: bao nhiêu phần trăm case có oracle không phán được gì? Con số đó thường gây bất ngờ.
2. Cờ `--warn-only` cho gate mới. Tầng chất lượng dòng nên bắt đầu ở mức cảnh báo, theo đúng ba bước ở
   Bài 8 mục 7.

## Đọc thêm

- [`scripts/qa/`](../../scripts/qa/) của kit này, bộ máy, cùng một khuôn bạn vừa dựng.
- Bài 28: khi số gate tăng lên, làm sao biết gate nào đã mất nơi gọi và **gate nào đã âm thầm tụt thành
  cảnh báo**.
