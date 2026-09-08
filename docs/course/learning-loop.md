# Bài 27 — Dùng lịch sử để quyết định lần test tiếp theo

> **2 giờ 30 phút** · Có gì trong tay: knowledge base có dữ liệu của vài sprint · Sau bài này: bảng rủi ro chấm được ngay từ tuần đầu

**Vấn đề**

Bạn có hai mươi module trên OPS và thời gian đủ để test kỹ khoảng năm cái.

Chọn năm cái nào?

Nếu câu trả lời là cảm giác thì mỗi người chọn khác, và mỗi sprint lại đổi. Mà bạn đang có sẵn dữ
liệu để trả lời: lịch sử bug của hai mươi module đó nằm ngay trong kho tri thức từ Bài 26, và nó nói
rất rõ rằng luồng thanh toán vỡ nhiều hơn màn danh mục.


**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Thời gian có hạn. Test đều tay mọi chỗ nghĩa là chỗ nguy hiểm bị làm qua loa. |
| **Bài này bạn gõ gì** | Khai mô hình rủi ro, viết máy chấm điểm, rồi viết gate ép test sâu hơn ở chỗ điểm cao. |
| **Xong thì được gì** | Test kỹ đúng chỗ đáng. Và biết làm gì khi chưa có lịch sử bug nào. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Tám việc:

1. Vì sao thời gian test luôn ít hơn thứ cần test (10 phút).
2. Công thức chấm rủi ro, và hai vế của nó lấy từ đâu (25 phút).
3. Cold start: chấm khi chưa có bug nào trong lịch sử (25 phút).
4. Bẫy dòng ma: tên module lệch làm cả bảng thành vô nghĩa (15 phút).
5. Bug thiếu nhãn module, và vì sao không được đoán (10 phút).
6. **Xây gate** ép độ sâu testcase theo band (25 phút).
7. Người override được, nhưng phải ghi lý do (15 phút).
8. Vòng đời dữ liệu: giữ bao lâu, tỉa thế nào, mỗi mốc kèm lý do (25 phút).

---

## Việc 1 — Vấn đề: thời gian test luôn ít hơn thứ cần test

Bài 14 cho bạn biết bộ case đang trống loại câu hỏi nào. Nhưng còn một câu khác chưa trả lời được:

> Trong 20 module, module nào đáng test **sâu**, module nào smoke là đủ?

Không có câu trả lời thì bạn rải đều. Và rải đều nghĩa là chỗ nguy hiểm bị hời hợt, chỗ an toàn bị thừa.

Câu trả lời phải là **con số**, không phải ý kiến. Vì nếu là ý kiến thì mỗi người một khác, và mỗi sprint lại
đổi.

## Việc 2 — Công thức, và hai vế lấy từ đâu

```
Risk = Likelihood × Impact
```

| Vế | Nghĩa | Nguồn |
|---|---|---|
| **Likelihood** | Module này **hay vỡ** cỡ nào | Lịch sử: bug đã có · tỉ lệ fail của test · tần suất sửa mã |
| **Impact** | Vỡ thì **hậu quả** ra sao | **Khai tay** — máy không suy được điều này |

Impact phải khai tay vì nó là quyết định kinh doanh, không phải dữ liệu. "Sai tiền" nặng hơn "lệch màu"
không phải vì mã nói thế.

`.agent/config/risk_model.json`:

