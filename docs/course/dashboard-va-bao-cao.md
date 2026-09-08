# Dashboard và báo cáo

> **1 giờ** · Có gì trong tay: nhiều lượt chạy đã ghi metrics · Sau bài này: một trang tự chứa cho người không có quyền vào công cụ, và biết vì sao dashboard không bao giờ là nguồn

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Sếp không có quyền vào công cụ. Còn bảng số thì không cho thấy đang tốt lên hay xấu đi. |
| **Bài này bạn gõ gì** | Viết máy sinh một trang HTML gọn, chỉ 3 đường, và soạn mẫu báo cáo 4 phần. |
| **Xong thì được gì** | Nhìn một cái là biết tháng này kit khá hơn hay kém đi. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Artifact** | Thứ **sinh ra** từ dữ liệu. Xoá đi sinh lại được, y hệt |
| **Tự chứa** | Một tệp `.html` mở được offline, không gọi ra mạng |

## Bài này bạn sẽ làm gì

Ba việc:

1. Hiểu vì sao dashboard là **artifact**, không phải nguồn (10 phút).
2. Sinh dashboard tự chứa từ dữ liệu đã có (35 phút).
3. Viết báo cáo cho người không có quyền vào công cụ (15 phút).

---

## Việc 1 — Dashboard là artifact, không phải nguồn (10 phút)

Luật một câu:

> Dashboard sinh ra từ dữ liệu. Sửa số trên dashboard là sửa bản photo.

Nghe hiển nhiên, nhưng nó bị vi phạm theo ba cách rất tự nhiên:

| Cách vi phạm | Nghe có vẻ hợp lý | Hỏng ở đâu |
|---|---|---|
| Sửa tay một con số cho "đúng thực tế" | *"case này rõ ràng pass mà"* | lần sinh sau số quay lại — hoặc tệ hơn, không quay lại và không ai biết vì sao |
| Nhập tay dữ liệu không có ở đâu khác | *"tiện, khỏi phải ghi hai chỗ"* | dashboard thành nguồn duy nhất, mà nó lại là thứ hay bị xoá đi sinh lại |
| Gửi ảnh chụp dashboard làm bằng chứng | *"nhìn là thấy"* | ảnh chụp một con số không chứng minh người dùng thấy gì (Bài 17) |

Nên hai quy tắc cho mọi dashboard:

1. Xoá đi sinh lại được, y hệt. Không được thì có dữ liệu đang chỉ sống ở đó, đưa nó về nơi đúng trước.
2. Không có ô nhập liệu. Dashboard chỉ đọc. Muốn sửa số thì sửa nguồn.

## Việc 2 — Sinh dashboard tự chứa (35 phút)

Ba đường cần vẽ, đúng ba đường ở cuối Bài 25, không hơn:

| Đường | Tụt/tăng thì nghĩa là |
|---|---|
| Mutation score | tụt ⇒ có oracle vừa bị làm yếu đi |
| Khoảng cách clean ↔ eventual | tăng ⇒ suite lệ thuộc retry hơn |
| Số test hạng `chap-chon` trở xuống | tăng ⇒ nợ kỹ thuật đang tích |

> Đừng vẽ thêm. Mỗi biểu đồ không đổi được hành động là một biểu đồ làm loãng ba cái quan trọng. Câu hỏi
> trước khi thêm bất cứ đường nào: *"đường này đi xuống thì tôi làm gì khác đi?"* — không trả lời được thì
> đừng vẽ.

