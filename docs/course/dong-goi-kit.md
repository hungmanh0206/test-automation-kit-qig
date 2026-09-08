# Bài 28 — Tách thứ thuộc Kit khỏi thứ thuộc Project

> **2 giờ 30 phút** · Có gì trong tay: kit đầy đủ, chạy tốt trên máy bạn · Sau bài này: một bản phát hành đã được chứng minh là chạy được, không phải một tệp zip hy vọng

**Vấn đề**

Một QA khác trong công ty hỏi xin bộ kit của bạn để dùng cho sản phẩm của họ.

Trước khi gửi, bạn tự hỏi: họ cần xoá những gì trước khi bắt đầu?

Nếu câu trả lời là *"khá nhiều"*, thì thứ bạn đang có là automation của một sản phẩm, không phải một
bộ kit.

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Bạn gửi kit cho người khác bằng file zip, mà không biết nó chạy nổi ở máy họ không. |
| **Bài này bạn gõ gì** | Đóng gói chỉ phần dùng chung, quét mật khẩu trong gói, rồi giải nén ra chỗ sạch chạy thử. |
| **Xong thì được gì** | Có một bản phát hành đã chạy thử được thật, kèm ghi chú cái gì thay đổi. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Năm việc:

1. Đánh số phiên bản và viết ghi chú đổi gì (20 phút).
2. Đóng gói **sạch**: loại tầng dự án, quét secret trong gói (35 phút).
3. Nghiệm thu gói. Bước quan trọng nhất, và bước hay bị bỏ nhất (40 phút).
4. Đưa bản mới sang dự án khác thế nào (25 phút).
5. Viết README mà người mới đọc là chạy được (30 phút).

---

## Việc 1 — Kit cũng có phiên bản (20 phút)

Kit là code. Code có phiên bản. Không có số phiên bản thì ba câu sau không trả lời được:

| Câu hỏi | Không có version thì |
|---|---|
| Dự án B đang dùng bản nào? | "bản tôi copy hồi tháng 6" |
| Gate mới có ở bản đó chưa? | phải đi so từng tệp |
| Bản mới có phá gì không? | không biết, vì không có ghi chú |

Quy ước đơn giản, đủ dùng:

| Đổi gì | Tăng | Ví dụ |
|---|---|---|
| Gate mới chặn thêm thứ trước đây cho qua | **major** | thêm `gate-mo-rong` ⇒ mọi task đang chạy có thể đỏ |
| Thêm máy/lệnh mà không đổi hành vi cũ | minor | thêm `sinh-dashboard.js` |
| Sửa lỗi, sửa chữ, chỉnh ngưỡng nhỏ | patch | sửa regex bắt oan |

> Gate siết chặt hơn = major. Nghe hơi nặng, nhưng đúng: nó **phá** quy trình đang chạy của người khác.
> Nếu bạn không đánh dấu, họ cập nhật rồi mọi task đỏ và không hiểu vì sao.

`CHANGELOG.md`:

```markdown
# Changelog

## 3.0.0 — 2026-09-08
### PHÁ (đọc trước khi nâng cấp)
- `gate-mo-rong` chặn phát hiện mở rộng có `PASS`/`FAIL` mà không `oracleRef`.
  **Ảnh hưởng:** task đang chạy có `mo-rong.json` cũ sẽ ĐỎ.
  **Cách xử lý:** hạ những phát hiện không neo được xuống `OBSERVATION`.
- `kiem-mcp-quyen` chặn server có quyền ghi mà không ai duyệt.
  **Ảnh hưởng:** repo chưa có `mcp_config.md` sẽ ĐỎ ở CI.
  **Cách xử lý:** tạo file theo mẫu Bài 20.

### Thêm
- `sinh-dashboard.js` — 3 đường xu hướng, tự chứa, tự kiểm 0 host ngoài.
- `sao-luu-knowledge.js` — từ chối đích sao lưu nằm trong repo.

### Sửa
- `kiem-file-cam` không còn bắt oan `profiles/task.env.example`.
```

Ba điều làm changelog này dùng được, và cả ba thường thiếu:

1. Khối PHÁ đứng đầu. Người đọc cần biết cái này trước khi quyết nâng cấp.
2. Mỗi mục phá có **Ảnh hưởng** + Cách xử lý. Không có cách xử lý thì đó là thông báo, không phải hướng dẫn.
3. Viết cho người nâng cấp, không phải cho người viết code.