```json
{
  "_note": "Trọng số cho Risk = Likelihood × Impact. Tên module PHẢI khớp cột Module của testcase — lệch tên là bảng đầy dòng ma, xem mục 4. Khoá bắt đầu bằng _ được bỏ qua.",

  "impact": {
    "_thang": "1 = thẩm mỹ · 2 = bất tiện · 3 = sai dữ liệu · 4 = sai tiền hoặc chặn nghiệp vụ · 5 = mất dữ liệu hoặc lộ dữ liệu",
    "modules": {
      "Tạo đơn hàng": 4,
      "Thanh toán": 5,
      "Danh mục sản phẩm": 3,
      "Báo cáo": 2,
      "Cấu hình hiển thị": 1
    },
    "macDinh": 2
  },

  "band": {
    "_note": "Ngưỡng chia band theo điểm Risk. depthPolicy là ĐỘ SÂU tối thiểu đòi hỏi ở mỗi band.",
    "high":   { "tuDiem": 12, "depthPolicy": "phải có case biên, case lỗi, và ít nhất 1 case E2E" },
    "medium": { "tuDiem": 6,  "depthPolicy": "phải có luồng chính và ít nhất 1 nhánh lỗi" },
    "low":    { "tuDiem": 0,  "depthPolicy": "smoke luồng chính là đủ" }
  },

  "coldStart": {
    "_note": "Khi chưa có lịch sử bug, Likelihood suy từ các tín hiệu THAY THẾ dưới đây. Chúng là PHỎNG ĐOÁN CÓ CƠ SỞ, không phải dữ liệu — nên band ở chế độ cold start chỉ CẢNH BÁO, không chặn.",
    "tinHieu": {
      "moiViet":        { "diem": 3, "giaiThich": "mã mới, chưa ai dùng thật" },
      "duongTien":      { "diem": 3, "giaiThich": "có tính toán tiền hoặc số lượng" },
      "nhieuNhanh":     { "diem": 2, "giaiThich": "nhiều điều kiện, nhiều biến thể" },
      "phuThuocNgoai":  { "diem": 2, "giaiThich": "gọi hệ thống ngoài" },
      "suaNhieuLan":    { "diem": 2, "giaiThich": "git log cho thấy sửa nhiều lần gần đây" },
      "onDinhLauNgay":  { "diem": -2, "giaiThich": "không sửa gì trong nhiều tháng" }
    },
    "toiThieu": 1, "toiDa": 5
  }
}
```

## Việc 3 — Cold start: chấm khi chưa có bug nào

Đây là mục quan trọng nhất, và là chỗ mà công thức trên không dùng được ở tuần đầu: `bugs/` rỗng nên
Likelihood = 0 cho mọi module, và mọi module cùng band. Vô dụng.

Năm tín hiệu thay thế, tất cả lấy được mà không cần lịch sử bug:

| Tín hiệu | Lấy ở đâu | Vì sao liên quan |
|---|---|---|
| **Mới viết** | `git log --diff-filter=A` cho thư mục module | Mã chưa ai dùng thật thì chưa ai phát hiện lỗi |
| **Đường tiền** | Đọc tài liệu: có công thức tính tiền/số lượng không | Lỗi ở đây tốn tiền thật, và hay có lỗi làm tròn |
| **Nhiều nhánh** | Đếm điều kiện trong tài liệu (hạng khách, loại đơn…) | Nhiều tổ hợp thì nhiều chỗ chưa ai thử |
| **Phụ thuộc ngoài** | Có gọi hệ thống khác không | Điểm đứt thêm, và không kiểm soát được |
| **Sửa nhiều lần** | `git log --oneline -- <đường/dẫn> \| wc -l` | Sửa nhiều thường là chưa ổn định |