```js
#!/usr/bin/env node
/*
 * sinh-dashboard.js — sinh MỘT tệp .html tự chứa từ lịch sử metrics.
 *
 * VÌ SAO TỰ CHỨA: người nhận thường không có quyền vào công cụ, và hay mở tệp khi không có mạng.
 * Tệp gọi ra CDN sẽ trắng trơn đúng lúc cần nhìn nhất.
 *
 * VÌ SAO VẼ BẰNG SVG TAY, KHÔNG DÙNG THƯ VIỆN: ba đường thẳng thì thư viện biểu đồ là 300 KB
 * để làm việc của 30 dòng — và nó kéo theo phụ thuộc mạng.
 *
 * Mã thoát: 0 = sinh xong · 1 = lỗi ghi · 2 = không đủ dữ liệu
 */
'use strict';
const fs = require('fs');
const path = require('path');

const LICH_SU = process.env.METRICS_HISTORY || 'outputs/metrics/lich-su.json';
const RA = process.argv[2] || 'outputs/metrics/dashboard.html';

if (!fs.existsSync(LICH_SU)) {
  console.error(`[dashboard] KHÔNG ĐO ĐƯỢC: không thấy ${LICH_SU}`);
  console.error('  Mỗi lượt chạy phải ghi thêm một mốc vào đây. Chưa có lịch sử thì không có xu hướng.');
  process.exit(2);
}

let ds;
try { ds = JSON.parse(fs.readFileSync(LICH_SU, 'utf8')); }
catch (e) { console.error('[dashboard] KHÔNG ĐO ĐƯỢC: JSON hỏng — ' + e.message); process.exit(2); }
if (!Array.isArray(ds) || ds.length < 2) {
  console.error(`[dashboard] KHÔNG ĐO ĐƯỢC: cần ít nhất 2 mốc để có xu hướng, đang có ${(ds || []).length}.`);
  console.error('  Một điểm không phải là đường — đừng vẽ khi chưa có gì để so.');
  process.exit(2);
}

ds.sort((a, b) => String(a.ngay).localeCompare(String(b.ngay)));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Vẽ một đường bằng SVG. cao=1 là đỉnh khung. Trả về chuỗi SVG hoàn chỉnh. */
function ve(diem, mau, nhan, dinh) {
  const W = 720, H = 160, L = 44, B = 26;
  const max = dinh || Math.max(...diem.map((d) => d.y), 0.0001);
  const x = (i) => L + (i * (W - L - 10)) / Math.max(1, diem.length - 1);
  const y = (v) => H - B - (v / max) * (H - B - 12);

  const duong = diem.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.y).toFixed(1)}`).join(' ');
  const cham = diem.map((d, i) =>
    `<circle cx="${x(i).toFixed(1)}" cy="${y(d.y).toFixed(1)}" r="3.5" fill="${mau}">` +
    `<title>${esc(d.nhan)}: ${esc(d.hienThi)}</title></circle>`).join('');
  const moc = [0, 0.5, 1].map((f) =>
    `<line x1="${L}" y1="${y(max * f)}" x2="${W - 10}" y2="${y(max * f)}" stroke="#E6E0D5" stroke-dasharray="3 4"/>` +
    `<text x="6" y="${(y(max * f) + 4).toFixed(1)}" font-size="10" fill="#79736A">${(max * f).toFixed(2)}</text>`).join('');

  return `<figure class="ch"><figcaption>${esc(nhan)}</figcaption>
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(nhan)}">
${moc}<path d="${duong}" fill="none" stroke="${mau}" stroke-width="2.5"/>${cham}
</svg>
<p class="last">gần nhất: <b>${esc(diem[diem.length - 1].hienThi)}</b> · ${esc(diem[diem.length - 1].nhan)}</p>
</figure>`;
}

const pc = (v) => (v * 100).toFixed(1) + '%';
const diemTu = (key, dinhDang) => ds.map((d) => ({
  y: Number(d[key] || 0), nhan: d.ngay, hienThi: dinhDang(Number(d[key] || 0))
}));

/* So mốc gần nhất với mốc trước — đây là thứ người đọc cần, không phải giá trị tuyệt đối. */
function xuHuong(key, tangLaTot) {
  const a = Number(ds[ds.length - 2][key] || 0), b = Number(ds[ds.length - 1][key] || 0);
  const d = b - a;
  if (Math.abs(d) < 1e-9) return { chu: 'không đổi', lop: 'giu' };
  const tot = tangLaTot ? d > 0 : d < 0;
  return { chu: (d > 0 ? '▲ ' : '▼ ') + Math.abs(d).toFixed(3), lop: tot ? 'tot' : 'xau' };
}

