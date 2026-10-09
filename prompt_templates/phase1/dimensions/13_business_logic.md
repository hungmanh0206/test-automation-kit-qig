# Chiều coverage: Business Logic / Calculation / Data Consistency Coverage

> Tag bắt buộc trong tiêu đề case: **`[Calc]`**.
> Mở khi **scope có tính toán, rule tổ hợp, hoặc dữ liệu hiển thị ở nhiều nơi**.
>
> Tách khỏi [`02_gen_testcases.md`](../02_gen_testcases.md) 14/08/2026. Nội dung giữ NGUYÊN VĂN.
> Chiều khác tham chiếu trong bài thì mở file tương ứng ở cùng thư mục. Danh sách đủ ở bảng điều hướng của `02`.

## 13. Business Logic / Calculation / Data Consistency Coverage (BẮT BUỘC khi scope có tính toán, rule tổ hợp, hoặc dữ liệu hiển thị nhiều nơi)

Đây là nơi bug **logic hệ thống** hay lọt nhất: UI/field trông đúng nhưng **giá trị/kết quả sai**. Mọi expected trong nhóm này phải là **giá trị cụ thể tính độc lập từ input đã biết** (oracle độc lập), TUYỆT ĐỐI KHÔNG lấy từ chính build đang chạy.

- **Calculation/Formula**: mỗi giá trị được TÍNH phải có TC verify bằng **con số cụ thể tự tính tay** từ input. KHÔNG chấp nhận "hiển thị đúng". Giá trị được tính gồm tổng, subtotal, thuế, phí, giảm giá, số dư, điểm, %, trung bình, đếm, quy đổi đơn vị và tỉ giá. Kèm ít nhất 1 biên: giá trị rơi đúng mốc làm tròn, chia dư, số 0, số âm.
- **Rounding & precision**: quy tắc làm tròn (round half-up/banker), số chữ số thập phân, tiền VND không thập phân. 1 TC cho giá trị rơi đúng ranh giới làm tròn (vd `.5`).
- **Decision table đầy đủ**: rule tổ hợp nhiều điều kiện thì liệt kê ma trận `điều kiện × kết quả`. Mỗi combination quan trọng là 1 TC riêng, nhất là cặp điều kiện xung đột hoặc có thứ tự ưu tiên. Tính cả nhánh else và default.
- **Ordering/Sorting**: verify THỨ TỰ thực tế của toàn danh sách theo rule (mới nhất/alphabet/priority/custom), tie-break khi trùng khóa, asc/desc, sort kết hợp filter.
- **Aggregation vs detail**: tổng/đếm ở màn list/summary phải KHỚP tổng cộng các dòng chi tiết (vd "Tổng 5 mục" = đúng 5 dòng; "Doanh thu tháng" = Σ order trong tháng). 1 TC đối chiếu trực tiếp 2 con số.
- **Data consistency đa màn/đa nguồn**: cùng một dữ liệu hiển thị ở ≥2 nơi (list vs detail, card summary vs bảng, 2 app cross-sync) phải GIỐNG NHAU. 1 TC so sánh trực tiếp giá trị 2 nơi, không kiểm rời từng nơi.
- **Before/after mutation, tức delta đúng**: sau create, edit, delete hay approve, giá trị dẫn xuất phải cập nhật ĐÚNG DELTA. Giá trị dẫn xuất gồm count, tổng, số dư, trạng thái, danh sách. Ví dụ xoá 1 mục thì tổng giảm đúng 1 và đúng phần tiền của mục đó. Viết 1 TC chụp giá trị trước và sau rồi so delta.
- **Filter/Search logic**: kết quả = đúng tập con thỏa điều kiện (không thừa/thiếu); filter kết hợp = giao điều kiện; search khớp đúng field & mode (contains/exact/không dấu); reset trả full.
- **Phủ option của dropdown hoặc filter.** Ở gen thì 1 case đại diện, ở execute thì vét hết giá trị. KHÔNG tạo 1 TC cho mỗi giá trị, vì nổ số case. Thay vào đó làm ba việc:

  1. **Kiểm kê option.** 1 TC verify đủ số option, đúng label, đúng thứ tự, đúng default so spec (mục 12 và 14).
  2. **1 case hành vi đại diện.** Dữ liệu Test ghi 1 giá trị mẫu, nhưng steps và expected nêu rõ "lặp qua **tất cả** option, mỗi option lọc đúng tập con của nó". Phase 2 execute chạy data-driven **vét hết** giá trị, không dừng ở giá trị mẫu.
  3. **Option khác lớp hành vi thì tách TC riêng**, vì expected khác. Khác lớp nghĩa là đổi kết quả hoặc nhánh, ra empty, hiện thêm field, đổi quyền, đổi công thức.

  Luôn thêm default, empty hoặc no-match, reset, và giao điều kiện khi filter kết hợp.
