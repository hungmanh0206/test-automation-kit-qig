# Bài 16 — Phase 2: chạy automation có kiểm soát

> **2 giờ 30 phút** · Có gì trong tay: bộ testcase đã sinh và đã chốt · Sau bài này: bắt được bug ở chỗ testcase không hề nói tới — mà không biến mở rộng thành tautology nhân 7 lần

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Bộ case phủ hết những gì tài liệu nói. Nhưng bug lại nằm ở chỗ tài liệu không nói. |
| **Bài này bạn gõ gì** | Lấy một case đã pass rồi soi rộng ra 7 hướng quanh nó, ngay trên app thực hành. |
| **Xong thì được gì** | Từ đúng một case, bạn tìm ra cả 3 bug cài sẵn và thêm một chỗ tài liệu còn thiếu. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Mở rộng** | Trong lúc execute một case, cố tình nhìn ra **quanh** nó, không chỉ làm đúng chữ trong case |
| **`OBSERVATION`** | Thấy một điều lạ nhưng không neo được vào mã luật nào. Không phải PASS, không phải FAIL |
| **`spec:gap`** | Ứng dụng làm một việc mà đặc tả không nói gì. Không phải bug — là lỗ hổng đặc tả |

## Bài này bạn sẽ làm gì

Bốn việc:

1. Tự thấy vì sao bộ case "đầy đủ" vẫn lọt bug (15 phút).
2. Mở **7 trục** quanh một case trên app thực hành, và tìm ra một thứ thật (50 phút).
3. Học luật sống-còn: không neo thì là `OBSERVATION`, và vì sao "nhất quán" không cứu được bạn (20 phút).
4. **Xây gate**: mở rộng không có neo ⇒ chặn; và gate độ sâu theo mức rủi ro để không nổ thời gian (35 phút).

---

## Việc 1 — Vì sao bộ case đầy đủ vẫn lọt (15 phút)

Bộ testcase của bạn phủ hết những gì tài liệu nói. Bug thì sống ở những chỗ tài liệu không nói:

| Bug sống ở đâu | Vì sao case không phủ |
|---|---|
| Trường thứ 5 trong cùng khối form | Tài liệu chỉ nêu 4 trường; trường thứ 5 có trên UI |
| Cùng một số, ở màn khác | Tài liệu viết theo màn, không viết theo *giá trị* |
| Giữa hai tầng (UI ↔ API ↔ nơi lưu) | Tài liệu nói "hiển thị đúng", không nói "và lưu đúng" |
| Nhánh ít đi (đơn huỷ, khách không có mã số) | Tài liệu nêu luồng chính |
| Trạng thái ngay trước/sau | Tài liệu tả trạng thái, không tả **chuyển** trạng thái |
| Hai người làm cùng lúc | Tài liệu gần như không bao giờ nói |
| Thứ ứng dụng làm mà tài liệu **không nói** | Không case nào sinh ra từ chỗ trống |

Bảy dòng trên chính là 7 trục. Chúng không phải danh sách đẹp, mỗi dòng là một lớp bug đã lọt thật.

> Và có một luật đi kèm, khắt khe: bug do người ngoài tìm ra = lỗi của máy. Khi có bug lọt, câu hỏi không
> phải *"case của tôi không phủ chỗ đó"* mà là *"máy nào lẽ ra phải bắt được, và vì sao nó không bắt?"*
> Bài 25 đưa câu hỏi này thành phép đo.

## Việc 2 — Mở 7 trục quanh một case (50 phút)

Lấy một case đã PASS trên app thực hành: *"Tạo đơn cho khách hạng Thường, 1 Ghế nhựa, tổng cộng 130.000"*.

Chạy app, rồi mở từng trục. Mỗi trục có một **câu hỏi** — hỏi đúng câu là ra việc.

### Trục 1 — Field cùng khối

> *Các trường khác trong cùng khối có đúng không?*

Case chỉ kiểm `Tổng cộng`. Cùng khối còn `Tạm tính`, `Giảm giá`, `Phí giao hàng`.

```bash
curl -s -X POST http://localhost:4010/api/quote -H "Content-Type: application/json" \
  -d "{\"customerId\":\"KH01\",\"items\":[{\"productId\":\"SP02\",\"qty\":1}]}"
```