```js
#!/usr/bin/env node
/*
 * cham-rui-ro.js — chấm Risk = Likelihood × Impact cho từng module.
 *
 * VÌ SAO CÓ CHẾ ĐỘ COLD START: tuần đầu thì bugs/ rỗng ⇒ Likelihood = 0 cho MỌI module ⇒ bảng vô dụng.
 * Chế độ cold start suy Likelihood từ tín hiệu thay thế (mã mới, đường tiền, số nhánh, phụ thuộc, tần suất
 * sửa). Chúng là PHỎNG ĐOÁN CÓ CƠ SỞ — nên chế độ này chỉ CẢNH BÁO, không bao giờ chặn.
 *
 * Mã thoát: 0 = xong · 1 = có vấn đề cần xử lý · 2 = không đo được.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const MODEL = JSON.parse(fs.readFileSync(path.join(ROOT, '.agent/config/risk_model.json'), 'utf8'));
const DIR_BUG = path.join(ROOT, 'knowledge', 'bugs');
const F_LICH_SU = path.join(ROOT, 'knowledge', 'metrics', 'lich-su-case.jsonl');
const F_COLD = path.join(ROOT, '.agent', 'config', 'cold-start-signals.json');

/** Bỏ khoá bắt đầu bằng _ — chúng là ghi chú, không phải module. */
function chiModule(obj) {
  return Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !k.startsWith('_')));
}

const impactModules = chiModule(MODEL.impact.modules);

/** Likelihood từ LỊCH SỬ THẬT: số bug + tỉ lệ fail của test. */
function likelihoodTuLichSu() {
  const ra = {};
  if (fs.existsSync(DIR_BUG)) {
    for (const f of fs.readdirSync(DIR_BUG).filter((x) => x.endsWith('.json'))) {
      let b; try { b = JSON.parse(fs.readFileSync(path.join(DIR_BUG, f), 'utf8')); } catch (e) { continue; }
      // Bug KHÔNG gắn module bị LOẠI khỏi bảng — gán sai module còn tệ hơn để trống, xem mục 5
      if (!b.module) continue;
      ra[b.module] = (ra[b.module] || 0) + 1;
    }
  }
  return ra;
}

/** Likelihood từ TÍN HIỆU THAY THẾ khi chưa có lịch sử. */
function likelihoodColdStart() {
  if (!fs.existsSync(F_COLD)) return null;
  const khai = JSON.parse(fs.readFileSync(F_COLD, 'utf8'));
  const { tinHieu, toiThieu, toiDa } = MODEL.coldStart;
  const ra = {};
  for (const [mod, danh] of Object.entries(chiModule(khai.modules))) {
    let diem = 0;
    const lyDo = [];
    for (const t of danh) {
      if (!tinHieu[t]) { lyDo.push(`(tín hiệu lạ bị bỏ qua: ${t})`); continue; }
      diem += tinHieu[t].diem;
      lyDo.push(t);
    }
    ra[mod] = { diem: Math.min(toiDa, Math.max(toiThieu, diem)), lyDo };
  }
  return ra;
}

const soBug = likelihoodTuLichSu();
const coBug = Object.values(soBug).reduce((a, b) => a + b, 0);
const cold = likelihoodColdStart();
const cheDo = coBug > 0 ? 'lich-su' : 'cold-start';

if (cheDo === 'cold-start' && !cold) {
  console.error('[risk] KHÔNG ĐO ĐƯỢC: chưa có bug lịch sử, và cũng chưa khai .agent/config/cold-start-signals.json');
  console.error('  → khai tín hiệu thay thế cho từng module (xem Bài 27 mục 3)');
  process.exit(2);
}

/** Ánh xạ điểm → band. */
function band(diem) {
  const bs = Object.entries(MODEL.band).filter(([k]) => !k.startsWith('_'))
    .sort((a, b) => b[1].tuDiem - a[1].tuDiem);
  for (const [ten, v] of bs) if (diem >= v.tuDiem) return ten;
  return 'low';
}

const bang = [];
const moiModule = new Set([...Object.keys(impactModules), ...Object.keys(soBug),
  ...Object.keys(cold || {})]);

for (const mod of moiModule) {
  const impact = impactModules[mod] ?? MODEL.impact.macDinh;
  const L = cheDo === 'lich-su'
    ? Math.min(5, 1 + (soBug[mod] || 0))
    : (cold[mod] ? cold[mod].diem : MODEL.coldStart.toiThieu);
  const diem = L * impact;
  bang.push({
    mod, L, impact, diem, band: band(diem),
    khaiImpact: mod in impactModules,
    coDuLieu: (soBug[mod] || 0) > 0 || !!(cold && cold[mod])
  });
}
bang.sort((a, b) => b.diem - a.diem);

console.log(`[risk] chế độ: ${cheDo}` + (cheDo === 'cold-start'
  ? ' — Likelihood là PHỎNG ĐOÁN CÓ CƠ SỞ, chỉ dùng để cảnh báo'
  : ` — dựa trên ${coBug} bug lịch sử`));
console.log('\nModule                   L  Impact  Điểm  Band');
console.log('─'.repeat(52));
for (const r of bang) {
  console.log(`${r.mod.padEnd(24)} ${String(r.L).padStart(1)}  ` +
    `${String(r.impact).padStart(6)}  ${String(r.diem).padStart(4)}  ${r.band}`);
}

/* ── BẪY DÒNG MA: module khai Impact mà KHÔNG có dữ liệu, và module CÓ dữ liệu mà chưa khai Impact ── */
const dongMa = bang.filter((r) => r.khaiImpact && !r.coDuLieu).map((r) => r.mod);
const thieuImpact = bang.filter((r) => r.coDuLieu && !r.khaiImpact).map((r) => r.mod);

const vanDe = [];
// Chỉ nổ khi CÓ CẢ HAI — nếu chỉ có dòng ma thì có thể module đó thật sự chưa test, không phải lệch tên
if (dongMa.length && thieuImpact.length) {
  vanDe.push(`NGHI LỆCH TÊN MODULE: ${dongMa.length} module khai Impact mà không có dữ liệu ` +
    `(${dongMa.slice(0, 5).join(' · ')}), trong khi ${thieuImpact.length} module CÓ dữ liệu lại rơi về ` +
    `Impact mặc định (${thieuImpact.slice(0, 5).join(' · ')}). Tên trong risk_model phải KHỚP cột Module ` +
    'của testcase.');
}
if (thieuImpact.length && !dongMa.length) {
  console.log(`\n⚠ ${thieuImpact.length} module có dữ liệu nhưng chưa khai Impact ` +
    `⇒ đang dùng mặc định ${MODEL.impact.macDinh}: ${thieuImpact.join(' · ')}`);
}

console.log('\nĐộ sâu đòi hỏi theo band:');
for (const [ten, v] of Object.entries(MODEL.band).filter(([k]) => !k.startsWith('_'))) {
  const n = bang.filter((r) => r.band === ten).length;
  console.log(`  ${ten.padEnd(7)} ${String(n).padStart(2)} module — ${v.depthPolicy}`);
}

fs.mkdirSync(path.join(ROOT, 'knowledge', 'metrics'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'knowledge', 'metrics', 'risk-register.json'),
  JSON.stringify({ luc: new Date().toISOString(), cheDo, bang }, null, 2), 'utf8');
console.log('\n[risk] đã ghi knowledge/metrics/risk-register.json');

if (vanDe.length) {
  console.error('\n[risk] ✗ ' + vanDe.length + ' vấn đề:');
  for (const v of vanDe) console.error('  - ' + v);
  process.exit(1);
}
process.exit(0);
```

