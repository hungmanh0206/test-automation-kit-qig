# Bài chi tiết — Bằng chứng

> **2 giờ** · Có gì trong tay: kết quả chạy có verdict và tầng lỗi · Sau bài này: ảnh có khoanh đỏ, video có banner, PII đã che — và file trạng thái đã đủ bằng chứng
>
> *Bài này không đánh số, nó là phần đào sâu của **Bài 13**. Đọc kèm **Bài 13**.*

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Bạn nói case đã chạy và đúng. Ba tuần sau không ai kiểm lại được nữa. |
| **Bài này bạn gõ gì** | Viết hàm chụp ảnh có khoanh đỏ và che thông tin cá nhân, rồi hàm quay video có chú thích từng bước. |
| **Xong thì được gì** | Case nào đã chạy cũng có ảnh hoặc video, mở ra là thấy ngay chỗ cần nhìn. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Bằng chứng** | Ảnh hoặc video chứng minh case đã chạy thật và ra đúng kết quả bạn nói |
| **Khoanh đỏ** | Vẽ khung vào đúng chỗ cần nhìn, kèm nhãn ngắn |
| **Che thông tin cá nhân** | Bôi email, số điện thoại, tên khách trước khi lưu ảnh |

## Bài này bạn sẽ làm gì

Bốn việc:

1. Chốt định dạng: chỉ ảnh hoặc video, không nhận file text (15 phút).
2. Viết hàm chụp có khoanh đỏ và có nhãn (45 phút).
3. Che thông tin cá nhân, kèm cái bẫy ô nhập liệu (30 phút).
4. Quay video cho case nhiều bước (30 phút).

---

## 1. Chỉ ảnh hoặc video

| Được chấp nhận | KHÔNG được |
|---|---|
| `.png` `.jpg` `.jpeg` `.webp` | `.json` `.md` `.txt` `.log` `.csv` |
| `.mp4` `.webm` | `trace.zip` · kết quả truy vấn database |

Vì sao trace và log không phải bằng chứng dù chúng chứa nhiều thông tin hơn ảnh:

> Bằng chứng phải kiểm chứng được bởi người không chạy test. Dev mở ảnh trong ba giây. Mở trace cần cài
> công cụ, cần biết cách đọc, và cần chính bản build đó. Log thì chỉ là chữ do chính script bạn in ra —
> nó chứng minh script đã in gì, không chứng minh màn hình trông thế nào.

Trace và log vẫn hữu ích. Chúng là công cụ điều tra tại chỗ, không phải bằng chứng để nộp.

## 2. Vì sao case PASS cũng phải có evidence

Đây là phần hay bị phản đối nhất: *"pass thì có gì mà chụp?"*

Trả lời bằng một tình huống. Sáu tuần sau, production có bug ở đúng màn đó. Ai đó hỏi: *"case TC_015 báo PASS,
lúc đó màn hình trông thế nào?"*

Không có ảnh thì mọi PASS của bạn là lời khai không kiểm chứng được. Có ảnh thì bạn trả lời được trong một
phút. Hoặc phát hiện ra rằng lúc đó nó đã sai rồi mà oracle của bạn không bắt (và đó là thông tin cực
giá trị cho Bài 21).

Đây là mục 4 trong `CLAUDE.md` bạn viết ở Bài 2, và là luật mà `gate-bang-chung.js` ở Bài 8 canh.

## 3. Khoanh đỏ: vì sao ảnh chụp trơn bị trả bug

Ảnh chụp trơn của một màn dày đặc dữ liệu thì Dev không biết nhìn vào đâu. Kết quả thực tế: bug bị trả về
với lý do *"không thấy lỗi"* — trong khi lỗi có ở đó thật.

Cách chữa: khoanh đỏ đúng element kèm nhãn ngắn, trước khi chụp.

`tests/support/evidence.js`:

