# Khi kit chặn sai

> **2 giờ** · Có gì trong tay: bộ gate nền đang chạy · Sau bài này: máy canh chính hệ thống luật và gate của bạn

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Gate báo đỏ nhưng bạn thấy code mình đúng. Nới ngưỡng cho qua thì lần sau nó chẳng chặn được gì nữa. |
| **Bài này bạn gõ gì** | Viết máy dò luật bị trôi khỏi tài liệu, và danh sách miễn trừ bắt buộc ghi lý do kèm ngày. |
| **Xong thì được gì** | Biết khi nào sửa gate, khi nào ghi miễn trừ. Và gate của bạn không mất uy tín. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Trôi** | Hai bản của cùng một luật dần nói khác nhau, mà không ai để ý |
| **Máy mồ côi** | Máy chặn viết xong, đúng, nhưng không ai gọi nên không bao giờ chạy |
| **Miễn trừ** | Chỗ cố ý cho qua. Phải ghi lý do và ngày, nếu không nó thành chỗ giấu nợ |

## Bài này bạn sẽ làm gì

Bốn việc:

1. Hiểu vì sao gate bắt oan nguy hiểm hơn không có gate (20 phút).
2. Viết máy dò luật bị trôi khỏi các bề mặt của kit (35 phút).
3. Viết máy tìm gate mồ côi, và danh mục gate tự sinh (30 phút).
4. Làm danh sách miễn trừ có kỷ luật: bắt buộc có lý do và ngày (25 phút).

---

## 1. Vấn đề mới xuất hiện ở Bài 14

Bạn vừa có 5 gate. Bây giờ có ba câu hỏi mà không cách nào trả lời:

1. Kit của tôi có bao nhiêu gate, và mỗi cái **chặn** gì?
2. Gate nào đã mất nơi gọi. Tồn tại nhưng không ai chạy?
3. Gate nào đã âm thầm tụt từ chặn xuống cảnh báo?

Ba câu này nghe như chuyện tiện lợi. Không phải:

> Luận đề của cả bộ kit là "luật cần máy". Nhưng máy mà không liệt kê được thì không kiểm toán được
> — và một cơ chế không kiểm toán được thì bạn không biết nó còn hoạt động hay không.

Nới một gate là sửa **một dòng**: `process.exit(1)` thành `process.exit(0)`. Không có ai để ý. Sáu tháng sau
bạn vẫn tin mình có 5 gate chặn, thực tế còn 2.

## 2. Canonical và bản tóm

Bài 5 bạn tạo hai file nói cùng một luật ở hai độ chi tiết: `CLAUDE.md` (ngắn, luôn trong ngữ cảnh) và
`LUAT-DAY-DU.md` (dài, tra khi cần). Đó là **cố ý** — và nó tạo rủi ro thật.

| | Canonical | Bản tóm |
|---|---|---|
| Vai trò | **Nguồn quyết** khi mâu thuẫn | Đọc nhanh, luôn hiện diện |
| Được phép | Dài, đủ mọi ngoại lệ | **Diễn đạt lại** cho gọn |
| Không được phép | — | **Nói khác** canonical |
| Bắt buộc | — | Khai rõ ai là canonical |

Điểm mấu chốt, và nó ngược với phản xạ thông thường:

> Đừng bắt bản tóm trùng từng chữ với canonical. Nếu trùng từng chữ thì nó mất lý do tồn tại, người ta
> đã có thể đọc canonical rồi. Bản tóm được phép diễn đạt lại; điều phải ép là quy ước chống trôi.

Nên gate không so văn bản. Nó kiểm ba quy ước:

1. Bản tóm **khai rõ** ai là canonical.
2. Mọi tài liệu luật có đường vào từ một điểm vào nào đó.
3. Mọi lệnh gate có nơi nhắc tới.

## 3. Gate chống mồ côi

Đây là gate quan trọng nhất của bài, vì nó bắt một lớp lỗi mà bạn không thể tự phát hiện bằng mắt.

Chuyện thật ở kit này, và con số đủ để giật mình:

