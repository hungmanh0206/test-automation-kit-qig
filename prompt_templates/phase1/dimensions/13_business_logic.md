# Chiều coverage: Business Logic / Calculation / Data Consistency Coverage

> Tag bắt buộc trong tiêu đề case: **`[Calc]`** · Mở khi: **scope có tính toán, rule tổ hợp, hoặc dữ liệu hiển thị ở nhiều nơi**
> Tách khỏi [`02_gen_testcases.md`](../02_gen_testcases.md) 14/08/2026. Nội dung giữ NGUYÊN VĂN.
> Chiều khác tham chiếu trong bài thì mở file tương ứng ở cùng thư mục — danh sách đủ ở bảng điều hướng của `02`.

## 13. Business Logic / Calculation / Data Consistency Coverage (BẮT BUỘC khi scope có tính toán, rule tổ hợp, hoặc dữ liệu hiển thị nhiều nơi)

Đây là nơi bug **logic hệ thống** hay lọt nhất: UI/field trông đúng nhưng **giá trị/kết quả sai**. Mọi expected trong nhóm này phải là **giá trị cụ thể tính độc lập từ input đã biết** (oracle độc lập), TUYỆT ĐỐI KHÔNG lấy từ chính build đang chạy.

- **Calculation/Formula**: mỗi giá trị được TÍNH (tổng, subtotal, thuế, phí, giảm giá, số dư, điểm, %, trung bình, đếm, quy đổi đơn vị/tỉ giá) có TC verify bằng **con số cụ thể tự tính tay** từ input — KHÔNG chấp nhận "hiển thị đúng". Kèm ≥1 biên (giá trị rơi đúng mốc làm tròn, chia dư, số 0, số âm).
- **Rounding & precision**: quy tắc làm tròn (round half-up/banker), số chữ số thập phân, tiền VND không thập phân. 1 TC cho giá trị rơi đúng ranh giới làm tròn (vd `.5`).
- **Decision table đầy đủ**: rule tổ hợp nhiều điều kiện → liệt kê ma trận `điều kiện × kết quả`; mỗi combination quan trọng (nhất là cặp điều kiện xung đột/ưu tiên) là 1 TC riêng, gồm cả nhánh else/default.
- **Ordering/Sorting**: verify THỨ TỰ thực tế của toàn danh sách theo rule (mới nhất/alphabet/priority/custom), tie-break khi trùng khóa, asc/desc, sort kết hợp filter.
- **Aggregation vs detail**: tổng/đếm ở màn list/summary phải KHỚP tổng cộng các dòng chi tiết (vd "Tổng 5 mục" = đúng 5 dòng; "Doanh thu tháng" = Σ order trong tháng). 1 TC đối chiếu trực tiếp 2 con số.
- **Data consistency đa màn/đa nguồn**: cùng một dữ liệu hiển thị ở ≥2 nơi (list vs detail, card summary vs bảng, 2 app cross-sync) phải GIỐNG NHAU. 1 TC so sánh trực tiếp giá trị 2 nơi, không kiểm rời từng nơi.
- **Before/after mutation (delta đúng)**: sau create/edit/delete/approve, giá trị dẫn xuất (count, tổng, số dư, trạng thái, danh sách) cập nhật ĐÚNG DELTA (xóa 1 mục → tổng giảm đúng 1 và đúng phần tiền của mục đó). 1 TC chụp giá trị trước và sau, so delta.
- **Filter/Search logic**: kết quả = đúng tập con thỏa điều kiện (không thừa/thiếu); filter kết hợp = giao điều kiện; search khớp đúng field & mode (contains/exact/không dấu); reset trả full.
- **Phủ option của dropdown/filter (1 case đại diện ở gen, execute vét hết giá trị)**: KHÔNG tạo 1 TC cho mỗi giá trị (nổ số case). Thay vào đó — (a) **kiểm kê option**: 1 TC verify đủ số option + đúng label/thứ tự/default so spec (mục 12/14); (b) **1 case hành vi đại diện**: Dữ liệu Test ghi 1 giá trị mẫu, nhưng steps/expected nêu rõ "lặp qua **tất cả** option, mỗi option lọc đúng tập con của nó" → Phase 2 execute chạy data-driven **vét hết** giá trị (không dừng ở giá trị mẫu); (c) option **khác lớp hành vi** (đổi kết quả/nhánh, ra empty, hiện thêm field, đổi quyền, đổi công thức) → tách TC riêng vì expected khác. Luôn thêm default, empty/no-match, reset, và giao điều kiện khi filter kết hợp.
- **Conditional display/derivation logic**: field/section chỉ hiện theo điều kiện (role/status/loại) → TC cả nhánh hiện lẫn nhánh ẩn; giá trị auto-derive (default approver, deadline, mã tự sinh, mapping trạng thái) verify đúng công thức + 1 biên.
- **Timezone/Date logic**: giá trị ngày/giờ tính đúng timezone, qua mốc nửa đêm/đổi ngày, DST nếu có; "hôm nay/tuần này/tháng này" tính đúng biên.
- **Đối tượng CÓ PHIÊN BẢN / hiệu lực theo thời gian (version, snapshot, bảng giá, cấu hình có ngày áp dụng)** — BẮT BUỘC khi scope có khái niệm "phiên bản" hoặc "hiệu lực từ/đến". Lớp này từng lọt nguyên cụm bug vì chỉ test "tạo bản mới thành công" mà không test **ảnh hưởng lên bản cũ và lên thứ đang trỏ tới bản cũ**:
  - **Bản cũ bị đóng đúng cách**: tạo bản mới → bản trước phải được set `end date`/hết hiệu lực đúng thời điểm (không để 2 bản cùng hiệu lực, không bỏ trống end date).
  - **Bản cũ giữ nguyên nội dung lịch sử**: sửa/tạo bản mới KHÔNG được làm đổi hay **ẩn mất** phần tử đã thuộc bản cũ (bản cũ là bằng chứng lịch sử — mất là mất dấu vết đối soát).
  - **Bản ghi đang trỏ tới bản cũ**: đơn/hợp đồng đã tạo theo bản cũ phải giữ giá trị theo bản cũ, KHÔNG bị kéo theo bản mới.
  - **Bản "hiện hành" là duy nhất và đúng cái**: đúng 1 bản current tại một thời điểm; action không hợp lệ trên bản current (vd xoá) phải bị chặn.
  - **Danh sách/filter/lịch sử cập nhật theo**: sau khi tạo bản mới, danh sách phiên bản, bộ lọc và cột dẫn xuất phải phản ánh đúng ngay (không cache cũ, không lệch thứ tự).

