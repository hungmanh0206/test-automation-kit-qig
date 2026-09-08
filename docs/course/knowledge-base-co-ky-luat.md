# Bài 18 — Thiết kế knowledge base có kỷ luật

> **2 giờ 30 phút** · Có gì trong tay: knowledge base đã có vài chục bản ghi · Sau bài này: tri thức có phiên bản, truy được nguồn, và không âm thầm dạy sai cho agent

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Một ghi chú sai vào kho là agent tin theo mãi. Càng dùng lại càng trông giống thật. |
| **Bài này bạn gõ gì** | Khai khuôn bắt buộc có nguồn, bốn trạng thái vòng đời, rồi viết gate chặn ngay ở cửa đọc. |
| **Xong thì được gì** | Ghi chú có phiên bản, tra được ai nói, và không âm thầm dạy sai cho agent. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **`source`** | Ai/cái gì khẳng định điều này. Không có thì đây là **phỏng đoán**, không phải tri thức |
| **`supersedes`** | Bản ghi này **thay thế** bản ghi cũ nào |
| **`covered_by`** | Testcase nào đang canh luật này. Dùng để truy **ngược** |
| **`superseded` ≠ `invalid`** | Nghiệp vụ **đổi** (kết quả cũ vẫn đúng lúc đó) ≠ ghi **sai từ đầu** (kết quả cũ mất giá trị) |

## Bài này bạn sẽ làm gì

Bốn việc:

1. Thấy tri thức không có nguồn dạy sai agent thế nào (20 phút).
2. Thiết kế schema: `source` rỗng thì **cấm ghi** (30 phút).
3. Hiểu **4 trạng thái vòng đời**, và khác biệt tinh giữa `superseded` và `invalid` (30 phút).
4. **Xây gate** chống học sai: mâu thuẫn · quá cũ · thiếu nguồn, chạy **trước khi** agent được đọc (40 phút).

---

## Việc 1 — Tri thức không nguồn dạy sai thế nào (20 phút)

Bài 17 dựng kho tri thức. Giờ nó có vài chục bản ghi, và một bản ghi trông thế này:

```json
{ "id": "R-014", "luat": "Phí giao hàng miễn khi tạm tính từ 450.000" }
```

Ai nói `450.000`? Không biết. Nhưng agent sẽ **đọc và tin**. Rồi:

| Hệ quả | Cụ thể |
|---|---|
| Testcase mới sinh ra sai | Kết quả mong đợi lấy mốc `450.000` |
| Case **cũ** đúng bị coi là sai | Agent thấy case ghi `500.000` và "sửa cho khớp tri thức" |
| Không ai truy được | Sáu tháng sau không biết con số đó từ đâu ra để mà bác |

Đây là lớp lỗi tệ nhất của bộ nhớ dự án: **sai một lần, dạy sai mãi mãi**, và mỗi lần dùng lại làm nó có vẻ
đúng thêm.

> Bài 10 dạy: kết luận phải neo được vào tài liệu. Bài này là **cùng luật đó áp cho tri thức**: một bản ghi
> không neo được thì nó là phỏng đoán được cất giữ trang trọng.

## Việc 2 — Schema: `source` rỗng thì cấm ghi (30 phút)

`.agent/config/knowledge-schema.json`:

```json
{
  "$schema": "hình dạng bắt buộc của mọi bản ghi tri thức. Thiếu trường bắt buộc ⇒ CẤM GHI.",
  "batBuoc": ["id", "loai", "noiDung", "source", "trangThai", "ngayGhi", "version"],
  "loai": {
    "domain": "luật nghiệp vụ đã xác nhận",
    "system": "cách hệ thống hoạt động (route, cấu trúc, ràng buộc kỹ thuật)",
    "decision": "quyết định đã chốt và LÝ DO",
    "fixture": "cách dựng một trạng thái dữ liệu",
    "leak": "bug đã lọt ra ngoài + máy nào lẽ ra phải bắt"
  },
  "trangThai": {
    "active": "đang đúng, agent được dùng",
    "superseded": "nghiệp vụ ĐỔI. Kết quả chạy theo bản cũ VẪN có giá trị ở thời điểm đó",
    "invalid": "SAI TỪ ĐẦU. Kết quả chạy theo bản này MẤT giá trị, phải chạy lại",
    "cho-xac-nhan": "đã quá hạn tái xác nhận, chưa ai xác nhận lại"
  },
  "sourceHopLe": [
    { "kieu": "tai-lieu", "canGi": "đường dẫn + mục/mã luật cụ thể" },
    { "kieu": "nguoi", "canGi": "tên + vai trò + ngày" },
    { "kieu": "do-duoc", "canGi": "cách tái hiện — lệnh hoặc bước cụ thể" }
  ],
  "hanTaiXacNhan": { "domain": 180, "system": 90, "decision": 365, "fixture": 90, "leak": 0 }
}
```

