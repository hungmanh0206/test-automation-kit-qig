# Chiều coverage: Export/Import & File Output Coverage

> Tag bắt buộc trong tiêu đề case: **`[Export]`** · Mở khi: **scope có export/import file**
> Tách khỏi [`02_gen_testcases.md`](../02_gen_testcases.md) 14/08/2026. Nội dung giữ NGUYÊN VĂN.
> Chiều khác tham chiếu trong bài thì mở file tương ứng ở cùng thư mục — danh sách đủ ở bảng điều hướng của `02`.

## 7. Export/Import & File Output Coverage
Mỗi chức năng export/import phải có testcase verify (nếu applicable):
- Tên file đúng format (kèm tham số tháng/năm/filter trong tên).
- Tên sheet, header, thứ tự cột; mapping 1:1 field UI -> cột file.
- Số dòng = số bản ghi sau filter; export theo từng filter và filter kết hợp (kết quả là giao điều kiện).
- Ô rỗng đúng nghĩa (vd ngày không có dữ liệu -> cột trống, không phải 0).
- Dynamic columns theo data (vd số cột ngày = số ngày trong tháng đang chọn).
- Dataset lớn (>=100 bản ghi) không mất dòng/không timeout.
- Ký tự đặc biệt/Unicode trong cell hiển thị đúng; mở file không lỗi.
- Empty state: filter không khớp -> file rỗng/chỉ header, không crash.
