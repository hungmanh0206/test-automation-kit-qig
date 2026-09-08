# Bài 3 — Chi phí và giới hạn thật

> **1 giờ** · Có gì trong tay: khung kit, một rule canonical · Sau bài này: đo được tài liệu trước khi đọc, và biết khi nào giao việc cho subagent

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Bạn đưa cả thư mục tài liệu cho agent. Nó đọc thiếu. Và không có gì báo cho bạn biết. |
| **Bài này bạn gõ gì** | Viết một máy đo cỡ tài liệu, chạy thử trên hai thư mục to nhỏ khác nhau. |
| **Xong thì được gì** | Biết trước tài liệu nào đọc thẳng được, tài liệu nào phải nhờ agent con trích ra. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Token** | Đơn vị agent đọc/viết. Xấp xỉ: **1 token ≈ 3 ký tự** với tiếng Việt, ≈ 4 với tiếng Anh |
| **Ngữ cảnh** (context) | Toàn bộ chữ agent đang "nhìn thấy" trong một phiên. Có giới hạn, và giới hạn đó là thật |
| **Subagent** | Một phiên con, ngữ cảnh riêng, làm một việc rồi trả về **kết luận** — không trả về toàn bộ thứ nó đã đọc |

## Bài này bạn sẽ làm gì

Ba việc:

1. Đo một tài liệu và tự tính nó tốn bao nhiêu ngữ cảnh (20 phút).
2. Viết máy đo tài liệu, trả về **khuyến nghị chiến lược** thay vì chỉ con số (25 phút).
3. Học cái bẫy đắt nhất: tài liệu đọc thiếu mà **không có tín hiệu nào báo** (15 phút).

Bài này không dạy tiết kiệm tiền. Nó dạy **đừng để agent đọc thiếu mà bạn không biết** — vì đó là nguồn của cả
một lớp lỗi mà bạn không thể debug: agent kết luận trên một nửa tài liệu, rất tự tin, và không nói gì.

---

## Việc 1 — Đo trước khi đọc (20 phút)

Trước khi đưa bất cứ tài liệu nào cho agent, hỏi một câu: **nó to bao nhiêu?**

Lấy chính đặc tả của app thực hành:

```bash
wc -c docs/course/assets/app-thuc-hanh/spec.md
```

**Bạn sẽ thấy** một số quanh `5000` — tức khoảng 5 KB.

Giờ tính nhẩm:

| Bước | Cách tính | Kết quả |
|---|---|---|
| Cỡ tệp | `wc -c` | ~5.000 ký tự |
| Token xấp xỉ | `ký tự ÷ 3` (tiếng Việt) | ~1.700 token |
| Phần trăm ngữ cảnh | so với giới hạn phiên của bạn | rất nhỏ |

Kết luận: đọc thẳng, không cần nghĩ.

Giờ thử một thứ khác — toàn bộ mã nguồn kit:

```bash
find scripts -name "*.js" -exec wc -c {} + | tail -1
```

**Bạn sẽ thấy** một số lớn hơn nhiều — hàng trăm KB. Nếu bạn nói *"đọc hết `scripts/` rồi cho tôi biết…"*
thì một trong ba chuyện xảy ra:

| Chuyện | Dấu hiệu bạn nhận được |
|---|---|
| Agent đọc hết, ngữ cảnh chật, chất lượng tụt ở phần sau | **Không có dấu hiệu nào** |
| Agent tự chọn đọc một phần | Đôi khi nó nói, đôi khi không |
| Công cụ cắt bớt giữa đường | Tuỳ công cụ, có khi im lặng |

Ba dòng trên đều tệ vì cùng một lý do: **bạn không biết nó đã đọc gì.**

### Ba nhóm chi phí, xếp theo mức đáng lo

| Nhóm | Thực tế | Đáng lo? |
|---|---|---|
| Câu hỏi ngắn, sửa vài dòng | rẻ | không |
| Đọc tài liệu dài, sinh 200 testcase | trung bình | vừa — quản bằng đo trước |
| **Đọc lại cùng một tài liệu 10 lần trong 10 phiên** | đắt nhất, và hay xảy ra nhất | **có** |

Nhóm thứ ba là thứ bộ nhớ dự án (Bài 17–18) giải: **trích một lần, ghi ra đĩa, lần sau đọc bản trích.**

## Việc 2 — Máy đo tài liệu (25 phút)

Đo tay được một tệp. Một thư mục tài liệu 40 tệp thì cần máy. Và điều đáng có không phải con số — mà là
**khuyến nghị làm gì với con số đó**.

Tạo `scripts/utils/do-tai-lieu.js`:

