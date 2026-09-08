# Chi phí và giới hạn thật

> **1 giờ** · Có gì trong tay: khung kit, hai file luật · Sau bài này: đo được tài liệu trước khi đưa cho agent, và biết khi nào nên giao việc cho agent con

**Vấn đề**

Bạn quyết định dựng một bộ kit. Trước khi bỏ vào đó vài chục giờ, có hai câu nên hỏi.

Câu thứ nhất là nó tốn bao nhiêu, không chỉ lúc dựng mà cả lúc bảo dưỡng.

Câu thứ hai khó chịu hơn: có việc gì mà bộ kit này **không** làm được, để bạn không đặt nhầm kỳ vọng
rồi thất vọng ở tháng thứ ba.

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Bạn đưa cả thư mục tài liệu cho agent. Nó đọc thiếu. Và không có gì báo cho bạn biết. |
| **Bài này bạn gõ gì** | Viết một máy đo cỡ tài liệu, chạy thử trên hai thư mục to nhỏ khác nhau. |
| **Xong thì được gì** | Biết trước tài liệu nào đọc thẳng được, tài liệu nào phải nhờ agent con trích ra. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Ba việc:

1. Đo một tài liệu, tự tính nó chiếm bao nhiêu ngữ cảnh (20 phút).
2. Viết máy đo tài liệu. Nó trả về lời khuyên, không chỉ trả về con số (25 phút).
3. Học cái bẫy đắt nhất: agent đọc thiếu mà không có gì báo (15 phút).

Bài này không dạy tiết kiệm tiền. Nó dạy đừng để agent đọc thiếu mà bạn không biết. Đó là loại lỗi bạn không
debug được: agent kết luận trên một nửa tài liệu, nói rất tự tin, và không hé một câu nào về phần nó chưa đọc.

---

## Việc 1 — Đo trước khi đọc (20 phút)

Trước khi đưa tài liệu nào cho agent, hỏi một câu: nó to bao nhiêu?

Lấy ngay đặc tả của app thực hành:

```bash
wc -c docs/course/assets/app-thuc-hanh/spec.md
```

Bạn sẽ thấy một số quanh `5000`, tức khoảng 5 KB. Giờ tính nhẩm:

| Bước | Cách tính | Ra bao nhiêu |
|---|---|---|
| Cỡ tệp | `wc -c` | ~5.000 ký tự |
| Token xấp xỉ | ký tự chia 3, vì đây là tiếng Việt | ~1.700 token |
| So với giới hạn phiên | | rất nhỏ |

Kết luận: đọc thẳng, khỏi nghĩ nhiều.

Giờ thử một thứ khác, toàn bộ mã nguồn kit:

```bash
find scripts -name "*.js" -exec wc -c {} + | tail -1
```

Số này lớn hơn nhiều, cỡ hàng trăm KB. Nếu bạn bảo agent "đọc hết `scripts/` rồi cho tôi biết…" thì một
trong ba chuyện sẽ xảy ra:

| Chuyện | Bạn nhận được tín hiệu gì |
|---|---|
| Agent đọc hết, ngữ cảnh chật, chất lượng tụt dần ở phần sau | Không có tín hiệu nào |
| Agent tự chọn đọc một phần | Đôi khi nó nói, đôi khi không |
| Công cụ cắt bớt giữa đường | Tuỳ công cụ, có khi im luôn |

Ba dòng trên đều tệ vì cùng một lý do: bạn không biết nó đã đọc những gì.

### Ba nhóm chi phí, xếp theo mức đáng lo

| Nhóm | Thực tế | Đáng lo không |
|---|---|---|
| Câu hỏi ngắn, sửa vài dòng | rẻ | không |
| Đọc tài liệu dài, sinh 200 testcase | trung bình | vừa phải. Đo trước là quản được |
| Đọc lại cùng một tài liệu 10 lần trong 10 phiên | đắt nhất, và hay xảy ra nhất | có |

Nhóm thứ ba là thứ mà bộ nhớ dự án ở Bài 26 và 18 giải: trích một lần, ghi ra đĩa, lần sau đọc bản trích.

## Việc 2 — Máy đo tài liệu (25 phút)

Đo tay được một tệp. Một thư mục 40 tệp thì cần máy. Nhưng thứ đáng có không phải con số, mà là lời khuyên
đi kèm con số đó.

Tạo `scripts/utils/do-tai-lieu.js`:

```js
#!/usr/bin/env node
/*
 * do-tai-lieu.js — đo cỡ tài liệu rồi nói nên làm gì, không chỉ nói nó to bao nhiêu.
 *
 * Con số "180 KB" không nói cho ai điều gì. Câu "vượt ngưỡng đọc thẳng, giao agent con
 * trích ra rồi đọc bản trích" thì nói được.
 *
 * Mã thoát:  0 = trong ngưỡng đọc thẳng  ·  1 = vượt ngưỡng, phải đổi cách  ·  2 = không đo được
 */
'use strict';
const fs = require('fs');
const path = require('path');

/* Ngưỡng khai ở một chỗ, không rải trong code. Con số theo kinh nghiệm chứ không phải hằng số
   vũ trụ. Dự án của bạn có thể khác, nhưng phải khai ra để đổi được ở một nơi. */
const NGUONG = {
  kyTuTrenToken: 3,          // tiếng Việt nhiều dấu, khoảng 3 ký tự một token
  docThang: 40 * 1024,       // dưới 40 KB: đưa thẳng vào prompt
  trichTruoc: 200 * 1024     // 40 đến 200 KB: giao agent con trích; trên nữa thì chia theo mục
};

const dich = process.argv[2];
if (!dich || !fs.existsSync(dich)) {
  console.error('[do-tai-lieu] KHÔNG ĐO ĐƯỢC: không thấy đường dẫn. Dùng: node scripts/utils/do-tai-lieu.js <file|thư-mục>');
  process.exit(2);
}

/** Liệt kê tệp văn bản, bỏ tệp nhị phân và bỏ node_modules. */
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
  console.log(`\n  ✓ Dưới ${kb(NGUONG.docThang)}. Đọc thẳng, đưa nguyên vào prompt.`);
  process.exit(0);
}

console.log('');
if (tong <= NGUONG.trichTruoc) {
  console.error(`  ⚠ Vượt ngưỡng đọc thẳng (${kb(NGUONG.docThang)}).`);
  console.error('    LÀM: giao agent con trích ra thứ bạn cần, rồi đọc bản trích.');
  console.error('    Nói rõ trích gì: "liệt kê mọi luật tính tiền kèm mã BR-", đừng nói "đọc rồi tóm tắt".');
} else {
  console.error(`  ✗ Vượt cả ngưỡng trích (${kb(NGUONG.trichTruoc)}).`);
  console.error('    LÀM: chia theo MỤC, không chia theo số dòng. Mỗi mục một agent con, rồi gộp bản trích.');
  console.error('    Chia theo số dòng sẽ cắt giữa một bảng. Bảng bị cắt là dữ liệu SAI, không phải dữ liệu thiếu.');
}
console.error('\n  Và nhớ ghi bản trích ra đĩa. Lần sau đọc bản trích, đừng đọc lại nguồn.');
process.exit(1);
```

Chạy trên hai đích khác nhau:

```bash
node scripts/utils/do-tai-lieu.js docs/course/assets/app-thuc-hanh
echo "mã thoát = $?"
node scripts/utils/do-tai-lieu.js scripts
echo "mã thoát = $?"
```

Đích thứ nhất ra `✓ … Đọc thẳng` với mã `0`. Đích thứ hai ra cảnh báo với mã `1` kèm hướng dẫn cụ thể.

Giờ bạn có máy trả lời được câu "tài liệu này đưa vào thế nào" trước khi mất một lượt chạy. Và để ý cách nó
nói: không phải "quá lớn", mà là "làm gì tiếp".

## Việc 3 — Vì sao agent con tốn hơn mà vẫn nên dùng (15 phút)

Có một chuyện làm nhiều người bỏ agent con: giao cho nó thì tổng token tăng lên. Nó đọc tài liệu, rồi bạn
lại đọc bản trích của nó. Cùng nội dung đi qua hai lần.

Nhưng nhìn cái được:

| | Đọc thẳng vào phiên chính | Giao agent con trích |
|---|---|---|
| Tổng token | thấp hơn | cao hơn |
| Ngữ cảnh phiên chính sau đó | chật, còn ít chỗ cho việc thật | rộng |
| Chất lượng ở phần sau của việc | tụt, và không có dấu hiệu | giữ được |
| Bạn biết nó đã đọc gì | không | có, vì bản trích nằm trên đĩa |

Dòng cuối là dòng quyết định. Bản trích là một file. Bạn mở ra đọc, thấy nó thiếu mục nào thì sửa yêu cầu
rồi trích lại. Còn câu "agent đã đọc tài liệu" thì không có cách nào kiểm.

Nên nguyên tắc là thế này:

> Giao agent con khi bạn cần giữ chỗ trong ngữ cảnh cho việc chính, hoặc khi bạn cần một bản trích để kiểm
> lại. Đừng giao chỉ vì nghĩ nó tiết kiệm, vì nó không tiết kiệm.

### Cái bẫy đắt nhất: đọc thiếu mà không có gì báo

Chuyện này có thật, và nó lặp lại ở nhiều dạng:

| Dạng | Cụ thể | Bạn nhận được tín hiệu gì |
|---|---|---|
| Tài liệu nhiều tab | Công cụ mặc định chỉ trả tab đầu | Không gì cả. Đọc được 18 KB trong khi tài liệu 345 KB |
| Danh sách phân trang | API trả 100 bản ghi đầu, còn 900 ở trang sau | Có trường `next_cursor`, nhưng chỉ khi bạn nhìn |
| Tài liệu có nhiều bản | Bạn đọc bản cũ, bản mới nằm chỗ khác | Không gì cả |
| Nội dung tô màu hoặc ghi chú lề | Phần BA bổ sung nằm ở chú thích, không nằm trong thân bài | Không gì cả |

Chống bằng một thói quen, không chống bằng cách dặn nhau cẩn thận hơn:

> Đọc xong bất cứ nguồn nào, ghi lại "đọc được bao nhiêu" rồi so với "nguồn to bao nhiêu".

Hai số khớp thì đi tiếp. Lệch thì bạn vừa tránh được một kết luận sai. Với tệp trên đĩa thì `do-tai-lieu.js`
đo hộ bạn. Với nguồn ngoài thì bạn phải tự hỏi công cụ con số thứ hai.

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Token** | Đơn vị agent đọc và viết. Tiếng Việt thì khoảng 3 ký tự là 1 token, tiếng Anh khoảng 4 |
| **Ngữ cảnh** | Toàn bộ chữ mà agent đang nhìn thấy trong một phiên. Nó có giới hạn, và giới hạn đó là thật |
| **Agent con** (subagent) | Một phiên phụ, ngữ cảnh riêng. Nó làm một việc rồi trả về kết luận, không trả về mọi thứ nó đã đọc |

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   └── nguong-tai-lieu.md            ← MỚI · khai ngưỡng và cách xử lý từng mức
└── scripts/utils/
    └── do-tai-lieu.js                ← MỚI · đo rồi nói nên làm gì (mã thoát 0/1/2)
```

Để ý `do-tai-lieu.js` nằm ở `scripts/utils/`, không nằm ở `scripts/qa/`. Nó không chặn quy trình, nó chỉ tư
vấn. Máy chặn thì đứng chắn đường và nói không. Máy tư vấn thì trả lời một câu hỏi mà bạn tự đặt ra.

## Tự kiểm

1. Tài liệu tiếng Việt 90 KB thì khoảng bao nhiêu token? Bạn đọc thẳng hay giao agent con?
2. Giao agent con làm tổng token tăng lên. Vậy cái được là gì?
3. Kể hai dạng đọc thiếu mà không có gì báo. Bạn phát hiện bằng cách nào?
4. Vì sao chia tài liệu lớn theo mục, chứ không chia theo số dòng?
5. Nhóm chi phí nào đắt nhất? Bài nào giải nó?
6. `do-tai-lieu.js` ở `utils/` chứ không ở `qa/`. Phân biệt bằng câu hỏi nào?

## Bài tập về nhà (20 phút)

1. Chạy `do-tai-lieu.js` lên thư mục tài liệu thật của dự án bạn. Ghi lại con số và lời khuyên nó đưa ra.
2. Lấy tài liệu lớn nhất trong đó. Giao agent trích ra một thứ cụ thể, ví dụ "liệt kê mọi luật tính toán, mỗi
   luật một dòng, kèm nó nằm ở mục nào". Ghi bản trích ra file.
3. Mở bản trích ra đọc. Nó thiếu gì? Sửa lại câu yêu cầu rồi trích lần nữa.

Bước 3 là chỗ cả bài này nhắm tới. Bản trích là thứ kiểm được. Làm một lần bạn sẽ thấy lần đầu bao giờ cũng
thiếu, và từ đó bạn không còn tin câu "agent đã đọc tài liệu" nữa.

## Bài sau

Bài 2 cài công cụ và đặt chế độ quyền. Trong đó có một thí nghiệm nhỏ nhưng đáng làm: bảo agent xoá một thư
mục, rồi xem quyền có chặn nó lại không.