- **Conditional display và derivation logic**: field hoặc section chỉ hiện theo điều kiện role, status hay loại thì phải có TC cho cả nhánh hiện lẫn nhánh ẩn. Giá trị auto-derive như default approver, deadline, mã tự sinh, mapping trạng thái thì verify đúng công thức kèm 1 biên.
- **Timezone/Date logic**: giá trị ngày/giờ tính đúng timezone, qua mốc nửa đêm/đổi ngày, DST nếu có; "hôm nay/tuần này/tháng này" tính đúng biên.
- **Đối tượng CÓ PHIÊN BẢN / hiệu lực theo thời gian (version, snapshot, bảng giá, cấu hình có ngày áp dụng)** — BẮT BUỘC khi scope có khái niệm "phiên bản" hoặc "hiệu lực từ/đến". Lớp này từng lọt nguyên cụm bug vì chỉ test "tạo bản mới thành công" mà không test **ảnh hưởng lên bản cũ và lên thứ đang trỏ tới bản cũ**:
  - **Bản cũ bị đóng đúng cách**: tạo bản mới → bản trước phải được set `end date`/hết hiệu lực đúng thời điểm (không để 2 bản cùng hiệu lực, không bỏ trống end date).
  - **Bản cũ giữ nguyên nội dung lịch sử**: sửa hoặc tạo bản mới KHÔNG được làm đổi hay **ẩn mất** phần tử đã thuộc bản cũ. Bản cũ là bằng chứng lịch sử, mất nó là mất dấu vết đối soát.
  - **Bản ghi đang trỏ tới bản cũ**: đơn/hợp đồng đã tạo theo bản cũ phải giữ giá trị theo bản cũ, KHÔNG bị kéo theo bản mới.
  - **Bản "hiện hành" là duy nhất và đúng cái**: đúng 1 bản current tại một thời điểm; action không hợp lệ trên bản current (vd xoá) phải bị chặn.
  - **Danh sách/filter/lịch sử cập nhật theo**: sau khi tạo bản mới, danh sách phiên bản, bộ lọc và cột dẫn xuất phải phản ánh đúng ngay (không cache cũ, không lệch thứ tự).

### CRUD lifecycle — một VÒNG, không phải bốn case rời

Component `crud` trong [`.agent/config/ui_components.json`](../../../.agent/config/ui_components.json).
Tạo, sửa, xoá thường được viết thành ba case độc lập, mỗi case tự kiểm "thành công". Vòng đời thì khác:
nó kiểm **bản ghi đi qua đủ các chặng mà vẫn đúng ở MỌI nơi nó xuất hiện**.

Phần lớn các chặng đã có chỗ ở chiều khác, chỉ cần trỏ tới chứ không viết lại:

| Chặng | Đã lo ở đâu |
|---|---|
| Tạo xong thì hiện đúng trong lưới, và chi tiết khớp dữ liệu vừa tạo | *Data consistency đa màn* ở trên |
| Sửa xong thì cập nhật ở **cả lưới lẫn chi tiết** | *Data consistency đa màn* ở trên |
| Giá trị dẫn xuất (đếm, tổng, trạng thái) đổi đúng delta | *Before/after mutation* ở trên |
| Save hai lần không ra hai bản ghi | [`23_db_persistence.md`](23_db_persistence.md) checklist #7 |
| Thao tác FAIL thì DB không đổi gì | [`23_db_persistence.md`](23_db_persistence.md) checklist #6 |
| Xoá mềm đúng quy ước, không phải UI ẩn mà DB còn nguyên | [`23_db_persistence.md`](23_db_persistence.md) checklist #3 |
| Hai người sửa cùng lúc | [`08_resilience.md`](08_resilience.md) |

Còn lại **ba chặng chưa chiều nào lo**, và đây mới là phần phải sinh case ở đây:

1. **Hộp xác nhận xoá có hai nhánh.** Cancel phải giữ nguyên bản ghi. Nhánh này hay bị bỏ vì nó "không
   làm gì", nhưng nút Cancel mà xoá thật thì là bug mất dữ liệu.