Một bản ghi đúng chuẩn:

```json
{
  "id": "R-014",
  "loai": "domain",
  "noiDung": "Phí giao hàng = 0 khi Tạm tính ≥ 500.000; ngược lại 30.000",
  "source": { "kieu": "tai-lieu", "tro": "spec.md § BR-03" },
  "covered_by": ["TC_012", "TC_013"],
  "trangThai": "active",
  "ngayGhi": "2026-09-07",
  "version": 1
}
```

Ba trường đáng nói:

| Trường | Vì sao bắt buộc |
|---|---|
| `source` | Không có thì đây là phỏng đoán. **Đây là trường quan trọng nhất của cả schema** |
| `covered_by` | Truy **ngược**: luật này có case nào canh không? Không có ⇒ luật đang không được kiểm |
| `version` | Đổi nội dung thì tăng version + ghi `supersedes`, **không sửa đè** |

> Không sửa đè. Sửa đè thì bạn mất lịch sử, và mất luôn khả năng trả lời câu *"lượt chạy tháng trước
> dùng luật nào?"* — câu này quyết định kết quả cũ còn giá trị hay không (Việc 3).

### `sourceHopLe` không phải hình thức

Ba kiểu nguồn, mỗi kiểu đòi một thứ khác nhau, và đòi đúng chỗ thì mới truy được:

| Kiểu | Đủ | **Không** đủ |
|---|---|---|
| `tai-lieu` | `spec.md § BR-03` | `"theo tài liệu"` |
| `nguoi` | `"BA Hương, 07/09/2026"` | `"BA xác nhận"` |
| `do-duoc` | `"curl POST /api/quote KH02×2 ⇒ phiGiaoHang=30000"` | `"đã test thấy vậy"` |

Cột phải là những câu **không truy được**, và chúng chiếm phần lớn tri thức viết vội.

## Việc 3 — Bốn trạng thái, và khác biệt tinh (30 phút)

Đây là mục dễ làm sai nhất, và làm sai thì hậu quả rất cụ thể.

```
active ──(nghiệp vụ đổi)──▶ superseded      kết quả cũ VẪN có giá trị
   │
   ├────(phát hiện ghi sai)──▶ invalid       kết quả cũ MẤT giá trị
   │
   └────(quá hạn tái xác nhận)──▶ cho-xac-nhan ──(ai đó xác nhận)──▶ active
```

### `superseded` vs `invalid` — vì sao phải tách

| | `superseded` | `invalid` |
|---|---|---|
| Chuyện gì xảy ra | Nghiệp vụ **đổi** từ ngày X | Bản ghi **sai từ đầu** |
| Ví dụ | Mốc miễn phí đổi từ `500.000` thành `450.000` từ 01/10 | Ai đó ghi `450.000` trong khi spec luôn là `500.000` |
| Kết quả chạy **trước** đó | **vẫn đúng** — lúc đó luật là thế | **mất giá trị** — chạy trên luật sai |
| Phải làm gì | không phải chạy lại | **chạy lại** mọi case liên quan |
| Bug đã log theo nó | vẫn hợp lệ | phải rà lại, có thể phải rút |

Gộp hai trạng thái này thành một là gộp *"không phải chạy lại"* với *"phải chạy lại toàn bộ"* — và bạn sẽ
chọn nhầm cái rẻ.

```json
{
  "id": "R-014", "version": 2,
  "noiDung": "Phí giao hàng = 0 khi Tạm tính ≥ 450.000",
  "source": { "kieu": "nguoi", "tro": "BA Hương, 25/09/2026 — đổi chính sách từ 01/10" },
  "supersedes": "R-014@v1",
  "hieuLucTu": "2026-10-01",
  "trangThai": "active",
  "ngayGhi": "2026-09-25", "covered_by": ["TC_012", "TC_013"]
}
```

Và bản cũ **không xoá**:

```json
{ "id": "R-014", "version": 1, "trangThai": "superseded", "supersededBy": "R-014@v2",
  "noiDung": "Phí giao hàng = 0 khi Tạm tính ≥ 500.000",
  "source": { "kieu": "tai-lieu", "tro": "spec.md § BR-03" },
  "hieuLucTu": "2026-01-01", "hieuLucDen": "2026-09-30",
  "ngayGhi": "2026-09-07", "covered_by": ["TC_012", "TC_013"] }
```