**Bạn sẽ thấy** `{"tamTinh":100000,"giamGia":0,"phiGiaoHang":30000,"tongCong":130000}`, cả bốn khớp
`BR-01`…`BR-04`. Trục này **PASS**, có neo.

### Trục 2 — Cùng giá trị, khác nơi hiển thị

> *Giá trị này còn hiện ở đâu nữa? Có khớp?*

`Tổng cộng` hiện ở màn Tạo đơn **và** ở bảng Danh sách đơn hàng. Tạo đơn qua giao diện rồi so hai chỗ.

Đây là trục tìm ra **BUG-2** nếu bạn chọn khách hạng Vàng: màn Tạo đơn hiện `Giảm giá 8.000` mà tầng lưu trữ
ghi `8750`. Neo: `UI-04`. ⇒ **FAIL**, tầng `frontend`.

### Trục 3 — Chuỗi form → API → nơi lưu → UI

> *Nhập gì → gửi gì → lưu gì → hiện gì? Tầng nào biến đổi giá trị?*

```bash
curl -s http://localhost:4010/api/_store/orders
```

Đây là Bài 10 làm kỹ. Ở đây chỉ cần thấy: có bốn tầng, và mỗi ranh giới là một chỗ giá trị đổi được.

### Trục 4 — Biến thể

> *Nhánh khác của cùng luật thì sao?*

Case dùng hạng Thường (giảm 0%). Còn Bạc 3%, Vàng 5%. Và ở đúng mốc `500.000`:

```bash
curl -s -X POST http://localhost:4010/api/quote -H "Content-Type: application/json" \
  -d "{\"customerId\":\"KH02\",\"items\":[{\"productId\":\"SP01\",\"qty\":2}]}"
```

**Bạn sẽ thấy** `phiGiaoHang: 30000` trong khi `BR-03` nói tạm tính `500.000` thì **miễn phí**. Đây là
**BUG-1**. Neo: `BR-03`. ⇒ **FAIL**, tầng `backend`.

Để ý: với hạng **Thường** (giảm 0%) hai công thức cho **cùng** kết quả, nên nếu chỉ mở trục 4 theo hạng mà
không đi tới mốc biên, bạn vẫn không thấy. Trục 4 phải giao với giá trị biên.

### Trục 5 — Trạng thái kế cận

> *Trạng thái ngay trước/sau thì hành vi có đúng?*

Đơn `Chờ xác nhận` sửa được. Còn `Đã xác nhận`?

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH http://localhost:4010/api/orders/DH0001 \
  -H "Content-Type: application/json" -d "{\"items\":[{\"productId\":\"SP01\",\"qty\":9}]}"
```

Với đơn đã xác nhận, bạn sẽ thấy `200` trong khi `BR-08` nói phải chặn bằng mọi đường. Đây là
**BUG-3**. Neo: `BR-08`. ⇒ **FAIL**, tầng `backend`.

### Trục 6 — Đồng thời

> *Hai người làm cùng lúc thì sao?*

```bash
curl -s -X POST http://localhost:4010/api/reset > /dev/null
for i in 1 2; do
  curl -s -X POST http://localhost:4010/api/orders -H "Content-Type: application/json" \
    -d "{\"customerId\":\"KH01\",\"items\":[{\"productId\":\"SP02\",\"qty\":1}]}" -o /dev/null &
