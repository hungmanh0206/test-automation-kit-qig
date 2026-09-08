# Bài 15 — Kiểm song song UI ↔ Database

> **2 giờ 30 phút** · Có gì trong tay: bộ case đã mở rộng 7 trục, suite có bằng chứng · Sau bài này: bắt được lớp bug "báo thành công nhưng lưu sai", và biết khoanh tầng lỗi bằng hai nguồn

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Màn hình báo thành công nhưng dữ liệu lưu xuống lại sai. Test qua giao diện không thấy được. |
| **Bài này bạn gõ gì** | So từng ô trên màn hình với bản ghi đã lưu, dựa vào một bảng ánh xạ khai sẵn. |
| **Xong thì được gì** | Bắt được 7 loại bug chỉ lộ ở nơi lưu dữ liệu, và biết lỗi thuộc tầng nào. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Tầng lưu trữ** | Nơi dữ liệu thật sự nằm sau khi bấm Lưu — database, hoặc bất cứ chỗ nào ứng dụng đọc lại lần sau |
| **Oracle phụ** | Nguồn thứ hai để đối chiếu, **không** thay thế oracle chính là đặc tả |
| **Xoá mềm** | Không xoá bản ghi, chỉ đánh dấu `deleted_at`. Đọc sai cờ này là bản ghi "đã xoá" vẫn hiện |

## Bài này bạn sẽ làm gì

Cho tới giờ bạn kết luận đúng/sai bằng **những gì màn hình hiện**. Bài này thêm một nguồn thứ hai: **dữ liệu
thật sự được lưu**.

Năm việc:

1. Nhìn cùng một đơn hàng từ hai tầng, và thấy chúng **không giống nhau** (20 phút).
2. Hiểu 7 lớp bug mà chỉ đối chiếu tầng lưu trữ mới bắt được (25 phút).
3. Dùng hai nguồn để **khoanh tầng lỗi** — bug hiển thị hay bug lưu (20 phút).
4. Viết máy đối chiếu UI ↔ tầng lưu trữ, có ánh xạ tên trường (35 phút).
5. Mô hình an toàn 4 lớp để nối database thật mà không phá dữ liệu ai (30 phút).

---

## Việc 1 — Cùng một đơn, hai tầng, hai câu trả lời (20 phút)

App thực hành có một cửa nhìn tầng lưu trữ. Nó đóng vai câu `SELECT` trong dự án thật: **cùng một bản ghi,
nhìn từ tầng dưới**.

Chạy app, rồi ở cửa sổ terminal thứ hai:

```bash
curl -s -X POST http://localhost:4010/api/reset
curl -s -X POST http://localhost:4010/api/orders -H "Content-Type: application/json" \
  -d "{\"customerId\":\"KH03\",\"items\":[{\"productId\":\"SP03\",\"qty\":1}]}"
```

Giờ mở `http://localhost:4010`, tạo **đúng** đơn đó bằng tay (khách `Lê Văn C — hạng Vàng`, `Đèn bàn`, số
lượng `1`) và ghi lại bốn số trên màn hình. Rồi gọi cửa tầng lưu trữ:

```bash
curl -s http://localhost:4010/api/_store/orders
```

**Bạn sẽ thấy:**

```json
{"data":[{"id":"DH0001","customer_id":"KH03","rank":"VANG","subtotal_amount":175000,
"discount_amount":8750,"shipping_fee":30000,"total_amount":196250,
"status":"CHO_XAC_NHAN","item_count":1,"created_at_utc":"2026-09-07T11:12:41.432Z"}]}
```

Đặt hai bên cạnh nhau:

| | Màn hình hiện | Tầng lưu trữ ghi | Khớp? |
|---|---|---|---|
| Tạm tính | 175.000 đ | `175000` | ✓ |
| Giảm giá | **8.000 đ** | **`8750`** | ✗ **lệch 750** |
| Phí giao hàng | 30.000 đ | `30000` | ✓ |
| Tổng cộng | 196.250 đ | `196250` | ✓ |

**Điều vừa xảy ra:** bạn vừa bắt được BUG-2 bằng một con đường **hoàn toàn khác** với Bài 13. Ở Bài 13 bạn
tìm ra nó bằng cách cộng thử các số trên màn hình. Ở đây bạn tìm ra nó bằng cách so với nơi lưu. Cùng một
bug, hai máy bắt được — và đó là dấu hiệu bộ kiểm đang khoẻ.

