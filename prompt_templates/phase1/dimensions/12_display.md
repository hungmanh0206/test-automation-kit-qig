# Chiều coverage: Display/Field Conformance Coverage

> Tag bắt buộc trong tiêu đề case: **`[Display]`** · Mở khi: **mọi màn có bảng/danh sách/field — BẮT BUỘC nếu scope có UI**
> Tách khỏi [`02_gen_testcases.md`](../02_gen_testcases.md) 14/08/2026. Nội dung giữ NGUYÊN VĂN.
> Chiều khác tham chiếu trong bài thì mở file tương ứng ở cùng thư mục — danh sách đủ ở bảng điều hướng của `02`.

## 12. Display/Field Conformance Coverage (đối chiếu tài liệu) — BẮT BUỘC cho mọi màn có bảng/danh sách/field

Đây là dimension **TÁCH RIÊNG** khỏi chức năng (mục 4) và design-token (mục 11): kiểm **hình thức hiển thị đúng như đặc tả**, để KHÔNG lọt lỗi nhỏ về tên cột, format, thứ tự, thiếu field. Đây là nơi thường bị miss nhất khi test bằng automation.

**Nguyên tắc nguồn-sự-thật (QUAN TRỌNG NHẤT — chống oracle tautological):**
- Giá trị `Kết quả mong đợi` của MỌI case hiển thị phải **TRÍCH NGUYÊN VĂN từ FS/Figma/tài liệu**, TUYỆT ĐỐI KHÔNG lấy từ giao diện build đang chạy. Recon build chỉ để biết *cách locate element*, KHÔNG để lấy *giá trị đúng*. Nếu expected suy từ build → testcase thành "build == build" → vĩnh viễn không bắt được sai lệch so với spec.
- Mỗi bảng "Name / Data type / Description" (hoặc bảng field/cột) trong FS là **checklist bắt buộc**: sinh case cho từng dòng, không bỏ sót field nào.
- **Tra `knowledge/domain/` TRƯỚC khi đi tìm lại tài liệu**: business rule đã được BA/Dev xác nhận ở task trước được lưu ở đó (kèm `source` + `examples {input, expected}` cụ thể). Dùng làm oracle và **ghi `id` rule** (vd `BR-PAYMENT-004`) vào `Kết quả mong đợi` hoặc `Assumptions` để truy nguyên. TC nào lấy rule làm oracle thì thêm TC ID vào `covered_by` của rule (skill `domain_recorder`) — nhờ đó BA đổi rule là biết ngay TC nào phải cập nhật. Rule **mới được xác nhận trong task này** cũng phải ghi vào `knowledge/domain/`. Kiểm: `npm run domain:check`.
- **Tra `knowledge/system/` cho case guard/permission/negative**: bản đồ hệ thống đã xác nhận (`npm run system:check`). Dùng làm oracle theo 3 hướng, và ghi `id` bản đồ vào `Kết quả mong đợi`/`Assumptions` để truy nguyên:
  - `state_machine` — mọi cặp `(from,to)` **không** khai trong `transitions` là **bất hợp pháp** ⇒ sinh case chứng minh hệ thống CHẶN (expected lấy từ `illegal_verified.expected`, vd "API trả 409, order giữ PAID"). Ưu tiên cặp xuất phát từ state `terminal` (đã thanh toán / đã huỷ / đã khoá) — đây là chỗ sinh bug toàn vẹn dữ liệu và bị bỏ sót nhiều nhất.
  - `permission_matrix` — `allow` là whitelist: mọi ô role×action ngoài `allow` ⇒ sinh case guard với expected = `deny_expected` (vd "403 + dữ liệu không đổi"). Case cross-role phải gọi bằng **token của role đó**, không phải role admin.
  - `shared_surface` — nếu scope đụng surface dùng chung thì **mọi `consumers`** phải có case regression (`--impact "<surface>"` liệt kê).
  Bản đồ mới xác nhận trong task này (bảng trạng thái/ma trận quyền trong FSD, hoặc dev confirm khi triage) ghi vào `knowledge/system/` — skill `system_mapper`. **TUYỆT ĐỐI không dựng bản đồ bằng cách thử API rồi ghi lại kết quả**: app đang sai thì bản đồ hợp thức hoá cái sai, TC sau đó vĩnh viễn không bắt được bug đó.

