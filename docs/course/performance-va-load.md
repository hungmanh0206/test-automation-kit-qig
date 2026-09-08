# Bài 23 — "Thấy nhanh" không phải là một phép đo

> **2 giờ** · Có gì trong tay: bộ test chức năng đầy đủ · Sau bài này: đo được tốc độ bằng số, và biết chỗ nào không được kết luận

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Ai đó nói "trang chậm". Bạn không có con số nào để đồng ý hay phản đối. |
| **Bài này bạn gõ gì** | Ba loại phép đo cho ba câu hỏi khác nhau, và một kịch bản tải chạy được. |
| **Xong thì được gì** | Số đo lặp lại được, và một báo cáo không kết luận quá tay. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Độ trễ** | Một yêu cầu mất bao lâu để có phản hồi |
| **Thông lượng** | Hệ thống xử lý được bao nhiêu yêu cầu trong một giây |
| **Phân vị 95** | 95% số lần nhanh hơn con số này. Đáng tin hơn giá trị trung bình |
| **SLA** | Ngưỡng đã cam kết. Không có SLA thì không có "đạt" hay "trượt" |

## Bài này bạn sẽ làm gì

Ba việc:

1. Ba câu hỏi hiệu năng, ba loại phép đo (25 phút).
2. Đo một trang bằng số của trình duyệt (40 phút).
3. Kịch bản tải, và đọc kết quả mà không kết luận quá tay (55 phút).

---

## Việc 1 — Ba câu hỏi khác nhau (25 phút)

"Chậm" là ba vấn đề khác nhau bị gọi chung một tên:

| Câu hỏi thật | Loại phép đo | Công cụ |
|---|---|---|
| Một người dùng thấy trang mất bao lâu mới dùng được? | Đo trang | Số của trình duyệt |
| Một API mất bao lâu để trả lời? | Đo điểm cuối | Gọi lặp, lấy phân vị |
| 200 người cùng lúc thì sao? | Đo tải | Kịch bản tải |

Chọn nhầm loại thì con số ra vô nghĩa. Ví dụ hay gặp: có người báo "trang đơn hàng chậm", bạn chạy
kịch bản tải 500 người dùng ảo, kết quả đẹp, và kết luận không có vấn đề. Trong khi vấn đề thật là
trang tải một tệp JavaScript 4MB, và nó chậm **kể cả khi chỉ có một người dùng**.

Câu hỏi đầu tiên luôn là: **chậm với một người, hay chỉ chậm khi đông người**. Hai thứ đó có nguyên
nhân hoàn toàn khác nhau, và chữa ở hai chỗ khác nhau.

## Việc 2 — Đo trang bằng số của trình duyệt (40 phút)

Đừng dùng đồng hồ bấm tay, và cũng đừng dùng `Date.now()` quanh `page.goto()`. Trình duyệt tự ghi lại
các mốc thời gian, đọc thẳng từ đó:

```js
// tests/support/do-toc-do.js
'use strict';

/*
 * Đọc mốc thời gian trình duyệt tự ghi. Chính xác hơn nhiều so với bọc Date.now() quanh goto(),
 * vì goto() trả về khi tài liệu tải xong — còn thứ người dùng quan tâm là lúc NHÌN THẤY nội dung
 * và lúc BẤM ĐƯỢC, hai mốc muộn hơn.
 */
async function doTrang(page, duongDan) {
  await page.goto(duongDan, { waitUntil: 'load' });

  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const veDauTien = performance.getEntriesByName('first-contentful-paint')[0];
    return {
      phanHoiDauTien: Math.round(nav.responseStart - nav.requestStart),
      taiXongTaiLieu:  Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      veNoiDungDauTien: veDauTien ? Math.round(veDauTien.startTime) : null,
      soYeuCau: performance.getEntriesByType('resource').length,
      tongByte: performance.getEntriesByType('resource')
        .reduce((s, r) => s + (r.transferSize || 0), 0),
    };
  });
}

module.exports = { doTrang };
```

Chạy nó **năm lần** rồi lấy trung vị, đừng lấy một lần:

```js
async function doNamLan(page) {
  const so = [];
  for (let i = 0; i < 5; i++) so.push(await doTrang(page, '/don-hang'));
  so.sort((a, b) => a.veNoiDungDauTien - b.veNoiDungDauTien);
  return so[2];   // trung vị
}
```

**Bạn sẽ thấy** năm con số chênh nhau khá nhiều, có khi gấp đôi. Đó là chuyện bình thường, và nó là
lý do một lần đo không nói lên gì.

| Thấy khác | Nghĩa là | Làm gì |
|---|---|---|
| Lần đầu chậm hơn hẳn bốn lần sau | Cache còn trống | Đo cả hai trạng thái, ghi rõ trạng thái nào |
| Năm lần chênh nhau vài lần | Máy bạn đang bận, hoặc mạng chập chờn | Đóng bớt ứng dụng, đo lại |
| `veNoiDungDauTien` là `null` | Trình duyệt không phải Chromium | Chỉ Chromium có mốc này |

Bốn con số đáng theo dõi, và mỗi con số chỉ vào một loại nguyên nhân khác nhau:

| Con số | Cao thì thường vì |
|---|---|
| `phanHoiDauTien` | Máy chủ xử lý chậm, hoặc truy vấn nặng |
| `veNoiDungDauTien` | Chặn render: CSS hoặc JavaScript tải trước nội dung |
| `soYeuCau` | Quá nhiều tệp rời, chưa gộp |
| `tongByte` | Ảnh chưa nén, thư viện quá to |