done; wait
curl -s http://localhost:4010/api/_store/orders
```

**Bạn sẽ thấy hai đơn**: `DH0001` và `DH0002`. Người dùng bấm hai lần, hoặc mạng chậm nên client gửi lại —
ra hai đơn.

Đây là bug? **Chưa kết luận được.** Đọc `spec.md`: không có luật nào về chống trùng. Không có mã luật để neo.

⇒ Trục 6 cho ra một **`OBSERVATION`**, không phải FAIL. Và nó dẫn thẳng sang trục 7.

### Trục 7 — Chiều ngược: `spec:gap`

> *Ứng dụng làm gì mà đặc tả không nói?*

Sáu trục trên đi từ case ra ứng dụng. Trục 7 đi ngược: từ ứng dụng ra đặc tả.

```json
{
  "id": "GAP-001",
  "loai": "spec:gap",
  "quanSat": "Gửi 2 request tạo đơn giống nhau cùng lúc ⇒ tạo 2 đơn riêng (DH0001, DH0002)",
  "specNoiGi": "spec.md không có luật nào về chống trùng / idempotency khi tạo đơn",
  "viSaoQuanTrong": "Không biết đây là hành vi đúng hay thiếu chốt ⇒ KHÔNG kiểm được, và không thể log bug",
  "evidence": "outputs/tasks/DEMO-1/evidence/GAP-001-hai-don-trung.png",
  "hoiAi": "BA",
  "trangThai": "cho-tra-loi"
}
```

**Điều vừa xảy ra:** bạn tìm ra một chỗ có thật, quan trọng, và đúng đắn khi không kết luận. Nếu bạn
log nó thành bug, Dev sẽ hỏi *"spec nào nói vậy?"* và bạn không trả lời được, bug bị Rejected, và lần sau
người ta tin bạn ít hơn.

`spec:gap` giữ được giá trị của phát hiện mà không phải trả giá đó.

### Bảng thu hoạch

| Trục | Tìm ra gì | Neo | Kết luận |
|---|---|---|---|
| 1 · field cùng khối | 4 số đều khớp | `BR-01`…`BR-04` | PASS |
| 2 · cùng giá trị khác nơi hiển thị | UI 8.000 ≠ lưu 8.750 | `UI-04` | **FAIL** · frontend |
| 3 · chuỗi 4 tầng | thấy chỗ giá trị đổi được | — | (dẫn sang Bài 10) |
| 4 · biến thể | mốc 500.000 hạng Bạc sai phí | `BR-03` | **FAIL** · backend |
| 5 · trạng thái kế cận | sửa được đơn đã xác nhận | `BR-08` | **FAIL** · backend |
| 6 · đồng thời | 2 request ⇒ 2 đơn | **không có** | `OBSERVATION` |
| 7 · chiều ngược | spec không nói gì về chống trùng | — | **`spec:gap`** |

Bảy trục quanh một case đã PASS tìm ra cả ba bug cài sẵn cộng một lỗ hổng đặc tả. Đó là toàn bộ lập
luận của bài này.

## Việc 3 — Luật sống còn: không neo thì là `OBSERVATION` (20 phút)

Mở rộng có một mặt tối, và nó nguy hiểm đúng bằng mức nó hữu ích:

> Mở rộng mà không có oracle = tautology nhân 7 lần.

Bài 13 dạy: lấy giá trị app làm kết quả mong đợi thì test luôn xanh. Mở rộng làm việc đó rộng ra bảy lần,
vì mỗi trục là một cơ hội mới để so app với chính app.

### Cái bẫy cụ thể của trục 2

Trục 2 hỏi *"giá trị này ở màn khác có khớp không?"*. Rất dễ làm thế này:

```
Màn A hiện 1.000.000. Màn B hiện 1.000.000. ⇒ khớp ⇒ PASS
```

Nhưng nếu `BR` nói cả hai phải là `1.100.000` (có phí), thì hai màn cùng sai và bạn vừa ghi PASS cho một
bug.

> Nhất quán không phải bằng chứng của đúng. Nó chỉ là bằng chứng của **cùng-một-nguồn**.

Nên luật là:

| Có neo được vào mã luật? | Kết luận cho phép |
|---|---|
| **Có** (`BR-`, `UI-`, `SM-`, `FSD-`…) | `PASS` hoặc `FAIL` |
| **Không** | **chỉ** `OBSERVATION` — hoặc nâng thành `spec:gap` nếu đáng hỏi BA |

Và `OBSERVATION` không được đếm vào độ phủ, không log bug, không làm case đỏ. Nó là một dòng ghi
chú có bằng chứng, chờ có neo.

## Việc 4 — Xây gate (35 phút)

Luật ở Việc 3 bị vi phạm theo phản xạ. Thấy hai màn giống nhau là ghi PASS. Nên cần máy.

### Định dạng phát hiện mở rộng

`outputs/tasks/<MÃ>/test-results/mo-rong.json`:

```json
[
  { "id": "MR-001", "caseGoc": "TC_012", "truc": "field-cung-khoi",
    "quanSat": "Tạm tính/Giảm giá/Phí đều khớp công thức", "oracleRef": "BR-01,BR-04",
    "ketLuan": "PASS", "evidence": "evidence/MR-001.png" },
  { "id": "MR-002", "caseGoc": "TC_012", "truc": "cung-gia-tri-khac-man",
    "quanSat": "UI hiện Giảm giá 8.000, tầng lưu trữ ghi 8750", "oracleRef": "UI-04",
    "ketLuan": "FAIL", "tangLoi": "frontend", "evidence": "evidence/MR-002.png" },
  { "id": "MR-003", "caseGoc": "TC_012", "truc": "dong-thoi",
    "quanSat": "2 request tạo đơn cùng lúc ⇒ 2 đơn", "oracleRef": "",
    "ketLuan": "OBSERVATION", "evidence": "evidence/MR-003.png" }
]
```

### Gate

```js
#!/usr/bin/env node
/*
 * gate-mo-rong.js — mở rộng phải neo được mới kết luận, và phải phủ đủ trục.
 *
 * 1. Chặn kiểu sai nào: ghi PASS/FAIL cho một phát hiện KHÔNG neo được vào mã luật —
 *    tức biến "hai chỗ giống nhau" thành "đúng" (tautology nhân 7 lần).
 * 2. Đo cái gì: mo-rong.json — mỗi phát hiện có oracleRef không, trục có hợp lệ không,
 *    FAIL có bằng chứng và tầng lỗi không, và phủ được mấy trục.
 * 3. Cửa: trước khi đẩy kết quả và trước khi log bug.
 * 4. Không đo được: thiếu tệp ⇒ mã 2 (chưa ai mở rộng ≠ mở rộng xong không thấy gì).
 * 5. Đối chứng: OBSERVATION không neo ⇒ QUA · PASS không neo ⇒ CHẶN · phủ 1/7 trục ⇒ CHẶN.
 *
 * Mã thoát:  0 = đạt  ·  1 = vi phạm  ·  2 = không đo được
 */
