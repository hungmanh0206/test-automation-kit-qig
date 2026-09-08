# Đặc tả — Cổng đăng ký khoá học

> Đây là **spec**: bản mô tả app *phải* làm gì. Cả khoá học sẽ neo mọi kết luận đúng/sai vào file này.
>
> Mỗi luật có một **mã** (`BR-xx`). Khi bạn nói "chỗ này sai", bạn phải chỉ được mã luật nó vi phạm.
> Không chỉ được mã nào thì bạn chưa chứng minh được gì — bạn chỉ đang thấy lạ.

## 1. Màn Tạo đơn hàng

Người dùng chọn **một** học viên, thêm sản phẩm vào giỏ, rồi bấm **Tạo đơn**.

### Học viên

| Mã | Tên | Hạng |
|---|---|---|
| `HV01` | Nguyễn Văn A | Thường |
| `HV02` | Trần Thị B | Bạc |
| `HV03` | Lê Văn C | Vàng |

### Khoá học

| Mã | Tên | Đơn giá |
|---|---|---|
| `KH01` | Ôn thi CFA Level 1 | 260.000 đ |
| `KH02` | Ôn thi ACCA F2 | 100.000 đ |
| `KH03` | Ôn thi CMA Part 1 | 175.000 đ |

## 2. Luật tính tiền

| Mã | Luật |
|---|---|
| **BR-01** | Đơn phải có ít nhất một dòng khoá học. Đơn rỗng thì chặn |
| **BR-02** | **Tạm tính** = tổng của (đơn giá × số suất) trên mọi dòng trong đơn |
| **BR-03** | **Giảm giá** = Tạm tính × tỉ lệ theo chương trình. Standard **0%** · Pro **3%** · Elite **5%**. Làm tròn đến đồng |
| **BR-04** | **Phí dịch vụ**: nếu **Tạm tính** từ **500.000 đ** trở lên thì **0 đ** (miễn phí); ngược lại **50.000 đ** |
| **BR-05** | **Tổng phải thu** = Tạm tính − Giảm giá + Phí dịch vụ |
| **BR-06** | **Số suất** phải là số nguyên trong khoảng **1–99**. Ngoài khoảng thì chặn, hiện thông báo *"Số suất phải từ 1 đến 99"* |
| **BR-07** | Đơn ở trạng thái **đã xác nhận** thì **không được sửa**. Mọi yêu cầu sửa phải bị từ chối |

> **BR-04 nói rõ mốc so trên _Tạm tính_**, không phải trên số nào khác. Đọc kỹ dòng này.

## 3. Luật hiển thị

| Mã | Luật |
|---|---|
| **UI-01** | Bốn số Tạm tính · Giảm giá · Phí dịch vụ · Tổng cộng đều hiện trên màn Tạo đơn hàng |
| **UI-02** | Số tiền định dạng kiểu Việt Nam, phân cách nghìn bằng dấu chấm, kèm `đ`. Ví dụ `260.000 đ` |
| **UI-03** | Phí dịch vụ bằng 0 thì hiện chữ **"Miễn phí"** thay cho số |
| **UI-04** | **Các số hiển thị phải cộng đúng với nhau**: số Tạm tính trừ số Giảm giá cộng số Phí dịch vụ đang hiện trên màn hình phải bằng đúng số Tổng cộng đang hiện |

> **UI-04 là một luật về _màn hình_, không phải về tính toán.** Backend tính đúng mà màn hình hiện các số
> không cộng lại thành tổng thì vẫn là vi phạm — vì người dùng nhìn màn hình, không nhìn backend.

## 4. Luật trạng thái đơn hàng

| Mã | Luật |
|---|---|
| **BR-06** | Đơn mới tạo có trạng thái **Chờ xác nhận** |
| **BR-07** | Đơn **Chờ xác nhận** thì xác nhận được. Đơn **Đã xác nhận** thì không xác nhận lại được |
| **BR-08** | Đơn **Đã xác nhận** thì **không sửa được nữa** — bằng mọi đường, kể cả gọi trực tiếp API |

> **BR-08 nói "bằng mọi đường".** Giao diện ẩn nút sửa **không phải** là thực thi luật này — ẩn nút chỉ là
> không mời người dùng làm. Luật chỉ được thực thi khi **backend từ chối**.

## 5. Giao diện HTTP (dùng cho test tầng API)

Máy chủ chạy ở `http://localhost:4010`.

| Cách | Đường | Làm gì |
|---|---|---|
| `GET` | `/api/students` | Danh sách khách |
| `GET` | `/api/courses` | Danh sách sản phẩm |
| `POST` | `/api/quote` | Tính tiền mà chưa tạo đơn. Body `{customerId, items:[{productId,qty}]}` |
| `GET` | `/api/orders` | Danh sách đơn |
| `GET` | `/api/orders/:id` | Một đơn |
| `POST` | `/api/orders` | Tạo đơn. Body như `/api/quote` |
| `POST` | `/api/orders/:id/confirm` | Xác nhận đơn |
| `PATCH` | `/api/orders/:id` | Sửa giỏ của đơn. Body `{items:[...]}` |
| `GET` | `/api/_store/orders` | **Cửa nhìn tầng lưu trữ** (Bài 15). Bản ghi thật đang được lưu, tên trường theo kiểu cột bảng, chưa qua tầng hiển thị. **Chỉ đọc** |
| `POST` | `/api/reset` | **Xoá sạch mọi đơn.** Dùng để dựng trạng thái sạch trước khi test |

> `/api/_store/orders` đóng vai câu `SELECT` trong dự án thật: **cùng một bản ghi, nhìn từ tầng dưới**.
> Nó cố tình dùng tên trường khác (`discount_amount`, `created_at_utc`…) để bạn phải **ánh xạ** thay vì
> so tên cho khớp. Và nó **không có đường ghi** — vì tiền điều kiện không được dựng bằng tầng lưu trữ,
> dù tầng đó đang mở.

Mọi response thành công có dạng `{"data": ...}`. Mọi response lỗi có dạng `{"error": "..."}`.

## 6. Mã định danh cho test (`data-testid`)

App đã gắn sẵn `data-testid` — bạn sẽ dùng chúng ở Bài 9 để viết locator bền.

| `data-testid` | Là gì |
|---|---|
| `khach` | Ô chọn học viên |
| `sanpham` | Ô chọn khoá học |
| `soluong` | Ô nhập số suất |
| `them` | Nút Thêm |
| `gio` | Bảng giỏ hàng (`tbody`) |
| `tam-tinh` `giam-gia` `phi-dich-vu` `tong-cong` | Bốn số tiền |
| `loi` | Khung thông báo lỗi |
| `tao-don` | Nút Tạo đơn |
| `ds-don` | Bảng danh sách đơn (`tbody`) |