> Quét mọi lệnh xuất hiện trong tầng workflow rồi đối chiếu với các điểm vào: **11 lệnh gate chỉ tồn tại ở
> tầng workflow, mà điểm vào không trỏ tới workflow nào. Nghĩa là ai làm đúng** theo điểm vào thì
> không bao giờ chạy chúng. Trong đó có cả lệnh tự soi trước khi kết thúc và lệnh kiểm input trước khi
> chạy phase.

Chúng không hỏng. Chúng chỉ không được gọi. Và không có cách nào biết bằng cách đọc.

`scripts/qa/chong-troi.js`:

```js
#!/usr/bin/env node
/*
 * chong-troi.js — canh chính HỆ THỐNG LUẬT: một nguồn, không mồ côi.
 *
 * VÌ SAO CÓ FILE NÀY: gate ở Bài 14 canh CÔNG VIỆC. File này canh chính BỘ MÁY CANH. Đo thật ở một kit:
 * 11 lệnh gate chỉ nằm ở tầng workflow mà điểm vào không trỏ tới ⇒ ai làm đúng quy trình thì không bao giờ
 * chạy chúng. Không đọc bằng mắt mà thấy được.
 *
 * KHÔNG kiểm trùng-văn-bản giữa canonical và bản tóm — bản tóm được phép diễn đạt lại. Chỉ ép QUY ƯỚC.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { ketQua, khongDoDuoc, ketThuc, fileDangTrack } = require('./lib/gate');

const GATE = 'policy-check';
const ROOT = process.cwd();
const CANONICAL = 'LUAT-DAY-DU.md';
const BAN_TOM = ['CLAUDE.md', '.agent/rules/core_rules.md'];
const DIEM_VAO_DIR = 'prompt_templates';
const ALLOW_FILE = '.agent/config/policy-check.allow.json';

const doc = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const co = (p) => fs.existsSync(path.join(ROOT, p));

if (!co(CANONICAL)) khongDoDuoc(GATE, `thiếu file canonical ${CANONICAL}`);

/* ── Allowlist: miễn trừ CÓ LÝ DO. Khối lạ bị CHẶN — khoá viết sai thì vô hình với code. ── */
const KHOI_HOP_LE = ['_note', 'npmScripts', 'files'];
let allow = { npmScripts: {}, files: {} };
if (co(ALLOW_FILE)) {
  let raw;
  try { raw = JSON.parse(doc(ALLOW_FILE)); }
  catch (e) { khongDoDuoc(GATE, `allowlist không parse được — ${e.message}`); }
  for (const k of Object.keys(raw)) {
    if (!KHOI_HOP_LE.includes(k)) {
      console.error(`[${GATE}] ✗ allowlist có khối lạ "${k}" — code KHÔNG đọc khối này. ` +
        'Sửa tên hoặc bỏ đi, đừng để nó vô hình.');
      process.exit(1);
    }
  }
  for (const blk of ['npmScripts', 'files']) allow[blk] = raw[blk] || {};
}

const kq = ketQua(GATE);

/* ── Quy ước 1: bản tóm phải khai rõ ai là canonical ── */
for (const f of BAN_TOM) {
  if (!co(f)) continue;
  if (!doc(f).includes(CANONICAL)) {
    kq.viPham.push(`${f} là bản tóm nhưng KHÔNG khai ${CANONICAL} là canonical — ` +
      'người đọc không biết tin file nào khi hai bên nói khác nhau.');
  }
}

/* ── Quy ước 2: mọi npm script phải có NƠI NHẮC TỚI ── */
const pkg = JSON.parse(doc('package.json'));
const lenh = Object.keys(pkg.scripts || {});

const files = fileDangTrack(ROOT);
if (files === null) khongDoDuoc(GATE, 'không có .git nên không biết file nào đang được track');

// Gom mọi chữ trong tài liệu, prompt, workflow, rule và CI — nơi một lệnh CÓ THỂ được nhắc tới.
const NOI_NHAC = files.filter((f) =>
  /\.(md|ya?ml)$/.test(f) && !f.startsWith('node_modules/'));
const chuTatCa = NOI_NHAC.map((f) => { try { return doc(f); } catch (e) { return ''; } }).join('\n');

for (const l of lenh) {
  if (allow.npmScripts[l]) continue;
  // Nhắc qua `npm run <tên>` HOẶC qua đường dẫn file mà script đó gọi (bí danh).
  const duongDan = String(pkg.scripts[l]).match(/scripts\/[\w./-]+\.js/);
  const duocNhac = chuTatCa.includes('npm run ' + l) ||
                   (duongDan && chuTatCa.includes(duongDan[0]));
  if (!duocNhac) {
    kq.viPham.push(`npm script "${l}" KHÔNG nơi nào nhắc tới ⇒ sẽ không ai chạy, ` +
      'và thứ nó gác sẽ lặng lẽ không xảy ra. Trỏ nó từ một điểm vào, hoặc xoá nếu hết dùng.');
  }
}

/* ── Quy ước 3: mọi tài liệu luật phải có đường vào ── */
if (co('.agent/rules')) {
  for (const f of fs.readdirSync(path.join(ROOT, '.agent/rules')).filter((x) => x.endsWith('.md'))) {
    const rel = '.agent/rules/' + f;
    if (allow.files[rel] || BAN_TOM.includes(rel)) continue;
    if (!chuTatCa.includes(rel) && !chuTatCa.includes(f)) {
      kq.viPham.push(`${rel} MỒ CÔI — không tài liệu nào dẫn tới nó, nên sẽ không ai đọc.`);
    }
  }
}

/* ── Miễn trừ đã mục thì phải dọn, nếu không allowlist thành rác ── */
for (const l of Object.keys(allow.npmScripts)) {
  if (!lenh.includes(l)) kq.viPham.push(`allowlist npmScripts."${l}" trỏ tới lệnh KHÔNG còn tồn tại — dọn đi.`);
  if (!String(allow.npmScripts[l] || '').trim()) {
    kq.viPham.push(`allowlist npmScripts."${l}" không ghi lý do — miễn trừ không lý do là chỗ giấu nợ.`);
  }
}

kq.daKiem = `${lenh.length} npm script · ${BAN_TOM.length} bản tóm · ${NOI_NHAC.length} file có thể nhắc tới`;
ketThuc(kq);
```