`.agent/config/cold-start-signals.json`:

```json
{
  "_note": "Tín hiệu thay thế cho Likelihood khi chưa có bug lịch sử. Khai theo module, tên PHẢI khớp cột Module của testcase. Tín hiệu hợp lệ khai ở risk_model.json/coldStart/tinHieu.",
  "modules": {
    "Tạo đơn hàng": ["moiViet", "duongTien", "nhieuNhanh"],
    "Thanh toán": ["duongTien", "phuThuocNgoai", "suaNhieuLan"],
    "Danh mục sản phẩm": ["onDinhLauNgay"],
    "Báo cáo": ["nhieuNhanh"],
    "Cấu hình hiển thị": ["onDinhLauNgay"]
  }
}
```

> Vì sao cold start chỉ cảnh báo, không chặn. Tín hiệu thay thế là phỏng đoán có cơ sở, không phải dữ
> liệu. Chặn dựa trên phỏng đoán thì sẽ chặn oan, và Bài 15 mục 8 đã nói hậu quả: gate báo oan là gate bị bỏ
> qua. Khi `bugs/` đã có dữ liệu thật thì mới bàn tới chuyện chặn.

## Việc 4 — Bẫy dòng ma: tên module lệch

Đây là bẫy đo được thật, và nó làm cả bảng rủi ro vô dụng mà vẫn trông đúng.

> Chuyện thật ở kit này: cấu hình khai 18 tên module bằng tiếng Anh (Payment, Order…) trong khi bug và
> snapshot dùng tên module canonical bằng tiếng Việt. Kết quả: **17/18 dòng đầu bảng có Impact cao với
> 0 bug. Toàn dòng ma. Còn 23 module có dữ liệu thật** thì rơi về Impact mặc định, nên band bị chặn trần
> ở Medium.
>
> Quy định *đã có* trong ghi chú của file cấu hình. Nhưng không có máy kiểm.

Nhận ra bằng hai dấu hiệu xuất hiện **cùng lúc**:

1. Module khai Impact mà 0 dữ liệu.
2. Module **có** dữ liệu mà rơi về Impact mặc định.

Chỉ có dấu hiệu 1 thì có thể module đó thật sự chưa được test, không phải lệch tên. Có **cả hai** thì gần như
chắc chắn là hai danh sách tên khác nhau. Đó là lý do máy ở mục 3 chỉ nổ khi có cả hai.

Một bẫy nhỏ hơn cùng họ: khoá `_note` trong cấu hình bị đếm thành module, làm bảng mọc một dòng tên `_note`
với Impact là chuỗi. Nên có `chiModule()` bỏ mọi khoá bắt đầu bằng `_`.

## Việc 5 — Bug thiếu nhãn module, và vì sao không được đoán

`bugs/` có bug không gắn module thì Likelihood của module thật bị hụt. Phản xạ: **suy** module từ tiêu đề bug.

Hai cách đã thử và **bị loại**, ghi lại để bạn không làm lại:

| Cách | Kết quả đo | Vì sao loại |
|---|---|---|
| Suy module từ tiêu đề bug | 9 ca "trông chắc", soi ra ≥4 sai rõ ràng | Gán sai bơm Likelihood cho module **vô can**, và vẫn để module thật mỏng |
| Bảng tra `nhãn → module` | **5/17 nhãn đa nghĩa**, và toàn là loại phổ biến nhất | Nhãn thực tế là nhãn **quy trình**, không phải nhãn chức năng |

> Module SAI tệ hơn module TRỐNG. Trống thì bạn biết là thiếu. Sai thì bạn có một con số tin được, mà nó
> sai.

Nên công cụ chỉ **đề xuất**, người chốt. Đo được: đoán theo module xác suất cao nhất chỉ đúng **40%**, nhưng
module thật nằm trong top-12 tới **73%** — đủ để làm danh sách ứng viên cho người đọc, không đủ để tự ghi.

Vì vậy: không có chế độ `--apply`. Người đọc danh sách rồi ghi tay vào một file bản đồ, và bản đồ đó là
**nguồn thứ ba** (sau nhãn và mô tả) khi nạp bug.

## Việc 6 — Gate độ sâu theo band

Có bảng rủi ro rồi thì đối chiếu với bộ case: module band `high` có đủ độ sâu chưa?

Nối với tag chiều ở Bài 14:

| Band | depthPolicy | Kiểm bằng tag |
|---|---|---|
| `high` | Case biên + case lỗi + ít nhất 1 `[E2E]` | Có `[Boundary]`, có `[Negative]`, có `[E2E]` |
| `medium` | Luồng chính + ít nhất 1 nhánh lỗi | Có `[Positive]`, có `[Negative]` |
| `low` | Smoke luồng chính | Có `[Positive]` |

```js
#!/usr/bin/env node
/* gate-do-sau.js — đối chiếu độ sâu bộ case với band rủi ro. MẶC ĐỊNH CẢNH BÁO; --enforce mới chặn. */
'use strict';
const fs = require('fs');
const path = require('path');
const { docMarkdown } = require('../lib/testcase');

const ENFORCE = process.argv.includes('--enforce');
const tcFile = process.argv[2];
if (!tcFile) { console.error('Dùng: node scripts/qa/gate-do-sau.js <testcase.md> [--enforce]'); process.exit(2); }

const reg = path.join(process.cwd(), 'knowledge', 'metrics', 'risk-register.json');
if (!fs.existsSync(reg)) {
  console.error('[do-sau] KHÔNG ĐO ĐƯỢC: chưa có risk-register. Chạy `npm run risk` trước.');
  process.exit(2);
}
const { cheDo, bang } = JSON.parse(fs.readFileSync(reg, 'utf8'));
const cases = docMarkdown(fs.readFileSync(tcFile, 'utf8'));

const DOI_HOI = {
  high: ['Boundary', 'Negative', 'E2E'],
  medium: ['Positive', 'Negative'],
  low: ['Positive']
};

const thieu = [];
for (const r of bang) {
  const cuaModule = cases.filter((c) => c.module === r.mod);
  if (!cuaModule.length) {
    thieu.push(`${r.mod} (band ${r.band}): 0 case nào`);
    continue;
  }
  const tags = new Set(cuaModule.flatMap((c) =>
    [...c.title.matchAll(/\[([A-Za-z0-9_]+)\]/g)].map((m) => m[1])));
  const con = (DOI_HOI[r.band] || []).filter((t) => !tags.has(t));
  if (con.length) thieu.push(`${r.mod} (band ${r.band}): thiếu tag ${con.join(' · ')}`);
}

console.log(`[do-sau] chế độ risk: ${cheDo} · ${bang.length} module · ${cases.length} case`);
if (!thieu.length) { console.log('[do-sau] ✓ ĐẠT'); process.exit(0); }

const nhan = ENFORCE ? '✗ CHẶN' : '⚠ CẢNH BÁO';
console.log(`\n[do-sau] ${nhan} — ${thieu.length} module chưa đủ độ sâu:`);
for (const t of thieu) console.log('  - ' + t);
if (cheDo === 'cold-start' && ENFORCE) {
  console.error('\n[do-sau] KHÔNG chặn ở chế độ cold-start: Likelihood đang là phỏng đoán, ' +
    'chặn dựa trên phỏng đoán sẽ chặn oan. Chờ có bug lịch sử thật rồi mới bật --enforce.');
  process.exit(0);
}
process.exit(ENFORCE ? 1 : 0);
```

