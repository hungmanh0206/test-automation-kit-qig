# [MẪU THỰC HÀNH] FSD — Màn "Tạo đơn hàng" · Hệ thống CRM nội bộ

> **Đây là tài liệu GIẢ LẬP dùng cho khoá học.** Nó được viết *cố ý* giống tài liệu thật ở dự án:
> có chỗ rõ, có chỗ mơ hồ, có chỗ mâu thuẫn, và có ghi chú quan trọng nằm ở footnote.
>
> Dùng ở **Bài 4** (so prompt sơ sài với prompt có ràng buộc) và **Bài 6** (sinh testcase).
> Không có dữ liệu thật, không có tên khách hàng thật.

---

## 1. Phạm vi

Màn `Tạo đơn hàng` cho phép nhân viên bán hàng tạo đơn cho một khách hàng đã tồn tại trong hệ thống.
Đơn sau khi tạo ở trạng thái `Nháp`, cần được duyệt trước khi gửi cho khách.

Ngoài phạm vi: nhập khách hàng mới · thanh toán · xuất hoá đơn.

## 2. Bố cục màn

Ba khối theo thứ tự từ trên xuống:

**Khối A — Thông tin khách hàng** (chỉ đọc, tự điền sau khi chọn khách)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| Mã khách hàng | text | Lấy từ ô tìm kiếm ở đầu màn |
| Tên khách hàng | text | |
| Số điện thoại | text | Định dạng `0xxxxxxxxx` |
| Hạng khách hàng | text | Một trong: `Thường` · `Bạc` · `Vàng` |

**Khối B — Danh sách sản phẩm**

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| Sản phẩm | dropdown | Bắt buộc. Chỉ hiện sản phẩm đang `Còn bán` |
| Số lượng | số nguyên | Bắt buộc, từ 1 đến 999 |
| Đơn giá | số | **Chỉ đọc** — lấy từ danh mục sản phẩm |
| Thành tiền | số | **Chỉ đọc** — `Số lượng × Đơn giá` |

Cho phép thêm tối đa **20 dòng** sản phẩm. Nút `Thêm dòng` bị vô hiệu khi đã đủ 20 dòng.

**Khối C — Tổng kết**

| Trường | Công thức |
|---|---|
| Tạm tính | Tổng `Thành tiền` của mọi dòng |
| Giảm giá | Theo hạng khách hàng — xem mục 3 |
| Phí giao hàng | `30.000` nếu Tạm tính < `500.000`, ngược lại `0` |
| **Tổng cộng** | `Tạm tính − Giảm giá + Phí giao hàng` |

## 3. Quy tắc giảm giá theo hạng khách hàng

| Hạng | Tỉ lệ giảm | Giảm tối đa |
|---|---|---|
| Thường | 0% | — |
| Bạc | 3% | 100.000 |
| Vàng | 5% | 300.000 |

Giảm giá tính trên **Tạm tính**, làm tròn xuống đến đơn vị đồng.

## 4. Luồng chính

1. Nhân viên mở màn `Tạo đơn hàng`.
2. Tìm và chọn khách hàng → Khối A tự điền.
3. Thêm ít nhất một dòng sản phẩm ở Khối B.
4. Khối C tự tính lại sau mỗi thay đổi ở Khối B.
5. Bấm `Lưu nháp` → đơn được tạo với trạng thái `Nháp`, hiện thông báo `Đã lưu đơn nháp` và chuyển sang màn
   chi tiết đơn.

## 5. Luồng lỗi

| Tình huống | Hành vi mong đợi |
|---|---|
| Chưa chọn khách hàng mà bấm `Lưu nháp` | Chặn, hiện `Vui lòng chọn khách hàng` |
| Không có dòng sản phẩm nào | Chặn, hiện `Đơn hàng phải có ít nhất một sản phẩm` |
| Số lượng = 0 hoặc để trống | Chặn tại dòng đó, hiện `Số lượng phải từ 1 đến 999` |
| Số lượng > 999 | Chặn tại dòng đó, cùng thông báo trên |
| Mất kết nối khi đang lưu | Giữ nguyên dữ liệu đã nhập, hiện `Không lưu được, vui lòng thử lại` |

## 6. Phân quyền