Ba chi tiết đắt giá trong đoạn trên:

| Chi tiết | Vì sao |
|---|---|
| Phân giải **bí danh** qua `package.json` | `npm run trace:matrix` và `node scripts/qa/traceability_matrix.js` là một thứ. Không phân giải thì cùng một gate viết hai kiểu sẽ báo thiếu oan — đo thật: **2/4 "thiếu"** ban đầu chỉ là bí danh |
| Allowlist chặn khối lạ | Viết `npmScript` thiếu chữ `s` thì code không đọc, miễn trừ **vô hình**, và bạn tưởng đã khai |
| Miễn trừ trỏ tới thứ không còn tồn tại cũng bị chặn | Không dọn thì allowlist phình thành rác, rồi thành chỗ giấu nợ thật |

`.agent/config/policy-check.allow.json`:

```json
{
  "_note": "Miễn trừ cho chong-troi. Mỗi miễn trừ BẮT BUỘC ghi lý do — để trống là gate chặn. Khối lạ cũng bị chặn.",
  "npmScripts": {
    "lint": "lệnh dev chung của toàn repo, không phải gate cần điểm vào",
    "typecheck": "lệnh dev chung"
  },
  "files": {}
}
```

## 4. Danh mục máy tự sinh

Câu 1 và câu 3 ở mục 1 cần một danh mục. Và danh mục đó phải sinh từ source, không viết tay. Viết tay
thì nó mục ngay tuần sau.

Mẹo hay: suy mức chặn từ chính mã. Gate có `process.exit(1)` là CHẶN; chỉ ghi file là SINH; chỉ
in ra là **BÁO CÁO**.