## Việc 2 — Đóng gói sạch (35 phút)

Gói phát hành phải chứa **tầng chung**, và tuyệt đối không chứa tầng dự án.

```js
#!/usr/bin/env node
/*
 * dong-goi.js — tạo gói phát hành CHỈ gồm tầng chung, và quét secret TRONG GÓI.
 *
 * VÌ SAO QUÉT LẠI TRONG GÓI, DÙ ĐÃ CÓ quet-secret Ở CI: quet-secret quét file ĐANG TRACK.
 * Gói lại được tạo từ ĐĨA, nên nó gom cả file chưa track — gồm .env và các tệp task.env
 * trong profiles đang nằm ngay đó. Hai phép quét, hai tập file khác nhau;
 * bỏ cái thứ hai là rò rỉ thật.
 *
 * Mã thoát: 0 = đóng gói xong · 1 = phát hiện secret / lỗi ghi · 2 = cấu hình sai
 */
'use strict';
const fs = require('fs');
const path = require('path');

/* Tầng CHUNG — mang đi được mọi dự án. */
const GOM = [
  'package.json', 'playwright.config.js', 'CLAUDE.md', 'LUAT-DAY-DU.md', 'README.md', 'CHANGELOG.md',
  '.gitignore', '.agent/rules', '.agent/skills', '.agent/workflows', '.claude/commands',
  'prompt_templates', 'scripts/lib', 'scripts/qa', 'scripts/utils', 'tests/support', '.github/workflows'
];

/* Tầng DỰ ÁN + dữ liệu — KHÔNG bao giờ vào gói. Khai TƯỜNG MINH, không đoán theo tên. */
const LOAI = [
  /^knowledge\//, /^outputs\//, /^profiles\/[^/]+\/task\.env$/, /^node_modules\//,
  /^test-results\//, /^playwright-report\//, /(^|\/)\.env($|\.)/, /^\.git\//,
  /^tests\/(e2e|api|smoke)\//                 // test của DỰ ÁN, không phải hạ tầng
];
/* Ngoại lệ: bản mẫu không có giá trị thật thì PHẢI đi theo, để người nhận biết cần khai gì. */
const GIU_LAI = [/^profiles\/task\.env\.example$/];

const RA = process.argv[2] || 'dist';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!pkg.version) { console.error('[dong-goi] KHÔNG ĐO ĐƯỢC: package.json thiếu "version"'); process.exit(2); }
if (!fs.existsSync('CHANGELOG.md')) { console.error('[dong-goi] KHÔNG ĐO ĐƯỢC: thiếu CHANGELOG.md'); process.exit(2); }
if (!fs.readFileSync('CHANGELOG.md', 'utf8').includes(pkg.version)) {
  console.error(`[dong-goi] CHẶN: CHANGELOG.md không có mục cho phiên bản ${pkg.version}.`);
  console.error('  Phát hành mà không ghi đổi gì thì người nâng cấp phải tự đoán.');
  process.exit(1);
}

const dich = path.join(RA, `kit-${pkg.version}`);
fs.rmSync(dich, { recursive: true, force: true });
fs.mkdirSync(dich, { recursive: true });

function nen(rel) { return rel.split(path.sep).join('/'); }
function biLoai(rel) {
  const r = nen(rel);
  if (GIU_LAI.some((x) => x.test(r))) return false;
  return LOAI.some((x) => x.test(r));
}

const daChep = [];
function chep(rel) {
  if (biLoai(rel)) return;
  const tu = path.resolve(rel);
  if (!fs.existsSync(tu)) return;
  const st = fs.statSync(tu);
  if (st.isDirectory()) {
    for (const e of fs.readdirSync(tu)) chep(path.join(rel, e));
    return;
  }
  const den = path.join(dich, rel);
  fs.mkdirSync(path.dirname(den), { recursive: true });
  fs.copyFileSync(tu, den);
  daChep.push(nen(rel));
}
for (const g of GOM) chep(g);
chep('profiles/task.env.example');

/* Quét secret TRONG GÓI — tập file khác với quet-secret ở CI. */
const MAU_SECRET = [
  { re: /(?:token|secret|password|passwd|api[_-]?key)\s*[:=]\s*['"][^'"\s]{8,}/i, ten: 'gán token/mật khẩu' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, ten: 'khoá riêng' },
  { re: /"private_key"\s*:/, ten: 'service account JSON' },
  { re: /\bBearer\s+[A-Za-z0-9._-]{20,}/, ten: 'Bearer token' },
  { re: /(postgres|mysql|mongodb)(\+srv)?:\/\/[^\s:]+:[^\s@]+@/i, ten: 'chuỗi kết nối có mật khẩu' }
];
const dinh = [];
for (const rel of daChep) {
  if (!/\.(js|ts|json|md|ya?ml|txt|env|example|sh)$/i.test(rel)) continue;
  const noi = fs.readFileSync(path.join(dich, rel), 'utf8');
  for (const m of MAU_SECRET) {
    if (m.re.test(noi)) dinh.push(`${rel}: nghi có ${m.ten}`);
  }
}
if (dinh.length) {
  fs.rmSync(dich, { recursive: true, force: true });          // XOÁ gói, đừng để nó nằm đó
  console.error(`[dong-goi] ✗ CHẶN — ${dinh.length} chỗ nghi có secret TRONG GÓI:`);
  for (const d of dinh) console.error('  - ' + d);
  console.error('\nĐã xoá gói. Sửa nguồn rồi đóng lại — đừng sửa trong gói.');
  process.exit(1);
}

const ke = { version: pkg.version, ngay: new Date().toISOString(), soTep: daChep.length };
fs.writeFileSync(path.join(dich, '_ban-ke.json'), JSON.stringify(ke, null, 2));

console.log(`[dong-goi] ✓ ${daChep.length} tệp → ${dich}`);
console.log('  BƯỚC BẮT BUỘC TIẾP THEO: npm run nghiem-thu-goi — gói chưa nghiệm thu KHÔNG phải bản phát hành.');
```