| Vai trò | Được làm gì trên màn này |
|---|---|
| Nhân viên bán hàng | Tạo và lưu nháp |
| Trưởng nhóm bán hàng | Tạo, lưu nháp, và duyệt đơn |
| Kế toán | **Chỉ xem** |
| Nhân viên kho | Không được vào màn này |

## 7. Yêu cầu phi chức năng

- Khối C phải tính lại xong trong vòng **300ms** sau khi người dùng đổi số lượng.
- Màn phải dùng được ở độ rộng từ 1280px trở lên.

---

## Ghi chú của BA

> ⚠️ **Ghi chú 1.** Đơn của khách hạng `Vàng` mà Tạm tính trên `10.000.000` thì cần trưởng nhóm duyệt ngay
> ở bước lưu nháp, không chờ bước duyệt riêng. *(Bổ sung sau buổi họp ngày 12 — chưa cập nhật vào mục 4.)*

> ⚠️ **Ghi chú 2.** Phí giao hàng ở mục 2 ghi mốc `500.000`, nhưng bảng giá mới nhất phòng kinh doanh gửi
> ghi mốc `700.000`. **Chưa chốt.**

> ⚠️ **Ghi chú 3.** Trường `Hạng khách hàng` hiện lấy từ hệ thống CRM. Có trường hợp khách chưa được phân
> hạng — tài liệu chưa nói lúc đó hiển thị gì và tính giảm giá thế nào.

---

## Dành cho giảng viên — những chỗ cài cắm cố ý

*(Học viên nên đọc phần này SAU khi đã tự làm bài thực hành.)*

| # | Loại | Nằm ở đâu | Điều học viên cần nhận ra |
|---|---|---|---|
| 1 | **Mâu thuẫn số** | Ghi chú 2 vs mục 2 | Hai mốc phí giao hàng khác nhau ⇒ **phải hỏi**, không được chọn bừa một con |
| 2 | **Rule nằm ngoài luồng chính** | Ghi chú 1 | Rule duyệt-ngay không có trong mục 4 ⇒ đọc mục 4 mà bỏ ghi chú là mất hẳn một nhánh |
| 3 | **Khoảng trống thật** | Ghi chú 3 | Khách chưa phân hạng: tài liệu KHÔNG có câu trả lời ⇒ đây là câu hỏi cho BA, không phải chỗ để suy đoán |
| 4 | **Trường dẫn xuất** | `Đơn giá`, `Thành tiền`, cả Khối A | Chỉ đọc ⇒ phải có case kiểm **không sửa được**, không chỉ kiểm hiển thị đúng |
| 5 | **Biên rõ** | Số lượng 1–999, tối đa 20 dòng | Có biên thì phải có case biên: 0, 1, 999, 1000, dòng thứ 20 và 21 |
| 6 | **Làm tròn** | Mục 3 "làm tròn xuống" | Cần case ra số lẻ, ví dụ Bạc 3% trên 33.333 |
| 7 | **Giảm tối đa** | Mục 3 | Vàng 5% nhưng trần 300.000 ⇒ case vượt trần là case riêng |
| 8 | **Ma trận phân quyền** | Mục 6 | 4 vai trò × các hành động ⇒ ô ngoài vùng cho phép phải bị **chặn**, không chỉ ẩn nút |
| 9 | **Chuỗi lưu trữ** | Mục 4 bước 5 | Lưu xong chuyển màn ⇒ giá trị nhập có sống sót qua chuỗi không (dùng ở Bài 19) |
| 10 | **Chữ hiển thị chính xác** | Mục 5 | Bốn thông báo lỗi có chữ cụ thể ⇒ kiểm đúng từng chữ, không kiểm "có thông báo là được" |

**Cách dùng ở Bài 4.** Cho học viên chạy hai prompt trên cùng tài liệu này. Prompt sơ sài (*"đọc file này và
viết testcase"*) thường bỏ hết ba ghi chú và không hỏi gì. Prompt có ràng buộc — buộc liệt kê chỗ mơ hồ
trước khi sinh case — thường bắt được ít nhất mâu thuẫn ở Ghi chú 2.

**Cách dùng ở Bài 6.** Bộ testcase đạt yêu cầu phải: dừng lại hỏi về 3 ghi chú thay vì đoán · có case biên
cho cả hai biên · có case cho trần giảm giá · có case phân quyền cho cả 4 vai trò.