Để ý dòng cuối: `--enforce` ở chế độ cold-start vẫn **không chặn**. Máy tự từ chối chặn khi dữ liệu chưa đủ tin
— tốt hơn là để người dùng tự nhớ.

## Việc 7 — Người override được, nhưng phải ghi lý do

Bảng rủi ro là **đề xuất**, không phải phán quyết. QA biết những thứ máy không biết: sắp demo cho khách, module
này khách dùng nhiều, phần kia sắp bỏ.

Nên override là hợp lệ, kèm nghĩa vụ:

```json
{
  "loai": "risk_override",
  "module": "Báo cáo",
  "bandMay": "low",
  "bandNguoi": "high",
  "lyDo": "Khách demo báo cáo trong sprint tới; sai số ở đây thấy ngay và ảnh hưởng đánh giá sản phẩm",
  "aiChot": "QA Lead <tên>", "ngay": "2026-xx-xx",
  "hetHan": "2026-xx-xx"
}
```

Ghi vào `knowledge/decisions/`. Hai trường quan trọng:

- **`lyDo`** — sáu tuần sau không ai nhớ vì sao module đó được nâng band.
- **`hetHan`** — override thường là tạm (demo xong thì hết lý do). Không có ngày hết hạn thì nó thành vĩnh viễn.

---

## Thực hành (50 phút)

### Bước 1 — Khai Impact (10 phút)

Viết `.agent/config/risk_model.json` cho dự án bạn. Ràng buộc: tên module **copy đúng** từ cột `Module` của bộ
testcase, đừng gõ lại, đừng dịch.

```bash
# lấy đúng danh sách tên module đang dùng
node -e "
const fs=require('fs');const {docMarkdown}=require('./scripts/lib/testcase');
const c=docMarkdown(fs.readFileSync(process.argv[1],'utf8'));
console.log([...new Set(c.map(x=>x.module))].join('\n'));
" outputs/demo/tasks/PROJ-1234/test-cases/agent-sinh.md
```

### Bước 2 — Khai tín hiệu cold start (10 phút)

Viết `cold-start-signals.json`. Với mỗi module, chọn tín hiệu dựa trên **bằng chứng**, không cảm giác:

```bash
# "sửa nhiều lần": đếm commit chạm module đó trong 3 tháng
git log --oneline --since="3 months ago" -- src/orders/ | wc -l
# "mới viết": tìm commit thêm file đầu tiên
git log --diff-filter=A --format="%ad" --date=short -- src/orders/ | tail -1
```

### Bước 3 — Chấm và đọc bảng (10 phút)

```bash
node scripts/qa/cham-rui-ro.js
```

Kiểm ba thứ:
- Chế độ có đúng là `cold-start` không (vì bạn chưa có bug lịch sử)?
- Có module nào khai Impact mà 0 dữ liệu không?
- Thứ tự band có hợp trực giác của bạn không? Không hợp thì hoặc Impact khai sai, hoặc trực giác bạn sai —
  và cả hai đều đáng xem lại.

### Bước 4 — Dựng bẫy dòng ma rồi xác nhận máy bắt được (10 phút)

```bash
# đổi một tên module trong risk_model sang tiếng Anh
node -e "
const fs=require('fs');const p='.agent/config/risk_model.json';
const m=JSON.parse(fs.readFileSync(p,'utf8'));
m.impact.modules['Order Creation'] = m.impact.modules['Tạo đơn hàng'];
delete m.impact.modules['Tạo đơn hàng'];
fs.writeFileSync(p, JSON.stringify(m,null,2));
"
node scripts/qa/cham-rui-ro.js; echo "exit=$?"    # → 1, nêu NGHI LỆCH TÊN MODULE
# hoàn nguyên
```

Đây là bẫy đã làm một bảng rủi ro thật vô dụng trong nhiều tuần. Thấy máy bắt được thì bạn tin nó hơn.

### Bước 5 — Gate độ sâu (10 phút)

Viết `gate-do-sau.js`, chạy trên bộ case Bài 14:

```bash
node scripts/qa/gate-do-sau.js outputs/demo/tasks/PROJ-1234/test-cases/agent-sinh.md
```

Điền bảng cho module band cao nhất:

| Module | Band | Tag đang có | Tag còn thiếu |
|---|---|---|---|

Rồi thử `--enforce` và xác nhận nó vẫn không chặn ở chế độ cold-start.

### Bước 6 — Commit

