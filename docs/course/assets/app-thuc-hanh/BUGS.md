# ⚠ ĐÁP ÁN — đừng mở trước khi làm hết Phần 3

Nếu bạn đang ở Phần 1 hoặc Phần 2, **đóng file này lại**. Tự tìm được ba bug này là bài học lớn nhất của
tài liệu; đọc đáp án trước là bỏ mất nó.

Còn nếu bạn đã làm hết Phần 3 (hoặc đang bí thật), đọc tiếp.

---

## BUG-1 — Lấy sai lớp làm mốc cắt hạn

**Tầng lỗi:** backend (logic nghiệp vụ)
**Vi phạm:** `BR-02`
**Ở đâu:** [`server.js`](server.js), hàm `tinhHan`

```js
// Đang là: sắp mọi lớp mới theo ngày bắt đầu rồi lấy lớp sớm nhất
const ungVien = [...dsLopMoi].sort((a, b) => soNgay(a.batDau) - soNgay(b.batDau));

// BR-02 nói mốc chỉ lấy theo LỚP CHÍNH:
const ungVien = dsLopMoi.filter((l) => l.loai === 'LESSON')
  .sort((a, b) => soNgay(a.batDau) - soNgay(b.batDau));
```

**Tái hiện:** học viên `HV01`, lớp cũ `CFA01`. Học viên này được xếp vào **hai** lớp mới: `CFA02F`
(Foundation, bắt đầu 01/07/2026) và `CFA02` (Lớp chính, bắt đầu 01/09/2026).

| | Lớp lấy làm mốc | Hạn mới của `CFA01` |
|---|---|---|
| App trả | `CFA02F` — Foundation | **30/06/2026** |
| Spec `BR-02` + `BR-03` | `CFA02` — Lớp chính | **31/08/2026** |

Học viên mất quyền vào lớp cũ **sớm hơn hai tháng** so với thứ spec cho phép.

**Vì sao nó dễ lọt:** chỉ sai khi học viên có **lớp đi kèm bắt đầu sớm hơn lớp chính**. Học viên chỉ được
xếp vào một lớp chính — như `HV03` — thì hai công thức cho **cùng** một kết quả, nên nếu bạn chỉ test một
ca "bình thường" thì không bao giờ thấy. Đây là lý do Bài 8 bắt bạn phủ **loại lớp × thứ tự ngày bắt đầu**,
không phải chỉ một ca happy path.

**Bài học:** một bug nằm ở chỗ **chọn dữ liệu nào để tính** chỉ hiện ra khi bộ dữ liệu của bạn có **nhiều
ứng viên** cho chỗ chọn đó. Một ứng viên thì mọi cách chọn đều ra cùng kết quả.

---

## BUG-2 — Ngày hết hạn trên màn không khớp thời hạn trên màn

**Tầng lỗi:** frontend (hiển thị)
**Vi phạm:** `UI-04`
**Ở đâu:** [`app.js`](app.js), hàm `veBangHocVien`

```js
// Đang là: cộng số ngày gia hạn vào thời hạn của LỚP
const hetHan = congNgay(lop.ketThuc, g.giaHan);

// BR-09 nói cộng vào thời hạn của GHI DANH:
const hetHan = congNgay(g.ketThuc, g.giaHan);
```

**Tái hiện:** đồng bộ học lại cho `HV01`, rồi mở lớp `CFA01`. Màn hình hiện:

| # | Học viên | Loại | Thời hạn | Gia hạn (ngày) | Ngày hết hạn |
|---|---|---|---|---|---|
| 1 | Nguyễn Văn A | Học lại | 01/03/2026 - **30/06/2026** | — | **31/07/2026** |

Cộng thử các số đang hiện: thời hạn kết thúc **30/06**, gia hạn **0 ngày**, vậy ngày hết hạn phải là
**30/06**. Nhưng màn hiện **31/07** — muộn hơn một tháng.

Gia hạn thêm 30 ngày thì lệch càng rõ: cột Thời hạn vẫn kết thúc 30/06, cột Gia hạn hiện 30, nên ngày hết
hạn phải là **30/07/2026**. Màn hiện **30/08/2026**.

**Backend tính đúng.** `GET /api/_store/ghi-danh` trả `duration_end: 2026-06-30` và
`expire_date: 2026-07-30`. Lỗi hoàn toàn nằm ở chỗ hiển thị: giao diện lấy hạn của **lớp** thay cho hạn của
**học viên trong lớp**.

**Vì sao nó dễ lọt:** với học viên **Thường** thì hạn của ghi danh **bằng** hạn của lớp, nên hai công thức
cho cùng kết quả và màn hình trông hoàn toàn đúng. Bug chỉ hiện ra ở học viên đã bị cắt hạn hoặc gia hạn —
tức là đúng những người mà cả tính năng này tồn tại để phục vụ. Và nếu kết quả mong đợi của bạn chỉ nói
"Ngày hết hạn = 31/07/2026" thì test **xanh**, vì đó chính là con số đang hiện.