2. **Xoá bản ghi đang được tham chiếu.** Phải bị chặn, hoặc xoá kèm theo quy tắc rõ ràng. Hai kết quả này
   khác nhau về nghiệp vụ, nên spec không khai thì mở câu hỏi Ambiguity Gate, đừng đoán.
3. **Tạo trùng ở field unique.** Trùng y nguyên, và trùng sau khi chuẩn hoá (khác hoa thường, thừa khoảng
   trắng, khác dấu). Ba kiểu trùng đó thường cho ba kết quả khác nhau.

### 13b. Bền vững dữ liệu sau mutation — oracle PHỤ ở TẦNG BẢN GHI (chỉ 5 tình huống dưới)

**KHÔNG tạo TC riêng cho việc "kiểm DB".** Đây là **một dòng verification thêm vào chính case create, edit hay delete đã có**. Viết câu `SELECT` vào "Các bước thực hiện" và kết quả cụ thể (số dòng hoặc giá trị cột) vào "Kết quả mong đợi". Rải khắp nơi thì test dính chặt schema, đổi tên cột là gãy hàng loạt.

Cách viết SQL kèm testcase, kèm 3 luật máy gác (chỉ `SELECT`, không literal PII, có `[DbPersist]` thì phải có `SELECT`): [`23_db_persistence.md`](23_db_persistence.md) mục *KÈM CÂU SQL để QA chạy tay được*.

**Vì sao cần dù đã đọc lại bằng UI/API:** đọc lại bằng `GET`/màn list là **cùng một stack vừa ghi tự nói là đã ghi**. Với CRUD phẳng thì thế đã đủ. Nhưng 5 tình huống sau thì UI/API **không thể** phân biệt được, phải xuống tầng bản ghi:

| Kích hoạt | UI/API mù ở chỗ nào |
|---|---|
| **Soft delete vs hard delete** | Sau khi xoá, UI hết thấy và `GET` trả 404 — **giống hệt nhau ở cả hai kiểu**. Spec yêu cầu xoá cứng mà thực tế set `deleted_at` (dữ liệu cá nhân vẫn nằm đó), hoặc ngược lại xoá cứng khi spec cần khôi phục được — cả hai đều nặng và đều vô hình |
| **Cascade / bản ghi mồ côi** | Xoá/đổi bản ghi cha (course, lớp, học viên) → bản ghi con (enrollment, lịch, điểm danh, tiến độ, mapping) ra sao? Màn cha KHÔNG hiển thị chúng ⇒ orphan tồn tại mà mọi assert vẫn xanh |
| **Field không render trên màn** | `sync_status`, cột audit (`updated_by`/`updated_at`), mã nội bộ, cờ trạng thái. Không có trên UI thì không assert được, mà đó thường là chỗ ghi sai |
| **Ghi trùng** | Save 2 lần / retry mạng / double-submit → 2 bản ghi. Lưới có phân trang + sort + filter nên rất dễ không nhìn thấy; `SELECT count(*)` thấy ngay |
| **Trường dẫn xuất lệch bản ghi gốc** | Tổng/số dư/đếm được lưu sẵn (không tính lại lúc đọc) có thể lệch khỏi các dòng sinh ra nó — vd ledger có 1 giao dịch nhưng `total_due` bị trừ 2 lần. So trường tổng vs `SUM()` các dòng gốc |

**Ranh giới — giữ nguyên, không nới:**
- Chỉ qua guarded client `tests/support/setup/db/uatDbClient.ts` (UAT, SQL Server, chỉ SELECT — chặn bằng lint trong client). **KHÔNG** dựng/sửa state bằng DB — precondition vẫn `api`/`factory`/`test_hook`/`pre_existing`.
- **KHÔNG phải evidence.** Evidence vẫn là ảnh/video màn hình. Kết quả SELECT chỉ dùng để kết luận và khoanh tầng lỗi.
- **KHÔNG thay oracle từ spec.** Expected vẫn là giá trị theo tài liệu; DB chỉ trả lời "bản ghi có đúng như thế không".
- PII đọc ra phải mask, cấm ghi ra file.
- Nếu DB UAT cũng không expose được → `Automation Readiness = Needs hook`/`Manual-only`, KHÔNG bịa expected.

**Cảnh báo ngược, đừng để DB ru ngủ:** *DB đúng KHÔNG có nghĩa sản phẩm đúng.* Bản ghi chuẩn mà UI hiển thị sai thì người dùng vẫn chịu thiệt. Một assert DB xanh rất dễ khiến bỏ qua bug FE. Vì vậy dòng `db_readonly` là **bổ sung** cho assert trên UI, không bao giờ thay thế.