`scripts/qa/danh-muc-gate.js`:

```js
#!/usr/bin/env node
/*
 * danh-muc-gate.js — sinh DANH MỤC GATE từ chính source. Có --check để chặn khi bảng lệch.
 *
 * VÌ SAO CẦN: cột "Mức" (CHẶN / SINH / BÁO CÁO) là thông tin chưa máy nào ghi, và là chỗ dễ trôi nhất —
 * nới một gate chỉ là sửa MỘT dòng. Bảng viết tay thì mục; bảng sinh từ source thì không thể lệch mà im.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const QA = path.join(ROOT, 'scripts', 'qa');
const OUT = path.join(ROOT, '.agent', 'config', 'GATES.md');
const CHECK = process.argv.includes('--check');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

/** Lệnh npm nào trỏ tới file này (một file có thể có nhiều bí danh). */
function lenhCuaFile(rel) {
  return Object.entries(pkg.scripts || {})
    .filter(([, v]) => String(v).includes(rel)).map(([k]) => '`' + k + '`');
}

/** Mức suy TỪ MÃ, không khai tay. */
function mucDo(src) {
  if (/process\.exit\(\s*1\s*\)/.test(src)) return 'CHẶN';
  if (/writeFileSync|createWriteStream/.test(src)) return 'SINH';
  return 'BÁO CÁO';
}

/** Câu mô tả = dòng đầu tiên của khối comment đầu file, sau tên file. */
function moTa(src) {
  const m = src.match(/^\s*\*?\s*[\w.]+\.js\s*—\s*(.+)$/m);
  return m ? m[1].trim().replace(/\|/g, '\\|') : '(chưa có mô tả ở đầu file)';
}

const rows = [];
for (const f of fs.readdirSync(QA).filter((x) => x.endsWith('.js'))) {
  const rel = 'scripts/qa/' + f;
  const src = fs.readFileSync(path.join(QA, f), 'utf8');
  const cmds = lenhCuaFile(rel);
  rows.push({
    muc: mucDo(src),
    lenh: cmds.length ? cmds.join(', ') : '(không có npm script)',
    moTa: moTa(src),
    file: '`' + rel + '`'
  });
}
const thuTu = { 'CHẶN': 0, 'SINH': 1, 'BÁO CÁO': 2 };
rows.sort((a, b) => thuTu[a.muc] - thuTu[b.muc] || a.lenh.localeCompare(b.lenh));

const dem = (m) => rows.filter((r) => r.muc === m).length;
const md = [
  '# Danh mục GATE của kit',
  '',
  '> **SINH TỰ ĐỘNG** bởi `node scripts/qa/danh-muc-gate.js`. Đừng sửa tay — `--check` sẽ chặn khi bảng',
  '> lệch source. Cột **Mức** suy từ mã: `exit 1` = CHẶN · ghi file = SINH · chỉ in = BÁO CÁO.',
  '',
  `Tổng **${rows.length}** máy — **${dem('CHẶN')} CHẶN** · ${dem('SINH')} SINH · ${dem('BÁO CÁO')} BÁO CÁO.`,
  '',
  'SINH và BÁO CÁO **không phải gate bị nới** — chúng không kiểm vi phạm, chỉ tạo dữ liệu cho máy khác chặn.',
  '',
  '| Mức | npm script | Chặn/kiểm cái gì | File |',
  '|---|---|---|---|',
  ...rows.map((r) => `| ${r.muc} | ${r.lenh} | ${r.moTa} | ${r.file} |`),
  ''
].join('\n');

if (CHECK) {
  const cu = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cu.trim() !== md.trim()) {
    console.error('[gates-index] CHẶN: GATES.md LỆCH source — gate được thêm/xoá, hoặc một gate ' +
      'đã đổi mức CHẶN ↔ CẢNH BÁO mà bảng không ghi. Chạy `node scripts/qa/danh-muc-gate.js` rồi commit.');
    process.exit(1);
  }
  console.log(`[gates-index] OK — ${rows.length} gate, bảng khớp source.`);
  process.exit(0);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, md, 'utf8');
console.log(`[gates-index] đã ghi ${path.relative(ROOT, OUT)} — ${rows.length} gate.`);
```