Ba chi tiết trong cửa tầng lưu trữ, mỗi cái có lý do:

| Chi tiết | Vì sao nó như vậy |
|---|---|
| Tên trường **khác hẳn** (`discount_amount` ≠ `giamGia`) | Bắt bạn phải **ánh xạ**, thay vì so tên cho khớp. Database thật không đặt tên theo giao diện |
| `created_at_utc` luôn là UTC | Giao diện hiển thị theo giờ máy người dùng. Đây là nguồn của cả một lớp bug — Việc 2 |
| **Không có đường ghi** | Tiền điều kiện **không được** dựng bằng tầng lưu trữ, dù tầng đó đang mở — Việc 5 |

## Việc 2 — Bảy lớp bug chỉ tầng lưu trữ mới bắt (25 phút)

Đây là lý do bài này tồn tại. Bảy lớp dưới đây **không** hiện ra khi bạn chỉ xem màn hình.

| # | Lớp bug | Biểu hiện trên UI | Sự thật ở tầng lưu trữ |
|---|---|---|---|
| 1 | **Làm tròn** | Số trông đẹp | Lưu `8750` mà hiện `8.000`, hoặc lưu `196249.999999` |
| 2 | **Lệch múi giờ** | "Ngày tạo: 07/09/2026" | Lưu `2026-09-06T17:12Z` — sang ngày khác ở UTC. Đơn cuối tháng bị đếm sai tháng |
| 3 | **Text bị cắt** | Hiện đủ tên khách | Cột `varchar(50)`, tên 60 ký tự bị cắt còn 50 — và **UI đang hiện từ bộ nhớ tạm**, chưa đọc lại |
| 4 | **Xoá mềm hỏng** | Bản ghi biến khỏi danh sách | `deleted_at` chưa được set, hoặc set rồi mà báo cáo không lọc — số liệu tháng vẫn đếm nó |
| 5 | **Bảng liên quan không đổi** | Đơn tạo thành công | `orders` có bản ghi mới nhưng `order_items` rỗng — đơn không có dòng hàng nào |
| 6 | **Tạo trùng** | Một đơn hiện ra | Hai bản ghi. Người dùng bấm hai lần, hoặc callback về hai lần, và không có chốt chống trùng |
| 7 | **Thiếu vết** | Sửa thành công | `updated_by` / `updated_at` không đổi — sau này không truy được ai sửa |

Ba lớp đắt nhất trong thực tế là **2, 5 và 6**:

- **Lớp 2** không lộ ra ngay. Nó lộ vào cuối tháng, khi báo cáo lệch một ngày, và lúc đó không ai nối được
  về đơn nào.
- **Lớp 5** làm đơn "tồn tại mà rỗng". Giao diện chi tiết đơn thường tự tính lại từ dữ liệu đang có trong
  màn, nên nó vẫn hiện đúng — cho tới khi ai đó tải lại trang.
- **Lớp 6** cho ra **đúng** một dòng trên danh sách nếu danh sách gom nhóm, và **hai** dòng nếu không. Bug
  cùng gốc, biểu hiện khác nhau tuỳ màn.

> **Test qua giao diện không bắt được bảy lớp này** — không phải vì bạn viết case dở, mà vì thông tin cần
> thiết **không có mặt** trên giao diện. Thêm case UI bao nhiêu cũng không giúp.

## Việc 3 — Dùng hai nguồn để khoanh tầng lỗi (20 phút)

Đây là công dụng lớn thứ hai, và nhiều người bỏ qua nó.

Khi một case FAIL, Bài 13 bắt bạn điền `tangLoi`. Trước đây bạn đoán. Giờ bạn **đo** được, bằng một bảng bốn ô:

| | Tầng lưu trữ **đúng** | Tầng lưu trữ **sai** |
|---|---|---|
| **UI đúng** | ✓ Không có lỗi | **Bug hiển thị đảo ngược** — UI đang tự tính lại, che mất dữ liệu lưu sai. Nguy hiểm nhất |
| **UI sai** | **Bug hiển thị** — tầng dưới làm đúng, tầng trên vẽ sai | **Bug lưu** — sai từ tầng tính toán, cả hai tầng cùng sai |