**Bài học:** kiểm từng trường một không đủ. Có loại bug chỉ sống ở **quan hệ** giữa các số đang hiện cùng
lúc trên một màn.

---

## BUG-3 — Chốt trạng thái không có ở backend

**Tầng lỗi:** backend (thiếu chốt bảo vệ trạng thái)
**Vi phạm:** `BR-10` và `BR-11`
**Ở đâu:** [`server.js`](server.js), nhánh `PATCH /api/ghi-danh/:id` và `DELETE /api/ghi-danh/:id`

```js
// PATCH đang là: đổi gì cũng được
if (b.type) gd.type = b.type;

// BR-11 nói Học lại không có đường về Thường:
if (b.type && gd.type === 'RETOOK' && b.type !== 'RETOOK') {
  return traJson(res, 409, { error: 'không có luồng đưa học viên học lại về loại thường' });
}

// DELETE đang là: xoá luôn
const bo = ghiDanh.splice(i, 1)[0];

// BR-10 nói chỉ xoá được học viên loại Thường:
if (ghiDanh[i].type !== 'NORMAL') {
  return traJson(res, 409, { error: 'chỉ xoá được học viên loại Thường khỏi lớp' });
}
```

**Tái hiện** (không làm được qua giao diện — phải gọi API):

```bash
# 1. Dựng lại dữ liệu sạch
curl -s -X POST http://localhost:4010/api/reset

# 2. Đồng bộ học lại cho HV01 — ghi danh GD001 chuyển sang loại Học lại
curl -s -X POST http://localhost:4010/api/dong-bo-hoc-lai \
  -H 'Content-Type: application/json' -d '{"hocVienId":"HV01"}'

# 3. Đưa Học lại về Thường — BR-11 nói không tồn tại luồng này
curl -s -X PATCH http://localhost:4010/api/ghi-danh/GD001 \
  -H 'Content-Type: application/json' -d '{"type":"NORMAL"}'
#    → HTTP 200, và student_type trong tầng lưu trữ đã thành NORMAL

# 4. Xoá học viên loại Học lại khỏi lớp — BR-10 nói phải bị từ chối
curl -s -X POST http://localhost:4010/api/reset
curl -s -X POST http://localhost:4010/api/dong-bo-hoc-lai \
  -H 'Content-Type: application/json' -d '{"hocVienId":"HV01"}'
curl -s -X DELETE http://localhost:4010/api/ghi-danh/GD001
#    → HTTP 200 {"data":{"daXoa":"GD001"}} — bản ghi biến mất khỏi lớp
```

**Vì sao nó dễ lọt:** giao diện **không có** lựa chọn nào để làm hai việc trên. Menu `⋮` của mỗi hàng chỉ
có *Gia hạn* và *Lịch sử*. Nên nếu bạn chỉ test qua giao diện, bạn sẽ thấy "không làm được" và ghi PASS.
Nhưng **không có nút không phải là thực thi luật** — nó chỉ là không mời người dùng làm. Bất cứ ai gọi được
API đều đi xuyên qua. Và ở hệ thống thật, đường đi xuyên đó là luồng đồng bộ từ hệ thống khác, không phải
người ngồi gõ curl.

**Bài học:** giao diện có thể **che** một backend không có chốt bảo vệ. Luật kiểu "không được làm X" phải
được kiểm ở **tầng backend**, không phải ở tầng nút bấm. Đây là lý do quy tắc của tài liệu là **test cả
giao diện lẫn API** — mỗi tầng bắt được loại bug mà tầng kia không bắt được.

---

## Ba bug, ba loại điểm mù

Ba bug này không phải chọn ngẫu nhiên. Mỗi cái đại diện cho một cách bộ kiểm bị mù:

| Bug | Bộ kiểm mù vì | Bài chữa |
|---|---|---|
| BUG-1 | dữ liệu chỉ có **một ứng viên** cho chỗ chọn, nên mọi cách chọn đều ra cùng kết quả | Bài 8 — độ phủ theo chiều |
| BUG-2 | kiểm từng trường, không kiểm **quan hệ giữa các trường đang hiện cùng lúc** | Bài 7 — kết quả mong đợi · Bài 12 — bằng chứng |
| BUG-3 | chỉ test **một tầng** (giao diện) | Bài 18 — test cả giao diện lẫn API |

Nếu bộ kiểm của bạn bắt được cả ba, nó đã vượt qua ba điểm mù phổ biến nhất. Nếu chưa — quay lại đúng bài
ở cột cuối.