Thêm vào `package.json`:

```json
"gates:index": "node scripts/qa/danh-muc-gate.js",
"gates:index:check": "node scripts/qa/danh-muc-gate.js --check",
"gate:policy": "node scripts/qa/chong-troi.js"
```

> Cảnh báo từ kinh nghiệm. Khi mới dựng danh mục ở kit này, **bốn "phát hiện" đầu tiên đều là lỗi của
> BẢNG, không của kit** — mô tả trích sai dòng, bí danh không phân giải, mức suy sai vì gate gọi hàm khác
> để thoát. Phải hiệu chuẩn danh mục trước khi tin số nó đưa ra. Đây đúng là nguyên tắc *"máy phải chạy
> trên nội dung thật mới tính là nghiệm thu"* ở Bài 15.

## 5. Allowlist: hai luật không được bỏ

Mọi gate rồi sẽ cần miễn trừ. Hai luật, và cả hai đều đến từ vấp thật:

**Luật 1 — miễn trừ phải ghi lý do.** Không có lý do thì sáu tuần sau không ai biết vì sao nó ở đó, và không
ai dám xoá. Allowlist biến thành chỗ giấu nợ: gate vẫn xanh, nợ vẫn còn, không ai thấy.

**Luật 2 — khối lạ phải bị chặn.** Đây là lớp lỗi im lặng riêng:

```json
{
  "npmScript": { "lint": "lệnh dev chung" }
}
```

Thiếu chữ `s`. Code đọc `npmScripts` nên không thấy gì. Bạn tưởng đã khai miễn trừ; gate vẫn đỏ hoặc —
tệ hơn. Bạn thêm miễn trừ khác cho tới khi nó xanh vì lý do khác. Cách chữa duy nhất là **chặn khối không
nằm trong danh sách hợp lệ**.

Thêm luật thứ ba nếu bạn muốn đi xa hơn: miễn trừ trỏ tới thứ không còn tồn tại cũng bị chặn. Không có
nó thì allowlist chỉ phình lên, không bao giờ co lại.

---

## Thực hành (55 phút)

### Bước 1 — chong-troi (20 phút)

Viết `chong-troi.js` và file allowlist. Chạy `npm run gate:policy`.

Rất có thể nó đỏ ngay lần đầu. Đó là bình thường, và là dấu hiệu tốt. Với mỗi lệnh bị báo mồ côi, quyết
định: nối vào một điểm vào, hay khai miễn trừ kèm lý do? Đừng khai miễn trừ chỉ để cho nó xanh.

> Một lỗi thật trong chính bài học này, để lại vì nó dạy đúng thứ cần dạy. Bản đầu của phép kiểm rule
> mồ côi viết là `if (!chuTatCa.split(rel).length > 1 && …)`. Cú pháp hợp lệ, `node --check` xanh, nhìn qua
> rất hợp lý. Nhưng `!` bám chặt hơn `>` nên nó thành `(!length) > 1` — **luôn `false`**, và phép kiểm đó
> không bao giờ chạy. Một gate xanh vĩnh viễn vì nó không kiểm gì cả.
>
> Bài học: cú pháp đúng không có nghĩa logic đúng, và đây chính là lý do mỗi gate phải có negative
> control ở Bước 2. Không tiêm lỗi thì loại lỗi này sống mãi.

### Bước 2 — Nghiệm thu bằng cách tiêm (10 phút)

```bash
# ① thêm một lệnh không nơi nào nhắc tới → mong đợi exit 1
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));
p.scripts['gate:khong-ai-goi']='node scripts/qa/gate-bang-chung.js';
fs.writeFileSync('package.json',JSON.stringify(p,null,2))"
npm run gate:policy; echo "exit=$?"        # → 1, nêu đúng tên lệnh

# ② allowlist khối viết sai tên → mong đợi exit 1 kèm "khối lạ"
# sửa "npmScripts" thành "npmScript" trong file allowlist rồi chạy lại

# hoàn nguyên cả hai
```

