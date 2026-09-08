# [MẪU THỰC HÀNH] FSD — Màn "Lớp › Học viên" · Hệ thống vận hành nội bộ

> **Đây là tài liệu GIẢ LẬP dùng cho tài liệu này.** Nó được viết *cố ý* giống tài liệu thật ở dự án:
> có chỗ rõ, có chỗ mơ hồ, có chỗ mâu thuẫn, và có ghi chú quan trọng nằm ở cuối.
>
> Dùng ở **Bài 15** (giao việc sinh testcase cho agent) và ở bài về prompt.
> Không có dữ liệu thật, không có tên học viên thật.

---

## 1. Phạm vi

Màn `Lớp › Học viên` cho phép nhân viên vận hành xem danh sách học viên trong một lớp, **cắt hạn** lớp cũ
khi học viên đăng ký học lại, và **gia hạn** thêm ngày truy cập cho học viên có lý do chính đáng.

Ngoài phạm vi: tạo lớp mới · nhập học viên mới · điểm danh · thu học phí.

## 2. Bố cục màn

Ba khối theo thứ tự từ trên xuống:

**Khối A — Thông tin lớp** (chỉ đọc, tự điền sau khi chọn lớp)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| Mã lớp | text | Lấy từ ô chọn lớp ở đầu màn |
| Tên lớp | text | |
| Loại lớp | text | Một trong: `Lớp chính` · `Foundation` · `Revision` |
| Thời hạn lớp | text | Dạng `dd/mm/yyyy - dd/mm/yyyy` |

**Khối B — Danh sách học viên trong lớp**

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| Học viên | text | **Chỉ đọc** — lấy từ danh mục học viên |
| Loại | text | **Chỉ đọc** — một trong `Thường` · `Học lại` · `Bảo lưu` |
| Thời hạn | text | **Chỉ đọc** — thời hạn riêng của học viên trong lớp này |
| Số ngày gia hạn | số nguyên | Bắt buộc khi gia hạn, từ 1 đến 180 |
| Lý do gia hạn | text | Bắt buộc khi gia hạn, tối đa 60 ký tự |
| Ngày hết hạn | text | **Chỉ đọc** — `Thời hạn kết thúc + Số ngày gia hạn` |

Bảng hiện tối đa **20 dòng** mỗi trang. Nút `Trang sau` bị vô hiệu ở trang cuối.

**Khối C — Đồng bộ học lại**

| Trường | Cách tính |
|---|---|
| Lớp cũ | Lớp học viên đang xin học lại |
| Lớp lấy làm mốc | Lớp mới bắt đầu sớm nhất — xem mục 3 |
| Hạn hiện tại | Thời hạn kết thúc đang lưu của học viên ở lớp cũ |
| **Hạn mới** | `Ngày bắt đầu của lớp mốc − 1 ngày` |

## 3. Quy tắc chọn lớp mốc

| Loại lớp mới | Được dùng làm mốc |
|---|---|
| Lớp chính | Có |
| Foundation | Không |
| Revision | Không |

Trong số các lớp được dùng làm mốc, lấy lớp có **ngày bắt đầu sớm nhất**.

## 4. Luồng chính

1. Nhân viên mở màn `Lớp › Học viên`.
2. Chọn lớp → Khối A tự điền, Khối B tải danh sách học viên.
3. Chọn học viên ở Khối C rồi bấm `Xem hạn mới` → bốn ô của Khối C được điền, **chưa ghi gì**.
4. Bấm `Áp dụng hạn mới` → thời hạn của học viên ở lớp cũ được cập nhật, `Loại` chuyển sang `Học lại`,
   và Khối B tải lại.
5. Để gia hạn: mở menu `⋮` của một hàng → `Gia hạn` → nhập số ngày và lý do → bấm `Lưu`, hiện thông báo
   `Đã cập nhật thời hạn` và bảng tải lại.

## 5. Luồng lỗi

| Tình huống | Hành vi mong đợi |
|---|---|
| Chưa chọn học viên mà bấm `Xem hạn mới` | Chặn, hiện `Vui lòng chọn học viên` |
| Học viên không có đơn học lại | Chặn, hiện `Học viên này không có đơn học lại` |
| Số ngày gia hạn = 0 hoặc để trống | Chặn, hiện `Số ngày gia hạn phải từ 1 đến 180` |
| Số ngày gia hạn > 180 | Chặn, cùng thông báo trên |
| Để trống lý do gia hạn | Chặn, hiện `Vui lòng nhập lý do gia hạn` |
| Mất kết nối khi đang lưu | Giữ nguyên dữ liệu đã nhập, hiện `Không lưu được, vui lòng thử lại` |