```bash
git add .agent/config/risk_model.json .agent/config/cold-start-signals.json scripts/qa package.json
git commit -m "feat(risk): Risk = L × I, có chế độ cold-start khi chưa có bug lịch sử

Cold start suy Likelihood từ 5 tín hiệu thay thế; chế độ này CHỈ cảnh báo.
Máy bắt bẫy lệch tên module (nghiệm thu: đổi 1 tên sang tiếng Anh → exit 1)."
```

---

## Việc 8 — Vòng đời dữ liệu: giữ bao lâu, tỉa thế nào (25 phút)

Bảy việc trên làm kho tri thức **hữu ích**. Việc này làm nó **không phình**.

Sau một năm, kho của bạn có vài nghìn bản ghi. Phần lớn nói về những màn hình không còn tồn tại. Và
đây là chỗ nguy hiểm: một kho phình không chỉ chậm, nó **giảm độ tin**. Người đọc gặp ba bản ghi cũ
liên tiếp là lần thứ tư họ không đọc nữa.

### Bốn nhóm, bốn vòng đời khác nhau

| Nhóm | Giữ bao lâu | Vì sao đúng con số đó |
|---|---|---|
| Quy tắc nghiệp vụ | Tới khi sản phẩm đổi luật | Không có hạn theo thời gian. Nó hết hạn theo **sự kiện** |
| Cách dựng trạng thái | 90 ngày rồi bắt tái xác nhận | Luồng sản phẩm đổi vài tháng một lần |
| Bug đã gặp | Giữ mãi, nhưng có nhãn "đã fix" | Lịch sử bug là đầu vào của chấm rủi ro. Xoá là mất trọng số |
| Kết quả từng lượt chạy | 30 ngày | Sau đó chỉ còn số tổng hợp là có ích, chi tiết thì không |

Cột thứ ba là cột quan trọng nhất, và nó là điểm khác biệt giữa một chính sách và một con số tuỳ hứng.

### Khai ngưỡng TRƯỚC, không tỉa theo cảm giác

Con số phải nằm trong một tệp cấu hình, kèm lý do:

```json
{
  "moTa": "Giữ bao lâu, và VÌ SAO đúng con số đó. Không có lý do thì lần sau không ai dám sửa.",
  "nhom": {
    "nghiepVu":   { "giu": null,  "lyDo": "hết hạn theo sự kiện sản phẩm đổi luật, không theo ngày" },
    "dungState":  { "giu": 90,    "lyDo": "đo thật: luồng sản phẩm đổi trung bình 2-3 tháng một lần" },
    "bugDaGap":   { "giu": null,  "lyDo": "là đầu vào chấm rủi ro ở Việc 2; xoá là mất trọng số" },
    "ketQuaChay": { "giu": 30,    "lyDo": "quá 30 ngày thì chỉ số tổng hợp còn ích, chi tiết thì không" }
  }
}
```

Vì sao phải khai trước khi kho phình, chứ không khai lúc cần tỉa: vì lúc kho đã phình thì bạn quyết
định dưới áp lực, và quyết định dưới áp lực luôn là **xoá cho nhanh**. Ba tháng sau bạn cần đúng bản
ghi vừa xoá.

Và vì sao bắt buộc có cột lý do: không có nó thì con số `90` trở thành thứ không ai dám sửa. Người sau
nhìn vào không biết nó là kết quả đo hay là số bốc ra, nên họ để nguyên. Một con số không ai dám sửa
là một con số đã chết.

### Tỉa không phải xoá

Ba mức, và chỉ mức cuối mới là xoá thật:

| Mức | Làm gì | Khi nào |
|---|---|---|
| Hạ trạng thái | Đổi sang `cho-xac-nhan` | Quá hạn tái xác nhận |
| Gộp | Nhiều bản ghi cùng chủ đề thành một, giữ nguồn của tất cả | Kho có 5 bản ghi nói cùng một luật |
| Xoá | Bỏ hẳn | Chỉ khi thứ nó nói tới **không còn tồn tại** trong sản phẩm |

Mức thứ nhất là mức quan trọng nhất, và nó là chỗ hay bị làm sai. Quá hạn **không** nghĩa là sai. Nó
nghĩa là *"chưa ai kiểm lại"*. Chuyển thẳng bản ghi quá hạn sang `khong-hop-le` là kết luận thay cho
một phép kiểm chưa ai làm.

### Một chỗ tuyệt đối không được nhầm