### 13b. Bền vững dữ liệu sau mutation — oracle PHỤ ở TẦNG BẢN GHI (chỉ 5 tình huống dưới)

**KHÔNG tạo TC riêng cho việc "kiểm DB".** Đây là **một dòng verification thêm vào chính case create/edit/delete đã có** — viết vào cột verification dạng `db_readonly: SELECT … FROM … WHERE …` kèm kết quả mong đợi cụ thể (số dòng / giá trị cột). Rải khắp nơi là làm test dính chặt schema, đổi tên cột là gãy hàng loạt.

**Vì sao cần dù đã đọc lại bằng UI/API:** đọc lại bằng `GET`/màn list là **cùng một stack vừa ghi tự nói là đã ghi**. Với CRUD phẳng thì thế đã đủ. Nhưng 5 tình huống sau thì UI/API **không thể** phân biệt được, phải xuống tầng bản ghi:

| Kích hoạt | UI/API mù ở chỗ nào |
|---|---|
| **Soft delete vs hard delete** | Sau khi xoá, UI hết thấy và `GET` trả 404 — **giống hệt nhau ở cả hai kiểu**. Spec yêu cầu xoá cứng mà thực tế set `deleted_at` (dữ liệu cá nhân vẫn nằm đó), hoặc ngược lại xoá cứng khi spec cần khôi phục được — cả hai đều nặng và đều vô hình |
| **Cascade / bản ghi mồ côi** | Xoá/đổi bản ghi cha (course, lớp, học viên) → bản ghi con (enrollment, lịch, điểm danh, tiến độ, mapping) ra sao? Màn cha KHÔNG hiển thị chúng ⇒ orphan tồn tại mà mọi assert vẫn xanh |
| **Field không render trên màn** | `sync_status`, cột audit (`updated_by`/`updated_at`), mã nội bộ, cờ trạng thái. Không có trên UI thì không assert được, mà đó thường là chỗ ghi sai |
| **Ghi trùng** | Save 2 lần / retry mạng / double-submit → 2 bản ghi. Lưới có phân trang + sort + filter nên rất dễ không nhìn thấy; `SELECT count(*)` thấy ngay |
| **Trường dẫn xuất lệch bản ghi gốc** | Tổng/số dư/đếm được lưu sẵn (không tính lại lúc đọc) có thể lệch khỏi các dòng sinh ra nó — vd ledger có 1 giao dịch nhưng `total_due` bị trừ 2 lần. So trường tổng vs `SUM()` các dòng gốc |

**Ranh giới — giữ nguyên, không nới:**
- Chỉ qua guarded client `tests/support/setup/db/uatPgClient.ts` (UAT, `BEGIN TRANSACTION READ ONLY`, chỉ SELECT). **KHÔNG** dựng/sửa state bằng DB — precondition vẫn `api`/`factory`/`test_hook`/`pre_existing`.
- **KHÔNG phải evidence.** Evidence vẫn là ảnh/video màn hình. Kết quả SELECT chỉ dùng để kết luận và khoanh tầng lỗi.
- **KHÔNG thay oracle từ spec.** Expected vẫn là giá trị theo tài liệu; DB chỉ trả lời "bản ghi có đúng như thế không".
- PII đọc ra phải mask, cấm ghi ra file.
- Nếu DB UAT cũng không expose được → `Automation Readiness = Needs hook`/`Manual-only`, KHÔNG bịa expected.

**Cảnh báo ngược — đừng để DB ru ngủ:** *DB đúng KHÔNG có nghĩa sản phẩm đúng.* Bản ghi chuẩn mà UI hiển thị sai thì người dùng vẫn chịu thiệt, và một assert DB xanh rất dễ khiến bỏ qua bug FE. Vì vậy dòng `db_readonly` là **bổ sung** cho assert trên UI, không bao giờ thay thế.