```js
/*
 * evidence.js — chụp ảnh CÓ KHOANH ĐỎ và ĐÃ CHE PII.
 *
 * VÌ SAO CẦN: ảnh chụp trơn của một màn dày dữ liệu thì người đọc không biết nhìn vào đâu, và bug bị trả
 * về với lý do "không thấy lỗi". Khoanh đỏ + nhãn làm chỗ sai lộ ra trong một giây.
 *
 * PII: đây là thứ rời khỏi máy bạn và lên hệ thống quản lý việc, nơi rất nhiều người đọc được. Phải che.
 */
'use strict';
const fs = require('fs');
const path = require('path');

/**
 * Khoanh đỏ các element và thêm nhãn, rồi chụp.
 * @param {import('@playwright/test').Page} page
 * @param {{ file: string, khoanh?: Array<{ selector: string, nhan: string, mau?: string }>,
 *           maskSelector?: string[], fullPage?: boolean }} opts
 */
async function chupCoHighlight(page, opts) {
  const { file, khoanh = [], maskSelector = [], fullPage = false } = opts;

  // ① Che PII TRƯỚC khi vẽ, để nhãn không bị che theo
  if (maskSelector.length) await chePII(page, maskSelector);

  // ② Vẽ khung và nhãn trong trang
  await page.evaluate((ds) => {
    for (const d of ds) {
      const el = document.querySelector(d.selector);
      if (!el) continue;
      const mau = d.mau || '#e11d48';
      el.style.outline = `4px solid ${mau}`;
      el.style.outlineOffset = '2px';

      const r = el.getBoundingClientRect();
      const nhan = document.createElement('div');
      nhan.textContent = d.nhan;
      nhan.setAttribute('data-evidence-label', '1');
      Object.assign(nhan.style, {
        position: 'fixed',
        // đặt nhãn PHÍA TRÊN element; nếu element ở sát đỉnh thì đặt xuống dưới
        top: (r.top > 34 ? r.top - 30 : r.bottom + 6) + 'px',
        left: Math.max(4, r.left) + 'px',
        background: mau, color: '#fff',
        font: '600 13px/1.4 system-ui, sans-serif',
        padding: '3px 9px', borderRadius: '6px',
        zIndex: '2147483647',
        // pointer-events: none — nhãn KHÔNG được chặn click của bước sau (bẫy đã gặp thật)
        pointerEvents: 'none',
        whiteSpace: 'nowrap'
      });
      document.body.appendChild(nhan);
    }
  }, khoanh);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage });

  // ③ Dọn nhãn để bước sau của test không bị ảnh hưởng
  await page.evaluate(() => {
    document.querySelectorAll('[data-evidence-label]').forEach((n) => n.remove());
  });
  return file;
}

/**
 * Che PII. HAI cơ chế, vì chúng KHÁC nhau:
 *   - textContent: cho chữ hiển thị
 *   - .value:      cho Ô NHẬP LIỆU — đây là bẫy, xem mục 4
 */
async function chePII(page, selectors) {
  await page.evaluate((sels) => {
    const CHE = '••••••••';
    for (const sel of sels) {
      for (const el of document.querySelectorAll(sel)) {
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
          el.value = CHE;                    // ← ô nhập: PHẢI set .value
          el.setAttribute('value', CHE);     // ← và cả attribute, vì có framework render lại từ đó
        } else {
          el.textContent = CHE;
        }
      }
    }
  }, selectors);
}

module.exports = { chupCoHighlight, chePII };
```

Dùng trong test:

```js
const { test, expect } = require('../support/fixtures');
const { chupCoHighlight } = require('../support/evidence');

test('TC_012 [Calc] giảm giá hạng Bạc', async ({ page, duLieu }, testInfo) => {
  const kh = await duLieu.khachHang({ hang: 'Bạc' });
  await page.goto('/orders/create');
  // … thao tác …

  const anh = `outputs/demo/tasks/${process.env.MA_TASK}/evidence/TC_012.png`;
  await chupCoHighlight(page, {
    file: anh,
    khoanh: [
      { selector: '#tong-ket [data-field=giam-gia]', nhan: 'Giảm giá 9.000 (mong đợi)' },
      { selector: '#tong-ket [data-field=tong-cong]', nhan: 'Tổng cộng 321.000 (mong đợi)' }
    ],
    maskSelector: ['[data-field=sdt]', 'input[name=email]']
  });
  // Gắn vào báo cáo để sinh-status.js đọc được (Bài 13)
  await testInfo.attach('TC_012', { path: anh, contentType: 'image/png' });
});
```

### Khi cần so sánh: khoanh cả cái đúng

Với bug lệch giữa hai nơi, khoanh **cả hai** và ghi rõ bên nào đúng:

```js
test('TC_020 [Display] ngày sinh lệch định dạng giữa hai tab', async ({ page }) => {
  await chupCoHighlight(page, {
    file: `outputs/demo/tasks/${process.env.MA_TASK}/evidence/TC_020-lech-dinh-dang.png`,
    khoanh: [
      { selector: '#tab-a [data-field=ngay-sinh]', nhan: 'Tab A: 2001-05-20 (SAI)', mau: '#e11d48' },
      { selector: '#tab-b [data-field=ngay-sinh]', nhan: 'Tab B: 20/05/2001 (ĐÚNG)', mau: '#16a34a' }
    ]
  });
});
```

