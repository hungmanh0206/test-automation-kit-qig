# Chiều coverage: Field-Level Validation

> Tag bắt buộc trong tiêu đề case: **`[Validation]`** · Mở khi: **scope có form/field nhập liệu (gần như luôn có)**
> Tách khỏi [`02_gen_testcases.md`](../02_gen_testcases.md) 14/08/2026. Nội dung giữ NGUYÊN VĂN.
> Chiều khác tham chiếu trong bài thì mở file tương ứng ở cùng thư mục. Danh sách đủ ở bảng điều hướng của `02`.

## 3. Field-Level Validation (QUAN TRỌNG)
Mỗi input field phải có TC validation riêng:

| Field Type | TCs bắt buộc |
|---|---|
| **Text (string)** | Empty, whitespace-only (phải bị từ chối), trim đầu/cuối, quá ngắn (min-1), đúng min, quá dài (max+1), đúng max, unicode tiếng Việt (phải nhận), **emoji/ký tự 4-byte** (nhận hay chặn theo spec, không vỡ/`????`), special chars `<>&"'` (phân biệt: hiển thị đúng vs chặn injection/XSS) |
| **Email** | Format sai (thiếu @, thiếu domain), trùng tài khoản đã có, quá dài |
| **Password** | Quá ngắn (min-1), đúng min, thiếu uppercase, thiếu number, thiếu special char (theo rule); **chặn paste/autofill vào field confirm nếu spec yêu cầu nhập tay** |
| **Number** | Kiểu string, số âm, số 0, vượt max, số thập phân (nếu integer) |
| **Dropdown/Enum/Filter** | Không chọn (required); **kiểm kê option** (đủ số lượng + đúng label/thứ tự/default so spec — mục 12); **1 case đại diện** — Dữ liệu Test ghi 1 giá trị mẫu, KHÔNG tạo 1 TC/giá trị (nổ case), nhưng steps/expected ghi rõ "lặp qua **tất cả** option, mỗi option lọc đúng tập con của nó" để Phase 2 execute vét hết; option **khác lớp hành vi** (đổi kết quả/nhánh/field/quyền) tách TC riêng; option đặc biệt "Tất cả"/"Khác"/empty; default; reset |
| **Date** | Format sai, ngày không tồn tại (31/2), ngày quá khứ/tương lai (theo rule) |
| **Date/Month filter** | Mặc định đúng (vd tháng hiện tại); tháng 28 / 29 (năm nhuận) / 30 / 31 ngày; số cột/ô động phải khớp số ngày của tháng; tháng không có dữ liệu; đổi tháng -> bảng cập nhật lại |
| **Time (HH:mm)** | Biên 00:00 và 23:59; start == end; start > end (phải chặn); sai format; thiếu leading zero |
| **Computed/derived field** | Mỗi field auto-derive (deadline = ngày tạo + N, approver mặc định, file naming, mapping) phải có TC kiểm derivation + 1 biên (vd deadline rơi qua cuối tháng/cuối năm, timezone) |
| **File upload** | Sai format, đúng dung lượng max (boundary) vs vượt max (max+1), file rỗng/0 byte, đúng số lượng max vs file thứ (max+1), upload từ Resource có sẵn |

## Ô bị khoá là một business rule chưa ai viết ra

Checkbox xám mờ là **disabled**, khác hẳn **không tick**. Ảnh độ phân giải thường không phân biệt nổi
hai thứ đó, nên đây là chỗ bắt buộc đọc DOM chứ không nhìn ảnh.

Thấy một ô bị khoá nghĩa là có **rule phụ thuộc** mà tài liệu chưa nêu. Phải làm hai việc:

1. Sinh case cho **cả hai chiều**: điều kiện khiến ô mở, và điều kiện khiến ô khoá.
2. Mở **câu hỏi Ambiguity Gate** về rule đó. Đoán ra rule rồi viết expected theo suy đoán là dựng
   oracle từ chính app, tức app==db mà `CLAUDE.md` §3 cấm.

Ô khoá mà không có case nào cho chiều khoá thì rule đó không ai kiểm, và nó sẽ đổi lặng lẽ.
