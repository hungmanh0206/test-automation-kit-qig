# ⚠ ĐÁP ÁN — đừng mở trước khi làm hết Phần 3

Nếu bạn đang ở Phần 1 hoặc Phần 2, **đóng file này lại**. Tự tìm được ba bug này là bài học lớn nhất của
khoá học; đọc đáp án trước là bỏ mất nó.

Còn nếu bạn đã làm hết Phần 3 (hoặc đang bí thật), đọc tiếp.

---

## BUG-1 — Phí dịch vụ so mốc trên số sai

**Tầng lỗi:** backend (logic tính toán)
**Vi phạm:** `BR-03`
**Ở đâu:** [`server.js`](server.js), hàm `tinhTien`

```js
// Đang là:
const phiDichVu = (tamTinh - giamGia) >= 500000 ? 0 : 30000;
// BR-03 nói mốc so trên TẠM TÍNH:
const phiDichVu = tamTinh >= 500000 ? 0 : 30000;
```

**Tái hiện:** khách `HV02` (chương trình Pro, giảm 3%), thêm `KH01` số suất **2**.

| | Tạm tính | Giảm giá | Phí dịch vụ | Tổng cộng |
|---|---|---|---|---|
| App trả | 500.000 | 15.000 | **30.000** | **515.000** |
| Spec `BR-03` + `BR-04` | 500.000 | 15.000 | **0** | **485.000** |

**Vì sao nó dễ lọt:** chỉ sai trong một **dải hẹp** — khi tạm tính vừa đủ mốc nhưng trừ giảm giá thì tụt
xuống dưới mốc. Với chương trình Standard (giảm 0%) thì hai công thức cho **cùng** kết quả, nên nếu bạn chỉ test
khách chương trình Standard thì không bao giờ thấy. Đây là lý do Bài 8 bắt bạn phủ **giá trị biên × chương trình**,
không phải chỉ một ca "happy path".

**Bài học:** một bug ở biên chỉ hiện ra khi bạn **cố tình** chọn dữ liệu ở biên. Nó không tự hiện ra khi
bạn dùng dữ liệu đẹp.

---

## BUG-2 — Các số trên màn hình không cộng đúng

**Tầng lỗi:** frontend (hiển thị)
**Vi phạm:** `UI-04`
**Ở đâu:** [`app.js`](app.js), hàm `capNhatTien`

```js
// Đang là:
q('giam-gia').textContent = tien(Math.floor(t.giamGia / 1000) * 1000);
// Phải là:
q('giam-gia').textContent = tien(t.giamGia);
```

**Tái hiện:** khách `HV03` (chương trình Elite, giảm 5%), thêm `KH03` số suất **1**.

Màn hình hiện:

| Nhãn | Số hiện trên màn hình |
|---|---|
| Tạm tính | 175.000 đ |
| Giảm giá | **8.000 đ** |
| Phí dịch vụ | 30.000 đ |
| **Tổng cộng** | **196.250 đ** |

Cộng thử các số đang hiện: `175.000 − 8.000 + 30.000 = 197.000`. Nhưng Tổng cộng hiện **196.250**.
Lệch **750 đ**.

**Backend tính đúng.** `giamGia` thật là `8.750`, và `196.250` là tổng đúng theo `BR-04`. Lỗi hoàn toàn
nằm ở chỗ hiển thị: giao diện làm tròn xuống nghìn *chỉ riêng* dòng Giảm giá.

**Vì sao nó dễ lọt:** nếu kết quả mong đợi của bạn chỉ nói "Tổng cộng = 196.250" thì test **xanh** — vì
tổng cộng đúng thật. Bug chỉ hiện ra khi bạn kiểm **quan hệ giữa các số đang hiện**, không phải kiểm từng
số riêng lẻ. Nó cũng chỉ hiện với chương trình Elite ở những số tiền mà 5% không chia hết 1.000.

**Bài học:** kiểm từng trường một không đủ. Có loại bug chỉ sống ở **quan hệ** giữa các trường.

---

## BUG-3 — Đơn đã xác nhận vẫn sửa được qua API

**Tầng lỗi:** backend (thiếu chốt bảo vệ trạng thái)
**Vi phạm:** `BR-08`
**Ở đâu:** [`server.js`](server.js), nhánh `PATCH /api/orders/:id`

```js
// Đang là: sửa xong luôn, không kiểm trạng thái
const b = await docBody(req);
if (Array.isArray(b.items) && b.items.length) { /* ... sửa ... */ }

// Phải có chốt trước khi sửa:
if (d.status !== 'CHO_XAC_NHAN') {
  return traJson(res, 409, { error: 'đơn đã xác nhận, không sửa được' });
}
```

**Tái hiện** (không làm được qua giao diện — phải gọi API):

```bash
# 1. Tạo đơn
curl -s -X POST http://localhost:4010/api/orders -H 'Content-Type: application/json' \
  -d '{"customerId":"HV01","items":[{"productId":"KH02","qty":1}]}'
#    → tổng cộng 130.000, trạng thái CHO_XAC_NHAN, mã ví dụ DH0001

# 2. Xác nhận nó
curl -s -X POST http://localhost:4010/api/orders/DH0001/confirm

# 3. Sửa đơn ĐÃ XÁC NHẬN — spec BR-08 nói phải bị chặn
curl -s -X PATCH http://localhost:4010/api/orders/DH0001 -H 'Content-Type: application/json' \
  -d '{"items":[{"productId":"KH01","qty":9}]}'
#    → HTTP 200, và đơn đã xác nhận giờ có tổng cộng 2.250.000
```

**Vì sao nó dễ lọt:** giao diện **ẩn** nút sửa với đơn đã xác nhận. Nên nếu bạn chỉ test qua giao diện, bạn
sẽ thấy "không sửa được" và ghi PASS. Nhưng ẩn nút không phải là thực thi luật — nó chỉ là không mời người
dùng làm. Bất cứ ai gọi được API đều đi xuyên qua.

**Bài học:** giao diện có thể **che** một backend không có chốt bảo vệ. Luật kiểu "không được làm X" phải
được kiểm ở **tầng backend**, không phải ở tầng nút bấm. Đây là lý do quy tắc của khoá là **test cả giao
diện lẫn API** — mỗi tầng bắt được loại bug mà tầng kia không bắt được.

---

## Ba bug, ba loại điểm mù

Ba bug này không phải chọn ngẫu nhiên. Mỗi cái đại diện cho một cách bộ kiểm bị mù:

| Bug | Bộ kiểm mù vì | Bài chữa |
|---|---|---|
| BUG-1 | chỉ test dữ liệu đẹp, không test **biên** | Bài 8 — độ phủ theo chiều |
| BUG-2 | kiểm từng trường, không kiểm **quan hệ giữa các trường** | Bài 7 — kết quả mong đợi · Bài 12 — bằng chứng |
| BUG-3 | chỉ test **một tầng** (giao diện) | Bài 18 — test cả giao diện lẫn API |

Nếu bộ kiểm của bạn bắt được cả ba, nó đã vượt qua ba điểm mù phổ biến nhất. Nếu chưa — quay lại đúng bài
ở cột cuối.