**Với mỗi màn có bảng/danh sách/field, sinh case ATOMIC — mỗi (phần tử × thuộc tính) là 1 case:**
- **Tên cột / label**: đúng CHÍNH XÁC từng ký tự theo tài liệu (vd cột phải là `Check-in`, KHÔNG phải `Checkin Time`).
- **Định dạng dữ liệu (format)**: đúng format tài liệu quy định — ngày, giờ (`hh:mm`), datetime (`DD/MM/YYYY hh:mm hh:mm`), số/tiền/công (số chữ số thập phân). 1 case cho mỗi field có format.
- **Số lượng cột + đủ tên + đúng thứ tự**: bảng phải có ĐÚNG các cột tài liệu liệt kê, đúng thứ tự → bắt cột thiếu/thừa/sai tên (1 case/bảng, liệt kê danh sách cột expected verbatim).
- **Field bắt buộc hiển thị**: mọi field tài liệu mô tả phải có mặt (kể cả field chỉ áp dụng 1 nhóm đối tượng → xác nhận rule ẩn/hiện theo spec).
- **Empty-state text / placeholder / label nút / label tab / tiêu đề màn-modal**: đúng chuỗi tài liệu.
- **Giá trị "để trống" đúng nghĩa** (vd buổi chưa diễn ra → cột công **trống**, KHÔNG phải `0`).
- **Field DẪN XUẤT phải bị KHOÁ theo nguồn, không chỉ "có mặt"**: field mà spec nói lấy giá trị từ bản ghi khác (transaction lấy tài khoản thụ hưởng của order, dòng con lấy đơn vị tiền của version…) cần **2 case**: (a) field không cho chọn/nhập lệch nguồn — hoặc nếu cho đổi thì đúng như spec cho phép; (b) giá trị ghi xuống/đồng bộ đi **trùng nguồn**. Vì sao tách ra: case dạng "form hiển thị đủ field X" **PASS ngay cả khi field đó cho chọn tự do**, nên cả một lớp bug "mỗi nơi một giá trị" lọt sạch. Đo 14/08/2026 trên bộ 530: `TC_175` liệt kê form Add Transaction CÓ field Recipient Bank Account nhưng không phát biểu ràng buộc ⇒ bug `CSDL-28420` (modal cho chọn pháp nhân khác order, HubSpot ghi sai pháp nhân) **không TC nào bắt được**.

**BẮT BUỘC sinh ARTIFACT kiểm được, không chỉ sinh case bằng chữ** — đây là chỗ đã từng hỏng: mục 12 này viết đủ nhưng một bộ 530 case thật chỉ có 12% là case hiển thị, không ai dựng catalog, và cả cụm bug "thiếu trường / thừa cột / hai màn lệch nhãn" lọt hết.
1. Với **mỗi màn trong scope**, thêm 1 dòng vào `<TASK_OUTPUT_DIR>/requirements/ui_catalog.json` (schema: `scripts/qa/ui_conformance_check.js`) gồm:
   - `table.expectedColumns` — danh sách cột **verbatim + đúng thứ tự** (bắt thiếu/thừa/sai tên cột);
   - `fields[]` — với **mỗi section/form**: `{containerSelector, expectedFields[]}` = **TẬP field** tài liệu quy định. Đây là thứ duy nhất bắt được "section thiếu 1 trường" và "màn mọc thêm trường lạ" — case theo bước không bao giờ thấy, vì thiếu field thì mọi step vẫn chạy xanh;
   - `texts[]` cho empty-state/label/tiêu đề.
2. Màn nào hiển thị **cùng một dữ liệu ở ≥2 chỗ** (vd Create/Edit và Order detail) → khai `fields` cho **cả hai** với cùng `expectedFields`. Lệch nhãn giữa 2 màn chỉ lộ khi cả hai cùng bị đối chiếu với một danh sách.
3. Phase 2 **phải chạy** `node scripts/qa/ui_conformance_check.js --catalog <ui_catalog.json>`; sai lệch báo ra là bug hiển thị, không được tự bỏ qua.

**Khung hoài nghi bắt buộc**: giả định build CÓ THỂ lệch tài liệu; nhiệm vụ là ĐỐI CHIẾU ngược build vs tài liệu và liệt kê MỌI khác biệt (kể cả nhỏ: hoa/thường, `-` vs `/`, thiếu 1 cột). KHÔNG mặc định build đúng, KHÔNG tự lọc bỏ "lỗi nhỏ".

Nếu màn không có đặc tả hiển thị bằng text (chỉ có Figma) → lấy expected từ Figma; nếu không có cả hai → ghi `N/A + lý do` trong Coverage Gaps, không bỏ qua im lặng.