Hai chi tiết đáng chú ý:

| Chi tiết | Vì sao |
|---|---|
| Quét secret **lại**, dù CI đã quét | `quet-secret` quét file **đang track**; gói tạo từ **đĩa**, gom cả file chưa track — `.env` và `task.env` đang nằm ngay đó |
| Phát hiện secret thì **xoá gói** | để gói lại đó là để ai đó gửi nhầm nó đi |

## Việc 3 — Nghiệm thu gói (40 phút)

> Bước quan trọng nhất của bài này, và là bước gần như ai cũng bỏ.

Gói chưa từng được giải nén và chạy thử thì bạn **không biết** nó chạy được. Và cách duy nhất để biết là làm
đúng những gì người nhận sẽ làm: thư mục sạch, cài lại, chạy gate.

```js
#!/usr/bin/env node
/*
 * nghiem-thu-goi.js — chứng minh bản phát hành THẬT SỰ chạy được.
 *
 * Làm đúng những gì người nhận làm: copy sang thư mục sạch NGOÀI repo → npm ci → chạy gate.
 *
 * BẪY THẬT ĐÃ VẤP: kit dùng `git ls-files` ở vài chỗ. Thư mục giải nén KHÔNG có .git, nên
 * những máy đó CRASH — mà ở repo gốc thì luôn xanh. Không nghiệm thu ở thư mục sạch thì
 * lỗi này chỉ lộ ra ở máy người nhận, trong ngày đầu họ dùng kit.
 *
 * Mã thoát: 0 = gói chạy được · 1 = gói hỏng · 2 = không đo được
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const goi = process.argv[2];
if (!goi || !fs.existsSync(goi)) {
  console.error('Dùng: node scripts/qa/nghiem-thu-goi.js dist/kit-<version>');
  process.exit(2);
}

/* Thư mục sạch NGOÀI repo — trong repo thì nó thừa hưởng .git và node_modules của repo,
   và phép nghiệm thu mất hết ý nghĩa. */
const san = fs.mkdtempSync(path.join(os.tmpdir(), 'nghiem-thu-kit-'));
console.log(`[nghiem-thu] sân sạch: ${san}`);

function chep(tu, den) {
  fs.mkdirSync(den, { recursive: true });
  for (const e of fs.readdirSync(tu, { withFileTypes: true })) {
    const a = path.join(tu, e.name), b = path.join(den, e.name);
    if (e.isDirectory()) chep(a, b); else fs.copyFileSync(a, b);
  }
}
chep(goi, san);

/* Kiểm những thứ KHÔNG được có mặt — làm trước khi cài, cho rẻ. */
const camCo = ['knowledge', 'outputs', '.env', '.git', 'node_modules'];
const loMat = camCo.filter((f) => fs.existsSync(path.join(san, f)));
if (loMat.length) {
  console.error(`[nghiem-thu] ✗ gói chứa thứ KHÔNG được có: ${loMat.join(', ')}`);
  process.exit(1);
}

function chay(nhan, lenh, args) {
  process.stdout.write(`  ${nhan.padEnd(26)}`);
  const r = spawnSync(lenh, args, { cwd: san, encoding: 'utf8', shell: process.platform === 'win32' });
  const ok = r.status === 0;
  console.log(ok ? '✓' : '✗ (mã ' + r.status + ')');
  if (!ok) {
    const ra = ((r.stdout || '') + (r.stderr || '')).split('\n').filter(Boolean).slice(-12);
    for (const d of ra) console.error('      ' + d);
  }
  return ok;
}

console.log('\n[nghiem-thu] chạy như người nhận:');
let dat = true;
dat = chay('npm ci', 'npm', ['ci', '--no-audit', '--no-fund']) && dat;

/* Gate hạng "mọi commit" — đây là tập KHÔNG cần môi trường ngoài, nên chạy được ở sân sạch.
   Đọc từ ci_scope.json để khỏi liệt kê hai nơi (Bài 20). */
let gates = [];
const scopeFile = path.join(san, '.agent', 'config', 'ci_scope.json');
if (fs.existsSync(scopeFile)) {
  const sc = JSON.parse(fs.readFileSync(scopeFile, 'utf8'));
  gates = ((sc.moiCommit || {}).lenh || []).map((l) => (l.match(/npm run ([\w:-]+)/) || [])[1]).filter(Boolean);
}
if (!gates.length) {
  console.error('[nghiem-thu] KHÔNG ĐO ĐƯỢC: không đọc được hạng moiCommit trong ci_scope.json');
  process.exit(2);
}
for (const g of gates) dat = chay('npm run ' + g, 'npm', ['run', g]) && dat;

console.log('');
if (!dat) {
  console.error('[nghiem-thu] ✗ GÓI HỎNG — đừng phát hành.');
  console.error(`  Sân kiểm còn ở: ${san}  (vào đó chạy tay để tìm nguyên nhân)`);
  console.error('  Lỗi hay gặp nhất: máy nào đó gọi `git ls-files` — thư mục giải nén KHÔNG có .git.');
  process.exit(1);
}
fs.rmSync(san, { recursive: true, force: true });
console.log('[nghiem-thu] ✓ gói chạy được ở thư mục sạch. ĐƯỢC phát hành.');
```