Áp vào BUG-2 vừa rồi: UI hiện `8.000`, lưu trữ ghi `8750`, spec nói `8750`. ⇒ ô góc dưới-trái ⇒ **bug hiển
thị**, tầng `frontend`. Bạn khoanh được tầng mà **không** cần đọc một dòng code nào.

Ô góc trên-phải là ô đáng sợ nhất:

> Màn hình hiện đúng, dữ liệu lưu sai — vì màn hình đang hiện lại **giá trị bạn vừa nhập**, không phải giá trị
> nó đọc về từ nơi lưu.

Cách phát hiện: sau khi lưu, **tải lại trang** rồi mới đọc. Nếu số đổi sau khi tải lại, bạn vừa gặp ô đó.
Đây là một dòng thêm vào mọi case tạo/sửa, và nó rẻ:

```js
// tests/e2e/tao-don.spec.js — sau mỗi hành động LƯU, đọc lại từ đầu
const { test, expect } = require('@playwright/test');

test('đơn tạo xong đọc lại vẫn đúng số', async ({ page, request }) => {
  await page.goto('/');
  // … tạo đơn …

  // Không tin số đang hiện: TẢI LẠI rồi đọc, vì trang có thể đang vẽ lại thứ bạn vừa nhập
  await page.reload();
  const tongTrenUI = await page.getByTestId('tong-cong').textContent();

  // Nguồn thứ hai: tầng lưu trữ
  const kho = await (await request.get('/api/_store/orders')).json();
  const donMoi = kho.data[kho.data.length - 1];

  // Oracle CHÍNH vẫn là spec — 196250 tính từ BR-01..BR-04, không lấy từ hai nguồn trên
  expect(donMoi.total_amount).toBe(196250);
  expect(tongTrenUI.replace(/\D/g, '')).toBe('196250');
});
```

> Để ý dòng cuối cùng: **oracle chính vẫn là đặc tả**. Tầng lưu trữ là **oracle phụ** — nó cho bạn tầng lỗi,
> không cho bạn kết luận đúng/sai. So UI với tầng lưu trữ mà cả hai cùng sai thì bạn được "khớp" và ghi PASS.
> Đây đúng là bẫy *"nhất quán ≠ đúng"* của Bài 10, chỉ ở một tầng khác.

## Việc 4 — Máy đối chiếu UI ↔ tầng lưu trữ (35 phút)

Đối chiếu tay được vài đơn. Bộ 200 case thì cần máy. Điểm khó không phải so số — mà là **ánh xạ tên trường**.

`.agent/config/anh-xa-luu-tru.json`:

```json
{
  "$schema": "ánh xạ trường: đặc tả ↔ giao diện ↔ tầng lưu trữ. MỘT nguồn cho cả ba tên gọi.",
  "orders": {
    "khoa": { "ui": "ma-don", "store": "id" },
    "truong": [
      { "y": "Tạm tính", "oracleRef": "BR-01", "ui": "tam-tinh", "store": "subtotal_amount", "kieu": "tien" },
      { "y": "Giảm giá", "oracleRef": "BR-02", "ui": "giam-gia", "store": "discount_amount", "kieu": "tien" },
      { "y": "Phí giao hàng", "oracleRef": "BR-03", "ui": "phi-giao-hang", "store": "shipping_fee", "kieu": "tien", "uiCoTheLaChu": ["Miễn phí"] },
      { "y": "Tổng cộng", "oracleRef": "BR-04", "ui": "tong-cong", "store": "total_amount", "kieu": "tien" },
      { "y": "Trạng thái", "oracleRef": "BR-06", "ui": "trang-thai", "store": "status", "kieu": "enum",
        "banDo": { "Chờ xác nhận": "CHO_XAC_NHAN", "Đã xác nhận": "DA_XAC_NHAN" } }
    ]
  }
}
```

Ba thứ trong file này đáng chú ý:

1. **`oracleRef` bắt buộc.** Không có mã luật thì phép so chỉ nói "hai tầng khác nhau", không nói tầng nào
   sai. Máy sẽ chặn nếu thiếu.
2. **`uiCoTheLaChu`** — `BR-03` + `UI-03` nói phí bằng 0 thì hiện chữ *"Miễn phí"*. Không khai thì máy báo
   lệch oan, và gate bắt oan thì gate chết (Bài 28).