Ảnh này nói được toàn bộ vấn đề mà người xem không cần đọc mô tả. Đó là mức nên nhắm tới.

## 4. Bẫy PII: che chữ không che được ô nhập

Đây là bẫy đã gặp thật, và nó im lặng hoàn toàn.

```js
// ✗ SAI — chỉ che chữ hiển thị
el.textContent = '••••';
```

Với `<input value="nguyen.van.a@congty.com">` thì `textContent` là chuỗi rỗng. Gán vào nó không đổi gì
cả. Giá trị thật vẫn nằm ở `input.value` và hiện nguyên trên ảnh.

```js
// ✓ ĐÚNG — ô nhập phải set .value (và cả attribute, vì có framework render lại từ đó)
el.value = '••••';
el.setAttribute('value', '••••');
```

**Và luật cuối, không được bỏ:** sau khi chụp, mở ảnh ra xem bằng mắt trước khi đính vào báo cáo. Đây là
việc năm giây, và nó là lớp bảo vệ cuối cùng. Bạn không thể tự động hoá việc *nhìn thấy* một thông tin chưa
che nằm ở chỗ bạn không nghĩ tới.

## 5. Khi nào buộc phải quay video

Ảnh tĩnh chỉ hợp bug về **trạng thái**. Với bug thể hiện qua chuỗi tương tác, ảnh cuối không nói được gì.

| Loại bug | Bằng chứng |
|---|---|
| Giá trị hiển thị sai · thiếu cột · sai nhãn | **Ảnh** |
| Chuỗi thao tác: tick → thu gọn → mở lại → mất tick | **Video** |
| Xử lý bất đồng bộ, cascade, kéo thả | **Video** |
| Nhiều bước, mỗi bước một trạng thái | **Video** |

Vì sao: với bug *"tick chọn → thu gọn → mở lại → mất tick"*, ảnh cuối chỉ cho thấy một ô không được tick —
và điều đó có thể hoàn toàn bình thường. Người xem không biết bạn đã làm gì để tới đó.

`tests/support/video.js`:

```js
/*
 * video.js — quay video có BANNER mô tả từng bước.
 *
 * VÌ SAO CẦN BANNER: video 20 giây không có chú thích thì người xem không biết đang xem bước nào, và
 * cũng không biết chỗ nào là chỗ sai. Banner + dừng 2–3 giây mỗi bước biến video thành thứ đọc được.
 */
'use strict';

/** Hiện banner ở đỉnh trang rồi dừng cho người xem kịp đọc. */
async function buoc(page, moTa, giay = 2.5) {
  await page.evaluate((t) => {
    let b = document.getElementById('__evidence_banner');
    if (!b) {
      b = document.createElement('div');
      b.id = '__evidence_banner';
      Object.assign(b.style, {
        position: 'fixed', top: '0', left: '0', right: '0',
        background: '#1a1916', color: '#ffb700',
        font: '700 15px/1.5 system-ui, sans-serif',
        padding: '10px 16px', zIndex: '2147483647',
        pointerEvents: 'none'      // không chặn thao tác của bước sau
      });
      document.body.appendChild(b);
    }
    b.textContent = t;
  }, moTa);
  await page.waitForTimeout(giay * 1000);   // ← ngoại lệ HỢP LỆ: chờ cho NGƯỜI XEM, không phải chờ app
}

module.exports = { buoc };
```

> `waitForTimeout` ở đây là ngoại lệ hợp lệ duy nhất của luật ở Bài 12. Nó không chờ ứng dụng, nó chờ
> người xem video kịp đọc banner. Ghi comment rõ để người sau không tưởng là mã ẩu.

Bật quay video cho một test cụ thể:

```js
const { test } = require('../support/fixtures');
const { buoc } = require('../support/video');

test.use({ video: { mode: 'on', size: { width: 1280, height: 720 } } });

test('TC_030 [E2E] tick sản phẩm → thu gọn → mở lại: tick còn nguyên', async ({ page }, testInfo) => {
  await page.goto('/orders/create');

  await buoc(page, 'Bước 1: tick chọn 2 sản phẩm');
  await page.getByRole('row').filter({ hasText: 'SP_A' }).getByRole('checkbox').check();
  await page.getByRole('row').filter({ hasText: 'SP_B' }).getByRole('checkbox').check();

  await buoc(page, 'Bước 2: thu gọn khối Danh sách sản phẩm');
  await page.getByRole('button', { name: 'Thu gọn', exact: true }).click();

  await buoc(page, 'Bước 3: mở lại khối — mong đợi: 2 tick CÒN NGUYÊN');
  await page.getByRole('button', { name: 'Mở rộng', exact: true }).click();

  await buoc(page, 'Kết quả: đếm số tick còn lại');
  const soTick = await page.getByRole('checkbox', { checked: true }).count();
  await buoc(page, `Thực tế: ${soTick} tick (mong đợi 2)`, 3);

  // Đường dẫn video chỉ có SAU khi context đóng — dùng testInfo để Playwright tự đính kèm
  await testInfo.attach('TC_030-video', {
    path: await page.video().path(), contentType: 'video/webm'
  });
});
```

## 6. Đường dẫn: đừng để Playwright xoá bằng chứng của bạn

Bẫy thật, và nó làm mất bằng chứng **im lặng**:

> `outputDir` của Playwright (mặc định `test-results/`) bị XOÁ SẠCH mỗi lần chạy. Ghi ảnh bằng chứng vào
> đó thì lượt chạy sau xoá hết bằng chứng của lượt trước.

Nên ghi vào thư mục của **task**:

```
outputs/<PROJECT>/tasks/<MA_TASK>/evidence/TC_012.png
```

Và trong file trạng thái, ghi đường dẫn tính từ gốc repo, không phải đường dẫn tuyệt đối của máy bạn
(người khác mở sẽ không thấy), cũng không phải đường dẫn tương đối từ thư mục task (gate chạy ở gốc repo sẽ
báo không tồn tại).

```json
[
  {
    "id": "TC_012",
    "status": "FAIL",
    "tangLoi": "api_bug",
    "evidence": ["outputs/demo/tasks/PROJ-1234/evidence/TC_012.png"]
  },
  {
    "id": "TC_015",
    "status": "PASS",
    "evidence": ["outputs/demo/tasks/PROJ-1234/evidence/TC_015.png"]
  }
]
```

Đây chính là hình dạng mà `gate-bang-chung.js` ở Bài 8 đọc.

## 7. Bốn thứ làm ảnh mất giá trị

| Vấn đề | Cách phát hiện | Cách chữa |
|---|---|---|
| **Ảnh trắng** | Kích thước file dưới ~1KB | Chụp sau khi trang ổn định — chờ **điều kiện**, không chờ thời gian |
| **Sai màn** | Mở ra không thấy element cần nhìn | Khẳng định element tồn tại trước khi chụp |
| **Không khoanh** | Người đọc phải tự dò | Luôn dùng `chupCoHighlight` |
| **Còn PII** | Mở ra và **đọc** | Che, rồi mở ảnh ra soi |

Ảnh trắng là thứ hay xảy ra nhất: khi test đỏ, Playwright vẫn chụp, chỉ là chụp **sau khi** trang đã hỏng
hoặc chưa render. File vẫn được tạo, đường dẫn vẫn có. Nên `gate-bang-chung.js` ở Bài 8 kiểm cả **kích thước
file**, không chỉ kiểm sự tồn tại.

---

## Thực hành (55 phút)

### Bước 1 — Viết `evidence.js` (20 phút)

Viết `tests/support/evidence.js` theo mục 3. Sửa 3 test ở Bài 12–10 để chụp bằng `chupCoHighlight` với ít nhất
**một** vùng khoanh mỗi test.

### Bước 2 — Mở ảnh ra soi (10 phút)

Mở từng ảnh vừa chụp và tự chấm:

| Ảnh | Đúng màn? | Có khoanh? | Nhãn đọc được? | Còn PII? | Kích thước |
|---|---|---|---|---|---|

Đây là bước không tự động hoá được và cũng là bước hay bị bỏ nhất.

### Bước 3 — Kiểm bẫy PII (10 phút)

Tìm một màn có ô nhập chứa dữ liệu cá nhân (email, SĐT). Thử **hai** cách:

```js
// cách sai
el.textContent = '••••';
// cách đúng
el.value = '••••'; el.setAttribute('value', '••••');
```

Chụp cả hai, mở cả hai ảnh ra so. Bạn phải **thấy** rằng cách sai không che được gì, thấy một lần thì
không quên.