'use strict';
const fs = require('fs');
const path = require('path');

/* Mã neo hợp lệ. Khai TƯỜNG MINH: thêm tiền tố mới thì sửa ở đây, không rải regex khắp nơi. */
const NEO = /^(BR|UI|SM|FSD|SPEC)[-_][A-Za-z0-9-]+$/;

const TRUC = ['field-cung-khoi', 'cung-gia-tri-khac-man', 'chuoi-form-api-luu-ui',
  'bien-the', 'trang-thai-ke-can', 'dong-thoi', 'chieu-nguoc'];

/* Số trục tối thiểu theo mức rủi ro. Case rủi ro thấp mở 7 trục thì nổ thời gian chạy;
   case rủi ro cao mở 2 trục thì gate độ phủ nói dối. */
const TOI_THIEU = { high: 6, medium: 4, low: 2 };

const file = process.argv[2];
const band = (process.argv[3] || 'medium').toLowerCase();
if (!file) {
  console.error('Dùng: node scripts/qa/gate-mo-rong.js <mo-rong.json> [high|medium|low]');
  process.exit(2);
}
if (!fs.existsSync(file)) {
  console.error(`[mo-rong] KHÔNG ĐO ĐƯỢC: không thấy ${file}`);
  console.error('  Chưa có tệp này nghĩa là CHƯA AI MỞ RỘNG — khác với "mở rộng rồi mà không thấy gì".');
  process.exit(2);
}
if (!TOI_THIEU[band]) {
  console.error(`[mo-rong] KHÔNG ĐO ĐƯỢC: mức rủi ro lạ "${band}" — phải là high|medium|low`);
  process.exit(2);
}

let ds;
try { ds = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error('[mo-rong] KHÔNG ĐO ĐƯỢC: JSON hỏng — ' + e.message); process.exit(2); }
if (!Array.isArray(ds)) { console.error('[mo-rong] KHÔNG ĐO ĐƯỢC: tệp phải là một mảng'); process.exit(2); }

const goc = path.dirname(path.dirname(file));      // .../tasks/<MÃ>/
const loi = [];