Giữ bản cũ cho phép trả lời: *"lượt chạy 15/09 dùng mốc nào?"* → `500.000`, và kết quả đó **vẫn đúng**.

### Tái xác nhận định kỳ

Tri thức không sai, nó **cũ đi**. `hanTaiXacNhan` trong schema nói mỗi loại sống bao lâu trước khi phải hỏi lại:

| Loại | Hạn | Vì sao |
|---|---|---|
| `system` | 90 ngày | route, cấu trúc đổi nhanh nhất |
| `fixture` | 90 ngày | cách dựng dữ liệu hỏng khi app đổi |
| `domain` | 180 ngày | luật nghiệp vụ chậm hơn |
| `decision` | 365 ngày | quyết định + lý do sống lâu |
| `leak` | 0 (không hết hạn) | bug đã lọt là sự thật lịch sử, không cũ đi |

Quá hạn thì chuyển `cho-xac-nhan` — **không** tự chuyển `invalid`. Quá hạn nghĩa là *"chưa ai kiểm lại"*,
không phải *"đã sai"*. Đây lại đúng luật **KHÔNG ĐO ĐƯỢC ≠ VI PHẠM** của Bài 11.

## Việc 4 — Gate chống học sai (40 phút)

Áp công thức 5 câu hỏi (Bài 8):

| # | | |
|---|---|---|
| 1 | Chặn kiểu sai nào | tri thức không nguồn / mâu thuẫn / quá cũ được agent đọc và tin |
| 2 | Đo cái gì | mọi tệp `knowledge/**/*.json`: đủ trường bắt buộc, `source` hợp lệ, không hai bản `active` mâu thuẫn, không quá hạn mà vẫn `active` |
| 3 | Cửa nào | **trước khi agent được đọc** kho — không phải sau khi nó đã dùng |
| 4 | Không đo được | thư mục `knowledge/` chưa tồn tại ⇒ mã 2 |
| 5 | Đối chứng | thiếu `source` ⇒ chặn · hai bản `active` cùng chủ đề ⇒ chặn · bản `superseded` cũ ⇒ **qua** |