const t1 = xuHuong('mutationScore', true);
const t2 = xuHuong('gapRetry', false);
const t3 = xuHuong('soTestYeu', false);
const cuoi = ds[ds.length - 1];

const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sức khoẻ bộ kiểm — ${esc(cuoi.ngay)}</title>
<style>
 :root{--ink:#1A1916;--wash:#FAF8F3;--card:#fff;--line:#E6E0D5;--mo:#79736A;
       --tot:#1F8A5B;--xau:#D64545;--gold:#FFB700}
 *{box-sizing:border-box} body{margin:0;background:var(--wash);color:var(--ink);
  font:15px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
 main{max-width:860px;margin:0 auto;padding:24px}
 h1{font-size:20px;margin:0 0 4px} .sub{color:var(--mo);font-size:13px;margin:0 0 20px}
 .kpis{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:22px}
 .kpi{background:var(--card);border:1px solid var(--line);border-top:3px solid var(--gold);
  border-radius:12px;padding:14px}
 .kpi b{display:block;font-size:26px;line-height:1.2} .kpi span{font-size:12.5px;color:var(--mo)}
 .kpi .d{font-size:12.5px;font-weight:700} .d.tot{color:var(--tot)} .d.xau{color:var(--xau)} .d.giu{color:var(--mo)}
 .ch{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 12px;margin:0 0 14px}
 figcaption{font-size:13.5px;font-weight:700;margin-bottom:6px} svg{width:100%;height:auto;display:block}
 .last{margin:6px 0 0;font-size:12.5px;color:var(--mo)}
 .note{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--gold);
  border-radius:12px;padding:14px;font-size:13.5px;color:var(--mo)}
 @media (prefers-color-scheme:dark){
  :root{--ink:#F5F1E8;--wash:#141310;--card:#1F1D19;--line:#39352D;--mo:#8E877B}}
</style></head><body><main>
<h1>Sức khoẻ bộ kiểm</h1>
<p class="sub">Sinh tự động từ <code>${esc(LICH_SU)}</code> · ${ds.length} mốc · gần nhất ${esc(cuoi.ngay)}.
Đây là <b>artifact</b>: xoá đi sinh lại được. Muốn sửa số thì sửa nguồn, đừng sửa trang này.</p>

<div class="kpis">
 <div class="kpi"><span>Mutation score</span><b>${pc(cuoi.mutationScore || 0)}</b>
   <span class="d ${t1.lop}">${t1.chu} so mốc trước</span></div>
 <div class="kpi"><span>Lệ thuộc retry</span><b>${pc(cuoi.gapRetry || 0)}</b>
   <span class="d ${t2.lop}">${t2.chu} so mốc trước</span></div>
 <div class="kpi"><span>Test chập chờn trở xuống</span><b>${Number(cuoi.soTestYeu || 0)}</b>
   <span class="d ${t3.lop}">${t3.chu} so mốc trước</span></div>
</div>

${ve(diemTu('mutationScore', pc), '#1F8A5B', 'Mutation score — suite có bắt được bug không', 1)}
${ve(diemTu('gapRetry', pc), '#D64545', 'Khoảng cách clean ↔ eventual — mức lệ thuộc retry', null)}
${ve(diemTu('soTestYeu', (v) => String(v)), '#F59E0B', 'Số test chập chờn trở xuống', null)}

<p class="note"><b>Đọc thế nào.</b> Đường 1 đi xuống ⇒ có oracle vừa bị làm yếu.
Đường 2 đi lên ⇒ suite đang lệ thuộc retry hơn — kiểm xem có bug app bị chôn dưới nhãn "flaky" không.
Đường 3 đi lên ⇒ nợ kỹ thuật đang tích. Ba đường này là <b>toàn bộ</b> — thêm biểu đồ chỉ làm loãng chúng.</p>
</main></body></html>`;

try {
  fs.mkdirSync(path.dirname(RA), { recursive: true });
  fs.writeFileSync(RA, html);
} catch (e) { console.error('[dashboard] ✗ lỗi ghi: ' + e.message); process.exit(1); }

/* Tự kiểm điều kiện "tự chứa" — đừng chỉ tin là mình đã viết đúng. */
const hostNgoai = (html.match(/(?:src|href)\s*=\s*["']https?:\/\/[^"']+/g) || []);
if (hostNgoai.length) {
  console.error('[dashboard] ✗ trang gọi ra host ngoài — sẽ trắng khi không có mạng:');
  for (const h of hostNgoai) console.error('    ' + h);
  process.exit(1);
}
console.log(`[dashboard] ✓ ${RA} · ${ds.length} mốc · ${(html.length / 1024).toFixed(0)} KB · 0 host ngoài`);
```

Lịch sử metrics, mỗi lượt chạy ghi thêm một dòng:

```json
[
  { "ngay": "2026-07-01", "mutationScore": 0.60, "gapRetry": 0.04, "soTestYeu": 3 },
  { "ngay": "2026-08-01", "mutationScore": 0.72, "gapRetry": 0.07, "soTestYeu": 5 },
  { "ngay": "2026-09-01", "mutationScore": 0.68, "gapRetry": 0.16, "soTestYeu": 9 }
]
```

```bash
node scripts/qa/sinh-dashboard.js outputs/metrics/dashboard.html
```

**Bạn sẽ thấy:**

```
[dashboard] ✓ outputs/metrics/dashboard.html · 3 mốc · 5 KB · 0 host ngoài
```

Mở tệp. Với dữ liệu mẫu trên, trang kể một câu chuyện rất rõ: mutation score **tụt** từ 0.72 xuống 0.68,
lệ thuộc retry tăng gấp đôi, số test yếu gần **gấp đôi**. Ba mũi tên đỏ cùng lúc, và đó là thứ một bảng
số không nói được.

### Ba chi tiết trong mã đáng chú ý

| Chi tiết | Vì sao |
|---|---|
| Dưới 2 mốc ⇒ **mã 2** | một điểm không phải là đường. Vẽ nó là gợi ý một xu hướng không tồn tại |
| **Tự kiểm** `0 host ngoài` sau khi ghi | đừng tin là mình viết đúng — đo lại. Đây là đối chứng cho chính máy sinh |
| So với **mốc trước**, không phải giá trị tuyệt đối | `68%` không nói gì; `▼ 0.04` nói phải đi tìm nguyên nhân |

## Việc 3 — Báo cáo cho người không có quyền (15 phút)

Sếp, PM, khách. Họ không có tài khoản công cụ test-management, và họ không đọc dashboard kỹ thuật.

Bốn phần, đúng thứ tự này:

```markdown
# Kết quả kiểm thử — <Sprint/Story> — <ngày>

## 1. Kết luận một câu
Chức năng Tạo đơn hàng **chưa nên phát hành**: còn 1 lỗi tính tiền ở mốc 500.000 (PROJ-1234).

## 2. Con số
| | |
|---|---|
| Đã kiểm | 42 / 42 case |
| Đạt | 39 |
| Không đạt | 3 — trong đó **1 chặn phát hành** |
| Chưa kiểm được | 0 |

## 3. Cái gì hỏng, ảnh hưởng ai
| Lỗi | Ảnh hưởng | Mức |
|---|---|---|
| Phí giao hàng tính sai ở mốc 500.000 | khách hạng Bạc bị thu thừa 30.000đ/đơn | **chặn** |
| Số trên màn không cộng khớp | khách thấy số lệch, gọi hỗ trợ | cao |
| Sửa được đơn đã xác nhận qua API | dữ liệu đơn đổi sau khi chốt | cao |

## 4. Cần gì để đi tiếp
- Dev sửa PROJ-1234 → kiểm lại 6 case (~2 giờ)
- BA trả lời: có chống trùng đơn khi bấm hai lần không? (chưa có trong đặc tả)
```

Bốn nguyên tắc:

| Nguyên tắc | Vì sao |
|---|---|
| **Kết luận đứng đầu** | người đọc quyết định trong 10 giây đầu; đừng bắt họ tự suy ra |
| **"Ảnh hưởng ai"**, không phải tên lỗi kỹ thuật | *"khách hạng Bạc bị thu thừa 30.000đ"* ≠ *"BR-03 sai"* |
| **Nêu cả chỗ chưa kiểm được** | im lặng về nó là để người đọc tưởng đã phủ hết |
| **Nói cần gì để đi tiếp** | báo cáo không có bước tiếp theo thì chỉ là lời than |

Và: không đính ảnh chụp dashboard làm bằng chứng cho một case. Bằng chứng cho case là ảnh/video màn hình
thật, có khoanh đỏ (Bài 17). Dashboard là bức tranh tổng, không phải chứng cứ.

## Cây thư mục sau bài này

```
kit-cua-toi/
├── scripts/qa/
│   └── sinh-dashboard.js             ← MỚI · sinh 1 tệp .html tự chứa, TỰ KIỂM 0 host ngoài
├── prompt_templates/phase2/
│   └── 09_bao_cao_stakeholder.md     ← MỚI · 4 phần, kết luận đứng đầu
└── outputs/metrics/                  ·  ⛔ KHÔNG commit
    ├── lich-su.json                  ← MỚI · mỗi lượt ghi thêm MỘT mốc
    └── dashboard.html                ← MỚI · artifact — xoá đi sinh lại được y hệt
```

`lich-su.json` nằm trong `outputs/` nên không lên git, nhưng Bài 27 đã khai nó giữ **365 ngày** và
`mutation-diem` thì không bao giờ tỉa, vì mất chúng là mất đường xu hướng.

## Tự kiểm

1. Vì sao dashboard là artifact? Hai quy tắc đi kèm là gì?
2. Ba đường đáng vẽ là gì? Câu hỏi nào lọc mọi đường khác?
3. Vì sao dưới 2 mốc thì máy **từ chối** vẽ?
4. Vì sao trang phải tự chứa? Máy tự kiểm điều đó bằng cách nào?
5. Vì sao so với **mốc trước** thay vì hiện giá trị tuyệt đối?
6. Bốn phần của báo cáo stakeholder, kể theo đúng thứ tự và nói vì sao thứ tự đó.
7. Vì sao không đính ảnh dashboard làm bằng chứng cho một case?

## Bài tập về nhà (20 phút)

1. Ghi mốc metrics đầu tiên cho dự án bạn vào `lich-su.json`. Một mốc thôi, dashboard sẽ **từ chối** vẽ, và
   đó là hành vi đúng. Tuần sau ghi mốc thứ hai rồi chạy lại.
2. Viết báo cáo 4 phần cho lượt chạy gần nhất. Rồi đưa cho một người không làm QA đọc và hỏi họ một
   câu: *"theo bạn, cái này nên phát hành chưa?"*
   - Trả lời được ngay ⇒ báo cáo đạt.
   - Phải đọc lại hoặc hỏi thêm ⇒ phần 1 của bạn chưa phải một câu kết luận.
3. Nhìn dashboard mẫu ở Việc 2 (ba mũi tên đỏ). Viết ra **ba việc** bạn sẽ làm tuần sau. Không viết nổi thì
   đường đó không đáng vẽ.

## Đọc thêm

- Bài 25 — [metrics và độ tin cậy](metrics-va-do-tin-cay.md): ba đường này tính ở đó.
- Bài 25 — [mutation testing](do-chinh-bo-kiem.md): đường quan trọng nhất, và cách đọc điểm cho đúng.
- Bài 27 — [sao lưu và vòng đời dữ liệu](sao-luu-va-vong-doi-du-lieu.md): vì sao `lich-su.json` không được tỉa.