Kho tri thức **không nằm trong repo** — nó là dữ liệu công ty, và Bài 26 đã nói vì sao. Nghĩa là git
không giữ nó, nên **không có bản lùi**. Tỉa sai là mất thật.

Nên trước khi tỉa lần đầu, hai việc, theo đúng thứ tự này:

1. Sao lưu ra ngoài repo, và **thử khôi phục một lần** ngay lúc đó. Bản sao lưu chưa từng được khôi
   phục thì bạn chưa biết nó có dùng được không, bạn chỉ đang tin là được.
2. Chạy phần tỉa ở chế độ in-ra-chứ-không-xoá, đọc danh sách nó định xoá, rồi mới cho chạy thật.

Cách dựng máy sao lưu nằm ở bài [Sao lưu và vòng đời dữ liệu](sao-luu-va-vong-doi-du-lieu.md). Trong
đó có một luật nghe lạ mà đáng nhớ: nếu đích sao lưu nằm **trong** repo thì máy phải từ chối chạy. Vì
sao lưu vào chính chỗ bạn đang lo mất thì không phải sao lưu.

---

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Điểm rủi ro** | Khả năng hỏng nhân với hậu quả nếu hỏng |
| **Band** | Mức rủi ro: cao, vừa, thấp. Nó quyết định test sâu tới đâu |
| **Chế độ chưa có dữ liệu** | Khi chưa có lịch sử bug, máy chỉ cảnh báo chứ không chặn |

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   ├── risk_model.json           ← MỚI · trọng số + khối coldStart 5 tín hiệu
│   └── cold-start-signals.json   ← MỚI · tín hiệu thay thế khi chưa có lịch sử bug
└── scripts/qa/
    ├── cham-rui-ro.js            ← MỚI · tính band; cold-start chỉ CẢNH BÁO
    └── gate-do-sau.js            ← MỚI · từ chối chặn ở chế độ cold-start, kể cả --enforce
```

## Bộ kit của bạn đang ở đâu

```
CẤP ĐỘ 4 · EVOLVE      bài 7/9 của cấp độ này
██████████████████████░░░░░░

cả tài liệu           bài 27/29
██████████████████████████░░
```

**Hết cấp độ 4 bạn nói được:** Tôi mở rộng, đo được độ tin cậy, tích luỹ learning và chứng minh reuse.

Cấp độ này còn 2 bài nữa.

## Tự kiểm

- [ ] Tôi nói được vì sao Impact phải khai tay còn Likelihood thì suy được.
- [ ] Tên module trong cấu hình **copy đúng** từ cột `Module`, không gõ lại.
- [ ] Tôi chọn tín hiệu cold start dựa trên bằng chứng git, không cảm giác.
- [ ] Máy của tôi bỏ qua khoá bắt đầu bằng `_`.
- [ ] Máy chỉ nổ "nghi lệch tên" khi có **cả hai** dấu hiệu, không phải một.
- [ ] Tôi đã dựng bẫy lệch tên và xác nhận máy bắt được.
- [ ] Chế độ cold-start **không chặn**, kể cả khi có `--enforce`.
- [ ] Tôi giải thích được vì sao module sai tệ hơn module trống.
- [ ] Override của tôi có `lyDo` và `hetHan`.

## Bài tập về nhà

Nếu dự án bạn **đã có** bug lịch sử: nạp về `knowledge/bugs/` và đếm bao nhiêu bug không gắn module.

Con số đó là phần lịch sử đang **vô hình** với việc chấm rủi ro. Ở kit này lần đầu đo được **26/57** — gần một
nửa. Nghĩa là gần một nửa số bug đã log rồi vẫn không làm bộ case lượt sau sâu hơn ở đúng chỗ.

Đừng gán module bằng cách đoán. Làm bản đồ tay cho **mười** bug quan trọng nhất trước, và ghi rõ căn cứ của
từng cái.

## Đọc thêm

- Bài 25 sẽ dùng band rủi ro để quyết độ sâu mở rộng. Mở 5 trục cho mọi case thì evidence nhân lên tới
  mức không ai đọc báo cáo nữa.
- [`scripts/qa/risk_score.js`](../../scripts/qa/risk_score.js) của kit này, bản đầy đủ, dựa trên lịch sử thật.

## Bài sau

Bài 28 chuẩn bị cho việc bàn giao: tách tầng chung khỏi tầng dự án, rồi đóng gói. Nhầm ranh giới ở
đây không phải chuyện gọn gàng, mà là chuyện an toàn.