```js
#!/usr/bin/env node
/*
 * kiem-tri-thuc.js — kho tri thức phải có kỷ luật TRƯỚC KHI agent được đọc.
 *
 * VÌ SAO CHẶN Ở CỬA ĐỌC, KHÔNG PHẢI CỬA GHI: bản ghi sai có thể vào kho bằng nhiều đường
 * (agent ghi, người sửa tay, merge nhánh). Chặn ở cửa đọc thì đường nào cũng đi qua đây.
 *
 * Mã thoát:  0 = kho sạch  ·  1 = có vấn đề (CHẶN)  ·  2 = không đo được
 */
'use strict';
const fs = require('fs');
const path = require('path');

const KHO = process.env.KNOWLEDGE_DIR || 'knowledge';
const SCHEMA_FILE = '.agent/config/knowledge-schema.json';

if (!fs.existsSync(SCHEMA_FILE)) {
  console.error('[knowledge] KHÔNG ĐO ĐƯỢC: thiếu ' + SCHEMA_FILE);
  process.exit(2);
}
if (!fs.existsSync(KHO)) {
  console.error(`[knowledge] KHÔNG ĐO ĐƯỢC: chưa có thư mục ${KHO}/`);
  console.error('  Kho chưa tồn tại KHÁC với kho sạch — xem Bài 17 về "rỗng có kiểm soát".');
  process.exit(2);
}
const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf8'));

function quet(d, ra) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) quet(p, ra);
    else if (e.name.endsWith('.json')) ra.push(p);
  }
  return ra;
}
const files = quet(KHO, []);
if (!files.length) {
  console.error(`[knowledge] KHÔNG ĐO ĐƯỢC: ${KHO}/ rỗng`);
  process.exit(2);
}

const loi = [];
const canhBao = [];
const banGhi = [];

for (const f of files) {
  let doc;
  try { doc = JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { loi.push(`${f}: JSON hỏng — ${e.message}`); continue; }
  for (const r of Array.isArray(doc) ? doc : [doc]) banGhi.push({ f: f, r: r });
}

const homNay = new Date();
const ngay = (s) => { const d = new Date(s); return isNaN(d) ? null : d; };

for (const { f, r } of banGhi) {
  const nhan = `${r.id || '(không id)'}@v${r.version || '?'}`;

  for (const k of schema.batBuoc) {
    if (r[k] === undefined || r[k] === null || String(r[k]).trim() === '') {
      loi.push(`${nhan} (${f}): thiếu trường bắt buộc "${k}"`);
    }
  }
  if (r.loai && !schema.loai[r.loai]) loi.push(`${nhan}: loại lạ "${r.loai}"`);
  if (r.trangThai && !schema.trangThai[r.trangThai]) loi.push(`${nhan}: trạng thái lạ "${r.trangThai}"`);

  /* source phải TRUY ĐƯỢC, không chỉ tồn tại. "theo tài liệu" là không truy được. */
  const src = r.source;
  if (src && typeof src === 'object') {
    const kieuOk = (schema.sourceHopLe || []).some((s) => s.kieu === src.kieu);
    if (!kieuOk) loi.push(`${nhan}: source.kieu lạ "${src.kieu}"`);
    const tro = String(src.tro || '').trim();
    if (tro.length < 8) loi.push(`${nhan}: source.tro quá mơ hồ — "${tro}". Cần mục/mã cụ thể, tên+ngày, hoặc cách tái hiện.`);
    if (src.kieu === 'nguoi' && !/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}/.test(tro)) {
      loi.push(`${nhan}: source kiểu "nguoi" phải có NGÀY — "${tro}"`);
    }
  } else if (src !== undefined) {
    loi.push(`${nhan}: source phải là object {kieu, tro}, không phải chuỗi`);
  }

  /* Luật đang active mà không case nào canh ⇒ luật không được kiểm. Cảnh báo, không chặn:
     có luật vừa ghi hôm nay, chưa kịp sinh case. */
  if (r.trangThai === 'active' && r.loai === 'domain' && !(r.covered_by || []).length) {
    canhBao.push(`${nhan}: luật đang active mà KHÔNG case nào canh (covered_by rỗng)`);
  }

  /* Quá hạn tái xác nhận ⇒ phải là cho-xac-nhan, không được active. */
  const han = (schema.hanTaiXacNhan || {})[r.loai];
  const dGhi = ngay(r.ngayXacNhanCuoi || r.ngayGhi);
  if (han > 0 && dGhi && r.trangThai === 'active') {
    const soNgay = Math.floor((homNay - dGhi) / 86400000);
    if (soNgay > han) {
      loi.push(`${nhan}: loại "${r.loai}" quá hạn tái xác nhận (${soNgay} ngày > ${han}) mà vẫn "active" — ` +
        'chuyển sang "cho-xac-nhan". Quá hạn nghĩa là CHƯA AI KIỂM LẠI, không phải đã sai.');
    }
  }

  /* supersedes phải trỏ tới bản có thật, và bản đó phải KHÔNG còn active. */
  if (r.supersedes) {
    const [id, v] = String(r.supersedes).split('@v');
    const cu = banGhi.find((x) => x.r.id === id && String(x.r.version) === String(v));
    if (!cu) loi.push(`${nhan}: supersedes trỏ tới "${r.supersedes}" KHÔNG tồn tại — đừng xoá bản cũ, hãy đổi trạng thái nó`);
    else if (cu.r.trangThai === 'active') {
      loi.push(`${nhan}: thay thế "${r.supersedes}" nhưng bản đó VẪN active ⇒ hai bản cùng đúng một lúc`);
    }
  }
}

/* Mâu thuẫn: hai bản ghi CÙNG id đều đang active. Đây là ca dạy sai nguy hiểm nhất, vì agent
   sẽ đọc được cả hai và chọn một cách không xác định. */
const theoId = {};
for (const { r } of banGhi) {
  if (r.trangThai !== 'active' || !r.id) continue;
  (theoId[r.id] = theoId[r.id] || []).push(r.version);
}
for (const [id, vs] of Object.entries(theoId)) {
  if (vs.length > 1) loi.push(`${id}: ${vs.length} bản cùng "active" (v${vs.join(', v')}) — chỉ được MỘT`);
}

console.log(`[knowledge] ${files.length} tệp · ${banGhi.length} bản ghi`);
const dem = banGhi.reduce((a, x) => { a[x.r.trangThai] = (a[x.r.trangThai] || 0) + 1; return a; }, {});
console.log('  ' + Object.entries(dem).map(([k, v]) => `${k}=${v}`).join(' · '));

for (const c of canhBao) console.log('  ⚠ ' + c);

if (loi.length) {
  console.error(`\n[knowledge] ✗ CHẶN — ${loi.length} vấn đề:`);
  for (const l of loi) console.error('  - ' + l);
  console.error('\nTri thức sai vào kho một lần thì DẠY SAI MÃI MÃI, và mỗi lần dùng lại làm nó có vẻ đúng thêm.');
  process.exit(1);
}
console.log('[knowledge] ✓ ĐẠT — kho sạch, agent được đọc.');
```