for (const p of ds) {
  const nhan = p.id || '(không id)';
  if (!TRUC.includes(p.truc)) {
    loi.push(`${nhan}: trục lạ "${p.truc}" — phải là một trong ${TRUC.join(' | ')}`);
  }
  if (!String(p.quanSat || '').trim()) loi.push(`${nhan}: thiếu "quanSat" — không ghi thấy gì thì phát hiện vô dụng`);

  const refs = String(p.oracleRef || '').split(',').map((s) => s.trim()).filter(Boolean);
  const coNeo = refs.length > 0 && refs.every((r) => NEO.test(r));
  if (refs.length && !coNeo) {
    loi.push(`${nhan}: oracleRef "${p.oracleRef}" không đúng dạng mã luật (vd BR-03, UI-04)`);
  }

  if (p.ketLuan === 'PASS' || p.ketLuan === 'FAIL') {
    if (!coNeo) {
      loi.push(`${nhan}: kết luận ${p.ketLuan} mà KHÔNG có oracleRef ⇒ phải hạ xuống OBSERVATION. ` +
        'Nhất quán không phải bằng chứng của đúng.');
    }
  } else if (p.ketLuan !== 'OBSERVATION') {
    loi.push(`${nhan}: kết luận lạ "${p.ketLuan}" — chỉ có PASS | FAIL | OBSERVATION`);
  }

  if (p.ketLuan === 'FAIL') {
    if (!String(p.tangLoi || '').trim()) loi.push(`${nhan}: FAIL mà không khoanh tầng lỗi`);
    if (!String(p.evidence || '').trim()) loi.push(`${nhan}: FAIL mà không có bằng chứng`);
  }
  // Bằng chứng phải TỒN TẠI trên đĩa, không chỉ có đường dẫn trong JSON
  if (p.evidence) {
    const f = path.join(goc, p.evidence);
    if (!fs.existsSync(f)) loi.push(`${nhan}: bằng chứng không tồn tại — ${p.evidence}`);
    else if (!/\.(png|jpe?g|webp|mp4|webm)$/i.test(f)) loi.push(`${nhan}: bằng chứng phải là ảnh/video — ${p.evidence}`);
  }
}

/* Độ phủ trục: mở một trục rồi báo "đã mở rộng" là không đủ. */
const dem = TRUC.map((t) => ({ t: t, n: ds.filter((p) => p.truc === t).length }));
const daPhu = dem.filter((d) => d.n > 0).length;
console.log(`[mo-rong] ${ds.length} phát hiện · phủ ${daPhu}/${TRUC.length} trục · mức rủi ro ${band} (cần ≥${TOI_THIEU[band]})`);
console.log('  ' + dem.map((d) => `${d.t}=${d.n}`).join(' · '));
if (daPhu < TOI_THIEU[band]) {
  loi.push(`chỉ phủ ${daPhu}/${TRUC.length} trục, mức ${band} cần ≥${TOI_THIEU[band]} — thiếu: ` +
    dem.filter((d) => d.n === 0).map((d) => d.t).join(', '));
}

const q = (k) => ds.filter((p) => p.ketLuan === k).length;
console.log(`  PASS=${q('PASS')} · FAIL=${q('FAIL')} · OBSERVATION=${q('OBSERVATION')}`);