```js
#!/usr/bin/env node
/*
 * do-tai-lieu.js — đo cỡ tài liệu và trả về KHUYẾN NGHỊ, không chỉ con số.
 *
 * VÌ SAO CẦN KHUYẾN NGHỊ: con số "180 KB" không nói cho ai điều gì. Câu "vượt ngưỡng đọc thẳng,
 * giao subagent trích ra rồi đọc bản trích" thì nói được.
 *
 * Mã thoát:  0 = trong ngưỡng đọc thẳng  ·  1 = vượt ngưỡng, PHẢI đổi cách  ·  2 = không đo được
 */
'use strict';
const fs = require('fs');
const path = require('path');

/* Ngưỡng khai TƯỜNG MINH, không rải trong code. Con số theo kinh nghiệm, không phải hằng số vũ trụ —
   dự án của bạn có thể khác, nhưng phải khai ra để đổi được ở MỘT chỗ. */
const NGUONG = {
  kyTuTrenToken: 3,          // tiếng Việt nhiều dấu, xấp xỉ 3 ký tự/token
  docThang: 40 * 1024,       // dưới 40 KB: đưa thẳng vào prompt
  trichTruoc: 200 * 1024     // 40–200 KB: giao subagent trích; trên nữa: chia theo mục
};

const dich = process.argv[2];
if (!dich || !fs.existsSync(dich)) {
  console.error('[do-tai-lieu] KHÔNG ĐO ĐƯỢC: không thấy đường dẫn. Dùng: node scripts/utils/do-tai-lieu.js <file|thư-mục>');
  process.exit(2);
}

/** Liệt kê tệp văn bản, bỏ nhị phân và bỏ node_modules. */
function liet(p, ra) {
  const st = fs.statSync(p);
  if (st.isFile()) {
    if (/\.(md|txt|json|ya?ml|csv|html?|js|ts)$/i.test(p)) ra.push({ p: p, n: st.size });
    return ra;
  }
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.git')) continue;
    liet(path.join(p, e.name), ra);
  }
  return ra;
}

const ds = liet(dich, []).sort((a, b) => b.n - a.n);
if (!ds.length) {
  console.error('[do-tai-lieu] KHÔNG ĐO ĐƯỢC: không có tệp văn bản nào ở ' + dich);
  process.exit(2);
}

const tong = ds.reduce((s, f) => s + f.n, 0);
const token = Math.round(tong / NGUONG.kyTuTrenToken);
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

console.log(`[do-tai-lieu] ${dich}`);
console.log(`  ${ds.length} tệp · ${kb(tong)} · ~${token.toLocaleString('vi-VN')} token`);
console.log('  5 tệp lớn nhất:');
for (const f of ds.slice(0, 5)) console.log(`    ${kb(f.n).padStart(9)}  ${f.p}`);

if (tong <= NGUONG.docThang) {
  console.log(`\n  ✓ Dưới ${kb(NGUONG.docThang)} — ĐỌC THẲNG. Đưa nguyên vào prompt.`);
  process.exit(0);
}

console.log('');
if (tong <= NGUONG.trichTruoc) {
  console.error(`  ⚠ Vượt ngưỡng đọc thẳng (${kb(NGUONG.docThang)}).`);
  console.error('    LÀM: giao SUBAGENT trích ra những gì cần, rồi đọc BẢN TRÍCH.');
  console.error('    Nói rõ trích gì: "liệt kê mọi luật tính tiền kèm mã BR-", không phải "đọc rồi tóm tắt".');
} else {
  console.error(`  ✗ Vượt cả ngưỡng trích (${kb(NGUONG.trichTruoc)}).`);
  console.error('    LÀM: chia theo MỤC (không phải theo số dòng), mỗi mục một subagent, rồi gộp bản trích.');
  console.error('    Chia theo số dòng sẽ cắt giữa một bảng, và bảng bị cắt là dữ liệu SAI, không phải thiếu.');
}
console.error('\n  Và ghi bản trích ra đĩa: lần sau đọc lại bản trích, đừng đọc lại nguồn.');
process.exit(1);
```

Chạy trên hai đích khác nhau:

```bash
node scripts/utils/do-tai-lieu.js docs/course/assets/app-thuc-hanh
echo "mã thoát = $?"
node scripts/utils/do-tai-lieu.js scripts
echo "mã thoát = $?"
```

**Bạn sẽ thấy** đích thứ nhất ra `✓ … ĐỌC THẲNG` với mã `0`; đích thứ hai ra cảnh báo với mã `1` kèm hướng
dẫn cụ thể.

**Điều vừa xảy ra:** bạn có một máy trả lời được câu *"tài liệu này đưa vào thế nào"* trước khi bạn mất một
lượt chạy. Và để ý cách nó nói: không phải *"quá lớn"*, mà là *"làm gì tiếp"*.

## Việc 3 — Vì sao subagent tốn hơn mà vẫn đáng (15 phút)

Nghịch lý làm nhiều người bỏ subagent: giao cho subagent thì **tổng token TĂNG**, vì nó đọc tài liệu rồi bạn
lại đọc bản trích của nó — cùng nội dung đi qua hai lần.