## 6. Phân quyền

| Vai trò | Được làm gì trên màn này |
|---|---|
| Nhân viên vận hành | Xem, gia hạn, đồng bộ học lại |
| Trưởng bộ phận vận hành | Xem, gia hạn, đồng bộ, và duyệt gia hạn dài |
| Kế toán | **Chỉ xem** |
| Giảng viên | Không được vào màn này |

## 7. Yêu cầu phi chức năng

- Khối C phải tính xong trong vòng **300ms** sau khi người dùng bấm `Xem hạn mới`.
- Màn phải dùng được ở độ rộng từ 1280px trở lên.

---

## Ghi chú của BA

> ⚠️ **Ghi chú 1.** Học viên đã học quá `50%` tiến độ lớp cũ thì việc gia hạn cần trưởng bộ phận duyệt
> ngay ở bước `Lưu`, không chờ bước duyệt riêng. *(Bổ sung sau buổi họp ngày 12 — chưa cập nhật vào mục 4.)*

> ⚠️ **Ghi chú 2.** Số ngày gia hạn ở mục 2 ghi tối đa `180`, nhưng quy định mới nhất phòng vận hành gửi
> ghi tối đa `365`. **Chưa chốt.**

> ⚠️ **Ghi chú 3.** Có trường hợp học viên xin học lại nhưng **chưa được xếp vào lớp mới nào** — tài liệu
> chưa nói lúc đó Khối C hiển thị gì và thời hạn lớp cũ được xử lý thế nào.

---

## Dành cho người hướng dẫn — những chỗ cài cắm cố ý

*(Đọc phần này SAU khi đã tự làm bài thực hành.)*

| # | Loại | Nằm ở đâu | Điều cần nhận ra |
|---|---|---|---|
| 1 | **Mâu thuẫn số** | Ghi chú 2 vs mục 2 | Hai mức trần gia hạn khác nhau ⇒ **phải hỏi**, không được chọn bừa một con |
| 2 | **Rule nằm ngoài luồng chính** | Ghi chú 1 | Rule duyệt-ngay không có trong mục 4 ⇒ đọc mục 4 mà bỏ ghi chú là mất hẳn một nhánh |
| 3 | **Khoảng trống thật** | Ghi chú 3 | Chưa xếp lớp mới: tài liệu KHÔNG có câu trả lời ⇒ đây là câu hỏi cho BA, không phải chỗ để suy đoán |
| 4 | **Trường dẫn xuất** | `Thời hạn`, `Ngày hết hạn`, cả Khối A | Chỉ đọc ⇒ phải có case kiểm **không sửa được**, không chỉ kiểm hiển thị đúng |
| 5 | **Biên rõ** | Số ngày 1–180, lý do 60 ký tự, 20 dòng mỗi trang | Có biên thì phải có case biên: 0, 1, 180, 181, ký tự thứ 60 và 61, dòng thứ 20 và 21 |
| 6 | **Biên ngày qua mốc** | Mục 2 Khối C, phép `− 1 ngày` | Lớp mốc bắt đầu `01/01` ⇒ hạn mới rơi sang `31/12` năm trước. Cần case qua mốc tháng và mốc năm |
| 7 | **Nhánh chặn hạn âm** | Mục 2 Khối C vs Khối A | Hạn mới có thể sớm hơn ngày bắt đầu lớp cũ ⇒ tài liệu không nói xử lý sao, và đó là case riêng |
| 8 | **Ma trận phân quyền** | Mục 6 | 4 vai trò × các hành động ⇒ ô ngoài vùng cho phép phải bị **chặn**, không chỉ ẩn nút |
| 9 | **Chuỗi lưu trữ** | Mục 4 bước 5 | Lưu xong bảng tải lại ⇒ giá trị vừa nhập có sống sót qua chuỗi không |
| 10 | **Chữ hiển thị chính xác** | Mục 5 | Sáu thông báo lỗi có chữ cụ thể ⇒ kiểm đúng từng chữ, không kiểm "có thông báo là được" |

**Cách dùng với prompt.** Chạy hai prompt trên cùng tài liệu này. Prompt sơ sài (*"đọc file này và
viết testcase"*) thường bỏ hết ba ghi chú và không hỏi gì. Prompt có ràng buộc — buộc liệt kê chỗ mơ hồ
trước khi sinh case — thường bắt được ít nhất mâu thuẫn ở Ghi chú 2.

**Cách dùng ở Bài 15.** Bộ testcase đạt yêu cầu phải: dừng lại hỏi về 3 ghi chú thay vì đoán · có case
biên cho cả hai đầu · có case cho nhánh chặn hạn âm · có case phân quyền cho cả 4 vai trò.
