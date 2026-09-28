# Chiều coverage: BE Response Data Conformance Coverage

> Tag bắt buộc trong tiêu đề case: **`[BEData]`**.
> Mở khi **mọi màn hoặc endpoint có dữ liệu từ BE**. BẮT BUỘC nếu có mapping field.
>
> Tách khỏi [`02_gen_testcases.md`](../02_gen_testcases.md) 14/08/2026. Nội dung giữ NGUYÊN VĂN.
> Chiều khác tham chiếu trong bài thì mở file tương ứng ở cùng thư mục. Danh sách đủ ở bảng điều hướng của `02`.

## 14. BE Response Data Conformance Coverage (BẮT BUỘC cho mọi màn/endpoint có dữ liệu từ BE)

Tách riêng khỏi API contract ở mục 5, vốn thiên về status và schema. Nhóm này kiểm **GIÁ TRỊ dữ liệu BE trả về** và **mapping BE sang UI**. Đó là nơi bug field trống, sai giá trị, thiếu field hay lọt.

- **Value đúng, không chỉ schema**: response chứa đúng GIÁ TRỊ nghiệp vụ (id/tên/số/trạng thái/quan hệ), không chỉ đúng kiểu. TC assert giá trị cụ thể.
- **Null vs empty vs missing vs 0**: phân biệt rõ `null` / chuỗi `""` / mảng `[]` / thiếu hẳn key / `0`. TC xác định BE PHẢI trả trạng thái nào theo spec (vd "chưa có công" → field vắng hay `null` hay `0`?), vì UI render mỗi trạng thái mỗi khác.
- **BE → UI mapping (field trống nghi ngờ)**: mỗi field UI hiển thị trống/`-`/`N/A` phải có TC đối chiếu response — BE có trả giá trị không? BE trả có mà UI trống = **FE bug**; BE trả rỗng trái spec = **BE bug**; cả hai đều là product bug, KHÔNG bỏ qua.
- **SAI NGUỒN dù CÓ giá trị.** Đây là điểm mù đắt nhất và là mục bắt buộc. Field hiển thị đầy đủ, không trống, không lỗi, nhưng lấy từ **đối tượng hoặc property SAI**.
  Ví dụ: lấy từ Deal trong khi spec nói lấy từ Contact; đọc nhầm property "học phí nộp thực tế" cho một loại đơn không dùng field đó; tài khoản nhận hiển thị khác tài khoản đã cấu hình.
  Oracle kiểu "có dữ liệu", "populate" hay "hiển thị đúng" **KHÔNG BAO GIỜ** bắt được lớp này, vì field nhầm nguồn vẫn populate. Vì vậy:
  - `Kết quả mong đợi` phải khai **HAI ĐẦU**: `<field UI>` = `<nguồn cụ thể>` (object + property), vd `Customer Email = Contact.email của deal đang chọn`, KHÔNG viết "hiển thị đúng email".
  - Chọn **giá trị phân biệt được nguồn**: cố ý dùng data mà Contact và Deal khác nhau. Nếu 2 nguồn trùng giá trị thì case đó **không chứng minh được gì**, phải đổi data hoặc ghi Coverage Gap.
  - Nếu task có **bảng mapping field** (`requirements/**/field_mapping*.{json,md}` hoặc mapping sheet trong FSD): **mỗi dòng của bảng = ≥1 case đối chiếu giá trị**, không gộp thành 1 case "map đủ field". Ghi tên field nguồn vào `Dữ liệu Test` để truy nguyên.
- **Định dạng & đơn vị khi đẩy đi**: giá trị gửi sang hệ khác phải đúng **định dạng và đơn vị tiền tệ** của bên nhận (USD ≠ đ; số thập phân; ×100 hay không). Trạng thái "đồng bộ thành công" **KHÔNG** chứng minh giá trị đúng — case phải đọc lại giá trị **ở phía nhận** và so bằng.
- **Foreign key resolution**: id tham chiếu resolve đúng tên/label (vd `ownerId` → đúng tên owner), không lộ id thô, không `undefined`/`[object Object]`.
- **Enum/status value**: BE trả đúng tập enum hợp lệ; UI map đúng nhãn từng enum; enum lạ/không map → xử lý an toàn.
- **Pagination/metadata**: `total`/`page`/`pageSize`/`hasNext` đúng; `total` khớp số bản ghi thực; trang cuối/trang rỗng đúng; đổi pageSize không mất/nhân đôi bản ghi.
- **Nested/list completeness**: object lồng & mảng trả đủ phần tử con (không cắt cụt), đúng thứ tự; mỗi phần tử đủ field cho UI.
- **Default value từ BE**: field có default do BE set (trạng thái khởi tạo, cờ, ngày tạo) trả đúng default.
- **Serialization**: date/number serialize đúng (ISO/epoch, number vs string, đơn vị tiền/giờ), không lệch timezone, không mất độ chính xác.
- **Sensitive/internal field**: response KHÔNG lộ field nội bộ/nhạy cảm (password hash, token, internal flag, PII vượt quyền) — bắc cầu mục 15.
- **Error payload**: response lỗi trả đúng `code`/`message`/`field` theo spec để UI hiển thị đúng; không nuốt lỗi thành `200` rỗng.