## Việc 3 — Kịch bản tải, và giới hạn kết luận (55 phút)

### Dựng một kịch bản tối thiểu

Không cần công cụ nặng để bắt đầu. Với app thực hành:

```js
// tests/load/tao-don-dong-thoi.js
'use strict';
const { request } = require('@playwright/test');

const SO_NGUOI = 20;
const SO_LUOT_MOI_NGUOI = 10;

async function motNguoi(ctx) {
  const doTre = [];
  for (let i = 0; i < SO_LUOT_MOI_NGUOI; i++) {
    const t0 = Date.now();
    const res = await ctx.post('/api/quote', {
      data: { khachId: 'KH02', items: [{ sanPhamId: 'SP01', soLuong: 2 }] },
    });
    doTre.push({ ms: Date.now() - t0, ok: res.ok() });
  }
  return doTre;
}

(async () => {
  const ctx = await request.newContext({ baseURL: process.env.BASE_URL });
  const tatCa = (await Promise.all(
    Array.from({ length: SO_NGUOI }, () => motNguoi(ctx))
  )).flat();

  const ms = tatCa.map((x) => x.ms).sort((a, b) => a - b);
  const loi = tatCa.filter((x) => !x.ok).length;

  console.log({
    soLuot: ms.length,
    loi: loi,
    trungVi: ms[Math.floor(ms.length * 0.5)],
    p95: ms[Math.floor(ms.length * 0.95)],
    chamNhat: ms[ms.length - 1],
  });
  await ctx.dispose();
})();
```

### Đọc kết quả

```
{ soLuot: 200, loi: 0, trungVi: 45, p95: 210, chamNhat: 890 }
```

Ba cách đọc sai thường gặp:

| Cách đọc | Vì sao sai |
|---|---|
| "Trung bình 60ms, rất tốt" | Trung bình bị kéo bởi số cực đoan. Dùng trung vị và phân vị 95 |
| "p95 = 210ms, đạt" | Đạt so với cái gì? Chưa có SLA thì chưa có "đạt" |
| "0 lỗi, hệ thống chịu được 20 người" | Bạn đo 20 người. Nói được về 20, không nói được về 200 |

Và một cách đọc sai nguy hiểm hơn cả ba: **kết luận về môi trường thật từ số đo trên môi trường thử
nghiệm**. Môi trường thử nghiệm thường ít tài nguyên hơn, ít dữ liệu hơn, và không có lưu lượng nền.
Số đo ở đó nói về chính nó, không nói về môi trường thật.

### Đừng bịa ngưỡng

Đây là phần dễ sai nhất của cả bài.

Không có SLA thì báo cáo hiệu năng là **tư vấn**, không phải phán quyết. Viết:

```
Đo trên môi trường thử nghiệm, 20 người dùng đồng thời, 200 lượt gọi.
Trung vị 45ms · p95 210ms · 0 lỗi.
Chưa có SLA cho endpoint này nên không kết luận đạt hay trượt.
So với lần đo trước (sprint 12): p95 tăng từ 150ms lên 210ms.
```

Bốn dòng, và mỗi dòng làm một việc: điều kiện đo · số đo · nói rõ giới hạn · **so với chính mình lần
trước**.

Dòng cuối là thứ có giá trị nhất khi chưa có SLA. Bạn không nói được "210ms là nhanh hay chậm", nhưng
bạn nói được "nó chậm hơn sprint trước 40%", và đó là thông tin hành động được.

> Đây cùng một kỷ luật với Bài 13: kết luận phải neo vào một nguồn. Có SLA thì neo vào SLA. Không có
> thì neo vào lần đo trước của chính mình. Không neo được vào đâu thì ghi số và dừng lại, đừng phán.

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   └── nguong-metrics.json       ← MỚI · SLA nếu có, mốc so với lần trước nếu chưa
└── tests/
    ├── support/
    │   └── do-toc-do.js          ← MỚI · đọc mốc thời gian của trình duyệt
    └── load/
        └── tao-don-dong-thoi.js  ← MỚI · kịch bản tải tối thiểu
```

## Tự kiểm

1. Ba câu hỏi hiệu năng khác nhau, và loại phép đo tương ứng?
2. Câu hỏi đầu tiên luôn phải hỏi là gì?
3. Vì sao không dùng `Date.now()` quanh `page.goto()`?
4. Vì sao phải đo 5 lần và lấy trung vị?
5. Bốn con số đáng theo dõi, mỗi cái chỉ vào loại nguyên nhân nào?
6. Vì sao dùng phân vị 95 thay vì giá trị trung bình?
7. Ba cách đọc kết quả tải sai, và cách sai thứ tư nguy hiểm hơn cả?
8. Chưa có SLA thì báo cáo viết thế nào? Dòng nào có giá trị nhất?

## Bài tập về nhà

Đo một trang của sản phẩm bạn đang test, 5 lần, lấy trung vị. Ghi lại bốn con số.

Rồi mở DevTools tab Network, sắp xếp theo kích thước giảm dần. Nhìn ba tệp nặng nhất.

Rất thường xuyên, ba tệp đó chiếm quá nửa tổng dung lượng, và một trong số đó là thứ không ai nhớ vì
sao lại có ở đây. Ghi lại, đó là đầu mối tốt hơn nhiều so với một kịch bản tải 500 người.

## Bài sau

Bài 24 quay lại nhìn tổng thể. Bạn đã viết khoảng mười cái gate rời rạc qua từng bài. Giờ là lúc gom
chúng vào một khung chung, và trả lời một câu khó: làm sao biết một gate thật sự đang chạy.
