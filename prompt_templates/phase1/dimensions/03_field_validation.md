# Chiều coverage: Field-Level Validation

> Tag bắt buộc trong tiêu đề case: **`[Validation]`** · Mở khi: **scope có form/field nhập liệu (gần như luôn có)**
> Tách khỏi [`02_gen_testcases.md`](../02_gen_testcases.md) 14/08/2026. Bảng loại field mở rộng 09/10/2026.
> Chiều khác tham chiếu trong bài thì mở file tương ứng ở cùng thư mục. Danh sách đủ ở bảng điều hướng của `02`.

## 3. Field-Level Validation (QUAN TRỌNG)

Mỗi input field phải có TC validation riêng. Bảng dưới là **danh mục loại field**, tức mẫu số của chiều
này. Màn có loại nào thì loại đó phải có case. Loại không có trên màn thì khai `n/a` kèm lý do. Bản máy đọc
được ở [`.agent/config/ui_components.json`](../../../.agent/config/ui_components.json).

| Field Type | TCs bắt buộc |
|---|---|
| **Text (string)** | Empty, whitespace-only (phải bị từ chối), trim đầu/cuối, quá ngắn (min-1), đúng min, quá dài (max+1), đúng max, unicode tiếng Việt (phải nhận), **emoji/ký tự 4-byte** (nhận hay chặn theo spec, không vỡ/`????`), special chars `<>&"'` (phân biệt: hiển thị đúng vs chặn injection/XSS), **SQL injection** (`' OR 1=1--` phải bị escape, không thực thi — khai thác sâu ở mục 15) |
| **Email** | Format hợp lệ, thiếu `@`, thiếu domain, domain sai, **nhiều `@`**, ký tự đặc biệt trước `@`, trùng tài khoản đã có, quá dài, **case sensitivity** (`A@b.com` vs `a@b.com` coi là một hay hai) |
| **Phone / số điện thoại** | Chỉ nhận số; prefix hợp lệ theo spec (`+84`, `0`); min/max độ dài; chữ cái xen lẫn; dấu `-`, `.`, khoảng trắng (chuẩn hoá hay từ chối); mã vùng không hợp lệ; **số đã tồn tại** nếu field là unique |
| **Password** | Quá ngắn (min-1), đúng min, thiếu uppercase, thiếu number, thiếu special char (theo rule); **chặn paste/autofill vào field confirm nếu spec yêu cầu nhập tay**; **toggle hiện/ẩn** đổi đúng `type`; **confirm khớp và không khớp** là 2 case |
| **Number** | Kiểu string, số âm, số 0, vượt max, số thập phân (nếu integer), **overflow** (vượt kiểu dữ liệu, không im lặng tràn), **leading zero** (`007` lưu thành gì), định dạng currency (dấu phân tách nghìn, số chữ số thập phân — công thức ở mục 13) |
| **Dropdown/Enum/Filter** | Không chọn (required); **kiểm kê option** (đủ số lượng + đúng label/thứ tự/default so spec — mục 12); **1 case đại diện** — Dữ liệu Test ghi 1 giá trị mẫu, KHÔNG tạo 1 TC/giá trị (nổ case), nhưng steps/expected ghi rõ "lặp qua **tất cả** option, mỗi option lọc đúng tập con của nó" để Phase 2 execute vét hết; option **khác lớp hành vi** (đổi kết quả/nhánh/field/quyền) tách TC riêng; option đặc biệt "Tất cả"/"Khác"/empty; default; reset; **option bị disabled** (xem mục *Ô bị khoá* dưới) |
| **Checkbox / Radio** | Trạng thái mặc định đúng spec; tick rồi bỏ tick; required (bắt buộc tick mới cho lưu); nhóm radio chỉ chọn được 1; **bị khoá** (xem mục *Ô bị khoá* dưới); checkbox điều khiển field khác thì cả nhánh bật lẫn nhánh tắt phải có case |
| **Date** | Format sai, ngày không tồn tại (31/2), năm nhuận (29/2), ngày quá khứ/tương lai (theo rule), **min/max date** nếu spec khai, **timezone** (giá trị lưu và giá trị hiển thị — logic ở mục 13) |
| **Date/Month filter** | Mặc định đúng (vd tháng hiện tại); tháng 28 / 29 (năm nhuận) / 30 / 31 ngày; số cột/ô động phải khớp số ngày của tháng; tháng không có dữ liệu; đổi tháng -> bảng cập nhật lại |
| **Time (HH:mm)** | Biên 00:00 và 23:59; start == end; start > end (phải chặn); sai format; thiếu leading zero |
| **Date range / Time picker** | Ngày kết thúc < ngày bắt đầu (phải chặn); hai khung giờ trùng lặp; giới hạn độ dài khoảng (vd tối đa 30 ngày); khoảng nằm hoàn toàn ở quá khứ hay tương lai theo rule; chọn 1 đầu rồi bỏ dở |
| **Textarea** | Max length (và hành vi khi vượt: chặn gõ hay báo lỗi); line break giữ đúng khi lưu và khi đọc lại; HTML tag nhập vào phải hiển thị dạng chữ, không render; character counter nếu có thì đếm đúng |
| **File upload** | Sai format, đúng dung lượng max (boundary) vs vượt max (max+1), file rỗng/0 byte, đúng số lượng max vs file thứ (max+1), upload từ Resource có sẵn, **tên file ký tự đặc biệt và dấu tiếng Việt** (lưu và tải lại không vỡ tên — path traversal ở mục 15), **kéo thả so với nút chọn** nếu UI có cả hai |
| **OTP / MFA code** | Auto-focus ô tiếp theo; paste cả chuỗi vào ô đầu; mã hết hạn; mã sai quá số lần cho phép (khoá hay bắt chờ); gửi lại mã có rate limit; mã của phiên trước không dùng được |
| **Rich text (WYSIWYG)** | Tag nguy hiểm (`<script>`, `<iframe>`) bị khử chứ không lưu nguyên; paste văn bản kèm format và kèm ảnh; character counter tính theo text thô hay theo HTML markup (hai số khác nhau, spec khai số nào) |
| **Multi-select / Tag input** | Giới hạn số lượng; tag trùng (chặn hay gộp); xoá bằng Backspace và bằng nút X; tag có ký tự đặc biệt; chọn hết rồi bỏ hết (về empty đúng cách) |
| **Range slider / Stepper** | Biên min và max kéo không vượt; bước nhảy (nhập giá trị lệch step); nhập tay trực tiếp so với kéo slider cho cùng kết quả; giá trị mặc định |
| **Computed/derived field** | Mỗi field auto-derive (deadline = ngày tạo + N, approver mặc định, file naming, mapping) phải có TC kiểm derivation + 1 biên (vd deadline rơi qua cuối tháng/cuối năm, timezone) |

Màn có loại field mà bảng chưa có dòng thì **thêm dòng vào đây trước**. Đừng viết case rời. Dòng trong
bảng là thứ lượt sau đọc lại được.

## Ô bị khoá là một business rule chưa ai viết ra

Checkbox xám mờ là **disabled**, khác hẳn **không tick**. Ảnh độ phân giải thường không phân biệt nổi
hai thứ đó, nên đây là chỗ bắt buộc đọc DOM chứ không nhìn ảnh.

Thấy một ô bị khoá nghĩa là có **rule phụ thuộc** mà tài liệu chưa nêu. Phải làm hai việc:

1. Sinh case cho **cả hai chiều**: điều kiện khiến ô mở, và điều kiện khiến ô khoá.
2. Mở **câu hỏi Ambiguity Gate** về rule đó. Đoán ra rule rồi viết expected theo suy đoán là dựng
   oracle từ chính app, tức app==db mà `CLAUDE.md` §3 cấm.

Ô khoá mà không có case nào cho chiều khoá thì rule đó không ai kiểm, và nó sẽ đổi lặng lẽ.