### Bẫy thật: thiếu `.git`

Bẫy này đã cắn thật, và nó là lý do bước nghiệm thu tồn tại:

> `kiem-file-cam.js` (Bài 2) chạy `git ls-files`. Ở repo gốc luôn xanh. Ở thư mục giải nén **không có `.git`**
> ⇒ lệnh lỗi ⇒ máy crash.

Điều tệ nhất không phải là crash. Là **nơi** nó crash: trên máy người nhận, trong ngày đầu tiên họ thử kit —
đúng lúc họ đang quyết định có tin kit này không.

Bản `kiem-file-cam.js` ở Bài 2 đã xử đúng: nó bắt lỗi và trả mã 2 — KHÔNG ĐO ĐƯỢC, không crash. Đây là
ví dụ rõ nhất trong cả tài liệu này cho luật *KHÔNG ĐO ĐƯỢC ≠ VI PHẠM* (Bài 14): "không phải repo git" là *chưa đo
được*, không phải *có tệp cấm*.

### Chạy thử

```bash
npm version minor          # tăng version, tạo tag
# viết mục mới trong CHANGELOG.md TRƯỚC khi đóng gói
npm run dong-goi
npm run nghiem-thu-goi -- dist/kit-3.1.0
```

**Bạn sẽ thấy:**

```
[nghiem-thu] sân sạch: /tmp/nghiem-thu-kit-a1b2c3

[nghiem-thu] chạy như người nhận:
  npm ci                    ✓
  npm run json:check        ✓
  npm run quet-secret       ✓
  npm run kiem:file-cam     ✓
  npm run gates:kiem ✓

[nghiem-thu] ✓ gói chạy được ở thư mục sạch. ĐƯỢC phát hành.
```