Nhưng nhìn cái được:

| | Đọc thẳng vào phiên chính | Giao subagent trích |
|---|---|---|
| Tổng token | thấp hơn | **cao hơn** |
| Ngữ cảnh phiên chính sau đó | chật, còn ít chỗ cho việc thật | **rộng** |
| Chất lượng ở phần sau của việc | tụt, và không có dấu hiệu | giữ được |
| Bạn biết nó đã đọc gì | không | **có — bản trích nằm trên đĩa, đọc được** |

Dòng cuối là dòng quyết định. **Bản trích là một artifact**: bạn mở ra đọc, thấy nó thiếu mục nào, và sửa
được. Còn "agent đã đọc tài liệu" thì không kiểm được.

Nên nguyên tắc là:

> Giao subagent khi bạn cần **giữ ngữ cảnh chính cho việc thật**, hoặc khi bạn cần **bản trích để kiểm lại**.
> Không giao chỉ để tiết kiệm — vì nó không tiết kiệm.

### Cái bẫy đắt nhất: đọc thiếu mà không có tín hiệu

Đây là chuyện thật, và nó lặp lại ở nhiều dạng:

| Dạng | Cụ thể | Bạn nhận được tín hiệu gì |
|---|---|---|
| Tài liệu **nhiều tab** | Công cụ đọc mặc định chỉ trả tab đầu | **Không gì cả.** Đọc được 18 KB trong khi tài liệu 345 KB |
| Danh sách **phân trang** | API trả 100 bản ghi đầu, còn 900 ở trang sau | Có `next_cursor` — nhưng chỉ khi bạn nhìn |
| Tài liệu có **nhiều bản** | Bạn đọc bản cũ, bản mới nằm chỗ khác | Không gì cả |
| Nội dung **tô màu / suggested** | Phần BA bổ sung nằm ở chú thích, không ở thân bài | Không gì cả |

Chống bằng **một** thói quen, không phải bằng cẩn thận:

> **Sau khi đọc bất cứ nguồn nào, ghi lại "đọc được bao nhiêu" và so với "nguồn to bao nhiêu".**

Hai số khớp thì đi tiếp. Lệch thì bạn vừa tránh được một kết luận sai. Đây chính là bước "đo" mà `do-tai-lieu.js`
làm cho tệp trên đĩa — với nguồn ngoài thì bạn phải hỏi công cụ số thứ hai.

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   └── nguong-tai-lieu.md            ← MỚI · khai ngưỡng + cách xử lý từng mức
└── scripts/utils/
    └── do-tai-lieu.js                ← MỚI · đo và trả KHUYẾN NGHỊ (exit 0/1/2)
```

Để ý `do-tai-lieu.js` nằm ở `scripts/utils/`, không ở `scripts/qa/`: nó **không chặn quy trình** — nó tư vấn.
Máy chặn thì đứng trong đường đi và nói "không"; máy tư vấn thì trả lời một câu hỏi bạn tự đặt ra.

## Tự kiểm

1. Tài liệu 90 KB tiếng Việt — khoảng bao nhiêu token? Bạn đọc thẳng hay giao subagent?
2. Vì sao giao subagent làm **tăng** tổng token? Cái được là gì?
3. Kể hai dạng "đọc thiếu mà không có tín hiệu". Bạn phát hiện bằng cách nào?
4. Vì sao chia tài liệu lớn theo **mục** chứ không theo **số dòng**?
5. Nhóm chi phí đắt nhất là nhóm nào? Bài nào của khoá giải nó?
6. `do-tai-lieu.js` ở `utils/` chứ không ở `qa/` — phân biệt bằng câu gì?

## Bài tập về nhà (20 phút)

1. Chạy `do-tai-lieu.js` lên thư mục tài liệu **thật** của dự án bạn. Ghi lại con số và khuyến nghị.
2. Lấy tài liệu lớn nhất trong đó. Giao agent trích ra **một** thứ cụ thể — ví dụ *"liệt kê mọi luật tính
   toán, mỗi luật một dòng, kèm mục nào trong tài liệu"*. Ghi bản trích ra `outputs/.../analysis/`.
3. Mở bản trích ra **đọc**. Nó thiếu gì? Sửa câu yêu cầu trích rồi làm lại.

Bước 3 là bước cả bài này nhắm tới: bản trích là thứ **kiểm được**. Làm một lần bạn sẽ thấy lần đầu nó luôn
thiếu, và bạn sẽ không bao giờ tin "agent đã đọc tài liệu" nữa.

## Đọc thêm

- Bài 7 — [phân tích requirement đa nguồn](tu-requirement-ra-testcase.md): vì sao ba nguồn rời rạc không gộp
  chung được, và bản trích của mỗi nguồn phải khác nhau.
- Bài 17 — [bộ nhớ dự án](bo-nho-du-an.md): trích một lần, ghi ra đĩa, hết chuyện đọc lại 10 lần.