if (loi.length) {
  console.error(`\n[mo-rong] ✗ CHẶN — ${loi.length} vấn đề:`);
  for (const l of loi) console.error('  - ' + l);
  process.exit(1);
}
console.log('[mo-rong] ✓ ĐẠT');
```

### Thử nó — bốn lần

| Lần | Sửa gì | Kỳ vọng |
|---|---|---|
| 1 | tệp mẫu ở trên, mức `low` (cần ≥2 trục, đang có 3) | **`0`** |
| 2 | đổi `MR-003` từ `OBSERVATION` sang `PASS` (vẫn `oracleRef` rỗng) | **`1`** — đúng luật sống còn |
| 3 | chạy mức `high` (cần ≥6 trục, đang có 3) | **`1`** — thiếu độ phủ |
| 4 | xoá tệp | **`2`** — không đo được |

Lần 1 là đối chứng âm quan trọng nhất: `OBSERVATION` không có neo phải ĐI QUA. Nếu gate chặn cả nó thì
bạn vừa cấm luôn việc ghi lại quan sát. Và người ta sẽ đối phó bằng cách gán một `oracleRef` bừa.

### Gate độ sâu: không nổ thời gian chạy

Bảy trục cho mọi case là bất khả thi. Nên độ sâu bám mức rủi ro, chính bảng `TOI_THIEU` ở trên:

| Mức rủi ro | Trục tối thiểu | Lý do |
|---|---|---|
| `high` (đường tiền, đường không hoàn lại được) | 6/7 | lọt ở đây là mất tiền thật |
| `medium` | 4/7 | đủ để bắt lớp bug hay gặp |
| `low` (màn xem, không đổi dữ liệu) | 2/7 | mở 7 trục ở đây là tiêu thời gian vào chỗ rẻ |

Mức rủi ro từ đâu ra? Từ Bài 14 và Bài 27, không phải bạn tự chọn lúc chạy. Truyền tay là bạn sẽ luôn chọn
`low`.

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   └── mo-rong-truc.json             ← MỚI · 7 trục + số trục tối thiểu theo mức rủi ro
├── scripts/qa/
│   ├── gate-mo-rong.js               ← MỚI · không neo ⇒ OBSERVATION; thiếu trục ⇒ chặn
│   └── tu-soi.js                ← SỬA · gọi thêm gate-mo-rong
└── outputs/tasks/<MÃ>/
    ├── test-results/
    │   ├── testcase-status.json      ← MỚI (thô) · Bài 17 mới phân tầng lỗi tử tế
    │   ├── mo-rong.json              ← MỚI · phát hiện mở rộng, có trục + neo + kết luận
    │   └── spec-gaps.json            ← MỚI · trục 7 — câu hỏi cho BA, KHÔNG log bug
    └── evidence/
        └── MR-*.png                  ← MỚI · mỗi FAIL của mở rộng cũng phải có bằng chứng
```

Để ý `spec-gaps.json` là tệp **riêng**, không lẫn vào `mo-rong.json`: nó đi tới **BA**, không đi tới đường log
bug. Trộn hai đường là cách sinh ra bug bị Rejected.

## Tự kiểm

1. Kể 7 trục. Trục nào đi **ngược** chiều với sáu trục kia?
2. Trên app thực hành, trục nào tìm ra BUG-1? BUG-2? BUG-3?
3. Vì sao mở trục 4 theo hạng khách mà không đi tới mốc biên thì vẫn không thấy BUG-1?
4. Hai màn cùng hiện `1.000.000` ⇒ kết luận được PASS chưa? Nêu bằng một câu.
5. Trục 6 tìm ra 2 đơn trùng. Vì sao đó không phải FAIL? Nó là gì?
6. Vì sao `OBSERVATION` không neo phải đi qua gate? Chặn nó thì hậu quả gì?
7. Case mức `low` cần mở mấy trục? Mức rủi ro đó lấy từ đâu, và vì sao không để người chạy tự chọn?

## Bài tập về nhà (30 phút)

Chọn một case đã PASS trên dự án thật của bạn. Mở đủ 7 trục, ghi ra `mo-rong.json`, rồi đếm:

| | Số |
|---|---|
| Phát hiện **neo được** (có mã luật) | ___ |
| Phát hiện không neo được (`OBSERVATION`) | ___ |
| `spec:gap` (spec không nói gì) | ___ |

Rồi trả lời hai câu:

1. Trục nào bạn **bỏ** đầu tiên khi hết thời gian? Đó thường là trục **đồng thời** và chiều ngược, và
   đó cũng là hai trục bug hay lọt nhất.
2. Trong các `OBSERVATION`, có cái nào bạn **muốn** ghi thành FAIL không? Nếu có, đi tìm mã luật. Không tìm
   được thì đó chính là một `spec:gap`, và nó có giá trị cao hơn một bug bị Rejected.

## Đọc thêm

- Bài 10 — [UI ↔ Database](ui-va-tang-luu-tru.md): trục 3 làm kỹ, cộng bảng bốn ô khoanh tầng lỗi.
- Bài 13 — [oracle](oracle.md): "nhất quán ≠ đúng" ở đây là bảy lần cơ hội vi phạm nó.
- Bài 25 — [mutation testing](do-chinh-bo-kiem.md): đo xem suite của bạn **thật sự** bắt được bao nhiêu, và
  biến luật *"bug lọt = lỗi của máy"* thành con số.

## Bài sau

Bài 17 lo phần sau khi có case đỏ. Một testcase Failed chưa đồng nghĩa với một Bug, và chặng nằm giữa
hai thứ đó là chặng hay bị bỏ nhất.