3. **`banDo`** cho enum — giao diện hiện tiếng Việt, tầng lưu trữ ghi mã. So thô là lệch 100%.

```js
#!/usr/bin/env node
/*
 * doi-chieu-luu-tru.js — so giá trị UI với giá trị ở tầng lưu trữ, theo ánh xạ đã khai.
 *
 * Mã thoát:  0 = khớp   ·   1 = có lệch   ·   2 = không đo được
 *
 * KHÔNG kết luận "app đúng" khi hai tầng khớp — hai tầng cùng sai thì cũng khớp. Máy này chỉ trả lời
 * "UI và nơi lưu có nói cùng một thứ không", và nhờ đó KHOANH TẦNG cho một FAIL đã biết.
 */
'use strict';
const fs = require('fs');

const CAU_HINH = '.agent/config/anh-xa-luu-tru.json';
if (!fs.existsSync(CAU_HINH)) {
  console.error('[doi-chieu] KHÔNG ĐO ĐƯỢC: thiếu ' + CAU_HINH);
  process.exit(2);
}
const anhXa = JSON.parse(fs.readFileSync(CAU_HINH, 'utf8'));

/** Bỏ mọi thứ không phải chữ số. "196.250 đ" → 196250 */
function soTuChu(s) {
  const t = String(s == null ? '' : s).replace(/[^\d-]/g, '');
  return t === '' ? null : Number(t);
}

/**
 * So một bản ghi. Trả về mảng lệch. Mỗi lệch nói rõ tầng nào ghi gì — người đọc không phải đoán.
 * @param {object} ui    giá trị đọc từ giao diện, khoá theo data-testid
 * @param {object} store bản ghi đọc từ tầng lưu trữ
 */
function soMotBanGhi(bang, ui, store) {
  const cauHinh = anhXa[bang];
  if (!cauHinh) throw new Error(`chưa khai ánh xạ cho bảng "${bang}"`);

  const lech = [];
  for (const t of cauHinh.truong) {
    if (!t.oracleRef) { lech.push(`${t.y}: THIẾU oracleRef trong ánh xạ`); continue; }

    const vUi = ui[t.ui];
    const vStore = store[t.store];
    if (vUi === undefined) { lech.push(`${t.y}: không đọc được từ giao diện (testid ${t.ui})`); continue; }
    if (vStore === undefined) { lech.push(`${t.y}: không có trường ${t.store} ở tầng lưu trữ`); continue; }

    if (t.kieu === 'tien') {
      // Chữ thay số là hợp lệ nếu đã khai — vd "Miễn phí" cho 0
      if ((t.uiCoTheLaChu || []).some((c) => String(vUi).trim() === c)) {
        if (Number(vStore) !== 0) lech.push(`${t.y}: UI hiện "${vUi}" (nghĩa là 0) mà lưu trữ ghi ${vStore}`);
        continue;
      }
      const a = soTuChu(vUi);
      if (a === null) { lech.push(`${t.y}: UI hiện "${vUi}", không đọc ra số`); continue; }
      if (a !== Number(vStore)) {
        lech.push(`${t.y} (${t.oracleRef}): UI ${a} ≠ lưu trữ ${vStore} — lệch ${Number(vStore) - a}`);
      }
    } else if (t.kieu === 'enum') {
      const mong = (t.banDo || {})[String(vUi).trim()];
      if (mong === undefined) { lech.push(`${t.y}: UI hiện "${vUi}" — chưa có trong banDo`); continue; }
      if (mong !== vStore) lech.push(`${t.y} (${t.oracleRef}): UI "${vUi}" ⇒ ${mong}, lưu trữ ghi ${vStore}`);
    } else {
      if (String(vUi).trim() !== String(vStore).trim()) {
        lech.push(`${t.y} (${t.oracleRef}): UI "${vUi}" ≠ lưu trữ "${vStore}"`);
      }
    }
  }
  return lech;
}

/* Chạy trực tiếp: đọc một file JSON chứa [{bang, ui, store}] do test ghi ra. */
if (require.main === module) {
  const f = process.argv[2];
  if (!f || !fs.existsSync(f)) {
    console.error('Dùng: node scripts/qa/doi-chieu-luu-tru.js <cap-doi-chieu.json>');
    process.exit(2);
  }
  const cap = JSON.parse(fs.readFileSync(f, 'utf8'));
  let tongLech = 0;
  for (const c of cap) {
    let lech;
    try { lech = soMotBanGhi(c.bang, c.ui, c.store); }
    catch (e) { console.error('[doi-chieu] KHÔNG ĐO ĐƯỢC: ' + e.message); process.exit(2); }
    if (!lech.length) continue;
    tongLech += lech.length;
    console.error(`\n✗ ${c.bang} ${c.ui[anhXa[c.bang].khoa.ui] || '(không mã)'}`);
    for (const l of lech) console.error('   - ' + l);
  }
  if (tongLech) {
    console.error(`\n[doi-chieu] ✗ ${tongLech} lệch giữa giao diện và tầng lưu trữ.`);
    console.error('  UI sai + lưu trữ ĐÚNG theo spec ⇒ bug hiển thị (frontend).');
    console.error('  UI và lưu trữ CÙNG lệch spec ⇒ bug lưu (backend).');
    console.error('  Đừng kết luận chỉ từ hai tầng khớp nhau — cả hai cùng sai thì cũng khớp.');
    process.exit(1);
  }
  console.log(`[doi-chieu] ✓ ${cap.length} bản ghi: giao diện và tầng lưu trữ nói cùng một thứ.`);
}

module.exports = { soMotBanGhi, soTuChu };
```