### Bước 3 — Danh mục tự sinh (15 phút)

Viết `danh-muc-gate.js`, chạy `npm run gates:list`, **mở `GATES.md` ra đọc**.

Soi từng dòng. Với mỗi dòng sai. Mô tả trích sai, mức suy sai, bí danh không nhận ra — **sửa `danh-muc-gate`,
không sửa gate**. Đây là bước hiệu chuẩn ở mục 4, và nó là phần đáng giá nhất của bài.

### Bước 4 — Nghiệm thu `--check` (10 phút)

```bash
npm run gates:kiem                  # → 0

# nới một gate: đổi process.exit(1) thành process.exit(0) trong gate-bang-chung.js
npm run gates:kiem; echo "exit=$?"  # → 1, vì mức đổi từ CHẶN sang BÁO CÁO
# hoàn nguyên, chạy lại → 0
```

Mũi tiêm này chính là câu 3 ở mục 1: gate nào đã âm thầm tụt xuống cảnh báo. Giờ bạn có máy trả lời.

### Bước 5 — Commit

```bash
git add scripts/qa .agent/config package.json
git commit -m "feat(gate): chong-troi + danh mục gate tự sinh

chong-troi: bản tóm khai canonical · lệnh mồ côi · rule mồ côi · allowlist có lý do + chặn khối lạ.
danh-muc-gate: sinh GATES.md từ source, mức suy từ mã; --check chặn khi bảng lệch.
Nghiệm thu: lệnh mồ côi → 1 · khối lạ → 1 · nới một gate → --check ra 1."
```

---

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   └── policy.allow.json         ← MỚI · miễn trừ PHẢI có lý do + ngày; khối lạ ⇒ chặn
└── scripts/qa/
    ├── chong-troi.js           ← MỚI · luật bị trôi khỏi bề mặt kit ⇒ chặn
    └── danh-muc-gate.js            ← MỚI · danh mục gate TỰ SINH từ source, không viết tay
```

## Tự kiểm

- [ ] Tôi giải thích được vì sao không bắt bản tóm trùng từng chữ với canonical.
- [ ] `chong-troi` phân giải được **bí danh** qua `package.json`.
- [ ] Allowlist của tôi chặn khối lạ và đòi lý do.
- [ ] Miễn trừ trỏ tới thứ không còn tồn tại cũng bị chặn.
- [ ] `GATES.md` sinh tự động, và cột Mức suy từ mã chứ không khai tay.
- [ ] Tôi đã **hiệu chuẩn** danh mục: soi từng dòng, sửa `danh-muc-gate` cho phần sai.
- [ ] `gates:index:check` đỏ khi tôi nới một gate từ `exit 1` sang `exit 0`.
- [ ] Ba mũi tiêm ở Bước 2 và Bước 4 đều cho mã mong đợi.

## Bài tập về nhà

Nối hai gate mới vào **CI**: `gate:policy` và `gates:index:check` đều chỉ đọc file, không cần môi trường thật,
không cần credentials. Nên chúng thuộc diện chạy được ở mọi lần push. Bài 20 sẽ nói kỹ về ranh giới
"CI dùng chung không được tự chạm môi trường thật", nhưng hai gate này thì an toàn tuyệt đối.

Sau khi nối, thử push một commit cố tình thêm lệnh mồ côi và xác nhận CI đỏ.

## Đọc thêm

- [`.agent/config/GATES.md`](../../.agent/config/GATES.md) của kit này, bảng thật, sinh từ source.
- [`scripts/qa/policy_source_check.js`](../../scripts/qa/policy_source_check.js) — bản đầy đủ, kiểm 5 quy ước
  thay vì 3. Để ý cách nó không bắt trùng văn bản.
- Phần 5 (Bài 26–17) chuyển sang bộ nhớ dự án: làm gì khi chưa có dữ liệu nào.