Nếu có `✗`, sân kiểm được giữ lại để bạn vào đó tìm nguyên nhân, đó là cố ý.

## Việc 4 — Đưa bản mới sang dự án khác (25 phút)

Dự án B đang dùng kit `2.4.0`, bạn phát hành `3.0.0`. Quy trình:

| Bước | Làm gì | Vì sao |
|---|---|---|
| 1 | Đọc khối **PHÁ** trong changelog | biết cái gì sẽ đỏ trước khi nó đỏ |
| 2 | Nâng cấp trên **một nhánh**, không phải `main` | task đang chạy không bị ảnh hưởng |
| 3 | Chép đè chỉ tầng chung | tầng dự án của B là của B |
| 4 | Chạy `npm run gates` | đỏ ở đây là **kỳ vọng** nếu changelog đã báo |
| 5 | Xử lý từng mục PHÁ theo *Cách xử lý* | |
| 6 | Chạy lại một task **đã xong** trên kit mới | đối chứng: kết quả cũ có tái hiện được không |

Bước 6 là đối chứng của cả quy trình, và nó rẻ: task đã xong thì bạn **biết trước** kết quả đúng phải là gì.
Ra khác ⇒ kit mới đổi hành vi ngoài dự kiến.

> Đừng chép đè cả thư mục kit. Bạn sẽ xoá mất `chieu-phu.json`, `risk_model.json`, `mutants.json`
> của dự án B — tức toàn bộ phần B đã tự chỉnh. Bài 29 dựng ranh giới này thành máy kiểm.

Gói đã nghiệm thu được rồi. Còn một thứ nữa quyết định kit của bạn có được ai dùng hay không, và nó
không phải code.

## Việc 5 — README mà người mới đọc là chạy được (30 phút)

Đây là thứ quyết định kit của bạn có được ai dùng hay không. Cấu trúc đã chứng minh hiệu quả:

```markdown
# <Tên kit>

Bộ kiểm thử có máy-chặn cho <dự án>. Agent AI sinh testcase và chạy test; **máy** quyết định
kết quả có được chấp nhận không.

## Chạy trong 5 phút

```bash
git clone <repo> && cd <repo>
npm ci
npx playwright install chromium
cp profiles/task.env.example profiles/DEMO-1/task.env   # điền URL + tài khoản
npm run gates                                            # phải ĐẠT hết trước khi làm gì
```

## Ba điều phải biết trước khi sửa gì

1. **Excel/testcase canonical là nguồn duy nhất.** Mọi tầng khác PARSE từ nó, không copy.
2. **Output của bạn bị máy kiểm.** Sai chuẩn = chặn. Xem `npm run gates:list`.
3. **"Không phán được" KHÔNG thành PASS.** Xem `.agent/config/phan-quyet.json`.

## Vòng làm việc

| Giai đoạn | Lệnh | Ra gì |
|---|---|---|
| Sinh testcase | `/phase1 <KEY>` | Excel canonical + kiểm cấu trúc |
| Publish | `npm run tms:publish -- --apply --qa-approved` | case trên công cụ + đối soát trường |
| Execute | `/phase2 <KEY>` | kết quả + bằng chứng + verdict |
| Đẩy kết quả | `npm run tms:push-exec -- --apply` | cycle có lịch sử |
| Log bug | `npm run bug:report -- --task <KEY>` | bug có tầng lỗi + bằng chứng |

## Danh mục máy

`npm run gates:list` — sinh tự động, KHÔNG viết tay. Nó nói mỗi máy CHẶN gì.

## Khi gate chặn bạn

Đọc thông báo. Nó nói **luật nào** và **sửa ở đâu**. Nếu bạn tin gate sai:

1. Tái hiện bằng một trường hợp nhỏ nhất.
2. **Sửa luật**, đừng thêm ngoại lệ cho riêng mình.
3. Thêm đối chứng âm để lần sau không tái phạm.

Gate bắt oan thì gate mất uy tín, và đó là cách một kit chết.

## Đo bộ kiểm

`npm run mutation` — tiêm lỗi có kiểm soát và đếm suite có bắt được không.
Chạy hàng tháng. Điểm tụt = có oracle vừa bị làm yếu đi.
```

Ba đặc điểm của README này đáng chép lại:

1. Lệnh chạy được ở dòng đầu, không phải triết lý.
2. Ba điều phải biết, không phải ba mươi.
3. Mục "khi gate chặn bạn", vì đó là trải nghiệm đầu tiên của người mới, và nếu nó khó chịu thì họ sẽ đi
   tìm cách vô hiệu gate.

---

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Bản phát hành** | Một gói có số phiên bản, có ghi chú đổi gì, và đã được nghiệm thu |
| **Nghiệm thu gói** | Giải nén ra thư mục sạch → cài lại → chạy gate. Đạt mới gọi là phát hành được |
| **Tầng chung / tầng dự án** | Cái mang đi được mọi nơi / cái chỉ đúng với dự án này |

## Cây thư mục sau bài này

```
kit-cua-toi/
├── CHANGELOG.md                      ← MỚI · khối PHÁ đứng đầu, mỗi mục có Ảnh hưởng + Cách xử lý
├── scripts/qa/
│   ├── dong-goi.js                   ← MỚI · chỉ tầng chung + quét secret TRONG GÓI, dính thì XOÁ gói
│   └── nghiem-thu-goi.js             ← MỚI · sân sạch ngoài repo → npm ci → gate hạng mọiCommit
└── dist/                             ← MỚI · ⛔ KHÔNG commit
    └── kit-<version>/
        └── _ban-ke.json              ·  version · ngày · số tệp
```

Nhớ thêm `dist/` vào `.gitignore`, nó là artifact, sinh lại được từ mã nguồn.

## Bộ kit của bạn đang ở đâu

```
CẤP ĐỘ 4 · EVOLVE      bài 8/9 của cấp độ này
█████████████████████████░░░

cả tài liệu           bài 28/29
███████████████████████████░
```

**Hết cấp độ 4 bạn nói được:** Tôi mở rộng, đo được độ tin cậy, tích luỹ learning và chứng minh reuse.

Cấp độ này còn 1 bài nữa.

## Tự kiểm

1. Gate siết chặt hơn là major hay minor? Vì sao?
2. Ba thứ làm một changelog dùng được, kể ra.
3. Vì sao phải quét secret **lại** trong gói, dù CI đã có `quet-secret`?
4. Phát hiện secret trong gói ⇒ vì sao **xoá gói** chứ không chỉ báo?
5. Vì sao sân nghiệm thu phải nằm **ngoài** repo?
6. Bẫy thiếu `.git`. Nó cắn ở đâu, và vì sao **nơi** nó cắn mới là điều tệ nhất?
7. Máy gặp "không phải repo git" thì trả mã mấy? Vì sao không phải mã 1?
8. Bước 6 khi nâng cấp dự án khác là gì, và vì sao nó là đối chứng rẻ?

## Bài tập về nhà (30 phút)

1. Đóng gói kit của bạn. Nghiệm thu. Nếu đỏ. Đây là thu hoạch chính: ghi lại lỗi, nó sẽ cắn người nhận
   đầu tiên nếu bạn không sửa.
2. Cố tình làm gói hỏng theo hai cách, và kiểm máy bắt được:
   - thêm một dòng `TEST_PASS: "mat-khau-that-gia"` vào một tệp trong tầng chung ⇒ `dong-goi` phải **chặn và
     xoá gói**;
   - thêm một máy có `execSync('git rev-parse')` không bọc try/catch ⇒ `nghiem-thu-goi` phải **đỏ**.
3. Viết mục `CHANGELOG.md` cho bản hiện tại. Nếu có mục PHÁ, viết đủ **Ảnh hưởng** và Cách xử lý. Không
   viết nổi cách xử lý thì bạn chưa nên phát hành thay đổi đó.

## Đọc thêm

- Bài 20 — [CI](ci-cd.md): hạng `moiCommit` mà nghiệm thu gói chạy lại, và luật một-nguồn cho CI.
- Bài 29 — mang kit sang dự án mới: ranh giới tầng chung ↔ tầng dự án, dựng thành máy kiểm.
- Bài 2 — [Git](git-tu-so-0.md): `kiem-file-cam.js` và cách nó trả mã 2 thay vì crash khi thiếu `.git`.

## Bài sau

Bài 29 là bài chứng minh. Bạn mang chính bộ kit vừa đóng gói sang một dự án chưa từng chạm vào, và
đếm xem phải sửa bao nhiêu file.