### Thử nó — hai lần, hai kết quả

**Lần 1 — ca lệch thật.** Tạo file `cap.json`:

```json
[{ "bang": "orders",
   "ui": { "ma-don": "DH0001", "tam-tinh": "175.000 đ", "giam-gia": "8.000 đ",
           "phi-giao-hang": "30.000 đ", "tong-cong": "196.250 đ", "trang-thai": "Chờ xác nhận" },
   "store": { "id": "DH0001", "subtotal_amount": 175000, "discount_amount": 8750,
              "shipping_fee": 30000, "total_amount": 196250, "status": "CHO_XAC_NHAN" } }]
```

```bash
node scripts/qa/doi-chieu-luu-tru.js cap.json; echo "mã thoát = $?"
```

**Bạn sẽ thấy:**

```
✗ orders DH0001
   - Giảm giá (BR-02): UI 8000 ≠ lưu trữ 8750 — lệch 750

[doi-chieu] ✗ 1 lệch giữa giao diện và tầng lưu trữ.
mã thoát = 1
```

**Lần 2 — đối chứng âm.** Sửa `"giam-gia"` thành `"8.750 đ"` và chạy lại. Phải ra `mã thoát = 0`.

Bước này bắt buộc. Máy chỉ báo đỏ mà chưa từng báo xanh thì bạn không biết nó đang **so** hay đang **luôn
chê**.

**Lần 3 — ca "Miễn phí".** Đổi `"phi-giao-hang"` thành `"Miễn phí"` và `shipping_fee` thành `0`. Phải ra
`0` — nếu ra `1` thì `uiCoTheLaChu` khai chưa đúng, và bạn vừa tránh được một gate bắt oan.

## Việc 5 — Nối database thật mà không phá gì (30 phút)

App thực hành lưu trong bộ nhớ. Dự án thật là một database có dữ liệu người khác đang dùng. Đây là chỗ dễ
gây tai nạn nhất trong cả tài liệu này.

### Mô hình an toàn 4 lớp

```
┌─ Lớp 1 · TÀI KHOẢN CHỈ ĐỌC ───────────── lớp CHÍNH. Database từ chối mọi lệnh ghi
│  ┌─ Lớp 2 · CHẶN CÂU LỆNH ────────────── chỉ cho SELECT đi qua, chặn ở phía mã nguồn
│  │  ┌─ Lớp 3 · KHOÁ THEO MÔI TRƯỜNG ──── chuỗi kết nối không phải UAT ⇒ từ chối chạy
│  │  │  ┌─ Lớp 4 · KHOÁ THEO TASK ─────── mỗi task một chuỗi kết nối riêng, không dùng .env chung
```

Điểm quan trọng nhất, và cũng là chỗ nhiều người làm ngược:

> **Lớp 1 phải là lớp chính.** Nhiều người dùng transaction rồi rollback và coi thế là an toàn — *"tôi có
> ghi, nhưng tôi hoàn lại"*. Không an toàn: script chết giữa đường thì transaction không rollback; một
> `COMMIT` lọt vào thì mất luôn; và trigger/sequence vẫn chạy dù rollback.
>
> **Tài khoản chỉ đọc thì database từ chối lệnh ghi — bạn không cần đúng để an toàn.**