### Thử nó — bốn lần

| Lần | Sửa gì | Kỳ vọng |
|---|---|---|
| 1 | kho đúng chuẩn | **`0`** |
| 2 | đổi `source.tro` thành `"theo tài liệu"` | **`1`** — không truy được |
| 3 | thêm `R-014@v2` `active` mà **không** đổi `v1` thành `superseded` | **`1`** — hai bản cùng đúng |
| 4 | đổi `v1` thành `superseded`, `ngayGhi` từ 2 năm trước | **`0`** — bản đã `superseded` thì không tính hạn |

Lần 4 là đối chứng âm quan trọng: **bản ghi cũ đã nghỉ hưu phải đi qua**. Chặn cả nó thì người ta sẽ xoá bản
cũ cho gọn, và mất luôn lịch sử.

## Bảo mật: vì sao `knowledge/` không lên repo công khai

Bài 5 đã nói và đáng nhắc lại ở đây, vì kho giờ đã lớn:

> Không chỉ **nội dung** nguy hiểm. **Tên tệp** đã tiết lộ.

```
knowledge/domain/tinh-phi-sai-khi-khach-hang-vang.json
knowledge/decisions/khong-chan-thanh-toan-trung-vi-chua-kip-sprint.json
knowledge/leak/khach-bao-loi-tru-tien-hai-lan.json
```

`git ls-files` trên một repo công khai là đủ để người ngoài biết sản phẩm có lỗi gì và bạn cố ý bỏ qua điều
gì — **không cần mở tệp nào**. `kiem-file-cam.js` (Bài 5) là máy canh chuyện đó; bài này chỉ nhắc rằng kho
càng lớn thì rủi ro càng cao.

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   └── knowledge-schema.json         ← MỚI · trường bắt buộc · 4 trạng thái · hạn tái xác nhận
├── scripts/qa/
│   └── kiem-tri-thuc.js             ← MỚI · chặn ở cửa ĐỌC, không phải cửa ghi (exit 0/1/2)
└── knowledge/                        ·  từ Bài 17 · ⛔ KHÔNG commit
    ├── domain/
    ├── system/
    ├── decisions/
    ├── fixture/
    └── leak/
```

## Tự kiểm

1. Vì sao `source` là trường quan trọng nhất của schema?
2. `"theo tài liệu"`, đủ làm `source` chưa? Vì sao?
3. `superseded` và `invalid` khác nhau ở chỗ nào? Kết quả chạy cũ trong mỗi trường hợp?
4. Quá hạn tái xác nhận thì chuyển trạng thái gì? Vì sao **không** phải `invalid`?
5. Vì sao gate chặn ở cửa **đọc** chứ không ở cửa **ghi**?
6. Hai bản ghi cùng `id` đều `active`, nguy hiểm ra sao?
7. Vì sao "luật active mà `covered_by` rỗng" chỉ là **cảnh báo**, không phải chặn?
8. `git ls-files` trên repo công khai tiết lộ gì mà không cần mở tệp?

## Bài tập về nhà (30 phút)

1. Lấy **5 bản ghi** trong kho tri thức thật của bạn. Với mỗi bản, trả lời: *ai nói điều này, và tôi truy lại
   bằng cách nào?* Bản nào không trả lời được → sửa `source`, hoặc chuyển `cho-xac-nhan`.
2. Tìm một luật nghiệp vụ **đã đổi** trong dự án bạn. Ghi đủ cặp `v1` (`superseded`, có `hieuLucDen`) và
   `v2` (`active`, có `hieuLucTu`). Rồi trả lời: *kết quả chạy tháng trước còn giá trị không?*
3. Chạy `kiem-tri-thuc.js` lên kho thật. Con số vi phạm lần đầu thường lớn, đó là bình thường. Sửa **5 cái
   nặng nhất**, đừng sửa hết trong một lần.

Câu hỏi ở bước 2 là toàn bộ lý do bài này tồn tại. Không có `superseded`/`invalid` tách bạch thì bạn phải
đoán, và đoán sai theo hướng rẻ thì bạn giữ lại một kết quả đã mất giá trị.

## Đọc thêm

- Bài 17 — [bộ nhớ dự án](bo-nho-du-an.md): 5 kho, và câu trả lời cho *"từ số 0 thì học từ đâu"*.
- Bài 20 — sao lưu và vòng đời dữ liệu: kho này mất thì mất theo cả lịch sử `superseded`.
- Bài 5 — [Git](git-tu-so-0.md): vì sao `knowledge/` không lên repo, và tên tệp là lớp rò rỉ hay bị bỏ.