### Bước 4 — Quay một video (10 phút)

Chọn một case có ít nhất 3 bước, viết `video.js` và quay với banner từng bước. Xem lại video và tự chấm: người
chưa biết case này có **hiểu được** bạn đang làm gì không?

### Bước 5 — Nối vào file trạng thái (5 phút)

Chạy suite, sinh lại status, kiểm phần `evidence` đã có đường dẫn:

```bash
npx playwright test
node scripts/qa/sinh-status.js test-results/results.json \
  outputs/demo/tasks/PROJ-1234/test-results/testcase-status.json

# mọi case đã chạy phải có evidence, và file phải tồn tại thật
node -e "
const fs=require('fs');
const a=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
const daChay=a.filter(x=>['PASS','FAIL','PASS_WITH_DEVIATION','SUSPECT_REAL_BUG'].includes(x.status));
const thieu=daChay.filter(x=>!(x.evidence||[]).length);
const mat=daChay.flatMap(x=>(x.evidence||[]).filter(f=>!fs.existsSync(f)).map(f=>x.id+': '+f));
console.log(daChay.length+' case đã chạy · '+thieu.length+' thiếu evidence · '+mat.length+' đường dẫn không tồn tại');
thieu.forEach(x=>console.log('  THIẾU  '+x.id));
mat.forEach(m=>console.log('  MẤT FILE  '+m));
" outputs/demo/tasks/PROJ-1234/test-results/testcase-status.json
```

Cả ba số phải là: *N case đã chạy · **0** thiếu · **0** mất file*.

### Bước 6 — Commit

```bash
git add tests/support/evidence.js tests/support/video.js tests
git commit -m "feat(evidence): chụp có khoanh đỏ + nhãn, che PII cả ô nhập, video có banner từng bước

Ghi vào thư mục task (KHÔNG vào outputDir của Playwright — nó bị xoá mỗi lượt chạy).
Kiểm: <N> case đã chạy, 0 thiếu evidence, 0 đường dẫn chết."
```

---

## Cây thư mục sau bài này

```
kit-cua-toi/tests/support/
├── evidence.js                   ← MỚI · chụp có KHOANH ĐỎ + che PII (cả input.value)
└── video.js                      ← MỚI · quay có banner từng bước, cho case nhiều bước
```

Hai file này là **hạ tầng**, không phải máy chặn. Máy chặn đọc *kết quả* của chúng, đó là
`gate-bang-chung.js` ở Bài 8.

## Tự kiểm

- [ ] Tôi biết danh sách đuôi file được chấp nhận, và vì sao trace/log không phải bằng chứng.
- [ ] Tôi giải thích được vì sao case **PASS** cũng cần bằng chứng.
- [ ] Mọi ảnh của tôi có khoanh đỏ và nhãn, không có ảnh chụp trơn.
- [ ] Nhãn của tôi có `pointerEvents: 'none'`, nó **không chặn** thao tác của bước sau.
- [ ] Tôi đã thấy tận mắt rằng `textContent` không che được ô nhập.
- [ ] Tôi đã mở từng ảnh ra soi trước khi đính vào báo cáo.
- [ ] Video của tôi có banner từng bước và người ngoài hiểu được.
- [ ] Bằng chứng ghi vào thư mục **task**, không vào `outputDir` của Playwright.
- [ ] Đường dẫn trong file trạng thái tính từ gốc repo.
- [ ] Lệnh kiểm ở Bước 5 ra 0 thiếu · 0 mất file.

## Bài tập về nhà

Mở **năm** bug gần nhất team bạn log lên hệ thống quản lý việc, và chấm bằng chứng của từng bug:

1. Có ảnh hoặc video không? (hay chỉ có mô tả chữ)
2. Ảnh có **khoanh** chỗ sai không?
3. Có thông tin khách hàng chưa che không?
4. Với bug chuỗi thao tác, có video không, hay chỉ ảnh cuối?

Nếu có bug từng bị trả về với lý do *"không tái hiện được"* hoặc *"không thấy lỗi"*, xem lại bằng chứng của
nó. Rất thường là ảnh chụp trơn.

## Đọc thêm

- Phần 4 (Bài 8–15) sẽ biến chính luật của bài này thành **máy chặn**: `gate-bang-chung.js` đọc file trạng thái
  bạn vừa sinh, tìm case đã chạy mà thiếu bằng chứng, và thoát mã 1.