### Lớp 2, viết ra code

```js
/*
 * tests/support/setup/db/uatClient.js — cửa DUY NHẤT đi tới tầng lưu trữ.
 *
 * VÌ SAO CHỈ MỘT CỬA: mỗi chỗ tự mở kết nối thì mỗi chỗ tự quyết mình được làm gì,
 * và bốn lớp an toàn chỉ còn là gợi ý.
 */
'use strict';

const CHI_SELECT = /^\s*(select|with)\b/i;
const CAM = /\b(insert|update|delete|drop|truncate|alter|create|grant|commit|call|do)\b/i;

function kiemChuoiKetNoi(url) {
  if (!url) throw new Error('SETUP: thiếu chuỗi kết nối — khai ở profiles/<TASK>/task.env, KHÔNG ở .env chung');
  // Lớp 3: chỉ môi trường UAT. Tên host phải khai tường minh, không đoán theo từ khoá.
  const choPhep = (process.env.DB_HOST_ALLOWLIST || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!choPhep.length) throw new Error('SETUP: chưa khai DB_HOST_ALLOWLIST — không có allowlist thì không chạy');
  const host = new URL(url).hostname;
  if (!choPhep.includes(host)) {
    throw new Error(`SETUP: host "${host}" không có trong DB_HOST_ALLOWLIST. Đây là lớp chặn, không phải lỗi cấu hình.`);
  }
  return url;
}

/** Lớp 2: chặn ở phía mã nguồn. Lớp 1 (tài khoản chỉ đọc) vẫn là lớp chính. */
function kiemCau(sql) {
  if (!CHI_SELECT.test(sql)) throw new Error('CHẶN: chỉ cho phép SELECT/WITH. Nhận được: ' + sql.slice(0, 60));
  if (CAM.test(sql)) throw new Error('CHẶN: câu lệnh chứa từ khoá ghi. Nhận được: ' + sql.slice(0, 60));
  return sql;
}

module.exports = { kiemChuoiKetNoi, kiemCau };
```

### Thiết kế đa database: interface theo **ngữ nghĩa**, không theo SQL

Sai lầm hay gặp: viết hàm `chayCauSql(sql)` rồi rải câu SQL khắp test. Hệ quả: dự án dùng Mongo là viết lại
hết, và mỗi test tự quyết join thế nào.

Đúng: khai theo **câu hỏi nghiệp vụ**.

```js
/*
 * Giao diện tầng lưu trữ khai theo NGỮ NGHĨA. Test hỏi "đơn này lưu ra sao", không hỏi "chạy SQL này".
 * Đổi Postgres sang Mongo thì thay bản cài đặt, test không sửa một dòng.
 */
const khoDonHang = {
  /** @returns {Promise<object|null>} bản ghi đơn, tên trường đã chuẩn hoá theo anh-xa-luu-tru.json */
  layDonTheoMa: async function (ma) { throw new Error('chưa cài đặt'); },
  /** @returns {Promise<number>} số dòng hàng của đơn — dùng bắt lớp bug 5 (bảng liên quan không đổi) */
  demDongHang: async function (ma) { throw new Error('chưa cài đặt'); },
  /** @returns {Promise<object[]>} các đơn TRÙNG theo khoá nghiệp vụ — dùng bắt lớp bug 6 */
  timDonTrung: async function (maKhach, khoangGiay) { throw new Error('chưa cài đặt'); }
};

module.exports = { khoDonHang };
```

Ba hàm trên không phải ví dụ ngẫu nhiên: mỗi hàm **nhắm đúng một lớp bug** ở Việc 2. Đó là cách chọn hàm cho
giao diện này — đi từ lớp bug muốn bắt, không đi từ bảng có sẵn.

### Điều tuyệt đối không làm

> **Không dựng tiền điều kiện bằng tầng lưu trữ**, dù bạn đang có kết nối mở.

Ba lý do, xếp theo mức đau:

| Lý do | Cụ thể |
|---|---|
| Bỏ qua chính luồng cần test | `INSERT` một đơn "đã xác nhận" là bỏ qua toàn bộ đường tạo + xác nhận, và bạn không biết đường đó có chạy |
| Thiếu tác dụng phụ | Ứng dụng còn ghi bảng liên quan, đẩy hàng đợi, sinh mã tham chiếu. `INSERT` tay thiếu hết |
| Sinh trạng thái **không tồn tại được** | Bạn dựng ra tổ hợp mà ứng dụng không bao giờ tạo ra, rồi log một bug không có thật — **bug ma** (Bài 12) |

Dựng state qua giao diện, API, factory hoặc hook. Tầng lưu trữ chỉ để **đọc và đối chiếu**.

Và một câu nữa, ngắn:

> **Tầng lưu trữ không phải bằng chứng.** Ảnh chụp một câu `SELECT` không phải evidence cho một case (Bài 13) —
> nó không chứng minh người dùng thấy gì. Nó là dữ liệu để khoanh tầng, đính vào phần phân tích của bug.

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   └── anh-xa-luu-tru.json              ← MỚI · một nguồn cho 3 tên gọi của cùng một trường
├── scripts/qa/
│   └── doi-chieu-luu-tru.js             ← MỚI · máy so UI ↔ tầng lưu trữ (exit 0/1/2)
└── tests/support/setup/db/
    ├── uatClient.js                     ← MỚI · cửa DUY NHẤT tới database, 4 lớp an toàn
    └── khoDonHang.js                    ← MỚI · giao diện theo NGỮ NGHĨA, không theo SQL
```

Để ý `khoDonHang.js` nằm ở `tests/support/`, không ở `scripts/qa/`: nó không tự chạy được và không chặn gì —
nó là hạ tầng test. Câu hỏi phân loại ở Bài 0 vẫn dùng được.

## Tự kiểm

1. Kể ba trong bảy lớp bug mà chỉ tầng lưu trữ mới bắt. Vì sao thêm case UI không giúp?
2. UI hiện `8.000`, lưu trữ ghi `8750`, spec nói `8750` — tầng lỗi là gì? Còn nếu spec nói `8.000`?
3. Ô "UI đúng / lưu trữ sai" nguy hiểm ở đâu? Một dòng code nào phát hiện được nó?
4. Vì sao tài khoản chỉ đọc phải là lớp **chính**, không phải transaction + rollback?
5. Vì sao `uiCoTheLaChu` tồn tại trong file ánh xạ? Không có nó thì gate hỏng kiểu gì?
6. Hai tầng khớp nhau — kết luận được app đúng chưa? Vì sao?
7. Bạn có kết nối database đang mở và cần một đơn "đã xác nhận". Vì sao **không** `INSERT`?

## Bài tập về nhà (30 phút)

Ba việc trên app thực hành:

1. Viết một test Playwright tạo đơn qua giao diện, **tải lại trang**, rồi đọc cả UI và `/api/_store/orders`,
   ghi ra `cap.json`, và chạy máy đối chiếu. Nó phải bắt được BUG-2 **mà không** cần bạn nói trước lệch ở đâu.
2. Với dự án thật của bạn: viết ra ba hàm đầu tiên cho giao diện ngữ nghĩa — đi từ **lớp bug muốn bắt**, không
   từ bảng có sẵn. Ghi rõ mỗi hàm nhắm lớp nào trong bảy lớp.
3. Kiểm lớp 1 của bạn có thật: dùng tài khoản đọc của bạn chạy `UPDATE ... WHERE 1=0` (không sửa dòng nào).
   Database phải **từ chối vì thiếu quyền**. Nếu nó chạy được thì bạn đang không có lớp 1, chỉ có lớp 2 — và
   lớp 2 thì một lỗi chính tả trong regex là xuyên qua.

Việc 3 là việc quan trọng nhất. Đây là đối chứng âm cho lớp an toàn của bạn, và hầu như không ai làm nó.

## Đọc thêm

- Bài 13 — [bằng chứng và phân tầng lỗi](verdict-va-phan-tang-loi.md): bảng bốn ô ở Việc 3 đưa thẳng vào
  trường `tangLoi`.
- Bài 10 — [oracle](oracle.md): "nhất quán ≠ đúng" ở đây là hai **tầng** cùng sai, không phải hai màn.
- Bài 12 — [tiền điều kiện](tien-dieu-kien.md): vì sao dựng state bằng tầng lưu trữ sinh ra **bug ma**.
